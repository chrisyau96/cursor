// Rewards view: Level & Identity, credits + streaks, redeemable gifts,
// the buffet milestone, and the redemption ledger.
import { el } from "../utils.js";
import { getWallet, removeRedemption } from "../store.js";
import { computeStats, GIFTS, RULES, redeemGift, claimBuffet, IDENTITIES } from "../gamify.js";

export function topbarFor() { return { title: "Rewards", sub: "Level, credits & gifts" }; }

export function render(ctx) {
  const view = el("div", { class: "view" });
  const s = computeStats();

  view.appendChild(levelCard(s));
  view.appendChild(creditsCard(ctx, s));
  view.appendChild(buffetCard(ctx, s));
  view.appendChild(redeemSection(ctx, s));
  view.appendChild(ledgerSection(ctx));
  view.appendChild(rulesCard());
  return view;
}

function levelCard(s) {
  const lv = s.level;
  const card = el("div", { class: "level-card" });
  const top = el("div", { class: "lvl-top" });
  top.appendChild(el("div", { class: "lvl-ring" }, [el("span", { text: `L${lv.level}` })]));
  top.appendChild(el("div", {}, [
    el("div", { class: "lvl-eyebrow", text: `Level ${lv.level} identity` }),
    el("div", { class: "lvl-identity", text: lv.identity }),
    el("div", { class: "lvl-xp", text: `${lv.intoLevel} / ${lv.span} XP to next level` }),
  ]));
  card.appendChild(top);
  card.appendChild(el("div", { class: "lvl-bar" }, [el("i", { style: `width:${Math.round(lv.progress * 100)}%` })]));
  const nextName = IDENTITIES[Math.min(lv.level, IDENTITIES.length - 1)];
  card.appendChild(el("div", { class: "lvl-next", text: `Next: “${nextName}”` }));
  return card;
}

function creditsCard(ctx, s) {
  const card = el("div", { class: "card card-pad" });
  card.appendChild(el("div", { class: "row-between" }, [
    el("div", {}, [
      el("div", { class: "tiny", style: "font-weight:700;color:var(--muted)", text: "Credit balance" }),
      el("div", { style: "font-size:32px;font-weight:800;letter-spacing:-.02em", text: `HK$${s.balance}` }),
    ]),
    el("div", { class: "credit-badge", text: "💰" }),
  ]));
  const grid = el("div", { class: "detail-stats", style: "margin:12px 0 0" });
  grid.appendChild(ds(`HK$${s.earnedCredits}`, "Earned"));
  grid.appendChild(ds(`-HK$${s.penaltyCredits}`, "Penalties"));
  grid.appendChild(ds(`-HK$${s.spent}`, "Redeemed"));
  card.appendChild(grid);

  const streaks = el("div", { class: "detail-stats", style: "margin-top:8px" });
  streaks.appendChild(ds(`🔥 ${s.longest100}`, "Longest 100%"));
  streaks.appendChild(ds(`${s.current80Streak}d`, "80%+ streak"));
  streaks.appendChild(ds(`${s.perfectDays}`, "Perfect days"));
  card.appendChild(streaks);

  if (s.penaltyPairs > 0) {
    card.appendChild(el("div", { class: "tiny", style: "margin-top:10px;color:var(--red)", text: `⚠️ ${s.penaltyPairs} penalty hit(s) from 2 days at 0% (−HK$${s.penaltyCredits}, −${s.penaltyXp} XP).` }));
  }
  return card;
}

function buffetCard(ctx, s) {
  const b = s.buffet;
  const card = el("div", { class: "buffet-card" });
  card.appendChild(el("div", { style: "display:flex;align-items:center;gap:10px" }, [
    el("div", { style: "font-size:30px", text: "🍽️" }),
    el("div", {}, [
      el("div", { style: "font-weight:800;font-size:15px", text: "Buffet Feast milestone" }),
      el("div", { class: "tiny", text: `${RULES.buffetDays} days in a row at ${Math.round(RULES.buffetThreshold * 100)}%+ unlocks a buffet.` }),
    ]),
  ]));
  card.appendChild(el("div", { class: "lvl-bar", style: "margin-top:12px;background:rgba(255,255,255,.25)" }, [
    el("i", { style: `width:${Math.round(b.progress * 100)}%;background:#fff` }),
  ]));
  card.appendChild(el("div", { class: "row-between", style: "margin-top:8px" }, [
    el("span", { class: "tiny", style: "color:#fff", text: `${b.streak} / ${b.needed} days` }),
    (() => {
      const btn = el("button", { class: "btn", style: "background:#fff;color:#b45309;padding:8px 14px", text: b.eligible ? "Claim buffet 🎉" : "Locked" });
      if (!b.eligible) btn.style.opacity = ".6";
      btn.addEventListener("click", () => {
        if (claimBuffet()) ctx.toast("Buffet unlocked! Enjoy 🎉");
        else ctx.toast(`Reach ${b.needed} days at 80%+ first`);
      });
      return btn;
    })(),
  ]));
  return card;
}

