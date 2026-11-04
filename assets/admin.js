/* =====================================================================
   Fika med Maria — admin area (admin.html). Ukrainian only.
   Sections (hash routes): #produkty  #vmist[/<id>]  #uchni  #zamovlennia
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

  var MATERIAL_KIND_LABEL = {
    pdf: "PDF", audio: "Аудіо", video: "Відео", link: "Посилання", other: "Файл", text: "Текст"
  };
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

  var H = {
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
        client.from("materials").select("*").eq("product_id", productId).order("position").order("id"),
        client.from("exercises").select("*").eq("product_id", productId).order("position").order("id")
      ]).then(function (rs) {
        var mods = must(rs[0]) || [], lessons = [];
        var modules = mods.map(function (m) {
          (m.course_lessons || []).forEach(function (l) { lessons.push(l); });
          var c = {}; for (var k in m) { if (k !== "course_lessons") c[k] = m[k]; }
          return c;
        });
        return { modules: modules, lessons: lessons, materials: must(rs[1]) || [], exercises: must(rs[2]) || [] };
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
  function makeDemoData() {
    var src = window.FMM_DEMO || {};
    var seq = 9000;
    var db = { products: [], course_modules: [], course_lessons: [], materials: [], exercises: [], profiles: [], entitlements: [], orders: [] };
    function clone(x) { return x == null ? x : JSON.parse(JSON.stringify(x)); }
    function later(v) { return new Promise(function (resolve) { setTimeout(function () { resolve(clone(v)); }, 30); }); }
    function nextId() { seq += 1; return seq; }

    var extra = {
      "svenska-a1-a2-forsta-steget": { price_cents: 4900, is_published: true, sort_order: 10 },
      "b1b2-lagom": { price_cents: 900, is_published: true, sort_order: 20 },
      "svenska-passiv": { price_cents: null, is_published: false, sort_order: 30 }
    };
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
          (l.materials || []).forEach(function (x) { db.materials.push(mat(p.id, l.id, x)); });
          (l.exercises || []).forEach(function (x) { db.exercises.push(exo(p.id, l.id, x)); });
        });
      });
      (pk.materials || []).forEach(function (x) { db.materials.push(mat(p.id, null, x)); });
      (pk.exercises || []).forEach(function (x) { db.exercises.push(exo(p.id, null, x)); });
    });
    function mat(pid, lid, x) {
      return { id: x.id, product_id: pid, lesson_id: lid, kind: x.kind, title: x.title, storage_path: x.storage_path || null,
        external_ref: x.external_ref || null, body: x.body == null ? null : x.body, position: x.position || 0 };
    }
    function exo(pid, lid, x) {
      return { id: x.id, product_id: pid, lesson_id: lid, title: x.title, instructions: x.instructions || "", content: clone(x.content), position: x.position || 0 };
    }

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
        db.materials = db.materials.filter(function (x) { return !same(x.lesson_id, id); });
        db.exercises = db.exercises.filter(function (x) { return !same(x.lesson_id, id); });
      }
    }

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
        materials: db.materials.filter(function (m) { return same(m.product_id, productId); }),
        exercises: db.exercises.filter(function (m) { return same(m.product_id, productId); })
      });
    };
    D.upload = function (productId, file) {
      var path = productId + "/" + Date.now() + "-" + safeFilename(file.name);
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
    people: { q: "", results: null, selected: null, ents: null }
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

  function chip(text, cls) { return h("span", { class: "ad-chip" + (cls ? " " + cls : "") }, text); }
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

  function materialsOf(lessonId) {
    return sorted(S.vmist.content.materials.filter(function (m) {
      return lessonId == null ? m.lesson_id == null : same(m.lesson_id, lessonId);
    }));
  }
  function exercisesOf(lessonId) {
    return sorted(S.vmist.content.exercises.filter(function (m) {
      return lessonId == null ? m.lesson_id == null : same(m.lesson_id, lessonId);
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

  function ownFolderPath(path, productId) {
    return typeof path === "string" && path.indexOf(String(productId) + "/") === 0;
  }
  function pathsOfMaterials(list) {
    var pid = S.vmist.productId;
    return list.filter(function (m) { return ownFolderPath(m.storage_path, pid); }).map(function (m) { return m.storage_path; });
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
        ? "Сюди додавай те, що належить усьому курсові (наприклад, загальний PDF). Уроки з файлами й вправами — нижче."
        : "Для готового уроку, підручника чи журналу достатньо додати файли, текст і вправи прямо сюди."),
      containerPanel(null)
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
    var mats = C.materials.filter(function (x) { return x.lesson_id != null && ids.indexOf(String(x.lesson_id)) > -1; });
    var exs = C.exercises.filter(function (x) { return x.lesson_id != null && ids.indexOf(String(x.lesson_id)) > -1; });
    var text = "Модуль «" + m.title + "» зникне разом з усім, що в ньому: "
      + lessons.length + " " + plural(lessons.length, "урок", "уроки", "уроків") + ", "
      + mats.length + " " + plural(mats.length, "матеріал", "матеріали", "матеріалів") + ", "
      + exs.length + " " + plural(exs.length, "набір вправ", "набори вправ", "наборів вправ")
      + ". Файли теж видаляться зі сховища. Результати учнів у цих вправах пропадуть. Це не можна скасувати.";
    confirmBox({ title: "Видалити модуль?", text: text, okLabel: "Так, видалити", danger: true }).then(function (yes) {
      if (!yes) return;
      var paths = pathsOfMaterials(mats);
      act(btn, function () {
        return D.deleteRow("course_modules", m.id).then(function () { return D.removeFiles(paths).catch(function () {}); });
      }, "Модуль видалено.");
    });
  }

  function deleteLesson(btn, l) {
    var C = S.vmist.content;
    var mats = C.materials.filter(function (x) { return same(x.lesson_id, l.id); });
    var exs = C.exercises.filter(function (x) { return same(x.lesson_id, l.id); });
    var text = "Урок «" + l.title + "» зникне разом з усім, що в ньому: "
      + mats.length + " " + plural(mats.length, "матеріал", "матеріали", "матеріалів") + ", "
      + exs.length + " " + plural(exs.length, "набір вправ", "набори вправ", "наборів вправ")
      + ". Файли теж видаляться зі сховища. Результати учнів у цих вправах пропадуть. Це не можна скасувати.";
    confirmBox({ title: "Видалити урок?", text: text, okLabel: "Так, видалити", danger: true }).then(function (yes) {
      if (!yes) return;
      var paths = pathsOfMaterials(mats);
      act(btn, function () {
        return D.deleteRow("course_lessons", l.id).then(function () { return D.removeFiles(paths).catch(function () {}); });
      }, "Урок видалено.");
    });
  }

  function lessonItem(l, idx, lessons) {
    var key = String(l.id);
    var open = !!S.vmist.open[key];
    var nm = S.vmist.content.materials.filter(function (x) { return same(x.lesson_id, l.id); }).length;
    var ne = S.vmist.content.exercises.filter(function (x) { return same(x.lesson_id, l.id); }).length;

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
      h("small", { class: "ad-muted ad-lesson-count" }, nm + " " + plural(nm, "матеріал", "матеріали", "матеріалів") + " · " + ne + " " + plural(ne, "набір вправ", "набори вправ", "наборів вправ")),
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
        containerPanel(l.id)
      ]));
    }
    return li;
  }

  /* Materials + exercises of one place (a lesson, or the whole product when lessonId is null) */
  function containerPanel(lessonId) {
    var mats = materialsOf(lessonId), exs = exercisesOf(lessonId);
    var wrap = h("div", { class: "ad-container" });

    wrap.appendChild(h("h4", { class: "ad-h4" }, "Матеріали"));
    if (!mats.length) wrap.appendChild(h("p", { class: "pf-hint" }, "Матеріалів ще немає."));
    else {
      var ul = h("ul", { class: "ad-rows" });
      mats.forEach(function (m, i) { ul.appendChild(materialRow(m, i, mats)); });
      wrap.appendChild(ul);
    }
    var fileInput = h("input", { type: "file", multiple: true, class: "sr-only", tabindex: "-1", "aria-hidden": "true" });
    fileInput.addEventListener("change", function () {
      var files = Array.prototype.slice.call(fileInput.files || []);
      fileInput.value = "";
      if (files.length) uploadFiles(files, lessonId);
    });
    wrap.appendChild(h("div", { class: "ad-adds" }, [
      fileInput,
      h("button", { class: "btn btn-ghost btn-sm", type: "button", onclick: function () { fileInput.click(); } }, "Додати файл"),
      h("button", { class: "btn btn-ghost btn-sm", type: "button", onclick: function () { openTextEditor(null, lessonId); } }, "Додати текст"),
      h("button", { class: "btn btn-ghost btn-sm", type: "button", onclick: function () { openVideoEditor(null, lessonId); } }, "Додати відео"),
      h("button", { class: "btn btn-ghost btn-sm", type: "button", onclick: function () { openLinkEditor(null, lessonId); } }, "Додати посилання")
    ]));

    wrap.appendChild(h("h4", { class: "ad-h4" }, "Вправи"));
    if (!exs.length) wrap.appendChild(h("p", { class: "pf-hint" }, "Вправ ще немає."));
    else {
      var ul2 = h("ul", { class: "ad-rows" });
      exs.forEach(function (x, i) { ul2.appendChild(exerciseRow(x, i, exs)); });
      wrap.appendChild(ul2);
    }
    wrap.appendChild(h("div", { class: "ad-adds" }, [
      h("button", { class: "btn btn-ghost btn-sm", type: "button", onclick: function () { openExerciseEditor(null, lessonId); } }, "Додати вправи")
    ]));
    return wrap;
  }

  function fileNameOf(path) {
    var s = String(path || "").replace(/^.*\//, "");
    return s.replace(/^\d{10,}-/, "");
  }

  function materialRow(m, idx, list) {
    var sub = "";
    if (m.kind === "text") sub = String((m.body || "").length) + " символів";
    else if (m.kind === "video" || m.kind === "link") sub = m.external_ref || "";
    else sub = fileNameOf(m.storage_path);
    return h("li", { class: "ad-row" }, [
      chip(MATERIAL_KIND_LABEL[m.kind] || m.kind, "k-" + m.kind),
      h("span", { class: "ad-row-title" }, [h("span", {}, m.title), sub ? h("small", {}, sub) : null]),
      h("span", { class: "ad-row-actions" }, [
        h("button", { class: "ad-link", type: "button", onclick: function () { openMaterialEditor(m); } }, "Змінити")
      ].concat(moveButtons("materials", list, idx, "«" + m.title + "»")).concat([
        h("button", { class: "ad-link-danger", type: "button", onclick: function (e) { deleteMaterial(e.currentTarget, m); } }, "Видалити")
      ]))
    ]);
  }

  function deleteMaterial(btn, m) {
    var isFile = ownFolderPath(m.storage_path, S.vmist.productId);
    confirmBox({
      title: "Видалити матеріал?",
      text: "«" + m.title + "» зникне з курсу" + (isFile ? ", файл теж видалиться зі сховища" : "") + ". Це не можна скасувати.",
      okLabel: "Так, видалити", danger: true
    }).then(function (yes) {
      if (!yes) return;
      act(btn, function () {
        return D.deleteRow("materials", m.id).then(function () {
          return isFile ? D.removeFiles([m.storage_path]).catch(function () {}) : null;
        });
      }, "Матеріал видалено.");
    });
  }

  function exerciseRow(x, idx, list) {
    var n = x.content && x.content.items ? x.content.items.length : 0;
    return h("li", { class: "ad-row" }, [
      chip("Вправи", "k-ex"),
      h("span", { class: "ad-row-title" }, [h("span", {}, x.title), h("small", {}, n + " " + plural(n, "завдання", "завдання", "завдань"))]),
      h("span", { class: "ad-row-actions" }, [
        h("button", { class: "ad-link", type: "button", onclick: function () { openExerciseEditor(x, x.lesson_id); } }, "Змінити")
      ].concat(moveButtons("exercises", list, idx, "«" + x.title + "»")).concat([
        h("button", { class: "ad-link-danger", type: "button", onclick: function (e) { deleteExercise(e.currentTarget, x); } }, "Видалити")
      ]))
    ]);
  }

  function deleteExercise(btn, x) {
    confirmBox({
      title: "Видалити вправи?",
      text: "Набір «" + x.title + "» зникне, а разом із ним — результати всіх учнів у ньому. Це не можна скасувати.",
      okLabel: "Так, видалити", danger: true
    }).then(function (yes) {
      if (!yes) return;
      act(btn, function () { return D.deleteRow("exercises", x.id); }, "Вправи видалено.");
    });
  }

  /* ---------- editors: text, video, link, file name ---------- */
  function saveMaterial(m, lessonId, fields, okMsg) {
    var p = S.vmist.productId;
    if (m) return D.updateRow("materials", m.id, fields);
    return D.insertRow("materials", {
      product_id: p, lesson_id: lessonId == null ? null : lessonId, kind: fields.kind, title: fields.title,
      storage_path: null, external_ref: fields.external_ref == null ? null : fields.external_ref,
      body: fields.body == null ? null : fields.body, position: maxPos(materialsOf(lessonId)) + 1
    });
  }

  function openMaterialEditor(m) {
    if (m.kind === "text") openTextEditor(m, m.lesson_id);
    else if (m.kind === "video") openVideoEditor(m, m.lesson_id);
    else if (m.kind === "link") openLinkEditor(m, m.lesson_id);
    else openTitleEditor(m);
  }

  function modalButtons(modal, saveLabel, saveBtn) {
    return h("div", { class: "ad-actions" }, [
      saveBtn,
      h("button", { class: "btn btn-ghost", type: "button", onclick: function () { modal.requestClose(); } }, "Скасувати")
    ]);
  }

  function openTitleEditor(m) {
    var input = h("input", { type: "text", maxlength: "200", value: m.title });
    var f = field("Назва (так її бачать учні)", input, "Файл: " + fileNameOf(m.storage_path));
    var save = h("button", { class: "btn btn-primary", type: "submit" }, "Зберегти");
    var form = h("form", { novalidate: true }, [f]);
    var modal = openModal({ title: "Змінити назву", isDirty: function () { return trim(input.value) !== m.title; } });
    form.appendChild(modalButtons(modal, "Зберегти", save));
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var t = trim(input.value);
      if (!t) { setErr(f, "Напиши назву."); input.focus(); return; }
      busy(save, D.updateRow("materials", m.id, { title: t })).then(function () {
        modal.close(); toast("Збережено."); refreshContent();
      }, function (er) { toast(friendly(er), "error"); });
    });
    modal.body.appendChild(form);
  }

  var MD_HELP = [
    ["## Заголовок", "великий заголовок"], ["### Підзаголовок", "менший заголовок"],
    ["- пункт", "список (кожен пункт з нового рядка)"], ["**жирний**", "жирний текст"], ["*курсив*", "курсив"],
    ["[текст](https://…)", "посилання"], ["> цитата", "виділена цитата"], ["порожній рядок", "новий абзац"]
  ];

  function openTextEditor(m, lessonId) {
    var title = h("input", { type: "text", maxlength: "200", value: m ? m.title : "", placeholder: "Наприклад: Урок 1 — Привіт!" });
    var ta = h("textarea", { rows: "14", class: "ad-code", spellcheck: "true", "aria-label": "Текст уроку" });
    ta.value = m && m.body ? m.body : "";
    var preview = h("div", { class: "ad-md ad-preview", tabindex: "0", "aria-label": "Попередній перегляд тексту" });
    var counter = h("p", { class: "pf-hint ad-counter" });
    var fTitle = field("Назва *", title);
    var fBody = field("Текст *", ta);
    var help = h("details", { class: "ad-help" }, [
      h("summary", {}, "Як оформлювати текст"),
      h("ul", {}, MD_HELP.map(function (r) { return h("li", {}, [h("code", {}, r[0]), " — " + r[1]]); }))
    ]);
    function upd() {
      var html = mdToHtml(ta.value);
      preview.innerHTML = html || '<p class="ad-muted">Тут з\'явиться попередній перегляд.</p>'; /* html is escaped by mdToHtml */
      var n = ta.value.length;
      counter.textContent = n + " / " + MD_LIMIT + " символів";
      counter.classList.toggle("is-over", n > MD_LIMIT);
    }
    ta.addEventListener("input", upd);
    upd();
    var save = h("button", { class: "btn btn-primary", type: "submit" }, "Зберегти");
    var startT = title.value, startB = ta.value;
    var modal = openModal({
      title: m ? "Змінити текст" : "Додати текст", wide: true, sticky: true,
      isDirty: function () { return title.value !== startT || ta.value !== startB; }
    });
    var form = h("form", { novalidate: true, class: "ad-split" }, [
      h("div", {}, [fTitle, fBody, counter, help, modalButtons(modal, "Зберегти", save)]),
      h("div", {}, [h("p", { class: "ad-label" }, "Так це побачать учні"), preview])
    ]);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var t = trim(title.value), ok = true;
      setErr(fTitle, ""); setErr(fBody, "");
      if (!t) { setErr(fTitle, "Напиши назву."); ok = false; }
      if (!trim(ta.value)) { setErr(fBody, "Напиши текст."); ok = false; }
      else if (ta.value.length > MD_LIMIT) { setErr(fBody, "Текст задовгий: найбільше " + MD_LIMIT + " символів. Розділи його на два матеріали."); ok = false; }
      if (!ok) { toast("Перевір поля, які підсвічені червоним.", "error"); return; }
      busy(save, saveMaterial(m, lessonId, { kind: "text", title: t, body: ta.value })).then(function () {
        modal.close(); toast("Текст збережено."); refreshContent();
      }, function (er) { toast(friendly(er), "error"); });
    });
    modal.body.appendChild(form);
  }

  function openVideoEditor(m, lessonId) {
    var title = h("input", { type: "text", maxlength: "200", value: m ? m.title : "", placeholder: "Наприклад: Відео до уроку" });
    var url = h("input", { type: "url", value: m ? (m.external_ref || "") : "", placeholder: "https://vimeo.com/…  або  https://www.youtube.com/watch?v=…", autocomplete: "off", spellcheck: "false" });
    var fTitle = field("Назва", title, "Якщо залишиш порожнім, буде «Відео».");
    var fUrl = field("Посилання на відео *", url, "Vimeo, YouTube або Bunny. Просто скопіюй адресу сторінки з відео — я сама зроблю з неї плеєр.");
    var live = h("p", { class: "ad-live", "aria-live": "polite" });
    function check() {
      if (!trim(url.value)) { live.textContent = ""; live.className = "ad-live"; return null; }
      var r = toEmbedUrl(url.value);
      live.className = "ad-live " + (r.ok ? "is-ok" : "is-bad");
      live.textContent = r.ok ? "Підходить. Покажемо плеєр: " + r.url : r.error;
      return r;
    }
    url.addEventListener("input", check);
    check();
    var save = h("button", { class: "btn btn-primary", type: "submit" }, "Зберегти");
    var s1 = title.value, s2 = url.value;
    var modal = openModal({ title: m ? "Змінити відео" : "Додати відео", isDirty: function () { return title.value !== s1 || url.value !== s2; } });
    var form = h("form", { novalidate: true }, [fTitle, fUrl, live, modalButtons(modal, "Зберегти", save)]);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      setErr(fUrl, "");
      var r = toEmbedUrl(url.value);
      if (!r.ok) { setErr(fUrl, r.error); url.focus(); return; }
      busy(save, saveMaterial(m, lessonId, { kind: "video", title: trim(title.value) || "Відео", external_ref: r.url })).then(function () {
        modal.close(); toast("Відео збережено."); refreshContent();
      }, function (er) { toast(friendly(er), "error"); });
    });
    modal.body.appendChild(form);
  }

  function openLinkEditor(m, lessonId) {
    var title = h("input", { type: "text", maxlength: "200", value: m ? m.title : "", placeholder: "Наприклад: Стаття про lagom" });
    var url = h("input", { type: "url", value: m ? (m.external_ref || "") : "", placeholder: "https://…", autocomplete: "off", spellcheck: "false" });
    var fTitle = field("Назва *", title, "Так на кнопці побачить учень.");
    var fUrl = field("Посилання *", url, "Тільки сайти з https://");
    var save = h("button", { class: "btn btn-primary", type: "submit" }, "Зберегти");
    var s1 = title.value, s2 = url.value;
    var modal = openModal({ title: m ? "Змінити посилання" : "Додати посилання", isDirty: function () { return title.value !== s1 || url.value !== s2; } });
    var form = h("form", { novalidate: true }, [fTitle, fUrl, modalButtons(modal, "Зберегти", save)]);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      setErr(fTitle, ""); setErr(fUrl, "");
      var t = trim(title.value), r = cleanLink(url.value), ok = true;
      if (!t) { setErr(fTitle, "Напиши назву."); ok = false; }
      if (!r.ok) { setErr(fUrl, r.error); ok = false; }
      if (!ok) { (!t ? title : url).focus(); return; }
      busy(save, saveMaterial(m, lessonId, { kind: "link", title: t, external_ref: r.url })).then(function () {
        modal.close(); toast("Посилання збережено."); refreshContent();
      }, function (er) { toast(friendly(er), "error"); });
    });
    modal.body.appendChild(form);
  }

  /* ---------- exercise editor ---------- */
  var FALLBACK_TEMPLATE = {
    version: 1,
    items: [
      { type: "choice", prompt: "Вибери правильну відповідь", options: ["варіант А", "варіант Б", "варіант В"], answer: 0, explain: "Чому саме так." },
      { type: "multi", prompt: "Познач усі правильні", options: ["перший", "другий", "третій"], answer: [0, 2] },
      { type: "truefalse", statement: "Твердження, яке треба оцінити.", answer: true },
      { type: "gap", prompt: "Jag ___ kaffe varje morgon.", answers: [["dricker"]], hint: "presens" },
      { type: "order", prompt: "Склади речення:", words: ["jag", "heter", "Maria"], answer: ["Jag heter Maria"] },
      { type: "match", prompt: "З'єднай пари:", pairs: [["hund", "собака"], ["katt", "кіт"], ["häst", "кінь"]] }
    ]
  };
  var TYPE_LABEL = { choice: "вибір", multi: "кілька відповідей", truefalse: "правда / неправда", gap: "пропуски", order: "порядок слів", match: "пари" };
  var templateText = null;

  function loadTemplate(cb) {
    if (templateText) { cb(templateText); return; }
    function done(obj) { templateText = JSON.stringify(obj, null, 2); cb(templateText); }
    try {
      var x = new XMLHttpRequest();
      x.open("GET", "assets/exercises-demo.json", true);
      x.onload = function () {
        var obj = null;
        try { obj = JSON.parse(x.responseText); } catch (_) { obj = null; }
        done(obj && obj.items ? obj : FALLBACK_TEMPLATE);
      };
      x.onerror = function () { done(FALLBACK_TEMPLATE); };
      x.send();
    } catch (_) { done(FALLBACK_TEMPLATE); }
  }

  /* text -> { ok, content | errors[] } */
  function parseExercises(text) {
    if (!trim(text)) return { ok: false, errors: ["Поле порожнє. Натисни «Вставити шаблон» або встав свої вправи."] };
    if (!window.FMMExercises) return { ok: false, errors: ["Не завантажився рушій вправ (exercises.js). Онови сторінку."] };
    var obj;
    try { obj = JSON.parse(text); }
    catch (e) { return { ok: false, errors: ["Це не схоже на правильний JSON: " + e.message + ". Перевір лапки, коми та дужки."] }; }
    var v = window.FMMExercises.validate(obj);
    if (!v.ok) return { ok: false, errors: v.errors };
    return { ok: true, content: obj };
  }

  function summaryOfExercises(content) {
    var counts = {}, order = [];
    content.items.forEach(function (it) {
      if (!counts[it.type]) { counts[it.type] = 0; order.push(it.type); }
      counts[it.type]++;
    });
    return order.map(function (t) { return (TYPE_LABEL[t] || t) + ": " + counts[t]; }).join(", ");
  }

  function openExerciseEditor(ex, lessonId) {
    var title = h("input", { type: "text", maxlength: "200", value: ex ? ex.title : "", placeholder: "Наприклад: Привітання" });
    var instr = h("textarea", { rows: "2", maxlength: "500", placeholder: "Що робити (бачить учень над вправами)" });
    instr.value = ex && ex.instructions ? ex.instructions : "";
    var ta = h("textarea", { rows: "16", class: "ad-code", spellcheck: "false", "aria-label": "Вправи у форматі JSON", wrap: "off" });
    ta.value = ex ? JSON.stringify(ex.content, null, 2) : "";
    var fTitle = field("Назва *", title);
    var fInstr = field("Інструкція", instr);
    var fJson = field("Вправи (JSON) *", ta, "Не вмієш писати JSON? Натисни «Вставити шаблон» і заміни тексти на свої. Потім «Перевірити».");
    var result = h("div", { class: "ad-check-result", "aria-live": "polite" });
    var previewBox = h("div", { class: "ad-ex-preview" });
    var previewNote = h("p", { class: "pf-hint" }, "Тут з'явиться попередній перегляд, коли вправи будуть без помилок.");

    function showResult(r) {
      clear(result);
      if (r.ok) {
        result.className = "ad-check-result is-ok";
        result.appendChild(h("strong", {}, "Усе гаразд: " + r.content.items.length + " " + plural(r.content.items.length, "завдання", "завдання", "завдань") + "."));
        result.appendChild(h("span", {}, " " + summaryOfExercises(r.content)));
      } else {
        result.className = "ad-check-result is-bad";
        result.appendChild(h("strong", {}, "Є що виправити:"));
        result.appendChild(h("ul", {}, r.errors.map(function (er) { return h("li", {}, er); })));
      }
    }

    var timer = null;
    function paintPreview() {
      var r = parseExercises(ta.value);
      clear(previewBox);
      if (!r.ok) {
        previewNote.hidden = false;
        previewNote.textContent = trim(ta.value)
          ? "Попередній перегляд з'явиться, коли в JSON не буде помилок. Натисни «Перевірити», щоб побачити, що виправити."
          : "Тут з'явиться попередній перегляд, коли вправи будуть без помилок.";
        return;
      }
      previewNote.hidden = true;
      try {
        window.FMMExercises.render(previewBox, r.content, { title: trim(title.value) || undefined, instructions: trim(instr.value) || undefined });
      } catch (e) {
        previewBox.appendChild(h("p", { class: "ad-live is-bad" }, "Не вдалося показати: " + e.message));
      }
    }
    function schedulePreview() { clearTimeout(timer); timer = setTimeout(paintPreview, 350); }
    [ta, title, instr].forEach(function (el) { el.addEventListener("input", schedulePreview); });

    var tplBtn = h("button", { class: "btn btn-ghost btn-sm", type: "button" }, "Вставити шаблон");
    var checkBtn = h("button", { class: "btn btn-ghost btn-sm", type: "button" }, "Перевірити");
    var save = h("button", { class: "btn btn-primary", type: "submit" }, "Зберегти");

    tplBtn.addEventListener("click", function () {
      function put() {
        loadTemplate(function (txt) {
          ta.value = txt;
          clear(result); result.className = "ad-check-result";
          paintPreview();
          toast("Шаблон вставлено: тут по одному прикладу кожного типу. Заміни тексти на свої.");
        });
      }
      if (trim(ta.value)) {
        confirmBox({ title: "Замінити вправи шаблоном?", text: "Те, що вже написано в полі, буде замінено прикладом.", okLabel: "Так, замінити", danger: true })
          .then(function (yes) { if (yes) put(); });
      } else put();
    });
    checkBtn.addEventListener("click", function () { showResult(parseExercises(ta.value)); paintPreview(); });

    var s1 = title.value, s2 = instr.value, s3 = ta.value;
    var modal = openModal({
      title: ex ? "Змінити вправи" : "Додати вправи", wide: true, sticky: true,
      isDirty: function () { return title.value !== s1 || instr.value !== s2 || ta.value !== s3; },
      onClose: function () { clearTimeout(timer); }
    });
    var form = h("form", { novalidate: true, class: "ad-split" }, [
      h("div", {}, [
        fTitle, fInstr, fJson,
        h("div", { class: "ad-adds" }, [tplBtn, checkBtn]),
        result,
        h("div", { class: "ad-actions" }, [save, h("button", { class: "btn btn-ghost", type: "button", onclick: function () { modal.requestClose(); } }, "Скасувати")])
      ]),
      h("div", {}, [h("p", { class: "ad-label" }, "Попередній перегляд (можна пробувати)"), previewNote, previewBox])
    ]);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      setErr(fTitle, ""); setErr(fJson, "");
      var t = trim(title.value), r = parseExercises(ta.value), ok = true;
      if (!t) { setErr(fTitle, "Напиши назву."); ok = false; }
      if (!r.ok) { showResult(r); setErr(fJson, "У вправах є помилки, дивись нижче."); ok = false; }
      if (!ok) { toast("Спершу виправ помилки, потім збережемо.", "error"); (t ? ta : title).focus(); return; }
      var fields = { title: t, instructions: trim(instr.value) || null, content: r.content };
      var op = ex
        ? D.updateRow("exercises", ex.id, fields)
        : D.insertRow("exercises", {
            product_id: S.vmist.productId, lesson_id: lessonId == null ? null : lessonId, title: t,
            instructions: fields.instructions, content: r.content, position: maxPos(exercisesOf(lessonId)) + 1
          });
      busy(save, op).then(function () {
        modal.close(); toast("Вправи збережено."); refreshContent();
      }, function (er) { toast(friendly(er), "error"); });
    });
    modal.body.appendChild(form);
    paintPreview();
  }

  /* ---------- file upload ---------- */
  function uploadFiles(files, lessonId) {
    var pid = S.vmist.productId;
    files = Array.prototype.slice.call(files || []);
    if (!files.length || pid == null) return;
    var running = true, okCount = 0;
    var posCounter = maxPos(materialsOf(lessonId));

    var items = files.map(function (f) {
      var status = h("span", { class: "ad-up-status" }, "Чекає");
      var bar = h("span", { class: "ad-bar", "aria-hidden": "true" }, h("i"));
      var retry = h("button", { class: "ad-link", type: "button", hidden: true }, "Спробувати ще раз");
      var row = h("li", { class: "ad-up-row" }, [
        h("span", { class: "ad-up-name" }, [h("strong", {}, f.name), h("small", {}, " " + fmtSize(f.size))]),
        bar, status, retry
      ]);
      return { file: f, row: row, status: status, retry: retry, state: "wait", path: null };
    });

    function setState(it, state, text) {
      it.state = state;
      it.row.className = "ad-up-row is-" + state;
      it.status.textContent = text || ({ wait: "Чекає", work: "Завантажується…", ok: "Готово ✓", err: "" }[state]);
      it.retry.hidden = state !== "err";
    }

    var summary = h("p", { class: "ad-up-summary", "aria-live": "polite" });
    var closeBtn = h("button", { class: "btn btn-primary", type: "button", disabled: true }, "Готово");
    var modal = openModal({ title: "Завантаження файлів", sticky: true, isDirty: function () { return running; }, focus: false });
    modal.body.appendChild(h("p", { class: "pf-hint" }, "Не закривай сторінку, поки файли завантажуються."));
    modal.body.appendChild(h("ul", { class: "ad-up-list" }, items.map(function (it) { return it.row; })));
    modal.body.appendChild(summary);
    modal.body.appendChild(h("div", { class: "ad-actions" }, [closeBtn]));
    closeBtn.addEventListener("click", function () { modal.close(); });

    function one(it) {
      setState(it, "work");
      if (!it.file.size) { setState(it, "err", "Файл порожній — не додано."); return Promise.resolve(); }
      return D.upload(pid, it.file).then(function (path) {
        it.path = path;
        posCounter += 1;
        return D.insertRow("materials", {
          product_id: pid, lesson_id: lessonId == null ? null : lessonId, kind: kindFromExt(it.file.name),
          title: titleFromFilename(it.file.name), storage_path: path, external_ref: null, body: null, position: posCounter
        });
      }).then(function () {
        it.path = null; okCount += 1;
        setState(it, "ok");
      }, function (e) {
        if (it.path) { D.removeFiles([it.path]).catch(function () {}); it.path = null; }
        setState(it, "err", friendly(e));
      });
    }

    function runAll(list) {
      running = true;
      closeBtn.disabled = true;
      return list.reduce(function (p, it) { return p.then(function () { return one(it); }); }, Promise.resolve()).then(function () {
        running = false;
        closeBtn.disabled = false;
        var failed = items.filter(function (i) { return i.state === "err"; }).length;
        summary.className = "ad-up-summary " + (failed ? "is-bad" : "is-ok");
        summary.textContent = failed
          ? "Додано " + okCount + " із " + items.length + ". Ті, що не вийшли, позначені червоним."
          : "Усе додано: " + okCount + " " + plural(okCount, "файл", "файли", "файлів") + ".";
        if (okCount) toast("Додано файлів: " + okCount + ".");
        return refreshContent();
      });
    }
    items.forEach(function (it) {
      it.retry.addEventListener("click", function () { if (!running) runAll([it]); });
    });
    return runAll(items);
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
     10. Start: who is asking?  routes
     ================================================================= */
  function parseHash() {
    var raw = String(window.location.hash || "").replace(/^#/, "");
    var parts = raw.split("/");
    var tabs = ["produkty", "vmist", "uchni", "zamovlennia"];
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
    var views = { produkty: viewProducts, vmist: viewContent, uchni: viewPeople, zamovlennia: viewOrders };
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
  window.FMMAdmin = { uploadFiles: uploadFiles, route: route, _state: S };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
