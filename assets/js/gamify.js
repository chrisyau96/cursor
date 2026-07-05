// Gamification engine: credits, XP, levels/identities, penalties,
// 100%/80% streaks, gift redemption, and the buffet milestone.
// Everything derivable is recomputed from records so editing history stays consistent.
import {
  activeHabits, scheduledHabits, isComplete, dayCompletion,
  firstTrackedDate, redemptionsTotal, getWallet, addRedemption, setBuffetClaim,
} from "./store.js";
import { todayISO, addDaysISO, daysBetween } from "./utils.js";

// Each level maps to an identity you are "voting" for.
export const IDENTITIES = [
  "The Beginner",     // 1
  "The Starter",      // 2
  "The Riser",        // 3
  "The Consistent",   // 4
  "The Disciplined",  // 5
  "The Committed",    // 6
  "The Relentless",   // 7
  "The Champion",     // 8
  "The Master",       // 9
  "The Legend",       // 10+
];

// Cumulative XP required to REACH each level.
const LEVEL_XP = [0, 300, 800, 1500, 2500, 4000, 6000, 8500, 11500, 15000];
const XP_STEP_AFTER = 4000; // per level beyond the table

// Reward rules (documented in the UI).
export const RULES = {
  creditFull: 10,   // HK$ for a 100% day
  creditHalf: 2,    // HK$ for a 50-99% day
  xpPerHabit: 10,   // XP per completed habit instance
  xpBonusFull: 30,  // XP bonus for a 100% day
  xpBonusHigh: 10,  // XP bonus for an 80-99% day
  penaltyCredit: 5, // HK$ lost per pair of consecutive 0% days
  penaltyXp: 30,    // XP lost per pair of consecutive 0% days
  buffetDays: 30,   // consecutive 80%+ days to unlock the buffet
  buffetThreshold: 0.8,
};

// Gifts you can buy with credits. Buffet is a special milestone (see below).
export const GIFTS = [
  { id: "snack", icon: "🍫", name: "Snack treat", cost: 20, tag: "Leisure" },
  { id: "coffee", icon: "☕", name: "Coffee break", cost: 30, tag: "Leisure" },
  { id: "movie", icon: "🎬", name: "Movie ticket", cost: 80, tag: "Leisure" },
  { id: "book", icon: "📚", name: "New book", cost: 120, tag: "Gadget" },
  { id: "gadget", icon: "🎧", name: "Gadget accessory", cost: 150, tag: "Gadget" },
  { id: "splurge", icon: "🎮", name: "Leisure splurge", cost: 250, tag: "Gadget" },
];

export function levelFromXp(xp) {
  let level = 1;
  for (let i = 0; i < LEVEL_XP.length; i++) {
    if (xp >= LEVEL_XP[i]) level = i + 1;
  }
  if (xp >= LEVEL_XP[LEVEL_XP.length - 1]) {
    const extra = Math.floor((xp - LEVEL_XP[LEVEL_XP.length - 1]) / XP_STEP_AFTER);
    level = LEVEL_XP.length + extra;
  }
  const curFloor = xpForLevel(level);
  const nextFloor = xpForLevel(level + 1);
  return {
    level,
    identity: IDENTITIES[Math.min(level - 1, IDENTITIES.length - 1)],
    xp,
    floor: curFloor,
    next: nextFloor,
    intoLevel: xp - curFloor,
    span: nextFloor - curFloor,
    progress: (xp - curFloor) / (nextFloor - curFloor),
  };
}

function xpForLevel(level) {
  if (level <= LEVEL_XP.length) return LEVEL_XP[level - 1];
  return LEVEL_XP[LEVEL_XP.length - 1] + (level - LEVEL_XP.length) * XP_STEP_AFTER;
}

// Walk every tracked day once and aggregate all gamification numbers.
export function computeStats() {
  const today = todayISO();
  let date = firstTrackedDate();
  let earnedCredits = 0;
  let earnedXp = 0;
  let zeroRun = 0;
  let penaltyPairs = 0;
  let longest100 = 0;
  let run100 = 0;
  let perfectDays = 0;
  let activeDays = 0;
  let guard = 0;

  while (date <= today && guard++ < 4000) {
    const sched = scheduledHabits(date);
    if (sched.length === 0) { date = addDaysISO(date, 1); continue; }
    activeDays++;
    const { done, ratio } = dayCompletion(date);

    earnedXp += done * RULES.xpPerHabit;
    if (ratio >= 1) { earnedXp += RULES.xpBonusFull; earnedCredits += RULES.creditFull; perfectDays++; }
    else if (ratio >= 0.8) earnedXp += RULES.xpBonusHigh;
    if (ratio >= 0.5 && ratio < 1) earnedCredits += RULES.creditHalf;

    if (ratio <= 0) {
      zeroRun++;
      if (zeroRun % 2 === 0) penaltyPairs++;
    } else {
      zeroRun = 0;
    }

    if (ratio >= 1) { run100++; longest100 = Math.max(longest100, run100); }
    else run100 = 0;

    date = addDaysISO(date, 1);
  }

  const penaltyCredits = penaltyPairs * RULES.penaltyCredit;
  const penaltyXp = penaltyPairs * RULES.penaltyXp;
  const netXp = Math.max(0, earnedXp - penaltyXp);
  const spent = redemptionsTotal();
  const balance = Math.max(0, earnedCredits - penaltyCredits - spent);

  return {
    earnedCredits,
    penaltyCredits,
    penaltyPairs,
    spent,
    balance,
    earnedXp,
    penaltyXp,
    netXp,
    longest100,
    perfectDays,
    activeDays,
    current80Streak: currentHighStreak(RULES.buffetThreshold),
    level: levelFromXp(netXp),
    buffet: buffetStatus(),
  };
}

// Consecutive days (ending today) whose completion ratio >= threshold.
export function currentHighStreak(threshold) {
  const today = todayISO();
  let date = today;
  let streak = 0;
  let guard = 0;
  const start = firstTrackedDate();
  while (date >= start && guard++ < 4000) {
    const sched = scheduledHabits(date);
    if (sched.length === 0) { date = addDaysISO(date, -1); continue; }
    const { ratio } = dayCompletion(date);
    if (ratio >= threshold) streak++;
    else break;
    date = addDaysISO(date, -1);
  }
  return streak;
}

export function buffetStatus() {
  const wallet = getWallet();
  const streak = currentHighStreak(RULES.buffetThreshold);
  const last = wallet.lastBuffetClaim;
  const cooldownOver = !last || daysBetween(last, todayISO()) >= RULES.buffetDays;
  return {
    streak,
    needed: RULES.buffetDays,
    eligible: streak >= RULES.buffetDays && cooldownOver,
    lastClaim: last,
    progress: Math.min(1, streak / RULES.buffetDays),
  };
}

// Attempt to redeem a gift; returns true on success.
export function redeemGift(gift) {
  const { balance } = computeStats();
  if (balance < gift.cost) return false;
  addRedemption({ item: gift.name, icon: gift.icon, cost: gift.cost, type: "gift" });
  return true;
}

export function claimBuffet() {
  const status = buffetStatus();
  if (!status.eligible) return false;
  addRedemption({ item: "Buffet Feast", icon: "🍽️", cost: 0, type: "buffet" });
  setBuffetClaim(todayISO());
  return true;
}

// Small per-day contribution helper for summaries (e.g. Today).
export function creditsForRatio(ratio) {
  if (ratio >= 1) return RULES.creditFull;
  if (ratio >= 0.5) return RULES.creditHalf;
  return 0;
}
