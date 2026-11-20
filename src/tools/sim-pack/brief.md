# Card Battles: Prestige — Prestige Tower Battle Simulator Pack

*Generated {{generatedAt}} from the Card Battles: Prestige fan wiki data. {{cardCount}} cards ({{battleCount}} battle, {{supportCount}} support). Companion file: `prestige-sim-cards.json` (the same card data, machine-readable).*

---

## Part 1 — Your task

You are building a **battle simulator for the Roblox game Card Battles: Prestige**. Its purpose is to find **unusually strong ("cheese") teams for the Prestige Tower**: teams that can clear far higher floors than their rarity or stats suggest, ideally ones nobody has noticed yet.

Build it in this order, and check in with the user at each step:

1. **Read everything in this file.** Parts 2–4 are the rules, Part 5 is what is still unknown, and Part 7 is every card in the game.
2. **Write the battle engine** that follows the rules in Part 2 exactly. Anything Part 5 lists as unknown must be a clearly named, configurable assumption, never hard-coded silently.
3. **Implement every card's ability** from its exact text in Part 7. Abilities are the hard part: each card needs its own implementation. Build them on shared building blocks (status effects, triggers, stacking buffs, damage instances) so they behave consistently.
4. **Test each ability.** Give every card at least one unit test that checks its main numbers (for example, "Hawkeye Sniper's 3rd shot deals 300% of her ATK"). Whenever an ability is ambiguous, list the question for the user instead of guessing. Collect all of these in an `ASSUMPTIONS.md` file.
5. **Add the Prestige Tower model:** enemy stats per floor from the model in Part 3, and which cards can appear there (Part 5).
6. **Search for strong teams** using the strategy in Part 6, and write a readable report.

### What "properly simulate" means

- Turn by turn, in the real order: who acts first, what each ability does on entry, stuns or freezes skipping turns, damage over time ticking, revives, deaths, and the next card coming in.
- Every percentage, stack, cap, "first time", "once per battle" and "every Nth attack" in the ability texts is honoured exactly.
- Random effects (dodge chances, random targets, stun chances) use a **seeded** random number generator. Run each matchup enough times to get a stable win rate, and report it.
- A battle log mode that prints every action, so the user can check a single fight against the real game.

### Recommended setup

- Any language works. Python is fine for the first version. If the search is too slow, move the hot loop to something faster or parallelise across CPU cores.
- Keep card data **out of the code**: load it from `prestige-sim-cards.json`. When the user adds or updates cards, it should only need a new JSON file.
- Make deterministic runs reproducible from a seed.

---

## Part 2 — Battle rules we know

### Teams and turns
- Prestige Tower battles are **4v4**, like Infinite.
- **A party has 4 slots. Each slot is one battle card plus exactly one support card:**

  | Slot | Battle card | Support card |
  |---|---|---|
  | 1 | Battle slot 1 | Support slot 1 |
  | 2 | Battle slot 2 | Support slot 2 |
  | 3 | Battle slot 3 | Support slot 3 |
  | 4 | Battle slot 4 | Support slot 4 |

- **A support only affects the battle card in its own slot**, unless the support's ability text says otherwise.
- **Copies are allowed.** The same battle card and the same support can appear more than once in a party, except cards with the **One Per Party** trait.
- Some battle cards affect other cards in the party, but only when their ability says so. For example, **Noble Companion** gives every card in your party +20% damage for each Noble Companion in the party (stacking).
- **Slot order:** each side fights in slot order. Slot 1 is in front first. When it dies, the card in the next slot comes in (slot 2, then 3, then 4). The other cards wait on the **bench**.
- **The player always gets the first turn.** After that, **the two sides alternate one action each**: player, enemy, player, enemy…
- **Effects can break the alternation.** Stuns, freezes, lost turns and similar effects skip or change turns exactly as each ability says. Examples:
  - **Time Master** permanently disables the entering enemy's ability.
  - **Ice Reaper** freezes the enemy for 3 turns when it dies.
  - **Blessed Sorcerer** stuns every enemy when it drops below 20% HP.
