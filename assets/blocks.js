/* =====================================================================
   Fika med Maria — lesson blocks: core renderer (assets/blocks.js)

   Global: window.FMMBlocks
     register(type, { render(el, content, ctx, block) -> { reset?, destroy? } })
     types()                         registered type names
     render(container, block, ctx)   APPENDS one framed block, returns a handle
                                     { el, type, reset(), destroy() } or null
                                     (teacher_note in student mode -> null)
     renderAll(container, blocks, ctx)  REPLACES the container content, returns handles
     validate(block) -> { ok, errors[] }   (Ukrainian; all 27 types)
     parseGaps(text) -> tokens           shared gap syntax (see below)
     md(text) -> safe HTML               tiny markdown, escapes first
     safeEmbed(provider, url) -> https embed URL | null
     _check                               pure helpers for tests

   Content types: text, hidden_text, table, vocabulary, audio, video, youtube,
   image, carousel, collage, file, link_button, embed, open_answer, student_file,
   teacher_note. The 11 exercise types register themselves from
   assets/blocks-exercises.js; their validation rules live here.

   Gap syntax (parseGaps):
     [answer]            one gap
     [a|b]               gap, several accepted answers
     [*right|wrong|...]  dropdown; "*" marks the right option (anywhere in the list)
     Escapes: \[  \]  \|  \*  \\  give the literal character (a backslash before
     any other character stays as it is). "[" without a closing "]", or "[]",
     stays literal text (and validate() reports it).

   Everything from the content goes into the page with textContent or through
   md() (which escapes first). Every student-facing string goes through T().
   Spec: fikamedmaria-backend/docs/blocks-spec.md
   ===================================================================== */
