# Word Catch

A tiny PWA for growing your English vocabulary: catch a new word during the day,
save it in one tap — with your own Hebrew translation and example sentence, or
leave either blank and the server fills it in automatically — and get it
pushed back to you later. Practice everything in a flashcard mode that works
fully offline.

## How your data is stored

- Your word list lives in **IndexedDB on your phone** — that's the source of
  truth, and Practice mode only ever reads from there, offline included.
- A copy of each word (word + translation + sentence) is also written to a
  small free cloud store (Vercel KV) **only** so the notification job has
  something to pick from when your phone isn't open. There's no account
  system and no analytics — just that one mirror, used solely to power push.

## One-time setup

1. **Push this folder to a new GitHub repo.**
2. **Import the repo into Vercel** (vercel.com → Add New → Project → import
   from GitHub). Framework preset: "Other". No build command needed.
3. **Add a KV store**: in the Vercel project → Storage tab → Create Database
   → KV → connect it to this project. Vercel sets the required `KV_*` env
   vars automatically.
4. **Generate VAPID keys** (used to sign push notifications). On any machine
   with Node installed, run:
   ```bash
   npx web-push generate-vapid-keys
   ```
   This prints a public and a private key.
5. **Set environment variables** in Vercel project → Settings → Environment
   Variables:
   - `VAPID_PUBLIC_KEY` — the public key from step 4
   - `VAPID_PRIVATE_KEY` — the private key from step 4
   - `NOTIFY_SECRET` — any random string you make up (protects the notify
     endpoint from strangers triggering it)
6. **Deploy.** Vercel will give you a URL like `https://word-catch.vercel.app`.

## Install it on your iPhone

1. Open your Vercel URL in **Safari** (not Chrome — iOS push only works
   through Safari's PWA install).
2. Tap the Share icon → **Add to Home Screen**.
3. Open the app **from the Home Screen icon** (not the Safari tab) — this is
   required for push notifications to work on iOS.
4. Tap **"Enable notifications"** and allow notifications when prompted. The
   same button turns into **"Disable notifications"** afterwards — tap it
   again any time to stop notifications on that device (this cleanly removes
   the subscription both locally and from the server, no need to dig through
   browser settings).

## How word selection works

Each notify run picks **one word per device**, chosen from whichever of your
saved words aren't categorized "Mastered" (see below), preferring whichever
one hasn't been sent in the longest time — a fair rotation, not a random
draw, so every word gets equal air time instead of the same ones repeating
by chance.

## Categorizing words — Still learning / Medium / Mastered

Every word is in one of three categories. There are two ways to set it:

1. **While practicing**: after you reveal a card, grade yourself with one of
   three buttons — **"Still learning"**, **"Medium"**, or **"I know this"**.
   Whichever you tap becomes that word's new category immediately (no streak
   to build up — one tap is enough to move it).
2. **From the Words tab**: a dedicated screen listing every word grouped
   under its category, each with a dropdown to reassign it any time. This is
   the place to go back and move a word you thought you'd mastered weeks ago
   back to "Still learning" if you find you've actually forgotten it — or to
   deliberately park a word at "Medium" if it's not quite hard but not quite
   easy either.

What the category affects:

- **Mastered** words are excluded from push notifications entirely (no point
  being reminded of a word you already know), and show up in Practice only
  occasionally (about 1 in 5 sessions) so they don't fade from memory
  completely.
- **Still learning** and **Medium** words are both included in every Practice
  session at full frequency, and are both eligible for push notifications —
  "Medium" is purely an organizational middle ground for the Words tab, it
  doesn't reduce anything on its own.

## Schedule the notifications (free)

Vercel's own free cron tier only allows once-a-day jobs per cron entry, so
instead use a free external scheduler to hit the notify endpoint whenever you
want during the day:

1. Create a free account at [cron-job.org](https://cron-job.org) (or any
   similar free scheduler).
2. Create 2–3 jobs, each calling:
   ```
   https://<your-app>.vercel.app/api/notify?secret=<your NOTIFY_SECRET>
   ```
   at whatever times you like — for example 10:00, 15:00, and 20:00.

**This is also how you control when notifications can happen at all** —
if you never schedule a trigger between, say, 23:00 and 08:00, nothing can
fire then, full stop. As a safety net in case a trigger ever lands in that
window anyway (e.g. a scheduler misfire), `/api/notify` also enforces its own
quiet hours — by default 23:00–08:00 in Asia/Jerusalem time, skipping the
whole run silently if called inside that window. Override with the
`QUIET_HOURS_START`, `QUIET_HOURS_END` (24h, 0–23) and `NOTIFY_TIMEZONE`
(IANA name, e.g. `Asia/Jerusalem`) environment variables in Vercel if you
want different hours.

Tapping the notification opens the app straight into Practice mode with that
word first.

## Notification permission on your computer vs. your iPhone

Enabling notifications works from *any* browser you open the app in — your
computer's Chrome included — because each browser/device generates its own
separate subscription (tracked by its own local device ID). If you tested
"Enable notifications" on your computer while trying things out, that
created a real, independent subscription for your computer, separate from
your phone's. To stop it:

- Easiest: open the app on that computer and tap **"Disable notifications"**
  (now a working toggle, see above) — this removes it from the server too.
- Or, browser-level: click the padlock/site-info icon next to the address
  bar → Notifications → Block (or your browser's site settings page → find
  the site → remove/block it). If the in-app toggle isn't used, a revoked
  browser permission still causes the *next* push attempt to fail, and the
  server automatically deletes that dead subscription at that point — so it
  cleans itself up within one notification cycle either way.

## Local development

Node isn't required to deploy (Vercel builds it for you), only if you want to
run things locally:

```bash
npm install
npm run dev   # requires the Vercel CLI: npm i -g vercel
```

## Replacing the placeholder icon

`icons/icon-180.png`, `icon-192.png`, and `icon-512.png` are solid-color
placeholders (generated by `scripts/generate-placeholder-icons.js`) so the
app is installable immediately. Swap them for real artwork whenever you like
— same filenames, same sizes.