- **Targeting:** a normal attack hits **the enemy in front**, unless an ability or a combination of abilities changes that.
- For now, **any card in the game can be an enemy**. The user will later send which cards actually appear in the Prestige Tower (Part 5).
- Abilities refer to the **front** card (the active one), the **bench**, "the next card that comes in", and "fallen" cards.

### Abilities combine
Cards and supports can **copy, borrow or steal abilities**, and a card can then hold **more than one ability at once and use them all**. The engine must support this generally, not as special cases. An example of how abilities can work together (an illustration of a mechanic, not a known strong combo):
- **Assimilator Kaiju** copies the ability of each enemy that enters.
- The support **Destiny Thread** makes the next card in your party borrow the fallen card's ability for 2 turns.
- So with Destiny Thread on the card in front of it, Assimilator Kaiju can borrow that card's ability (for example a multi-hit) and also copy the enemy's ability, then use both at once.

Interactions like this are exactly what the search is looking for. Model abilities as components a card can gain or lose during a battle, and make every trigger (on entry, on attack, on hit, on death, start or end of turn) work for any ability a card holds at the time.

### Stats
- Every battle card has **DMG** (its attack, also called ATK in ability text) and **HP**.
- **HP is exactly 2x DMG** on every card seen so far (small differences are rounding).
- Stats in Part 7 are **base stats**: no variant, no Awakening, no prestige boost.
- Abilities saying "X% of his ATK", "X% of her attack" or "X% ATK damage" deal X% of that card's **current** DMG. Ability text saying just "X% damage" (for example "3 shots for 175% damage each") most likely means X% of a normal attack's damage. Treat that as an assumption.
- "Starting ATK" means the card's DMG when the battle began (before buffs).

### Variants (shown in game as the card's border)
Each variant multiplies the card's **base rarity** and **base DMG and HP**.

{{variantTable}}

Rules:
- Every 10x in rarity doubles the stats: stat multiplier = 2^(log10 of the rarity multiplier).
- Shiny combos multiply: Shiny Gold = Shiny x Gold, Shiny Prismatic = Shiny x Prismatic, Shiny Cosmic = Shiny x Cosmic, Shiny Galactic = Shiny x Galactic (both rarity and stats).
- Rainbow is standalone and never combines with Shiny or anything else.
- Variant DMG/HP = base DMG/HP x stat multiplier. Ability damage written as "% of ATK" uses the variant's DMG.
- In-game numbers can differ slightly from these calculations because of rounding.

### Awakening
Awakening is a new upgrade for a card's ability, **levels 1 to 5**.
- Each level adds **10% of the base value** to the ability's percentages. A 1000% ability becomes 1100% at Lv 1, 1200% at Lv 2, 1300% at Lv 3, 1400% at Lv 4 and **1500% at Lv 5 (the cap)**.
- The user's rule is that this applies to **every percentage in every ability**. Part 7 shows each card's percentages at every level.
- **Unconfirmed:** in the one Awakened example seen so far (Eight-Handled General, "Awakened Lv 1/5: its ability is 10% stronger"), the 25% heal became 27.5% and the +100% damage per spin became +110%. But "20% less damage per spin" stayed at 20%, and the boss-only 50% and +25% did not change. **Make Awakening scaling switchable per number.** Default to "all percentages scale", keep a list of exceptions, and report results both ways if it matters.

### Supports
- Support cards have **no HP or DMG**. A support is **equipped on a battle card** and gives that card the support's ability.
- Percentages in a support's ability (for example "16% of the attacker's ATK") use the **equipped battle card's** stats.

### Traits
Traits are short labels the game shows on each card. They summarise what the ability does; the ability text is what counts.

{{traitTable}}

---

## Part 3 — The Prestige Tower

