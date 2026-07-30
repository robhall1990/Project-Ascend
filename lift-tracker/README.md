# Lift Tracker

A single-user, on-device PWA for a 20-week upper-body-biased lifting block with
nutrition tracking. React + Vite + TypeScript, Dexie/IndexedDB, Recharts.
Built phase by phase — see the build brief.

## Status

- **Phase 1 — Program & session view (read-only)** ✅
  Seeds the 4-day upper-body program into IndexedDB, computes today's session
  from the program start date + 4-day rotation, and shows each exercise's target
  sets × rep-range for the current phase (Phase 3 auto-drops the main lifts to
  3–5 reps). No logging yet.

## Develop

```bash
cd lift-tracker
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build to dist/
npm run typecheck
```

Program seed data lives in `src/data/program.ts`, transcribed verbatim from
`upper-body-training-program.md`. Reset the app's data by clearing the
`lift-tracker` IndexedDB database in devtools.
