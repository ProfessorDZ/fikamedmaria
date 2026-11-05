/* =====================================================================
   Fika med Maria — scored exercise blocks + flashcards
   Needs assets/blocks.js (window.FMMBlocks) loaded first. Registers:
     gap, drag_words, choice, order_words, order_sentences, dropdown_gap,
     truefalse, table_fill, match, categorize   (scored)
     flashcards                                  (practice, not scored)
   Spec: fikamedmaria-backend/docs/blocks-spec.md (sections 1 and 2).

   Every block: one «Перевірити», a tick or cross per element with the right
   answer, «Результат: {score} з {max}», «Спробувати ще раз» (reshuffles) and
   ctx.onResult(blockId, { score, max, answers }) — not called when
   ctx.mode === "preview" (the answers are still checked).
   Text from the content goes into the page with textContent only, never as
   HTML. Every UI string goes through T() (assets/i18n.js).
   Pure checkers for tests: window.FMMBlocksExercises._check
   (also FMMBlocks._check.exercises).
   CSS: assets/blocks-exercises.css (fbx- prefix).
   ===================================================================== */
(function () {
  "use strict";

  var B = window.FMMBlocks;

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
  function toList(x) { return Array.isArray(x) ? x : [x]; }
  function isObj(x) { return x !== null && typeof x === "object" && !Array.isArray(x); }
  function hasText(x) { return typeof x === "string" && /\S/.test(x); }

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

  /* exact (no "almost"): a word from a bank or a dropdown */
  function checkExact(given, accepted) {
    var g = normalise(given), list = toList(accepted), i;
    if (!g) return false;
    for (i = 0; i < list.length; i++) {
      if (normalise(list[i]) === g) return true;
    }
    return false;
  }

  function uniqueSorted(a) {
    var out = [], i;
    if (!Array.isArray(a)) return null;
    for (i = 0; i < a.length; i++) {
      if (typeof a[i] !== "number") return null;
      if (out.indexOf(a[i]) === -1) out.push(a[i]);
    }
    return out.sort(function (x, y) { return x - y; });
  }

  /* choice: the exact set of options must be picked (radio = a set of one) */
  function checkChoice(given, correct) {
    var g = uniqueSorted(given), c = uniqueSorted(correct), i;
    if (!g || !c || !g.length || g.length !== c.length) return false;
    for (i = 0; i < c.length; i++) { if (g[i] !== c[i]) return false; }
    return true;
  }

  function checkTrueFalse(given, answer) {
    return typeof given === "boolean" && given === answer;
  }

  /* order_words: given = sentence string or array of words;
     answer + alt = accepted sentences. "ok" | "almost" | "wrong" */
  /* Punctuation inside the sentence does not matter (the chips carry their own
     commas and full stops, so an alternative order would move them around). */
  function stripPunct(s) { return str(s).replace(/[.,;:!?…"«»()]/g, ""); }
  function checkOrderWords(given, answer, alt) {
    if (Array.isArray(given)) given = given.join(" ");
    var list = [answer];
    if (Array.isArray(alt)) list = list.concat(alt);
    return checkGap(stripPunct(given), list.map(stripPunct));
  }

  /* order_sentences: given = the student's list (texts) in their order.
     -> { ok: every line is in its place, flags: [bool per position] } */
  function checkOrderSentences(given, items) {
    var flags = [], ok = Array.isArray(given) && Array.isArray(items) && given.length === items.length, i;
    for (i = 0; i < items.length; i++) {
      flags.push(Array.isArray(given) && normalise(given[i]) === normalise(items[i]));
      if (!flags[i]) ok = false;
    }
    return { ok: ok, flags: flags };
  }

  /* match: pairs = [{ left, right, left_src?, right_src? }].
     given[i] = index of the pair whose right side the student put next to left
     side i (null if none). Right sides that are identical are interchangeable.
     -> { ok: all pairs right, flags: [bool per left] } */
  function sameRight(a, b) {
    if (!a || !b) return false;
    var ta = normalise(a.right), tb = normalise(b.right);
    return ta !== "" && ta === tb && str(a.right_src) === str(b.right_src);
  }
  function checkMatch(given, pairs) {
    var flags = [], ok = Array.isArray(given) && Array.isArray(pairs) && given.length === pairs.length, i, r;
    for (i = 0; i < pairs.length; i++) {
      r = Array.isArray(given) ? given[i] : null;
      flags.push(typeof r === "number" && !!pairs[r] && (r === i || sameRight(pairs[r], pairs[i])));
      if (!flags[i]) ok = false;
    }
    return { ok: ok, flags: flags };
  }

  /* categorize: columns = [{ title, items }]. placed[k] = column index chosen for
     the k-th item of the columns taken in order (-1 / null = left in the bank).
     An item whose text also stands in the column chosen is accepted too.
     -> { score, max, flags: [bool per item] } */
  function flatItems(columns) {
    var out = [];
    columns.forEach(function (c, ci) {
      toList(c.items || []).forEach(function (t) { if (t != null && String(t) !== "") out.push({ text: String(t), col: ci }); });
    });
    return out;
  }
  function checkCategorize(placed, columns) {
    var flat = flatItems(columns), flags = [], score = 0;
    flat.forEach(function (it, k) {
      var p = placed && typeof placed[k] === "number" ? placed[k] : -1, ok = false, j, col, items;
      if (p === it.col) ok = true;
      else if (p >= 0 && columns[p]) {
        items = columns[p].items || [];
        for (j = 0; j < items.length; j++) { if (normalise(items[j]) === normalise(it.text)) ok = true; }
      }
      flags.push(ok);
      if (ok) score++;
    });
    return { score: score, max: flat.length, flags: flags };
  }

  /* ---------------------------------------------------------------
     DOM helpers (textContent only — nothing from content becomes HTML)
     --------------------------------------------------------------- */
  var uid = 0;

  function node(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function btn(cls, text) {
    var b = node("button", cls, text);
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
  function safeFocus(n) { try { if (n) n.focus(); } catch (e) { /* ignore */ } }
  function ensureArray(x) { return Array.isArray(x) ? x : []; }
  function letter(i) { return String.fromCharCode(97 + (i % 26)); }
  function setClass(n, cls, on) {
    if (on) n.classList.add(cls); else n.classList.remove(cls);
  }

  /* src of a picture / audio: through ctx.signedUrl (storage path or https
     URL); without it only https:// or a relative path is accepted. */
  function resolveSrc(ctx, src) {
    src = str(src);
    if (!src) return Promise.reject(new Error("empty"));
    if (ctx && typeof ctx.signedUrl === "function") {
      try { return Promise.resolve(ctx.signedUrl(src)); } catch (e) { return Promise.reject(e); }
    }
    if (/^https:\/\//i.test(src) || /^[^:]*$/.test(src)) return Promise.resolve(src);
    return Promise.reject(new Error("unsafe"));
  }
  function loadImage(ctx, img, src) {
    resolveSrc(ctx, src).then(function (url) { if (url) img.src = url; }, function () { img.hidden = true; });
  }

  /* ---------------------------------------------------------------
     Pointer dragging (mouse, touch, pen). The tap / keyboard way always
     works too; dragging is an extra.
       o.start()          -> payload, or null/undefined to refuse
       o.target(under)    -> drop target for the element under the pointer, or null
       o.hover(t, on)     highlight a target
       o.drop(payload, t)
       o.disabled()       optional
     --------------------------------------------------------------- */
  function enableDrag(handle, o) {
    var st = null, suppress = false;
    handle.classList.add("fbx-draggable");
    if (o.touch) handle.style.touchAction = o.touch;

    function cleanup() {
      if (!st) return;
      if (st.ghost && st.ghost.parentNode) st.ghost.parentNode.removeChild(st.ghost);
      if (st.target) o.hover(st.target, false);
      handle.classList.remove("is-dragging");
      st = null;
    }
    handle.addEventListener("pointerdown", function (e) {
      if (o.disabled && o.disabled()) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      st = { id: e.pointerId, x: e.clientX, y: e.clientY, moving: false, ghost: null, target: null, payload: null };
      try { handle.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    });
    handle.addEventListener("pointermove", function (e) {
      if (!st || e.pointerId !== st.id) return;
      if (!st.moving) {
        if (Math.abs(e.clientX - st.x) + Math.abs(e.clientY - st.y) < 8) return;
        st.payload = o.start();
        if (st.payload === null || st.payload === undefined) { st = null; return; }
        st.moving = true;
        st.ghost = node("div", "fbx-ghost", str(o.label ? o.label(st.payload) : handle.textContent));
        document.body.appendChild(st.ghost);
        handle.classList.add("is-dragging");
      }
      if (e.cancelable) e.preventDefault();
      st.ghost.style.left = e.clientX + "px";
      st.ghost.style.top = e.clientY + "px";
      var under = document.elementFromPoint ? document.elementFromPoint(e.clientX, e.clientY) : null;
      var t = under ? o.target(under, st.payload) : null;
      if (t !== st.target) {
        if (st.target) o.hover(st.target, false);
        if (t) o.hover(t, true);
        st.target = t;
      }
    });
    function end(e, cancelled) {
      if (!st || e.pointerId !== st.id) return;
      var s = st, moved = s.moving;
      var target = s.target, payload = s.payload;
      cleanup();
      if (moved) {
        suppress = true;
        setTimeout(function () { suppress = false; }, 50);
        if (!cancelled && target) o.drop(payload, target);
      }
    }
    handle.addEventListener("pointerup", function (e) { end(e, false); });
    handle.addEventListener("pointercancel", function (e) { end(e, true); });
    handle.addEventListener("click", function (e) {
      if (suppress) { suppress = false; e.stopPropagation(); e.preventDefault(); }
    }, true);
    return { cancel: cleanup };
  }

  /* ---------------------------------------------------------------
     Shell for scored blocks: «Перевірити», score, «Спробувати ще раз»,
     the best result, onResult. factory(area, api) builds one attempt and
     returns { check() -> { score, max, answers }, lock(on) } — check() paints
     the ticks, crosses and right answers itself.
     --------------------------------------------------------------- */
  function mountScored(host, ctx, factory, block) {
    ctx = ctx || {};
    empty(host);
    var api = { id: "fbx" + (++uid), focusCheck: null };
    var root = node("div", "fbx");
    var bestBox = node("p", "fbx-best");
    bestBox.hidden = true;
    var area = node("div", "fbx-area");
    var actions = node("div", "fbx-actions");
    var checkBtn = btn("btn btn-primary", T("Перевірити"));
    var retryBtn = btn("btn btn-ghost", T("Спробувати ще раз"));
    retryBtn.hidden = true;
    actions.appendChild(checkBtn);
    actions.appendChild(retryBtn);
    var scoreBox = node("div", "fbx-score");
    scoreBox.tabIndex = -1;
    scoreBox.setAttribute("role", "status");
    scoreBox.hidden = true;
    root.appendChild(bestBox);
    root.appendChild(area);
    root.appendChild(actions);
    root.appendChild(scoreBox);
    host.appendChild(root);

    var ctrl = null, done = false, live = null;
    api.focusCheck = function () { if (!checkBtn.hidden) safeFocus(checkBtn); };

    function blockId() {
      if (block && block.id != null) return String(block.id);
      if (ctx.blockId != null) return String(ctx.blockId);
      var n = host;
      while (n && n.nodeType === 1) {
        if (n.getAttribute && n.getAttribute("data-block-id") != null) return n.getAttribute("data-block-id");
        n = n.parentNode;
      }
      return null;
    }

    function refreshBest() {
      var r = live;
      if (!r) {
        var id = blockId();
        var saved = id != null && ctx.results ? ctx.results[id] : null;
        if (saved && saved.attempts) r = { best: saved.best_score, max: saved.max_score, attempts: saved.attempts };
      }
      if (r) {
        bestBox.textContent = T("Найкращий результат: {best} з {max} · спроб: {n}", { best: r.best, max: r.max, n: r.attempts });
        bestBox.hidden = false;
      } else {
        bestBox.hidden = true;
      }
    }

    function remember(res) {
      var id = blockId();
      var saved = id != null && ctx.results ? ctx.results[id] : null;
      var prev = live || (saved && saved.attempts ? { best: saved.best_score, max: saved.max_score, attempts: saved.attempts } : null);
      var best = res.score;
      if (prev && prev.max === res.max && prev.best > best) best = prev.best;
      live = { best: best, max: res.max, attempts: (prev ? prev.attempts : 0) + 1 };
    }

    function build() {
      if (ctrl && ctrl.destroy) { try { ctrl.destroy(); } catch (e) { /* ignore */ } }
      empty(area);
      ctrl = factory(area, api);
    }

    function check() {
      if (done || !ctrl) return;
      done = true;
      var res = ctrl.check();
      ctrl.lock(true);
      empty(scoreBox);
      scoreBox.appendChild(node("p", "fbx-score-main", T("Результат: {score} з {max}", { score: res.score, max: res.max })));
      scoreBox.appendChild(node("p", "fbx-score-note", res.score === res.max
        ? T("Чудово, усе правильно!")
        : T("Подивись правильні відповіді вище й спробуй ще раз.")));
      scoreBox.hidden = false;
      checkBtn.hidden = true;
      retryBtn.hidden = false;
      safeFocus(scoreBox);
      try { scoreBox.scrollIntoView({ block: "nearest", behavior: "smooth" }); } catch (e) { /* ignore */ }
      if (ctx.mode !== "preview") {
        if (res.max > 0) remember(res);
        refreshBest();
        if (typeof ctx.onResult === "function" && res.max > 0) {
          try { ctx.onResult(blockId(), { score: res.score, max: res.max, answers: res.answers }); }
          catch (err) { if (typeof console !== "undefined" && console.error) console.error(err); }
        }
      }
    }

    function reset(fromUser) {
      done = false;
      build();
      scoreBox.hidden = true;
      empty(scoreBox);
      checkBtn.hidden = false;
      retryBtn.hidden = true;
      if (fromUser) {
        var first = area.querySelector("input:not([disabled]), select:not([disabled]), button:not([disabled])");
        safeFocus(first);
        try { root.scrollIntoView({ block: "nearest", behavior: "smooth" }); } catch (e) { /* ignore */ }
      }
    }

    checkBtn.addEventListener("click", check);
    retryBtn.addEventListener("click", function () { reset(true); });
    reset(false);
    refreshBest();
    /* the frame may put this block into the page only after render() returns */
    if (typeof Promise !== "undefined") Promise.resolve().then(refreshBest);

    return {
      reset: function () { reset(false); },
      destroy: function () { if (ctrl && ctrl.destroy) ctrl.destroy(); empty(host); }
    };
  }

  function errorNotice(host, why) {
    empty(host);
    var err = node("div", "fbx fbx-error", T("Цю вправу не вдалося показати. Напиши Марії, будь ласка."));
    err.setAttribute("role", "alert");
    host.appendChild(err);
    if (typeof console !== "undefined" && console.warn) console.warn("FMMBlocks exercise:", why);
    return { reset: function () {}, destroy: function () {} };
  }

  /* ---------------------------------------------------------------
     Feedback boxes
     --------------------------------------------------------------- */
  function newFb(area) {
    var fb = node("div", "fbx-fb");
    fb.hidden = true;
    area.appendChild(fb);
    return fb;
  }
  function fbHead(fb, status, msg) {
    var head = node("p", "fbx-fb-head");
    var ico = node("span", "fbx-fb-ico", status === "right" ? "✓" : "✗");
    ico.setAttribute("aria-hidden", "true");
    head.appendChild(ico);
    head.appendChild(node("span", null, msg));
    fb.appendChild(head);
  }
  function fbLine(fb, label, text, cls) {
    var p = node("p", cls || "fbx-fb-ans");
    p.appendChild(node("strong", null, label + " "));
    p.appendChild(document.createTextNode(text));
    fb.appendChild(p);
  }
  function fbExplain(fb, text) {
    if (hasText(text)) fbLine(fb, T("Пояснення:"), text, "fbx-fb-explain");
  }
  function statusMsg(status, isEmpty) {
    return status === "right" ? T("Правильно!")
      : status === "almost" ? T("Майже! Перевір å / ä / ö")
      : isEmpty ? T("Без відповіді") : T("Неправильно");
  }

  /* feedback for a list of slots / gaps: { n, status, correct } */
  function slotFeedback(fb, slots, statuses, explain) {
    empty(fb);
    var bad = [], i;
    for (i = 0; i < slots.length; i++) { if (statuses[i] !== "ok") bad.push(i); }
    if (!slots.length) { fb.hidden = true; return; }
    if (!bad.length) {
      fb.className = "fbx-fb is-right";
      fbHead(fb, "right", T("Правильно!"));
    } else {
      fb.className = "fbx-fb is-" + (bad.every(function (k) { return statuses[k] === "almost"; }) ? "almost" : "wrong");
      fbHead(fb, "wrong", bad.length === 1 ? T("Неправильно") : T("Неправильних відповідей: {n}", { n: bad.length }));
      fbLine(fb, bad.length === 1 ? T("Правильна відповідь:") : T("Правильні відповіді:"), "");
      var ul = node("ul", "fbx-fb-list");
      bad.forEach(function (k) {
        var li = node("li");
        li.appendChild(node("strong", null, slots[k].n + ") "));
        li.appendChild(document.createTextNode(slots[k].correct()));
        if (statuses[k] === "almost") li.appendChild(node("span", "fbx-almost", " — " + T("Майже! Перевір å / ä / ö")));
        ul.appendChild(li);
      });
      fb.appendChild(ul);
    }
    fbExplain(fb, explain);
    fb.hidden = false;
  }

  /* ---------------------------------------------------------------
     Inline slots: text inputs for [answer|other], <select>s for [*right|wrong]
     (gap, dropdown_gap, table_fill). Every slot:
       { n, node, get(), isEmpty(), status() "ok"|"almost"|"wrong",
         correct() text, mark(status), lock(on) }
     --------------------------------------------------------------- */
  function addTick(slotNode, status) {
    var old = slotNode.nextSibling;
    if (old && old.classList && old.classList.contains("fbx-tick")) old.parentNode.removeChild(old);
    var t = node("span", "fbx-tick", status === "ok" ? "✓" : status === "almost" ? "≈" : "✗");
    t.setAttribute("aria-hidden", "true");
    t.className += " is-" + (status === "ok" ? "right" : status);
    slotNode.parentNode.insertBefore(t, slotNode.nextSibling);
  }

  function gapSlot(part, hostNode, all, api) {
    var n = all.length + 1;
    var inp = node("input", "fbx-gap-input");
    inp.type = "text";
    inp.setAttribute("autocomplete", "off");
    inp.setAttribute("autocapitalize", "none");
    inp.setAttribute("autocorrect", "off");
    inp.setAttribute("spellcheck", "false");
    inp.setAttribute("lang", "sv");
    inp.maxLength = 80;
    inp.setAttribute("aria-label", T("Пропуск {n}", { n: n }));
    var longest = 4;
    part.answers.forEach(function (a) { longest = Math.max(longest, str(a).length); });
    inp.style.width = "calc(" + Math.min(longest + 2, 24) + "ch + 1.4rem)";
    hostNode.appendChild(inp);
    var slot = {
      n: n, node: inp,
      get: function () { return inp.value; },
      isEmpty: function () { return !/\S/.test(inp.value); },
      status: function () { return checkGap(inp.value, part.answers); },
      correct: function () { return part.answers.join(" / "); },
      mark: function (st) {
        inp.classList.add("is-" + (st === "ok" ? "right" : st));
        addTick(inp, st);
      },
      lock: function (on) { inp.readOnly = on; }
    };
    inp.addEventListener("keydown", function (e) {
      if (e.key !== "Enter") return;
      e.preventDefault();
      var next = all[all.indexOf(slot) + 1];
      if (next) safeFocus(next.node); else if (api.focusCheck) api.focusCheck();
    });
    return slot;
  }

  function selectSlot(part, hostNode, all, api) {
    var n = all.length + 1;
    var sel = node("select", "fbx-select");
    sel.setAttribute("aria-label", T("Пропуск {n}", { n: n }));
    var blank = node("option", null, "—");
    blank.value = "";
    sel.appendChild(blank);
    var idx = part.options.map(function (o, i) { return i; });
    shuffle(idx).forEach(function (i) {
      var op = node("option", null, part.options[i]);
      op.value = String(i);
      sel.appendChild(op);
    });
    hostNode.appendChild(sel);
    var right = part.options[part.correct];
    var slot = {
      n: n, node: sel,
      get: function () { return sel.value === "" ? "" : part.options[Number(sel.value)]; },
      isEmpty: function () { return sel.value === ""; },
      status: function () { return checkExact(slot.get(), [right]) ? "ok" : "wrong"; },
      correct: function () { return right; },
      mark: function (st) {
        sel.classList.add("is-" + (st === "ok" ? "right" : st));
        addTick(sel, st);
      },
      lock: function (on) { sel.disabled = on; }
    };
    return slot;
  }

  /* parts from FMMBlocks.parseGaps -> slots appended to `all`, drawn into hostNode */
  function drawParts(parts, hostNode, all, api) {
    parts.forEach(function (p) {
      if (p.type === "text") {
        if (p.value !== "") hostNode.appendChild(document.createTextNode(p.value));
      } else if (p.type === "gap" && ensureArray(p.answers).length) {
        all.push(gapSlot(p, hostNode, all, api));
      } else if (p.type === "select" && ensureArray(p.options).length > 1) {
        all.push(selectSlot(p, hostNode, all, api));
      }
    });
  }

  function paintSlots(all, fb, explain) {
    var statuses = all.map(function (s) { return s.status(); });
    all.forEach(function (s, i) { s.mark(statuses[i]); });
    slotFeedback(fb, all, statuses, explain);
    var score = 0;
    statuses.forEach(function (st) { if (st === "ok") score++; });
    return { score: score, max: all.length, answers: all.map(function (s) { return s.get(); }) };
  }

  function inlineFactory(content, cls) {
    return function (area, api) {
      var all = [];
      var host = node("div", "fbx-text " + cls);
      area.appendChild(host);
      drawParts(B.parseGaps(str(content.text)), host, all, api);
      var fb = newFb(area);
      return {
        check: function () { return paintSlots(all, fb, content.explain); },
        lock: function (on) { all.forEach(function (s) { s.lock(on); }); }
      };
    };
  }

  /* ---------------------------------------------------------------
     List of questions: choice, truefalse, order_words.
     makeItem(item, num, api) -> { prompt?, note?, body, get(), evaluate() ->
       { status: "right"|"almost"|"wrong", empty }, mark(), lock(on),
       correctLabel, correct() , explain? }
     --------------------------------------------------------------- */
  function listFactory(items, makeItem, kind) {
    return function (area, api) {
      var ol = node("ol", "fbx-list");
      area.appendChild(ol);
      var ctrls = [], lis = [];
      items.forEach(function (item, i) {
        var num = i + 1;
        var c = makeItem(item, num, api);
        var li = node("li", "fbx-item fbx-item--" + kind);
        li.appendChild(node("span", "fbx-num", String(num)));
        var main = node("div", "fbx-main");
        if (c.note) main.appendChild(node("p", "fbx-note", c.note));
        if (c.prompt) {
          var p = node("p", "fbx-prompt" + (kind === "truefalse" ? " fbx-statement" : ""), c.prompt);
          p.id = api.id + "-p" + num;
          main.appendChild(p);
          c.body.setAttribute("aria-labelledby", p.id);
        }
        main.appendChild(c.body);
        var fb = node("div", "fbx-fb");
        fb.hidden = true;
        main.appendChild(fb);
        li.appendChild(main);
        li._fb = fb;
        ol.appendChild(li);
        ctrls.push(c);
        lis.push(li);
      });
      return {
        check: function () {
          var score = 0, answers = [];
          ctrls.forEach(function (c, i) {
            var ev = c.evaluate(), fb = lis[i]._fb;
            answers.push(c.get());
            if (ev.status === "right") score++;
            lis[i].classList.add("is-" + ev.status);
            c.mark();
            empty(fb);
            fb.className = "fbx-fb is-" + ev.status;
            fbHead(fb, ev.status, statusMsg(ev.status, ev.empty));
            if (ev.status !== "right") fbLine(fb, c.correctLabel, c.correct());
            fbExplain(fb, items[i].explain);
            fb.hidden = false;
          });
          return { score: score, max: items.length, answers: answers };
        },
        lock: function (on) { ctrls.forEach(function (c) { c.lock(on); }); }
      };
    };
  }

  function markText(lab, text) {
    var m = lab.querySelector(".fbx-mark");
    if (m) m.textContent = text;
  }

  /* radio / checkbox group. texts[i] = label, letters = show a) b) c) */
  function optionGroup(texts, kind, name, letters) {
    var group = node("div", "fbx-options");
    group.setAttribute("role", kind === "radio" ? "radiogroup" : "group");
    var inputs = [], labels = [];
    texts.forEach(function (opt, i) {
      var lab = node("label", "fbx-opt");
      var inp = node("input");
      inp.type = kind;
      inp.name = name;
      inp.value = String(i);
      lab.appendChild(inp);
      if (letters) {
        var l = node("span", "fbx-letter", letter(i) + ")");
        l.setAttribute("aria-hidden", "true");
        lab.appendChild(l);
      }
      lab.appendChild(node("span", "fbx-opt-text", opt));
      var mark = node("span", "fbx-mark");
      mark.setAttribute("aria-hidden", "true");
      lab.appendChild(mark);
      group.appendChild(lab);
      inputs.push(inp);
      labels.push(lab);
    });
    group.addEventListener("change", function () {
      labels.forEach(function (lab, i) { setClass(lab, "is-picked", inputs[i].checked); });
    });
    return {
      group: group, inputs: inputs, labels: labels,
      lock: function (on) { inputs.forEach(function (x) { x.disabled = on; }); },
      picked: function () {
        var out = [];
        inputs.forEach(function (x, i) { if (x.checked) out.push(i); });
        return out;
      }
    };
  }

  /* ---------------------------------------------------------------
     choice
     --------------------------------------------------------------- */
  function choiceQuestions(content) {
    return ensureArray(content.questions).filter(function (q) {
      return isObj(q) && hasText(q.q) && ensureArray(q.options).length >= 2 && ensureArray(q.correct).length;
    });
  }

  function choiceFactory(content) {
    var qs = choiceQuestions(content);
    return listFactory(qs, function (q, num, api) {
      var correct = uniqueSorted(q.correct) || [];
      var multi = correct.length > 1;
      var o = optionGroup(q.options.map(str), multi ? "checkbox" : "radio", api.id + "-q" + num, true);
      var body = o.group;
      var wrap = body;
      if (multi) {
        wrap = node("div", "fbx-multi");
        wrap.appendChild(node("p", "fbx-note", T("Можна обрати кілька відповідей.")));
        wrap.appendChild(o.group);
      }
      return {
        prompt: q.q,
        body: wrap,
        get: function () { return o.picked(); },
        lock: o.lock,
        evaluate: function () {
          var g = o.picked();
          return { status: checkChoice(g, correct) ? "right" : "wrong", empty: !g.length };
        },
        mark: function () {
          var g = o.picked();
          o.labels.forEach(function (lab, i) {
            if (correct.indexOf(i) !== -1) { lab.classList.add("is-correct"); markText(lab, "✓"); }
            else if (g.indexOf(i) !== -1) { lab.classList.add("is-wrong"); markText(lab, "✗"); }
          });
        },
        correctLabel: multi ? T("Правильні відповіді:") : T("Правильна відповідь:"),
        correct: function () {
          return correct.map(function (i) { return letter(i) + ") " + q.options[i]; }).join("; ");
        }
      };
    }, "choice");
  }

  /* ---------------------------------------------------------------
     truefalse
     --------------------------------------------------------------- */
  function tfStatements(content) {
    return ensureArray(content.statements).filter(function (s) {
      return isObj(s) && hasText(s.text) && typeof s.answer === "boolean";
    });
  }

  function truefalseFactory(content) {
    return listFactory(tfStatements(content), function (s, num, api) {
      var o = optionGroup([T("Правда"), T("Неправда")], "radio", api.id + "-q" + num, false);
      o.group.className += " fbx-options--tf";
      function get() {
        if (o.inputs[0].checked) return true;
        if (o.inputs[1].checked) return false;
        return null;
      }
      var right = s.answer ? 0 : 1;
      return {
        prompt: s.text,
        body: o.group,
        get: get,
        lock: o.lock,
        evaluate: function () {
          var g = get();
          return { status: checkTrueFalse(g, s.answer) ? "right" : "wrong", empty: g === null };
        },
        mark: function () {
          var g = get();
          o.labels.forEach(function (lab, i) {
            if (i === right) { lab.classList.add("is-correct"); markText(lab, "✓"); }
            else if (g !== null && i === (g ? 0 : 1)) { lab.classList.add("is-wrong"); markText(lab, "✗"); }
          });
        },
        correctLabel: T("Правильна відповідь:"),
        correct: function () { return s.answer ? T("Правда") : T("Неправда"); }
      };
    }, "truefalse");
  }

  /* ---------------------------------------------------------------
     order_words: build each sentence from shuffled word chips
     --------------------------------------------------------------- */
  function owSentences(content) {
    return ensureArray(content.sentences).filter(function (s) {
      return isObj(s) && hasText(s.answer) && str(s.answer).trim().split(/\s+/).length >= 2;
    });
  }

  function orderWordsFactory(content) {
    return listFactory(owSentences(content), function (s, num, api) {
      var words = str(s.answer).trim().split(/\s+/);
      var alt = ensureArray(s.alt).map(str).filter(hasText);
      var perm = shuffleNot(words.map(function (w, i) { return i; }), function (p) {
        return checkOrderWords(p.map(function (i) { return words[i]; }), s.answer, alt) !== "wrong";
      });
      var picked = [], locked = false;
      var body = node("div", "fbx-order");
      body.setAttribute("role", "group");
      var line = node("div", "fbx-line");
      line.setAttribute("role", "group");
      line.setAttribute("aria-label", T("Твоя відповідь"));
      var bank = node("div", "fbx-bank");
      bank.setAttribute("role", "group");
      bank.setAttribute("aria-label", T("Слова"));
      var clear = btn("fbx-link", T("Очистити"));
      var tools = node("div", "fbx-order-tools");
      tools.appendChild(clear);
      body.appendChild(line);
      body.appendChild(bank);
      body.appendChild(tools);

      function paint(focusWord, focusInLine) {
        empty(line);
        empty(bank);
        var toFocus = null;
        if (!picked.length) line.appendChild(node("span", "fbx-placeholder", T("Натисни на слова нижче, щоб скласти речення")));
        picked.forEach(function (wi) {
          var b = btn("fbx-chip in-line", words[wi]);
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
          var b = btn("fbx-chip", words[wi]);
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
      function verdict() { return checkOrderWords(sentence(), s.answer, alt); }
      return {
        note: T("Склади речення зі слів."),
        body: body,
        get: function () { return picked.map(function (i) { return words[i]; }); },
        lock: function (on) { locked = on; paint(null, false); },
        evaluate: function () {
          var r = verdict();
          return { status: r === "ok" ? "right" : (r === "almost" ? "almost" : "wrong"), empty: !picked.length };
        },
        mark: function () { line.classList.add(verdict() === "ok" ? "is-right" : "is-wrong"); },
        correctLabel: T("Правильна відповідь:"),
        correct: function () { return str(s.answer); }
      };
    }, "order");
  }

  /* ---------------------------------------------------------------
     order_sentences: one list, moved with drag or the ↑ ↓ buttons
     --------------------------------------------------------------- */
  function orderSentencesFactory(content) {
    var items = ensureArray(content.items).map(str).filter(hasText);
    return function (area, api) {
      var perm = shuffleNot(items.map(function (t, i) { return i; }), function (p) {
        for (var i = 0; i < p.length; i++) { if (normalise(items[p[i]]) !== normalise(items[i])) return false; }
        return true;
      });
      var locked = false, result = null;
      area.appendChild(node("p", "fbx-note", T("Розстав речення в правильному порядку: перетягни їх або користуйся стрілками ↑ ↓.")));
      var list = node("ol", "fbx-sort");
      list.setAttribute("aria-label", T("Речення"));
      area.appendChild(list);
      var live = node("div", "fbx-sr");
      live.setAttribute("aria-live", "polite");
      area.appendChild(live);
      var fb = newFb(area);

      function move(from, to) {
        if (locked || to < 0 || to >= perm.length || from === to) return;
        var v = perm.splice(from, 1)[0];
        perm.splice(to, 0, v);
        live.textContent = T("Речення тепер на місці {pos} з {total}", { pos: to + 1, total: perm.length });
      }

      function paint(focusPos, focusDir) {
        empty(list);
        var toFocus = null;
        perm.forEach(function (itemIdx, pos) {
          var li = node("li", "fbx-sort-row");
          li.setAttribute("data-pos", String(pos));
          if (result) li.classList.add(result.flags[pos] ? "is-right" : "is-wrong");
          var grip = node("span", "fbx-grip", "⋮⋮");
          grip.setAttribute("aria-hidden", "true");
          li.appendChild(grip);
          li.appendChild(node("span", "fbx-sort-pos", String(pos + 1)));
          li.appendChild(node("span", "fbx-sort-text", items[itemIdx]));
          var up = btn("fbx-mini", "↑");
          up.setAttribute("aria-label", T("Підняти вище: {text}", { text: items[itemIdx] }));
          up.disabled = locked || pos === 0;
          var down = btn("fbx-mini", "↓");
          down.setAttribute("aria-label", T("Опустити нижче: {text}", { text: items[itemIdx] }));
          down.disabled = locked || pos === perm.length - 1;
          up.addEventListener("click", function () { move(pos, pos - 1); paint(pos - 1, "up"); });
          down.addEventListener("click", function () { move(pos, pos + 1); paint(pos + 1, "down"); });
          li.appendChild(up);
          li.appendChild(down);
          if (result) {
            var m = node("span", "fbx-mark", result.flags[pos] ? "✓" : "✗");
            m.setAttribute("aria-hidden", "true");
            li.appendChild(m);
          }
          if (pos === focusPos) {
            toFocus = focusDir === "up" ? (up.disabled ? down : up) : (down.disabled ? up : down);
          }
          enableDrag(grip, {
            touch: "none",
            disabled: function () { return locked; },
            start: function () { return pos; },
            label: function () { return items[itemIdx]; },
            target: function (under) {
              var r = under.closest ? under.closest(".fbx-sort-row") : null;
              return r && list.contains(r) ? r : null;
            },
            hover: function (t, on) { setClass(t, "is-over", on); },
            drop: function (from, t) {
              var to = Number(t.getAttribute("data-pos"));
              move(from, to);
              paint(to, "up");
            }
          });
          list.appendChild(li);
        });
        if (toFocus && !toFocus.disabled) safeFocus(toFocus);
      }
      paint(-1, "up");

      return {
        check: function () {
          var given = perm.map(function (i) { return items[i]; });
          result = checkOrderSentences(given, items);
          paint(-1, "up");
          empty(fb);
          fb.className = "fbx-fb is-" + (result.ok ? "right" : "wrong");
          fbHead(fb, result.ok ? "right" : "wrong", result.ok ? T("Правильно!") : T("Неправильний порядок"));
          if (!result.ok) {
            var p = node("p", "fbx-fb-ans");
            p.appendChild(node("strong", null, T("Правильний порядок:")));
            fb.appendChild(p);
            var ol = node("ol", "fbx-fb-list");
            items.forEach(function (t) { ol.appendChild(node("li", null, t)); });
            fb.appendChild(ol);
          }
          fbExplain(fb, content.explain);
          fb.hidden = false;
          return { score: result.ok ? 1 : 0, max: 1, answers: given };
        },
        lock: function (on) { locked = on; paint(-1, "up"); }
      };
    };
  }

  /* ---------------------------------------------------------------
     table_fill
     --------------------------------------------------------------- */
  function tableFillFactory(content) {
    var header = ensureArray(content.header);
    var rows = ensureArray(content.rows).filter(Array.isArray);
    return function (area, api) {
      var all = [];
      var scroll = node("div", "fbx-scroll");
      scroll.tabIndex = 0;
      scroll.setAttribute("role", "region");
      scroll.setAttribute("aria-label", T("Таблиця (гортається вбік)"));
      var table = node("table", "fbx-table");
      /* no header row is stored as all-blank header cells: draw no <thead> then */
      if (header.some(hasText)) {
        var thead = node("thead"), trh = node("tr");
        header.forEach(function (h) {
          var th = node("th", null, str(h));
          th.scope = "col";
          trh.appendChild(th);
        });
        thead.appendChild(trh);
        table.appendChild(thead);
      }
      var tbody = node("tbody");
      rows.forEach(function (row) {
        var tr = node("tr");
        row.forEach(function (cell, ci) {
          var text = str(cell);
          var parts = B.parseGaps(text);
          var hasSlot = parts.some(function (p) { return p.type !== "text"; });
          var td = node(!hasSlot && ci === 0 ? "th" : "td", hasSlot ? "has-gap" : null);
          if (td.tagName.toLowerCase() === "th") td.scope = "row";
          drawParts(parts, td, all, api);
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      scroll.appendChild(table);
      area.appendChild(scroll);
      var fb = newFb(area);
      return {
        check: function () { return paintSlots(all, fb, content.explain); },
        lock: function (on) { all.forEach(function (s) { s.lock(on); }); }
      };
    };
  }

  /* ---------------------------------------------------------------
     drag_words: a word bank and gaps; drag, or tap a word and then a gap
     --------------------------------------------------------------- */
  function dragWordsFactory(content) {
    return function (area, api) {
      var parts = B.parseGaps(str(content.text));
      var gaps = parts.filter(function (p) { return p.type === "gap" && ensureArray(p.answers).length; });
      var bankItems = [];
      gaps.forEach(function (g) { bankItems.push({ id: bankItems.length, word: str(g.answers[0]) }); });
      ensureArray(content.extra).forEach(function (w) {
        if (hasText(w)) bankItems.push({ id: bankItems.length, word: str(w) });
      });
      var order = shuffle(bankItems.map(function (b) { return b.id; }));
      var fill = gaps.map(function () { return -1; });
      var sel = -1, locked = false, statuses = null;

      area.appendChild(node("p", "fbx-note", T("Перетягни слово в пропуск. Або натисни слово, а потім пропуск. Натисни на слово в реченні, щоб повернути його.")));
      var host = node("div", "fbx-text fbx-dw-text");
      area.appendChild(host);
      var bank = node("div", "fbx-bank fbx-dw-bank");
      bank.setAttribute("role", "group");
      bank.setAttribute("aria-label", T("Слова"));
      area.appendChild(bank);
      var fb = newFb(area);

      var slotBtns = [], gi = 0;
      parts.forEach(function (p) {
        if (p.type === "text") {
          if (p.value !== "") host.appendChild(document.createTextNode(p.value));
        } else if (p.type === "gap" && ensureArray(p.answers).length) {
          var idx = gi++;
          var b = btn("fbx-slot");
          b.setAttribute("data-slot", String(idx));
          host.appendChild(b);
          slotBtns.push(b);
          b.addEventListener("click", function () { clickSlot(idx); });
          enableDrag(b, {
            touch: "none",
            disabled: function () { return locked; },
            start: function () { return fill[idx] >= 0 ? { from: "slot", slot: idx, id: fill[idx] } : null; },
            label: function (pl) { return bankItems[pl.id].word; },
            target: dropTarget,
            hover: function (t, on) { setClass(t, "is-over", on); },
            drop: drop
          });
        }
      });

      function dropTarget(under) {
        var t = under.closest ? under.closest(".fbx-slot, .fbx-dw-bank") : null;
        return t && area.contains(t) ? t : null;
      }
      function drop(pl, t) {
        if (t.classList.contains("fbx-slot")) {
          place(pl.id, Number(t.getAttribute("data-slot")), pl.from === "slot" ? pl.slot : -1);
        } else if (pl.from === "slot") {
          fill[pl.slot] = -1;
          sel = -1;
          paint({ chip: pl.id });
        }
      }
      function place(id, j, fromSlot) {
        var prev = fill[j];
        if (fromSlot >= 0) fill[fromSlot] = (fromSlot === j) ? id : prev;
        fill[j] = id;
        sel = -1;
        paint({ slot: j });
      }
      function clickSlot(j) {
        if (locked) return;
        if (sel >= 0) { place(sel, j, -1); return; }
        if (fill[j] >= 0) {
          var id = fill[j];
          fill[j] = -1;
          paint({ chip: id });
        }
      }
      function clickChip(id) {
        if (locked) return;
        sel = sel === id ? -1 : id;
        paint({ chip: id });
      }

      function usedBy(id) { return fill.indexOf(id); }

      function paint(focus) {
        var toFocus = null;
        slotBtns.forEach(function (b, i) {
          var w = fill[i] >= 0 ? bankItems[fill[i]].word : "";
          b.textContent = w;
          var cls = "fbx-slot" + (w ? " is-filled" : "");
          if (statuses) cls += statuses[i] === "ok" ? " is-right" : " is-wrong";
          if (sel >= 0 && !locked) cls += " is-target";
          b.className = cls;
          b.disabled = locked;
          b.setAttribute("aria-label", w
            ? T("Пропуск {n}: {word}. Натисни, щоб повернути слово.", { n: i + 1, word: w })
            : T("Пропуск {n}: порожньо", { n: i + 1 }));
          if (statuses) {
            var m = node("span", "fbx-slot-mark", statuses[i] === "ok" ? " ✓" : " ✗");
            m.setAttribute("aria-hidden", "true");
            b.appendChild(m);
          }
          if (focus && focus.slot === i) toFocus = b;
        });
        empty(bank);
        order.forEach(function (id) {
          var b = btn("fbx-chip", bankItems[id].word);
          var used = usedBy(id) !== -1;
          if (used) {
            b.disabled = true;
            b.classList.add("is-used");
            b.setAttribute("aria-hidden", "true");
          } else {
            b.disabled = locked;
            b.setAttribute("aria-pressed", sel === id ? "true" : "false");
            if (sel === id) b.classList.add("is-selected");
            b.addEventListener("click", function () { clickChip(id); });
            enableDrag(b, {
              touch: "none",
              disabled: function () { return locked; },
              start: function () { return { from: "bank", id: id }; },
              label: function () { return bankItems[id].word; },
              target: dropTarget,
              hover: function (t, on) { setClass(t, "is-over", on); },
              drop: drop
            });
            if (focus && focus.chip === id) toFocus = b;
          }
          bank.appendChild(b);
        });
        if (toFocus) safeFocus(toFocus);
      }
      bank.addEventListener("click", function (e) {
        /* a tap on the empty part of the bank puts a selected word away */
        if (e.target === bank) { sel = -1; paint(null); }
      });
      paint(null);

      return {
        check: function () {
          var slots = [];
          statuses = gaps.map(function (g, i) {
            var w = fill[i] >= 0 ? bankItems[fill[i]].word : "";
            return checkExact(w, g.answers) ? "ok" : "wrong";
          });
          gaps.forEach(function (g, i) { slots.push({ n: i + 1, correct: function () { return g.answers.join(" / "); } }); });
          var score = 0;
          statuses.forEach(function (s) { if (s === "ok") score++; });
          sel = -1;
          paint(null);
          slotFeedback(fb, slots, statuses, content.explain);
          return {
            score: score, max: gaps.length,
            answers: gaps.map(function (g, i) { return fill[i] >= 0 ? bankItems[fill[i]].word : ""; })
          };
        },
        lock: function (on) { locked = on; sel = -1; paint(null); }
      };
    };
  }

  /* ---------------------------------------------------------------
     match: tap a left item, then its pair on the right — or drag across
     --------------------------------------------------------------- */
  var PAIR_COLOURS = 6;

  function matchPairs(content) {
    return ensureArray(content.pairs).filter(function (p) {
      return isObj(p) && (hasText(p.left) || hasText(p.left_src)) && (hasText(p.right) || hasText(p.right_src));
    });
  }

  function matchFactory(content, ctx) {
    var pairs = matchPairs(content);
    return function (area, api) {
      var n = pairs.length;
      var order = shuffleNot(pairs.map(function (p, i) { return i; }), function (p) {
        for (var i = 0; i < p.length; i++) { if (p[i] !== i) return false; }
        return true;
      });
      var byLeft = [], byRight = [], slotOfLeft = [], slots = [], sel = null, locked = false, result = null, i;
      for (i = 0; i < n; i++) { byLeft.push(-1); byRight.push(-1); slotOfLeft.push(-1); }

      area.appendChild(node("p", "fbx-note", T("Натисни елемент ліворуч, потім його пару праворуч. Або перетягни одну пару до іншої. Натисни на пару ще раз, щоб скасувати.")));
      var cols = node("div", "fbx-match-cols");
      var colL = node("div", "fbx-match-col"), colR = node("div", "fbx-match-col");
      cols.appendChild(colL);
      cols.appendChild(colR);
      area.appendChild(cols);
      var fb = newFb(area);
      var leftBtns = [], rightBtns = [];

      function mk(text, src, side, idx) {
        var b = btn("fbx-m");
        b.setAttribute("data-side", side);
        b.setAttribute("data-idx", String(idx));
        b.appendChild(node("span", "fbx-badge"));
        if (hasText(src)) {
          var img = node("img", "fbx-m-img");
          img.alt = str(text);
          img.loading = "lazy";
          loadImage(ctx, img, src);
          b.appendChild(img);
        }
        if (hasText(text)) b.appendChild(node("span", "fbx-m-text", str(text)));
        return b;
      }
      function wireDrag(b, side, idx) {
        b.addEventListener("click", function () { pick(side, idx); });
        enableDrag(b, {
          touch: "pan-y",
          disabled: function () { return locked; },
          start: function () {
            var paired = side === "l" ? byLeft[idx] !== -1 : byRight[idx] !== -1;
            return paired ? null : { side: side, idx: idx };
          },
          label: function () { return b.textContent; },
          target: function (under, pl) {
            var t = under.closest ? under.closest(".fbx-m") : null;
            if (!t || !area.contains(t)) return null;
            var ts = t.getAttribute("data-side") === "l" ? "l" : "r";
            if (ts === pl.side) return null;
            var ti = Number(t.getAttribute("data-idx"));
            var paired = ts === "l" ? byLeft[ti] !== -1 : byRight[ti] !== -1;
            return paired ? null : t;
          },
          hover: function (t, on) { setClass(t, "is-over", on); },
          drop: function (pl, t) {
            var ti = Number(t.getAttribute("data-idx"));
            sel = null;
            if (pl.side === "l") makePair(pl.idx, ti); else makePair(ti, pl.idx);
            paint();
          }
        });
      }
      pairs.forEach(function (p, l) {
        var b = mk(p.left, p.left_src, "l", l);
        wireDrag(b, "l", l);
        colL.appendChild(b);
        leftBtns.push(b);
      });
      order.forEach(function (r) {
        var b = mk(pairs[r].right, pairs[r].right_src, "r", r);
        wireDrag(b, "r", r);
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
        var cls = "fbx-m fbx-draggable";
        var isSel = sel && sel.side === side && sel.idx === idx;
        if (paired) cls += " is-paired fbx-c" + (slotOfLeft[l] % PAIR_COLOURS + 1);
        if (isSel) cls += " is-selected";
        if (result && paired) cls += result.flags[l] ? " is-right" : " is-wrong";
        b.className = cls;
        b.setAttribute("aria-pressed", paired || isSel ? "true" : "false");
        b.firstChild.textContent = paired ? String(slotOfLeft[l] + 1) : "";
        if (paired && !locked) b.title = T("Натисни, щоб скасувати пару"); else b.removeAttribute("title");
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
      function describe(p) {
        return hasText(p.left) ? str(p.left) : T("картинка");
      }
      function describeRight(p) {
        return hasText(p.right) ? str(p.right) : T("картинка");
      }
      return {
        check: function () {
          result = checkMatch(given(), pairs);
          sel = null;
          for (var l = 0; l < n; l++) {
            if (byLeft[l] === -1) result.flags[l] = false;
          }
          paint();
          empty(fb);
          fb.className = "fbx-fb is-" + (result.ok ? "right" : "wrong");
          fbHead(fb, result.ok ? "right" : "wrong", result.ok ? T("Правильно!") : T("Не всі пари правильні"));
          if (!result.ok) {
            var p = node("p", "fbx-fb-ans");
            p.appendChild(node("strong", null, T("Правильні пари:")));
            fb.appendChild(p);
            var ul = node("ul", "fbx-fb-list");
            pairs.forEach(function (pr, k) {
              var li = node("li");
              li.appendChild(node("span", result.flags[k] ? "fbx-ok" : "fbx-bad", result.flags[k] ? "✓ " : "✗ "));
              li.appendChild(document.createTextNode(describe(pr) + " → " + describeRight(pr)));
              ul.appendChild(li);
            });
            fb.appendChild(ul);
          }
          fbExplain(fb, content.explain);
          fb.hidden = false;
          return {
            score: result.ok ? 1 : 0, max: 1,
            answers: given().map(function (r, k) {
              return [describe(pairs[k]), r === null ? null : describeRight(pairs[r])];
            })
          };
        },
        lock: function (on) { locked = on; sel = null; paint(); }
      };
    };
  }

  /* ---------------------------------------------------------------
     categorize: sort the items from one bank into columns
     --------------------------------------------------------------- */
  function categorizeColumns(content) {
    return ensureArray(content.columns).filter(function (c) {
      return isObj(c) && hasText(c.title) && ensureArray(c.items).length;
    });
  }

  function categorizeFactory(content) {
    var columns = categorizeColumns(content);
    return function (area, api) {
      var flat = flatItems(columns);
      var order = shuffle(flat.map(function (f, k) { return k; }));
      var placed = flat.map(function () { return -1; });
      var sel = -1, locked = false, result = null;

      area.appendChild(node("p", "fbx-note", T("Перетягни слово в колонку. Або натисни слово, а потім колонку. Натисни на слово в колонці, щоб повернути його.")));
      var bank = node("div", "fbx-bank fbx-cat-bank");
      bank.setAttribute("role", "group");
      bank.setAttribute("aria-label", T("Слова"));
      area.appendChild(bank);
      var colsBox = node("div", "fbx-cols");
      area.appendChild(colsBox);
      var fb = newFb(area);

      var colNodes = [], dropBtns = [], bodies = [];
      columns.forEach(function (c, ci) {
        var col = node("div", "fbx-col");
        col.setAttribute("data-col", String(ci));
        col.setAttribute("role", "group");
        var h = node("h4", "fbx-col-title", c.title);
        h.id = api.id + "-c" + ci;
        col.setAttribute("aria-labelledby", h.id);
        var put = btn("fbx-col-put", T("Покласти сюди"));
        put.setAttribute("aria-label", T("Покласти в колонку «{title}»", { title: c.title }));
        put.addEventListener("click", function (e) { e.stopPropagation(); putInto(ci); });
        var body = node("div", "fbx-col-body");
        col.appendChild(h);
        col.appendChild(body);
        col.appendChild(put);
        col.addEventListener("click", function (e) { if (e.target === col || e.target === body) putInto(ci); });
        colsBox.appendChild(col);
        colNodes.push(col);
        dropBtns.push(put);
        bodies.push(body);
      });

      function dropTarget(under) {
        var t = under.closest ? under.closest(".fbx-col, .fbx-cat-bank") : null;
        return t && area.contains(t) ? t : null;
      }
      function drop(k, t) {
        sel = -1;
        if (t.classList.contains("fbx-col")) placed[k] = Number(t.getAttribute("data-col"));
        else placed[k] = -1;
        paint({ chip: k });
      }
      function putInto(ci) {
        if (locked || sel < 0) return;
        var k = sel;
        placed[k] = ci;
        sel = -1;
        paint({ drop: ci });
      }
      function clickChip(k) {
        if (locked) return;
        if (placed[k] >= 0) { placed[k] = -1; sel = -1; paint({ chip: k }); return; }
        sel = sel === k ? -1 : k;
        paint({ chip: k });
      }
      function chip(k) {
        var b = btn("fbx-chip", flat[k].text);
        b.addEventListener("click", function () { clickChip(k); });
        enableDrag(b, {
          touch: "none",
          disabled: function () { return locked; },
          start: function () { return k; },
          label: function () { return flat[k].text; },
          target: dropTarget,
          hover: function (t, on) { setClass(t, "is-over", on); },
          drop: drop
        });
        return b;
      }

      function paint(focus) {
        var toFocus = null;
        empty(bank);
        bodies.forEach(empty);
        var left = 0;
        order.forEach(function (k) {
          var b = chip(k);
          var inCol = placed[k] >= 0;
          if (sel === k) { b.classList.add("is-selected"); b.setAttribute("aria-pressed", "true"); }
          if (inCol) {
            b.classList.add("in-col");
            b.setAttribute("aria-label", T("{word} — натисни, щоб повернути", { word: flat[k].text }));
          }
          if (result) {
            b.classList.add(result.flags[k] ? "is-right" : "is-wrong");
            var m = node("span", "fbx-chip-mark", result.flags[k] ? " ✓" : " ✗");
            m.setAttribute("aria-hidden", "true");
            b.appendChild(m);
          }
          b.disabled = locked;
          if (focus && focus.chip === k) toFocus = b;
          if (inCol) bodies[placed[k]].appendChild(b);
          else { bank.appendChild(b); left++; }
        });
        if (!left && !result) bank.appendChild(node("span", "fbx-placeholder", T("Усі слова розкладено")));
        colNodes.forEach(function (col, ci) {
          setClass(col, "is-target", sel >= 0 && !locked);
          dropBtns[ci].disabled = locked || sel < 0;
          dropBtns[ci].hidden = locked;
          if (!bodies[ci].firstChild) {
            bodies[ci].appendChild(node("span", "fbx-placeholder", T("Поки порожньо")));
          }
        });
        if (focus && focus.drop !== undefined) toFocus = dropBtns[focus.drop].disabled ? null : dropBtns[focus.drop];
        if (toFocus) safeFocus(toFocus);
      }
      paint(null);

      return {
        check: function () {
          result = checkCategorize(placed, columns);
          sel = -1;
          paint(null);
          empty(fb);
          var ok = result.score === result.max;
          fb.className = "fbx-fb is-" + (ok ? "right" : "wrong");
          fbHead(fb, ok ? "right" : "wrong", ok ? T("Правильно!") : T("Правильних: {score} з {max}", { score: result.score, max: result.max }));
          if (!ok) {
            var ul = node("ul", "fbx-fb-list");
            flat.forEach(function (f, k) {
              if (result.flags[k]) return;
              var li = node("li");
              li.appendChild(node("strong", null, f.text));
              li.appendChild(document.createTextNode(" → " + columns[f.col].title));
              ul.appendChild(li);
            });
            fb.appendChild(ul);
          }
          fbExplain(fb, content.explain);
          fb.hidden = false;
          return {
            score: result.score, max: result.max,
            answers: flat.map(function (f, k) { return [f.text, placed[k] >= 0 ? columns[placed[k]].title : null]; })
          };
        },
        lock: function (on) { locked = on; sel = -1; paint(null); }
      };
    };
  }

  /* ---------------------------------------------------------------
     flashcards (practice, not scored, nothing is saved)
     --------------------------------------------------------------- */
  function renderFlashcards(host, content, ctx) {
    ctx = ctx || {};
    var cards = ensureArray(content.cards).filter(function (c) {
      return isObj(c) && (hasText(c.front) || hasText(c.back) || hasText(c.front_src));
    });
    if (!cards.length) return errorNotice(host, "flashcards: no cards");
    empty(host);

    var id = "fbx" + (++uid);
    var order = cards.map(function (c, i) { return i; });
    var pos = 0, flipped = false, rate = {}, audioEl = null;

    var root = node("div", "fbx fbx-fc");
    root.setAttribute("role", "group");
    root.setAttribute("aria-label", T("Картки"));
    var top = node("div", "fbx-fc-top");
    var counter = node("span", "fbx-fc-count");
    var tally = node("span", "fbx-fc-tally");
    top.appendChild(counter);
    top.appendChild(tally);
    var card = btn("fbx-fc-card");
    var front = node("span", "fbx-fc-face fbx-fc-front");
    var back = node("span", "fbx-fc-face fbx-fc-back");
    card.appendChild(front);
    card.appendChild(back);
    var hint = node("p", "fbx-fc-hint", T("Натисни на картку, щоб перевернути. Стрілки ← → — наступна й попередня."));
    var audioBtn = btn("fbx-fc-audio btn btn-ghost btn-sm", "▶ " + T("Прослухати"));
    audioBtn.hidden = true;
    var nav = node("div", "fbx-fc-nav");
    var prevBtn = btn("btn btn-ghost btn-sm", "← " + T("Назад"));
    var nextBtn = btn("btn btn-ghost btn-sm", T("Далі") + " →");
    nav.appendChild(prevBtn);
    nav.appendChild(nextBtn);
    var rateBox = node("div", "fbx-fc-rate");
    var againBtn = btn("btn btn-ghost", T("Ще повторю"));
    var knowBtn = btn("btn btn-primary", T("Знаю"));
    rateBox.appendChild(againBtn);
    rateBox.appendChild(knowBtn);
    var tools = node("div", "fbx-fc-tools");
    var shuffleBtn = btn("fbx-link", T("Перемішати"));
    var restartBtn = btn("fbx-link", T("Почати спочатку"));
    tools.appendChild(shuffleBtn);
    tools.appendChild(restartBtn);
    var summary = node("div", "fbx-score fbx-fc-summary");
    summary.tabIndex = -1;
    summary.setAttribute("role", "status");
    summary.hidden = true;
    var sumMain = node("p", "fbx-score-main");
    var sumNote = node("p", "fbx-score-note");
    var sumAgain = btn("btn btn-primary btn-sm", T("Повторити те, що ще не знаю"));
    var sumRestart = btn("btn btn-ghost btn-sm", T("Почати спочатку"));
    var sumActions = node("div", "fbx-actions");
    sumActions.appendChild(sumAgain);
    sumActions.appendChild(sumRestart);
    summary.appendChild(sumMain);
    summary.appendChild(sumNote);
    summary.appendChild(sumActions);
    var live = node("div", "fbx-sr");
    live.setAttribute("aria-live", "polite");

    var deck = node("div", "fbx-fc-deck");
    [top, card, audioBtn, hint, nav, rateBox, tools].forEach(function (n) { deck.appendChild(n); });
    root.appendChild(deck);
    root.appendChild(summary);
    root.appendChild(live);
    host.appendChild(root);

    function counts() {
      var known = 0, again = 0;
      order.forEach(function (ci) {
        if (rate[ci] === "know") known++;
        else if (rate[ci] === "again") again++;
      });
      return { known: known, again: again };
    }

    function stopAudio() {
      if (audioEl) { try { audioEl.pause(); } catch (e) { /* ignore */ } audioEl = null; }
    }

    function drawFace(faceNode, text, src) {
      empty(faceNode);
      if (hasText(src)) {
        var img = node("img", "fbx-fc-img");
        img.alt = "";
        loadImage(ctx, img, src);
        faceNode.appendChild(img);
      }
      if (hasText(text)) faceNode.appendChild(node("span", "fbx-fc-text", str(text)));
    }

    function paint(focusCard) {
      var c = cards[order[pos]];
      stopAudio();
      drawFace(front, c.front, c.front_src);
      drawFace(back, c.back, null);
      card.classList.toggle("is-flipped", flipped);
      card.setAttribute("aria-pressed", flipped ? "true" : "false");
      card.setAttribute("aria-label", T("Картка {n} з {total}. Натисни, щоб перевернути.", { n: pos + 1, total: order.length }));
      front.setAttribute("aria-hidden", flipped ? "true" : "false");
      back.setAttribute("aria-hidden", flipped ? "false" : "true");
      counter.textContent = T("Картка {n} з {total}", { n: pos + 1, total: order.length });
      var k = counts();
      tally.textContent = T("Знаю: {k} · Ще повторю: {r}", { k: k.known, r: k.again });
      audioBtn.hidden = !hasText(c.audio_src);
      prevBtn.disabled = order.length < 2;
      nextBtn.disabled = order.length < 2;
      var r = rate[order[pos]];
      setClass(knowBtn, "is-set", r === "know");
      setClass(againBtn, "is-set", r === "again");
      knowBtn.setAttribute("aria-pressed", r === "know" ? "true" : "false");
      againBtn.setAttribute("aria-pressed", r === "again" ? "true" : "false");
      if (focusCard) safeFocus(card);
    }

    function go(delta) {
      if (order.length < 2) return;
      pos = (pos + delta + order.length) % order.length;
      flipped = false;
      paint(false);
      live.textContent = T("Картка {n} з {total}", { n: pos + 1, total: order.length });
    }
    function flip() {
      flipped = !flipped;
      paint(false);
      var c = cards[order[pos]];
      live.textContent = flipped ? str(c.back) : str(c.front);
    }

    function showSummary() {
      var k = counts();
      deck.hidden = true;
      summary.hidden = false;
      sumMain.textContent = T("Знаю: {k} з {total}", { k: k.known, total: order.length });
      sumNote.textContent = k.again
        ? T("Ще повторю: {r}. Можна пройти ці картки ще раз.", { r: k.again })
        : T("Чудово, усі картки знаєш!");
      sumAgain.hidden = !k.again;
      safeFocus(summary);
    }
    function rateCard(kind) {
      rate[order[pos]] = kind;
      var next = -1, i, p;
      for (i = 1; i <= order.length; i++) {
        p = (pos + i) % order.length;
        if (!rate[order[p]]) { next = p; break; }
      }
      if (next === -1) { paint(false); showSummary(); return; }
      pos = next;
      flipped = false;
      paint(true);
    }
    function restart(subset) {
      order = subset || cards.map(function (c, i) { return i; });
      order.forEach(function (ci) { delete rate[ci]; });
      if (!subset) rate = {};
      pos = 0;
      flipped = false;
      deck.hidden = false;
      summary.hidden = true;
      paint(true);
    }

    card.addEventListener("click", flip);
    prevBtn.addEventListener("click", function () { go(-1); });
    nextBtn.addEventListener("click", function () { go(1); });
    knowBtn.addEventListener("click", function () { rateCard("know"); });
    againBtn.addEventListener("click", function () { rateCard("again"); });
    shuffleBtn.addEventListener("click", function () {
      order = shuffle(order);
      pos = 0;
      flipped = false;
      paint(true);
    });
    restartBtn.addEventListener("click", function () { restart(null); });
    sumRestart.addEventListener("click", function () { restart(null); });
    sumAgain.addEventListener("click", function () {
      var again = order.filter(function (ci) { return rate[ci] !== "know"; });
      restart(shuffle(again));
    });
    audioBtn.addEventListener("click", function () {
      var c = cards[order[pos]];
      if (audioEl) { stopAudio(); return; }
      resolveSrc(ctx, c.audio_src).then(function (url) {
        stopAudio();
        try {
          audioEl = new Audio(url);
          audioEl.addEventListener("ended", function () { audioEl = null; });
          var pr = audioEl.play();
          if (pr && pr.catch) pr.catch(function () { audioEl = null; });
        } catch (e) { audioEl = null; }
      }, function () { /* no audio */ });
    });
    root.addEventListener("keydown", function (e) {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (deck.hidden) return;
      if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
      else if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
    });

    paint(false);
    return {
      reset: function () { restart(null); },
      destroy: function () { stopAudio(); empty(host); }
    };
  }

  /* ---------------------------------------------------------------
     Registration
     --------------------------------------------------------------- */
  function scored(type, makeFactory, ok) {
    B.register(type, {
      render: function (host, content, ctx, block) {
        if (!isObj(content)) return errorNotice(host, type + ": content is not an object");
        var why = ok(content);
        if (why) return errorNotice(host, type + ": " + why);
        return mountScored(host, ctx, makeFactory(content, ctx), block);
      }
    });
  }
  function hasGaps(content, kind) {
    if (!hasText(content.text)) return "no text";
    var parts = B.parseGaps(content.text), n = 0;
    parts.forEach(function (p) { if (p.type === kind || (kind === "any" && p.type !== "text")) n++; });
    return n ? null : "no gaps in the text";
  }

  function install() {
    scored("gap", function (c) { return inlineFactory(c, "fbx-gap"); }, function (c) { return hasGaps(c, "gap"); });
    scored("dropdown_gap", function (c) { return inlineFactory(c, "fbx-dd"); }, function (c) { return hasGaps(c, "select"); });
    scored("drag_words", dragWordsFactory, function (c) { return hasGaps(c, "gap"); });
    scored("choice", choiceFactory, function (c) { return choiceQuestions(c).length ? null : "no questions"; });
    scored("truefalse", truefalseFactory, function (c) { return tfStatements(c).length ? null : "no statements"; });
    scored("order_words", orderWordsFactory, function (c) { return owSentences(c).length ? null : "no sentences"; });
    scored("order_sentences", orderSentencesFactory, function (c) {
      return ensureArray(c.items).filter(hasText).length >= 2 ? null : "need at least 2 items";
    });
    scored("table_fill", tableFillFactory, function (c) {
      return ensureArray(c.rows).some(function (r) {
        return Array.isArray(r) && r.some(function (cell) {
          return B.parseGaps(str(cell)).some(function (p) { return p.type !== "text"; });
        });
      }) ? null : "no gaps in the table";
    });
    scored("match", matchFactory, function (c) { return matchPairs(c).length >= 2 ? null : "need at least 2 pairs"; });
    scored("categorize", categorizeFactory, function (c) {
      return categorizeColumns(c).length >= 2 ? null : "need at least 2 columns with items";
    });
    B.register("flashcards", {
      render: function (host, content, ctx) {
        if (!isObj(content)) return errorNotice(host, "flashcards: content is not an object");
        return renderFlashcards(host, content, ctx);
      }
    });
  }

  var api = {
    _check: {
      normalise: normalise,
      gap: checkGap,
      exact: checkExact,
      choice: checkChoice,
      truefalse: checkTrueFalse,
      orderWords: checkOrderWords,
      orderSentences: checkOrderSentences,
      match: checkMatch,
      categorize: checkCategorize
    },
    TYPES: ["gap", "drag_words", "choice", "order_words", "order_sentences", "dropdown_gap",
            "truefalse", "table_fill", "match", "categorize", "flashcards"]
  };
  window.FMMBlocksExercises = api;
  if (B) {
    B._check = B._check || {};
    if (!B._check.exercises) B._check.exercises = api._check;
  }

  if (!B || typeof B.register !== "function") {
    if (typeof console !== "undefined" && console.warn) console.warn("blocks-exercises.js: load assets/blocks.js first");
  } else {
    install();
  }
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
