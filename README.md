# ☕ Fika med Maria

A warm, premium, Scandinavian-inspired **Ukrainian-language website** for *Fika med Maria* —
a founder-led Swedish-learning brand for adults. Built from Maria's brief.

It's a static multi-page site (no build step, no dependencies), so it runs anywhere
and deploys in minutes — ideal for a quick preview link.

## Pages

| File | Page |
|------|------|
| `index.html` | Головна (Home) |
| `kursy.html` | Курси (Courses overview) |
| `kurs.html` | Course detail template (URL-driven by id, e.g. `kurs.html?id=<course-id>`) |
| `bezkoshtovni.html` | Готові уроки (Free materials) |
| `misyachnyk.html` | Медіатека (Media library: magazine, podcast, show) |
| `blog.html` | Блог (Blog overview) |
| `kontakty.html` | Контакти / запис (Contact & application) |
| `vykladacham.html` | Викладачам (For teachers) |

## How it's structured

- **`assets/styles.css`** — the full design system (warm cream + brand blue `#0d4a85` +
  honey accent, editorial Playfair Display headings + Inter body, all responsive).
- **`assets/data.js`** — **all editable content** in reusable arrays: `liveLessons`, `selfStudyCourses`,
  `resources`, `posts`, `faq`, `courseFaq`, `testimonials`. Edit text here and it
  updates across every page.
- **`assets/main.js`** — injects the shared header/footer, renders card grids from
  `data.js`, handles the mobile menu, FAQ accordions, and demo forms.

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
python3 i18n/build.py check       # leftover Ukrainian, broken links, wrong lang
```

`SITE_URL` in `build.py` (used for `hreflang` and social previews) must be updated
if the site moves to its own domain.

## Run / preview locally

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

> Open via a server (not `file://`) so the shared header/footer and cards render.

## Deploy

The site is at the repo root — a zero-config static deploy. It is live in two places:

- **Vercel (production)** — https://fikamedmaria.com (also served at https://fikamedmaria.vercel.app)
  Project `fikamedmaria` on the marketinggrizly Vercel account. To redeploy after
  changes, either connect this GitHub repo to the Vercel project (Vercel dashboard →
  Project → Settings → Git) so every push to `main` auto-deploys, or run `vercel --prod`
  from the repo root with the Vercel CLI. No framework preset and no build command —
  deploy the 11 site files (8 HTML pages + `assets/`) as-is.
- **GitHub Pages** — `.github/workflows/pages.yml` publishes automatically on every
  push to `main`.

Pushing to `main` is therefore the single step that updates Pages; Vercel updates
automatically too once the repo is connected in the Vercel dashboard.

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
<script src="assets/data.js"></script>
<script src="assets/fmm-kit.js"></script>
<script src="assets/main.js"></script>
```

**Config.** The config block at the top of `assets/fmm-kit.js` holds the backend
address and its public key, plus three values that still have to be filled in:

- `gtmId` — currently the `GTM-XXXXXXX` placeholder. While it is the placeholder,
  nothing is loaded from Google.
- `ga4Id` — currently the `G-XXXXXXXXXX` placeholder.
- `privacyUrl` — the address of the privacy page.

**Consent.** Without consent the site stores only what a visitor sends on purpose
(the contact request). Only after the visitor allows analytics in the cookie banner
does it store a visitor id and record page views, clicks and form-fill steps (never
the text a visitor typed). The choice can be changed later through "Налаштування cookie"
in the footer (a button with `data-fmm-cookie-settings`).

**Contact form outcomes.** The form has three results: sent; saved on the device and
retried automatically; or could not be sent (the visitor is told to write directly).
`generate_lead` is pushed to `dataLayer` only after the backend has confirmed the request.

**Preselecting an offer.** `kontakty.html?offer=<id>` preselects what the visitor is
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
