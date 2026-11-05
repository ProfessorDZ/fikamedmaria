/* =====================================================================
   Fika med Maria — lesson builder: EXERCISE EDITORS (admin only).
   Friendly Ukrainian forms for the 11 exercise types of blocks-spec §1:
   gap, drag_words, choice, order_words, order_sentences, dropdown_gap,
   truefalse, table_fill, match, categorize, flashcards.

   Each editor is registered with FMMBlockEditors.register(type, {
     label, group: "exercise", icon, empty(), edit(el, content, onChange, helpers)
   }) and calls onChange(fullContent) on every edit. Maria never sees JSON.

   Load order: admin-blocks.js (the registry) first, then this file.
   The stylesheet admin-blocks-exercises.css is added automatically
   (next to this script) if the page has not linked it already.
   Everything inside starts with "abe-". ES5-style, no build step.
   ===================================================================== */
(function (root) {
  "use strict";

  var doc = root && root.document;

  /* ---------- tiny DOM helpers ---------- */
  function h(tag, attrs, kids) {
    var el = doc.createElement(tag);
    var k, v;
    if (attrs) {
      for (k in attrs) {
        if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
        v = attrs[k];
        if (v === null || v === undefined || v === false) continue;
        if (k === "class") el.className = v;
        else if (k === "text") el.textContent = v;
        else if (k === "html") el.innerHTML = v;
        else if (k === "value") el.value = v;
        else if (k.slice(0, 2) === "on" && typeof v === "function") el.addEventListener(k.slice(2), v);
        else el.setAttribute(k, v === true ? "" : String(v));
      }
    }
    add(el, kids);
    return el;
  }
  function add(el, kids) {
    if (kids === null || kids === undefined || kids === false) return;
    if (Object.prototype.toString.call(kids) === "[object Array]") {
      for (var i = 0; i < kids.length; i++) add(el, kids[i]);
    } else if (typeof kids === "string" || typeof kids === "number") {
      el.appendChild(doc.createTextNode(String(kids)));
    } else {
      el.appendChild(kids);
    }
  }
  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function isArr(a) { return Object.prototype.toString.call(a) === "[object Array]"; }
  function str(v) { return typeof v === "string" ? v : (v === null || v === undefined ? "" : String(v)); }
  function trim(s) { return str(s).replace(/^\s+|\s+$/g, ""); }
  function uid() { return "abe" + Math.random().toString(36).slice(2, 9); }

  function autosize(t) {
    if (!t || !t.style) return;
    t.style.height = "auto";
    if (t.scrollHeight) t.style.height = (t.scrollHeight + 2) + "px";
  }

  /* An optional field is stored only when it has text. */
  function setOpt(obj, key, val) {
    if (typeof val === "string") val = trim(val) === "" ? "" : val;
    if (val === "" || val === null || val === undefined) delete obj[key];
    else obj[key] = val;
  }

  function ask(helpers, msg) {
    if (helpers && typeof helpers.confirm === "function") return !!helpers.confirm(msg);
    if (root && typeof root.confirm === "function") return !!root.confirm(msg);
    return true;
  }

  /* ---------- our own icons (blue / honey / cream) ---------- */
  var B = "#0d4a85", HO = "#e9a93b", CR = "#f7e6c4";
  function svg(inner) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="' + B +
      '" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + inner + "</svg>";
  }
  var ICONS = {
    gap: svg('<path d="M3 7h5M16 7h5M3 17h18"/><rect x="9.5" y="4.2" width="5" height="5.6" rx="1.3" fill="' + CR + '" stroke="' + HO + '"/>'),
    drag_words: svg('<rect x="3" y="3" width="8" height="5" rx="2" fill="' + HO + '" stroke="' + HO + '"/><rect x="13" y="3" width="8" height="5" rx="2" fill="' + CR + '"/><path d="M12 10.5v5M9.8 13.5l2.2 2.2 2.2-2.2"/><rect x="5" y="17.5" width="14" height="3.6" rx="1.4" stroke-dasharray="2.4 2"/>'),
    choice: svg('<circle cx="6" cy="7" r="2.6" fill="' + HO + '" stroke="' + HO + '"/><circle cx="6" cy="17" r="2.6"/><path d="M11.5 7H21M11.5 17H19"/>'),
    order_words: svg('<rect x="2.5" y="12" width="6" height="6" rx="1.6" fill="' + CR + '"/><rect x="10" y="12" width="5" height="6" rx="1.6" fill="' + HO + '" stroke="' + HO + '"/><rect x="16.5" y="12" width="5" height="6" rx="1.6" fill="' + CR + '"/><path d="M5.5 9c0-3 3-4 6.5-4s6.5 1 6.5 4M16.6 7.4l1.9 1.7 1.7-2"/>'),
    order_sentences: svg('<circle cx="5" cy="6" r="1.6" fill="' + HO + '" stroke="' + HO + '"/><circle cx="5" cy="12" r="1.6" fill="' + CR + '"/><circle cx="5" cy="18" r="1.6" fill="' + CR + '"/><path d="M10 6h11M10 12h11M10 18h8"/>'),
    dropdown_gap: svg('<rect x="3" y="3.5" width="18" height="6.5" rx="2" fill="' + CR + '"/><path d="M15.5 6l1.7 1.8L18.9 6"/><rect x="3" y="12.5" width="18" height="8" rx="2"/><rect x="4.4" y="14" width="15.2" height="2.6" rx="1" fill="' + HO + '" stroke="' + HO + '"/><path d="M6.5 19h8"/>'),
    truefalse: svg('<circle cx="7.5" cy="12" r="4.6" fill="' + CR + '"/><path d="M5.3 12.2l1.7 1.7 3-3.6" stroke="' + B + '"/><circle cx="17" cy="12" r="4.6"/><path d="M15 10l4 4M19 10l-4 4" stroke="' + HO + '" stroke-width="2"/>'),
    table_fill: svg('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9.5h18M9 4v16M15 4v16"/><rect x="9.6" y="10.4" width="5" height="4.2" rx="1" fill="' + HO + '" stroke="' + HO + '"/>'),
    match: svg('<circle cx="5" cy="6" r="1.8" fill="' + HO + '" stroke="' + HO + '"/><circle cx="5" cy="12" r="1.8" fill="' + CR + '"/><circle cx="5" cy="18" r="1.8" fill="' + CR + '"/><circle cx="19" cy="6" r="1.8" fill="' + CR + '"/><circle cx="19" cy="12" r="1.8" fill="' + HO + '" stroke="' + HO + '"/><circle cx="19" cy="18" r="1.8" fill="' + CR + '"/><path d="M7 6l10 12M7 12h10M7 18L17 6"/>'),
    categorize: svg('<rect x="2.5" y="4" width="8.5" height="16" rx="2" fill="' + CR + '"/><rect x="13" y="4" width="8.5" height="16" rx="2"/><rect x="4.2" y="8" width="5" height="3" rx="1" fill="' + HO + '" stroke="' + HO + '"/><rect x="4.2" y="13" width="5" height="3" rx="1"/><rect x="14.8" y="8" width="5" height="3" rx="1"/><path d="M4.5 6h4M15 6h4"/>'),
    flashcards: svg('<rect x="5" y="3" width="15" height="12" rx="2" fill="' + CR + '"/><rect x="3" y="7" width="15" height="12" rx="2" fill="#fffdf8"/><path d="M6.5 11.5h7M6.5 14.5h4"/><path d="M19 19.5a3 3 0 0 0 2.2-4.8M21.2 14.7V17M21.2 14.7H19" stroke="' + HO + '" stroke-width="1.8"/>')
  };

  /* =====================================================================
     Gap syntax helpers (pure functions, also exported for tests)
     ===================================================================== */
  var ESCAPABLE = "[]|\\*";

  /* Read one gap starting at text[start] === "[" the same way the lesson player does
     (assets/blocks.js): escapes \[ \] \| \* \\, "|" splits, a leading "*" marks the right
     option, a gap lives on one line. → { ok, end, parts:[{text,star}] } or { ok:false } */
  function readGap(text, start) {
    var n = text.length, j = start + 1, parts = [], cur = "", star = false, started = false, ch;
    function endOpt() { parts.push({ text: trim(cur), star: star }); cur = ""; star = false; started = false; }
    while (j < n) {
      ch = text.charAt(j);
      if (ch === "\\" && j + 1 < n && ESCAPABLE.indexOf(text.charAt(j + 1)) > -1) { cur += text.charAt(j + 1); started = true; j += 2; continue; }
      if (ch === "]") { endOpt(); return { ok: true, end: j + 1, parts: parts }; }
      if (ch === "[" || ch === "\n") return { ok: false };
      if (ch === "|") { endOpt(); j++; continue; }
      if (ch === "*" && !started && !star) { star = true; j++; continue; }
      if (!/\s/.test(ch)) started = true;
      cur += ch; j++;
    }
    return { ok: false };
  }
  function escGap(t) {
    return str(t).replace(/([\[\]|\\])/g, "\\$1").replace(/^\*/, "\\*");
  }

  /* Walk through the text and collect gaps + structural problems. */
  function scanGaps(text) {
    text = str(text);
    var gaps = [], warns = [], i = 0, n = text.length, line = 1, c, g;
    while (i < n) {
      c = text.charAt(i);
      if (c === "\n") { line++; i++; continue; }
      if (c === "\\" && i + 1 < n && ESCAPABLE.indexOf(text.charAt(i + 1)) > -1) { i += 2; continue; }
      if (c === "[") {
        g = readGap(text, i);
        if (!g.ok) {
          warns.push("У рядку " + line + " дужка «[» не закрита (пропуск має починатися й закінчуватися в одному рядку). Якщо дужка потрібна як звичайний символ, напиши \\[");
          i++; continue;
        }
        gaps.push({ inner: text.slice(i + 1, g.end - 1), parts: g.parts, line: line, start: i, end: g.end });
        i = g.end; continue;
      }
      if (c === "]") warns.push("У рядку " + line + " є зайва «]» без пари. Якщо вона потрібна як звичайний символ, напиши \\]");
      i++;
    }
    return { gaps: gaps, warns: warns };
  }

  /* mode: "gap" | "drag" | "dropdown" → { count, items:[label], warns:[] } */
  function analyze(text, mode) {
    var sc = scanGaps(text), warns = sc.warns.slice(), items = [], i, j, g, parts, stars, texts, right, wrong, empties, emptyGaps = 0;
    for (i = 0; i < sc.gaps.length; i++) {
      g = sc.gaps[i];
      parts = g.parts;
      if (trim(g.inner) === "") {
        warns.push("Порожній пропуск «[]» у рядку " + g.line + " — впиши слово всередині дужок.");
        emptyGaps++;
        continue;
      }
      empties = 0; stars = 0; texts = [];
      for (j = 0; j < parts.length; j++) {
        if (parts[j].star) stars++;
        if (parts[j].text === "") empties++; else texts.push(parts[j].text);
      }
      if (empties) warns.push("У пропуску «[" + trim(g.inner) + "]» (рядок " + g.line + ") є порожній варіант — прибери зайву рисочку «|».");
      if (mode === "dropdown") {
        right = null; wrong = [];
        for (j = 0; j < parts.length; j++) {
          if (parts[j].text === "") continue;
          if (parts[j].star) { if (right === null) right = parts[j].text; else wrong.push(parts[j].text); } else wrong.push(parts[j].text);
        }
        if (stars === 0) warns.push("У пропуску «[" + trim(g.inner) + "]» (рядок " + g.line + ") не позначено правильну відповідь — постав «*» перед нею.");
        else if (stars > 1) warns.push("У пропуску «[" + trim(g.inner) + "]» (рядок " + g.line + ") кілька «*» — правильна має бути лише одна.");
        if (texts.length < 2) warns.push("У пропуску «[" + trim(g.inner) + "]» (рядок " + g.line + ") мало варіантів — додай хоча б один неправильний («Додати варіанти»).");
        var lows = {}, dupe = false;
        for (j = 0; j < texts.length; j++) { if (lows[texts[j].toLowerCase()]) dupe = true; lows[texts[j].toLowerCase()] = true; }
        if (dupe) warns.push("У пропуску «[" + trim(g.inner) + "]» (рядок " + g.line + ") є однакові варіанти — прибери повтор.");
        items.push((right === null ? "?" : right) + (wrong.length ? "  (не те: " + wrong.join(", ") + ")" : ""));
      } else {
        if (stars) warns.push("У пропуску «[" + trim(g.inner) + "]» (рядок " + g.line + ") є «*». Зірочка потрібна тільки у вправі «Заповніть пропуск одним з варіантів».");
        items.push(texts.join(" / "));
      }
    }
    return { count: items.length, items: items, warns: warns, gaps: sc.gaps };
  }

  function isWordChar(c) {
    if (!c) return false;
    return c.toLowerCase() !== c.toUpperCase() || /[0-9'’\-]/.test(c);
  }

  /* The gap that contains the position range [s, e], or null. */
  function gapAround(text, s, e) {
    var sc = scanGaps(text), i, g;
    for (i = 0; i < sc.gaps.length; i++) {
      g = sc.gaps[i];
      if (s >= g.start && e <= g.end) return g;
    }
    return null;
  }

  /* The word to wrap: the selection, or the word under the cursor.
     → { s, e } trimmed, or { error } */
  function pickWord(text, s, e) {
    var a, b;
    if (s > e) { a = s; s = e; e = a; }
    if (s === e) {
      a = s; b = s;
      while (a > 0 && isWordChar(text.charAt(a - 1))) a--;
      while (b < text.length && isWordChar(text.charAt(b))) b++;
      s = a; e = b;
    } else {
      while (s < e && /\s/.test(text.charAt(s))) s++;
      while (e > s && /[\s.,!?;:…"«»()]/.test(text.charAt(e - 1))) e--;
      while (s < e && /[«"(]/.test(text.charAt(s))) s++;
    }
    if (e <= s) return { error: "Спочатку виділи слово у тексті (або постав курсор на слово)." };
    if (/[\[\]]/.test(text.slice(s, e))) return { error: "У виділеному вже є квадратні дужки." };
    return { s: s, e: e };
  }

  /* «Зробити пропуском»: wrap the selected word in [ ] (or [* ] for dropdowns).
     → { text, start, end } | { error } */
  function wrapSelection(text, s, e, prefix) {
    text = str(text); prefix = prefix || "";
    var w = pickWord(text, s, e);
    if (w.error) return w;
    if (gapAround(text, w.s, w.e)) return { error: "Це слово вже стоїть у пропуску." };
    var word = text.slice(w.s, w.e);
    var out = text.slice(0, w.s) + "[" + prefix + word + "]" + text.slice(w.e);
    return { text: out, start: w.s, end: w.s + word.length + prefix.length + 2 };
  }

  function splitWrong(raw) {
    var parts = str(raw).split(/[,;|\n]/), out = [], i, p;
    for (i = 0; i < parts.length; i++) { p = trim(parts[i]).replace(/^\*/, ""); if (p) out.push(p); }
    return out;
  }

  /* «Додати варіанти» for the dropdown: make [*word|wrong|wrong] out of the selected
     word (or extend the gap the cursor is in). → { text, start, end } | { error } */
  function addDropdownOptions(text, s, e, wrongRaw) {
    text = str(text);
    var wrong = isArr(wrongRaw) ? wrongRaw : splitWrong(wrongRaw);
    if (!wrong.length) return { error: "Впиши хоча б один неправильний варіант." };
    var g = gapAround(text, Math.min(s, e), Math.max(s, e)), parts, right = null, others = [], i, p, low, seen, out, newGap;
    if (!g) {
      var w = pickWord(text, s, e);
      if (w.error) return w;
      parts = [{ text: text.slice(w.s, w.e), star: true }];
      g = { start: w.s, end: w.e };
    } else {
      parts = g.parts;
    }
    seen = {};
    for (i = 0; i < parts.length; i++) {
      p = parts[i];
      if (!p.text) continue;
      low = p.text.toLowerCase();
      if (seen[low]) continue;
      seen[low] = true;
      if (p.star && right === null) right = p.text; else others.push(p.text);
    }
    if (right === null) {
      /* gap written as [word] — the first word is the right one */
      right = others.length ? others.shift() : "";
    }
    for (i = 0; i < wrong.length; i++) {
      low = wrong[i].toLowerCase();
      if (!seen[low]) { seen[low] = true; others.push(wrong[i]); }
    }
    newGap = "[*" + escGap(right) + (others.length ? "|" + others.map(escGap).join("|") : "") + "]";
    out = text.slice(0, g.start) + newGap + text.slice(g.end);
    return { text: out, start: g.start, end: g.start + newGap.length };
  }

  /* =====================================================================
     Reusable UI parts
     ===================================================================== */

  /* A text field with label and (optional) hint. Returns { wrap, input }. */
  function textField(o) {
    var id = uid();
    var input = o.multiline
      ? h("textarea", { id: id, rows: o.rows || 2, class: "abe-input abe-area", placeholder: o.placeholder || "" })
      : h("input", { id: id, type: "text", class: "abe-input", placeholder: o.placeholder || "", autocomplete: "off" });
    input.value = str(o.value);
    input.addEventListener("input", function () {
      if (o.multiline) autosize(input);
      o.onInput(input.value);
    });
    if (o.multiline) { input.addEventListener("focus", function () { autosize(input); }); }
    var wrap = h("div", { class: "abe-field" + (o.className ? " " + o.className : "") }, [
      o.label ? h("label", { class: "abe-label", for: id, text: o.label }) : null,
      input,
      o.hint ? h("p", { class: "abe-hint", text: o.hint }) : null
    ]);
    if (o.multiline && root.requestAnimationFrame) root.requestAnimationFrame(function () { autosize(input); });
    return { wrap: wrap, input: input };
  }

  /* Pill-style input: Enter or comma adds, × removes. values is edited in place. */
  function chipsInput(o) {
    var values = o.values;
    var id = uid();
    var box = h("div", { class: "abe-chips" });
    var input = h("input", { id: id, type: "text", class: "abe-chips-input", placeholder: o.placeholder || "Впиши й натисни Enter", autocomplete: "off", "aria-label": o.ariaLabel || "Додати" });
    function draw() {
      clear(box);
      values.forEach(function (v, i) {
        box.appendChild(h("span", { class: "abe-chip" }, [
          h("span", { class: "abe-chip-text", text: v }),
          h("button", { type: "button", class: "abe-chip-x", "aria-label": "Прибрати «" + v + "»", text: "×", onclick: function (ev) {
            ev.stopPropagation();
            values.splice(i, 1);
            draw();
            o.onChange();
            input.focus();
          } })
        ]));
      });
      box.appendChild(input);
    }
    function addRaw(raw) {
      var parts = str(raw).split(/[,;\n]/), changed = false, i, p;
      for (i = 0; i < parts.length; i++) {
        p = trim(parts[i]);
        if (p && values.indexOf(p) < 0) { values.push(p); changed = true; }
      }
      if (changed) { draw(); o.onChange(); }
      input.value = "";
    }
    input.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter" || ev.key === ",") {
        ev.preventDefault();
        if (trim(input.value)) { addRaw(input.value); input.focus(); }
      } else if (ev.key === "Backspace" && input.value === "" && values.length) {
        values.pop(); draw(); o.onChange(); input.focus();
      }
    });
    input.addEventListener("input", function () { if (/[,;\n]/.test(input.value)) addRaw(input.value); });
    input.addEventListener("blur", function () { if (trim(input.value)) addRaw(input.value); });
    box.addEventListener("click", function (ev) { if (ev.target === box) input.focus(); });
    draw();
    var wrap = h("div", { class: "abe-field" }, [
      o.label ? h("label", { class: "abe-label", for: id, text: o.label }) : null,
      box,
      o.hint ? h("p", { class: "abe-hint", text: o.hint }) : null
    ]);
    return { wrap: wrap, input: input, redraw: draw };
  }

  function isLocalUrl(src) { return /^(https?:|data:|blob:|\/|assets\/)/i.test(src); }
  function resolveSrc(helpers, src) {
    if (!src) return Promise.resolve("");
    if (isLocalUrl(src) || !helpers || typeof helpers.signedUrl !== "function") return Promise.resolve(src);
    try { return Promise.resolve(helpers.signedUrl(src)); } catch (e) { return Promise.resolve(""); }
  }

  /* Picture / audio upload field. obj[key] holds the src. */
  function fileField(o) {
    var helpers = o.helpers, obj = o.obj, key = o.key, kind = o.kind || "image";
    var wrap = h("div", { class: "abe-file" });
    var token = 0;
    function draw(msg, isErr) {
      clear(wrap);
      var cur = trim(obj[key]);
      var canUpload = helpers && typeof helpers.upload === "function";
      var label = o.label || (kind === "audio" ? "Аудіо" : "Картинка");
      wrap.appendChild(h("span", { class: "abe-label", text: label }));
      var input = h("input", { type: "file", class: "abe-file-input", accept: kind === "audio" ? "audio/*" : "image/*", "aria-label": label, tabindex: "-1" });
      input.addEventListener("change", function () {
        var f = input.files && input.files[0];
        if (!f) return;
        var my = ++token;
        draw("Завантажую…", false);
        var p;
        try { p = Promise.resolve(helpers.upload(f)); } catch (err) { p = Promise.reject(err); }
        p.then(function (src) {
          if (my !== token) return;
          obj[key] = src;
          draw("", false);
          o.onChange();
        }, function (err) {
          if (my !== token) return;
          draw("Не вдалося завантажити: " + (err && err.message ? err.message : "спробуй ще раз"), true);
        });
      });
      var row = h("div", { class: "abe-file-row" });
      if (cur) {
        if (kind === "audio") {
          var au = h("audio", { controls: true, preload: "none", class: "abe-file-audio" });
          resolveSrc(helpers, cur).then(function (u) { if (u) au.src = u; });
          row.appendChild(au);
        } else {
          var im = h("img", { class: "abe-file-thumb", alt: "" });
          resolveSrc(helpers, cur).then(function (u) { if (u) im.src = u; });
          row.appendChild(im);
        }
      }
      if (canUpload) {
        row.appendChild(h("button", { type: "button", class: "abe-btn abe-btn-sm", onclick: function () { input.click(); }, text: cur ? "Замінити" : (kind === "audio" ? "Додати аудіо" : "Додати картинку") }));
        if (cur) row.appendChild(h("button", { type: "button", class: "abe-link abe-link-danger", onclick: function () { token++; delete obj[key]; draw("", false); o.onChange(); }, text: "Прибрати" }));
      } else if (cur) {
        row.appendChild(h("button", { type: "button", class: "abe-link abe-link-danger", onclick: function () { delete obj[key]; draw("", false); o.onChange(); }, text: "Прибрати" }));
      } else {
        row.appendChild(h("span", { class: "abe-hint", text: "Завантаження файлів тут недоступне." }));
      }
      row.appendChild(input);
      wrap.appendChild(row);
      if (msg) wrap.appendChild(h("p", { class: "abe-file-msg" + (isErr ? " is-bad" : ""), role: "status", text: msg }));
    }
    draw("", false);
    return wrap;
  }

  /* A list of rows with ↑ ↓ × and an «add» button. o.items is edited in place. */
  function rowList(o) {
    var items = o.items;
    var wrap = h("div", { class: "abe-list" + (o.className ? " " + o.className : "") });
    var list = h("div", { class: "abe-rows" });
    var min = o.min === undefined ? 1 : o.min;
    function changed() { if (o.emit) o.emit(); }
    function render(focusIdx) {
      clear(list);
      items.forEach(function (item, i) {
        var body = h("div", { class: "abe-row-body" });
        o.render(item, i, body);
        var num = o.numbering === "letter" ? String.fromCharCode(97 + (i % 26)) : (o.numbering === "none" ? "" : String(i + 1));
        var canRemove = items.length > min;
        var tools = h("div", { class: "abe-row-tools" }, [
          h("button", { type: "button", class: "abe-icon-btn", "aria-label": "Вгору", title: "Вгору", text: "↑", disabled: i === 0 ? "disabled" : null, onclick: function () { move(i, i - 1); } }),
          h("button", { type: "button", class: "abe-icon-btn", "aria-label": "Вниз", title: "Вниз", text: "↓", disabled: i === items.length - 1 ? "disabled" : null, onclick: function () { move(i, i + 1); } }),
          h("button", { type: "button", class: "abe-icon-btn abe-icon-danger", "aria-label": "Видалити", title: canRemove ? "Видалити" : (o.minTitle || "Має лишитися хоча б один рядок"), text: "×", disabled: canRemove ? null : "disabled", onclick: function () { remove(i); } })
        ]);
        var numEl = o.numbering === "none" ? null : h("div", { class: "abe-row-num", "aria-hidden": "true", text: num });
        var row;
        if (o.inline) {
          row = h("div", { class: "abe-row is-inline" + (numEl ? "" : " no-num") }, [numEl, body, tools]);
        } else {
          row = h("div", { class: "abe-row" }, [
            h("div", { class: "abe-row-head" }, [numEl, o.rowLabel ? h("span", { class: "abe-row-label", text: o.rowLabel }) : null, tools]),
            body
          ]);
        }
        list.appendChild(row);
      });
      if (focusIdx !== undefined && list.children[focusIdx]) {
        var f = list.children[focusIdx].querySelector("input[type=text], textarea");
        if (f) f.focus();
      }
      if (o.max) {
        var full = items.length >= o.max;
        if (full) addBtn.setAttribute("disabled", "disabled"); else addBtn.removeAttribute("disabled");
        addBtn.title = full ? "Більше " + o.max + " додати не можна" : "";
      }
      if (o.onRender) o.onRender();
    }
    function move(from, to) {
      if (to < 0 || to >= items.length) return;
      var it = items.splice(from, 1)[0];
      items.splice(to, 0, it);
      if (o.afterMove) o.afterMove(from, to);
      render(to);
      changed();
    }
    function remove(i) {
      if (items.length <= min) return;
      if (!(o.isEmpty && o.isEmpty(items[i])) && !ask(o.helpers, o.confirmText || "Видалити цей рядок?")) return;
      if (o.beforeRemove) o.beforeRemove(i);
      items.splice(i, 1);
      render(Math.min(i, items.length - 1));
      changed();
    }
    var addBtn = h("button", { type: "button", class: "abe-btn abe-btn-add", onclick: function () {
      if (o.max && items.length >= o.max) return;
      items.push(o.newItem());
      render(items.length - 1);
      changed();
    } }, [h("span", { class: "abe-plus", "aria-hidden": "true", text: "+" }), o.addLabel || "Додати рядок"]);
    wrap.appendChild(list);
    wrap.appendChild(h("div", { class: "abe-add" }, addBtn));
    render();
    return { wrap: wrap, render: render };
  }

  function helpBox(summary, paragraphs) {
    var d = h("details", { class: "abe-help" });
    d.appendChild(h("summary", { text: summary }));
    var body = h("div", { class: "abe-help-body" });
    paragraphs.forEach(function (p) {
      if (typeof p === "string") body.appendChild(h("p", { html: p }));
      else body.appendChild(p);
    });
    d.appendChild(body);
    return d;
  }

  function warnBox() { return h("div", { class: "abe-warns", role: "status", "aria-live": "polite" }); }
  function setWarns(box, list) {
    clear(box);
    if (!list.length) { box.hidden = true; return; }
    box.hidden = false;
    box.appendChild(h("ul", null, list.map(function (w) { return h("li", { text: w }); })));
  }

  /* Common set-up of an editor: clears el, makes a root, clones content. */
  function begin(el, content, empty, onChange, helpers, extraClass) {
    var c = clone(content && typeof content === "object" ? content : empty());
    var root_ = h("div", { class: "abe" + (extraClass ? " " + extraClass : "") });
    clear(el);
    el.appendChild(root_);
    var warns = warnBox();
    var api = {
      c: c, root: root_, helpers: helpers || {}, warns: warns,
      check: function () {},
      clean: null,
      emit: function () { api.check(); try { var out = clone(c); if (api.clean) api.clean(out); onChange(out); } catch (e) { if (root && root.console) root.console.error(e); } }
    };
    return api;
  }

  /* Title + instructions are normally edited by the builder shell itself («Заголовок і підказка»).
     They are drawn here only when the host asks: helpers.titleFields === true. */
  function titleFields(api) {
    if (!api.helpers || api.helpers.titleFields !== true) return null;
    var c = api.c;
    var t = textField({ label: "Заголовок вправи (необов'язково)", placeholder: "Наприклад: Вправа 1. Заповни пропуски", value: c.title, onInput: function (v) { setOpt(c, "title", v); api.emit(); } });
    var ins = textField({ label: "Підказка під заголовком (необов'язково)", placeholder: "Наприклад: Впиши слово в дужках у правильній формі", value: c.instructions, onInput: function (v) { setOpt(c, "instructions", v); api.emit(); } });
    return h("div", { class: "abe-top" }, [t.wrap, ins.wrap]);
  }

  function section(title, hint) {
    return h("div", { class: "abe-sec" }, [
      h("h4", { class: "abe-sec-title", text: title }),
      hint ? h("p", { class: "abe-hint", text: hint }) : null
    ]);
  }

  /* =====================================================================
     gap / drag_words / dropdown_gap  (text with [gaps])
     ===================================================================== */
  var GAP_PLACEHOLDER = {
    gap: "Jag [dricker] kaffe.\nHon [åker|kör] till jobbet.",
    drag: "Jag [dricker] kaffe.\nVi [fikar] klockan tre.",
    dropdown: "Jag [*dricker|dricka|drack] kaffe.\nHon [*åker|åka|åkte] till jobbet."
  };

  function gapEditorFactory(mode) {
    return function (el, content, onChange, helpers) {
      var api = begin(el, content, EMPTY[mode === "gap" ? "gap" : mode === "drag" ? "drag_words" : "dropdown_gap"], onChange, helpers);
      var c = api.c, r = api.root;
      if (typeof c.text !== "string") c.text = "";
      if (mode === "drag" && !isArr(c.extra)) c.extra = [];

      var tf = titleFields(api);
      if (tf) r.appendChild(tf);

      /* --- the text box --- */
      var taId = uid();
      var ta = h("textarea", { id: taId, class: "abe-input abe-area abe-gaptext", rows: 7, spellcheck: "false", placeholder: GAP_PLACEHOLDER[mode] });
      ta.value = c.text;
      var lead = mode === "dropdown"
        ? "Пиши текст як звичайно. Там, де учень має вибрати, постав слово в квадратні дужки, а перед правильним словом — зірочку: Jag [*dricker|dricka|drack] kaffe."
        : mode === "drag"
          ? "Пиши текст як звичайно. Слово, яке треба вставити, візьми в квадратні дужки: Jag [dricker] kaffe. Ці слова потраплять у банк, звідки учень їх перетягує."
          : "Пиши текст як звичайно. Слово, яке учень має вписати сам, візьми в квадратні дужки: Jag [dricker] kaffe.";
      r.appendChild(h("div", { class: "abe-field" }, [
        h("label", { class: "abe-label", for: taId, text: "Текст вправи" }),
        h("p", { class: "abe-hint", text: lead }),
        ta
      ]));

      /* --- helper buttons --- */
      var msg = h("p", { class: "abe-msg", role: "status", "aria-live": "polite" });
      var bar = h("div", { class: "abe-toolbar" });
      var lastSel = { s: 0, e: 0 };
      function saveSel() { lastSel = { s: ta.selectionStart || 0, e: ta.selectionEnd || 0 }; }
      ["keyup", "mouseup", "select", "blur", "input"].forEach(function (ev) { ta.addEventListener(ev, saveSel); });

      function applyResult(res) {
        if (res.error) { showMsg(res.error, true); return false; }
        ta.value = res.text; c.text = res.text;
        autosize(ta);
        ta.focus();
        try { ta.setSelectionRange(res.start, res.end); } catch (e) { /* ignore */ }
        saveSel();
        api.emit();
        showMsg("", false);
        return true;
      }
      function showMsg(text, bad) { msg.textContent = text; msg.className = "abe-msg" + (bad ? " is-bad" : ""); }

      var makeBtn = h("button", { type: "button", class: "abe-btn abe-btn-sm", onmousedown: function (ev) { ev.preventDefault(); }, onclick: function () {
        saveSel();
        applyResult(wrapSelection(ta.value, lastSel.s, lastSel.e, mode === "dropdown" ? "*" : ""));
      }, title: "Виділи слово в тексті, потім натисни" }, [h("span", { class: "abe-bracket", "aria-hidden": "true", text: "[ ]" }), " Зробити пропуском"]);
      bar.appendChild(makeBtn);

      var optPanel = null;
      if (mode === "dropdown") {
        var optBtn = h("button", { type: "button", class: "abe-btn abe-btn-sm", onmousedown: function (ev) { ev.preventDefault(); }, onclick: function () {
          saveSel();
          openOptPanel();
        } }, [h("span", { class: "abe-plus", "aria-hidden": "true", text: "+" }), " Додати варіанти"]);
        bar.appendChild(optBtn);
        optPanel = h("div", { class: "abe-optpanel", hidden: true });
      }
      r.appendChild(bar);
      if (optPanel) r.appendChild(optPanel);
      r.appendChild(msg);

      function openOptPanel() {
        var sel = { s: lastSel.s, e: lastSel.e };
        var g = gapAround(ta.value, Math.min(sel.s, sel.e), Math.max(sel.s, sel.e));
        var word;
        if (g) {
          var pr = null, i;
          for (i = 0; i < g.parts.length; i++) if (g.parts[i].star) { pr = g.parts[i].text; break; }
          word = pr || (g.parts[0] && g.parts[0].text) || "";
        } else {
          var pw = pickWord(ta.value, sel.s, sel.e);
          if (pw.error) { showMsg(pw.error, true); return; }
          word = ta.value.slice(pw.s, pw.e);
        }
        showMsg("", false);
        clear(optPanel);
        optPanel.hidden = false;
        var inpId = uid();
        var inp = h("input", { id: inpId, type: "text", class: "abe-input", placeholder: "dricka, drack", autocomplete: "off" });
        function done() { optPanel.hidden = true; clear(optPanel); }
        function submit() {
          var res = addDropdownOptions(ta.value, sel.s, sel.e, inp.value);
          if (res.error) { showMsg(res.error, true); return; }
          if (applyResult(res)) done();
        }
        inp.addEventListener("keydown", function (ev) { if (ev.key === "Enter") { ev.preventDefault(); submit(); } else if (ev.key === "Escape") done(); });
        optPanel.appendChild(h("p", { class: "abe-optpanel-title" }, ["Правильне слово: ", h("strong", { text: word }), ". Які ще варіанти покажемо в списку (неправильні)?"]));
        optPanel.appendChild(h("div", { class: "abe-optpanel-row" }, [
          h("label", { class: "abe-label", for: inpId, text: "Неправильні варіанти через кому" }),
          inp,
          h("div", { class: "abe-optpanel-btns" }, [
            h("button", { type: "button", class: "abe-btn abe-btn-primary abe-btn-sm", onclick: submit, text: "Додати" }),
            h("button", { type: "button", class: "abe-link", onclick: done, text: "Скасувати" })
          ])
        ]));
        inp.focus();
      }

      /* --- extra words (drag_words) --- */
      var chips = null;
      if (mode === "drag") {
        chips = chipsInput({
          values: c.extra, label: "Зайві слова (необов'язково)",
          hint: "Це слова-пастки: їх немає в тексті, але вони будуть у банку поруч з правильними. Пиши слово й натискай Enter.",
          placeholder: "Наприклад: dricka — і Enter", ariaLabel: "Додати зайве слово",
          onChange: function () { api.emit(); }
        });
        r.appendChild(chips.wrap);
      }

      /* --- help --- */
      var examples = [
        "<b>Один пропуск.</b> <code>Jag [dricker] kaffe.</code> — учень впише <i>dricker</i>.",
        "<b>Кілька правильних відповідей</b> — через рисочку: <code>Hon [åker|kör] till jobbet.</code> — підійде і <i>åker</i>, і <i>kör</i>.",
        "<b>Список на вибір</b> — зірочка перед правильним словом: <code>Jag [*dricker|dricka|drack] kaffe.</code> (для вправи з випадаючим списком).",
        "Пропусків може бути багато, а рядків — скільки завгодно. Новий рядок — це Enter.",
        "Швидкий спосіб: виділи слово в тексті й натисни «Зробити пропуском».",
        "Великі й малі літери та крапка в кінці не важливі. Літери å, ä, ö треба писати правильно."
      ];
      if (mode === "gap") examples.splice(2, 1);
      if (mode === "dropdown") examples = [
        "<b>Один пропуск зі списком.</b> <code>Jag [*dricker|dricka|drack] kaffe.</code> — перше слово зі зірочкою <code>*</code> правильне, решта — неправильні. Учень побачить усі слова в списку, у випадковому порядку.",
        "Правильне слово має бути <b>одне</b> (одна зірочка) і хоча б <b>один</b> неправильний варіант.",
        "Швидкий спосіб: виділи слово, натисни «Додати варіанти» й впиши неправильні через кому — дужки й зірочка з'являться самі.",
        "Пропусків може бути багато, а рядків — скільки завгодно."
      ];
      if (mode === "drag") examples.push("Слова з усіх пропусків (і зайві слова) потрапляють у банк. Учень перетягує слово або торкається слова, а потім пропуску.");
      r.appendChild(helpBox("Як позначати пропуски?", [h("ul", { class: "abe-help-list", html: examples.map(function (x) { return "<li>" + x + "</li>"; }).join("") })]));

      /* --- live result --- */
      var live = h("div", { class: "abe-live", role: "status", "aria-live": "polite" });
      r.appendChild(live);
      r.appendChild(api.warns);

      api.check = function () {
        var res = analyze(c.text, mode);
        var extras = mode === "drag" ? c.extra : [];
        clear(live);
        var ok = res.count > 0 && !res.warns.length;
        live.className = "abe-live" + (res.count === 0 ? " is-empty" : (res.warns.length ? " is-warn" : " is-ok"));
        if (res.count === 0) {
          live.appendChild(h("p", { class: "abe-live-head", text: "Поки немає жодного пропуску. Виділи слово в тексті й натисни «Зробити пропуском»." }));
        } else {
          live.appendChild(h("p", { class: "abe-live-head" }, [
            "Знайдено пропусків: ", h("strong", { text: String(res.count) }),
            ok ? " ✓" : ""
          ]));
          live.appendChild(h("ol", { class: "abe-live-list" }, res.items.map(function (it, i) { return h("li", null, [h("span", { class: "abe-live-n", text: String(i + 1) }), it]); })));
          if (extras.length) live.appendChild(h("p", { class: "abe-live-extra", text: "Зайві слова в банку: " + extras.join(", ") }));
        }
        var all = res.warns.slice();
        if (mode === "drag" && c.extra.length > 30) all.push("Зайвих слів забагато (" + c.extra.length + ") — у вправі може бути до 30.");
        setWarns(api.warns, all);
      };

      ta.addEventListener("input", function () { c.text = ta.value; autosize(ta); api.emit(); });
      ta.addEventListener("focus", function () { autosize(ta); });
      if (root.requestAnimationFrame) root.requestAnimationFrame(function () { autosize(ta); });
      api.check();
    };
  }

  /* =====================================================================
     choice
     ===================================================================== */
  function editChoice(el, content, onChange, helpers) {
    var api = begin(el, content, EMPTY.choice, onChange, helpers);
    var c = api.c, r = api.root;
    if (!isArr(c.questions)) c.questions = [];
    if (!c.questions.length) c.questions.push(newChoiceQ());
    c.questions.forEach(normChoiceQ);

    var tf = titleFields(api);
    if (tf) r.appendChild(tf);
    r.appendChild(section("Питання", "Для кожного питання впиши варіанти й познач галочкою правильні. Якщо правильний один — учень побачить кружечки, якщо кілька — квадратики."));

    var qs = rowList({
      items: c.questions, helpers: helpers, emit: api.emit, addLabel: "Додати питання", numbering: "num", rowLabel: "Питання",
      confirmText: "Видалити це питання з усіма варіантами?",
      isEmpty: function (q) { return !trim(q.q) && q.options.every(function (o) { return !trim(o); }) && !trim(q.explain); },
      newItem: newChoiceQ,
      render: function (q, qi, body) {
        body.appendChild(textField({ label: "Текст питання", multiline: true, rows: 2, value: q.q, placeholder: "Наприклад: Що ти п'єш вранці?", onInput: function (v) { q.q = v; api.emit(); } }).wrap);
        body.appendChild(h("p", { class: "abe-label", text: "Варіанти відповіді (галочка — правильний)" }));
        var opts = rowList({
          items: q.options, helpers: helpers, emit: api.emit, min: 2, max: 8, minTitle: "Потрібно хоча б два варіанти",
          numbering: "letter", inline: true, addLabel: "Додати варіант", className: "abe-opts",
          confirmText: "Видалити цей варіант?",
          isEmpty: function (o) { return !trim(o); },
          newItem: function () { return ""; },
          beforeRemove: function (i) {
            q.correct = q.correct.filter(function (x) { return x !== i; }).map(function (x) { return x > i ? x - 1 : x; });
          },
          afterMove: function (from, to) {
            q.correct = q.correct.map(function (x) {
              if (x === from) return to;
              if (from < to && x > from && x <= to) return x - 1;
              if (from > to && x >= to && x < from) return x + 1;
              return x;
            }).sort(function (a, b) { return a - b; });
          },
          render: function (opt, oi, obody) {
            var cb = h("input", { type: "checkbox", class: "abe-correct-cb", "aria-label": "Правильна відповідь" });
            cb.checked = q.correct.indexOf(oi) >= 0;
            cb.addEventListener("change", function () {
              var idx = q.correct.indexOf(oi);
              if (cb.checked && idx < 0) q.correct.push(oi);
              if (!cb.checked && idx >= 0) q.correct.splice(idx, 1);
              q.correct.sort(function (a, b) { return a - b; });
              lab.className = "abe-correct" + (cb.checked ? " is-on" : "");
              api.emit();
            });
            var lab = h("label", { class: "abe-correct" + (cb.checked ? " is-on" : "") }, [cb, h("span", { text: "правильно" })]);
            var inp = h("input", { type: "text", class: "abe-input", placeholder: "Варіант відповіді", autocomplete: "off", "aria-label": "Варіант відповіді" });
            inp.value = opt;
            inp.addEventListener("input", function () { q.options[oi] = inp.value; api.emit(); });
            obody.appendChild(h("div", { class: "abe-opt" }, [inp, lab]));
          },
          onRender: function () {}
        });
        body.appendChild(opts.wrap);
        body.appendChild(textField({ label: "Пояснення (необов'язково)", value: q.explain, placeholder: "Покажеться учневі після перевірки", onInput: function (v) { setOpt(q, "explain", v); api.emit(); } }).wrap);
      }
    });
    r.appendChild(qs.wrap);
    r.appendChild(api.warns);

    api.check = function () {
      var w = [];
      c.questions.forEach(function (q, i) {
        var n = "Питання " + (i + 1) + ": ";
        if (!trim(q.q)) w.push(n + "напиши текст питання.");
        var filled = q.options.filter(function (o) { return trim(o); }).length;
        if (filled < 2) w.push(n + "потрібно хоча б два заповнені варіанти.");
        else if (q.options.some(function (o) { return !trim(o); })) w.push(n + "є порожній варіант — заповни або видали його.");
        var lowOpts = {}, dupOpt = false;
        q.options.forEach(function (o) { var k = trim(o).toLowerCase(); if (k) { if (lowOpts[k]) dupOpt = true; lowOpts[k] = true; } });
        if (dupOpt) w.push(n + "є однакові варіанти — прибери повтор.");
        if (!q.correct.length) w.push(n + "познач галочкою хоча б одну правильну відповідь.");
        else if (q.correct.some(function (x) { return !trim(q.options[x]); })) w.push(n + "правильним позначено порожній варіант.");
      });
      setWarns(api.warns, w);
    };
    api.check();
  }
  function newChoiceQ() { return { q: "", options: ["", ""], correct: [] }; }
  function normChoiceQ(q) {
    if (typeof q.q !== "string") q.q = str(q.q);
    if (!isArr(q.options)) q.options = [];
    q.options = q.options.map(str);
    while (q.options.length < 2) q.options.push("");
    if (!isArr(q.correct)) q.correct = [];
    q.correct = q.correct.filter(function (x) { return typeof x === "number" && x >= 0 && x < q.options.length; });
  }

  /* =====================================================================
     truefalse
     ===================================================================== */
  function editTrueFalse(el, content, onChange, helpers) {
    var api = begin(el, content, EMPTY.truefalse, onChange, helpers);
    var c = api.c, r = api.root;
    if (!isArr(c.statements)) c.statements = [];
    if (!c.statements.length) c.statements.push(newStatement());
    c.statements.forEach(function (s) { s.text = str(s.text); s.answer = s.answer !== false; });

    var tf = titleFields(api);
    if (tf) r.appendChild(tf);
    r.appendChild(section("Твердження", "Напиши твердження й познач, правдиве воно чи ні."));

    var list = rowList({
      items: c.statements, helpers: helpers, emit: api.emit, addLabel: "Додати твердження", numbering: "num", rowLabel: "Твердження",
      isEmpty: function (s) { return !trim(s.text) && !trim(s.explain); },
      newItem: newStatement,
      render: function (s, i, body) {
        body.appendChild(textField({ label: "Твердження", multiline: true, rows: 2, value: s.text, placeholder: "Наприклад: Fika — це кава з булочкою.", onInput: function (v) { s.text = v; api.emit(); } }).wrap);
        var group = h("div", { class: "abe-tf", role: "radiogroup", "aria-label": "Правильна відповідь" });
        var bT = h("button", { type: "button", class: "abe-tf-btn is-true", role: "radio", text: "Правда" });
        var bF = h("button", { type: "button", class: "abe-tf-btn is-false", role: "radio", text: "Неправда" });
        function paint() {
          bT.setAttribute("aria-checked", s.answer ? "true" : "false");
          bF.setAttribute("aria-checked", s.answer ? "false" : "true");
          bT.className = "abe-tf-btn is-true" + (s.answer ? " is-on" : "");
          bF.className = "abe-tf-btn is-false" + (!s.answer ? " is-on" : "");
        }
        bT.addEventListener("click", function () { s.answer = true; paint(); api.emit(); });
        bF.addEventListener("click", function () { s.answer = false; paint(); api.emit(); });
        paint();
        group.appendChild(h("span", { class: "abe-tf-label", text: "Правильна відповідь:" }));
        group.appendChild(bT); group.appendChild(bF);
        body.appendChild(group);
        body.appendChild(textField({ label: "Пояснення (необов'язково)", value: s.explain, placeholder: "Покажеться після перевірки", onInput: function (v) { setOpt(s, "explain", v); api.emit(); } }).wrap);
      }
    });
    r.appendChild(list.wrap);
    r.appendChild(api.warns);
    api.check = function () {
      var w = [];
      c.statements.forEach(function (s, i) { if (!trim(s.text)) w.push("Твердження " + (i + 1) + ": напиши текст."); });
      setWarns(api.warns, w);
    };
    api.check();
  }
  function newStatement() { return { text: "", answer: true }; }

  /* =====================================================================
     order_words
     ===================================================================== */
  function sortedWords(s) {
    return trim(s).split(/\s+/).map(function (x) { return x.toLowerCase().replace(/[.!?]+$/, ""); }).filter(Boolean).sort().join(" ");
  }
  function wordCount(s) { var t = trim(s); return t ? t.split(/\s+/).length : 0; }

  function editOrderWords(el, content, onChange, helpers) {
    var api = begin(el, content, EMPTY.order_words, onChange, helpers);
    var c = api.c, r = api.root;
    if (!isArr(c.sentences)) c.sentences = [];
    if (!c.sentences.length) c.sentences.push(newSentence());
    c.sentences.forEach(function (s) { s.answer = str(s.answer); if (s.alt && !isArr(s.alt)) delete s.alt; });

    var tf = titleFields(api);
    if (tf) r.appendChild(tf);
    r.appendChild(section("Речення", "Впиши речення в правильному порядку. Слова перемішаються, а учень збере речення сам."));

    var list = rowList({
      items: c.sentences, helpers: helpers, emit: api.emit, addLabel: "Додати речення", numbering: "num", rowLabel: "Речення",
      isEmpty: function (s) { return !trim(s.answer) && !(s.alt && s.alt.some(trim)); },
      newItem: newSentence,
      render: function (s, i, body) {
        var count = h("span", { class: "abe-count" });
        function paintCount() {
          var n = wordCount(s.answer);
          count.textContent = n ? "Слів: " + n : "";
          count.className = "abe-count" + (n === 1 ? " is-warn" : "");
        }
        var tfld = textField({ label: "Правильне речення", value: s.answer, placeholder: "Jag dricker kaffe varje morgon.", onInput: function (v) { s.answer = v; paintCount(); api.emit(); } });
        tfld.wrap.appendChild(count);
        body.appendChild(tfld.wrap);
        paintCount();
        /* alternatives */
        var altWrap = h("div", { class: "abe-alt" });
        function drawAlt() {
          clear(altWrap);
          var alts = s.alt || [];
          if (!alts.length) {
            altWrap.appendChild(h("button", { type: "button", class: "abe-link", text: "+ Є інший правильний порядок слів", onclick: function () {
              s.alt = [""]; drawAlt(); var f = altWrap.querySelector("input"); if (f) f.focus(); api.emit();
            } }));
            return;
          }
          altWrap.appendChild(h("p", { class: "abe-label", text: "Інші правильні варіанти цього речення" }));
          var lst = rowList({
            items: s.alt, helpers: helpers, min: 0, numbering: "none", inline: true, addLabel: "Ще один варіант", className: "abe-alt-list",
            emit: function () { api.emit(); },
            isEmpty: function (x) { return !trim(x); },
            newItem: function () { return ""; },
            onRender: function () {},
            render: function (x, xi, xb) {
              var inp = h("input", { type: "text", class: "abe-input", placeholder: "Наприклад: Varje morgon dricker jag kaffe.", autocomplete: "off", "aria-label": "Інший правильний варіант" });
              inp.value = x;
              inp.addEventListener("input", function () { s.alt[xi] = inp.value; api.emit(); });
              xb.appendChild(inp);
            }
          });
          /* when the last alternative is removed, drop the empty list */
          altWrap.appendChild(lst.wrap);
          altWrap.appendChild(h("button", { type: "button", class: "abe-link abe-link-danger", text: "Прибрати всі додаткові варіанти", onclick: function () {
            var any = s.alt.some(function (z) { return trim(z); });
            if (any && !ask(helpers, "Прибрати всі додаткові варіанти?")) return;
            delete s.alt; drawAlt(); api.emit();
          } }));
        }
        drawAlt();
        body.appendChild(altWrap);
      }
    });
    r.appendChild(list.wrap);
    r.appendChild(api.warns);
    api.clean = function (out) {
      out.sentences.forEach(function (s) {
        if (s.alt) { s.alt = s.alt.filter(function (x) { return trim(x); }); if (!s.alt.length) delete s.alt; }
      });
    };
    api.check = function () {
      var w = [];
      c.sentences.forEach(function (s, i) {
        var n = "Речення " + (i + 1) + ": ";
        var k = wordCount(s.answer);
        if (!k) w.push(n + "впиши речення.");
        else if (k === 1) w.push(n + "тут одне слово — його нічого переставляти. Додай ще слова.");
        (s.alt || []).forEach(function (a) {
          if (trim(a) && k && sortedWords(a) !== sortedWords(s.answer)) w.push(n + "інший варіант «" + trim(a) + "» має складатися з тих самих слів, що й головне речення (змінюється лише порядок).");
        });
      });
      setWarns(api.warns, w);
    };
    api.check();
  }
  function newSentence() { return { answer: "" }; }

  /* =====================================================================
     order_sentences
     ===================================================================== */
  function editOrderSentences(el, content, onChange, helpers) {
    var api = begin(el, content, EMPTY.order_sentences, onChange, helpers);
    var c = api.c, r = api.root;
    if (!isArr(c.items)) c.items = [];
    c.items = c.items.map(str);
    while (c.items.length < 2) c.items.push("");

    var tf = titleFields(api);
    if (tf) r.appendChild(tf);
    r.appendChild(section("Речення у правильному порядку", "Впиши речення так, як вони мають стояти (зверху — перше). Учень побачить їх перемішаними й розставить сам. Порядок можна змінити стрілками ↑ ↓."));
    var list = rowList({
      items: c.items, helpers: helpers, emit: api.emit, addLabel: "Додати речення", numbering: "num", inline: true, min: 2, max: 30, minTitle: "Потрібно хоча б два речення",
      isEmpty: function (x) { return !trim(x); },
      newItem: function () { return ""; },
      render: function (item, i, body) {
        var ta = h("textarea", { class: "abe-input abe-area", rows: 1, placeholder: i === 0 ? "Наприклад: Först kokar jag kaffe." : "", "aria-label": "Речення " + (i + 1) });
        ta.value = item;
        ta.addEventListener("input", function () { c.items[i] = ta.value; autosize(ta); api.emit(); });
        ta.addEventListener("focus", function () { autosize(ta); });
        body.appendChild(ta);
        if (root.requestAnimationFrame) root.requestAnimationFrame(function () { autosize(ta); });
      }
    });
    r.appendChild(list.wrap);
    r.appendChild(api.warns);
    api.check = function () {
      var w = [];
      var filled = c.items.filter(function (x) { return trim(x); }).length;
      if (filled < 2) w.push("Потрібно хоча б два речення, щоб було що розставляти.");
      if (c.items.some(function (x) { return !trim(x); }) && c.items.length > 1) w.push("Є порожнє речення — заповни або видали його.");
      var seenS = {}, dupS = false;
      c.items.forEach(function (x) { var k = trim(x).toLowerCase(); if (k) { if (seenS[k]) dupS = true; seenS[k] = true; } });
      if (dupS) w.push("Є однакові речення — тоді порядок буде неоднозначним. Зроби їх різними.");
      setWarns(api.warns, w);
    };
    api.check();
  }

  /* =====================================================================
     table_fill
     ===================================================================== */
  function editTableFill(el, content, onChange, helpers) {
    var api = begin(el, content, EMPTY.table_fill, onChange, helpers);
    var c = api.c, r = api.root;
    if (!isArr(c.header)) c.header = [];
    if (!isArr(c.rows)) c.rows = [];
    c.header = c.header.map(str);
    c.rows = c.rows.map(function (row) { return isArr(row) ? row.map(str) : []; });
    var ncols = c.header.length;
    c.rows.forEach(function (row) { if (row.length > ncols) ncols = row.length; });
    if (ncols < 1) ncols = 2;
    if (!c.rows.length) c.rows.push([]);
    /* The lesson format always stores one header cell per column (the player skips
       empty header cells); "no header row" = all header cells blank. */
    var hasHeader = c.header.some(trim) || !c.rows.some(function (row) { return row.some(trim); });
    var stash = hasHeader ? c.header.slice() : [];
    function fit() {
      c.rows.forEach(function (row) { while (row.length < ncols) row.push(""); row.length = ncols; });
      while (c.header.length < ncols) c.header.push("");
      c.header.length = ncols;
      if (!hasHeader) c.header = c.header.map(function () { return ""; });
    }
    fit();

    var tf = titleFields(api);
    if (tf) r.appendChild(tf);
    r.appendChild(section("Таблиця", "Заповни клітинки. Якщо учень має вписати слово — візьми його в квадратні дужки, наприклад [dricker]. Клітинки без дужок учень побачить як звичайний текст."));

    /* header toggle */
    var hdrId = uid();
    var hdrCb = h("input", { type: "checkbox", id: hdrId });
    hdrCb.checked = hasHeader;
    hdrCb.addEventListener("change", function () {
      hasHeader = hdrCb.checked;
      if (hasHeader) { c.header = stash.length === ncols ? stash.slice() : []; }
      else { stash = c.header.slice(); }
      fit(); draw(); api.emit();
    });
    r.appendChild(h("label", { class: "abe-check", for: hdrId }, [hdrCb, h("span", { text: "Перший рядок — заголовки колонок" })]));

    var lastCell = null, lastSel = { s: 0, e: 0 };
    var msg = h("p", { class: "abe-msg", role: "status", "aria-live": "polite" });
    var bar = h("div", { class: "abe-toolbar" }, [
      h("button", { type: "button", class: "abe-btn abe-btn-sm", onmousedown: function (ev) { ev.preventDefault(); }, onclick: function () {
        if (!lastCell) { msg.textContent = "Спочатку клацни в клітинку й виділи в ній слово."; msg.className = "abe-msg is-bad"; return; }
        var res = wrapSelection(lastCell.input.value, lastSel.s, lastSel.e);
        if (res.error) { msg.textContent = res.error; msg.className = "abe-msg is-bad"; return; }
        lastCell.input.value = res.text;
        lastCell.set(res.text);
        lastCell.input.focus();
        try { lastCell.input.setSelectionRange(res.start, res.end); } catch (e) { /* ignore */ }
        msg.textContent = ""; msg.className = "abe-msg";
      } }, [h("span", { class: "abe-bracket", "aria-hidden": "true", text: "[ ]" }), " Зробити пропуском"])
    ]);
    r.appendChild(bar);
    r.appendChild(msg);

    var gridWrap = h("div", { class: "abe-grid-scroll" });
    r.appendChild(gridWrap);

    function cellInput(value, placeholder, setter, label) {
      var inp = h("input", { type: "text", class: "abe-input abe-cell" + (value.indexOf("[") >= 0 ? " has-gap" : ""), placeholder: placeholder || "", autocomplete: "off", "aria-label": label });
      inp.value = value;
      var rec = { input: inp, set: function (v) { setter(v); inp.className = "abe-input abe-cell" + (v.indexOf("[") >= 0 ? " has-gap" : ""); api.emit(); } };
      inp.addEventListener("input", function () { rec.set(inp.value); });
      function save() { lastCell = rec; lastSel = { s: inp.selectionStart || 0, e: inp.selectionEnd || 0 }; }
      ["focus", "keyup", "mouseup", "select", "blur"].forEach(function (ev) { inp.addEventListener(ev, save); });
      return inp;
    }
    function colNonEmpty(j) { return (hasHeader && trim(c.header[j])) || c.rows.some(function (row) { return trim(row[j]); }); }
    function moveCol(j, to) {
      if (to < 0 || to >= ncols) return;
      function mv(arr) { var x = arr.splice(j, 1)[0]; arr.splice(to, 0, x); }
      mv(c.header);
      c.rows.forEach(mv);
      draw(); api.emit();
    }
    function removeCol(j) {
      if (ncols <= 1) return;
      if (colNonEmpty(j) && !ask(helpers, "Видалити цю колонку разом з вмістом?")) return;
      c.header.splice(j, 1);
      c.rows.forEach(function (row) { row.splice(j, 1); });
      ncols--; draw(); api.emit();
    }
    function moveRow(i, to) {
      if (to < 0 || to >= c.rows.length) return;
      var x = c.rows.splice(i, 1)[0]; c.rows.splice(to, 0, x);
      draw(); api.emit();
    }
    function removeRow(i) {
      if (c.rows.length <= 1) return;
      if (c.rows[i].some(trim) && !ask(helpers, "Видалити цей рядок таблиці?")) return;
      c.rows.splice(i, 1); draw(); api.emit();
    }
    function ib(text, label, fn, disabled, danger) {
      return h("button", { type: "button", class: "abe-icon-btn abe-icon-sm" + (danger ? " abe-icon-danger" : ""), "aria-label": label, title: label, text: text, disabled: disabled ? "disabled" : null, onclick: fn });
    }
    function draw() {
      clear(gridWrap);
      var t = h("table", { class: "abe-grid" });
      var thead = h("thead");
      var trTools = h("tr", { class: "abe-grid-tools" });
      var j, i;
      for (j = 0; j < ncols; j++) {
        (function (j) {
          trTools.appendChild(h("th", { scope: "col" }, h("div", { class: "abe-grid-coltools" }, [
            ib("←", "Колонку " + (j + 1) + " ліворуч", function () { moveCol(j, j - 1); }, j === 0),
            ib("→", "Колонку " + (j + 1) + " праворуч", function () { moveCol(j, j + 1); }, j === ncols - 1),
            ib("×", ncols <= 1 ? "Має лишитися хоча б одна колонка" : "Видалити колонку " + (j + 1), function () { removeCol(j); }, ncols <= 1, true)
          ])));
        })(j);
      }
      trTools.appendChild(h("th", { class: "abe-grid-corner" }));
      thead.appendChild(trTools);
      if (hasHeader) {
        var trH = h("tr", { class: "abe-grid-head" });
        for (j = 0; j < ncols; j++) {
          (function (j) { trH.appendChild(h("td", null, cellInput(c.header[j], "Заголовок", function (v) { c.header[j] = v; }, "Заголовок колонки " + (j + 1)))); })(j);
        }
        trH.appendChild(h("td", { class: "abe-grid-corner" }));
        thead.appendChild(trH);
      }
      t.appendChild(thead);
      var tb = h("tbody");
      for (i = 0; i < c.rows.length; i++) {
        (function (i) {
          var tr = h("tr");
          for (var jj = 0; jj < ncols; jj++) {
            (function (jj) { tr.appendChild(h("td", null, cellInput(c.rows[i][jj], "", function (v) { c.rows[i][jj] = v; }, "Рядок " + (i + 1) + ", колонка " + (jj + 1)))); })(jj);
          }
          tr.appendChild(h("td", { class: "abe-grid-rowtools" }, h("div", { class: "abe-grid-rt" }, [
            ib("↑", "Рядок вгору", function () { moveRow(i, i - 1); }, i === 0),
            ib("↓", "Рядок вниз", function () { moveRow(i, i + 1); }, i === c.rows.length - 1),
            ib("×", c.rows.length <= 1 ? "Має лишитися хоча б один рядок" : "Видалити рядок", function () { removeRow(i); }, c.rows.length <= 1, true)
          ])));
          tb.appendChild(tr);
        })(i);
      }
      t.appendChild(tb);
      gridWrap.appendChild(t);
      limits();
      api.check();
    }

    var addRowBtn = h("button", { type: "button", class: "abe-btn abe-btn-add", onclick: function () {
      if (c.rows.length >= 100) return;
      var row = []; for (var k = 0; k < ncols; k++) row.push("");
      c.rows.push(row); draw(); api.emit();
      var inputs = gridWrap.querySelectorAll("tbody tr:last-child input"); if (inputs[0]) inputs[0].focus();
    } }, [h("span", { class: "abe-plus", "aria-hidden": "true", text: "+" }), "Додати рядок"]);
    var addColBtn = h("button", { type: "button", class: "abe-btn abe-btn-add", onclick: function () {
      if (ncols >= 12) return;
      ncols++; c.header.push(""); if (stash.length) stash.push("");
      c.rows.forEach(function (row) { row.push(""); });
      draw(); api.emit();
    } }, [h("span", { class: "abe-plus", "aria-hidden": "true", text: "+" }), "Додати колонку"]);
    r.appendChild(h("div", { class: "abe-add abe-add-row" }, [addRowBtn, addColBtn]));
    function limits() {
      if (ncols >= 12) { addColBtn.setAttribute("disabled", "disabled"); addColBtn.title = "Більше 12 колонок додати не можна"; }
      else { addColBtn.removeAttribute("disabled"); addColBtn.title = ""; }
      if (c.rows.length >= 100) addRowBtn.setAttribute("disabled", "disabled"); else addRowBtn.removeAttribute("disabled");
    }

    r.appendChild(helpBox("Як позначати пропуски?", [h("ul", { class: "abe-help-list", html:
      "<li><b>Пропуск у клітинці:</b> <code>[dricker]</code> — учень впише це слово. Клітинки з дужками підсвічені.</li>" +
      "<li>Кілька правильних відповідей — через рисочку: <code>[åker|kör]</code>.</li>" +
      "<li>Можна поєднати текст і пропуск в одній клітинці: <code>jag [dricker]</code>.</li>" +
      "<li>Клітинка без дужок — це звичайний текст, учень її не змінює.</li>" +
      "<li>Швидкий спосіб: клацни в клітинку, виділи слово й натисни «Зробити пропуском».</li>" }) ]));
    var live = h("div", { class: "abe-live", role: "status", "aria-live": "polite" });
    r.appendChild(live);
    r.appendChild(api.warns);

    api.check = function () {
      var total = 0, w = [];
      function scanCell(text, where) {
        var res = analyze(text, "gap");
        total += res.count;
        res.warns.forEach(function (x) { w.push(where + ": " + x); });
      }
      if (hasHeader) c.header.forEach(function (x, j) { scanCell(x, "заголовок колонки " + (j + 1)); });
      c.rows.forEach(function (row, i) { row.forEach(function (x, j) { scanCell(x, "рядок " + (i + 1) + ", колонка " + (j + 1)); }); });
      clear(live);
      live.className = "abe-live" + (total === 0 ? " is-empty" : (w.length ? " is-warn" : " is-ok"));
      live.appendChild(h("p", { class: "abe-live-head" }, total === 0
        ? "Поки немає жодного пропуску. Візьми слово в квадратні дужки, щоб учень його вписав."
        : ["Пропусків у таблиці: ", h("strong", { text: String(total) }), w.length ? "" : " ✓"]));
      setWarns(api.warns, w);
    };
    draw();
  }

  /* =====================================================================
     match
     ===================================================================== */
  function editMatch(el, content, onChange, helpers) {
    var api = begin(el, content, EMPTY.match, onChange, helpers);
    var c = api.c, r = api.root;
    if (!isArr(c.pairs)) c.pairs = [];
    while (c.pairs.length < 2) c.pairs.push(newPair());
    c.pairs.forEach(function (p) { p.left = str(p.left); p.right = str(p.right); });

    var tf = titleFields(api);
    if (tf) r.appendChild(tf);
    r.appendChild(section("Пари", "У кожному рядку — що з чим з'єднується. До кожної частини можна додати картинку. Учень побачить обидві колонки перемішаними."));
    var list = rowList({
      items: c.pairs, helpers: helpers, emit: api.emit, addLabel: "Додати пару", numbering: "num", rowLabel: "Пара", min: 2, max: 12, minTitle: "Потрібно хоча б дві пари",
      isEmpty: function (p) { return !trim(p.left) && !trim(p.right) && !p.left_src && !p.right_src; },
      newItem: newPair,
      render: function (p, i, body) {
        function side(textKey, srcKey, label, ph) {
          var box = h("div", { class: "abe-pair-side" });
          box.appendChild(textField({ label: label, value: p[textKey], placeholder: ph, onInput: function (v) { p[textKey] = v; api.emit(); } }).wrap);
          box.appendChild(fileField({ obj: p, key: srcKey, kind: "image", helpers: helpers, label: "Картинка (необов'язково)", onChange: api.emit }));
          return box;
        }
        body.appendChild(h("div", { class: "abe-pair" }, [
          side("left", "left_src", "Ліва частина", "Наприклад: kaffe"),
          h("div", { class: "abe-pair-link", "aria-hidden": "true", text: "↔" }),
          side("right", "right_src", "Права частина", "Наприклад: кава")
        ]));
      }
    });
    r.appendChild(list.wrap);
    r.appendChild(api.warns);
    api.check = function () {
      var w = [];
      c.pairs.forEach(function (p, i) {
        var n = "Пара " + (i + 1) + ": ";
        if (!trim(p.left) && !p.left_src) w.push(n + "додай текст або картинку ліворуч.");
        if (!trim(p.right) && !p.right_src) w.push(n + "додай текст або картинку праворуч.");
      });
      setWarns(api.warns, w);
    };
    api.check();
  }
  function newPair() { return { left: "", right: "" }; }

  /* =====================================================================
     categorize
     ===================================================================== */
  function editCategorize(el, content, onChange, helpers) {
    var api = begin(el, content, EMPTY.categorize, onChange, helpers);
    var c = api.c, r = api.root;
    if (!isArr(c.columns)) c.columns = [];
    c.columns.forEach(function (col) { col.title = str(col.title); col.items = isArr(col.items) ? col.items.map(str) : []; });
    while (c.columns.length < 2) c.columns.push(newColumn());

    var tf = titleFields(api);
    if (tf) r.appendChild(tf);
    r.appendChild(section("Колонки", "Дай назву кожній колонці й впиши, що до неї належить. Учень побачить усі слова разом, перемішані, і розкладе їх по колонках."));
    var list = rowList({
      items: c.columns, helpers: helpers, emit: api.emit, addLabel: "Додати колонку", numbering: "num", rowLabel: "Колонка", min: 2, max: 6, minTitle: "Потрібно хоча б дві колонки",
      confirmText: "Видалити цю колонку разом з її словами?",
      isEmpty: function (col) { return !trim(col.title) && !col.items.length; },
      newItem: newColumn,
      render: function (col, i, body) {
        body.appendChild(textField({ label: "Назва колонки", value: col.title, placeholder: i === 0 ? "Наприклад: en-ord (en kopp)" : "Наприклад: ett-ord (ett bröd)", onInput: function (v) { col.title = v; api.emit(); } }).wrap);
        body.appendChild(chipsInput({
          values: col.items, label: "Що належить до цієї колонки",
          hint: "Впиши слово або короткий вираз і натисни Enter (або кому).",
          placeholder: "Впиши й натисни Enter", ariaLabel: "Додати елемент до колонки " + (i + 1),
          onChange: api.emit
        }).wrap);
      }
    });
    r.appendChild(list.wrap);
    r.appendChild(api.warns);
    api.check = function () {
      var w = [], seen = {}, total = 0;
      c.columns.forEach(function (col, i) {
        var n = "Колонка " + (i + 1) + ": ";
        if (!trim(col.title)) w.push(n + "дай їй назву.");
        if (!col.items.length) w.push(n + "додай хоча б одне слово.");
        col.items.forEach(function (it) {
          var k = it.toLowerCase();
          if (seen[k] !== undefined && seen[k] !== i) w.push("Слово «" + it + "» є і в колонці " + (seen[k] + 1) + ", і в колонці " + (i + 1) + " — учень не зможе знати, куди його класти.");
          else if (seen[k] === i) w.push("Слово «" + it + "» повторюється в колонці " + (i + 1) + " — залиш одне.");
          else seen[k] = i;
          total++;
        });
      });
      if (total > 60) w.push("Забагато слів (" + total + "): у вправі може бути до 60.");
      setWarns(api.warns, w);
    };
    api.check();
  }
  function newColumn() { return { title: "", items: [] }; }

  /* =====================================================================
     flashcards
     ===================================================================== */
  function editFlashcards(el, content, onChange, helpers) {
    var api = begin(el, content, EMPTY.flashcards, onChange, helpers);
    var c = api.c, r = api.root;
    if (!isArr(c.cards)) c.cards = [];
    if (!c.cards.length) c.cards.push(newCard());
    c.cards.forEach(function (k) { k.front = str(k.front); k.back = str(k.back); });

    var tf = titleFields(api);
    if (tf) r.appendChild(tf);
    r.appendChild(section("Картки", "Учень натискає на картку, і вона перевертається. На лицьовій стороні — питання чи слово, на зворотній — відповідь. До картки можна додати картинку й аудіо."));
    var list = rowList({
      items: c.cards, helpers: helpers, emit: api.emit, addLabel: "Додати картку", numbering: "num", rowLabel: "Картка",
      isEmpty: function (k) { return !trim(k.front) && !trim(k.back) && !k.front_src && !k.audio_src; },
      newItem: newCard,
      render: function (k, i, body) {
        body.appendChild(h("div", { class: "abe-card2" }, [
          textField({ label: "Лицьова сторона", multiline: true, rows: 2, value: k.front, placeholder: "Наприклад: en kopp", onInput: function (v) { k.front = v; api.emit(); } }).wrap,
          textField({ label: "Зворотна сторона", multiline: true, rows: 2, value: k.back, placeholder: "Наприклад: чашка", onInput: function (v) { k.back = v; api.emit(); } }).wrap
        ]));
        body.appendChild(h("div", { class: "abe-card2 abe-card-media" }, [
          fileField({ obj: k, key: "front_src", kind: "image", helpers: helpers, label: "Картинка на картці (необов'язково)", onChange: api.emit }),
          fileField({ obj: k, key: "audio_src", kind: "audio", helpers: helpers, label: "Аудіо (необов'язково)", onChange: api.emit })
        ]));
      }
    });
    r.appendChild(list.wrap);
    r.appendChild(api.warns);
    api.check = function () {
      var w = [];
      c.cards.forEach(function (k, i) {
        var n = "Картка " + (i + 1) + ": ";
        if (!trim(k.front) && !k.front_src) w.push(n + "заповни лицьову сторону.");
        if (!trim(k.back)) w.push(n + "заповни зворотну сторону.");
      });
      setWarns(api.warns, w);
    };
    api.check();
  }
  function newCard() { return { front: "", back: "" }; }

  /* =====================================================================
     Empty content of each type (one blank row, ready to fill in)
     ===================================================================== */
  var EMPTY = {
    gap: function () { return { text: "" }; },
    drag_words: function () { return { text: "", extra: [] }; },
    choice: function () { return { questions: [newChoiceQ()] }; },
    order_words: function () { return { sentences: [newSentence()] }; },
    order_sentences: function () { return { items: ["", ""] }; },
    dropdown_gap: function () { return { text: "" }; },
    truefalse: function () { return { statements: [newStatement()] }; },
    table_fill: function () { return { header: ["", ""], rows: [["", ""]] }; },
    match: function () { return { pairs: [newPair(), newPair()] }; },
    categorize: function () { return { columns: [newColumn(), newColumn()] }; },
    flashcards: function () { return { cards: [newCard()] }; }
  };

  var DEFS = [
    ["gap", "Заповніть пропуск", gapEditorFactory("gap")],
    ["drag_words", "Перетягніть слова", gapEditorFactory("drag")],
    ["choice", "Оберіть правильний варіант", editChoice],
    ["order_words", "Розкладіть у правильному порядку", editOrderWords],
    ["order_sentences", "Розставте речення по порядку", editOrderSentences],
    ["dropdown_gap", "Заповніть пропуск одним з варіантів", gapEditorFactory("dropdown")],
    ["truefalse", "True чи False", editTrueFalse],
    ["table_fill", "Заповніть таблицю", editTableFill],
    ["match", "З'єднайте елементи", editMatch],
    ["categorize", "Розкладіть по колонках", editCategorize],
    ["flashcards", "Фліп-картки", editFlashcards]
  ];

  /* ---------- exports (tests + other scripts) ---------- */
  var kit = {
    scanGaps: scanGaps, analyze: analyze, wrapSelection: wrapSelection,
    addDropdownOptions: addDropdownOptions, splitWrong: splitWrong,
    icons: ICONS, empty: function (type) { return EMPTY[type](); },
    types: DEFS.map(function (d) { return d[0]; })
  };
  if (root) root.FMMExerciseEditors = kit;

  /* ---------- make sure the stylesheet is there ---------- */
  function ensureCss() {
    if (!doc || !doc.querySelector || !doc.head) return;
    try {
      if (doc.querySelector('link[href*="admin-blocks-exercises.css"]')) return;
      var s = doc.currentScript && doc.currentScript.src;
      if (!s) {
        var all = doc.getElementsByTagName("script"), i;
        for (i = 0; i < all.length; i++) if ((all[i].src || "").indexOf("admin-blocks-exercises.js") >= 0) { s = all[i].src; break; }
      }
      if (!s) return;
      var link = doc.createElement("link");
      link.rel = "stylesheet";
      link.href = s.replace(/admin-blocks-exercises\.js(\?.*)?$/, "admin-blocks-exercises.css$1");
      doc.head.appendChild(link);
    } catch (e) { /* the page still works, just unstyled */ }
  }

  /* ---------- register ---------- */
  function register() {
    var reg = root && root.FMMBlockEditors;
    if (!reg || typeof reg.register !== "function") return false;
    DEFS.forEach(function (d) {
      reg.register(d[0], { label: d[1], group: "exercise", icon: ICONS[d[0]], empty: EMPTY[d[0]], edit: d[2] });
    });
    return true;
  }

  if (doc) {
    ensureCss();
    if (!register() && doc.addEventListener) {
      /* registry not loaded yet (wrong script order): try again once the page is ready */
      doc.addEventListener("DOMContentLoaded", register);
    }
  }
})(typeof window !== "undefined" ? window : undefined);
