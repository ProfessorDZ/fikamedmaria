/* =====================================================================
   Fika med Maria — thank-you page (dyakuyu.html).
   The page is mostly plain text. This script only makes the main button
   smart: someone who is already signed in goes straight to the cabinet,
   everybody else to the sign-in page. It also keeps ?demo=1 on the links.
   ===================================================================== */
(function () {
  "use strict";

  var A = window.FMMAccount;
  var I = window.FMMI18N || {};
  var T = window.T || function (s) { return String(s); };
  var btn = document.getElementById("pf-open");
  if (!A || !btn) return;

  function withDemo(href) {
    if (!A.isDemo()) return href;
    var parts = href.split("#");
    parts[0] += (parts[0].indexOf("?") > -1 ? "&" : "?") + "demo=1";
    return parts.join("#");
  }

  var links = document.querySelectorAll("a[href^='vkhid.html']");
  Array.prototype.forEach.call(links, function (a) {
    a.setAttribute("href", withDemo(I.url ? I.url(a.getAttribute("href")) : a.getAttribute("href")));
  });

  /* Only ask (and so load supabase-js) when this browser holds a saved login. */
  function hasSavedLogin() {
    try {
      for (var i = 0; i < window.localStorage.length; i++) {
        if (String(window.localStorage.key(i)).indexOf("sb-") === 0 && /-auth-token/.test(window.localStorage.key(i))) return true;
      }
    } catch (_) {}
    return false;
  }
  if (!A.isDemo() && !hasSavedLogin()) return;

  A.user().then(function (u) {
    if (!u) return;
    btn.setAttribute("href", withDemo(I.url ? I.url("kabinet.html") : "kabinet.html"));
    btn.textContent = T("Відкрити кабінет");
  });
})();
