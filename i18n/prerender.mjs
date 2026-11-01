#!/usr/bin/env node
/* Fika med Maria: puts the HTML that assets/main.js draws in the browser into the
   files themselves, so crawlers that do not run scripts (Bing, AI crawlers, and
   Google before it renders) see the header, footer, cards, lists and lessons.

   Run it after `python3 i18n/build.py build`:

       python3 i18n/build.py build     # sv/ en/ pl/ pages, runtime strings, hreflang, JSON-LD
       node i18n/prerender.mjs         # prerendered blocks, lesson pages, sitemap.xml

   assets/main.js stays the only template code. This script loads it (with
   assets/i18n.js, the language's strings, data.js and lesson-details.js) in a
   node:vm context that stubs just enough of window and document, once for every
   page, and calls the builders it exposes as window.FMMRender. Their HTML goes
   into each placeholder (data-include-header, data-courses, data-posts, ...)
   between <!-- prerender --> and <!-- /prerender --> markers. The markers make a
   run idempotent: they are removed before every run, so the same input gives the
   same bytes. i18n/build.py removes them too before it reads a Ukrainian page,
   so prerendered text never becomes a translatable piece.

   It also writes the 30 lesson pages in 4 languages (uroky/<id>.html and
   <lang>/uroky/<id>.html, from urok.html) and sitemap.xml.

   Links come out relative to the page, like the rest of the site's markup: the
   stub serves the site from http://prerender.invalid/ and that prefix is turned
   into a path from the page's own folder. The footer's year is the year of the
   run; the browser brings it up to date. No dependencies: node:fs, node:vm,
   node:path and node:child_process (git, for the sitemap's lastmod). */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITE_URL = /^SITE_URL = "([^"]+)"/m.exec(readFileSync(path.join(SITE, "i18n/build.py"), "utf8"))[1];

const LANGS = ["uk", "sv", "en", "pl"];                                  // "uk" is the source, at the root
const OG_LOCALE = { uk: "uk_UA", sv: "sv_SE", en: "en_GB", pl: "pl_PL" };    // as in build.py
const UK_ONLY = ["404.html"];                                            // served at any depth, so it stays JS-rendered
const QUERY_PAGES = ["kurs.html", "urok.html"];                          // content depends on ?id=; not in the sitemap
const ORIGIN = "http://prerender.invalid/";                              // the site's root inside the stub
const MARK_START = "<!-- prerender -->";
const MARK_END = "<!-- /prerender -->";
const MARKS = new RegExp(MARK_START + "[\\s\\S]*?" + MARK_END, "g");
const ALTERNATES = /<!-- i18n:alternates -->[\s\S]*?<!-- \/i18n:alternates -->/;
const TOP_PAGES = ["index.html", "kursy.html", "gotovi-uroky.html", "misyachnyk.html", "blog.html",
  "kontakty.html", "vykladacham.html", "kurs-vykladacham.html"];            // sitemap order

const read = (rel) => readFileSync(path.join(SITE, rel), "utf8");

function write(rel, text) {
  const file = path.join(SITE, rel);
  if (existsSync(file) && readFileSync(file, "utf8") === text) return false;
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, text);
  return true;
}

const stripMarks = (src) => src.replace(MARKS, "");
const plain = (html) => html.replace(/<[^>]+>/g, "");
const escHtml = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/* ---------------------------------------------------------------- pages */

/* Ukrainian source pages (paths from the site root): the same list as build.py's
   source_pages(), plus kurs.html and urok.html, which build.py treats as pages too. */
function sourcePages() {
  const root = readdirSync(SITE).filter((f) => f.endsWith(".html") && !UK_ONLY.includes(f)).sort();
  const blog = readdirSync(path.join(SITE, "blog")).filter((f) => f.endsWith(".html")).sort();
  return root.concat(blog.map((f) => "blog/" + f));
}

const fileOf = (lang, rel) => (lang === "uk" ? rel : lang + "/" + rel);

/* The address a page is served at, from the site root: index.html is its folder
   and the other pages lose their ".html" (vercel.json cleanUrls). `rel` stays
   the file path. */
