#!/usr/bin/env python3
"""Fika med Maria — the site in four languages.

Ukrainian is the source language and stays at the site root. Swedish, English
and Polish pages are GENERATED into /sv/, /en/ and /pl/ from the Ukrainian pages
plus one translation catalog per language (i18n/catalogs/<lang>.json, a map
"Ukrainian text" -> "translation"). Text that JavaScript draws on the page
(cards from data.js, the header, the cookie banner, ...) is translated in the
browser from assets/i18n/<lang>.js, which this script writes too.

    python3 i18n/build.py extract            list every translatable piece -> i18n/source.json
    python3 i18n/build.py status             per language: translated / missing / unused
    python3 i18n/build.py todo <lang>        missing pieces as work files i18n/work/<lang>/*.json
    python3 i18n/build.py validate <file..>  check filled-in work files (tags, {placeholders}, leftovers)
    python3 i18n/build.py merge <lang>       move validated work files into the catalog
    python3 i18n/build.py build [--strict]   write /sv /en /pl pages + assets/i18n/<lang>.js
    python3 i18n/build.py check              audit the generated pages (Ukrainian left, broken links)

What counts as translatable: any piece of text that contains a Cyrillic letter.
Swedish example sentences (no Cyrillic) are therefore never touched. A piece is
the smallest run of text with its inline tags (<b>, <a>, <span>, ...) inside a
block (<p>, <li>, <h2>, <option>, ...), plus a few attributes (alt, title,
placeholder, aria-label, data-label, meta description / og texts).

Never edit the files in /sv/, /en/, /pl/ or assets/i18n/ by hand: change the
Ukrainian page or the catalog, then run `build`.
"""
import html
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

SITE = Path(__file__).resolve().parent.parent
I18N = SITE / "i18n"
CATALOGS = I18N / "catalogs"
WORK = I18N / "work"
SOURCE_JSON = I18N / "source.json"
RUNTIME_DIR = SITE / "assets" / "i18n"

LANGS = ["sv", "en", "pl"]                     # generated languages; "uk" is the source
ALL_LANGS = ["uk"] + LANGS
OG_LOCALE = {"uk": "uk_UA", "sv": "sv_SE", "en": "en_GB", "pl": "pl_PL"}
# Absolute address used only for <link rel="alternate" hreflang>. Change it when
# the site gets its own domain, then run `build` again.
SITE_URL = "https://fikamedmaria.vercel.app"

# Ukrainian pages that get language copies (paths relative to the site root).
def source_pages():
    pages = sorted(p.name for p in SITE.glob("*.html"))
    blog = sorted("blog/" + p.name for p in (SITE / "blog").glob("*.html"))
    return pages + blog

# Files whose JavaScript strings are drawn at runtime.
RUNTIME_T_FILES = ["assets/i18n.js", "assets/main.js", "assets/fmm-kit.js"]      # T("...") calls
RUNTIME_DATA_FILES = ["assets/data.js", "assets/lesson-details.js"]            # every Cyrillic literal

CYR = re.compile(r"[Ѐ-ӿ]")
INLINE = {"a", "abbr", "b", "bdi", "bdo", "br", "cite", "code", "data", "dfn", "em", "i",
          "img", "kbd", "mark", "q", "s", "samp", "small", "span", "strong", "sub", "sup",
          "time", "u", "var", "wbr"}
VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta",
        "param", "source", "track", "wbr"}
SKIP = {"script", "style", "noscript", "template", "svg"}
TRANSLATABLE_ATTRS = {"alt", "title", "placeholder", "aria-label", "data-label"}
META_TEXT = {"description", "og:title", "og:description", "twitter:title", "twitter:description"}
ALT_START = "<!-- i18n:alternates -->"
ALT_END = "<!-- /i18n:alternates -->"


def norm(s):
    return re.sub(r"\s+", " ", s).strip()


def has_cyr(s):
    return bool(CYR.search(s or ""))


