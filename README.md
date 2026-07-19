# Will It Plane — Website

The official landing page for **Will It Plane**, a live-content entertainment brand where viewers choose an object and we plane it.

Live site: [https://www.willitplane.com](https://www.willitplane.com)

---

## What this site does

- Link-in-bio style landing page with all social and streaming platform links.
- Interactive HTML5 Canvas particle effects (sawdust, chips, sparks).
- Click-to-destroy "Will It Plane?" headline animation.
- Countdown timer to the first video release on **August 7, 2026**.
- Object suggestion form that posts to a Discord webhook.
- Safety disclaimer.
- Effects toggle so visitors can reduce motion if they prefer.

---

## Hosting

This site is hosted for free on **GitHub Pages** with a custom domain through **Porkbun** DNS.

- Repository: `Anoforge/willitplane_website`
- Branch deployed: `main`
- Root folder: `/`
- Custom domain: `www.willitplane.com`
- HTTPS: enforced

---

## File structure

| File | Purpose |
|------|---------|
| `index.html` | Main landing page, styles, and countdown markup |
| `effects.js` | Canvas particle system, text destruction animation, form handling, effects toggle |
| `WIP_logo_hazard.png` | Brand logo used on the site and as favicon |
| `wip_logo.png` | Alternate logo, currently unused |
| `CNAME` | Tells GitHub Pages to serve `www.willitplane.com` |
| `README.md` | This file |

---

## How to make changes

1. Edit the files locally in this repo.
2. Stage your changes:
   ```bash
   git add -A
   ```
3. Commit:
   ```bash
   git commit -m "Describe your change"
   ```
4. Push to GitHub:
   ```bash
   git push
   ```

GitHub Pages will rebuild and deploy automatically within a minute or two.

---

## Updating content

### Social links
Edit the `<nav class="links">` section in `index.html`.

### Countdown date
The release date is set in `index.html` near the bottom:

```js
const target = new Date('2026-08-07T16:00:00Z');
```

`2026-08-07T16:00:00Z` is August 7, 2026 at 12:00 PM EDT (UTC-4). Adjust as needed.

### Logo
Replace `WIP_logo_hazard.png` with a new file of the same name, then commit and push.

### Suggestion form
The form posts to a Discord webhook configured in `effects.js`.

---

## Security notes

- This is a static site with no backend or database.
- The suggestion form uses a Discord webhook with client-side validation and rate limiting.
- Client-side protections are in place:
  - Empty submissions are blocked.
  - Object names are limited to 120 characters.
  - Notes are limited to 500 characters.
  - Each browser is limited to **3 submissions per day** using `localStorage`.
- If spam becomes a problem, regenerate the Discord webhook URL or move form handling behind a free serverless function (Cloudflare Workers / Vercel Functions).

---

## Accessibility

- Respects `prefers-reduced-motion` — canvas effects are disabled for users who prefer reduced motion.
- Visitors can also turn particle effects off with the **Effects: on/off** button.
- Semantic HTML and ARIA labels are used throughout.

---

## License / ownership

© 2026 Will It Plane. All rights reserved.
