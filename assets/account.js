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
   (library, orders, product, saveResult ...) reject with an Error when
   something goes wrong; err.code is one of: network, rate_limited,
   session_missing, unknown.
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

  /* Demo changes (results, ticks, profile) are kept in the fixtures in
     memory and copied into sessionStorage so they survive a page change. */
  var overlay = { results: {}, done: {}, profile: null };
  function saveOverlay() { ssSet("fmm_demo_state", JSON.stringify(overlay)); }
  function eachExercise(prod, fn) {
    prod.exercises.forEach(fn);
    prod.modules.forEach(function (m) { m.lessons.forEach(function (l) { l.exercises.forEach(fn); }); });
  }
  function eachLesson(prod, fn) {
    prod.modules.forEach(function (m) { m.lessons.forEach(fn); });
  }
  if (DEMO) {
    try {
      var saved = JSON.parse(ssGet("fmm_demo_state") || "null");
      if (saved && typeof saved === "object") {
        overlay.results = saved.results || {};
        overlay.done = saved.done || {};
        overlay.profile = saved.profile || null;
      }
    } catch (_) {}
    var pk = demoData.products || {};
    Object.keys(pk).forEach(function (slug) {
      eachExercise(pk[slug], function (e) { if (overlay.results[e.id]) e.result = overlay.results[e.id]; });
      eachLesson(pk[slug], function (l) { if (Object.prototype.hasOwnProperty.call(overlay.done, l.id)) l.done = !!overlay.done[l.id]; });
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
      exercises_total: num(r.exercises_total), exercises_completed: num(r.exercises_completed)
    };
  }

  function demoCounts(prod) {
    var lt = 0, ld = 0, et = 0, ec = 0;
    eachLesson(prod, function (l) { lt++; if (l.done) ld++; });
    eachExercise(prod, function (e) { et++; if (e.result && e.result.completed) ec++; });
    return { lessons_total: lt, lessons_done: ld, exercises_total: et, exercises_completed: ec };
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

  function normMaterial(m) {
    return {
      id: m.id, kind: m.kind, title: m.title || "", storage_path: m.storage_path || null,
      external_ref: m.external_ref || null, body: m.body == null ? null : m.body, position: num(m.position)
    };
  }
  function normResult(r) {
    return {
      best_score: num(r.best_score), last_score: num(r.last_score), max_score: num(r.max_score),
      attempts: num(r.attempts), completed: !!(r.completed === true || r.completed_at)
    };
  }
  function normExercise(e, results) {
    return {
      id: e.id, title: e.title || "", instructions: e.instructions || "", content: e.content,
      position: num(e.position), result: results[String(e.id)] || null
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
      c.from("materials").select("id,lesson_id,kind,title,storage_path,external_ref,body,position").eq("product_id", p.id),
      c.from("exercises").select("id,lesson_id,title,instructions,content,position").eq("product_id", p.id),
      c.from("exercise_results").select("exercise_id,best_score,last_score,max_score,attempts,completed_at").eq("user_id", u.id),
      c.from("lesson_progress").select("lesson_id").eq("user_id", u.id)
    ]).then(function (rs) {
      var mods = must(rs[0]) || [], mats = must(rs[1]) || [], exs = must(rs[2]) || [];
      var resRows = must(rs[3]) || [], progRows = must(rs[4]) || [];
      var results = {}, done = {};
      resRows.forEach(function (x) { results[String(x.exercise_id)] = normResult(x); });
      progRows.forEach(function (x) { done[String(x.lesson_id)] = true; });

      var matsByLesson = {}, exsByLesson = {}, rootMats = [], rootExs = [];
      mats.map(normMaterialRow).sort(byPosition).forEach(function (m) {
        if (m.lesson_id == null) rootMats.push(m.mat);
        else (matsByLesson[String(m.lesson_id)] = matsByLesson[String(m.lesson_id)] || []).push(m.mat);
      });
      exs.slice().sort(byPosition).forEach(function (e) {
        var ne = normExercise(e, results);
        if (e.lesson_id == null) rootExs.push(ne);
        else (exsByLesson[String(e.lesson_id)] = exsByLesson[String(e.lesson_id)] || []).push(ne);
      });

      var modules = mods.slice().sort(byPosition).map(function (m) {
        return {
          id: m.id, title: m.title || "", position: num(m.position),
          lessons: (m.course_lessons || []).slice().sort(byPosition).map(function (l) {
            return {
              id: l.id, title: l.title || "", summary: l.summary || "", position: num(l.position),
              done: !!done[String(l.id)],
              materials: matsByLesson[String(l.id)] || [],
              exercises: exsByLesson[String(l.id)] || []
            };
          })
        };
      });
      return {
        product: {
          id: p.id, slug: p.slug, kind: p.kind, title: p.title || "",
          short_description: p.short_description || "", description: p.description || "", cover_path: p.cover_path || null
        },
        modules: modules, materials: rootMats, exercises: rootExs
      };
    });
  }
  /* Sorting helper that keeps lesson_id next to the cleaned material. */
  function normMaterialRow(m) { return { id: m.id, position: m.position, lesson_id: m.lesson_id, mat: normMaterial(m) }; }

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
  function demoAsset(path) {
    if (path && /^assets\//.test(path)) return I.asset ? I.asset(path) : path;
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

  /* ---------------- Results and progress ---------------- */
  function clampInt(x, lo, hi) {
    x = Math.round(num(x));
    return x < lo ? lo : (x > hi ? hi : x);
  }

  function demoFindExercise(id) {
    var found = null;
    Object.keys(demoData.products).forEach(function (slug) {
      eachExercise(demoData.products[slug], function (e) { if (String(e.id) === String(id)) found = e; });
    });
    return found;
  }

  function saveResult(exerciseId, res) {
    res = res || {};
    var max = clampInt(res.max, 1, 500);
    var score = clampInt(res.score, 0, max);
    if (DEMO) {
      var ex = demoFindExercise(exerciseId);
      if (!ex) return Promise.reject(mkErr(null, "unknown"));
      var old = ex.result;
      ex.result = {
        best_score: Math.max(old ? old.best_score : 0, score),
        last_score: score,
        max_score: max,
        attempts: (old ? old.attempts : 0) + 1,
        completed: !!(old && old.completed) || score === max
      };
      overlay.results[ex.id] = ex.result;
      saveOverlay();
      return Promise.resolve(clone(ex.result));
    }
    var answers = res.answers == null ? null : res.answers;
    try { if (answers != null && JSON.stringify(answers).length > 18000) answers = null; } catch (_) { answers = null; }
    return ready().then(function (c) {
      return c.rpc("save_exercise_result", { p_exercise_id: exerciseId, p_score: score, p_max: max, p_answers: answers });
    }).then(function (r) {
      var d = must(r);
      if (Array.isArray(d)) d = d[0];
      return normResult(d || {});
    });
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
    saveResult: saveResult,
    setLessonDone: setLessonDone,
    isAdmin: isAdmin,
    buy: buy
  };
})();
