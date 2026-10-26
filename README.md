# Project Ascend

The active app here is **Lift Tracker** — a personal strength training and
nutrition coaching PWA, deployed to GitHub Pages via a GitHub Actions
workflow (`.github/workflows/deploy-lift-tracker.yml`), not a classic
branch-based Pages deploy.

See [`lift-tracker/README.md`](lift-tracker/README.md) for what it does, and
[`lift-tracker/DEPLOY.md`](lift-tracker/DEPLOY.md) for deployment setup.

**Repo → Settings → Pages → Source must stay set to "GitHub Actions."**
Switching it to "Deploy from a branch" re-enables GitHub's legacy Jekyll
build, which will silently overwrite the deployed app — this is what
clobbered the previous deployment.

The original "Project Ascend" high-performer tracker that used to live at
the repo root has been retired; its code remains in git history and on the
`claude/high-performer-tracking-app-0p0mk7` branch.