function servedPath(lang, rel) {
  const tail = rel === "index.html" ? "" : rel.replace(/\.html$/, "");
  return (lang === "uk" ? "" : lang + "/") + tail;
}

function altHref(lang, rel) {
  return SITE_URL + "/" + servedPath(lang, rel);
}

/* ------------------------------------------------------------ vm context */

const compiled = {};
function script(rel) {
  if (!compiled[rel]) compiled[rel] = new vm.Script(read(rel), { filename: rel });
  return compiled[rel];
}

/* A page's window: only what i18n.js and main.js touch while they load. Clicks,
   forms and the DOMContentLoaded handler never run here, so no more is stubbed. */
function pageContext(lang, rel, dataPage) {
  const href = ORIGIN + servedPath(lang, rel);
  const sandbox = { URL, URLSearchParams };
  sandbox.window = sandbox;
  sandbox.location = { protocol: "http:", href, search: "", hash: "", pathname: "/" + servedPath(lang, rel) };
  sandbox.document = {
    documentElement: { getAttribute: (n) => (n === "lang" ? lang : null) },
    currentScript: { src: ORIGIN + "assets/i18n.js" },     // i18n.js finds the site root from this
    body: { dataset: { page: dataPage }, getAttribute: (n) => (n === "data-page" ? dataPage : null) },
    addEventListener() {}
  };
  vm.createContext(sandbox);
  const files = (lang === "uk" ? [] : ["assets/i18n/" + lang + ".js"])
    .concat(["assets/i18n.js", "assets/data.js", "assets/lesson-details.js", "assets/main.js"]);
  files.forEach((f) => script(f).runInContext(sandbox));
  return sandbox;
}

/* ------------------------------------------------------------ placeholders */

/* The <div>/<main> with attribute `attr`: [{ el, at }], where `el` answers
   getAttribute and hasAttribute as a DOM element would, and `at` is the offset
   just before its closing tag. */