What we know:
- You climb floors in 4v4 battles. **Prestige luck** grows at milestones every 100 floors (this does not affect battles).
- **The player's own cards are boosted in battle by their prestige floor.** At the user's current floor, cards in the battle menu showed about **281x their base stats** (5 cards measured: 280.7x to 281.8x). The exact rule is still unknown (Part 5).
- Outside the tower, world NPC enemies (secret bosses included) also scale up: at floor 3,001 they are about 130–143x their base strength. That is separate from the tower enemies below.

### Enemy stats in the Prestige Tower
**Every enemy card on a floor has exactly the same DMG and HP. It depends only on the floor number.** The enemy card's own base stats and its variant (Prismatic, Shiny Cosmic and so on) do **not** matter in the tower. Enemy cards still have their own abilities. Assume any "% of ATK" in an enemy's ability uses that floor's DMG.

Measured in game (stats change every single floor):

| Floor | Enemy DMG | Enemy HP | DMG ÷ HP |
|---|---|---|---|
| 100 | 2,660 | 4,430 | 0.60 |
| 1,000 | 34,000 | 56,600 | 0.60 |
| 1,250 | 53,700 | 107,000 | 0.50 |
| 1,500 | 132,000 | 264,000 | 0.50 |
| 1,750 | 262,000 | 525,000 | 0.50 |
| 2,000 | 641,000 | 1,280,000 | 0.50 |
| 3,000 | 12,900,000 | 25,900,000 | 0.50 |
| 3,800 | 77,700,000 | 155,000,000 | 0.50 |

What the data shows:
- **HP is the steady number, and DMG is a fixed share of it:** DMG = **0.6 × HP** up to at least floor 1,000, and **0.5 × HP** from floor 1,250 on. Exactly where between 1,001 and 1,250 it switches is not known.
- **HP growth per 100 floors, between measured floors:**

  | Floors | HP growth per 100 floors |
  |---|---|
  | 100 → 1,000 | x1.327 |
  | 1,000 → 1,250 | x1.290 |
  | 1,250 → 1,500 | x1.435 |
  | 1,500 → 1,750 | x1.317 |
  | 1,750 → 2,000 | x1.428 |
  | 2,000 → 3,000 | x1.351 |
  | 3,000 → 3,800 | x1.251 |

- **The stretches ending on a multiple of 500 grow faster.** That suggests a likely (not yet confirmed) pattern: steady growth of about x1.29–1.32 per 100 floors, plus an **extra jump of about x1.25 at every multiple of 500 floors**, with slower steady growth after floor 3,000.
- No single smooth formula fits: simple exponential fits are off by up to 43%.

**Use this model** (call it `enemyStats(floor)`):
1. **HP:** interpolate log-linearly between the measured floors above: `HP(f) = H1 × (H2 / H1) ^ ((f − f1) / (f2 − f1))` for measured floors f1 < f ≤ f2. It is exact at every measured floor. Below floor 100, continue the 100–1,000 rate. Above floor 3,800, continue the 3,000–3,800 rate (x1.002239 per floor).
2. **DMG:** 0.6 × HP up to floor 1,000, 0.5 × HP from floor 1,250. Between 1,001 and 1,249, use the measured switch point once the user provides it (until then, switch at 1,001 and flag it).
3. Keep the measured table and the DMG ratio in a config file, so new measurements improve the model without code changes.
4. **Optional, once confirmed:** if the user confirms the jump at every 500th floor, switch to "steady per-floor growth plus a jump at each multiple of 500" fitted to the table. That is more accurate between measured floors than plain interpolation.

---

## Part 4 — Statuses and keywords used in abilities

These words appear in ability texts. Implement each one once and reuse it. Where the exact rule is not written down, it is listed in Part 5.

- **Stun**: the target skips its next turn (or the number of turns stated).
- **Freeze**: like Stun, for the stated turns.
- **Silence / "loses its ability"**: the target's ability does nothing for the stated turns.
- **Burn, Poison, Bleed**: damage at the start or end of turns, as each card states. Some move to the next enemy when their target dies.
- **Dodge / miss**: the attack does no damage.
- **Shield**: blocks a whole hit.
- **Damage reduction** ("takes 40% less damage"). "Ignores damage reduction" and "Ignores Defense" bypass it.
- **Revive / "stays at 1 HP" / "returns at X% HP"**: survives a lethal hit, usually once.
- **Summons**: extra units such as guardians, wolves or missiles.
- **Bench**: cards waiting their turn. Some abilities work "even from the bench" or hit "bench included".
- **Boss**: some effects say "not a boss's" or "no effect on boss NPCs".

