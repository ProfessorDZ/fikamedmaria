/* =====================================================================
   Fika med Maria — sign-in page (vkhid.html).
   Three modes, chosen by the address:
     vkhid.html              sign in
     vkhid.html?mode=reset   ask for a link to make a new password
     vkhid.html?mode=set     arrived from the e-mail link: choose a password
                             (the link carries &token_hash=...&type=recovery;
                             it is exchanged once for a session and then
                             removed from the address bar)
   Optional: ?next=kurs-kabinet.html?id=... (a page of this site only) and
   ?email=... (fills the e-mail field). Needs assets/account.js.
   ===================================================================== */
(function () {
  "use strict";

  var A = window.FMMAccount;
  var I = window.FMMI18N || {};
  var T = window.T || function (s, v) {
    return String(s).replace(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g, function (m, k) { return v && v[k] != null ? v[k] : m; });
  };
  if (!A) return;

  /* An old-style dead e-mail link comes back as
     #error=access_denied&error_code=otp_expired ... (kept harmless). */
  var HASH_ERROR = /[#&]error(?:_code|_description)?=/.test(window.location.hash || "");

  function $(sel, root) { return (root || document).querySelector(sel); }
  function all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function param(name) {
    var m = new RegExp("[?&]" + name + "=([^&#]*)").exec(window.location.search);
    if (!m) return "";
    try { return decodeURIComponent(m[1].replace(/\+/g, " ")); } catch (_) { return ""; }
  }

  /* ---------------- Where to go after signing in ---------------- */
  function safeNext() {
    var n = param("next");
    if (!n || n.length > 200) return "";
    if (!/^[A-Za-z0-9_\-\/.]+\.html(\?[A-Za-z0-9_\-=&%.]*)?(#[A-Za-z0-9_\-=&%.]*)?$/.test(n)) return "";
    if (n.indexOf("//") > -1 || n.indexOf("..") > -1 || n.charAt(0) === "/") return "";
    return n;
  }

  function withDemo(href) {
    if (!A.isDemo()) return href;
    var parts = href.split("#");
    parts[0] += (parts[0].indexOf("?") > -1 ? "&" : "?") + "demo=1";
    return parts.join("#");
  }

  function destination() {
    var path = safeNext() || "kabinet.html";
    return withDemo(I.url ? I.url(path) : path);
  }

  /* ---------------- Little UI helpers ---------------- */
  var modes = all("[data-mode]");

  function showMode(name) {
    modes.forEach(function (el) { el.hidden = el.getAttribute("data-mode") !== name; });
    var titles = {
      login: T("Вхід у кабінет"),
      reset: T("Забула пароль?"),
      set: T("Створи пароль")
    };
    document.title = titles[name] + " — Fika med Maria";
  }

  function section(name) { return $('[data-mode="' + name + '"]'); }

  function setMsg(name, kind, text) {
    var el = $("[data-msg]", section(name));
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

  function looksLikeEmail(s) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 254; }

  var ERRORS = {
    invalid_credentials: T("Невірний email або пароль. Спробуй ще раз або натисни «Забула пароль?»."),
    email_not_confirmed: T("Цей email ще не підтверджено. Знайди мій лист і натисни кнопку в ньому."),
    rate_limited: T("Забагато спроб поспіль. Зачекай хвилинку й спробуй знову."),
    network: T("Немає звʼязку із сервером. Перевір інтернет і спробуй ще раз."),
    unknown: T("Щось пішло не так. Спробуй ще раз за хвилину."),
    invalid_email: T("Перевір email: здається, у ньому є помилка."),
    weak_password: T("Цей пароль надто простий. Додай більше символів, літери й цифри."),
    same_password: T("Такий пароль у тебе вже був. Придумай новий."),
    session_missing: T("Це посилання вже не діє.")
  };
  function errText(code) { return ERRORS[code] || ERRORS.unknown; }

  /* ---------------- Show / hide password ---------------- */
  all("[data-toggle-pw]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var ids = (btn.getAttribute("aria-controls") || "").split(/\s+/);
      var show = btn.getAttribute("aria-pressed") !== "true";
      ids.forEach(function (id) {
        var inp = document.getElementById(id);
        if (inp) inp.type = show ? "text" : "password";
      });
      btn.setAttribute("aria-pressed", show ? "true" : "false");
      btn.textContent = show ? T("Сховати") : T("Показати");
    });
  });

  /* ---------------- Mode: sign in ---------------- */
  function initLogin() {
    showMode("login");
    var form = $('[data-form="login"]');
    var email = $("#pf-login-email");
    var pw = $("#pf-login-pw");
    var btn = $('button[type="submit"]', form);
    var prefill = param("email");
    if (prefill && looksLikeEmail(prefill)) email.value = prefill;

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      setMsg("login", "", "");
      mark(email, false); mark(pw, false);
      var em = email.value.replace(/^\s+|\s+$/g, "");
      if (!looksLikeEmail(em)) {
        mark(email, true); setMsg("login", "error", ERRORS.invalid_email); email.focus(); return;
      }
      if (!pw.value) {
        mark(pw, true); setMsg("login", "error", T("Напиши пароль.")); pw.focus(); return;
      }
      busy(btn, true);
      A.signIn(em, pw.value).then(function (r) {
        if (r.ok) {
          setMsg("login", "ok", T("Вітаю! Відкриваю твій кабінет…"));
          window.location.href = destination();
          return;
        }
        busy(btn, false);
        setMsg("login", "error", errText(r.code));
        if (r.code === "invalid_credentials") { mark(pw, true); pw.value = ""; pw.focus(); }
      });
    });

    /* Already signed in? Straight to the cabinet. (Not in the demo: there the
       form is the thing to look at, and a link leads on to the sample cabinet.) */
    if (A.isDemo()) {
      var demoLink = $("[data-demo-link]");
      if (demoLink) {
        var a = $("a", demoLink);
        a.href = withDemo(I.url ? I.url("kabinet.html") : "kabinet.html");
        demoLink.hidden = false;
      }
      return;
    }
    A.user().then(function (u) { if (u) window.location.replace(destination()); });
  }

  /* ---------------- Mode: ask for a reset link ---------------- */
  function initReset(notice) {
    showMode("reset");
    var form = $('[data-form="reset"]');
    var email = $("#pf-reset-email");
    var btn = $('button[type="submit"]', form);
    var prefill = param("email");
    if (prefill && looksLikeEmail(prefill) && !email.value) email.value = prefill;
    if (notice) setMsg("reset", "info", notice);
    if (form.getAttribute("data-wired")) return;
    form.setAttribute("data-wired", "1");

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      setMsg("reset", "", "");
      mark(email, false);
      var em = email.value.replace(/^\s+|\s+$/g, "");
      if (!looksLikeEmail(em)) {
        mark(email, true); setMsg("reset", "error", ERRORS.invalid_email); email.focus(); return;
      }
      busy(btn, true);
      A.sendReset(em).then(function (r) {
        busy(btn, false);
        if (r.ok) {
          setMsg("reset", "ok", T("Готово! Якщо цей email є в моїй базі, лист із посиланням уже в дорозі. Перевір і папку «Спам»."));
        } else {
          setMsg("reset", "error", errText(r.code));
        }
      });
    });
  }

  /* ---------------- Mode: choose a password ---------------- */
  /* Take the one-time token out of the address bar (keeps mode=set, demo ...). */
  function stripTokenFromAddress() {
    try {
      var rest = (window.location.search || "").replace(/^\?/, "").split("&").filter(function (kv) {
        return kv && !/^(token_hash|type)=/.test(kv);
      });
      var url = window.location.pathname + (rest.length ? "?" + rest.join("&") : "") + (window.location.hash || "");
      window.history.replaceState(null, "", url);
    } catch (_) {}
  }

  function initSet() {
    showMode("set");
    var form = $('[data-form="set"]');
    var pw = $("#pf-set-pw");
    var pw2 = $("#pf-set-pw2");
    var btn = $('button[type="submit"]', form);
    var expired = T("Це посилання вже не діє (воно працює лише один раз і недовго). Напиши email, і я надішлю нове.");

    if (HASH_ERROR) { initReset(expired); return; }

    var tokenHash = param("token_hash");
    var linkType = param("type");
    var hasToken = !!tokenHash && linkType === "recovery";

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      setMsg("set", "", "");
      mark(pw, false); mark(pw2, false);
      if (pw.value.length < 8) {
        mark(pw, true); setMsg("set", "error", T("Пароль має бути щонайменше з 8 символів.")); pw.focus(); return;
      }
      if (pw.value !== pw2.value) {
        mark(pw2, true); setMsg("set", "error", T("Паролі не збігаються. Перевір, будь ласка.")); pw2.focus(); return;
      }
      busy(btn, true);
      A.setPassword(pw.value).then(function (r) {
        if (r.ok) {
          setMsg("set", "ok", T("Пароль збережено! Відкриваю твій кабінет…"));
          window.setTimeout(function () { window.location.href = withDemo(I.url ? I.url("kabinet.html") : "kabinet.html"); }, 1200);
          return;
        }
        busy(btn, false);
        if (r.code === "session_missing") { initReset(expired); return; }
        setMsg("set", "error", errText(r.code));
        if (r.code === "weak_password") { mark(pw, true); pw.focus(); }
      });
    });

    /* A usable link means a session now exists (made by verifyRecovery or an
       earlier visit); no session = a dead link. */
    function checkSession() {
      A.session().then(function (s) {
        if (!s) { initReset(expired); return; }
        var name = $("#pf-set-username");
        if (name && s.user && s.user.email) name.value = s.user.email;
      });
    }

    if (!hasToken) { checkSession(); return; }

    /* The link's token is spent exactly once, then taken off the address. */
    busy(btn, true);
    setMsg("set", "info", T("Перевіряю посилання…"));
    A.verifyRecovery(tokenHash).then(function (r) {
      stripTokenFromAddress();
      if (r && r.ok) {
        busy(btn, false);
        setMsg("set", "", "");
        checkSession();
        return;
      }
      initReset(r && r.code === "network" ? errText("network") : expired);
    }, function () {
      stripTokenFromAddress();
      initReset(errText("unknown"));
    });
  }

  /* ---------------- Start ---------------- */
  var mode = param("mode");
  if (mode === "set") initSet();
  else if (mode === "reset") initReset();
  else initLogin();
})();
