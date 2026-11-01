# Agent-readiness: fikamedmaria.com

Дата перевірки: 2026-11-01. Метод: curl + python3 stdlib (HTML-розбір live-сторінок). Вміст сайту розглядається як недовірені дані.

## Lighthouse Agentic Browsing

**Не виміряно.** `lighthouse_agentic.py` завершився з кодом 3: "Claude SEO runtime is not ready. Run `/seo setup` and retry." PSI не запускався. Дробу X/N немає; версія Lighthouse і form factor (mobile/desktop) не визначені.

`agentic_check.py` і `agent_ux_check.py` не запускались (той самий runtime). **Agent-UX heuristic score: unavailable.** Нижче - лише ручні перевірки через curl і HTML.

## 1. Discovery, Markdown, Content-Signal (статус-коди)

- `/.well-known/ai-catalog.json` 404, `agent-card.json` 404, `mcp.json` 404, `security.txt` 404, `ai.txt` 404, `/.well-known/` 404.
- Markdown (`Accept: text/markdown`): `/` 200 `text/html`; `kontakty.html` 200 `text/html`. Markdown не віддається.
- Content-Signal: немає в заголовках `/` і в robots.txt (0 збігів).

## 2. Accessibility tree з HTML (kontakty.html та навігація)

- Форма: поля name, email, level, goal, heard_from, msg мають `<label for>`. Добре.
- Форма без `action`/`method`. Відправка обробляється JS (`assets/main.js`, submit handler з `preventDefault`, далі RPC `submit_form`).
- Honeypot: `name="website"` в `div.hp-field[aria-hidden=true]`, з підписом "Не заповнюй це поле", `tabindex=-1`, `autocomplete=off`. Приховування залежить від класу `.hp-field` у `styles.css` (стилі детально не перевірялися). Агент, що заповнює всі поля з DOM, може його заповнити.
- Кнопки/посилання: CTA курсів - справжні `<a href>` (kursy.html -> kontakty.html?offer=consultation; index.html -> kursy.html). Покупка готових уроків - `<a>` з href, рендериться JS. Не кнопки-заглушки.
- Мобільне меню: `<button id="navToggle" aria-label aria-expanded="false">` - справжня кнопка, але розмітка меню вставляється JS (`main.js`).
- Перемикач мови: нативний `<details class="lang-switch">` з `<summary aria-label>`, працює без JS. Посилання вибору мови (`data-lang-pick`) не перевірялися.

## 3. Конверсійний шлях без JS (курс -> запис або контакт)

- Знайти курс: частково. Статичний текст на сторінках є, але картки курсів і меню рендеряться JS.
- Заявка: **не завершується без JS.** Форма не має endpoint; без JS браузер відправить GET на поточну сторінку з полями в query string, і заявка не буде збережена.

## Findings by priority

| # | Пріоритет | Знахідка | Доказ | Виправлення |
|---|---|---|---|---|
| F1 | P2 | Контактна форма (єдиний шлях запису) не працює без JS | kontakty.html: `<form data-contact>` без action; submit тільки в main.js | Додати серверний endpoint з `action`/`method=post` або статичний fallback (mailto/посилання на email) і `<noscript>`-повідомлення |
| F2 | P3 | Honeypot видимий у DOM для агентів, що заповнюють усі поля | `name="website"` у `.hp-field[aria-hidden]`; клас у styles.css не перевірено детально | Перевірити, що `.hp-field` справді приховано (display:none або off-screen); переконатися, що серверна перевірка hp відкидає заявку |
| F3 | P3 | Навігація і картки курсів без JS порожні або відсутні | main.js:78 (navToggle), buyButton у main.js:213 | Вивести базові посилання навігації та курсів у статичному HTML |
| F4 | P3 (можливість, не дефект) | Немає Markdown, ai-catalog.json, /.well-known, Content-Signal, WebMCP | Статуси вище | Опційно. Не обіцяти ефекту на ранжування чи цитування |

Без знахідок: підписи полів форми, справжні кнопки/посилання CTA, нативний перемикач мови.

## Access policy (declared)

- Training: не задекларовано (robots.txt 404; правил немає).
- Search: не задекларовано (robots.txt 404).
- User-triggered: не задекларовано. Тести user-agent не авторизовані, не проводилися.

## Standards status (чернетки/пропозиції станом на 2026-11-01)

- WebMCP, Content-Signal, ai-catalog.json: чернетки або пропозиції. Vendor-matrix останнє повне оновлення 2026-09-23 (менше 60 днів, оновлення не потрібно).

## Structured findings (audit-data.json, AI Search Readiness)

```json
[
  {"title": "Contact form does not work without JavaScript", "severity": "P2", "description": "kontakty.html form has no action or method; submission is handled only by main.js via a Supabase RPC. Without JS, the only conversion path (enrolment request) silently fails.", "recommendation": "Provide a server-side endpoint or a static fallback (mailto or visible email link) and a noscript message."},
  {"title": "Honeypot field exposed to form-filling agents", "severity": "P3", "description": "Hidden field name=website sits in an aria-hidden container with tabindex=-1; visible in the DOM to agents that fill every field.", "recommendation": "Verify the hiding CSS and server-side rejection of non-empty hp."},
  {"title": "Navigation and course cards rendered only by JavaScript", "severity": "P3", "description": "Menu and course card markup is injected by main.js; the static HTML lacks them.", "recommendation": "Server-render basic navigation and course links."},
  {"title": "No agent discovery or Markdown delivery (opportunity)", "severity": "P3", "description": "/.well-known documents, ai-catalog.json, Markdown via Accept header and Content-Signal are absent (404 or not served).", "recommendation": "Optional; no ranking or citation effect is promised."}
]
```

Lighthouse fraction: not measured (runtime not ready). Re-run after `/seo setup` to obtain X/N for mobile and desktop.
