/* =====================================================================
   Fika med Maria — data kit: cookie consent, dataLayer, forms, events.
   Loaded on every page between data.js and main.js. No dependencies.

   What leaves the browser, and when:
   * A form the visitor sends on purpose always goes to the database.
   * Page views, clicks and form-fill steps are recorded ONLY after the
     visitor allowed analytics in the cookie banner. Before that no
     visitor id is stored and nothing is sent.
   * Nothing is loaded from Google until gtmId below is a real id AND
     the visitor allowed analytics.
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
    noticeVersion: "2026-10-draft",
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

  var gtmLoaded = false;
  function allowGoogle() {
    /* Only analytics is ever granted: the site has no advertising purpose. */
    gtag("consent", "update", { analytics_storage: "granted" });
    if (!gtmEnabled || gtmLoaded) return;
    gtmLoaded = true;
    push({ "gtm.start": new Date().getTime(), event: "gtm.js" });
    var s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtm.js?id=" + encodeURIComponent(CONFIG.gtmId);
    document.head.appendChild(s);
  }

  /* ---------------- Consent state ---------------- */
  function storedConsent() {
    var c = readJson(lsGet("fmm_consent"), null);
    if (c && c.v === NOTICE && (c.analytics === "granted" || c.analytics === "denied")) return c.analytics;
    return null;
  }
  var consent = storedConsent(); // "granted" | "denied" | null (not asked yet)

  function hasConsent() { return consent === "granted"; }
  function saveConsent(value) {
    consent = value;
    lsSet("fmm_consent", JSON.stringify({ analytics: value, v: NOTICE, at: new Date().toISOString() }));
  }

  function visitorKey() { return hasConsent() ? lsGet("fmm_vid") : null; }
  function sessionKey() {
    if (!hasConsent()) return null;
    var s = ssGet("fmm_sid");
    if (!s) { s = uuid(); ssSet("fmm_sid", s); }
    return s;
  }
  function firstTouch() { return hasConsent() ? readJson(lsGet("fmm_first"), {}) : {}; }

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
    if (p.indexOf("/blog/") !== -1) return "blog_post";
    var f = p.split("/").pop().replace(/\.html$/, "");
    /* A language home page opened as "/sv" (no slash) is still the home page. */
    var langs = (window.FMMI18N && window.FMMI18N.langs) || [];
    for (var i = 0; i < langs.length; i++) { if (f === langs[i].code) f = ""; }
    var map = {
      "": "home", "index": "home", "kursy": "courses", "kurs": "course",
      "bezkoshtovni": "lessons", "urok": "lesson", "misyachnyk": "media",
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
     Two buttons of the same size and look: refusing must be as easy as
     allowing. Not modal: the page stays readable behind it. */
  var bannerEl = null;

  function el(tag, className, text) {
    var n = document.createElement(tag);
    if (className) n.className = className;
    if (text) n.textContent = text;
    return n;
  }

  function closeBanner() {
    if (bannerEl && bannerEl.parentNode) bannerEl.parentNode.removeChild(bannerEl);
    bannerEl = null;
  }

  function openBanner(reopened) {
    if (bannerEl || !document.body) return;

    var box = el("div", "fmm-consent");
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-label", T("Налаштування cookie"));
    box.setAttribute("data-fmm-consent", "");

    var body = el("div", "fmm-consent__body");
    body.appendChild(el("h2", "fmm-consent__title", T("Трохи про cookie")));
    body.appendChild(el("p", "fmm-consent__text", gtmEnabled
      ? T("Я хочу розуміти, які сторінки й уроки тобі корисні. Для цього сайт зберігає у твоєму браузері анонімний номер відвідувача й записує перегляди сторінок у мою базу даних і передає їх у Google Analytics. Це відбувається тільки з твоєї згоди. Змінити рішення можна будь-коли: «Налаштування cookie» внизу сторінки.")
      : T("Я хочу розуміти, які сторінки й уроки тобі корисні. Для цього сайт зберігає у твоєму браузері анонімний номер відвідувача й записує перегляди сторінок у мою базу даних. Це відбувається тільки з твоєї згоди. Змінити рішення можна будь-коли: «Налаштування cookie» внизу сторінки.")));
    if (CONFIG.privacyUrl) {
      var more = el("a", "fmm-consent__more", T("Докладніше"));
      more.href = CONFIG.privacyUrl;
      body.appendChild(more);
    }
    if (reopened && consent) {
      body.appendChild(el("p", "fmm-consent__state",
        consent === "granted" ? T("Зараз аналітику дозволено.") : T("Зараз аналітику вимкнено.")));
    }

    var actions = el("div", "fmm-consent__actions");
    var no = el("button", "btn btn-ghost btn-sm", T("Відмовитись"));
    no.type = "button";
    no.setAttribute("data-fmm-consent-deny", "");
    var yes = el("button", "btn btn-ghost btn-sm", T("Дозволити"));
    yes.type = "button";
    yes.setAttribute("data-fmm-consent-allow", "");
    no.addEventListener("click", deny);
    yes.addEventListener("click", allow);
    actions.appendChild(no);
    actions.appendChild(yes);

    box.appendChild(body);
    box.appendChild(actions);
    document.body.appendChild(box);
    bannerEl = box;
    if (reopened) { try { yes.focus(); } catch (_) {} }
  }

  function consentCall(state, key, keepalive) {
    var p = { purpose: "analytics", state: state, notice_version: NOTICE, page_path: pagePath() };
    if (key) p.visitor_key = key;
    rpc("record_consent", { p: p }, keepalive);
  }

  function allow() {
    if (consent === "granted" && lsGet("fmm_vid")) { closeBanner(); return; }
    saveConsent("granted");
    if (!lsGet("fmm_vid")) lsSet("fmm_vid", uuid());
    if (!ssGet("fmm_sid")) ssSet("fmm_sid", uuid());
    /* First touch is taken from this page: nothing was kept before consent. */
    if (!lsGet("fmm_first")) {
      lsSet("fmm_first", JSON.stringify(attributionFrom(window.location.href, document.referrer, window.location.hostname)));
    }
    consentCall("granted", lsGet("fmm_vid"), false);
    allowGoogle();
    closeBanner();
    recordPage();
  }

  function deny() {
    var vid = lsGet("fmm_vid");
    if (vid) {
      /* Analytics was allowed before: this is a withdrawal. The server wipes
         what it holds about this browser; the ids are removed here; the page
         reloads so an already loaded Google tag stops. */
      queue = [];
      consentCall("withdrawn", vid, true);
      lsDel("fmm_vid");
      lsDel("fmm_first");
      ssDel("fmm_sid");
      saveConsent("denied");
      gtag("consent", "update", { analytics_storage: "denied" });
      closeBanner();
      window.setTimeout(function () { window.location.reload(); }, 200);
      return;
    }
    if (consent === "denied") { closeBanner(); return; }
    saveConsent("denied");
    consentCall("denied", null, false); /* a refusal is logged without any identifier */
    closeBanner();
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
    allowGoogle();
  } else if (consent === null) {
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