(function () {
  "use strict";

  /* ---------------------------------------------------------------
     Small helpers
     --------------------------------------------------------------- */
  /* T(): window.FMMI18N.T / window.T when i18n.js is loaded, else identity
     (placeholders {name} still filled). Looked up at call time. */
  function T(s, v) {
    var f = (window.FMMI18N && window.FMMI18N.T) || window.T;
    if (typeof f === "function") return f(s, v);
    s = String(s == null ? "" : s);
    return v ? s.replace(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g, function (m, k) { return v[k] != null ? String(v[k]) : m; }) : s;
  }

  function str(s) { return s == null ? "" : String(s); }
  function esc(s) {
    return str(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function isStr(x) { return typeof x === "string" && /\S/.test(x); }
  function isInt(x) { return typeof x === "number" && isFinite(x) && Math.floor(x) === x; }
  function isObj(x) { return x !== null && typeof x === "object" && !Array.isArray(x); }
  function doc() { return window.document; }

  function h(tag, cls, text) {
    var e = doc().createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function slice(a) { return Array.prototype.slice.call(a); }

  var uid = 0;
  function nextId(prefix) { uid += 1; return prefix + uid; }

  /* ---------------------------------------------------------------
     Checking helpers (pure)
     --------------------------------------------------------------- */
  /* trim, collapse spaces, lower-case, drop final . ! ? (å/ä/ö/é stay) */
  function normalise(s) {
    s = str(s);
    if (typeof s.normalize === "function") s = s.normalize("NFC");
    s = s.replace(/[‘’ʼ]/g, "'").replace(/\s+/g, " ").replace(/^ +| +$/g, "").toLowerCase();
    return s.replace(/[.!?…]+$/, "").replace(/ +$/, "");
  }
  /* like normalise, but without accents: å ä -> a, ö -> o, é -> e */
  function fold(s) {
    s = normalise(s);
    if (typeof s.normalize === "function") return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
    return s.replace(/[åä]/g, "a").replace(/ö/g, "o").replace(/é/g, "e");
  }
  /* "ok" | "almost" (only å/ä/ö/é differ) | "wrong" */
  function checkGap(given, accepted) {
    var g = normalise(given), list = Array.isArray(accepted) ? accepted : [accepted], i, almost = false;
    if (!g) return "wrong";
    for (i = 0; i < list.length; i++) { if (normalise(list[i]) === g) return "ok"; }
    var gf = fold(given);
    for (i = 0; i < list.length; i++) { if (fold(list[i]) === gf) almost = true; }
    return almost ? "almost" : "wrong";
  }

  function countWords(text) {
    var parts = str(text).split(/\s+/), n = 0, i;
    for (i = 0; i < parts.length; i++) {
      if (/[A-Za-z0-9À-ɏͰ-ϿЀ-ӿ]/.test(parts[i])) n += 1;
    }
    return n;
  }

  /* ---------------------------------------------------------------
     Gap syntax
     --------------------------------------------------------------- */
  var ESCAPABLE = "[]|\\*";

  /* -> { tokens, problems[] }; problems are Ukrainian sentences for validate() */
  function scanGaps(text) {
    text = str(text).replace(/\r\n?/g, "\n");
    var toks = [], problems = [], buf = "", i = 0, n = text.length, c, nx;
    function pushText() { if (buf) { toks.push({ type: "text", value: buf }); buf = ""; } }

    /* parse from text[i] === "[" ; -> { end, opts } or null (unclosed / nested) */
    function readGap(start) {
      var j = start + 1, opts = [], cur = "", star = false, started = false, ch, nxt;
      function endOpt() { opts.push({ t: cur.replace(/^\s+|\s+$/g, ""), star: star }); cur = ""; star = false; started = false; }
      while (j < n) {
        ch = text.charAt(j);
        if (ch === "\\" && j + 1 < n && ESCAPABLE.indexOf(text.charAt(j + 1)) > -1) {
          cur += text.charAt(j + 1); started = true; j += 2; continue;
        }
        if (ch === "]") { endOpt(); return { end: j + 1, opts: opts }; }
        if (ch === "[") return null;
        if (ch === "|") { endOpt(); j += 1; continue; }
        if (ch === "*" && !started && !star) { star = true; j += 1; continue; }
        if (ch === "\n") return null;
        if (!/\s/.test(ch)) started = true;
        cur += ch; j += 1;
      }
      return null;
    }

    while (i < n) {
      c = text.charAt(i);
      if (c === "\\" && i + 1 < n) {
        nx = text.charAt(i + 1);
        if (ESCAPABLE.indexOf(nx) > -1) { buf += nx; i += 2; continue; }
      }
      if (c === "[") {
        var g = readGap(i);
        if (!g) {
          problems.push("незакрита дужка «[» (якщо потрібна літерна дужка, напиши \\[ )");
          buf += c; i += 1; continue;
        }
        var raw = text.slice(i, g.end), opts = [], k, stars = 0, starIdx = -1, seen = {}, dup = false;
        for (k = 0; k < g.opts.length; k++) {
          if (g.opts[k].t === "") continue;
          if (g.opts[k].star) { stars += 1; if (starIdx < 0) starIdx = opts.length; }
          opts.push(g.opts[k].t);
        }
        var anyStar = stars > 0 || g.opts.some(function (o) { return o.star; });
        if (!opts.length) {
          problems.push("порожній пропуск «" + raw + "»");
          buf += raw; i = g.end; continue;
        }
        if (anyStar) {
          if (stars !== 1) problems.push("у «" + raw + "» має бути рівно одна правильна відповідь із зірочкою *");
          if (opts.length < 2) problems.push("у «" + raw + "» потрібно щонайменше два варіанти");
          for (k = 0; k < opts.length; k++) {
            if (seen[normalise(opts[k])]) dup = true;
            seen[normalise(opts[k])] = true;
          }
          if (dup) problems.push("у «" + raw + "» є однакові варіанти");
          pushText();
          toks.push({ type: "select", options: opts, correct: starIdx < 0 ? 0 : starIdx });
        } else {
          pushText();
          toks.push({ type: "gap", answers: opts });
        }
        i = g.end; continue;
      }
      buf += c; i += 1;
    }
    pushText();
    return { tokens: toks, problems: problems };
  }

  function parseGaps(text) { return scanGaps(text).tokens; }

  function gapStats(text) {
    var s = scanGaps(text), gaps = 0, selects = 0, i;
    for (i = 0; i < s.tokens.length; i++) {
      if (s.tokens[i].type === "gap") gaps += 1;
      else if (s.tokens[i].type === "select") selects += 1;
    }
    return { gaps: gaps, selects: selects, problems: s.problems };
  }

  /* ---------------------------------------------------------------
     Tiny markdown (escape first)
     "## " / "### " headings, blank-line paragraphs, "- " lists, **bold**,
     *italic*, [text](https://...) links (https only, new tab), "> " quote,
     single line breaks.
     --------------------------------------------------------------- */
  function emphasis(s) {
    s = s.replace(/\*\*(\S(?:[^*\n]*?\S)?)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/\*(\S(?:[^*\n]*?\S)?)\*/g, "<em>$1</em>");
    return s;
  }
  function inline(escaped) {
    var stash = [];
    var s = escaped.replace(/[\u0001\u0002]/g, "").replace(/\[([^\]\n]+)\]\((https:\/\/[^\s)]+)\)/g, function (m, text, href) {
      stash.push('<a href="' + href + '" target="_blank" rel="noopener noreferrer">' + emphasis(text) + "</a>");
      return "\u0001" + (stash.length - 1) + "\u0002";
    });
    s = emphasis(s);
    return s.replace(/\u0001(\d+)\u0002/g, function (m, i) { return stash[Number(i)]; });
  }
  function md(src) {
    var lines = str(src).replace(/\r\n?/g, "\n").split("\n");
    var out = [], para = [], list = [], quote = [], i, line, m;
    function flush() {
      if (para.length) { out.push("<p>" + para.map(function (l) { return inline(esc(l)); }).join("<br>") + "</p>"); para = []; }
      if (list.length) { out.push("<ul>" + list.map(function (l) { return "<li>" + inline(esc(l)) + "</li>"; }).join("") + "</ul>"); list = []; }
      if (quote.length) { out.push("<blockquote><p>" + quote.map(function (l) { return inline(esc(l)); }).join("<br>") + "</p></blockquote>"); quote = []; }
    }
    for (i = 0; i < lines.length; i++) {
      line = lines[i];
      if (/^\s*$/.test(line)) { flush(); continue; }
      if ((m = /^###\s+(.*)$/.exec(line))) { flush(); out.push("<h4>" + inline(esc(m[1])) + "</h4>"); continue; }
      if ((m = /^##\s+(.*)$/.exec(line))) { flush(); out.push("<h3>" + inline(esc(m[1])) + "</h3>"); continue; }
      if ((m = /^-\s+(.*)$/.exec(line))) {
        if (para.length || quote.length) flush();
        list.push(m[1]); continue;
      }
      if ((m = /^>\s?(.*)$/.exec(line))) {
        if (para.length || list.length) flush();
        quote.push(m[1]); continue;
      }
      if (list.length || quote.length) flush();
      para.push(line);
    }
    flush();
    return out.join("\n");
  }

  /* ---------------------------------------------------------------
     URLs, sources, embeds
     --------------------------------------------------------------- */
  /* https URL without credentials / port -> URL object, else null */
  function parseHttps(s) {
    var u;
    s = str(s).replace(/^\s+|\s+$/g, "");
    if (!s || /[\u0000-\u001f\u007f]/.test(s)) return null;
    try { u = new URL(s); } catch (e) { return null; }
    if (u.protocol !== "https:" || u.username || u.password || u.port) return null;
    return u;
  }
  function isHttps(s) { return !!parseHttps(s); }

  /* a path inside the private bucket: "<product_id>/folder/file.ext" (or a site
     file such as "assets/lessons/x.webp" in the demo) */
  function isStoragePath(s) {
    if (typeof s !== "string" || !/\S/.test(s) || s.length > 500) return false;
    if (/[\u0000-\u001f\u007f\\:?#]/.test(s)) return false;
    if (s.charAt(0) === "/" || /(^|\/)\.\.?(\/|$)/.test(s) || /\/\//.test(s)) return false;
    return true;
  }
  function isSrc(s) { return isHttps(s) || isStoragePath(s); }

  /* the URL that came back from ctx.signedUrl: https, blob: or a path of this
     site. An http:// address is accepted only when it is the page's own origin:
     a site picture is given as an absolute address of the page it is shown on,
     which is http:// when the site is tried out on a local server.
     The address is trimmed, a control character anywhere or a space inside the
     scheme refuses it, and it is parsed the way the browser will parse it
     (so "\\evil.com", "/\\evil.com" and "//evil.com" cannot slip through as
     "relative"). */
  function pageBase() {
    var loc = window.location, href = loc && loc.href ? String(loc.href) : "";
    try { return new URL(href); } catch (e) { return new URL("https://site.invalid/"); }
  }
  function safeUrl(u) {
    var base, parsed, scheme;
    u = str(u).replace(/^\s+|\s+$/g, "");
    if (!u || /[\u0000-\u001f\u007f]/.test(u)) return null;
    scheme = /^([^:\/?#]*):/.exec(u);
    if (scheme && !/^[A-Za-z][A-Za-z0-9+.\-]*$/.test(scheme[1])) return null;
    base = pageBase();
    try { parsed = new URL(u, base.href); } catch (e) { return null; }
    if (scheme) {
      if (parsed.protocol === "https:" || parsed.protocol === "blob:") return u;
      if (parsed.protocol === "http:" && base.protocol === "http:" && parsed.origin === base.origin) return u;
      return null;
    }
    /* no scheme: a path of this very site, never another host */
    if (/^\/\/|\\/.test(u)) return null;
    if (parsed.protocol !== base.protocol || parsed.host !== base.host) return null;
    return u;
  }

  function hostIs(u, list) { return list.indexOf(u.hostname.toLowerCase()) > -1; }
  function plain(u) { return "https://" + u.host + u.pathname + u.search; }

  var YT_HOSTS = ["youtu.be", "youtube.com", "www.youtube.com", "m.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com"];
  var YT_ID = /^[A-Za-z0-9_-]{11}$/;

  function ytStart(u) {
    var m = /(?:^|[?&])(?:t|start)=(\d{1,6})s?(?:&|$)/.exec(u.search + (u.hash ? "&" + u.hash.slice(1) : ""));
    return m ? Number(m[1]) : 0;
  }
  /* any YouTube link -> https://www.youtube-nocookie.com/embed/<id>[?start=n] | null */
  function youtubeEmbed(url) {
    var u = parseHttps(url), id = null, m, start;
    if (!u || !hostIs(u, YT_HOSTS)) return null;
    var host = u.hostname.toLowerCase();
    if (host === "youtu.be") {
      m = /^\/([^/]+)\/?$/.exec(u.pathname); id = m && m[1];
    } else if (u.pathname === "/watch") {
      m = /(?:^|[?&])v=([^&#]+)/.exec(u.search); id = m && m[1];
    } else {
      m = /^\/(?:embed|shorts|live|v)\/([^/?#]+)\/?$/.exec(u.pathname); id = m && m[1];
    }
    if (!id || !YT_ID.test(id)) return null;
    start = ytStart(u);
    return "https://www.youtube-nocookie.com/embed/" + id + (start ? "?start=" + start : "");
  }

  /* embed providers: each -> embed URL string | null */
  /* only the address WordWall gives for embedding: wordwall.net/embed/… */
  function wordwall(u) {
    if (!hostIs(u, ["wordwall.net", "www.wordwall.net"])) return null;
    return /^\/embed\/.+/.test(u.pathname) ? "https://wordwall.net" + u.pathname + u.search : null;
  }
  function genially(u) {
    if (hostIs(u, ["view.genial.ly", "view.genially.com"])) return u.pathname.length > 1 ? plain(u) : null;
    if (hostIs(u, ["app.genially.com"])) {
      var segs = u.pathname.split("/"), i;
      for (i = 0; i < segs.length; i++) {
        if (/^[0-9a-f]{24}$/i.test(segs[i])) return "https://view.genial.ly/" + segs[i];
      }
    }
    return null;
  }
  function quizlet(u) {
    if (!hostIs(u, ["quizlet.com", "www.quizlet.com"])) return null;
    var segs = u.pathname.split("/"), i;
    for (i = 0; i < segs.length; i++) {
      if (/^\d{4,}$/.test(segs[i])) return "https://quizlet.com/" + segs[i] + "/flashcards/embed";
    }
    return null;
  }
  var IFRAME_HOSTS = {
    "docs.google.com": function (u) { return u.pathname.length > 1 ? plain(u) : null; },
    "www.canva.com": function (u) {
      if (!/^\/design\/[^/]+/.test(u.pathname) || /\/edit\/?$/.test(u.pathname)) return null;
      return "https://www.canva.com" + u.pathname + "?embed";
    },
    "miro.com": function (u) {
      if (/^\/app\/live-embed\/.+/.test(u.pathname)) return plain(u);
      var m = /^\/app\/board\/([^/]+)\/?$/.exec(u.pathname);
      return m ? "https://miro.com/app/live-embed/" + m[1] + "/" : null;
    },
    "learningapps.org": function (u) { return u.pathname.length > 1 ? plain(u) : null; },
    "h5p.org": function (u) { return u.pathname.length > 1 ? plain(u) : null; },
    "www.youtube-nocookie.com": function (u) { return /^\/embed\/[A-Za-z0-9_-]{11}\/?$/.test(u.pathname) ? plain(u) : null; },
    "player.vimeo.com": function (u) { return /^\/video\/\d{5,12}\/?$/.test(u.pathname) ? plain(u) : null; },
    "iframe.mediadelivery.net": function (u) { return /^\/embed\/.+/.test(u.pathname) ? plain(u) : null; }
  };
  function genericIframe(u) {
    var host = u.hostname.toLowerCase();
    return Object.prototype.hasOwnProperty.call(IFRAME_HOSTS, host) ? IFRAME_HOSTS[host](u) : null;
  }
  /* provider "iframe" also accepts the three named providers' links, so a pasted
     WordWall link works whichever provider was chosen. */
  function safeEmbed(provider, url) {
    var u = parseHttps(url);
    if (!u) return null;
    if (provider === "wordwall") return wordwall(u);
    if (provider === "genially") return genially(u);
    if (provider === "quizlet") return quizlet(u);
    if (provider === "iframe") return genericIframe(u) || wordwall(u) || genially(u) || quizlet(u);
    return null;
  }
  /* which provider an https link belongs to (for the editor) -> name | null */
  function detectProvider(url) {
    var u = parseHttps(url);
    if (!u) return null;
    if (wordwall(u)) return "wordwall";
    if (genially(u)) return "genially";
    if (quizlet(u)) return "quizlet";
    if (genericIframe(u)) return "iframe";
    return null;
  }

  var VIDEO_FILE = /\.(mp4|webm|m4v|mov|ogv)$/i;
  /* video src -> { kind: "storage"|"file"|"embed", url } | null */
  function videoSource(src) {
    var u, e, m;
    if (typeof src !== "string") return null;
    if (/^\s*[a-z][a-z0-9+.\-]*:/i.test(src) || /^\s*\/\//.test(src)) {
      u = parseHttps(src);
      if (!u) return null;
      e = youtubeEmbed(u.href);
      if (e) return { kind: "embed", url: e };
      if (u.hostname.toLowerCase() === "vimeo.com" && (m = /^\/(\d{5,12})\/?$/.exec(u.pathname))) {
        return { kind: "embed", url: "https://player.vimeo.com/video/" + m[1] };
      }
      if (hostIs(u, ["player.vimeo.com", "iframe.mediadelivery.net", "www.youtube-nocookie.com"])) {
        e = genericIframe(u);
        return e ? { kind: "embed", url: e } : null;
      }
      if (VIDEO_FILE.test(u.pathname)) return { kind: "file", url: u.href };
      return null;
    }
    return isStoragePath(src) ? { kind: "storage", url: src } : null;
  }

  /* ---------------------------------------------------------------
     File checks (student uploads)
     --------------------------------------------------------------- */
  var MAX_FILE = 20 * 1024 * 1024;
  var MAX_FILES = 5;
  /* exactly what the private bucket student-work accepts: audio/*, five image
     types, PDF, Word, ODT and plain text (no SVG, no RTF) */
  var ACCEPT_EXT = {
    audio: ["mp3", "m4a", "aac", "wav", "ogg", "oga", "opus", "flac", "webm"],
    image: ["jpg", "jpeg", "png", "webp", "gif", "heic"],
    document: ["pdf", "doc", "docx", "odt", "txt"]
  };
  var IMAGE_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic"];
  var DOC_MIME = ["application/pdf", "application/msword", "text/plain",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.oasis.opendocument.text"];

  function fileKindOk(kind, type, name) {
    var t = str(type).toLowerCase().split(";")[0].replace(/^\s+|\s+$/g, ""), ext = (/\.([A-Za-z0-9]+)$/.exec(str(name)) || [])[1];
    ext = ext ? ext.toLowerCase() : "";
    if (t && t !== "application/octet-stream") {
      if (kind === "audio") return t.indexOf("audio/") === 0 || (t === "video/webm" && ext === "webm");
      if (kind === "image") return IMAGE_MIME.indexOf(t) > -1;
      return DOC_MIME.indexOf(t) > -1;
    }
    return ACCEPT_EXT[kind].indexOf(ext) > -1;
  }
  /* -> null (fine) | "empty" | "size" | "type" */
  function fileProblem(file, accept) {
    if (!file) return "empty";
    var size = typeof file.size === "number" ? file.size : 0;
    if (size <= 0) return "empty";
    if (size > MAX_FILE) return "size";
    var kinds = accept === "audio" || accept === "image" || accept === "document" ? [accept] : ["audio", "image", "document"], i;
    for (i = 0; i < kinds.length; i++) {
      if (fileKindOk(kinds[i], file.type, file.name)) return null;
    }
    return "type";
  }
  var IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/gif,image/heic,.jpg,.jpeg,.png,.webp,.gif,.heic";
  function acceptAttr(accept) {
    if (accept === "audio") return "audio/*";
    if (accept === "image") return IMAGE_ACCEPT;
    if (accept === "document") return ".pdf,.doc,.docx,.odt,.txt";
    return "audio/*," + IMAGE_ACCEPT + ",.pdf,.doc,.docx,.odt,.txt";
  }

  /* ---------------------------------------------------------------
     Registry and the block frame
     --------------------------------------------------------------- */
  var REG = {};
  var ORDER = [];

  function register(type, def) {
    if (typeof type !== "string" || !/^[a-z][a-z0-9_]*$/.test(type)) throw new Error("FMMBlocks.register: bad type name");
    if (!def || typeof def.render !== "function") throw new Error("FMMBlocks.register: render() is required");
    if (!REG[type]) ORDER.push(type);
    REG[type] = def;
  }
  function types() { return ORDER.slice(); }

  function modeOf(ctx) { return ctx && ctx.mode ? ctx.mode : "student"; }
  function teacherView(ctx) { var m = modeOf(ctx); return m === "admin" || m === "preview"; }

  /* a flag + cleanup list shared by one block's async work */
  function Life() { this.alive = true; this.fns = []; }
  Life.prototype.on = function (fn) { this.fns.push(fn); };
  Life.prototype.end = function () {
    var fns = this.fns, i;
    this.alive = false; this.fns = [];
    for (i = 0; i < fns.length; i++) { try { fns[i](); } catch (e) { /* ignore */ } }
  };

  function blockIdOf(el, block) {
    if (block && block.id != null) return String(block.id);
    var s = el && el.closest ? el.closest("[data-block-id]") : null;
    return s ? s.getAttribute("data-block-id") : "";
  }

  function render(container, block, ctx) {
    if (!container || !block || typeof block !== "object") return null;
    ctx = ctx || {};
    var type = str(block.type);
    if (type === "teacher_note" && !teacherView(ctx)) return null;
    var content = isObj(block.content) ? block.content : {};
    var sec = h("section", "fb-block fb-" + type.replace(/[^a-z0-9_-]/gi, "-"));
    sec.setAttribute("data-block-id", block.id == null ? "" : String(block.id));
    if (isStr(content.title) || isStr(content.instructions)) {
      var head = h("div", "fb-head");
      if (isStr(content.title)) head.appendChild(h("h3", "fb-title", content.title));
      if (isStr(content.instructions)) head.appendChild(h("p", "fb-instr", content.instructions));
      sec.appendChild(head);
    }
    var body = h("div", "fb-body");
    sec.appendChild(body);
    var def = REG[type], inst = null;
    if (!def) {
      var nt = h("p", "fb-unknown", T("Цей тип блоку тут не показується: {type}.", { type: type || "?" }));
      body.appendChild(nt);
    } else {
      try { inst = def.render(body, content, ctx, block) || null; }
      catch (e) {
        if (window.console && window.console.error) window.console.error("FMMBlocks: block " + type + " failed", e);
        clear(body);
        body.appendChild(h("p", "fb-error", T("Не вдалося показати цей блок.")));
      }
    }
    container.appendChild(sec);
    var done = false;
    return {
      el: sec,
      type: type,
      reset: function () { if (inst && typeof inst.reset === "function") inst.reset(); },
      destroy: function () {
        if (done) return;
        done = true;
        if (inst && typeof inst.destroy === "function") { try { inst.destroy(); } catch (e) { /* ignore */ } }
        if (sec.parentNode) sec.parentNode.removeChild(sec);
      }
    };
  }

  function renderAll(container, blocks, ctx) {
    var out = [], i, hd, list;
    if (!container) return out;
    if (container.__fbHandles) {
      for (i = 0; i < container.__fbHandles.length; i++) container.__fbHandles[i].destroy();
    }
    clear(container);
    list = Array.isArray(blocks) ? blocks.map(function (b, idx) { return { b: b, i: idx }; }) : [];
    list.sort(function (x, y) {
      var px = x.b && typeof x.b.position === "number" ? x.b.position : 0;
      var py = y.b && typeof y.b.position === "number" ? y.b.position : 0;
      return px - py || x.i - y.i;
    });
    for (i = 0; i < list.length; i++) {
      hd = render(container, list[i].b, ctx);
      if (hd) out.push(hd);
    }
    container.__fbHandles = out;
    return out;
  }

  /* ---------------------------------------------------------------
     validate(block) — Ukrainian messages "<field>: <what is wrong>"
     --------------------------------------------------------------- */
  var ALL_TYPES = ["gap", "drag_words", "choice", "order_words", "order_sentences", "dropdown_gap",
    "truefalse", "table_fill", "match", "categorize", "flashcards", "text", "hidden_text", "table",
    "vocabulary", "audio", "video", "youtube", "image", "carousel", "collage", "file", "link_button",
    "embed", "open_answer", "student_file", "teacher_note"];

  function V(errs) {
    var self = {
      bad: function (field, msg) { errs.push(field + ": " + msg); },
      str: function (c, f, max, required) {
        var v = c[f];
        if (v == null || v === "") { if (required) self.bad(f, "це поле не може бути порожнім"); return; }
        if (typeof v !== "string") { self.bad(f, "має бути текст"); return; }
        if (required && !/\S/.test(v)) self.bad(f, "це поле не може бути порожнім");
        if (max && v.length > max) self.bad(f, "занадто довго (до " + max + " символів)");
      },
      src: function (c, f, required, prefix) {
        var v = c[f], name = (prefix || "") + f;
        if (v == null || v === "") { if (required) self.bad(name, "потрібен файл або посилання https://"); return; }
        if (typeof v !== "string" || !isSrc(v)) self.bad(name, "має бути файл із сховища або посилання, що починається з https://");
      },
      list: function (c, f, min, max, itemsLabel) {
        var v = c[f];
        if (!Array.isArray(v)) { self.bad(f, "має бути список"); return null; }
        if (v.length < min) { self.bad(f, "додай щонайменше " + min + " " + itemsLabel); return v; }
        if (v.length > max) self.bad(f, "забагато: не більше " + max + " " + itemsLabel);
        return v;
      },
      bool: function (c, f) {
        if (c[f] != null && typeof c[f] !== "boolean") self.bad(f, "має бути «так» або «ні»");
      }
    };
    return self;
  }

  function dupFree(arr) {
    var seen = {}, i, k;
    for (i = 0; i < arr.length; i++) {
      k = normalise(arr[i]);
      if (seen[k]) return false;
      seen[k] = true;
    }
    return true;
  }
  function sortedTokens(s) {
    var parts = str(s).split(/\s+/), out = [], i;
    for (i = 0; i < parts.length; i++) { if (parts[i] !== "") out.push(normalise(parts[i])); }
    return out.sort();
  }
  function sameTokens(a, b) {
    var i;
    if (a.length !== b.length) return false;
    for (i = 0; i < a.length; i++) { if (a[i] !== b[i]) return false; }
    return true;
  }

  var VALIDATORS = {
    gap: function (c, v) {
      v.str(c, "text", 20000, true);
      if (!isStr(c.text)) return;
      var s = gapStats(c.text);
      s.problems.forEach(function (p) { v.bad("text", p); });
      if (s.selects) v.bad("text", "варіанти зі «*» тут не потрібні — для списку вибору є окремий тип «Заповніть пропуск одним з варіантів»");
      if (!s.gaps) v.bad("text", "додай хоча б один пропуск у квадратних дужках, наприклад [dricker]");
    },
    drag_words: function (c, v) {
      v.str(c, "text", 20000, true);
      if (isStr(c.text)) {
        var s = gapStats(c.text);
        s.problems.forEach(function (p) { v.bad("text", p); });
        if (s.selects) v.bad("text", "варіанти зі «*» тут не потрібні");
        if (!s.gaps) v.bad("text", "додай хоча б один пропуск у квадратних дужках, наприклад [kaffe]");
      }
      if (c.extra != null) {
        if (!Array.isArray(c.extra)) v.bad("extra", "має бути список слів");
        else {
          if (c.extra.length > 30) v.bad("extra", "забагато зайвих слів (до 30)");
          c.extra.forEach(function (w, i) { if (!isStr(w)) v.bad("extra[" + (i + 1) + "]", "слово не може бути порожнім"); });
        }
      }
    },
    choice: function (c, v) {
      var qs = v.list(c, "questions", 1, 100, "питань");
      if (!qs) return;
      qs.forEach(function (q, i) {
        var p = "questions[" + (i + 1) + "]";
        if (!isObj(q)) { v.bad(p, "має бути питання"); return; }
        if (!isStr(q.q)) v.bad(p + ".q", "текст питання не може бути порожнім");
        if (q.explain != null && typeof q.explain !== "string") v.bad(p + ".explain", "має бути текст");
        if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 8) { v.bad(p + ".options", "потрібно від 2 до 8 варіантів"); return; }
        var okOpts = true;
        q.options.forEach(function (o, k) { if (!isStr(o)) { okOpts = false; v.bad(p + ".options[" + (k + 1) + "]", "варіант не може бути порожнім"); } });
        if (okOpts && !dupFree(q.options)) v.bad(p + ".options", "є однакові варіанти");
        if (!Array.isArray(q.correct) || !q.correct.length) { v.bad(p + ".correct", "познач хоча б одну правильну відповідь"); return; }
        var seen = {};
        q.correct.forEach(function (x) {
          if (!isInt(x) || x < 0 || x >= q.options.length) v.bad(p + ".correct", "номер правильної відповіді поза списком варіантів");
          else if (seen[x]) v.bad(p + ".correct", "один варіант позначено двічі");
          seen[x] = true;
        });
      });
    },
    order_words: function (c, v) {
      var ss = v.list(c, "sentences", 1, 100, "речень");
      if (!ss) return;
      ss.forEach(function (s, i) {
        var p = "sentences[" + (i + 1) + "]";
        if (!isObj(s)) { v.bad(p, "має бути речення"); return; }
        if (!isStr(s.answer)) { v.bad(p + ".answer", "речення не може бути порожнім"); return; }
        var toks = sortedTokens(s.answer);
        if (toks.length < 2) v.bad(p + ".answer", "у реченні має бути щонайменше два слова");
        if (toks.length > 30) v.bad(p + ".answer", "забагато слів (до 30)");
        if (s.alt != null) {
          if (!Array.isArray(s.alt)) v.bad(p + ".alt", "має бути список речень");
          else s.alt.forEach(function (a, k) {
            if (!isStr(a)) v.bad(p + ".alt[" + (k + 1) + "]", "речення не може бути порожнім");
            else if (!sameTokens(sortedTokens(a), toks)) v.bad(p + ".alt[" + (k + 1) + "]", "має складатися з тих самих слів, що й основне речення");
          });
        }
      });
    },
    order_sentences: function (c, v) {
      var items = v.list(c, "items", 2, 30, "речень");
      if (!items) return;
      var ok = true;
      items.forEach(function (t, i) { if (!isStr(t)) { ok = false; v.bad("items[" + (i + 1) + "]", "речення не може бути порожнім"); } });
      if (ok && !dupFree(items)) v.bad("items", "є однакові речення — порядок буде неоднозначним");
    },
    dropdown_gap: function (c, v) {
      v.str(c, "text", 20000, true);
      if (!isStr(c.text)) return;
      var s = gapStats(c.text);
      s.problems.forEach(function (p) { v.bad("text", p); });
      if (s.gaps) v.bad("text", "усі пропуски мають бути зі списком варіантів: [*правильно|неправильно|…]");
      if (!s.selects) v.bad("text", "додай хоча б один пропуск зі списком, наприклад [*dricker|dricka|drack]");
    },
    truefalse: function (c, v) {
      var st = v.list(c, "statements", 1, 100, "тверджень");
      if (!st) return;
      st.forEach(function (s, i) {
        var p = "statements[" + (i + 1) + "]";
        if (!isObj(s)) { v.bad(p, "має бути твердження"); return; }
        if (!isStr(s.text)) v.bad(p + ".text", "твердження не може бути порожнім");
        if (typeof s.answer !== "boolean") v.bad(p + ".answer", "познач, чи твердження правильне (true/false)");
        if (s.explain != null && typeof s.explain !== "string") v.bad(p + ".explain", "має бути текст");
      });
    },
    table_fill: function (c, v) {
      var hd = v.list(c, "header", 1, 12, "стовпців");
      var rows = v.list(c, "rows", 1, 100, "рядків");
      if (!hd || !rows) return;
      hd.forEach(function (x, i) { if (typeof x !== "string") v.bad("header[" + (i + 1) + "]", "має бути текст"); });
      var gaps = 0;
      rows.forEach(function (r, i) {
        var p = "rows[" + (i + 1) + "]";
        if (!Array.isArray(r)) { v.bad(p, "має бути рядок із клітинок"); return; }
        if (r.length !== hd.length) v.bad(p, "кількість клітинок (" + r.length + ") не збігається з кількістю стовпців (" + hd.length + ")");
        r.forEach(function (cell, k) {
          if (typeof cell !== "string") { v.bad(p + "[" + (k + 1) + "]", "має бути текст"); return; }
          var s = gapStats(cell);
          gaps += s.gaps;
          s.problems.forEach(function (pr) { v.bad(p + "[" + (k + 1) + "]", pr); });
          if (s.selects) v.bad(p + "[" + (k + 1) + "]", "варіанти зі «*» тут не потрібні");
        });
      });
      if (!gaps) v.bad("rows", "додай хоча б один пропуск у клітинку, наприклад [dricker]");
    },
    match: function (c, v) {
      var ps = v.list(c, "pairs", 2, 12, "пар");
      if (!ps) return;
      ps.forEach(function (p, i) {
        var f = "pairs[" + (i + 1) + "]";
        if (!isObj(p)) { v.bad(f, "має бути пара"); return; }
        ["left", "right"].forEach(function (side) {
          if (p[side] != null && typeof p[side] !== "string") v.bad(f + "." + side, "має бути текст");
          v.src(p, side + "_src", false, f + ".");
          if (!isStr(p[side]) && !p[side + "_src"]) v.bad(f + "." + side, "потрібен текст або картинка");
        });
      });
    },
    categorize: function (c, v) {
      var cols = v.list(c, "columns", 2, 6, "колонок");
      if (!cols) return;
      var all = [], total = 0;
      cols.forEach(function (col, i) {
        var p = "columns[" + (i + 1) + "]";
        if (!isObj(col)) { v.bad(p, "має бути колонка"); return; }
        if (!isStr(col.title)) v.bad(p + ".title", "назва колонки не може бути порожньою");
        if (!Array.isArray(col.items) || !col.items.length) { v.bad(p + ".items", "додай хоча б один елемент"); return; }
        col.items.forEach(function (it, k) {
          if (!isStr(it)) v.bad(p + ".items[" + (k + 1) + "]", "елемент не може бути порожнім");
          else { all.push(it); total += 1; }
        });
      });
      if (total > 60) v.bad("columns", "забагато елементів (до 60)");
      if (all.length && !dupFree(all)) v.bad("columns", "однаковий елемент у кількох місцях — відповідь буде неоднозначною");
    },
    flashcards: function (c, v) {
      var cs = v.list(c, "cards", 1, 300, "карток");
      if (!cs) return;
      cs.forEach(function (cd, i) {
        var p = "cards[" + (i + 1) + "]";
        if (!isObj(cd)) { v.bad(p, "має бути картка"); return; }
        if (!isStr(cd.front)) v.bad(p + ".front", "лицьовий бік не може бути порожнім");
        if (!isStr(cd.back)) v.bad(p + ".back", "зворотний бік не може бути порожнім");
        if (cd.front_src != null && cd.front_src !== "" && !isSrc(cd.front_src)) v.bad(p + ".front_src", "має бути файл із сховища або посилання https://");
        if (cd.audio_src != null && cd.audio_src !== "" && !isSrc(cd.audio_src)) v.bad(p + ".audio_src", "має бути файл із сховища або посилання https://");
      });
    },
    text: function (c, v) {
      v.str(c, "heading", 200, false);
      v.str(c, "body", 50000, true);
    },
    hidden_text: function (c, v) {
      v.str(c, "label", 120, true);
      v.str(c, "body", 50000, true);
    },
    table: function (c, v) {
      var hd = v.list(c, "header", 1, 12, "стовпців");
      var rows = v.list(c, "rows", 1, 200, "рядків");
      v.str(c, "caption", 300, false);
      if (!hd || !rows) return;
      hd.forEach(function (x, i) { if (typeof x !== "string") v.bad("header[" + (i + 1) + "]", "має бути текст"); });
      rows.forEach(function (r, i) {
        var p = "rows[" + (i + 1) + "]";
        if (!Array.isArray(r)) { v.bad(p, "має бути рядок із клітинок"); return; }
        if (r.length !== hd.length) v.bad(p, "кількість клітинок (" + r.length + ") не збігається з кількістю стовпців (" + hd.length + ")");
        r.forEach(function (cell, k) { if (typeof cell !== "string") v.bad(p + "[" + (k + 1) + "]", "має бути текст"); });
      });
    },
    vocabulary: function (c, v) {
      var ws = v.list(c, "words", 1, 300, "слів");
      if (!ws) return;
      ws.forEach(function (w, i) {
        var p = "words[" + (i + 1) + "]";
        if (!isObj(w)) { v.bad(p, "має бути слово"); return; }
        if (!isStr(w.word)) v.bad(p + ".word", "слово не може бути порожнім");
        if (!isStr(w.translation)) v.bad(p + ".translation", "переклад не може бути порожнім");
        if (w.example != null && typeof w.example !== "string") v.bad(p + ".example", "має бути текст");
        v.src(w, "src", false, p + ".");
        v.src(w, "audio_src", false, p + ".");
      });
    },
    audio: function (c, v) {
      v.src(c, "src", true);
      v.str(c, "caption", 300, false);
      v.str(c, "transcript", 50000, false);
    },
    video: function (c, v) {
      if (!isStr(c.src)) { v.bad("src", "потрібен файл або посилання на відео"); return; }
      if (!videoSource(c.src)) v.bad("src", "це посилання не з дозволених сервісів (YouTube, Vimeo, Bunny) і не пряме посилання на відеофайл — завантаж файл або встав інше посилання");
    },
    youtube: function (c, v) {
      if (!isStr(c.url)) { v.bad("url", "встав посилання на відео з YouTube"); return; }
      if (!youtubeEmbed(c.url)) v.bad("url", "це не схоже на посилання YouTube (https://www.youtube.com/watch?v=… або https://youtu.be/…)");
    },
    image: function (c, v) {
      v.src(c, "src", true);
      v.str(c, "alt", 300, true);
      v.str(c, "caption", 300, false);
    },
    carousel: function (c, v) { validImages(c, v, 1, 30); },
    collage: function (c, v) { validImages(c, v, 1, 30); },
    file: function (c, v) {
      v.src(c, "src", true);
      v.str(c, "name", 200, true);
      v.str(c, "note", 500, false);
    },
    link_button: function (c, v) {
      v.str(c, "label", 80, true);
      if (!isStr(c.url)) v.bad("url", "встав посилання, що починається з https://");
      else if (!isHttps(c.url)) v.bad("url", "посилання має починатися з https://");
    },
    embed: function (c, v) {
      var provs = ["wordwall", "genially", "quizlet", "iframe"];
      if (provs.indexOf(c.provider) < 0) v.bad("provider", "обери сервіс: wordwall, genially, quizlet або iframe");
      if (!isStr(c.url)) v.bad("url", "встав посилання на сервіс");
      else if (!isHttps(c.url)) v.bad("url", "посилання має починатися з https://");
      else if (c.provider === "wordwall" && /^\/(?:[a-z]{2}(?:-[A-Za-z]{2})?\/)?resource\//.test(parseHttps(c.url).pathname)) v.bad("url", "для WordWall потрібна адреса з кнопки «Embed / Вбудувати» (вона починається з https://wordwall.net/embed/…), а не звичайне посилання на вправу");
      else if (provs.indexOf(c.provider) > -1 && !safeEmbed(c.provider, c.url)) v.bad("url", "це посилання не підходить для вбудовування (потрібен дозволений сервіс і правильний вигляд адреси)");
      if (c.height != null && (!isInt(c.height) || c.height < 200 || c.height > 1200)) v.bad("height", "висота має бути цілим числом від 200 до 1200");
    },
    open_answer: function (c, v) {
      v.str(c, "question", 20000, true);
      if (c.min_words != null && (!isInt(c.min_words) || c.min_words < 0 || c.min_words > 2000)) v.bad("min_words", "має бути цілим числом від 0 до 2000");
    },
    student_file: function (c, v) {
      v.str(c, "task", 20000, true);
      if (["audio", "image", "document", "any"].indexOf(c.accept) < 0) v.bad("accept", "обери тип файлу: audio, image, document або any");
      v.bool(c, "allow_recording");
      if (c.allow_recording === true && c.accept !== "audio" && c.accept !== "any") v.bad("allow_recording", "запис голосу можливий лише для аудіо (або «будь-який файл»)");
    },
    teacher_note: function (c, v) {
      v.str(c, "body", 50000, true);
    }
  };

  function validImages(c, v, min, max) {
    var imgs = v.list(c, "images", min, max, "картинок");
    if (!imgs) return;
    imgs.forEach(function (im, i) {
      var p = "images[" + (i + 1) + "]";
      if (!isObj(im)) { v.bad(p, "має бути картинка"); return; }
      if (!isSrc(im.src)) v.bad(p + ".src", "потрібен файл із сховища або посилання https://");
      if (!isStr(im.alt)) v.bad(p + ".alt", "опиши картинку одним реченням (для екранних читалок)");
      if (im.caption != null && typeof im.caption !== "string") v.bad(p + ".caption", "має бути текст");
    });
  }

  function validate(block) {
    var errors = [], v = V(errors);
    if (!isObj(block)) return { ok: false, errors: ["block: це має бути блок"] };
    var type = block.type;
    if (typeof type !== "string" || ALL_TYPES.indexOf(type) < 0) {
      return { ok: false, errors: ["type: невідомий тип блоку «" + str(type) + "»"] };
    }
    var c = block.content;
    if (!isObj(c)) return { ok: false, errors: ["content: зміст блоку має бути заповнений"] };
    v.str(c, "title", 300, false);
    v.str(c, "instructions", 1000, false);
    VALIDATORS[type](c, v);
    return { ok: errors.length === 0, errors: errors };
  }

  /* ===============================================================
     Renderers: content, media, embeds, student work, teacher note
     =============================================================== */
  var ICONS = {
    play: '<path d="M8 5v14l11-7z"/>',
    pause: '<path d="M7 5h4v14H7zM13 5h4v14h-4z"/>',
    download: '<path d="M12 3v10m0 0l-4-4m4 4l4-4M5 17v3h14v-3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    mic: '<path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM6 11a6 6 0 0 0 12 0M12 17v4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>',
    close: '<path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
    prev: '<path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
    next: '<path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    file: '<path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM14 3v4h4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
    clip: '<path d="M20 11l-8.5 8.5a5 5 0 0 1-7-7L13 4a3.3 3.3 0 0 1 4.7 4.7L9.2 17.2a1.7 1.7 0 0 1-2.4-2.4L14.5 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    note: '<path d="M5 4h14v12l-5 4H5zM14 20v-4h5M8 9h8M8 12.5h5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>'
  };
  function ico(name) {
    var s = h("span", "fb-ico");
    s.setAttribute("aria-hidden", "true");
    s.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" focusable="false">' + (ICONS[name] || "") + "</svg>";
    return s;
  }
  function btn(cls, label, iconName) {
    var b = h("button", cls);
    b.type = "button";
    if (iconName) b.appendChild(ico(iconName));
    if (label) b.appendChild(doc().createTextNode(label));
    return b;
  }
  function iconBtn(cls, iconName, label) {
    var b = btn(cls, "", iconName);
    b.setAttribute("aria-label", label);
    return b;
  }

  /* ---- signed URLs and lazy media ---- */
  function resolveSrc(ctx, src, work) {
    return new Promise(function (resolve, reject) {
      var fn = null, p;
      if (ctx) {
        if (work && typeof ctx.workFileUrl === "function") fn = ctx.workFileUrl;
        else if (typeof ctx.signedUrl === "function") fn = ctx.signedUrl;
      }
      if (fn) p = fn(src);
      else if (isHttps(src)) p = src;
      else { reject(new Error("no signedUrl")); return; }
      Promise.resolve(p).then(function (u) {
        u = safeUrl(u);
        if (u) resolve(u); else reject(new Error("unsafe url"));
      }, reject);
    });
  }
  function errBox(text) {
    var d = h("div", "fb-ph fb-ph--err", text || T("Не вдалося завантажити."));
    d.setAttribute("role", "status");
    return d;
  }
  /* a box that shows "loading", then make(url) when the signed URL arrives */
  function lazyNode(ctx, life, src, make, work) {
    var wrap = h("div", "fb-lazy"), ph = h("div", "fb-ph", T("Завантаження…"));
    ph.setAttribute("role", "status");
    wrap.setAttribute("aria-busy", "true");
    wrap.appendChild(ph);
    resolveSrc(ctx, src, work).then(function (url) {
      if (!life.alive) return;
      clear(wrap);
      wrap.appendChild(make(url));
      wrap.removeAttribute("aria-busy");
    }, function () {
      if (!life.alive) return;
      clear(wrap);
      wrap.appendChild(errBox());
      wrap.removeAttribute("aria-busy");
    });
    return wrap;
  }
  function makeImg(url, alt) {
    var img = h("img", "fb-img");
    img.alt = str(alt);
    img.setAttribute("loading", "lazy");
    img.setAttribute("decoding", "async");
    img.addEventListener("error", function () {
      if (img.parentNode) img.parentNode.replaceChild(errBox(), img);
    });
    img.src = url;
    return img;
  }
  function stopMedia(root) {
    slice(root.querySelectorAll("audio,video")).forEach(function (m) { try { m.pause(); } catch (e) { /* ignore */ } });
  }

  /* a new-tab download after an async signed URL */
  function openUrl(url, name) {
    var a = h("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    if (name) a.setAttribute("download", name);
    a.style.display = "none";
    doc().body.appendChild(a);
    a.click();
    doc().body.removeChild(a);
  }
  function fetchAndOpen(ctx, life, src, name, button, msg, work) {
    button.disabled = true;
    msg.textContent = "";
    resolveSrc(ctx, src, work).then(function (url) {
      if (!life.alive) return;
      button.disabled = false;
      openUrl(url, name);
    }, function () {
      if (!life.alive) return;
      button.disabled = false;
      msg.textContent = T("Не вдалося отримати файл. Спробуй ще раз.");
    });
  }

  function iframeEl(url, title, allow) {
    var f = h("iframe", "fb-iframe");
    f.setAttribute("src", url);
    f.setAttribute("title", title);
    f.setAttribute("loading", "lazy");
    f.setAttribute("allowfullscreen", "");
    f.setAttribute("allow", allow || "fullscreen");
    f.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
    f.setAttribute("sandbox", "allow-scripts allow-same-origin allow-popups allow-forms allow-presentation");
    return f;
  }
  function plainLink(url, label) {
    var a = h("a", "fb-ext", label);
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    return a;
  }
  function captionEl(text) { return isStr(text) ? h("p", "fb-caption", text) : null; }
  function proseEl(mdText) {
    var d = h("div", "fb-prose");
    d.innerHTML = md(mdText);
    return d;
  }
  function none(life) { return { destroy: function () { life.end(); } }; }

  /* ---- lightbox (one shared overlay) ---- */
  var LB = null;
  function lightbox() {
    if (LB) return LB;
    var root = h("div", "fb-lightbox"), fig = h("figure", "fb-lb-fig"), img = h("img", "fb-lb-img"), cap = h("figcaption", "fb-lb-cap");
    var closeB = iconBtn("fb-lb-btn fb-lb-close", "close", T("Закрити")), prevB = iconBtn("fb-lb-btn fb-lb-prev", "prev", T("Попередня")), nextB = iconBtn("fb-lb-btn fb-lb-next", "next", T("Наступна"));
    var items = [], idx = 0, opener = null;
    root.hidden = true;
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-label", T("Перегляд картинки"));
    fig.appendChild(img); fig.appendChild(cap);
    root.appendChild(fig); root.appendChild(prevB); root.appendChild(nextB); root.appendChild(closeB);
    doc().body.appendChild(root);

    function show() {
      var it = items[idx];
      img.src = it.url;
      img.alt = str(it.alt);
      cap.textContent = str(it.caption);
      cap.hidden = !it.caption;
      prevB.hidden = nextB.hidden = items.length < 2;
    }
    function step(d) { if (items.length > 1) { idx = (idx + d + items.length) % items.length; show(); } }
    function close() {
      if (root.hidden) return;
      root.hidden = true;
      doc().documentElement.classList.remove("fb-lb-open");
      img.removeAttribute("src");
      if (opener && opener.focus && doc().body.contains(opener)) opener.focus();
      opener = null;
    }
    function open(list, i, from) {
      items = list.filter(function (x) { return x && x.url; });
      if (!items.length) return;
      idx = Math.max(0, Math.min(i, items.length - 1));
      opener = from || null;
      show();
      root.hidden = false;
      doc().documentElement.classList.add("fb-lb-open");
      closeB.focus();
    }
    closeB.addEventListener("click", close);
    prevB.addEventListener("click", function () { step(-1); });
    nextB.addEventListener("click", function () { step(1); });
    root.addEventListener("click", function (e) { if (e.target === root || e.target === fig) close(); });
    root.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { e.preventDefault(); close(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); step(-1); }
      else if (e.key === "ArrowRight") { e.preventDefault(); step(1); }
      else if (e.key === "Tab") {
        var f = [closeB, prevB, nextB].filter(function (b) { return !b.hidden; });
        var at = f.indexOf(doc().activeElement);
        e.preventDefault();
        f[(at + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
      }
    });
    LB = { open: open, close: close, el: root };
    return LB;
  }
  function zoomButton(url, item, items, getIndex) {
    var b = h("button", "fb-zoom");
    b.type = "button";
    b.setAttribute("aria-label", T("Збільшити: {alt}", { alt: item.alt }));
    b.appendChild(makeImg(url, item.alt));
    b.addEventListener("click", function () {
      var list = items(), loaded = list.filter(function (x) { return x.url; });
      lightbox().open(loaded, Math.max(0, loaded.indexOf(item)), b);
    });
    return b;
  }

  /* ---- text ---- */
  register("text", {
    render: function (el, c) {
      if (isStr(c.heading)) el.appendChild(h("h3", "fb-heading", c.heading));
      el.appendChild(proseEl(c.body));
    }
  });

  register("hidden_text", {
    render: function (el, c) {
      var d = h("details", "fb-details"), s = h("summary", "", str(c.label) || T("Показати"));
      d.appendChild(s);
      d.appendChild(proseEl(c.body));
      el.appendChild(d);
    }
  });

  register("table", {
    render: function (el, c) {
      var wrap = h("div", "fb-table-wrap"), t = h("table", "fb-tbl"), i, k, tr;
      wrap.tabIndex = 0;
      wrap.setAttribute("role", "region");
      wrap.setAttribute("aria-label", isStr(c.caption) ? c.caption : (isStr(c.title) ? c.title : T("Таблиця")));
      if (isStr(c.caption)) t.appendChild(h("caption", "", c.caption));
      var head = Array.isArray(c.header) ? c.header : [], rows = Array.isArray(c.rows) ? c.rows : [];
      var thead = h("thead"); tr = h("tr");
      for (i = 0; i < head.length; i++) { var th = h("th", "", str(head[i])); th.setAttribute("scope", "col"); tr.appendChild(th); }
      thead.appendChild(tr); t.appendChild(thead);
      var tbody = h("tbody");
      for (i = 0; i < rows.length; i++) {
        tr = h("tr");
        for (k = 0; k < (Array.isArray(rows[i]) ? rows[i].length : 0); k++) tr.appendChild(h("td", "", str(rows[i][k])));
        tbody.appendChild(tr);
      }
      t.appendChild(tbody); wrap.appendChild(t); el.appendChild(wrap);
    }
  });

  register("vocabulary", {
    render: function (el, c, ctx) {
      var life = new Life(), words = Array.isArray(c.words) ? c.words : [], list = h("ul", "fb-vocab");
      var audios = {}, current = null;
      function setOn(b, on) {
        clear(b);
        b.appendChild(ico(on ? "pause" : "play"));
        b.setAttribute("aria-pressed", on ? "true" : "false");
        b.classList.toggle("is-on", on);
      }
      function stopCurrent() {
        if (current) { try { current.audio.pause(); } catch (e) { /* ignore */ } setOn(current.btn, false); current = null; }
      }
      function play(b, i, w) {
        if (current && current.btn === b) { stopCurrent(); return; }
        stopCurrent();
        function go(a) {
          current = { btn: b, audio: a };
          setOn(b, true);
          try { a.currentTime = 0; var p = a.play(); if (p && p.catch) p.catch(function () { setOn(b, false); current = null; }); }
          catch (e) { setOn(b, false); current = null; }
        }
        if (audios[i]) { go(audios[i]); return; }
        b.disabled = true;
        resolveSrc(ctx, w.audio_src).then(function (url) {
          if (!life.alive) return;
          b.disabled = false;
          var a = doc().createElement("audio");
          a.preload = "auto"; a.src = url;
          a.addEventListener("ended", function () { setOn(b, false); if (current && current.btn === b) current = null; });
          audios[i] = a;
          go(a);
        }, function () { if (life.alive) { b.disabled = false; } });
      }
      words.forEach(function (w, i) {
        if (!isObj(w)) return;
        var li = h("li", "fb-word"), txt = h("div", "fb-word-text");
        if (w.src) {
          var pic = h("div", "fb-word-pic");
          pic.appendChild(lazyNode(ctx, life, w.src, function (url) { return makeImg(url, w.word); }));
          li.appendChild(pic);
        }
        var line = h("p", "fb-word-line");
        line.appendChild(h("strong", "fb-w", str(w.word)));
        line.appendChild(h("span", "fb-tr", str(w.translation)));
        txt.appendChild(line);
        if (isStr(w.example)) txt.appendChild(h("p", "fb-ex", w.example));
        li.appendChild(txt);
        if (w.audio_src) {
          var b = iconBtn("fb-play", "play", T("Прослухати: {word}", { word: str(w.word) }));
          b.setAttribute("aria-pressed", "false");
          b.addEventListener("click", function () { play(b, i, w); });
          li.appendChild(b);
        }
        list.appendChild(li);
      });
      el.appendChild(list);
      return { destroy: function () { stopCurrent(); life.end(); } };
    }
  });

  /* ---- media ---- */
  register("audio", {
    render: function (el, c, ctx) {
      var life = new Life(), box = h("div", "fb-audio-box");
      box.appendChild(lazyNode(ctx, life, c.src, function (url) {
        var a = h("audio", "fb-audio-el");
        a.controls = true; a.setAttribute("preload", "metadata"); a.src = url;
        return a;
      }));
      el.appendChild(box);
      var cap = captionEl(c.caption);
      if (cap) el.appendChild(cap);
      if (isStr(c.transcript)) {
        var d = h("details", "fb-details");
        d.appendChild(h("summary", "", T("Показати текст запису")));
        d.appendChild(proseEl(c.transcript));
        el.appendChild(d);
      }
      return { destroy: function () { stopMedia(el); life.end(); } };
    }
  });

  function ratioBox(child) {
    var r = h("div", "fb-ratio");
    r.appendChild(child);
    return r;
  }
  var VIDEO_ALLOW = "fullscreen; picture-in-picture; encrypted-media";

  register("video", {
    render: function (el, c, ctx) {
      var life = new Life(), vs = videoSource(c.src);
      if (!vs) {
        var u = parseHttps(c.src);
        if (u) { el.appendChild(h("p", "fb-note-line", T("Це відео не можна показати на сторінці. Відкрий його за посиланням:"))); el.appendChild(plainLink(u.href, u.href)); }
        else el.appendChild(h("p", "fb-error", T("Відео недоступне.")));
        return none(life);
      }
      if (vs.kind === "embed") {
        el.appendChild(ratioBox(iframeEl(vs.url, isStr(c.title) ? c.title : T("Відео"), VIDEO_ALLOW)));
        return none(life);
      }
      var make = function (url) {
        var v = h("video", "fb-video-el");
        v.controls = true; v.setAttribute("preload", "metadata"); v.setAttribute("playsinline", "");
        v.src = url;
        return v;
      };
      if (vs.kind === "file") { el.appendChild(make(vs.url)); }
      else el.appendChild(lazyNode(ctx, life, vs.url, make));
      return { destroy: function () { stopMedia(el); life.end(); } };
    }
  });

  register("youtube", {
    render: function (el, c) {
      var life = new Life(), e = youtubeEmbed(c.url);
      if (!e) {
        var u = parseHttps(c.url);
        if (u) el.appendChild(plainLink(u.href, u.href));
        else el.appendChild(h("p", "fb-error", T("Відео недоступне.")));
        return none(life);
      }
      el.appendChild(ratioBox(iframeEl(e, isStr(c.title) ? c.title : T("Відео з YouTube"), VIDEO_ALLOW)));
      return none(life);
    }
  });

  register("image", {
    render: function (el, c, ctx) {
      var life = new Life(), fig = h("figure", "fb-figure"), item = { url: "", alt: str(c.alt), caption: str(c.caption) };
      fig.appendChild(lazyNode(ctx, life, c.src, function (url) {
        item.url = url;
        return zoomButton(url, item, function () { return [item]; });
      }));
      if (isStr(c.caption)) fig.appendChild(h("figcaption", "fb-caption", c.caption));
      el.appendChild(fig);
      return none(life);
    }
  });

  register("carousel", {
    render: function (el, c, ctx) {
      var life = new Life(), imgs = (Array.isArray(c.images) ? c.images : []).filter(isObj), n = imgs.length, cur = 0, slides = [], dots = [];
      if (!n) { el.appendChild(h("p", "fb-error", T("Тут ще немає картинок."))); return none(life); }
      var root = h("div", "fb-car"), view = h("div", "fb-car-view"), counter = h("p", "fb-car-count");
      root.setAttribute("role", "group");
      root.setAttribute("aria-roledescription", "carousel");
      root.setAttribute("aria-label", isStr(c.title) ? c.title : T("Карусель картинок"));
      view.tabIndex = 0;
      view.setAttribute("aria-label", T("Гортай стрілками ← →"));
      counter.setAttribute("aria-live", "polite");
      imgs.forEach(function (im, i) {
        var s = h("div", "fb-slide"), box = h("div", "fb-slide-box");
        s.setAttribute("role", "group");
        s.setAttribute("aria-roledescription", "slide");
        s.setAttribute("aria-label", T("{n} з {total}", { n: i + 1, total: n }));
        s.appendChild(box);
        if (isStr(im.caption)) s.appendChild(h("p", "fb-caption", im.caption));
        view.appendChild(s);
        slides.push({ el: s, box: box, started: false, item: { url: "", alt: str(im.alt), caption: str(im.caption) } });
      });
      function ensure(i) {
        i = (i + n) % n;
        var sl = slides[i];
        if (sl.started) return;
        sl.started = true;
        sl.box.appendChild(lazyNode(ctx, life, imgs[i].src, function (url) {
          sl.item.url = url;
          return zoomButton(url, sl.item, function () { return [sl.item]; });
        }));
      }
      function go(i) {
        cur = (i + n) % n;
        slides.forEach(function (sl, k) { sl.el.hidden = k !== cur; });
        dots.forEach(function (d, k) { if (k === cur) d.setAttribute("aria-current", "true"); else d.removeAttribute("aria-current"); });
        counter.textContent = T("{n} з {total}", { n: cur + 1, total: n });
        ensure(cur); ensure(cur + 1);
      }
      var prevB = iconBtn("fb-car-btn fb-car-prev", "prev", T("Попередня картинка")), nextB = iconBtn("fb-car-btn fb-car-next", "next", T("Наступна картинка"));
      prevB.addEventListener("click", function () { go(cur - 1); });
      nextB.addEventListener("click", function () { go(cur + 1); });
      view.addEventListener("keydown", function (e) {
        if (e.key === "ArrowLeft") { e.preventDefault(); go(cur - 1); }
        else if (e.key === "ArrowRight") { e.preventDefault(); go(cur + 1); }
      });
      var sx = 0, sy = 0, tracking = false;
      view.addEventListener("touchstart", function (e) {
        var t = e.touches && e.touches[0];
        if (!t) return;
        sx = t.clientX; sy = t.clientY; tracking = true;
      }, { passive: true });
      view.addEventListener("touchend", function (e) {
        var t = e.changedTouches && e.changedTouches[0];
        if (!tracking || !t) return;
        tracking = false;
        var dx = t.clientX - sx, dy = t.clientY - sy;
        if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? cur + 1 : cur - 1);
      }, { passive: true });
      var stage = h("div", "fb-car-stage");
      stage.appendChild(view);
      if (n > 1) { stage.appendChild(prevB); stage.appendChild(nextB); }
      root.appendChild(stage);
      if (n > 1) {
        var bar = h("div", "fb-car-bar"), dotBox = h("div", "fb-dots");
        imgs.forEach(function (im, i) {
          var d = h("button", "fb-dot");
          d.type = "button";
          d.setAttribute("aria-label", T("Картинка {n}", { n: i + 1 }));
          d.addEventListener("click", function () { go(i); });
          dots.push(d); dotBox.appendChild(d);
        });
        bar.appendChild(dotBox); bar.appendChild(counter);
        root.appendChild(bar);
      }
      el.appendChild(root);
      go(0);
      return { reset: function () { go(0); }, destroy: function () { life.end(); } };
    }
  });

  register("collage", {
    render: function (el, c, ctx) {
      var life = new Life(), imgs = (Array.isArray(c.images) ? c.images : []).filter(isObj), grid = h("div", "fb-collage-grid"), items = [];
      if (!imgs.length) { el.appendChild(h("p", "fb-error", T("Тут ще немає картинок."))); return none(life); }
      imgs.forEach(function (im) {
        var fig = h("figure", "fb-col-item"), item = { url: "", alt: str(im.alt), caption: str(im.caption) };
        items.push(item);
        fig.appendChild(lazyNode(ctx, life, im.src, function (url) {
          item.url = url;
          return zoomButton(url, item, function () { return items; });
        }));
        if (isStr(im.caption)) fig.appendChild(h("figcaption", "fb-caption", im.caption));
        grid.appendChild(fig);
      });
      el.appendChild(grid);
      return none(life);
    }
  });

  register("file", {
    render: function (el, c, ctx) {
      var life = new Life(), card = h("div", "fb-file-card"), info = h("div", "fb-file-info"), msg = h("p", "fb-msg is-error");
      card.appendChild(ico("file"));
      info.appendChild(h("strong", "fb-file-name", str(c.name)));
      if (isStr(c.note)) info.appendChild(h("span", "fb-file-note", c.note));
      card.appendChild(info);
      var b = btn("btn btn-primary btn-sm fb-file-btn", T("Завантажити"), "download");
      b.addEventListener("click", function () { fetchAndOpen(ctx, life, c.src, str(c.name), b, msg); });
      card.appendChild(b);
      msg.setAttribute("role", "alert");
      el.appendChild(card); el.appendChild(msg);
      return none(life);
    }
  });

  register("link_button", {
    render: function (el, c) {
      var u = parseHttps(c.url);
      if (!u) { el.appendChild(h("p", "fb-error", T("Посилання недоступне."))); return; }
      var a = h("a", "btn btn-primary fb-linkbtn");
      a.href = u.href; a.target = "_blank"; a.rel = "noopener noreferrer";
      a.appendChild(doc().createTextNode(str(c.label) || u.hostname));
      a.appendChild(ico("external"));
      el.appendChild(a);
    }
  });

  var PROVIDER_NAME = { wordwall: "WordWall", genially: "Genially", quizlet: "Quizlet", iframe: "" };
  register("embed", {
    render: function (el, c) {
      var life = new Life(), url = safeEmbed(c.provider, c.url), orig = parseHttps(c.url);
      if (!url) {
        if (orig) {
          el.appendChild(h("p", "fb-note-line", T("Цей сервіс не можна показати на сторінці. Відкрий його за посиланням:")));
          el.appendChild(plainLink(orig.href, orig.href));
        } else el.appendChild(h("p", "fb-error", T("Посилання недоступне.")));
        return none(life);
      }
      var ht = isInt(c.height) && c.height >= 200 && c.height <= 1200 ? c.height : 480;
      var name = PROVIDER_NAME[c.provider] || "";
      var wrap = h("div", "fb-embed-frame"), f = iframeEl(url, isStr(c.title) ? c.title : (name ? T("Вправа: {name}", { name: name }) : T("Вбудований сервіс")), "fullscreen");
      f.style.height = ht + "px";
      wrap.appendChild(f);
      el.appendChild(wrap);
      var link = plainLink(orig ? orig.href : url, T("Відкрити в новій вкладці"));
      link.className = "fb-ext fb-embed-link";
      el.appendChild(link);
      return none(life);
    }
  });

  /* ---- teacher note ---- */
  register("teacher_note", {
    render: function (el, c, ctx) {
      if (!teacherView(ctx)) return;
      var box = h("div", "fb-tnote"), tag = h("p", "fb-tnote-tag");
      tag.appendChild(ico("note"));
      tag.appendChild(doc().createTextNode(T("Нотатка вчителя — тільки для тебе")));
      box.appendChild(tag);
      box.appendChild(proseEl(c.body));
      el.appendChild(box);
    }
  });

  /* ===============================================================
     Student work (open_answer, student_file)
     =============================================================== */
  function workState(ctx, id) {
    var w = ctx && ctx.work && ctx.work[id];
    if (!isObj(w) || (w.status !== "submitted" && w.status !== "reviewed")) return null;
    return {
      status: w.status,
      text: str(w.text),
      files: Array.isArray(w.files) ? w.files.filter(isObj).map(function (f) { return { path: str(f.path), name: str(f.name) }; }) : [],
      feedback: str(w.feedback),
      score: typeof w.score === "number" ? w.score : null,
      reviewed_at: w.reviewed_at || null
    };
  }
  /* what the student sees after sending: the row from onSubmitWork when it has one */
  function mergeSent(payload, row) {
    var st = {
      status: "submitted",
      text: str(payload.text),
      files: (payload.files || []).map(function (f) { return { path: "", name: str(f && f.name) }; }),
      feedback: "", score: null, reviewed_at: null
    };
    if (isObj(row)) {
      if (row.status === "reviewed") st.status = "reviewed";
      if (typeof row.text === "string") st.text = row.text;
      if (Array.isArray(row.files)) st.files = row.files.filter(isObj).map(function (f) { return { path: str(f.path), name: str(f.name) }; });
      if (typeof row.feedback === "string") st.feedback = row.feedback;
      if (typeof row.score === "number") st.score = row.score;
      if (row.reviewed_at) st.reviewed_at = row.reviewed_at;
    }
    return st;
  }
  function sendWork(ctx, id, payload) {
    if (modeOf(ctx) === "preview" || !ctx || typeof ctx.onSubmitWork !== "function") return Promise.resolve(null);
    return Promise.resolve().then(function () { return ctx.onSubmitWork(id, payload); });
  }
  function rememberWork(ctx, id, st) {
    if (modeOf(ctx) !== "preview" && ctx && isObj(ctx.work)) ctx.work[id] = st;
  }
  function chip(state) {
    var rev = state.status === "reviewed";
    return h("p", "fb-chip " + (rev ? "is-reviewed" : "is-submitted"), rev ? T("Перевірено") : T("Надіслано, Марія перевірить"));
  }
  function feedbackBox(state) {
    if (state.status !== "reviewed" || (!isStr(state.feedback) && state.score == null)) return null;
    var box = h("div", "fb-feedback");
    box.appendChild(h("h4", "fb-feedback-title", T("Відгук Марії")));
    if (isStr(state.feedback)) box.appendChild(proseEl(state.feedback));
    if (state.score != null) box.appendChild(h("p", "fb-score", T("Оцінка: {score}", { score: state.score })));
    return box;
  }
  function fmtSize(n) {
    if (n >= 1048576) return T("{n} МБ", { n: (Math.round(n / 104857.6) / 10).toFixed(1) });
    return T("{n} КБ", { n: Math.max(1, Math.round(n / 1024)) });
  }
  function objectUrl(blob) {
    var U = window.URL || URL;
    try { return U && U.createObjectURL ? U.createObjectURL(blob) : null; } catch (e) { return null; }
  }
  function revokeUrl(u) {
    var U = window.URL || URL;
    try { if (u && U && U.revokeObjectURL) U.revokeObjectURL(u); } catch (e) { /* ignore */ }
  }
  function isAudioName(name) { return /\.(mp3|m4a|wav|ogg|oga|webm|aac|flac)$/i.test(str(name)); }

  /* files that were already sent: name + player / open button */
  function sentFilesList(ctx, life, files) {
    var ul = h("ul", "fb-sent-files");
    files.forEach(function (f) {
      var li = h("li", "fb-sent-file");
      li.appendChild(h("span", "fb-sent-name", f.name || T("Файл")));
      if (f.path) {
        if (isAudioName(f.name)) {
          li.appendChild(lazyNode(ctx, life, f.path, function (url) {
            var a = h("audio", "fb-audio-el"); a.controls = true; a.setAttribute("preload", "none"); a.src = url; return a;
          }, true));
        } else {
          var msg = h("span", "fb-msg is-error"), b = btn("btn btn-ghost btn-sm", T("Відкрити"), "external");
          b.addEventListener("click", function () { fetchAndOpen(ctx, life, f.path, f.name, b, msg, true); });
          li.appendChild(b); li.appendChild(msg);
        }
      }
      ul.appendChild(li);
    });
    return ul;
  }

  function liveBox() {
    var p = h("p", "fb-msg");
    p.setAttribute("role", "status");
    return p;
  }
  function say(live, text, isError) {
    live.textContent = text || "";
    live.className = "fb-msg" + (text ? (isError ? " is-error" : " is-ok") : "");
    live.setAttribute("role", isError ? "alert" : "status");
  }

  /* What the student reads when sending failed (err.code comes from account.js). */
  function typeNotAllowedText(accept) {
    var head = T("Такий тип файлу не підходить."), list;
    if (accept === "audio") list = T("Можна: аудіо (MP3, M4A, AAC, WAV, OGG, FLAC, WebM).");
    else if (accept === "image") list = T("Можна: зображення (JPG, PNG, WebP, GIF, HEIC).");
    else if (accept === "document") list = T("Можна: PDF, Word (DOC, DOCX), ODT, TXT.");
    else list = T("Можна: аудіо (MP3, M4A, AAC, WAV, OGG, FLAC, WebM), зображення (JPG, PNG, WebP, GIF, HEIC), PDF, Word (DOC, DOCX), ODT, TXT.");
    return head + " " + list;
  }
  function sendFailText(err, accept) {
    var code = err && err.code;
    if (code === "type_not_allowed") return typeNotAllowedText(accept);
    if (code === "too_many_files") return T("Можна додати не більше {n} файлів.", { n: MAX_FILES });
    if (code === "file_too_large") return T("Файл завеликий: найбільший розмір — 20 МБ.");
    return T("Не вдалося надіслати. Спробуй ще раз.");
  }
  /* The work was reviewed while the page was open: ask the page for the fresh
     row (ctx.reloadWork, optional). Calls done(true) when the block can now
     show the «Перевірено» state, otherwise done(false). */
  function reloadReviewed(ctx, id, done) {
    if (!ctx || typeof ctx.reloadWork !== "function") { done(false); return; }
    var p;
    try { p = Promise.resolve(ctx.reloadWork(id)); } catch (e) { done(false); return; }
    p.then(function () {
      var st = workState(ctx, id);
      done(!!st && st.status === "reviewed", st);
    }, function () { done(false); });
  }

  register("open_answer", {
    render: function (el, c, ctx, block) {
      var id = blockIdOf(el, block), life = new Life(), preview = modeOf(ctx) === "preview";
      var state = workState(ctx, id), busy = false;
      var min = isInt(c.min_words) && c.min_words > 0 ? c.min_words : 0;
      var draft = state ? state.text : "";
      var root = h("div", "fb-work"), live = liveBox();
      el.appendChild(proseEl(c.question));
      el.appendChild(root);
      el.appendChild(live);

      function draw() {
        clear(root);
        var reviewed = !!state && state.status === "reviewed";
        if (state) root.appendChild(chip(state));
        var tid = nextId("fb-ta-"), label = h("label", "sr-only", T("Твоя відповідь"));
        label.setAttribute("for", tid);
        var ta = h("textarea", "fb-textarea");
        ta.id = tid; ta.rows = 7;
        ta.setAttribute("maxlength", "20000");
        ta.setAttribute("placeholder", T("Напиши свою відповідь тут…"));
        ta.value = draft;
        if (reviewed) ta.setAttribute("readonly", "");
        root.appendChild(label); root.appendChild(ta);
        if (reviewed) {
          var fb = feedbackBox(state);
          if (fb) root.appendChild(fb);
          return;
        }
        var count = h("p", "fb-count"), send = btn("btn btn-primary fb-send", state ? T("Надіслати ще раз") : T("Надіслати Марії"));
        function update() {
          var words = countWords(ta.value);
          count.textContent = min ? T("Слів: {n} з {min}", { n: words, min: min }) : T("Слів: {n}", { n: words });
          count.classList.toggle("is-ok", !!min && words >= min);
          send.disabled = busy || !/\S/.test(ta.value) || words < min;
          send.textContent = busy ? T("Надсилаю…") : (state ? T("Надіслати ще раз") : T("Надіслати Марії"));
        }
        ta.addEventListener("input", function () { draft = ta.value; update(); });
        send.addEventListener("click", function () {
          busy = true; update(); say(live, "");
          var payload = { text: ta.value, kind: "open_answer" };
          sendWork(ctx, id, payload).then(function (row) {
            if (!life.alive) return;
            busy = false;
            state = mergeSent(payload, row);
            rememberWork(ctx, id, state);
            draft = state.text;
            draw();
            say(live, state.status === "reviewed" ? "" : T("Надіслано. Марія перевірить."));
          }, function (err) {
            if (!life.alive) return;
            if (err && err.code === "already_reviewed") {
              reloadReviewed(ctx, id, function (ok, st) {
                if (!life.alive) return;
                busy = false;
                if (ok) { state = st; draft = st.text; draw(); say(live, T("Марія вже перевірила цю роботу.")); }
                else { update(); say(live, sendFailText(err), true); }
              });
              return;
            }
            busy = false; update();
            say(live, sendFailText(err), true);
          });
        });
        root.appendChild(count);
        if (preview) root.appendChild(h("p", "fb-preview-note", T("Перегляд: відповідь нікуди не надсилається.")));
        root.appendChild(send);
        update();
      }
      draw();
      return { destroy: function () { life.end(); } };
    }
  });

  /* ---- voice recording ---- */
  function recorderSupported() {
    var w = window, nav = w.navigator;
    return !!(w.MediaRecorder && nav && nav.mediaDevices && typeof nav.mediaDevices.getUserMedia === "function");
  }
  function pickMime() {
    var list = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"], i, MR = window.MediaRecorder;
    if (!MR || typeof MR.isTypeSupported !== "function") return "";
    for (i = 0; i < list.length; i++) { if (MR.isTypeSupported(list[i])) return list[i]; }
    return "";
  }
  function stopTracks(stream) {
    try { stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) { /* ignore */ }
  }
  function makeFile(blob, name, type) {
    try { return new window.File([blob], name, { type: type }); }
    catch (e) { try { blob.name = name; } catch (e2) { /* ignore */ } return blob; }
  }
  var MAX_REC_SECONDS = 900;

  register("student_file", {
    render: function (el, c, ctx, block) {
      var id = blockIdOf(el, block), life = new Life(), preview = modeOf(ctx) === "preview";
      var accept = ["audio", "image", "document"].indexOf(c.accept) > -1 ? c.accept : "any";
      var recWanted = c.allow_recording === true && (accept === "audio" || accept === "any");
      var canRec = recWanted && recorderSupported();
      var state = workState(ctx, id), busy = false, picked = [], rec = null, starting = false;
      var root = h("div", "fb-work"), statusSlot = h("div", "fb-slot"), sentSlot = h("div", "fb-slot"), form = h("div", "fb-form"), fbSlot = h("div", "fb-slot"), live = liveBox();
      el.appendChild(proseEl(c.task));
      root.appendChild(statusSlot); root.appendChild(sentSlot); root.appendChild(form); root.appendChild(fbSlot);
      el.appendChild(root); el.appendChild(live);

      var hintTexts = {
        audio: T("Аудіофайл до 20 МБ."),
        image: T("Зображення до 20 МБ."),
        document: T("Документ (PDF, Word, текст) до 20 МБ."),
        any: T("Аудіо, зображення або документ, до 20 МБ кожен файл.")
      };
      form.appendChild(h("p", "fb-hint", hintTexts[accept]));

      var input = h("input", "fb-file-input");
      input.type = "file"; input.multiple = true; input.tabIndex = -1;
      input.setAttribute("accept", acceptAttr(accept));
      input.setAttribute("aria-hidden", "true");
      var tools = h("div", "fb-tools");
      var pickB = btn("btn btn-ghost fb-pick", T("Вибрати файл"), "clip");
      pickB.addEventListener("click", function () { input.click(); });
      tools.appendChild(pickB);
      var recB = null, timerEl = null;
      if (canRec) {
        recB = btn("btn btn-ghost fb-rec-btn", T("Записати голос"), "mic");
        timerEl = h("span", "fb-rec-time");
        timerEl.hidden = true;
        tools.appendChild(recB); tools.appendChild(timerEl);
      }
      form.appendChild(input); form.appendChild(tools);
      if (recWanted && !canRec) form.appendChild(h("p", "fb-hint", T("Запис голосу в цьому браузері не працює — додай аудіофайл.")));
      var listEl = h("ul", "fb-picked");
      form.appendChild(listEl);
      var noteId = nextId("fb-note-"), noteLabel = h("label", "fb-note-label", T("Коментар для Марії (необов'язково)"));
      noteLabel.setAttribute("for", noteId);
      var note = h("textarea", "fb-textarea fb-textarea--short");
      note.id = noteId; note.rows = 2;
      note.setAttribute("maxlength", "2000");
      form.appendChild(noteLabel); form.appendChild(note);
      if (preview) form.appendChild(h("p", "fb-preview-note", T("Перегляд: файли нікуди не надсилаються.")));
      var send = btn("btn btn-primary fb-send", T("Надіслати Марії"));
      form.appendChild(send);

      function updateSend() {
        send.disabled = busy || !!rec || !picked.length;
        send.textContent = busy ? T("Надсилаю…") : (state ? T("Надіслати ще раз") : T("Надіслати Марії"));
        pickB.disabled = busy || !!rec;
        if (recB) recB.disabled = busy;
      }
      function drawPicked() {
        clear(listEl);
        picked.forEach(function (p) {
          var li = h("li", "fb-picked-item"), top = h("div", "fb-picked-top");
          top.appendChild(h("span", "fb-picked-name", p.file.name || T("Запис голосу")));
          top.appendChild(h("span", "fb-picked-size", fmtSize(p.file.size || 0)));
          var rm = btn("fb-link", T("Прибрати"));
          rm.addEventListener("click", function () {
            revokeUrl(p.url);
            picked.splice(picked.indexOf(p), 1);
            drawPicked(); updateSend(); say(live, "");
          });
          top.appendChild(rm);
          li.appendChild(top);
          if (p.url && fileKindOk("audio", p.file.type, p.file.name)) {
            var a = h("audio", "fb-audio-el"); a.controls = true; a.setAttribute("preload", "metadata"); a.src = p.url;
            li.appendChild(a);
          }
          listEl.appendChild(li);
        });
      }
      function problemText(file, p) {
        var nm = file.name || T("Файл");
        if (p === "size") return T("«{name}» завелике: найбільший розмір — 20 МБ.", { name: nm });
        if (p === "empty") return T("«{name}» порожній.", { name: nm });
        return "«" + nm + "»: " + typeNotAllowedText(accept);
      }
      /* -> null when added, else the message for the student */
      function addFile(file, fromRec) {
        var p = fileProblem(file, accept);
        if (p) return problemText(file, p);
        if (picked.length >= MAX_FILES) return T("Можна додати не більше {n} файлів.", { n: MAX_FILES });
        picked.push({ file: file, url: fromRec || fileKindOk("audio", file.type, file.name) ? objectUrl(file) : null, rec: !!fromRec });
        return null;
      }
      input.addEventListener("change", function () {
        var files = slice(input.files || []), msgs = [];
        files.forEach(function (f) {
          var m = addFile(f, false);
          if (m) msgs.push(m);
        });
        say(live, msgs.join(" "), msgs.length > 0);
        try { input.value = ""; } catch (e) { /* ignore */ }
        drawPicked(); updateSend();
      });

      /* recording */
      function setRecUi(on) {
        if (!recB) return;
        clear(recB);
        recB.appendChild(ico(on ? "stop" : "mic"));
        recB.appendChild(doc().createTextNode(on ? T("Зупинити запис") : (hasRec() ? T("Записати ще раз") : T("Записати голос"))));
        recB.classList.toggle("is-recording", on);
        timerEl.hidden = !on;
      }
      function hasRec() { return picked.some(function (p) { return p.rec; }); }
      function fmtTime(s) { return Math.floor(s / 60) + ":" + (s % 60 < 10 ? "0" : "") + (s % 60); }
      function endRecording(keep) {
        if (!rec) return;
        var r = rec;
        rec = null;
        clearInterval(r.timer);
        r.keep = keep;
        try { if (r.mr.state !== "inactive") r.mr.stop(); else r.finish(); } catch (e) { r.finish(); }
      }
      function startRecording() {
        say(live, "");
        if (picked.length >= MAX_FILES && !hasRec()) { say(live, T("Можна додати не більше {n} файлів.", { n: MAX_FILES }), true); return; }
        if (starting) return;
        starting = true;
        function failStart() {
          if (!life.alive) return;
          say(live, T("Не вдалося почати запис. Додай аудіофайл."), true);
        }
        var gum;
        try { gum = window.navigator.mediaDevices.getUserMedia({ audio: true }); }
        catch (e) { starting = false; failStart(); return; }
        gum.then(function (stream) {
          starting = false;
          if (!life.alive) { stopTracks(stream); return; }
          var mime = pickMime(), mr, chunks = [], opts = { audioBitsPerSecond: 64000 };
          if (mime) opts.mimeType = mime;
          try { mr = new window.MediaRecorder(stream, opts); }
          catch (e) { stopTracks(stream); failStart(); return; }
          var r = { mr: mr, secs: 0, keep: true, done: false, timer: 0, finish: null };
          r.finish = function () {
            if (r.done) return;
            r.done = true;
            stopTracks(stream);
            if (!r.keep || !life.alive) { setRecUi(false); updateSend(); return; }
            var type = str(mr.mimeType || mime || "audio/webm").split(";")[0];
            var ext = type.indexOf("mp4") > -1 ? "m4a" : (type.indexOf("ogg") > -1 ? "ogg" : "webm");
            var blob = new window.Blob(chunks, { type: type });
            var file = makeFile(blob, "voice-" + new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14) + "." + ext, type);
            picked = picked.filter(function (p) { if (p.rec) { revokeUrl(p.url); return false; } return true; });
            var problem = addFile(file, true);
            if (problem) say(live, problem, true);
            drawPicked(); setRecUi(false); updateSend();
          };
          mr.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
          mr.onstop = function () { r.finish(); };
          mr.onerror = function () { rec = null; clearInterval(r.timer); r.keep = false; r.finish(); say(live, T("Запис перервано. Спробуй ще раз або додай аудіофайл."), true); };
          rec = r;
          try {
            mr.start();
            timerEl.textContent = fmtTime(0);
            setRecUi(true); updateSend();
            r.timer = setInterval(function () {
              r.secs += 1;
              timerEl.textContent = fmtTime(r.secs);
              if (r.secs >= MAX_REC_SECONDS) endRecording(true);
            }, 1000);
          } catch (e) {
            /* could not start: free the microphone, go back to the idle state */
            rec = null; r.keep = false; r.done = true;
            clearInterval(r.timer);
            stopTracks(stream);
            setRecUi(false); updateSend();
            failStart();
          }
        }, function (err) {
          starting = false;
          if (!life.alive) return;
          var nm = err && err.name;
          if (nm === "NotAllowedError" || nm === "SecurityError") say(live, T("Немає доступу до мікрофона. Дозволь його в налаштуваннях браузера або додай аудіофайл."), true);
          else if (nm === "NotFoundError") say(live, T("Мікрофон не знайдено. Додай аудіофайл."), true);
          else say(live, T("Не вдалося почати запис. Додай аудіофайл."), true);
        });
      }
      if (recB) recB.addEventListener("click", function () { if (rec) endRecording(true); else startRecording(); });

      /* status / sent files / feedback */
      function drawState() {
        clear(statusSlot); clear(sentSlot); clear(fbSlot);
        if (!state) return;
        statusSlot.appendChild(chip(state));
        if (state.files.length || isStr(state.text)) {
          var box = h("div", "fb-sent");
          box.appendChild(h("p", "fb-sent-title", T("Надіслано:")));
          if (state.files.length) box.appendChild(sentFilesList(ctx, life, state.files));
          if (isStr(state.text)) box.appendChild(h("p", "fb-sent-text", state.text));
          sentSlot.appendChild(box);
        }
        var fb = feedbackBox(state);
        if (fb) fbSlot.appendChild(fb);
        form.hidden = state.status === "reviewed";
      }

      send.addEventListener("click", function () {
        busy = true; updateSend(); say(live, "");
        var payload = { text: note.value, files: picked.map(function (p) { return p.file; }), kind: "student_file" };
        sendWork(ctx, id, payload).then(function (row) {
          if (!life.alive) return;
          busy = false;
          state = mergeSent(payload, row);
          rememberWork(ctx, id, state);
          picked.forEach(function (p) { revokeUrl(p.url); });
          picked = []; note.value = "";
          drawPicked(); drawState(); updateSend();
          if (recB) setRecUi(false);
          say(live, state.status === "reviewed" ? "" : T("Надіслано. Марія перевірить."));
        }, function (err) {
          if (!life.alive) return;
          if (err && err.code === "already_reviewed") {
            reloadReviewed(ctx, id, function (ok, st) {
              if (!life.alive) return;
              busy = false;
              if (ok) {
                state = st;
                picked.forEach(function (p) { revokeUrl(p.url); });
                picked = []; note.value = "";
                drawPicked(); drawState(); updateSend();
                if (recB) setRecUi(false);
                say(live, T("Марія вже перевірила цю роботу."));
              } else { updateSend(); say(live, sendFailText(err, accept), true); }
            });
            return;
          }
          busy = false; updateSend();
          say(live, sendFailText(err, accept), true);
        });
      });

      life.on(function () {
        if (rec) { rec.keep = false; clearInterval(rec.timer); try { if (rec.mr.state !== "inactive") rec.mr.stop(); } catch (e) { /* ignore */ } rec.finish(); rec = null; }
        picked.forEach(function (p) { revokeUrl(p.url); });
      });
      drawState(); updateSend();
      return { destroy: function () { life.end(); } };
    }
  });


  window.FMMBlocks = {
    register: register,
    types: types,
    render: render,
    renderAll: renderAll,
    validate: validate,
    parseGaps: parseGaps,
    md: md,
    safeEmbed: safeEmbed,
    _check: {
      allTypes: ALL_TYPES.slice(),
      normalise: normalise,
      fold: fold,
      gap: checkGap,
      gapProblems: function (t) { return scanGaps(t).problems; },
      gapStats: gapStats,
      countWords: countWords,
      youtubeEmbed: youtubeEmbed,
      videoSource: videoSource,
      detectProvider: detectProvider,
      isStoragePath: isStoragePath,
      isSrc: isSrc,
      isHttps: isHttps,
      safeUrl: safeUrl,
      fileProblem: fileProblem,
      maxFile: MAX_FILE
    }
  };
})();
