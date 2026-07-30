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
- **Phase 6 — Food logging** ✅
  Log food into meal slots (pre/post-training, breakfast/lunch/dinner/snack) via
  a bottom sheet: one-tap saved foods (per-100g, adjustable grams) and saved
  meals, or manual entry with a "save as reusable" toggle. Running totals update
  the Fuel rings/bars live; entries are listed per slot and deletable; a slot's
  entries can be saved as a one-tap Meal. Over-target reads "0 left" (never a
  failure state). Photo estimation intentionally deferred.
- **Phase 7 — Training-day nutrition guidance** ✅
  Contextual fuelling cards on the Today screen, driven by the day type: a
  pre-lift carb prompt (flags when little has been logged), a post-lift protein
  prompt (framed as "over the next few hours", not the overstated 30-min
  window), and an in-session carb prompt for endurance sessions ≥90 min. Cards
  progress pre→post, auto-dismiss once the relevant slot is logged, and have a
  manual dismiss remembered for the day. A card's action jumps to Fuel with the
  log sheet already open at the right slot.
- **Phase 8 — Meal suggestions** ✅
  Rules-based suggestions over the user's own saved Meals: filtered to those that
  fit today's remaining calorie/carb/fat headroom (protein may overshoot, since
  hitting protein is the goal) and ranked by protein density, each one-tap
  loggable. (Herbi/Mealio was checked as a suggestion source but is a family
  dinner planner with no per-recipe macros, so it isn't reused.)
- **Phase 9 — Combined progress view** ✅
  The payoff screen: bodyweight, a strength index (sum of the four main lifts'
  estimated 1RM) and weekly-average protein, plotted as three stacked mini-charts
  sharing one weekly x-axis over the 20 weeks — so the relationship between eating
  enough, lifting consistently and getting stronger is visible in one place.

All nine phases from the build brief are complete.

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
