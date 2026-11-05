/* =====================================================================
   Fika med Maria — student cabinet (kabinet.html).
   Three tabs, chosen by the address hash:
     #materialy  my courses, lessons, books (cards from FMMAccount.library())
     #pokupky    my orders
     #profil     name, e-mail, language, new password, sign out
   No session -> vkhid.html?next=kabinet.html. Needs assets/account.js.
   Every piece of data is escaped before it goes into HTML.
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

  function setMsg(el, kind, text) {
    if (!el) return;
    el.textContent = text || "";
    el.className = "pf-msg" + (text ? " is-" + kind : "");
  }
  function busy(btn, on) {
    if (!btn) return;
    btn.disabled = !!on;
    if (on) btn.setAttribute("aria-busy", "true"); else btn.removeAttribute("aria-busy");
  }
  function mark(input, bad) {
    if (!input) return;
    if (bad) input.setAttribute("aria-invalid", "true"); else input.removeAttribute("aria-invalid");
  }

  function fmtDate(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    try {
      return d.toLocaleDateString(I.lang || "uk", { day: "numeric", month: "long", year: "numeric" });
    } catch (_) {
      return d.toLocaleDateString();
    }
  }
  function fmtMoney(cents, currency) {
    if (cents == null) return "—";
    var cur = String(currency || "EUR").toUpperCase();
    try {
      return new Intl.NumberFormat(I.lang || "uk", { style: "currency", currency: cur }).format(cents / 100);
    } catch (_) {
      return (cents / 100).toFixed(2) + " " + cur;
    }
  }

  /* ---------------- Texts ---------------- */
  var KINDS = {
    course: { label: T("Курс"), icon: "🎓", order: 1 },
    teacher_course: { label: T("Курс для викладачів"), icon: "🍎", order: 2 },
    lesson: { label: T("Урок"), icon: "✏️", order: 3 },
    book: { label: T("Підручник"), icon: "📘", order: 4 },
    magazine_issue: { label: T("Журнал"), icon: "📖", order: 5 },
    magazine_subscription: { label: T("Журнал"), icon: "📖", order: 5 }
  };
  var OTHER_KIND = { label: T("Матеріал"), icon: "☕", order: 9 };
  function kindOf(k) { return KINDS[k] || OTHER_KIND; }

  var STATUS = {
    paid: { label: T("оплачено"), cls: "is-ok" },
    refunded: { label: T("повернено"), cls: "is-muted" },
    partially_refunded: { label: T("частково повернено"), cls: "is-muted" },
    pending: { label: T("очікує"), cls: "" },
    disputed: { label: T("спір із банком"), cls: "is-warn" },
    failed: { label: T("не вдалося"), cls: "is-warn" },
    canceled: { label: T("скасовано"), cls: "is-muted" }
  };

  var PW_ERRORS = {
    weak_password: T("Цей пароль надто простий. Додай більше символів, літери й цифри."),
    same_password: T("Такий пароль у тебе вже був. Придумай новий."),
    session_missing: T("Сесія закінчилась. Увійди ще раз."),
    rate_limited: T("Забагато спроб поспіль. Зачекай хвилинку й спробуй знову."),
    network: T("Немає звʼязку із сервером. Перевір інтернет і спробуй ще раз."),
    unknown: T("Щось пішло не так. Спробуй ще раз за хвилину.")
  };

  function loadError(err) {
    var c = err && err.code;
    if (c === "network") return T("Немає звʼязку із сервером. Перевір інтернет і спробуй ще раз.");
    if (c === "rate_limited") return T("Забагато спроб поспіль. Зачекай хвилинку й спробуй знову.");
    return T("Щось пішло не так. Спробуй ще раз за хвилину.");
  }

  /* ---------------- Sign-in guard ---------------- */
  function goLogin() {
    var target = url("vkhid.html") + "?next=" + encodeURIComponent("kabinet.html" + (window.location.hash || ""));
    if (A.isDemo()) target += "&demo=1";
    window.location.replace(target);
  }

  /* ---------------- Tabs ---------------- */
  var TABS = ["materialy", "pokupky", "profil"];
  var tabButtons = all("[data-tab]");
  var panels = all("[data-panel]");

  function tabFromHash() {
    var h = String(window.location.hash || "").replace(/^#/, "");
    return TABS.indexOf(h) > -1 ? h : "materialy";
  }

  function selectTab(name) {
    tabButtons.forEach(function (b) {
      var on = b.getAttribute("data-tab") === name;
      b.setAttribute("aria-selected", on ? "true" : "false");
      b.tabIndex = on ? 0 : -1;
    });
    panels.forEach(function (p) { p.hidden = p.getAttribute("data-panel") !== name; });
    var titles = {
      materialy: T("Мої матеріали"),
      pokupky: T("Покупки"),
      profil: T("Профіль")
    };
    document.title = titles[name] + " — " + T("Мій кабінет") + " — Fika med Maria";
  }

  function goTab(name, focus) {
    if (window.location.hash !== "#" + name) {
      /* hashchange will call selectTab */
      window.location.hash = name;
    }
    selectTab(name);
    if (focus) { var b = $("#kb-tab-" + name); if (b) b.focus(); }
  }

  tabButtons.forEach(function (b, i) {
    b.addEventListener("click", function () { goTab(b.getAttribute("data-tab"), false); });
    b.addEventListener("keydown", function (e) {
      var j = null;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") j = (i + 1) % tabButtons.length;
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") j = (i - 1 + tabButtons.length) % tabButtons.length;
      else if (e.key === "Home") j = 0;
      else if (e.key === "End") j = tabButtons.length - 1;
      if (j == null) return;
      e.preventDefault();
      goTab(tabButtons[j].getAttribute("data-tab"), true);
    });
  });
  window.addEventListener("hashchange", function () { selectTab(tabFromHash()); });

  /* ---------------- Greeting ---------------- */
  function greet(profile, email) {
    var name = profile && profile.full_name ? String(profile.full_name).replace(/^\s+|\s+$/g, "").split(/\s+/)[0] : "";
    var h = $("#kb-greeting");
    h.textContent = T("Привіт, {name}!", { name: name || email || "" });
  }

  /* ---------------- Tab: materials ---------------- */
  var materialsBox = $("#kb-materials");

  function progressHtml(row) {
    var lt = row.lessons_total, bt = row.blocks_total;
    var html = "";
    if (lt > 0 || bt > 0) {
      var parts = [];
      if (lt > 0) parts.push(T("Уроків пройдено {done} з {total}", { done: row.lessons_done, total: lt }));
      if (bt > 0) parts.push(T("Вправ виконано {done} з {total}", { done: row.blocks_completed, total: bt }));
      var label = parts.join(" · ");
      var done = Math.min(row.lessons_done, lt) + Math.min(row.blocks_completed, bt);
      var total = lt + bt;
      var pct = total > 0 ? Math.round((done / total) * 100) : 0;
      html += '<div class="kb-progress">' +
        '<div class="pf-progress' + (pct >= 100 ? " is-done" : "") + '" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '" aria-label="' + esc(label) + '"><span style="width:' + pct + '%"></span></div>' +
        '<p class="pf-progress-label">' + esc(label) + "</p></div>";
    }
    /* work sent to Maria: waiting for her / already checked */
    var work = [];
    if (row.work_pending > 0) work.push('<span class="pf-badge">' + esc(T("Робіт на перевірці: {n}", { n: row.work_pending })) + "</span>");
    if (row.work_reviewed > 0) work.push('<span class="pf-badge is-ok">' + esc(T("Марія перевірила робіт: {n}", { n: row.work_reviewed })) + "</span>");
    if (work.length) html += '<p class="kb-work">' + work.join(" ") + "</p>";
    return html;
  }

  function accessText(row) {
    if (!row.expires_at) return T("Доступ: назавжди");
    var d = fmtDate(row.expires_at);
    return d ? T("Доступ: до {date}", { date: d }) : T("Доступ: назавжди");
  }

  function cardHtml(row, idx) {
    var kind = kindOf(row.kind);
    var href = page("kurs-kabinet.html?id=" + encodeURIComponent(row.slug));
    var cover = row.cover_path
      ? '<div class="kb-cover" data-cover="' + idx + '"><span class="kb-cover-ph" aria-hidden="true">' + kind.icon + "</span></div>"
      : '<div class="kb-cover"><span class="kb-cover-ph" aria-hidden="true">' + kind.icon + "</span></div>";
    return '<article class="kb-card pf-card">' + cover +
      '<div class="kb-card-body">' +
        '<span class="pf-badge is-blue">' + esc(kind.label) + "</span>" +
        '<h3 class="kb-card-title">' + esc(row.title) + "</h3>" +
        (row.short_description ? '<p class="kb-card-desc">' + esc(row.short_description) + "</p>" : "") +
        progressHtml(row) +
        '<p class="kb-access">' + esc(accessText(row)) + "</p>" +
        '<a class="btn btn-primary btn-sm kb-open" href="' + esc(href) + '">' + esc(T("Відкрити")) +
          '<span class="sr-only"> — ' + esc(row.title) + "</span></a>" +
      "</div></article>";
  }

  function loadCovers(rows) {
    all("[data-cover]", materialsBox).forEach(function (box) {
      var row = rows[Number(box.getAttribute("data-cover"))];
      if (!row || !row.cover_path) return;
      A.signedUrl(row.cover_path).then(function (u) {
        var img = new Image();
        img.alt = "";
        img.loading = "lazy";
        img.decoding = "async";
        img.onload = function () {
          box.innerHTML = "";
          box.appendChild(img);
          box.classList.add("has-img");
        };
        img.src = u; /* a failed load just keeps the soft placeholder */
      }, function () {});
    });
  }

  function emptyHtml() {
    return '<div class="pf-empty">' +
      '<div class="pf-big-ico" aria-hidden="true">☕</div>' +
      "<h3>" + esc(T("Тут зʼявляться твої курси й уроки після покупки")) + "</h3>" +
      "<p>" + esc(T("А поки що подивись безкоштовні матеріали або каталог курсів.")) + "</p>" +
      '<div class="pf-actions kb-empty-actions">' +
        '<a class="btn btn-primary" href="' + esc(url("bezkoshtovni.html")) + '">' + esc(T("Безкоштовні матеріали")) + "</a>" +
        '<a class="btn btn-ghost" href="' + esc(url("kursy.html")) + '">' + esc(T("Усі курси")) + "</a>" +
      "</div></div>";
  }

  function renderLibrary(rows) {
    materialsBox.setAttribute("aria-busy", "false");
    if (!rows.length) { materialsBox.innerHTML = emptyHtml(); return; }
    var html = "";
    var indexed = rows.map(function (r, i) { return { row: r, i: i }; });
    if (rows.length > 6) {
      var groups = {};
      indexed.forEach(function (x) {
        var k = kindOf(x.row.kind);
        var key = k.order + "|" + k.label;
        (groups[key] = groups[key] || { kind: k, items: [] }).items.push(x);
      });
      Object.keys(groups).sort(function (a, b) { return parseInt(a, 10) - parseInt(b, 10); }).forEach(function (key) {
        var g = groups[key];
        html += '<h2 class="kb-group">' + esc(g.kind.label) + "</h2>" +
          '<div class="pf-card-grid kb-grid">' + g.items.map(function (x) { return cardHtml(x.row, x.i); }).join("") + "</div>";
      });
    } else {
      html = '<div class="pf-card-grid kb-grid">' + indexed.map(function (x) { return cardHtml(x.row, x.i); }).join("") + "</div>";
    }
    materialsBox.innerHTML = html;
    loadCovers(rows);
  }

  function showLoadError(box, err, retry) {
    box.setAttribute("aria-busy", "false");
    box.innerHTML = '<div class="pf-empty"><h3>' + esc(T("Не вдалося завантажити")) + "</h3><p>" + esc(loadError(err)) + "</p>" +
      '<button class="btn btn-primary" type="button" data-retry>' + esc(T("Спробувати ще раз")) + "</button></div>";
    var b = $("[data-retry]", box);
    if (b) b.addEventListener("click", retry);
  }

  function handleSession(err) {
    if (err && err.code === "session_missing") { goLogin(); return true; }
    return false;
  }

  function loadLibrary() {
    materialsBox.setAttribute("aria-busy", "true");
    A.library().then(renderLibrary, function (err) {
      if (handleSession(err)) return;
      showLoadError(materialsBox, err, function () {
        materialsBox.innerHTML = '<p class="kb-loading">' + esc(T("Завантажую твої матеріали…")) + "</p>";
        loadLibrary();
      });
    });
  }

  /* ---------------- Tab: purchases ---------------- */
  var ordersBox = $("#kb-orders");

  function orderRow(o) {
    var st = STATUS[o.status] || { label: o.status || "—", cls: "is-muted" };
    var items = (o.items || []).map(function (it) {
      var q = it.quantity > 1 ? " × " + it.quantity : "";
      return "<li>" + esc(it.title || T("Матеріал")) + esc(q) + "</li>";
    }).join("");
    return "<tr>" +
      '<td data-label="' + esc(T("Дата")) + '">' + esc(fmtDate(o.paid_at || o.created_at)) + "</td>" +
      '<td data-label="' + esc(T("Що куплено")) + '"><ul class="kb-items">' + (items || "<li>—</li>") + "</ul></td>" +
      '<td data-label="' + esc(T("Сума")) + '" class="kb-amount">' + esc(fmtMoney(o.amount_total_cents, o.currency)) + "</td>" +
      '<td data-label="' + esc(T("Статус")) + '"><span class="pf-badge ' + st.cls + '">' + esc(st.label) + "</span></td>" +
      "</tr>";
  }

  function renderOrders(list) {
    ordersBox.setAttribute("aria-busy", "false");
    if (!list.length) {
      ordersBox.innerHTML = '<div class="pf-empty"><div class="pf-big-ico" aria-hidden="true">🧾</div>' +
        "<h3>" + esc(T("Покупок поки немає")) + "</h3>" +
        "<p>" + esc(T("Коли щось купиш, тут зʼявиться список із датами й сумами.")) + "</p></div>";
      return;
    }
    ordersBox.innerHTML = '<div class="pf-card kb-table-card"><table class="kb-table">' +
      "<caption class=\"sr-only\">" + esc(T("Мої покупки")) + "</caption>" +
      "<thead><tr><th scope=\"col\">" + esc(T("Дата")) + "</th><th scope=\"col\">" + esc(T("Що куплено")) +
      "</th><th scope=\"col\">" + esc(T("Сума")) + "</th><th scope=\"col\">" + esc(T("Статус")) + "</th></tr></thead>" +
      "<tbody>" + list.map(orderRow).join("") + "</tbody></table></div>";
  }

  function loadOrders() {
    ordersBox.setAttribute("aria-busy", "true");
    A.orders().then(renderOrders, function (err) {
      if (handleSession(err)) return;
      showLoadError(ordersBox, err, function () {
        ordersBox.innerHTML = '<p class="kb-loading">' + esc(T("Завантажую покупки…")) + "</p>";
        loadOrders();
      });
    });
  }

  /* ---------------- Tab: profile ---------------- */
  function initProfile(profile, email) {
    var form = $("#kb-profile-form");
    var name = $("#kb-name");
    var mail = $("#kb-email");
    var loc = $("#kb-locale");
    /* Language names stay in their own language («Українська» on every
       page), so the Ukrainian one is filled in here, not translated. */
    var native = loc && loc.querySelector("[data-native-name]");
    if (native) native.textContent = "\u0423\u043a\u0440\u0430\u0457\u043d\u0441\u044c\u043a\u0430";
    var msg = $('[data-msg="profile"]');
    var btn = $('button[type="submit"]', form);
    name.value = (profile && profile.full_name) || "";
    mail.value = (profile && profile.email) || email || "";
    loc.value = (profile && profile.locale) || "uk";
    if (!loc.value) loc.value = "uk";

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      setMsg(msg, "", "");
      busy(btn, true);
      A.updateProfile({ full_name: name.value, locale: loc.value }).then(function (p) {
        busy(btn, false);
        name.value = p.full_name || "";
        greet(p, email);
        setMsg(msg, "ok", T("Збережено."));
      }, function (err) {
        busy(btn, false);
        if (handleSession(err)) return;
        setMsg(msg, "error", loadError(err));
      });
    });

    /* password */
    var pwForm = $("#kb-password-form");
    var pw1 = $("#kb-pw1");
    var pw2 = $("#kb-pw2");
    var pwMsg = $('[data-msg="password"]');
    var pwBtn = $('button[type="submit"]', pwForm);
    var user = $("#kb-pw-username");
    if (user) user.value = mail.value;

    all("[data-toggle-pw]").forEach(function (b) {
      b.addEventListener("click", function () {
        var ids = (b.getAttribute("aria-controls") || "").split(/\s+/);
        var show = b.getAttribute("aria-pressed") !== "true";
        ids.forEach(function (id) { var inp = document.getElementById(id); if (inp) inp.type = show ? "text" : "password"; });
        b.setAttribute("aria-pressed", show ? "true" : "false");
        b.textContent = show ? T("Сховати") : T("Показати");
      });
    });

    pwForm.addEventListener("submit", function (e) {
      e.preventDefault();
      setMsg(pwMsg, "", "");
      mark(pw1, false); mark(pw2, false);
      if (pw1.value.length < 8) {
        mark(pw1, true); setMsg(pwMsg, "error", T("Пароль має бути щонайменше з 8 символів.")); pw1.focus(); return;
      }
      if (pw1.value !== pw2.value) {
        mark(pw2, true); setMsg(pwMsg, "error", T("Паролі не збігаються. Перевір, будь ласка.")); pw2.focus(); return;
      }
      busy(pwBtn, true);
      A.setPassword(pw1.value).then(function (r) {
        busy(pwBtn, false);
        if (r.ok) {
          pw1.value = ""; pw2.value = "";
          setMsg(pwMsg, "ok", T("Пароль змінено."));
          return;
        }
        if (r.code === "session_missing") { goLogin(); return; }
        setMsg(pwMsg, "error", PW_ERRORS[r.code] || PW_ERRORS.unknown);
        if (r.code === "weak_password") { mark(pw1, true); pw1.focus(); }
      });
    });

    /* sign out */
    var out = $("#kb-signout");
    out.addEventListener("click", function () {
      busy(out, true);
      A.signOut().then(function () { window.location.href = url("index.html"); });
    });
  }

  /* ---------------- Start ---------------- */
  function start(sess) {
    var email = (sess.user && sess.user.email) || "";
    var pageMsg = $("#kb-page-msg");

    greet(null, email);
    selectTab(tabFromHash());

    A.isAdmin().then(function (yes) {
      var a = $("#kb-admin");
      if (yes && a) { a.href = withDemo(I.asset ? I.asset("admin.html") : "admin.html"); /* the admin page exists only in Ukrainian, at the root */ a.hidden = false; }
    }, function () {});

    A.profile().then(function (p) {
      if (!p) { goLogin(); return; }
      greet(p, email);
      initProfile(p, email);
    }, function (err) {
      if (handleSession(err)) return;
      initProfile(null, email); /* the forms still work, the name stays empty */
      setMsg(pageMsg, "error", loadError(err));
    });

    loadLibrary();
    loadOrders();
  }

  A.session().then(function (s) {
    if (!s) { goLogin(); return; }
    start(s);
  }, goLogin);
})();
