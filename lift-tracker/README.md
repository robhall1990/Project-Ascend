# Lift Tracker

A single-user, on-device PWA for a 20-week upper-body-biased lifting block with
nutrition tracking. React + Vite + TypeScript, Dexie/IndexedDB, Recharts.
Built phase by phase — see the build brief.

## Status

- **Phase 1 — Program & session view (read-only)** ✅
  Seeds the 4-day upper-body program into IndexedDB, computes today's session
  from the program start date + 4-day rotation, and shows each exercise's target
  sets × rep-range for the current phase (Phase 3 auto-drops the main lifts to
  3–5 reps).
- **Phase 2 — Training logging** ✅
  Start / resume / finish / discard a session. Per-set weight, reps and optional
  RPE written straight to IndexedDB as you type; weight carries down from the
  previous set. Adjustable rest timer between sets. History tab lists past
  sessions; tap to reopen and edit. The rotation pointer advances only when a
  session is finished.
- **Phase 3 — Progression engine** ✅
  Double progression per exercise, computed from history: every set at the top
  of the range → suggest +one increment (barbell lower body +5 kg / everything
  else +2.5 kg; ×2 in lb) and reset to the bottom; otherwise hold. Suggestions
  pre-fill the logging inputs. Estimated 1RM (Epley) tracked for the four main
  lifts and shown on the home strength strip. Deload weeks (6/12/18 + taper)
  auto-flag, cut suggested volume to 2 sets, and hold weight.
- **Phase 4 — Training history & progress** ✅
  A Progress tab with a phase timeline (current phase + weeks to year-end), a
  Recharts estimated-1RM trend for the four main lifts (colourblind-validated
  palette, legend), and a per-exercise history view — top-set weight over time
  plus a session-by-session list of the actual sets logged.
- **Phase 5 — Macro targets engine** ✅
  A Fuel tab computing daily macro targets in-app from your own stats: Mifflin–St
  Jeor BMR × activity = maintenance; goal mode (lean gain +10% / recomp /
  maintenance) as a choice; protein 1.6–2.2 g/kg (default 1.8); fat 25% of
  calories (0.8 g/kg floor); carbs the remainder, flexing by day type (lift
  baseline / endurance adds carbs by minutes × intensity / rest trims ~15%).
  Prominent protein-remaining ring plus calorie/carb/fat bars; editable stats
  panel with bodyweight logging. Remaining = target until food logging lands.

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
