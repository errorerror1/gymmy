# Deploy to Vercel

One-time setup, then every `git push` auto-deploys.

## 1. Put the code on GitHub

```bash
cd /Users/errorerror_/code/gymmy/GymTracker
git init                            # if not already a repo
git add .
git commit -m "GymTracker ready for deploy"
```

Create an empty repo on github.com (no README / .gitignore — you already have them),
then wire it up:

```bash
git remote add origin git@github.com:<your-username>/gymtracker.git
git branch -M main
git push -u origin main
```

## 2. Import to Vercel

1. Go to https://vercel.com/new and sign in with GitHub.
2. Pick the `gymtracker` repo you just pushed. Click **Import**.
3. On the config screen:
   - **Framework Preset**: "Other" (Vercel will auto-read `vercel.json`)
   - **Root Directory**: leave blank (the repo root *is* the project)
   - **Build Command** and **Output Directory**: already set in `vercel.json`,
     nothing to change.
4. Click **Deploy**. First build takes ~2 minutes.

You'll get a URL like `gymtracker-xxxx.vercel.app`. That's your app.

## 3. Custom domain (optional, later)

Project → Settings → Domains → Add. Vercel walks you through the DNS records.

## 4. Every subsequent change

```bash
git add -p           # stage what you want to ship
git commit -m "..."
git push
```

Vercel picks up the push, runs `npm run build`, and redeploys. Preview
deployments are made automatically for branches other than `main`.

## Updating the service worker cache

GymTracker caches its JS and assets in the browser so it works offline.
When you push code changes the app **will** update, but you want to be
sure users don't get stuck on an old version. The simple rule:

> Whenever you deploy a shippable change, bump `CACHE_VERSION` in
> `public/service-worker.js` (e.g. `'v2'` → `'v3'`).

The worker's `activate` handler deletes caches with the old version
automatically, so users get fresh assets on their next visit.

## Backing up your data

The app is local-only — your workouts live in the browser's storage for
the domain you visit (`gymtracker-xxxx.vercel.app`). To move data across
devices/browsers:

1. On the old device: **Settings → Backup → Export**. You'll get a
   `gymtracker-backup-<date>.json` file.
2. On the new device: open the same URL, then **Settings → Backup →
   Import**, pick the JSON.

Clearing browser data for the site wipes everything, so export
occasionally.

## Local development

```bash
npm install
npm run web        # opens in browser with hot reload
```

Other useful scripts:

- `npm run build` — produce the production bundle in `dist/`
- `npm run typecheck` — run the TypeScript compiler without emitting
