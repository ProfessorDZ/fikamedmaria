# ☕ Fika med Maria

A warm, premium, Scandinavian-inspired **Ukrainian-language website** for *Fika med Maria* —
a founder-led Swedish-learning brand for adults. Built from Maria's brief.

It's a static multi-page site (no build step, no dependencies), so it runs anywhere
and deploys in minutes — ideal for a quick preview link.

## Pages

Addresses have no `.html` (`/kursy`, not `/kursy.html`); the files keep their names.
Only the language home pages end in a slash (`/en/`). `vercel.json` redirects `/kursy/` to
`/kursy`, because with the slash the relative paths to `assets/` stop resolving.

| File | Address | Page |
|------|---------|------|
| `index.html` | `/` | Головна (Home) |
| `kursy.html` | `/kursy` | Курси (Courses overview) |
| `kurs.html` | `/kurs?id=<course-id>` | Course detail template (URL-driven by id) |
| `gotovi-uroky.html` | `/gotovi-uroky` | Готові уроки (Ready-made lessons catalogue) |
| `uroky/<id>.html` | `/uroky/<id>` | One page per lesson, generated from the `urok.html` template |
| `misyachnyk.html` | `/misyachnyk` | Медіатека (Media library: magazine, podcast, show) |
| `blog.html` | `/blog` | Блог (Blog overview) |
| `blog/<post>.html` | `/blog/<post>` | One blog post |
| `kontakty.html` | `/kontakty` | Контакти / запис (Contact & application) |
| `vykladacham.html` | `/vykladacham` | Викладачам (For teachers) |
| `kurs-vykladacham.html` | `/kurs-vykladacham` | Course sales page for teachers |

In HTML, write page links without `.html` (`href="kursy"`, `href="kontakty?offer=consultation"`).
In JavaScript, `data.js` and `main.js` keep file names such as `"kontakty.html"`; `I.url()`
(`assets/i18n.js`) drops the `.html` when it builds the link. A `rel` in `build.py` and
`prerender.mjs` is a file path and keeps its `.html`.

## How it's structured

- **`assets/styles.css`** — the full design system (warm cream + brand blue `#0d4a85` +
  honey accent, editorial Playfair Display headings + Inter body, all responsive).
- **`assets/data.js`** — **all editable content** in reusable arrays: `liveLessons`, `selfStudyCourses`,
  `resources`, `posts`, `faq`, `courseFaq`, `testimonials`. Edit text here and it
  updates across every page.
- **`assets/main.js`** — holds the templates for the header, footer and card grids, and
  handles the mobile menu, FAQ accordions and forms. `i18n/prerender.mjs` runs those same
  templates at build time and writes the result into the HTML, so crawlers that do not run
  scripts see it. In the browser `main.js` only fills a block the build left empty.

Card grids are placed with simple markers, e.g.:
`<div class="grid grid-2" data-courses="live"></div>`,
`<div data-resources></div>`, `<div data-posts></div>`, `<div class="faq" data-faq="course"></div>`.
The `data-courses` attribute supports `"live"` (4 live lesson formats) and `"self-study"` (12 self-study courses).

## Languages (Ukrainian, Swedish, English, Polish)

Ukrainian is the source and lives at the root. `sv/`, `en/` and `pl/` hold the same
pages in Swedish, English and Polish (blog in `<lang>/blog/`). **They are generated —
never edit them by hand**; change the Ukrainian page and rebuild. The header has a
language menu (`assets/i18n.js`) that keeps the current page and `?id=` when switching.

- `i18n/build.py` — the generator. Translations are stored in `i18n/catalogs/<lang>.json`,
  keyed by the exact Ukrainian text (a reworded Ukrainian sentence needs a new translation).
- Text that JavaScript draws (`main.js`, `data.js`, `fmm-kit.js`) goes through `T("…")`;
  wrap every new user-visible string in `T()`. Runtime strings for each language are
  written to `assets/i18n/<lang>.js`.
- `i18n/STYLE.md` and `i18n/glossary/` — tone, typography and fixed terms per language.
- `i18n/covers.py` + `i18n/covers.json` — blog covers have the headline drawn into the
  picture; the script paints it out and sets the translated headline
  (`assets/blog/<lang>/<cover>.webp`). A new post needs its cover lines in `covers.json`.

After changing site text:

