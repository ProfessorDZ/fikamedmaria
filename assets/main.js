/* =====================================================================
   Fika med Maria — shared interactions & rendering
   Injects header/footer, renders card grids from data.js, handles FAQ,
   mobile nav, and demo forms. No build step, no dependencies.
   ===================================================================== */
(function () {
  "use strict";

  var PAGE = document.body.dataset.page || "home";

  var NAV = [
    { id: "home", label: "Головна", href: "index.html" },
    { id: "about", label: "Про Марію", href: "pro-mariu.html" },
    { id: "courses", label: "Курси", href: "kursy.html" },
    { id: "free", label: "Безкоштовні матеріали", href: "bezkoshtovni.html" },
    { id: "magazine", label: "Місячник", href: "misyachnyk.html" },
    { id: "blog", label: "Блог", href: "blog.html" },
    { id: "contact", label: "Контакти", href: "kontakty.html" }
  ];

  /* ---------------- Header ---------------- */
  function buildHeader() {
    var links = NAV.map(function (n) {
      return '<a href="' + n.href + '"' + (n.id === PAGE ? ' class="active"' : "") + ">" + n.label + "</a>";
    }).join("");

    return '' +
      '<header class="site-header"><div class="wrap header-inner">' +
        '<a class="brand" href="index.html" aria-label="Fika med Maria — головна">' +
          '<span class="brand-mark">☕</span>' +
          '<span class="brand-name">Fika med <b>Maria</b></span>' +
        '</a>' +
        '<nav class="nav" aria-label="Головна навігація">' +
          '<div class="nav-links" id="navLinks">' + links + '</div>' +
          '<a class="btn btn-primary btn-sm" href="kursy.html">Обрати курс</a>' +
          '<button class="nav-toggle" id="navToggle" aria-label="Меню" aria-expanded="false">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>' +
          '</button>' +
        '</nav>' +
      '</div></header>';
  }

  /* ---------------- Footer ---------------- */
  function buildFooter() {
    var year = new Date().getFullYear();
    return '' +
      '<footer class="site-footer"><div class="wrap">' +
        '<div class="footer-grid">' +
          '<div class="f-brand">' +
            '<span class="brand-name">Fika med <b style="color:#fff">Maria</b></span>' +
            '<p>Шведська через мову, культуру й живе спілкування — для українськомовних дорослих.</p>' +
          '</div>' +
          '<div>' +
            '<h4>Навігація</h4>' +
            '<div class="f-links">' +
              '<a href="pro-mariu.html">Про Марію</a>' +
              '<a href="kursy.html">Курси</a>' +
              '<a href="blog.html">Блог</a>' +
              '<a href="kontakty.html">Контакти</a>' +
            '</div>' +
          '</div>' +
          '<div>' +
            '<h4>Матеріали</h4>' +
            '<div class="f-links">' +
              '<a href="bezkoshtovni.html">Безкоштовні матеріали</a>' +
              '<a href="misyachnyk.html">Місячник зі шведської</a>' +
              '<a href="kursy.html">Усі курси</a>' +
            '</div>' +
          '</div>' +
          '<div>' +
            '<h4>Fika-лист</h4>' +
            '<p style="margin-bottom:.6rem">Маленька порція шведської раз на тиждень.</p>' +
            '<form class="f-signup" data-newsletter>' +
              '<input type="email" placeholder="твоя@пошта.com" aria-label="Email" required />' +
              '<button class="btn btn-accent btn-sm" type="submit">Підписатися</button>' +
            '</form>' +
            '<p class="form-msg" data-msg style="color:var(--honey)"></p>' +
          '</div>' +
        '</div>' +
        '<div class="footer-bottom">' +
          '<span>© ' + year + ' Fika med Maria. Зроблено з теплом.</span>' +
          '<span>hej@fikamedmaria.com · <a href="kontakty.html">Контакти</a></span>' +
        '</div>' +
      '</div></footer>';
  }

  /* ---------------- Card renderers ---------------- */
  function courseCard(c) {
    return '' +
      '<article class="card course-card">' +
        '<span class="badge">' + c.level + '</span>' +
        '<h3>' + c.icon + ' ' + c.title + '</h3>' +
        '<div class="rows">' +
          '<div class="row"><b>Для кого</b><span>' + c.audience + '</span></div>' +
          '<div class="row"><b>Результат</b><span>' + c.result + '</span></div>' +
          '<div class="row"><b>Формат</b><span>' + c.format + '</span></div>' +
        '</div>' +
        '<div class="card-foot">' +
          '<span class="price">' + c.price + '</span>' +
          '<a class="btn btn-ghost btn-sm" href="' + c.href + '">' + c.cta + '</a>' +
        '</div>' +
      '</article>';
  }

  function resourceCard(r) {
    return '' +
      '<article class="card resource-card">' +
        '<span class="tag">● ' + r.category + '</span>' +
        '<h3>' + r.title + '</h3>' +
        '<p>' + r.description + '</p>' +
        '<div class="card-foot" style="display:flex;justify-content:space-between;align-items:center;gap:.8rem">' +
          '<span class="fmt">' + r.format + '</span>' +
          '<a class="btn btn-accent btn-sm" href="kontakty.html">' + r.cta + '</a>' +
        '</div>' +
      '</article>';
  }

  function postCard(p) {
    return '' +
      '<article class="card post-card">' +
        '<div class="post-top"></div>' +
        '<div class="post-body">' +
          '<div class="meta"><span class="cat">' + p.category + '</span><span>' + p.time + ' читання</span></div>' +
          '<h3>' + p.title + '</h3>' +
          '<p style="color:var(--muted)">' + p.excerpt + '</p>' +
          '<div class="card-foot"><a class="btn btn-ghost btn-sm" href="blog.html">Читати →</a></div>' +
        '</div>' +
      '</article>';
  }

  function testiCard() {
    return '' +
      '<article class="testi">' +
        '<div class="stars">★★★★★</div>' +
        '<p>«Тут зʼявиться справжній відгук студента, коли Марія додасть перші історії.»</p>' +
        '<div class="who"><span class="av"></span><span><b>Імʼя студента</b><br><span class="placeholder-note">Місце для відгуку</span></span></div>' +
      '</article>';
  }

  function faqItem(f) {
    return '<details><summary>' + f.q + '</summary><p>' + f.a + '</p></details>';
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

    // Courses: [data-courses="all"] or [data-courses="featured"] with optional [data-limit]
    document.querySelectorAll("[data-courses]").forEach(function (el) {
      var mode = el.getAttribute("data-courses");
      var limit = parseInt(el.getAttribute("data-limit"), 10) || 0;
      var list = (D.courses || []).filter(function (c) { return mode === "featured" ? c.featured : true; });
      if (limit) list = list.slice(0, limit);
      el.innerHTML = list.map(courseCard).join("");
    });

    document.querySelectorAll("[data-resources]").forEach(function (el) {
      var limit = parseInt(el.getAttribute("data-limit"), 10) || 0;
      var list = (D.resources || []).slice();
      if (limit) list = list.slice(0, limit);
      el.innerHTML = list.map(resourceCard).join("");
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
  }

  /* ---------------- Forms (demo) ----------------
     Front-end only. To collect real signups/messages, point the form at a
     provider (Mailchimp, Buttondown, Formspree) or your own API. See README. */
  function wireForms() {
    document.querySelectorAll("form[data-newsletter], form[data-contact]").forEach(function (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var msg = form.parentElement.querySelector("[data-msg]") || form.querySelector("[data-msg]");
        var email = (form.querySelector('input[type="email"]') || {}).value || "";
        var ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
        if (!ok) { if (msg) msg.textContent = "Перевір, будь ласка, email ☕"; return; }
        try {
          var key = "fmm-signups";
          var saved = JSON.parse(localStorage.getItem(key) || "[]");
          if (saved.indexOf(email) === -1) saved.push(email);
          localStorage.setItem(key, JSON.stringify(saved));
        } catch (_) {}
        form.reset();
        if (msg) msg.textContent = form.hasAttribute("data-contact")
          ? "Дякую! Я звʼяжуся з тобою найближчим часом 🫶"
          : "Готово! Перша fika вже летить до тебе 🫶";
      });
    });
  }

  /* ---------------- Init ---------------- */
  document.addEventListener("DOMContentLoaded", function () {
    var h = document.querySelector("[data-include-header]");
    if (h) h.outerHTML = buildHeader();
    var f = document.querySelector("[data-include-footer]");
    if (f) f.outerHTML = buildFooter();

    renderAll();
    wireNav();
    wireForms();
  });
})();
