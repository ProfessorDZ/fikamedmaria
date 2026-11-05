/* =====================================================================
   Fika med Maria — one course / lesson / book in the cabinet
   (kurs-kabinet.html?id=<slug>).
   * A course (modules -> lessons): outline on the left, the open lesson on
     the right; the lesson is chosen by the address hash  #l=<lessonId>.
   * A product without modules (ready lesson, book, issue): one page with
     its blocks.
   Every lesson is a list of blocks drawn by FMMBlocks.renderAll
   (assets/blocks.js + blocks-exercises.js): text, media, exercises that
   are checked on the spot, and work for Maria (open answer, voice, file).
   No session -> vkhid.html?next=... ; no access -> a friendly message.
   Needs assets/account.js, assets/blocks.js, assets/blocks-exercises.js.
   ===================================================================== */
(function () {
  "use strict";

  var A = window.FMMAccount;
  var I = window.FMMI18N || {};
  var T = window.T || function (s, v) {
    return String(s).replace(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g, function (m, k) { return v && v[k] != null ? v[k] : m; });
  };
  if (!A) return;

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
    if (!A.isDemo()) return href;
    var parts = href.split("#");
    parts[0] += (parts[0].indexOf("?") > -1 ? "&" : "?") + "demo=1";
    return parts.join("#");
  }
  function page(p) { return withDemo(url(p)); }


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
    if (hasLessons && data.blocks.length) {
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

  /* ---------------- Blocks of one place (lesson / product level) ---------------- */
  var handles = [];      /* what FMMBlocks.renderAll returned for the open page */
  var saveFail = null;   /* the last result that could not be saved */

  function stopBlocks() {
    handles.forEach(function (h) { try { if (h && h.destroy) h.destroy(); } catch (_) {} });
    handles = [];
  }

  /* The things the blocks call back into. results and work are the live maps
     of the product, so a page that is opened again shows the newest state. */
  function makeCtx() {
    return {
      mode: "student",
      lang: I.lang || document.documentElement.getAttribute("lang") || "uk",
      signedUrl: function (src) { return A.signedUrl(src); },
      workFileUrl: function (path) { return A.workFileUrl(path); },
      results: data.results,
      work: data.work,
      onResult: function (blockId, res) {
        return saveResult(blockId, res);
      },
      /* A send was refused because Maria has just reviewed the work: fetch the
         product again and take the fresh work of that block into the live map. */
      reloadWork: function (blockId) {
        return A.product(SLUG).then(function (fresh) {
          var w = fresh && fresh.work ? fresh.work : {};
          var key = String(blockId);
          if (w[key]) data.work[key] = w[key];
          return data.work[key] || null;
        }, function () { return null; });
      },
      onSubmitWork: function (blockId, payload) {
        return A.submitWork(blockId, { text: payload.text, files: payload.files }).then(function (row) {
          data.work[String(blockId)] = row;
          return row;
        }, function (err) {
          if (err && err.code === "session_missing") goLogin();
          throw err;
        });
      }
    };
  }

  function saveMsg() { return $("#kc-save-msg"); }

  function saveResult(blockId, res) {
    var msg = saveMsg();
    if (msg) { msg.className = "kc-save-msg"; msg.textContent = ""; }
    saveFail = null;
    return A.saveBlockResult(blockId, res).then(function (saved) {
      data.results[String(blockId)] = saved;
      return saved;
    }, function (err) {
      if (err && err.code === "session_missing") { goLogin(); return null; }
      saveFail = { blockId: blockId, res: res };
      var m = saveMsg();
      if (m) {
        m.className = "kc-save-msg is-error";
        m.innerHTML = "";
        m.appendChild(document.createTextNode(T("Результат не вдалося зберегти.") + " "));
        var retry = document.createElement("button");
        retry.type = "button";
        retry.className = "pf-link";
        retry.textContent = T("Зберегти ще раз");
        retry.addEventListener("click", function () {
          var f = saveFail;
          if (f) saveResult(f.blockId, f.res);
        });
        m.appendChild(retry);
      }
      return null;
    });
  }

  function fillBlocks(box, blocks) {
    stopBlocks();
    var holder = $(".kc-content", box);
    if (!blocks.length) {
      holder.innerHTML = '<p class="kc-wait">' + esc(T("Матеріали для цього уроку скоро зʼявляться.")) + "</p>";
      return;
    }
    if (!window.FMMBlocks) {
      holder.innerHTML = '<p class="kc-wait is-error">' + esc(T("Цей урок не вдалося показати. Напиши Марії, будь ласка.")) + "</p>";
      return;
    }
    handles = FMMBlocks.renderAll(holder, blocks, makeCtx()) || [];
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
    var blocks = s.lesson ? s.lesson.blocks : data.blocks;

    var html = '<article class="kc-lesson-view" aria-labelledby="kc-lesson-title">' +
      '<p class="kc-crumb">' + crumb + "</p>" +
      '<h2 class="kc-lesson-title" id="kc-lesson-title" tabindex="-1">' + esc(title) + "</h2>" +
      (s.lesson && s.lesson.summary ? '<p class="kc-summary">' + esc(s.lesson.summary) + "</p>" : "") +
      '<div class="kc-content"></div><p class="kc-save-msg" id="kc-save-msg" role="alert"></p>';
    if (s.lesson) {
      html += '<div class="kc-done-bar"><button class="btn" type="button" id="kc-done"></button>' +
        '<span class="kc-done-msg" id="kc-done-msg" role="status" aria-live="polite"></span></div>';
    }
    html += pagerHtml(i) + "</article>";
    stopBlocks();
    main.innerHTML = html;

    fillBlocks(main, blocks);
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
      /* one page: the blocks of the product itself */
      currentId = "single";
      var main = $("#kc-main");
      var p = data.product;
      var intro = p.description && window.FMMBlocks ? '<div class="kc-text kc-intro">' + FMMBlocks.md(p.description) + "</div>" : "";
      main.innerHTML = intro + '<div class="kc-content"></div><p class="kc-save-msg" id="kc-save-msg" role="alert"></p>';
      fillBlocks(main, data.blocks);
      setTitle([p.title]);
    }
  }

  function load() {
    A.product(SLUG).then(function (d) {
      if (!d || !d.product) { showUnavailable(); return; }
      data = d;
      data.modules = data.modules || [];
      data.blocks = data.blocks || [];
      data.results = data.results || {};
      data.work = data.work || {};
      data.modules.forEach(function (m) {
        m.lessons = m.lessons || [];
        m.lessons.forEach(function (l) { l.blocks = l.blocks || []; });
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