function findPlaceholders(src, attr) {
  const open = new RegExp("<([a-zA-Z][a-zA-Z0-9]*)\\b([^>]*\\s" + attr + "(?=[\\s/>=])[^>]*)>", "g");
  const found = [];
  for (const m of src.matchAll(open)) {
    const attrs = {};
    for (const a of m[0].matchAll(/\s([a-zA-Z_:][-\w:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g)) {
      attrs[a[1].toLowerCase()] = a[2] ?? a[3] ?? a[4] ?? "";
    }
    const el = { getAttribute: (n) => (n in attrs ? attrs[n] : null), hasAttribute: (n) => n in attrs };
    // the matching closing tag: count the same tag nested inside
    const tags = new RegExp("<(/?)" + m[1] + "\\b[^>]*>", "gi");
    tags.lastIndex = m.index + m[0].length;
    let depth = 1, t;
    while (depth && (t = tags.exec(src))) depth += t[1] ? -1 : 1;
    if (depth) throw new Error("no closing </" + m[1] + "> for " + m[0]);
    found.push({ el, at: t.index });
  }
  return found;
}

/* Everything in the stub's address space becomes a path from the page's folder. */
function relativize(html, file) {
  const dir = path.posix.dirname(file) === "." ? "" : path.posix.dirname(file);
  return html.replace(/http:\/\/prerender\.invalid\/([^"'<>\s)]*)/g, (all, target) => {
    const [, p, tail] = /^([^?#]*)(.*)$/.exec(target);
    const rel = path.posix.relative(dir, p.replace(/\/$/, ""));
    if (p === "" || p.endsWith("/")) return (rel ? rel + "/" : "./") + tail;
    // a page named like its own folder (blog, seen from blog/): "" would mean the current page
    return (rel || "../" + path.posix.basename(p)) + tail;
  });
}

/* The page with its placeholders filled. `extra` adds jobs: [{ attr, html(el) }]. */
function fillPage(src, ctx, file, extra) {
  src = stripMarks(src);
  const R = ctx.FMMRender;
  const jobs = [
    { attr: "data-include-header", html: () => R.buildHeader() },
    { attr: "data-include-footer", html: () => R.buildFooter() }
  ].concat(R.fillers.map((f) => ({ attr: f.selector.slice(1, -1), html: (el) => f.html(el, ctx.FMM) })), extra || []);
  const inserts = [];
  for (const job of jobs) {
    for (const { el, at } of findPlaceholders(src, job.attr)) {
      const html = job.html(el);
      if (html != null) inserts.push({ at, text: MARK_START + relativize(html, file) + MARK_END });
    }
  }
  inserts.sort((a, b) => b.at - a.at);                       // from the end, so offsets stay valid
  for (const { at, text } of inserts) src = src.slice(0, at) + text + src.slice(at);
  return src;
}

/* ---------------------------------------------------------- lesson pages */

/* JSON-LD as the block build.py writes for its pages (see put_jsonld there). */
function jsonLdBlock(data) {
  const json = JSON.stringify(data).replace(/<\//g, "<\\/");
  return ["<!-- i18n:jsonld -->", '<script type="application/ld+json">' + json + "</script>", "<!-- /i18n:jsonld -->"].join("\n  ");
}

/* canonical, hreflang and social tags: what build.py's alternates_block writes
   for the other pages. */
function alternatesBlock(lang, rel, page) {
  const lines = ["<!-- i18n:alternates -->", `<link rel="canonical" href="${altHref(lang, rel)}" />`];
  for (const l of LANGS) lines.push(`<link rel="alternate" hreflang="${l}" href="${altHref(l, rel)}" />`);
  lines.push(`<link rel="alternate" hreflang="x-default" href="${altHref("uk", rel)}" />`);
  lines.push(`<meta property="og:locale" content="${OG_LOCALE[lang]}" />`);
  lines.push(`<meta property="og:url" content="${altHref(lang, rel)}" />`);
  lines.push(`<meta property="og:title" content="${escHtml(page.title)}" />`);
  lines.push(`<meta property="og:description" content="${escHtml(page.description)}" />`);
  lines.push('<meta property="og:type" content="website" />');
  lines.push(`<meta property="og:image" content="${page.image}" />`);
  lines.push('<meta name="twitter:card" content="summary_large_image" />');
  lines.push("<!-- /i18n:alternates -->");
  return lines.join("\n  ");
}

/* One lesson page: urok.html (or its translation) one folder deeper, with its own
   head, and the lesson's content written into <main>. */
function lessonPage(lang, lesson) {
  const rel = "uroky/" + lesson.id + ".html";
  const file = fileOf(lang, rel);
  let doc = stripMarks(read(fileOf(lang, "urok.html")));
  const dataPage = /<body[^>]*\sdata-page="([^"]*)"/.exec(doc)[1];
  const ctx = pageContext(lang, rel, dataPage);
  // what T() returns may carry <span lang="uk"> around a quoted Ukrainian word; meta tags take plain text
  const T = (text, vars) => plain(ctx.FMMI18N.T(text, vars));
  const title = plain(ctx.FMMRender.lessonPageTitle(lesson));
  const description = T(lesson.description);

  // one folder deeper: shared files need one more ../
  doc = doc.replace(/\b(href|src)=(["'])([^"']*)\2/g, (all, name, q, val) =>
    /^(?:[a-zA-Z][a-zA-Z0-9+.-]*:|\/|#)/.test(val) || val === "" ? all : `${name}=${q}../${val}${q}`);
  doc = doc.replace(/<!-- GENERATED by i18n\/build\.py[^>]*-->\n?/, "");
  doc = doc.replace(/(<!DOCTYPE[^>]*>\n?)/i, "$1<!-- GENERATED by i18n/prerender.mjs from urok.html, assets/data.js and " +
    "assets/lesson-details.js — do not edit this file. Change those, then run build.py build and prerender.mjs. -->\n");
  doc = doc.replace(/<title>[\s\S]*?<\/title>/, () => `<title>${escHtml(title)}</title>`);
  doc = doc.replace(/(<meta name="description" content=")[^"]*"/, (all, head) => head + escHtml(description) + '"');

  const crumbs = [
    [T("Головна"), altHref(lang, "index.html")],
    [T("Готові уроки"), altHref(lang, "gotovi-uroky.html")],
    [T(lesson.title), altHref(lang, rel)]
  ];
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map(([name, item], i) => ({ "@type": "ListItem", position: i + 1, name, item }))
  };
  const image = SITE_URL + "/assets/lessons/" + lesson.id + "/cover.webp";
  const head = alternatesBlock(lang, rel, { title, description, image }) + "\n  " + jsonLdBlock(breadcrumb);
  doc = doc.replace(ALTERNATES, () => head);
  // urok.html's note about the ?id= query string does not apply to a lesson page
  doc = doc.replace(/<main data-lesson-detail>[\s\S]*?<\/main>/, `<main data-lesson-detail data-lesson-id="${lesson.id}"></main>`);

  const job = { attr: "data-lesson-detail", html: () => ctx.FMMRender.lessonDetailHtml(lesson) };
  return { file, rel, text: fillPage(doc, ctx, file, [job]) };
}

/* ---------------------------------------------------------------- sitemap */

function lastmod(file) {
  const day = execFileSync("git", ["log", "-1", "--format=%cs", "--", file], { cwd: SITE, encoding: "utf8" }).trim();
  return day || new Date().toISOString().slice(0, 10);     // not committed yet
}

function sitemap(pages, lessons) {
  const urls = [];
  for (const rel of pages) for (const lang of LANGS) urls.push({ lang, rel });
  for (const id of lessons) for (const lang of LANGS) urls.push({ lang, rel: "uroky/" + id + ".html" });
  const out = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<!-- Sitemap for ${SITE_URL}, written by i18n/prerender.mjs. ${urls.length} URLs = ${pages.length} pages + ${lessons.length} lessons, each in 4 languages.`,
    "     Excluded: kurs.html / urok.html bare shells and every ?id= URL. Only <loc>, <lastmod> and hreflang alternates are used; priority/changefreq are ignored by Google. -->",
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">'
  ];
  for (const { lang, rel } of urls) {
    out.push("  <url>", `    <loc>${altHref(lang, rel)}</loc>`, `    <lastmod>${lastmod(fileOf(lang, rel))}</lastmod>`);
    for (const l of LANGS) out.push(`    <xhtml:link rel="alternate" hreflang="${l}" href="${altHref(l, rel)}"/>`);
    out.push(`    <xhtml:link rel="alternate" hreflang="x-default" href="${altHref("uk", rel)}"/>`, "  </url>");
  }
  out.push("</urlset>", "");
  return out.join("\n");
}

/* ------------------------------------------------------------------- main */

function main() {
  let changed = 0;
  const pages = sourcePages();

  for (const lang of LANGS) {
    for (const rel of pages) {
      const file = fileOf(lang, rel);
      const src = read(file);
      const dataPage = /<body[^>]*\sdata-page="([^"]*)"/.exec(src)[1];
      if (write(file, fillPage(src, pageContext(lang, rel, dataPage), file))) changed++;
    }
  }

  const lessons = pageContext("uk", "urok.html", "free").FMM.resources;
  const written = new Set();
  for (const lang of LANGS) {
    for (const lesson of lessons) {
      const page = lessonPage(lang, lesson);
      written.add(page.file);
      if (write(page.file, page.text)) changed++;
    }
  }
  // a lesson that is gone from data.js loses its pages
  for (const lang of LANGS) {
    const dir = path.join(SITE, fileOf(lang, "uroky"));
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) {
      const file = fileOf(lang, "uroky/" + f);
      if (!written.has(file) && read(file).includes("GENERATED by i18n/prerender.mjs")) {
        unlinkSync(path.join(SITE, file));
        console.log("removed " + file + " (its lesson is gone)");
      }
    }
  }

  const indexable = pages.filter((p) => !QUERY_PAGES.includes(p));
  const sitemapPages = TOP_PAGES.concat(indexable.filter((p) => !TOP_PAGES.includes(p) && !p.startsWith("blog/")),
    indexable.filter((p) => p.startsWith("blog/")));
  if (write("sitemap.xml", sitemap(sitemapPages, lessons.map((l) => l.id)))) changed++;

  console.log(`prerender: ${pages.length * LANGS.length} pages, ${lessons.length * LANGS.length} lesson pages, ${changed} file(s) changed`);
}

main();
