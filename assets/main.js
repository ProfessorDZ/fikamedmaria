/* =====================================================================
   Fika med Maria — shared interactions & rendering
   Injects header/footer, renders card grids from data.js, handles FAQ,
   mobile nav, and demo forms. No build step, no dependencies.
   ===================================================================== */
(function () {
  "use strict";

  var PAGE = document.body.dataset.page || "home";

  /* Languages (assets/i18n.js). T() translates a Ukrainian string on a
     Swedish/English/Polish page; url() and asset() build links that work from
     every folder. The fallback keeps the site working if i18n.js is missing. */
  var I = window.FMMI18N || {
    lang: "uk",
    T: function (s, v) {
      s = String(s == null ? "" : s);
      return v ? s.replace(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g, function (m, k) { return v[k] != null ? String(v[k]) : m; }) : s;
    },
    url: function (u) { return u; },
    asset: function (u) { return u; },
    localizedAsset: function (u) { return u; },
    addAlternates: function () {},
    switcherHtml: function () { return ""; },
    wireSwitcher: function () {}
  };
  var T = I.T;

  /* Titles contain quotes and dashes, so every value that goes into an
     HTML attribute is escaped first. */
  function escAttr(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  /* The data-fmm-* attributes that assets/fmm-kit.js reads from clicks.
     Attributes only: no visual change, no href change. */
  function fmmMarks(id, name, cat, list, action) {
    return ' data-fmm-item="' + escAttr(id) + '"' +
      ' data-fmm-name="' + escAttr(name) + '"' +
      ' data-fmm-cat="' + cat + '"' +
      ' data-fmm-list="' + list + '"' +
      (action ? ' data-fmm-action="' + action + '"' : "");
  }

  /* Page load time: the fallback start for a form's "time to fill" when
     the visitor never focused a field. */
  var PAGE_LOADED_AT = Date.now();

  var NAV = [
    { id: "home", label: T("Головна"), href: "index.html" },
    { id: "courses", label: T("Курси"), href: "kursy.html" },
    { id: "free", label: T("Готові уроки"), href: "bezkoshtovni.html" },
    { id: "magazine", label: T("Медіатека"), href: "misyachnyk.html" },
    { id: "blog", label: T("Блог"), href: "blog.html" }
  ];

  /* ---------------- Header ---------------- */
  function buildHeader() {
    var links = NAV.map(function (n) {
      return '<a href="' + I.url(n.href) + '"' + (n.id === PAGE ? ' class="active"' : "") + ">" + n.label + "</a>";
    }).join("");

    return '' +
      '<header class="site-header"><div class="wrap header-inner">' +
        '<a class="brand" href="' + I.url("index.html") + '" aria-label="' + escAttr(T("Fika med Maria — головна")) + '">' +
          '<span class="brand-mark">☕</span>' +
          '<span class="brand-name">Fika med <b>Maria</b></span>' +
        '</a>' +
        '<nav class="nav" aria-label="' + escAttr(T("Головна навігація")) + '">' +
          '<div class="nav-links" id="navLinks">' + links + '<a href="' + I.url("vykladacham.html") + '" class="nav-teachers-link">' + T("Викладачам") + '</a></div>' +
          '<a class="btn btn-ghost btn-sm nav-teachers-btn" href="' + I.url("vykladacham.html") + '">' + T("Викладачам") + '</a>' +
          '<a class="btn btn-primary btn-sm" href="' + I.url("kursy.html") + '">' + T("Обрати курс") + '</a>' +
          I.switcherHtml() +
          '<button class="nav-toggle" id="navToggle" aria-label="' + escAttr(T("Меню")) + '" aria-expanded="false">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>' +
          '</button>' +
        '</nav>' +
      '</div></header>';
  }

  /* ---------------- Footer ---------------- */
  function buildFooter() {
    var year = new Date().getFullYear();
    /* TODO: placeholder tiles — swap the emoji for real post photos, and
       point each tile at its own post URL, once Maria sends them. Until
       then every tile links straight to the profile. */
    var instaTile = '<a class="insta-tile" href="https://instagram.com/fika.med.maria" target="_blank" rel="noopener" aria-label="Instagram"><span class="insta-ico">📸</span></a>';
    var instaStrip = '' +
      '<div class="insta-strip">' +
        '<div class="insta-heading"><b>Instagram</b><a href="https://instagram.com/fika.med.maria" target="_blank" rel="noopener">@fika.med.maria</a></div>' +
        '<div class="insta-grid">' + instaTile.repeat(5) + '</div>' +
      '</div>';

    return '' +
      '<footer class="site-footer"><div class="wrap">' +
        instaStrip +
        '<div class="footer-grid">' +
          '<div class="f-brand">' +
            '<span class="brand-name">Fika med <b style="color:#fff">Maria</b></span>' +
            '<p>' + T("Шведська через мову, культуру й живе спілкування — для українськомовних дорослих.") + '</p>' +
          '</div>' +
          '<div>' +
            '<h4>' + T("Навігація") + '</h4>' +
            '<div class="f-links">' +
              '<a href="' + I.url("kursy.html") + '">' + T("Курси") + '</a>' +
              '<a href="' + I.url("blog.html") + '">' + T("Блог") + '</a>' +
              '<a href="' + I.url("kontakty.html") + '">' + T("Контакти") + '</a>' +
            '</div>' +
          '</div>' +
          '<div>' +
            '<h4>' + T("Матеріали") + '</h4>' +
            '<div class="f-links">' +
              '<a href="' + I.url("bezkoshtovni.html") + '">' + T("Готові уроки") + '</a>' +
              '<a href="' + I.url("misyachnyk.html") + '">' + T("Медіатека") + '</a>' +
              '<a href="' + I.url("kursy.html") + '">' + T("Усі курси") + '</a>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="footer-bottom">' +
          '<span>© ' + year + ' Fika med Maria. ' + T("Зроблено з теплом.") + '</span>' +
          '<span>fika.med.maria@gmail.com · <a href="' + I.url("kontakty.html") + '">' + T("Контакти") + '</a></span>' +
          /* The kit listens for clicks on [data-fmm-cookie-settings] to reopen the cookie banner. */
          '<button type="button" class="fmm-cookie-link" data-fmm-cookie-settings>' + T("Налаштування cookie") + '</button>' +
        '</div>' +
      '</div></footer>';
  }

  /* ---------------- Card renderers ---------------- */

  /* "Курси з Марією" — live lessons. Per-session price + optional package deal. */
  function liveLessonCard(c) {
    /* A button that only points at the contact page also says which format
       the visitor came from, so the form can preselect it. data.js stays as is. */
    var href = I.url(c.href === "kontakty.html" ? "kontakty.html?offer=" + encodeURIComponent(c.id) : c.href);
    var rows = '';
    if (c.meta) rows += '<div class="row"><b>' + T("Формат") + '</b><span>' + T(c.meta) + '</span></div>';
    if (c.packages) rows += '<div class="row"><b>' + T("Абонемент") + '</b><span>' + T(c.packages) + '</span></div>';
    return '' +
      '<article class="card course-card" id="' + c.id + '">' +
        '<span class="badge">' + T(c.badge) + '</span>' +
        '<h3>' + c.icon + ' ' + T(c.title) + '</h3>' +
        (rows ? '<div class="rows">' + rows + '</div>' : '') +
        '<div class="card-foot">' +
          '<span class="price">' + T(c.price) + (c.priceNote ? '<br><small style="color:var(--muted);font-weight:400">' + T(c.priceNote) + '</small>' : '') + '</span>' +
          '<a class="btn btn-ghost btn-sm" href="' + href + '"' + fmmMarks(c.id, c.title, "live_lesson", "live_formats") + '>' + T(c.cta) + '</a>' +
        '</div>' +
      '</article>';
  }

  /* Combines level + status into one short pill, e.g. "C1 · Уже доступний".
     Used by both the card and the detail page so the two stay in sync. */
  function courseBadge(c) {
    var parts = [];
    if (c.level) parts.push(c.level);
    if (c.status === "in-development") parts.push(T("У розробці"));
    if (c.status === "growing") parts.push(T("Уже доступний"));
    return parts.join(" · ");
  }

  /* "Курси для самостійного опрацювання" — no prices yet, so none are shown. */
  function selfStudyCard(c) {
    var badge = courseBadge(c);
    return '' +
      '<article class="card course-card">' +
        (badge ? '<span class="badge">' + badge + '</span>' : '') +
        '<h3>' + c.icon + ' ' + T(c.title) + '</h3>' +
        '<p>' + T(c.description) + '</p>' +
        '<div class="card-foot">' +
          '<a class="btn btn-ghost btn-sm" href="' + I.url("kurs.html?id=" + c.id) + '"' + fmmMarks(c.id, c.title, "course", "self_study") + '>' + T("Дізнатися більше") + '</a>' +
        '</div>' +
      '</article>';
  }

  /* "Готові уроки" — every lesson ships as the same four PDFs (student
     slides, slides with answers, A4 worksheet, A4 worksheet with answers),
     plus an online Canva presentation and a Miro board. */
  var LESSON_FORMAT = "4 PDF · Canva · Miro";
  var LEVEL_ORDER = ["A0", "A1", "A2", "B1", "B2", "C1"];

  /* "A2–B1" → ["A2","B1"], "B2" → ["B2"]. Feeds the level filter, so a
     lesson labelled A2–B1 turns up under both A2 and B1. */
  function levelsOf(label) {
    var parts = String(label || "").split("–");
    var from = LEVEL_ORDER.indexOf(parts[0]);
    var to = LEVEL_ORDER.indexOf(parts[parts.length - 1]);
    return from < 0 || to < from ? [] : LEVEL_ORDER.slice(from, to + 1);
  }

  /* What every lesson contains — one list, shown on the catalogue page and on
     each lesson's own page. */
  var LESSON_INCLUDES = [
    { ico: "🖥️", title: T("Слайди для учня"), text: T("Урок у форматі презентації — від розминки до міні-проєкту.") },
    { ico: "✅", title: T("Слайди з відповідями"), text: T("Та сама презентація з відповідями — для викладача або самоперевірки.") },
    { ico: "📄", title: T("Робочий аркуш A4"), text: T("Усі завдання уроку на аркушах, які зручно роздрукувати.") },
    { ico: "📝", title: T("Аркуш A4 з відповідями"), text: T("Ключі до всіх завдань.") },
    { ico: "🎨", title: T("Презентація в Canva"), text: T("Онлайн-версія слайдів з відповідями — зручно показувати на занятті.") },
    { ico: "🧩", title: T("Дошка в Miro"), text: T("Слайди для учня на онлайн-дошці — для занять онлайн.") }
  ];

  function lessonUrl(r) { return I.url("urok.html?id=" + r.id); }

  function lessonTopic(r) {
    var D = window.FMM || {};
    return (D.resourceTopics || []).filter(function (t) { return t.id === r.topic; })[0];
  }

  /* The "Купити" button. It goes to Patreon; until Maria sends the link
     (patreonUrl in data.js) it stays "#" and opens nothing. */
  function buyButton(r, cls) {
    var D = window.FMM || {};
    var url = r.href || D.patreonUrl || "#";
    var external = url === "#" ? "" : ' target="_blank" rel="noopener"';
    return '<a class="btn ' + cls + '" href="' + url + '"' + external + fmmMarks(r.id, r.title, "lesson", "ready_lessons", "buy_click") + '>' + (r.cta ? T(r.cta) : T("Купити")) + '</a>';
  }

  function lessonPills(r) {
    var topic = lessonTopic(r);
    return '<div class="levels">' +
      (r.level ? '<span class="level-badge">' + r.level + '</span>' : '') +
      (topic ? '<span class="topic-pill">' + T(topic.subtitle) + '</span>' : '') +
    '</div>';
  }

  /* A product card: cover image, level + topic, title, short text, buy button.
     The whole card opens the lesson's page (stretched title link); the buy
     button sits above that link. */
  function resourceCard(r) {
    return '' +
      '<article class="card resource-card" data-levels="' + levelsOf(r.level).join(",") + '" data-topic="' + (r.topic || "") + '">' +
        '<div class="resource-media"><img src="' + I.asset("assets/lessons/" + r.id + "/cover.webp") + '" alt="" loading="lazy" /></div>' +
        '<div class="resource-body">' +
          lessonPills(r) +
          '<h3><a class="card-link" href="' + lessonUrl(r) + '"' + fmmMarks(r.id, r.title, "lesson", "ready_lessons") + '>' + T(r.title) + '</a></h3>' +
          '<p>' + T(r.description) + '</p>' +
          '<div class="card-foot" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:.6rem .8rem">' +
            '<span class="fmt">' + LESSON_FORMAT + '</span>' +
            buyButton(r, "btn-accent btn-sm") +
          '</div>' +
        '</div>' +
      '</article>';
  }

  /* Cover tint per category — swap for real photos any time by giving a
     post its own "image" field and branching on it here. */
  var CATEGORY_COVER_BG = {
    "Культура Швеції": "var(--honey-soft)",
    "Слова та вирази": "var(--blue-soft)",
    "Життя у Швеції": "var(--sage-soft)",
    "Як вчити шведську": "var(--terracotta-soft)"
  };

  function postCard(p) {
    var cover;
    if (p.image) {
      var src = I.localizedAsset(p.image), base = I.asset(p.image);
      /* if this language has no cover of its own yet, show the Ukrainian one */
      var fallback = src !== base ? ' onerror="this.onerror=null;this.src=\'' + base + '\'"' : "";
      cover = '<div class="post-cover post-cover-photo"><img src="' + src + '" alt="" loading="lazy"' + fallback + ' /></div>';
    } else {
      var bg = CATEGORY_COVER_BG[p.category] || "var(--paper-2)";
      cover = '<div class="post-cover" style="background:' + bg + '"><span class="post-cover-icon">' + (p.icon || "☕") + '</span></div>';
    }
    return '' +
      '<article class="card post-card">' +
        cover +
        '<div class="post-body">' +
          '<div class="meta"><span class="cat">' + T(p.category) + '</span><span>' + T("{time} читання", { time: T(p.time) }) + '</span></div>' +
          '<h3>' + T(p.title) + '</h3>' +
          '<p style="color:var(--muted)">' + T(p.excerpt) + '</p>' +
          '<div class="card-foot"><a class="btn btn-ghost btn-sm" href="' + I.url(p.href || "blog.html") + '">' + T("Читати →") + '</a></div>' +
        '</div>' +
      '</article>';
  }

  /* Students' own words. On a translated page the quote is translated and
     says so; names always stay exactly as the person wrote them. */
  function testiCard(t) {
    var name = t.name || T("Учениця");
    /* a name keeps its own (Ukrainian) spelling; mark it so it is read correctly */
    var nameLang = t.name && I.lang !== "uk" && /[\u0400-\u04FF]/.test(t.name) ? ' lang="uk"' : "";
    var quote = T(t.quote);
    var translated = quote !== t.quote;
    var av;
    if (t.photo) av = '<span class="av"><img src="' + I.asset(t.photo) + '" alt="" loading="lazy" /></span>';
    else if (t.name) av = '<span class="av"' + nameLang + '>' + t.name.charAt(0).toUpperCase() + '</span>';
    else av = '<span class="av"></span>';
    return '' +
      '<article class="testi">' +
        '<p>' + T("«{quote}»", { quote: quote }) + '</p>' +
        (translated ? '<p class="testi-note">' + T("Перекладено з української") + '</p>' : '') +
        '<div class="who">' + av + '<span><b' + nameLang + '>' + name + '</b>' + (t.source ? '<br><span class="testi-source">' + T(t.source) + '</span>' : '') + '</span></div>' +
      '</article>';
  }

  function faqItem(f) {
    return '<details><summary>' + T(f.q) + '</summary><p>' + T(f.a) + '</p></details>';
  }

  /* ---------------- Render into containers ---------------- */
  function fill(selector, items, builder, limit, filterFn) {
    var el = document.querySelector(selector);
    if (!el || !items) return;
    var list = filterFn ? items.filter(filterFn) : items.slice();
    if (limit) list = list.slice(0, limit);
    el.innerHTML = list.map(builder).join("");
  }

  function renderAll() {
    var D = window.FMM || {};

    // Courses: [data-courses="live"] (Курси з Марією) or [data-courses="self-study"]
    document.querySelectorAll("[data-courses]").forEach(function (el) {
      var mode = el.getAttribute("data-courses");
      if (mode === "live") {
        el.innerHTML = (D.liveLessons || []).map(liveLessonCard).join("");
      } else if (mode === "self-study") {
        el.innerHTML = (D.selfStudyCourses || []).map(selfStudyCard).join("");
      }
    });

    document.querySelectorAll("[data-resources]").forEach(function (el) {
      var limit = parseInt(el.getAttribute("data-limit"), 10) || 0;
      var list = (D.resources || []).slice();
      if (limit) list = list.slice(0, limit);
      if (!list.length) {
        el.innerHTML = '<p class="center" style="grid-column:1/-1;color:var(--muted)">' + T("Перші готові уроки скоро з’являться тут.") + '</p>';
      } else if (el.hasAttribute("data-grouped")) {
        /* The catalogue page: one headed block per topic, in roadmap order. */
        el.innerHTML = (D.resourceTopics || []).map(function (t) {
          var items = list.filter(function (r) { return r.topic === t.id; });
          if (!items.length) return "";
          return '<section class="topic-block" data-topic-block>' +
            '<div class="topic-head"><h3>' + T(t.title) + '</h3><p>' + T(t.subtitle) + '</p></div>' +
            '<div class="grid grid-3">' + items.map(function (r) { return resourceCard(r); }).join("") + '</div>' +
          '</section>';
        }).join("");
      } else {
        el.innerHTML = list.map(function (r) { return resourceCard(r); }).join("");
      }
    });

    document.querySelectorAll("[data-lesson-includes]").forEach(function (el) {
      el.innerHTML = lessonIncludesHtml();
    });

    document.querySelectorAll("[data-topic-filters]").forEach(function (el) {
      el.innerHTML += (D.resourceTopics || []).map(function (t) {
        return '<label class="filter-check"><input type="checkbox" name="filter-topic" value="' + t.id + '" /> ' + T(t.title) + '</label>';
      }).join("");
    });

    document.querySelectorAll("[data-posts]").forEach(function (el) {
      var limit = parseInt(el.getAttribute("data-limit"), 10) || 0;
      var list = (D.posts || []).slice();
      if (limit) list = list.slice(0, limit);
      el.innerHTML = list.map(postCard).join("");
    });

    document.querySelectorAll("[data-faq]").forEach(function (el) {
      var src = el.getAttribute("data-faq") === "course" ? D.courseFaq : D.faq;
      el.innerHTML = (src || []).map(faqItem).join("");
    });

    document.querySelectorAll("[data-testimonials]").forEach(function (el) {
      el.innerHTML = (D.testimonials || []).map(testiCard).join("");
    });
  }

  /* ---------------- Course detail page (kurs.html?id=<id>) ----------------
     Looks the course up in D.selfStudyCourses by the "id" query param and
     renders whatever is known about it. Live lessons ("Курси з Марією")
     don't have detail pages — only self-study courses do. */
  function courseStatusNote(c) {
    if (c.status === "in-development") return T("Цей курс ще в розробці. Ми повідомимо, коли він стане доступний.");
    if (c.status === "growing") return T("Курс уже можна придбати. Він ще доповнюється — Марія додає нові уроки щодня.");
    return "";
  }

  function courseNotFoundTemplate() {
    return '' +
      '<section class="page-hero">' +
        '<div class="wrap center">' +
          '<span class="eyebrow">' + T("Курс не знайдено") + '</span>' +
          '<h1>' + T("Такого курсу тут немає") + '</h1>' +
          '<p class="lead">' + T("Можливо, посилання застаріло або курс ще не додано. Переглянь усі курси нижче.") + '</p>' +
          '<div class="hero-actions" style="justify-content:center">' +
            '<a class="btn btn-primary" href="' + I.url("kursy.html") + '">' + T("Усі курси") + '</a>' +
          '</div>' +
        '</div>' +
      '</section>';
  }

  function courseDetailTemplate(c) {
    var badge = courseBadge(c) || T("Курс для самостійного опрацювання");
    var statusNote = courseStatusNote(c);
    var rows = c.level ? '<div class="rows"><div class="row"><b>' + T("Рівень") + '</b><span>' + c.level + '</span></div></div>' : '';
    return '' +
      '<section class="page-hero">' +
        '<div class="wrap">' +
          '<div class="breadcrumb"><a href="' + I.url("index.html") + '">' + T("Головна") + '</a> → <a href="' + I.url("kursy.html") + '">' + T("Курси") + '</a> → ' + T(c.title) + '</div>' +
          '<span class="eyebrow">' + badge + '</span>' +
          '<h1>' + c.icon + ' ' + T(c.title) + '</h1>' +
          '<p class="lead">' + T(c.description) + '</p>' +
        '</div>' +
      '</section>' +
      '<section class="section">' +
        '<div class="wrap" style="max-width:720px">' +
          '<div class="card course-card">' +
            '<h3>' + T("Що відомо про курс") + '</h3>' +
            rows +
            (statusNote ? '<p style="color:var(--muted)">' + statusNote + '</p>' : '') +
            '<p style="color:var(--muted)">' + T("Повний опис і ціна курсу зʼявляться тут пізніше.") + '</p>' +
          '</div>' +
          '<div class="center" style="margin-top:2rem">' +
            '<div class="hero-actions" style="justify-content:center">' +
              '<a class="btn btn-primary" href="' + I.url("kontakty.html?offer=" + encodeURIComponent(c.id)) + '">' + T("Написати Марії") + '</a>' +
              '<a class="btn btn-ghost" href="' + I.url("kursy.html") + '">' + T("Усі курси") + '</a>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</section>';
  }

  function renderCourseDetail() {
    var el = document.querySelector("[data-course-detail]");
    if (!el) return;
    var D = window.FMM || {};
    var id = new URLSearchParams(window.location.search).get("id");
    var course = (D.selfStudyCourses || []).filter(function (c) { return c.id === id; })[0];
    if (!course) { el.innerHTML = courseNotFoundTemplate(); return; }
    document.title = T(course.title) + " — Fika med Maria";
    el.innerHTML = courseDetailTemplate(course);
    I.addAlternates();
    /* Only on a real course, never on the "not found" state: tells the kit what this page is about. */
    document.body.setAttribute("data-fmm-item", course.id);
    document.body.setAttribute("data-fmm-name", course.title);
    document.body.setAttribute("data-fmm-cat", "course");
  }

  /* ---------------- Lesson page (urok.html?id=<lesson id>) ----------------
     A product page for one ready lesson: image gallery, buy button, longer
     explanation, lesson plan. Texts come from D.resources (data.js), images /
     plan / key expressions from D.lessonDetails (lesson-details.js). */
  function lessonNotFoundTemplate() {
    return '' +
      '<section class="page-hero">' +
        '<div class="wrap center">' +
          '<span class="eyebrow">' + T("Урок не знайдено") + '</span>' +
          '<h1>' + T("Такого уроку тут немає") + '</h1>' +
          '<p class="lead">' + T("Можливо, посилання застаріло або урок ще не додано. Усі готові уроки — нижче.") + '</p>' +
          '<div class="hero-actions" style="justify-content:center">' +
            '<a class="btn btn-primary" href="' + I.url("bezkoshtovni.html") + '">' + T("Усі готові уроки") + '</a>' +
          '</div>' +
        '</div>' +
      '</section>';
  }

  /* Total minutes, rounded to the nearest 5. */
  function roundMinutes(m) { return Math.round(m / 5) * 5; }

  function lessonGallery(r, det) {
    var imgs = det.images || [];
    if (!imgs.length) return '';
    var base = I.asset("assets/lessons/" + r.id + "/");
    var alt0 = escAttr(T(imgs[0].alt));
    return '<div class="lesson-gallery">' +
      '<div class="gallery-main"><img src="' + base + imgs[0].file + '" alt="' + alt0 + '" data-gallery-main /></div>' +
      '<div class="gallery-thumbs">' + imgs.map(function (im, i) {
        var alt = escAttr(T(im.alt));
        return '<button type="button" class="gallery-thumb' + (i ? '' : ' active') + '" data-gallery-thumb data-src="' + base + im.file + '" data-alt="' + alt + '" aria-label="' + alt + '">' +
          '<img src="' + base + im.file + '" alt="" loading="lazy" /></button>';
      }).join('') + '</div>' +
    '</div>';
  }

  function lessonPlan(det) {
    var plan = det.plan || [];
    if (!plan.length) return '';
    function row(p) {
      var time = p.homework ? T("вдома") : (p.optional ? T("за бажанням") + " · " : "") + T("{n} хв", { n: p.minutes });
      return '<li><span class="plan-kind">' + T(p.kind) + '</span><span class="plan-title">' + p.title + '</span><span class="plan-min">' + time + '</span></li>';
    }
    var inClass = plan.filter(function (p) { return !p.homework; });
    var homework = plan.filter(function (p) { return p.homework; });
    return '<ol class="plan-list">' + inClass.map(row).join('') + '</ol>' +
      '<p class="plan-total">' + T("Разом ≈ {n} хв (без завдань за бажанням)", { n: roundMinutes(det.minutes) }) + '</p>' +
      (homework.length ? '<h3 class="plan-sub">' + T("Вдома") + '</h3><ol class="plan-list">' + homework.map(row).join('') + '</ol>' : '');
  }

  function lessonDetailTemplate(r, det) {
    var D = window.FMM || {};
    var topic = lessonTopic(r);
    var mins = det.minutes ? roundMinutes(det.minutes) : 0;
    var chunks = (det.chunks || []).map(function (c) { return '<li>' + c.charAt(0).toLowerCase() + c.slice(1) + '</li>'; }).join('');

    var learn = '';
    if (chunks) learn += '<div class="card"><div class="ico">📚</div><h3>' + T("Ключові вирази") + '</h3><p>' + T("Вирази з тексту уроку, які ти опрацьовуєш у вправах.") + '</p><ul class="chip-list">' + chunks + '</ul></div>';
    if (r.grammar) learn += '<div class="card"><div class="ico">🧩</div><h3>' + T("Граматика") + '</h3><p>' + T(r.grammar) + '</p></div>';
    if (r.project) learn += '<div class="card"><div class="ico">💬</div><h3>' + T("Практика") + '</h3><p>' + T(r.project) + '</p></div>';

    var related = (D.resources || []).filter(function (x) { return x.topic === r.topic && x.id !== r.id; }).slice(0, 3);
    var fits = mins
      ? T("Підходить студентам рівня {level}, які вчаться самостійно, і викладачам, яким потрібен готовий урок на ≈ {mins} хвилин. Слайди з відповідями допоможуть і з самоперевіркою, і на занятті.", { level: r.level, mins: mins })
      : T("Підходить студентам рівня {level}, які вчаться самостійно, і викладачам, яким потрібен готовий урок. Слайди з відповідями допоможуть і з самоперевіркою, і на занятті.", { level: r.level });

    return '' +
      '<section class="section" style="padding-top:1.5rem;padding-bottom:2rem">' +
        '<div class="wrap">' +
          '<div class="breadcrumb"><a href="' + I.url("index.html") + '">' + T("Головна") + '</a> → <a href="' + I.url("bezkoshtovni.html") + '">' + T("Готові уроки") + '</a> → ' + T(r.title) + '</div>' +
          '<div class="lesson-top">' +
            lessonGallery(r, det) +
            '<div class="lesson-info">' +
              lessonPills(r) +
              '<h1>' + T(r.title) + '</h1>' +
              '<p class="lead">' + T(r.description) + '</p>' +
              '<dl class="lesson-facts">' +
                '<div><dt>' + T("Рівень") + '</dt><dd>' + r.level + '</dd></div>' +
                (topic ? '<div><dt>' + T("Тема") + '</dt><dd>' + T(topic.subtitle) + '</dd></div>' : '') +
                (mins ? '<div><dt>' + T("Тривалість") + '</dt><dd>' + T("≈ {n} хв", { n: mins }) + '</dd></div>' : '') +
                '<div><dt>' + T("Що в уроці") + '</dt><dd>' + LESSON_FORMAT + '</dd></div>' +
                '<div><dt>' + T("Мова матеріалів") + '</dt><dd>' + T("шведська") + '</dd></div>' +
              '</dl>' +
              buyButton(r, 'btn-accent btn-buy') +
              '<p class="buy-note">' + T("Оплата й доступ — через Patreon.") + '</p>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</section>' +

      '<section class="section section-soft">' +
        '<div class="wrap" style="max-width:820px">' +
          '<span class="eyebrow">' + T("Про урок") + '</span>' +
          '<h2 class="section-title">' + T("Що відбувається на занятті") + '</h2>' +
          '<p class="lead" style="margin-top:1rem">' + T(r.about) + '</p>' +
          '<p>' + fits + '</p>' +
        '</div>' +
      '</section>' +

      (learn ? '<section class="section"><div class="wrap">' +
        '<span class="eyebrow">' + T("Чого ти навчишся") + '</span>' +
        '<h2 class="section-title">' + T("Мова, яку одразу можна використати") + '</h2>' +
        '<div class="grid grid-3" style="margin-top:2rem">' + learn + '</div>' +
      '</div></section>' : '') +

      (det.plan && det.plan.length ? '<section class="section section-soft"><div class="wrap" style="max-width:820px">' +
        '<span class="eyebrow">' + T("План уроку") + '</span>' +
        '<h2 class="section-title">' + T("Крок за кроком") + '</h2>' +
        lessonPlan(det) +
      '</div></section>' : '') +

      '<section class="section"><div class="wrap">' +
        '<span class="eyebrow">' + T("Що ти отримаєш") + '</span>' +
        '<h2 class="section-title">' + T("Усе для заняття в одному місці") + '</h2>' +
        '<p class="section-intro">' + T("Чотири файли PDF, а також онлайн-версії для занять у Canva та Miro.") + '</p>' +
        '<div class="values values-six" style="margin-top:2rem">' + lessonIncludesHtml() + '</div>' +
      '</div></section>' +

      '<section class="section final-cta" style="padding-top:0"><div class="wrap"><div class="band">' +
        '<h2 class="section-title" style="color:#fff">' + T("Цей урок для тебе чи для твого заняття?") + '</h2>' +
        '<p class="lead" style="color:rgba(255,255,255,.9);max-width:52ch;margin-inline:auto">' + T("Отримай слайди, аркуші, Canva й Miro — і проведи урок уже завтра.") + '</p>' +
        '<div class="hero-actions">' + buyButton(r, 'btn-accent') + '<a class="btn btn-light" href="' + I.url("bezkoshtovni.html") + '">' + T("Усі готові уроки") + '</a></div>' +
      '</div></div></section>' +

      (related.length ? '<section class="section section-soft"><div class="wrap">' +
        '<span class="eyebrow">' + T("Ще з теми") + '</span>' +
        '<h2 class="section-title">' + (topic ? T(topic.title) : T("Інші уроки")) + '</h2>' +
        '<div class="grid grid-3" style="margin-top:2rem">' + related.map(function (x) { return resourceCard(x); }).join('') + '</div>' +
      '</div></section>' : '');
  }

  function lessonIncludesHtml() {
    return LESSON_INCLUDES.map(function (i) {
      return '<div class="value"><div class="ico">' + i.ico + '</div><h4>' + i.title + '</h4><p>' + i.text + '</p></div>';
    }).join("");
  }

  function renderLessonDetail() {
    var el = document.querySelector("[data-lesson-detail]");
    if (!el) return;
    var D = window.FMM || {};
    var id = new URLSearchParams(window.location.search).get("id");
    var lesson = (D.resources || []).filter(function (r) { return r.id === id; })[0];
    if (!lesson) { el.innerHTML = lessonNotFoundTemplate(); return; }
    var det = (D.lessonDetails || {})[id] || {};
    document.title = T(lesson.title) + " — " + T("Готові уроки") + " — Fika med Maria";
    var meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", T(lesson.description));
    el.innerHTML = lessonDetailTemplate(lesson, det);
    I.addAlternates();
    /* Only on a real lesson, never on the "not found" state: tells the kit what this page is about. */
    document.body.setAttribute("data-fmm-item", lesson.id);
    document.body.setAttribute("data-fmm-name", lesson.title);
    document.body.setAttribute("data-fmm-cat", "lesson");

    var main = el.querySelector("[data-gallery-main]");
    el.querySelectorAll("[data-gallery-thumb]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        main.src = btn.getAttribute("data-src");
        main.alt = btn.getAttribute("data-alt");
        el.querySelectorAll("[data-gallery-thumb]").forEach(function (b) { b.classList.toggle("active", b === btn); });
      });
    });
  }

  /* ---------------- Mobile nav ---------------- */
  function wireNav() {
    var toggle = document.getElementById("navToggle");
    var links = document.getElementById("navLinks");
    if (!toggle || !links) return;
    toggle.addEventListener("click", function () {
      var open = links.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(open));
    });
    links.addEventListener("click", function (e) {
      if (e.target.tagName === "A") { links.classList.remove("open"); toggle.setAttribute("aria-expanded", "false"); }
    });

    /* A translated menu can be longer than the Ukrainian one. When the desktop
       menu does not fit on one line, the header uses the phone menu instead. */
    var header = toggle.closest(".site-header");
    var inner = header && header.querySelector(".header-inner");
    if (!inner) return;
    /* Measuring means briefly switching the compact menu off; transitions are
       paused meanwhile, or the hidden menu would visibly slide shut each time. */
    function fit() {
      links.style.transition = "none";
      header.classList.remove("nav-compact");
      var tooWide = !window.matchMedia("(max-width: 860px)").matches &&
        inner.scrollWidth > inner.clientWidth + 1;
      header.classList.toggle("nav-compact", tooWide);
      void links.offsetWidth; // settle the final state before transitions return
      links.style.transition = "";
    }
    fit();
    window.addEventListener("resize", fit);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
  }

  /* ---------------- Seasonal decor ----------------
     Drops a couple of small emoji accents into the empty top corners of
     every page's hero section. Purely decorative: aria-hidden, no pointer
     events, hidden below 600px so it never crowds a phone screen. Season
     is controlled entirely by D.seasonDecor in data.js — nothing here
     needs editing to change it. */
  function renderSeasonDecor() {
    var D = window.FMM || {};
    var icons = D.seasonDecor || [];
    if (!icons.length) return;
    var hero = document.querySelector(".hero, .page-hero");
    if (!hero) return;
    var corners = [
      { cls: "season-decor tl", icon: icons[0] },
      { cls: "season-decor br", icon: icons[1] || icons[0] }
    ];
    corners.forEach(function (c, i) {
      if (!c.icon) return;
      var span = document.createElement("span");
      span.className = c.cls;
      span.setAttribute("aria-hidden", "true");
      span.textContent = c.icon;
      hero.appendChild(span);
    });
  }

  /* ---------------- Copy-email buttons ----------------
     A mailto: link can't open the visitor's mail app when the page is
     shown inside an embedded preview (e.g. a shared Artifact iframe), so
     every mailto also gets a copy-to-clipboard fallback next to it. */
  function copyFallback(text) {
    var ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); } catch (_) {}
    document.body.removeChild(ta);
  }

  function wireCopyButtons() {
    document.querySelectorAll("[data-copy-email]").forEach(function (el) {
      el.addEventListener("click", function (e) {
        e.preventDefault();
        var email = el.getAttribute("data-copy-email");
        var original = el.textContent;
        var mark = function () {
          el.textContent = T("Скопійовано ✓");
          setTimeout(function () { el.textContent = original; }, 1800);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(email).then(mark).catch(function () { copyFallback(email); mark(); });
        } else {
          copyFallback(email);
          mark();
        }
      });
    });
  }

  /* ---------------- Resource filters (bezkoshtovni.html) ----------------
     Checkboxes styled as circles. Level and topic are multi-select — a card
     matches if it has ANY checked level and belongs to ANY checked topic.
     No filter checked in a group = that group doesn't narrow. Topic blocks
     with no visible card are hidden along with their heading. */
  function wireResourceFilters() {
    var panel = document.querySelector("[data-resource-filters]");
    if (!panel) return;
    var levelInputs = panel.querySelectorAll('[name="filter-level"]');
    var topicInputs = panel.querySelectorAll('[name="filter-topic"]');
    var emptyMsg = document.querySelector("[data-resources-empty]");

    function apply() {
      var levels = Array.prototype.filter.call(levelInputs, function (i) { return i.checked; }).map(function (i) { return i.value; });
      var topics = Array.prototype.filter.call(topicInputs, function (i) { return i.checked; }).map(function (i) { return i.value; });
      var visible = 0;

      document.querySelectorAll(".resource-card").forEach(function (card) {
        var cardLevels = (card.getAttribute("data-levels") || "").split(",");
        var okLevel = !levels.length || levels.some(function (l) { return cardLevels.indexOf(l) !== -1; });
        var okTopic = !topics.length || topics.indexOf(card.getAttribute("data-topic")) !== -1;
        var show = okLevel && okTopic;
        card.style.display = show ? "" : "none";
        if (show) visible++;
      });

      document.querySelectorAll("[data-topic-block]").forEach(function (block) {
        var any = Array.prototype.some.call(block.querySelectorAll(".resource-card"), function (c) { return c.style.display !== "none"; });
        block.style.display = any ? "" : "none";
      });

      if (emptyMsg) emptyMsg.style.display = visible ? "none" : "";
    }

    panel.addEventListener("change", apply);
    apply();
  }

  /* ---------------- Contact page: ?offer=<id> ----------------
     Buttons on cards and detail pages say what the visitor is interested in,
     and the form's "goal" select preselects it. Only values this site knows
     are accepted, so a hand-edited URL cannot put arbitrary text in the form. */
  function addGoalOption(select, value, text) {
    var opt = document.createElement("option");
    opt.value = value;
    opt.textContent = text;
    select.appendChild(opt);
    select.value = value;
  }

  function applyOfferHint() {
    var goal = document.querySelector('form[data-contact] select[name="goal"]');
    if (!goal) return;
    var offer = new URLSearchParams(window.location.search).get("offer");
    if (!offer) return;

    /* 1. A format that already has an option (live lessons, consultation). */
    for (var i = 0; i < goal.options.length; i++) {
      if (goal.options[i].value === offer) { goal.selectedIndex = i; return; }
    }
    /* 2. The teachers' page link. */
    if (offer === "teacher_collab") {
      addGoalOption(goal, offer, T("Співпраця для викладачів"));
      return;
    }
    /* 3. A self-study course or a ready lesson, looked up by id in data.js. */
    if (offer.length > 80 || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(offer)) return;
    var D = window.FMM || {};
    var known = (D.selfStudyCourses || []).concat(D.resources || []).filter(function (x) { return x.id === offer; })[0];
    if (known) addGoalOption(goal, offer, T("Питання про: {title}", { title: T(known.title) }));
  }

  /* ---------------- Forms ----------------
     The contact and newsletter forms hand their values to FMMKit
     (assets/fmm-kit.js), which answers "sent", "queued" (saved on this device,
     retried later) or "rejected". This file only collects the values and
     shows the outcome, so the site still works when the kit file is blocked. */
  var FALLBACK_TELEGRAM = { handle: "@MaryZubchenko", url: "https://t.me/MaryZubchenko" };
  var MSG_EMAIL = T("Перевір, будь ласка, email ☕");
  var MSG_SENT_CONTACT = T("Дякую! Я звʼяжуся з тобою найближчим часом 🫶");
  var MSG_SENT_NEWSLETTER = T("Готово! Перша fika вже летить до тебе 🫶");
  /* These two are followed by the Telegram link and a full stop. */
  var MSG_QUEUED = T("Заявку збережено на цьому пристрої, але надіслати її поки не вдалося. Я спробую ще раз автоматично. Якщо справа термінова — напиши мені в Telegram:") + " ";
  var MSG_REJECTED = T("Не вдалося надіслати заявку. Напиши мені, будь ласка, напряму: fika.med.maria@gmail.com або в Telegram") + " ";

  /* Handle and link come from the kit's config. The literal ones are used
     when the kit is missing, or when its config has no usable link. */
  function telegramInfo() {
    var cfg = (window.FMMKit && window.FMMKit.config) || {};
    if (cfg.telegramHandle && /^https:\/\//i.test(String(cfg.telegramUrl || ""))) {
      return { handle: String(cfg.telegramHandle), url: String(cfg.telegramUrl) };
    }
    return FALLBACK_TELEGRAM;
  }

  /* Builds the message with DOM nodes only (no innerHTML). state is "is-ok",
     "is-warn", "is-error" or "" to clear; withLink adds the Telegram link
     and a full stop. */
  function showFormMessage(msg, state, text, withLink) {
    if (!msg) return;
    msg.textContent = text;
    msg.classList.remove("is-ok", "is-warn", "is-error");
    if (state) msg.classList.add(state);
    if (withLink) {
      var tg = telegramInfo();
      var a = document.createElement("a");
      a.href = tg.url;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = tg.handle;
      msg.appendChild(a);
      msg.appendChild(document.createTextNode("."));
    }
  }

  /* Every named field as a trimmed string. The honeypot ("website") is not a
     real field, so it is left out here and sent to the kit separately. A
     select also sends the visible text of its chosen option as <name>_label,
     but only when a real value is chosen. */
  function collectFields(form) {
    var fields = {};
    Array.prototype.forEach.call(form.elements, function (el) {
      var type = String(el.type || "").toLowerCase();
      if (!el.name || el.name === "website" || el.disabled) return;
      if (type === "submit" || type === "button" || type === "reset" || type === "image" || type === "file") return;
      if ((type === "checkbox" || type === "radio") && !el.checked) return;
      fields[el.name] = String(el.value).trim();
      if (el.tagName === "SELECT" && el.value !== "" && el.selectedIndex >= 0) {
        fields[el.name + "_label"] = el.options[el.selectedIndex].text.trim();
      }
    });
    return fields;
  }

  function kitAttemptKey(form) {
    try {
      if (window.FMMKit && typeof window.FMMKit.attemptKey === "function") return window.FMMKit.attemptKey(form) || null;
    } catch (_) {}
    return null;
  }

  /* Always resolves to "sent", "queued" or "rejected". A missing kit, an
     error thrown by it and a rejected promise all count as "rejected". */
  function sendToKit(formKey, fields, extra) {
    var kit = window.FMMKit;
    if (!kit || typeof kit.submitForm !== "function") return Promise.resolve("rejected");
    try {
      return Promise.resolve(kit.submitForm(formKey, fields, extra)).catch(function () { return "rejected"; });
    } catch (_) {
      return Promise.resolve("rejected");
    }
  }

  function wireForms() {
    document.querySelectorAll("form[data-newsletter], form[data-contact]").forEach(function (form) {
      var formKey = form.hasAttribute("data-contact") ? "contact" : "newsletter";
      var msg = form.querySelector("[data-msg]") || (form.parentElement && form.parentElement.querySelector("[data-msg]"));
      var button = form.querySelector('button[type="submit"], button:not([type])');
      var sending = false;
      var startedAt = null;

      /* A live region has to exist before its text changes, so set it up now. */
      if (msg) {
        msg.setAttribute("role", "status");
        msg.setAttribute("aria-live", "polite");
      }

      /* "Time to fill" starts at the first focus inside the form. */
      form.addEventListener("focusin", function (e) {
        /* Focusing the send button is not the start of filling the form. */
        if (startedAt === null && e.target !== button) startedAt = Date.now();
      });

      form.addEventListener("submit", function (e) {
        e.preventDefault();
        if (sending) return;

        var emailField = form.querySelector('input[type="email"]');
        var email = emailField ? emailField.value : "";
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
          showFormMessage(msg, "is-error", MSG_EMAIL, false);
          return;
        }

        sending = true;
        var label = button ? button.textContent : "";
        if (button) { button.disabled = true; button.textContent = T("Надсилаю…"); }
        showFormMessage(msg, "", "", false);

        var honeypot = form.querySelector('[name="website"]');
        var fields = collectFields(form);
        var extra = {
          hp: honeypot ? String(honeypot.value) : "",
          elapsed_ms: Date.now() - (startedAt === null ? PAGE_LOADED_AT : startedAt),
          attempt_key: kitAttemptKey(form)
        };

        var finish = function () {
          sending = false;
          if (button) { button.disabled = false; button.textContent = label; }
        };

        sendToKit(formKey, fields, extra).then(function (result) {
          if (result !== "sent" && result !== "queued") {
            /* Not sent and not saved: keep what the visitor typed. */
            showFormMessage(msg, "is-error", MSG_REJECTED, true);
            return;
          }
          form.reset();
          startedAt = null;
          /* The message must show even if the kit's reset step fails. */
          try { window.FMMKit.resetForm(form); } catch (_) {}
          if (result === "sent") {
            showFormMessage(msg, "is-ok", formKey === "contact" ? MSG_SENT_CONTACT : MSG_SENT_NEWSLETTER, false);
          } else {
            showFormMessage(msg, "is-warn", MSG_QUEUED, true);
          }
        }).then(finish, finish);
      });

      /* Last, so the kit sees the form with the offer hint already applied. */
      if (window.FMMKit && typeof window.FMMKit.watchForm === "function") {
        try { window.FMMKit.watchForm(form, formKey); } catch (_) {}
      }
    });
  }

  /* ---------------- Init ---------------- */
  document.addEventListener("DOMContentLoaded", function () {
    var h = document.querySelector("[data-include-header]");
    if (h) { h.outerHTML = buildHeader(); I.wireSwitcher(); }
    var f = document.querySelector("[data-include-footer]");
    if (f) f.outerHTML = buildFooter();

    renderAll();
    renderCourseDetail();
    renderLessonDetail();
    wireNav();
    applyOfferHint(); // before wireForms, so the kit watches the form in its final state
    wireForms();
    wireCopyButtons();
    renderSeasonDecor();
    wireResourceFilters();

    /* Cards like #sprakkafe are rendered by renderAll() above, so an
       incoming link's #hash (e.g. from a blog article) doesn't exist yet
       when the browser tries to jump to it on page load. Scroll to it now
       that the target is actually in the DOM. */
    if (location.hash) {
      var target = document.getElementById(location.hash.slice(1));
      if (target) target.scrollIntoView();
    }

    /* Last of all, once everything is rendered: the kit reads the page's
       data-fmm-* marks and starts its tracking. Skipped if the kit is missing. */
    if (window.FMMKit && window.FMMKit.pageReady) window.FMMKit.pageReady();
  });
})();