# --------------------------------------------------------------------------
# HTML: a small tree with source offsets, so pages are rewritten by splicing
# and everything that is not translated stays byte-for-byte the same.
# --------------------------------------------------------------------------
class Node:
    __slots__ = ("kind", "tag", "attrs", "start", "end", "inner_start", "inner_end",
                 "children", "parent", "tag_text")

    def __init__(self, kind, tag=None, attrs=None, start=0, end=0):
        self.kind = kind            # "el" | "text" | "other"
        self.tag = tag
        self.attrs = attrs or []
        self.start = start          # start of the start tag / text
        self.end = end              # end of the end tag / text
        self.inner_start = end
        self.inner_end = end
        self.children = []
        self.parent = None
        self.tag_text = ""


class TreeBuilder(HTMLParser):
    def __init__(self, src):
        super().__init__(convert_charrefs=True)
        self.src = src
        self.line_starts = [0]
        for m in re.finditer("\n", src):
            self.line_starts.append(m.end())
        self.root = Node("el", "#root", start=0, end=len(src))
        self.root.inner_start, self.root.inner_end = 0, len(src)
        self.stack = [self.root]
        self.events = []            # (offset, node or None)
        self.warnings = []

    def off(self):
        line, col = self.getpos()
        return self.line_starts[line - 1] + col

    def _add(self, node):
        node.parent = self.stack[-1]
        self.stack[-1].children.append(node)

    def handle_starttag(self, tag, attrs):
        start = self.off()
        text = self.get_starttag_text()
        node = Node("el", tag, attrs, start, start + len(text))
        node.tag_text = text
        node.inner_start = node.inner_end = start + len(text)
        self._add(node)
        self.events.append((start, None))
        if tag not in VOID:
            self.stack.append(node)

    def handle_startendtag(self, tag, attrs):
        start = self.off()
        text = self.get_starttag_text()
        node = Node("el", tag, attrs, start, start + len(text))
        node.tag_text = text
        node.inner_start = node.inner_end = start + len(text)
        self._add(node)
        self.events.append((start, None))

    def handle_endtag(self, tag):
        start = self.off()
        self.events.append((start, None))   # a text node before this tag ends here
        m = re.compile(r"</\s*" + re.escape(tag) + r"\s*>", re.I).match(self.src, start)
        end = m.end() if m else self.src.index(">", start) + 1
        if tag in VOID:
            return
        names = [n.tag for n in self.stack]
        if tag not in names:
            self.warnings.append(f"stray </{tag}> at offset {start}")
            return
        while self.stack[-1].tag != tag:
            n = self.stack.pop()
            self.warnings.append(f"<{n.tag}> closed implicitly at offset {start}")
            n.inner_end, n.end = start, start
        n = self.stack.pop()
        n.inner_end, n.end = start, end

    def handle_data(self, data):
        start = self.off()
        node = Node("text", start=start, end=start)   # end fixed in finish()
        self._add(node)
        self.events.append((start, node))

    def handle_comment(self, data):
        start = self.off()
        node = Node("other", "#comment", start=start, end=start + len(data) + 7)
        self._add(node)
        self.events.append((start, None))

    def handle_decl(self, decl):
        self.events.append((self.off(), None))

    def unknown_decl(self, data):
        self.events.append((self.off(), None))

    def finish(self):
        self.close()
        # A text node ends where the next event starts.
        evs = sorted(self.events, key=lambda e: e[0])
        for i, (s, node) in enumerate(evs):
            if node is not None:
                node.end = evs[i + 1][0] if i + 1 < len(evs) else len(self.src)
        while len(self.stack) > 1:
            n = self.stack.pop()
            self.warnings.append(f"<{n.tag}> never closed")
            n.inner_end = n.end = len(self.src)
        return self.root


def parse(src):
    tb = TreeBuilder(src)
    tb.feed(src)
    root = tb.finish()
    return root, tb.warnings


def is_inline(node):
    return node.kind == "text" or node.kind == "other" or (node.kind == "el" and node.tag in INLINE)


def direct_text(node, src):
    return node.kind == "text" and src[node.start:node.end].strip() != ""


