/* =====================================================================
   Fika med Maria — data kit: cookie consent, dataLayer, forms, events.
   Loaded on every page between data.js and main.js. No dependencies.

   What leaves the browser, and when:
   * A form the visitor sends on purpose always goes to the database.
   * Page views, clicks and form-fill steps are recorded ONLY after the
     visitor allowed analytics in the cookie banner. Before that no
     visitor id is stored and nothing is sent.
   * With analytics allowed, a form also carries the Google Analytics
     client id and session id, read from the _ga cookies at the moment
     the form is sent (null when there is no cookie).
   * With ads allowed (a separate choice in the banner), the browser keeps
     ad click ids, the Meta cookies _fbc/_fbp and a random ad key in
     localStorage ("fmm_ads"). A form then also carries them, and the
     server saves the visitor's full IP address with the submission for
     7 days. Without ads consent none of this is stored or sent, and
     withdrawing it deletes "fmm_ads".
   * These ids go to our own database only. Nothing is sent to Meta or
     Google yet, and the ids never enter the dataLayer or any event.
   * Nothing is loaded from Google until gtmId below is a real id AND
     the visitor allowed analytics or ads. Google consent mode is kept
     in step with the two choices.
   The file name is neutral on purpose: ad blockers block "tracking.js".
   ===================================================================== */
