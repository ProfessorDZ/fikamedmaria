/* =====================================================================
   Fika med Maria — one course / lesson / book in the cabinet
   (kurs-kabinet.html?id=<slug>).
   * A course (modules -> lessons): outline on the left, the open lesson on
     the right; the lesson is chosen by the address hash  #l=<lessonId>.
   * A product without modules (ready lesson, book, issue): one page with
     its materials and exercises.
   No session -> vkhid.html?next=... ; no access -> a friendly message.
   Needs assets/account.js, assets/exercises.js. All data is escaped before
   it goes into HTML; text materials go through the tiny markdown below
   (it escapes first); iframes only for allow-listed video hosts.
   ===================================================================== */
(function () {
  "use strict";

  var A = window.FMMAccount;
  var I = window.FMMI18N || {};
  var T = window.T || function (s, v) {
    return String(s).replace(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g, function (m, k) { return v && v[k] != null ? v[k] : m; });
  };

  /* ---------------- Small helpers ---------------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function url(p) { return I.url ? I.url(p) : p; }
  function withDemo(href) {
    if (!A || !A.isDemo()) return href;
    var parts = href.split("#");
    parts[0] += (parts[0].indexOf("?") > -1 ? "&" : "?") + "demo=1";
    return parts.join("#");
  }
  function page(p) { return withDemo(url(p)); }

  /* ---------------- Tiny markdown (escape first) ---------------- */
  /* ## / ### headings, blank-line paragraphs, "- " lists, **bold**, *italic*,
     [text](https://...) links, "> " quotes, single line breaks. */
  function inline(escaped) {
    var stash = [];
    var s = escaped.replace(/[\u0001\u0002]/g, "").replace(/\[([^\]\n]+)\]\((https:\/\/[^\s)]+)\)/g, function (m, text, href) {
      stash.push('<a href="' + href + '" target="_blank" rel="noopener noreferrer">' + emphasis(text) + "</a>");
      return "\u0001" + (stash.length - 1) + "\u0002";
    });
    s = emphasis(s);
    return s.replace(/\u0001(\d+)\u0002/g, function (m, i) { return stash[Number(i)]; });
  }
  function emphasis(s) {
    s = s.replace(/\*\*(\S(?:[^*\n]*?\S)?)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/\*(\S(?:[^*\n]*?\S)?)\*/g, "<em>$1</em>");
    return s;
  }
  function md(src) {
    var lines = String(src == null ? "" : src).replace(/\r\n?/g, "\n").split("\n");
    var out = [], para = [], list = [], quote = [], i, line, m;
    function flush() {
      if (para.length) { out.push("<p>" + para.map(function (l) { return inline(esc(l)); }).join("<br>") + "</p>"); para = []; }
      if (list.length) { out.push("<ul>" + list.map(function (l) { return "<li>" + inline(esc(l)) + "</li>"; }).join("") + "</ul>"); list = []; }
      if (quote.length) { out.push("<blockquote><p>" + quote.map(function (l) { return inline(esc(l)); }).join("<br>") + "</p></blockquote>"); quote = []; }
    }
    for (i = 0; i < lines.length; i++) {
      line = lines[i];
      if (/^\s*$/.test(line)) { flush(); continue; }
      if ((m = /^###\s+(.*)$/.exec(line))) { flush(); out.push("<h4>" + inline(esc(m[1])) + "</h4>"); continue; }
      if ((m = /^##\s+(.*)$/.exec(line))) { flush(); out.push("<h3>" + inline(esc(m[1])) + "</h3>"); continue; }
      if ((m = /^-\s+(.*)$/.exec(line))) {
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

  /* ---------------- Video links ---------------- */
  var VIDEO_HOSTS = ["player.vimeo.com", "iframe.mediadelivery.net", "www.youtube-nocookie.com", "www.youtube.com"];

  function parseUrl(s) {
    try { return new URL(String(s)); } catch (_) { return null; }
  }
  /* -> { embed: "https://..." } for an allow-listed player, { link: "https://..." }
     for any other https address, or null. Ordinary YouTube / Vimeo page links
     are turned into their player address (ids are checked). */
  function videoRef(ref) {
    var u = parseUrl(ref);
    if (!u || u.protocol !== "https:") return null;
    var host = u.hostname.toLowerCase(), path = u.pathname, id;
    if (host === "youtu.be" && (id = /^\/([A-Za-z0-9_-]{6,15})$/.exec(path))) {
      return { embed: "https://www.youtube-nocookie.com/embed/" + id[1] };
    }
    if ((host === "www.youtube.com" || host === "youtube.com" || host === "m.youtube.com") && path === "/watch") {
      id = /(?:^|[?&])v=([A-Za-z0-9_-]{6,15})(?:&|$)/.exec(u.search);
      if (id) return { embed: "https://www.youtube-nocookie.com/embed/" + id[1] };
    }
    if (host === "vimeo.com" && (id = /^\/(\d{5,12})$/.exec(path))) {
      return { embed: "https://player.vimeo.com/video/" + id[1] };
    }
    if (VIDEO_HOSTS.indexOf(host) > -1) {
      if (host === "www.youtube.com" && path.indexOf("/embed/") !== 0) return { link: u.href };
      return { embed: u.href };
    }
    return { link: u.href };
  }

  window.FMMKursKabinet = { md: md, videoRef: videoRef };
  if (!A) return;

  /* ---------------- Query / hash ---------------- */
  function param(name) {
    var m = new RegExp("[?&]" + name + "=([^&#]*)").exec(window.location.search);
    if (!m) return "";
    try { return decodeURIComponent(m[1].replace(/\+/g, " ")); } catch (_) { return ""; }
  }
  function hashLesson() {
    var m = /^#l=(.+)$/.exec(window.location.hash || "");
    if (!m) return "";
    try { return decodeURIComponent(m[1]); } catch (_) { return ""; }
  }

  var SLUG = param("id");
  var root = $("#kc-root");
  var BRAND = " — Fika med Maria";

  var KINDS = {
    course: T("Курс"), teacher_course: T("Курс для викладачів"), lesson: T("Урок"),
    book: T("Підручник"), magazine_issue: T("Журнал"), magazine_subscription: T("Журнал")
  };
  var MAT_ICONS = { pdf: "📄", other: "📎", audio: "🎧", video: "🎬", link: "🔗", text: "📝" };

  var errTexts = {
    network: T("Немає звʼязку із сервером. Перевір інтернет і спробуй ще раз."),
    rate_limited: T("Забагато спроб поспіль. Зачекай хвилинку й спробуй знову."),
    unknown: T("Щось пішло не так. Спробуй ще раз за хвилину.")
  };
  function errText(err) { return errTexts[err && err.code] || errTexts.unknown; }

  function setTitle(parts) {
    document.title = parts.filter(Boolean).join(" — ") + BRAND;
  }

  /* ---------------- Guards and simple states ---------------- */
  function goLogin() {
    var next = "kurs-kabinet.html?id=" + encodeURIComponent(SLUG) + (window.location.hash || "");
    var target = url("vkhid.html") + "?next=" + encodeURIComponent(next);
    if (A.isDemo()) target += "&demo=1";
    window.location.replace(target);
  }

  function showUnavailable() {
    root.setAttribute("aria-busy", "false");
    setTitle([T("Матеріал недоступний")]);
    root.innerHTML = '<div class="pf-empty kc-unavailable">' +
      '<div class="pf-big-ico" aria-hidden="true">🔒</div>' +
      "<h1>" + esc(T("Цей матеріал поки недоступний у твоєму кабінеті")) + "</h1>" +
      "<p>" + esc(T("Можливо, ти увійшла з іншим email, або доступ ще не відкрито. Подивись каталог чи напиши мені, і ми швидко розберемось.")) + "</p>" +
      '<div class="pf-actions kb-empty-actions">' +
        '<a class="btn btn-primary" href="' + esc(url("kursy.html")) + '">' + esc(T("Каталог курсів")) + "</a>" +
        '<a class="btn btn-ghost" href="' + esc(url("kontakty.html")) + '">' + esc(T("Написати Марії")) + "</a>" +
      "</div></div>";
  }

  function showError(err) {
    root.setAttribute("aria-busy", "false");
    root.innerHTML = '<div class="pf-empty"><h1>' + esc(T("Не вдалося завантажити")) + "</h1><p>" + esc(errText(err)) + "</p>" +
      '<button class="btn btn-primary" type="button" id="kc-retry">' + esc(T("Спробувати ще раз")) + "</button></div>";
    $("#kc-retry").addEventListener("click", function () {
      root.setAttribute("aria-busy", "true");
      root.innerHTML = '<p class="kb-loading">' + esc(T("Завантажую…")) + "</p>";
      load();
    });
  }

  /* ---------------- Data model ---------------- */
  var data = null;       /* what FMMAccount.product() returned */
  var seq = [];          /* flat list of steps: { id, lesson|null, module|null, extra } */
  var currentId = null;
  var hasLessons = false;

  function buildSeq() {
    seq = [];
    data.modules.forEach(function (m) {
      m.lessons.forEach(function (l) { seq.push({ id: String(l.id), lesson: l, module: m, extra: false }); });
    });
    hasLessons = seq.length > 0;
    if (hasLessons && (data.materials.length || data.exercises.length)) {
      seq.push({ id: "extra", lesson: null, module: null, extra: true });
    }
  }
  function stepById(id) {
    for (var i = 0; i < seq.length; i++) { if (seq[i].id === String(id)) return i; }
    return -1;
  }
  function lessonCounts() {
    var total = 0, done = 0;
    seq.forEach(function (s) { if (s.lesson) { total++; if (s.lesson.done) done++; } });
    return { total: total, done: done };
  }
  function defaultStep() {
    for (var i = 0; i < seq.length; i++) { if (seq[i].lesson && !seq[i].lesson.done) return i; }
    return 0;
  }

  /* ---------------- Page frame ---------------- */
  function headHtml(p) {
    var kind = KINDS[p.kind] || "";
    var desc = p.short_description ? '<p class="kc-short">' + esc(p.short_description) + "</p>" : "";
    var prog = "";
    if (hasLessons) {
      prog = '<div class="kc-progress" id="kc-progress"></div>';
    }
    return '<header class="kc-head">' +
      (kind ? '<span class="pf-badge is-blue">' + esc(kind) + "</span>" : "") +
      '<h1 class="kc-title">' + esc(p.title) + "</h1>" + desc + prog + "</header>";
  }

  function updateProgress() {
    var box = $("#kc-progress");
    if (!box) return;
    var c = lessonCounts();
    var pct = c.total ? Math.round((c.done / c.total) * 100) : 0;
    var label = T("Уроків пройдено {done} з {total}", { done: c.done, total: c.total });
    box.innerHTML = '<div class="pf-progress' + (pct >= 100 ? " is-done" : "") + '" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct +
      '" aria-label="' + esc(label) + '"><span style="width:' + pct + '%"></span></div><p class="pf-progress-label">' + esc(label) + "</p>";
  }

  function outlineHtml() {
    var html = '<ol class="kc-modules">';
    data.modules.forEach(function (m) {
      if (!m.lessons.length) return;
      html += '<li class="kc-module"><h2 class="kc-mod-title">' + esc(m.title) + '</h2><ol class="kc-lessons">';
      m.lessons.forEach(function (l) { html += outlineItem(String(l.id), l.title, l.done, false); });
      html += "</ol></li>";
    });
    if (seq.length && seq[seq.length - 1].extra) {
      html += '<li class="kc-module"><ol class="kc-lessons">' + outlineItem("extra", T("Додатково"), false, true) + "</ol></li>";
    }
    return html + "</ol>";
  }
  function outlineItem(id, title, done, extra) {
    return '<li><a class="kc-lesson-link" href="#l=' + esc(encodeURIComponent(id)) + '" data-step="' + esc(id) + '">' +
      '<span class="kc-tick' + (extra ? " is-extra" : "") + '" aria-hidden="true">' + (extra ? "★" : "✓") + "</span>" +
      '<span class="kc-lesson-name">' + esc(title) + "</span>" +
      '<span class="sr-only kc-done-sr"></span></a></li>';
  }

  function updateOutline() {
    all("[data-step]").forEach(function (a) {
      var id = a.getAttribute("data-step");
      var i = stepById(id);
      var s = seq[i];
      var done = !!(s && s.lesson && s.lesson.done);
      var cur = id === currentId;
      a.classList.toggle("is-done", done);
      a.classList.toggle("is-current", cur);
      if (cur) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
      var sr = $(".kc-done-sr", a);
      if (sr) sr.textContent = done ? " — " + T("пройдено") : "";
    });
  }

  function renderFrame() {
    var p = data.product;
    var html = headHtml(p);
    if (hasLessons) {
      html += '<div class="kc-layout">' +
        '<aside class="kc-outline">' +
          '<button class="kc-outline-toggle" type="button" id="kc-outline-toggle" aria-expanded="false" aria-controls="kc-nav">' +
            "<span>" + esc(T("Зміст курсу")) + '</span><span class="kc-chev" aria-hidden="true"></span></button>' +
          '<nav class="kc-nav" id="kc-nav" aria-label="' + esc(T("Зміст курсу")) + '">' + outlineHtml() + "</nav>" +
        "</aside>" +
        '<div class="kc-main" id="kc-main"></div></div>';
    } else {
      html += '<div class="kc-single" id="kc-main"></div>';
    }
    root.innerHTML = html;
    root.setAttribute("aria-busy", "false");
    updateProgress();

    var toggle = $("#kc-outline-toggle");
    if (toggle) {
      toggle.addEventListener("click", function () {
        var open = toggle.getAttribute("aria-expanded") !== "true";
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
        $("#kc-nav").classList.toggle("is-open", open);
      });
    }
    all("[data-step]").forEach(function (a) {
      a.addEventListener("click", function () { closeOutline(); });
    });
  }
  function closeOutline() {
    var toggle = $("#kc-outline-toggle");
    if (!toggle) return;
    toggle.setAttribute("aria-expanded", "false");
    $("#kc-nav").classList.remove("is-open");
  }

  /* ---------------- Materials ---------------- */
  function matTitle(m) {
    if (m.title) return m.title;
    var names = { pdf: T("Файл PDF"), audio: T("Аудіо"), video: T("Відео"), link: T("Посилання"), text: T("Текст"), other: T("Файл") };
    return names[m.kind] || T("Матеріал");
  }

  function materialHtml(m, idx) {
    var t = esc(matTitle(m));
    var ico = '<span class="kc-mat-ico" aria-hidden="true">' + (MAT_ICONS[m.kind] || MAT_ICONS.other) + "</span>";
    var ext = m.external_ref && /^https:\/\//i.test(m.external_ref) ? m.external_ref : "";
    var vr;

    if (m.kind === "text") {
      return '<section class="kc-mat kc-mat-text"><h3 class="kc-mat-title">' + ico + t + '</h3><div class="kc-text">' + md(m.body) + "</div></section>";
    }
    if (m.kind === "audio") {
      return '<section class="kc-mat"><h3 class="kc-mat-title">' + ico + t + '</h3><div class="kc-media" data-audio="' + idx + '">' +
        '<p class="kc-wait">' + esc(T("Завантажую аудіо…")) + "</p></div></section>";
    }
    if (m.kind === "video") {
      vr = ext ? videoRef(ext) : null;
      if (vr && vr.embed) {
        return '<section class="kc-mat"><h3 class="kc-mat-title">' + ico + t + '</h3><div class="kc-video">' +
          '<iframe src="' + esc(vr.embed) + '" title="' + esc(matTitle(m)) + '" loading="lazy" allowfullscreen ' +
          'allow="fullscreen; picture-in-picture; encrypted-media" referrerpolicy="strict-origin-when-cross-origin"></iframe></div></section>';
      }
      if (vr && vr.link) {
        return '<section class="kc-mat kc-mat-file"><h3 class="kc-mat-title">' + ico + t + '</h3>' +
          '<a class="btn btn-ghost btn-sm" href="' + esc(vr.link) + '" target="_blank" rel="noopener noreferrer">' + esc(T("Дивитися відео")) + "</a></section>";
      }
      if (m.storage_path) {
        return '<section class="kc-mat"><h3 class="kc-mat-title">' + ico + t + '</h3><div class="kc-media" data-video="' + idx + '">' +
          '<p class="kc-wait">' + esc(T("Завантажую відео…")) + "</p></div></section>";
      }
      return '<section class="kc-mat"><h3 class="kc-mat-title">' + ico + t + '</h3><p class="kc-wait">' + esc(T("Відео поки недоступне.")) + "</p></section>";
    }
    if (m.kind === "link") {
      if (!ext) {
        return '<section class="kc-mat"><h3 class="kc-mat-title">' + ico + t + '</h3><p class="kc-wait">' + esc(T("Посилання поки недоступне.")) + "</p></section>";
      }
      return '<section class="kc-mat kc-mat-file"><h3 class="kc-mat-title">' + ico + t + '</h3>' +
        '<a class="btn btn-ghost btn-sm" href="' + esc(ext) + '" target="_blank" rel="noopener noreferrer">' + esc(T("Відкрити посилання")) + "</a></section>";
    }
    /* pdf, other */
    if (!m.storage_path && ext) {
      return '<section class="kc-mat kc-mat-file"><h3 class="kc-mat-title">' + ico + t + '</h3>' +
        '<a class="btn btn-ghost btn-sm" href="' + esc(ext) + '" target="_blank" rel="noopener noreferrer">' + esc(T("Відкрити")) + "</a></section>";
    }
    if (!m.storage_path) {
      return '<section class="kc-mat"><h3 class="kc-mat-title">' + ico + t + '</h3><p class="kc-wait">' + esc(T("Файл поки недоступний.")) + "</p></section>";
    }
    return '<section class="kc-mat kc-mat-file"><h3 class="kc-mat-title">' + ico + t + "</h3>" +
      '<div class="kc-file-actions"><button class="btn btn-ghost btn-sm" type="button" data-dl="' + idx + '">' +
      esc(m.kind === "pdf" ? T("Завантажити PDF") : T("Завантажити файл")) + "</button>" +
      '<span class="kc-file-msg" role="status" aria-live="polite"></span></div></section>';
  }

  function wireMaterials(box, mats) {
    all("[data-dl]", box).forEach(function (btn) {
      var m = mats[Number(btn.getAttribute("data-dl"))];
      var msg = $(".kc-file-msg", btn.parentNode);
      btn.addEventListener("click", function () {
        /* open the tab at once (a click is needed for that), fill it when the link is ready */
        var w = null;
        try { w = window.open("", "_blank"); } catch (_) { w = null; }
        btn.disabled = true;
        msg.className = "kc-file-msg";
        msg.textContent = T("Готую файл…");
        A.signedUrl(m.storage_path).then(function (u) {
          btn.disabled = false;
          msg.textContent = "";
          if (w) { try { w.opener = null; } catch (_) {} w.location.href = u; }
          else window.location.href = u;
        }, function (err) {
          btn.disabled = false;
          if (w) { try { w.close(); } catch (_) {} }
          msg.className = "kc-file-msg is-error";
          msg.textContent = err && err.code === "network"
            ? T("Немає звʼязку із сервером. Перевір інтернет і спробуй ще раз.")
            : T("Не вдалося відкрити файл. Спробуй ще раз або напиши мені.");
        });
      });
    });
    ["audio", "video"].forEach(function (kind) {
      all("[data-" + kind + "]", box).forEach(function (holder) {
        var m = mats[Number(holder.getAttribute("data-" + kind))];
        A.signedUrl(m.storage_path).then(function (u) {
          var el = document.createElement(kind);
          el.controls = true;
          el.preload = "none";
          el.setAttribute("controls", "");
          el.setAttribute("aria-label", matTitle(m));
          el.src = u;
          holder.innerHTML = "";
          holder.appendChild(el);
        }, function () {
          holder.innerHTML = '<p class="kc-file-msg is-error">' + esc(T("Не вдалося завантажити. Онови сторінку або напиши мені.")) + "</p>";
        });
      });
    });
  }

  /* ---------------- Exercises ---------------- */
  function bestText(r) {
    return T("Найкращий результат: {best} з {max} · спроб: {n}", { best: r.best_score, max: r.max_score, n: r.attempts });
  }

  function mountExercise(holder, ex) {
    var best = $(".kc-best", holder);
    var target = $(".kc-ex-target", holder);
    var msg = $(".kc-save-msg", holder);

    function showBest() {
      if (ex.result && ex.result.attempts > 0 && ex.result.max_score > 0) {
        best.textContent = bestText(ex.result);
        best.hidden = false;
        best.classList.toggle("is-perfect", ex.result.best_score >= ex.result.max_score);
      } else {
        best.hidden = true;
      }
    }
    showBest();

    if (!window.FMMExercises) {
      target.innerHTML = '<p class="kc-file-msg is-error">' + esc(T("Цю вправу не вдалося показати. Напиши Марії, будь ласка.")) + "</p>";
      return;
    }

    function save(res) {
      msg.className = "kc-save-msg";
      msg.textContent = "";
      A.saveResult(ex.id, res).then(function (saved) {
        ex.result = {
          best_score: saved.best_score, last_score: saved.last_score, max_score: saved.max_score,
          attempts: saved.attempts, completed: !!saved.completed
        };
        showBest();
      }, function (err) {
        if (err && err.code === "session_missing") { goLogin(); return; }
        msg.className = "kc-save-msg is-error";
        msg.innerHTML = "";
        msg.appendChild(document.createTextNode(T("Результат не вдалося зберегти.") + " "));
        var retry = document.createElement("button");
        retry.type = "button";
        retry.className = "pf-link";
        retry.textContent = T("Зберегти ще раз");
        retry.addEventListener("click", function () { save(res); });
        msg.appendChild(retry);
      });
    }

    FMMExercises.render(target, ex.content, {
      title: ex.title || undefined,
      instructions: ex.instructions || undefined,
      onResult: function (result) {
        save({ score: result.score, max: result.max, answers: result.answers });
      }
    });
  }

  function exercisesHtml(list) {
    return list.map(function (ex, i) {
      return '<div class="kc-ex" data-ex="' + i + '"><p class="kc-best" role="status" hidden></p><div class="kc-ex-target"></div>' +
        '<p class="kc-save-msg" role="alert"></p></div>';
    }).join("");
  }

  /* ---------------- Content of one place (lesson / product level) ---------------- */
  function fillContent(box, mats, exs) {
    var html = "";
    mats.forEach(function (m, i) { html += materialHtml(m, i); });
    if (exs.length) {
      html += '<div class="kc-exercises">' + exercisesHtml(exs) + "</div>";
    }
    if (!mats.length && !exs.length) {
      html = '<p class="kc-wait">' + esc(T("Матеріали для цього уроку скоро зʼявляться.")) + "</p>";
    }
    var holder = $(".kc-content", box);
    holder.innerHTML = html;
    wireMaterials(holder, mats);
    all("[data-ex]", holder).forEach(function (h) { mountExercise(h, exs[Number(h.getAttribute("data-ex"))]); });
  }

  /* ---------------- Showing one step ---------------- */
  function pagerHtml(i) {
    var prev = seq[i - 1], next = seq[i + 1];
    function name(s) { return s.lesson ? s.lesson.title : T("Додатково"); }
    var html = '<nav class="kc-pager" aria-label="' + esc(T("Перехід між уроками")) + '">';
    html += prev
      ? '<a class="btn btn-ghost" href="#l=' + esc(encodeURIComponent(prev.id)) + '" rel="prev"><span aria-hidden="true">←</span> ' + esc(T("Попередній")) +
        '<span class="sr-only">: ' + esc(name(prev)) + "</span></a>"
      : "<span></span>";
    html += next
      ? '<a class="btn btn-primary" href="#l=' + esc(encodeURIComponent(next.id)) + '" rel="next">' + esc(T("Наступний урок")) +
        '<span class="sr-only">: ' + esc(name(next)) + '</span> <span aria-hidden="true">→</span></a>'
      : '<a class="btn btn-primary" href="' + esc(page("kabinet.html") + "#materialy") + '">' + esc(T("До мого кабінету")) + "</a>";
    return html + "</nav>";
  }

  function showStep(i, moved) {
    var s = seq[i];
    currentId = s.id;
    var main = $("#kc-main");
    var total = lessonCounts().total;
    var lessonNo = 0;
    for (var k = 0; k <= i; k++) { if (seq[k].lesson) lessonNo++; }

    var title = s.lesson ? s.lesson.title : T("Додатково");
    var crumb = s.lesson
      ? esc(s.module.title) + " · " + esc(T("Урок {n} з {total}", { n: lessonNo, total: total }))
      : esc(T("Підсумок і додаткові матеріали"));
    var mats = s.lesson ? s.lesson.materials : data.materials;
    var exs = s.lesson ? s.lesson.exercises : data.exercises;

    var html = '<article class="kc-lesson-view" aria-labelledby="kc-lesson-title">' +
      '<p class="kc-crumb">' + crumb + "</p>" +
      '<h2 class="kc-lesson-title" id="kc-lesson-title" tabindex="-1">' + esc(title) + "</h2>" +
      (s.lesson && s.lesson.summary ? '<p class="kc-summary">' + esc(s.lesson.summary) + "</p>" : "") +
      '<div class="kc-content"></div>';
    if (s.lesson) {
      html += '<div class="kc-done-bar"><button class="btn" type="button" id="kc-done"></button>' +
        '<span class="kc-done-msg" id="kc-done-msg" role="status" aria-live="polite"></span></div>';
    }
    html += pagerHtml(i) + "</article>";
    main.innerHTML = html;

    fillContent(main, mats, exs);
    if (s.lesson) wireDone(s.lesson);
    updateOutline();
    setTitle([title, data.product.title]);

    if (moved) {
      var h = $("#kc-lesson-title");
      try { h.focus({ preventScroll: true }); } catch (_) { h.focus(); }
      var top = main.getBoundingClientRect().top + window.pageYOffset - 90;
      if (window.pageYOffset > top) window.scrollTo(0, Math.max(0, top));
    }
  }

  function paintDone(btn, lesson) {
    btn.className = "btn " + (lesson.done ? "btn-ghost kc-is-done" : "btn-accent");
    btn.textContent = lesson.done ? "✓ " + T("Урок пройдено. Зняти позначку") : T("Позначити урок пройденим");
  }

  function wireDone(lesson) {
    var btn = $("#kc-done");
    var msg = $("#kc-done-msg");
    paintDone(btn, lesson);
    btn.addEventListener("click", function () {
      var want = !lesson.done;
      btn.disabled = true;
      msg.className = "kc-done-msg";
      msg.textContent = "";
      A.setLessonDone(lesson.id, want).then(function () {
        lesson.done = want;
        btn.disabled = false;
        paintDone(btn, lesson);
        msg.textContent = want ? T("Чудово! Урок позначено пройденим.") : T("Позначку знято.");
        updateOutline();
        updateProgress();
      }, function (err) {
        btn.disabled = false;
        if (err && err.code === "session_missing") { goLogin(); return; }
        msg.className = "kc-done-msg is-error";
        msg.textContent = T("Не вдалося зберегти. Спробуй ще раз.");
      });
    });
  }

  function route(moved) {
    var i = stepById(hashLesson());
    if (i < 0) i = defaultStep();
    showStep(i, moved);
  }

  /* ---------------- Start ---------------- */
  function render() {
    buildSeq();
    renderFrame();
    if (hasLessons) {
      route(false);
      window.addEventListener("hashchange", function () { route(true); });
    } else {
      /* one page: product-level materials and exercises */
      currentId = "single";
      var main = $("#kc-main");
      var p = data.product;
      main.innerHTML = (p.description ? '<div class="kc-text kc-intro">' + md(p.description) + "</div>" : "") + '<div class="kc-content"></div>';
      fillContent(main, data.materials, data.exercises);
      setTitle([p.title]);
    }
  }

  function load() {
    A.product(SLUG).then(function (d) {
      if (!d || !d.product) { showUnavailable(); return; }
      data = d;
      data.modules = data.modules || [];
      data.materials = data.materials || [];
      data.exercises = data.exercises || [];
      data.modules.forEach(function (m) {
        m.lessons = m.lessons || [];
        m.lessons.forEach(function (l) { l.materials = l.materials || []; l.exercises = l.exercises || []; });
      });
      render();
    }, function (err) {
      if (err && err.code === "session_missing") { goLogin(); return; }
      showError(err);
    });
  }

  function start() {
    var back = $("#kc-back");
    if (back) back.href = page("kabinet.html") + "#materialy";
    A.session().then(function (s) {
      if (!s) { goLogin(); return; }
      if (!SLUG) { showUnavailable(); return; }
      load();
    }, goLogin);
  }
  start();
})();