def collect_units(root, src):
    """Translatable text runs: list of (start, end) spans in src."""
    units = []

    def walk(el):
        if el.kind != "el" or el.tag in SKIP:
            return
        kids = el.children
        i = 0
        while i < len(kids):
            if is_inline(kids[i]):
                j = i
                while j < len(kids) and is_inline(kids[j]):
                    j += 1
                run = [k for k in kids[i:j] if k.kind != "other" or True]
                if any(direct_text(k, src) for k in run):
                    s, e = run[0].start, run[-1].end
                    while s < e and src[s].isspace():
                        s += 1
                    while e > s and src[e - 1].isspace():
                        e -= 1
                    if has_cyr(re.sub(r"<!--.*?-->", "", src[s:e], flags=re.S)):
                        units.append((s, e))
                else:
                    for k in run:
                        if k.kind == "el":
                            walk(k)
                i = j
            else:
                walk(kids[i])
                i += 1

    walk(root)
    return units


def attr_spans(tag_text, tag_start):
    """(name, value_raw, value_start, value_end) for each quoted attribute in a start tag."""
    out = []
    for m in re.finditer(r'([^\s=/<>"\']+)\s*=\s*("([^"]*)"|\'([^\']*)\')', tag_text):
        name = m.group(1).lower()
        if m.group(3) is not None:
            vs, ve = m.start(3), m.end(3)
        else:
            vs, ve = m.start(4), m.end(4)
        out.append((name, tag_text[vs:ve], tag_start + vs, tag_start + ve, m.group(2)[0]))
    return out


def collect_attr_units(root, src, unit_spans):
    """Translatable attribute values outside text units: list of (start, end, quote)."""
    out = []

    def inside_unit(pos):
        return any(s <= pos < e for s, e in unit_spans)

    def walk(el):
        for k in el.children:
            if k.kind != "el":
                continue
            if k.tag in SKIP:
                continue
            if not inside_unit(k.start):
                attrs = dict((n.lower(), v) for n, v in k.attrs)
                for name, raw, vs, ve, q in attr_spans(k.tag_text, k.start):
                    if not has_cyr(raw):
                        continue
                    if name in TRANSLATABLE_ATTRS:
                        out.append((vs, ve, q))
                    elif k.tag == "meta" and name == "content" and \
                            (attrs.get("name") in META_TEXT or attrs.get("property") in META_TEXT):
                        out.append((vs, ve, q))
            walk(k)

    walk(root)
    return out


def page_pieces(rel):
    """(src, warnings, text_units, attr_units) for one Ukrainian page."""
    src = (SITE / rel).read_text(encoding="utf-8")
    root, warnings = parse(src)
    units = collect_units(root, src)
    attrs = collect_attr_units(root, src, units)
    return src, warnings, units, attrs


def context_of(src, pos):
    """The tag name and class of the element a piece sits in, as a hint for translators."""
    before = src[:pos]
    m = None
    for m in re.finditer(r"<([a-zA-Z0-9]+)([^>]*)>", before[-600:]):
        pass
    if not m:
        return ""
    cls = re.search(r'class="([^"]*)"', m.group(2) or "")
    return m.group(1) + ("." + cls.group(1).split()[0] if cls else "")


# --------------------------------------------------------------------------
# JavaScript strings
# --------------------------------------------------------------------------
JS_ESC = re.compile(r"\\(u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|.)", re.S)


def js_unescape(s):
    def rep(m):
        c = m.group(1)
        if c[0] == "u":
            return chr(int(c[1:], 16))
        if c[0] == "x":
            return chr(int(c[1:], 16))
        return {"n": "\n", "t": "\t", "r": "\r", "b": "\b", "f": "\f", "v": "\v", "0": "\0"}.get(c, c)
    return JS_ESC.sub(rep, s)


T_CALL = re.compile(r"""\bT\(\s*(?:"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)')""")
STR_LIT = re.compile(r'''"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)\'''')


REGEX_BEFORE = set("(,=:[!&|?{};+-*%<>~^")
REGEX_KEYWORDS = {"return", "typeof", "case", "do", "else", "in", "of", "new", "delete", "void", "throw"}