```bash
python3 i18n/build.py extract     # find all translatable pieces
python3 i18n/build.py status      # what is missing per language
python3 i18n/build.py todo sv     # work files with the missing pieces (i18n/work/sv/)
python3 i18n/build.py validate    # after filling the "value" fields
python3 i18n/build.py merge sv    # into the catalog
python3 i18n/build.py build       # regenerate sv/ en/ pl/ and assets/i18n/*.js
node i18n/prerender.mjs           # header, footer, cards, uroky/ pages, sitemap.xml
python3 i18n/build.py check       # leftover Ukrainian, broken links, wrong lang
```

**After any change to `data.js`, `lesson-details.js`, `main.js` or a page, run `build` and
`prerender`.** Skipping them leaves the static HTML behind the data. Both are safe to rerun
and give no diff when nothing changed.

A new lesson also needs its id added to the two `/urok` redirects in `vercel.json` (`/urok?id=<id>` and `/<lang>/urok?id=<id>` lead to `/uroky/<id>`).

`SITE_URL` in `build.py` (used for `hreflang` and social previews) must be updated
if the site moves to its own domain.

## Run / preview locally

```bash
python3 i18n/serve.py            # port 8000 by default; python3 i18n/serve.py 8743 for another
# open http://localhost:8000
```

`i18n/serve.py` serves the repo root with the production addresses: `/kursy` answers with
`kursy.html`, and an unknown address gets `404.html` with status 404. Plain
`python3 -m http.server` cannot serve `/kursy`.

> Open via a server (not `file://`) so the shared header/footer and cards render.

## Deploy

The site is at the repo root — a static deploy with no build command, so the generated
files are committed.

- **Vercel (production)** — https://fikamedmaria.com (www and fikamedmaria.vercel.app redirect here)
  Project `fikamedmaria` on the marketinggrizly Vercel account. Every push to `main`
  goes live. `.vercelignore` keeps `i18n/`, `supabase/` and `.github/` out of the deploy;
  its leading slashes matter, because `assets/i18n/` has to stay in.
- **Addresses have no `.html`.** `"cleanUrls": true` in `vercel.json` serves `/kursy` and
  redirects `/kursy.html` to it. A redirect `source` must not end in `.html`: Vercel applies
  the `cleanUrls` rules before the redirects, so such a rule would never match. Language home
  pages stay `/en/` with the slash, because the relative links depend on it.

## What's placeholder (for Maria to provide)

The brief lists these as "still missing" — they're marked in the UI as placeholders:

- Maria's real photo (hero shows a styled monogram placeholder)
- Final bio, exact course names/formats, **prices** (shown as «Уточнюється»)
- Real testimonials (section shows placeholder cards, no fake names)
- Free resource files, newsletter provider, contact handles (Telegram/Instagram)
- Legal/privacy pages

## Data, consent and events

**Script order.** `assets/fmm-kit.js` is loaded on every page, between `data.js` and
`main.js`. A new page must include the same three tags in that order:

```html
<script defer src="assets/data.js"></script>
<script defer src="assets/fmm-kit.js"></script>
<script defer src="assets/main.js"></script>
```

**Config.** The config block at the top of `assets/fmm-kit.js` holds the backend
address and its public key, plus these values:

- `gtmId` — `GTM-5LHRGJFH`. Nothing is loaded from Google before the visitor allows
  analytics or ads. Tags live in that container; platform ids are in its `CONST - …`
  variables, so a new pixel id is set in one place.
- `ga4Id` — `G-V4RKW91FKN`. The GA session id is read from the cookie
  `_ga_<id without "G-">`.
- `privacyUrl` — the address of the privacy page.
- `noticeVersion` — change it when the banner or what is collected changes: every
  visitor is then asked again.
- `preselectOptional` — `false`: Analytics and Ads start unticked on the settings layer,
  so consent is an active choice. `true` would show them ticked for a first-time visitor.
  Whatever the value, a browser that sends Global Privacy Control starts unticked, and
  a saved choice is always shown as saved.

