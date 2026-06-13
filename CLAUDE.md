# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`thameen-landing` is the web property for Omar's **ثَمين / Thameen** brand (a 90-day video-editing
course). It's a **static, no-build site** — plain HTML/CSS/vanilla JS — deployed on **GitHub Pages**
(`omarthamen/thameen-landing`, branch `main`), fronting a **Supabase** backend (project ref
`hwzpjxxfdqsjymxbjokv`). There is no bundler, framework, package.json, or test suite. Editing a file
and pushing to `main` deploys it.

> This repo is one of several projects under `/Users/omar`. The home-directory `CLAUDE.md` describes
> the sibling projects (WhatsApp bridge, bots, Remotion videos); this file governs `thameen-landing` only.

## Three surfaces

The site is three independent single-page apps that share the brand CSS and a hand-rolled Supabase
REST layer — they do **not** share a router or build.

1. **Landing** — `index.html` + `main.js` (gallery/lightbox + main video scrubber), `gallery.js`,
   `reviews.js`, `styles.css`. Public marketing page → drives traffic to thameen.shop.
2. **Academy** — `academy.html` + `academy.js` + `academy.css`. Logged-in subscriber course platform:
   sections → lessons (Bunny-hosted video), per-lesson timestamped notes, progress, community chat
   channels, group calls (Jitsi, opened in a **new tab** — embedding hits a 5-min limit), notifications,
   and a "coming soon" tools panel (`SOON_TOOLS` / `comingSoonFolder()` in `academy.js`, shown only in
   the "pro" section detected by title via `isProSection`).
3. **Admin** — `admin.html` + `admin.js` + `admin.css`. Dashboard for `omarthamen@gmail.com`: manages
   site content, media uploads, reviews moderation, and subscribers. Lessons are added per section
   (course) including a bulk box parsing `Section | Lesson title | Bunny embed` lines.

## Architecture & conventions you must respect

- **Direct Supabase REST, never `supabase-js`.** Every app defines its own `SUPABASE_URL`,
  publishable `SUPABASE_KEY`, and helpers `fetchT` (fetch with abort timeout), `authHeaders`,
  `dbGet`, `dbSend`. This is deliberate: `supabase-js`'s `signInWithPassword` hangs in Safari via
  `navigator.locks`. Do **not** introduce the library — extend the REST helpers instead.
- **RLS does the authorization.** Tables enable row-level security; reads are public on landing tables
  (`reviews`, `media`, `site_content`) and authenticated-only on academy tables (`sections`, `lessons`,
  `progress`, `members`, `profiles`, `notes`, `community_messages`, ...). Admin-only writes are gated
  by `auth.jwt()->>'email' = 'omarthamen@gmail.com'`. The publishable key in client JS is expected —
  it's the anon key; privileges come from RLS + the user's JWT (`TOKEN`).
- **Privileged actions go through the Edge Function** `supabase/functions/create-subscriber/index.ts`.
  It uses the service-role key server-side and verifies the caller is the admin email before
  create/suspend/delete subscriber or `reset_device`. Anything needing the service role belongs here,
  not in client JS.
- **Bunny video + referrer/DRM.** Lessons embed `iframe.mediadelivery.net/embed/<lib>/<guid>`.
  Bunny libraries restrict playback to **allowed referrers** — a plain embed returns 403/black off-domain.
  Add the site's domains (thameen.shop, the Pages domain) in Bunny → Stream → library → Security; if token
  DRM is on, a token-signer is required. Academy uses player.js for an anti-skip view counter.
- **Single brand source.** All colors/fonts live in `styles.css :root` and mirror the Remotion
  `brand.ts` in the sibling `remotion-landing` project. Everything is Arabic **RTL**, IBM Plex Sans Arabic.
  Preserve Arabic copy exactly; don't transliterate.
- **Generated files — don't hand-edit.** `gallery.js` and `reviews.js` carry a "مولّد تلقائيًا" header
  and are overwritten by their `.command` scripts.
- **Cache busting.** Assets are referenced with `?v=N` (e.g. `styles.css?v=22`); bump N when changing a
  cached asset. Safari caches HTML aggressively — see the `[[github-pages-cache-busting]]` note.

## Commands

This is a static site — "build" = none, "test" = open it in a browser.

- **Run locally:** open `index.html` directly, or `python3 -m http.server 8000` then visit localhost.
- **Regenerate gallery:** double-click `update-gallery.command` (scans `assets/images/`, sorts
  alphabetically — name files `01.jpg`, `02.jpg`… to control order — rewrites `gallery.js`).
- **Refresh testimonials:** double-click `update-reviews.command` (pulls live store comments from
  `thameen.shop/api/comments`, keeps 5-star/non-complaint, rewrites `reviews.js`).
- **Deploy:** `git add -A && git commit -m "…" && git push` → GitHub Pages serves `main`.
- **Provision DB (one-time / on schema change):** paste `supabase-setup.sql` then `academy-setup.sql`
  into the Supabase SQL Editor and Run.
- **Deploy Edge Function:** `supabase functions deploy create-subscriber` (needs `SUPABASE_URL`,
  `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` set as function secrets).