def strip_js_comments(code):
    """Removes /* */ and // comments; strings, template literals and regex
    literals are copied untouched (a regex like /"/g must not look like a string)."""
    out, i, n = [], 0, len(code)
    last = ""          # last significant character emitted
    last_word = ""
    while i < n:
        c = code[i]
        if c in "\"'`":
            j = i + 1
            while j < n and code[j] != c:
                j += 2 if code[j] == "\\" else 1
            out.append(code[i:j + 1])
            i = j + 1
            last, last_word = c, ""
        elif code.startswith("/*", i):
            j = code.find("*/", i + 2)
            i = n if j < 0 else j + 2
        elif code.startswith("//", i):
            j = code.find("\n", i)
            i = n if j < 0 else j
        elif c == "/" and (last == "" or last in REGEX_BEFORE or last_word in REGEX_KEYWORDS):
            j, in_class = i + 1, False
            while j < n and code[j] != "\n":
                if code[j] == "\\":
                    j += 2
                    continue
                if code[j] == "[":
                    in_class = True
                elif code[j] == "]":
                    in_class = False
                elif code[j] == "/" and not in_class:
                    break
                j += 1
            j += 1
            while j < n and code[j].isalpha():
                j += 1
            out.append(code[i:j])
            i = j
            last, last_word = "/", ""
        else:
            out.append(c)
            if not c.isspace():
                if c.isalnum() or c in "_$":
                    m = re.match(r"[A-Za-z0-9_$]+", code[i:])
                    word = m.group(0)
                    out.append(word[1:])
                    i += len(word)
                    last, last_word = word[-1], word
                    continue
                last, last_word = c, ""
            i += 1
    return "".join(out)


def runtime_keys():
    """{key: [file, ...]} for every string drawn by JavaScript."""
    keys = {}
    for rel in RUNTIME_T_FILES:
        p = SITE / rel
        if not p.exists():
            continue
        code = strip_js_comments(p.read_text(encoding="utf-8"))
        for m in T_CALL.finditer(code):
            # Every T("...") is meant to be translated, even without Cyrillic (e.g. "«{quote}»").
            raw = m.group(1) if m.group(1) is not None else m.group(2)
            keys.setdefault(js_unescape(raw), []).append(rel)
    for rel in RUNTIME_DATA_FILES:
        p = SITE / rel
        if not p.exists():
            continue
        code = strip_js_comments(p.read_text(encoding="utf-8"))
        for m in STR_LIT.finditer(code):
            raw = m.group(1) if m.group(1) is not None else m.group(2)
            k = js_unescape(raw)
            if has_cyr(k):
                keys.setdefault(k, []).append(rel)
    return keys


# --------------------------------------------------------------------------
# extract / status / todo
# --------------------------------------------------------------------------
def extract(quiet=False):
    entries = {}   # key -> {"kinds": set, "files": [], "ctx": str}

    def add(key, kind, rel, ctx=""):
        e = entries.setdefault(key, {"kinds": set(), "files": [], "ctx": ctx})
        e["kinds"].add(kind)
        if rel not in e["files"]:
            e["files"].append(rel)
        if not e["ctx"] and ctx:
            e["ctx"] = ctx

    all_warnings = []
    for rel in source_pages():
        src, warnings, units, attrs = page_pieces(rel)
        all_warnings += [f"{rel}: {w}" for w in warnings]
        for s, e in units:
            add(norm(src[s:e]), "html", rel, context_of(src, s))
        for s, e, q in attrs:
            add(html.unescape(src[s:e]), "attr", rel, "attribute")
    for k, files in runtime_keys().items():
        for rel in files:
            add(k, "runtime", rel, "js")

    data = [{"key": k, "kinds": sorted(v["kinds"]), "files": v["files"], "ctx": v["ctx"]}
            for k, v in entries.items()]
    SOURCE_JSON.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    if not quiet:
        kinds = {}
        for d in data:
            for k in d["kinds"]:
                kinds[k] = kinds.get(k, 0) + 1
        chars = sum(len(d["key"]) for d in data)
        print(f"{len(data)} pieces, {chars} characters ({kinds}) -> {SOURCE_JSON.relative_to(SITE)}")
        for w in all_warnings:
            print("  warning:", w)
    return data


def load_catalog(lang):
    p = CATALOGS / f"{lang}.json"
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else {}


def save_catalog(lang, cat):
    CATALOGS.mkdir(parents=True, exist_ok=True)
    (CATALOGS / f"{lang}.json").write_text(
        json.dumps(cat, ensure_ascii=False, indent=1, sort_keys=False) + "\n", encoding="utf-8")