function redeemSection(ctx, s) {
  const wrap = el("div");
  wrap.appendChild(el("div", { class: "section-title" }, [el("h2", { text: "Redeem gifts" }), el("span", { class: "link", text: `HK$${s.balance} available` })]));
  const grid = el("div", { class: "gift-grid" });
  GIFTS.forEach((g) => {
    const affordable = s.balance >= g.cost;
    const cell = el("div", { class: "gift-cell" + (affordable ? "" : " locked") });
    cell.appendChild(el("div", { class: "gift-ico", text: g.icon }));
    cell.appendChild(el("div", { class: "gift-name", text: g.name }));
    cell.appendChild(el("div", { class: "gift-tag", text: g.tag }));
    const btn = el("button", { class: "gift-btn" + (affordable ? "" : " disabled"), text: `HK$${g.cost}` });
    btn.addEventListener("click", () => {
      if (redeemGift(g)) ctx.toast(`Redeemed: ${g.name}`);
      else ctx.toast("Not enough credits yet");
    });
    cell.appendChild(btn);
    grid.appendChild(cell);
  });
  wrap.appendChild(grid);
  return wrap;
}

function ledgerSection(ctx) {
  const wallet = getWallet();
  const wrap = el("div");
  wrap.appendChild(el("div", { class: "section-title" }, [el("h2", { text: "Redemption history" })]));
  if (!wallet.redemptions.length) {
    wrap.appendChild(el("div", { class: "card card-pad muted center", text: "No redemptions yet. Earn credits and treat yourself!" }));
    return wrap;
  }
  const list = el("div", { class: "habit-list" });
  wallet.redemptions.forEach((r) => {
    const row = el("div", { class: "manage-row" });
    row.appendChild(el("div", { class: "habit-ico", text: r.icon || "🎁" }));
    row.appendChild(el("div", { class: "m-main" }, [
      el("div", { class: "m-name", text: r.item }),
      el("div", { class: "m-sub", text: new Date(r.at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) }),
    ]));
    row.appendChild(el("div", { style: "font-weight:800;color:var(--red);text-align:right", text: r.cost ? `-HK$${r.cost}` : "free" }));
    const del = el("button", { class: "icon-btn", style: "width:34px;height:34px;font-size:15px", text: "↩" });
    del.title = "Undo (refund)";
    del.addEventListener("click", () => { removeRedemption(r.id); ctx.toast("Redemption undone"); });
    row.appendChild(del);
    list.appendChild(row);
  });
  wrap.appendChild(list);
  return wrap;
}

function rulesCard() {
  const card = el("div", { class: "card card-pad", style: "margin-top:14px" });
  card.appendChild(el("div", { style: "font-weight:800;font-size:14px;margin-bottom:8px", text: "How credits & XP work" }));
  const ul = el("ul", { class: "rules-list" });
  [
    `100% day → +HK$${RULES.creditFull} credits`,
    `50–99% day → +HK$${RULES.creditHalf} credits`,
    `+${RULES.xpPerHabit} XP per habit done, +${RULES.xpBonusFull} XP for a perfect day`,
    `2 days in a row at 0% → −HK$${RULES.penaltyCredit} & −${RULES.penaltyXp} XP`,
    `${RULES.buffetDays} days at ${Math.round(RULES.buffetThreshold * 100)}%+ → Buffet Feast`,
    `Each level unlocks a new identity to live into`,
  ].forEach((t) => ul.appendChild(el("li", { text: t })));
  card.appendChild(ul);
  return card;
}

function ds(value, label) {
  return el("div", { class: "ds" }, [
    el("div", { class: "v", text: String(value) }),
    el("div", { class: "l", text: label }),
  ]);
}
