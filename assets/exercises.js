/* =====================================================================
   Fika med Maria — interactive exercises engine
   Global: window.FMMExercises
     validate(content)                 -> { ok, errors[] }   (Ukrainian, for the admin)
     render(container, content, opts)  -> { reset() }
     _check.{choice,multi,truefalse,gap,order,match}, _normalise   (pure, for tests)
   Format and rules: fikamedmaria-backend/docs/platform-spec.md, section 3.
   All text from the content goes into the page with textContent only, never
   as HTML. Every UI string goes through T() (assets/i18n.js).
   ===================================================================== */
(function () {
  "use strict";

  var TYPES = ["choice", "multi", "truefalse", "gap", "order", "match"];
  var MAX_ITEMS = 100;
  var MAX_OPTIONS = 12;
  var MAX_PAIRS = 12;

  /* T(): window.FMMI18N.T / window.T when i18n.js is loaded, otherwise identity
     (with {name} placeholders still filled). Looked up at call time. */
  function T(s, v) {
    var f = (window.FMMI18N && window.FMMI18N.T) || window.T;
    if (typeof f === "function") return f(s, v);
    s = String(s == null ? "" : s);
    return v ? s.replace(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g, function (m, k) { return v[k] != null ? String(v[k]) : m; }) : s;
  }

  /* ---------------------------------------------------------------
     Checking (pure functions)
     --------------------------------------------------------------- */
  function str(s) { return s == null ? "" : String(s); }

  /* trim, collapse spaces, lower-case, drop final . ! ? (å/ä/ö/é stay) */
  function normalise(s) {
    s = str(s);
    if (typeof s.normalize === "function") s = s.normalize("NFC");
    s = s.replace(/[‘’ʼ]/g, "'")
         .replace(/\s+/g, " ")
         .replace(/^ +| +$/g, "")
         .toLowerCase();
    return s.replace(/[.!?…]+$/, "").replace(/ +$/, "");
  }

  /* like normalise, but without accents: å ä -> a, ö -> o, é -> e */
  function fold(s) {
    s = normalise(s);
    if (typeof s.normalize === "function") return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
    return s.replace(/[åä]/g, "a").replace(/ö/g, "o").replace(/é/g, "e");
  }

  function toList(x) { return Array.isArray(x) ? x : [x]; }

  /* "ok" | "almost" (only å/ä/ö/é differ) | "wrong" */
  function checkGap(given, accepted) {
    var g = normalise(given);
    if (!g) return "wrong";
    var list = toList(accepted), i, almost = false, gf = fold(given);
    for (i = 0; i < list.length; i++) {
      if (normalise(list[i]) === g) return "ok";
    }
    for (i = 0; i < list.length; i++) {
      if (fold(list[i]) === gf) almost = true;
    }
    return almost ? "almost" : "wrong";
  }

  /* given: sentence string or array of words; accepted: list of sentences */
  function checkOrder(given, accepted) {
    if (Array.isArray(given)) given = given.join(" ");
    return checkGap(given, accepted);
  }

  function checkChoice(given, answer) {
    return typeof given === "number" && given === answer;
  }

  function uniqueSorted(a) {
    var out = [], i;
    for (i = 0; i < a.length; i++) {
      if (typeof a[i] !== "number") return null;
      if (out.indexOf(a[i]) === -1) out.push(a[i]);
    }
    return out.sort(function (x, y) { return x - y; });
  }

  /* exact set of options */
  function checkMulti(given, answer) {
    if (!Array.isArray(given) || !Array.isArray(answer)) return false;
    var g = uniqueSorted(given), a = uniqueSorted(answer), i;
    if (!g || !a || g.length !== a.length) return false;
    for (i = 0; i < a.length; i++) { if (g[i] !== a[i]) return false; }
    return true;
  }

  function checkTrueFalse(given, answer) {
    return typeof given === "boolean" && given === answer;
  }

  /* given[i] = index of the pair whose right side the student put next to left
     side i (null if none). Right sides with identical text are interchangeable. */
  function checkMatch(given, pairs) {
    if (!Array.isArray(given) || !Array.isArray(pairs) || given.length !== pairs.length) return false;
    var i, r;
    for (i = 0; i < pairs.length; i++) {
      r = given[i];
      if (typeof r !== "number" || !pairs[r]) return false;
      if (r !== i && normalise(pairs[r][1]) !== normalise(pairs[i][1])) return false;
    }
    return true;
  }

  /* ---------------------------------------------------------------
     validate(content) — messages for the admin (Ukrainian)
     --------------------------------------------------------------- */
  function isStr(x) { return typeof x === "string" && /\S/.test(x); }
  function isInt(x) { return typeof x === "number" && isFinite(x) && Math.floor(x) === x; }
  function isObj(x) { return x !== null && typeof x === "object" && !Array.isArray(x); }
  function countBlanks(p) { var m = str(p).match(/_{3,}/g); return m ? m.length : 0; }

  function tokens(s) {
    var parts = str(s).split(/\s+/), out = [], i, t;
    for (i = 0; i < parts.length; i++) {
      t = normalise(parts[i]);
      if (parts[i] !== "") out.push(t);
    }
    return out.sort();
  }

  function sameTokens(a, b) {
    var i;
    if (a.length !== b.length) return false;
    for (i = 0; i < a.length; i++) { if (a[i] !== b[i]) return false; }
    return true;
  }

  function validateItem(it, n, errors) {
    var pre = "Завдання " + n + ": ";
    function bad(msg) { errors.push(pre + msg); }
    var i, k;

    if (!isObj(it)) { bad("має бути об'єктом { \"type\": …, … }"); return; }
    if (TYPES.indexOf(it.type) === -1) {
      bad("невідомий тип «" + str(it.type) + "» (є: " + TYPES.join(", ") + ")");
      return;
    }
    var t = it.type;

    ["prompt", "explain", "hint"].forEach(function (key) {
      if (it[key] !== undefined && it[key] !== null && typeof it[key] !== "string") bad("поле " + key + " має бути текстом");
    });
    if (it.audio !== undefined && it.audio !== null && it.audio !== "") {
      if (typeof it.audio !== "string" || !/^https:\/\//i.test(it.audio)) bad("audio має бути посиланням, що починається з https://");
    }

    if (t === "choice" || t === "multi") {
      if (!isStr(it.prompt)) bad("у " + t + " немає питання (prompt)");
      if (!Array.isArray(it.options) || it.options.length < 2) {
        bad("у " + t + " потрібно щонайменше 2 варіанти в options");
        return;
      }
      if (it.options.length > MAX_OPTIONS) bad("забагато варіантів у options (максимум " + MAX_OPTIONS + ")");
      for (i = 0; i < it.options.length; i++) {
        if (!isStr(it.options[i])) { bad("варіант " + (i + 1) + " в options порожній або не є текстом"); return; }
      }
      var len = it.options.length;
      if (t === "choice") {
        if (!isInt(it.answer) || it.answer < 0 || it.answer >= len) {
          bad("answer має бути номером правильного варіанта, починаючи з 0 (від 0 до " + (len - 1) + ")");
        }
      } else {
        if (!Array.isArray(it.answer) || !it.answer.length) {
          bad("answer у multi має бути непорожнім списком номерів, наприклад [0, 2]");
        } else {
          var seen = [];
          for (i = 0; i < it.answer.length; i++) {
            if (!isInt(it.answer[i]) || it.answer[i] < 0 || it.answer[i] >= len) {
              bad("в answer є номер, якого немає серед варіантів (допустимо від 0 до " + (len - 1) + ")");
              break;
            }
            if (seen.indexOf(it.answer[i]) !== -1) { bad("в answer номер " + it.answer[i] + " повторюється"); break; }
            seen.push(it.answer[i]);
          }
        }
      }
    } else if (t === "truefalse") {
      if (!isStr(it.statement)) bad("у truefalse немає твердження (statement)");
      if (typeof it.answer !== "boolean") bad("answer має бути true або false (без лапок)");
    } else if (t === "gap") {
      if (!isStr(it.prompt)) { bad("у gap немає речення (prompt) з пропусками ___"); return; }
      var blanks = countBlanks(it.prompt);
      if (!blanks) { bad("у gap у prompt немає жодного пропуску ___ (три підкреслення або більше)"); return; }
      if (!Array.isArray(it.answers)) {
        bad("answers має бути списком списків, наприклад [[\"dricker\"], [\"äter\", \"tar\"]]");
        return;
      }
      if (it.answers.length !== blanks) {
        bad("у gap кількість пропусків ___ (" + blanks + ") не збігається з answers (" + it.answers.length + ")");
      }
      for (i = 0; i < it.answers.length; i++) {
        var a = toList(it.answers[i]), okList = a.length > 0;
        for (k = 0; k < a.length; k++) { if (!isStr(a[k])) okList = false; }
        if (!okList) bad("у answers для пропуску " + (i + 1) + " потрібен непорожній список правильних слів");
      }
    } else if (t === "order") {
      if (!Array.isArray(it.words) || it.words.length < 2) {
        bad("у order потрібно щонайменше 2 слова в words");
        return;
      }
      if (it.words.length > 20) bad("забагато слів у words (максимум 20)");
      for (i = 0; i < it.words.length; i++) {
        if (!isStr(it.words[i])) { bad("слово " + (i + 1) + " в words порожнє або не є текстом"); return; }
      }
      var answers = typeof it.answer === "string" ? [it.answer] : it.answer;
      if (!Array.isArray(answers) || !answers.length) {
        bad("answer має бути списком правильних речень, наприклад [\"I dag jobbar jag inte\"]");
        return;
      }
      var wt = tokens(it.words.join(" "));
      for (i = 0; i < answers.length; i++) {
        if (!isStr(answers[i])) { bad("речення " + (i + 1) + " в answer порожнє або не є текстом"); continue; }
        if (!sameTokens(tokens(answers[i]), wt)) {
          bad("слова в answer («" + answers[i] + "») не збігаються зі словами в words (регістр та знак у кінці не важливі)");
        }
      }
    } else if (t === "match") {
      if (!Array.isArray(it.pairs) || it.pairs.length < 2) {
        bad("у match потрібно щонайменше 2 пари в pairs");
        return;
      }
      if (it.pairs.length > MAX_PAIRS) bad("забагато пар у pairs (максимум " + MAX_PAIRS + ")");
      var lefts = {};
      for (i = 0; i < it.pairs.length; i++) {
        var p = it.pairs[i];
        if (!Array.isArray(p) || p.length !== 2 || !isStr(p[0]) || !isStr(p[1])) {
          bad("пара " + (i + 1) + " має вигляд [\"hund\", \"собака\"]");
          continue;
        }
        var key = normalise(p[0]);
        if (lefts[key] !== undefined) bad("ліве слово «" + p[0] + "» повторюється в парах " + lefts[key] + " і " + (i + 1));
        else lefts[key] = i + 1;
      }
    }
  }

  function validate(content) {
    var errors = [];
    if (typeof content === "string") {
      try { content = JSON.parse(content); }
      catch (e) { return { ok: false, errors: ["Це не схоже на правильний JSON: " + e.message] }; }
    }
    if (!isObj(content)) {
      return { ok: false, errors: ["Вміст вправи має бути об'єктом: { \"version\": 1, \"items\": [ … ] }"] };
    }
    if (content.version !== undefined && content.version !== 1) {
      errors.push("Непідтримувана версія формату (" + str(content.version) + "), потрібна version: 1");
    }
    if (!Array.isArray(content.items) || !content.items.length) {
      errors.push("Немає жодного завдання: items має бути непорожнім списком");
      return { ok: false, errors: errors };
    }
    if (content.items.length > MAX_ITEMS) errors.push("Забагато завдань (" + content.items.length + "), максимум " + MAX_ITEMS);
    content.items.forEach(function (it, i) { validateItem(it, i + 1, errors); });
    return { ok: errors.length === 0, errors: errors };
  }

  /* ---------------------------------------------------------------
     DOM helpers (textContent only — nothing from content becomes HTML)
     --------------------------------------------------------------- */
  var uid = 0;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function btn(cls, text) {
    var b = el("button", cls, text);
    b.type = "button";
    return b;
  }
  function empty(n) { while (n.firstChild) n.removeChild(n.firstChild); }
  function shuffle(arr) {
    var a = arr.slice(), i, j, t;
    for (i = a.length - 1; i > 0; i--) {
      j = Math.floor(Math.random() * (i + 1));
      t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  /* shuffled copy that is not "bad" (e.g. not already the right order) */
  function shuffleNot(arr, isBad) {
    var a, k;
    for (k = 0; k < 30; k++) {
      a = shuffle(arr);
      if (!isBad(a)) return a;
    }
    a = arr.slice(1).concat(arr.slice(0, 1));
    if (!isBad(a)) return a;
    return arr.slice().reverse();
  }
  function safeFocus(n) { try { n.focus(); } catch (e) { /* ignore */ } }

  /* ---------------------------------------------------------------
     Item builders. Each returns a controller:
       body        node with the controls
       ownPrompt   true when the builder draws the prompt itself (gap)
       get()       the student's answer (small JSON)
       evaluate()  { status: "right"|"almost"|"wrong", empty: bool }
       mark()      paint ✓/✗ on the controls after checking
       correct()   text with the correct answer, correctLabel
       lock(on)    enable/disable the controls
     --------------------------------------------------------------- */
  function markText(node, text) {
    var m = node.querySelector(".fmx-mark");
    if (m) m.textContent = text;
  }

  function buildOptions(item, num, ctx, kind) {
    var group = el("div", "fmx-options");
    group.setAttribute("role", kind === "radio" ? "radiogroup" : "group");
    var name = ctx.id + "-q" + num, inputs = [], labels = [];
    var texts = item.type === "truefalse" ? [T("Правда"), T("Неправда")] : item.options;
    texts.forEach(function (opt, i) {
      var lab = el("label", "fmx-opt");
      var inp = el("input");
      inp.type = kind;
      inp.name = name;
      inp.value = String(i);
      var mark = el("span", "fmx-mark");
      mark.setAttribute("aria-hidden", "true");
      lab.appendChild(inp);
      lab.appendChild(el("span", "fmx-opt-text", opt));
      lab.appendChild(mark);
      group.appendChild(lab);
      inputs.push(inp);
      labels.push(lab);
    });
    function paintPicked() {
      labels.forEach(function (lab, i) {
        if (inputs[i].checked) lab.classList.add("is-picked"); else lab.classList.remove("is-picked");
      });
    }
    group.addEventListener("change", paintPicked);
    return {
      group: group,
      inputs: inputs,
      labels: labels,
      lock: function (on) { inputs.forEach(function (x) { x.disabled = on; }); }
    };
  }

  function buildChoice(item, num, ctx) {
    var o = buildOptions(item, num, ctx, "radio");
    function get() {
      for (var i = 0; i < o.inputs.length; i++) { if (o.inputs[i].checked) return i; }
      return null;
    }
    return {
      body: o.group,
      get: get,
      lock: o.lock,
      evaluate: function () {
        var g = get();
        return { status: checkChoice(g, item.answer) ? "right" : "wrong", empty: g === null };
      },
      mark: function () {
        var g = get();
        o.labels.forEach(function (lab, i) {
          if (i === item.answer) { lab.classList.add("is-correct"); markText(lab, "✓"); }
          else if (i === g) { lab.classList.add("is-wrong"); markText(lab, "✗"); }
        });
      },
      correctLabel: T("Правильна відповідь:"),
      correct: function () { return item.options[item.answer]; }
    };
  }

  function buildMulti(item, num, ctx) {
    var o = buildOptions(item, num, ctx, "checkbox");
    var wrap = el("div", "fmx-multi");
    wrap.appendChild(el("p", "fmx-note", T("Можна обрати кілька відповідей.")));
    wrap.appendChild(o.group);
    function get() {
      var out = [];
      o.inputs.forEach(function (x, i) { if (x.checked) out.push(i); });
      return out;
    }
    return {
      body: wrap,
      get: get,
      lock: o.lock,
      evaluate: function () {
        var g = get();
        return { status: checkMulti(g, item.answer) ? "right" : "wrong", empty: g.length === 0 };
      },
      mark: function () {
        var g = get();
        o.labels.forEach(function (lab, i) {
          var want = item.answer.indexOf(i) !== -1, has = g.indexOf(i) !== -1;
          if (want) { lab.classList.add("is-correct"); markText(lab, "✓"); }
          else if (has) { lab.classList.add("is-wrong"); markText(lab, "✗"); }
        });
      },
      correctLabel: T("Правильні відповіді:"),
      correct: function () {
        return item.answer.slice().sort(function (a, b) { return a - b; })
          .map(function (i) { return item.options[i]; }).join(", ");
      }
    };
  }

  function buildTrueFalse(item, num, ctx) {
    var o = buildOptions(item, num, ctx, "radio");
    function get() {
      if (o.inputs[0].checked) return true;
      if (o.inputs[1].checked) return false;
      return null;
    }
    var right = item.answer ? 0 : 1;
    return {
      body: o.group,
      get: get,
      lock: o.lock,
      evaluate: function () {
        var g = get();
        return { status: checkTrueFalse(g, item.answer) ? "right" : "wrong", empty: g === null };
      },
      mark: function () {
        var g = get();
        o.labels.forEach(function (lab, i) {
          if (i === right) { lab.classList.add("is-correct"); markText(lab, "✓"); }
          else if (g !== null && i === (g ? 0 : 1)) { lab.classList.add("is-wrong"); markText(lab, "✗"); }
        });
      },
      correctLabel: T("Правильна відповідь:"),
      correct: function () { return item.answer ? T("Правда") : T("Неправда"); }
    };
  }

  function buildGap(item, num, ctx) {
    var parts = item.prompt.split(/_{3,}/);
    var body = el("p", "fmx-prompt fmx-gap");
    var inputs = [];
    parts.forEach(function (part, i) {
      if (part) body.appendChild(document.createTextNode(part));
      if (i < parts.length - 1) {
        var inp = el("input", "fmx-gap-input");
        inp.type = "text";
        inp.setAttribute("autocomplete", "off");
        inp.setAttribute("autocapitalize", "none");
        inp.setAttribute("autocorrect", "off");
        inp.setAttribute("spellcheck", "false");
        inp.setAttribute("lang", "sv");
        inp.maxLength = 60;
        inp.setAttribute("aria-label", T("Пропуск {n}", { n: i + 1 }));
        var longest = 4;
        toList(item.answers[i]).forEach(function (a) { longest = Math.max(longest, str(a).length); });
        inp.style.width = "calc(" + Math.min(longest + 2, 22) + "ch + 1.4rem)";
        inp.addEventListener("keydown", function (e) {
          if (e.key !== "Enter") return;
          e.preventDefault();
          var next = inputs[inputs.indexOf(inp) + 1];
          if (next) safeFocus(next); else if (ctx.focusCheck) ctx.focusCheck();
        });
        body.appendChild(inp);
        inputs.push(inp);
      }
    });
    function get() { return inputs.map(function (x) { return x.value; }); }
    function statuses() {
      return inputs.map(function (x, i) { return checkGap(x.value, item.answers[i]); });
    }
    return {
      body: body,
      ownPrompt: true,
      get: get,
      lock: function (on) { inputs.forEach(function (x) { x.readOnly = on; }); },
      evaluate: function () {
        var st = statuses(), wrong = false, almost = false, allEmpty = true, i;
        for (i = 0; i < st.length; i++) {
          if (st[i] === "wrong") wrong = true;
          if (st[i] === "almost") almost = true;
          if (/\S/.test(inputs[i].value)) allEmpty = false;
        }
        return { status: wrong ? "wrong" : (almost ? "almost" : "right"), empty: allEmpty };
      },
      mark: function () {
        var st = statuses();
        inputs.forEach(function (x, i) { x.classList.add("is-" + (st[i] === "ok" ? "right" : st[i])); });
      },
      correctLabel: item.answers.length > 1 ? T("Правильні відповіді:") : T("Правильна відповідь:"),
      correct: function () {
        var out = item.answers.map(function (a, i) {
          var s = toList(a).join(" / ");
          return item.answers.length > 1 ? (i + 1) + ") " + s : s;
        });
        return out.join("; ");
      }
    };
  }

  function buildOrder(item, num, ctx) {
    var words = item.words;
    var accepted = typeof item.answer === "string" ? [item.answer] : item.answer;
    var perm = shuffleNot(words.map(function (w, i) { return i; }), function (p) {
      return checkOrder(p.map(function (i) { return words[i]; }), accepted) !== "wrong";
    });
    var picked = [], locked = false;
    var body = el("div", "fmx-order");
    var line = el("div", "fmx-line");
    line.setAttribute("role", "group");
    line.setAttribute("aria-label", T("Твоя відповідь"));
    var bank = el("div", "fmx-bank");
    bank.setAttribute("role", "group");
    bank.setAttribute("aria-label", T("Слова"));
    var clear = btn("fmx-link", T("Очистити"));
    var tools = el("div", "fmx-order-tools");
    tools.appendChild(clear);
    body.appendChild(line);
    body.appendChild(bank);
    body.appendChild(tools);

    function chip(wi) { return btn("fmx-chip", words[wi]); }

    function paint(focusWord, focusInLine) {
      empty(line);
      empty(bank);
      var toFocus = null;
      if (!picked.length) {
        line.appendChild(el("span", "fmx-placeholder", T("Натисни на слова нижче, щоб скласти речення")));
      }
      picked.forEach(function (wi) {
        var b = chip(wi);
        b.classList.add("in-line");
        b.setAttribute("aria-label", T("{word} — натисни, щоб прибрати", { word: words[wi] }));
        b.disabled = locked;
        b.addEventListener("click", function () {
          if (locked) return;
          picked.splice(picked.indexOf(wi), 1);
          paint(wi, false);
        });
        if (focusInLine && wi === focusWord) toFocus = b;
        line.appendChild(b);
      });
      perm.forEach(function (wi) {
        var b = chip(wi);
        if (picked.indexOf(wi) !== -1) {
          b.disabled = true;
          b.classList.add("is-used");
          b.setAttribute("aria-hidden", "true");
        } else {
          b.disabled = locked;
          b.addEventListener("click", function () {
            if (locked) return;
            picked.push(wi);
            paint(wi, true);
          });
          if (!focusInLine && wi === focusWord) toFocus = b;
        }
        bank.appendChild(b);
      });
      clear.disabled = locked || !picked.length;
      if (toFocus) safeFocus(toFocus);
    }
    clear.addEventListener("click", function () {
      if (locked) return;
      picked = [];
      paint(null, false);
    });
    paint(null, false);

    function sentence() { return picked.map(function (i) { return words[i]; }).join(" "); }
    return {
      body: body,
      get: function () { return picked.map(function (i) { return words[i]; }); },
      lock: function (on) { locked = on; paint(null, false); },
      evaluate: function () {
        var r = checkOrder(sentence(), accepted);
        return { status: r === "ok" ? "right" : (r === "almost" ? "almost" : "wrong"), empty: !picked.length };
      },
      mark: function () {
        line.classList.add(checkOrder(sentence(), accepted) === "ok" ? "is-right" : "is-wrong");
      },
      correctLabel: T("Правильна відповідь:"),
      correct: function () { return accepted[0]; }
    };
  }

  var PAIR_COLOURS = 6;

  function buildMatch(item, num, ctx) {
    var pairs = item.pairs, n = pairs.length;
    var order = shuffleNot(pairs.map(function (p, i) { return i; }), function (p) {
      for (var i = 0; i < p.length; i++) { if (p[i] !== i) return false; }
      return true;
    });
    var byLeft = [], byRight = [], slotOfLeft = [], slots = [], sel = null, locked = false, i;
    for (i = 0; i < n; i++) { byLeft.push(-1); byRight.push(-1); slotOfLeft.push(-1); }

    var body = el("div", "fmx-match");
    body.appendChild(el("p", "fmx-note", T("Натисни слово ліворуч, потім його пару праворуч. Натисни на пару ще раз, щоб скасувати.")));
    var cols = el("div", "fmx-match-cols");
    var colL = el("div", "fmx-match-col"), colR = el("div", "fmx-match-col");
    cols.appendChild(colL);
    cols.appendChild(colR);
    body.appendChild(cols);
    var leftBtns = [], rightBtns = [];

    function mk(text) {
      var b = btn("fmx-m");
      b.appendChild(el("span", "fmx-badge"));
      b.appendChild(el("span", "fmx-m-text", text));
      return b;
    }
    pairs.forEach(function (p, l) {
      var b = mk(p[0]);
      b.addEventListener("click", function () { pick("l", l); });
      colL.appendChild(b);
      leftBtns.push(b);
    });
    order.forEach(function (r) {
      var b = mk(pairs[r][1]);
      b.addEventListener("click", function () { pick("r", r); });
      colR.appendChild(b);
      rightBtns[r] = b;
    });

    function unpair(l) {
      var r = byLeft[l];
      if (r === -1) return;
      slots[slotOfLeft[l]] = false;
      byLeft[l] = -1;
      byRight[r] = -1;
      slotOfLeft[l] = -1;
    }
    function makePair(l, r) {
      var s = 0;
      while (slots[s]) s++;
      slots[s] = true;
      byLeft[l] = r;
      byRight[r] = l;
      slotOfLeft[l] = s;
    }
    function paintBtn(b, side, idx) {
      var l = side === "l" ? idx : byRight[idx];
      var paired = l !== -1 && byLeft[l] !== -1;
      var cls = "fmx-m";
      var isSel = sel && sel.side === side && sel.idx === idx;
      if (paired) cls += " is-paired fmx-c" + (slotOfLeft[l] % PAIR_COLOURS + 1);
      if (isSel) cls += " is-selected";
      b.className = cls;
      b.setAttribute("aria-pressed", paired || isSel ? "true" : "false");
      b.firstChild.textContent = paired ? String(slotOfLeft[l] + 1) : "";
      if (paired) b.title = T("Натисни, щоб скасувати пару"); else b.removeAttribute("title");
      b.disabled = locked;
    }
    function paint() {
      leftBtns.forEach(function (b, l) { paintBtn(b, "l", l); });
      rightBtns.forEach(function (b, r) { paintBtn(b, "r", r); });
    }
    function pick(side, idx) {
      if (locked) return;
      if (side === "l" && byLeft[idx] !== -1) { unpair(idx); sel = null; paint(); return; }
      if (side === "r" && byRight[idx] !== -1) { unpair(byRight[idx]); sel = null; paint(); return; }
      if (sel && sel.side !== side) {
        makePair(side === "l" ? idx : sel.idx, side === "r" ? idx : sel.idx);
        sel = null;
      } else if (sel && sel.side === side && sel.idx === idx) {
        sel = null;
      } else {
        sel = { side: side, idx: idx };
      }
      paint();
    }
    paint();

    function given() { return byLeft.map(function (r) { return r === -1 ? null : r; }); }
    function made() { for (var k = 0; k < n; k++) { if (byLeft[k] !== -1) return true; } return false; }
    function leftOk(l) {
      var r = byLeft[l];
      return r !== -1 && (r === l || normalise(pairs[r][1]) === normalise(pairs[l][1]));
    }
    return {
      body: body,
      get: given,
      lock: function (on) { locked = on; sel = null; paint(); },
      evaluate: function () {
        return { status: checkMatch(given(), pairs) ? "right" : "wrong", empty: !made() };
      },
      mark: function () {
        for (var l = 0; l < n; l++) {
          var c = leftOk(l) ? "is-right" : "is-wrong";
          leftBtns[l].classList.add(c);
          if (byLeft[l] !== -1) rightBtns[byLeft[l]].classList.add(c);
        }
      },
      correctLabel: T("Правильні пари:"),
      correct: function () {
        return pairs.map(function (p) { return p[0] + " → " + p[1]; }).join("; ");
      }
    };
  }

  var BUILDERS = {
    choice: buildChoice,
    multi: buildMulti,
    truefalse: buildTrueFalse,
    gap: buildGap,
    order: buildOrder,
    match: buildMatch
  };

  /* ---------------------------------------------------------------
     render(container, content, options)
     --------------------------------------------------------------- */
  function render(container, content, options) {
    options = options || {};
    if (typeof content === "string") {
      try { content = JSON.parse(content); } catch (e) { content = null; }
    }
    empty(container);

    var v = validate(content);
    if (!v.ok) {
      var err = el("div", "fmx fmx-error", T("Цю вправу не вдалося показати. Напиши Марії, будь ласка."));
      err.setAttribute("role", "alert");
      container.appendChild(err);
      if (typeof console !== "undefined" && console.warn) console.warn("FMMExercises: invalid content", v.errors);
      return { reset: function () {} };
    }

    var items = content.items;
    var ctx = { id: "fmx" + (++uid), focusCheck: null };
    var root = el("section", "fmx");
    if (options.title) root.setAttribute("aria-labelledby", ctx.id + "-title");

    if (options.title || options.instructions) {
      var head = el("header", "fmx-head");
      if (options.title) {
        var h = el("h3", "fmx-title", options.title);
        h.id = ctx.id + "-title";
        head.appendChild(h);
      }
      if (options.instructions) head.appendChild(el("p", "fmx-instr", options.instructions));
      root.appendChild(head);
    }

    var list = el("ol", "fmx-list");
    root.appendChild(list);

    var actions = el("div", "fmx-actions");
    var checkBtn = btn("btn btn-primary", T("Перевірити"));
    var retryBtn = btn("btn btn-ghost", T("Спробувати ще раз"));
    retryBtn.hidden = true;
    actions.appendChild(checkBtn);
    actions.appendChild(retryBtn);
    if (options.readOnly) actions.hidden = true;
    root.appendChild(actions);

    var scoreBox = el("div", "fmx-score");
    scoreBox.tabIndex = -1;
    scoreBox.setAttribute("role", "status");
    scoreBox.hidden = true;
    root.appendChild(scoreBox);

    container.appendChild(root);

    var ctrls = [], lis = [], done = false;
    ctx.focusCheck = function () { if (!checkBtn.hidden) safeFocus(checkBtn); };

    function build() {
      empty(list);
      ctrls = [];
      lis = [];
      items.forEach(function (item, i) {
        var num = i + 1;
        var c = BUILDERS[item.type](item, num, ctx);
        var li = el("li", "fmx-item fmx-item--" + item.type);
        li.appendChild(el("span", "fmx-num", String(num)));
        var main = el("div", "fmx-main");
        var promptText = item.type === "truefalse" ? item.statement : item.prompt;
        var promptEl = null;
        if (!c.ownPrompt) {
          if (item.type === "truefalse" && item.prompt) main.appendChild(el("p", "fmx-note", item.prompt));
          if (promptText) {
            promptEl = el("p", "fmx-prompt" + (item.type === "truefalse" ? " fmx-statement" : ""), promptText);
            promptEl.id = ctx.id + "-p" + num;
            main.appendChild(promptEl);
          }
        } else {
          c.body.id = ctx.id + "-p" + num;
        }
        if (typeof item.audio === "string" && /^https:\/\//i.test(item.audio)) {
          var wrap = el("div", "fmx-audio");
          var a = document.createElement("audio");
          a.controls = true;
          a.preload = "none";
          a.src = item.audio;
          a.setAttribute("aria-label", T("Аудіо до завдання {n}", { n: num }));
          wrap.appendChild(a);
          main.appendChild(wrap);
        }
        if (promptEl) {
          var tgt = item.type === "multi" ? c.body.querySelector("[role]") : c.body;
          if (item.type === "order" || item.type === "match") tgt.setAttribute("role", "group");
          tgt.setAttribute("aria-labelledby", promptEl.id);
        }
        main.appendChild(c.body);
        if (item.hint) {
          var hint = el("p", "fmx-hint");
          hint.appendChild(el("strong", null, T("Підказка:") + " "));
          hint.appendChild(document.createTextNode(item.hint));
          main.appendChild(hint);
        }
        var fb = el("div", "fmx-fb");
        fb.hidden = true;
        main.appendChild(fb);
        li.appendChild(main);
        li._fb = fb;
        list.appendChild(li);
        ctrls.push(c);
        lis.push(li);
      });
    }

    function showFeedback(li, c, item, ev) {
      var fb = li._fb;
      empty(fb);
      fb.className = "fmx-fb is-" + ev.status;
      var msg = ev.status === "right" ? T("Правильно!")
        : ev.status === "almost" ? T("Майже! Перевір å / ä / ö")
        : ev.empty ? T("Без відповіді") : T("Неправильно");
      var head = el("p", "fmx-fb-head");
      var ico = el("span", "fmx-fb-ico", ev.status === "right" ? "✓" : "✗");
      ico.setAttribute("aria-hidden", "true");
      head.appendChild(ico);
      head.appendChild(el("span", null, msg));
      fb.appendChild(head);
      if (ev.status !== "right") {
        var ans = el("p", "fmx-fb-ans");
        ans.appendChild(el("strong", null, c.correctLabel + " "));
        ans.appendChild(document.createTextNode(c.correct()));
        fb.appendChild(ans);
      }
      if (item.explain) {
        var ex = el("p", "fmx-fb-explain");
        ex.appendChild(el("strong", null, T("Пояснення:") + " "));
        ex.appendChild(document.createTextNode(item.explain));
        fb.appendChild(ex);
      }
      fb.hidden = false;
    }

    function check() {
      if (done) return;
      done = true;
      var score = 0, answers = [];
      ctrls.forEach(function (c, i) {
        var ev = c.evaluate();
        answers.push(c.get());
        if (ev.status === "right") score++;
        lis[i].classList.add("is-" + ev.status);
        c.lock(true);
        c.mark();
        showFeedback(lis[i], c, items[i], ev);
      });
      var max = items.length;
      empty(scoreBox);
      scoreBox.appendChild(el("p", "fmx-score-main", T("Результат: {score} з {max}", { score: score, max: max })));
      scoreBox.appendChild(el("p", "fmx-score-note", score === max
        ? T("Чудово, усе правильно!")
        : T("Подивись правильні відповіді у завданнях вище й спробуй ще раз.")));
      scoreBox.hidden = false;
      checkBtn.hidden = true;
      retryBtn.hidden = false;
      safeFocus(scoreBox);
      try { scoreBox.scrollIntoView({ block: "nearest", behavior: "smooth" }); } catch (e) { /* ignore */ }
      if (typeof options.onResult === "function") {
        try { options.onResult({ score: score, max: max, answers: answers }); }
        catch (err2) { if (typeof console !== "undefined" && console.error) console.error(err2); }
      }
    }

    function reset(fromUser) {
      done = false;
      build();
      if (options.readOnly) ctrls.forEach(function (c) { c.lock(true); });
      scoreBox.hidden = true;
      empty(scoreBox);
      checkBtn.hidden = false;
      retryBtn.hidden = true;
      if (fromUser) {
        var first = list.querySelector("input:not([disabled]), button:not([disabled])");
        if (first) safeFocus(first);
        try { root.scrollIntoView({ block: "start", behavior: "smooth" }); } catch (e) { /* ignore */ }
      }
    }

    checkBtn.addEventListener("click", check);
    retryBtn.addEventListener("click", function () { reset(true); });
    reset(false);

    return { reset: function () { reset(false); } };
  }

  var api = {
    validate: validate,
    render: render,
    _normalise: normalise,
    _check: {
      choice: checkChoice,
      multi: checkMulti,
      truefalse: checkTrueFalse,
      gap: checkGap,
      order: checkOrder,
      match: checkMatch
    }
  };
  window.FMMExercises = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