def status():
    data = extract(quiet=True)
    keys = [d["key"] for d in data]
    for lang in LANGS:
        cat = load_catalog(lang)
        done = sum(1 for k in keys if cat.get(k))
        unused = sum(1 for k in cat if k not in set(keys))
        print(f"{lang}: {done}/{len(keys)} translated, {len(keys) - done} missing, {unused} unused in catalog")


def chunk_name(rel):
    return re.sub(r"[^a-z0-9]+", "-", rel.lower().replace(".html", "").replace(".js", "")).strip("-")


def todo(lang, max_chars=9000):
    """One work file per source file (split when large) with the pieces still missing."""
    data = extract(quiet=True)
    cat = load_catalog(lang)
    groups, order = {}, []
    for d in data:
        if cat.get(d["key"]):
            continue
        rel = d["files"][0]
        groups.setdefault(rel, []).append(d)
        if rel not in order:
            order.append(rel)
    out_dir = WORK / lang
    out_dir.mkdir(parents=True, exist_ok=True)
    # Values already typed into unmerged work files are kept, never wiped.
    typed = {}
    for old in out_dir.glob("*.json"):
        for it in json.loads(old.read_text(encoding="utf-8")).get("items", []):
            if it.get("value", "").strip():
                typed.setdefault(it["key"], it["value"])
    written = []
    for rel in order:
        chunks, cur, size = [], [], 0
        for d in groups[rel]:
            if cur and size + len(d["key"]) > max_chars:
                chunks.append(cur)
                cur, size = [], 0
            cur.append(d)
            size += len(d["key"])
        if cur:
            chunks.append(cur)
        for n, items in enumerate(chunks, 1):
            name = chunk_name(rel) + (f"-{n}" if len(chunks) > 1 else "")
            payload = {"lang": lang, "chunk": name, "source_file": rel,
                       "items": [{"id": f"u{i + 1:03d}", "key": d["key"], "kind": d["kinds"],
                                  "context": d["ctx"], "value": typed.get(d["key"], "")}
                                 for i, d in enumerate(items)]}
            p = out_dir / f"{name}.json"
            p.write_text(json.dumps(payload, ensure_ascii=False, indent=1), encoding="utf-8")
            written.append((p, len(items), sum(len(x["key"]) for x in items)))
    for p, n, c in written:
        print(f"{p.relative_to(SITE)}: {n} pieces, {c} chars")
    return written


# --------------------------------------------------------------------------
# validate / merge
# --------------------------------------------------------------------------
TAG = re.compile(r"<(/?)([a-zA-Z0-9]+)([^>]*)>")
PLACEHOLDER = re.compile(r"\{[a-zA-Z_][a-zA-Z0-9_]*\}")


def tag_signature(s):
    """Tags with their non-text attributes, as a sorted list: word order may change."""
    sig = []
    for m in TAG.finditer(s):
        attrs = []
        for am in re.finditer(r'([^\s=/<>"\']+)\s*=\s*("([^"]*)"|\'([^\']*)\')', m.group(3)):
            name = am.group(1).lower()
            if name in TRANSLATABLE_ATTRS:
                continue
            attrs.append(name + "=" + (am.group(3) if am.group(3) is not None else am.group(4)))
        sig.append(m.group(1) + m.group(2).lower() + "[" + " ".join(sorted(attrs)) + "]")
    return sorted(sig)


UK_SPAN = re.compile(r'<span lang="uk">(.*?)</span>', re.S)


def without_uk_spans(s):
    """A Ukrainian word quoted on purpose may be wrapped in <span lang="uk">…</span>."""
    return UK_SPAN.sub(lambda m: m.group(1), s)


def check_pair(key, value):
    errors, warnings = [], []
    if not value or not value.strip():
        errors.append("empty translation")
        return errors, warnings
    if tag_signature(key) != tag_signature(without_uk_spans(value)):
        errors.append("HTML tags differ from the source (tags and their href/class must stay identical)")
    if sorted(PLACEHOLDER.findall(key)) != sorted(PLACEHOLDER.findall(value)):
        errors.append("{placeholders} differ from the source")
    if has_cyr(UK_SPAN.sub("", value)):
        warnings.append("contains Cyrillic letters (wrap a Ukrainian word quoted on purpose in <span lang=\"uk\">…</span>)")
    if norm(value) == norm(key) and has_cyr(key):
        errors.append("left untranslated")
    return errors, warnings


