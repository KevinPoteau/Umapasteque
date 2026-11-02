// Rating grid (admin page): the card's GameTora numbers (data/numbers.json,
// made by scripts/card_numbers.py) scored 1 to 5 per criterion, a suggested
// verdict, and where the card stands among its peers. A hint only: nothing
// here is saved.
//
// One point ≈ what 5% Training eff. brings. Each criterion starts at 1 and
// goes past 5 when the card does better (shown as red dots, up to 10);
// fractions are rounded up.
//   Training eff.   +1 per 5% (with what the unique can add), +1 per 30% Mood:
//                   at Great mood, 30% Mood bonus gives about what 5% does
//   Friendship      20% 2 · 25% 3 · 30% 4 · 35% 5 · then +1 per 5%
//   Specialty       0 1 · 1-39 2 · 40 3 · 60 4 · 80 5 · then +1 per 20
//   Stats bonus     +1 per bonus point, stats and SP alike (Speed +2 → 3)
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

const MAX = 10;
const up = x => Math.max(0, Math.ceil(x));
const STEP_TEXT = { 1: "very low", 2: "low", 3: "okay", 4: "good", 5: "very good" };

function criteria(n) {
  const te = n.te + (n.te_upto ?? 0);
  const bonus = n.bonus.reduce((a, [, v]) => a + v, 0);
  const lv = n.hint_lv ?? 0, freq = n.hint_freq ?? 0;
  const mood = up((n.mood ?? 0) / 30);
  return [
    { key: "te", label: "Training eff.", score: 1 + up(te / 5) + mood,
      value: n.te_upto ? `${n.te}% → up to ${te}%` : `${te}%`,
      note: [n.te_upto ? `${n.te_how} (unique)` : "", mood ? `+${mood} from Mood` : ""].filter(Boolean).join(" · ") },
    { key: "mood", label: "Mood", score: mood, value: `${n.mood ?? 0}%`, note: mood ? "Counted in Training eff.: +1 per 30% (rounded up)" : "" },
    { key: "friend", label: "Friendship", score: 1 + up((n.friend - 15) / 5), value: `${n.friend}%` },
    { key: "spe", label: "Specialty", score: n.spe ? 2 + up((n.spe - 39) / 20) : 1, value: String(n.spe) },
    { key: "bonus", label: "Stats bonus", score: 1 + bonus,
      value: n.bonus.length ? n.bonus.map(([k, v]) => `${k} +${v}`).join(" · ") : "none" },
    { key: "hints", label: "Hints", score: Math.min(5, 1 + (lv >= 3) + (lv >= 4) + (freq >= 40) + (freq >= 60)),
      value: lv || freq ? `Lv${lv} · ${freq}%` : "none" },
  ].map(c => ({ ...c, score: Math.min(MAX, c.score), grade: STEP_TEXT[Math.min(5, c.score)] ?? "" }));
}

const mean = rows => rows.reduce((a, c) => a + c.score * (WEIGHTS[c.key] ?? 0), 0);
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