(function () {
  "use strict";

  /* ---------------- Config ---------------- */
  var CONFIG = {
    supabaseUrl: "https://svgqvvctlujameejtqnm.supabase.co",
    supabaseKey: "sb_publishable_rOBXp5RLteSyp9pHlX7EOA_5a09VsA0", // public by design: it can only call the four functions below
    gtmId: "GTM-XXXXXXX",      // PLACEHOLDER — nothing is loaded from Google until this is a real id
    ga4Id: "G-XXXXXXXXXX",     // PLACEHOLDER — for reference; the GA4 tag itself is set up inside GTM
    noticeVersion: "2026-11-draft",
    preselectOptional: true,   // first-time visitors see Analytics and Ads ticked in the banner settings; set false to start unticked
    privacyUrl: "",            // the privacy policy page does not exist yet; when empty, no link is shown
    telegramUrl: "https://t.me/MaryZubchenko",
    telegramHandle: "@MaryZubchenko",
    email: "fika.med.maria@gmail.com"
  };

  var gtmEnabled = /^GTM-[A-Z0-9]{4,}$/.test(CONFIG.gtmId) && CONFIG.gtmId !== "GTM-XXXXXXX";

  /* Banner and form texts in the page's language (assets/i18n.js). */
  var T = (window.FMMI18N && window.FMMI18N.T) || function (s) { return s; };
  /* The visitor is asked again on the day Google Analytics is really switched on. */
  var NOTICE = CONFIG.noticeVersion + (gtmEnabled ? "+ga" : "");

  /* ---------------- Storage (never throws) ---------------- */
  function lsGet(k) { try { return window.localStorage.getItem(k); } catch (_) { return null; } }
  function lsSet(k, v) { try { window.localStorage.setItem(k, v); return true; } catch (_) { return false; } }
  function lsDel(k) { try { window.localStorage.removeItem(k); } catch (_) {} }
  function ssGet(k) { try { return window.sessionStorage.getItem(k); } catch (_) { return null; } }
  function ssSet(k, v) { try { window.sessionStorage.setItem(k, v); } catch (_) {} }
  function ssDel(k) { try { window.sessionStorage.removeItem(k); } catch (_) {} }
  function readJson(raw, fallback) {
    try { var v = JSON.parse(raw); return v == null ? fallback : v; } catch (_) { return fallback; }
  }

  function clip(s, n) {
    s = String(s == null ? "" : s).replace(/^\s+|\s+$/g, "");
    return s.length > n ? s.slice(0, n) : s;
  }

  function uuid() {
    var c = window.crypto || window.msCrypto;
    try { if (c && typeof c.randomUUID === "function") return c.randomUUID(); } catch (_) {}
    var b = [], i;
    if (c && c.getRandomValues) {
      b = c.getRandomValues(new Uint8Array(16));
    } else {
      for (i = 0; i < 16; i++) b.push(Math.floor(Math.random() * 256));
    }
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    var hex = [];
    for (i = 0; i < 16; i++) hex.push((b[i] + 0x100).toString(16).slice(1));
    return hex.slice(0, 4).join("") + "-" + hex.slice(4, 6).join("") + "-" + hex.slice(6, 8).join("") + "-" +
      hex.slice(8, 10).join("") + "-" + hex.slice(10, 16).join("");
  }

  /* ---------------- Where requests go ----------------
     Always the real backend, except on a developer's own machine, where
     localStorage "fmm_dev_api" may point at a local mock server. Both the
     page and the mock must be local, so this cannot happen on a real site. */
  var apiBase = CONFIG.supabaseUrl;
  (function () {
    var h = window.location.hostname;
    if (h !== "localhost" && h !== "127.0.0.1") return;
    var dev = lsGet("fmm_dev_api");
    if (dev && /^http:\/\/(localhost|127\.0\.0\.1)(:\d{2,5})?$/.test(dev)) apiBase = dev;
  })();

  /* Resolves {ok, status, json}. Never rejects: a network failure is status 0. */
  function rpc(name, body, keepalive) {
    if (typeof window.fetch !== "function") return Promise.resolve({ ok: false, status: 0, json: null });
    var opts = {
      method: "POST",
      headers: { "apikey": CONFIG.supabaseKey, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    };
    if (keepalive) opts.keepalive = true;
    try {
      return window.fetch(apiBase + "/rest/v1/rpc/" + name, opts).then(function (res) {
        return res.text().then(function (t) {
          return { ok: res.ok, status: res.status, json: readJson(t, null) };
        }, function () {
          return { ok: res.ok, status: res.status, json: null };
        });
      }).catch(function () {
        return { ok: false, status: 0, json: null };
      });
    } catch (_) {
      return Promise.resolve({ ok: false, status: 0, json: null });
    }
  }

  /* ---------------- dataLayer and Google ----------------
     The dataLayer is only a local array. The consent default says "denied"
     for everything, and it is the first thing any Google tag would read. */
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  gtag("consent", "default", {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: "denied"
  });

  function push(obj) { try { window.dataLayer.push(obj); } catch (_) {} }

  /* Google consent mode follows the two banner choices:
     "analytics" -> analytics_storage
     "ads"       -> ad_storage, ad_user_data and ad_personalization
     Denial sets the same signals back to denied. */
  function googleSignals(purpose, value) {
    if (purpose === "ads") return { ad_storage: value, ad_user_data: value, ad_personalization: value };
    return { analytics_storage: value };
  }
  function allowGoogle(purpose) { gtag("consent", "update", googleSignals(purpose, "granted")); }
  function denyGoogle(purpose) { gtag("consent", "update", googleSignals(purpose, "denied")); }

  /* Called after the consent updates above, so a tag never sees stale signals.
     Loads once, and only when at least one purpose was granted. */
  var gtmLoaded = false;
  function loadGtm() {
    if (!gtmEnabled || gtmLoaded || !(hasConsent() || hasAdsConsent())) return;
    gtmLoaded = true;
    push({ "gtm.start": new Date().getTime(), event: "gtm.js" });
    var s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtm.js?id=" + encodeURIComponent(CONFIG.gtmId);
    document.head.appendChild(s);
  }

  /* ---------------- Consent state ---------------- */
  /* fmm_consent = {analytics, ads, v, at}. A record from another notice
     version, or one missing a purpose, counts as "not asked yet". */
  function storedConsent() {
    var c = readJson(lsGet("fmm_consent"), null);
    var ok = function (x) { return x === "granted" || x === "denied"; };
    if (c && typeof c === "object" && c.v === NOTICE && ok(c.analytics) && ok(c.ads)) {
      return { analytics: c.analytics, ads: c.ads };
    }
    return null;
  }
  var storedChoice = storedConsent();
  var consent = storedChoice ? storedChoice.analytics : null;    // "granted" | "denied" | null (not asked yet)
  var adsConsent = storedChoice ? storedChoice.ads : null;       // same values, for the ads purpose

  function hasConsent() { return consent === "granted"; }
  function hasAdsConsent() { return adsConsent === "granted"; }
  function saveConsent(analytics, ads) {
    consent = analytics;
    adsConsent = ads;
    lsSet("fmm_consent", JSON.stringify({ analytics: analytics, ads: ads, v: NOTICE, at: new Date().toISOString() }));
  }

  function visitorKey() { return hasConsent() ? lsGet("fmm_vid") : null; }
  function sessionKey() {
    if (!hasConsent()) return null;
    var s = ssGet("fmm_sid");
    if (!s) { s = uuid(); ssSet("fmm_sid", s); }
    return s;
  }
  function firstTouch() { return hasConsent() ? readJson(lsGet("fmm_first"), {}) : {}; }

  /* ---------------- Ad and Google Analytics identifiers ----------------
     Kept so a server can later report a lead to Meta (Conversions API) and
     to Google (GA4 Measurement Protocol). Nothing is sent from here: these
     ids go only into the form payload, never into the dataLayer, an event
     or the console.
     * Ad ids need ADS consent. They live in localStorage "fmm_ads":
       {key, gclid, gbraid, wbraid, fbclid, msclkid, ttclid, fbc, fbp, at}
       and are removed when ads consent is withdrawn.
     * Google Analytics ids need ANALYTICS consent. They are only read
       from Google's own cookies at the moment a form is sent. */
  var CLICK_IDS = ["gclid", "gbraid", "wbraid", "fbclid", "msclkid", "ttclid"];
  var AD_ID_RE = /^[A-Za-z0-9._-]+$/;
  var CLICK_ID_MAX_AGE = 90 * 24 * 60 * 60 * 1000;

  function readCookies() {
    var out = {};
    try {
      var parts = String(document.cookie || "").split(";");
      for (var i = 0; i < parts.length; i++) {
        var eq = parts[i].indexOf("=");
        if (eq < 1) continue;
        var name = parts[i].slice(0, eq).replace(/^\s+/, "");
        if (!Object.prototype.hasOwnProperty.call(out, name)) out[name] = parts[i].slice(eq + 1).replace(/\s+$/, "");
      }
    } catch (_) {}
    return out;
  }

  function randomDigits(n) {
    var c = window.crypto || window.msCrypto, s = "", i;
    var b = null;
    try { if (c && c.getRandomValues) b = c.getRandomValues(new Uint8Array(n)); } catch (_) {}
    for (i = 0; i < n; i++) s += String(b ? b[i] % 10 : Math.floor(Math.random() * 10));
    return s;
  }

  /* The saved ad record, or {} if there is none. Click ids older than 90 days
     are dropped here; the ad key and fbp stay. */
  function readAds() {
    var r = readJson(lsGet("fmm_ads"), null);
    if (!r || typeof r !== "object" || Object.prototype.toString.call(r) === "[object Array]") return {};
    var age = new Date().getTime() - Date.parse(r.at || "");
    if (!(age >= 0 && age < CLICK_ID_MAX_AGE)) {
      for (var i = 0; i < CLICK_IDS.length; i++) delete r[CLICK_IDS[i]];
      delete r.fbc;
      r.stale = true; // lets captureAds save the cleaned record
    }
    return r;
  }

  /* Stores what the ad platforms need. Does nothing without ads consent.
     Called when a page loads with consent, and right after it is granted. */
  function captureAds() {
    if (!hasAdsConsent()) return {};
    var rec = readAds();
    var now = new Date().getTime();
    var changed = false, newFbclid = null, i;
    if (!rec.key) { rec.key = uuid(); changed = true; }
    if (rec.stale) { delete rec.stale; changed = true; }

    var q = null;
    try { q = new URLSearchParams(window.location.search); } catch (_) {}
    var clickChanged = false;
    for (i = 0; q && i < CLICK_IDS.length; i++) {
      var v = clip(q.get(CLICK_IDS[i]) || "", 300);
      if (v && AD_ID_RE.test(v) && v !== rec[CLICK_IDS[i]]) {
        rec[CLICK_IDS[i]] = v;
        clickChanged = true;
        if (CLICK_IDS[i] === "fbclid") newFbclid = v;
      }
    }
    if (clickChanged) { rec.at = new Date(now).toISOString(); changed = true; }
    if (!rec.at) { rec.at = new Date(now).toISOString(); changed = true; }

    var cookies = readCookies();
    /* The cookie can still hold an older click: it counts only if it matches the latest fbclid. */
    var fbc = cookies._fbc ? clip(cookies._fbc, 300) : "";
    var fbcFits = !rec.fbclid || fbc.slice(-rec.fbclid.length) === rec.fbclid;
    if (fbc && AD_ID_RE.test(fbc) && fbcFits) {
      if (rec.fbc !== fbc) { rec.fbc = fbc; changed = true; }
    } else if (newFbclid) {
      rec.fbc = "fb.1." + now + "." + newFbclid;
      changed = true;
    }

    var fbp = cookies._fbp ? clip(cookies._fbp, 300) : "";
    if (fbp && AD_ID_RE.test(fbp)) {
      if (rec.fbp !== fbp) { rec.fbp = fbp; changed = true; }
    } else if (!rec.fbp) {
      rec.fbp = "fb.1." + now + "." + randomDigits(10);
      changed = true;
    }

    if (changed) {
      var out = { key: rec.key, at: rec.at };
      var names = CLICK_IDS.concat(["fbc", "fbp"]);
      for (i = 0; i < names.length; i++) out[names[i]] = rec[names[i]] || null;
      lsSet("fmm_ads", JSON.stringify(out));
      return out;
    }
    return rec;
  }

  function adKeyStored() {
    var k = readJson(lsGet("fmm_ads"), null);
    return k && typeof k.key === "string" && k.key ? k.key : null;
  }

  /* {gclid: "...", fbp: "..."}: only the ids that are set. {} without ads consent. */
  function adIds() {
    if (!hasAdsConsent()) return {};
    var rec = captureAds(), out = {}, names = CLICK_IDS.concat(["fbc", "fbp"]);
    for (var i = 0; i < names.length; i++) { if (rec[names[i]]) out[names[i]] = rec[names[i]]; }
    return out;
  }

  /* GA4 client id: the _ga cookie looks like GA1.1.<number>.<number>; the
     client id is the last two numbers. null without analytics consent. */
  function gaClientId() {
    if (!hasConsent()) return null;
    var m = /^GA\d+\.\d+\.(\d+\.\d+)$/.exec(readCookies()._ga || "");
    return m ? m[1] : null;
  }

  /* GA4 session id: cookie _ga_<measurement id without "G-">. Both formats
     are read: GS1.1.<session>.<n>... and GS2.1.s<session>$o1$g1... If the
     measurement id is still the placeholder, the first _ga_* cookie is used. */
  function gaSessionId() {
    if (!hasConsent()) return null;
    var cookies = readCookies(), re = /^GS\d+\.\d+\.s?(\d+)/, value = null, name;
    if (/^G-[A-Z0-9]{4,}$/.test(CONFIG.ga4Id) && CONFIG.ga4Id !== "G-XXXXXXXXXX") {
      value = cookies["_ga_" + CONFIG.ga4Id.replace(/^G-/, "")] || null;
    } else {
      for (name in cookies) {
        if (Object.prototype.hasOwnProperty.call(cookies, name) && name.indexOf("_ga_") === 0) { value = cookies[name]; break; }
      }
    }
    var m = value ? re.exec(value) : null;
    return m && m[1].length <= 20 ? m[1] : null;
  }

  /* ---------------- Attribution (pure) ----------------
     Where the visitor came from, without keeping any full address:
     only a source name, the referring host and the landing path. */
  function hostOf(url) { try { return new URL(url).hostname.toLowerCase(); } catch (_) { return ""; } }

  function attributionFrom(urlString, referrerString, siteHost) {
    var out = { source: "(direct)", medium: "(none)", campaign: "", content: "", term: "", referrer: "", landing_page: "/" };
    var u = null;
    try { u = new URL(urlString); } catch (_) {}
    var q = u ? u.searchParams : null;
    if (u) out.landing_page = clip(u.pathname, 300);
    var ref = referrerString ? hostOf(referrerString) : "";
    out.referrer = clip(ref, 200);

    function p(name) { return q ? clip(String(q.get(name) || "").toLowerCase(), 100) : ""; }

    if (p("utm_source")) {
      out.source = p("utm_source");
      out.medium = p("utm_medium") || "(not set)";
      out.campaign = p("utm_campaign");
      out.content = p("utm_content");
      out.term = p("utm_term");
      return out;
    }
    if (q && q.get("gclid")) { out.source = "google"; out.medium = "cpc"; return out; }
    if (!ref || ref === String(siteHost || "").toLowerCase()) return out;

    function has(part) { return ref.indexOf(part) !== -1; }
    var isTelegram = ref === "t.me" || /\.t\.me$/.test(ref) || has("telegram");
    var isFacebook = has("facebook") || ref.indexOf("fb.") === 0;

    if (has("instagram")) { out.source = "instagram"; out.medium = "social"; }
    else if (isTelegram) { out.source = "telegram"; out.medium = "social"; }
    else if (has("youtube") || has("youtu.be")) { out.source = "youtube"; out.medium = "social"; }
    else if (isFacebook) { out.source = "facebook"; out.medium = "social"; }
    else if (has("threads")) { out.source = "threads"; out.medium = "social"; }
    else if (has("google.")) { out.source = "google"; out.medium = "organic"; }
    else if (has("bing.")) { out.source = "bing"; out.medium = "organic"; }
    else if (has("duckduckgo")) { out.source = "duckduckgo"; out.medium = "organic"; }
    else if (has("yahoo.")) { out.source = "yahoo"; out.medium = "organic"; }
    else { out.source = clip(ref, 100); out.medium = "referral"; }
    return out;
  }

  /* ---------------- Page facts ---------------- */
  function pagePath() { return clip(window.location.pathname, 300); }

  function pageType() {
    var p = window.location.pathname.toLowerCase();
    /* 404.html is served at whatever address was missing, so the path says nothing. */
    if (document.body && document.body.getAttribute("data-page") === "notfound") return "not_found";
    if (p.indexOf("/blog/") !== -1) return "blog_post";
    var f = p.split("/").pop().replace(/\.html$/, "");
    /* A language home page opened as "/sv" (no slash) is still the home page. */
    var langs = (window.FMMI18N && window.FMMI18N.langs) || [];
    for (var i = 0; i < langs.length; i++) { if (f === langs[i].code) f = ""; }
    var map = {
      "": "home", "index": "home", "kursy": "courses", "kurs": "course",
      "gotovi-uroky": "lessons", "urok": "lesson", "misyachnyk": "media",
      "blog": "blog", "kontakty": "contact", "vykladacham": "teachers",
      "kurs-vykladacham": "teacher_course"
    };
    return Object.prototype.hasOwnProperty.call(map, f) ? map[f] : "other";
  }

  function deviceType() {
    var w = window.innerWidth || 0;
    if (!w) return "unknown";
    return w < 768 ? "mobile" : (w < 1100 ? "tablet" : "desktop");
  }

  function visitorInfo() {
    var f = firstTouch();
    return {
      source: f.source, medium: f.medium, campaign: f.campaign, content: f.content, term: f.term,
      referrer: f.referrer, landing_page: f.landing_page,
      device: deviceType(), language: clip(window.navigator.language || "", 20)
    };
  }

  /* ---------------- Events ----------------
     Without consent this does nothing at all. With consent an event goes to
     the dataLayer and into a small queue that is sent to the database in
     batches (and once more when the page is being left). */
  var queue = [];
  var retried = {};
  var flushTimer = null;

  function flush(keepalive) {
    if (!hasConsent() || !queue.length) return;
    var vk = visitorKey();
    if (!vk) return;
    var batch = queue.splice(0, 25);
    rpc("track", {
      p: { visitor_key: vk, session_key: sessionKey(), visitor: visitorInfo(), events: batch }
    }, keepalive).then(function (r) {
      if (!r.ok && hasConsent()) {
        /* One more try for each event, then it is let go. */
        var back = [];
        for (var i = 0; i < batch.length; i++) {
          if (!retried[batch[i].event_key]) { retried[batch[i].event_key] = true; back.push(batch[i]); }
        }
        queue = back.concat(queue).slice(0, 100);
      }
      if (queue.length) scheduleFlush();
    });
  }

  function scheduleFlush() {
    if (flushTimer) return;
    flushTimer = window.setTimeout(function () { flushTimer = null; flush(false); }, 4000);
  }

  function event(name, data) {
    try {
      if (!hasConsent()) return;
      data = data || {};
      var params = data.params || {};

      /* Google's own tag counts page views; a second one would double them. */
      if (name !== "page_view") {
        if (data.ecommerce) {
          push({ ecommerce: null });
          push({ event: name, ecommerce: data.ecommerce });
        } else {
          var dl = { event: name };
          for (var k in params) { if (Object.prototype.hasOwnProperty.call(params, k)) dl[k] = params[k]; }
          push(data.dl || dl);
        }
      }

      var e = {
        event_key: uuid(), name: name, ts: new Date().toISOString(),
        page_path: pagePath(), page_type: data.page_type || pageType(), params: params
      };
      var optional = ["item_slug", "value_cents", "currency", "attempt_key", "form_key", "field", "step"];
      for (var i = 0; i < optional.length; i++) {
        if (data[optional[i]] !== undefined && data[optional[i]] !== null) e[optional[i]] = data[optional[i]];
      }
      queue.push(e);
      if (queue.length > 100) queue.shift();
      if (queue.length >= 20) flush(false); else scheduleFlush();
    } catch (_) {}
  }

  /* Item events use Google's ecommerce shape. No value or currency: the site
     shows no prices for these items. */
  function itemEvent(name, listId, items, action) {
    var gaItems = [];
    for (var i = 0; i < items.length; i++) {
      gaItems.push({ item_id: items[i].id, item_name: items[i].name, item_category: items[i].cat, index: i });
    }
    var ecommerce = { items: gaItems };
    if (listId) ecommerce.item_list_id = listId;
    var data = { ecommerce: ecommerce, params: {} };
    if (listId) data.params.list = listId;
    if (name === "view_item_list") {
      data.params.count = items.length;
    } else if (items.length) {
      data.item_slug = clip(items[0].id, 80);
    }
    if (action) data.params.action = action;
    event(name, data);
  }

  function itemFrom(el) {
    return {
      id: clip(el.getAttribute("data-fmm-item"), 80),
      name: clip(el.getAttribute("data-fmm-name") || "", 120),
      cat: clip(el.getAttribute("data-fmm-cat") || "", 40)
    };
  }

  /* ---------------- The page itself ----------------
     main.js calls pageReady() once everything is rendered. If the visitor
     allows analytics later on the same page, the page is recorded then. */
  var pageReadyCalled = false;
  var pageRecorded = false;

  function recordPage() {
    if (pageRecorded || !pageReadyCalled || !hasConsent()) return;
    pageRecorded = true;

    event("page_view", { params: { title: clip(document.title, 120) } });

    var body = document.body;
    if (body && body.getAttribute("data-fmm-item")) {
      itemEvent("view_item", null, [itemFrom(body)]);
    } else if (pageType() === "teacher_course") {
      /* A fixed name: the page heading is translated on /sv/, /en/ and /pl/,
         and every other item keeps its Ukrainian name in analytics. */
      itemEvent("view_item", null, [{ id: "teacher-course", name: '[НЕ] називайте мене "пані вчителько"', cat: "teacher_course" }]);
    }

    var lists = {}, order = [];
    var marked = document.querySelectorAll("[data-fmm-item][data-fmm-list]");
    for (var i = 0; i < marked.length; i++) {
      var list = marked[i].getAttribute("data-fmm-list");
      var it = itemFrom(marked[i]);
      if (!lists[list]) { lists[list] = { seen: {}, items: [] }; order.push(list); }
      if (lists[list].seen[it.id] || lists[list].items.length >= 30) continue;
      lists[list].seen[it.id] = true;
      lists[list].items.push(it);
    }
    for (var j = 0; j < order.length; j++) itemEvent("view_item_list", order[j], lists[order[j]].items);
  }

  function pageReady() {
    pageReadyCalled = true;
    recordPage();
  }

  /* ---------------- Clicks, FAQ, filters ----------------
     One listener each for the whole page, so content that main.js renders
     later is covered too. They only call event(), which ignores everything
     until the visitor has allowed analytics. */
  function closest(el, selector) {
    return el && el.closest ? el.closest(selector) : null;
  }

  function placeOf(el) {
    if (closest(el, "header")) return "header";
    if (closest(el, "footer")) return "footer";
    return "page";
  }

  document.addEventListener("click", function (ev) {
    try {
      var t = ev.target;

      if (closest(t, "[data-fmm-cookie-settings]")) { openBanner(true); return; }
      if (closest(t, "[data-fmm-consent]")) return;

      if (closest(t, "[data-fmm-free-issue]")) event("free_issue_download", { params: {} });

      var marked = closest(t, "[data-fmm-item]");
      if (marked && marked.tagName !== "BODY") {
        itemEvent("select_item", marked.getAttribute("data-fmm-list") || null, [itemFrom(marked)],
          marked.getAttribute("data-fmm-action") || null);
      }

      var method = null;
      var copy = closest(t, "[data-copy-email]");
      var link = closest(t, "a[href]");
      if (copy) {
        method = "email_copy";
      } else if (link) {
        var href = String(link.getAttribute("href") || "");
        if (href.indexOf("mailto:") === 0) method = "email";
        else if (/^https?:\/\/(www\.)?t\.me\//i.test(href)) method = "telegram";
        else if (/^https?:\/\/(www\.)?instagram\.com/i.test(href)) method = "instagram";
      }
      if (method) event("contact_click", { params: { method: method, location: placeOf(copy || link) } });
    } catch (_) {}
  }, true);

  document.addEventListener("toggle", function (ev) {
    try {
      var d = ev.target;
      if (!d || d.tagName !== "DETAILS" || !d.open) return;
      if (d.hasAttribute("data-lang-switch")) return; /* the language menu is not an FAQ question */
      var s = d.querySelector("summary");
      event("faq_open", { params: { question: clip(s ? s.textContent : "", 80) } });
    } catch (_) {}
  }, true);

  document.addEventListener("change", function (ev) {
    try {
      var t = ev.target;
      if (!closest(t, "[data-resource-filters]")) return;
      var type = t.name === "filter-level" ? "level" : (t.name === "filter-topic" ? "topic" : null);
      if (!type) return;
      /* main.js applies the filter in its own change handler; count after it. */
      window.setTimeout(function () {
        var cards = document.querySelectorAll(".resource-card"), shown = 0;
        for (var i = 0; i < cards.length; i++) { if (cards[i].style.display !== "none") shown++; }
        event("catalog_filter", { params: { filter_type: type, value: clip(t.value, 60), checked: !!t.checked, results: shown } });
      }, 0);
    } catch (_) {}
  });

  /* Send what is waiting when the page is being left. */
  window.addEventListener("pagehide", function () { flush(true); });
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") flush(true);
  });

  /* ---------------- Form-fill steps ----------------
     Which fields were reached, never what was typed. Nothing is recorded
     before consent; if consent comes while the form is being filled, the
     attempt starts at the next interaction (no backfill). */
  var watched = [];

  function watchedState(form) {
    for (var i = 0; i < watched.length; i++) { if (watched[i].form === form) return watched[i]; }
    return null;
  }

  function fieldNames(form) {
    var names = [];
    for (var i = 0; i < form.elements.length; i++) {
      var el = form.elements[i];
      var type = String(el.type || "").toLowerCase();
      if (!el.name || el.name === "website") continue;
      if (type === "submit" || type === "button" || type === "reset") continue;
      if (names.indexOf(el.name) === -1) names.push(el.name);
    }
    return names;
  }

  function watchForm(form, formKey) {
    if (!form || watchedState(form)) return;
    var st = { form: form, formKey: formKey, key: null, done: {} };
    watched.push(st);

    function started() {
      if (!hasConsent()) return false;
      if (!st.key) {
        st.key = uuid();
        st.done = {};
        event("lead_form_start", { attempt_key: st.key, form_key: formKey, params: {} });
      }
      return true;
    }
    function okName(name) { return /^[a-z][a-z0-9_]{0,39}$/.test(name) && name !== "website"; }

    form.addEventListener("focusin", function () { started(); });

    form.addEventListener("change", function (ev) {
      var el = ev.target;
      if (!el || !el.name || !okName(el.name)) return;
      if (String(el.value == null ? "" : el.value).replace(/\s/g, "") === "") return;
      if (!started() || st.done[el.name]) return;
      st.done[el.name] = true;
      event("lead_form_step", {
        attempt_key: st.key, form_key: formKey, field: el.name,
        step: fieldNames(form).indexOf(el.name) + 1, params: {}
      });
    });

    form.addEventListener("invalid", function (ev) {
      var el = ev.target;
      if (!el || !el.name || !okName(el.name) || !started()) return;
      event("lead_form_error", { attempt_key: st.key, form_key: formKey, field: el.name, params: {} });
    }, true);

    form.addEventListener("click", function (ev) {
      if (!closest(ev.target, 'button[type="submit"], button:not([type]), input[type="submit"]')) return;
      if (!started()) return;
      event("lead_form_submit_attempt", { attempt_key: st.key, form_key: formKey, params: {} });
    });
  }

  function attemptKey(form) {
    var st = watchedState(form);
    return st && st.key && hasConsent() ? st.key : null;
  }

  function resetForm(form) {
    var st = watchedState(form);
    if (st) { st.key = null; st.done = {}; }
  }

  /* ---------------- Forms ----------------
     A request is first saved in this browser (the "outbox"), then sent. If
     sending fails for a passing reason it stays saved and is retried, here
     and on the next page the visitor opens. The server ignores a repeat of
     the same submission, so retrying is always safe. */
  var LIVE_FORMATS = ["indyvidualni-zanyattya", "parni-zanyattya", "sprakkafe", "knyzhkovyi-klub"];
  var LEVELS = ["zero", "a1_a2", "b1_b2", "b2_plus", "unknown"];
  var pushedLeads = {};

  function readOutbox() {
    var a = readJson(lsGet("fmm_outbox"), []);
    return Object.prototype.toString.call(a) === "[object Array]" ? a : [];
  }
  function writeOutbox(a) { return lsSet("fmm_outbox", JSON.stringify(a.slice(-20))); }
  function inOutbox(key) {
    var box = readOutbox();
    for (var i = 0; i < box.length; i++) {
      if (box[i] && box[i].payload && box[i].payload.submission_key === key) return true;
    }
    return false;
  }
  function removeFromOutbox(key) {
    var box = readOutbox(), rest = [];
    for (var i = 0; i < box.length; i++) {
      if (box[i] && box[i].payload && box[i].payload.submission_key !== key) rest.push(box[i]);
    }
    writeOutbox(rest);
  }

  /* What the dataLayer event needs. Never the name, email or message. */
  function leadInfo(fields) {
    var goal = String(fields.goal || "");
    var info = { lead_type: "other" };
    if (LIVE_FORMATS.indexOf(goal) !== -1) { info.lead_type = "live_lessons"; info.item_id = goal; }
    else if (goal === "consultation") info.lead_type = "consultation";
    else if (goal === "teacher_collab") info.lead_type = "teacher_collab";
    else if (/^[a-z0-9]+(-[a-z0-9]+)*$/.test(goal) && goal.length <= 80) { info.lead_type = "product_question"; info.item_id = goal; }
    if (LEVELS.indexOf(String(fields.level || "")) !== -1) info.swedish_level = fields.level;
    if (hasConsent() && firstTouch().source) info.lead_source = firstTouch().source;
    return info;
  }

  /* The server confirmed the request: forget the saved copy and tell the
     dataLayer, once. */
  function confirmLead(entry) {
    var key = entry.payload.submission_key;
    removeFromOutbox(key);
    if (entry.payload.form_key !== "contact" || pushedLeads[key]) return;
    pushedLeads[key] = true;
    var lead = entry.lead || {};
    var dl = { event: "generate_lead", event_id: "lead:" + key, form_id: entry.payload.form_key };
    var keys = ["lead_type", "item_id", "swedish_level", "lead_source"];
    for (var i = 0; i < keys.length; i++) { if (lead[keys[i]]) dl[keys[i]] = lead[keys[i]]; }
    push(dl);
  }

  /* "sent", "retry" (a passing problem) or "rejected" (will never succeed). */
  function sendEntry(entry, keepalive) {
    return rpc("submit_form", { p: entry.payload }, keepalive).then(function (r) {
      if (r.ok) { confirmLead(entry); return "sent"; }
      var code = r.json && r.json.code;
      if (r.status === 0 || r.status >= 500 || r.status === 429 || code === "P0001") return "retry";
      removeFromOutbox(entry.payload.submission_key);
      return "rejected";
    });
  }

  function retryLater(entry, delays) {
    if (!delays.length) return;
    window.setTimeout(function () {
      if (!inOutbox(entry.payload.submission_key)) return;
      sendEntry(entry, false).then(function (result) {
        if (result === "retry") retryLater(entry, delays.slice(1));
      });
    }, delays[0]);
  }

  function submitForm(formKey, fields, extra) {
    try {
      fields = fields || {};
      extra = extra || {};
      var granted = hasConsent();
      var adsOn = hasAdsConsent();
      var ads = adsOn ? captureAds() : {};

      var offer = "";
      try { offer = new URLSearchParams(window.location.search).get("offer") || ""; } catch (_) {}
      var path = pagePath();
      if (/^[a-z0-9_]+(-[a-z0-9]+)*$/.test(offer) && offer.length <= 80) path += "?offer=" + offer;

      var entry = {
        payload: {
          submission_key: uuid(),
          form_key: String(formKey),
          fields: fields,
          page_path: path,
          referrer: document.referrer ? hostOf(document.referrer) : "",
          attribution: granted ? firstTouch() : {},
          visitor_key: granted ? visitorKey() : null,
          session_key: granted ? sessionKey() : null,
          attempt_key: granted && extra.attempt_key ? String(extra.attempt_key) : null,
          ga_client_id: granted ? gaClientId() : null,
          ga_session_id: granted ? gaSessionId() : null,
          ads_consent: adsOn,
          ad_key: adsOn && ads.key ? ads.key : null,
          ad_ids: adsOn ? adIds() : {},
          privacy_notice_version: CONFIG.noticeVersion,
          marketing_opt_in: false,
          hp: String(extra.hp == null ? "" : extra.hp),
          elapsed_ms: typeof extra.elapsed_ms === "number" && isFinite(extra.elapsed_ms) ? Math.round(extra.elapsed_ms) : null
        },
        queued_at: new Date().toISOString(),
        lead: leadInfo(fields)
      };

      var box = readOutbox();
      box.push(entry);
      var saved = writeOutbox(box) && inOutbox(entry.payload.submission_key);

      return sendEntry(entry, true).then(function (result) {
        if (result === "sent" || result === "rejected") return result;
        /* Not sent. Promise a retry only if the copy really is saved here. */
        if (!saved) return "rejected";
        retryLater(entry, [3000, 10000, 30000]);
        return "queued";
      });
    } catch (_) {
      return Promise.resolve("rejected");
    }
  }

  /* On every page: send whatever an earlier page could not. */
  function drainOutbox() {
    var now = new Date().getTime(), box = readOutbox(), keep = [];
    for (var i = 0; i < box.length; i++) {
      var e = box[i];
      if (!e || !e.payload || !e.payload.submission_key) continue;
      var age = now - Date.parse(e.queued_at || "");
      if (age >= 0 && age < 30 * 24 * 60 * 60 * 1000) keep.push(e);
    }
    if (keep.length !== box.length) writeOutbox(keep);
    var n = 0;
    function next() {
      if (n >= keep.length) return;
      var entry = keep[n++];
      if (!inOutbox(entry.payload.submission_key)) { next(); return; }
      sendEntry(entry, false).then(function () { window.setTimeout(next, 1000); });
    }
    next();
  }
  window.setTimeout(drainOutbox, 1500);

  /* ---------------- Cookie banner ----------------
     Two layers in one box. Not modal: the page stays readable behind it, and
     ignoring it keeps consent unset, so nothing is tracked.
     Layer 1: the explanation and two buttons of the same size and look,
       "Налаштувати" and "Дозволити все". There is no refuse button here.
     Layer 2: one row per purpose, each with a checkbox, a label and a short
       description, and "Зберегти вибір". "Необхідні" is ticked and locked;
       "Аналітика" and "Реклама" are separate and optional.
     The boxes start ticked for a first-time visitor when
     CONFIG.preselectOptional is true, unless the browser sends the Global
     Privacy Control signal; a saved choice is always shown as it was saved.
     The footer link (data-fmm-cookie-settings) opens layer 2 directly, which
     is how a visitor withdraws a choice. Both layers end in applyChoice(). */
  var bannerEl = null;
  var bannerLayer = 0;

  function el(tag, className, text) {
    var n = document.createElement(tag);
    if (className) n.className = className;
    if (text) n.textContent = text;
    return n;
  }

  function closeBanner() {
    if (bannerEl && bannerEl.parentNode) bannerEl.parentNode.removeChild(bannerEl);
    bannerEl = null;
    bannerLayer = 0;
  }

  /* What the two optional boxes show when layer 2 opens. */
  function optionalDefaults() {
    if (consent !== null) return { analytics: hasConsent(), ads: hasAdsConsent() };
    if (!CONFIG.preselectOptional || window.navigator.globalPrivacyControl === true) {
      return { analytics: false, ads: false };
    }
    return { analytics: true, ads: true };
  }

  function focusNode(node) {
    if (!node) return;
    try { node.focus(); } catch (_) {}
  }

  function firstLayer(box, moveFocus) {
    var body = el("div", "fmm-consent__body");
    var title = el("h2", "fmm-consent__title", T("Трохи про cookie"));
    title.tabIndex = -1;
    body.appendChild(title);
    body.appendChild(el("p", "fmm-consent__text",
      T("Я хочу розуміти, які сторінки й уроки тобі корисні, і показувати рекламу тим, кому вона справді цікава. Для цього сайт зберігає у твоєму браузері номер відвідувача й може передавати дані про відвідування та заявки в Google і Meta. Змінити вибір можна будь-коли: «Налаштування cookie» внизу сторінки.")));
    if (CONFIG.privacyUrl) {
      var more = el("a", "fmm-consent__more", T("Докладніше"));
      more.href = CONFIG.privacyUrl;
      body.appendChild(more);
    }

    var actions = el("div", "fmm-consent__actions");
    var settings = el("button", "btn btn-ghost btn-sm", T("Налаштувати"));
    settings.type = "button";
    settings.setAttribute("data-fmm-consent-settings", "");
    var all = el("button", "btn btn-ghost btn-sm", T("Дозволити все"));
    all.type = "button";
    all.setAttribute("data-fmm-consent-allow", "");
    settings.addEventListener("click", function () { showLayer(2, true); });
    all.addEventListener("click", function () { applyChoice(true, true); });
    actions.appendChild(settings);
    actions.appendChild(all);

    box.appendChild(body);
    box.appendChild(actions);
    /* The first layer appears on its own, so it must not take focus from the page. */
    if (moveFocus) focusNode(title);
  }

  function purposeRow(id, label, description, checked, locked) {
    var row = el("div", "fmm-consent__row");
    var input = document.createElement("input");
    input.type = "checkbox";
    input.id = "fmm-consent-" + id;
    input.checked = checked;
    if (locked) input.disabled = true;
    var text = el("div", "fmm-consent__rowtext");
    var lab = el("label", "fmm-consent__label", label);
    lab.setAttribute("for", input.id);
    var desc = el("p", "fmm-consent__desc", description);
    desc.id = "fmm-consent-" + id + "-desc";
    input.setAttribute("aria-describedby", desc.id);
    text.appendChild(lab);
    text.appendChild(desc);
    row.appendChild(input);
    row.appendChild(text);
    return { row: row, input: input };
  }

  function secondLayer(box, moveFocus) {
    var start = optionalDefaults();
    var body = el("div", "fmm-consent__body");
    var title = el("h2", "fmm-consent__title", T("Налаштування cookie"));
    title.tabIndex = -1;
    body.appendChild(title);

    var rows = el("div", "fmm-consent__rows");
    rows.setAttribute("role", "group");
    rows.setAttribute("aria-label", T("Налаштування cookie"));
    var need = purposeRow("necessary", T("Необхідні"),
      T("Запамʼятовують твій вибір щодо cookie. Завжди увімкнені."), true, true);
    var ana = purposeRow("analytics", T("Аналітика"),
      T("Перегляди сторінок, кліки й кроки заповнення форм у моїй базі даних і в Google Analytics."), start.analytics, false);
    var ads = purposeRow("ads", T("Реклама"),
      T("Рекламні мітки кліків і дані заявки, зокрема IP-адреса та зашифрований email, можуть передаватися в Meta і Google, щоб вимірювати рекламу."), start.ads, false);
    rows.appendChild(need.row);
    rows.appendChild(ana.row);
    rows.appendChild(ads.row);
    body.appendChild(rows);

    var actions = el("div", "fmm-consent__actions");
    var save = el("button", "btn btn-ghost btn-sm", T("Зберегти вибір"));
    save.type = "button";
    save.setAttribute("data-fmm-consent-save", "");
    save.addEventListener("click", function () { applyChoice(ana.input.checked, ads.input.checked); });
    actions.appendChild(save);

    box.appendChild(body);
    box.appendChild(actions);
    /* The heading names the new layer for a screen reader; Tab then reaches the first box. */
    if (moveFocus) focusNode(title);
  }

  /* Swaps the content of the same box. */
  function showLayer(layer, moveFocus) {
    if (!bannerEl) return;
    while (bannerEl.firstChild) bannerEl.removeChild(bannerEl.firstChild);
    bannerLayer = layer;
    bannerEl.setAttribute("data-fmm-layer", String(layer));
    if (layer === 2) secondLayer(bannerEl, moveFocus); else firstLayer(bannerEl, moveFocus);
  }

  /* reopened = true: the visitor asked for it (footer link), so show the
     settings layer straight away. Otherwise the explanation layer appears. */
  function openBanner(reopened) {
    if (!document.body) return;
    if (bannerEl) {
      if (reopened && bannerLayer !== 2) showLayer(2, true);
      return;
    }
    var box = el("div", "fmm-consent");
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-label", T("Налаштування cookie"));
    box.setAttribute("data-fmm-consent", "");
    document.body.appendChild(box);
    bannerEl = box;
    showLayer(reopened ? 2 : 1, !!reopened);
  }

  /* keepalive: the proof of a choice must arrive even if the visitor leaves the page at once. */
  function consentCall(purpose, state, key) {
    var p = { purpose: purpose, state: state, notice_version: NOTICE, page_path: pagePath() };
    if (key) p[purpose === "ads" ? "ad_key" : "visitor_key"] = key;
    rpc("record_consent", { p: p }, true);
  }

  /* A form still waiting in the outbox must not carry ids the visitor has
     since withdrawn. */
  function scrubOutbox(purpose) {
    var box = readOutbox();
    if (!box.length) return;
    for (var i = 0; i < box.length; i++) {
      var pl = box[i] && box[i].payload;
      if (!pl) continue;
      if (purpose === "ads") { pl.ads_consent = false; pl.ad_key = null; pl.ad_ids = {}; }
      else { pl.ga_client_id = null; pl.ga_session_id = null; }
    }
    writeOutbox(box);
  }

  /* The one place a choice is applied, from either layer. analytics and ads
     are booleans. Each purpose is logged only when its state really changes.
     A withdrawal wipes what was stored for that purpose; the page then
     reloads once, last, so an already loaded Google tag stops. */
  function applyChoice(wantAnalytics, wantAds) {
    var prevAnalytics = consent, prevAds = adsConsent;
    var vid = lsGet("fmm_vid"), adKey = adKeyStored();
    var reload = false, newAnalytics = false;

    saveConsent(wantAnalytics ? "granted" : "denied", wantAds ? "granted" : "denied");

    /* analytics */
    if (wantAnalytics) {
      if (!vid) { vid = uuid(); lsSet("fmm_vid", vid); }
      if (!ssGet("fmm_sid")) ssSet("fmm_sid", uuid());
      /* First touch is taken from this page: nothing was kept before consent. */
      if (!lsGet("fmm_first")) {
        lsSet("fmm_first", JSON.stringify(attributionFrom(window.location.href, document.referrer, window.location.hostname)));
      }
      if (prevAnalytics !== "granted") {
        consentCall("analytics", "granted", vid);
        newAnalytics = true;
      }
      allowGoogle("analytics");
    } else {
      denyGoogle("analytics");
      if (vid) {
        /* Analytics was allowed before: this is a withdrawal. The server wipes
           what it holds about this browser; the ids are removed here. */
        queue = [];
        consentCall("analytics", "withdrawn", vid);
        lsDel("fmm_vid");
        lsDel("fmm_first");
        ssDel("fmm_sid");
        scrubOutbox("analytics");
        reload = true;
      } else if (prevAnalytics !== "denied") {
        consentCall("analytics", "denied", null); /* a refusal is logged without any identifier */
      }
    }

    /* ads */
    if (wantAds) {
      var rec = captureAds();
      if (prevAds !== "granted") consentCall("ads", "granted", rec.key || null);
      allowGoogle("ads");
    } else {
      denyGoogle("ads");
      if (adKey) {
        consentCall("ads", "withdrawn", adKey);
        lsDel("fmm_ads");
        scrubOutbox("ads");
        reload = true;
      } else if (prevAds !== "denied") {
        consentCall("ads", "denied", null);
      }
    }

    closeBanner();
    if (reload) {
      window.setTimeout(function () { window.location.reload(); }, 200);
      return;
    }
    loadGtm();
    if (newAnalytics) recordPage();
  }

  /* ---------------- Purchases ----------------
     After paying, the buyer comes back to a page whose address carries
     ?session_id=cs_... The numbers come from the server, which also says
     whether this is the first time they are asked for — so the purchase
     reaches the dataLayer exactly once. */
  function reportPurchase() {
    var sid = "";
    try { sid = new URLSearchParams(window.location.search).get("session_id") || ""; } catch (_) {}
    if (!/^cs_[A-Za-z0-9_]{10,200}$/.test(sid)) return;
    var tries = 0;
    function ask() {
      tries++;
      rpc("purchase_for_datalayer", { p_session_id: sid }, false).then(function (r) {
        var d = r.ok ? r.json : null;
        if (d && typeof d === "object" && d.transaction_id) {
          if (d.push !== true) return;
          var mark = "fmm_purchase_" + d.transaction_id;
          if (ssGet(mark)) return;
          ssSet(mark, "1");
          push({ ecommerce: null });
          push({
            event: "purchase",
            ecommerce: { transaction_id: d.transaction_id, value: d.value, tax: d.tax, currency: d.currency, items: d.items || [] }
          });
          return;
        }
        /* The payment notice may still be on its way to the server. */
        if (tries < 6) window.setTimeout(ask, 2500);
      });
    }
    ask();
  }

  /* ---------------- Start ---------------- */
  function whenDomReady(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }

  if (consent === "granted") {
    /* Ids can be missing if the browser cleared part of its storage. */
    if (!lsGet("fmm_vid")) lsSet("fmm_vid", uuid());
    if (!lsGet("fmm_first")) {
      lsSet("fmm_first", JSON.stringify(attributionFrom(window.location.href, document.referrer, window.location.hostname)));
    }
    allowGoogle("analytics");
  }
  if (adsConsent === "granted") {
    captureAds();
    allowGoogle("ads");
  }
  loadGtm();
  if (consent === null) {
    /* A browser that sends the "do not sell or share" signal has already
       answered: stay off without asking. The footer link can still open
       the banner. */
    var optedOut = window.navigator.globalPrivacyControl === true && !lsGet("fmm_consent");
    if (!optedOut) whenDomReady(function () { openBanner(false); });
  }

  whenDomReady(function () {
    var line = document.getElementById("fmm-privacy-line");
    if (line && /^https?:\/\//i.test(CONFIG.privacyUrl)) {
      var a = el("a", "", T("Докладніше"));
      a.href = CONFIG.privacyUrl;
      line.appendChild(document.createTextNode(" "));
      line.appendChild(a);
    }
  });

  reportPurchase();

  var publicConfig = {
    telegramUrl: CONFIG.telegramUrl, telegramHandle: CONFIG.telegramHandle,
    email: CONFIG.email, privacyUrl: CONFIG.privacyUrl
  };
  if (Object.freeze) Object.freeze(publicConfig);

  window.FMMKit = {
    config: publicConfig,
    push: push,
    event: event,
    pageReady: pageReady,
    submitForm: submitForm,
    watchForm: watchForm,
    attemptKey: attemptKey,
    resetForm: resetForm,
    reportPurchase: reportPurchase,
    openCookieSettings: function () { openBanner(true); },
    _attributionFrom: attributionFrom
  };
})();