---

## Part 5 — Still to be provided (ask the user)

These are not known yet. Build them as configuration, mark them clearly, and ask the user for each one before relying on results:

1. **More enemy stat measurements** to tighten the model in Part 3: floors just before and after a multiple of 500 (for example 1,499 and 1,500, or 2,499 and 2,500) to confirm the jump; a few floors between 1,000 and 1,250 to find where DMG switches from 0.6 to 0.5 of HP; and floors past 3,800.
2. **Which cards appear as enemies in the Prestige Tower**, and how enemy teams are picked per floor (random? fixed? does a team size or ordering change?).
3. **Player boost**: exactly how the player's prestige floor boosts their own cards (about 281x was observed at one floor).
4. **When a new card comes in** after the one in front dies: does it act right away, or does the alternation simply continue?
5. **Timing words**: exactly when "on entry", "start of turn", "end of turn", "end of round" and "at the start of each enemy turn" trigger, relative to each other.
6. **Stacking**: do two damage reductions add or multiply? Do buffs from several cards stack?
7. **"X% damage" without ATK**: confirm it means X% of a normal attack.
8. **Awakening exceptions**: which percentages do not scale.

When the user answers, update `ASSUMPTIONS.md` and re-run the affected tests.

---

## Part 6 — Finding broken teams

**The goal is to simulate as many battles, with as many different card combinations, as possible**, to find the cards and teams that can fight at the highest Prestige Tower floors.

The full space is huge: {{battleCount}} battle cards make about {{fourCardTeams}} different 4-card teams before order, variants, Awakening and supports. Simulating all of them is not realistic, so search in stages. The goal is that nothing promising is skipped:

1. **Single cards.** Simulate every card alone against a fixed set of reference enemy teams at several floors. Record damage dealt, damage taken, turns survived, and how much each card's power comes from its ability rather than raw stats.
2. **Pairs.** Test promising cards in pairs to find **synergies**: cards whose abilities feed each other (status combos, "works from anywhere in your party", buffs to the team, death triggers).
3. **Full teams.** Use beam search or a genetic algorithm over 4-card teams (and their order, supports and variants), seeded with the best singles and pairs.
4. **Exhaustive check on the shortlist.** Take the best few dozen cards and try every 4-card team and order among them.
5. **Measure strength as the highest floor cleared.** For each finalist, find the highest Prestige Tower floor it clears at least 90% of the time, at Base variant and at the user's chosen variants and Awakening levels.

The search space per team is: 4 battle cards (order matters), 4 supports (one per slot, copies allowed), each card's variant and Awakening level.

Look especially for **cheese**: teams that win because of a rule interaction rather than big stats. Examples: permanent stuns or silences, immunity loops, revive chains, reflected damage that scales with enemy stats, abilities that ignore enemy scaling ("not a boss's", fixed HP percentages), and anything that keeps working as enemy HP grows.

### Report
- The top teams, with highest floor cleared, win rate, and why they work (the key interaction).
- Surprising teams: low rarity or low stats, but high floors.
- For each team, one full battle log at its hardest cleared floor, so the user can try it in game.
- The list of assumptions each result depends on.

---

## Part 7 — Every card

Card stats are **base** (no variant, Awakening or prestige boost). Rarity is "1 in N" before variants. Cards marked **(estimated)** had their base stats worked out from boosted battle-menu numbers; treat them as approximate. "Roles" are the wiki's own summary labels, not from the game.

For each ability, the **Ability numbers** table lists every percentage in the text, in order, with its value at each Awakening level (base x 1.1, 1.2, 1.3, 1.4, 1.5).