**Consent.** Without consent the site stores only what a visitor sends on purpose
(the contact request). The cookie banner has two layers. The first has two equal buttons,
"Налаштувати" and "Дозволити все"; there is no refuse button, and ignoring the banner keeps
consent unset, so nothing is tracked. "Налаштувати" opens the second layer: "Необхідні"
(always on), "Аналітика" and "Реклама", two independent choices. Only after the visitor
allows **analytics** does the site store a visitor id and record page views, clicks and
form-fill steps (never the text a visitor typed). Only after the visitor allows **ads**
does it keep ad click ids (below) and may the lead data, including the IP address, later
be passed to Meta and Google to measure ads. The choice is saved in `fmm_consent` as
`{analytics, ads, v, at}` and logged in `consent_log` (purpose `analytics` or `ads`, no
identifier for a refusal). Both layers end in one function, `applyChoice()`. A visitor
changes or withdraws a choice through "Налаштування cookie" in the footer (a button with
`data-fmm-cookie-settings`), which opens the second layer directly. Withdrawing a purpose
deletes what was stored for it, in the browser and on the server, and reloads the page.
Google consent mode follows the choices: analytics sets `analytics_storage`, ads sets
`ad_storage`, `ad_user_data` and `ad_personalization`.

**Ad and GA identifiers.** Nothing is sent to Meta or Google yet; the ids are only
captured and saved so a server can send them later. With **ads consent**, the browser
keeps `fmm_ads` in localStorage: `{key, gclid, gbraid, wbraid, fbclid, msclkid, ttclid,
fbc, fbp, at}`. `key` is a random id made when ads are allowed; click ids come from the
page address, are capped at 300 characters and dropped after 90 days; `fbc` and `fbp`
come from the `_fbc` / `_fbp` cookies or are built in Meta's format. The record is removed
on withdrawal. With **analytics consent**, the GA client id (cookie `_ga`) and session id
(cookie `_ga_<id>`) are read when a form is sent. The form payload carries `ga_client_id`,
`ga_session_id`, `ads_consent`, `ad_key` and `ad_ids`; they are saved in
`form_submissions` by `submit_form`, together with `client_ip`, the full IP address, which
is stored only with ads consent and erased after 7 days by the `purge-client-ips` job.
The ids never go into `dataLayer`, events, Telegram messages or the console. A future
sender must respect the Measurement Protocol limit of 72 hours for backdated events and
Meta's 7 day limit for `event_time`, and must use `lead:<submission_key>` as the event id
so Meta can deduplicate it against the browser event. The GA ids stay empty until GTM and
GA4 are set up. Apply `supabase/migrations/20261102090000_ad_and_ga_identifiers.sql`
before publishing the new banner.

**Contact form outcomes.** The form has three results: sent; saved on the device and
retried automatically; or could not be sent (the visitor is told to write directly).
`generate_lead` is pushed to `dataLayer` only after the backend has confirmed the request.

**Telegram notifications.** Every non-spam submission stays in `form_submissions` and is
also sent to a Telegram chat by the `telegram-notify` edge function. A database trigger
runs it right after the insert, and `pg_cron` retries every 2 minutes with backoff for
7 days. Honeypot spam is stored but not sent. Failures are visible in `notified_at`,
`notify_attempts` and `notify_error`. The code lives in `supabase/`; the bot token and
chat id live in Vault as `telegram_bot_token` and `telegram_chat_id`.

**Preselecting an offer.** `kontakty?offer=<id>` preselects what the visitor is
interested in (for example `?offer=consultation` or `?offer=teacher_collab`).

**`data-fmm-*` attributes** (put them on links and buttons):

| Attribute | Meaning |
|-----------|---------|
| `data-fmm-item` | Product id |
| `data-fmm-name` | Product name shown in events |
| `data-fmm-cat` | Category: `live_lesson`, `course`, `lesson`, `teacher_course`, `magazine` |
| `data-fmm-list` | The list the item is shown in |
| `data-fmm-action="buy_click"` | Marks a buy button |
| `data-fmm-free-issue` | Marks the free magazine issue button |
| `data-fmm-cookie-settings` | Reopens the cookie banner |

**Adding a form.** Give the form `data-contact` (or `data-newsletter`), use named
fields, add a `[data-msg]` paragraph for the status text, and include the hidden
`website` honeypot field (`<div class="hp-field" aria-hidden="true">…</div>`, see
`kontakty.html`).

**Purchases.** The `purchase` event is pushed to `dataLayer` on the page the buyer
returns to after payment (a URL carrying `?session_id=…`). That page does not exist yet.

**Local testing.** On `localhost` only, setting `localStorage.fmm_dev_api` to the
address of a mock server sends all calls there instead of the real backend.

## Design references honoured

- **Swedish with Yulia** — main visual / UX / ecosystem inspiration (typography, warmth,
  free + paid materials, monthly mini-magazine, premium school feeling).
- **Humla** — structural reference only (course pages, pricing, FAQ, free materials,
  newsletter). Its visual style was intentionally **not** copied.

---

Зроблено з теплом. 🫶