def validate(paths, quiet=False):
    total_err = 0
    for path in paths:
        p = Path(path)
        doc = json.loads(p.read_text(encoding="utf-8"))
        for it in doc["items"]:
            errs, warns = check_pair(it["key"], it.get("value", ""))
            for e in errs:
                total_err += 1
                print(f"ERROR {p.parent.name}/{p.name} {it['id']}: {e}")
            for w in warns:
                if not quiet:
                    print(f"warn  {p.parent.name}/{p.name} {it['id']}: {w}")
    if not quiet:
        print("OK" if total_err == 0 else f"{total_err} error(s)")
    return total_err


def merge(lang):
    files = sorted((WORK / lang).glob("*.json"))
    cat = load_catalog(lang)
    added = 0
    for p in files:
        if validate([p], quiet=True):
            print(f"skipped {p.name}: has errors (run validate)")
            continue
        doc = json.loads(p.read_text(encoding="utf-8"))
        for it in doc["items"]:
            cat[it["key"]] = it["value"].strip()
            added += 1
        done = WORK / lang / "merged"
        done.mkdir(exist_ok=True)
        p.replace(done / p.name)
    save_catalog(lang, cat)
    print(f"{lang}: merged {added} translations from {len(files)} files")


# --------------------------------------------------------------------------
# build
# --------------------------------------------------------------------------
def alt_href(lang, rel):
    path = rel
    if path == "index.html":
        path = ""
    elif path.endswith("/index.html"):
        path = path[: -len("index.html")]
    prefix = "" if lang == "uk" else lang + "/"
    return f"{SITE_URL}/{prefix}{path}"


def alternates_block(lang, rel):
    lines = [ALT_START]
    for l in ALL_LANGS:
        lines.append(f'<link rel="alternate" hreflang="{l}" href="{alt_href(l, rel)}" />')
    lines.append(f'<link rel="alternate" hreflang="x-default" href="{alt_href("uk", rel)}" />')
    lines.append(f'<meta property="og:locale" content="{OG_LOCALE[lang]}" />')
    lines.append(ALT_END)
    return "\n  ".join(lines)


QUERY_PAGES = {"urok.html", "kurs.html"}   # content depends on ?id=; main.js writes their alternates


def put_alternates(src, lang, rel):
    if rel in QUERY_PAGES:
        block = ALT_START + "\n  " + f'<meta property="og:locale" content="{OG_LOCALE[lang]}" />' + "\n  " + ALT_END
        if ALT_START in src:
            return re.sub(re.escape(ALT_START) + r".*?" + re.escape(ALT_END), lambda m: block, src, flags=re.S)
        return src.replace("</head>", "  " + block + "\n</head>", 1)
    block = alternates_block(lang, rel)
    if ALT_START in src:
        return re.sub(re.escape(ALT_START) + r".*?" + re.escape(ALT_END), lambda m: block, src, flags=re.S)
    return src.replace("</head>", "  " + block + "\n</head>", 1)


def is_page_link(path):
    return path == "" or path.endswith("/") or path.endswith(".html")


def rewrite_paths(doc):
    """Language pages sit one folder deeper: shared files need one more ../"""
    def fix(m):
        name, q, val = m.group(1), m.group(2), m.group(3)
        if re.match(r"^(?:[a-zA-Z][a-zA-Z0-9+.-]*:|//|/|#)", val) or val == "":
            return m.group(0)
        path = re.split(r"[?#]", val, 1)[0]
        if is_page_link(path):
            return m.group(0)
        return f"{name}={q}../{val}{q}"
    return re.sub(r"""\b(href|src)=(["'])([^"']*)\2""", fix, doc)


def esc_attr(text, quote):
    t = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    return t.replace('"', "&quot;") if quote == '"' else t.replace("'", "&#39;")


CYR_RUN = re.compile(r"[\u0400-\u04FF\u02BC'’]+(?:[\s,.;:!?«»„“”-]+[\u0400-\u04FF\u02BC'’]+)*")


