# Deploying the Lift Tracker

The Lift Tracker is a Vite app, so it must be **built** (`npm run build` → `dist/`)
before it can be hosted — unlike the plain-HTML Project Ascend app. A GitHub
Actions workflow (`.github/workflows/deploy-lift-tracker.yml`) does this
automatically on every push to `claude/lift-tracker-app-v2-btl7dw`.

## One-time repo setup

1. **Enable Pages via Actions**
   Repo → **Settings → Pages** → *Build and deployment* → **Source: GitHub
   Actions**.

2. **Allow this branch to deploy** (only needed because we deploy from a feature
   branch, not `main`)
   Repo → **Settings → Environments → `github-pages`** → *Deployment branches
   and tags* → add `claude/lift-tracker-app-v2-btl7dw` (or choose "All
   branches"). Without this, the deploy step fails with an
   "environment protection rules" error.

3. Push any commit to the branch (or **Actions → Deploy Lift Tracker → Run
   workflow**). When it finishes, the URL appears in the workflow's **deploy**
   job summary — typically:

   ```
   https://robhall1990.github.io/Project-Ascend/
   ```

> This repo has a single GitHub Pages site, so publishing the Lift Tracker
> replaces the old Project Ascend page there. The Project Ascend files remain in
> the repo and its git history.

## Install on your phone

Open the Pages URL in **Chrome (Android)** or **Safari (iOS)** → menu → **Add to
Home screen**. HTTPS (which Pages provides) is required for install + offline.

## See it without deploying

```bash
cd lift-tracker
npm install
npm run dev      # http://localhost:5173
```
