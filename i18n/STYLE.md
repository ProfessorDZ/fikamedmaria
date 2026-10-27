# Translating the Fika med Maria site — style guide

The site is Ukrainian. We translate it into **Swedish (sv)**, **English (en)** and
**Polish (pl)**. Every piece of text comes from `i18n/work/<lang>/<chunk>.json`:
fill in `"value"` for every item and never touch `"id"` or `"key"`.

## Who is speaking, to whom

* The site belongs to **Maria**, a Ukrainian teacher of Swedish who lives in Sweden.
  She writes in the first person ("я" = I), warmly, plainly, like a good teacher
  talking to an adult student. No corporate or salesy tone; never make a claim
  stronger, weaker or longer than the source.
* Her courses are **taught in Ukrainian, for Ukrainian-speaking adults**. Keep
  every such statement exactly ("для українськомовних дорослих" = "for
  Ukrainian-speaking adults", "Сучасна шведська українською" = modern Swedish
  taught in Ukrainian). Do not quietly change who the offer is for.
* Maria speaks about herself in the feminine (викладачка, сама пройшла).
* The reader: Ukrainian uses the informal **ти** on the pages and in the
  interface, and **ви** in some blog articles. Many forms addressed to the reader
  are **feminine** ("Готова почати…?", "Не готова записуватися?", "Ти
  дивилася…", "Не впевнена").
  * **sv** – always *du*. Gender disappears; that is fine.
  * **en** – *you*. Gender disappears; that is fine.
  * **pl** – *ty* where the source has ти; where a blog article addresses readers
    with ви, use *ty* as well unless the article clearly speaks to a group (then
    *wy*), and stay consistent inside one article. Keep feminine forms where the
    Ukrainian is feminine (*Gotowa?*, *Nie jesteś pewna*, *oglądałaś*) and
    neutral/masculine where it is neutral/masculine. Never Pan/Pani.

## What must not change

* **HTML**: keep every tag and every attribute exactly (`<a href="…">`, `<span
  class="accent">`, `<b>`, `<em>`, `<br>` …). Only the visible words change; the
  tags may move with the words they wrap. A validator rejects any difference.
* **{placeholders}** like `{time}`, `{n}`, `{level}`, `{title}`, `{quote}` stay
  exactly, once each.
* **Swedish words, phrases and example sentences** inside the Ukrainian text
  (*fika*, *lagom*, *Ska vi ta en fika?*, *ju, väl, nog*, lesson titles such as
  *Vad är egentligen lagom?*) are the subject being taught: copy them exactly,
  with the same italics/markup. Never translate or "correct" them.
* The brand **Fika med Maria**, product names that are already Swedish or
  English (Språkkafe, Speak Café, Slow Swedish Morning Show, Canva, Miro, Patreon,
  Instagram, Telegram, YouTube, SFI, PDF), e-mail addresses, @handles, URLs,
  emojis, numbers, levels (A1–A2, B1–B2 …), prices and currencies (390 SEK, €10,
  $149). Translate unit words around them ("390 SEK / урок" → "390 SEK / lektion").
* Arrows and symbols (→, ≈, ·, ✓).

## Glosses of Swedish examples (blog articles)

The blog often shows a Swedish sentence and then a Ukrainian gloss of it in the
next paragraph. In **en/pl**, translate the gloss into English/Polish. In **sv**,
a gloss would just repeat the Swedish line: write it as a short, natural Swedish
explanation of the meaning or the nuance instead (e.g. "Ungefär: ska vi ses en
stund över en kopp kaffe?"), never a verbatim copy and never Ukrainian. Keep it
as short as the source.

Where an article quotes a **Ukrainian** word or phrase on purpose (to compare
it with Swedish), keep it in Cyrillic and add the meaning in brackets the first
time, e.g. „дякую" (thank you). Otherwise there must be no Cyrillic in the
translation.

## Language quality

* **Swedish**: natural, idiomatic, the way a Swedish teacher would write a
  friendly course website. Correct en/ett, V2 word order, compounds written
  together (no *särskrivningar*), no anglicisms or calques from Ukrainian.
  Swedish quotation marks ”…” (the same mark on both sides), a spaced en dash
  " – " for dashes, decimal comma.
* **English**: British spelling (organise, colour), plain and warm, sentence case
  in headings (not Title Case), curly quotes “…”, spaced en dash " – ".
* **Polish**: natural, idiomatic Polish; beware of Ukrainian–Polish false
  friends and calques; full diacritics; Polish quotation marks „…”; spaced en
  dash " – ".
* Convert Ukrainian «…» quotes to the target language's quotes. Keep the meaning
  of bold/italic emphasis.
* Keep headings, buttons and menu items short. A button stays a verb phrase.
* Use the glossary (`i18n/glossary/<lang>.json`) for every term it lists — the
  same Ukrainian term must read the same way everywhere on the site.

## Context fields

`kind`: `html` = visible text on a page (may contain tags), `attr` = an
attribute (image description, meta description for search engines, form
placeholder) — plain text, no tags, `runtime` = text drawn by JavaScript
(cards, buttons, messages; may be short labels). `context` shows the tag/class
the text sits in (`h1`, `a.btn`, `option`, `span.eyebrow` …) — use it to choose
the right register and length.
