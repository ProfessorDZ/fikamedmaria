/* =====================================================================
   Fika med Maria — admin area (admin.html). Ukrainian only.
   Sections (hash routes): #produkty  #vmist[/<id>]  #uchni  #zamovlennia  #roboty
   Lesson content is a list of blocks (table lesson_blocks), drawn by
   assets/admin-blocks.js; this file does the database work for it.
   * Real mode: reads and writes through the supabase-js client of
     FMMAccount.client() (the database rules let only an admin do this) and
     calls the Edge Function admin-grant-access with the admin's token.
   * Demo mode (?demo=1): a small in-memory database seeded from
     window.FMM_DEMO. Nothing is sent anywhere, nothing is saved.
   Everything that comes from the database is put on the page with
   textContent (never as HTML). The only innerHTML is the text preview, and
   its source is escaped first.
   Spec: fikamedmaria-backend/docs/platform-spec.md (section 4, admin.html).
   ===================================================================== */
(function () {
  "use strict";

  /* =================================================================
     1. Pure helpers (no page needed; exported for the tests)
     ================================================================= */
  var KINDS = [
    ["course", "Курс"],
    ["lesson", "Готовий урок"],
    ["book", "Підручник"],
    ["teacher_course", "Курс для викладачів"],
    ["magazine_subscription", "Підписка на журнал"],
    ["magazine_issue", "Номер журналу"],
    ["podcast_subscription", "Підписка на подкаст"],
    ["live_lesson", "Живе заняття"],
    ["live_package", "Пакет живих занять"]
  ];
  var KIND_LABEL = {};
  KINDS.forEach(function (k) { KIND_LABEL[k[0]] = k[1]; });

  var ORDER_STATUS = {
    pending: ["Очікує оплати", "is-muted"],
    paid: ["Оплачено", "is-ok"],
    partially_refunded: ["Частково повернуто", "is-warn"],
    refunded: ["Повернуто", "is-warn"],
    disputed: ["Спір", "is-warn"],
    failed: ["Не вдалося", "is-warn"],
    canceled: ["Скасовано", "is-muted"]
  };
  var SOURCE_LABEL = { purchase: "Купівля", subscription: "Підписка", admin_grant: "Відкрито вручну" };

  var SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
  var MD_LIMIT = 100000;

  function num(x) { var n = Number(x); return isFinite(n) ? n : 0; }
  function trim(s) { return String(s == null ? "" : s).replace(/^\s+|\s+$/g, ""); }
  function same(a, b) { return String(a) === String(b); }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function billingFor(kind) {
    return kind === "magazine_subscription" || kind === "podcast_subscription" ? "subscription" : "one_time";
  }

  /* Returns "" when fine, otherwise a Ukrainian message. */
  function checkSlug(slug) {
    slug = String(slug == null ? "" : slug);
    if (!trim(slug)) return "Напиши адресу продукту (латиницею).";
    if (slug.length > 80) return "Адреса задовга: найбільше 80 символів.";
    if (!SLUG_RE.test(slug)) {
      return "Тільки малі англійські літери, цифри та дефіси між ними. Наприклад: svenska-a1-forsta-steget";
    }
    return "";
  }

  /* "12,50" -> { ok:true, cents:1250 }; "" -> { ok:true, cents:null } (no price yet) */
  function parsePrice(text) {
    var s = String(text == null ? "" : text).replace(/[\s  ]/g, "").replace(/€/g, "").replace(/eur$/i, "");
    if (s === "") return { ok: true, cents: null };
    if (!/^\d+([.,]\d{1,2})?$/.test(s)) {
      return { ok: false, cents: null, error: "Ціна має бути числом, наприклад 12 або 12,50." };
    }
    var parts = s.replace(",", ".").split(".");
    var frac = parts[1] || "0";
    if (frac.length === 1) frac += "0";
    var cents = parseInt(parts[0], 10) * 100 + parseInt(frac, 10);
    if (cents > 9999999) return { ok: false, cents: null, error: "Ціна занадто велика. Перевір, чи немає зайвих цифр." };
    return { ok: true, cents: cents };
  }

  function formatMoney(cents, currency) {
    if (cents == null || cents === "") return "";
    var n = num(cents) / 100;
    var s = (Math.round(n * 100) % 100 === 0) ? String(Math.round(n)) : n.toFixed(2).replace(".", ",");
    var cur = currency || "EUR";
    return s + " " + (cur === "EUR" ? "€" : cur);
  }

  /* For the price field: 1250 -> "12,50", 4900 -> "49" */
  function centsToInput(cents) {
    if (cents == null) return "";
    var n = num(cents);
    if (n % 100 === 0) return String(n / 100);
    return (n / 100).toFixed(2).replace(".", ",");
  }

  var TRANSLIT = {
    "а": "a", "б": "b", "в": "v", "г": "h", "ґ": "g", "д": "d", "е": "e", "є": "ie", "ж": "zh", "з": "z",
    "и": "y", "і": "i", "ї": "i", "й": "i", "к": "k", "л": "l", "м": "m", "н": "n", "о": "o", "п": "p",
    "р": "r", "с": "s", "т": "t", "у": "u", "ф": "f", "х": "kh", "ц": "ts", "ч": "ch", "ш": "sh",
    "щ": "shch", "ь": "", "ю": "iu", "я": "ia", "ы": "y", "э": "e", "ъ": "", "ё": "io",
    "å": "a", "ä": "a", "ö": "o", "ł": "l", "ø": "o", "æ": "ae", "ß": "ss", "đ": "d",
    "'": "", "’": "", "ʼ": "", "`": ""
  };

  /* Any text -> latin letters, digits and dashes */
  function slugify(text) {
    var s = String(text == null ? "" : text).toLowerCase(), out = "", i, ch;
    for (i = 0; i < s.length; i++) {
      ch = s.charAt(i);
      out += Object.prototype.hasOwnProperty.call(TRANSLIT, ch) ? TRANSLIT[ch] : ch;
    }
    if (typeof out.normalize === "function") out = out.normalize("NFD").replace(/[̀-ͯ]/g, "");
    return out.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60).replace(/-+$/, "");
  }

  /* "Урок 1 (фінал).PDF" -> "urok-1-final.pdf" */
  function safeFilename(name) {
    name = String(name == null ? "" : name);
    name = name.replace(/^.*[\\\/]/, "");
    var dot = name.lastIndexOf(".");
    var base = dot > 0 ? name.slice(0, dot) : name;
    var ext = dot > 0 ? name.slice(dot + 1) : "";
    base = slugify(base).slice(0, 60) || "file";
    ext = String(ext).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8);
    return ext ? base + "." + ext : base;
  }

  /* File title shown to students, made from the file name */
  function titleFromFilename(name) {
    var base = String(name == null ? "" : name).replace(/^.*[\\\/]/, "").replace(/\.[^.]*$/, "");
    base = base.replace(/[_]+/g, " ").replace(/\s+/g, " ");
    return trim(base) || "Файл";
  }

  function extOf(name) {
    var m = /\.([A-Za-z0-9]+)$/.exec(String(name == null ? "" : name));
    return m ? m[1].toLowerCase() : "";
  }

  function kindFromExt(name) {
    var e = extOf(name);
    if (e === "pdf") return "pdf";
    if (e === "mp3" || e === "m4a" || e === "wav" || e === "ogg" || e === "aac") return "audio";
    return "other";
  }

  function fmtSize(bytes) {
    var n = num(bytes);
    if (n >= 1048576) return (n / 1048576).toFixed(1).replace(".", ",") + " МБ";
    if (n >= 1024) return Math.round(n / 1024) + " КБ";
    return n + " Б";
  }

  function parseUrl(s) {
    try { return new URL(s); } catch (_) { return null; }
  }

  var VIDEO_HELP = "Підтримуються тільки Vimeo, YouTube і Bunny. Встав посилання на сторінку відео з одного з цих сайтів.";

  /* Page address of a video -> the address of its player (embed). */
  function toEmbedUrl(raw) {
    var s = trim(raw);
    if (!s) return { ok: false, error: "Встав посилання на відео." };
    if (!/^https?:\/\//i.test(s)) {
      if (/^[A-Za-z0-9.-]+\.[A-Za-z]{2,}(\/|$)/.test(s)) s = "https://" + s;
      else return { ok: false, error: VIDEO_HELP };
    }
    var u = parseUrl(s);
    if (!u || !u.hostname) return { ok: false, error: "Це не схоже на посилання. " + VIDEO_HELP };
    var host = u.hostname.toLowerCase().replace(/^www\./, "");
    var path = u.pathname || "/";
    var m, id, hash;

    if (host === "vimeo.com" || host === "player.vimeo.com") {
      m = /\/video\/(\d+)\/?$/.exec(path) || /\/(\d+)(?:\/([0-9a-f]+))?\/?$/.exec(path);
      if (m) {
        id = m[1];
        hash = u.searchParams.get("h") || m[2] || "";
        if (hash && !/^[0-9a-f]+$/i.test(hash)) hash = "";
        return { ok: true, url: "https://player.vimeo.com/video/" + id + (hash ? "?h=" + hash : ""), host: "vimeo" };
      }
      return { ok: false, error: "Не бачу номера відео в посиланні Vimeo. Відкрий відео й скопіюй адресу з браузера." };
    }

    if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com" ||
        host === "music.youtube.com" || host === "youtu.be") {
      id = "";
      if (host === "youtu.be") {
        m = /^\/([A-Za-z0-9_-]{6,20})/.exec(path);
        if (m) id = m[1];
      } else if (/^\/watch\/?$/.test(path)) {
        id = u.searchParams.get("v") || "";
      } else {
        m = /^\/(?:embed|shorts|live|v)\/([A-Za-z0-9_-]{6,20})/.exec(path);
        if (m) id = m[1];
      }
      if (id && /^[A-Za-z0-9_-]{6,20}$/.test(id)) {
        return { ok: true, url: "https://www.youtube-nocookie.com/embed/" + id, host: "youtube" };
      }
      return { ok: false, error: "Не бачу номера відео в посиланні YouTube. Відкрий відео й скопіюй адресу з браузера." };
    }

    if (host === "iframe.mediadelivery.net" || host === "player.mediadelivery.net" || host === "video.bunnycdn.com") {
      m = /^\/(?:embed|play)\/(\d+)\/([0-9a-fA-F-]{20,})\/?$/.exec(path);
      if (m) return { ok: true, url: "https://iframe.mediadelivery.net/embed/" + m[1] + "/" + m[2], host: "bunny" };
      return { ok: false, error: "Не бачу номера відео в посиланні Bunny. Скопіюй адресу, що має вигляд …/play/12345/абвгд-…" };
    }

    return { ok: false, error: VIDEO_HELP };
  }

  /* Ordinary link for the «Посилання» material: https only. */
  function cleanLink(raw) {
    var s = trim(raw);
    if (!s) return { ok: false, error: "Встав посилання." };
    if (/^(javascript|data|vbscript|file|mailto|tel|blob):/i.test(s)) {
      return { ok: false, error: "Можна додати тільки звичайне посилання на сайт (https://…)." };
    }
    if (/^https?:\/\//i.test(s)) {
      s = s.replace(/^http:\/\//i, "https://");
    } else if (/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) {
      return { ok: false, error: "Можна додати тільки посилання, що починається з https://" };
    } else {
      s = "https://" + s;
    }
    var u = parseUrl(s);
    if (!u || !u.hostname || u.hostname.indexOf(".") < 1 || /\s/.test(s)) {
      return { ok: false, error: "Це не схоже на посилання. Приклад: https://example.com/сторінка" };
    }
    return { ok: true, url: u.href };
  }

  /* The tiny markdown of the spec: ## ### headings, paragraphs, "- " lists,
     **bold**, *italic*, [text](https://…), "> " quotes, line breaks.
     Escapes everything first. */
  function mdInline(raw) {
    var s = esc(raw), links = [];
    s = s.replace(/\[([^\]\n]+)\]\((https:\/\/[^\s)]+)\)/g, function (m, label, url) {
      links.push('<a href="' + url + '" target="_blank" rel="noopener">' + label + "</a>");
      return "\u0001" + (links.length - 1) + "\u0002";
    });
    s = s.replace(/\*\*([^*\n]+?)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/(^|[^*\w])\*([^*\n]+?)\*(?![*\w])/g, "$1<em>$2</em>");
    s = s.replace(/\u0001(\d+)\u0002/g, function (m, i) { return links[Number(i)]; });
    return s;
  }

  function mdToHtml(src) {
    var lines = String(src == null ? "" : src).replace(/\r\n?/g, "\n").split("\n");
    var out = [], para = [], list = [], quote = [], i, line, m;
    function flush() {
      if (para.length) { out.push("<p>" + para.map(mdInline).join("<br>") + "</p>"); para = []; }
      if (list.length) { out.push("<ul>" + list.map(function (x) { return "<li>" + mdInline(x) + "</li>"; }).join("") + "</ul>"); list = []; }
      if (quote.length) { out.push("<blockquote>" + quote.map(mdInline).join("<br>") + "</blockquote>"); quote = []; }
    }
    for (i = 0; i < lines.length; i++) {
      line = lines[i];
      if (/^\s*$/.test(line)) { flush(); continue; }
      if ((m = /^###\s+(.*)$/.exec(line))) { flush(); out.push("<h3>" + mdInline(m[1]) + "</h3>"); continue; }
      if ((m = /^##\s+(.*)$/.exec(line))) { flush(); out.push("<h2>" + mdInline(m[1]) + "</h2>"); continue; }
      if ((m = /^\s*-\s+(.*)$/.exec(line))) {
        if (para.length || quote.length) flush();
        list.push(m[1]); continue;
      }
      if ((m = /^>\s?(.*)$/.exec(line))) {
        if (para.length || list.length) flush();
        quote.push(m[1]); continue;
      }
      if (list.length || quote.length) flush();
      para.push(line);
    }
    flush();
    return out.join("\n");
  }

  /* ---- helpers for the data layer (pure, tested) ---- */
  var IN_CHUNK = 50;   /* longest list sent to one ".in(...)" lookup */
  function chunkList(arr, n) {
    var out = [], i;
    for (i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
    return out;
  }
  function uniqIds(list) {
    var seen = {}, out = [];
    (list || []).forEach(function (x) {
      if (x == null) return;
      var k = typeof x + ":" + x;
      if (!seen[k]) { seen[k] = true; out.push(x); }
    });
    return out;
  }
  /* Rows of `table` whose `key` is one of `ids`, asked for in chunks of 50 so the
     address of a request never gets too long. */
  function lookupIn(client, table, columns, ids, key) {
    ids = uniqIds(ids);
    if (!ids.length) return Promise.resolve([]);
    return Promise.all(chunkList(ids, IN_CHUNK).map(function (part) {
      return client.from(table).select(columns).in(key || "id", part).then(function (r) {
        if (r && r.error) {
          var e = new Error(r.error.message || "error");
          e.code = r.error.code || "";
          e.status = r.error.status;
          throw e;
        }
        return (r && r.data) || [];
      });
    })).then(function (parts) {
      return parts.reduce(function (all, p) { return all.concat(p); }, []);
    });
  }
  /* true when an error does not prove that a write was refused: the request may
     have reached the database (no answer, timeout, gateway error) */
  function writeUncertain(e) {
    var code = String((e && e.code) || ""), st = Number(e && e.status) || 0, low = String((e && e.message) || "").toLowerCase();
    if (/failed to fetch|networkerror|load failed|network request failed|timeout|timed out|abort/.test(low)) return true;
    if (code === "network" || code === "timeout") return true;
    if (st === 408 || st === 502 || st === 503 || st === 504) return true;
    return !code && !st;
  }

  var H = {
    chunkList: chunkList, uniqIds: uniqIds, lookupIn: lookupIn, writeUncertain: writeUncertain,
    KINDS: KINDS, KIND_LABEL: KIND_LABEL, billingFor: billingFor, checkSlug: checkSlug,
    parsePrice: parsePrice, formatMoney: formatMoney, centsToInput: centsToInput,
    slugify: slugify, safeFilename: safeFilename, titleFromFilename: titleFromFilename,
    kindFromExt: kindFromExt, toEmbedUrl: toEmbedUrl, cleanLink: cleanLink,
    mdToHtml: mdToHtml, esc: esc, fmtSize: fmtSize
  };

  /* Loaded by a test (no page): export the helpers and stop. */
  if (typeof window === "undefined" || typeof document === "undefined") {
    if (typeof module !== "undefined" && module.exports) module.exports = H;
    return;
  }
  window.FMMAdminHelpers = H;

  /* =================================================================
     2. Small page helpers: element builder, toast, dialogs
     ================================================================= */
  function $(sel, root) { return (root || document).querySelector(sel); }

  function addKids(n, kids) {
    if (kids == null || kids === false) return;
    if (Array.isArray(kids)) { kids.forEach(function (k) { addKids(n, k); }); return; }
    if (typeof kids === "object" && kids.nodeType) { n.appendChild(kids); return; }
    n.appendChild(document.createTextNode(String(kids)));
  }

  /* h("div", { class: "x", onclick: fn }, [children]) — text is always text. */
  function h(tag, attrs, kids) {
    var n = document.createElement(tag), late = {}, k, v;
    if (attrs) {
      for (k in attrs) {
        if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
        v = attrs[k];
        if (v === false || v == null) continue;
        if (k === "class") n.className = v;
        else if (k.slice(0, 2) === "on" && typeof v === "function") n.addEventListener(k.slice(2), v);
        else if (k === "value" || k === "checked" || k === "selected") late[k] = v;
        else if (k === "disabled" || k === "hidden" || k === "readOnly") n[k] = v;
        else n.setAttribute(k, v === true ? "" : v);
      }
    }
    addKids(n, kids);
    for (k in late) { if (Object.prototype.hasOwnProperty.call(late, k)) n[k] = late[k]; }
    return n;
  }

  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); return n; }

  function toast(msg, kind) {
    var box = $("#ad-toasts");
    if (!box) return;
    var t = h("div", { class: "ad-toast is-" + (kind || "ok"), role: kind === "error" ? "alert" : "status" }, msg);
    function gone() { if (t.parentNode) t.parentNode.removeChild(t); }
    t.addEventListener("click", gone);
    box.appendChild(t);
    setTimeout(gone, kind === "error" ? 8000 : 3800);
  }

  function busy(btn, promise) {
    if (btn) { btn.disabled = true; btn.classList.add("is-busy"); }
    function done() { if (btn) { btn.disabled = false; btn.classList.remove("is-busy"); } }
    return promise.then(function (r) { done(); return r; }, function (e) { done(); throw e; });
  }

  /* ---- dialogs ---- */
  var modals = [];

  function openModal(opts) {
    var prevFocus = document.activeElement;
    var overlay = h("div", { class: "ad-overlay" });
    var title = h("h3", {}, opts.title || "");
    var box = h("div", { class: "ad-modal" + (opts.wide ? " is-wide" : ""), role: "dialog", "aria-modal": "true", "aria-label": opts.title || "Вікно" });
    var body = h("div", { class: "ad-modal-body" });
    var closed = false;
    var api = { body: body, box: box };

    function really() {
      if (closed) return;
      closed = true;
      var i = modals.indexOf(api);
      if (i > -1) modals.splice(i, 1);
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      if (!modals.length) document.body.classList.remove("ad-noscroll");
      if (opts.onClose) opts.onClose();
      if (prevFocus && prevFocus.focus && document.body.contains(prevFocus)) { try { prevFocus.focus(); } catch (_) {} }
    }
    /* Asks first when there are unsaved changes. */
    api.requestClose = function () {
      if (opts.isDirty && opts.isDirty()) {
        confirmBox({ title: "Закрити без збереження?", text: "Те, що ти написала, ще не збережено. Воно зникне.", okLabel: "Закрити без збереження", danger: true })
          .then(function (yes) { if (yes) really(); });
      } else {
        really();
      }
    };
    api.close = really;

    box.appendChild(h("div", { class: "ad-modal-head" }, [
      title,
      h("button", { class: "ad-x", type: "button", "aria-label": "Закрити", onclick: api.requestClose }, "×")
    ]));
    box.appendChild(body);
    overlay.appendChild(box);
    if (!opts.sticky) {
      overlay.addEventListener("mousedown", function (e) { if (e.target === overlay) api.requestClose(); });
    }
    document.body.appendChild(overlay);
    document.body.classList.add("ad-noscroll");
    modals.push(api);
    api.overlay = overlay;
    if (opts.focus !== false) {
      setTimeout(function () {
        var f = opts.focusEl || body.querySelector("input, textarea, select, button");
        if (f && f.focus) f.focus();
      }, 0);
    }
    return api;
  }

  document.addEventListener("keydown", function (e) {
    if (!modals.length) return;
    var top = modals[modals.length - 1];
    if (e.key === "Escape") { e.preventDefault(); top.requestClose(); return; }
    if (e.key === "Tab") {
      var f = top.box.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled])');
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || !top.box.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || !top.box.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
    }
  });

  /* Yes / no question. Resolves true or false. */
  function confirmBox(o) {
    return new Promise(function (resolve) {
      var answered = false;
      var cancelBtn = h("button", { class: "btn btn-ghost btn-sm", type: "button" }, o.cancelLabel || "Скасувати");
      var okBtn = h("button", { class: "btn btn-sm " + (o.danger ? "ad-btn-danger" : "btn-primary"), type: "button" }, o.okLabel || "Так");
      var m = openModal({
        title: o.title || "Підтвердь, будь ласка",
        focusEl: cancelBtn,
        onClose: function () { if (!answered) { answered = true; resolve(false); } }
      });
      m.body.appendChild(h("p", { class: "ad-confirm-text" }, o.text || ""));
      m.body.appendChild(h("div", { class: "ad-actions" }, [okBtn, cancelBtn]));
      okBtn.addEventListener("click", function () { answered = true; m.close(); resolve(true); });
      cancelBtn.addEventListener("click", function () { m.close(); });
    });
  }

  /* =================================================================
     3. Error texts
     ================================================================= */
  var CODE_TEXT = {
    unauthorized: "Сесія закінчилась. Онови сторінку й увійди ще раз.",
    forbidden: "Ця дія доступна тільки Марії.",
    invalid_email: "Схоже, email написаний із помилкою. Перевір, будь ласка.",
    invalid_product: "Не вдалося впізнати продукт.",
    invalid_json: "Сервер не зрозумів запит. Онови сторінку й спробуй ще раз.",
    invalid_send_email: "Сервер не зрозумів запит. Онови сторінку й спробуй ще раз.",
    invalid_locale: "Сервер не зрозумів запит. Онови сторінку й спробуй ще раз.",
    product_not_found: "Такого продукту не знайдено.",
    subscription_not_grantable: "До підписок доступ відкривається тільки через оплату. Обери інший продукт.",
    payload_too_large: "Запит завеликий.",
    method_not_allowed: "Сервер не прийняв запит. Напиши розробнику.",
    server_error: "Помилка на сервері. Спробуй ще раз за хвилину.",
    network: "Немає зв'язку з сервером. Перевір інтернет і спробуй ще раз.",
    work_changed: "Учень щойно надіслав нову версію — відкрий її ще раз.",
    not_deployed: "Ця функція на сервері ще не підключена. Її запустять перед відкриттям магазину."
  };

  function friendly(e) {
    var code = String((e && e.code) || ""), msg = String((e && e.message) || (typeof e === "string" ? e : "")), low = msg.toLowerCase();
    if (e && e.friendly) return e.friendly;
    if (CODE_TEXT[code]) return CODE_TEXT[code];
    if (code === "42501" || low.indexOf("row-level security") > -1 || low.indexOf("permission denied") > -1) {
      return "У тебе немає прав на цю дію. Можливо, сесія закінчилась — онови сторінку й увійди ще раз.";
    }
    if (code === "PGRST301" || low.indexOf("jwt") > -1) return "Сесія закінчилась. Онови сторінку й увійди ще раз.";
    if (code === "23505") {
      if (low.indexOf("slug") > -1) return "Продукт із такою адресою вже є. Обери іншу адресу.";
      if (low.indexOf("stripe_price") > -1) return "Цей Stripe-ідентифікатор ціни вже використаний в іншому продукті.";
      return "Такий запис уже існує.";
    }
    if (code === "23503") return "Це не можна видалити або змінити: до нього прив'язані замовлення чи доступи учнів.";
    if (code === "23514") return "База даних не прийняла ці значення. Перевір поля й спробуй ще раз.";
    if (code === "22P02") return "Одне зі значень має неправильний вигляд. Перевір поля.";
    if (low.indexOf("failed to fetch") > -1 || low.indexOf("networkerror") > -1 || low.indexOf("load failed") > -1 || low.indexOf("network request failed") > -1) {
      return CODE_TEXT.network;
    }
    if (low.indexOf("exceeded the maximum allowed size") > -1 || low.indexOf("too large") > -1 || code === "413") {
      return "Файл завеликий для сховища.";
    }
    if (low.indexOf("already exists") > -1 || low.indexOf("duplicate") > -1) return "Файл із такою назвою вже є.";
    if (low.indexOf("mime type") > -1) return "Такий тип файлу сховище не приймає.";
    if (low.indexOf("invalid key") > -1) return "Назва файлу містить недозволені символи.";
    return "Не вийшло. Спробуй ще раз." + (msg ? " (Технічно: " + msg.slice(0, 160) + ")" : "");
  }

  /* =================================================================
     4. Data layer — one interface, two implementations
        listProducts, insertRow, updateRow, deleteRow, loadContent,
        upload, removeFiles, searchProfiles, getEntitlements, setRevoked,
        grantAccess, listOrders
     ================================================================= */
  function mkError(code, message, status) {
    var er = new Error(message || code);
    er.code = code;
    if (status) er.status = status;
    return er;
  }

  var CFG = window.FMM_PLATFORM || {};
  var WORK_PAGE = 50;   /* works shown per page in «Роботи учнів» */

  /* ---------- 4.1 Real: supabase-js ---------- */
  function makeRealData(client) {
    function must(r) {
      if (r && r.error) {
        var e = new Error(r.error.message || "error");
        e.code = r.error.code || "";
        e.status = r.error.status;
        throw e;
      }
      return r ? r.data : null;
    }
    function clean(q) { return trim(q).replace(/[%,()*\\]/g, " ").replace(/\s+/g, " ").slice(0, 80); }

    var D = {};
    D.listProducts = function () {
      return client.from("products").select("*").order("sort_order", { ascending: true }).order("id", { ascending: true }).then(must);
    };
    D.insertRow = function (table, row) {
      return client.from(table).insert(row).select().single().then(must);
    };
    D.updateRow = function (table, id, patch) {
      return client.from(table).update(patch).eq("id", id).select().single().then(must);
    };
    D.deleteRow = function (table, id) {
      return client.from(table).delete().eq("id", id).then(must);
    };
    D.loadContent = function (productId) {
      return Promise.all([
        client.from("course_modules").select("*, course_lessons(*)").eq("product_id", productId).order("position").order("id"),
        client.from("lesson_blocks").select("*").eq("product_id", productId).order("position").order("id")
      ]).then(function (rs) {
        var mods = must(rs[0]) || [], lessons = [];
        var modules = mods.map(function (m) {
          (m.course_lessons || []).forEach(function (l) { lessons.push(l); });
          var c = {}; for (var k in m) { if (k !== "course_lessons") c[k] = m[k]; }
          return c;
        });
        return { modules: modules, lessons: lessons, blocks: must(rs[1]) || [] };
      });
    };
    D.upload = function (productId, file) {
      var path = productId + "/" + Date.now() + "-" + safeFilename(file.name);
      return client.storage.from("materials").upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type || undefined })
        .then(function (r) {
          if (r && r.error) { var e = new Error(r.error.message || "upload"); e.code = String(r.error.statusCode || r.error.status || ""); throw e; }
          return path;
        });
    };
    D.removeFiles = function (paths) {
      paths = (paths || []).filter(Boolean);
      if (!paths.length) return Promise.resolve();
      return client.storage.from("materials").remove(paths).then(function () {});
    };
    D.searchProfiles = function (q) {
      q = clean(q);
      var qb = client.from("profiles").select("id,email,full_name,locale,created_at").order("created_at", { ascending: false }).limit(30);
      if (q) qb = qb.or("email.ilike.%" + q + "%,full_name.ilike.%" + q + "%");
      return qb.then(must);
    };
    D.getEntitlements = function (userId) {
      return client.from("entitlements")
        .select("id,user_id,product_id,source,granted_at,expires_at,revoked_at,products(title,slug,kind)")
        .eq("user_id", userId).order("granted_at", { ascending: false })
        .then(must).then(function (rows) {
          return (rows || []).map(function (r) { r.product = r.products || {}; delete r.products; return r; });
        });
    };
    D.setRevoked = function (entitlementId, revoked) {
      return client.from("entitlements").update({ revoked_at: revoked ? new Date().toISOString() : null })
        .eq("id", entitlementId).select().single().then(must);
    };
    D.grantAccess = function (email, slug, sendEmail) {
      return client.auth.getSession().then(function (r) {
        var s = r && r.data && r.data.session;
        if (!s) throw mkError("unauthorized");
        return fetch(String(CFG.functionsUrl || "") + "/admin-grant-access", {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: CFG.supabaseKey || "", Authorization: "Bearer " + s.access_token },
          body: JSON.stringify({ email: email, product_slug: slug, send_email: !!sendEmail })
        });
      }).then(function (resp) {
        return resp.text().then(function (txt) {
          var body = null;
          try { body = JSON.parse(txt); } catch (_) { body = null; }
          if (resp.ok && body && body.ok) return body;
          if (body && body.error) throw mkError(String(body.error), String(body.error), resp.status);
          if (resp.status === 404) throw mkError("not_deployed", "404", 404);
          throw mkError("server_error", "HTTP " + resp.status, resp.status);
        });
      }, function () {
        throw mkError("network", "Failed to fetch");
      });
    };
    /* Students' answers and files. block_work points at auth users, so names, blocks,
       lessons and products are fetched in separate small queries (50 ids at a time)
       and joined here. */
    function byId(rows) { var m = {}; (rows || []).forEach(function (r) { m[String(r.id)] = r; }); return m; }
    function describeWork(rows) {
      rows = rows || [];
      if (!rows.length) return Promise.resolve([]);
      return Promise.all([
        lookupIn(client, "profiles", "id,email,full_name", rows.map(function (r) { return r.user_id; })),
        lookupIn(client, "lesson_blocks", "id,type,content,product_id,lesson_id", rows.map(function (r) { return r.block_id; }))
      ]).then(function (rs) {
        var profs = byId(rs[0]), blks = byId(rs[1]);
        var bl = Object.keys(blks).map(function (k) { return blks[k]; });
        return Promise.all([
          lookupIn(client, "course_lessons", "id,title", bl.map(function (b) { return b.lesson_id; })),
          lookupIn(client, "products", "id,title", bl.map(function (b) { return b.product_id; }))
        ]).then(function (qs) {
          var lessons = byId(qs[0]), prods = byId(qs[1]);
          return rows.map(function (r) {
            var pr = profs[String(r.user_id)] || {}, b = blks[String(r.block_id)] || null;
            var files = r.files;
            if (typeof files === "string") { try { files = JSON.parse(files); } catch (_) { files = []; } }
            return {
              user_id: r.user_id, block_id: r.block_id, status: r.status, text: r.text, files: Array.isArray(files) ? files : [],
              /* submitted_at stays the exact text the database sent: review_block_work compares it to the microsecond */
              submitted_at: r.submitted_at, feedback: r.feedback, score: r.score, reviewed_at: r.reviewed_at,
              student: { name: pr.full_name || "", email: pr.email || "" },
              block: b ? { id: b.id, type: b.type, content: b.content || {} } : null,
              lesson_title: b && b.lesson_id != null && lessons[String(b.lesson_id)] ? lessons[String(b.lesson_id)].title : "",
              product_title: b && prods[String(b.product_id)] ? prods[String(b.product_id)].title : ""
            };
          });
        });
      });
    }
    /* One page of works: { status: "submitted" (oldest first) | "reviewed" (newest first), from, limit }.
       Answers { rows, more }. */
    D.listWork = function (opts) {
      opts = opts || {};
      var status = opts.status === "reviewed" ? "reviewed" : "submitted";
      var from = Math.max(0, Number(opts.from) || 0), limit = Math.max(1, Number(opts.limit) || WORK_PAGE);
      var q = client.from("block_work").select("*").eq("status", status);
      if (status === "submitted") q = q.order("submitted_at", { ascending: true });
      else q = q.order("reviewed_at", { ascending: false, nullsFirst: false }).order("submitted_at", { ascending: false });
      q = q.order("user_id", { ascending: true }).order("block_id", { ascending: true });
      return q.range(from, from + limit).then(must).then(function (rows) {   /* one row more than the page, to know if there is a next page */
        rows = rows || [];
        var more = rows.length > limit;
        return describeWork(rows.slice(0, limit)).then(function (list) { return { rows: list, more: more }; });
      });
    };
    D.countWork = function (status) {
      return client.from("block_work").select("*", { count: "exact", head: true }).eq("status", status === "reviewed" ? "reviewed" : "submitted")
        .then(function (r) {
          if (r && r.error) throw mkError(r.error.code || "", r.error.message);
          return (r && r.count) || 0;
        });
    };
    D.getWork = function (userId, blockId) {
      return client.from("block_work").select("*").eq("user_id", userId).eq("block_id", blockId).maybeSingle().then(must).then(function (row) {
        return row ? describeWork([row]).then(function (l) { return l[0] || null; }) : null;
      });
    };
    D.workFileUrl = function (path) {
      return client.storage.from("student-work").createSignedUrl(path, 3600).then(must).then(function (d) {
        if (!d || !d.signedUrl) throw mkError("unknown", "no url");
        return d.signedUrl;
      });
    };
    /* submittedAt: the submitted_at text of the version Maria opened, passed back untouched */
    D.reviewWork = function (userId, blockId, feedback, score, submittedAt) {
      return client.rpc("review_block_work", { p_user_id: userId, p_block_id: blockId, p_feedback: feedback, p_score: score, p_submitted_at: submittedAt })
        .then(must).then(null, function (e) {
          if (/work_changed/.test(String((e && e.message) || ""))) e.code = "work_changed";
          throw e;
        });
    };
    D.listOrders = function () {
      return client.from("orders")
        .select("id,created_at,paid_at,status,email,amount_total_cents,currency,source,order_items(quantity,unit_amount_cents,products(title))")
        .order("created_at", { ascending: false }).limit(100)
        .then(must).then(function (rows) {
          return (rows || []).map(function (o) {
            o.items = (o.order_items || []).map(function (it) {
              return { title: (it.products && it.products.title) || "", quantity: num(it.quantity) || 1, unit_amount_cents: it.unit_amount_cents };
            });
            delete o.order_items;
            return o;
          });
        });
    };
    return D;
  }

  /* ---------- 4.2 Demo: everything in memory ---------- */
  /* Example blocks for the demo (used when the demo data has none of its own). */
  function demoBlockSeeds() {
    var md1 = [
      "## Привіт! Hej!",
      "",
      "Сьогодні ти вивчиш **перші слова** шведською. Не поспішай: *повільно — значить добре*.",
      "",
      "- Hej — привіт",
      "- Hej då — до побачення",
      "- Tack — дякую",
      "",
      "> Порада: у Швеції на «du» звертаються майже до всіх."
    ].join("\n");
    return {
      l111: [
        { id: 8001, type: "text", content: { heading: "Hej! Привіт і знайомство", body: md1 } },
        { id: 8002, type: "image", content: { src: "assets/lessons/a2-skor/slide-a.webp", alt: "Слайд зі словами привітання", caption: "Перші слова" } },
        { id: 8003, type: "hidden_text", content: { label: "Показати переклад", body: "- **Jag heter Olena.** — Мене звати Олена.\n- **Trevligt att träffas!** — Приємно познайомитись!" } },
        { id: 8004, type: "open_answer", content: { title: "Розкажи про себе", instructions: "Напиши 2–3 речення шведською.", question: "Представся: як тебе звати і звідки ти? Використай *Jag heter…* і *Jag kommer från…*", min_words: 8 } },
        { id: 8005, type: "teacher_note", content: { body: "На занятті запитай кожного: **Hur mår du?** Правильна відповідь на «Jag heter…» — просто ім'я." } }
      ],
      l112: [
        { id: 8011, type: "table", content: { header: ["Число", "Svenska"], rows: [["1", "ett"], ["2", "två"], ["3", "tre"], ["4", "fyra"]], caption: "Рахуємо до чотирьох" } },
        { id: 8012, type: "embed", content: { provider: "wordwall", url: "https://wordwall.net/embed/38a853ecb2fc4cb98c801b5cef3978c7?themeId=1", height: 480 } },
        { id: 8013, type: "student_file", content: { title: "Запиши голос", task: "Запиши аудіо, у якому ти рахуєш від **1 до 10** шведською.", accept: "audio", allow_recording: true } }
      ],
      l121: [
        { id: 8021, type: "youtube", content: { url: "https://www.youtube.com/watch?v=M7lc1UVf-VE" } },
        { id: 8022, type: "vocabulary", content: { words: [
          { word: "en kaffe", translation: "кава", example: "Jag vill ha en kaffe, tack." },
          { word: "en kanelbulle", translation: "булочка з корицею", example: "Kanelbullar är goda!" }
        ] } }
      ],
      l122: [
        { id: 8031, type: "carousel", content: { images: [
          { src: "assets/lessons/a2-skor/slide-a.webp", alt: "Слайд 1 про магазин", caption: "" },
          { src: "assets/lessons/a2-skor/slide-b.webp", alt: "Слайд 2 про магазин", caption: "" }
        ] } }
      ],
      p2: [
        { id: 8041, type: "text", content: { heading: "Vad är lagom?", body: "Слово **lagom** не має точного перекладу. Приблизно: «в міру, як треба»." } },
        { id: 8042, type: "collage", content: { images: [
          { src: "assets/lessons/b1b2-lagom/slide-a.webp", alt: "Слайд про слово lagom", caption: "" },
          { src: "assets/lessons/b1b2-lagom/slide-b.webp", alt: "Приклади вживання lagom", caption: "" }
        ] } },
        { id: 8043, type: "link_button", content: { label: "Прочитати статтю про lagom", url: "https://sv.wikipedia.org/wiki/Lagom" } },
        { id: 8044, type: "file", content: { src: "2/lagom-worksheet.pdf", name: "Робочий аркуш (PDF)", note: "Роздрукуй або заповни на екрані." } }
      ],
      p3: [
        { id: 8051, type: "text", content: { heading: "Svenska passiv", body: "Пасив у шведській утворюється двома способами: **-s** та **bli + participium**." } },
        { id: 8052, type: "file", content: { src: "3/svenska-passiv.pdf", name: "Svenska passiv (PDF)" } }
      ]
    };
  }

  /* A second of silence, so the demo can show an audio player for a student's recording. */
  function silentWavUrl() {
    var n = 8000, bytes = [], i;
    function w32(v) { bytes.push(v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >> 24) & 255); }
    function w16(v) { bytes.push(v & 255, (v >> 8) & 255); }
    function tag(t) { for (var k = 0; k < t.length; k++) bytes.push(t.charCodeAt(k)); }
    tag("RIFF"); w32(36 + n); tag("WAVE"); tag("fmt "); w32(16); w16(1); w16(1); w32(8000); w32(8000); w16(1); w16(8);
    tag("data"); w32(n);
    for (i = 0; i < n; i++) bytes.push(128);
    var bin = "";
    for (i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return "data:audio/wav;base64," + btoa(bin);
  }

  function makeDemoData() {
    var src = window.FMM_DEMO || {};
    var seq = 9000;
    var db = { products: [], course_modules: [], course_lessons: [], lesson_blocks: [], block_work: [], profiles: [], entitlements: [], orders: [] };
    function clone(x) { return x == null ? x : JSON.parse(JSON.stringify(x)); }
    function later(v) { return new Promise(function (resolve) { setTimeout(function () { resolve(clone(v)); }, 30); }); }
    function nextId() { seq += 1; return seq; }

    var extra = {
      "svenska-a1-a2-forsta-steget": { price_cents: 4900, is_published: true, sort_order: 10 },
      "b1b2-lagom": { price_cents: 900, is_published: true, sort_order: 20 },
      "svenska-passiv": { price_cents: null, is_published: false, sort_order: 30 }
    };
    var seeds = demoBlockSeeds();
    function addBlocks(pid, lid, list) {
      (list || []).forEach(function (x, i) {
        db.lesson_blocks.push({ id: x.id != null ? x.id : nextId(), product_id: pid, lesson_id: lid, type: x.type, content: clone(x.content) || {}, position: x.position || i + 1 });
      });
    }
    Object.keys(src.products || {}).forEach(function (slug) {
      var pk = src.products[slug], p = pk.product, ex = extra[slug] || {};
      db.products.push({
        id: p.id, slug: p.slug, kind: p.kind, billing: billingFor(p.kind), title: p.title,
        short_description: p.short_description || "", description: p.description || "",
        price_cents: ex.price_cents == null ? null : ex.price_cents, currency: "EUR", stripe_price_id: null,
        cover_path: p.cover_path || null, is_published: !!ex.is_published, sort_order: ex.sort_order || 0,
        created_at: "2026-10-01T10:00:00Z"
      });
      (pk.modules || []).forEach(function (m) {
        db.course_modules.push({ id: m.id, product_id: p.id, title: m.title, position: m.position });
        (m.lessons || []).forEach(function (l) {
          db.course_lessons.push({ id: l.id, module_id: m.id, title: l.title, summary: l.summary || "", position: l.position });
          addBlocks(p.id, l.id, l.blocks || seeds["l" + l.id]);
        });
      });
      addBlocks(p.id, null, pk.blocks || seeds["p" + p.id]);
    });

    [
      { id: 4, slug: "svenska-varje-manad", kind: "magazine_subscription", title: "Svenska varje månad — журнал",
        short_description: "Щомісячний журнал для тих, хто вчить шведську.", price_cents: 900, stripe_price_id: "price_1Demo123abc", is_published: true, sort_order: 40 },
      { id: 5, slug: "magazin-nr-1", kind: "magazine_issue", title: "Журнал Nr 1 — листопад 2026",
        short_description: "Перший номер журналу.", price_cents: 500, stripe_price_id: null, is_published: true, sort_order: 50 },
      { id: 6, slug: "pakket-5-lektioner", kind: "live_package", title: "Пакет із 5 живих занять",
        short_description: "П'ять індивідуальних занять зі мною.", price_cents: 12500, stripe_price_id: null, is_published: false, sort_order: 60 },
      { id: 7, slug: "ne-nazyvaite-mene-pani-vchytelko", kind: "teacher_course", title: "[НЕ] називайте мене «пані вчителько»",
        short_description: "Курс для викладачів.", price_cents: null, stripe_price_id: null, is_published: false, sort_order: 70 }
    ].forEach(function (p) {
      p.billing = billingFor(p.kind); p.description = ""; p.currency = "EUR"; p.cover_path = null; p.created_at = "2026-10-10T10:00:00Z";
      db.products.push(p);
    });

    var u = src.profile || { id: "demo-u-1", email: "olena.demo@example.com", full_name: "Олена", locale: "uk" };
    db.profiles.push({ id: u.id, email: u.email, full_name: u.full_name, locale: u.locale || "uk", created_at: "2026-10-12T09:30:00Z" });
    db.profiles.push({ id: "demo-u-2", email: "taras.k@example.com", full_name: "Тарас Коваль", locale: "uk", created_at: "2026-10-25T14:10:00Z" });
    db.profiles.push({ id: "demo-u-3", email: "anna.kowalska@example.pl", full_name: "Anna Kowalska", locale: "pl", created_at: "2026-10-30T08:45:00Z" });
    db.profiles.push({ id: "demo-u-4", email: "iryna.m@example.com", full_name: "", locale: "uk", created_at: "2026-11-02T19:20:00Z" });

    var ent = 0;
    function addEnt(uid, pid, source, at, revoked, expires) {
      db.entitlements.push({ id: ++ent, user_id: uid, product_id: pid, source: source, granted_at: at, expires_at: expires || null, revoked_at: revoked || null });
    }
    (src.library || []).forEach(function (r) { addEnt(u.id, r.product_id, r.source, r.granted_at); });
    addEnt("demo-u-2", 1, "purchase", "2026-10-25T14:12:00Z");
    addEnt("demo-u-2", 4, "subscription", "2026-11-01T08:00:00Z", null, "2026-12-04T08:00:00Z");
    addEnt("demo-u-3", 2, "purchase", "2026-10-30T08:50:00Z", "2026-11-02T10:00:00Z");

    (src.orders || []).forEach(function (o) {
      db.orders.push({ id: o.id, created_at: o.created_at, paid_at: o.paid_at, status: o.status, email: u.email,
        amount_total_cents: o.amount_total_cents, currency: o.currency, source: "stripe", items: clone(o.items) });
    });
    db.orders.push({ id: 1005, created_at: "2026-11-03T20:15:00Z", paid_at: "2026-11-03T20:16:00Z", status: "paid", email: "iryna.m@example.com",
      amount_total_cents: 900, currency: "EUR", source: "stripe", items: [{ title: "Svenska varje månad — журнал", quantity: 1, unit_amount_cents: 900 }] });
    db.orders.push({ id: 1004, created_at: "2026-11-01T08:00:00Z", paid_at: "2026-11-01T08:01:00Z", status: "paid", email: "taras.k@example.com",
      amount_total_cents: 900, currency: "EUR", source: "stripe", items: [{ title: "Svenska varje månad — журнал", quantity: 1, unit_amount_cents: 900 }] });
    db.orders.push({ id: 1003, created_at: "2026-10-30T08:48:00Z", paid_at: "2026-10-30T08:50:00Z", status: "refunded", email: "anna.kowalska@example.pl",
      amount_total_cents: 900, currency: "EUR", source: "stripe", items: [{ title: "Vad är egentligen lagom?", quantity: 1, unit_amount_cents: 900 }] });
    db.orders.push({ id: 1000, created_at: "2026-10-25T14:10:00Z", paid_at: "2026-10-25T14:12:00Z", status: "paid", email: "taras.k@example.com",
      amount_total_cents: 4900, currency: "EUR", source: "manual", items: [{ title: "Шведська A1–A2: перший крок", quantity: 1, unit_amount_cents: 4900 }] });
    db.orders.push({ id: 999, created_at: "2026-10-24T18:00:00Z", paid_at: null, status: "failed", email: "dmytro@example.com",
      amount_total_cents: 4900, currency: "EUR", source: "stripe", items: [{ title: "Шведська A1–A2: перший крок", quantity: 1, unit_amount_cents: 4900 }] });

    function table(name) {
      if (!db[name]) throw mkError("unknown", "table " + name);
      return db[name];
    }
    function findIdx(rows, id) {
      for (var i = 0; i < rows.length; i++) { if (same(rows[i].id, id)) return i; }
      return -1;
    }
    function cascade(name, id) {
      var i, l;
      if (name === "course_modules") {
        db.course_lessons.filter(function (x) { return same(x.module_id, id); }).forEach(function (x) { cascade("course_lessons", x.id); });
        db.course_lessons = db.course_lessons.filter(function (x) { return !same(x.module_id, id); });
      } else if (name === "course_lessons") {
        var gone = db.lesson_blocks.filter(function (x) { return same(x.lesson_id, id); }).map(function (x) { return String(x.id); });
        db.lesson_blocks = db.lesson_blocks.filter(function (x) { return !same(x.lesson_id, id); });
        db.block_work = db.block_work.filter(function (w) { return gone.indexOf(String(w.block_id)) < 0; });
      } else if (name === "lesson_blocks") {
        db.block_work = db.block_work.filter(function (w) { return !same(w.block_id, id); });
      }
    }

    /* Students' work (open answers and files) for the review section */
    function seedWork() {
      function first(type) { return db.lesson_blocks.filter(function (b) { return b.type === type; })[0]; }
      var oa = first("open_answer"), sf = first("student_file");
      if (!oa) { oa = { id: nextId(), product_id: 1, lesson_id: null, type: "open_answer", content: { question: "Розкажи про свій ранок.", min_words: 8 }, position: 99 }; db.lesson_blocks.push(oa); }
      if (!sf) { sf = { id: nextId(), product_id: 1, lesson_id: null, type: "student_file", content: { task: "Запиши голос.", accept: "audio", allow_recording: true }, position: 98 }; db.lesson_blocks.push(sf); }
      db.block_work.push(
        { user_id: "demo-u-2", block_id: oa.id, status: "submitted", submitted_at: "2026-11-04T18:20:00Z", feedback: null, score: null, reviewed_at: null, files: [],
          text: "Jag heter Taras. Jag kommer från Lviv, men jag bor i Krakow nu. På morgonen dricker jag kaffe och äter en smörgås. Jag gillar fika!" },
        { user_id: "demo-u-3", block_id: sf.id, status: "submitted", submitted_at: "2026-11-04T09:05:00Z", feedback: null, score: null, reviewed_at: null, text: "",
          files: [{ path: "demo-u-3/" + sf.id + "/1730700000000-moj-golos.webm", name: "мій голос.webm", size: 48210, type: "audio/webm" }] },
        { user_id: "demo-u-4", block_id: sf.id, status: "submitted", submitted_at: "2026-11-03T21:40:00Z", feedback: null, score: null, reviewed_at: null, text: "Ось мій малюнок з булочкою.",
          files: [{ path: "demo-u-4/" + sf.id + "/1730650000000-bulochka.jpg", name: "булочка.jpg", size: 215430, type: "image/jpeg" }] },
        { user_id: "demo-u-1", block_id: oa.id, status: "reviewed", submitted_at: "2026-10-30T12:00:00Z", reviewed_at: "2026-10-31T08:30:00Z", score: 8,
          feedback: "Дуже добре! **Jag heter Olena** — без помилок.\n\n- Не забудь про *från*: «Jag kommer från Kyiv».\n- Ще раз перевір порядок слів.",
          text: "Jag heter Olena. Jag kommer fran Kyiv. Jag bor i Warszawa.", files: [] }
      );
    }
    seedWork();

    var D = {};
    D.listProducts = function () {
      var rows = db.products.slice().sort(function (a, b) { return (num(a.sort_order) - num(b.sort_order)) || (num(a.id) - num(b.id)); });
      return later(rows);
    };
    D.insertRow = function (tableName, row) {
      var rows = table(tableName), r = clone(row);
      if (tableName === "products") {
        if (rows.some(function (x) { return x.slug === r.slug; })) return Promise.reject(mkError("23505", "duplicate key value violates unique constraint \"products_slug_key\""));
        if (r.stripe_price_id && rows.some(function (x) { return x.stripe_price_id === r.stripe_price_id; })) return Promise.reject(mkError("23505", "products_stripe_price_id_key"));
        r.created_at = new Date().toISOString();
      }
      r.id = nextId();
      rows.push(r);
      return later(r);
    };
    D.updateRow = function (tableName, id, patch) {
      var rows = table(tableName), i = findIdx(rows, id);
      if (i < 0) return Promise.reject(mkError("PGRST116", "Row not found"));
      if (tableName === "products" && patch.slug && rows.some(function (x, j) { return j !== i && x.slug === patch.slug; })) {
        return Promise.reject(mkError("23505", "products_slug_key"));
      }
      for (var k in patch) { if (Object.prototype.hasOwnProperty.call(patch, k)) rows[i][k] = clone(patch[k]); }
      return later(rows[i]);
    };
    D.deleteRow = function (tableName, id) {
      var rows = table(tableName), i = findIdx(rows, id);
      if (i > -1) { rows.splice(i, 1); cascade(tableName, id); }
      return later(null);
    };
    D.loadContent = function (productId) {
      var modules = db.course_modules.filter(function (m) { return same(m.product_id, productId); });
      var ids = modules.map(function (m) { return String(m.id); });
      return later({
        modules: modules,
        lessons: db.course_lessons.filter(function (l) { return ids.indexOf(String(l.module_id)) > -1; }),
        blocks: db.lesson_blocks.filter(function (b) { return same(b.product_id, productId); })
      });
    };
    D.upload = function (productId, file) {
      var path = productId + "/" + Date.now() + "-" + safeFilename(file.name);
      try { demoBlobs[path] = URL.createObjectURL(file); } catch (_) {}
      return later(path);
    };
    D.removeFiles = function () { return later(null); };
    D.searchProfiles = function (q) {
      q = trim(q).toLowerCase();
      var rows = db.profiles.filter(function (p) {
        return !q || String(p.email || "").toLowerCase().indexOf(q) > -1 || String(p.full_name || "").toLowerCase().indexOf(q) > -1;
      }).sort(function (a, b) { return a.created_at < b.created_at ? 1 : -1; });
      return later(rows);
    };
    D.getEntitlements = function (userId) {
      var rows = db.entitlements.filter(function (e) { return same(e.user_id, userId); }).map(function (e) {
        var c = clone(e), p = db.products.filter(function (x) { return same(x.id, e.product_id); })[0] || {};
        c.product = { title: p.title || "", slug: p.slug || "", kind: p.kind || "" };
        return c;
      }).sort(function (a, b) { return a.granted_at < b.granted_at ? 1 : -1; });
      return later(rows);
    };
    D.setRevoked = function (entitlementId, revoked) {
      var i = findIdx(db.entitlements, entitlementId);
      if (i < 0) return Promise.reject(mkError("PGRST116", "Row not found"));
      db.entitlements[i].revoked_at = revoked ? new Date().toISOString() : null;
      return later(db.entitlements[i]);
    };
    D.grantAccess = function (email, slug, sendEmail) {
      email = trim(email).toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Promise.reject(mkError("invalid_email"));
      var prod = db.products.filter(function (p) { return p.slug === slug; })[0];
      if (!prod) return Promise.reject(mkError("product_not_found"));
      if (prod.billing === "subscription") return Promise.reject(mkError("subscription_not_grantable"));
      var prof = db.profiles.filter(function (p) { return String(p.email).toLowerCase() === email; })[0], created = false;
      if (!prof) {
        prof = { id: "demo-u-" + nextId(), email: email, full_name: "", locale: "uk", created_at: new Date().toISOString() };
        db.profiles.push(prof); created = true;
      }
      var e = db.entitlements.filter(function (x) { return same(x.user_id, prof.id) && same(x.product_id, prod.id); })[0];
      if (e) { e.revoked_at = null; e.expires_at = null; }
      else addEnt(prof.id, prod.id, "admin_grant", new Date().toISOString());
      return later({ ok: true, user_id: prof.id, created: created, email: sendEmail ? "sent" : "not_requested" });
    };
    function describeDemoWork(w) {
      var pr = db.profiles.filter(function (x) { return same(x.id, w.user_id); })[0] || {};
      var b = db.lesson_blocks.filter(function (x) { return same(x.id, w.block_id); })[0] || null;
      var les = b && b.lesson_id != null ? db.course_lessons.filter(function (x) { return same(x.id, b.lesson_id); })[0] : null;
      var prod = b ? db.products.filter(function (x) { return same(x.id, b.product_id); })[0] : null;
      var c = clone(w);
      c.student = { name: pr.full_name || "", email: pr.email || "" };
      c.block = b ? { id: b.id, type: b.type, content: clone(b.content) } : null;
      c.lesson_title = les ? les.title : "";
      c.product_title = prod ? prod.title : "";
      return c;
    }
    D.listWork = function (opts) {
      opts = opts || {};
      var status = opts.status === "reviewed" ? "reviewed" : "submitted";
      var from = Math.max(0, Number(opts.from) || 0), limit = Math.max(1, Number(opts.limit) || WORK_PAGE);
      var rows = db.block_work.filter(function (w) { return (w.status === "reviewed" ? "reviewed" : "submitted") === status; }).sort(function (a, b) {
        if (status === "submitted") return a.submitted_at < b.submitted_at ? -1 : (a.submitted_at > b.submitted_at ? 1 : 0);
        var x = String(a.reviewed_at || ""), y = String(b.reviewed_at || "");
        return x < y ? 1 : (x > y ? -1 : 0);
      });
      return later({ rows: rows.slice(from, from + limit).map(describeDemoWork), more: rows.length > from + limit });
    };
    D.countWork = function (status) {
      var st = status === "reviewed" ? "reviewed" : "submitted";
      return later(db.block_work.filter(function (w) { return (w.status === "reviewed" ? "reviewed" : "submitted") === st; }).length);
    };
    D.getWork = function (userId, blockId) {
      var w = db.block_work.filter(function (x) { return same(x.user_id, userId) && same(x.block_id, blockId); })[0];
      return later(w ? describeDemoWork(w) : null);
    };
    /* demo only (for checking by hand): the student sends the work again */
    D.demoResend = function (userId, blockId, text) {
      var w = db.block_work.filter(function (x) { return same(x.user_id, userId) && same(x.block_id, blockId); })[0];
      if (!w) return later(null);
      w.text = text; w.status = "submitted"; w.feedback = null; w.score = null; w.reviewed_at = null;
      w.submitted_at = new Date().toISOString().replace("Z", "123Z");
      return later(describeDemoWork(w));
    };
    D.workFileUrl = function (path) {
      var t = String(path || "").toLowerCase();
      if (/\.(webm|mp3|m4a|wav|ogg)$/.test(t)) return later(silentWavUrl()).then(function (u) { return u; });
      return Promise.resolve("assets/lessons/a2-skor/slide-a.webp");
    };
    D.reviewWork = function (userId, blockId, feedback, score, submittedAt) {
      var w = db.block_work.filter(function (x) { return same(x.user_id, userId) && same(x.block_id, blockId); })[0];
      if (!w) return Promise.reject(mkError("PGRST116", "Row not found"));
      if (submittedAt !== undefined && String(w.submitted_at) !== String(submittedAt)) return Promise.reject(mkError("work_changed", "work_changed"));
      w.feedback = feedback; w.score = score; w.status = "reviewed"; w.reviewed_at = new Date().toISOString();
      return later(w);
    };
    D.listOrders = function () {
      var rows = db.orders.slice().sort(function (a, b) { return a.created_at < b.created_at ? 1 : -1; }).slice(0, 100);
      return later(rows);
    };
    return D;
  }

  var D = null;       // the active data layer
  var IS_DEMO = false;

  /* =================================================================
     5. State, small shared pieces
     ================================================================= */
  var S = {
    products: null,
    list: { kind: "", q: "" },
    vmist: { productId: null, content: null, open: {} },
    people: { q: "", results: null, selected: null, ents: null },
    work: { filter: "pending", pending: { rows: null, more: false }, reviewed: { rows: null, more: false }, pendingCount: null }
  };
  var main = null;
  var renderToken = 0;
  function alive(tok) { return tok === renderToken; }

  function productById(id) {
    var rows = S.products || [], i;
    for (i = 0; i < rows.length; i++) { if (same(rows[i].id, id)) return rows[i]; }
    return null;
  }
  function loadProducts(force) {
    if (S.products && !force) return Promise.resolve(S.products);
    return D.listProducts().then(function (rows) { S.products = rows; return rows; });
  }
  function byPos(a, b) { return (num(a.position) - num(b.position)) || (num(a.id) - num(b.id)); }
  function sorted(arr) { return arr.slice().sort(byPos); }
  function maxPos(arr) { var m = 0; arr.forEach(function (x) { if (num(x.position) > m) m = num(x.position); }); return m; }

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function fmtDate(iso, withTime) {
    if (!iso) return "—";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    var s = pad(d.getDate()) + "." + pad(d.getMonth() + 1) + "." + d.getFullYear();
    return withTime ? s + " " + pad(d.getHours()) + ":" + pad(d.getMinutes()) : s;
  }

  function plural(n, one, few, many) {
    var a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return many;
    if (b > 1 && b < 5) return few;
    if (b === 1) return one;
    return many;
  }

  function badge(text, cls) { return h("span", { class: "pf-badge " + (cls || "") }, text); }

  function emptyBox(title, text, action) {
    return h("div", { class: "pf-empty" }, [h("h3", {}, title), text ? h("p", {}, text) : null, action || null]);
  }

  /* Field = label + control + hint + error line */
  function field(labelText, control, hint, extraClass) {
    var id = control.id || ("ad-" + Math.random().toString(36).slice(2, 8));
    control.id = id;
    var hintEl = hint ? h("p", { class: "pf-hint", id: id + "-hint" }, hint) : null;
    var errEl = h("p", { class: "ad-err", id: id + "-err", role: "alert", hidden: true });
    if (hintEl) control.setAttribute("aria-describedby", id + "-hint");
    var wrap = h("div", { class: "field ad-field" + (extraClass ? " " + extraClass : "") }, [
      h("label", { for: id }, labelText), control, hintEl, errEl
    ]);
    wrap._ctrl = control; wrap._err = errEl;
    return wrap;
  }
  function setErr(f, msg) {
    f._err.textContent = msg || "";
    f._err.hidden = !msg;
    if (msg) f._ctrl.setAttribute("aria-invalid", "true"); else f._ctrl.removeAttribute("aria-invalid");
  }

  function sectionHead(title, right) {
    return h("div", { class: "ad-section-head" }, [h("h2", {}, title), right || null]);
  }

  /* Plain "← back" link */
  function backLink(href, text) { return h("a", { class: "ad-back", href: href }, "← " + text); }

  /* Rename in place: shows the text and a pencil; click -> input. */
  function inlineEdit(value, opts) {
    var wrap = h("span", { class: "ad-inline" });
    function show() {
      clear(wrap);
      wrap.appendChild(h("span", { class: "ad-inline-text" }, value));
      wrap.appendChild(h("button", {
        class: "ad-icon-btn", type: "button", title: "Перейменувати",
        "aria-label": "Перейменувати: " + value, onclick: edit
      }, "✎"));
    }
    function edit() {
      var input = h("input", { type: "text", value: value, maxlength: "200", "aria-label": opts.label || "Назва" });
      var saveBtn = h("button", { class: "btn btn-primary btn-sm", type: "submit" }, "Зберегти");
      var form = h("form", { class: "ad-inline-form", novalidate: true }, [
        input, saveBtn, h("button", { class: "btn btn-ghost btn-sm", type: "button", onclick: show }, "Скасувати")
      ]);
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var v = trim(input.value);
        if (!v) { toast("Назва не може бути порожньою.", "error"); input.focus(); return; }
        if (v === value) { show(); return; }
        busy(saveBtn, opts.onSave(v)).then(function () {}, function () {});
      });
      input.addEventListener("keydown", function (e) { if (e.key === "Escape") { e.stopPropagation(); show(); } });
      clear(wrap);
      wrap.appendChild(form);
      input.focus(); input.select();
    }
    show();
    return wrap;
  }

  /* =================================================================
     6. Section: Продукти
     ================================================================= */
  function viewProducts(arg, tok) {
    return loadProducts(true).then(function () {
      if (!alive(tok)) return;
      clear(main);
      if (arg === "new") return drawProductForm(null);
      if (arg) {
        var p = productById(arg);
        if (p) return drawProductForm(p);
        toast("Такого продукту не знайдено.", "error");
      }
      drawProductList();
    });
  }

  function priceText(p) {
    if (p.price_cents == null) return h("span", { class: "ad-muted" }, "— ще без ціни");
    return document.createTextNode(formatMoney(p.price_cents, p.currency));
  }

  function publishSwitch(p) {
    var knobText = h("span", { class: "ad-switch-text" }, "");
    var btn = h("button", { type: "button", role: "switch", class: "ad-switch" }, [h("span", { class: "ad-switch-knob", "aria-hidden": "true" }), knobText]);
    function paint() {
      btn.setAttribute("aria-checked", p.is_published ? "true" : "false");
      btn.setAttribute("aria-label", "Опубліковано на сайті: «" + p.title + "»");
      btn.classList.toggle("is-on", !!p.is_published);
      knobText.textContent = p.is_published ? "Опубліковано" : "Чернетка";
    }
    paint();
    btn.addEventListener("click", function () {
      var next = !p.is_published;
      busy(btn, D.updateRow("products", p.id, { is_published: next })).then(function () {
        p.is_published = next;
        paint();
        var extra = "";
        if (next && p.price_cents == null) extra = " Ціни ще немає, тому купити його поки не можна.";
        else if (next && p.billing === "subscription" && !p.stripe_price_id) extra = " Для підписки ще треба вписати Stripe-ідентифікатор ціни.";
        toast(next ? "«" + p.title + "» тепер видно на сайті." + extra : "«" + p.title + "» сховано від відвідувачів.");
      }, function (e) { toast(friendly(e), "error"); });
    });
    return btn;
  }

  function drawProductList() {
    var kindSel = h("select", { "aria-label": "Показати тип продукту" },
      [h("option", { value: "" }, "Усі типи")].concat(KINDS.map(function (k) { return h("option", { value: k[0] }, k[1]); })));
    kindSel.value = S.list.kind;
    var search = h("input", { type: "search", placeholder: "Пошук за назвою або адресою", value: S.list.q, "aria-label": "Пошук продукту", autocomplete: "off" });
    var holder = h("div", { class: "ad-list-holder" });
    var count = h("p", { class: "pf-hint ad-count", "aria-live": "polite" });

    function paint() {
      var q = trim(S.list.q).toLowerCase();
      var rows = (S.products || []).filter(function (p) {
        if (S.list.kind && p.kind !== S.list.kind) return false;
        if (q && (String(p.title).toLowerCase().indexOf(q) < 0 && String(p.slug).toLowerCase().indexOf(q) < 0)) return false;
        return true;
      });
      clear(holder);
      count.textContent = (S.products || []).length ? "Показано " + rows.length + " із " + S.products.length : "";
      if (!(S.products || []).length) {
        holder.appendChild(emptyBox("Продуктів ще немає", "Натисни «Новий продукт», щоб створити перший.",
          h("a", { class: "btn btn-primary btn-sm", href: "#produkty/new" }, "Новий продукт")));
        return;
      }
      if (!rows.length) {
        holder.appendChild(emptyBox("Нічого не знайдено", "Спробуй інше слово або обери «Усі типи»."));
        return;
      }
      var tbody = h("tbody");
      rows.forEach(function (p) {
        tbody.appendChild(h("tr", {}, [
          h("td", { "data-label": "Назва", class: "ad-td-main" }, [h("strong", {}, p.title), h("small", {}, p.slug)]),
          h("td", { "data-label": "Тип" }, KIND_LABEL[p.kind] || p.kind),
          h("td", { "data-label": "Ціна" }, priceText(p)),
          h("td", { "data-label": "На сайті" }, publishSwitch(p)),
          h("td", { class: "ad-td-actions" }, [
            h("a", { class: "btn btn-ghost btn-sm", href: "#produkty/" + p.id }, "Редагувати"),
            h("a", { class: "btn btn-ghost btn-sm", href: "#vmist/" + p.id }, "Вміст")
          ])
        ]));
      });
      holder.appendChild(h("table", { class: "ad-table" }, [
        h("thead", {}, h("tr", {}, [h("th", {}, "Назва"), h("th", {}, "Тип"), h("th", {}, "Ціна"), h("th", {}, "На сайті"), h("th", {}, h("span", { class: "sr-only" }, "Дії"))])),
        tbody
      ]));
    }

    kindSel.addEventListener("change", function () { S.list.kind = kindSel.value; paint(); });
    search.addEventListener("input", function () { S.list.q = search.value; paint(); });

    main.appendChild(sectionHead("Продукти", h("a", { class: "btn btn-primary btn-sm", href: "#produkty/new" }, "+ Новий продукт")));
    main.appendChild(h("div", { class: "ad-filters" }, [kindSel, search]));
    main.appendChild(count);
    main.appendChild(holder);
    paint();
  }

  function drawProductForm(p) {
    var isNew = !p;
    var v = p || { kind: "course", is_published: false, currency: "EUR", sort_order: 0, title: "", slug: "" };
    if (isNew) {
      var top = 0;
      (S.products || []).forEach(function (x) { if (num(x.sort_order) > top) top = num(x.sort_order); });
      v.sort_order = top + 10;
    }
    var slugTouched = !isNew;

    var title = h("input", { type: "text", maxlength: "200", value: v.title || "", autocomplete: "off" });
    var kind = h("select", {}, KINDS.map(function (k) { return h("option", { value: k[0] }, k[1]); }));
    kind.value = v.kind;
    var billingNote = h("p", { class: "pf-hint ad-billing" });
    var slug = h("input", { type: "text", maxlength: "80", value: v.slug || "", autocomplete: "off", spellcheck: "false", autocapitalize: "none", readOnly: !isNew });
    var price = h("input", { type: "text", inputmode: "decimal", value: centsToInput(v.price_cents), placeholder: "наприклад 12,50", autocomplete: "off" });
    var short = h("textarea", { rows: "2", maxlength: "400" }); short.value = v.short_description || "";
    var desc = h("textarea", { rows: "6" }); desc.value = v.description || "";
    var cover = h("input", { type: "text", value: v.cover_path || "", placeholder: "assets/lessons/назва/cover.webp", autocomplete: "off", spellcheck: "false" });
    var stripe = h("input", { type: "text", value: v.stripe_price_id || "", placeholder: "price_…", autocomplete: "off", spellcheck: "false", autocapitalize: "none" });
    var sort = h("input", { type: "number", step: "1", value: String(v.sort_order == null ? 0 : v.sort_order) });
    var pub = h("input", { type: "checkbox", id: "ad-pub", checked: !!v.is_published });

    var fTitle = field("Назва *", title, "Так її побачать учні й відвідувачі сайту.");
    var fKind = field("Тип *", kind);
    fKind.appendChild(billingNote);
    var slugHint = isNew
      ? "Адреса в посиланні, латиницею: малі літери, цифри й дефіси. Створюється сама з назви."
      : "Увага: якщо змінити адресу, старі посилання на цей продукт перестануть працювати.";
    var fSlug = field("Адреса (slug) *", slug, slugHint);
    if (!isNew) {
      var unlock = h("button", { class: "ad-link", type: "button" }, "Змінити адресу");
      unlock.addEventListener("click", function () {
        confirmBox({ title: "Змінити адресу?", text: "Старі посилання на цей продукт можуть перестати працювати. Змінюй, тільки якщо справді треба.", okLabel: "Так, змінити" }).then(function (yes) {
          if (!yes) return;
          slug.readOnly = false; slugTouched = true; unlock.hidden = true; slug.focus();
        });
      });
      fSlug.appendChild(unlock);
    }
    var fPrice = field("Ціна, €", price, "Можна з комою: 12,50. Залиш порожнім, якщо ціни ще немає.");
    var fShort = field("Короткий опис", short, "Одне-два речення для картки в кабінеті.");
    var fDesc = field("Повний опис", desc);
    var fCover = field("Обкладинка (cover_path)", cover, "Шлях до картинки на сайті, наприклад assets/lessons/назва/cover.webp. Можна лишити порожнім.");
    var fStripe = field("Stripe: ідентифікатор ціни", stripe,
      "Починається з price_… Знайдеш у Stripe: Каталог товарів → потрібна ціна → «Ідентифікатор API». Для підписок обов'язковий, для разових покупок можна лишити порожнім.");
    var fSort = field("Порядок у списку", sort, "Менше число — вище в списку.");
    var fPub = h("div", { class: "field ad-field ad-check" }, [
      h("label", { for: "ad-pub", class: "ad-check-label" }, [pub, h("span", {}, "Опубліковано на сайті")]),
      h("p", { class: "pf-hint" }, "Поки не позначено — це чернетка, її бачиш тільки ти.")
    ]);

    function paintBilling() {
      var b = billingFor(kind.value);
      billingNote.textContent = b === "subscription"
        ? "Оплата: щомісячна підписка. Потрібен Stripe-ідентифікатор ціни."
        : "Оплата: одноразова.";
    }
    paintBilling();
    kind.addEventListener("change", paintBilling);
    title.addEventListener("input", function () { if (!slugTouched) slug.value = slugify(title.value); });
    slug.addEventListener("input", function () { slugTouched = true; });

    function collect() {
      var errs = [], row = {}, pr;
      [fTitle, fSlug, fPrice, fStripe, fSort].forEach(function (f) { setErr(f, ""); });
      row.title = trim(title.value);
      if (!row.title) errs.push([fTitle, "Напиши назву."]);
      row.slug = trim(slug.value);
      var se = checkSlug(row.slug);
      if (se) errs.push([fSlug, se]);
      row.kind = kind.value;
      row.billing = billingFor(row.kind);
      pr = parsePrice(price.value);
      if (!pr.ok) errs.push([fPrice, pr.error]);
      row.price_cents = pr.ok ? pr.cents : null;
      row.currency = (p && p.currency) || "EUR";
      row.stripe_price_id = trim(stripe.value) || null;
      if (row.stripe_price_id && !/^price_[A-Za-z0-9]+$/.test(row.stripe_price_id)) {
        errs.push([fStripe, "Ідентифікатор має починатися з price_ і далі літери та цифри, без пробілів."]);
      }
      var so = trim(sort.value);
      if (so !== "" && !/^-?\d+$/.test(so)) errs.push([fSort, "Тут має бути ціле число, наприклад 10."]);
      row.sort_order = so === "" ? 0 : parseInt(so, 10);
      row.short_description = trim(short.value) || null;
      row.description = trim(desc.value) || null;
      row.cover_path = trim(cover.value) || null;
      row.is_published = !!pub.checked;
      errs.forEach(function (e) { setErr(e[0], e[1]); });
      return { ok: !errs.length, row: row, errs: errs };
    }

    var saveBtn = h("button", { class: "btn btn-primary", type: "submit" }, isNew ? "Створити продукт" : "Зберегти");
    var form = h("form", { class: "ad-form", novalidate: true }, [
      h("div", { class: "ad-form-grid" }, [fTitle, fKind, fSlug, fPrice, fShort, fCover, fStripe, fSort]),
      fDesc, fPub,
      h("div", { class: "ad-actions" }, [
        saveBtn,
        h("a", { class: "btn btn-ghost", href: "#produkty" }, "Скасувати"),
        isNew ? null : h("a", { class: "btn btn-ghost", href: "#vmist/" + p.id }, "Вміст продукту →")
      ])
    ]);

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var c = collect();
      if (!c.ok) {
        toast("Перевір поля, які підсвічені червоним.", "error");
        c.errs[0][0]._ctrl.focus();
        return;
      }
      var op = isNew ? D.insertRow("products", c.row) : D.updateRow("products", p.id, c.row);
      busy(saveBtn, op).then(function (row) {
        var note = "";
        if (c.row.is_published && c.row.price_cents == null) note = " Ціни ще немає, тому купити його поки не можна.";
        else if (c.row.is_published && c.row.billing === "subscription" && !c.row.stripe_price_id) note = " Для підписки ще треба вписати Stripe-ідентифікатор ціни.";
        toast((isNew ? "Продукт створено. Тепер можна додати вміст — кнопка «Вміст» у списку." : "Збережено.") + note);
        S.products = null;
        window.location.hash = "#produkty";
      }, function (er) {
        var msg = friendly(er);
        if (String(er && er.code) === "23505") {
          var low = String(er.message || "").toLowerCase();
          if (low.indexOf("stripe") > -1) setErr(fStripe, msg); else setErr(fSlug, msg);
        }
        toast(msg, "error");
      });
    });

    main.appendChild(backLink("#produkty", "Усі продукти"));
    main.appendChild(sectionHead(isNew ? "Новий продукт" : "Редагувати продукт"));
    main.appendChild(h("div", { class: "pf-card ad-card" }, form));
    title.focus();
  }

  /* =================================================================
     7. Section: Вміст продукту
     ================================================================= */
  function viewContent(arg, tok) {
    return loadProducts().then(function (products) {
      if (!alive(tok)) return;
      if (!products.length) {
        clear(main);
        main.appendChild(sectionHead("Вміст продукту"));
        main.appendChild(emptyBox("Спочатку створи продукт", "Вміст додається до продукту: уроки, файли, тексти, вправи.",
          h("a", { class: "btn btn-primary btn-sm", href: "#produkty/new" }, "Новий продукт")));
        return;
      }
      var pick = arg && productById(arg) ? productById(arg).id
        : (S.vmist.productId && productById(S.vmist.productId) ? S.vmist.productId : products[0].id);
      S.vmist.productId = pick;
      return D.loadContent(pick).then(function (c) {
        if (!alive(tok)) return;
        S.vmist.content = c;
        drawContent();
      });
    });
  }

  function refreshContent() {
    var pid = S.vmist.productId, tok = renderToken;
    return D.loadContent(pid).then(function (c) {
      if (!alive(tok) || !same(pid, S.vmist.productId)) return;
      S.vmist.content = c;
      drawContent();
    }, function (e) { toast(friendly(e), "error"); });
  }

  /* Runs a change, then shows the result and redraws. */
  function act(btn, makePromise, okMsg) {
    return busy(btn, makePromise()).then(function (r) {
      if (okMsg) toast(okMsg);
      return refreshContent().then(function () { return r; });
    }, function (e) { toast(friendly(e), "error"); });
  }

  function blocksOf(lessonId) {
    return sorted(S.vmist.content.blocks.filter(function (b) {
      return lessonId == null ? b.lesson_id == null : same(b.lesson_id, lessonId);
    }));
  }
  function lessonsOf(moduleId) {
    return sorted(S.vmist.content.lessons.filter(function (l) { return same(l.module_id, moduleId); }));
  }

  /* Moves item idx by dir (-1 / +1) inside its sorted siblings; renumbers 1..n. */
  function moveItem(table, siblings, idx, dir) {
    var j = idx + dir;
    if (j < 0 || j >= siblings.length) return Promise.resolve();
    var list = siblings.slice(), tmp = list[idx];
    list[idx] = list[j]; list[j] = tmp;
    var ups = [];
    list.forEach(function (it, i) { if (num(it.position) !== i + 1) ups.push([it.id, i + 1]); });
    return ups.reduce(function (p, u) {
      return p.then(function () { return D.updateRow(table, u[0], { position: u[1] }); });
    }, Promise.resolve());
  }

  function moveButtons(table, siblings, idx, what) {
    return [
      h("button", {
        class: "ad-icon-btn", type: "button", title: "Вище", "aria-label": what + ": пересунути вище", disabled: idx === 0,
        onclick: function (e) { act(e.currentTarget, function () { return moveItem(table, siblings, idx, -1); }); }
      }, "↑"),
      h("button", {
        class: "ad-icon-btn", type: "button", title: "Нижче", "aria-label": what + ": пересунути нижче", disabled: idx === siblings.length - 1,
        onclick: function (e) { act(e.currentTarget, function () { return moveItem(table, siblings, idx, 1); }); }
      }, "↓")
    ];
  }

  function drawContent() {
    var y = window.scrollY || 0;
    var C = S.vmist.content, p = productById(S.vmist.productId);
    clear(main);

    var picker = h("select", { id: "ad-pick", "aria-label": "Продукт" }, S.products.map(function (x) {
      return h("option", { value: String(x.id) }, x.title + " — " + (KIND_LABEL[x.kind] || x.kind));
    }));
    picker.value = String(p.id);
    picker.addEventListener("change", function () { window.location.hash = "#vmist/" + picker.value; });

    main.appendChild(sectionHead("Вміст продукту"));
    main.appendChild(h("div", { class: "ad-picker" }, [
      h("label", { for: "ad-pick" }, "Продукт"), picker,
      h("a", { class: "btn btn-ghost btn-sm", href: "#produkty/" + p.id }, "Налаштування продукту")
    ]));

    /* product level */
    var rootBox = h("section", { class: "pf-card ad-card ad-root" }, [
      h("h3", {}, "Без уроку — для всього продукту"),
      h("p", { class: "pf-hint" }, p.kind === "course" || p.kind === "teacher_course"
        ? "Сюди додавай те, що належить усьому курсові (наприклад, вступ чи загальний PDF). Окремі уроки — нижче."
        : "Для готового уроку, підручника чи журналу достатньо скласти урок із блоків прямо тут: текст, картинки, вправи, файли…"),
      blocksPanel(null)
    ]);
    main.appendChild(rootBox);

    /* modules & lessons */
    main.appendChild(h("h3", { class: "ad-h3" }, "Модулі та уроки"));
    var mods = sorted(C.modules);
    if (!mods.length) {
      main.appendChild(h("p", { class: "pf-hint" }, "Модулів ще немає. Модуль — це розділ курсу, у ньому лежать уроки. Для готового уроку чи підручника модулі не потрібні."));
    }
    mods.forEach(function (m, idx) { main.appendChild(moduleCard(m, idx, mods)); });

    var newMod = h("input", { type: "text", maxlength: "200", placeholder: "Назва нового модуля, наприклад: Знайомство", "aria-label": "Назва нового модуля" });
    var addMod = h("button", { class: "btn btn-primary btn-sm", type: "submit" }, "Додати модуль");
    var modForm = h("form", { class: "ad-add-form", novalidate: true }, [newMod, addMod]);
    modForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var t = trim(newMod.value);
      if (!t) { toast("Напиши назву модуля.", "error"); newMod.focus(); return; }
      act(addMod, function () {
        return D.insertRow("course_modules", { product_id: p.id, title: t, position: maxPos(C.modules) + 1 });
      }, "Модуль додано.");
    });
    main.appendChild(h("div", { class: "pf-card ad-card" }, modForm));
    window.scrollTo(0, y);
  }

  function moduleCard(m, idx, mods) {
    var C = S.vmist.content;
    var lessons = lessonsOf(m.id);
    var head = h("header", { class: "ad-module-head" }, [
      h("span", { class: "ad-module-no" }, "Модуль " + (idx + 1)),
      inlineEdit(m.title, {
        label: "Назва модуля",
        onSave: function (v) { return act(null, function () { return D.updateRow("course_modules", m.id, { title: v }); }, "Назву збережено."); }
      }),
      h("span", { class: "ad-row-actions" }, moveButtons("course_modules", mods, idx, "Модуль «" + m.title + "»").concat([
        h("button", {
          class: "ad-link-danger", type: "button",
          onclick: function (e) { deleteModule(e.currentTarget, m, lessons); }
        }, "Видалити")
      ]))
    ]);

    var ol = h("ol", { class: "ad-lessons" });
    lessons.forEach(function (l, li) { ol.appendChild(lessonItem(l, li, lessons)); });

    var newLes = h("input", { type: "text", maxlength: "200", placeholder: "Назва нового уроку", "aria-label": "Назва нового уроку в модулі «" + m.title + "»" });
    var addLes = h("button", { class: "btn btn-ghost btn-sm", type: "submit" }, "Додати урок");
    var lesForm = h("form", { class: "ad-add-form", novalidate: true }, [newLes, addLes]);
    lesForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var t = trim(newLes.value);
      if (!t) { toast("Напиши назву уроку.", "error"); newLes.focus(); return; }
      act(addLes, function () {
        return D.insertRow("course_lessons", { module_id: m.id, title: t, summary: null, position: maxPos(lessons) + 1 }).then(function (row) {
          S.vmist.open[String(row.id)] = true;
          return row;
        });
      }, "Урок додано.");
    });

    return h("article", { class: "pf-card ad-card ad-module" }, [
      head,
      lessons.length ? ol : h("p", { class: "pf-hint" }, "У цьому модулі ще немає уроків."),
      lesForm
    ]);
  }

  function deleteModule(btn, m, lessons) {
    var C = S.vmist.content, ids = lessons.map(function (l) { return String(l.id); });
    var blocks = C.blocks.filter(function (x) { return x.lesson_id != null && ids.indexOf(String(x.lesson_id)) > -1; });
    var text = "Модуль «" + m.title + "» зникне разом з усім, що в ньому: "
      + lessons.length + " " + plural(lessons.length, "урок", "уроки", "уроків") + ", "
      + blocks.length + " " + plural(blocks.length, "блок", "блоки", "блоків")
      + ". Файли теж видаляться зі сховища. Результати й роботи учнів у цих блоках пропадуть. Це не можна скасувати.";
    confirmBox({ title: "Видалити модуль?", text: text, okLabel: "Так, видалити", danger: true }).then(function (yes) {
      if (!yes) return;
      var paths = orphanPaths(blocks);
      act(btn, function () {
        return D.deleteRow("course_modules", m.id).then(function () { return D.removeFiles(paths).catch(function () {}); });
      }, "Модуль видалено.");
    });
  }

  function deleteLesson(btn, l) {
    var C = S.vmist.content;
    var blocks = C.blocks.filter(function (x) { return same(x.lesson_id, l.id); });
    var text = "Урок «" + l.title + "» зникне разом з усім, що в ньому: "
      + blocks.length + " " + plural(blocks.length, "блок", "блоки", "блоків")
      + ". Файли теж видаляться зі сховища. Результати й роботи учнів у цих блоках пропадуть. Це не можна скасувати.";
    confirmBox({ title: "Видалити урок?", text: text, okLabel: "Так, видалити", danger: true }).then(function (yes) {
      if (!yes) return;
      var paths = orphanPaths(blocks);
      act(btn, function () {
        return D.deleteRow("course_lessons", l.id).then(function () { return D.removeFiles(paths).catch(function () {}); });
      }, "Урок видалено.");
    });
  }

  function lessonItem(l, idx, lessons) {
    var key = String(l.id);
    var open = !!S.vmist.open[key];
    var nb = S.vmist.content.blocks.filter(function (x) { return same(x.lesson_id, l.id); }).length;

    var toggle = h("button", {
      class: "ad-toggle", type: "button", "aria-expanded": open ? "true" : "false",
      "aria-label": (open ? "Згорнути урок «" : "Розгорнути урок «") + l.title + "»",
      onclick: function () { S.vmist.open[key] = !S.vmist.open[key]; drawContent(); }
    }, open ? "▾" : "▸");

    var head = h("div", { class: "ad-lesson-head" }, [
      toggle,
      inlineEdit(l.title, {
        label: "Назва уроку",
        onSave: function (v) { return act(null, function () { return D.updateRow("course_lessons", l.id, { title: v }); }, "Назву збережено."); }
      }),
      h("small", { class: "ad-muted ad-lesson-count" }, nb + " " + plural(nb, "блок", "блоки", "блоків")),
      h("span", { class: "ad-row-actions" }, moveButtons("course_lessons", lessons, idx, "Урок «" + l.title + "»").concat([
        h("button", { class: "ad-link-danger", type: "button", onclick: function (e) { deleteLesson(e.currentTarget, l); } }, "Видалити")
      ]))
    ]);

    var li = h("li", { class: "ad-lesson" + (open ? " is-open" : "") }, head);
    if (open) {
      var sum = h("textarea", { rows: "2", maxlength: "500", "aria-label": "Короткий опис уроку", placeholder: "Одне-два речення про урок (бачать учні)" });
      sum.value = l.summary || "";
      var sumBtn = h("button", { class: "btn btn-ghost btn-sm", type: "button" }, "Зберегти опис");
      sumBtn.addEventListener("click", function () {
        act(sumBtn, function () { return D.updateRow("course_lessons", l.id, { summary: trim(sum.value) || null }); }, "Опис збережено.");
      });
      li.appendChild(h("div", { class: "ad-lesson-body" }, [
        h("div", { class: "ad-summary" }, [h("label", { class: "ad-label" }, "Короткий опис уроку"), sum, sumBtn]),
        h("h4", { class: "ad-h4" }, "Блоки уроку"),
        blocksPanel(l.id)
      ]));
    }
    return li;
  }

  /* ---------- the block builder of one lesson (assets/admin-blocks.js draws it) ---------- */
  var demoBlobs = {};   // demo mode: uploaded file path -> address of the file in this browser tab

  function signedUrlFor(src) {
    src = String(src == null ? "" : src);
    if (demoBlobs[src]) return Promise.resolve(demoBlobs[src]);
    if (IS_DEMO && /^assets\//.test(src)) return Promise.resolve(src);   // a picture of the site itself
    if (window.FMMAccount && typeof window.FMMAccount.signedUrl === "function") return window.FMMAccount.signedUrl(src);
    return Promise.resolve(src);
  }

  /* Files that only the deleted blocks pointed at (copies of a block share their files). */
  function orphanPaths(deleted) {
    var BE = window.FMMBlockEditors, pid = S.vmist.productId;
    if (!BE || !BE.helpers || !deleted.length) return [];
    var ids = deleted.map(function (b) { return String(b.id); });
    var rest = S.vmist.content.blocks.filter(function (b) { return ids.indexOf(String(b.id)) < 0; });
    var cand = [];
    deleted.forEach(function (b) { BE.helpers.collectPaths(b.content, pid).forEach(function (p) { cand.push(p); }); });
    return BE.helpers.unusedPaths(cand, rest, pid);
  }

  /* Numbers a list 1..n again; only the rows whose number changed are written. */
  function renumber(list) {
    return list.reduce(function (p, it, i) {
      return num(it.position) === i + 1 ? p : p.then(function () { return D.updateRow("lesson_blocks", it.id, { position: i + 1 }); });
    }, Promise.resolve());
  }

  /* Runs a change, shows the result, redraws. Resolves true (done), false (the
     database refused: nothing was written) or "unknown" (no answer came back, e.g.
     the network dropped: the change may or may not have been written). The error
     is already shown. */
  function blockStep(makePromise, okMsg) {
    return Promise.resolve().then(makePromise).then(function () {
      if (okMsg) toast(okMsg);
      return refreshContent().then(function () { return true; }, function (e) {
        toast("Збережено, але список не вдалося оновити. " + friendly(e), "error");
        return true;
      });
    }, function (e) {
      toast(friendly(e), "error");
      return H.writeUncertain(e) ? "unknown" : false;
    });
  }

  function blockDeps(lessonId) {
    var pid = S.vmist.productId;
    return {
      openModal: openModal, confirm: confirmBox, toast: toast, friendly: friendly,
      upload: function (file) { return D.upload(pid, file); },
      removeFiles: function (paths) { return D.removeFiles(paths).catch(function () {}); },
      signedUrl: signedUrlFor,
      allBlocks: function () { return S.vmist.content.blocks; },
      insert: function (type, content, afterId) {
        return blockStep(function () {
          var siblings = blocksOf(lessonId);
          return D.insertRow("lesson_blocks", {
            product_id: pid, lesson_id: lessonId == null ? null : lessonId, type: type, content: content, position: maxPos(siblings) + 1
          }).then(function (row) {
            if (afterId == null) return row;
            var order = siblings.slice(), at = -1;
            order.forEach(function (x, i) { if (same(x.id, afterId)) at = i; });
            order.splice(at < 0 ? order.length : at + 1, 0, row);
            return renumber(order);
          });
        }, afterId == null ? "Блок додано." : "Копію зроблено.");
      },
      update: function (block, content) {
        return blockStep(function () { return D.updateRow("lesson_blocks", block.id, { content: content }); }, "Блок збережено.");
      },
      remove: function (block) {
        return blockStep(function () { return D.deleteRow("lesson_blocks", block.id); }, "Блок видалено.");
      },
      move: function (block, dir) {
        var sib = blocksOf(lessonId), idx = -1;
        sib.forEach(function (x, i) { if (same(x.id, block.id)) idx = i; });
        return blockStep(function () { return moveItem("lesson_blocks", sib, idx, dir); });
      }
    };
  }

  function blocksPanel(lessonId) {
    var wrap = h("div", { class: "ad-container" });
    var BE = window.FMMBlockEditors;
    if (!BE || typeof BE.mount !== "function") {
      wrap.appendChild(h("p", { class: "pf-msg is-error" }, "Конструктор блоків не підключився. Онови сторінку (Cmd+Shift+R)."));
      return wrap;
    }
    BE.mount(wrap, { productId: S.vmist.productId, lessonId: lessonId, blocks: blocksOf(lessonId), deps: blockDeps(lessonId) });
    return wrap;
  }

  /* =================================================================
     8. Section: Учні
     ================================================================= */
  function statusOfEnt(e) {
    if (e.revoked_at) return { text: "Закритий", cls: "is-warn", state: "revoked" };
    if (e.expires_at && new Date(e.expires_at).getTime() < Date.now()) return { text: "Строк минув", cls: "is-muted", state: "expired" };
    return { text: e.expires_at ? "Активний до " + fmtDate(e.expires_at) : "Активний", cls: "is-ok", state: "active" };
  }

  function viewPeople(arg, tok) {
    return loadProducts().then(function () { return D.searchProfiles(S.people.q); }).then(function (rows) {
      if (!alive(tok)) return;
      S.people.results = rows;
      drawPeople();
    });
  }

  function drawPeople() {
    clear(main);
    main.appendChild(sectionHead("Учні"));

    /* --- grant access --- */
    var email = h("input", { type: "email", inputmode: "email", autocomplete: "off", autocapitalize: "none", spellcheck: "false", placeholder: "учениця@пошта.com" });
    var grantable = (S.products || []).filter(function (p) { return p.billing !== "subscription"; });
    var prod = h("select", {}, [h("option", { value: "" }, "— обери продукт —")].concat(grantable.map(function (p) {
      return h("option", { value: p.slug }, p.title + " — " + (KIND_LABEL[p.kind] || p.kind) + (p.is_published ? "" : " (чернетка)"));
    })));
    var send = h("input", { type: "checkbox", id: "ad-send", checked: true });
    var fEmail = field("Email учениці *", email, "Якщо акаунта ще немає, він створиться сам.");
    var fProd = field("Що відкрити *", prod, "Підписки (журнал, подкаст) тут не показано: до них доступ відкривається тільки через оплату.");
    var sendWrap = h("div", { class: "field ad-field ad-check" }, [
      h("label", { for: "ad-send", class: "ad-check-label" }, [send, h("span", {}, "Надіслати їй лист")]),
      h("p", { class: "pf-hint" }, "У листі — посилання, щоб створити пароль і зайти в кабінет.")
    ]);
    var msg = h("p", { class: "pf-msg", role: "status", "aria-live": "polite" });
    var grantBtn = h("button", { class: "btn btn-primary", type: "submit" }, "Відкрити доступ");
    var grantForm = h("form", { novalidate: true, class: "ad-form" }, [
      h("div", { class: "ad-form-grid" }, [fEmail, fProd]), sendWrap, msg, h("div", { class: "ad-actions" }, [grantBtn])
    ]);
    function setMsg(text, kind) { msg.textContent = text || ""; msg.className = "pf-msg" + (kind ? " is-" + kind : ""); }

    grantForm.addEventListener("submit", function (e) {
      e.preventDefault();
      setErr(fEmail, ""); setErr(fProd, ""); setMsg("");
      var em = trim(email.value).toLowerCase(), ok = true;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { setErr(fEmail, "Напиши email повністю, наприклад anna@gmail.com"); ok = false; }
      if (!prod.value) { setErr(fProd, "Обери, що відкрити."); ok = false; }
      if (!ok) { (fEmail._err.hidden ? prod : email).focus(); return; }
      var chosen = prod.options[prod.selectedIndex].text.replace(/ — .*$/, "");
      busy(grantBtn, D.grantAccess(em, prod.value, send.checked)).then(function (res) {
        var t = "Готово: " + em + " тепер має доступ до «" + chosen + "».";
        if (res.created) t += " Акаунт створено.";
        var kind = "ok";
        if (res.email === "sent") t += " Лист надіслано.";
        else if (res.email === "failed") { t += " Лист не вдалося надіслати — учениця може сама натиснути «Забула пароль» на сторінці входу."; kind = "info"; }
        else if (res.email === "skipped") { t += " Лист не надіслано: пошта ще не підключена. Учениця може натиснути «Забула пароль»."; kind = "info"; }
        setMsg(t, kind);
        toast("Доступ відкрито.");
        S.people.q = em;
        return D.searchProfiles(em).then(function (rows) {
          S.people.results = rows;
          var hit = rows.filter(function (r) { return same(r.id, res.user_id); })[0] || rows[0];
          S.people.selected = hit || null;
          S.people.ents = null;
          paintPeopleList();
          return hit ? selectPerson(hit, true) : null;
        });
      }, function (er) {
        var text = friendly(er);
        setMsg(text, "error");
        if (String(er && er.code) === "invalid_email") setErr(fEmail, text);
        toast(text, "error");
      });
    });
    main.appendChild(h("section", { class: "pf-card ad-card" }, [h("h3", {}, "Відкрити доступ"),
      h("p", { class: "pf-hint" }, "Для тих, хто заплатив поза сайтом, або щоб подарувати матеріал."), grantForm]));

    /* --- search + list + details --- */
    var search = h("input", { type: "search", placeholder: "Email або ім'я", value: S.people.q, autocomplete: "off", "aria-label": "Пошук учениці" });
    var listBox = h("div", { class: "ad-people-list" });
    var detail = h("div", { class: "ad-people-detail", "aria-live": "polite" });
    var timer = null;

    function paintPeopleList() {
      clear(listBox);
      var rows = S.people.results || [];
      search.value = S.people.q;
      if (!rows.length) {
        listBox.appendChild(h("p", { class: "pf-hint" }, trim(S.people.q) ? "Нікого не знайдено. Перевір написання email." : "Поки що немає зареєстрованих учнів."));
        return;
      }
      listBox.appendChild(h("p", { class: "pf-hint" }, trim(S.people.q) ? "Знайдено: " + rows.length : "Останні, хто зареєструвався:"));
      var ul = h("ul", { class: "ad-person-list" });
      rows.forEach(function (r) {
        var sel = S.people.selected && same(S.people.selected.id, r.id);
        ul.appendChild(h("li", {}, h("button", {
          type: "button", class: "ad-person" + (sel ? " is-selected" : ""), "aria-pressed": sel ? "true" : "false",
          onclick: function () { selectPerson(r); }
        }, [h("strong", {}, r.full_name || "Без імені"), h("small", {}, r.email || "")])));
      });
      listBox.appendChild(ul);
    }

    function paintDetail() {
      clear(detail);
      var pr = S.people.selected;
      if (!pr) { detail.appendChild(h("p", { class: "pf-hint" }, "Обери людину зі списку, щоб побачити, до чого в неї є доступ.")); return; }
      detail.appendChild(h("h3", {}, pr.full_name || "Без імені"));
      detail.appendChild(h("p", { class: "ad-person-meta" }, [pr.email || "", " · зареєструвалась ", fmtDate(pr.created_at)]));
      detail.appendChild(h("div", { class: "ad-adds" }, [
        h("button", { class: "btn btn-ghost btn-sm", type: "button", onclick: function () {
          email.value = pr.email || ""; setErr(fEmail, ""); email.scrollIntoView({ block: "center" }); email.focus();
        } }, "Відкрити їй ще доступ")
      ]));
      if (S.people.ents == null) { detail.appendChild(h("p", { class: "pf-hint" }, "Завантажую…")); return; }
      if (!S.people.ents.length) { detail.appendChild(h("p", { class: "pf-hint" }, "Доступів поки немає.")); return; }
      var tbody = h("tbody");
      S.people.ents.forEach(function (en) {
        var st = statusOfEnt(en);
        var action = null;
        if (st.state === "revoked") {
          action = h("button", { class: "btn btn-ghost btn-sm", type: "button", onclick: function (ev) { setRevoked(ev.currentTarget, en, false); } }, "Повернути доступ");
        } else if (st.state === "active") {
          action = h("button", { class: "btn btn-ghost btn-sm ad-danger-text", type: "button", onclick: function (ev) { setRevoked(ev.currentTarget, en, true); } }, "Закрити доступ");
        } else {
          action = h("span", { class: "pf-hint" }, "Щоб відкрити знову — «Відкрити доступ» вище.");
        }
        tbody.appendChild(h("tr", {}, [
          h("td", { "data-label": "Продукт", class: "ad-td-main" }, [h("strong", {}, (en.product && en.product.title) || "—"), h("small", {}, KIND_LABEL[en.product && en.product.kind] || "")]),
          h("td", { "data-label": "Звідки" }, SOURCE_LABEL[en.source] || en.source),
          h("td", { "data-label": "Відкрито" }, fmtDate(en.granted_at)),
          h("td", { "data-label": "Стан" }, badge(st.text, st.cls)),
          h("td", { class: "ad-td-actions" }, action)
        ]));
      });
      detail.appendChild(h("table", { class: "ad-table" }, [
        h("thead", {}, h("tr", {}, [h("th", {}, "Продукт"), h("th", {}, "Звідки"), h("th", {}, "Відкрито"), h("th", {}, "Стан"), h("th", {}, h("span", { class: "sr-only" }, "Дії"))])),
        tbody
      ]));
    }

    function setRevoked(btn, en, revoke) {
      var title = (en.product && en.product.title) || "цей продукт";
      var go = function () {
        busy(btn, D.setRevoked(en.id, revoke)).then(function () {
          toast(revoke ? "Доступ закрито." : "Доступ повернуто.");
          return D.getEntitlements(S.people.selected.id).then(function (rows) { S.people.ents = rows; paintDetail(); });
        }, function (er) { toast(friendly(er), "error"); });
      };
      if (!revoke) { go(); return; }
      confirmBox({
        title: "Закрити доступ?",
        text: "Учениця більше не зможе відкривати «" + title + "». Файли й уроки зникнуть із її кабінету. Потім доступ можна повернути однією кнопкою.",
        okLabel: "Так, закрити", danger: true
      }).then(function (yes) { if (yes) go(); });
    }

    function selectPerson(pr, quiet) {
      S.people.selected = pr; S.people.ents = null;
      paintPeopleList(); paintDetail();
      return D.getEntitlements(pr.id).then(function (rows) {
        if (!S.people.selected || !same(S.people.selected.id, pr.id)) return;
        S.people.ents = rows; paintDetail();
      }, function (er) { toast(friendly(er), "error"); });
    }

    search.addEventListener("input", function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        S.people.q = search.value;
        D.searchProfiles(S.people.q).then(function (rows) { S.people.results = rows; paintPeopleList(); }, function (er) { toast(friendly(er), "error"); });
      }, 300);
    });

    main.appendChild(h("section", { class: "pf-card ad-card" }, [
      h("h3", {}, "Знайти ученицю"),
      h("div", { class: "ad-people" }, [h("div", {}, [search, listBox]), detail])
    ]));
    paintPeopleList();
    paintDetail();
    if (S.people.selected) selectPerson(S.people.selected, true);
  }

  /* =================================================================
     9. Section: Замовлення
     ================================================================= */
  function viewOrders(arg, tok) {
    return D.listOrders().then(function (rows) {
      if (!alive(tok)) return;
      clear(main);
      main.appendChild(sectionHead("Замовлення"));
      main.appendChild(h("p", { class: "pf-hint" }, "Останні 100 замовлень. Тут можна тільки дивитись."));
      if (!rows.length) { main.appendChild(emptyBox("Замовлень ще немає", "Вони з'являться тут, щойно хтось купить.")); return; }
      var tbody = h("tbody");
      rows.forEach(function (o) {
        var st = ORDER_STATUS[o.status] || [o.status, "is-muted"];
        var items = (o.items || []).map(function (it) { return it.title + (it.quantity > 1 ? " ×" + it.quantity : ""); }).join("; ") || "—";
        tbody.appendChild(h("tr", {}, [
          h("td", { "data-label": "Дата" }, fmtDate(o.created_at, true)),
          h("td", { "data-label": "Email", class: "ad-td-email" }, o.email || "—"),
          h("td", { "data-label": "Що купили", class: "ad-td-main" }, [items, o.source === "manual" ? h("small", {}, "додано вручну") : null]),
          h("td", { "data-label": "Сума", class: "ad-td-num" }, o.amount_total_cents == null ? "—" : formatMoney(o.amount_total_cents, o.currency)),
          h("td", { "data-label": "Стан" }, badge(st[0], st[1]))
        ]));
      });
      main.appendChild(h("table", { class: "ad-table" }, [
        h("thead", {}, h("tr", {}, [h("th", {}, "Дата"), h("th", {}, "Email"), h("th", {}, "Що купили"), h("th", { class: "ad-td-num" }, "Сума"), h("th", {}, "Стан")])),
        tbody
      ]));
    });
  }

  /* =================================================================
     9b. Section: Роботи учнів (open answers and files to check)
     ================================================================= */
  var WORK_TYPE = { open_answer: "Відкрита відповідь", student_file: "Файл учня" };

  function workTask(row) {
    var c = (row.block && row.block.content) || {};
    return trim(row.block && row.block.type === "student_file" ? c.task : c.question);
  }
  function plainTask(row) {
    return workTask(row).replace(/\[([^\]\n]+)\]\([^)\s]*\)/g, "$1").replace(/^\s*(#{1,6}|>|-)\s+/gm, "").replace(/[*_`]/g, "").replace(/\s+/g, " ");
  }
  function studentName(row) {
    var s = row.student || {};
    return trim(s.name) || s.email || "Учень";
  }

  /* the number of unchecked works on the tab (from a count query); unknown -> no number */
  function updateWorkBadge() {
    var a = $('#ad-tabs a[data-tab="roboty"]');
    if (!a) return;
    var n = S.work.pendingCount;
    var old = a.querySelector(".ad-tab-count");
    if (old) old.parentNode.removeChild(old);
    if (n) a.appendChild(h("span", { class: "ad-tab-count", "aria-label": n + " " + plural(n, "робота очікує", "роботи очікують", "робіт очікують") }, String(n)));
  }
  function refreshPendingCount() {
    return D.countWork("submitted").then(function (n) { S.work.pendingCount = n; updateWorkBadge(); }, function () {});
  }

  function workKind() { return S.work.filter === "reviewed" ? "reviewed" : "pending"; }
  /* loads the first page (or, with append, the next one) of pending / reviewed works */
  function loadWork(kind, append) {
    var L = S.work[kind], from = append && L.rows ? L.rows.length : 0;
    return D.listWork({ status: kind === "reviewed" ? "reviewed" : "submitted", from: from, limit: WORK_PAGE }).then(function (res) {
      L.rows = append && L.rows ? L.rows.concat(res.rows) : res.rows;
      L.more = !!res.more;
    });
  }

  function viewWork(arg, tok) {
    return Promise.all([loadWork(workKind(), false), refreshPendingCount()]).then(function () {
      if (!alive(tok)) return;
      drawWork();
    });
  }

  /* after a review: both lists start again from the first page */
  function reloadWork() {
    var tok = renderToken;
    S.work.pending.rows = null; S.work.reviewed.rows = null;
    return Promise.all([loadWork(workKind(), false), refreshPendingCount()]).then(function () {
      if (alive(tok) && parseHash().tab === "roboty") drawWork();
    }, function (e) { toast(friendly(e), "error"); });
  }

  function drawWork() {
    var kind = workKind(), L = S.work[kind], rows = L.rows || [];
    var f = S.work.filter === "reviewed" ? "reviewed" : "pending";
    var shown = rows;
    clear(main);
    main.appendChild(sectionHead("Роботи учнів"));
    main.appendChild(h("p", { class: "pf-hint" }, "Тут з'являються відповіді й файли, які учні надсилають із блоків «Відкрита відповідь» та «Файл учня». Відкрий роботу, напиши відгук і, якщо хочеш, постав бал — учень побачить це у своєму кабінеті."));

    var pendingLabel = "Очікують" + (S.work.pendingCount != null ? " (" + S.work.pendingCount + ")" : "");
    var filters = h("div", { class: "ad-seg", role: "group", "aria-label": "Які роботи показати" }, [
      ["pending", pendingLabel],
      ["reviewed", "Перевірені"]
    ].map(function (x) {
      return h("button", {
        type: "button", class: "ad-seg-btn" + (f === x[0] ? " is-on" : ""), "aria-pressed": f === x[0] ? "true" : "false",
        onclick: function () {
          S.work.filter = x[0];
          var tok = renderToken, K = S.work[x[0]];
          if (K.rows) { drawWork(); return; }
          loadWork(x[0], false).then(function () { if (alive(tok)) drawWork(); }, function (e) { toast(friendly(e), "error"); });
        }
      }, x[1]);
    }));
    main.appendChild(filters);

    if (!shown.length) {
      main.appendChild(emptyBox(
        f === "reviewed" ? "Перевірених робіт ще немає" : "Усе перевірено",
        f === "pending" ? "Нових робіт від учнів немає. Коли хтось надішле — вони з'являться тут." : "Вони з'являться тут, щойно ти перевіриш першу роботу."));
      return;
    }
    if (f === "pending") main.appendChild(h("p", { class: "pf-hint" }, "Найстаріші зверху: спочатку ті, що чекають довше."));

    var tbody = h("tbody");
    shown.forEach(function (r) {
      var done = r.status === "reviewed";
      var task = plainTask(r);
      tbody.appendChild(h("tr", {}, [
        h("td", { "data-label": "Надіслано" }, fmtDate(r.submitted_at, true)),
        h("td", { "data-label": "Учень", class: "ad-td-main" }, [h("strong", {}, studentName(r)), r.student && r.student.email && trim(r.student.name) ? h("small", {}, r.student.email) : null]),
        h("td", { "data-label": "Де", class: "ad-td-main" }, [
          h("strong", {}, r.product_title || "—"),
          h("small", {}, (r.lesson_title ? r.lesson_title + " · " : "") + (WORK_TYPE[r.block && r.block.type] || "Робота") + (task ? ": " + (task.length > 70 ? task.slice(0, 69) + "…" : task) : ""))
        ]),
        h("td", { "data-label": "Стан" }, [
          badge(done ? "Перевірено" : "Очікує", done ? "is-ok" : "is-warn"),
          done && r.score != null ? h("small", {}, "Бал: " + r.score) : null
        ]),
        h("td", { class: "ad-td-actions" }, h("button", { class: "btn " + (done ? "btn-ghost" : "btn-primary") + " btn-sm", type: "button", onclick: function () { openWorkReview(r); } }, done ? "Переглянути" : "Перевірити"))
      ]));
    });
    main.appendChild(h("table", { class: "ad-table" }, [
      h("thead", {}, h("tr", {}, [h("th", {}, "Надіслано"), h("th", {}, "Учень"), h("th", {}, "Де"), h("th", {}, "Стан"), h("th", {}, "")])),
      tbody
    ]));
    if (L.more) {
      var moreBtn = h("button", { class: "btn btn-ghost", type: "button" }, "Показати ще");
      moreBtn.addEventListener("click", function () {
        var tok = renderToken;
        busy(moreBtn, loadWork(kind, true)).then(function () { if (alive(tok)) drawWork(); }, function (e) { toast(friendly(e), "error"); });
      });
      main.appendChild(h("div", { class: "ad-actions" }, moreBtn));
    }
  }

  function fileKind(f) {
    var t = String((f && f.type) || "").toLowerCase(), e = extOf(f && (f.name || f.path));
    if (t.indexOf("audio/") === 0 || /^(mp3|m4a|wav|ogg|aac|webm|oga|opus)$/.test(e) && t.indexOf("video/") !== 0) return "audio";
    if (t.indexOf("image/") === 0 || /^(jpg|jpeg|png|gif|webp|heic|avif)$/.test(e)) return "image";
    return "file";
  }

  /* row: the work as Maria opened it (row.submitted_at is the version she is reading);
     draft: text she had typed for an earlier version { feedback, score } */
  function openWorkReview(row, draft) {
    var done = row.status === "reviewed";
    var feedback = h("textarea", { class: "ad-review-text", rows: "7", maxlength: "10000", "aria-label": "Відгук для учня", placeholder: "Напиши відгук: що вийшло добре, що виправити. Можна ## заголовки, - списки, **жирний**." });
    feedback.value = row.feedback || "";
    var score = h("input", { type: "number", min: "0", max: "100", step: "1", inputmode: "numeric", "aria-label": "Бал", class: "ad-review-score" });
    score.value = row.score == null ? "" : String(row.score);
    var preview = h("div", { class: "ad-preview ad-md ad-review-prev", "aria-label": "Так учень побачить відгук" });
    var err = h("p", { class: "ad-err", role: "alert", hidden: true });
    var saveBtn = h("button", { class: "btn btn-primary", type: "submit" }, done ? "Зберегти зміни" : "Зберегти перевірку");
    var closeBtn = h("button", { class: "btn btn-ghost", type: "button" }, "Закрити");
    var startFb = feedback.value, startScore = score.value;
    if (draft) { feedback.value = draft.feedback || ""; score.value = draft.score || ""; }

    function paint() {
      var v = trim(feedback.value);
      preview.innerHTML = v ? mdToHtml(feedback.value) : "";
      preview.hidden = !v;
    }
    feedback.addEventListener("input", paint);

    var modal = openModal({
      title: "Робота: " + studentName(row), wide: true, sticky: true, focus: false,
      isDirty: function () { return feedback.value !== startFb || score.value !== startScore; }
    });

    /* left: what the student sent */
    var mine = h("div", { class: "ad-work" });
    mine.appendChild(h("p", { class: "ad-person-meta" }, [
      (row.student && row.student.email) ? row.student.email + " · " : "",
      row.product_title || "", row.lesson_title ? " › " + row.lesson_title : "",
      " · надіслано " + fmtDate(row.submitted_at, true)
    ]));
    mine.appendChild(h("h4", { class: "ad-h4" }, "Завдання"));
    var taskBox = h("div", { class: "ad-md ad-work-task" });
    taskBox.innerHTML = workTask(row) ? mdToHtml(workTask(row)) : "";
    if (!workTask(row)) taskBox.appendChild(h("p", { class: "ad-muted" }, "Завдання не збереглось (блок видалений)."));
    mine.appendChild(taskBox);
    mine.appendChild(h("h4", { class: "ad-h4" }, "Відповідь учня"));
    if (trim(row.text)) mine.appendChild(h("div", { class: "ad-work-text" }, row.text));
    var files = Array.isArray(row.files) ? row.files : [];
    if (!trim(row.text) && !files.length) mine.appendChild(h("p", { class: "ad-muted" }, "Нічого не надіслано."));
    files.forEach(function (f) {
      var box = h("div", { class: "ad-work-file" }, [h("p", { class: "ad-work-fname" }, [h("strong", {}, f.name || "файл"), f.size ? h("small", {}, " " + fmtSize(f.size)) : null])]);
      var kind = fileKind(f);
      var status = h("p", { class: "ad-up-status" }, "Готую файл…");
      box.appendChild(status);
      D.workFileUrl(f.path).then(function (url) {
        status.parentNode && status.parentNode.removeChild(status);
        if (kind === "audio") box.appendChild(h("audio", { controls: true, preload: "metadata", src: url, class: "ad-work-audio" }));
        else if (kind === "image") box.appendChild(h("a", { href: url, target: "_blank", rel: "noopener" }, h("img", { src: url, alt: "Картинка від учня: " + (f.name || ""), class: "ad-work-img" })));
        box.appendChild(h("a", { class: "btn btn-ghost btn-sm", href: url, target: "_blank", rel: "noopener" }, kind === "audio" ? "Відкрити окремо" : "Відкрити файл"));
      }, function (e) { status.textContent = "Не вдалося відкрити файл: " + friendly(e); });
      mine.appendChild(box);
    });

    /* right: feedback */
    var form = h("form", { class: "ad-review", novalidate: true }, [
      h("h4", { class: "ad-h4" }, done ? "Відгук (уже надіслано " + fmtDate(row.reviewed_at, true) + ")" : "Твій відгук"),
      feedback,
      h("p", { class: "pf-hint" }, "Учень побачить цей текст у своєму кабінеті."),
      preview,
      h("div", { class: "field ad-field" }, [
        h("label", {}, "Бал (необов'язково)"), score,
        h("p", { class: "pf-hint" }, "Ціле число від 0 до 100. Залиш порожнім, якщо бал не потрібен.")
      ]),
      err,
      h("div", { class: "ad-actions" }, [saveBtn, closeBtn])
    ]);
    modal.body.appendChild(h("div", { class: "ad-split" }, [mine, form]));
    paint();
    closeBtn.addEventListener("click", function () { modal.requestClose(); });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var fb = trim(feedback.value), sc = trim(score.value), scoreVal = null;
      err.hidden = true;
      if (sc !== "") {
        if (!/^\d{1,3}$/.test(sc) || Number(sc) > 100) { err.textContent = "Бал — це ціле число від 0 до 100."; err.hidden = false; score.focus(); return; }
        scoreVal = Number(sc);
      }
      if (!fb && scoreVal == null) { err.textContent = "Напиши відгук або постав бал."; err.hidden = false; feedback.focus(); return; }
      busy(saveBtn, D.reviewWork(row.user_id, row.block_id, fb, scoreVal, row.submitted_at)).then(function () {
        toast("Перевірку збережено.");
        startFb = feedback.value; startScore = score.value;
        modal.close();
        reloadWork();
      }, function (er) {
        if (er && er.code === "work_changed") {
          /* the student sent a new version while this window was open: show it, keep what Maria typed */
          toast("Учень щойно надіслав нову версію — показую її");
          var keep = { feedback: feedback.value, score: score.value };
          D.getWork(row.user_id, row.block_id).then(function (fresh) {
            startFb = feedback.value; startScore = score.value;
            modal.close();
            if (fresh) openWorkReview(fresh, keep);
            reloadWork();
          }, function (e2) { toast(friendly(e2), "error"); });
          return;
        }
        toast(friendly(er), "error");
      });
    });
    setTimeout(function () { feedback.focus(); }, 30);
  }

  /* =================================================================
     10. Start: who is asking?  routes
     ================================================================= */
  function parseHash() {
    var raw = String(window.location.hash || "").replace(/^#/, "");
    var parts = raw.split("/");
    var tabs = ["produkty", "vmist", "uchni", "zamovlennia", "roboty"];
    return { tab: tabs.indexOf(parts[0]) > -1 ? parts[0] : "produkty", arg: parts[1] || "" };
  }

  function route() {
    var r = parseHash();
    renderToken += 1;
    var tok = renderToken;
    Array.prototype.forEach.call(document.querySelectorAll("#ad-tabs a"), function (a) {
      var on = a.getAttribute("data-tab") === r.tab;
      a.classList.toggle("is-active", on);
      if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    var views = { produkty: viewProducts, vmist: viewContent, uchni: viewPeople, zamovlennia: viewOrders, roboty: viewWork };
    clear(main);
    main.appendChild(h("p", { class: "ad-loading", role: "status" }, "Завантажую…"));
    window.scrollTo(0, 0);
    Promise.resolve().then(function () { return views[r.tab](r.arg, tok); }).catch(function (e) {
      if (!alive(tok)) return;
      clear(main);
      main.appendChild(h("div", { class: "pf-card ad-card" }, [
        h("p", { class: "pf-msg is-error" }, friendly(e)),
        h("button", { class: "btn btn-primary btn-sm", type: "button", onclick: route }, "Спробувати ще раз")
      ]));
    });
  }

  function gateMessage(parts) {
    var gate = $("#ad-gate");
    clear(gate);
    addKids(gate, parts);
    gate.hidden = false;
  }

  function init() {
    main = $("#ad-main");
    var A = window.FMMAccount;
    if (!A) {
      gateMessage(h("p", {}, "Не вдалося запустити адмін-панель: не завантажився файл account.js. Онови сторінку."));
      return;
    }
    IS_DEMO = !!A.isDemo();
    if (IS_DEMO) $("#ad-demo").hidden = false;

    var retry = h("button", { class: "btn btn-primary btn-sm", type: "button", onclick: function () { window.location.reload(); } }, "Спробувати ще раз");
    A.ready().then(function (client) {
      return A.session().then(function (s) {
        if (!s) {
          window.location.replace("vkhid.html?next=admin.html" + (IS_DEMO ? "&demo=1" : ""));
          return;
        }
        return A.isAdmin().then(function (isAdmin) {
          if (!isAdmin) {
            return A.user().then(function (u) {
              gateMessage([
                h("h2", {}, "Ця сторінка тільки для Марії"),
                h("p", {}, "Ти увійшла як " + ((u && u.email) || "—") + ", і в цього акаунта немає доступу до адмін-панелі."),
                h("div", { class: "ad-actions" }, [
                  h("a", { class: "btn btn-primary btn-sm", href: "kabinet.html" + (IS_DEMO ? "?demo=1" : "") }, "Мій кабінет"),
                  h("a", { class: "btn btn-ghost btn-sm", href: "index.html" }, "На головну")
                ])
              ]);
            });
          }
          D = IS_DEMO ? makeDemoData() : makeRealData(client);
          $("#ad-gate").hidden = true;
          $("#ad-app").hidden = false;
          var out = h("button", { class: "ad-link ad-signout", type: "button" }, "Вийти");
          out.addEventListener("click", function () {
            A.signOut().then(function () { window.location.replace("vkhid.html"); });
          });
          $(".ad-top").appendChild(out);
          window.addEventListener("hashchange", route);
          route();
          /* the number of unchecked works on the tab; if it cannot be read, no number */
          refreshPendingCount();
        });
      });
    }).catch(function (err) {
      if (window.console && console.error) console.error("admin:", err);
      gateMessage([
        h("h2", {}, "Не вдалося підключитися"),
        h("p", {}, "Перевір інтернет і спробуй ще раз."),
        retry
      ]);
    });
  }

  /* Handles for tests and for me when I check the page by script */
  window.FMMAdmin = { route: route, _state: S, _data: function () { return D; } };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
