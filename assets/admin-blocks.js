/* =====================================================================
   Fika med Maria — lesson builder for the admin area (admin.html).
   Ukrainian only. Loaded before assets/admin.js.

   What is in here
   1. Pure helpers (tables, links, markdown buttons, summaries ...) —
      exported for the tests when there is no page.
   2. window.FMMBlockEditors — the registry (register / list) that
      assets/admin-blocks-exercises.js also writes into.
   3. Editors (friendly forms, never raw JSON) for: text, hidden_text,
      table, vocabulary, audio, video, youtube, image, carousel, collage,
      file, link_button, embed, open_answer, student_file, teacher_note.
   4. The builder shell: FMMBlockEditors.mount(el, options) draws the list
      of blocks of one lesson with the palette «+ Додати блок», the editor
      window with a live preview and the unsaved-changes warning. The
      database work is done by admin.js through options.deps.

   Spec: fikamedmaria-backend/docs/blocks-spec.md, section 2 «Editors».
   Everything that comes from the database goes on the page with
   textContent; the only innerHTML is our own icon strings.
   ===================================================================== */
(function () {
  "use strict";

  /* =================================================================
     1. Pure helpers
     ================================================================= */
  var GROUPS = [
    ["exercise", "Вправи"],
    ["content", "Текст і таблиці"],
    ["media", "Медіа"],
    ["embed", "Вбудовані сервіси"],
    ["work", "Робота учня"],
    ["teacher", "Для вчителя"]
  ];

  function str(x) { return x == null ? "" : String(x); }
  function trim(s) { return str(s).replace(/^\s+|\s+$/g, ""); }
  function clone(x) { return x == null ? x : JSON.parse(JSON.stringify(x)); }
  function assign(t) {
    var i, k, s;
    for (i = 1; i < arguments.length; i++) {
      s = arguments[i];
      if (!s) continue;
      for (k in s) { if (Object.prototype.hasOwnProperty.call(s, k)) t[k] = s[k]; }
    }
    return t;
  }
  function num(x) { var n = Number(x); return isFinite(n) ? n : 0; }
  function isArr(x) { return Object.prototype.toString.call(x) === "[object Array]"; }

  function moveInArray(arr, i, dir) {
    var j = i + dir, c = arr.slice(), t;
    if (i < 0 || i >= arr.length || j < 0 || j >= arr.length) return c;
    t = c[i]; c[i] = c[j]; c[j] = t;
    return c;
  }
  function removeAt(arr, i) { var c = arr.slice(); if (i >= 0 && i < c.length) c.splice(i, 1); return c; }

  function parseUrl(s) { try { return new URL(s); } catch (_) { return null; } }
  function hostOf(s) {
    var u = parseUrl(str(s));
    return u ? u.hostname.toLowerCase() : "";
  }
  function isHttps(s) { return /^https:\/\/[^\s/]+\.[^\s/]+/i.test(trim(s)); }
  function isLink(s) { return /^https?:\/\//i.test(str(s)); }

  /* "Урок 1.mp3" in a storage path "12/1730000000000-urok-1.mp3" -> "urok-1.mp3" */
  function fileLabel(src) {
    src = trim(src);
    if (!src) return "";
    if (isLink(src)) return hostOf(src) || src;
    return src.replace(/^.*\//, "").replace(/^\d{10,}-/, "");
  }

  function titleFromFilename(name) {
    var base = str(name).replace(/^.*[\\\/]/, "").replace(/\.[^.]*$/, "").replace(/[_]+/g, " ").replace(/\s+/g, " ");
    return trim(base) || "Файл";
  }

  /* Plain text out of the tiny markdown (for one-line summaries) */
  function stripMd(s) {
    return str(s)
      .replace(/\[([^\]\n]+)\]\([^)\s]*\)/g, "$1")
      .replace(/^\s*(#{1,6}|>|-)\s+/gm, "")
      .replace(/[*_`]/g, "")
      .replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "");
  }
  function cut(s, n) {
    s = str(s);
    return s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…" : s;
  }

  function plural(n, one, few, many) {
    var a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return many;
    if (b > 1 && b < 5) return few;
    if (b === 1) return one;
    return many;
  }

  /* ---------- tables ---------- */
  function blankRow(n) { var r = [], i; for (i = 0; i < n; i++) r.push(""); return r; }

  /* Makes sure header and every row have the same number of cells, >= 1 column, >= 1 row. */
  function normalizeTable(c) {
    c = c || {};
    var header = isArr(c.header) ? c.header.map(str) : [];
    var rows = isArr(c.rows) ? c.rows.map(function (r) { return isArr(r) ? r.map(str) : []; }) : [];
    var cols = header.length;
    rows.forEach(function (r) { if (r.length > cols) cols = r.length; });
    if (cols < 1) cols = 1;
    while (header.length < cols) header.push("");
    rows = rows.map(function (r) { r = r.slice(); while (r.length < cols) r.push(""); return r; });
    if (!rows.length) rows = [blankRow(cols)];
    return assign({}, c, { header: header, rows: rows });
  }
  function tableAddRow(c) { c = normalizeTable(c); c.rows.push(blankRow(c.header.length)); return c; }
  function tableAddCol(c) {
    c = normalizeTable(c);
    c.header.push("");
    c.rows.forEach(function (r) { r.push(""); });
    return c;
  }
  function tableRemoveRow(c, i) {
    c = normalizeTable(c);
    if (c.rows.length > 1) c.rows = removeAt(c.rows, i);
    return c;
  }
  function tableRemoveCol(c, j) {
    c = normalizeTable(c);
    if (c.header.length > 1) {
      c.header = removeAt(c.header, j);
      c.rows = c.rows.map(function (r) { return removeAt(r, j); });
    }
    return c;
  }
  function tableSet(c, r, col, value) {
    c = normalizeTable(c);
    if (r === -1) { if (col >= 0 && col < c.header.length) c.header[col] = str(value); }
    else if (c.rows[r] && col >= 0 && col < c.header.length) c.rows[r][col] = str(value);
    return c;
  }
  /* Text copied from Excel / Google Sheets (tabs and new lines) goes into the grid from cell (r, col). */
  function tablePaste(c, r, col, text) {
    c = normalizeTable(c);
    var lines = str(text).replace(/\r\n?/g, "\n").replace(/\n+$/, "").split("\n");
    var i, j, rr, cc;
    for (i = 0; i < lines.length; i++) {
      var cells = lines[i].split("\t");
      rr = r === -1 ? (i === 0 ? -1 : i - 1) : r + i;
      for (j = 0; j < cells.length; j++) {
        cc = col + j;
        while (cc >= c.header.length) c = tableAddCol(c);
        while (rr >= c.rows.length) c = tableAddRow(c);
        c = tableSet(c, rr, cc, cells[j]);
      }
    }
    return c;
  }

  /* ---------- video / youtube / embed links ---------- */
  function youtubeId(raw) {
    var s = trim(raw), u, host, path, m, id = "";
    if (!s) return "";
    if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
    if (!/^https?:\/\//i.test(s)) s = "https://" + s;
    u = parseUrl(s);
    if (!u) return "";
    host = u.hostname.toLowerCase().replace(/^www\./, "").replace(/^m\./, "");
    path = u.pathname || "/";
    if (host === "youtu.be") {
      m = /^\/([A-Za-z0-9_-]{11})(?:[/?]|$)/.exec(path);
      if (m) id = m[1];
    } else if (host === "youtube.com" || host === "youtube-nocookie.com" || host === "music.youtube.com") {
      if (/^\/watch\/?$/.test(path)) id = u.searchParams.get("v") || "";
      else {
        m = /^\/(?:embed|shorts|live|v)\/([A-Za-z0-9_-]{11})(?:[/?]|$)/.exec(path);
        if (m) id = m[1];
      }
    }
    return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : "";
  }

  var VIDEO_HELP = "Для відео працюють: завантажений файл, посилання Vimeo, Bunny чи YouTube або пряме посилання на файл .mp4.";

  /* A pasted page address of a video -> the address of its player. */
  function videoLink(raw) {
    var s = trim(raw), u, host, path, m, id;
    if (!s) return { ok: false, error: "Встав посилання на відео." };
    if (!/^https?:\/\//i.test(s)) {
      if (/^[A-Za-z0-9.-]+\.[A-Za-z]{2,}(\/|$)/.test(s)) s = "https://" + s;
      else return { ok: false, error: VIDEO_HELP };
    }
    u = parseUrl(s);
    if (!u || !u.hostname) return { ok: false, error: "Це не схоже на посилання. " + VIDEO_HELP };
    host = u.hostname.toLowerCase().replace(/^www\./, "");
    path = u.pathname || "/";
    if (host === "vimeo.com" || host === "player.vimeo.com") {
      m = /\/video\/(\d+)\/?$/.exec(path) || /\/(\d+)(?:\/([0-9a-f]+))?\/?$/.exec(path);
      if (!m) return { ok: false, error: "Не бачу номера відео в посиланні Vimeo. Відкрий відео й скопіюй адресу з браузера." };
      var hash = u.searchParams.get("h") || m[2] || "";
      if (hash && !/^[0-9a-f]+$/i.test(hash)) hash = "";
      return { ok: true, url: "https://player.vimeo.com/video/" + m[1] + (hash ? "?h=" + hash : ""), host: "Vimeo" };
    }
    id = youtubeId(s);
    if (host === "youtube.com" || host === "m.youtube.com" || host === "youtu.be" || host === "youtube-nocookie.com") {
      if (id) return { ok: true, url: "https://www.youtube-nocookie.com/embed/" + id, host: "YouTube" };
      return { ok: false, error: "Не бачу номера відео в посиланні YouTube. Відкрий відео й скопіюй адресу з браузера." };
    }
    if (host === "iframe.mediadelivery.net" || host === "player.mediadelivery.net" || host === "video.bunnycdn.com") {
      m = /^\/(?:embed|play)\/(\d+)\/([0-9a-fA-F-]{20,})\/?$/.exec(path);
      if (m) return { ok: true, url: "https://iframe.mediadelivery.net/embed/" + m[1] + "/" + m[2], host: "Bunny" };
      return { ok: false, error: "Не бачу номера відео в посиланні Bunny. Скопіюй адресу, що має вигляд …/play/12345/абвгд-…" };
    }
    if (/\.(mp4|webm|ogv|mov|m4v)$/i.test(path)) return { ok: true, url: u.href, host: "відеофайл" };
    return { ok: false, error: VIDEO_HELP };
  }

  /* Plain https link for a picture / sound / file kept outside our storage. */
  function httpsLink(raw) {
    var s = trim(raw), u;
    if (!s) return { ok: false, error: "" };
    if (/^(javascript|data|vbscript|file|mailto|tel|blob|ftp):/i.test(s)) return { ok: false, error: "Можна додати тільки посилання, що починається з https://" };
    if (/^http:\/\//i.test(s)) s = s.replace(/^http:\/\//i, "https://");
    else if (!/^https:\/\//i.test(s)) s = "https://" + s;
    u = parseUrl(s);
    if (!u || !u.hostname || u.hostname.indexOf(".") < 1 || /\s/.test(s)) return { ok: false, error: "Це не схоже на посилання. Приклад: https://example.com/файл.jpg" };
    return { ok: true, url: u.href };
  }

  /* Allowed embed hosts (blocks-spec.md §1) */
  var EMBED_HOSTS = {
    wordwall: ["wordwall.net"],
    genially: ["view.genial.ly", "view.genially.com", "app.genially.com"],
    quizlet: ["quizlet.com"],
    iframe: ["docs.google.com", "www.canva.com", "miro.com", "learningapps.org", "h5p.org",
      "www.youtube-nocookie.com", "player.vimeo.com", "iframe.mediadelivery.net"]
  };
  var PROVIDER_LABEL = { wordwall: "WordWall", genially: "Genially", quizlet: "Quizlet", iframe: "Інший сервіс" };

  function cleanHost(h) { return str(h).toLowerCase().replace(/^www\./, ""); }

  /* Which provider owns this address? "" when none does. */
  function providerOfUrl(url) {
    var host = cleanHost(hostOf(url)), p, list, i;
    if (!host) return "";
    for (p in EMBED_HOSTS) {
      if (!Object.prototype.hasOwnProperty.call(EMBED_HOSTS, p)) continue;
      list = EMBED_HOSTS[p];
      for (i = 0; i < list.length; i++) { if (cleanHost(list[i]) === host) return p; }
    }
    return "";
  }

  function hostAllowed(provider, url) {
    var host = hostOf(url), list = EMBED_HOSTS[provider] || [], i;
    if (!host) return false;
    for (i = 0; i < list.length; i++) {
      if (list[i] === host) return true;
      if (provider !== "iframe" && cleanHost(list[i]) === cleanHost(host)) return true;
    }
    return false;
  }

  /* The same conversion rules as FMMBlocks.safeEmbed (used when blocks.js is not loaded). */
  function safeEmbedLocal(provider, url) {
    var u = parseUrl(trim(url)), host, path, m;
    if (!u || u.protocol !== "https:") return null;
    if (!hostAllowed(provider, u.href)) return null;
    host = u.hostname.toLowerCase();
    path = u.pathname || "/";
    if (provider === "wordwall") {
      /* only the address WordWall gives for embedding (same rule as FMMBlocks.safeEmbed) */
      return /^\/embed\/.+/.test(path) ? u.href : null;
    }
    if (provider === "genially") {
      if (host === "app.genially.com") {
        m = /\/([0-9a-f]{24})(?:\/|$)/i.exec(path);
        return m ? "https://view.genially.com/" + m[1] : null;
      }
      return path.length > 1 ? u.href : null;
    }
    if (provider === "quizlet") {
      if (/\/embed\/?$/.test(path)) return u.href;
      m = /\/(\d{4,})(?:\/|$)/.exec(path);
      return m ? "https://quizlet.com/" + m[1] + "/flashcards/embed" : null;
    }
    if (provider === "iframe") {
      if (host === "www.canva.com") {
        m = /^\/design\/([A-Za-z0-9_-]+)\/([A-Za-z0-9_-]+)\/view/.exec(path);
        if (!m) return null;
        return "https://www.canva.com" + m[0] + "?embed";
      }
      if (host === "miro.com") return /^\/app\/live-embed\//.test(path) ? u.href : null;
      return u.href;
    }
    return null;
  }

  /* "" when the address can be embedded, otherwise a Ukrainian reason. */
  function embedProblem(provider, url, safeEmbed) {
    var s = trim(url), u, list;
    if (!s) return "Встав посилання.";
    u = parseUrl(s);
    if (!u || !/^https?:$/.test(u.protocol)) return "Це не схоже на посилання. Скопіюй його з адресного рядка браузера.";
    if (u.protocol !== "https:") return "Посилання має починатися з https:// (з «s»).";
    if (!hostAllowed(provider, s)) {
      list = (EMBED_HOSTS[provider] || []).join(", ");
      return "Сайт " + u.hostname + " сюди додати не можна: з міркувань безпеки дозволені тільки перевірені сервіси ("
        + list + "). Якщо потрібне просто посилання на цей сайт, додай блок «Кнопка з посиланням».";
    }
    var out = (safeEmbed || safeEmbedLocal)(provider, s);
    if (!out && provider === "wordwall") {
      return "Це звичайне посилання на гру, воно сюди не підходить. На wordwall.net натисни «Embed / Поділитися» → «Вбудувати» і встав адресу, що починається з https://wordwall.net/embed/…";
    }
    if (!out) return "Сайт підходить, але я не бачу в посиланні номера матеріалу. Скопіюй посилання зі сторінки самого матеріалу.";
    return "";
  }

  /* ---------- messages from FMMBlocks.validate: «words[2].translation: …» -> «Слова №2 › Переклад: …» ---------- */
  var FIELD_NAMES = {
    title: "Заголовок завдання", instructions: "Підказка", heading: "Заголовок", body: "Текст", label: "Напис", text: "Текст",
    src: "Файл", audio_src: "Аудіо", front_src: "Картинка", left_src: "Картинка", right_src: "Картинка", alt: "Опис картинки",
    caption: "Підпис", url: "Посилання", name: "Назва", note: "Примітка", question: "Запитання", task: "Завдання",
    transcript: "Розшифровка", min_words: "Мінімум слів", accept: "Тип файлу", allow_recording: "Запис голосу",
    provider: "Сервіс", height: "Висота", words: "Слова", word: "Слово", translation: "Переклад", example: "Приклад",
    images: "Картинки", header: "Заголовки стовпців", rows: "Рядки", questions: "Питання", q: "Запитання", options: "Варіанти",
    correct: "Правильна відповідь", explain: "Пояснення", answer: "Відповідь", alt_answers: "Інші відповіді",
    sentences: "Речення", items: "Елементи", extra: "Зайві слова", statements: "Твердження", cards: "Картки", front: "Лицьовий бік",
    back: "Зворотний бік", pairs: "Пари", left: "Ліворуч", right: "Праворуч", columns: "Колонки"
  };

  function humanizeError(msg) {
    var m = /^([A-Za-z_][A-Za-z0-9_]*(?:\[\d+\])?(?:\.[A-Za-z_][A-Za-z0-9_]*(?:\[\d+\])?)*):\s*([\s\S]*)$/.exec(str(msg));
    if (!m) return str(msg);
    var parts = m[1].split(".").map(function (tok) {
      var t = /^([A-Za-z_][A-Za-z0-9_]*)(?:\[(\d+)\])?$/.exec(tok);
      if (!t) return tok;
      var name = FIELD_NAMES[t[1]] || t[1];
      return t[2] ? name + " №" + t[2] : name;
    });
    return parts.join(" › ") + ": " + m[2];
  }

  /* ---------- markdown toolbar ---------- */
  var MD_PREFIX = { h2: "## ", h3: "### ", list: "- ", quote: "> " };

  function mdInsert(value, start, end, kind) {
    value = str(value);
    start = Math.max(0, Math.min(value.length, num(start)));
    end = Math.max(0, Math.min(value.length, num(end)));
    if (end < start) { var t = start; start = end; end = t; }
    var sel = value.slice(start, end), before = value.slice(0, start), after = value.slice(end);
    var nv, s, inner, label;
    if (kind === "bold" || kind === "italic") {
      var m = kind === "bold" ? "**" : "*";
      inner = sel || "текст";
      nv = before + m + inner + m + after;
      return { value: nv, start: start + m.length, end: start + m.length + inner.length };
    }
    if (kind === "link") {
      label = sel || "текст посилання";
      nv = before + "[" + label + "](https://)" + after;
      s = start + 1 + label.length + 2;
      return { value: nv, start: s, end: s + 8 };
    }
    var prefix = MD_PREFIX[kind];
    if (!prefix) return { value: value, start: start, end: end };
    var ls = before.lastIndexOf("\n") + 1;
    var nl = after.indexOf("\n");
    var le = nl < 0 ? value.length : end + nl;
    var lines = value.slice(ls, le).split("\n");
    var allHave = lines.every(function (l) { return !trim(l) || l.indexOf(prefix) === 0; });
    lines = lines.map(function (l) {
      if (!trim(l)) return l;
      if (allHave) return l.slice(prefix.length);
      if (kind === "h2" || kind === "h3") l = l.replace(/^#{2,3}\s+/, "");
      return l.indexOf(prefix) === 0 ? l : prefix + l;
    });
    var block = lines.join("\n");
    return { value: value.slice(0, ls) + block + value.slice(le), start: ls, end: ls + block.length };
  }

  /* ---------- storage paths inside a block ---------- */
  /* Files of our storage mentioned in a block: "<product_id>/..." in fields called src / *_src. */
  function collectPaths(content, productId) {
    var out = [], prefix = str(productId) + "/";
    (function walk(v, key) {
      var k;
      if (isArr(v)) { v.forEach(function (x) { walk(x, key); }); return; }
      if (v && typeof v === "object") {
        for (k in v) { if (Object.prototype.hasOwnProperty.call(v, k)) walk(v[k], k); }
        return;
      }
      if (typeof v === "string" && /(^|_)src$/.test(key || "") && v.indexOf(prefix) === 0 && !/\s/.test(v) && out.indexOf(v) < 0) out.push(v);
    })(content, "");
    return out;
  }

  /* Paths in `candidates` that no block of `remaining` still points at. */
  function unusedPaths(candidates, remaining, productId) {
    var used = {};
    (remaining || []).forEach(function (b) {
      collectPaths(b && b.content, productId).forEach(function (p) { used[p] = true; });
    });
    return (candidates || []).filter(function (p, i, a) { return p && !used[p] && a.indexOf(p) === i; });
  }

  /* ---------- one-line summaries ---------- */
  function countWord(n, one, few, many) { return n + " " + plural(n, one, few, many); }

  var SUMMARY = {
    text: function (c) { return trim(c.heading) ? c.heading : stripMd(c.body); },
    hidden_text: function (c) { return trim(c.label) || stripMd(c.body); },
    table: function (c) {
      var t = normalizeTable(c);
      return countWord(t.rows.length, "рядок", "рядки", "рядків") + " × " + countWord(t.header.length, "стовпець", "стовпці", "стовпців")
        + (trim(t.header[0]) ? " · " + t.header.filter(function (x) { return trim(x); }).slice(0, 3).join(", ") : "");
    },
    vocabulary: function (c) {
      var w = isArr(c.words) ? c.words : [];
      var names = w.map(function (x) { return trim(x && x.word); }).filter(Boolean).slice(0, 3).join(", ");
      return countWord(w.length, "слово", "слова", "слів") + (names ? ": " + names : "");
    },
    audio: function (c) { return trim(c.caption) || fileLabel(c.src); },
    video: function (c) { return fileLabel(c.src); },
    youtube: function (c) { var id = youtubeId(c.url); return id ? "youtube.com · " + id : trim(c.url); },
    image: function (c) { return trim(c.caption) || trim(c.alt) || fileLabel(c.src); },
    carousel: function (c) { var n = isArr(c.images) ? c.images.length : 0; return countWord(n, "картинка", "картинки", "картинок"); },
    collage: function (c) { var n = isArr(c.images) ? c.images.length : 0; return countWord(n, "картинка", "картинки", "картинок"); },
    file: function (c) { return trim(c.name) || fileLabel(c.src); },
    link_button: function (c) { return trim(c.label) + (trim(c.url) ? " → " + (hostOf(c.url) || c.url) : ""); },
    embed: function (c) { return (PROVIDER_LABEL[c.provider] || "Сервіс") + (hostOf(c.url) ? " · " + hostOf(c.url) : ""); },
    open_answer: function (c) { return stripMd(c.question); },
    student_file: function (c) { return stripMd(c.task); },
    teacher_note: function (c) { return stripMd(c.body); }
  };

  /* Works for every type, also for ones this file does not know. */
  function summarize(type, content) {
    var c = content && typeof content === "object" ? content : {}, out = "", keys, i, v;
    if (Object.prototype.hasOwnProperty.call(SUMMARY, type)) {
      try { out = trim(SUMMARY[type](c)); } catch (_) { out = ""; }
    }
    if (!out) {
      keys = ["title", "text", "question", "task", "body", "instructions"];
      for (i = 0; i < keys.length && !out; i++) { if (typeof c[keys[i]] === "string") out = stripMd(c[keys[i]]); }
    }
    if (!out) {
      keys = ["questions", "statements", "sentences", "items", "cards", "pairs", "columns", "rows", "words", "images"];
      for (i = 0; i < keys.length && !out; i++) {
        v = c[keys[i]];
        if (isArr(v) && v.length) out = countWord(v.length, "елемент", "елементи", "елементів");
      }
    }
    return cut(out, 110);
  }

  /* ---------- checks (Ukrainian messages) ---------- */
  function need(v) { return !trim(v); }

  var CHECKS = {
    text: function (c) { return need(c.body) ? ["Напиши текст."] : []; },
    hidden_text: function (c) {
      var e = [];
      if (need(c.label)) e.push("Напиши підпис кнопки (наприклад: «Показати відповідь»).");
      if (need(c.body)) e.push("Напиши прихований текст.");
      return e;
    },
    table: function (c) {
      var t = normalizeTable(c), any = false;
      t.header.forEach(function (x) { if (trim(x)) any = true; });
      t.rows.forEach(function (r) { r.forEach(function (x) { if (trim(x)) any = true; }); });
      return any ? [] : ["Заповни хоча б одну клітинку таблиці."];
    },
    vocabulary: function (c) {
      var w = isArr(c.words) ? c.words : [], e = [];
      if (!w.length) return ["Додай хоча б одне слово."];
      w.forEach(function (x, i) {
        x = x || {};
        if (need(x.word) && need(x.translation)) e.push("Слово №" + (i + 1) + ": заповни або видали цей рядок.");
        else if (need(x.word)) e.push("Слово №" + (i + 1) + ": напиши слово.");
        else if (need(x.translation)) e.push("Слово №" + (i + 1) + ": напиши переклад.");
      });
      return e;
    },
    audio: function (c) { return need(c.src) ? ["Завантаж аудіофайл або встав посилання на нього."] : []; },
    video: function (c) {
      if (need(c.src)) return ["Завантаж відеофайл або встав посилання на відео."];
      if (isLink(c.src) && !videoLink(c.src).ok) return [videoLink(c.src).error];
      return [];
    },
    youtube: function (c) {
      if (need(c.url)) return ["Встав посилання на відео з YouTube."];
      return youtubeId(c.url) ? [] : ["Не бачу номера відео в посиланні YouTube. Скопіюй адресу зі сторінки відео."];
    },
    image: function (c) {
      var e = [];
      if (need(c.src)) e.push("Завантаж картинку.");
      if (need(c.alt)) e.push("Опиши картинку словами (для тих, хто її не бачить).");
      return e;
    },
    carousel: function (c) { return imagesCheck(c, 1); },
    collage: function (c) { return imagesCheck(c, 2); },
    file: function (c) {
      var e = [];
      if (need(c.src)) e.push("Завантаж файл.");
      if (need(c.name)) e.push("Напиши назву файлу (її побачить учень).");
      return e;
    },
    link_button: function (c) {
      var e = [];
      if (need(c.label)) e.push("Напиши, що буде на кнопці.");
      if (need(c.url)) e.push("Встав посилання.");
      else if (!isHttps(c.url)) e.push("Посилання має починатися з https://");
      return e;
    },
    embed: function (c) {
      var p = embedProblem(c.provider, c.url, typeof window !== "undefined" && window.FMMBlocks && window.FMMBlocks.safeEmbed);
      return p ? [p] : [];
    },
    open_answer: function (c) { return need(c.question) ? ["Напиши запитання для учня."] : []; },
    student_file: function (c) { return need(c.task) ? ["Напиши завдання для учня."] : []; },
    teacher_note: function (c) { return need(c.body) ? ["Напиши нотатку."] : []; }
  };

  function imagesCheck(c, min) {
    var imgs = isArr(c.images) ? c.images : [], e = [];
    if (imgs.length < min) return [min > 1 ? "Додай щонайменше " + min + " картинки." : "Додай хоча б одну картинку."];
    imgs.forEach(function (im, i) {
      im = im || {};
      if (need(im.src)) e.push("Картинка №" + (i + 1) + ": завантаж файл.");
      if (need(im.alt)) e.push("Картинка №" + (i + 1) + ": опиши її словами.");
    });
    return e;
  }

  var P = {
    GROUPS: GROUPS, EMBED_HOSTS: EMBED_HOSTS, PROVIDER_LABEL: PROVIDER_LABEL, CHECKS: CHECKS,
    moveInArray: moveInArray, removeAt: removeAt, clone: clone, fileLabel: fileLabel, titleFromFilename: titleFromFilename,
    stripMd: stripMd, normalizeTable: normalizeTable, tableAddRow: tableAddRow, tableAddCol: tableAddCol,
    tableRemoveRow: tableRemoveRow, tableRemoveCol: tableRemoveCol, tableSet: tableSet, tablePaste: tablePaste,
    youtubeId: youtubeId, videoLink: videoLink, httpsLink: httpsLink, providerOfUrl: providerOfUrl,
    hostAllowed: hostAllowed, safeEmbedLocal: safeEmbedLocal, embedProblem: embedProblem,
    humanizeError: humanizeError, mdInsert: mdInsert, collectPaths: collectPaths, unusedPaths: unusedPaths, summarize: summarize, plural: plural
  };

  /* Loaded by a test (no page): export the helpers and stop. */
  if (typeof window === "undefined" || typeof document === "undefined") {
    if (typeof module !== "undefined" && module.exports) module.exports = P;
    return;
  }

  /* =================================================================
     2. Page helpers: element builder, field widgets
     ================================================================= */
  function addKids(n, kids) {
    if (kids == null || kids === false) return;
    if (isArr(kids)) { kids.forEach(function (k) { addKids(n, k); }); return; }
    if (typeof kids === "object" && kids.nodeType) { n.appendChild(kids); return; }
    n.appendChild(document.createTextNode(String(kids)));
  }

  function h(tag, attrs, kids) {
    var n = document.createElement(tag), k, v;
    if (attrs) {
      for (k in attrs) {
        if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
        v = attrs[k];
        if (v === false || v == null) continue;
        if (k === "class") n.className = v;
        else if (k.slice(0, 2) === "on" && typeof v === "function") n.addEventListener(k.slice(2), v);
        else if (k === "disabled" || k === "hidden") n[k] = v;
        else n.setAttribute(k, v === true ? "" : v);
      }
    }
    addKids(n, kids);
    return n;
  }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); return n; }

  var uidN = 0;
  function nid() { uidN += 1; return "abf" + uidN; }

  function btn(label, onclick, cls, attrs) {
    return h("button", assign({ type: "button", class: cls || "btn btn-ghost btn-sm", onclick: onclick }, attrs || {}), label);
  }
  function iconBtn(label, title, onclick, disabled) {
    return h("button", { type: "button", class: "ad-icon-btn", title: title, "aria-label": title, onclick: onclick, disabled: !!disabled }, label);
  }

  /* label + control + hint */
  function fld(labelText, control, hint, opt) {
    opt = opt || {};
    if (!control.id) control.id = nid();
    var hintEl = hint ? h("p", { class: "ab-hint", id: control.id + "-h" }, hint) : null;
    if (hintEl) control.setAttribute("aria-describedby", control.id + "-h");
    return h("div", { class: "ab-field" + (opt.cls ? " " + opt.cls : "") }, [
      h("label", { for: control.id }, [labelText, opt.required ? h("span", { class: "ab-req", "aria-hidden": "true" }, " *") : null]),
      control, hintEl
    ]);
  }

  function inp(value, onInput, attrs) {
    var el = h("input", assign({ type: "text", class: "ab-input" }, attrs || {}));
    el.value = str(value);
    el.addEventListener("input", function () { onInput(el.value); });
    return el;
  }
  function area(value, onInput, attrs) {
    var el = h("textarea", assign({ class: "ab-input", rows: "3" }, attrs || {}));
    el.value = str(value);
    el.addEventListener("input", function () { onInput(el.value); });
    return el;
  }
  function selectEl(value, options, onChange) {
    var el = h("select", { class: "ab-input" }, options.map(function (o) { return h("option", { value: o[0] }, o[1]); }));
    el.value = value;
    el.addEventListener("change", function () { onChange(el.value); });
    return el;
  }
  function checkbox(labelText, checked, onChange) {
    var c = h("input", { type: "checkbox" });
    c.checked = !!checked;
    c.addEventListener("change", function () { onChange(c.checked); });
    return h("label", { class: "ab-check" }, [c, h("span", {}, labelText)]);
  }
  function note(text, cls) { return h("p", { class: "ab-note" + (cls ? " " + cls : "") }, text); }

  var MD_BUTTONS = [
    ["h2", "Заголовок", "Заголовок"],
    ["h3", "Підзаголовок", "Підзаголовок"],
    ["bold", "Ж", "Жирний"],
    ["italic", "К", "Курсив"],
    ["list", "Список", "Список"],
    ["quote", "Цитата", "Цитата"],
    ["link", "Посилання", "Посилання"]
  ];

  /* A text box with formatting buttons; the user never has to know the markup. */
  function mdField(labelText, value, onInput, o) {
    o = o || {};
    var ta = area(value, function (v) { onInput(v); }, { rows: String(o.rows || 6), placeholder: o.placeholder || "", maxlength: "100000" });
    var bar = h("div", { class: "ab-md-bar", role: "toolbar", "aria-label": "Форматування тексту" }, MD_BUTTONS.map(function (b) {
      var el = h("button", { type: "button", class: "ab-md-btn ab-md-" + b[0], title: b[2], "aria-label": b[2] }, b[1]);
      el.addEventListener("mousedown", function (e) { e.preventDefault(); });
      el.addEventListener("click", function () {
        var r = mdInsert(ta.value, ta.selectionStart, ta.selectionEnd, b[0]);
        ta.value = r.value;
        ta.focus();
        try { ta.setSelectionRange(r.start, r.end); } catch (_) {}
        onInput(ta.value);
      });
      return el;
    }));
    var help = h("details", { class: "ab-help" }, [
      h("summary", {}, "Як форматувати текст?"),
      h("ul", {}, [
        h("li", {}, "Заголовок: постав ## на початку рядка (або натисни кнопку «Заголовок»)."),
        h("li", {}, "Жирний: **ось так**. Курсив: *ось так*."),
        h("li", {}, "Список: кожен пункт з нового рядка, на початку «- »."),
        h("li", {}, "Цитата: «> » на початку рядка."),
        h("li", {}, "Посилання: [текст](https://адреса). Новий абзац — порожній рядок.")
      ])
    ]);
    var wrap = fld(labelText, ta, o.hint, { required: o.required });
    wrap.insertBefore(bar, ta);
    wrap.appendChild(help);
    return wrap;
  }

  /* =================================================================
     3. Registry
     ================================================================= */
  var REG = {}, ORDER = [];

  var R = window.FMMBlockEditors || {};
  R.register = function (type, def) {
    type = str(type);
    if (!type || !def) return;
    var d = assign({}, def);
    d.type = type;
    d.label = d.label || type;
    d.group = d.group || "content";
    if (!REG[type]) ORDER.push(type);
    REG[type] = d;
  };
  R.list = function () {
    return ORDER.map(function (t) {
      return { type: t, label: REG[t].label, group: REG[t].group, icon: REG[t].icon || "" };
    });
  };
  R.get = function (type) { return REG[type] || null; };
  R.has = function (type) { return !!REG[type]; };
  window.FMMBlockEditors = R;

  /* =================================================================
     4. Our own icons: blue lines, honey and cream fills
     ================================================================= */
  var HONEY = "#e9a93b", HONEY_SOFT = "#f7e6c4", CREAM = "#f1efe7";
  function svg(inner) {
    return '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="#0d4a85" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + inner + "</svg>";
  }
  var ICON = {
    text: svg('<rect x="4" y="4.5" width="9" height="3.4" rx="1.7" fill="' + HONEY + '" stroke="none"/><path d="M4 12.5h16M4 16.5h16M4 20.5h10"/>'),
    hidden_text: svg('<rect x="3.5" y="4.5" width="17" height="15" rx="3" fill="' + CREAM + '"/><path d="M7 9h6" /><path d="M8.5 13.2l3.5 3.3 3.5-3.3" stroke="' + HONEY + '" stroke-width="2.2"/>'),
    table: svg('<rect x="3.5" y="5" width="17" height="14" rx="2.5" fill="' + CREAM + '"/><path d="M3.5 7.5A2.5 2.5 0 0 1 6 5h12a2.5 2.5 0 0 1 2.5 2.5V10h-17z" fill="' + HONEY + '" stroke="none"/><path d="M3.5 10h17M3.5 14.5h17M9.5 5v14M15 5v14"/>'),
    vocabulary: svg('<rect x="3.5" y="4.5" width="17" height="15" rx="3" fill="' + CREAM + '"/><path d="M12 7.5v9" stroke="' + HONEY + '" stroke-width="2"/><path d="M6.5 9h3.2M6.5 12h3.2M6.5 15h3.2M14.5 9h3.2M14.5 12h3.2M14.5 15h3.2"/>'),
    audio: svg('<path d="M4 10v4h3.5L12 17.8V6.2L7.5 10z" fill="' + HONEY + '"/><path d="M15.2 9.3a3.6 3.6 0 0 1 0 5.4M17.8 6.8a7.2 7.2 0 0 1 0 10.4"/>'),
    video: svg('<rect x="3" y="5.5" width="18" height="13" rx="3" fill="' + CREAM + '"/><path d="M10.3 9.4v5.2l4.6-2.6z" fill="' + HONEY + '"/>'),
    youtube: svg('<rect x="2.5" y="6" width="19" height="12" rx="5.5" fill="' + HONEY + '"/><path d="M10 9.6v4.8l4.4-2.4z" fill="#fffdf8"/>'),
    image: svg('<rect x="3.5" y="5" width="17" height="14" rx="3" fill="' + CREAM + '"/><circle cx="9" cy="10" r="1.7" fill="' + HONEY + '" stroke="none"/><path d="M4 17.2l5-4.3 3.6 3 3-2.4 4.4 3.7"/>'),
    carousel: svg('<rect x="6.5" y="4.5" width="11" height="11" rx="2.5" fill="' + CREAM + '"/><path d="M3.5 7.5v5M20.5 7.5v5"/><circle cx="9.5" cy="19" r="1" fill="#0d4a85" stroke="none"/><circle cx="12" cy="19" r="1.4" fill="' + HONEY + '" stroke="none"/><circle cx="14.5" cy="19" r="1" fill="#0d4a85" stroke="none"/>'),
    collage: svg('<rect x="3.5" y="4.5" width="9" height="8.5" rx="2" fill="' + HONEY + '"/><rect x="14.5" y="4.5" width="6" height="5" rx="2" fill="' + CREAM + '"/><rect x="14.5" y="11" width="6" height="8.5" rx="2" fill="' + CREAM + '"/><rect x="3.5" y="14.5" width="9" height="5" rx="2" fill="' + CREAM + '"/>'),
    file: svg('<path d="M6 3.5h8l4.5 4.5v12.5H6z" fill="' + CREAM + '"/><path d="M14 3.5V8h4.5"/><path d="M12.2 11v5.2M9.8 14l2.4 2.4 2.4-2.4" stroke="' + HONEY + '" stroke-width="2"/>'),
    link_button: svg('<rect x="3" y="7.5" width="18" height="9" rx="4.5" fill="' + HONEY + '"/><path d="M8.5 12h7M13.2 9.6l2.4 2.4-2.4 2.4"/>'),
    embed: svg('<rect x="3" y="5" width="18" height="14" rx="3" fill="' + CREAM + '"/><path d="M3 9.5h18"/><circle cx="6.3" cy="7.3" r=".8" fill="' + HONEY + '" stroke="none"/><path d="M10.2 12.6l-2 2 2 2M13.8 12.6l2 2-2 2"/>'),
    open_answer: svg('<path d="M5.5 4.5h13A2.5 2.5 0 0 1 21 7v7a2.5 2.5 0 0 1-2.5 2.5H12L8 20v-3.5H5.5A2.5 2.5 0 0 1 3 14V7a2.5 2.5 0 0 1 2.5-2.5z" fill="' + CREAM + '"/><path d="M7.5 9h9M7.5 12h5"/><circle cx="17.2" cy="12" r="1.1" fill="' + HONEY + '" stroke="none"/>'),
    student_file: svg('<path d="M4 14.5V18a1.7 1.7 0 0 0 1.7 1.7h12.6A1.7 1.7 0 0 0 20 18v-3.5" fill="' + CREAM + '"/><path d="M12 15.5V5M8.4 8.6L12 5l3.6 3.6" stroke="' + HONEY + '" stroke-width="2.2"/>'),
    teacher_note: svg('<path d="M5 4.5h14v10l-5 5H5z" fill="' + HONEY_SOFT + '"/><path d="M14 19.5v-4a1 1 0 0 1 1-1h4"/><path d="M8 9h8M8 12.5h5"/>'),
    unknown: svg('<rect x="4" y="4" width="16" height="16" rx="4" fill="' + CREAM + '"/><path d="M9.6 9.8a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1 .8-1 1.5M12 16.6v.1" stroke="' + HONEY + '" stroke-width="2"/>')
  };

  /* =================================================================
     5. Upload widget (picture / sound / video / file)
     ================================================================= */
  function uploadBox(o) {
    var helpers = o.helpers, cur = str(o.value), working = false, token = 0;
    var wrap = h("div", { class: "ab-up" + (o.compact ? " is-compact" : "") });
    var fileInput = h("input", { type: "file", class: "sr-only", tabindex: "-1", "aria-hidden": "true", accept: o.accept || null });
    var msg = h("p", { class: "ab-up-msg", role: "status", "aria-live": "polite" });
    var linkMsg = h("p", { class: "ab-up-msg", role: "status", "aria-live": "polite" });
    var kindWord = { image: "Картинка", audio: "Аудіо", video: "Відео", file: "Файл" }[o.kind] || "Файл";

    function setMsg(text, bad) { msg.textContent = text || ""; msg.className = "ab-up-msg" + (bad ? " is-bad" : (text ? " is-ok" : "")); }

    function thumb() {
      var box = h("div", { class: "ab-up-thumb" });
      if (!cur) return null;
      var t = ++token;
      if (!helpers || !helpers.signedUrl) return null;
      if (o.kind === "image") {
        var img = h("img", { alt: "", class: "ab-thumb" });
        box.appendChild(img);
        helpers.signedUrl(cur).then(function (u) { if (t === token) img.src = u; }, function () { if (t === token) { box.textContent = "Не вдалося показати картинку."; } });
      } else if (o.kind === "audio") {
        var au = h("audio", { controls: true, preload: "none", class: "ab-audio" });
        box.appendChild(au);
        helpers.signedUrl(cur).then(function (u) { if (t === token) au.src = u; }, function () { if (t === token) { box.textContent = "Не вдалося підготувати прослуховування."; } });
      }
      return box.childNodes.length ? box : null;
    }

    function draw() {
      clear(wrap);
      var linked = isLink(cur);
      var line = h("div", { class: "ab-up-cur" }, cur
        ? [h("strong", {}, fileLabel(cur)), h("span", { class: "ab-muted" }, linked ? " (посилання)" : " (завантажено)")]
        : h("span", { class: "ab-muted" }, o.emptyText || (kindWord + " ще не вибрано.")));
      var t = thumb();
      wrap.appendChild(line);
      if (t) wrap.appendChild(t);
      var row = h("div", { class: "ab-up-btns" }, [
        fileInput,
        btn(working ? "Завантажується…" : (cur ? "Замінити файл" : (o.buttonLabel || "Завантажити файл")), function () { fileInput.click(); }, "btn btn-ghost btn-sm", { disabled: working }),
        cur ? btn("Прибрати", function () { cur = ""; setMsg(""); o.onChange("", null); draw(); }, "ad-link-danger") : null
      ]);
      wrap.appendChild(row);
      wrap.appendChild(msg);
      if (o.allowLink) {
        var li = inp(linked ? cur : "", function (v) {
          var r = (o.normalizeLink || httpsLink)(v);
          if (!trim(v)) { linkMsg.textContent = ""; linkMsg.className = "ab-up-msg"; if (isLink(cur)) { cur = ""; o.onChange("", null); } return; }
          if (r.ok) {
            linkMsg.textContent = "Посилання підходить" + (r.host ? " (" + r.host + ")" : "") + ".";
            linkMsg.className = "ab-up-msg is-ok";
            cur = r.url;
            o.onChange(r.url, null);
          } else {
            linkMsg.textContent = r.error || "";
            linkMsg.className = "ab-up-msg is-bad";
            if (isLink(cur)) { cur = ""; o.onChange("", null); }
          }
        }, { type: "url", placeholder: o.linkPlaceholder || "https://…", "aria-label": o.linkLabel || "Посилання" });
        wrap.appendChild(h("details", { class: "ab-linkopt", open: linked ? true : null }, [
          h("summary", {}, o.linkSummary || "Або встав посилання"),
          o.linkHint ? h("p", { class: "ab-hint" }, o.linkHint) : null,
          li, linkMsg
        ]));
      }
    }

    fileInput.addEventListener("change", function () {
      var f = fileInput.files && fileInput.files[0];
      fileInput.value = "";
      if (!f) return;
      if (!f.size) { setMsg("Цей файл порожній. Обери інший.", true); return; }
      if (f.type && o.kind === "image" && f.type.indexOf("image/") !== 0) { setMsg("Це не картинка. Обери файл JPG, PNG, WebP чи GIF.", true); return; }
      if (f.type && o.kind === "audio" && f.type.indexOf("audio/") !== 0) { setMsg("Це не звук. Обери файл MP3, M4A, WAV чи OGG.", true); return; }
      if (f.type && o.kind === "video" && f.type.indexOf("video/") !== 0) { setMsg("Це не відео. Обери файл MP4 чи WebM.", true); return; }
      working = true; draw(); setMsg("Завантажується…");
      helpers.upload(f).then(function (path) {
        working = false; cur = path;
        draw(); setMsg("Готово ✓");
        o.onChange(path, f);
      }, function (e) {
        working = false; draw();
        setMsg((e && (e.friendly || e.message)) || "Не вдалося завантажити. Спробуй ще раз.", true);
      });
    });

    draw();
    return wrap;
  }

  /* =================================================================
     6. Editors
     ================================================================= */
  function ed(type, label, group, hint, empty, edit, extra) {
    R.register(type, assign({ label: label, group: group, icon: ICON[type], hint: hint, empty: empty, edit: edit,
      check: CHECKS[type] }, extra || {}));
  }

  /* one-line "set a key" helper that keeps every other key of the content */
  function setter(content, onChange) {
    var c = assign({}, content);
    return function (key, value) { c[key] = value; onChange(assign({}, c)); };
  }

  /* ---------- text ---------- */
  ed("text", "Заголовок / Текст", "content", "Звичайний текст із заголовком, списками й посиланнями.",
    function () { return { heading: "", body: "" }; },
    function (el, content, onChange) {
      var set = setter(content, onChange);
      el.appendChild(fld("Заголовок (необов'язково)", inp(content.heading, function (v) { set("heading", v); }, { maxlength: "200" })));
      el.appendChild(mdField("Текст", content.body, function (v) { set("body", v); }, { rows: 10, required: true, placeholder: "Пиши тут. Кнопки над полем допоможуть зробити заголовок чи список." }));
    });

  /* ---------- hidden text ---------- */
  ed("hidden_text", "Прихований текст", "content", "Текст за кнопкою: учень натискає й бачить, наприклад, відповідь.",
    function () { return { label: "Показати відповідь", body: "" }; },
    function (el, content, onChange) {
      var set = setter(content, onChange);
      el.appendChild(fld("Напис на кнопці", inp(content.label, function (v) { set("label", v); }, { maxlength: "120" }), "Наприклад: «Показати відповідь» або «Підказка».", { required: true }));
      el.appendChild(mdField("Що ховається за кнопкою", content.body, function (v) { set("body", v); }, { rows: 6, required: true }));
    });

  /* ---------- table ---------- */
  ed("table", "Таблиця", "content", "Таблиця для читання (не вправа). Можна вставити з Excel чи Google Таблиць.",
    function () { return normalizeTable({ header: ["", ""], rows: [["", ""], ["", ""]], caption: "" }); },
    function (el, content, onChange) {
      var t = normalizeTable(content);
      var gridBox = h("div", { class: "ab-grid-wrap" });
      function emit() { onChange(clone(t)); }
      function draw(focus) {
        clear(gridBox);
        var head = h("tr", {}, [h("th", { class: "ab-grid-corner" })]);
        t.header.forEach(function (cell, j) {
          head.appendChild(h("th", {}, h("div", { class: "ab-grid-cellwrap" }, [
            cellInput(-1, j, cell, "Заголовок стовпця " + (j + 1)),
            t.header.length > 1 ? iconBtn("×", "Видалити стовпець " + (j + 1), function () { t = tableRemoveCol(t, j); emit(); draw(); }) : null
          ])));
        });
        var body = h("tbody");
        t.rows.forEach(function (row, i) {
          var tr = h("tr", {}, [h("th", { class: "ab-grid-rowhead", scope: "row" },
            t.rows.length > 1 ? iconBtn("×", "Видалити рядок " + (i + 1), function () { t = tableRemoveRow(t, i); emit(); draw(); }) : null)]);
          row.forEach(function (cell, j) { tr.appendChild(h("td", {}, cellInput(i, j, cell, "Рядок " + (i + 1) + ", стовпець " + (j + 1)))); });
          body.appendChild(tr);
        });
        gridBox.appendChild(h("div", { class: "ab-grid-scroll" }, h("table", { class: "ab-grid" }, [h("thead", {}, head), body])));
        if (focus) {
          var target = gridBox.querySelector('[data-pos="' + focus + '"]');
          if (target) target.focus();
        }
      }
      function cellInput(r, j, value, label) {
        var i = inp(value, function (v) { t = tableSet(t, r, j, v); emit(); }, { "aria-label": label, "data-pos": r + ":" + j, class: "ab-input ab-cell" + (r === -1 ? " is-head" : "") });
        i.addEventListener("paste", function (e) {
          var text = e.clipboardData && e.clipboardData.getData("text");
          if (text && /[\t\n]/.test(text.replace(/\n+$/, ""))) {
            e.preventDefault();
            t = tablePaste(t, r, j, text);
            emit(); draw();
          }
        });
        return i;
      }
      el.appendChild(note("Верхній рядок — заголовки стовпців (він виділений). Щоб швидко заповнити, скопіюй клітинки з Excel чи Google Таблиць і встав у першу клітинку."));
      el.appendChild(gridBox);
      el.appendChild(h("div", { class: "ab-row-btns" }, [
        btn("+ Додати рядок", function () { t = tableAddRow(t); emit(); draw((t.rows.length - 1) + ":0"); }),
        btn("+ Додати стовпець", function () { t = tableAddCol(t); emit(); draw("-1:" + (t.header.length - 1)); })
      ]));
      el.appendChild(fld("Підпис під таблицею (необов'язково)", inp(content.caption, function (v) { t.caption = v; emit(); }, { maxlength: "200" })));
      draw();
    });

  /* ---------- generic "rows you can add, move and delete" ---------- */
  function rowsEditor(o) {
    var items = o.items.slice();
    var box = h("div", { class: "ab-rows" });
    var addBtn = btn(o.addLabel, function () { items.push(o.newItem()); emit(); draw(items.length - 1); });
    function emit() { o.onChange(items.slice()); }
    function draw(focusIdx) {
      clear(box);
      if (!items.length) box.appendChild(note(o.emptyText || "Ще нічого немає."));
      items.forEach(function (item, i) {
        var head = h("div", { class: "ab-rowcard-head" }, [
          h("strong", {}, o.rowLabel + " №" + (i + 1)),
          h("span", { class: "ab-rowcard-btns" }, [
            iconBtn("↑", "Вище: " + o.rowLabel + " №" + (i + 1), function () { items = moveInArray(items, i, -1); emit(); draw(); }, i === 0),
            iconBtn("↓", "Нижче: " + o.rowLabel + " №" + (i + 1), function () { items = moveInArray(items, i, 1); emit(); draw(); }, i === items.length - 1),
            btn("Видалити", function () { items = removeAt(items, i); emit(); draw(); }, "ad-link-danger", { "aria-label": "Видалити: " + o.rowLabel + " №" + (i + 1) })
          ])
        ]);
        var card = h("div", { class: "ab-rowcard", "data-idx": String(i) }, [head, o.renderRow(item, i, function () { emit(); }, function () { draw(); })]);
        box.appendChild(card);
      });
      if (focusIdx != null) {
        var f = box.querySelector('[data-idx="' + focusIdx + '"] input:not([type=file]), [data-idx="' + focusIdx + '"] textarea');
        if (f) f.focus();
      }
    }
    draw();
    var wrap = h("div", {}, [box, h("div", { class: "ab-row-btns" }, [addBtn, o.extraBtns || null])]);
    wrap.setItems = function (next) { items = next.slice(); emit(); draw(); };
    wrap.getItems = function () { return items.slice(); };
    return wrap;
  }

  /* ---------- vocabulary ---------- */
  ed("vocabulary", "Словник", "content", "Слова з перекладом, прикладом, картинкою та озвучкою.",
    function () { return { words: [{ word: "", translation: "", example: "" }] }; },
    function (el, content, onChange, helpers) {
      var set = setter(content, onChange);
      el.appendChild(rowsEditor({
        items: isArr(content.words) ? content.words.map(function (w) { return assign({}, w); }) : [],
        rowLabel: "Слово", addLabel: "+ Додати слово", emptyText: "Слів ще немає. Натисни «Додати слово».",
        newItem: function () { return { word: "", translation: "", example: "" }; },
        onChange: function (items) { set("words", items); },
        renderRow: function (w, i, emit) {
          return h("div", {}, [
            h("div", { class: "ab-two" }, [
              fld("Слово", inp(w.word, function (v) { w.word = v; emit(); }, { maxlength: "120" }), null, { required: true }),
              fld("Переклад", inp(w.translation, function (v) { w.translation = v; emit(); }, { maxlength: "200" }), null, { required: true })
            ]),
            fld("Приклад (необов'язково)", inp(w.example, function (v) { w.example = v; emit(); }, { maxlength: "300" })),
            h("div", { class: "ab-two" }, [
              h("div", {}, [h("p", { class: "ab-minilabel" }, "Картинка (необов'язково)"),
                uploadBox({ helpers: helpers, kind: "image", compact: true, accept: "image/*", value: w.src, buttonLabel: "Додати картинку", emptyText: "Без картинки.", onChange: function (s) { if (s) w.src = s; else delete w.src; emit(); } })]),
              h("div", {}, [h("p", { class: "ab-minilabel" }, "Озвучка (необов'язково)"),
                uploadBox({ helpers: helpers, kind: "audio", compact: true, accept: "audio/*", value: w.audio_src, buttonLabel: "Додати аудіо", emptyText: "Без озвучки.", onChange: function (s) { if (s) w.audio_src = s; else delete w.audio_src; emit(); } })])
            ])
          ]);
        }
      }));
    });

  /* ---------- audio ---------- */
  ed("audio", "Аудіо", "media", "Звуковий файл із підписом і текстом (розшифровкою).",
    function () { return { src: "", caption: "", transcript: "" }; },
    function (el, content, onChange, helpers) {
      var set = setter(content, onChange);
      el.appendChild(h("div", { class: "ab-field" }, [
        h("p", { class: "ab-label" }, ["Аудіофайл", h("span", { class: "ab-req" }, " *")]),
        uploadBox({ helpers: helpers, kind: "audio", accept: "audio/*", value: content.src, allowLink: true, linkSummary: "Або встав посилання на аудіо", onChange: function (s) { set("src", s); } })
      ]));
      el.appendChild(fld("Підпис (необов'язково)", inp(content.caption, function (v) { set("caption", v); }, { maxlength: "200" })));
      el.appendChild(mdField("Розшифровка (необов'язково)", content.transcript, function (v) { set("transcript", v); }, { rows: 5, hint: "Учень побачить її за кнопкою під плеєром." }));
    });

  /* ---------- video ---------- */
  ed("video", "Відео", "media", "Відеофайл або посилання на Vimeo, Bunny чи YouTube.",
    function () { return { src: "" }; },
    function (el, content, onChange, helpers) {
      var set = setter(content, onChange);
      el.appendChild(h("div", { class: "ab-field" }, [
        h("p", { class: "ab-label" }, ["Відео", h("span", { class: "ab-req" }, " *")]),
        uploadBox({
          helpers: helpers, kind: "video", accept: "video/*", value: content.src, allowLink: true, normalizeLink: videoLink,
          buttonLabel: "Завантажити відеофайл", linkSummary: "Або встав посилання на відео",
          linkHint: "Працюють посилання Vimeo, Bunny і YouTube. Інші сайти ми не вбудовуємо — з міркувань безпеки.",
          linkPlaceholder: "https://vimeo.com/123456789",
          onChange: function (s) { set("src", s); }
        })
      ]));
      el.appendChild(note("Великі відео (понад кілька сотень мегабайтів) краще залити на Vimeo чи Bunny, а сюди вставити посилання — так вони швидше вантажаться в учнів."));
    });

  /* ---------- youtube ---------- */
  ed("youtube", "Відео з YouTube", "media", "Вставляєш посилання — відео з'являється в уроці.",
    function () { return { url: "" }; },
    function (el, content, onChange) {
      var set = setter(content, onChange);
      var live = h("p", { class: "ab-live", role: "status", "aria-live": "polite" });
      function paint(v) {
        if (!trim(v)) { live.textContent = ""; live.className = "ab-live"; return; }
        var id = youtubeId(v);
        live.textContent = id ? "Відео знайдено ✓" : "Не бачу номера відео. Скопіюй адресу зі сторінки відео на YouTube.";
        live.className = "ab-live " + (id ? "is-ok" : "is-bad");
      }
      el.appendChild(fld("Посилання на відео", inp(content.url, function (v) { set("url", v); paint(v); }, { type: "url", placeholder: "https://www.youtube.com/watch?v=…" }),
        "Підійде будь-яке посилання з YouTube: зі сторінки відео, коротке (youtu.be) чи «Поділитися».", { required: true }));
      el.appendChild(live);
      paint(content.url);
    });

  /* ---------- image ---------- */
  ed("image", "Картинка", "media", "Одна картинка з описом і підписом.",
    function () { return { src: "", alt: "", caption: "" }; },
    function (el, content, onChange, helpers) {
      var set = setter(content, onChange);
      el.appendChild(h("div", { class: "ab-field" }, [
        h("p", { class: "ab-label" }, ["Картинка", h("span", { class: "ab-req" }, " *")]),
        uploadBox({ helpers: helpers, kind: "image", accept: "image/*", value: content.src, allowLink: true, linkSummary: "Або встав посилання на картинку", onChange: function (s) { set("src", s); } })
      ]));
      el.appendChild(fld("Опис картинки словами", inp(content.alt, function (v) { set("alt", v); }, { maxlength: "250" }),
        "Коротко: що на картинці. Це читає програма для людей, які не бачать екран, і це видно, якщо картинка не завантажилась.", { required: true }));
      el.appendChild(fld("Підпис під картинкою (необов'язково)", inp(content.caption, function (v) { set("caption", v); }, { maxlength: "250" })));
    });

  /* ---------- carousel & collage share one editor ---------- */
  function imagesEditor(minWord) {
    return function (el, content, onChange, helpers) {
      var set = setter(content, onChange);
      var picker = h("input", { type: "file", multiple: true, accept: "image/*", class: "sr-only", tabindex: "-1", "aria-hidden": "true" });
      var status = h("p", { class: "ab-up-msg", role: "status", "aria-live": "polite" });
      var list = rowsEditor({
        items: isArr(content.images) ? content.images.map(function (im) { return assign({}, im); }) : [],
        rowLabel: "Картинка", addLabel: "+ Додати порожню картинку", emptyText: "Картинок ще немає. Натисни «Додати картинки» й обери кілька файлів одразу.",
        newItem: function () { return { src: "", alt: "", caption: "" }; },
        onChange: function (items) { set("images", items); },
        extraBtns: [picker, btn("Додати картинки (кілька файлів)", function () { picker.click(); }, "btn btn-primary btn-sm")],
        renderRow: function (im, i, emit) {
          return h("div", { class: "ab-imgrow" }, [
            uploadBox({ helpers: helpers, kind: "image", compact: true, accept: "image/*", value: im.src, onChange: function (s) { im.src = s; emit(); } }),
            h("div", {}, [
              fld("Опис словами", inp(im.alt, function (v) { im.alt = v; emit(); }, { maxlength: "250" }), "Що на картинці — коротко.", { required: true }),
              fld("Підпис (необов'язково)", inp(im.caption, function (v) { im.caption = v; emit(); }, { maxlength: "250" }))
            ])
          ]);
        }
      });
      picker.addEventListener("change", function () {
        var files = Array.prototype.slice.call(picker.files || []);
        picker.value = "";
        if (!files.length) return;
        var done = 0, failed = 0;
        status.className = "ab-up-msg"; status.textContent = "Завантажується 1 з " + files.length + "…";
        files.reduce(function (p, f) {
          return p.then(function () {
            return helpers.upload(f).then(function (path) {
              list.setItems(list.getItems().concat([{ src: path, alt: "", caption: "" }]));
              done += 1;
            }, function (e) {
              failed += 1;
              status.className = "ab-up-msg is-bad";
              status.textContent = f.name + ": " + ((e && (e.friendly || e.message)) || "не вдалося завантажити.");
            }).then(function () {
              if (done + failed < files.length) { status.className = "ab-up-msg"; status.textContent = "Завантажується " + (done + failed + 1) + " з " + files.length + "…"; }
            });
          });
        }, Promise.resolve()).then(function () {
          if (!failed) { status.className = "ab-up-msg is-ok"; status.textContent = "Додано: " + done + ". Тепер опиши кожну картинку словами."; }
        });
      });
      el.appendChild(note(minWord));
      el.appendChild(list);
      el.appendChild(status);
    };
  }
  ed("carousel", "Карусель картинок", "media", "Кілька картинок, які учень гортає стрілками.",
    function () { return { images: [] }; },
    imagesEditor("Картинки йдуть у тому порядку, як у списку. Кожній треба дати короткий опис словами."));
  ed("collage", "Колаж", "media", "Кілька картинок поруч; по дотику збільшуються.",
    function () { return { images: [] }; },
    imagesEditor("Для колажу потрібні щонайменше дві картинки. Кожній треба дати короткий опис словами."));

  /* ---------- file ---------- */
  ed("file", "Файл для завантаження", "media", "PDF, документ чи інший файл, який учень може завантажити.",
    function () { return { src: "", name: "", note: "" }; },
    function (el, content, onChange, helpers) {
      var c = assign({}, content);
      var nameInput = inp(content.name, function (v) { c.name = v; onChange(assign({}, c)); }, { maxlength: "200" });
      el.appendChild(h("div", { class: "ab-field" }, [
        h("p", { class: "ab-label" }, ["Файл", h("span", { class: "ab-req" }, " *")]),
        uploadBox({
          helpers: helpers, kind: "file", value: content.src, allowLink: true, linkSummary: "Або встав посилання на файл",
          onChange: function (s, file) {
            c.src = s;
            if (file && !trim(nameInput.value)) { nameInput.value = titleFromFilename(file.name); c.name = nameInput.value; }
            onChange(assign({}, c));
          }
        })
      ]));
      el.appendChild(fld("Назва, яку побачить учень", nameInput, "Наприклад: «Робочий аркуш: числа». Підставляється з назви файлу, її можна змінити.", { required: true }));
      el.appendChild(fld("Коротка примітка (необов'язково)", inp(content.note, function (v) { c.note = v; onChange(assign({}, c)); }, { maxlength: "300" })));
    });

  /* ---------- link button ---------- */
  ed("link_button", "Кнопка з посиланням", "media", "Велика кнопка, що відкриває сайт.",
    function () { return { url: "", label: "" }; },
    function (el, content, onChange) {
      var set = setter(content, onChange);
      var live = h("p", { class: "ab-live", role: "status", "aria-live": "polite" });
      function paint(v) {
        if (!trim(v)) { live.textContent = ""; live.className = "ab-live"; return; }
        var ok = isHttps(v);
        live.textContent = ok ? "Посилання підходить ✓" : "Посилання має починатися з https://";
        live.className = "ab-live " + (ok ? "is-ok" : "is-bad");
      }
      el.appendChild(fld("Текст на кнопці", inp(content.label, function (v) { set("label", v); }, { maxlength: "80" }), "Наприклад: «Відкрити статтю».", { required: true }));
      el.appendChild(fld("Посилання", inp(content.url, function (v) { set("url", v); paint(v); }, { type: "url", placeholder: "https://…" }), null, { required: true }));
      el.appendChild(live);
      paint(content.url);
    });

  /* ---------- embed ---------- */
  var EMBED_HELP = {
    wordwall: "На wordwall.net відкрий свою активність, натисни «Embed / Поділитися» → «Вбудувати» і встав сюди адресу, що починається з wordwall.net/embed/… (звичайне посилання на гру тут не підійде).",
    genially: "У Genially натисни «Поділитися» → «Посилання» і скопіюй адресу (view.genially.com/…).",
    quizlet: "На quizlet.com відкрий набір карток і скопіюй адресу з браузера.",
    iframe: "Тут працюють Google Документи/Таблиці/Презентації, Canva, Miro, LearningApps, H5P, Vimeo, YouTube та Bunny. Скопіюй посилання «Опублікувати / Вбудувати»."
  };
  var EMBED_PLACEHOLDER = { wordwall: "https://wordwall.net/embed/…", genially: "https://view.genially.com/…", quizlet: "https://quizlet.com/…", iframe: "https://…" };
  ed("embed", "WordWall / Genially / Quizlet", "embed", "Інтерактивна гра чи презентація з іншого сайту прямо в уроці.",
    function () { return { provider: "wordwall", url: "", height: 480 }; },
    function (el, content, onChange) {
      var c = assign({ provider: "wordwall", height: 480 }, content);
      if (!EMBED_HOSTS[c.provider]) c.provider = "iframe";
      function emit() { onChange(assign({}, c)); }
      var safe = window.FMMBlocks && window.FMMBlocks.safeEmbed;
      var live = h("p", { class: "ab-live", role: "status", "aria-live": "polite" });
      var helpP = h("p", { class: "ab-hint" });
      var hostsP = h("p", { class: "ab-hint" });
      var sel = selectEl(c.provider, [["wordwall", "WordWall"], ["genially", "Genially"], ["quizlet", "Quizlet"], ["iframe", "Інший сервіс (Google, Canva, Miro, H5P…)"]], function (v) { c.provider = v; paintAll(); emit(); });
      var urlInput = inp(c.url, function (v) {
        c.url = v;
        var own = providerOfUrl(v);
        if (own && own !== c.provider && !hostAllowed(c.provider, v)) { c.provider = own; sel.value = own; changed = PROVIDER_LABEL[own]; } else changed = "";
        paintAll(); emit();
      }, { type: "url", placeholder: "https://wordwall.net/embed/…" });
      var changed = "";
      var range = h("input", { type: "range", min: "200", max: "1200", step: "20", class: "ab-range" });
      range.value = String(c.height || 480);
      var rangeOut = h("output", { class: "ab-range-out" }, (c.height || 480) + " px");
      range.addEventListener("input", function () { c.height = Number(range.value); rangeOut.textContent = c.height + " px"; emit(); });

      function paintAll() {
        helpP.textContent = EMBED_HELP[c.provider] || "";
        urlInput.setAttribute("placeholder", EMBED_PLACEHOLDER[c.provider] || "https://…");
        hostsP.textContent = "Дозволені сайти: " + (EMBED_HOSTS[c.provider] || []).join(", ") + ".";
        if (!trim(c.url)) { live.textContent = ""; live.className = "ab-live"; return; }
        var p = embedProblem(c.provider, c.url, safe);
        if (p) { live.textContent = "⚠ " + p; live.className = "ab-live is-bad"; }
        else { live.textContent = (changed ? "Тип сервісу змінено на " + changed + ". " : "") + "Посилання підходить ✓ (" + hostOf(c.url) + ")"; live.className = "ab-live is-ok"; }
      }
      el.appendChild(fld("Який це сервіс", sel));
      el.appendChild(fld("Посилання", urlInput, null, { required: true }));
      el.appendChild(live);
      el.appendChild(helpP);
      el.appendChild(hostsP);
      el.appendChild(h("div", { class: "ab-field ab-range-field" }, [
        h("label", { for: (range.id = nid()) }, "Висота вікна"),
        h("div", { class: "ab-range-row" }, [range, rangeOut]),
        h("p", { class: "ab-hint" }, "Від 200 до 1200 пікселів. Для більшості ігор достатньо 480; якщо внизу щось обрізається — збільш.")
      ]));
      paintAll();
    });

  /* ---------- open answer ---------- */
  ed("open_answer", "Відкрита відповідь", "work", "Учень пише текст і надсилає тобі на перевірку.",
    function () { return { question: "" }; },
    function (el, content, onChange) {
      var c = assign({}, content);
      el.appendChild(mdField("Запитання або завдання", content.question, function (v) { c.question = v; onChange(assign({}, c)); }, { rows: 5, required: true, placeholder: "Наприклад: Розкажи в 3–4 реченнях, що ти їси на сніданок." }));
      var mw = inp(content.min_words == null ? "" : content.min_words, function (v) {
        var n = parseInt(v, 10);
        if (isFinite(n) && n > 0) c.min_words = Math.min(n, 2000); else delete c.min_words;
        onChange(assign({}, c));
      }, { type: "number", min: "0", max: "2000", inputmode: "numeric" });
      el.appendChild(fld("Мінімум слів (необов'язково)", mw, "Учень побачить лічильник слів. Залиш порожнім, якщо ліміту немає."));
      el.appendChild(note("Відповіді учнів з'являться в розділі «Роботи учнів» — там ти напишеш відгук."));
    });

  /* ---------- student file ---------- */
  ed("student_file", "Файл учня", "work", "Учень надсилає тобі файл або записує голос просто в браузері.",
    function () { return { task: "", accept: "any", allow_recording: false }; },
    function (el, content, onChange) {
      var c = assign({ accept: "any", allow_recording: false }, content);
      function emit() { onChange(assign({}, c)); }
      el.appendChild(mdField("Завдання", c.task, function (v) { c.task = v; emit(); }, { rows: 5, required: true, placeholder: "Наприклад: Запиши аудіо, у якому ти представляєшся." }));
      el.appendChild(fld("Який файл приймати", selectEl(c.accept, [["any", "Будь-який файл"], ["audio", "Тільки аудіо"], ["image", "Тільки картинки"], ["document", "Документи (PDF, Word, текст)"]], function (v) { c.accept = v; emit(); }),
        "Розмір файлу — до 20 МБ."));
      el.appendChild(checkbox("Дозволити записати голос у браузері (без окремого файлу)", c.allow_recording, function (v) { c.allow_recording = v; emit(); }));
      el.appendChild(note("Роботи учнів з'являться в розділі «Роботи учнів» — там ти послухаєш чи подивишся й напишеш відгук."));
    });

  /* ---------- teacher note ---------- */
  ed("teacher_note", "Нотатка вчителя", "teacher", "Тільки для тебе: учні цю нотатку не бачать.",
    function () { return { body: "" }; },
    function (el, content, onChange) {
      var c = assign({}, content);
      el.appendChild(h("p", { class: "ab-banner" }, "🔒 Цю нотатку бачиш тільки ти. Учням її не показують — навіть якщо вони відкриють урок на своєму боці."));
      el.appendChild(mdField("Нотатка", content.body, function (v) { c.body = v; onChange(assign({}, c)); }, { rows: 7, required: true, placeholder: "Ідеї для заняття, правильні відповіді, на що звернути увагу…" }));
    });

  /* =================================================================
     7. The builder shell
     ================================================================= */
  var GROUP_NAME = {};
  GROUPS.forEach(function (g) { GROUP_NAME[g[0]] = g[1]; });

  function iconOf(def) {
    var s = h("span", { class: "ab-ico ab-g-" + (def ? def.group : "unknown"), "aria-hidden": "true" });
    s.innerHTML = (def && def.icon) || ICON.unknown;
    return s;
  }

  function safeLocalErrors(def, content) {
    try { return def && def.check ? def.check(content) || [] : []; } catch (_) { return []; }
  }

  /* Errors to show. Our own checks (friendly, field by field) come first; when they find nothing,
     FMMBlocks.validate gets the last word (length limits and the like). Exercise editors written
     elsewhere have no checks of ours, so for them validate is the only source. */
  function errorsFor(def, type, content) {
    var mine = safeLocalErrors(def, content), v = null, B = window.FMMBlocks;
    if (mine.length) return mine;
    if (B && typeof B.validate === "function") {
      try { v = B.validate({ id: "preview", type: type, position: 1, content: content }); } catch (_) { v = null; }
    }
    if (v && !v.ok && v.errors && v.errors.length) return v.errors.map(humanizeError);
    return [];
  }

  var openEditors = 0;
  function beforeUnload(e) { e.preventDefault(); e.returnValue = ""; return ""; }

  function openEditor(o, block, type) {
    var deps = o.deps, def = REG[type];
    if (!def) {
      var m0 = deps.openModal({ title: "Блок не підключений" });
      m0.body.appendChild(h("p", {}, "Цей тип блоку («" + type + "») ще не підключений, тому його не можна змінити. Онови сторінку; якщо не допоможе — напиши розробнику."));
      m0.body.appendChild(h("div", { class: "ad-actions" }, [btn("Закрити", function () { m0.close(); }, "btn btn-primary btn-sm")]));
      return;
    }
    var original = block ? clone(block.content) : def.empty();
    if (!original || typeof original !== "object") original = {};
    var current = clone(original);
    var saved = false, touched = false, attempted = false;
    /* a save whose answer never came (network, timeout) may still have reached the
       database: then the files of this editor session may be in use, never delete them */
    var maybeSaved = false;
    var uploaded = [];

    var helpers = {
      productId: o.productId,
      upload: function (file) {
        return deps.upload(file).then(function (p) { uploaded.push(p); return p; }, function (e) {
          if (e && !e.friendly && deps.friendly) e.friendly = deps.friendly(e);
          throw e;
        });
      },
      signedUrl: function (src) { return (deps.signedUrl || function (s) { return Promise.resolve(s); })(src); }
    };

    function isDirty() { return !saved && JSON.stringify(current) !== JSON.stringify(original); }

    var modal = deps.openModal({
      title: (block ? "Змінити блок: " : "Новий блок: ") + def.label,
      wide: true, sticky: true, focus: false,
      isDirty: isDirty,
      onClose: function () {
        openEditors = Math.max(0, openEditors - 1);
        if (!openEditors) window.removeEventListener("beforeunload", beforeUnload);
        if (clearTimer) clearTimeout(clearTimer);
        destroyPreview();
        if (!saved && !maybeSaved) {
          var keep = collectPaths(original, o.productId);
          var drop = uploaded.filter(function (p) { return keep.indexOf(p) < 0; });
          if (drop.length && deps.removeFiles) { try { deps.removeFiles(drop); } catch (_) {} }
        }
      }
    });
    openEditors += 1;
    window.addEventListener("beforeunload", beforeUnload);

    var titleInput = inp(current.title, function (v) { if (trim(v)) current.title = v; else delete current.title; changed(); }, { maxlength: "200", placeholder: "Наприклад: Вправа 1. Заповни пропуски" });
    var instrInput = inp(current.instructions, function (v) { if (trim(v)) current.instructions = v; else delete current.instructions; changed(); }, { maxlength: "300", placeholder: "Одне речення: що робити" });
    var common = h("details", { class: "ab-common", open: (current.title || current.instructions) ? true : null }, [
      h("summary", {}, "Заголовок і підказка до завдання (необов'язково)"),
      fld("Заголовок завдання", titleInput, "Його побачить учень над блоком."),
      fld("Підказка під заголовком", instrInput)
    ]);

    var form = h("div", { class: "ab-form" });
    var errBox = h("div", { class: "ab-errors", role: "alert", "aria-live": "polite" });
    var previewEl = h("div", { class: "ab-preview-body" });
    var previewNote = h("p", { class: "ab-hint" });
    var statusEl = h("span", { class: "ab-status", role: "status", "aria-live": "polite" });
    var saveBtn = h("button", { type: "button", class: "btn btn-primary" }, "Зберегти");
    var cancelBtn = h("button", { type: "button", class: "btn btn-ghost" }, "Скасувати");

    var left = h("div", { class: "ab-left" }, [common, form, errBox]);
    var right = h("div", { class: "ab-right" }, [h("p", { class: "ab-label" }, "Так це побачить учень"), previewEl, previewNote]);
    modal.body.appendChild(h("div", { class: "ab-edit" }, [
      h("div", { class: "ad-split" }, [left, right]),
      h("div", { class: "ab-bar" }, [saveBtn, cancelBtn, statusEl])
    ]));

    var previewCtl = null, clearTimer = null;
    function destroyPreview() {
      if (previewCtl && typeof previewCtl.destroy === "function") { try { previewCtl.destroy(); } catch (_) {} }
      previewCtl = null;
    }
    function paintPreview() {
      destroyPreview();
      clear(previewEl);
      var B = window.FMMBlocks;
      if (!B || typeof B.render !== "function") {
        previewNote.textContent = "Попередній перегляд ще не підключений.";
        return;
      }
      previewNote.textContent = "";
      var ctx = {
        mode: "preview", lang: "uk", work: {}, results: {},
        signedUrl: helpers.signedUrl,
        onResult: function () {},
        onSubmitWork: function () { return Promise.resolve(); }
      };
      try { previewCtl = B.render(previewEl, { id: "preview", type: type, position: 1, content: clone(current) }, ctx) || null; }
      catch (e) {
        clear(previewEl);
        previewNote.textContent = "Не вдалося показати перегляд. Заповни поля — він з'явиться.";
      }
    }
    function paintErrors() {
      clear(errBox);
      var errs = errorsFor(def, type, current);
      if (!errs.length) {
        if (touched || attempted) errBox.appendChild(h("p", { class: "ab-ok" }, "Усе заповнено ✓"));
        return errs;
      }
      if (touched || attempted) {
        errBox.appendChild(h("p", { class: "ab-err-head" }, "Ще треба виправити:"));
        errBox.appendChild(h("ul", {}, errs.map(function (e) { return h("li", {}, e); })));
      }
      return errs;
    }
    function paintStatus() {
      statusEl.textContent = maybeSaved && !saved ? "Не вдалося підтвердити, чи збереглося. Закрий вікно й перевір список блоків." : (isDirty() ? "Є незбережені зміни" : "");
    }
    function changed() {
      touched = true;
      paintStatus();
      if (clearTimer) clearTimeout(clearTimer);
      clearTimer = setTimeout(function () { clearTimer = null; paintPreview(); paintErrors(); }, 220);
    }

    function onEditorChange(nc) {
      var next = clone(nc) || {};
      if (trim(current.title)) next.title = current.title; else delete next.title;
      if (trim(current.instructions)) next.instructions = current.instructions; else delete next.instructions;
      current = next;
      changed();
    }

    try {
      def.edit(form, clone(current), onEditorChange, helpers);
    } catch (e) {
      if (window.console && console.error) console.error("block editor:", type, e);
      form.appendChild(h("p", { class: "ab-banner is-bad" }, "Цей редактор не запустився. Онови сторінку; якщо не допоможе — напиши розробнику."));
    }
    paintPreview();
    paintErrors();

    cancelBtn.addEventListener("click", function () { modal.requestClose(); });
    saveBtn.addEventListener("click", function () {
      attempted = true;
      var errs = paintErrors();
      if (errs.length) {
        deps.toast("Спочатку виправ помилки в блоці — вони під формою.", "error");
        if (errBox.scrollIntoView) { try { errBox.scrollIntoView({ block: "nearest", behavior: "smooth" }); } catch (_) {} }
        return;
      }
      var content = clone(current);
      if (JSON.stringify(content).length > 190000) {
        deps.toast("Блок завеликий. Розбий його на кілька менших.", "error");
        return;
      }
      saveBtn.disabled = true; saveBtn.classList.add("is-busy");
      var p = block ? deps.update(block, content) : deps.insert(type, content);
      Promise.resolve(p).then(function (ok) {
        saveBtn.disabled = false; saveBtn.classList.remove("is-busy");
        if (ok === "unknown") { maybeSaved = true; paintStatus(); return; }
        if (!ok) return;
        saved = true; maybeSaved = false;
        /* files that are no longer used by this block or any other */
        var gone = collectPaths(original, o.productId).concat(uploaded);
        var final = collectPaths(content, o.productId);
        var others = (deps.allBlocks ? deps.allBlocks() : []).filter(function (b) { return !block || String(b.id) !== String(block.id); });
        var drop = unusedPaths(gone.filter(function (x) { return final.indexOf(x) < 0; }), others, o.productId);
        if (drop.length && deps.removeFiles) { try { deps.removeFiles(drop); } catch (_) {} }
        modal.close();
      }, function () {
        /* the step failed in a way we cannot read: treat it as possibly saved */
        maybeSaved = true; paintStatus();
        saveBtn.disabled = false; saveBtn.classList.remove("is-busy");
      });
    });
    setTimeout(function () {
      var f = form.querySelector("input:not([type=file]):not([type=range]), textarea, select");
      if (f && f.focus) f.focus();
    }, 30);
  }

  function openPalette(o) {
    var deps = o.deps;
    var modal = deps.openModal({ title: "Додати блок", wide: true });
    var all = R.list();
    modal.body.appendChild(h("p", { class: "ab-hint" }, "Обери, що додати до уроку. Блок з'явиться в кінці списку, а потім його можна пересунути."));
    var any = false;
    GROUPS.forEach(function (g) {
      var items = all.filter(function (x) { return x.group === g[0]; });
      if (!items.length && g[0] !== "exercise") return;
      any = true;
      var sec = h("section", { class: "ab-pal-group" }, [h("h4", { class: "ad-h4" }, g[1])]);
      if (!items.length) {
        sec.appendChild(h("p", { class: "ab-hint" }, "Вправи ще не підключені. Онови сторінку; якщо не допоможе — напиши розробнику."));
      } else {
        sec.appendChild(h("div", { class: "ab-pal-grid" }, items.map(function (x) {
          var d = REG[x.type];
          var b = h("button", { type: "button", class: "ab-pal-item", "data-type": x.type }, [
            iconOf(d),
            h("span", { class: "ab-pal-text" }, [h("strong", {}, d.label), d.hint ? h("small", {}, d.hint) : null])
          ]);
          b.addEventListener("click", function () { modal.close(); openEditor(o, null, x.type); });
          return b;
        })));
      }
      modal.body.appendChild(sec);
    });
    /* types from groups we do not list by name */
    var extra = all.filter(function (x) { return !GROUP_NAME[x.group]; });
    if (extra.length) {
      var sec2 = h("section", { class: "ab-pal-group" }, [h("h4", { class: "ad-h4" }, "Інше")]);
      sec2.appendChild(h("div", { class: "ab-pal-grid" }, extra.map(function (x) {
        var b = h("button", { type: "button", class: "ab-pal-item", "data-type": x.type }, [iconOf(REG[x.type]), h("span", { class: "ab-pal-text" }, h("strong", {}, x.label))]);
        b.addEventListener("click", function () { modal.close(); openEditor(o, null, x.type); });
        return b;
      })));
      modal.body.appendChild(sec2);
    }
    if (!any && !extra.length) modal.body.appendChild(h("p", {}, "Редактори блоків не завантажились. Онови сторінку."));
  }

  var SCORED_WARN = {
    gap: 1, drag_words: 1, choice: 1, order_words: 1, order_sentences: 1, dropdown_gap: 1, truefalse: 1,
    table_fill: 1, match: 1, categorize: 1
  };

  function mount(el, o) {
    var deps = o.deps, blocks = (o.blocks || []).slice();
    clear(el);
    el.classList.add("ab-mount");

    if (!blocks.length) {
      el.appendChild(h("div", { class: "ab-empty" }, [
        h("strong", {}, "Тут ще немає жодного блоку."),
        h("span", {}, "Блок — це шматочок уроку: текст, картинка, вправа, відео… Натисни «Додати блок».")
      ]));
    } else {
      var ol = h("ol", { class: "ab-list" });
      blocks.forEach(function (b, i) {
        var def = REG[b.type];
        var label = def ? def.label : b.type;
        var sum = def ? summarize(b.type, b.content) : "Цей тип блоку ще не підключений";
        var main = h("button", { type: "button", class: "ab-block-main", "aria-label": "Змінити блок " + (i + 1) + ": " + label },
          [h("strong", {}, label), h("span", { class: "ab-sum" }, sum || "Порожній блок")]);
        main.addEventListener("click", function () { openEditor(o, b, b.type); });
        var li = h("li", { class: "ab-block" + (b.type === "teacher_note" ? " is-teacher" : "") + (def ? "" : " is-unknown") }, [
          h("span", { class: "ab-num", "aria-hidden": "true" }, String(i + 1)),
          iconOf(def),
          main,
          h("span", { class: "ab-block-btns" }, [
            iconBtn("↑", "Вище: блок " + (i + 1) + " (" + label + ")", function (e) { guard(e.currentTarget, deps.move(b, -1)); }, i === 0),
            iconBtn("↓", "Нижче: блок " + (i + 1) + " (" + label + ")", function (e) { guard(e.currentTarget, deps.move(b, 1)); }, i === blocks.length - 1),
            btn("Копія", function (e) { guard(e.currentTarget, deps.insert(b.type, clone(b.content), b.id)); }, "ad-link", { "aria-label": "Зробити копію: блок " + (i + 1) + " (" + label + ")" }),
            btn("Видалити", function (e) { askDelete(e.currentTarget, b, label); }, "ad-link-danger", { "aria-label": "Видалити: блок " + (i + 1) + " (" + label + ")" })
          ])
        ]);
        ol.appendChild(li);
      });
      el.appendChild(ol);
    }

    el.appendChild(h("div", { class: "ab-add" }, [
      btn("+ Додати блок", function () { openPalette(o); }, "btn btn-primary btn-sm")
    ]));

    function guard(button, promise) {
      if (button) { button.disabled = true; }
      Promise.resolve(promise).then(function () { if (button) button.disabled = false; }, function () { if (button) button.disabled = false; });
    }

    function askDelete(button, b, label) {
      var extra = "";
      if (b.type === "teacher_note") extra = "";
      else if (SCORED_WARN[b.type] || b.type === "flashcards") extra = " Результати учнів у цій вправі теж зникнуть.";
      else if (b.type === "open_answer" || b.type === "student_file") extra = " Надіслані учнями роботи до цього блоку теж зникнуть.";
      deps.confirm({
        title: "Видалити блок?",
        text: "Блок «" + label + "»" + (summarize(b.type, b.content) ? " (" + summarize(b.type, b.content) + ")" : "") + " зникне з уроку." + extra + " Це не можна скасувати.",
        okLabel: "Так, видалити", danger: true
      }).then(function (yes) {
        if (!yes) return;
        var mine = collectPaths(b.content, o.productId);
        var others = (deps.allBlocks ? deps.allBlocks() : []).filter(function (x) { return String(x.id) !== String(b.id); });
        var drop = unusedPaths(mine, others, o.productId);
        guard(button, Promise.resolve(deps.remove(b)).then(function (ok) {
          if (ok && drop.length && deps.removeFiles) { try { deps.removeFiles(drop); } catch (_) {} }
        }));
      });
    }
  }

  R.mount = mount;
  R.openEditor = function (o, block, type) { openEditor(o, block, type || (block && block.type)); };
  R.helpers = P;
  R.ui = {
    h: h, clear: clear, fld: fld, inp: inp, area: area, selectEl: selectEl, checkbox: checkbox, mdField: mdField,
    uploadBox: uploadBox, rowsEditor: rowsEditor, note: note, btn: btn, iconBtn: iconBtn, svg: svg
  };
  R.GROUPS = GROUPS;
})();