def mark_uk(value):
    """Wraps Cyrillic left in a translation (a Ukrainian word quoted on purpose)
    in <span lang="uk">, outside tags and outside spans that already say so."""
    if not has_cyr(value):
        return value
    parts = re.split(r"(<[^>]+>)", value)
    out, inside_uk = [], 0
    for part in parts:
        if part.startswith("<"):
            if part == '<span lang="uk">':
                inside_uk += 1
            elif part == "</span>" and inside_uk:
                inside_uk -= 1
            out.append(part)
        elif inside_uk or not has_cyr(part):
            out.append(part)
        else:
            out.append(CYR_RUN.sub(lambda m: f'<span lang="uk">{m.group(0)}</span>' if has_cyr(m.group(0)) else m.group(0), part))
    return "".join(out)


# Shared images that exist in a language version: assets/blog/x.webp -> assets/blog/<lang>/x.webp
LOCALIZED_DIRS = ["assets/blog/"]


def localize_assets(doc, lang):
    def fix(m):
        d, name = m.group(1), m.group(2)
        if (SITE / d / lang / name).exists():
            return f"{d}{lang}/{name}"
        return m.group(0)
    for d in LOCALIZED_DIRS:
        doc = re.sub("(" + re.escape(d) + r")([A-Za-z0-9._-]+\.(?:webp|png|jpe?g))", fix, doc)
    return doc


def build_page(rel, lang, cat, missing):
    src, _, units, attrs = page_pieces(rel)
    reps = []
    for s, e in units:
        key = norm(src[s:e])
        val = cat.get(key)
        if not val:
            missing.add(key)
            continue
        reps.append((s, e, mark_uk(val)))
    for s, e, q in attrs:
        key = html.unescape(src[s:e])
        val = cat.get(key)
        if not val:
            missing.add(key)
            continue
        reps.append((s, e, esc_attr(val, q)))
    reps.sort(key=lambda r: r[0])
    out, pos = [], 0
    for s, e, val in reps:
        if s < pos:
            raise SystemExit(f"{rel}: overlapping pieces at {s}")
        out.append(src[pos:s])
        out.append(val)
        pos = e
    out.append(src[pos:])
    doc = "".join(out)

    doc = re.sub(r'<html\s+lang="uk"', f'<html lang="{lang}"', doc, count=1)
    doc = rewrite_paths(doc)
    doc = localize_assets(doc, lang)
    # The language's runtime strings load right before the shared i18n script.
    depth = rel.count("/") + 1
    up = "../" * depth
    doc = doc.replace(f'<script src="{up}assets/i18n.js"></script>',
                      f'<script src="{up}assets/i18n/{lang}.js"></script>\n  '
                      f'<script src="{up}assets/i18n.js"></script>', 1)
    doc = put_alternates(doc, lang, rel)
    marker = (f"<!-- GENERATED by i18n/build.py from {rel} — do not edit this file. "
              f"Change the Ukrainian page or i18n/catalogs/{lang}.json, then run the build. -->\n")
    doc = re.sub(r"(<!DOCTYPE[^>]*>\n?)", lambda m: m.group(1) + marker, doc, count=1, flags=re.I)
    dest = SITE / lang / rel
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(doc, encoding="utf-8")


def build(strict=False):
    data = extract(quiet=True)
    runtime = [d["key"] for d in data if "runtime" in d["kinds"]]
    problems = 0
    for rel in source_pages():
        p = SITE / rel
        src = p.read_text(encoding="utf-8")
        if 'src="assets/i18n.js"' not in src and 'src="../assets/i18n.js"' not in src:
            print(f"warning: {rel} does not load assets/i18n.js")
            problems += 1
        new = put_alternates(src, "uk", rel)
        if new != src:
            p.write_text(new, encoding="utf-8")
    RUNTIME_DIR.mkdir(parents=True, exist_ok=True)
    for lang in LANGS:
        for rel in orphan_pages(lang):
            (SITE / lang / rel).unlink()
            print(f"removed {lang}/{rel} (its Ukrainian page is gone)")
        cat = load_catalog(lang)
        missing = set()
        for rel in source_pages():
            build_page(rel, lang, cat, missing)
        strings = {}
        for k in runtime:
            if cat.get(k):
                strings[k] = mark_uk(cat[k])
            else:
                missing.add(k)
        body = json.dumps({"lang": lang, "strings": strings}, ensure_ascii=False, indent=0)
        (RUNTIME_DIR / f"{lang}.js").write_text(
            "/* GENERATED by i18n/build.py from i18n/catalogs/" + lang + ".json — do not edit. */\n"
            "window.FMM_I18N = " + body + ";\n", encoding="utf-8")
        print(f"{lang}: {len(source_pages())} pages, {len(strings)} runtime strings, {len(missing)} missing")
        problems += len(missing)
    if strict and problems:
        raise SystemExit(f"{problems} problem(s): run `status` / `todo` first")


