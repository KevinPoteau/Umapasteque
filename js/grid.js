// Rating grid (admin page): a checklist read from the card's GameTora numbers
// (data/numbers.json, made by scripts/card_numbers.py) and a suggested
// verdict out of 5. It is a hint only: nothing here is saved.
//
// Scales:
//   Training eff.      0% bad · 5% low · 10% good · 15%+ high
//   Specialty          0 very bad · <40 low · 40-59 okay · 60-79 high · 80+ very high
//   Stats bonus        any stat good · SP very good
//   Friendship         higher is better (it lines up with the ratings)
//   Mood               shown, not scored: it does not line up with the ratings
//   Skills (gold)      Current Speed very good · late Acceleration very good ·
//                      Target speed okay · Acceleration at another time very bad
//
// Points were tuned on the cards rated so far (see the pull request that added
// this file): about 4 in 10 suggestions match the verdict, 9 in 10 are within 1.
const NUMBERS = "data/numbers.json";
let numbers = null;

export async function loadNumbers() {
  if (numbers) return numbers;
  try {
    const r = await fetch(NUMBERS, { cache: "no-store" });
    numbers = r.ok ? await r.json() : {};
  } catch { numbers = {}; }
  return numbers;
}

const BASE = 0.6;
const level = (v, steps) => steps.findLastIndex(s => v >= s);

function te(v) {
  const i = Math.max(0, level(v, [0, 5, 10, 15]));
  return { label: "Training eff.", value: `${v}%`, grade: ["bad", "low", "good", "high"][i], pts: [0, .2, .4, .6][i] };
}

function spe(v) {
  const i = v <= 0 ? 0 : level(v, [0, 1, 40, 60, 80]);
  return { label: "Specialty", value: String(v), grade: ["very bad", "low", "okay", "high", "very high"][i], pts: [0, .25, .5, .75, 1][i] };
}

function bonus(rows) {
  const b = Object.fromEntries(rows);
  const stats = rows.filter(([k]) => k !== "SP");
  const sp = Math.min(b.SP ?? 0, 2);
  const value = rows.length ? rows.map(([k, v]) => `${k} +${v}`).join(" · ") : "none";
  const grade = sp ? "very good" : stats.length ? "good" : "bad";
  return { label: "Stats bonus", value, grade, pts: (stats.length ? .4 : 0) + .25 * sp };
}

function friend(v) {
  const pts = Math.max(-.35, Math.min(.5, (v - 25) / 10 * .35));
  const grade = v >= 35 ? "high" : v >= 30 ? "good" : v >= 25 ? "okay" : "low";
  return { label: "Friendship", value: `${v}%`, grade, pts };
}

function mood(v) {
  return { label: "Mood", value: `${v}%`, grade: "not scored", pts: 0, note: "Does not line up with the ratings so far" };
}

/** One gold skill → its grade. */
export function skillGrade(s) {
  if (s.kind === "cs") return { grade: "very good", pts: 2, what: `Current Speed +${s.value.toFixed(2)}` };
  if (s.kind === "accel" && s.late) return { grade: "very good", pts: 1.25, what: `Accel +${s.value.toFixed(2)}, late` };
  if (s.kind === "accel") return { grade: "very bad", pts: 0, what: `Accel +${s.value.toFixed(2)}, too early` };
  if (s.kind === "ts") return { grade: "okay", pts: .35, what: `Target speed +${s.value.toFixed(2)}` };
  if (s.kind === "recovery") return { grade: "not scored", pts: 0, what: `Recovery ${s.value.toFixed(1)}%` };
  return { grade: "not scored", pts: 0, what: "Other effect" };
}

/** {rows, skills, score, raw} for a support card, or null without numbers. */
export function gridFor(n) {
  if (!n) return null;
  const rows = [te(n.te), spe(n.spe), bonus(n.bonus), friend(n.friend), mood(n.mood)];
  const skills = n.skills.filter(s => s.gold).map(s => ({ ...s, ...skillGrade(s) }));
  const best = Math.max(0, ...skills.map(s => s.pts));
  const raw = BASE + rows.reduce((a, r) => a + r.pts, 0) + best;
  return { rows, skills, best, raw, score: Math.min(5, Math.max(1, Math.round(raw))) };
}
