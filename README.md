# ☕ Fika med Maria

A warm, premium, Scandinavian-inspired **Ukrainian-language website** for *Fika med Maria* —
a founder-led Swedish-learning brand for adults. Built from Maria's brief.

It's a static multi-page site (no build step, no dependencies), so it runs anywhere
and deploys in minutes — ideal for a quick preview link.

## Pages

| File | Page |
|------|------|
| `index.html` | Головна (Home) |
| `pro-mariu.html` | Про Марію (About Maria) |
| `kursy.html` | Курси (Courses overview) |
| `kurs.html` | Course detail template (Шведська з нуля) |
| `bezkoshtovni.html` | Безкоштовні матеріали (Free materials) |
| `misyachnyk.html` | Місячник (Monthly mini-magazine) |
| `blog.html` | Блог (Blog overview) |
| `kontakty.html` | Контакти / запис (Contact & application) |

## How it's structured

- **`assets/styles.css`** — the full design system (warm cream + brand blue `#0d4a85` +
  honey accent, editorial Playfair Display headings + Inter body, all responsive).
- **`assets/data.js`** — **all editable content** in reusable arrays: `courses`,
  `resources`, `posts`, `faq`, `courseFaq`, `testimonials`. Edit text here and it
  updates across every page.
- **`assets/main.js`** — injects the shared header/footer, renders card grids from
  `data.js`, handles the mobile menu, FAQ accordions, and demo forms.

Card grids are placed with simple markers, e.g.:
`<div class="grid grid-3" data-courses="featured" data-limit="3"></div>`,
`<div data-resources></div>`, `<div data-posts></div>`, `<div class="faq" data-faq="course"></div>`.

## Run / preview locally

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

> Open via a server (not `file://`) so the shared header/footer and cards render.

## Deploy

The site is at the repo root — a zero-config static deploy. It is live in two places:

- **Vercel (production)** — https://fikamedmaria.vercel.app
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

## Hooking up forms (newsletter + contact)

Forms are front-end-only right now (validate + store to `localStorage`). To collect
real data, wire each `form[data-newsletter]` / `form[data-contact]` to a provider
(Mailchimp, Buttondown, Formspree) or your own endpoint inside `wireForms()` in
`assets/main.js`.

## Design references honoured

- **Swedish with Yulia** — main visual / UX / ecosystem inspiration (typography, warmth,
  free + paid materials, monthly mini-magazine, premium school feeling).
- **Humla** — structural reference only (course pages, pricing, FAQ, free materials,
  newsletter). Its visual style was intentionally **not** copied.

---

Зроблено з теплом. 🫶
