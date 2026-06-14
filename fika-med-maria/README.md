# ☕ Fika med Maria

A warm, Swedish-*fika*-themed landing page — built to invite people to slow down,
grab a coffee, and join the next gathering.

It's a single static page (no build step, no dependencies), so it runs anywhere
and deploys in minutes.

## Files

| File | What it is |
|------|------------|
| `index.html` | The page markup and copy (in Swedish — easy to edit) |
| `styles.css` | All styling: warm fika palette, responsive layout, animated coffee cup |
| `script.js` | Footer year + signup form handling (demo, see below) |

## Run it locally

No tooling required — just open the file:

```bash
# from this folder
open index.html        # macOS
xdg-open index.html    # Linux
```

Or serve it (nicer for testing):

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Customize

- **Copy & sections** — edit `index.html`. Each section is clearly labelled
  (`HERO`, `ABOUT`, `WHAT TO EXPECT`, `JOIN`).
- **Colors** — change the CSS variables at the top of `styles.css` (`:root`).
- **Fonts** — swap the Google Fonts link in `index.html` (`Fraunces` + `Inter`).

## Hooking up the signup form

Right now `script.js` only validates the email and stores it in `localStorage`
as a placeholder — nothing is sent anywhere yet. To actually collect emails,
pick one:

- **Formspree** — set `<form action="https://formspree.io/f/your-id" method="POST">`
  and remove the `event.preventDefault()` demo handler.
- **Buttondown / Mailchimp** — paste their embed form in the `#join` section.
- **Your own API** — `fetch()` POST the email to your endpoint inside the submit handler.

## Deploy

This is a static site, so any of these work with zero config:

- **Vercel** — `vercel` (or import the repo at vercel.com). No framework preset needed.
- **Netlify** — drag-and-drop this folder, or connect the repo.
- **GitHub Pages** — Settings → Pages → deploy from branch.

---

Made with warmth. 🫶
