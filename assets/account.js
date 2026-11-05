/* =====================================================================
   Fika med Maria — student account (window.FMMAccount).
   One place that talks to Supabase for the sign-in page, the cabinet,
   the course page and the admin page. Every method returns a Promise.
   * Real mode: supabase-js is loaded once, on demand, from
     FMM_PLATFORM.supabaseJs (assets/platform-config.js).
   * Demo mode (?demo=1, remembered for the tab; or localStorage
     fmm_demo = "1"): supabase-js is never loaded, everything answers
     from window.FMM_DEMO (assets/platform-demo.js). ?demo=0 switches it off.
   Sign-in methods never reject: they answer { ok, code }. Data methods
   (library, orders, product, saveBlockResult, submitWork ...) reject with an
   Error when something goes wrong; err.code is one of: network, rate_limited,
   session_missing, unknown (and, for submitWork, already_reviewed,
   empty_submission, too_many_files, file_too_large, no_access).
   Loaded after assets/i18n.js and assets/platform-config.js.
   ===================================================================== */
(function () {
  "use strict";

  var I = window.FMMI18N || {};
  var T = window.T || function (s, v) {
    return String(s).replace(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g, function (m, k) {
      return v && v[k] != null ? v[k] : m;
    });
  };
  var CFG = window.FMM_PLATFORM || {};

  /* ---------------- Small helpers (never throw) ---------------- */
  function ssGet(k) { try { return window.sessionStorage.getItem(k); } catch (_) { return null; } }
  function ssSet(k, v) { try { window.sessionStorage.setItem(k, v); } catch (_) {} }
  function ssDel(k) { try { window.sessionStorage.removeItem(k); } catch (_) {} }
  function lsGet(k) { try { return window.localStorage.getItem(k); } catch (_) { return null; } }
  function lsDel(k) { try { window.localStorage.removeItem(k); } catch (_) {} }

  function clone(x) { return x == null ? x : JSON.parse(JSON.stringify(x)); }
  function num(x) { var n = Number(x); return isFinite(n) ? n : 0; }
  function byPosition(a, b) { return (num(a.position) - num(b.position)) || (num(a.id) - num(b.id)); }
  function ok(extra) {
    var o = { ok: true };
    if (extra) { for (var k in extra) { if (Object.prototype.hasOwnProperty.call(extra, k)) o[k] = extra[k]; } }
    return o;
  }
  function fail(code) { return { ok: false, code: code }; }
  function mkErr(e, code) {
    var er = new Error((e && e.message) || "error");
    er.code = code || authCode(e) || "unknown";
    return er;
  }

  /* ---------------- Demo switch ---------------- */
  function detectDemo() {
    var m = /[?&]demo=([^&#]*)/.exec(window.location ? window.location.search : "");
    if (m) {
      if (m[1] === "0" || m[1] === "off") { ssDel("fmm_demo"); lsDel("fmm_demo"); ssDel("fmm_demo_out"); ssDel("fmm_demo_state"); return false; }
      ssSet("fmm_demo", "1");
      return true;
    }
    if (!onRealSite()) return true;
    return ssGet("fmm_demo") === "1" || lsGet("fmm_demo") === "1";
  }

  /* Anywhere but the real site (the preview link, a local file) there is no
     backend to talk to, so the cabinet always shows the sample. The real
     hosts are listed in platform-config.js (liveHosts); localhost is for
     testing against the real backend. */
  function onRealSite() {
    var cfg = window.FMM_PLATFORM || {};
    var host = (window.location && window.location.hostname) || "";
    if (!cfg.liveHosts) return true;
    if (host === "localhost" || host === "127.0.0.1") return true;
    var bare = host.replace(/^www\./, "");
    return cfg.liveHosts.indexOf(host) !== -1 || cfg.liveHosts.indexOf(bare) !== -1;
  }

  /* Hosts where "no backend, sample only" is expected: a local file, a local
     server, the Claude preview. Anywhere else the sample is a warning sign
     (the real custom domain may have been forgotten in liveHosts). */
  function isExpectedPreviewHost() {
    var host = ((window.location && window.location.hostname) || "").toLowerCase();
    return host === "" || host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host === "::1" ||
      /\.localhost$/.test(host) || /\.test$/.test(host) ||
      /(^|\.)(claude\.ai|claudeusercontent\.com|claude\.com|anthropic\.com)$/.test(host) ||
      (window.location && window.location.protocol === "file:");
  }
  var DEMO = detectDemo() && !!window.FMM_DEMO;
  if (DEMO && !onRealSite() && !isExpectedPreviewHost() && window.console && console.warn) {
    console.warn("[FMM] demo mode: host not in liveHosts (" + ((window.location && window.location.hostname) || "") +
      "). If this is the real site, add its address to liveHosts in assets/platform-config.js.");
  }
  var demoData = window.FMM_DEMO || null;

  /* Demo changes (results, sent work, ticks, profile) are kept in the fixtures
     in memory and copied into sessionStorage so they survive a page change. */
  var overlay = { results: {}, work: {}, done: {}, profile: null };
  function saveOverlay() { ssSet("fmm_demo_state", JSON.stringify(overlay)); }
  var SCORED = ["gap", "drag_words", "choice", "order_words", "order_sentences", "dropdown_gap", "truefalse", "table_fill", "match", "categorize"];
  var WORK_TYPES = ["open_answer", "student_file"];
  function eachBlock(prod, fn) {
    (prod.blocks || []).forEach(fn);
    prod.modules.forEach(function (m) { m.lessons.forEach(function (l) { (l.blocks || []).forEach(fn); }); });
  }
  function eachLesson(prod, fn) {
    prod.modules.forEach(function (m) { m.lessons.forEach(fn); });
  }
  if (DEMO) {
    try {
      var saved = JSON.parse(ssGet("fmm_demo_state") || "null");
      if (saved && typeof saved === "object") {
        overlay.results = saved.results || {};
        overlay.work = saved.work || {};
        overlay.done = saved.done || {};
        overlay.profile = saved.profile || null;
      }
    } catch (_) {}
    var pk = demoData.products || {};
    Object.keys(pk).forEach(function (slug) {
      var prod = pk[slug];
      prod.results = prod.results || {};
      prod.work = prod.work || {};
      eachBlock(prod, function (b) {
        if (overlay.results[b.id]) prod.results[b.id] = overlay.results[b.id];
        if (overlay.work[b.id]) prod.work[b.id] = overlay.work[b.id];
      });
      eachLesson(prod, function (l) { if (Object.prototype.hasOwnProperty.call(overlay.done, l.id)) l.done = !!overlay.done[l.id]; });
    });
    if (overlay.profile) {
      demoData.profile.full_name = overlay.profile.full_name;
      demoData.profile.locale = overlay.profile.locale;
    }
  }
  function demoIn() { return ssGet("fmm_demo_out") !== "1"; }

  /* The small ribbon shown on every page while the demo is on. Its look is
     set inline so it works even on a page without platform.css. */
  function showRibbon() {
    if (!DEMO || !window.document || !document.body || document.getElementById("pf-demo-ribbon")) return;
    var r = document.createElement("div");
    r.id = "pf-demo-ribbon";
    r.className = "pf-demo-ribbon";
    r.setAttribute("role", "note");
    r.textContent = T("Демо-режим: це приклад, справжні дані не показуються");
    r.style.cssText = "position:fixed;left:50%;bottom:12px;transform:translateX(-50%);z-index:900;" +
      "max-width:calc(100% - 24px);padding:.45rem .9rem;border-radius:999px;background:#20303f;color:#fff;" +
      "font:600 .8rem/1.3 Inter,system-ui,sans-serif;text-align:center;box-shadow:0 6px 18px -8px rgba(0,0,0,.5);" +
      "pointer-events:none";
    document.body.appendChild(r);
  }
  if (DEMO && window.document) {
    if (document.body) showRibbon();
    else document.addEventListener("DOMContentLoaded", showRibbon);
  }

  /* ---------------- Supabase client (real mode) ---------------- */
  var clientP = null;

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      if (window.supabase && window.supabase.createClient) { resolve(); return; }
      var s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error("network")); };
      document.head.appendChild(s);
    });
  }

  function ready() {
    if (DEMO) return Promise.resolve(null);
    if (!clientP) {
      clientP = loadScript(CFG.supabaseJs).then(function () {
        return window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey, {
          /* Never take a session from the address bar: a crafted link with
             #access_token=... would sign the visitor in as someone else.
             Password links are exchanged explicitly (verifyRecovery). */
          auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, flowType: "implicit" }
        });
      });
      clientP.catch(function () { clientP = null; }); // a failed load can be tried again
    }
    return clientP;
  }

  /* Supabase errors -> our short codes. */
  function authCode(err) {
    if (!err) return null;
    var c = String(err.code || "").toLowerCase();
    var m = String(err.message || "").toLowerCase();
    var n = String(err.name || "");
    var st = err.status;
    if (c === "invalid_credentials" || m.indexOf("invalid login credentials") > -1) return "invalid_credentials";
    if (c === "email_not_confirmed" || m.indexOf("email not confirmed") > -1) return "email_not_confirmed";
    if (st === 429 || c.indexOf("rate_limit") > -1 || m.indexOf("rate limit") > -1 || m.indexOf("too many") > -1) return "rate_limited";
    if (c === "same_password" || m.indexOf("different from the old password") > -1) return "same_password";
    if (c === "weak_password" || n === "AuthWeakPasswordError" || m.indexOf("password should be") > -1) return "weak_password";
    if (n === "AuthSessionMissingError" || c === "session_not_found" || c === "no_authorization" ||
        m.indexOf("session missing") > -1 || m.indexOf("auth session") > -1) return "session_missing";
    if (c === "validation_failed" && m.indexOf("email") > -1) return "invalid_email";
    if (n === "AuthRetryableFetchError" || st === 0 || m.indexOf("failed to fetch") > -1 ||
        m.indexOf("networkerror") > -1 || m.indexOf("network") > -1 || m.indexOf("load failed") > -1) return "network";
    return null;
  }

  function must(r) {
    if (r && r.error) throw mkErr(r.error);
    return r ? r.data : null;
  }

  function realSession() {
    return ready().then(function (c) {
      return c.auth.getSession().then(function (r) { return (r && r.data && r.data.session) || null; });
    });
  }

  /* ---------------- Public API: sign-in ---------------- */
  function session() {
    if (DEMO) {
      if (!demoIn()) return Promise.resolve(null);
      return Promise.resolve({ access_token: "demo", user: clone(demoData.user) });
    }
    return realSession().catch(function () { return null; });
  }

  function user() {
    return session().then(function (s) {
      return s && s.user ? { id: s.user.id, email: s.user.email || "" } : null;
    });
  }

  function signIn(email, password) {
    email = String(email == null ? "" : email).replace(/^\s+|\s+$/g, "");
    password = String(password == null ? "" : password);
    if (DEMO) {
      if (!email || !password || password === "wrong") return Promise.resolve(fail("invalid_credentials"));
      ssDel("fmm_demo_out");
      return Promise.resolve(ok());
    }
    if (!email || !password) return Promise.resolve(fail("invalid_credentials"));
    return ready().then(function (c) {
      return c.auth.signInWithPassword({ email: email, password: password });
    }).then(function (r) {
      if (r && r.error) {
        var code = authCode(r.error);
        return fail(code === "invalid_credentials" || code === "email_not_confirmed" || code === "rate_limited" || code === "network" ? code : "unknown");
      }
      return ok();
    }, function (e) {
      return fail(authCode(e) === "network" ? "network" : "unknown");
    });
  }

  function signOut() {
    if (DEMO) { ssSet("fmm_demo_out", "1"); return Promise.resolve(ok()); }
    return ready().then(function (c) { return c.auth.signOut(); }).then(function () { return ok(); }, function () {
      return ok(); // the local session is cleared by supabase-js anyway
    });
  }

  function resetRedirect() {
    var path = "vkhid.html?mode=set";
    var target = I.url ? I.url(path) : path;
    try { return new URL(target, window.location.href).href; } catch (_) { return target; }
  }

  function sendReset(email) {
    email = String(email == null ? "" : email).replace(/^\s+|\s+$/g, "");
    if (!email || email.indexOf("@") < 1) return Promise.resolve(fail("invalid_email"));
    if (DEMO) return Promise.resolve(ok());
    return ready().then(function (c) {
      return c.auth.resetPasswordForEmail(email, { redirectTo: resetRedirect() });
    }).then(function (r) {
      if (r && r.error) return fail(authCode(r.error) || "unknown");
      return ok();
    }, function (e) {
      return fail(authCode(e) || "unknown");
    });
  }

  /* Exchange the one-time token from a password link (vkhid.html?mode=set&
     token_hash=...&type=recovery) for a session. Answers { ok } or
     { ok:false, code: expired | invalid | network | unknown }. */
  function verifyRecovery(tokenHash) {
    tokenHash = String(tokenHash == null ? "" : tokenHash).replace(/^\s+|\s+$/g, "");
    if (!tokenHash || tokenHash.length > 512) return Promise.resolve(fail("invalid"));
    if (DEMO) return Promise.resolve(tokenHash === "expired" ? fail("expired") : ok());
    return ready().then(function (c) {
      return c.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" });
    }).then(function (r) {
      if (r && r.error) return fail(recoveryCode(r.error));
      return ok();
    }, function (e) {
      return fail(authCode(e) === "network" ? "network" : "unknown");
    });
  }

  function recoveryCode(err) {
    var c = String(err.code || "").toLowerCase();
    var m = String(err.message || "").toLowerCase();
    if (c === "otp_expired" || m.indexOf("expired") > -1) return "expired";
    var a = authCode(err);
    if (a === "network") return "network";
    if (a === "rate_limited") return "unknown";
    if (c === "validation_failed" || c === "bad_jwt" || m.indexOf("invalid") > -1 || m.indexOf("not found") > -1 ||
        err.status === 400 || err.status === 403 || err.status === 404 || err.status === 422) return "invalid";
    return "unknown";
  }

  function setPassword(pw) {
    pw = String(pw == null ? "" : pw);
    if (DEMO) {
      if (!demoIn()) return Promise.resolve(fail("session_missing"));
      if (pw.length < 8) return Promise.resolve(fail("weak_password"));
      if (pw === "samepassword") return Promise.resolve(fail("same_password"));
      return Promise.resolve(ok());
    }
    return ready().then(function (c) {
      return c.auth.updateUser({ password: pw });
    }).then(function (r) {
      if (r && r.error) return fail(authCode(r.error) || "unknown");
      return ok();
    }, function (e) {
      return fail(authCode(e) || "unknown");
    });
  }

  /* ---------------- Profile ---------------- */
  var LOCALES = ["uk", "sv", "en", "pl"];

  function normProfile(row, u) {
    row = row || {};
    return {
      id: row.id || (u && u.id) || "",
      email: row.email || (u && u.email) || "",
      full_name: row.full_name || "",
      locale: LOCALES.indexOf(row.locale) > -1 ? row.locale : "uk"
    };
  }

  function profile() {
    if (DEMO) return Promise.resolve(demoIn() ? clone(demoData.profile) : null);
    return user().then(function (u) {
      if (!u) return null;
      return ready().then(function (c) {
        return c.from("profiles").select("id,email,full_name,locale").eq("id", u.id).maybeSingle();
      }).then(function (r) {
        return normProfile(must(r), u);
      });
    });
  }

  function updateProfile(fields) {
    fields = fields || {};
    var patch = {};
    if (fields.full_name != null) patch.full_name = String(fields.full_name).replace(/^\s+|\s+$/g, "").slice(0, 120);
    if (fields.locale != null && LOCALES.indexOf(fields.locale) > -1) patch.locale = fields.locale;
    if (DEMO) {
      if (!demoIn()) return Promise.reject(mkErr(null, "session_missing"));
      if (patch.full_name != null) demoData.profile.full_name = patch.full_name;
      if (patch.locale != null) demoData.profile.locale = patch.locale;
      overlay.profile = { full_name: demoData.profile.full_name, locale: demoData.profile.locale };
      saveOverlay();
      return Promise.resolve(clone(demoData.profile));
    }
    return user().then(function (u) {
      if (!u) throw mkErr(null, "session_missing");
      if (!Object.keys(patch).length) return profile();
      return ready().then(function (c) {
        return c.from("profiles").update(patch).eq("id", u.id).select("id,email,full_name,locale").maybeSingle();
      }).then(function (r) {
        return normProfile(must(r), u);
      });
    });
  }

  /* ---------------- Library ---------------- */
  function normLibraryRow(r) {
    return {
      product_id: r.product_id, slug: r.slug, kind: r.kind, title: r.title,
      short_description: r.short_description || "", cover_path: r.cover_path || null,
      source: r.source || "purchase", granted_at: r.granted_at || null, expires_at: r.expires_at || null,
      lessons_total: num(r.lessons_total), lessons_done: num(r.lessons_done),
      blocks_total: num(r.blocks_total), blocks_completed: num(r.blocks_completed),
      work_pending: num(r.work_pending), work_reviewed: num(r.work_reviewed)
    };
  }

  function demoCounts(prod) {
    var c = { lessons_total: 0, lessons_done: 0, blocks_total: 0, blocks_completed: 0, work_pending: 0, work_reviewed: 0 };
    eachLesson(prod, function (l) { c.lessons_total++; if (l.done) c.lessons_done++; });
    eachBlock(prod, function (b) {
      var r = prod.results && prod.results[b.id], w = prod.work && prod.work[b.id];
      if (SCORED.indexOf(b.type) > -1) { c.blocks_total++; if (r && r.completed) c.blocks_completed++; }
      if (WORK_TYPES.indexOf(b.type) > -1 && w) { if (w.status === "reviewed") c.work_reviewed++; else c.work_pending++; }
    });
    return c;
  }

  function library() {
    if (DEMO) {
      if (!demoIn()) return Promise.reject(mkErr(null, "session_missing"));
      return Promise.resolve(demoData.library.map(function (row) {
        var out = clone(row);
        var prod = demoData.products[row.slug];
        if (prod) { var c = demoCounts(prod); for (var k in c) { out[k] = c[k]; } }
        return normLibraryRow(out);
      }));
    }
    return ready().then(function (c) {
      /* Magazine issues bought-for-everyone are granted on demand; a failure
         here must never hide the library. */
      var claim;
      try { claim = Promise.resolve(c.rpc("claim_my_issues")); } catch (e) { claim = Promise.reject(e); }
      return claim.then(function (r) {
        if (r && r.error && window.console && console.warn) console.warn("[FMM] claim_my_issues failed", r.error);
      }, function (e) {
        if (window.console && console.warn) console.warn("[FMM] claim_my_issues failed", e);
      }).then(function () { return c.rpc("my_library"); });
    }).then(function (r) {
      return (must(r) || []).map(normLibraryRow);
    });
  }

  /* ---------------- Orders ---------------- */
  function orders() {
    if (DEMO) {
      if (!demoIn()) return Promise.reject(mkErr(null, "session_missing"));
      return Promise.resolve(clone(demoData.orders));
    }
    return user().then(function (u) {
      if (!u) throw mkErr(null, "session_missing");
      return ready().then(function (c) {
        return c.from("orders")
          .select("id,created_at,paid_at,status,amount_total_cents,currency,order_items(product_id,unit_amount_cents,quantity,products(title,kind))")
          .eq("user_id", u.id)
          .order("created_at", { ascending: false });
      });
    }).then(function (r) {
      return (must(r) || []).map(function (o) {
        return {
          id: o.id, created_at: o.created_at, paid_at: o.paid_at || null, status: o.status,
          amount_total_cents: o.amount_total_cents == null ? null : num(o.amount_total_cents),
          currency: o.currency || "EUR",
          items: (o.order_items || []).map(function (it) {
            var p = it.products || {};
            return {
              product_id: it.product_id, title: p.title || "", kind: p.kind || "",
              unit_amount_cents: it.unit_amount_cents == null ? null : num(it.unit_amount_cents),
              quantity: num(it.quantity) || 1
            };
          })
        };
      });
    });
  }

  /* ---------------- One product with its content ---------------- */
  function isAdmin() {
    if (DEMO) return Promise.resolve(demoIn() && !!demoData.admin);
    return user().then(function (u) {
      if (!u) return false;
      return ready().then(function (c) { return c.rpc("am_i_admin"); }).then(function (r) {
        return must(r) === true;
      });
    }).catch(function () { return false; });
  }

  function isObj(x) { return x !== null && typeof x === "object" && !Array.isArray(x); }
  function normBlock(b) {
    return { id: b.id, type: String(b.type || ""), position: num(b.position), content: isObj(b.content) ? b.content : {} };
  }
  function normResult(r) {
    return {
      best_score: num(r.best_score), last_score: num(r.last_score), max_score: num(r.max_score),
      attempts: num(r.attempts), completed: !!(r.completed === true || r.completed_at)
    };
  }
  function normWork(w) {
    w = w || {};
    return {
      status: w.status === "reviewed" ? "reviewed" : "submitted",
      text: w.text == null ? "" : String(w.text),
      files: (Array.isArray(w.files) ? w.files : []).filter(isObj).map(function (f) {
        return { path: String(f.path || ""), name: String(f.name || ""), size: num(f.size), type: String(f.type || "") };
      }),
      feedback: w.feedback == null ? "" : String(w.feedback),
      score: w.score == null ? null : num(w.score),
      reviewed_at: w.reviewed_at || null
    };
  }

  function realProduct(slug) {
    return ready().then(function (c) {
      return c.from("products")
        .select("id,slug,kind,title,short_description,description,cover_path")
        .eq("slug", String(slug)).maybeSingle().then(function (r) {
          var p = must(r);
          if (!p) return null;
          return Promise.all([library(), isAdmin(), user()]).then(function (a) {
            var has = a[0].some(function (row) { return String(row.product_id) === String(p.id); });
            if (!has && !a[1]) return null;
            return loadContent(c, p, a[2]);
          });
        });
    });
  }

  function loadContent(c, p, u) {
    return Promise.all([
      c.from("course_modules").select("id,title,position,course_lessons(id,title,summary,position)").eq("product_id", p.id),
      /* the database never sends a teacher note to a student */
      c.from("lesson_blocks").select("id,lesson_id,type,content,position").eq("product_id", p.id),
      c.from("block_results").select("block_id,best_score,last_score,max_score,attempts,completed_at").eq("user_id", u.id),
      c.from("block_work").select("block_id,text,files,status,feedback,score,reviewed_at").eq("user_id", u.id),
      c.from("lesson_progress").select("lesson_id").eq("user_id", u.id)
    ]).then(function (rs) {
      var mods = must(rs[0]) || [], rows = must(rs[1]) || [];
      var resRows = must(rs[2]) || [], workRows = must(rs[3]) || [], progRows = must(rs[4]) || [];
      var done = {}, byLesson = {}, rootBlocks = [], mine = {}, results = {}, work = {};
      progRows.forEach(function (x) { done[String(x.lesson_id)] = true; });

      rows.slice().sort(byPosition).forEach(function (r) {
        if (r.type === "teacher_note") return; /* never shown in the student cabinet, even to Maria */
        var b = normBlock(r);
        mine[String(b.id)] = true;
        if (r.lesson_id == null) rootBlocks.push(b);
        else (byLesson[String(r.lesson_id)] = byLesson[String(r.lesson_id)] || []).push(b);
      });
      resRows.forEach(function (x) { if (mine[String(x.block_id)]) results[String(x.block_id)] = normResult(x); });
      workRows.forEach(function (x) { if (mine[String(x.block_id)]) work[String(x.block_id)] = normWork(x); });

      var modules = mods.slice().sort(byPosition).map(function (m) {
        return {
          id: m.id, title: m.title || "", position: num(m.position),
          lessons: (m.course_lessons || []).slice().sort(byPosition).map(function (l) {
            return {
              id: l.id, title: l.title || "", summary: l.summary || "", position: num(l.position),
              done: !!done[String(l.id)],
              blocks: byLesson[String(l.id)] || []
            };
          })
        };
      });
      return {
        product: {
          id: p.id, slug: p.slug, kind: p.kind, title: p.title || "",
          short_description: p.short_description || "", description: p.description || "", cover_path: p.cover_path || null
        },
        modules: modules, blocks: rootBlocks, results: results, work: work
      };
    });
  }

  function product(slug) {
    if (DEMO) {
      if (!demoIn()) return Promise.reject(mkErr(null, "session_missing"));
      var p = demoData.products && demoData.products[String(slug)];
      return Promise.resolve(p ? clone(p) : null);
    }
    return user().then(function (u) {
      if (!u) throw mkErr(null, "session_missing");
      return realProduct(slug);
    });
  }

  /* ---------------- Files ---------------- */
  /* Demo only: a file that is not a picture of the site is made up on the
     spot (a short tone for sound, a tiny text for the rest), so players and
     download buttons have something real to open. */
  var demoBlobs = {};
  function demoTone() {
    var rate = 8000, n = rate * 2, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf), i;
    function w(o, t) { for (var k = 0; k < t.length; k++) v.setUint8(o + k, t.charCodeAt(k)); }
    w(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); w(8, "WAVE"); w(12, "fmt ");
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    w(36, "data"); v.setUint32(40, n * 2, true);
    for (i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.sin(i / rate * 2 * Math.PI * 440) * 3000 * (1 - i / n), true);
    return new Blob([buf], { type: "audio/wav" });
  }
  function demoFileUrl(path) {
    if (demoBlobs[path]) return demoBlobs[path];
    try {
      var blob;
      if (/\.(mp3|wav|m4a|ogg|webm|aac)$/i.test(path)) blob = demoTone();
      else if (/\.(pdf|txt|docx?|odt)$/i.test(path)) blob = new Blob(["Fika med Maria — demo\n"], { type: "text/plain" });
      if (blob) { demoBlobs[path] = URL.createObjectURL(blob); return demoBlobs[path]; }
    } catch (_) {}
    return null;
  }
  function demoAsset(path) {
    if (path && /^assets\//.test(path)) return I.asset ? I.asset(path) : path;
    var made = demoFileUrl(path);
    if (made) return made;
    var f = "assets/lessons/b1b2-lagom/worksheet.webp";
    return I.asset ? I.asset(f) : f;
  }

  function signedUrl(path) {
    path = String(path == null ? "" : path);
    if (!path) return Promise.reject(mkErr(null, "unknown"));
    if (DEMO) return Promise.resolve(demoAsset(path));
    /* Site files (covers in assets/...) and full links need no signing. */
    if (/^assets\//.test(path)) return Promise.resolve(I.asset ? I.asset(path) : path);
    if (/^https:\/\//i.test(path)) return Promise.resolve(path);
    return ready().then(function (c) {
      return c.storage.from("materials").createSignedUrl(path, 3600);
    }).then(function (r) {
      var d = must(r);
      if (!d || !d.signedUrl) throw mkErr(null, "unknown");
      return d.signedUrl;
    });
  }

  /* A file the student sent (private bucket student-work): a short-lived link. */
  function workFileUrl(path) {
    path = String(path == null ? "" : path);
    if (!path) return Promise.reject(mkErr(null, "unknown"));
    if (DEMO) return Promise.resolve(demoAsset(path));
    return ready().then(function (c) {
      return c.storage.from("student-work").createSignedUrl(path, 3600);
    }).then(function (r) {
      var d = must(r);
      if (!d || !d.signedUrl) throw mkErr(null, "unknown");
      return d.signedUrl;
    });
  }

  /* ---------------- Results and progress ---------------- */
  function clampInt(x, lo, hi) {
    x = Math.round(num(x));
    return x < lo ? lo : (x > hi ? hi : x);
  }

  function demoFindBlock(id) {
    var found = null;
    Object.keys(demoData.products).forEach(function (slug) {
      var prod = demoData.products[slug];
      eachBlock(prod, function (b) { if (String(b.id) === String(id)) found = { block: b, prod: prod }; });
    });
    return found;
  }

  /* Remember the result of a scored block (the student pressed «Перевірити»).
     Answers { best_score, last_score, max_score, attempts, completed }. */
  function saveBlockResult(blockId, res) {
    res = res || {};
    var max = clampInt(res.max, 1, 500);
    var score = clampInt(res.score, 0, max);
    if (DEMO) {
      var hit = demoFindBlock(blockId);
      if (!hit || SCORED.indexOf(hit.block.type) < 0) return Promise.reject(mkErr(null, "unknown"));
      var old = hit.prod.results[hit.block.id];
      var now = {
        best_score: Math.max(old ? old.best_score : 0, score),
        last_score: score,
        max_score: max,
        attempts: (old ? old.attempts : 0) + 1,
        completed: !!(old && old.completed) || score === max
      };
      hit.prod.results[hit.block.id] = now;
      overlay.results[hit.block.id] = now;
      saveOverlay();
      return Promise.resolve(clone(now));
    }
    var answers = res.answers == null ? null : res.answers;
    try { if (answers != null && JSON.stringify(answers).length > 18000) answers = null; } catch (_) { answers = null; }
    return ready().then(function (c) {
      return c.rpc("save_block_result", { p_block_id: blockId, p_score: score, p_max: max, p_answers: answers });
    }).then(function (r) {
      var d = must(r);
      if (Array.isArray(d)) d = d[0];
      return normResult(d || {});
    });
  }

  /* ---- Student work: an open answer or files for Maria to check ---- */
  var MAX_WORK_FILES = 5;
  var MAX_WORK_BYTES = 20 * 1024 * 1024;
  /* Extension -> type, for a file the browser gave no (or a useless) type. The
     bucket student-work takes exactly: audio/*, jpeg/png/webp/gif/heic, PDF,
     Word (doc, docx), ODT and plain text. */
  var EXT_TYPES = {
    mp3: "audio/mpeg", m4a: "audio/mp4", aac: "audio/aac", ogg: "audio/ogg", oga: "audio/ogg", opus: "audio/opus",
    wav: "audio/wav", flac: "audio/flac", webm: "audio/webm",
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", heic: "image/heic",
    pdf: "application/pdf", doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    odt: "application/vnd.oasis.opendocument.text", txt: "text/plain"
  };
  var OTHER_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "application/pdf", "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.oasis.opendocument.text", "text/plain"];
  var TYPE_EXT = { "audio/webm": "webm", "audio/mp4": "m4a", "audio/mpeg": "mp3", "audio/wav": "wav", "audio/ogg": "ogg", "audio/flac": "flac", "audio/aac": "aac", "image/jpeg": "jpg", "image/png": "png", "application/pdf": "pdf", "text/plain": "txt" };

  /* "audio/webm;codecs=opus" -> "audio/webm": the bucket wants a plain type.
     A sound saved by a browser as video/webm is a sound for us. A missing or
     "application/octet-stream" type is taken from the extension. */
  function plainType(file) {
    var t = String((file && file.type) || "").split(";")[0].replace(/^\s+|\s+$/g, "").toLowerCase();
    if (t === "video/webm") return "audio/webm";
    if (t && t !== "application/octet-stream") return t;
    var m = /\.([A-Za-z0-9]{1,8})$/.exec(String((file && file.name) || ""));
    return (m && EXT_TYPES[m[1].toLowerCase()]) || "application/octet-stream";
  }
  function typeAllowed(t) { return t.indexOf("audio/") === 0 || OTHER_TYPES.indexOf(t) > -1; }
  /* A storage-friendly name: letters, digits, dot, dash, underscore only. */
  function safeFileName(name, type) {
    name = String(name == null ? "" : name).split(/[\\/]/).pop();
    var dot = name.lastIndexOf("."), ext = dot > 0 ? name.slice(dot + 1) : "", base = dot > 0 ? name.slice(0, dot) : name;
    try { base = base.normalize("NFD").replace(/[̀-ͯ]/g, ""); } catch (_) {}
    base = base.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
    ext = ext.replace(/[^A-Za-z0-9]/g, "").toLowerCase().slice(0, 8);
    if (!base) base = "file";
    if (!ext) ext = TYPE_EXT[type] || "";
    return base + (ext ? "." + ext : "");
  }
  function workName(file, type) {
    var n = String((file && file.name) || "").split(/[\\/]/).pop();
    if (n) return n.slice(0, 200);
    return "recording" + (TYPE_EXT[type] ? "." + TYPE_EXT[type] : "");
  }
  var WORK_CODES = ["already_reviewed", "empty_submission", "no_access", "block_not_work", "block_not_found", "text_too_long", "invalid_files", "files_not_allowed", "too_many_files", "type_not_allowed"];
  function workErr(e) {
    var m = String((e && e.message) || "") + " " + String((e && e.error) || "");
    for (var i = 0; i < WORK_CODES.length; i++) { if (m.indexOf(WORK_CODES[i]) > -1) return mkErr(e, WORK_CODES[i]); }
    if (/mime type|invalid_mime/i.test(m)) return mkErr(e, "type_not_allowed");
    if (/exceeded the maximum allowed size|payload too large|too large/i.test(m) || (e && (e.statusCode === "413" || e.status === 413))) return mkErr(e, "file_too_large");
    return mkErr(e);
  }

  /* Send (or send again) work for a block. files: File / Blob objects.
     Answers the saved row { status, text, files, feedback, score, reviewed_at }. */
  function submitWork(blockId, payload) {
    payload = payload || {};
    var text = payload.text == null ? "" : String(payload.text);
    var files = (Array.isArray(payload.files) ? payload.files : []).filter(Boolean), i;
    if (files.length > MAX_WORK_FILES) return Promise.reject(mkErr(null, "too_many_files"));
    for (i = 0; i < files.length; i++) {
      if (num(files[i].size) > MAX_WORK_BYTES) return Promise.reject(mkErr(null, "file_too_large"));
    }
    if (!/\S/.test(text) && !files.length) return Promise.reject(mkErr(null, "empty_submission"));
    for (i = 0; i < files.length; i++) {
      if (!typeAllowed(plainType(files[i]))) return Promise.reject(mkErr(null, "type_not_allowed"));
    }

    if (DEMO) {
      if (!demoIn()) return Promise.reject(mkErr(null, "session_missing"));
      var hit = demoFindBlock(blockId);
      if (!hit || WORK_TYPES.indexOf(hit.block.type) < 0) return Promise.reject(mkErr(null, "unknown"));
      var before = hit.prod.work[hit.block.id];
      if (before && before.status === "reviewed") return Promise.reject(mkErr(null, "already_reviewed"));
      if (hit.block.type === "open_answer") files = [];
      var row = {
        status: "submitted",
        text: text.replace(/^\s+|\s+$/g, "").slice(0, 20000),
        files: files.map(function (f, k) {
          var type = plainType(f), name = workName(f, type);
          var path = "demo/" + hit.block.id + "/" + (Date.now() + k) + "-" + safeFileName(name, type);
          try { if (typeof URL !== "undefined" && URL.createObjectURL) demoBlobs[path] = URL.createObjectURL(f); } catch (_) {}
          return { path: path, name: name, size: num(f.size), type: type };
        }),
        feedback: "", score: null, reviewed_at: null
      };
      hit.prod.work[hit.block.id] = row;
      overlay.work[hit.block.id] = row;
      saveOverlay();
      return Promise.resolve(clone(row));
    }

    return user().then(function (u) {
      if (!u) throw mkErr(null, "session_missing");
      return ready().then(function (c) {
        var bucket = c.storage.from("student-work"), folder = u.id + "/" + blockId, stamp = Date.now();
        /* a work that is already reviewed cannot be replaced: do not upload anything */
        return alreadyReviewed(c, u.id, blockId).then(function (rev) {
          if (rev) throw mkErr(null, "already_reviewed");
          return Promise.all(files.map(function (f, k) {
            var type = plainType(f), name = workName(f, type);
            var path = folder + "/" + (stamp + k) + "-" + safeFileName(name, type);
            return Promise.resolve().then(function () {
              return bucket.upload(path, f, { contentType: type, upsert: false });
            }).then(function (r) {
              if (r && r.error) throw workErr(r.error);
              return { ok: true, meta: { path: path, name: name, size: num(f.size), type: type } };
            }).then(null, function (e) { return { ok: false, err: e && e.code ? e : workErr(e) }; });
          }));
        }).then(function (results) {
          var uploaded = results.filter(function (x) { return x.ok; }).map(function (x) { return x.meta; });
          var failed = results.filter(function (x) { return !x.ok; })[0];
          if (failed) {
            /* nothing points at the files of this attempt: remove them */
            return removeWorkFiles(bucket, uploaded.map(function (m) { return m.path; })).then(function () { throw failed.err; });
          }
          var paths = uploaded.map(function (m) { return m.path; });
          return Promise.resolve().then(function () {
            return c.rpc("submit_block_work", { p_block_id: blockId, p_text: text, p_files: uploaded });
          }).then(function (r) {
            if (r && r.error) throw workErr(r.error);
            var d = r ? r.data : null;
            return Array.isArray(d) ? d[0] : d;
          }).then(null, function (e) {
            var er = e && e.code ? e : workErr(e);
            /* only a clear refusal means the files are unused; after a network
               problem the work may have been saved, so the files stay */
            if (WORK_CODES.indexOf(er.code) > -1) return removeWorkFiles(bucket, paths).then(function () { throw er; });
            throw er;
          }).then(function (d) {
            /* the old files of this block are no longer needed (errors are only logged) */
            return dropOldWorkFiles(bucket, folder, paths).then(function () { return normWork(d || {}); });
          });
        });
      });
    }).then(null, function (e) {
      throw (e && e.code ? e : workErr(e));
    });
  }

  function logWorkFiles(what, e) {
    try { if (window.console && console.warn) console.warn("[FMM] student-work " + what + ":", e && (e.message || e)); } catch (_) {}
  }
  /* true when Maria has already reviewed this work (a failed check counts as "no") */
  function alreadyReviewed(c, userId, blockId) {
    return Promise.resolve().then(function () {
      return c.from("block_work").select("status").eq("user_id", userId).eq("block_id", blockId).maybeSingle();
    }).then(function (r) {
      return !!(r && !r.error && r.data && r.data.status === "reviewed");
    }, function () { return false; });
  }
  /* remove files from the bucket; never fails */
  function removeWorkFiles(bucket, paths) {
    if (!paths.length) return Promise.resolve();
    return Promise.resolve().then(function () { return bucket.remove(paths); }).then(function (r) {
      if (r && r.error) logWorkFiles("remove", r.error);
    }, function (e) { logWorkFiles("remove", e); });
  }
  /* remove everything in the student's folder of this block except the files in keep */
  function dropOldWorkFiles(bucket, folder, keep) {
    return Promise.resolve().then(function () { return bucket.list(folder, { limit: 100 }); }).then(function (r) {
      if (!r || r.error) { logWorkFiles("list", r && r.error); return; }
      var old = (r.data || []).filter(function (o) { return o && o.name && o.id !== null && o.name.charAt(0) !== "."; })
        .map(function (o) { return folder + "/" + o.name; })
        .filter(function (p) { return keep.indexOf(p) < 0; });
      return removeWorkFiles(bucket, old);
    }, function (e) { logWorkFiles("list", e); });
  }

  function setLessonDone(lessonId, done) {
    done = !!done;
    if (DEMO) {
      var hit = false;
      Object.keys(demoData.products).forEach(function (slug) {
        eachLesson(demoData.products[slug], function (l) {
          if (String(l.id) === String(lessonId)) { l.done = done; hit = true; }
        });
      });
      if (!hit) return Promise.reject(mkErr(null, "unknown"));
      overlay.done[lessonId] = done;
      saveOverlay();
      return Promise.resolve(done);
    }
    return ready().then(function (c) {
      return c.rpc("set_lesson_done", { p_lesson_id: lessonId, p_done: done });
    }).then(function (r) {
      must(r);
      return done;
    });
  }

  /* ---------------- Buying ---------------- */
  function firstTouch() {
    /* Same rule as assets/fmm-kit.js: only with the visitor's analytics consent. */
    try {
      var consent = JSON.parse(lsGet("fmm_consent") || "null");
      if (!consent || consent.analytics !== "granted") return {};
      return JSON.parse(lsGet("fmm_first") || "null") || {};
    } catch (_) { return {}; }
  }

  function buy(slug, opts) {
    opts = opts || {};
    if (DEMO) return Promise.resolve(fail("demo"));
    if (!CFG.checkoutEnabled) return Promise.resolve(fail("disabled"));
    return realSession().catch(function () { return null; }).then(function (s) {
      var token = (s && s.access_token) || CFG.supabaseKey;
      return fetch(CFG.functionsUrl + "/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: CFG.supabaseKey, Authorization: "Bearer " + token },
        body: JSON.stringify({
          product: String(slug),
          locale: I.lang || "uk",
          email: opts.email || undefined,
          return_path: opts.returnPath || undefined,
          attribution: firstTouch()
        })
      });
    }).then(function (resp) {
      return resp.json().catch(function () { return {}; }).then(function (body) {
        if (resp.ok && body && body.url) {
          window.location.href = body.url;
          return ok({ url: body.url });
        }
        if (resp.status === 409 && body && body.error === "already_owned") return fail("already_owned");
        return fail((body && body.error && String(body.error)) || (resp.status === 429 ? "rate_limited" : "unknown"));
      });
    }).catch(function () {
      return fail("network");
    });
  }

  /* ---------------- Export ---------------- */
  window.FMMAccount = {
    isDemo: function () { return DEMO; },
    ready: ready,
    client: ready,
    session: session,
    user: user,
    signIn: signIn,
    signOut: signOut,
    sendReset: sendReset,
    verifyRecovery: verifyRecovery,
    setPassword: setPassword,
    profile: profile,
    updateProfile: updateProfile,
    library: library,
    orders: orders,
    product: product,
    signedUrl: signedUrl,
    workFileUrl: workFileUrl,
    saveBlockResult: saveBlockResult,
    submitWork: submitWork,
    setLessonDone: setLessonDone,
    isAdmin: isAdmin,
    buy: buy
  };
})();