# --------------------------------------------------------------------------
# check
# --------------------------------------------------------------------------
def visible_cyrillic(doc):
    """Cyrillic left in generated pages, ignoring comments, scripts and analytics attributes."""
    d = re.sub(r"<!--.*?-->", "", doc, flags=re.S)
    d = re.sub(r"<script\b.*?</script>", "", d, flags=re.S | re.I)
    d = re.sub(r"""\sdata-fmm-[a-z-]+=(["']).*?\1""", "", d)
    d = re.sub(r"""\shreflang="[^"]*"\s+href="[^"]*\"""", "", d)
    d = re.sub(r'<span lang="uk">.*?</span>', "", d, flags=re.S)
    found = []
    for m in CYR.finditer(d):
        s = max(0, m.start() - 40)
        found.append(norm(d[s:m.start() + 40]))
    return found


def orphan_pages(lang):
    """Generated pages whose Ukrainian source page no longer exists."""
    out = []
    base = SITE / lang
    if not base.exists():
        return out
    sources = set(source_pages())
    for p in list(base.glob("*.html")) + list(base.glob("blog/*.html")):
        rel = p.relative_to(base).as_posix()
        if rel not in sources and "GENERATED by i18n/build.py" in p.read_text(encoding="utf-8")[:400]:
            out.append(rel)
    return out


def check():
    bad = 0
    for lang in LANGS:
        for rel in orphan_pages(lang):
            print(f"{lang}/{rel}: generated page without a Ukrainian source (run build)")
            bad += 1
        for rel in source_pages():
            p = SITE / lang / rel
            if not p.exists():
                print(f"MISSING {lang}/{rel}")
                bad += 1
                continue
            doc = p.read_text(encoding="utf-8")
            if f'<html lang="{lang}"' not in doc:
                print(f"{lang}/{rel}: wrong <html lang>")
                bad += 1
            left = visible_cyrillic(doc)
            seen = set()
            for snip in left:
                if snip in seen:
                    continue
                seen.add(snip)
                print(f"{lang}/{rel}: Ukrainian left: …{snip}…")
                bad += 1
            for m in re.finditer(r"""\b(?:href|src)=["']([^"'#?]+)""", doc):
                val = m.group(1)
                if re.match(r"^(?:[a-zA-Z][a-zA-Z0-9+.-]*:|//|/)", val):
                    continue
                target = (p.parent / val).resolve()
                if val.endswith("/"):
                    target = target / "index.html"
                if not target.exists():
                    print(f"{lang}/{rel}: broken link {val}")
                    bad += 1
    print("check: OK" if bad == 0 else f"check: {bad} problem(s)")
    return bad


def main(argv):
    if not argv:
        print(__doc__)
        return
    cmd, rest = argv[0], argv[1:]
    if cmd == "extract":
        extract()
    elif cmd == "status":
        status()
    elif cmd == "todo":
        todo(rest[0])
    elif cmd == "validate":
        # no paths: every work file that has not been merged yet
        paths = rest or sorted(str(p) for p in WORK.glob("*/*.json"))
        sys.exit(1 if validate(paths) else 0)
    elif cmd == "merge":
        merge(rest[0])
    elif cmd == "build":
        build(strict="--strict" in rest)
    elif cmd == "check":
        sys.exit(1 if check() else 0)
    else:
        print(__doc__)


if __name__ == "__main__":
    main(sys.argv[1:])
