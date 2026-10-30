// Rating grid (admin page): the card's GameTora numbers (data/numbers.json,
// made by scripts/card_numbers.py) scored 1 to 5 per criterion, a suggested
// verdict, and where the card stands among its peers. A hint only: nothing
// here is saved.
//
// Criteria (1 → 5):
//   Training eff.   <5% · 5% · 10% · 15% · 20%+      (with what the unique can add)
//   Specialty       0 · 1-39 · 40-59 · 60-79 · 80+
//   Friendship      <20% · 20% · 25% · 30% · 35%+
//   Stats bonus     none 1 · a stat +2 · two stats or more +1 · SP +1 each (max 2)
//   Hints           +1 each: Lv3+, Lv4+, 40%+, 60%+
// Suggested verdict = weighted mean (WEIGHTS). Skills are left out on purpose:
// how much they are worth depends too much on the running style and the CMs.
//
// Peers: the same type of card released within PEER_DAYS; "top 10%" = better
// than 90% of them on the weighted mean.
const NUMBERS = "data/numbers.json";
const WEIGHTS = { te: .3, spe: .3, friend: .15, bonus: .15, hints: .1 };
const PEER_DAYS = 730;
let numbers = null;

export async function loadNumbers() {
  if (numbers) return numbers;
  try {
    const r = await fetch(NUMBERS, { cache: "no-store" });
    numbers = r.ok ? await r.json() : {};
  } catch { numbers = {}; }
  return numbers;
}

/** 1 + how many of the thresholds v reaches. */
const step = (v, cuts) => 1 + cuts.filter(c => v >= c).length;
const STEP_TEXT = { 1: "very low", 2: "low", 3: "okay", 4: "good", 5: "very good" };

function criteria(n) {
  const te = n.te + (n.te_upto ?? 0);
  const stats = n.bonus.filter(([k]) => k !== "SP");
  const sp = Math.min(Object.fromEntries(n.bonus).SP ?? 0, 2);
  const lv = n.hint_lv ?? 0, freq = n.hint_freq ?? 0;
  return [
    { key: "te", label: "Training eff.", score: step(te, [5, 10, 15, 20]),
      value: n.te_upto ? `${n.te}% → up to ${te}%` : `${te}%`, note: n.te_upto ? `${n.te_how} (unique)` : "" },
    { key: "spe", label: "Specialty", score: step(n.spe, [1, 40, 60, 80]), value: String(n.spe) },
    { key: "friend", label: "Friendship", score: step(n.friend, [20, 25, 30, 35]), value: `${n.friend}%` },
    { key: "bonus", label: "Stats bonus", score: Math.min(5, 1 + (stats.length ? 2 : 0) + (stats.length > 1 ? 1 : 0) + sp),
      value: n.bonus.length ? n.bonus.map(([k, v]) => `${k} +${v}`).join(" · ") : "none" },
    { key: "hints", label: "Hints", score: Math.min(5, 1 + (lv >= 3) + (lv >= 4) + (freq >= 40) + (freq >= 60)),
      value: lv || freq ? `Lv${lv} · ${freq}%` : "none" },
  ].map(c => ({ ...c, grade: STEP_TEXT[c.score] }));
}

const mean = rows => rows.reduce((a, c) => a + c.score * WEIGHTS[c.key], 0);
const clamp = x => Math.min(5, Math.max(1, Math.round(x)));
const days = (a, b) => Math.abs(Date.parse(a) - Date.parse(b)) / 864e5;

/** Mean score of a card from its numbers. */
export const strength = n => mean(criteria(n));

/**
 * Grid for support card `it`, compared with the cards in `all` (support.json)
 * using `nums` (numbers.json). Null without numbers.
 */
export function gridFor(it, all, nums) {
  const n = nums[it.id];
  if (!n) return null;
  const rows = criteria(n);
  const raw = mean(rows);
  const peers = all.filter(c => c.type === it.type && c.id !== it.id && nums[c.id] && days(c.iso, it.iso) <= PEER_DAYS)
    .map(c => strength(nums[c.id]));
  const below = peers.filter(s => s < raw).length + peers.filter(s => s === raw).length / 2;
  const share = peers.length ? below / peers.length : null;        // 0 = weakest, 1 = strongest
  return {
    rows, raw, score: clamp(raw),
    peers: peers.length, share,
    peerScore: share == null ? null : 1 + Math.min(4, Math.floor(share * 5)),
    skills: n.skills.filter(s => s.gold),
    years: PEER_DAYS / 365,
  };
}
