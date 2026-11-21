# Card Battles: Prestige — Prestige Tower Battle Simulator Pack

*Generated 2026-11-21 from the Card Battles: Prestige fan wiki data. 287 cards (238 battle, 49 support). Companion file: `prestige-sim-cards.json` (the same card data, machine-readable).*

---

## Part 1 — Your task

You are building a **battle simulator for the Roblox game Card Battles: Prestige**. Its purpose is to find **unusually strong ("cheese") teams for the Prestige Tower**: teams that can clear far higher floors than their rarity or stats suggest, ideally ones nobody has noticed yet.

Build it in this order. Show the user your progress after step 4 (the ability tests and `ASSUMPTIONS.md`) and after step 6 (the results), but don't stop and wait in between:

1. **Read everything in this file.** Parts 2–4 are the rules, Part 5 is what is still unknown, and Part 7 is every card in the game.
2. **Write the battle engine** that follows the rules in Part 2 exactly. Anything Part 5 lists as unknown must be a clearly named, configurable assumption, never hard-coded silently.
3. **Implement every card's ability** from its exact text in Part 7. Abilities are the hard part: each card needs its own implementation. Build them on shared building blocks (status effects, triggers, stacking buffs, damage instances) so they behave consistently.
4. **Test each ability.** Give every card at least one unit test that checks its main numbers (for example, "Hawkeye Sniper's 3rd shot deals 300% of her ATK"). Whenever an ability is ambiguous, list the question for the user instead of guessing. Collect all of these in an `ASSUMPTIONS.md` file.
5. **Add the Prestige Tower model:** enemy stats per floor from the model in Part 3, and which cards can appear there (Part 5).
6. **Search for strong teams** using the strategy in Part 6, and write the results files it describes (`results/RESULTS.md` and the rest).
7. **Build the results app** in Part 8 (at the end of this file): pictures of the top teams, and a rarity filter that limits which cards the search may use.

### First run: start now, with these defaults
Part 5 lists what is still unknown. **Don't wait for those answers before the first run.** Use the defaults below, put each one in a config file, list them in `ASSUMPTIONS.md` and in the results, and re-run when the user answers.

| Unknown | Default for the first run |
|---|---|
| Which cards appear as tower enemies | Every battle card in Part 7 |
| How an enemy team is picked | 4 random battle cards from that pool, random order, a new draw per battle (seeded). Enemy stats come from the floor (Part 3), never from the card or its variant |
| Enemy supports | None |
| Player variants and Awakening | Base variant, no Awakening. Then a second pass of the finalists with each card at the strongest variant the rarity cap allows (Rainbow, x2,048, when there is no cap) and Awakening Lv 5, to show the best case |
| Difficulty Cut | Maxed (the floor table as written) |
| Between floors | Each floor is a fresh battle at full HP with no carried-over effects |
| A new card coming in | The alternation simply continues; the new card does not get a free action |
| Timing words | Order: on entry, then start of turn, then the action, then end of turn, then end of round |
| Stacking | Damage reductions multiply (two 50% reductions take 75% off); buffs from different sources add |
| "X% damage" with no ATK | X% of the card's current DMG |
| Awakening | Every percentage scales, as in Part 7 |

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
- Stats in Part 7 are **base stats**: no variant, no Awakening.
- **In battle, a player's card fights with its base stats × its variant's stat multiplier, and nothing else.** The prestige floor does not boost the player's cards. Awakening changes ability percentages, not stats. The only other changes happen inside a battle, through abilities and supports, for example a stat transfer like the **Last Legacy** support (on death, it passes 40% of the card's stats to the next card in line).
- Abilities saying "X% of his ATK", "X% of her attack" or "X% ATK damage" deal X% of that card's **current** DMG. Ability text saying just "X% damage" (for example "3 shots for 175% damage each") most likely means X% of a normal attack's damage. Treat that as an assumption.
- "Starting ATK" means the card's DMG when the battle began (before buffs).

### Variants (shown in game as the card's border)
Each variant multiplies the card's **base rarity** and **base DMG and HP**.

| Variant | Rarity multiplier | Stat multiplier (DMG and HP) | Made of |
|---|---|---|---|
| Base | x1 | x1 | — |
| Gold | x100 | x4 | — |
| Prismatic | x1,000 | x8 | — |
| Shiny | x1,000 | x8 | — |
| Cosmic | x10,000 | x16 | — |
| Shiny Gold | x100,000 | x32 | Shiny x Gold |
| Galactic | x1,000,000 | x64 | — |
| Shiny Prismatic | x1,000,000 | x64 | Shiny x Prismatic |
| Shiny Cosmic | x10,000,000 | x128 | Shiny x Cosmic |
| Shiny Galactic | x1,000,000,000 | x512 | Shiny x Galactic |
| Rainbow | x100,000,000,000 | x2,048 | standalone |

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

| Trait | Meaning (game text) |
|---|---|
| Bleed | Can make enemies bleed, hurting them for a few turns. |
| Burn | Can burn enemies, hurting them for a few turns. |
| Can't Miss | Some of its attacks can't be dodged. |
| Death Effect | Does something when this card is knocked out. |
| Dodge | Can dodge enemy attacks. |
| Entry Effect | Does something as soon as this card enters a fight. |
| Execute | Can instantly finish off a weakened enemy. |
| Freeze | Can freeze enemies. |
| Heal | Can restore HP. |
| Hits All | Can hit every enemy at once. |
| Ignores Defense | Some of its damage ignores the enemy's damage reduction. |
| Immune | Status effects like burn and stun don't affect this card. |
| Lifesteal | Can heal itself from the damage it deals. |
| Not On Bosses | Part of this card's ability doesn't work on bosses. |
| Once Per Battle | Part of this card's ability can only happen once per fight. |
| One Per Party | Only one copy can be in your party. |
| Pierce | Some of its attacks also hit the enemy behind the target. |
| Poison | Can poison enemies, hurting them for a few turns. |
| Revive | Can come back after being knocked out. |
| Shield | Can block hits with a shield. |
| Stun | Can stun enemies so they skip a turn. |
| Summon | Can bring extra cards into the fight. |
| Support | Equip this card on a battle card to give that card its ability. |

---

## Part 3 — The Prestige Tower

What we know:
- You climb floors in 4v4 battles. **Prestige luck** grows at milestones every 100 floors (this does not affect battles).
- **The player's cards are not boosted by the prestige floor.** They fight with base stats × their variant's stat multiplier (Part 2). Only the enemies scale with the floor. So the variants the player uses decide how high a team can climb.
- Outside the tower, world NPC enemies (secret bosses included) also scale up: at floor 3,001 they are about 130–143x their base strength. That is separate from the tower enemies below.

### Enemy stats in the Prestige Tower
**Every enemy card on a floor has exactly the same DMG and HP. It depends only on the floor number.** The enemy card's own base stats and its variant (Prismatic, Shiny Cosmic and so on) do **not** matter in the tower. Enemy cards still have their own abilities. Assume any "% of ATK" in an enemy's ability uses that floor's DMG.

Measured in game (stats change every single floor). "Cut 5" means the reading came from a player with the Difficulty Cut upgrade maxed (see below); it only matters from floor 4,000 on.

| Floor | Enemy DMG | Enemy HP | DMG ÷ HP | Note |
|---|---|---|---|---|
| 100 | 2,660 | 4,430 | 0.60 | |
| 1,000 | 34,000 | 56,600 | 0.60 | |
| 1,100 | 38,300 | 76,700 | 0.50 | |
| 1,200 | 52,100 | 104,000 | 0.50 | |
| 1,250 | 53,700 | 107,000 | 0.50 | about 9% under the curve, **not used** (recheck) |
| 1,499 | 111,000 | 222,000 | 0.50 | |
| 1,500 | 132,000 | 264,000 | 0.50 | |
| 1,750 | 262,000 | 525,000 | 0.50 | |
| 2,000 | 641,000 | 1,280,000 | 0.50 | |
| 2,499 | 2,660,000 | 5,320,000 | 0.50 | |
| 2,500 | 3,170,000 | 6,340,000 | 0.50 | |
| 2,750 | 6,360,000 | 12,700,000 | 0.50 | |
| 3,000 | 12,900,000 | 25,900,000 | 0.50 | |
| 3,250 | 21,000,000 | 42,100,000 | 0.50 | |
| 3,499 | 34,100,000 | 68,300,000 | 0.50 | |
| 3,800 | ~70,400,000 | ~141,000,000 | 0.50 | interpolated from 3,499 and 3,999 |
| 3,803 | 77,500,000 | 155,000,000 | 0.50 | about 9% over the curve (buffed, like the 3,800 reading), **not used** |
| 3,999 | 101,000,000 | 203,000,000 | 0.50 | |
| 4,000 | 120,000,000 | 240,000,000 | 0.50 | Cut 5 |
| 4,250 | 187,000,000 | 374,000,000 | 0.50 | Cut 5 |
| 4,499 | 290,000,000 | 581,000,000 | 0.50 | Cut 5 |
| 4,500 | 343,000,000 | 686,000,000 | 0.50 | Cut 5 |
| 4,750 | 522,000,000 | 1,040,000,000 | 0.50 | Cut 5 |
| 4,999 | 794,000,000 | 1,580,000,000 | 0.50 | Cut 5 |
| 5,000 | 936,000,000 | 1,870,000,000 | 0.50 | Cut 5 |
| 5,001 | 936,000,000 | 1,870,000,000 | 0.50 | Cut 5 |

The in-game readings at floors 3,800 and 3,803 were both higher than the floors around them allow, so they were probably buffed. Floor 3,800 is interpolated instead, and 3,803 is left out of the model.

**Difficulty Cut (player upgrade, 5 levels):** "Prestige floor 4,000+: enemies grow slower." It only changes enemy growth from floor 4,000 on; every reading below 4,000 is unaffected. With all 5 levels, growth from 4,000 to 5,000 is only slightly slower than just before 4,000 (x1.19 and x1.18 per 100 floors, against x1.20 from 3,500 to 4,000), and that fits the slowdown the curve already had. So either the cut is small, or it can't be told apart from the natural slowdown yet. Readings at a lower Difficulty Cut level above 4,000 are still to come. Until then, model floors above 4,000 as a player with Difficulty Cut maxed and flag it; with fewer levels, enemies above 4,000 are at least this strong.

What the data shows:
- **HP is the base number, and DMG is a fixed share of it:** DMG = **0.6 × HP** up to floor 1,000, and **0.5 × HP** from floor 1,100 on. The exact switch floor is between 1,001 and 1,100.
- **Every 500th floor (500, 1,000, 1,500 …) adds a one-time jump of about x1.187** on top of normal growth. Confirmed directly at 1,500, 2,500, 4,000, 4,500 and 5,000 (each x1.18–1.19, with or without Difficulty Cut).
- **Between jumps, HP grows a little every floor, and the rate slowly drops**, per 100 floors: about x1.28 (100–1,000), x1.32–1.36 (1,000–2,750), x1.24 (2,750–3,000), x1.21 (3,000–3,500), x1.20 (3,500–4,000), x1.19 (4,000–4,500, Cut 5), x1.18 (4,500–5,000, Cut 5).

**Use this model** (call it `enemyStats(floor)`):
1. Let `J = 1.187` and `n(f) = floor(f / 500)`, the number of 500-floor jumps reached, counting floor f itself if it is a multiple of 500.
2. For every measured floor not marked "not used", compute the smooth part `y = ln(HP) − n(f) × ln(J)`.
3. For any floor f, interpolate `y` linearly between the two nearest measured floors, then `HP(f) = e^(y(f) + n(f) × ln(J))`. Below floor 100, continue the 100–1,000 slope. Above 5,000, continue the 4,500–5,000 slope (x1.18 per 100 floors plus the jumps), and flag it: the rate has kept dropping, so far floors are probably overestimated, but Difficulty Cut is said to stop at floor 5,000, which would push the other way.
4. **DMG** = 0.6 × HP up to floor 1,000, and 0.5 × HP from floor 1,001 (flag floors 1,001–1,099 until the exact switch floor is known).
5. Keep the measured table, `J` and the DMG ratio in a config file, so new measurements improve the model without code changes.

**Accuracy:** predicting each measured floor from its neighbours lands within about 3% for most floors, and 8% at worst (floor 2,750, where the growth rate drops). Floors 4,250 and 4,750 are predicted within 0.2%. There are no readings above 5,001.

A rough rule of thumb, for reading only (it can be 10–20% off): enemy HP grows about **x1.3 every 100 floors up to floor 2,750 and about x1.2 after that, plus x1.19 at every 500th floor**. Enemy DMG is half of HP.

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

These are not known yet. Build them as configuration and mark them clearly. Use the defaults in Part 1 ("First run") until the user answers, and ask the user about each one:

1. **More enemy stat measurements** (optional, to tighten the model in Part 3): a recheck of floors 1,250 and 3,803, the exact floor between 1,001 and 1,100 where DMG switches from 0.6 to 0.5 of HP, and any floors past 5,001.
2. **Which cards appear as enemies in the Prestige Tower**, and how enemy teams are picked per floor (random? fixed? does a team size or ordering change?).
3. **Final Flame**: the user mentioned "final flame", a stat transfer that buffs the next card in line. Check with the user whether it works like the Last Legacy support or is something else.
4. **When a new card comes in** after the one in front dies: does it act right away, or does the alternation simply continue?
5. **Timing words**: exactly when "on entry", "start of turn", "end of turn", "end of round" and "at the start of each enemy turn" trigger, relative to each other.
6. **Stacking**: do two damage reductions add or multiply? Do buffs from several cards stack?
7. **"X% damage" without ATK**: confirm it means X% of a normal attack.
8. **Awakening exceptions**: which percentages do not scale.
9. **Difficulty Cut**: how much each of its 5 levels slows enemy growth above floor 4,000 (readings at a lower level are coming), and whether it really stops at floor 5,000.

When the user answers, update `ASSUMPTIONS.md` and re-run the affected tests.

---

## Part 6 — Finding broken teams

**The goal is to simulate as many battles, with as many different card combinations, as possible**, to find the cards and teams that can fight at the highest Prestige Tower floors.

The full space is huge: 238 battle cards make about 130 million different 4-card teams before order, variants, Awakening and supports. Simulating all of them is not realistic, so search in stages. The goal is that nothing promising is skipped:

1. **Single cards.** Simulate every card alone against a fixed set of reference enemy teams at several floors. Record damage dealt, damage taken, turns survived, and how much each card's power comes from its ability rather than raw stats.
2. **Pairs.** Test promising cards in pairs to find **synergies**: cards whose abilities feed each other (status combos, "works from anywhere in your party", buffs to the team, death triggers).
3. **Full teams.** Use beam search or a genetic algorithm over 4-card teams (and their order, supports and variants), seeded with the best singles and pairs.
4. **Exhaustive check on the shortlist.** Take the best few dozen cards and try every 4-card team and order among them.
5. **Measure strength as the highest floor cleared.** For each finalist, find the highest Prestige Tower floor it clears at least 90% of the time, at Base variant and at the user's chosen variants and Awakening levels.

The search space per team is: 4 battle cards (order matters), 4 supports (one per slot, copies allowed), each card's variant and Awakening level.

Look especially for **cheese**: teams that win because of a rule interaction rather than big stats. Examples: permanent stuns or silences, immunity loops, revive chains, reflected damage that scales with enemy stats, abilities that ignore enemy scaling ("not a boss's", fixed HP percentages), and anything that keeps working as enemy HP grows.

**Finding the highest floor:** enemies only get stronger as the floor rises, so binary-search the floor for each team. Run at least 200 battles per floor checked, and call a floor cleared at a win rate of 90% or more.

### Results files
Write everything into a `results/` folder, and overwrite it on every full run:

1. **`results/RESULTS.md`**, the readable report, with these sections:
   - **Run summary:** the date, how many battles and teams were simulated, the random seed, and the config used (variants, Awakening, rarity cap, Difficulty Cut).
   - **Top 25 teams:** a table with rank, slot 1–4 battle cards, slot 1–4 supports, highest floor cleared (90%+ win rate), win rate there, the highest floor won at least once, and average turns per win. Show Base / no Awakening and the best-case pass (strongest allowed variant, Awakening Lv 5) in separate tables, and list each card's variant in the best-case table.
   - **Why they work:** for each of the top 10, two or three sentences on the key interaction (which abilities carry the team, and what goes wrong without each card).
   - **Cheese and surprises:** teams that reach high floors with low stats or common cards, and any interaction that keeps working no matter how strong enemies get. Flag any team whose floor looks unlimited (it may be a bug in the engine or a real exploit; say which you think it is).
   - **Best single cards** and **best supports:** the top 20 of each, by how much they raise a team's highest floor.
   - **Best pairs:** the top 20 synergies.
   - **Assumptions:** every default from "First run" that the results depend on, and which top teams would change if it turned out wrong.
2. **`results/teams.csv`**: every team that finished the full-team stage, one row each, with columns `rank, card1, card2, card3, card4, support1, support2, support3, support4, variant, awakening, highest_floor_90, win_rate_at_that_floor, highest_floor_won, avg_turns, key_interaction`.
3. **`results/teams.json`**: everything in `teams.csv`, plus each team's card ids, variant, Awakening, rarest-card rarity and the filter it was searched with. The results app (Part 8) reads this.
4. **`results/cards.csv`**: every battle card and support, with its single-card score and the best team it appears in.
5. **`results/logs/`**: for each top-10 team, one full turn-by-turn battle log at its highest cleared floor, as a text file named after the rank and cards. The user can follow this in game to check the simulation.

Also print a short summary to the console when a run finishes: the top 5 teams and their floors.

---

## Part 7 — Every card

Card stats are **base** (no variant or Awakening), from the in-game deck view. Rarity is "1 in N" before variants. "Roles" are the wiki's own summary labels, not from the game.

For each ability, the **Ability numbers** table lists every percentage in the text, in order, with its value at each Awakening level (base x 1.1, 1.2, 1.3, 1.4, 1.5).

### Index

- [Battle cards (238)](#battle-cards)
- [Support cards (49)](#support-cards)

## Battle cards

### 10th Captain

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 218 (218) · **Base HP:** 435 (435)

**Traits:** Freeze, Entry Effect

**Roles (wiki labels):** Crowd control, Tank, Entry effect

**Ability: Frost Dragon Domain**

> - On entry, freeze enemy for 2 turns.
> - Attacks against frozen targets deal 1.5x damage.
> - 10th Captain takes 20% reduced damage at all times (ice shell).

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 20% | 22% | 24% | 26% | 28% | 30% | …targets deal 1.5x damage. · 10th Captain takes 20% reduced damage at all times (ice shell). |

---

### Absolute Zero

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 848 (848) · **Base HP:** 1.69K (1,690)

**Traits:** Freeze, Entry Effect

**Roles (wiki labels):** Crowd control, Entry effect

**Ability: Ice Time Capsule**

> - On entry, freeze enemy for 2 turns.
> - Deal 2x damage to frozen targets.
> - When a frozen target is killed, freeze transfers to next card entering (1 turn).

---

### Almighty Tyrant

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 608 (608) · **Base HP:** 1.21K (1,210)

**Traits:** Dodge, Revive, Death Effect

**Roles (wiki labels):** Cheat death, Evasion, Crowd control, Death effect

**Ability: The Almighty**

> - See the future: dodge the first attack every 3 turns.
> - On death, alter the future: revive at 60% HP with the enemy's ability disabled for 2 turns.
> - Once.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 60% | 66% | 72% | 78% | 84% | 90% | …turns. · On death, alter the future: revive at 60% HP with the enemy's ability disabled for 2 turns.… |

---

### Ant King

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 2.56K (2,560) · **Base HP:** 5.12K (5,120)

**Traits:** Revive, Heal

**Roles (wiki labels):** Self-scaling, Cheat death, Healer

**Ability: Post-Rose Evolution**

> - Ant King gains 5% stats every turn.
> - On kill, absorb 15% of the defeated card's stats permanently and heal 25% max HP.
> - On death, Ant King revives once at 50% HP in his Post-Rose form with 50% more attack.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 5% | 5.5% | 6% | 6.5% | 7% | 7.5% | - Ant King gains 5% stats every turn. · On kill, absorb 15% of the… |
| 2 | 15% | 16.5% | 18% | 19.5% | 21% | 22.5% | …gains 5% stats every turn. · On kill, absorb 15% of the defeated card's stats permanently and… |
| 3 | 25% | 27.5% | 30% | 32.5% | 35% | 37.5% | …the defeated card's stats permanently and heal 25% max HP. · On death, Ant King revives once at… |
| 4 | 50% | 55% | 60% | 65% | 70% | 75% | …max HP. · On death, Ant King revives once at 50% HP in his Post-Rose form with 50% more attack. |
| 5 | 50% | 55% | 60% | 65% | 70% | 75% | …revives once at 50% HP in his Post-Rose form with 50% more attack. |

---

### Apex of Curses

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 1.21M (1,210,000) · **Base HP:** 2.42M (2,420,000)

**Traits:** Lifesteal, Stun

**Roles (wiki labels):** Self-scaling, Healer, Crowd control, Cheat death

**Ability: King's Feast**

> **Feast**
> - Its attacks heal it for 5% of the damage dealt.
> - Healing past full HP permanently raises its max HP.
> - Whenever its max HP grows, its attack grows by the same percentage.
>
> **Wheel**
> - The Wheel spins once each time it attacks or is hit, and 3 times when it kills a card.
> - Each spin permanently raises its max HP by 5% and its lifesteal by 2%.
>
> **Dread**
> - Every enemy card that comes in front of it is Stunned for 1 turn and Frightened for 3 turns.
> - It deals 50% more damage to Frightened cards, and Feast heals twice as much from them.
>
> **Divine General**
> - The first time it would die, it returns with 10% of its max HP for every spin of the Wheel (up to 300%), and the Wheel spins 3 times.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 5% | 5.5% | 6% | 6.5% | 7% | 7.5% | Feast · Its attacks heal it for 5% of the damage dealt. · Healing past full HP permanently… |
| 2 | 5% | 5.5% | 6% | 6.5% | 7% | 7.5% | …· Each spin permanently raises its max HP by 5% and its lifesteal by 2%. Dread · Every enemy… |
| 3 | 2% | 2.2% | 2.4% | 2.6% | 2.8% | 3% | …raises its max HP by 5% and its lifesteal by 2%. Dread · Every enemy card that comes in front… |
| 4 | 50% | 55% | 60% | 65% | 70% | 75% | …turn and Frightened for 3 turns. · It deals 50% more damage to Frightened cards, and Feast heals… |
| 5 | 10% | 11% | 12% | 13% | 14% | 15% | …The first time it would die, it returns with 10% of its max HP for every spin of the Wheel (up… |
| 6 | 300% | 330% | 360% | 390% | 420% | 450% | …its max HP for every spin of the Wheel (up to 300%), and the Wheel spins 3 times. |

---

### Architect of Agony

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 57.4K (57,400) · **Base HP:** 114K (114,000)

**Traits:** One Per Party, Stun, Shield, Entry Effect

**Roles (wiki labels):** Damage over time, Splash Damage, Counter, Crowd control

**Ability: The Labyrinth**

> - On entry, he opens the Labyrinth for as long as he lives.
> - At the start of each turn, every enemy is bound with 1 Chain (max 10).
> - Chained enemies lose 20% of his ATK per Chain at the end of each turn.
> - When one attacks, hooks tear it for 30% of his ATK per Chain.
> - When one uses an ability, it gains 2 Chains.
> - When one dodges or shields, it gains 3 Chains and is stunned for 1 turn (once every 3 turns per enemy).
> - The Chains are linked: whenever a Chain hurts the enemy on the field, every other chained enemy takes 50% of that damage.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 20% | 22% | 24% | 26% | 28% | 30% | …with 1 Chain (max 10). · Chained enemies lose 20% of his ATK per Chain at the end of each turn.… |
| 2 | 30% | 33% | 36% | 39% | 42% | 45% | …turn. · When one attacks, hooks tear it for 30% of his ATK per Chain. · When one uses an ability,… |
| 3 | 50% | 55% | 60% | 65% | 70% | 75% | …on the field, every other chained enemy takes 50% of that damage. |

**Hits that scale with this card's ATK:** Chain tick per Chain 20%, Hook tear per Chain 30%

---

### Armored Titan

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 465 (465) · **Base HP:** 930 (930)

**Roles (wiki labels):** Tank

**Ability: Hardened Armor**

> - 75% HP: +10% damage reduction.
> - 50% HP: +25% damage reduction.
> - 25% HP: +50% damage reduction.
> - (Doesn't stack)

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 75% | 82.5% | 90% | 97.5% | 105% | 112.5% | - 75% HP: +10% damage reduction. · 50% HP: +25% damage… |
| 2 | +10% | +11% | +12% | +13% | +14% | +15% | - 75% HP: +10% damage reduction. · 50% HP: +25% damage reduction.… |
| 3 | 50% | 55% | 60% | 65% | 70% | 75% | - 75% HP: +10% damage reduction. · 50% HP: +25% damage reduction. · 25% HP: +50% damage… |
| 4 | +25% | +27.5% | +30% | +32.5% | +35% | +37.5% | - 75% HP: +10% damage reduction. · 50% HP: +25% damage reduction. · 25% HP: +50% damage reduction.… |
| 5 | 25% | 27.5% | 30% | 32.5% | 35% | 37.5% | …reduction. · 50% HP: +25% damage reduction. · 25% HP: +50% damage reduction. · (Doesn't stack) |
| 6 | +50% | +55% | +60% | +65% | +70% | +75% | …reduction. · 50% HP: +25% damage reduction. · 25% HP: +50% damage reduction. · (Doesn't stack) |

---

### Artillery Captain

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 16.8K (16,800) · **Base HP:** 33.7K (33,700)

**Roles (wiki labels):** Team support, Works from the bench

**Ability: Artillery Command**

> - While this card is alive in your party, every attack by an ally also deals 25% of its attack to the enemy.
> - Its attacks deal 50% bonus damage to enemies below 50% HP.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 25% | 27.5% | 30% | 32.5% | 35% | 37.5% | …your party, every attack by an ally also deals 25% of its attack to the enemy. · Its attacks deal… |
| 2 | 50% | 55% | 60% | 65% | 70% | 75% | …its attack to the enemy. · Its attacks deal 50% bonus damage to enemies below 50% HP. |
| 3 | 50% | 55% | 60% | 65% | 70% | 75% | …attacks deal 50% bonus damage to enemies below 50% HP. |

---

### Assimilator Kaiju

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 11K (11,000) · **Base HP:** 22.1K (22,100)

**Roles (wiki labels):** Crowd control, Self-scaling

**Ability: Assimilation**

> - When an enemy enters, copy its ability.
> - His first attack on the first enemy he faces permanently disables that enemy's ability.
> - On a kill, gain 50% of his own starting stats.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 50% | 55% | 60% | 65% | 70% | 75% | …disables that enemy's ability. · On a kill, gain 50% of his own starting stats. |

---

### Astral Devourer

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 5.12K (5,120) · **Base HP:** 10.2K (10,200)

**Traits:** Hits All, Ignores Defense

**Roles (wiki labels):** Self-scaling, Nuker, Splash Damage, Cheat death

**Ability: Mode: Cosmic Fear**

> - Every turn, Astral Devourer adapts and gains 15% stats.
> - Every 3rd attack becomes Gamma Ray Burst, dealing 4x damage, ignoring damage reduction, and hitting every other enemy card for 20% of Astral Devourer's attack.
> - On receiving fatal damage, Astral Devourer reverses causality once, returning to the HP he had at the beginning of the previous turn and gaining 25% attack permanently.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 15% | 16.5% | 18% | 19.5% | 21% | 22.5% | …Every turn, Astral Devourer adapts and gains 15% stats. · Every 3rd attack becomes Gamma Ray Burst,… |
| 2 | 20% | 22% | 24% | 26% | 28% | 30% | …reduction, and hitting every other enemy card for 20% of Astral Devourer's attack. · On receiving fatal… |
| 3 | 25% | 27.5% | 30% | 32.5% | 35% | 37.5% | …the beginning of the previous turn and gaining 25% attack permanently. |

**Hits that scale with this card's ATK:** Gamma Ray splash 20%

**Hits written as "X% damage" (probably of a normal attack):** Gamma Ray Burst 400%

---

### Attack Titan

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 69.4K (69,400) · **Base HP:** 138K (138,000)

**Traits:** One Per Party

**Roles (wiki labels):** Self-scaling

**Ability: Nine Titans**

> **Nine Titans**
> - Every other Titan in your party also gives him its ability (copies of the same Titan count once).
>
> **Titan Devour**
> - When a Titan in your party dies, he devours it.
> - He keeps its ability for the rest of the battle, and his own ATK and max HP permanently double.
>
> **Attack Titan**
> - His attacks deal 25% more damage, plus 25% more for every Titan ability he holds.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 25% | 27.5% | 30% | 32.5% | 35% | 37.5% | …permanently double. Attack Titan · His attacks deal 25% more damage, plus 25% more for every Titan ability… |
| 2 | 25% | 27.5% | 30% | 32.5% | 35% | 37.5% | …Titan · His attacks deal 25% more damage, plus 25% more for every Titan ability he holds. |

---

### Axe Prodigy

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 14.4K (14,400) · **Base HP:** 28.9K (28,900)

**Traits:** Heal

**Roles (wiki labels):** Splash Damage, Healer

**Ability: Prodigy's Axe**

> - Damage past what kills an enemy carries over to the next enemy at 120%.
> - On a kill, heal for 75% of that overkill damage.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 120% | 132% | 144% | 156% | 168% | 180% | …kills an enemy carries over to the next enemy at 120%. · On a kill, heal for 75% of that overkill damage. |
| 2 | 75% | 82.5% | 90% | 97.5% | 105% | 112.5% | …the next enemy at 120%. · On a kill, heal for 75% of that overkill damage. |

---

### Bandit

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 10 (10) · **Base HP:** 20 (20)

**Traits:** Stun

**Roles (wiki labels):** Multi-hit, Works from the bench

**Ability: Backstab**

> Whenever an enemy is stunned, frozen or misses an attack, Bandit stabs it for 100% of his attack, even from the bench.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 100% | 110% | 120% | 130% | 140% | 150% | …frozen or misses an attack, Bandit stabs it for 100% of his attack, even from the bench. |

**Hits that scale with this card's ATK:** Backstab hit 100%

---

### Beast Titan

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 507 (507) · **Base HP:** 1.01K (1,010)

**Traits:** Entry Effect

**Roles (wiki labels):** Entry effect

**Ability: Boulder Throw**

> On entry, throw a boulder at the last enemy dealing 100% damage.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 100% | 110% | 120% | 130% | 140% | 150% | …entry, throw a boulder at the last enemy dealing 100% damage. |

**Hits written as "X% damage" (probably of a normal attack):** Entry boulder hit 100%

---

### Beautiful Abomination

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 73.3K (73,300) · **Base HP:** 146K (146,000)

**Traits:** One Per Party, Stun, Revive, Death Effect

**Roles (wiki labels):** Cheat death, Summoner, Crowd control, Death effect

**Ability: Eternal Parasite**

> - When killed, she regenerates at full HP but permanently loses 20% of her original max HP.
> - Each regeneration also grows an Abomination Copy at the back of her team with 50% of her stats (max 3).
> - Copies regenerate once and don't multiply.
> - Each time she regenerates, the card that killed her is Obsessed and stunned for 1 turn.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 20% | 22% | 24% | 26% | 28% | 30% | …regenerates at full HP but permanently loses 20% of her original max HP. · Each regeneration also… |
| 2 | 50% | 55% | 60% | 65% | 70% | 75% | …Abomination Copy at the back of her team with 50% of her stats (max 3). · Copies regenerate once… |

---

### Blade Vice Captain

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 15.7K (15,700) · **Base HP:** 31.5K (31,500)

**Traits:** Dodge

**Roles (wiki labels):** Evasion, Counter

**Ability: Twin Blade Style**

> - Gain 10% dodge chance every other turn (max 40%).
> - After dodging an attack, counterattack for 175% damage (2 turn cooldown).

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 10% | 11% | 12% | 13% | 14% | 15% | - Gain 10% dodge chance every other turn (max 40%). · After… |
| 2 | 40% | 44% | 48% | 52% | 56% | 60% | …Gain 10% dodge chance every other turn (max 40%). · After dodging an attack, counterattack for… |
| 3 | 175% | 192.5% | 210% | 227.5% | 245% | 262.5% | …· After dodging an attack, counterattack for 175% damage (2 turn cooldown). |

**Hits written as "X% damage" (probably of a normal attack):** Counterattack 175%

---

### Blank Chess Prodigy

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 10.9K (10,900) · **Base HP:** 21.9K (21,900)

**Roles (wiki labels):** Team support, Splash Damage, Works from the bench

**Ability: Checkmate**

> - When one of your cards hits for at least 1.5x its ATK, the next enemy in line takes 75% of that hit (at most 3x its ATK).
> - Works from anywhere in your party.
> - Copies don't stack.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 75% | 82.5% | 90% | 97.5% | 105% | 112.5% | …least 1.5x its ATK, the next enemy in line takes 75% of that hit (at most 3x its ATK). · Works from… |

---

### Blessed Mage

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 190 (190) · **Base HP:** 379 (379)

**Roles (wiki labels):** Nuker

**Ability: Spirit of Zephyr**

> - +20% stats for the entire fight.
> - Every 2 turns, Spirit Dive activates: next attack deals 2x damage.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | +20% | +22% | +24% | +26% | +28% | +30% | - +20% stats for the entire fight. · Every 2 turns,… |

---

### Blessed Sorcerer

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 548 (548) · **Base HP:** 1.09K (1,090)

**Traits:** Once Per Battle, Stun, Hits All, Ignores Defense, Heal

**Roles (wiki labels):** Tank, Crowd control, Nuker, Healer

**Ability: Six Eyes: Hollow Purple**

> **Infinity**
> - Take 50% reduced damage from all sources.
> - Every 4 turns, Hollow Purple: 2x damage ignoring all damage reduction.
> - Below 20% HP, Unlimited Void: stun all enemies for 2 turns, heal to 50%.
> - Once per battle.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 50% | 55% | 60% | 65% | 70% | 75% | Infinity · Take 50% reduced damage from all sources. · Every 4 turns,… |
| 2 | 20% | 22% | 24% | 26% | 28% | 30% | …damage ignoring all damage reduction. · Below 20% HP, Unlimited Void: stun all enemies for 2 turns,… |
| 3 | 50% | 55% | 60% | 65% | 70% | 75% | …Void: stun all enemies for 2 turns, heal to 50%. · Once per battle. |

---

### Blind Board Master

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 12.6K (12,600) · **Base HP:** 25.2K (25,200)

**Roles (wiki labels):** Team support, Works from the bench

**Ability: Practice Makes Perfect**

> - Stats your cards gain from their own ability grow 50% more (one-time transforms and revives don't count).
> - Works from anywhere in your party.
> - Copies don't stack.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 50% | 55% | 60% | 65% | 70% | 75% | …your cards gain from their own ability grow 50% more (one-time transforms and revives don't count).… |

---

### Blizzard Baddie

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 175 (175) · **Base HP:** 350 (350)

**Traits:** Entry Effect

**Roles (wiki labels):** Tank, Self-scaling, Entry effect

**Ability: Psychic Blizzard**

> - On entry, create a psychic barrier that grants 30% damage reduction for 3 turns.
> - Each attack reduced by the barrier grants Blizzard Baddie 10% HP permanently.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 30% | 33% | 36% | 39% | 42% | 45% | …entry, create a psychic barrier that grants 30% damage reduction for 3 turns. · Each attack reduced… |
| 2 | 10% | 11% | 12% | 13% | 14% | 15% | …reduced by the barrier grants Blizzard Baddie 10% HP permanently. |

---

### Blood Brother

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 9.73K (9,730) · **Base HP:** 19.4K (19,400)

**Traits:** Bleed, Pierce, Heal

**Roles (wiki labels):** Damage over time, Healer, Splash Damage

**Ability: Blood Manipulation / Piercing Blood**

> - Attacks apply bleed for 12% of this card's ATK per turn for 2 turns.
> - Every 4 turns, Blood Brother uses Piercing Blood for 2x damage and pierces to the card behind for 40% damage.
> - Blood Brother heals for 50% of all bleed damage dealt.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 12% | 13.2% | 14.4% | 15.6% | 16.8% | 18% | - Attacks apply bleed for 12% of this card's ATK per turn for 2 turns. · Every… |
| 2 | 40% | 44% | 48% | 52% | 56% | 60% | …2x damage and pierces to the card behind for 40% damage. · Blood Brother heals for 50% of all… |
| 3 | 50% | 55% | 60% | 65% | 70% | 75% | …behind for 40% damage. · Blood Brother heals for 50% of all bleed damage dealt. |

**Hits that scale with this card's ATK:** Bleed per turn 12%

---

### Blood Fiend

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 429 (429) · **Base HP:** 858 (858)

**Roles (wiki labels):** Nuker

**Ability: Blood Hammer**

> - Attacks consume 5% of Blood Fiend's max HP to deal 30% bonus damage.
> - Below 20% HP, next attack deals 3x damage (Blood Spear).

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 5% | 5.5% | 6% | 6.5% | 7% | 7.5% | - Attacks consume 5% of Blood Fiend's max HP to deal 30% bonus damage.… |
| 2 | 30% | 33% | 36% | 39% | 42% | 45% | …Attacks consume 5% of Blood Fiend's max HP to deal 30% bonus damage. · Below 20% HP, next attack deals… |
| 3 | 20% | 22% | 24% | 26% | 28% | 30% | …Fiend's max HP to deal 30% bonus damage. · Below 20% HP, next attack deals 3x damage (Blood Spear). |

---

### Bloodchain Reaper

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 85.5K (85,500) · **Base HP:** 171K (171,000)

**Traits:** One Per Party, Ignores Defense, Heal

**Roles (wiki labels):** Nuker, Self-scaling, Cheat death

**Ability: Inner Hollow / Mugetsu**

> **Inner Hollow**
> - He gains 2% ATK for every 1% HP he loses, and keeps it even if he heals.
>
> **Mugetsu**
> - The first time he would die, he's left at 1 HP and cuts the enemy in front for 1500% of his ATK, ignoring damage reduction.
> - Then his power is gone: his ATK drops to 10% of what it was.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 2% | 2.2% | 2.4% | 2.6% | 2.8% | 3% | Inner Hollow · He gains 2% ATK for every 1% HP he loses, and keeps it even… |
| 2 | 1% | 1.1% | 1.2% | 1.3% | 1.4% | 1.5% | Inner Hollow · He gains 2% ATK for every 1% HP he loses, and keeps it even if he heals. Mugetsu… |
| 3 | 1500% | 1650% | 1800% | 1950% | 2100% | 2250% | …left at 1 HP and cuts the enemy in front for 1500% of his ATK, ignoring damage reduction. · Then… |
| 4 | 10% | 11% | 12% | 13% | 14% | 15% | …reduction. · Then his power is gone: his ATK drops to 10% of what it was. |

**Hits that scale with this card's ATK:** Mugetsu cut 1500%

---

### Bloodmoon Demon

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 111 (111) · **Base HP:** 222 (222)

**Traits:** Heal

**Roles (wiki labels):** Healer, Counter

**Ability: Blood Demon Art: Exploding Blood**

> - Regenerate 10% max HP every turn.
> - When attacked, 40% chance to ignite attacker's blood dealing 10% of their max HP back to them.
> - Below 20% HP, enter awakened form: 2x attack, stop regenerating.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 10% | 11% | 12% | 13% | 14% | 15% | - Regenerate 10% max HP every turn. · When attacked, 40% chance… |
| 2 | 40% | 44% | 48% | 52% | 56% | 60% | …Regenerate 10% max HP every turn. · When attacked, 40% chance to ignite attacker's blood dealing 10%… |
| 3 | 10% | 11% | 12% | 13% | 14% | 15% | …40% chance to ignite attacker's blood dealing 10% of their max HP back to them. · Below 20% HP,… |
| 4 | 20% | 22% | 24% | 26% | 28% | 30% | …dealing 10% of their max HP back to them. · Below 20% HP, enter awakened form: 2x attack, stop regenerating. |

---

### Bloodthirsty Monarch

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 42.7K (42,700) · **Base HP:** 85.5K (85,500)

**Traits:** One Per Party, Lifesteal, Revive, Execute, Entry Effect

**Roles (wiki labels):** Self-scaling, Cheat death, Healer, Execute

**Ability: Endless Feast / Last Supper**

> **Endless Feast**
> - On entry, consumes up to 3 allies behind him and gains 50% of their ATK and max HP.
> - Each ally consumed is one extra life: when he would die, he revives with 30% of his max HP instead.
> - He also gains one ability per ally consumed, in order:
>   - Blood Drinker: heals for 40% of the damage he deals, and healing past full HP permanently raises his max HP (up to +50%).
>   - Baskerville: when an enemy falls below 25% HP, his hound devours it instantly.
>   - Release Level Zero: every 3rd attack, each consumed ally strikes the enemy with its original ATK.
>
> **Last Supper**
> - Consumed allies die.
> - Their death abilities and supports trigger, and anything they would pass to the next card goes to him.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 50% | 55% | 60% | 65% | 70% | 75% | …consumes up to 3 allies behind him and gains 50% of their ATK and max HP. · Each ally consumed… |
| 2 | 30% | 33% | 36% | 39% | 42% | 45% | …extra life: when he would die, he revives with 30% of his max HP instead. · He also gains one ability… |
| 3 | 40% | 44% | 48% | 52% | 56% | 60% | …consumed, in order: · Blood Drinker: heals for 40% of the damage he deals, and healing past full… |
| 4 | +50% | +55% | +60% | +65% | +70% | +75% | …full HP permanently raises his max HP (up to +50%). · Baskerville: when an enemy falls below 25%… |
| 5 | 25% | 27.5% | 30% | 32.5% | 35% | 37.5% | …+50%). · Baskerville: when an enemy falls below 25% HP, his hound devours it instantly. · Release… |

---

### Blooming Wrath

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 8.93K (8,930) · **Base HP:** 17.8K (17,800)

**Traits:** Stun, Heal, Entry Effect

**Roles (wiki labels):** Debuffer, Self-scaling, Crowd control, Entry effect

**Ability: Cursed Bud / Disaster Plants**

> - On entry, plant a cursed bud on the active enemy card.
> - Each turn, it drains 5% of that card's attack and Blooming Wrath gains 10% attack.
> - After 3 turns, it blooms, stunning the host for 1 turn and healing Blooming Wrath for 15% max HP.
> - If the host dies first, the bud transfers to the next card.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 5% | 5.5% | 6% | 6.5% | 7% | 7.5% | …the active enemy card. · Each turn, it drains 5% of that card's attack and Blooming Wrath gains… |
| 2 | 10% | 11% | 12% | 13% | 14% | 15% | …that card's attack and Blooming Wrath gains 10% attack. · After 3 turns, it blooms, stunning… |
| 3 | 15% | 16.5% | 18% | 19.5% | 21% | 22.5% | …host for 1 turn and healing Blooming Wrath for 15% max HP. · If the host dies first, the bud transfers… |

---

### Blue Flame Heir

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 206 (206) · **Base HP:** 411 (411)

**Traits:** Once Per Battle, Heal

**Roles (wiki labels):** Self-scaling, Healer

**Ability: Blue Flames Unsheathed**

> Once per battle, below 50% HP: draws his demon sword for +50% attack and heals 25% of his max HP.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 50% | 55% | 60% | 65% | 70% | 75% | Once per battle, below 50% HP: draws his demon sword for +50% attack and… |
| 2 | +50% | +55% | +60% | +65% | +70% | +75% | …battle, below 50% HP: draws his demon sword for +50% attack and heals 25% of his max HP. |
| 3 | 25% | 27.5% | 30% | 32.5% | 35% | 37.5% | …draws his demon sword for +50% attack and heals 25% of his max HP. |

---

### Bone Knight

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 1.17K (1,170) · **Base HP:** 2.35K (2,350)

**Traits:** Pierce, Entry Effect

**Roles (wiki labels):** Debuffer, Splash Damage, Entry effect

**Ability: Sword of Actuation**

> - On entry, cut through the enemy's power: reduce their attack by 25% and max HP by 15%.
> - Every attack pierces to the next card in enemy lineup for 40% damage.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 25% | 27.5% | 30% | 32.5% | 35% | 37.5% | …through the enemy's power: reduce their attack by 25% and max HP by 15%. · Every attack pierces to… |
| 2 | 15% | 16.5% | 18% | 19.5% | 21% | 22.5% | …power: reduce their attack by 25% and max HP by 15%. · Every attack pierces to the next card in enemy… |
| 3 | 40% | 44% | 48% | 52% | 56% | 60% | …pierces to the next card in enemy lineup for 40% damage. |

---

### Brood Kaiju

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 10.9K (10,900) · **Base HP:** 21.9K (21,900)

**Traits:** Summon, Entry Effect

**Roles (wiki labels):** Summoner, Entry effect

**Ability: Kaiju Brood**

> - On entry and the first time taking damage each turn, summon a Kaiju Beast with 25% of its stats to the back of the team (max 3).
> - When it dies, it explodes for 20% of its max HP + 5% per beast summoned.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 25% | 27.5% | 30% | 32.5% | 35% | 37.5% | …damage each turn, summon a Kaiju Beast with 25% of its stats to the back of the team (max 3).… |
| 2 | 20% | 22% | 24% | 26% | 28% | 30% | …team (max 3). · When it dies, it explodes for 20% of its max HP + 5% per beast summoned. |
| 3 | 5% | 5.5% | 6% | 6.5% | 7% | 7.5% | …it dies, it explodes for 20% of its max HP + 5% per beast summoned. |

---

### Cart Titan

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 418 (418) · **Base HP:** 835 (835)

**Traits:** Shield

**Roles (wiki labels):** Team support, Tank

**Ability: Cart Rescue**

> - When an ally falls below 25% HP, Cart Titan steps in and gives it a 1-hit shield.
> - After tanking one enemy turn, he retreats to the back of the party.
> - Up to 2 rescues per battle, each ally once.
> - Copies don't stack.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 25% | 27.5% | 30% | 32.5% | 35% | 37.5% | - When an ally falls below 25% HP, Cart Titan steps in and gives it a 1-hit… |

---

### Celestial Attendant

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 562 (562) · **Base HP:** 1.12K (1,120)

**Traits:** Entry Effect

**Roles (wiki labels):** Tank, Healer

**Ability: Temporal Rewind**

> - On entry, after 3 turns, rewind HP to what it was 3 turns ago.
> - Celestial Attendant has 40% damage reduction.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 40% | 44% | 48% | 52% | 56% | 60% | …it was 3 turns ago. · Celestial Attendant has 40% damage reduction. |

---

### Chainsaw Fiend

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 380 (380) · **Base HP:** 759 (759)

**Traits:** Heal

**Roles (wiki labels):** Healer

**Ability: Chainsaw Rip**

> 70% chance on attack to heal for 30% of damage dealt.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 70% | 77% | 84% | 91% | 98% | 105% | 70% chance on attack to heal for 30% of damage dealt. |
| 2 | 30% | 33% | 36% | 39% | 42% | 45% | 70% chance on attack to heal for 30% of damage dealt. |

---

### Chair Guy

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 190 (190) · **Base HP:** 379 (379)

**Ability: Shame Chair**

> This card has no ability.

---

### Chrome Bruiser

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 30.7K (30,700) · **Base HP:** 61.4K (61,400)

**Traits:** Heal

**Roles (wiki labels):** Self-scaling, Tank, Multi-hit

**Ability: Cyber Rage**

> - Every hit Chrome Bruiser takes, and every time he heals, gives him 1 Rage (max 5).
> - Each Rage gives him 300% more attack.
> - While he has 3 or more Rage he takes 40% less damage.
> - At 5 Rage his next attack is Piston Smash: 3 hits for 120% damage each, then his Rage drops to 0.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 300% | 330% | 360% | 390% | 420% | 450% | …gives him 1 Rage (max 5). · Each Rage gives him 300% more attack. · While he has 3 or more Rage he… |
| 2 | 40% | 44% | 48% | 52% | 56% | 60% | …attack. · While he has 3 or more Rage he takes 40% less damage. · At 5 Rage his next attack is Piston… |
| 3 | 120% | 132% | 144% | 156% | 168% | 180% | …his next attack is Piston Smash: 3 hits for 120% damage each, then his Rage drops to 0. |

**Hits written as "X% damage" (probably of a normal attack):** Piston Smash hit 120%

---

### Chrome Runner

Battle card · Rarity: 1 in 8B · Origin: Card pack (Forged Pack)

**Base DMG:** 11.9K (11,900) · **Base HP:** 23.9K (23,900)

**Roles (wiki labels):** Multi-hit, Self-scaling, Evasion

**Ability: Sandevistan**

> **Sandevistan**
> - Every 3 turns, starting with his first, his attack hits 4 times and the next enemy attack on him misses.
> - Extra attacks he gets do the same.
>
> **Chrome Body**
> - His other attacks hit 2 times for 60% damage each.
>
> **Cyberpsychosis**
> - Every hit he lands permanently gives him +10% of his starting ATK (max +300%).
> - Once he has gained +100% ATK or more, at the end of each of his turns he loses 5% of his max HP for every +50% ATK he has gained.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 60% | 66% | 72% | 78% | 84% | 90% | …Chrome Body · His other attacks hit 2 times for 60% damage each. Cyberpsychosis · Every hit he lands… |
| 2 | +10% | +11% | +12% | +13% | +14% | +15% | …Cyberpsychosis · Every hit he lands permanently gives him +10% of his starting ATK (max +300%). · Once he has… |
| 3 | +300% | +330% | +360% | +390% | +420% | +450% | …permanently gives him +10% of his starting ATK (max +300%). · Once he has gained +100% ATK or more, at… |
| 4 | +100% | +110% | +120% | +130% | +140% | +150% | …starting ATK (max +300%). · Once he has gained +100% ATK or more, at the end of each of his turns… |
| 5 | 5% | 5.5% | 6% | 6.5% | 7% | 7.5% | …more, at the end of each of his turns he loses 5% of his max HP for every +50% ATK he has gained. |
| 6 | +50% | +55% | +60% | +65% | +70% | +75% | …his turns he loses 5% of his max HP for every +50% ATK he has gained. |

**Hits written as "X% damage" (probably of a normal attack):** Chrome Body hit 60%

---

### Cleanup Kaiju

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 19K (19,000) · **Base HP:** 38.1K (38,100)

**Traits:** Hits All, Can't Miss, Heal, Immune

**Roles (wiki labels):** Tank, Healer, Splash Damage

**Ability: Kaiju Regeneration**

> - Immune to status effects.
> - The first time this card would fall below 60% HP and again below 40% HP, it snaps back to that HP and heals an additional 20% max HP.
> - After its first regeneration, its attacks deal 100% bonus damage and cannot be dodged.
> - After the second, every attack also hits all other enemies for 20% of the damage dealt.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 60% | 66% | 72% | 78% | 84% | 90% | …· The first time this card would fall below 60% HP and again below 40% HP, it snaps back to that… |
| 2 | 40% | 44% | 48% | 52% | 56% | 60% | …card would fall below 60% HP and again below 40% HP, it snaps back to that HP and heals an additional… |
| 3 | 20% | 22% | 24% | 26% | 28% | 30% | …snaps back to that HP and heals an additional 20% max HP. · After its first regeneration, its attacks… |
| 4 | 100% | 110% | 120% | 130% | 140% | 150% | …After its first regeneration, its attacks deal 100% bonus damage and cannot be dodged. · After the… |
| 5 | 20% | 22% | 24% | 26% | 28% | 30% | …every attack also hits all other enemies for 20% of the damage dealt. |

---

### Colossal Titan

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 591 (591) · **Base HP:** 1.18K (1,180)

**Traits:** Hits All, Entry Effect

**Roles (wiki labels):** Splash Damage, Entry effect

**Ability: Colossal Blast**

> On entry, gain 25% max HP, then deal 30% of the Colossal Titan's HP to all enemies.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 25% | 27.5% | 30% | 32.5% | 35% | 37.5% | On entry, gain 25% max HP, then deal 30% of the Colossal Titan's… |
| 2 | 30% | 33% | 36% | 39% | 42% | 45% | On entry, gain 25% max HP, then deal 30% of the Colossal Titan's HP to all enemies. |

---

### Controller

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 1.47K (1,470) · **Base HP:** 2.94K (2,940)

**Traits:** Entry Effect

**Roles (wiki labels):** Crowd control, Entry effect

**Ability: Control Devil**

> - On entry, take control of the enemy's next card in line — it attacks its own active card once for full damage, then returns to the enemy lineup.
> - Every 4 turns, Controller controls again.

---

### Copyblade Mentor

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 299 (299) · **Base HP:** 598 (598)

**Traits:** Entry Effect

**Roles (wiki labels):** Entry effect

**Ability: Sharingan Copy**

> On entry or enemy entry, copy the opponent's active card's ability for the next 6 turns.

---

### Crash Out Queen

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 326 (326) · **Base HP:** 651 (651)

**Roles (wiki labels):** Debuffer

**Ability: Corrosion**

> - Reduce the enemy card's attack by 15% every turn (permanent, stacking).
> - Deal 25% more damage to cards with less attack than Crash out Queen.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 15% | 16.5% | 18% | 19.5% | 21% | 22.5% | - Reduce the enemy card's attack by 15% every turn (permanent, stacking). · Deal 25%… |
| 2 | 25% | 27.5% | 30% | 32.5% | 35% | 37.5% | …15% every turn (permanent, stacking). · Deal 25% more damage to cards with less attack than Crash… |

---

### Crescent Reaper

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 13.7K (13,700) · **Base HP:** 27.5K (27,500)

**Roles (wiki labels):** Multi-hit, Tank, Self-scaling

**Ability: Body Evolution**

> - Every turn Crescent Reaper is alive, he takes 7% less damage (up to 70%).
> - Every 2 turns he also grows another arm, adding an extra hit for 50% of his damage (up to 4 extra hits).
> - Killing a card counts as 1 additional turn.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 7% | 7.7% | 8.4% | 9.1% | 9.8% | 10.5% | …Every turn Crescent Reaper is alive, he takes 7% less damage (up to 70%). · Every 2 turns he also… |
| 2 | 70% | 77% | 84% | 91% | 98% | 105% | …Reaper is alive, he takes 7% less damage (up to 70%). · Every 2 turns he also grows another arm,… |
| 3 | 50% | 55% | 60% | 65% | 70% | 75% | …also grows another arm, adding an extra hit for 50% of his damage (up to 4 extra hits). · Killing… |

**Hits written as "X% damage" (probably of a normal attack):** Extra arm hit 50%

---

### Crimson Crow

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 1.08K (1,080) · **Base HP:** 2.16K (2,160)

**Traits:** Burn

**Roles (wiki labels):** Damage over time, Evasion, Tank

**Ability: Tsukuyomi / Amaterasu**

> - On enemy entry, trap the opponent in Tsukuyomi: their next attack misses and deals 25% of its damage to themselves.
> - Every 3rd attack, Crimson Crow uses Amaterasu, applying a burn for 25% of this card's ATK per turn for 3 turns.
> - Each one adds a stack.
> - Below 25% HP, Crimson Crow activates Susano'o and gains 50% damage reduction for 3 turns.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 25% | 27.5% | 30% | 32.5% | 35% | 37.5% | …Tsukuyomi: their next attack misses and deals 25% of its damage to themselves. · Every 3rd attack,… |
| 2 | 25% | 27.5% | 30% | 32.5% | 35% | 37.5% | …Crimson Crow uses Amaterasu, applying a burn for 25% of this card's ATK per turn for 3 turns. · Each… |
| 3 | 25% | 27.5% | 30% | 32.5% | 35% | 37.5% | …for 3 turns. · Each one adds a stack. · Below 25% HP, Crimson Crow activates Susano'o and gains… |
| 4 | 50% | 55% | 60% | 65% | 70% | 75% | …HP, Crimson Crow activates Susano'o and gains 50% damage reduction for 3 turns. |

**Hits that scale with this card's ATK:** Amaterasu burn per turn 25%

---

### Crimson Moon Captain

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 37.8K (37,800) · **Base HP:** 75.6K (75,600)

**Traits:** Entry Effect

**Roles (wiki labels):** Debuffer, Entry effect, Self-scaling, Evasion

**Ability: Crimson Moon**

> - On entry, he leaps above the field and hurls the Crimson Moon: the next attack on him misses, every enemy card is Scorched (deals 50% less damage for 4 turns) and the enemy in front takes 150% of his attack.
> - Whenever he defeats a card, he gains 25% attack permanently and the next enemy card enters Scorched.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 50% | 55% | 60% | 65% | 70% | 75% | …misses, every enemy card is Scorched (deals 50% less damage for 4 turns) and the enemy in front… |
| 2 | 150% | 165% | 180% | 195% | 210% | 225% | …damage for 4 turns) and the enemy in front takes 150% of his attack. · Whenever he defeats a card,… |
| 3 | 25% | 27.5% | 30% | 32.5% | 35% | 37.5% | …attack. · Whenever he defeats a card, he gains 25% attack permanently and the next enemy card enters… |

**Hits that scale with this card's ATK:** Crimson Moon hit 150%

---

### Crimson Phantom

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 81.9K (81,900) · **Base HP:** 163K (163,000)

**Traits:** One Per Party, Once Per Battle, Revive, Ignores Defense

**Roles (wiki labels):** Cheat death, Team support, Crowd control, Nuker

**Ability: Fate Erasure / Crimson's Curse**

> **Fate Erasure**
> - The first time this card or your strongest card (most max HP) dies, its death is erased, reviving it with 75% HP and +100% damage for 2 turns (once per battle).
>
> **Crimson's Curse**
> - Every 3 turns, erase the enemy's next turn and counter for 500% ATK, ignoring 60% of the enemy's damage reduction.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 75% | 82.5% | 90% | 97.5% | 105% | 112.5% | …dies, its death is erased, reviving it with 75% HP and +100% damage for 2 turns (once per battle).… |
| 2 | +100% | +110% | +120% | +130% | +140% | +150% | …death is erased, reviving it with 75% HP and +100% damage for 2 turns (once per battle). Crimson's… |
| 3 | 500% | 550% | 600% | 650% | 700% | 750% | …erase the enemy's next turn and counter for 500% ATK, ignoring 60% of the enemy's damage reduction. |
| 4 | 60% | 66% | 72% | 78% | 84% | 90% | …next turn and counter for 500% ATK, ignoring 60% of the enemy's damage reduction. |

**Hits that scale with this card's ATK:** Curse counter 500%

---

### Crimson Ruin Princess

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 11.5K (11,500) · **Base HP:** 23.1K (23,100)

**Roles (wiki labels):** Team support, Works from the bench

**Ability: Evil Pieces**

> - All summons on your team get double ATK and HP.
> - Each summon that joins your team while she's alive gives your whole team +10% ATK (up to 5 times).
> - Works from anywhere in your party.
> - Copies don't stack.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | +10% | +11% | +12% | +13% | +14% | +15% | …team while she's alive gives your whole team +10% ATK (up to 5 times). · Works from anywhere in… |

---

### Crimson Warlord

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 382 (382) · **Base HP:** 763 (763)

**Traits:** Hits All, Entry Effect

**Roles (wiki labels):** Splash Damage, Tank, Entry effect

**Ability: Tengai Shinsei**

> - On entry, call down a meteor that deals 50% damage to all enemies.
> - Every 4 turns, call down another meteor that deals 125% damage to all enemies.
> - Crimson Warlord takes 20% less damage.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 50% | 55% | 60% | 65% | 70% | 75% | - On entry, call down a meteor that deals 50% damage to all enemies. · Every 4 turns, call… |
| 2 | 125% | 137.5% | 150% | 162.5% | 175% | 187.5% | …4 turns, call down another meteor that deals 125% damage to all enemies. · Crimson Warlord takes… |
| 3 | 20% | 22% | 24% | 26% | 28% | 30% | …damage to all enemies. · Crimson Warlord takes 20% less damage. |

---

### Crooked Fixer

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 27.9K (27,900) · **Base HP:** 55.8K (55,800)

**Traits:** Heal, Entry Effect

**Roles (wiki labels):** Team support, Debuffer, Healer, Self-scaling

**Ability: Bounty**

> - On entry, Crooked Fixer puts a Bounty on the enemy card in front.
> - His team deals 100% more damage to the Bounty card.
> - When it dies, every card in his party heals 20% of its max HP, Crooked Fixer permanently gains 250% attack (max 3 times), and the next enemy card that enters gets the Bounty.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 100% | 110% | 120% | 130% | 140% | 150% | …on the enemy card in front. · His team deals 100% more damage to the Bounty card. · When it dies,… |
| 2 | 20% | 22% | 24% | 26% | 28% | 30% | …When it dies, every card in his party heals 20% of its max HP, Crooked Fixer permanently gains… |
| 3 | 250% | 275% | 300% | 325% | 350% | 375% | …its max HP, Crooked Fixer permanently gains 250% attack (max 3 times), and the next enemy card… |

---

### Crowned Strategist

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 617 (617) · **Base HP:** 1.23K (1,230)

**Roles (wiki labels):** Crowd control

**Ability: Geass: Absolute Obedience**

> On enemy entry, the enemy card attacks itself once for 40% damage.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 40% | 44% | 48% | 52% | 56% | 60% | …entry, the enemy card attacks itself once for 40% damage. |

---

### Curse Tyrant

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 11.6K (11,600) · **Base HP:** 23.3K (23,300)

**Traits:** Hits All, Heal

**Roles (wiki labels):** Splash Damage, Healer, Damage over time

**Ability: Cleave / Dismantle / Malevolent Shrine**

> - Normal attacks deal 1.5x damage.
> - Every 3rd attack hits all enemy cards for 40% of Curse Tyrant's attack.
> - Below 40% HP, Curse Tyrant opens Malevolent Shrine for 3 turns, causing every card on the field to take 15% max HP per turn.
> - Curse Tyrant heals for 30% of damage dealt by his attacks.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 40% | 44% | 48% | 52% | 56% | 60% | …· Every 3rd attack hits all enemy cards for 40% of Curse Tyrant's attack. · Below 40% HP, Curse… |
| 2 | 40% | 44% | 48% | 52% | 56% | 60% | …cards for 40% of Curse Tyrant's attack. · Below 40% HP, Curse Tyrant opens Malevolent Shrine for… |
| 3 | 15% | 16.5% | 18% | 19.5% | 21% | 22.5% | …turns, causing every card on the field to take 15% max HP per turn. · Curse Tyrant heals for 30%… |
| 4 | 30% | 33% | 36% | 39% | 42% | 45% | …15% max HP per turn. · Curse Tyrant heals for 30% of damage dealt by his attacks. |

**Hits that scale with this card's ATK:** Every 3rd attack (all) 40%

---

### Cursed Vessel

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 760 (760) · **Base HP:** 1.51K (1,510)

**Roles (wiki labels):** Nuker

**Ability: Divergent Fist**

> - On attack, leave cursed energy that explodes for 1.8x this card's current attack after 2 turns.
> - One detonation per card.

**Hits written as "X% damage" (probably of a normal attack):** Cursed energy detonation 180%

---

### Darkin Lord

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 3.52K (3,520) · **Base HP:** 7.04K (7,040)

**Traits:** Revive, Hits All, Pierce, Heal

**Roles (wiki labels):** Splash Damage, Healer, Cheat death

**Ability: The World Ender**

> - His attacks cycle: the 1st deals 150% damage, the 2nd deals 40% to every enemy, the 3rd pierces the enemy and the one behind it for 80% each.
> - Heals for 30% of all damage he deals.
> - The first time he dies, he revives with 40% damage reduction and heals for 60% of all damage he deals.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 150% | 165% | 180% | 195% | 210% | 225% | - His attacks cycle: the 1st deals 150% damage, the 2nd deals 40% to every enemy, the… |
| 2 | 40% | 44% | 48% | 52% | 56% | 60% | …cycle: the 1st deals 150% damage, the 2nd deals 40% to every enemy, the 3rd pierces the enemy and… |
| 3 | 80% | 88% | 96% | 104% | 112% | 120% | …pierces the enemy and the one behind it for 80% each. · Heals for 30% of all damage he deals.… |
| 4 | 30% | 33% | 36% | 39% | 42% | 45% | …the one behind it for 80% each. · Heals for 30% of all damage he deals. · The first time he dies,… |
| 5 | 40% | 44% | 48% | 52% | 56% | 60% | …deals. · The first time he dies, he revives with 40% damage reduction and heals for 60% of all damage… |
| 6 | 60% | 66% | 72% | 78% | 84% | 90% | …revives with 40% damage reduction and heals for 60% of all damage he deals. |

**Hits written as "X% damage" (probably of a normal attack):** 1st cycle attack 150%, 2nd cycle (all enemies) 40%, 3rd cycle pierce 80%

---

### Deadbeat Dad

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 10.9K (10,900) · **Base HP:** 21.8K (21,800)

**Roles (wiki labels):** Nuker

**Ability: Heavenly Restriction / Inverted Spear of Heaven**

> - Deadbeat Dad is immune to all status effects.
> - His attacks deal 1.5x damage to cards weaker than him.
> - Each attack has a 25% chance to target a random card in their party instead.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 25% | 27.5% | 30% | 32.5% | 35% | 37.5% | …to cards weaker than him. · Each attack has a 25% chance to target a random card in their party… |

---

### Deathless King

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 11.5K (11,500) · **Base HP:** 23.1K (23,100)

**Traits:** Shield, Heal, Entry Effect

**Roles (wiki labels):** Self-scaling, Debuffer, Tank, Healer

**Ability: Realm of Death**

> - On entry, drags a random enemy to the front and seals them both in his Realm: it loses its support and all help from its allies, and nothing outside can hit or heal either of them.
> - Each of his turns he steals 10% of its ATK and max HP (up to 75% of his starting stats in all).
> - If it dies in there, he keeps what he stole, his Iron fills up and the Realm reopens on the next strongest enemy.
>
> **Indestructible**
> - 50% of the damage he deals is stored as Iron, a shield of up to 50% of his max HP.
> - Under 50% HP, all of it turns into healing.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 10% | 11% | 12% | 13% | 14% | 15% | …either of them. · Each of his turns he steals 10% of its ATK and max HP (up to 75% of his starting… |
| 2 | 75% | 82.5% | 90% | 97.5% | 105% | 112.5% | …turns he steals 10% of its ATK and max HP (up to 75% of his starting stats in all). · If it dies in… |
| 3 | 50% | 55% | 60% | 65% | 70% | 75% | …on the next strongest enemy. Indestructible · 50% of the damage he deals is stored as Iron, a shield… |
| 4 | 50% | 55% | 60% | 65% | 70% | 75% | …he deals is stored as Iron, a shield of up to 50% of his max HP. · Under 50% HP, all of it turns… |
| 5 | 50% | 55% | 60% | 65% | 70% | 75% | …a shield of up to 50% of his max HP. · Under 50% HP, all of it turns into healing. |

---

### Defense Director

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 9.92K (9,920) · **Base HP:** 19.8K (19,800)

**Traits:** Heal

**Roles (wiki labels):** Tank, Self-scaling, Healer

**Ability: Veteran's Guard**

> - Takes 25% less damage from attacks, and the damage blocked is permanently added to its attack (up to 50% of its starting ATK per hit).
> - The first time below 35% HP, gain 50% attack and heal 10% max HP every turn for the rest of the battle.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 25% | 27.5% | 30% | 32.5% | 35% | 37.5% | - Takes 25% less damage from attacks, and the damage blocked… |
| 2 | 50% | 55% | 60% | 65% | 70% | 75% | …blocked is permanently added to its attack (up to 50% of its starting ATK per hit). · The first time… |
| 3 | 35% | 38.5% | 42% | 45.5% | 49% | 52.5% | …starting ATK per hit). · The first time below 35% HP, gain 50% attack and heal 10% max HP every… |
| 4 | 50% | 55% | 60% | 65% | 70% | 75% | …per hit). · The first time below 35% HP, gain 50% attack and heal 10% max HP every turn for the… |
| 5 | 10% | 11% | 12% | 13% | 14% | 15% | …time below 35% HP, gain 50% attack and heal 10% max HP every turn for the rest of the battle. |

---

### Demon Flame

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 6.45K (6,450) · **Base HP:** 12.9K (12,900)

**Traits:** Burn

**Roles (wiki labels):** Damage over time, Crowd control, Self-scaling

**Ability: Timefire**

> - His attacks Burn the target for 30% of his damage per turn for 2 turns.
> - While it Burns from him, it can't use its ability or support.
> - When he hits a Burning enemy, all its Burns go off at once and start over, and he gains +20% ATK for each Burn that went off.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 30% | 33% | 36% | 39% | 42% | 45% | - His attacks Burn the target for 30% of his damage per turn for 2 turns. · While it… |
| 2 | +20% | +22% | +24% | +26% | +28% | +30% | …go off at once and start over, and he gains +20% ATK for each Burn that went off. |

**Hits written as "X% damage" (probably of a normal attack):** Burn per turn 30%

---

### Demon General

Battle card · Rarity: unknown · Origin: Weather (Cataclysm)

**Base DMG:** 9.1K (9,100) · **Base HP:** 18.2K (18,200)

**Traits:** Hits All, Heal

**Roles (wiki labels):** Self-scaling, Splash Damage, Healer, Works from the bench

**Ability: Demonic Ascension**

> - Off the field, at the end of every round his ravens hit the enemy in front for 25% ATK and take a Soul.
> - On the field, each of his attacks takes a Soul.
> - Each Soul heals 5% max HP and adds +3% max HP permanently (up to +150%).
> - At 6 Souls he transforms for the rest of the battle and hits the enemy in front for all the max HP he has gained.
> - Transformed, his attacks deal 200% damage, and at the start of each of his turns he hits every enemy (bench included) for 50% of his ATK, heals for all the damage dealt and takes a Soul from each.
> - That damage is also stored: the next enemy to step onto the field takes all of it.
> - With one enemy left, that enemy takes it whenever the store reaches 300% of his ATK.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 25% | 27.5% | 30% | 32.5% | 35% | 37.5% | …round his ravens hit the enemy in front for 25% ATK and take a Soul. · On the field, each of… |
| 2 | 5% | 5.5% | 6% | 6.5% | 7% | 7.5% | …his attacks takes a Soul. · Each Soul heals 5% max HP and adds +3% max HP permanently (up to… |
| 3 | +3% | +3.3% | +3.6% | +3.9% | +4.2% | +4.5% | …a Soul. · Each Soul heals 5% max HP and adds +3% max HP permanently (up to +150%). · At 6 Souls… |
| 4 | +150% | +165% | +180% | +195% | +210% | +225% | …max HP and adds +3% max HP permanently (up to +150%). · At 6 Souls he transforms for the rest of… |
| 5 | 200% | 220% | 240% | 260% | 280% | 300% | …has gained. · Transformed, his attacks deal 200% damage, and at the start of each of his turns… |
| 6 | 50% | 55% | 60% | 65% | 70% | 75% | …turns he hits every enemy (bench included) for 50% of his ATK, heals for all the damage dealt and… |
| 7 | 300% | 330% | 360% | 390% | 420% | 450% | …that enemy takes it whenever the store reaches 300% of his ATK. |

**Hits that scale with this card's ATK:** Raven hit 25%, Transformed hit (all) 50%

**Hits written as "X% damage" (probably of a normal attack):** Transformed attack 200%

---

### Demon Slime

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 933 (933) · **Base HP:** 1.86K (1,860)

**Roles (wiki labels):** Self-scaling

**Ability: Predator: Gluttony**

> - On kill, absorb 25% of defeated card's stats permanently AND copy their ability for the rest of the battle.
> - Keeps the most recent copied ability.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 25% | 27.5% | 30% | 32.5% | 35% | 37.5% | - On kill, absorb 25% of defeated card's stats permanently AND copy… |

---

### Devil Hunter

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 4.15K (4,150) · **Base HP:** 8.3K (8,300)

**Traits:** Dodge

**Roles (wiki labels):** Evasion, Counter, Tank, Splash Damage

**Ability: Style Switching**

> Each turn cycles: Trickster (dodge next attack), Swordmaster (1.5x damage), Royalguard (take 50% less damage + counter for 30% of attack), Gunslinger (attack hits active card + next card in line for 40%).

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 50% | 55% | 60% | 65% | 70% | 75% | …Swordmaster (1.5x damage), Royalguard (take 50% less damage + counter for 30% of attack), Gunslinger… |
| 2 | 30% | 33% | 36% | 39% | 42% | 45% | …Royalguard (take 50% less damage + counter for 30% of attack), Gunslinger (attack hits active card… |
| 3 | 40% | 44% | 48% | 52% | 56% | 60% | …(attack hits active card + next card in line for 40%). |

**Hits that scale with this card's ATK:** Royalguard counter 30%

**Hits written as "X% damage" (probably of a normal attack):** Gunslinger splash 40%

---

### Divine Rivals

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 81.9K (81,900) · **Base HP:** 163K (163,000)

**Traits:** Hits All, Ignores Defense, Heal

**Roles (wiki labels):** Self-scaling, Nuker, Splash Damage, Healer

**Ability: Final Kamehameha**

> - +30% ATK every turn and +25% ATK whenever any card dies.
> - Fires a blast when it drops below 30% HP or on its 4th turn, whichever comes first: 200% ATK damage to every enemy (400% to the enemy in front), ignoring damage reduction.
> - If it fired below 30% HP, it heals 60% of its max HP.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | +30% | +33% | +36% | +39% | +42% | +45% | - +30% ATK every turn and +25% ATK whenever any card… |
| 2 | +25% | +27.5% | +30% | +32.5% | +35% | +37.5% | - +30% ATK every turn and +25% ATK whenever any card dies. · Fires a blast when… |
| 3 | 30% | 33% | 36% | 39% | 42% | 45% | …card dies. · Fires a blast when it drops below 30% HP or on its 4th turn, whichever comes first:… |
| 4 | 200% | 220% | 240% | 260% | 280% | 300% | …HP or on its 4th turn, whichever comes first: 200% ATK damage to every enemy (400% to the enemy… |
| 5 | 400% | 440% | 480% | 520% | 560% | 600% | …comes first: 200% ATK damage to every enemy (400% to the enemy in front), ignoring damage reduction.… |
| 6 | 30% | 33% | 36% | 39% | 42% | 45% | …ignoring damage reduction. · If it fired below 30% HP, it heals 60% of its max HP. |
| 7 | 60% | 66% | 72% | 78% | 84% | 90% | …reduction. · If it fired below 30% HP, it heals 60% of its max HP. |

**Hits that scale with this card's ATK:** Blast (all enemies) 200%

**Hits written as "X% damage" (probably of a normal attack):** Blast (front enemy) 400%

---

### Dragon Emperor

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 7.01K (7,010) · **Base HP:** 14K (14,000)

**Traits:** Stun, Death Effect

**Roles (wiki labels):** Tank, Crowd control, Death effect

**Ability: Dragon Form / Thunder Bagua**

> - Above 50% HP, Dragon Emperor takes 30% reduced damage.
> - Below 50% HP, he loses the reduction but gains 2x attack.
> - Every attack has a 25% chance to stun for 1 turn.
> - On death, Dragon Emperor deals 35% of his max HP to the card that defeated him.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 50% | 55% | 60% | 65% | 70% | 75% | - Above 50% HP, Dragon Emperor takes 30% reduced damage.… |
| 2 | 30% | 33% | 36% | 39% | 42% | 45% | - Above 50% HP, Dragon Emperor takes 30% reduced damage. · Below 50% HP, he loses the… |
| 3 | 50% | 55% | 60% | 65% | 70% | 75% | …Dragon Emperor takes 30% reduced damage. · Below 50% HP, he loses the reduction but gains 2x attack.… |
| 4 | 25% | 27.5% | 30% | 32.5% | 35% | 37.5% | …reduction but gains 2x attack. · Every attack has a 25% chance to stun for 1 turn. · On death, Dragon… |
| 5 | 35% | 38.5% | 42% | 45.5% | 49% | 52.5% | …for 1 turn. · On death, Dragon Emperor deals 35% of his max HP to the card that defeated him. |

---

### Dragon Girl

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 165 (165) · **Base HP:** 330 (330)

**Traits:** Heal, Entry Effect

**Roles (wiki labels):** Healer

**Ability: Sky Dragon's Roar**

> - On entry, increase this card's attack by 20% for the rest of the fight.
> - Heal 10% max HP every turn.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 20% | 22% | 24% | 26% | 28% | 30% | - On entry, increase this card's attack by 20% for the rest of the fight. · Heal 10% max HP… |
| 2 | 10% | 11% | 12% | 13% | 14% | 15% | …attack by 20% for the rest of the fight. · Heal 10% max HP every turn. |

---

### Dragon Sin

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 197 (197) · **Base HP:** 394 (394)

**Roles (wiki labels):** Counter

**Ability: Full Counter**

> When attacked, counter-attack dealing 30% of Dragon Sin's attack back to the attacker.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 30% | 33% | 36% | 39% | 42% | 45% | When attacked, counter-attack dealing 30% of Dragon Sin's attack back to the attacker. |

**Hits that scale with this card's ATK:** Counter hit 30%

---

### Dreamer

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 1.22K (1,220) · **Base HP:** 2.45K (2,450)

**Roles (wiki labels):** Crowd control, Debuffer

**Ability: Forced Slumber**

> - Every 3 turns, Dreamer puts the active enemy card to sleep for 1 turn.
> - Sleeping cards take 30% more damage.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 30% | 33% | 36% | 39% | 42% | 45% | …card to sleep for 1 turn. · Sleeping cards take 30% more damage. |

---

### Dumb Hair Guy

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 2.77K (2,770) · **Base HP:** 5.54K (5,540)

**Traits:** Heal

**Roles (wiki labels):** Self-scaling, Healer, Nuker

**Ability: Senzu Munch**

> - Heal 25% max HP every turn (won't stop eating).
> - Attacks deal 0.5x damage while eating.
> - Every 3 turns, finish the meal: an unmissable 4x strike, then gain 25% of its damage as Attack and 50% as max HP (up to 10x his stats).
> - Then starts eating again.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 25% | 27.5% | 30% | 32.5% | 35% | 37.5% | - Heal 25% max HP every turn (won't stop eating). · Attacks… |
| 2 | 25% | 27.5% | 30% | 32.5% | 35% | 37.5% | …the meal: an unmissable 4x strike, then gain 25% of its damage as Attack and 50% as max HP (up… |
| 3 | 50% | 55% | 60% | 65% | 70% | 75% | …strike, then gain 25% of its damage as Attack and 50% as max HP (up to 10x his stats). · Then starts… |

**Hits written as "X% damage" (probably of a normal attack):** Meal finisher strike 400%

---

### Dumb Nine-Tail Prodigy

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 2.39K (2,390) · **Base HP:** 4.78K (4,780)

**Traits:** Stun, Hits All, Entry Effect

**Roles (wiki labels):** Crowd control, Entry effect

**Ability: Multi Clone Mayhem**

> - On entry, stun every enemy: 2 turns if it has less attack than him, 1 turn if not.
> - Every 4 turns send another wave, stunning all enemies for 1 turn.

---

### Dumb Stretchy Guy

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 2.56K (2,560) · **Base HP:** 5.12K (5,120)

**Traits:** Hits All, Heal

**Roles (wiki labels):** Splash Damage, Counter, Healer

**Ability: Gomu Gomu no... Wait What?**

> Every attack triggers one of: Gum-Gum Balloon (reflect 50% damage from next hit), Gum-Gum Fireworks (hit all enemies for 50% of attack), or Gum-Gum Flop (miss but heal 40% max HP).

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 50% | 55% | 60% | 65% | 70% | 75% | …attack triggers one of: Gum-Gum Balloon (reflect 50% damage from next hit), Gum-Gum Fireworks (hit… |
| 2 | 50% | 55% | 60% | 65% | 70% | 75% | …hit), Gum-Gum Fireworks (hit all enemies for 50% of attack), or Gum-Gum Flop (miss but heal 40%… |
| 3 | 40% | 44% | 48% | 52% | 56% | 60% | …50% of attack), or Gum-Gum Flop (miss but heal 40% max HP). |

**Hits that scale with this card's ATK:** Gum-Gum Fireworks 50%

---

### Dumb Threeblade Ronin

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 2.19K (2,190) · **Base HP:** 4.39K (4,390)

**Traits:** Entry Effect

**Roles (wiki labels):** Splash Damage, Entry effect

**Ability: Three-Sword Confusion**

> - Threeblade Ronin is lost.
> - On entry, he accidentally attacks the enemy's entire lineup for 15% of his attack.
> - Every attack has a 30% chance to accidentally hit the enemy's next card too for full damage.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 15% | 16.5% | 18% | 19.5% | 21% | 22.5% | …accidentally attacks the enemy's entire lineup for 15% of his attack. · Every attack has a 30% chance… |
| 2 | 30% | 33% | 36% | 39% | 42% | 45% | …for 15% of his attack. · Every attack has a 30% chance to accidentally hit the enemy's next card… |

**Hits that scale with this card's ATK:** Entry hit (all enemies) 15%

---

### Eclipse Twins

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 605K (605,000) · **Base HP:** 1.21M (1,210,000)

**Traits:** Burn, Revive, Heal

**Roles (wiki labels):** Multi-hit, Damage over time, Healer, Cheat death

**Ability: Eclipse**

> **Moon Breathing**
> - Its first attack slashes 3 times, and every attack after that adds 1 more slash (max 6).
> - Each slash deals 40% damage.
>
> **Sun Breathing**
> - Every slash Burns the target for 8% of its attack every turn for 3 turns.
>
> **Demon Blood**
> - It heals for all the damage its Burns deal.
> - Its Burns stay on enemies after it dies.
>
> **Severing Strike**
> - When a slash kills a card, the rest of its slashes go on into the next enemy card.
> - The first time it would die, it returns at 50% HP.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 40% | 44% | 48% | 52% | 56% | 60% | …adds 1 more slash (max 6). · Each slash deals 40% damage. Sun Breathing · Every slash Burns the… |
| 2 | 8% | 8.8% | 9.6% | 10.4% | 11.2% | 12% | …Breathing · Every slash Burns the target for 8% of its attack every turn for 3 turns. Demon Blood… |
| 3 | 50% | 55% | 60% | 65% | 70% | 75% | …· The first time it would die, it returns at 50% HP. |

**Hits that scale with this card's ATK:** Burn per turn 8%

**Hits written as "X% damage" (probably of a normal attack):** Slash 40%

---

### Eight-Handled General

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 114K (114,000) · **Base HP:** 229K (229,000)

**Traits:** Heal

**Roles (wiki labels):** Tank, Healer, Cheat death

**Ability: Wheel of Adaptation**

> - Whenever an enemy hits him, his wheel spins once for that enemy: he heals 25% of his max HP, that enemy deals 20% less damage to him per spin, and he deals +100% damage to it per spin.
>
> **Adaptation**
> - Each kind of status from the enemy team works on him only once, for at most 1 turn.
>
> **Divine General**
> - The first hit from each enemy that would kill him leaves him at 1 HP and spins his wheel 3 times for that enemy.
> - As a boss enemy, his wheel's healing and damage cut are 50% as strong, and he deals +25% damage per spin.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 25% | 27.5% | 30% | 32.5% | 35% | 37.5% | …his wheel spins once for that enemy: he heals 25% of his max HP, that enemy deals 20% less damage… |
| 2 | 20% | 22% | 24% | 26% | 28% | 30% | …he heals 25% of his max HP, that enemy deals 20% less damage to him per spin, and he deals +100%… |
| 3 | +100% | +110% | +120% | +130% | +140% | +150% | …20% less damage to him per spin, and he deals +100% damage to it per spin. Adaptation · Each kind… |
| 4 | 50% | 55% | 60% | 65% | 70% | 75% | …enemy, his wheel's healing and damage cut are 50% as strong, and he deals +25% damage per spin. |
| 5 | +25% | +27.5% | +30% | +32.5% | +35% | +37.5% | …and damage cut are 50% as strong, and he deals +25% damage per spin. |

*Note: Cards can be Awakened (shown as "Awakened Lv 1/5" on the card). Each level makes the ability stronger: at Lv 1 it is 10% stronger, so the heal is 27.5% instead of 25% and the damage per spin +110% instead of +100%. This page shows the un-awakened (base) numbers.*

---

### Eternal Blight

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 30.7K (30,700) · **Base HP:** 61.4K (61,400)

**Traits:** One Per Party, Heal

**Roles (wiki labels):** Debuffer, Self-scaling

**Ability: Extinction Plague**

> - Attacks apply 1 Infection.
> - Whenever an enemy heals, it takes that amount as damage instead and gains 1 Infection.
> - At the end of each turn, 2 random enemies are infected.
> - Every 2 stacks of Infection lower its ATK and max HP by 20%.
> - When an infected enemy dies, every ally it had gains 1 Infection.
> - Gains 25% of its starting ATK and max HP for each dead enemy.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 20% | 22% | 24% | 26% | 28% | 30% | …stacks of Infection lower its ATK and max HP by 20%. · When an infected enemy dies, every ally it… |
| 2 | 25% | 27.5% | 30% | 32.5% | 35% | 37.5% | …every ally it had gains 1 Infection. · Gains 25% of its starting ATK and max HP for each dead… |

---

### Fabled Soldier

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 3.25K (3,250) · **Base HP:** 6.5K (6,500)

**Traits:** Entry Effect

**Roles (wiki labels):** Execute, Entry effect

**Ability: Supernova**

> - On entry, if the enemy's active card has less current HP than 20% of Fabled Soldier's attack stat, instantly destroy it.
> - Attacks deal 1.3x base damage.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 20% | 22% | 24% | 26% | 28% | 30% | …enemy's active card has less current HP than 20% of Fabled Soldier's attack stat, instantly destroy… |

---

### Faceless Prophet

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 491K (491,000) · **Base HP:** 983K (983,000)

**Traits:** One Per Party, Stun, Hits All, Ignores Defense, Death Effect

**Roles (wiki labels):** Crowd control, Self-scaling, Death effect, Splash Damage

**Ability: The Book of Prophecy**

> **The Chosen Ones**
> - Each turn, a random enemy betrays its own team (up to 300% of this card's ATK, 500% during the Blessing).
>
> **Faith**
> - +50% base stats each (max 8), gained from each betrayal while this card is fighting and whenever a chosen one kills its ally.
> - A betrayal kill reveals The Savior: enemies gain +25% ATK for 3 turns.
> - When the Blessing ends, Blessed enemies are Stunned for 1 turn and the next attack gains +50% damage per Faith.
> - On death, becomes a non-attacking Doomsday Clock with 100% max HP: destroy it within 4 turns or all enemies take 500% ATK damage, bypassing defenses.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 300% | 330% | 360% | 390% | 420% | 450% | …turn, a random enemy betrays its own team (up to 300% of this card's ATK, 500% during the Blessing).… |
| 2 | 500% | 550% | 600% | 650% | 700% | 750% | …its own team (up to 300% of this card's ATK, 500% during the Blessing). Faith · +50% base stats… |
| 3 | +50% | +55% | +60% | +65% | +70% | +75% | …card's ATK, 500% during the Blessing). Faith · +50% base stats each (max 8), gained from each betrayal… |
| 4 | +25% | +27.5% | +30% | +32.5% | +35% | +37.5% | …betrayal kill reveals The Savior: enemies gain +25% ATK for 3 turns. · When the Blessing ends, Blessed… |
| 5 | +50% | +55% | +60% | +65% | +70% | +75% | …Stunned for 1 turn and the next attack gains +50% damage per Faith. · On death, becomes a non-attacking… |
| 6 | 100% | 110% | 120% | 130% | 140% | 150% | …becomes a non-attacking Doomsday Clock with 100% max HP: destroy it within 4 turns or all enemies… |
| 7 | 500% | 550% | 600% | 650% | 700% | 750% | …destroy it within 4 turns or all enemies take 500% ATK damage, bypassing defenses. |

**Hits that scale with this card's ATK:** Betrayal hit 300%, Betrayal hit (Blessing) 500%, Doomsday Clock 500%

---

### Feral Hound

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 21.1K (21,100) · **Base HP:** 42.2K (42,200)

**Traits:** Lifesteal

**Roles (wiki labels):** Nuker, Healer, Cheat death

**Ability: Wild Hunt**

> **Wild Hunt**
> - Her attacks deal +45% damage for every 10% of her max HP she has lost.
>
> **Savage Feast**
> - While below 50% HP, she heals for 40% of the damage she deals.
>
> **Beast's Grit**
> - The first 3 times she would die, she stays alive with 15% of her max HP.
> - As a boss enemy, Beast's Grit saves her only once.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | +45% | +49.5% | +54% | +58.5% | +63% | +67.5% | Wild Hunt · Her attacks deal +45% damage for every 10% of her max HP she has lost.… |
| 2 | 10% | 11% | 12% | 13% | 14% | 15% | …Hunt · Her attacks deal +45% damage for every 10% of her max HP she has lost. Savage Feast · While… |
| 3 | 50% | 55% | 60% | 65% | 70% | 75% | …HP she has lost. Savage Feast · While below 50% HP, she heals for 40% of the damage she deals.… |
| 4 | 40% | 44% | 48% | 52% | 56% | 60% | …Savage Feast · While below 50% HP, she heals for 40% of the damage she deals. Beast's Grit · The first… |
| 5 | 15% | 16.5% | 18% | 19.5% | 21% | 22.5% | …3 times she would die, she stays alive with 15% of her max HP. · As a boss enemy, Beast's Grit… |

---

### Final Juggernaut

Battle card · Rarity: unknown · Origin: Weather (Cataclysm)

**Base DMG:** 7.13K (7,130) · **Base HP:** 14.2K (14,200)

**Traits:** Stun, Revive, Can't Miss

**Roles (wiki labels):** Self-scaling, Cheat death, Crowd control

**Ability: Glory in Death**

> - Every hit he takes permanently raises his max HP by 5% of the damage.
> - Each kill raises it by 30% of his base max HP.
> - His attacks deal bonus damage equal to 25% of his bonus max HP.
> - The first time he dies, he rises undead: his ATK and max HP swap, and for 3 turns he can't drop below 1 HP.
> - Each kill adds a turn.
> - His first attack after rising can't be dodged or blocked and stuns its target for 1 turn.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 5% | 5.5% | 6% | 6.5% | 7% | 7.5% | …hit he takes permanently raises his max HP by 5% of the damage. · Each kill raises it by 30% of… |
| 2 | 30% | 33% | 36% | 39% | 42% | 45% | …by 5% of the damage. · Each kill raises it by 30% of his base max HP. · His attacks deal bonus… |
| 3 | 25% | 27.5% | 30% | 32.5% | 35% | 37.5% | …HP. · His attacks deal bonus damage equal to 25% of his bonus max HP. · The first time he dies,… |

---

### Fire Fist

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 75.6K (75,600) · **Base HP:** 151K (151,000)

**Traits:** One Per Party, Once Per Battle, Burn, Entry Effect

**Roles (wiki labels):** Splash Damage, Damage over time, Team support, Entry effect

**Ability: Fireflies / Brother's Shield**

> **Fireflies**
> - On entry, 5 fireflies drift onto random enemies (bench included), and 3 more after each of his attacks.
> - Any card that hits him gets one too.
> - Every 3rd attack, and when he dies, he snaps his fingers and every firefly explodes for 125% of his ATK and sets its card on fire: Burn for 50% of his ATK per turn for 2 turns.
>
> **Brother's Shield**
> - Once per battle, when an ally would die from a hit, Fire Fist jumps in front and takes it instead.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 125% | 137.5% | 150% | 162.5% | 175% | 187.5% | …snaps his fingers and every firefly explodes for 125% of his ATK and sets its card on fire: Burn for… |
| 2 | 50% | 55% | 60% | 65% | 70% | 75% | …his ATK and sets its card on fire: Burn for 50% of his ATK per turn for 2 turns. Brother's Shield… |

**Hits that scale with this card's ATK:** Firefly explosion 125%, Burn per turn 50%

---

### First Sunblade

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 89.5K (89,500) · **Base HP:** 179K (179,000)

**Traits:** One Per Party, Burn

**Roles (wiki labels):** Damage over time, Debuffer, Multi-hit

**Ability: Sun Scars / Thirteenth Form**

> **Sun Scars**
> - Every hit he lands leaves a Sun Scar that never fades.
> - A scarred card can't heal or come back to life, and it burns for 200% of his ATK per scar at the end of every turn, even after he's gone.
>
> **Thirteenth Form**
> - Whenever he kills a card, he flows straight into the next form and attacks the next enemy in the same turn.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 200% | 220% | 240% | 260% | 280% | 300% | …heal or come back to life, and it burns for 200% of his ATK per scar at the end of every turn,… |

**Hits that scale with this card's ATK:** Burn per scar 200%

---

### Flame Colonel

Battle card · Rarity: 1 in 6B · Origin: Card pack (Forged Pack)

**Base DMG:** 10.9K (10,900) · **Base HP:** 21.9K (21,900)

**Traits:** Entry Effect

**Roles (wiki labels):** Crowd control, Nuker, Cheat death, Entry effect

**Ability: Flame Alchemy**

> **Oxygen Theft**
> - On entry, he hits the enemy in front for 50% of his ATK and it loses its ability for 2 turns.
>
> **Wildfire**
> - When he kills an enemy, the next enemy to enter takes the same hit and loses its ability for 2 turns.
>
> **Flame Alchemy**
> - His attacks on enemies that have lost their ability deal bonus damage equal to 100% of his starting ATK.
>
> **Cauterize**
> - The first time he would die, he stays at 1 HP and his next attack deals 500% of its normal damage.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 50% | 55% | 60% | 65% | 70% | 75% | …Theft · On entry, he hits the enemy in front for 50% of his ATK and it loses its ability for 2 turns.… |
| 2 | 100% | 110% | 120% | 130% | 140% | 150% | …lost their ability deal bonus damage equal to 100% of his starting ATK. Cauterize · The first time… |
| 3 | 500% | 550% | 600% | 650% | 700% | 750% | …die, he stays at 1 HP and his next attack deals 500% of its normal damage. |

**Hits that scale with this card's ATK:** Entry hit 50%, Bonus vs silenced 100%

---

### Frost Rookie

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 8.31K (8,310) · **Base HP:** 16.6K (16,600)

**Traits:** Freeze

**Roles (wiki labels):** Crowd control

**Ability: Frost Combo**

> - When this card attacks the same enemy twice, freeze that enemy for 1 turn.
> - This card deals 200% damage to frozen cards.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 200% | 220% | 240% | 260% | 280% | 300% | …freeze that enemy for 1 turn. · This card deals 200% damage to frozen cards. |

---

### Frost Wizard

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 218 (218) · **Base HP:** 436 (436)

**Roles (wiki labels):** Multi-hit

**Ability: Ice Make: Eagle**

> Attacks hit twice (second hit at 40% damage).

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 40% | 44% | 48% | 52% | 56% | 60% | Attacks hit twice (second hit at 40% damage). |

---

### Frostbane

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 267 (267) · **Base HP:** 534 (534)

**Traits:** Freeze, Entry Effect

**Roles (wiki labels):** Crowd control, Entry effect

**Ability: Spine Rip Combo**

> - On entry, freeze enemy for 2 turns.
> - Every attack that hits a frozen target deals 1.5x damage.

---

### Full-Borg Enforcer

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 39.4K (39,400) · **Base HP:** 78.9K (78,900)

**Traits:** Revive

**Roles (wiki labels):** Tank, Splash Damage, Cheat death

**Ability: Full Chrome**

> - Full-Borg Enforcer takes 40% less damage from attacks and can't be Stunned or Silenced.
> - His attacks deal extra damage equal to 40% of his max HP.
> - After each of his attacks, his launcher fires 3 missiles at random enemy cards (bench included) for 50% damage each.
>
> **Reboot**
> - The first time he would die, he returns at 60% HP with 50% more attack and fires 10 missiles at once.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 40% | 44% | 48% | 52% | 56% | 60% | - Full-Borg Enforcer takes 40% less damage from attacks and can't be Stunned… |
| 2 | 40% | 44% | 48% | 52% | 56% | 60% | …Silenced. · His attacks deal extra damage equal to 40% of his max HP. · After each of his attacks, his… |
| 3 | 50% | 55% | 60% | 65% | 70% | 75% | …missiles at random enemy cards (bench included) for 50% damage each. Reboot · The first time he would… |
| 4 | 60% | 66% | 72% | 78% | 84% | 90% | …· The first time he would die, he returns at 60% HP with 50% more attack and fires 10 missiles… |
| 5 | 50% | 55% | 60% | 65% | 70% | 75% | …time he would die, he returns at 60% HP with 50% more attack and fires 10 missiles at once. |

**Hits written as "X% damage" (probably of a normal attack):** Missile 50%

---

### Galactic Tyrant

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 519 (519) · **Base HP:** 1.03K (1,030)

**Traits:** Ignores Defense

**Roles (wiki labels):** Self-scaling, Splash Damage, Tank

**Ability: Golden Evolution / Death Beam**

> - Every 3rd attack becomes a Death Beam, ignoring damage reduction and hitting the enemy's next card as well.
> - Below 50% HP, Galactic Tyrant transforms into Golden Galactic Tyrant, gaining 70% attack and 25% damage reduction for the rest of the battle.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 50% | 55% | 60% | 65% | 70% | 75% | …hitting the enemy's next card as well. · Below 50% HP, Galactic Tyrant transforms into Golden Galactic… |
| 2 | 70% | 77% | 84% | 91% | 98% | 105% | …transforms into Golden Galactic Tyrant, gaining 70% attack and 25% damage reduction for the rest… |
| 3 | 25% | 27.5% | 30% | 32.5% | 35% | 37.5% | …Golden Galactic Tyrant, gaining 70% attack and 25% damage reduction for the rest of the battle. |

---

### Gamer Captain

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 17.8K (17,800) · **Base HP:** 35.6K (35,600)

**Traits:** Shield

**Roles (wiki labels):** Multi-hit, Tank

**Ability: Rapid Follow-Up**

> When this card kills an enemy, he immediately hits the next enemy for 150% damage and gains a shield that blocks one hit until the end of the enemy's next turn.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 150% | 165% | 180% | 195% | 210% | 225% | …enemy, he immediately hits the next enemy for 150% damage and gains a shield that blocks one hit… |

**Hits written as "X% damage" (probably of a normal attack):** Follow-up hit 150%

---

### Gentle Fist Heiress

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 11.5K (11,500) · **Base HP:** 23.1K (23,100)

**Roles (wiki labels):** Crowd control, Debuffer, Works from the bench

**Ability: Encore**

> - Every time your team silences an enemy, every other enemy also loses its ability for 2 turns on their entry.
> - Silenced enemies take 15% more damage from your team.
> - Works from anywhere in your party.
> - Copies don't stack.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 15% | 16.5% | 18% | 19.5% | 21% | 22.5% | …turns on their entry. · Silenced enemies take 15% more damage from your team. · Works from anywhere… |

---

### Ghost Netrunner

Battle card · Rarity: 1 in 1.2B · Origin: Card pack (Forged Pack)

**Base DMG:** 6.76K (6,760) · **Base HP:** 13.5K (13,500)

**Traits:** Entry Effect

**Roles (wiki labels):** Debuffer, Entry effect, Works from the bench

**Ability: Breach Protocol**

> **Breach Protocol**
> - On entry, every enemy takes 25% more damage from your team for the rest of the battle.
>
> **Daemons**
> - Every hit your cards land adds a Daemon to the enemy, each +5% damage taken from your team (max 6).
>
> **Flatline**
> - When an enemy with Daemons dies, its Daemons move to the next enemy.
> - Daemons and Flatline work while she's alive anywhere in your party.
> - Copies don't stack.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 25% | 27.5% | 30% | 32.5% | 35% | 37.5% | Breach Protocol · On entry, every enemy takes 25% more damage from your team for the rest of the… |
| 2 | +5% | +5.5% | +6% | +6.5% | +7% | +7.5% | …cards land adds a Daemon to the enemy, each +5% damage taken from your team (max 6). Flatline… |

---

### Glitched Entity

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 2.09K (2,090) · **Base HP:** 4.18K (4,180)

**Traits:** Immune, Entry Effect

**Roles (wiki labels):** Debuffer, Entry effect, Self-scaling

**Ability: Corrupted Data**

> - On entry, duplicate this card's stats (2x stats).
> - Every attack corrupts the enemy: permanently reduce their max HP by 8% (stacking).
> - Glitched Entity is immune to status effects.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 8% | 8.8% | 9.6% | 10.4% | 11.2% | 12% | …the enemy: permanently reduce their max HP by 8% (stacking). · Glitched Entity is immune to status… |

---

### God Muncher

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 25 (25) · **Base HP:** 49 (49)

**Traits:** Heal

**Roles (wiki labels):** Healer, Tank

**Ability: Predator Instinct**

> Heal 15% max HP every time this card is attacked.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 15% | 16.5% | 18% | 19.5% | 21% | 22.5% | Heal 15% max HP every time this card is attacked. |

---

### Golden Requiem

Battle card · Rarity: 1 in 300Qa · Origin: unknown

**Base DMG:** 2.73M (2,730,000) · **Base HP:** 5.47M (5,470,000)

**Traits:** One Per Party, Stun, Ignores Defense, Heal

**Roles (wiki labels):** Counter, Nuker, Healer, Debuffer

**Ability: Return to Zero**

> - Return to Zero: enemy abilities aimed at him do nothing, and every 3rd attack aimed at him is reset to zero and never happens: it comes back on its owner for 500% of his ATK and Stuns it for 1 turn.
>
> **Life Giver**
> - At the start of each of his turns he heals 10% of his max HP and every enemy's ATK is set back to where it started (not a boss's).
>
> **Requiem**
> - Every attack he makes deals 500% damage that ignores damage reduction.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 500% | 550% | 600% | 650% | 700% | 750% | …never happens: it comes back on its owner for 500% of his ATK and Stuns it for 1 turn. Life Giver… |
| 2 | 10% | 11% | 12% | 13% | 14% | 15% | …· At the start of each of his turns he heals 10% of his max HP and every enemy's ATK is set back… |
| 3 | 500% | 550% | 600% | 650% | 700% | 750% | …boss's). Requiem · Every attack he makes deals 500% damage that ignores damage reduction. |

**Hits that scale with this card's ATK:** Return to Zero 500%, Requiem attack 500%

---

### Green Beast

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 160 (160) · **Base HP:** 320 (320)

**Roles (wiki labels):** Self-scaling

**Ability: Eight Gates**

> - Each attack opens a gate: +15% attack, up to 5 gates.
> - With all 5 open, each attack costs 8% of his max HP.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | +15% | +16.5% | +18% | +19.5% | +21% | +22.5% | - Each attack opens a gate: +15% attack, up to 5 gates. · With all 5 open, each… |
| 2 | 8% | 8.8% | 9.6% | 10.4% | 11.2% | 12% | …gates. · With all 5 open, each attack costs 8% of his max HP. |

---

### Green Day

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 10.6K (10,600) · **Base HP:** 21.3K (21,300)

**Traits:** One Per Party, Poison

**Roles (wiki labels):** Damage over time, Debuffer, Death effect

**Ability: Mold**

> **Mold**
> - Every attack poisons its target for 3 turns (5% a turn).
> - The lower you go, the faster it grows: his attacks deal up to +100% damage, the more HP the target is missing.
> - When a card he molded dies, the mold moves into the next enemy that comes in.
> - When he dies, his spores mold every enemy.
>
> **Rot**
> - A card with his poison on it deals 45% less damage.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 5% | 5.5% | 6% | 6.5% | 7% | 7.5% | …Every attack poisons its target for 3 turns (5% a turn). · The lower you go, the faster it grows:… |
| 2 | +100% | +110% | +120% | +130% | +140% | +150% | …the faster it grows: his attacks deal up to +100% damage, the more HP the target is missing. ·… |
| 3 | 45% | 49.5% | 54% | 58.5% | 63% | 67.5% | …enemy. Rot · A card with his poison on it deals 45% less damage. |

---

### Half Demon

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 177 (177) · **Base HP:** 354 (354)

**Roles (wiki labels):** Nuker, Splash Damage

**Ability: Wind Scar**

> Every 3rd attack, unleash Wind Scar: deal 2x damage to the active enemy and 30% damage to the next card in their lineup.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 30% | 33% | 36% | 39% | 42% | 45% | …Scar: deal 2x damage to the active enemy and 30% damage to the next card in their lineup. |

**Hits written as "X% damage" (probably of a normal attack):** Wind Scar hit 200%, Wind Scar splash 30%

---

### Hand of Conquest

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 5.79K (5,790) · **Base HP:** 11.5K (11,500)

**Traits:** Hits All, Heal

**Roles (wiki labels):** Splash Damage, Self-scaling, Healer

**Ability: Conqueror**

> - His first kill gives +25% ATK, and every kill after it +10% more.
> - His attacks inflict Hemorrhage: those enemies take more damage from him the lower their HP, up to +25% below 25% HP.
> - Whenever an enemy falls below 50% HP (once per enemy), he swings his axe at every enemy for 75% ATK and heals 25% of the damage dealt.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | +25% | +27.5% | +30% | +32.5% | +35% | +37.5% | - His first kill gives +25% ATK, and every kill after it +10% more. · His… |
| 2 | +10% | +11% | +12% | +13% | +14% | +15% | …kill gives +25% ATK, and every kill after it +10% more. · His attacks inflict Hemorrhage: those… |
| 3 | +25% | +27.5% | +30% | +32.5% | +35% | +37.5% | …more damage from him the lower their HP, up to +25% below 25% HP. · Whenever an enemy falls below… |
| 4 | 25% | 27.5% | 30% | 32.5% | 35% | 37.5% | …from him the lower their HP, up to +25% below 25% HP. · Whenever an enemy falls below 50% HP (once… |
| 5 | 50% | 55% | 60% | 65% | 70% | 75% | …below 25% HP. · Whenever an enemy falls below 50% HP (once per enemy), he swings his axe at every… |
| 6 | 75% | 82.5% | 90% | 97.5% | 105% | 112.5% | …enemy), he swings his axe at every enemy for 75% ATK and heals 25% of the damage dealt. |
| 7 | 25% | 27.5% | 30% | 32.5% | 35% | 37.5% | …his axe at every enemy for 75% ATK and heals 25% of the damage dealt. |

**Hits that scale with this card's ATK:** Axe swing (all) 75%

---

### Havoc Wreaker

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 4.21K (4,210) · **Base HP:** 8.43K (8,430)

**Traits:** Stun, Hits All

**Roles (wiki labels):** Crowd control, Splash Damage, Multi-hit

**Ability: Super Mega Death Rocket**

> - Enemies that come onto the field while she's on it are stunned for 2 turns.
> - Every 3rd attack, she fires a rocket that hits every enemy for 85% of her attack.
> - When she kills an enemy, she attacks the next one as it comes in.
> - A kill from that extra attack doesn't trigger it again.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 85% | 93.5% | 102% | 110.5% | 119% | 127.5% | …she fires a rocket that hits every enemy for 85% of her attack. · When she kills an enemy, she… |

**Hits that scale with this card's ATK:** Rocket (all enemies) 85%

---

### Hawkeye Sniper

Battle card · Rarity: 1 in 2B · Origin: Card pack (Forged Pack)

**Base DMG:** 7.88K (7,880) · **Base HP:** 15.7K (15,700)

**Traits:** Can't Miss

**Roles (wiki labels):** Works from the bench, Nuker, Counter

**Ability: Overwatch**

> **Overwatch**
> - While she's not in front, at the end of every round she shoots the enemy in front for 75% of her ATK.
>
> **Hawk's Eye**
> - Every 3rd shot is a headshot for 300% of her ATK.
>
> **Covering Fire**
> - When another of your cards dies, she shoots its killer.
> - Her shots are attacks that can't be dodged.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 75% | 82.5% | 90% | 97.5% | 105% | 112.5% | …every round she shoots the enemy in front for 75% of her ATK. Hawk's Eye · Every 3rd shot is a… |
| 2 | 300% | 330% | 360% | 390% | 420% | 450% | …Hawk's Eye · Every 3rd shot is a headshot for 300% of her ATK. Covering Fire · When another of your… |

**Hits that scale with this card's ATK:** Overwatch shot 75%, Headshot 300%

---

### Height of Painting

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 1.84K (1,840) · **Base HP:** 3.67K (3,670)

**Traits:** Stun, Ignores Defense, Heal, Entry Effect

**Roles (wiki labels):** Tank, Nuker, Self-scaling, Crowd control

**Ability: Twilight of Valhalla**

> - On entry, Height of Painting paints Twilight of Valhalla for 4 turns.
> - While it is active, she takes 40% reduced damage, gains 15% attack every turn, and cannot fall below 1 HP.
> - When the painting ends, she heals 40% max HP.
> - Every 3rd attack becomes Masterpiece, dealing 3x damage, ignoring damage reduction, and stunning the enemy for 1 turn.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 40% | 44% | 48% | 52% | 56% | 60% | …for 4 turns. · While it is active, she takes 40% reduced damage, gains 15% attack every turn,… |
| 2 | 15% | 16.5% | 18% | 19.5% | 21% | 22.5% | …active, she takes 40% reduced damage, gains 15% attack every turn, and cannot fall below 1 HP.… |
| 3 | 40% | 44% | 48% | 52% | 56% | 60% | …below 1 HP. · When the painting ends, she heals 40% max HP. · Every 3rd attack becomes Masterpiece,… |

**Hits written as "X% damage" (probably of a normal attack):** Masterpiece hit 300%

---

### Hextech Brawler

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 3.2K (3,200) · **Base HP:** 6.4K (6,400)

**Traits:** Stun, Ignores Defense, Can't Miss, Shield

**Roles (wiki labels):** Nuker, Crowd control, Tank

**Ability: Vault Breaker**

> **Blast Shield**
> - A shield blocks the first 2 hits she takes.
>
> **Vault Breaker**
> - Her first attack and every other attack after it deal 250% damage, ignore damage reduction, stun the target for 1 turn and can't be dodged or blocked.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 250% | 275% | 300% | 325% | 350% | 375% | …attack and every other attack after it deal 250% damage, ignore damage reduction, stun the target… |

**Hits written as "X% damage" (probably of a normal attack):** Vault Breaker hit 250%

---

### Hollow Armor

Battle card · Rarity: 1 in 4B · Origin: Card pack (Forged Pack)

**Base DMG:** 9.71K (9,710) · **Base HP:** 19.4K (19,400)

**Traits:** Heal

**Roles (wiki labels):** Tank, Cheat death, Healer

**Ability: Blood Seal**

> **Empty Armor**
> - +100% max HP.
> - His attacks deal bonus damage equal to 20% of his max HP.
>
> **Blood Seal**
> - 2 times per battle, when he would die while no card in your party has more max HP (fallen ones included), he survives, gains +25% max HP and heals to 50% of his max HP.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | +100% | +110% | +120% | +130% | +140% | +150% | Empty Armor · +100% max HP. · His attacks deal bonus damage equal… |
| 2 | 20% | 22% | 24% | 26% | 28% | 30% | …HP. · His attacks deal bonus damage equal to 20% of his max HP. Blood Seal · 2 times per battle,… |
| 3 | +25% | +27.5% | +30% | +32.5% | +35% | +37.5% | …HP (fallen ones included), he survives, gains +25% max HP and heals to 50% of his max HP. |
| 4 | 50% | 55% | 60% | 65% | 70% | 75% | …he survives, gains +25% max HP and heals to 50% of his max HP. |

---

### Hollow Bat

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 16.6K (16,600) · **Base HP:** 33.2K (33,200)

**Traits:** Pierce, Can't Miss, Heal

**Roles (wiki labels):** Nuker, Splash Damage, Self-scaling, Healer

**Ability: Light Spear**

> - Every 4th turn, Hollow Bat throws a Light Spear for 3.5x damage that cannot be dodged and pierces the card behind for 50% damage.
> - Below 50% HP, or when a hit would kill him, he spreads his wings once: 75% more attack and max HP, and he heals 12% max HP every turn.
> - After that, the spear comes every 3rd turn and also hits all other enemy cards for 100% damage.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 50% | 55% | 60% | 65% | 70% | 75% | …cannot be dodged and pierces the card behind for 50% damage. · Below 50% HP, or when a hit would kill… |
| 2 | 50% | 55% | 60% | 65% | 70% | 75% | …pierces the card behind for 50% damage. · Below 50% HP, or when a hit would kill him, he spreads… |
| 3 | 75% | 82.5% | 90% | 97.5% | 105% | 112.5% | …hit would kill him, he spreads his wings once: 75% more attack and max HP, and he heals 12% max… |
| 4 | 12% | 13.2% | 14.4% | 15.6% | 16.8% | 18% | …once: 75% more attack and max HP, and he heals 12% max HP every turn. · After that, the spear comes… |
| 5 | 100% | 110% | 120% | 130% | 140% | 150% | …turn and also hits all other enemy cards for 100% damage. |

**Hits written as "X% damage" (probably of a normal attack):** Light Spear 350%, Spear pierce 50%, Spear splash (evolved) 100%

---

### Hollow Shinobi

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 37.8K (37,800) · **Base HP:** 75.6K (75,600)

**Traits:** Burn, Can't Miss

**Roles (wiki labels):** Self-scaling, Cheat death, Damage over time

**Ability: Hollow Body**

> - His attacks deal 25% more damage for every 10% of his HP that's missing.
> - The first time he would die, he stays at 1 HP and burns the card that hit him for 25% of his attack every turn for 3 turns.
> - His attacks can't be dodged.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 25% | 27.5% | 30% | 32.5% | 35% | 37.5% | - His attacks deal 25% more damage for every 10% of his HP that's missing.… |
| 2 | 10% | 11% | 12% | 13% | 14% | 15% | - His attacks deal 25% more damage for every 10% of his HP that's missing. · The first time he… |
| 3 | 25% | 27.5% | 30% | 32.5% | 35% | 37.5% | …at 1 HP and burns the card that hit him for 25% of his attack every turn for 3 turns. · His attacks… |

**Hits that scale with this card's ATK:** Burn per turn 25%

---

### Hotheaded Gunner

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 8.78K (8,780) · **Base HP:** 17.5K (17,500)

**Traits:** Dodge

**Roles (wiki labels):** Self-scaling, Evasion, Works from the bench

**Ability: For Fallen Comrades**

> Whenever an allied card dies, even while this card is on the bench, gain 25% attack and 15% dodge chance (max 75%).

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 25% | 27.5% | 30% | 32.5% | 35% | 37.5% | …dies, even while this card is on the bench, gain 25% attack and 15% dodge chance (max 75%). |
| 2 | 15% | 16.5% | 18% | 19.5% | 21% | 22.5% | …this card is on the bench, gain 25% attack and 15% dodge chance (max 75%). |
| 3 | 75% | 82.5% | 90% | 97.5% | 105% | 112.5% | …bench, gain 25% attack and 15% dodge chance (max 75%). |

---

### Ice Queen

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 1.07K (1,070) · **Base HP:** 2.14K (2,140)

**Traits:** Freeze

**Roles (wiki labels):** Crowd control

**Ability: Mahapadma — Time Freeze**

> - On enemy entry, freeze them for 1 turn.
> - Attacks have 25% chance to freeze for 1 turn.
> - Ice Queen deals 1.3x damage to frozen targets.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 25% | 27.5% | 30% | 32.5% | 35% | 37.5% | …entry, freeze them for 1 turn. · Attacks have 25% chance to freeze for 1 turn. · Ice Queen deals… |

---

### Ice Reaper

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 243 (243) · **Base HP:** 485 (485)

**Traits:** Freeze, Death Effect

**Roles (wiki labels):** Crowd control, Debuffer, Death effect

**Ability: Final Frost**

> When Ice Reaper dies, freeze the enemy card for 3 turns and reduce their attack by 30% permanently.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 30% | 33% | 36% | 39% | 42% | 45% | …card for 3 turns and reduce their attack by 30% permanently. |

---

### Immortal Beast

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 1.09K (1,090) · **Base HP:** 2.19K (2,190)

**Traits:** Heal

**Roles (wiki labels):** Self-scaling, Tank, Healer

**Ability: Nosferatu Transformation**

> - Start at 1.2x stats.
> - Below 50% HP, transform to apostle form: 2x attack, 30% damage reduction.
> - On kill in apostle form, heal 25% max HP.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 50% | 55% | 60% | 65% | 70% | 75% | - Start at 1.2x stats. · Below 50% HP, transform to apostle form: 2x attack, 30%… |
| 2 | 30% | 33% | 36% | 39% | 42% | 45% | …50% HP, transform to apostle form: 2x attack, 30% damage reduction. · On kill in apostle form,… |
| 3 | 25% | 27.5% | 30% | 32.5% | 35% | 37.5% | …damage reduction. · On kill in apostle form, heal 25% max HP. |

---

### Immortal Vampire

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 298 (298) · **Base HP:** 595 (595)

**Traits:** Stun, Can't Miss, Heal, Entry Effect

**Roles (wiki labels):** Crowd control, Healer, Entry effect

**Ability: The World: Time Stop**

> - On entry and every 4 turns, Immortal Vampire stops time and stuns the active enemy for 2 turns.
> - Immortal Vampire's attacks during stopped time cannot be dodged.
> - When Immortal Vampire defeats a card, he drains its blood and heals 25% max HP.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 25% | 27.5% | 30% | 32.5% | 35% | 37.5% | …defeats a card, he drains its blood and heals 25% max HP. |

---

### Immortal Witch

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 10.2K (10,200) · **Base HP:** 20.5K (20,500)

**Roles (wiki labels):** Team support, Works from the bench

**Ability: Immortal Contract**

> - Each time a card on your team dies or comes back to life, all your cards gain +15% stats (up to 3 times).
> - Works from anywhere in your party.
> - Copies don't stack.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | +15% | +16.5% | +18% | +19.5% | +21% | +22.5% | …dies or comes back to life, all your cards gain +15% stats (up to 3 times). · Works from anywhere… |

---

### Ink Anamloy

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 1.71K (1,710) · **Base HP:** 3.42K (3,420)

**Traits:** Stun, Revive, Heal, Death Effect

**Roles (wiki labels):** Tank, Debuffer, Healer, Cheat death

**Ability: The Ink Demon**

> - Ink Anamloy takes 30% reduced damage.
> - Attacks apply Ink Corruption, permanently reducing the enemy's attack by 10%, stacking up to 5 times.
> - Every 3rd attack heals Ink Anamloy for 50% of the damage dealt.
> - On death, Ink Anamloy reforms once at 50% HP and stuns the enemy for 1 turn.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 30% | 33% | 36% | 39% | 42% | 45% | - Ink Anamloy takes 30% reduced damage. · Attacks apply Ink Corruption,… |
| 2 | 10% | 11% | 12% | 13% | 14% | 15% | …Corruption, permanently reducing the enemy's attack by 10%, stacking up to 5 times. · Every 3rd attack heals… |
| 3 | 50% | 55% | 60% | 65% | 70% | 75% | …times. · Every 3rd attack heals Ink Anamloy for 50% of the damage dealt. · On death, Ink Anamloy… |
| 4 | 50% | 55% | 60% | 65% | 70% | 75% | …dealt. · On death, Ink Anamloy reforms once at 50% HP and stuns the enemy for 1 turn. |

---

### Ink Artist

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 1.49K (1,490) · **Base HP:** 2.98K (2,980)

**Traits:** Summon

**Roles (wiki labels):** Summoner, Splash Damage, Tank

**Ability: Super Beast Scroll**

> - Every attack summons an ink beast that also hits the enemy's next card for 40% of Ink Artist's attack.
> - Every 3rd attack summons a giant ink tiger dealing 2x damage and creates an ink clone that completely blocks the next incoming attack.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 40% | 44% | 48% | 52% | 56% | 60% | …beast that also hits the enemy's next card for 40% of Ink Artist's attack. · Every 3rd attack summons… |

**Hits that scale with this card's ATK:** Ink beast hit 40%

---

### Insect Eater

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 1.55K (1,550) · **Base HP:** 3.11K (3,110)

**Traits:** Freeze, Heal, Entry Effect

**Roles (wiki labels):** Debuffer, Crowd control, Healer, Entry effect

**Ability: Cryokinesis: Frozen Lotus**

> - On entry, freeze the enemy for 1 turn.
> - Attacks apply frostbite, permanently reducing the enemy's attack by 8% stacking up to 5 times.
> - When Insect Eater attacks a frozen target, he heals 15% max HP.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 8% | 8.8% | 9.6% | 10.4% | 11.2% | 12% | …frostbite, permanently reducing the enemy's attack by 8% stacking up to 5 times. · When Insect Eater attacks… |
| 2 | 15% | 16.5% | 18% | 19.5% | 21% | 22.5% | …Insect Eater attacks a frozen target, he heals 15% max HP. |

---

### Iron Fist Disciple

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 32 (32) · **Base HP:** 64 (64)

**Roles (wiki labels):** Self-scaling

**Ability: Eight Gates**

> - Every 3 turns, open a Gate: +25% attack permanently.
> - After opening 3 Gates, take 10% max HP per turn (body destruction).

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | +25% | +27.5% | +30% | +32.5% | +35% | +37.5% | - Every 3 turns, open a Gate: +25% attack permanently. · After opening 3 Gates,… |
| 2 | 10% | 11% | 12% | 13% | 14% | 15% | …attack permanently. · After opening 3 Gates, take 10% max HP per turn (body destruction). |

---

### Irregular Boy

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 1.23K (1,230) · **Base HP:** 2.46K (2,460)

**Roles (wiki labels):** Self-scaling

**Ability: Thorn Absorption**

> - Absorb 20% of damage taken as permanent bonus attack (not from a hit that defeats him).
> - Each hit counts up to 50% of his max HP.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 20% | 22% | 24% | 26% | 28% | 30% | - Absorb 20% of damage taken as permanent bonus attack (not… |
| 2 | 50% | 55% | 60% | 65% | 70% | 75% | …hit that defeats him). · Each hit counts up to 50% of his max HP. |

---

### Karma Vessel

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 80.9K (80,900) · **Base HP:** 161K (161,000)

**Traits:** One Per Party

**Roles (wiki labels):** Damage over time, Self-scaling, Counter, Nuker

**Ability: Karma / Rasengan Uzuhiko**

> **Karma**
> - Statuses, stat cuts and ability damage that enemies aim at him are absorbed by his Karma instead.
> - Each one gives him +20% ATK for the rest of the battle, and his next attack throws every absorbed status back onto its target.
>
> **Rasengan Uzuhiko**
> - His first attack, and every 3rd after it, fires a Rasengan into the target.
> - It grows inside it, dealing 200%, then 300%, then 400% of his ATK at the end of the next 3 turns.
> - If the card dies first, the Rasengan moves into the next enemy that comes in.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | +20% | +22% | +24% | +26% | +28% | +30% | …absorbed by his Karma instead. · Each one gives him +20% ATK for the rest of the battle, and his next… |
| 2 | 200% | 220% | 240% | 260% | 280% | 300% | …into the target. · It grows inside it, dealing 200%, then 300%, then 400% of his ATK at the end of… |
| 3 | 300% | 330% | 360% | 390% | 420% | 450% | …target. · It grows inside it, dealing 200%, then 300%, then 400% of his ATK at the end of the next… |
| 4 | 400% | 440% | 480% | 520% | 560% | 600% | …grows inside it, dealing 200%, then 300%, then 400% of his ATK at the end of the next 3 turns. ·… |

**Hits that scale with this card's ATK:** Rasengan turn 1 200%, Rasengan turn 2 300%, Rasengan turn 3 400%

---

### Killer Queen

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 684K (684,000) · **Base HP:** 1.36M (1,360,000)

**Traits:** One Per Party, Once Per Battle

**Roles (wiki labels):** Nuker, Cheat death

**Ability: Bites the Dust**

> **First Bomb**
> - Every attack turns its target into a bomb, which detonates at the start of her next turn for 400% of her ATK.
>
> **Sheer Heart Attack**
> - At the end of each of her turns it hunts the enemy with the highest ATK, bench included, for 400% of her ATK.
>
> **Bites the Dust**
> - Once per battle, when she would die, time rewinds: she returns with the HP she had 3 turns ago (at least 75%) and the enemy in front blows up for 400% of her ATK.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 400% | 440% | 480% | 520% | 560% | 600% | …detonates at the start of her next turn for 400% of her ATK. Sheer Heart Attack · At the end of… |
| 2 | 400% | 440% | 480% | 520% | 560% | 600% | …enemy with the highest ATK, bench included, for 400% of her ATK. Bites the Dust · Once per battle,… |
| 3 | 75% | 82.5% | 90% | 97.5% | 105% | 112.5% | …returns with the HP she had 3 turns ago (at least 75%) and the enemy in front blows up for 400% of… |
| 4 | 400% | 440% | 480% | 520% | 560% | 600% | …least 75%) and the enemy in front blows up for 400% of her ATK. |

**Hits that scale with this card's ATK:** Bomb 400%, Sheer Heart Attack 400%, Bites the Dust 400%

---

### Kindness Spreader

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 7.44K (7,440) · **Base HP:** 14.8K (14,800)

**Traits:** Not On Bosses

**Roles (wiki labels):** Debuffer

**Ability: Idle Transfiguration**

> - Attacks have a 35% chance to reshape the target, permanently reducing its max HP by 25%.
> - This can trigger up to twice per target (no effect on boss NPCs).

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 35% | 38.5% | 42% | 45.5% | 49% | 52.5% | - Attacks have a 35% chance to reshape the target, permanently reducing… |
| 2 | 25% | 27.5% | 30% | 32.5% | 35% | 37.5% | …the target, permanently reducing its max HP by 25%. · This can trigger up to twice per target (no… |

---

### King Crimson

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 797K (797,000) · **Base HP:** 1.59M (1,590,000)

**Traits:** One Per Party, Dodge, Can't Miss

**Roles (wiki labels):** Evasion, Counter, Nuker, Crowd control

**Ability: Epitaph / Time Erasure**

> **Epitaph**
> - He has already seen the future.
> - The first attack each enemy card aims at him, and every 2nd attack after it, is dodged, and he counters each dodge for 200% of his ATK.
>
> **Time Erasure**
> - His every 3rd turn erases the enemy's next turn, and he strikes for 400% of his ATK.
> - That strike can't be dodged or reduced.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 200% | 220% | 240% | 260% | 280% | 300% | …it, is dodged, and he counters each dodge for 200% of his ATK. Time Erasure · His every 3rd turn… |
| 2 | 400% | 440% | 480% | 520% | 560% | 600% | …erases the enemy's next turn, and he strikes for 400% of his ATK. · That strike can't be dodged or… |

**Hits that scale with this card's ATK:** Dodge counter 200%, Time Erasure strike 400%

---

### KO King

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 843 (843) · **Base HP:** 1.68K (1,680)

**Traits:** Hits All

**Roles (wiki labels):** Nuker, Splash Damage

**Ability: Serious Punch**

> - Does nothing for 2 turns.
> - Turn 3: 5x damage.
> - Shockwave hits all enemies in lineup for 10% of this attack.
> - 3-turn cooldown.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 10% | 11% | 12% | 13% | 14% | 15% | …damage. · Shockwave hits all enemies in lineup for 10% of this attack. · 3-turn cooldown. |

---

### Legendary Duo

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 53.9K (53,900) · **Base HP:** 107K (107,000)

**Roles (wiki labels):** Nuker, Evasion, Crowd control, Self-scaling

**Ability: Perfect Synchronization**

> - Enters with 3 clones.
> - Every hit it takes has a 40% chance to land on a clone instead, popping it.
> - Each popped clone gives +20% ATK for the rest of the battle.
> - Every 2nd attack deals 350% ATK damage and seals the target's ability for 2 turns.
> - If that strike kills, the seal moves to the next enemy that comes in.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 40% | 44% | 48% | 52% | 56% | 60% | …Enters with 3 clones. · Every hit it takes has a 40% chance to land on a clone instead, popping it.… |
| 2 | +20% | +22% | +24% | +26% | +28% | +30% | …instead, popping it. · Each popped clone gives +20% ATK for the rest of the battle. · Every 2nd attack… |
| 3 | 350% | 385% | 420% | 455% | 490% | 525% | …rest of the battle. · Every 2nd attack deals 350% ATK damage and seals the target's ability for… |

**Hits that scale with this card's ATK:** Every 2nd attack 350%

---

### Leopard Assassin

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 4.33K (4,330) · **Base HP:** 8.67K (8,670)

**Roles (wiki labels):** Multi-hit

**Ability: Rokushiki / Rokuogan**

> - Every attack hits twice, with the second hit dealing 40% damage.
> - Every 4th attack, Leopard Assassin uses Rokuogan, dealing 40% of his attack while ignoring defensive abilities.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 40% | 44% | 48% | 52% | 56% | 60% | …attack hits twice, with the second hit dealing 40% damage. · Every 4th attack, Leopard Assassin… |
| 2 | 40% | 44% | 48% | 52% | 56% | 60% | …attack, Leopard Assassin uses Rokuogan, dealing 40% of his attack while ignoring defensive abilities. |

**Hits that scale with this card's ATK:** Second hit 40%, Rokuogan 40%

---

### Light Ambassador

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 4.05K (4,050) · **Base HP:** 8.11K (8,110)

**Traits:** Not On Bosses, Execute, Shield, Entry Effect

**Roles (wiki labels):** Debuffer, Execute, Counter, Entry effect

**Ability: Shimmer Retribution**

> **Rebuttal**
> - A shield blocks the first hit she takes.
> - On entry she Overwhelms every enemy, and each of her hits Overwhelms the target.
> - Each Overwhelm stack makes it take 20% more damage from everything for the rest of the battle (up to 3 stacks).
> - Her attacks and reflections instantly kill enemies under 10% of their max HP per Overwhelm stack.
> - Every 3rd hit she takes is reflected back at the attacker for 100% of the damage (no effect on boss NPCs).

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 20% | 22% | 24% | 26% | 28% | 30% | …target. · Each Overwhelm stack makes it take 20% more damage from everything for the rest of the… |
| 2 | 10% | 11% | 12% | 13% | 14% | 15% | …and reflections instantly kill enemies under 10% of their max HP per Overwhelm stack. · Every… |
| 3 | 100% | 110% | 120% | 130% | 140% | 150% | …takes is reflected back at the attacker for 100% of the damage (no effect on boss NPCs). |

---

### Lightborne Admiral

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 346 (346) · **Base HP:** 692 (692)

**Traits:** Entry Effect

**Roles (wiki labels):** Splash Damage, Evasion, Entry effect

**Ability: Yasakani no Magatama**

> - Every attack hits the enemy + one card in their lineup for 30% damage.
> - Attacks deal 1.5x damage.
> - On entry, blind enemy: their first attack misses.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 30% | 33% | 36% | 39% | 42% | 45% | …hits the enemy + one card in their lineup for 30% damage. · Attacks deal 1.5x damage. · On entry,… |

---

### Lightning Shout

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 203 (203) · **Base HP:** 405 (405)

**Traits:** Stun, Hits All, Entry Effect

**Roles (wiki labels):** Crowd control, Splash Damage, Entry effect

**Ability: Lightning Dragon's Roar**

> - On entry, hit all enemies for 10% of Lightning Shout's attack.
> - Every attack has a 25% chance to stun for 1 turn.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 10% | 11% | 12% | 13% | 14% | 15% | - On entry, hit all enemies for 10% of Lightning Shout's attack. · Every attack has… |
| 2 | 25% | 27.5% | 30% | 32.5% | 35% | 37.5% | …Lightning Shout's attack. · Every attack has a 25% chance to stun for 1 turn. |

**Hits that scale with this card's ATK:** Entry AoE hit 10%

---

### Lone Wolf

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 18.3K (18,300) · **Base HP:** 36.6K (36,600)

**Traits:** Entry Effect

**Roles (wiki labels):** Summoner, Multi-hit, Counter, Entry effect

**Ability: Pack Hunt**

> - On entry, 2 spirit wolves join Lone Wolf, and each bites for 35% damage after his attacks.
> - While a wolf is out, the next enemy attack on Lone Wolf is intercepted: the wolf takes 35% of the hit and explodes on the attacker for 150% damage, then it's gone.
> - When Lone Wolf has no wolves left, his next attack is a Barrage: 6 shots for 40% damage at the front enemy card, moving on to the next card when one dies.
> - Every kill brings a wolf back.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 35% | 38.5% | 42% | 45.5% | 49% | 52.5% | …spirit wolves join Lone Wolf, and each bites for 35% damage after his attacks. · While a wolf is out,… |
| 2 | 35% | 38.5% | 42% | 45.5% | 49% | 52.5% | …on Lone Wolf is intercepted: the wolf takes 35% of the hit and explodes on the attacker for 150%… |
| 3 | 150% | 165% | 180% | 195% | 210% | 225% | …of the hit and explodes on the attacker for 150% damage, then it's gone. · When Lone Wolf has… |
| 4 | 40% | 44% | 48% | 52% | 56% | 60% | …left, his next attack is a Barrage: 6 shots for 40% damage at the front enemy card, moving on to… |

**Hits written as "X% damage" (probably of a normal attack):** Wolf bite 35%, Wolf explosion 150%, Barrage shot 40%

---

### Longnose Liar

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 12 (12) · **Base HP:** 24 (24)

**Roles (wiki labels):** Nuker

**Ability: Sniper King's Gambit**

> - 30% chance to miss an attack.
> - After missing, next attack deals 250% damage.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 30% | 33% | 36% | 39% | 42% | 45% | - 30% chance to miss an attack. · After missing, next… |
| 2 | 250% | 275% | 300% | 325% | 350% | 375% | …an attack. · After missing, next attack deals 250% damage. |

**Hits written as "X% damage" (probably of a normal attack):** Post-miss attack 250%

---

### Lord of Hemomancy

Battle card · Rarity: unknown · Origin: Weather (Cataclysm)

**Base DMG:** 10.4K (10,400) · **Base HP:** 20.8K (20,800)

**Traits:** Heal

**Roles (wiki labels):** Nuker, Healer, Splash Damage, Self-scaling

**Ability: Sanguine Dominion**

> - 50% of his bonus max HP is added to his ATK.
> - Healing from others doesn't restore his HP: it becomes Blood instead.
> - Each attack spends 35% of his HP into Blood and deals 350% of it as bonus damage, and he heals 40% of the damage dealt.
> - When his Blood reaches his max HP he casts Hemoplague: every enemy takes 20% more damage for 2 turns, then their blood erupts for 100% of his Blood.
> - He heals 50% of the eruption's damage and gains 25% of it as max HP permanently.
> - The first attack that would kill him misses, and he casts Hemoplague right away, even if his Blood isn't full.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 50% | 55% | 60% | 65% | 70% | 75% | - 50% of his bonus max HP is added to his ATK. · Healing… |
| 2 | 35% | 38.5% | 42% | 45.5% | 49% | 52.5% | …becomes Blood instead. · Each attack spends 35% of his HP into Blood and deals 350% of it as… |
| 3 | 350% | 385% | 420% | 455% | 490% | 525% | …attack spends 35% of his HP into Blood and deals 350% of it as bonus damage, and he heals 40% of the… |
| 4 | 40% | 44% | 48% | 52% | 56% | 60% | …deals 350% of it as bonus damage, and he heals 40% of the damage dealt. · When his Blood reaches… |
| 5 | 20% | 22% | 24% | 26% | 28% | 30% | …max HP he casts Hemoplague: every enemy takes 20% more damage for 2 turns, then their blood erupts… |
| 6 | 100% | 110% | 120% | 130% | 140% | 150% | …damage for 2 turns, then their blood erupts for 100% of his Blood. · He heals 50% of the eruption's… |
| 7 | 50% | 55% | 60% | 65% | 70% | 75% | …blood erupts for 100% of his Blood. · He heals 50% of the eruption's damage and gains 25% of it… |
| 8 | 25% | 27.5% | 30% | 32.5% | 35% | 37.5% | …heals 50% of the eruption's damage and gains 25% of it as max HP permanently. · The first attack… |

---

### Mach Twenty Teacher

Battle card · Rarity: unknown · Origin: Echo Depths (Lantern Cistern)

**Base DMG:** 37.8K (37,800) · **Base HP:** 75.6K (75,600)

**Traits:** Dodge

**Roles (wiki labels):** Evasion, Team support, Counter, Debuffer

**Ability: Mach 20 Lesson**

> - Every card in his party enters under his watch: the first attack it takes misses.
> - He dodges 35% of attacks.
> - Whenever a card in his party dodges, he strikes the attacker for 100% of his attack, and it deals 30% less damage for 2 turns.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 35% | 38.5% | 42% | 45.5% | 49% | 52.5% | …the first attack it takes misses. · He dodges 35% of attacks. · Whenever a card in his party dodges,… |
| 2 | 100% | 110% | 120% | 130% | 140% | 150% | …his party dodges, he strikes the attacker for 100% of his attack, and it deals 30% less damage for… |
| 3 | 30% | 33% | 36% | 39% | 42% | 45% | …attacker for 100% of his attack, and it deals 30% less damage for 2 turns. |

**Hits that scale with this card's ATK:** Counter strike 100%

---

### Madness Blade

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 1.6K (1,600) · **Base HP:** 3.2K (3,200)

**Traits:** Heal

**Roles (wiki labels):** Tank, Nuker, Healer

**Ability: Black Blood**

> - Takes 25% less damage from attacks.
> - Every hit it takes adds 1 Madness.
> - At 4 Madness, its next attack is Screech Alpha: 250% damage, and it heals 45% of its max HP.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 25% | 27.5% | 30% | 32.5% | 35% | 37.5% | - Takes 25% less damage from attacks. · Every hit it takes… |
| 2 | 250% | 275% | 300% | 325% | 350% | 375% | …4 Madness, its next attack is Screech Alpha: 250% damage, and it heals 45% of its max HP. |
| 3 | 45% | 49.5% | 54% | 58.5% | 63% | 67.5% | …is Screech Alpha: 250% damage, and it heals 45% of its max HP. |

**Hits written as "X% damage" (probably of a normal attack):** Screech Alpha 250%

---

### Masked Chrome

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 33.9K (33,900) · **Base HP:** 67.9K (67,900)

**Traits:** Dodge, Bleed

**Roles (wiki labels):** Multi-hit, Damage over time, Evasion

**Ability: Mantis Rush**

> - Masked Chrome's attacks slash 3 times for 45% damage each, and each slash adds a Bleed stack (max 9).
> - A Bleeding card takes 5% of Masked Chrome's attack as damage per stack at the start of each of its turns.
> - When a Bleeding card dies, its stacks move to the next enemy card that enters.
> - The first attack each enemy card makes on her is dodged.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 45% | 49.5% | 54% | 58.5% | 63% | 67.5% | - Masked Chrome's attacks slash 3 times for 45% damage each, and each slash adds a Bleed stack… |
| 2 | 5% | 5.5% | 6% | 6.5% | 7% | 7.5% | …Bleed stack (max 9). · A Bleeding card takes 5% of Masked Chrome's attack as damage per stack… |

**Hits that scale with this card's ATK:** Bleed per stack 5%

**Hits written as "X% damage" (probably of a normal attack):** Slash 45%

---

### Meteor Conqueror

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 640 (640) · **Base HP:** 1.28K (1,280)

**Traits:** Hits All, Entry Effect

**Roles (wiki labels):** Nuker, Splash Damage, Entry effect

**Ability: Meteoric Burst**

> - On entry, deal 15% of his max HP to all enemy cards.
> - 2x attack for 3 turns.
> - After 3 turns, overheat: lose 10% max HP per turn.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 15% | 16.5% | 18% | 19.5% | 21% | 22.5% | - On entry, deal 15% of his max HP to all enemy cards. · 2x attack… |
| 2 | 10% | 11% | 12% | 13% | 14% | 15% | …for 3 turns. · After 3 turns, overheat: lose 10% max HP per turn. |

---

### Millennium Mage

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 37.8K (37,800) · **Base HP:** 75.6K (75,600)

**Traits:** Stun, Ignores Defense, Can't Miss, Shield

**Roles (wiki labels):** Tank, Crowd control, Nuker

**Ability: Hidden Mana**

> - Her defensive magic blocks the first 5 hits on her, and each blocked hit stuns the attacker for 1 turn.
> - Her first attack releases her hidden mana: 300% damage that can't be dodged.
> - Every attack ignores damage reduction.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 300% | 330% | 360% | 390% | 420% | 450% | …· Her first attack releases her hidden mana: 300% damage that can't be dodged. · Every attack ignores… |

**Hits written as "X% damage" (probably of a normal attack):** Hidden mana release 300%

---

### Mimic

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 15 (15) · **Base HP:** 30 (30)

**Traits:** Death Effect

**Roles (wiki labels):** Death effect

**Ability: Gambler's Curse**

> On death: 50% chance to deal 75% of this card's attack to the enemy, or 50% chance to deal 40% to your next card.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 50% | 55% | 60% | 65% | 70% | 75% | On death: 50% chance to deal 75% of this card's attack to the… |
| 2 | 75% | 82.5% | 90% | 97.5% | 105% | 112.5% | On death: 50% chance to deal 75% of this card's attack to the enemy, or 50% chance… |
| 3 | 50% | 55% | 60% | 65% | 70% | 75% | …deal 75% of this card's attack to the enemy, or 50% chance to deal 40% to your next card. |
| 4 | 40% | 44% | 48% | 52% | 56% | 60% | …card's attack to the enemy, or 50% chance to deal 40% to your next card. |

**Hits that scale with this card's ATK:** Death hit (enemy) 75%

**Hits written as "X% damage" (probably of a normal attack):** Death hit (own card) 40%

---

### Mirror Traitor

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 21.3K (21,300) · **Base HP:** 42.7K (42,700)

**Traits:** Revive

**Roles (wiki labels):** Cheat death, Debuffer, Splash Damage

**Ability: Hypnosis**

> - Mirror Traitor's attacks Hypnotize the target for 2 turns: a Hypnotized card deals 35% less damage.
> - Whenever a new enemy card enters, he Hypnotizes it on sight, and his next attack on it hits twice, dealing 50% more damage.
> - The first 2 times he would die, he evolves instead: he returns at 50% HP with 30% more attack.
> - After his second evolution, his attacks also hit all other enemy cards for 60% damage.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 35% | 38.5% | 42% | 45.5% | 49% | 52.5% | …target for 2 turns: a Hypnotized card deals 35% less damage. · Whenever a new enemy card enters,… |
| 2 | 50% | 55% | 60% | 65% | 70% | 75% | …and his next attack on it hits twice, dealing 50% more damage. · The first 2 times he would die,… |
| 3 | 50% | 55% | 60% | 65% | 70% | 75% | …would die, he evolves instead: he returns at 50% HP with 30% more attack. · After his second evolution,… |
| 4 | 30% | 33% | 36% | 39% | 42% | 45% | …he evolves instead: he returns at 50% HP with 30% more attack. · After his second evolution, his… |
| 5 | 60% | 66% | 72% | 78% | 84% | 90% | …his attacks also hit all other enemy cards for 60% damage. |

**Hits written as "X% damage" (probably of a normal attack):** Evolved splash 60%

---

### Mist Executioner

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 609 (609) · **Base HP:** 1.21K (1,210)

**Traits:** Dodge

**Roles (wiki labels):** Evasion

**Ability: Silent Ninja**

> - If Mist Executioner defeats a card, he enters stealth.
> - In stealth Mist Executioner dodges the next attack, and his next attack deals 1.2x damage.

---

### Mochi Man

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 5.69K (5,690) · **Base HP:** 11.3K (11,300)

**Traits:** Dodge

**Roles (wiki labels):** Evasion

**Ability: Future Sight / Mochi Thrust**

> - Mochi Man has a 35% chance to dodge any attack.
> - After dodging, his next attack deals 50% more damage.
> - Every 3 turns, he uses Buzz Cut Mochi for 1.5x damage with a guaranteed hit.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 35% | 38.5% | 42% | 45.5% | 49% | 52.5% | - Mochi Man has a 35% chance to dodge any attack. · After dodging,… |
| 2 | 50% | 55% | 60% | 65% | 70% | 75% | …attack. · After dodging, his next attack deals 50% more damage. · Every 3 turns, he uses Buzz Cut… |

---

### Moon Mother

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 576 (576) · **Base HP:** 1.15K (1,150)

**Traits:** Ignores Defense

**Roles (wiki labels):** Crowd control, Nuker, Execute

**Ability: Amenominaka / All-Killing Ash Bones**

> - On enemy entry, Moon Mother shifts dimensions, disabling the active enemy's ability for 2 turns.
> - Every 4th attack becomes All-Killing Ash Bones, dealing 3x damage, ignoring damage reduction, and instantly defeating targets below 25% HP.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 25% | 27.5% | 30% | 32.5% | 35% | 37.5% | …reduction, and instantly defeating targets below 25% HP. |

---

### Moon Reaper

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 1.76K (1,760) · **Base HP:** 3.52K (3,520)

**Traits:** Revive

**Roles (wiki labels):** Multi-hit, Cheat death

**Ability: Moon Breathing / Monstrous Regeneration**

> - Every attack hits twice, with the second hit dealing 40% damage.
> - On death, Moon Reaper regenerates once at 40% HP in his transformed state with 50% more attack and 30% damage reduction.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 40% | 44% | 48% | 52% | 56% | 60% | …attack hits twice, with the second hit dealing 40% damage. · On death, Moon Reaper regenerates once… |
| 2 | 40% | 44% | 48% | 52% | 56% | 60% | …· On death, Moon Reaper regenerates once at 40% HP in his transformed state with 50% more attack… |
| 3 | 50% | 55% | 60% | 65% | 70% | 75% | …once at 40% HP in his transformed state with 50% more attack and 30% damage reduction. |
| 4 | 30% | 33% | 36% | 39% | 42% | 45% | …his transformed state with 50% more attack and 30% damage reduction. |

**Hits written as "X% damage" (probably of a normal attack):** Second hit 40%

---

### Nine-Tail Prodigy

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 1.78K (1,780) · **Base HP:** 3.56K (3,560)

**Roles (wiki labels):** Debuffer

**Ability: Life Force Drain**

> - For 4 turns, Nine-Tail Prodigy has 1.75x all stats and every attack permanently reduces the enemy's max HP by 12%.
> - After 4 turns, Nine-Tail Prodigy dies.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 12% | 13.2% | 14.4% | 15.6% | 16.8% | 18% | …attack permanently reduces the enemy's max HP by 12%. · After 4 turns, Nine-Tail Prodigy dies. |

---

### Noble Companion

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 105 (105) · **Base HP:** 210 (210)

**Roles (wiki labels):** Team support, Works from the bench

**Ability: Passionate Narration**

> All cards in your party gain 20% damage for each Noble Companion in the party (stacks).

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 20% | 22% | 24% | 26% | 28% | 30% | All cards in your party gain 20% damage for each Noble Companion in the party… |

---

### Nullblade Knight

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 329 (329) · **Base HP:** 658 (658)

**Traits:** Entry Effect

**Roles (wiki labels):** Crowd control, Entry effect

**Ability: Anti-Magic: Demon Destroyer**

> - On entry, negate the enemy's ability for 2 turns.
> - Nullblade Knight is immune to any ability that would reduce his stats.
> - Attacks deal 1.3x damage.

---

### Ocean's Guardian

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 416 (416) · **Base HP:** 831 (831)

**Traits:** Hits All, Heal, Entry Effect

**Roles (wiki labels):** Healer, Splash Damage, Entry effect

**Ability: Fish-Man Karate: Vagabond Drill**

> - On entry, create rainfall for 3 turns: heal 20% max HP per turn during rainfall.
> - Every 3rd attack sends a shockwave hitting all enemies for 15% of Ocean's Guardian's attack.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 20% | 22% | 24% | 26% | 28% | 30% | …On entry, create rainfall for 3 turns: heal 20% max HP per turn during rainfall. · Every 3rd… |
| 2 | 15% | 16.5% | 18% | 19.5% | 21% | 22.5% | …attack sends a shockwave hitting all enemies for 15% of Ocean's Guardian's attack. |

**Hits that scale with this card's ATK:** Shockwave (all enemies) 15%

---

### Omni Sovereign

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 4.15K (4,150) · **Base HP:** 8.31K (8,310)

**Traits:** Entry Effect

**Roles (wiki labels):** Execute, Entry effect

**Ability: Erase**

> On entry, if the enemy is weaker than Omni Sovereign, erase them from the battle entirely.

---

### One Eyed

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 1.75K (1,750) · **Base HP:** 3.5K (3,500)

**Traits:** Heal

**Roles (wiki labels):** Self-scaling, Healer

**Ability: Ghoul Awakening**

> - Start in human form.
> - Below 50% HP, awaken: 2x attack, heal 30% max HP, and every attack heals for 20% of damage dealt.
> - Below 15% HP in awakened form, go berserk: 3x attack for 2 turns, then die.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 50% | 55% | 60% | 65% | 70% | 75% | - Start in human form. · Below 50% HP, awaken: 2x attack, heal 30% max HP, and every… |
| 2 | 30% | 33% | 36% | 39% | 42% | 45% | …form. · Below 50% HP, awaken: 2x attack, heal 30% max HP, and every attack heals for 20% of damage… |
| 3 | 20% | 22% | 24% | 26% | 28% | 30% | …heal 30% max HP, and every attack heals for 20% of damage dealt. · Below 15% HP in awakened form,… |
| 4 | 15% | 16.5% | 18% | 19.5% | 21% | 22.5% | …attack heals for 20% of damage dealt. · Below 15% HP in awakened form, go berserk: 3x attack for… |

---

### Otherwordly Being

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 5.28K (5,280) · **Base HP:** 10.5K (10,500)

**Traits:** Dodge, Ignores Defense

**Roles (wiki labels):** Evasion, Self-scaling, Nuker, Cheat death

**Ability: Ultra Instinct: One Percent**

> - He has a 60% chance to dodge any attack.
> - Whenever he dodges, he gains 15% attack permanently, stacking up to 5 times.
> - Every 3rd attack uses one percent of his power, dealing 2x damage and ignoring damage reduction.
> - The first time he receives fatal damage, he survives at 1 HP and gains 1.5x attack.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 60% | 66% | 72% | 78% | 84% | 90% | - He has a 60% chance to dodge any attack. · Whenever he dodges,… |
| 2 | 15% | 16.5% | 18% | 19.5% | 21% | 22.5% | …dodge any attack. · Whenever he dodges, he gains 15% attack permanently, stacking up to 5 times. ·… |

---

### Pale Snake

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 15.3K (15,300) · **Base HP:** 30.7K (30,700)

**Traits:** One Per Party

**Roles (wiki labels):** Crowd control, Self-scaling, Evasion, Debuffer

**Ability: Stand Disc / Memory Disc**

> **Stand Disc**
> - When he enters, and on his every 3rd turn, he pulls the active enemy's disc out.
> - It is silenced for 2 turns and he keeps 25% of its ATK for the rest of the battle.
>
> **Memory Disc**
> - The first attack each enemy card aims at him is forgotten and never lands.
> - His attacks deal +50% damage to silenced targets.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 25% | 27.5% | 30% | 32.5% | 35% | 37.5% | …out. · It is silenced for 2 turns and he keeps 25% of its ATK for the rest of the battle. Memory… |
| 2 | +50% | +55% | +60% | +65% | +70% | +75% | …forgotten and never lands. · His attacks deal +50% damage to silenced targets. |

---

### Panther King

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 12.4K (12,400) · **Base HP:** 24.9K (24,900)

**Traits:** Can't Miss, Heal

**Roles (wiki labels):** Multi-hit, Healer

**Ability: Pantera**

> - Attacks hit 2 times for 75% damage each.
> - Every attack in a row on the same card deals 20% more damage (up to 2x).
> - Below 50% HP, or when a hit would kill him, Panther King releases Pantera once: he heals 30% max HP, gains 50% attack and hits 3 times, the third hit cannot be dodged.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 75% | 82.5% | 90% | 97.5% | 105% | 112.5% | - Attacks hit 2 times for 75% damage each. · Every attack in a row on the same… |
| 2 | 20% | 22% | 24% | 26% | 28% | 30% | …Every attack in a row on the same card deals 20% more damage (up to 2x). · Below 50% HP, or when… |
| 3 | 50% | 55% | 60% | 65% | 70% | 75% | …card deals 20% more damage (up to 2x). · Below 50% HP, or when a hit would kill him, Panther King… |
| 4 | 30% | 33% | 36% | 39% | 42% | 45% | …Panther King releases Pantera once: he heals 30% max HP, gains 50% attack and hits 3 times, the… |
| 5 | 50% | 55% | 60% | 65% | 70% | 75% | …releases Pantera once: he heals 30% max HP, gains 50% attack and hits 3 times, the third hit cannot… |

**Hits written as "X% damage" (probably of a normal attack):** Per hit (x2) 75%

---

### Paper Pal

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 136 (136) · **Base HP:** 272 (272)

**Traits:** Hits All, Entry Effect

**Roles (wiki labels):** Splash Damage, Entry effect

**Ability: Paper Storm**

> - On entry, paper shreds deal 10% of Paper Pal's attack to all enemy cards.
> - Attacks have a 25% chance to cut through, dealing 1.5x damage.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 10% | 11% | 12% | 13% | 14% | 15% | - On entry, paper shreds deal 10% of Paper Pal's attack to all enemy cards. · Attacks… |
| 2 | 25% | 27.5% | 30% | 32.5% | 35% | 37.5% | …attack to all enemy cards. · Attacks have a 25% chance to cut through, dealing 1.5x damage. |

**Hits that scale with this card's ATK:** Entry AoE hit 10%

**Hits written as "X% damage" (probably of a normal attack):** Cut-through hit 150%

---

### Phantom

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 155 (155) · **Base HP:** 309 (309)

**Roles (wiki labels):** Evasion

**Ability: Hydrification**

> - 30% chance to negate any incoming attack entirely.
> - Can't negate the same attacker twice in a row.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 30% | 33% | 36% | 39% | 42% | 45% | - 30% chance to negate any incoming attack entirely.… |

---

### Pinnacle of Sorcery

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 132K (132,000) · **Base HP:** 265K (265,000)

**Traits:** Hits All, Pierce, Entry Effect, Death Effect

**Roles (wiki labels):** Splash Damage, Nuker, Entry effect, Death effect

**Ability: Domain Clash**

> - On entry, opens its Domain for 5 turns.
> - At the end of each turn while it's open, slashes every enemy for 50% ATK damage.
> - Each enemy killed while it's open adds 1 turn (up to 3 extra turns).
> - Every 3rd attack fires a blazing arrow: 250% ATK damage to the target and 125% ATK damage to the enemy behind it.
> - When it dies permanently, a final beam hits every enemy for 350% ATK damage, ignoring defensive abilities.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 50% | 55% | 60% | 65% | 70% | 75% | …turn while it's open, slashes every enemy for 50% ATK damage. · Each enemy killed while it's open… |
| 2 | 250% | 275% | 300% | 325% | 350% | 375% | …turns). · Every 3rd attack fires a blazing arrow: 250% ATK damage to the target and 125% ATK damage… |
| 3 | 125% | 137.5% | 150% | 162.5% | 175% | 187.5% | …blazing arrow: 250% ATK damage to the target and 125% ATK damage to the enemy behind it. · When it… |
| 4 | 350% | 385% | 420% | 455% | 490% | 525% | …permanently, a final beam hits every enemy for 350% ATK damage, ignoring defensive abilities. |

**Hits that scale with this card's ATK:** Domain slash 50%, Arrow hit 250%, Arrow pierce 125%, Death beam 350%

---

### Poison Princess

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 288 (288) · **Base HP:** 576 (576)

**Traits:** Poison, Hits All, Death Effect

**Roles (wiki labels):** Debuffer, Death effect

**Ability: Wisteria Poison Finale**

> On death, poison the battlefield for 3 turns — all enemies take 30% more damage from all sources.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 30% | 33% | 36% | 39% | 42% | 45% | …the battlefield for 3 turns — all enemies take 30% more damage from all sources. |

---

### Possesive Rabbit

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 2.76K (2,760) · **Base HP:** 5.51K (5,510)

**Traits:** Not On Bosses, Revive, Death Effect

**Roles (wiki labels):** Cheat death, Crowd control, Death effect

**Ability: I Always Come Back**

> - On death, possess the enemy's active card: it attacks itself for 2 turns for 60% damage (no effect on boss NPCs).
> - After, Possesive Rabbit revives at 100% HP.
> - Can trigger once.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 60% | 66% | 72% | 78% | 84% | 90% | …active card: it attacks itself for 2 turns for 60% damage (no effect on boss NPCs). · After, Possesive… |
| 2 | 100% | 110% | 120% | 130% | 140% | 150% | …NPCs). · After, Possesive Rabbit revives at 100% HP. · Can trigger once. |

---

### Primordial Colossus

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 1.51K (1,510) · **Base HP:** 3.02K (3,020)

**Traits:** Hits All, Entry Effect, Death Effect

**Roles (wiki labels):** Splash Damage, Entry effect, Death effect

**Ability: The Rumbling**

> - On entry, transform: 1.5x all stats.
> - Every 3 turns, Wall Titans march dealing 20% of Primordial Colossus's attack to all enemy cards.
> - On death, the Rumbling continues for 2 more turns — every enemy takes 100% of Primordial Colossus's attack per turn even after it falls.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 20% | 22% | 24% | 26% | 28% | 30% | …stats. · Every 3 turns, Wall Titans march dealing 20% of Primordial Colossus's attack to all enemy… |
| 2 | 100% | 110% | 120% | 130% | 140% | 150% | …continues for 2 more turns — every enemy takes 100% of Primordial Colossus's attack per turn even… |

**Hits that scale with this card's ATK:** Wall Titans march 20%, Death Rumbling per turn 100%

---

### Primordial Dread

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 199K (199,000) · **Base HP:** 398K (398,000)

**Traits:** One Per Party

**Roles (wiki labels):** Debuffer, Counter, Evasion, Self-scaling

**Ability: Primal Fear**

> - Any skill that targets the Primordial Dread is negated, and each negated skill grants it 1 Darkness.
> - Enemy attacks have a 15% chance to fail, +5% per Darkness, up to 60%.
> - Whenever an enemy's attack fails, the Primordial Dread's arms strike back for 200% of its ATK.
> - While it is alive, enemies can't recover HP, revive or use shields.
> - At the end of each turn, every enemy (bench included) loses 2.5% of its ATK and max HP, and the Primordial Dread gains 1 Darkness.
> - Each Darkness also gives it +75% of its starting ATK.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 15% | 16.5% | 18% | 19.5% | 21% | 22.5% | …grants it 1 Darkness. · Enemy attacks have a 15% chance to fail, +5% per Darkness, up to 60%.… |
| 2 | +5% | +5.5% | +6% | +6.5% | +7% | +7.5% | …Darkness. · Enemy attacks have a 15% chance to fail, +5% per Darkness, up to 60%. · Whenever an enemy's… |
| 3 | 60% | 66% | 72% | 78% | 84% | 90% | …15% chance to fail, +5% per Darkness, up to 60%. · Whenever an enemy's attack fails, the Primordial… |
| 4 | 200% | 220% | 240% | 260% | 280% | 300% | …the Primordial Dread's arms strike back for 200% of its ATK. · While it is alive, enemies can't… |
| 5 | 2.5% | 2.75% | 3% | 3.25% | 3.5% | 3.75% | …each turn, every enemy (bench included) loses 2.5% of its ATK and max HP, and the Primordial Dread… |
| 6 | +75% | +82.5% | +90% | +97.5% | +105% | +112.5% | …gains 1 Darkness. · Each Darkness also gives it +75% of its starting ATK. |

**Hits that scale with this card's ATK:** Counter strike 200%

---

### Psychic Esper

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 5.34K (5,340) · **Base HP:** 10.6K (10,600)

**Traits:** Revive

**Roles (wiki labels):** Multi-hit, Splash Damage, Cheat death

**Ability: Psychic Barrage**

> - Instead of attacking, throws 5 rocks that each deal 30% damage to a random enemy (bench included).
> - Each rock that hits the same enemy as the last one deals +10% more.
> - The first time he dies, he enters ???%: revives at full HP and throws 10 rocks per barrage from then on.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 30% | 33% | 36% | 39% | 42% | 45% | …of attacking, throws 5 rocks that each deal 30% damage to a random enemy (bench included). ·… |
| 2 | +10% | +11% | +12% | +13% | +14% | +15% | …that hits the same enemy as the last one deals +10% more. · The first time he dies, he enters ???%:… |

**Hits written as "X% damage" (probably of a normal attack):** Rock hit 30%

---

### Psychic Girl

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 482 (482) · **Base HP:** 963 (963)

**Traits:** Dodge

**Roles (wiki labels):** Team support, Evasion, Works from the bench

**Ability: Psychic Precognition**

> - While Psychic Girl is alive in your party, all your cards have a 25% chance to dodge any attack.
> - Does not stack with multiple copies.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 25% | 27.5% | 30% | 32.5% | 35% | 37.5% | …is alive in your party, all your cards have a 25% chance to dodge any attack. · Does not stack… |

---

### Puppeteer

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 284 (284) · **Base HP:** 567 (567)

**Traits:** Poison

**Roles (wiki labels):** Debuffer, Tank

**Ability: Hitokugutsu — Human Puppet**

> - Attacks apply puppet poison: -10% attack permanently per hit (stacking).
> - Puppeteer takes 20% reduced damage (puppet body).

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | -10% | -11% | -12% | -13% | -14% | -15% | - Attacks apply puppet poison: -10% attack permanently per hit (stacking). · Puppeteer… |
| 2 | 20% | 22% | 24% | 26% | 28% | 30% | …permanently per hit (stacking). · Puppeteer takes 20% reduced damage (puppet body). |

---

### Rain Mage

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 171 (171) · **Base HP:** 341 (341)

**Traits:** Entry Effect

**Roles (wiki labels):** Debuffer, Entry effect

**Ability: Water Lock**

> On entry, the enemy deals 30% less damage for 2 turns.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 30% | 33% | 36% | 39% | 42% | 45% | On entry, the enemy deals 30% less damage for 2 turns. |

---

### Red Dog

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 6.3K (6,300) · **Base HP:** 12.6K (12,600)

**Traits:** Burn, Hits All, Death Effect

**Roles (wiki labels):** Damage over time, Death effect, Splash Damage

**Ability: Meigou / Absolute Justice**

> - Attacks apply Magma Burn for 20% of this card's ATK per turn for 2 turns, stacking.
> - If an enemy dies while burned, the burn transfers to the next card entering the field.
> - On death, Red Dog erupts and deals 30% of his max HP to all enemy cards.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 20% | 22% | 24% | 26% | 28% | 30% | - Attacks apply Magma Burn for 20% of this card's ATK per turn for 2 turns, stacking.… |
| 2 | 30% | 33% | 36% | 39% | 42% | 45% | …field. · On death, Red Dog erupts and deals 30% of his max HP to all enemy cards. |

**Hits that scale with this card's ATK:** Magma Burn per turn 20%

---

### Regressor

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 1.57K (1,570) · **Base HP:** 3.15K (3,150)

**Traits:** Revive

**Roles (wiki labels):** Cheat death

**Ability: Regression**

> On death, if Regressor has killed at least one card this fight, revive at 40% HP with ability refreshed.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 40% | 44% | 48% | 52% | 56% | 60% | …killed at least one card this fight, revive at 40% HP with ability refreshed. |

---

### Rejection Maiden

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 13.5K (13,500) · **Base HP:** 27K (27,000)

**Traits:** Once Per Battle, Revive

**Roles (wiki labels):** Team support, Cheat death, Works from the bench

**Ability: I Reject**

> - Once per battle, when your strongest card (most max HP) dies, it comes back with the HP it had at the start of its last turn.
> - Works from anywhere in your party.
> - Copies don't stack.

---

### Royal Vanguard

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 891 (891) · **Base HP:** 1.78K (1,780)

**Roles (wiki labels):** Self-scaling

**Ability: Pride of the Prince**

> When any card in your party dies, Royal Vanguard gains 25% attack permanently.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 25% | 27.5% | 30% | 32.5% | 35% | 37.5% | …card in your party dies, Royal Vanguard gains 25% attack permanently. |

---

### Rubberbound Captain

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 243 (243) · **Base HP:** 485 (485)

**Roles (wiki labels):** Multi-hit

**Ability: Gear Second: Jet Gatling**

> 25% chance on attack to hit again for 75% more damage.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 25% | 27.5% | 30% | 32.5% | 35% | 37.5% | 25% chance on attack to hit again for 75% more damage. |
| 2 | 75% | 82.5% | 90% | 97.5% | 105% | 112.5% | 25% chance on attack to hit again for 75% more damage. |

---

### Ruler

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 4.93K (4,930) · **Base HP:** 9.87K (9,870)

**Traits:** Revive, Ignores Defense

**Roles (wiki labels):** Nuker, Cheat death

**Ability: Venuzdonoa**

> - On death, revive at 100% HP (once).
> - All attacks deal 2x damage.
> - Enemy's damage reduction effects are ignored entirely.
> - Ruler cannot be affected by any status effect.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 100% | 110% | 120% | 130% | 140% | 150% | - On death, revive at 100% HP (once). · All attacks deal 2x damage. · Enemy's… |

---

### Sand Vessel

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 316 (316) · **Base HP:** 631 (631)

**Roles (wiki labels):** Nuker, Tank

**Ability: Sand Burial**

> - Every 3 turns, Sand Burial: guaranteed hit dealing 2x damage, ignores dodge/stealth.
> - Between Sand Burials, auto-block 25% of incoming damage.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 25% | 27.5% | 30% | 32.5% | 35% | 37.5% | …dodge/stealth. · Between Sand Burials, auto-block 25% of incoming damage. |

---

### Sand Warden

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 877 (877) · **Base HP:** 1.75K (1,750)

**Roles (wiki labels):** Tank, Counter

**Ability: Sand Shield**

> - Sand Warden automatically blocks the first hit every 4 turns.
> - Below 30% HP, the sand spirit partially awakens: Sand Warden gains 50% attack and blocked hits reflect 30% damage.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 30% | 33% | 36% | 39% | 42% | 45% | …blocks the first hit every 4 turns. · Below 30% HP, the sand spirit partially awakens: Sand Warden… |
| 2 | 50% | 55% | 60% | 65% | 70% | 75% | …spirit partially awakens: Sand Warden gains 50% attack and blocked hits reflect 30% damage. |
| 3 | 30% | 33% | 36% | 39% | 42% | 45% | …Warden gains 50% attack and blocked hits reflect 30% damage. |

---

### Sand Warlord

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 3.95K (3,950) · **Base HP:** 7.9K (7,900)

**Roles (wiki labels):** Self-scaling, Debuffer

**Ability: Desert Spada / Sables**

> - Each hit that lands dries out the target: it loses 10% of its ATK (up to 50%), and Sand Warlord gains 50% of his starting ATK.
> - Sand Warlord is immune to attacks from cards below 40% HP.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 10% | 11% | 12% | 13% | 14% | 15% | …hit that lands dries out the target: it loses 10% of its ATK (up to 50%), and Sand Warlord gains… |
| 2 | 50% | 55% | 60% | 65% | 70% | 75% | …out the target: it loses 10% of its ATK (up to 50%), and Sand Warlord gains 50% of his starting… |
| 3 | 50% | 55% | 60% | 65% | 70% | 75% | …its ATK (up to 50%), and Sand Warlord gains 50% of his starting ATK. · Sand Warlord is immune… |
| 4 | 40% | 44% | 48% | 52% | 56% | 60% | …Warlord is immune to attacks from cards below 40% HP. |

---

### Scythe Meister

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 23.3K (23,300) · **Base HP:** 46.6K (46,600)

**Traits:** One Per Party, Hits All

**Roles (wiki labels):** Splash Damage, Execute

**Ability: Soul Resonance**

> - She starts with 1 Resonance, and every attack and every hit she takes builds 1 more.
> - On the 3rd, she unleashes Witch Hunter: a giant slash that deals 200% of her ATK to the enemy and 50% to every other enemy (bench included).
>
> **Reaper's Verdict**
> - Any enemy Witch Hunter leaves below 20% HP is reaped instantly.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 200% | 220% | 240% | 260% | 280% | 300% | …unleashes Witch Hunter: a giant slash that deals 200% of her ATK to the enemy and 50% to every other… |
| 2 | 50% | 55% | 60% | 65% | 70% | 75% | …that deals 200% of her ATK to the enemy and 50% to every other enemy (bench included). Reaper's… |
| 3 | 20% | 22% | 24% | 26% | 28% | 30% | …Verdict · Any enemy Witch Hunter leaves below 20% HP is reaped instantly. |

**Hits that scale with this card's ATK:** Witch Hunter (target) 200%

**Hits written as "X% damage" (probably of a normal attack):** Witch Hunter (others) 50%

---

### Sea Sovereign

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 470 (470) · **Base HP:** 939 (939)

**Roles (wiki labels):** Multi-hit, Execute

**Ability: Divine Trident**

> - Attacks hit 3 times (each hit at 50% damage).
> - Every 4 turns, Sea Sovereign uses 40-Day Flood: deal 2x damage, guaranteed kill on cards below 20% HP.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 50% | 55% | 60% | 65% | 70% | 75% | - Attacks hit 3 times (each hit at 50% damage). · Every 4 turns, Sea Sovereign uses… |
| 2 | 20% | 22% | 24% | 26% | 28% | 30% | …deal 2x damage, guaranteed kill on cards below 20% HP. |

---

### Sea Valkyrie

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 389 (389) · **Base HP:** 777 (777)

**Traits:** Ignores Defense

**Roles (wiki labels):** Nuker

**Ability: Sea Dragon's Roar**

> Every 3rd attack, unleash Sea Dragon: deal 2.5x damage, ignoring any damage reduction on the enemy.

---

### Serpent Sage

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 971 (971) · **Base HP:** 1.94K (1,940)

**Traits:** Revive, Heal

**Roles (wiki labels):** Cheat death, Healer, Self-scaling

**Ability: Shedding Skin**

> - Every 5 turns, Serpent Sage sheds, healing to 60% HP and gaining 10% stats.
> - On death, he revives once at 30% HP in a new form with 25% more attack.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 60% | 66% | 72% | 78% | 84% | 90% | …Every 5 turns, Serpent Sage sheds, healing to 60% HP and gaining 10% stats. · On death, he revives… |
| 2 | 10% | 11% | 12% | 13% | 14% | 15% | …Serpent Sage sheds, healing to 60% HP and gaining 10% stats. · On death, he revives once at 30% HP… |
| 3 | 30% | 33% | 36% | 39% | 42% | 45% | …gaining 10% stats. · On death, he revives once at 30% HP in a new form with 25% more attack. |
| 4 | 25% | 27.5% | 30% | 32.5% | 35% | 37.5% | …he revives once at 30% HP in a new form with 25% more attack. |

---

### Serpent Witch

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 800 (800) · **Base HP:** 1.6K (1,600)

**Traits:** Poison

**Roles (wiki labels):** Damage over time

**Ability: Vector Venom**

> - Attacks add a Poison stack to the enemy (50% of this card's ATK per turn for 3 turns).
>
> **Snake Migration**
> - When a Poisoned enemy dies, its Poison slithers to another enemy.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 50% | 55% | 60% | 65% | 70% | 75% | - Attacks add a Poison stack to the enemy (50% of this card's ATK per turn for 3 turns). Snake… |

**Hits that scale with this card's ATK:** Poison per turn 50%

---

### Shade Prince

Battle card · Rarity: 1 in 3.5B · Origin: Card pack (Forged Pack)

**Base DMG:** 9.33K (9,330) · **Base HP:** 18.6K (18,600)

**Traits:** Revive, Hits All, Entry Effect

**Roles (wiki labels):** Splash Damage, Self-scaling, Cheat death, Entry effect

**Ability: Living Shadow**

> **Shadow Lash**
> - On entry, he hits all enemies for 10% of his ATK.
>
> **Living Shadow**
> - Whenever he damages an enemy, all other enemies take 50% of that damage (20% when the damage comes from an ability or a support).
>
> **Devour**
> - When that shadow damage kills an enemy, he permanently gains +20% ATK and max HP (max 3 times).
>
> **Homunculus Core**
> - The first time he would die, he revives with 40% of his max HP.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 10% | 11% | 12% | 13% | 14% | 15% | Shadow Lash · On entry, he hits all enemies for 10% of his ATK. Living Shadow · Whenever he damages… |
| 2 | 50% | 55% | 60% | 65% | 70% | 75% | …he damages an enemy, all other enemies take 50% of that damage (20% when the damage comes from… |
| 3 | 20% | 22% | 24% | 26% | 28% | 30% | …enemy, all other enemies take 50% of that damage (20% when the damage comes from an ability or a support).… |
| 4 | +20% | +22% | +24% | +26% | +28% | +30% | …damage kills an enemy, he permanently gains +20% ATK and max HP (max 3 times). Homunculus Core… |
| 5 | 40% | 44% | 48% | 52% | 56% | 60% | …The first time he would die, he revives with 40% of his max HP. |

**Hits that scale with this card's ATK:** Entry hit 10%

---

### Shadow Heir

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 1.78K (1,780) · **Base HP:** 3.56K (3,560)

**Traits:** Dodge, Burn, Ignores Defense, Entry Effect

**Roles (wiki labels):** Nuker, Evasion, Counter, Entry effect

**Ability: Amenotejikara / Susanoo Chidori**

> - On entry, Amenotejikara causes the enemy's first attack to miss and Shadow Heir immediately counters for 1.5x damage.
> - Every 3 turns, Shadow Heir dodges the next attack.
> - Every 4th attack becomes a Susanoo Chidori dealing 3x damage and ignoring damage reduction.
> - Below 30% HP, Perfect Susanoo activates, granting 40% damage reduction and causing attacks to burn the enemy for 40% of this card's ATK per turn for 2 turns.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 30% | 33% | 36% | 39% | 42% | 45% | …damage and ignoring damage reduction. · Below 30% HP, Perfect Susanoo activates, granting 40% damage… |
| 2 | 40% | 44% | 48% | 52% | 56% | 60% | …30% HP, Perfect Susanoo activates, granting 40% damage reduction and causing attacks to burn… |
| 3 | 40% | 44% | 48% | 52% | 56% | 60% | …reduction and causing attacks to burn the enemy for 40% of this card's ATK per turn for 2 turns. |

**Hits that scale with this card's ATK:** Susanoo burn per turn 40%

---

### Shadow King

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 7.04K (7,040) · **Base HP:** 14K (14,000)

**Traits:** Not On Bosses, Summon

**Roles (wiki labels):** Summoner, Self-scaling

**Ability: Eternal Legion**

> - Enemies he kills rise as Shadows on your side, in front of him, with 75% of the stats they started the battle with (no effect on boss NPCs or Shadows).
> - Each time one of his Shadows dies, he permanently gains +75% ATK and max HP.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 75% | 82.5% | 90% | 97.5% | 105% | 112.5% | …Shadows on your side, in front of him, with 75% of the stats they started the battle with (no… |
| 2 | +75% | +82.5% | +90% | +97.5% | +105% | +112.5% | …one of his Shadows dies, he permanently gains +75% ATK and max HP. |

---

### Shadow Monarch

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 2K (2,000) · **Base HP:** 4K (4,000)

**Traits:** Summon

**Roles (wiki labels):** Summoner

**Ability: Arise**

> - On kill, raise the defeated card as a shadow with 40% of its stats.
> - The shadow fights in Shadow Monarch's place for 2 turns, or until it falls.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 40% | 44% | 48% | 52% | 56% | 60% | …kill, raise the defeated card as a shadow with 40% of its stats. · The shadow fights in Shadow Monarch's… |

---

### Shadow Strategist

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 36 (36) · **Base HP:** 71 (71)

**Traits:** Stun, Entry Effect

**Roles (wiki labels):** Crowd control, Entry effect

**Ability: Shadow Paralysis**

> On entry, stun the enemy card for 1 turn.

---

### Shark Swordsman

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 444 (444) · **Base HP:** 888 (888)

**Traits:** Heal

**Roles (wiki labels):** Healer, Splash Damage

**Ability: Super Shark Bomb**

> - Every 4 turns, flood dealing 10% max HP to all cards (both sides), Shark Swordsman heals for double what he took if he survives.
> - Attacks heal for 20% of damage dealt.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 10% | 11% | 12% | 13% | 14% | 15% | - Every 4 turns, flood dealing 10% max HP to all cards (both sides), Shark Swordsman… |
| 2 | 20% | 22% | 24% | 26% | 28% | 30% | …what he took if he survives. · Attacks heal for 20% of damage dealt. |

---

### Sharpshooter

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 9.19K (9,190) · **Base HP:** 18.3K (18,300)

**Traits:** Stun, Can't Miss

**Roles (wiki labels):** Nuker, Crowd control

**Ability: Scoped Shot**

> Every 3rd attack is a charged shot that deals 220% damage, cannot be dodged and stuns the enemy for 1 turn.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 220% | 242% | 264% | 286% | 308% | 330% | Every 3rd attack is a charged shot that deals 220% damage, cannot be dodged and stuns the enemy… |

**Hits written as "X% damage" (probably of a normal attack):** Charged shot 220%

---

### Shrine Maiden Princess

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 8.78K (8,780) · **Base HP:** 17.5K (17,500)

**Traits:** Shield, Heal

**Roles (wiki labels):** Team support, Healer, Works from the bench

**Ability: Purifying Ward**

> - At the start of each of your cards' turns, it heals 20% of its max HP.
> - Healing past full HP becomes a shield, up to 50% of its max HP.
> - Works from anywhere in your party.
> - Copies don't stack.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 20% | 22% | 24% | 26% | 28% | 30% | …start of each of your cards' turns, it heals 20% of its max HP. · Healing past full HP becomes… |
| 2 | 50% | 55% | 60% | 65% | 70% | 75% | …Healing past full HP becomes a shield, up to 50% of its max HP. · Works from anywhere in your… |

---

### Silent Swordsman

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 184 (184) · **Base HP:** 367 (367)

**Traits:** Dodge

**Roles (wiki labels):** Evasion, Nuker

**Ability: Water Breathing: Dead Calm**

> - Dodge all attacks for the first 2 turns.
> - After that, next attack deals 2x damage.

**Hits written as "X% damage" (probably of a normal attack):** Post-dodge hit 200%

---

### Silver Chariot

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 7.68K (7,680) · **Base HP:** 15.3K (15,300)

**Traits:** One Per Party, Dodge, Ignores Defense, Can't Miss

**Roles (wiki labels):** Multi-hit, Tank, Nuker, Evasion

**Ability: Rapier Flurry / Armor Off**

> **Rapier Flurry**
> - Every attack strikes 3 times for 55% damage each.
>
> **Armor**
> - Attacks deal 25% less damage to him.
>
> **Armor Off**
> - Once he falls to 50% HP, or the first time he would die (he survives at 1 HP), he sheds his armor and fires his blade: his next attack deals 500% damage, can't be dodged and ignores damage reduction.
> - After that his flurries strike 5 times, and his afterimages dodge every 2nd attack aimed at him.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 55% | 60.5% | 66% | 71.5% | 77% | 82.5% | Rapier Flurry · Every attack strikes 3 times for 55% damage each. Armor · Attacks deal 25% less damage… |
| 2 | 25% | 27.5% | 30% | 32.5% | 35% | 37.5% | …times for 55% damage each. Armor · Attacks deal 25% less damage to him. Armor Off · Once he falls… |
| 3 | 50% | 55% | 60% | 65% | 70% | 75% | …damage to him. Armor Off · Once he falls to 50% HP, or the first time he would die (he survives… |
| 4 | 500% | 550% | 600% | 650% | 700% | 750% | …armor and fires his blade: his next attack deals 500% damage, can't be dodged and ignores damage reduction.… |

**Hits written as "X% damage" (probably of a normal attack):** Flurry hit 55%, Blade shot 500%

---

### Sixfold Prophet

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 676 (676) · **Base HP:** 1.35K (1,350)

**Traits:** Once Per Battle, Summon, Hits All, Heal

**Roles (wiki labels):** Splash Damage, Multi-hit, Crowd control, Summoner

**Ability: Six Paths**

> - Each turn he uses the next Path: Deva: his attack hits every enemy for 75% ATK.
>
> **Asura**
> - His attack hits 3 times for 60% ATK.
>
> **Preta**
> - Blocks the next hit he takes.
>
> **Animal**
> - Summons a Path body with 30% of his stats (once per battle).
>
> **Human**
> - His attack makes the target lose its ability for 2 turns.
>
> **Naraka**
> - Heals himself 30% of his max HP and removes his debuffs.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 75% | 82.5% | 90% | 97.5% | 105% | 112.5% | …Path: Deva: his attack hits every enemy for 75% ATK. Asura · His attack hits 3 times for 60%… |
| 2 | 60% | 66% | 72% | 78% | 84% | 90% | …75% ATK. Asura · His attack hits 3 times for 60% ATK. Preta · Blocks the next hit he takes. Animal… |
| 3 | 30% | 33% | 36% | 39% | 42% | 45% | …he takes. Animal · Summons a Path body with 30% of his stats (once per battle). Human · His attack… |
| 4 | 30% | 33% | 36% | 39% | 42% | 45% | …ability for 2 turns. Naraka · Heals himself 30% of his max HP and removes his debuffs. |

**Hits that scale with this card's ATK:** Deva (all enemies) 75%, Asura (per hit, x3) 60%

---

### Skeleton Boy

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 2.95K (2,950) · **Base HP:** 5.9K (5,900)

**Traits:** Death Effect

**Roles (wiki labels):** Debuffer, Nuker, Death effect

**Ability: Anti-Void Strings**

> - On enemy entry, wrap strings around the enemy: they deal 40% less damage and take 30% more damage for the entire fight.
> - Skeleton Boy's attacks deal 2x damage.
> - On death, crash the anti-void: deal 100% of Skeleton Boy's max HP to the active enemy.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 40% | 44% | 48% | 52% | 56% | 60% | …entry, wrap strings around the enemy: they deal 40% less damage and take 30% more damage for the… |
| 2 | 30% | 33% | 36% | 39% | 42% | 45% | …the enemy: they deal 40% less damage and take 30% more damage for the entire fight. · Skeleton… |
| 3 | 100% | 110% | 120% | 130% | 140% | 150% | …damage. · On death, crash the anti-void: deal 100% of Skeleton Boy's max HP to the active enemy. |

---

### Sketching Menace

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 1.61K (1,610) · **Base HP:** 3.22K (3,220)

**Traits:** Not On Bosses

**Roles (wiki labels):** Crowd control, Damage over time

**Ability: Me Hoy Minoy**

> - Permanently erase the enemy's ability on hit.
> - Each turn, erase 20% of the enemy's max HP (no effect on boss NPCs).

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 20% | 22% | 24% | 26% | 28% | 30% | …the enemy's ability on hit. · Each turn, erase 20% of the enemy's max HP (no effect on boss NPCs). |

---

### Slime

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 14 (14) · **Base HP:** 27 (27)

**Traits:** Revive

**Roles (wiki labels):** Cheat death

**Ability: Mitosis**

> The first time Slime falls, it gets back up with half its stats.

---

### Slime Virtuoso

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 20.1K (20,100) · **Base HP:** 40.3K (40,300)

**Traits:** Can't Miss

**Roles (wiki labels):** Multi-hit, Nuker

**Ability: Concerto**

> **Concerto**
> - Her attacks hit 5 times for 40% damage each and can't be dodged.
> - Every attack she lands adds 1 hit to the next (max 6).
>
> **Finale**
> - The 6th hit deals 300% of her ATK, then she goes back to 5 hits.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 40% | 44% | 48% | 52% | 56% | 60% | Concerto · Her attacks hit 5 times for 40% damage each and can't be dodged. · Every attack… |
| 2 | 300% | 330% | 360% | 390% | 420% | 450% | …the next (max 6). Finale · The 6th hit deals 300% of her ATK, then she goes back to 5 hits. |

**Hits that scale with this card's ATK:** Finale hit 300%

**Hits written as "X% damage" (probably of a normal attack):** Concerto hit 40%

---

### Snacktime Menace

Battle card · Rarity: unknown · Origin: Weather (Cataclysm)

**Base DMG:** 8.06K (8,060) · **Base HP:** 16.1K (16,100)

**Traits:** Hits All, Heal

**Roles (wiki labels):** Healer, Self-scaling, Splash Damage, Cheat death

**Ability: Hungry**

> - Heals for 15% of the damage she deals, plus 1% more for every 1% HP she's missing.
> - Each kill heals 30% of her missing HP and gives +100% ATK.
> - Attacking and taking hits fill her Hunger: at 5 she frenzies for 2 turns, attacking random enemies (bench included) for 200% damage with double healing, but she takes 25% more damage.
> - Each kill adds a turn of frenzy.
> - The first hit that would kill her deals 80% less: she heals 50% of her missing HP and hits every enemy for 200% ATK.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 15% | 16.5% | 18% | 19.5% | 21% | 22.5% | - Heals for 15% of the damage she deals, plus 1% more for every… |
| 2 | 1% | 1.1% | 1.2% | 1.3% | 1.4% | 1.5% | …Heals for 15% of the damage she deals, plus 1% more for every 1% HP she's missing. · Each kill… |
| 3 | 1% | 1.1% | 1.2% | 1.3% | 1.4% | 1.5% | …the damage she deals, plus 1% more for every 1% HP she's missing. · Each kill heals 30% of her… |
| 4 | 30% | 33% | 36% | 39% | 42% | 45% | …every 1% HP she's missing. · Each kill heals 30% of her missing HP and gives +100% ATK. · Attacking… |
| 5 | +100% | +110% | +120% | +130% | +140% | +150% | …Each kill heals 30% of her missing HP and gives +100% ATK. · Attacking and taking hits fill her Hunger:… |
| 6 | 200% | 220% | 240% | 260% | 280% | 300% | …attacking random enemies (bench included) for 200% damage with double healing, but she takes 25%… |
| 7 | 25% | 27.5% | 30% | 32.5% | 35% | 37.5% | …200% damage with double healing, but she takes 25% more damage. · Each kill adds a turn of frenzy.… |
| 8 | 80% | 88% | 96% | 104% | 112% | 120% | …frenzy. · The first hit that would kill her deals 80% less: she heals 50% of her missing HP and hits… |
| 9 | 50% | 55% | 60% | 65% | 70% | 75% | …that would kill her deals 80% less: she heals 50% of her missing HP and hits every enemy for 200%… |
| 10 | 200% | 220% | 240% | 260% | 280% | 300% | …50% of her missing HP and hits every enemy for 200% ATK. |

**Hits that scale with this card's ATK:** Frenzy attack 200%, Near-death hit (all) 200%

---

### Solar Brawler

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 549 (549) · **Base HP:** 1.09K (1,090)

**Roles (wiki labels):** Self-scaling

**Ability: Saiyan Growth**

> Every turn, gain 20% stats.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 20% | 22% | 24% | 26% | 28% | 30% | Every turn, gain 20% stats. |

---

### Soul Reaper

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 445 (445) · **Base HP:** 890 (890)

**Traits:** Revive

**Roles (wiki labels):** Cheat death

**Ability: Hollow Resurrection**

> - On death, revive at 50% HP with 20% more attack.
> - One time.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 50% | 55% | 60% | 65% | 70% | 75% | - On death, revive at 50% HP with 20% more attack. · One time. |
| 2 | 20% | 22% | 24% | 26% | 28% | 30% | - On death, revive at 50% HP with 20% more attack. · One time. |

---

### Spiral Digger

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 37.8K (37,800) · **Base HP:** 75.6K (75,600)

**Traits:** Stun, Revive, Entry Effect

**Roles (wiki labels):** Self-scaling, Crowd control, Cheat death, Entry effect

**Ability: Spiral Drill**

> - On entry, he drills through the enemy in front: it's stunned for 1 turn.
> - Every time he's attacked, his Spiral grows: +20% attack, up to 3 times.
> - The first time he dies, he gets back up at 50% HP with 100% more attack.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | +20% | +22% | +24% | +26% | +28% | +30% | …Every time he's attacked, his Spiral grows: +20% attack, up to 3 times. · The first time he dies,… |
| 2 | 50% | 55% | 60% | 65% | 70% | 75% | …· The first time he dies, he gets back up at 50% HP with 100% more attack. |
| 3 | 100% | 110% | 120% | 130% | 140% | 150% | …time he dies, he gets back up at 50% HP with 100% more attack. |

---

### Star Fist

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 30.7K (30,700) · **Base HP:** 61.4K (61,400)

**Traits:** One Per Party, Once Per Battle, Stun, Heal

**Roles (wiki labels):** Multi-hit, Self-scaling, Team support, Healer

**Ability: Ora Rush / Restore**

> **Ora Rush**
> - Every attack strikes 4 times for 40% damage each, and every 2nd attack fuses the target into the wall (Stun, 1 turn).
>
> **Rage**
> - Every attack that lands on him or an ally, even while he waits on the bench, gives him +100% ATK (up to +400%).
>
> **Restore**
> - He can fix anything but himself.
> - At the start of his turns the most hurt ally on the bench heals 20% of its max HP, and once per battle the first ally to fall is restored at 50% HP.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 40% | 44% | 48% | 52% | 56% | 60% | Ora Rush · Every attack strikes 4 times for 40% damage each, and every 2nd attack fuses the target… |
| 2 | +100% | +110% | +120% | +130% | +140% | +150% | …even while he waits on the bench, gives him +100% ATK (up to +400%). Restore · He can fix anything… |
| 3 | +400% | +440% | +480% | +520% | +560% | +600% | …waits on the bench, gives him +100% ATK (up to +400%). Restore · He can fix anything but himself.… |
| 4 | 20% | 22% | 24% | 26% | 28% | 30% | …turns the most hurt ally on the bench heals 20% of its max HP, and once per battle the first… |
| 5 | 50% | 55% | 60% | 65% | 70% | 75% | …battle the first ally to fall is restored at 50% HP. |

**Hits written as "X% damage" (probably of a normal attack):** Ora hit 40%

---

### Static Ghost

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 93.5K (93,500) · **Base HP:** 187K (187,000)

**Traits:** One Per Party, Hits All, Can't Miss

**Roles (wiki labels):** Splash Damage, Tank, Crowd control, Cheat death

**Ability: Ghost Protocol**

> - Static Ghost starts the battle jacked into the Net for 3 turns: he takes 90% less damage, and his attacks hit every enemy card for 100% damage that can't be dodged.
>
> **Possession**
> - The first time each enemy card uses its ability, he hacks it: it is Silenced for 2 turns and he permanently gains 15% attack.
>
> **Blackwall**
> - The first time he would die, he returns at full HP and jacks back into the Net for 3 turns.
> - After that, his attacks also hit every other enemy card for 50% damage.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 90% | 99% | 108% | 117% | 126% | 135% | …battle jacked into the Net for 3 turns: he takes 90% less damage, and his attacks hit every enemy… |
| 2 | 100% | 110% | 120% | 130% | 140% | 150% | …damage, and his attacks hit every enemy card for 100% damage that can't be dodged. Possession · The… |
| 3 | 15% | 16.5% | 18% | 19.5% | 21% | 22.5% | …Silenced for 2 turns and he permanently gains 15% attack. Blackwall · The first time he would die,… |
| 4 | 50% | 55% | 60% | 65% | 70% | 75% | …attacks also hit every other enemy card for 50% damage. |

**Hits written as "X% damage" (probably of a normal attack):** Net hit (all) 100%, Blackwall splash 50%

---

### Steel Alchemist

Battle card · Rarity: 1 in 1.5B · Origin: Card pack (Forged Pack)

**Base DMG:** 7.23K (7,230) · **Base HP:** 14.4K (14,400)

**Traits:** Entry Effect

**Roles (wiki labels):** Tank, Summoner, Self-scaling, Entry effect

**Ability: Equivalent Exchange**

> **Clap**
> - On entry he raises 2 stone guardians (summons), and 1 more every 4 turns (max 2).
> - While no card in your party has more ATK (fallen ones included), a guardian blocks each hit on him and crumbles.
>
> **Equivalent Exchange**
> - Every hit a guardian blocks permanently gives him +35% of his starting ATK (max 8 times).

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | +35% | +38.5% | +42% | +45.5% | +49% | +52.5% | …hit a guardian blocks permanently gives him +35% of his starting ATK (max 8 times). |

---

### Stone World Scientist

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 9.4K (9,400) · **Base HP:** 18.8K (18,800)

**Roles (wiki labels):** Team support, Damage over time, Works from the bench

**Ability: Chemistry**

> - Burn, Poison and Bleed from your cards deal 50% more damage.
> - Works from anywhere in your party.
> - Copies don't stack.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 50% | 55% | 60% | 65% | 70% | 75% | …Burn, Poison and Bleed from your cards deal 50% more damage. · Works from anywhere in your party.… |

---

### String Emperor

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 5.12K (5,120) · **Base HP:** 10.2K (10,200)

**Traits:** Hits All, Heal, Entry Effect

**Roles (wiki labels):** Debuffer, Splash Damage, Healer, Entry effect

**Ability: Parasite String / Ever White**

> - On entry, place strings on 2 random enemy cards, causing them to deal 25% less damage.
> - Every 3 turns, String Emperor heals 10% max HP.
> - Below 25% HP, he awakens the battlefield, dealing 8% of his max HP to all enemy cards each turn.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 25% | 27.5% | 30% | 32.5% | 35% | 37.5% | …on 2 random enemy cards, causing them to deal 25% less damage. · Every 3 turns, String Emperor… |
| 2 | 10% | 11% | 12% | 13% | 14% | 15% | …damage. · Every 3 turns, String Emperor heals 10% max HP. · Below 25% HP, he awakens the battlefield,… |
| 3 | 25% | 27.5% | 30% | 32.5% | 35% | 37.5% | …turns, String Emperor heals 10% max HP. · Below 25% HP, he awakens the battlefield, dealing 8% of… |
| 4 | 8% | 8.8% | 9.6% | 10.4% | 11.2% | 12% | …25% HP, he awakens the battlefield, dealing 8% of his max HP to all enemy cards each turn. |

---

### Sun God

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 4.63K (4,630) · **Base HP:** 9.27K (9,270)

**Traits:** Entry Effect

**Roles (wiki labels):** Tank, Counter, Debuffer, Entry effect

**Ability: Rubber Field**

> - On entry, turns the battlefield into rubber.
> - While he's on it, he takes 50% less damage from attacks and bounces the other 50% back at the attacker.
> - Attackers become Dizzy: 20% more damage taken from everything per stack, for 3 turns.
> - Dizzy stacks.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 50% | 55% | 60% | 65% | 70% | 75% | …battlefield into rubber. · While he's on it, he takes 50% less damage from attacks and bounces the other… |
| 2 | 50% | 55% | 60% | 65% | 70% | 75% | …less damage from attacks and bounces the other 50% back at the attacker. · Attackers become Dizzy:… |
| 3 | 20% | 22% | 24% | 26% | 28% | 30% | …back at the attacker. · Attackers become Dizzy: 20% more damage taken from everything per stack,… |

---

### Sunbreath Swordsman

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 69 (69) · **Base HP:** 137 (137)

**Roles (wiki labels):** Nuker

**Ability: Water Breathing: First Form**

> First hit against any new card deals 35% more damage.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 35% | 38.5% | 42% | 45.5% | 49% | 52.5% | First hit against any new card deals 35% more damage. |

---

### Sungsho

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 746 (746) · **Base HP:** 1.49K (1,490)

**Roles (wiki labels):** Self-scaling

**Ability: Shadow Inheritance**

> When any card in your party dies, Sungsho gains 20% of their stats.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 20% | 22% | 24% | 26% | 28% | 30% | When any card in your party dies, Sungsho gains 20% of their stats. |

---

### Surgeon

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 750 (750) · **Base HP:** 1.49K (1,490)

**Traits:** Heal

**Roles (wiki labels):** Debuffer, Healer

**Ability: Chakra Scalpel**

> - Attacks permanently reduce the enemy's attack by 8%, stacking with each hit.
> - Every 3 turns, Surgeon heals for 20% max HP.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 8% | 8.8% | 9.6% | 10.4% | 11.2% | 12% | …Attacks permanently reduce the enemy's attack by 8%, stacking with each hit. · Every 3 turns, Surgeon… |
| 2 | 20% | 22% | 24% | 26% | 28% | 30% | …each hit. · Every 3 turns, Surgeon heals for 20% max HP. |

---

### Symmetry Reaper

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 400 (400) · **Base HP:** 800 (800)

**Traits:** Can't Miss

**Roles (wiki labels):** Multi-hit, Nuker

**Ability: Perfect Symmetry**

> **Twin Pistols**
> - Every attack fires 2 shots of 60% damage.
> - Each shot that lands adds 1 Symmetry.
> - At 8 Symmetry he fires the Death Cannon: 400% of his ATK that can't be dodged or blocked.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 60% | 66% | 72% | 78% | 84% | 90% | Twin Pistols · Every attack fires 2 shots of 60% damage. · Each shot that lands adds 1 Symmetry.… |
| 2 | 400% | 440% | 480% | 520% | 560% | 600% | …Symmetry. · At 8 Symmetry he fires the Death Cannon: 400% of his ATK that can't be dodged or blocked. |

**Hits that scale with this card's ATK:** Death Cannon 400%

**Hits written as "X% damage" (probably of a normal attack):** Pistol shot 60%

---

### The Dancer

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 1K (1,000) · **Base HP:** 2K (2,000)

**Roles (wiki labels):** Nuker

**Ability: Sword of Light**

> - Deal 15% more damage to cards with higher stats than The Dancer.
> - Every 3rd attack is a guaranteed crit (2x damage).

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 15% | 16.5% | 18% | 19.5% | 21% | 22.5% | - Deal 15% more damage to cards with higher stats than The… |

---

### The Eminence

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 24.8K (24,800) · **Base HP:** 49.6K (49,600)

**Traits:** Hits All, Can't Miss

**Roles (wiki labels):** Counter, Splash Damage, Cheat death

**Ability: I Am Atomic**

> **Godstep**
> - Whenever an enemy attacks him, he strikes it first for 60% of his ATK.
> - If that kills it, its attack is cancelled.
>
> **I Am Atomic**
> - He gets 2 Atomic per Godstep and 1 per attack he lands.
> - At 5 Atomic he uses it all to deal 200% of his ATK to the enemy in front (can't be dodged) and 100% of his ATK to every other enemy.
> - The first time he would die, he stays at 1 HP and uses I Am Atomic.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 60% | 66% | 72% | 78% | 84% | 90% | …an enemy attacks him, he strikes it first for 60% of his ATK. · If that kills it, its attack is… |
| 2 | 200% | 220% | 240% | 260% | 280% | 300% | …lands. · At 5 Atomic he uses it all to deal 200% of his ATK to the enemy in front (can't be dodged)… |
| 3 | 100% | 110% | 120% | 130% | 140% | 150% | …to the enemy in front (can't be dodged) and 100% of his ATK to every other enemy. · The first… |

**Hits that scale with this card's ATK:** Godstep strike 60%, Atomic (front) 200%, Atomic (others) 100%

---

### The Griefer

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 2.58K (2,580) · **Base HP:** 5.16K (5,160)

**Traits:** Revive

**Roles (wiki labels):** Debuffer, Team support, Cheat death

**Ability: World Corruption**

> - On enemy entry, corrupt the enemy's ability: every 3rd turn it glitches and hits itself for 200% of The Griefer's attack.
> - Each glitch gives your party +10% damage for the rest of the battle.
> - The first time The Griefer dies he is removed, then returns behind your last card with 50% HP.
> - The Griefer attacks deal 1.3x damage.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 200% | 220% | 240% | 260% | 280% | 300% | …every 3rd turn it glitches and hits itself for 200% of The Griefer's attack. · Each glitch gives… |
| 2 | +10% | +11% | +12% | +13% | +14% | +15% | …Griefer's attack. · Each glitch gives your party +10% damage for the rest of the battle. · The first… |
| 3 | 50% | 55% | 60% | 65% | 70% | 75% | …removed, then returns behind your last card with 50% HP. · The Griefer attacks deal 1.3x damage. |

**Hits that scale with this card's ATK:** Glitch self-hit 200%

---

### The Hand

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 21.3K (21,300) · **Base HP:** 42.7K (42,700)

**Traits:** One Per Party, Can't Miss

**Roles (wiki labels):** Nuker, Debuffer

**Ability: Erase**

> **Erase**
> - His every 2nd attack scrapes space away.
> - It deals 400% damage, can't be dodged, ignores all damage reduction, and permanently erases 15% of the target's max HP (not a boss's).
>
> **Scrape Space**
> - When he kills a card, the next enemy that comes in is dragged straight to him and takes 500% of his ATK.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 400% | 440% | 480% | 520% | 560% | 600% | …every 2nd attack scrapes space away. · It deals 400% damage, can't be dodged, ignores all damage reduction,… |
| 2 | 15% | 16.5% | 18% | 19.5% | 21% | 22.5% | …all damage reduction, and permanently erases 15% of the target's max HP (not a boss's). Scrape… |
| 3 | 500% | 550% | 600% | 650% | 700% | 750% | …comes in is dragged straight to him and takes 500% of his ATK. |

**Hits that scale with this card's ATK:** Scrape Space 500%

**Hits written as "X% damage" (probably of a normal attack):** Erase 400%

---

### The Needle Hunter

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 75.6K (75,600) · **Base HP:** 151K (151,000)

**Traits:** Dodge, Hits All, Pierce

**Roles (wiki labels):** Evasion, Counter, Splash Damage

**Ability: Needle Dance**

> - Dodges the first attack from each enemy and counters for 150% damage.
> - Whenever this card attacks, it has a 33% chance to launch a needle through the target, dealing 150% damage to all enemies behind it.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 150% | 165% | 180% | 195% | 210% | 225% | …first attack from each enemy and counters for 150% damage. · Whenever this card attacks, it has… |
| 2 | 33% | 36.3% | 39.6% | 42.9% | 46.2% | 49.5% | …damage. · Whenever this card attacks, it has a 33% chance to launch a needle through the target,… |
| 3 | 150% | 165% | 180% | 195% | 210% | 225% | …launch a needle through the target, dealing 150% damage to all enemies behind it. |

**Hits written as "X% damage" (probably of a normal attack):** Dodge counter 150%, Needle pierce 150%

---

### The Struggler

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 1.26K (1,260) · **Base HP:** 2.51K (2,510)

**Roles (wiki labels):** Self-scaling, Cheat death

**Ability: Berserker Armor**

> - Lose 5% max HP every turn (never below 1), gain 15% attack.
> - Below 20% HP, Berserker Armor: immune to death for 2 turns, 2x attack.
> - After 2 turns, The Struggler dies.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 5% | 5.5% | 6% | 6.5% | 7% | 7.5% | - Lose 5% max HP every turn (never below 1), gain 15% attack.… |
| 2 | 15% | 16.5% | 18% | 19.5% | 21% | 22.5% | …Lose 5% max HP every turn (never below 1), gain 15% attack. · Below 20% HP, Berserker Armor: immune… |
| 3 | 20% | 22% | 24% | 26% | 28% | 30% | …turn (never below 1), gain 15% attack. · Below 20% HP, Berserker Armor: immune to death for 2 turns,… |

---

### The World

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 1.36M (1,360,000) · **Base HP:** 2.73M (2,730,000)

**Traits:** One Per Party, Once Per Battle, Lifesteal, Hits All, Can't Miss

**Roles (wiki labels):** Crowd control, Nuker, Multi-hit, Healer

**Ability: Time Stop**

> **Time Stop**
> - The moment he enters time stops and the enemy loses its next 2 turns.
> - It stops again on his every 3rd turn, for 2 enemy turns.
> - While time is stopped his attacks deal 300% damage and can't be dodged, and when it moves again the knives he left in the air hit every enemy for 300% of his ATK.
>
> **Muda Barrage**
> - Every attack strikes 3 times for 50% damage each, and he heals for 50% of the damage his hits deal.
>
> **Road Roller**
> - Once per battle, at or under 30% HP, he heals 40% of his max HP and drops it on the enemy in front for 800% of his ATK.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 300% | 330% | 360% | 390% | 420% | 450% | …turns. · While time is stopped his attacks deal 300% damage and can't be dodged, and when it moves… |
| 2 | 300% | 330% | 360% | 390% | 420% | 450% | …knives he left in the air hit every enemy for 300% of his ATK. Muda Barrage · Every attack strikes… |
| 3 | 50% | 55% | 60% | 65% | 70% | 75% | …Muda Barrage · Every attack strikes 3 times for 50% damage each, and he heals for 50% of the damage… |
| 4 | 50% | 55% | 60% | 65% | 70% | 75% | …times for 50% damage each, and he heals for 50% of the damage his hits deal. Road Roller · Once… |
| 5 | 30% | 33% | 36% | 39% | 42% | 45% | …deal. Road Roller · Once per battle, at or under 30% HP, he heals 40% of his max HP and drops it on… |
| 6 | 40% | 44% | 48% | 52% | 56% | 60% | …Once per battle, at or under 30% HP, he heals 40% of his max HP and drops it on the enemy in front… |
| 7 | 800% | 880% | 960% | 1040% | 1120% | 1200% | …max HP and drops it on the enemy in front for 800% of his ATK. |

**Hits that scale with this card's ATK:** Knives (all) 300%, Time-stop attack 300%, Road Roller 800%

**Hits written as "X% damage" (probably of a normal attack):** Barrage hit 50%

---

### Thread Demon

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 1.13K (1,130) · **Base HP:** 2.27K (2,270)

**Traits:** Hits All, Entry Effect, Death Effect

**Roles (wiki labels):** Counter, Splash Damage, Entry effect, Death effect

**Ability: Blood Demon Art: Threads**

> - On entry, place threads on the enemy team.
> - The first card to attack Thread Demon takes reflected damage equal to 20% of its own attack.
> - Threads break after triggering once, but Thread Demon replaces them every 3 turns.
> - On death, the threads deal 10% max HP damage to all enemy cards.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 20% | 22% | 24% | 26% | 28% | 30% | …Thread Demon takes reflected damage equal to 20% of its own attack. · Threads break after triggering… |
| 2 | 10% | 11% | 12% | 13% | 14% | 15% | …every 3 turns. · On death, the threads deal 10% max HP damage to all enemy cards. |

---

### Threeblade Ronin

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 620 (620) · **Base HP:** 1.24K (1,240)

**Roles (wiki labels):** Nuker, Cheat death

**Ability: Three Thousand Worlds / Ashura**

> - Every 4th attack, Ashura manifests: 3x damage strike.
>
> **Last Stand**
> - The first time Threeblade Ronin would fall, it stays at 1 HP and still attacks for 1 more turn.

**Hits written as "X% damage" (probably of a normal attack):** Ashura strike 300%

---

### Thriller King

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 1.92K (1,920) · **Base HP:** 3.84K (3,840)

**Traits:** Not On Bosses, Revive

**Roles (wiki labels):** Cheat death, Damage over time

**Ability: Biokinesis**

> - Every turn Thriller King is alive, the active enemy card takes 8% max HP damage (no effect on boss NPCs).
> - On death, Thriller King splits with 70% of his previous stats and can split up to 3 times.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 8% | 8.8% | 9.6% | 10.4% | 11.2% | 12% | …Thriller King is alive, the active enemy card takes 8% max HP damage (no effect on boss NPCs). · On… |
| 2 | 70% | 77% | 84% | 91% | 98% | 105% | …NPCs). · On death, Thriller King splits with 70% of his previous stats and can split up to 3 times. |

---

### Thunder Maniac

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 85 (85) · **Base HP:** 169 (169)

**Traits:** Stun, Entry Effect

**Roles (wiki labels):** Crowd control, Self-scaling, Entry effect

**Ability: Lightning Battle Fiend**

> - On entry, attack immediately for 60% damage, unless he is stunned, frozen or asleep.
> - Every 3rd attack has a 50% chance to stun for 1 turn.
> - Whenever he stuns an enemy, he permanently gains 8% attack, stacking up to 5 times.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 60% | 66% | 72% | 78% | 84% | 90% | - On entry, attack immediately for 60% damage, unless he is stunned, frozen or asleep.… |
| 2 | 50% | 55% | 60% | 65% | 70% | 75% | …stunned, frozen or asleep. · Every 3rd attack has a 50% chance to stun for 1 turn. · Whenever he stuns… |
| 3 | 8% | 8.8% | 9.6% | 10.4% | 11.2% | 12% | …Whenever he stuns an enemy, he permanently gains 8% attack, stacking up to 5 times. |

**Hits written as "X% damage" (probably of a normal attack):** Entry hit 60%

---

### Thunder Prodigy

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 219 (219) · **Base HP:** 438 (438)

**Roles (wiki labels):** Nuker, Splash Damage

**Ability: Thunderclap Flash**

> - Falls asleep for 1 turn.
> - Next attack deals 4x damage, and damage beyond what kills the target hits the next enemy.

---

### Tidal Queen

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 15.1K (15,100) · **Base HP:** 30.2K (30,200)

**Traits:** Hits All

**Roles (wiki labels):** Splash Damage, Self-scaling, Debuffer, Crowd control

**Ability: Relentless Tide**

> - Tidal Queen enters with the flood at level 1 and raises it by 1 every turn (max 4).
> - Each flood level gives her +15% attack and makes enemy cards deal 9% less damage.
> - When the flood is full, she unleashes Tidal Crash instead of attacking: 150% damage to all enemy cards, the active card is silenced for 2 turns, and the flood drops to 2.
> - Tidal Queen deals 30% more damage to Silenced cards.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | +15% | +16.5% | +18% | +19.5% | +21% | +22.5% | …every turn (max 4). · Each flood level gives her +15% attack and makes enemy cards deal 9% less damage.… |
| 2 | 9% | 9.9% | 10.8% | 11.7% | 12.6% | 13.5% | …gives her +15% attack and makes enemy cards deal 9% less damage. · When the flood is full, she unleashes… |
| 3 | 150% | 165% | 180% | 195% | 210% | 225% | …unleashes Tidal Crash instead of attacking: 150% damage to all enemy cards, the active card is… |
| 4 | 30% | 33% | 36% | 39% | 42% | 45% | …and the flood drops to 2. · Tidal Queen deals 30% more damage to Silenced cards. |

**Hits written as "X% damage" (probably of a normal attack):** Tidal Crash 150%

---

### Time Master

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 3.56K (3,560) · **Base HP:** 7.12K (7,120)

**Roles (wiki labels):** Crowd control, Cheat death

**Ability: Gold Experience Requiem**

> - On enemy entry, permanently disables enemy ability.
> - The first lethal hit is reverted, leaving him at 1 HP.

---

### Time Trickster

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 3.61K (3,610) · **Base HP:** 7.23K (7,230)

**Traits:** Once Per Battle, Stun, Revive, Entry Effect, Death Effect

**Roles (wiki labels):** Cheat death, Crowd control, Entry effect, Death effect

**Ability: Z-Drive Resonance**

> - On entry, stuns the enemy in front for 1 turn.
> - Once per battle, when he would die, he revives with full HP, permanently gains +70% attack, deals 100% of his max HP to the enemy in front and stuns it for 1 turn.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | +70% | +77% | +84% | +91% | +98% | +105% | …die, he revives with full HP, permanently gains +70% attack, deals 100% of his max HP to the enemy… |
| 2 | 100% | 110% | 120% | 130% | 140% | 150% | …full HP, permanently gains +70% attack, deals 100% of his max HP to the enemy in front and stuns… |

---

### Titan Hunter

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 362 (362) · **Base HP:** 723 (723)

**Traits:** Dodge

**Roles (wiki labels):** Evasion

**Ability: Ackerman Reflex**

> - 35% chance to dodge any attack.
> - When Titan Hunter dodges, next attack deals 40% more damage.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 35% | 38.5% | 42% | 45.5% | 49% | 52.5% | - 35% chance to dodge any attack. · When Titan Hunter… |
| 2 | 40% | 44% | 48% | 52% | 56% | 60% | …When Titan Hunter dodges, next attack deals 40% more damage. |

---

### Trash Kid

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 247 (247) · **Base HP:** 494 (494)

**Traits:** Pierce

**Roles (wiki labels):** Splash Damage, Tank

**Ability: Trash Armament**

> - On attack, equip a random trash weapon: Blow Dryer (+40% damage this hit), Nail Gun (pierce to next card for 25%), Amulet (deal 50% damage but block the next incoming attack).
> - Different weapon every attack.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | +40% | +44% | +48% | +52% | +56% | +60% | …attack, equip a random trash weapon: Blow Dryer (+40% damage this hit), Nail Gun (pierce to next card… |
| 2 | 25% | 27.5% | 30% | 32.5% | 35% | 37.5% | …this hit), Nail Gun (pierce to next card for 25%), Amulet (deal 50% damage but block the next… |
| 3 | 50% | 55% | 60% | 65% | 70% | 75% | …(pierce to next card for 25%), Amulet (deal 50% damage but block the next incoming attack). ·… |

**Hits written as "X% damage" (probably of a normal attack):** Nail Gun pierce 25%, Amulet hit 50%

---

### Tremor Emperor

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 2.39K (2,390) · **Base HP:** 4.78K (4,780)

**Traits:** Hits All, Entry Effect, Death Effect

**Roles (wiki labels):** Splash Damage, Entry effect, Cheat death

**Ability: Worldshaker**

> - On entry, quake dealing 10% of their max HP to ALL enemy cards.
> - Every attack sends a shockwave hitting all enemies for 15% of Tremor Emperor's attack.
> - On death, Tremor Emperor stays for 1 extra turn before falling.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 10% | 11% | 12% | 13% | 14% | 15% | - On entry, quake dealing 10% of their max HP to ALL enemy cards. · Every attack… |
| 2 | 15% | 16.5% | 18% | 19.5% | 21% | 22.5% | …attack sends a shockwave hitting all enemies for 15% of Tremor Emperor's attack. · On death, Tremor… |

**Hits that scale with this card's ATK:** Shockwave (all) 15%

---

### Trickster Ace

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 1.36K (1,360) · **Base HP:** 2.73K (2,730)

**Roles (wiki labels):** Debuffer

**Ability: Bungee Gum**

> - After being attacked, attach Bungee Gum — for 2 turns, all of Trickster Ace's attacks deal 30% bonus damage to that opponent.
> - If the gummed opponent dies, gum transfers to the next card entering.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 30% | 33% | 36% | 39% | 42% | 45% | …2 turns, all of Trickster Ace's attacks deal 30% bonus damage to that opponent. · If the gummed… |

---

### True Hero

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 7 (7) · **Base HP:** 13 (13)

**Traits:** Death Effect

**Roles (wiki labels):** Team support, Tank, Death effect

**Ability: Justice Crash**

> - All cards in your party take 15% less damage while True Hero is alive.
> - When True Hero dies, the next card to enter deals 10% more damage for 2 turns.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 15% | 16.5% | 18% | 19.5% | 21% | 22.5% | - All cards in your party take 15% less damage while True Hero is alive. · When… |
| 2 | 10% | 11% | 12% | 13% | 14% | 15% | …True Hero dies, the next card to enter deals 10% more damage for 2 turns. |

---

### Turbo Occultist

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 936 (936) · **Base HP:** 1.87K (1,870)

**Roles (wiki labels):** Multi-hit

**Ability: Turbo Granny Acceleration**

> - After surviving 2 turns, gain an extra attack per turn at 25% damage.
> - Stacks up to 3 times maximum.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 25% | 27.5% | 30% | 32.5% | 35% | 37.5% | …surviving 2 turns, gain an extra attack per turn at 25% damage. · Stacks up to 3 times maximum. |

**Hits written as "X% damage" (probably of a normal attack):** Extra attack 25%

---

### Turncoat Netrunner

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 25.3K (25,300) · **Base HP:** 50.7K (50,700)

**Traits:** Stun, Heal

**Roles (wiki labels):** Crowd control, Cheat death, Healer

**Ability: Quickhack**

> **Quickhack**
> - Every attack has a chance to Stun the target for 1 turn, starting at 30%.
> - An attack that doesn't Stun raises the chance by 15%, and a Stun lowers it by 15%.
>
> **Double-Cross**
> - The first time she would die, she survives and heals 30% of her max HP.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 30% | 33% | 36% | 39% | 42% | 45% | …chance to Stun the target for 1 turn, starting at 30%. · An attack that doesn't Stun raises the chance… |
| 2 | 15% | 16.5% | 18% | 19.5% | 21% | 22.5% | …attack that doesn't Stun raises the chance by 15%, and a Stun lowers it by 15%. Double-Cross ·… |
| 3 | 15% | 16.5% | 18% | 19.5% | 21% | 22.5% | …raises the chance by 15%, and a Stun lowers it by 15%. Double-Cross · The first time she would die,… |
| 4 | 30% | 33% | 36% | 39% | 42% | 45% | …first time she would die, she survives and heals 30% of her max HP. |

---

### Twin-Gun Gremlin

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 22.9K (22,900) · **Base HP:** 45.9K (45,900)

**Traits:** Pierce

**Roles (wiki labels):** Multi-hit, Nuker, Splash Damage

**Ability: Trigger Happy**

> **Trigger Happy**
> - Twin-Gun Gremlin's attacks fire 2 shots for 175% damage each.
> - Shots deal 100% more damage to cards below 50% HP.
>
> **Guts**
> - When an ally dies, her next attack is a single blast for 300% damage that also hits the card behind for 150%.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 175% | 192.5% | 210% | 227.5% | 245% | 262.5% | …Twin-Gun Gremlin's attacks fire 2 shots for 175% damage each. · Shots deal 100% more damage to… |
| 2 | 100% | 110% | 120% | 130% | 140% | 150% | …fire 2 shots for 175% damage each. · Shots deal 100% more damage to cards below 50% HP. Guts · When… |
| 3 | 50% | 55% | 60% | 65% | 70% | 75% | …· Shots deal 100% more damage to cards below 50% HP. Guts · When an ally dies, her next attack… |
| 4 | 300% | 330% | 360% | 390% | 420% | 450% | …dies, her next attack is a single blast for 300% damage that also hits the card behind for 150%. |
| 5 | 150% | 165% | 180% | 195% | 210% | 225% | …300% damage that also hits the card behind for 150%. |

**Hits written as "X% damage" (probably of a normal attack):** Shot 175%, Guts blast 300%, Guts pierce 150%

---

### Undead Overlord

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 37.8K (37,800) · **Base HP:** 75.6K (75,600)

**Traits:** Not On Bosses, Stun, Entry Effect

**Roles (wiki labels):** Crowd control, Cheat death, Debuffer, Entry effect

**Ability: Grasp Heart**

> - On entry, Grasp Heart: the enemy in front is stunned for 2 turns (no effect on boss NPCs).
> - The first time he would die, his undead body holds: he stays at 1 HP and every enemy card deals 45% less damage for the rest of the battle.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 45% | 49.5% | 54% | 58.5% | 63% | 67.5% | …he stays at 1 HP and every enemy card deals 45% less damage for the rest of the battle. |

---

### Undying Rogue

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 1.09K (1,090) · **Base HP:** 2.19K (2,190)

**Roles (wiki labels):** Self-scaling

**Ability: Snatch**

> When Undying Rogue defeats a card, permanently steal 15% of its stats added to his own.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 15% | 16.5% | 18% | 19.5% | 21% | 22.5% | …Undying Rogue defeats a card, permanently steal 15% of its stats added to his own. |

---

### Volcano Head

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 8.31K (8,310) · **Base HP:** 16.6K (16,600)

**Traits:** Burn, Heal

**Roles (wiki labels):** Damage over time, Healer

**Ability: Disaster Flames / Coffin of the Iron Mountain**

> - Attacks apply burn for 16% of this card's ATK per turn for 2 turns.
> - Every 3 turns, Volcano Head creates a Domain for 2 turns where all attacks from both sides deal 50% more damage.
> - The winner is healed for all damage taken inside the Domain.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 16% | 17.6% | 19.2% | 20.8% | 22.4% | 24% | - Attacks apply burn for 16% of this card's ATK per turn for 2 turns. · Every… |
| 2 | 50% | 55% | 60% | 65% | 70% | 75% | …turns where all attacks from both sides deal 50% more damage. · The winner is healed for all damage… |

**Hits that scale with this card's ATK:** Burn per turn 16%

---

### Warhammer Titan

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 542 (542) · **Base HP:** 1.08K (1,080)

**Traits:** Stun, Pierce

**Roles (wiki labels):** Crowd control, Splash Damage

**Ability: War Hammer Arsenal**

> - Every 3 rounds swap to a new weapon.
>
> **Spear**
> - Pierces the next enemy for 30% damage.
>
> **Axe**
> - 40% more damage against enemies missing HP.
>
> **Hammer**
> - Stuns the enemy for 1 turn (2 turn cooldown).

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 30% | 33% | 36% | 39% | 42% | 45% | …new weapon. Spear · Pierces the next enemy for 30% damage. Axe · 40% more damage against enemies… |
| 2 | 40% | 44% | 48% | 52% | 56% | 60% | …Pierces the next enemy for 30% damage. Axe · 40% more damage against enemies missing HP. Hammer… |

---

### Weather Report

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 151K (151,000) · **Base HP:** 302K (302,000)

**Traits:** One Per Party, Once Per Battle, Freeze, Burn, Hits All

**Roles (wiki labels):** Splash Damage, Crowd control, Tank, Damage over time

**Ability: Heavy Weather**

> **Cloud Suit**
> - Attacks deal 60% less damage to him.
> - At the start of each of his turns the weather turns, in order: Storm (200% of his ATK to the enemy in front, 100% to every other enemy), Blizzard (Freeze for 1 turn), Scorching Sun (Burn for 3 turns).
>
> **Heavy Weather**
> - Once per battle, at or under 40% HP, every enemy is silenced for 2 turns and all three weathers strike at once.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 60% | 66% | 72% | 78% | 84% | 90% | Cloud Suit · Attacks deal 60% less damage to him. · At the start of each of… |
| 2 | 200% | 220% | 240% | 260% | 280% | 300% | …his turns the weather turns, in order: Storm (200% of his ATK to the enemy in front, 100% to every… |
| 3 | 100% | 110% | 120% | 130% | 140% | 150% | …Storm (200% of his ATK to the enemy in front, 100% to every other enemy), Blizzard (Freeze for 1… |
| 4 | 40% | 44% | 48% | 52% | 56% | 60% | …Heavy Weather · Once per battle, at or under 40% HP, every enemy is silenced for 2 turns and all… |

**Hits that scale with this card's ATK:** Storm (front) 200%

**Hits written as "X% damage" (probably of a normal attack):** Storm (others) 100%

---

### Weirdo Warrior

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 539 (539) · **Base HP:** 1.07K (1,070)

**Traits:** Stun, Poison

**Roles (wiki labels):** Crowd control, Damage over time, Debuffer

**Ability: Chaotic Arsenal**

> Each attack randomly triggers one of three: apply poison for 20% of this card's ATK per turn for 2 turns, stun for 1 turn, or permanently reduce enemy attack by 15%.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 20% | 22% | 24% | 26% | 28% | 30% | …randomly triggers one of three: apply poison for 20% of this card's ATK per turn for 2 turns, stun… |
| 2 | 15% | 16.5% | 18% | 19.5% | 21% | 22.5% | …turn, or permanently reduce enemy attack by 15%. |

**Hits that scale with this card's ATK:** Poison per turn 20%

---

### White Hawk

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 1.4K (1,400) · **Base HP:** 2.8K (2,800)

**Roles (wiki labels):** Crowd control, Evasion

**Ability: Godhand Causality**

> - When attacked, the enemy's ability is permanently removed.
> - Every 3 turns, the enemy's next attack misses.

---

### White Lotus

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 1K (1,000) · **Base HP:** 2K (2,000)

**Traits:** Dodge, Freeze, Entry Effect

**Roles (wiki labels):** Evasion, Crowd control, Nuker, Entry effect

**Ability: Crystal Ice Mirrors**

> - On entry, create ice mirrors: 35% chance every turn to dodge the attack.
> - Attacks deal 1.5x damage to frozen targets.
> - Every 3 turns, trap enemy in ice mirrors: freeze for 1 turn and deal 2x damage.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 35% | 38.5% | 42% | 45.5% | 49% | 52.5% | - On entry, create ice mirrors: 35% chance every turn to dodge the attack. · Attacks… |

---

### Wildheart Hunter

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 130 (130) · **Base HP:** 259 (259)

**Roles (wiki labels):** Nuker

**Ability: Jajanken – Rock**

> - Below 30% HP, next attack deals 2.2x damage.
> - Wildheart Hunter dies at end of turn.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 30% | 33% | 36% | 39% | 42% | 45% | - Below 30% HP, next attack deals 2.2x damage. · Wildheart… |

**Hits written as "X% damage" (probably of a normal attack):** Low-HP hit 220%

---

### Wind Shinobi

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 154 (154) · **Base HP:** 308 (308)

**Roles (wiki labels):** Splash Damage

**Ability: Wind Scythe Jutsu**

> Every attack hits the active card AND one card in the enemy lineup for 20% damage.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 20% | 22% | 24% | 26% | 28% | 30% | …active card AND one card in the enemy lineup for 20% damage. |

**Hits written as "X% damage" (probably of a normal attack):** Lineup splash hit 20%

---

### Wonder of U

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 1.96M (1,960,000) · **Base HP:** 3.93M (3,930,000)

**Traits:** One Per Party

**Roles (wiki labels):** Counter, Debuffer, Death effect

**Ability: Calamity**

> **Calamity**
> - Whoever pursues him is struck.
> - A card that damages him takes 150% of that damage back, even if the hit kills him, and every 2nd attack aimed at him is struck down before it lands: the attacker takes 300% of his ATK instead.
>
> **Pursuit**
> - Every attack a card aims at him counts against it.
> - At the start of each enemy turn the active enemy takes 75% of his ATK for every pursuit it has made.
> - When he dies, calamity lands one last time on every enemy, and every enemy permanently loses 70% of its ATK (not a boss's).

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 150% | 165% | 180% | 195% | 210% | 225% | …him is struck. · A card that damages him takes 150% of that damage back, even if the hit kills him,… |
| 2 | 300% | 330% | 360% | 390% | 420% | 450% | …struck down before it lands: the attacker takes 300% of his ATK instead. Pursuit · Every attack a… |
| 3 | 75% | 82.5% | 90% | 97.5% | 105% | 112.5% | …start of each enemy turn the active enemy takes 75% of his ATK for every pursuit it has made. · When… |
| 4 | 70% | 77% | 84% | 91% | 98% | 105% | …every enemy, and every enemy permanently loses 70% of its ATK (not a boss's). |

**Hits that scale with this card's ATK:** Struck-down attacker 300%, Pursuit per stack 75%

---

### Worthy Fighter

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 1.33K (1,330) · **Base HP:** 2.67K (2,670)

**Traits:** Heal

**Roles (wiki labels):** Self-scaling, Healer

**Ability: Compass Needle / Annihilation Type**

> - Worthy Fighter gains 8% stats every time he takes a hit.
> - Below 30% HP, he regenerates 5% HP per turn.
> - His attacks have a 20% chance to become a Disorder attack that deals 1.5x damage.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 8% | 8.8% | 9.6% | 10.4% | 11.2% | 12% | - Worthy Fighter gains 8% stats every time he takes a hit. · Below 30%… |
| 2 | 30% | 33% | 36% | 39% | 42% | 45% | …8% stats every time he takes a hit. · Below 30% HP, he regenerates 5% HP per turn. · His attacks… |
| 3 | 5% | 5.5% | 6% | 6.5% | 7% | 7.5% | …takes a hit. · Below 30% HP, he regenerates 5% HP per turn. · His attacks have a 20% chance… |
| 4 | 20% | 22% | 24% | 26% | 28% | 30% | …regenerates 5% HP per turn. · His attacks have a 20% chance to become a Disorder attack that deals… |

---

### Yellow Flash

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 250 (250) · **Base HP:** 499 (499)

**Traits:** Dodge, Entry Effect

**Roles (wiki labels):** Evasion, Counter, Nuker, Entry effect

**Ability: Flying Raijin: Yellow Flash**

> - On entry, mark the enemy with a Flying Raijin seal.
> - Yellow Flash dodges an attack from a marked enemy every 3 turns and counters for 60% damage.
> - Every 3rd attack becomes a Flying Raijin Rasengan dealing 2x damage which marks the enemy with a seal.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 60% | 66% | 72% | 78% | 84% | 90% | …marked enemy every 3 turns and counters for 60% damage. · Every 3rd attack becomes a Flying Raijin… |

---

### Yo-Yo Kid

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 235 (235) · **Base HP:** 469 (469)

**Traits:** Stun, Entry Effect

**Roles (wiki labels):** Crowd control, Entry effect

**Ability: Godspeed**

> - On entry, attack once immediately.
> - Attacks have a 30% chance to stun for 1 turn.
> - Every 3 turns, Lightning Palm: 1.5x damage with guaranteed stun.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 30% | 33% | 36% | 39% | 42% | 45% | …entry, attack once immediately. · Attacks have a 30% chance to stun for 1 turn. · Every 3 turns, Lightning… |

---

### Yordle Inventor

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 3.81K (3,810) · **Base HP:** 7.63K (7,630)

**Traits:** Entry Effect

**Roles (wiki labels):** Summoner, Multi-hit, Tank, Entry effect

**Ability: H-28G Evolution Turret**

> - On entry, deploys 2 turrets, then 1 more every 2 turns.
> - Each turret gives him +25% attack.
> - After each of his attacks, every turret shoots the enemy in front for 25% of his attack.
> - When he's hit, there's a 40% chance a turret takes the hit instead and is destroyed.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | +25% | +27.5% | +30% | +32.5% | +35% | +37.5% | …more every 2 turns. · Each turret gives him +25% attack. · After each of his attacks, every turret… |
| 2 | 25% | 27.5% | 30% | 32.5% | 35% | 37.5% | …attacks, every turret shoots the enemy in front for 25% of his attack. · When he's hit, there's a 40%… |
| 3 | 40% | 44% | 48% | 52% | 56% | 60% | …25% of his attack. · When he's hit, there's a 40% chance a turret takes the hit instead and is… |

**Hits that scale with this card's ATK:** Turret shot (each) 25%

---

### Young Shadow Heir

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 56 (56) · **Base HP:** 111 (111)

**Traits:** Burn

**Roles (wiki labels):** Damage over time

**Ability: Fireball Jutsu**

> 50% chance on attack to burn the enemy for 16% of this card's ATK per turn for 2 turns.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 50% | 55% | 60% | 65% | 70% | 75% | 50% chance on attack to burn the enemy for 16% of… |
| 2 | 16% | 17.6% | 19.2% | 20.8% | 22.4% | 24% | 50% chance on attack to burn the enemy for 16% of this card's ATK per turn for 2 turns. |

**Hits that scale with this card's ATK:** Burn per turn 16%

---

### Young Spirit Vessel

Battle card · Rarity: unknown · Origin: unknown

**Base DMG:** 44 (44) · **Base HP:** 88 (88)

**Traits:** Dodge

**Roles (wiki labels):** Evasion

**Ability: Shadow Clone Dodge**

> Young Spirit Vessel dodges the first hit aimed at it.

---

## Support cards

### Ascension Catalyst

Support card · Rarity: unknown · Origin: unknown

**Traits:** Support, Heal

**Roles (wiki labels):** Healer, Self-scaling

**Ability: Ascension Catalyst**

> The first time below 40% HP, heal to 60% and permanently gain +40% attack.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 40% | 44% | 48% | 52% | 56% | 60% | The first time below 40% HP, heal to 60% and permanently gain +40% attack. |
| 2 | 60% | 66% | 72% | 78% | 84% | 90% | The first time below 40% HP, heal to 60% and permanently gain +40% attack. |
| 3 | +40% | +44% | +48% | +52% | +56% | +60% | …below 40% HP, heal to 60% and permanently gain +40% attack. |

---

### Blight Veil

Support card · Rarity: unknown · Origin: unknown

**Traits:** Support, Not On Bosses

**Roles (wiki labels):** Counter, Debuffer

**Ability: Blight Veil**

> - When hit, 40% of the damage hits the enemy back.
> - An enemy with 2x your attack isn't hit, but deals 20% less damage for its next 2 attacks.
> - No effect on boss NPCs.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 40% | 44% | 48% | 52% | 56% | 60% | - When hit, 40% of the damage hits the enemy back. · An enemy… |
| 2 | 20% | 22% | 24% | 26% | 28% | 30% | …enemy with 2x your attack isn't hit, but deals 20% less damage for its next 2 attacks. · No effect… |

---

### Celestial Circlet

Support card · Rarity: unknown · Origin: unknown

**Traits:** Support

**Roles (wiki labels):** Tank

**Ability: Celestial Circlet**

> Takes 30% less damage from attacks.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 30% | 33% | 36% | 39% | 42% | 45% | Takes 30% less damage from attacks. |

---

### Chainsaw Revving

Support card · Rarity: unknown · Origin: unknown

**Traits:** Support, Heal

**Roles (wiki labels):** Healer, Multi-hit

**Ability: Chainsaw Revving**

> - Heal 30% of damage dealt.
> - On kill, heal 25% max HP and the next attack hits twice.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 30% | 33% | 36% | 39% | 42% | 45% | - Heal 30% of damage dealt. · On kill, heal 25% max HP and… |
| 2 | 25% | 27.5% | 30% | 32.5% | 35% | 37.5% | - Heal 30% of damage dealt. · On kill, heal 25% max HP and the next attack hits twice. |

---

### Combat Instinct

Support card · Rarity: unknown · Origin: unknown

**Traits:** Support, Pierce

**Roles (wiki labels):** Splash Damage

**Ability: Combat Instinct**

> Attacks pierce the next enemy card for 60% of the damage dealt.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 60% | 66% | 72% | 78% | 84% | 90% | Attacks pierce the next enemy card for 60% of the damage dealt. |

---

### Command Sigil

Support card · Rarity: unknown · Origin: unknown

**Traits:** Support, Can't Miss, Heal

**Roles (wiki labels):** Nuker, Healer

**Ability: Command Sigil**

> - 3 orders, once each.
> - Its first attack can't be dodged.
> - The first time below 50% HP, it moves to the back of the team and heals 50%.
> - After the first ally death, its next attack deals 4x damage.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 50% | 55% | 60% | 65% | 70% | 75% | …attack can't be dodged. · The first time below 50% HP, it moves to the back of the team and heals… |
| 2 | 50% | 55% | 60% | 65% | 70% | 75% | …HP, it moves to the back of the team and heals 50%. · After the first ally death, its next attack… |

---

### Corroded Chain

Support card · Rarity: unknown · Origin: unknown

**Traits:** Support, Death Effect

**Roles (wiki labels):** Debuffer, Death effect

**Ability: Corroded Chain**

> - +20% max HP.
> - On death, the killer permanently loses 35% of its attack.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | +20% | +22% | +24% | +26% | +28% | +30% | - +20% max HP. · On death, the killer permanently loses… |
| 2 | 35% | 38.5% | 42% | 45.5% | 49% | 52.5% | …HP. · On death, the killer permanently loses 35% of its attack. |

---

### Counter Trigger

Support card · Rarity: unknown · Origin: unknown

**Traits:** Support

**Roles (wiki labels):** Counter, Nuker

**Ability: Counter Trigger**

> Whenever it takes lethal damage, even if it survives, it deals 250% of its max HP to the enemy in front.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 250% | 275% | 300% | 325% | 350% | 375% | …lethal damage, even if it survives, it deals 250% of its max HP to the enemy in front. |

---

### Crimson Egg

Support card · Rarity: unknown · Origin: unknown

**Traits:** Support, Heal

**Roles (wiki labels):** Cheat death, Healer

**Ability: Crimson Egg**

> - The first time it would die, the next ally in line falls instead.
> - It lives on with 30% of its max HP and heals 30%.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 30% | 33% | 36% | 39% | 42% | 45% | …ally in line falls instead. · It lives on with 30% of its max HP and heals 30%. |
| 2 | 30% | 33% | 36% | 39% | 42% | 45% | …It lives on with 30% of its max HP and heals 30%. |

---

### Crimson Thorn

Support card · Rarity: unknown · Origin: unknown

**Traits:** Support, Stun, Entry Effect

**Roles (wiki labels):** Crowd control, Entry effect

**Ability: Crimson Thorn**

> On entry, bind the active enemy: stun it for 1 turn and deal 20% of its max HP.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 20% | 22% | 24% | 26% | 28% | 30% | …the active enemy: stun it for 1 turn and deal 20% of its max HP. |

---

### Defense Force Suit

Support card · Rarity: unknown · Origin: unknown

**Traits:** Support, Once Per Battle, Shield

**Roles (wiki labels):** Tank

**Ability: Combat Suit**

> - +20% max HP.
> - Once per battle, below 50% HP, gain a 1-hit shield and 20% more attack.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | +20% | +22% | +24% | +26% | +28% | +30% | - +20% max HP. · Once per battle, below 50% HP, gain… |
| 2 | 50% | 55% | 60% | 65% | 70% | 75% | - +20% max HP. · Once per battle, below 50% HP, gain a 1-hit shield and 20% more attack. |
| 3 | 20% | 22% | 24% | 26% | 28% | 30% | …battle, below 50% HP, gain a 1-hit shield and 20% more attack. |

---

### Destiny Thread

Support card · Rarity: unknown · Origin: unknown

**Traits:** Support, Death Effect

**Roles (wiki labels):** Team support, Death effect

**Ability: Destiny Thread**

> - On death, the next card in your party borrows its ability for 2 turns, without its entry effects.
> - While it holds the borrowed ability, its own support does nothing.
> - One borrowed ability at a time.
> - Boss cards' abilities can't be borrowed.

---

### Devil's Contract

Support card · Rarity: unknown · Origin: unknown

**Traits:** Support, Lifesteal

**Roles (wiki labels):** Healer

**Ability: Devil's Contract**

> - +40% attack.
> - 25% lifesteal.
> - Can't heal from anything except lifesteal.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | +40% | +44% | +48% | +52% | +56% | +60% | - +40% attack. · 25% lifesteal. · Can't heal from anything… |
| 2 | 25% | 27.5% | 30% | 32.5% | 35% | 37.5% | - +40% attack. · 25% lifesteal. · Can't heal from anything except… |

---

### Fiend Heart

Support card · Rarity: unknown · Origin: unknown

**Traits:** Support

**Roles (wiki labels):** Tank

**Ability: Fiend Heart**

> Takes 15% less damage, plus 0.6% less for every 1% HP missing (up to 60%).

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 15% | 16.5% | 18% | 19.5% | 21% | 22.5% | Takes 15% less damage, plus 0.6% less for every 1% HP missing… |
| 2 | 0.6% | 0.66% | 0.72% | 0.78% | 0.84% | 0.9% | Takes 15% less damage, plus 0.6% less for every 1% HP missing (up to 60%). |
| 3 | 1% | 1.1% | 1.2% | 1.3% | 1.4% | 1.5% | Takes 15% less damage, plus 0.6% less for every 1% HP missing (up to 60%). |
| 4 | 60% | 66% | 72% | 78% | 84% | 90% | …plus 0.6% less for every 1% HP missing (up to 60%). |

---

### Flame Core

Support card · Rarity: unknown · Origin: unknown

**Traits:** Support, Burn

**Roles (wiki labels):** Damage over time

**Ability: Flame Core**

> - Every attack applies a burn for 16% of the attacker's ATK per turn, lasting 1 turn.
> - Every hit adds a stack.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 16% | 17.6% | 19.2% | 20.8% | 22.4% | 24% | - Every attack applies a burn for 16% of the attacker's ATK per turn, lasting 1 turn.… |

---

### Force Breaker

Support card · Rarity: unknown · Origin: unknown

**Traits:** Support, Stun

**Roles (wiki labels):** Self-scaling

**Ability: Force Breaker**

> - Consecutive attacks escalate: 1st hit = 1x, 2nd = 1.5x, 3rd = 2x, 4th = 3x damage.
> - Resets when stunned, frozen or hit by a status effect.

---

### Fortune Clover

Support card · Rarity: unknown · Origin: unknown

**Traits:** Support

**Roles (wiki labels):** Cheat death

**Ability: Fortune Clover**

> - Survive a lethal attack at 1 HP.
> - Refreshes every 5 turns.

---

### Fractured Lens

Support card · Rarity: unknown · Origin: unknown

**Traits:** Support

**Roles (wiki labels):** Evasion

**Ability: Ambush**

> The first attack from each enemy has a 50% chance to miss.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 50% | 55% | 60% | 65% | 70% | 75% | The first attack from each enemy has a 50% chance to miss. |

---

### Grapple Harness

Support card · Rarity: unknown · Origin: unknown

**Traits:** Support, Dodge, Pierce

**Roles (wiki labels):** Evasion, Multi-hit, Splash Damage

**Ability: Grapple Harness**

> - The first attack aimed at it each battle misses.
> - Whenever it dodges, its next attack hits twice and pierces the enemy behind for 50% of the first hit (at most 2x its ATK).

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 50% | 55% | 60% | 65% | 70% | 75% | …hits twice and pierces the enemy behind for 50% of the first hit (at most 2x its ATK). |

---

### Hero's Journey

Support card · Rarity: unknown · Origin: unknown

**Traits:** Support

**Roles (wiki labels):** Self-scaling

**Ability: Hero's Journey**

> +20% all stats for each ally that died before it in the fight.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | +20% | +22% | +24% | +26% | +28% | +30% | +20% all stats for each ally that died before it in… |

---

### Hex Mark

Support card · Rarity: unknown · Origin: unknown

**Traits:** Support

**Roles (wiki labels):** Nuker

**Ability: Hex Mark**

> - +25% attack.
> - Every 3rd attack deals 3x damage.
> - Loses 8% max HP every turn.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | +25% | +27.5% | +30% | +32.5% | +35% | +37.5% | - +25% attack. · Every 3rd attack deals 3x damage. ·… |
| 2 | 8% | 8.8% | 9.6% | 10.4% | 11.2% | 12% | …· Every 3rd attack deals 3x damage. · Loses 8% max HP every turn. |

---

### Hush Talisman

Support card · Rarity: 1 in 150M · Origin: Card pack (Forged Pack)

**Traits:** One Per Party, Support, Death Effect

**Roles (wiki labels):** Crowd control, Death effect

**Ability: Hush Talisman**

> - On death, its killer loses its ability for 2 turns.
> - If a burn, poison or bleed kills it, the card that applied it counts as the killer.

---

### Impact Core

Support card · Rarity: unknown · Origin: unknown

**Traits:** Support, Shield

**Roles (wiki labels):** Counter, Tank

**Ability: Impact Core**

> - Stores all damage taken.
> - Every 3rd turn, the next attack adds all of it.
> - Against enemies with 2x your attack, that damage becomes a shield instead (up to 30% max HP).

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 30% | 33% | 36% | 39% | 42% | 45% | …that damage becomes a shield instead (up to 30% max HP). |

---

### Junk Recycler

Support card · Rarity: unknown · Origin: unknown

**Traits:** Support, Heal

**Roles (wiki labels):** Self-scaling, Healer

**Ability: Junk Recycler**

> On kill, heal 35% max HP and gain +40% of its starting attack (up to 3 kills).

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 35% | 38.5% | 42% | 45.5% | 49% | 52.5% | On kill, heal 35% max HP and gain +40% of its starting attack (up… |
| 2 | +40% | +44% | +48% | +52% | +56% | +60% | On kill, heal 35% max HP and gain +40% of its starting attack (up to 3 kills). |

---

### Last Legacy

Support card · Rarity: unknown · Origin: unknown

**Traits:** Support, Death Effect

**Roles (wiki labels):** Team support, Death effect

**Ability: Last Legacy**

> - On death, pass 40% of all stats to the next card in your lineup.
> - If no cards remain, deal 100% of those total stats as damage to the enemy instead.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 40% | 44% | 48% | 52% | 56% | 60% | - On death, pass 40% of all stats to the next card in your lineup.… |
| 2 | 100% | 110% | 120% | 130% | 140% | 150% | …card in your lineup. · If no cards remain, deal 100% of those total stats as damage to the enemy instead. |

---

### Limit Breaker

Support card · Rarity: unknown · Origin: unknown

**Traits:** Support

**Roles (wiki labels):** Self-scaling

**Ability: Limit Breaker**

> - -30% damage for the first 2 turns.
> - On turn 3, permanently gain +350% of its base attack.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | -30% | -33% | -36% | -39% | -42% | -45% | - -30% damage for the first 2 turns. · On turn 3, permanently… |
| 2 | +350% | +385% | +420% | +455% | +490% | +525% | …first 2 turns. · On turn 3, permanently gain +350% of its base attack. |

---

### Neural Overclock

Support card · Rarity: unknown · Origin: unknown

**Traits:** Support

**Roles (wiki labels):** Multi-hit

**Ability: Neural Overclock**

> - Every attack that lands also strikes the same enemy again for 100% of its ATK.
> - Once every 2 turns, an attack that hits 2 or more times is followed by 1 more attack.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 100% | 110% | 120% | 130% | 140% | 150% | …lands also strikes the same enemy again for 100% of its ATK. · Once every 2 turns, an attack that… |

---

### Numbers Weapon

Support card · Rarity: unknown · Origin: unknown

**Traits:** Support

**Roles (wiki labels):** Nuker

**Ability: Numbers Arsenal**

> - +50% attack.
> - The first attack on each enemy deals 3x damage.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | +50% | +55% | +60% | +65% | +70% | +75% | - +50% attack. · The first attack on each enemy deals… |

---

### Oblivion Eraser

Support card · Rarity: unknown · Origin: unknown

**Traits:** Support, Entry Effect, Death Effect

**Roles (wiki labels):** Counter, Debuffer, Entry effect, Death effect

**Ability: Oblivion Eraser**

> - On entry, bind a random enemy card: it also takes 50% of every hit you take.
> - While it has 2x your attack, it takes 25% more damage from your team instead.
> - On death, the bound enemy loses 30% of its ATK.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 50% | 55% | 60% | 65% | 70% | 75% | …entry, bind a random enemy card: it also takes 50% of every hit you take. · While it has 2x your… |
| 2 | 25% | 27.5% | 30% | 32.5% | 35% | 37.5% | …take. · While it has 2x your attack, it takes 25% more damage from your team instead. · On death,… |
| 3 | 30% | 33% | 36% | 39% | 42% | 45% | …team instead. · On death, the bound enemy loses 30% of its ATK. |

---

### Portal Blade

Support card · Rarity: unknown · Origin: unknown

**Traits:** Support, Pierce

**Roles (wiki labels):** Splash Damage, Nuker

**Ability: Portal Blade**

> Every 2nd attack also warps behind the enemy lineup, hitting their last card for 3x its attack.

---

### Realm Cleaver

Support card · Rarity: unknown · Origin: unknown

**Traits:** Support, Pierce

**Roles (wiki labels):** Splash Damage

**Ability: Realm Cleaver**

> - Every attack pierces the next enemy card for 60% of the damage, with the same on-hit effects.
> - With no next card, 50% is added to the main hit instead.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 60% | 66% | 72% | 78% | 84% | 90% | …Every attack pierces the next enemy card for 60% of the damage, with the same on-hit effects.… |
| 2 | 50% | 55% | 60% | 65% | 70% | 75% | …the same on-hit effects. · With no next card, 50% is added to the main hit instead. |

---

### Reaper's Lantern

Support card · Rarity: unknown · Origin: unknown

**Traits:** Support, Stun, Burn, Poison, Bleed

**Roles (wiki labels):** Self-scaling

**Ability: Soul Harvest**

> - Each Burn, Poison, Bleed or Stun your team puts on an enemy adds a soul.
> - At 4 souls the lantern empties: +50% ATK and HP for the rest of the battle (max 3).

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | +50% | +55% | +60% | +65% | +70% | +75% | …adds a soul. · At 4 souls the lantern empties: +50% ATK and HP for the rest of the battle (max 3). |

---

### Restless Coffin

Support card · Rarity: unknown · Origin: unknown

**Traits:** Support

**Roles (wiki labels):** Debuffer, Crowd control

**Ability: Restless Coffin**

> When it comes back to life through its own ability, the enemy that killed it loses its ability for 2 turns and takes double damage from your team for 4 turns.

---

### Revival Seed

Support card · Rarity: unknown · Origin: unknown

**Traits:** Support, Heal

**Roles (wiki labels):** Healer

**Ability: Revival Seed**

> - Heal 20% max HP every turn.
> - The first time below 25% HP, heal 50% at once.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 20% | 22% | 24% | 26% | 28% | 30% | - Heal 20% max HP every turn. · The first time below 25%… |
| 2 | 25% | 27.5% | 30% | 32.5% | 35% | 37.5% | …20% max HP every turn. · The first time below 25% HP, heal 50% at once. |
| 3 | 50% | 55% | 60% | 65% | 70% | 75% | …every turn. · The first time below 25% HP, heal 50% at once. |

---

### Rift Anchor

Support card · Rarity: unknown · Origin: unknown

**Traits:** Support, Once Per Battle

**Roles (wiki labels):** Cheat death

**Ability: Rift Anchor**

> Once per battle, on taking lethal damage, HP goes back to what it was 3 turns ago.

---

### Shadow Armor

Support card · Rarity: unknown · Origin: unknown

**Traits:** Support

**Roles (wiki labels):** Tank

**Ability: Shadow Armor**

> +100% max HP.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | +100% | +110% | +120% | +130% | +140% | +150% | +100% max HP. |

---

### Shadow Fragment

Support card · Rarity: unknown · Origin: unknown

**Traits:** Support

**Roles (wiki labels):** Self-scaling

**Ability: Shadow Fragment**

> On kill, gain +60% attack.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | +60% | +66% | +72% | +78% | +84% | +90% | On kill, gain +60% attack. |

---

### Sorceress's Sorrow

Support card · Rarity: unknown · Origin: unknown

**Traits:** Support, Poison, Death Effect

**Roles (wiki labels):** Debuffer, Damage over time, Death effect

**Ability: Sorceress's Sorrow**

> On death, curse the enemy's active card: -25% stats and a poison for 30% of the fallen card's ATK per turn for 2 turns.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | -25% | -27.5% | -30% | -32.5% | -35% | -37.5% | On death, curse the enemy's active card: -25% stats and a poison for 30% of the fallen card's… |
| 2 | 30% | 33% | 36% | 39% | 42% | 45% | …enemy's active card: -25% stats and a poison for 30% of the fallen card's ATK per turn for 2 turns. |

---

### Soul Siphon

Support card · Rarity: unknown · Origin: unknown

**Traits:** Support

**Roles (wiki labels):** Self-scaling

**Ability: Soul Siphon**

> Boost attack by 25% of max HP.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 25% | 27.5% | 30% | 32.5% | 35% | 37.5% | Boost attack by 25% of max HP. |

---

### Sovereign Will

Support card · Rarity: unknown · Origin: unknown

**Traits:** Support, Entry Effect

**Roles (wiki labels):** Self-scaling, Team support, Entry effect

**Ability: Sovereign Will**

> - +35% attack on entry.
> - If it kills an enemy, the next card in your party enters with +60% attack per enemy killed.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | +35% | +38.5% | +42% | +45.5% | +49% | +52.5% | - +35% attack on entry. · If it kills an enemy, the… |
| 2 | +60% | +66% | +72% | +78% | +84% | +90% | …enemy, the next card in your party enters with +60% attack per enemy killed. |

---

### Spider Tattoo

Support card · Rarity: unknown · Origin: unknown

**Traits:** Support, Burn, Poison, Bleed, Pierce

**Roles (wiki labels):** Damage over time, Splash Damage

**Ability: Spider Tattoo**

> Its Burn, Poison and Bleed also land on the enemy behind the target.

---

### Spirit Thread

Support card · Rarity: unknown · Origin: unknown

**Traits:** Support, Heal

**Roles (wiki labels):** Evasion, Healer

**Ability: Spirit Thread**

> - 20% chance any incoming hit fails.
> - Every hit that misses heals 10% max HP.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 20% | 22% | 24% | 26% | 28% | 30% | - 20% chance any incoming hit fails. · Every hit that… |
| 2 | 10% | 11% | 12% | 13% | 14% | 15% | …incoming hit fails. · Every hit that misses heals 10% max HP. |

---

### Spirit Undertaker

Support card · Rarity: unknown · Origin: unknown

**Traits:** Support, Lifesteal

**Roles (wiki labels):** Nuker, Healer, Tank

**Ability: Paramita Papilio**

> - Below 50% HP, it deals 100% more damage and heals for 15% of the damage it deals.
>
> **Farewell Ghost**
> - The first time it drops below 50% HP, a ghost blocks the next hit.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 50% | 55% | 60% | 65% | 70% | 75% | - Below 50% HP, it deals 100% more damage and heals for 15%… |
| 2 | 100% | 110% | 120% | 130% | 140% | 150% | - Below 50% HP, it deals 100% more damage and heals for 15% of the damage it… |
| 3 | 15% | 16.5% | 18% | 19.5% | 21% | 22.5% | …HP, it deals 100% more damage and heals for 15% of the damage it deals. Farewell Ghost · The… |
| 4 | 50% | 55% | 60% | 65% | 70% | 75% | …Farewell Ghost · The first time it drops below 50% HP, a ghost blocks the next hit. |

---

### Stitched Professor

Support card · Rarity: unknown · Origin: unknown

**Traits:** Support, Stun

**Roles (wiki labels):** Debuffer, Crowd control

**Ability: Soul Surgery**

> **Dissection**
> - Hits make the enemy take 40% more damage from everything for 2 turns.
>
> **Soul Force**
> - Every 3rd attack has a 50% chance to stun the enemy for 1 turn.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 40% | 44% | 48% | 52% | 56% | 60% | Dissection · Hits make the enemy take 40% more damage from everything for 2 turns. Soul… |
| 2 | 50% | 55% | 60% | 65% | 70% | 75% | …2 turns. Soul Force · Every 3rd attack has a 50% chance to stun the enemy for 1 turn. |

---

### Territory Surge

Support card · Rarity: unknown · Origin: unknown

**Traits:** Support, Hits All

**Roles (wiki labels):** Splash Damage

**Ability: Territory Surge**

> Every 3rd attack also hits every other enemy for 100% of its attack.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 100% | 110% | 120% | 130% | 140% | 150% | Every 3rd attack also hits every other enemy for 100% of its attack. |

---

### Thorn Fragment

Support card · Rarity: unknown · Origin: unknown

**Traits:** Support, Lifesteal, Dodge, Entry Effect

**Roles (wiki labels):** Self-scaling, Healer, Tank, Evasion

**Ability: Thorn Fragment**

> On entry, gain 10% attack, 10% lifesteal, 10% damage reduction, 10% max HP and a 10% chance to dodge attacks.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 10% | 11% | 12% | 13% | 14% | 15% | On entry, gain 10% attack, 10% lifesteal, 10% damage reduction,… |
| 2 | 10% | 11% | 12% | 13% | 14% | 15% | On entry, gain 10% attack, 10% lifesteal, 10% damage reduction, 10% max HP and… |
| 3 | 10% | 11% | 12% | 13% | 14% | 15% | On entry, gain 10% attack, 10% lifesteal, 10% damage reduction, 10% max HP and a 10% chance… |
| 4 | 10% | 11% | 12% | 13% | 14% | 15% | …attack, 10% lifesteal, 10% damage reduction, 10% max HP and a 10% chance to dodge attacks. |
| 5 | 10% | 11% | 12% | 13% | 14% | 15% | …lifesteal, 10% damage reduction, 10% max HP and a 10% chance to dodge attacks. |

---

### Transmutation Circle

Support card · Rarity: 1 in 500M · Origin: Card pack (Forged Pack)

**Traits:** Support, Shield

**Roles (wiki labels):** Summoner, Tank

**Ability: Transmutation Circle**

> Its summons get +50% ATK and max HP and enter with a shield that blocks 1 hit.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | +50% | +55% | +60% | +65% | +70% | +75% | Its summons get +50% ATK and max HP and enter with a shield that blocks… |

---

### Voodoo Doll

Support card · Rarity: unknown · Origin: PvP shop

**Traits:** Support

**Roles (wiki labels):** Debuffer

**Ability: Cursed Pins**

> - Each attack sticks a pin in the target (max 3).
> - Each pin takes away 10% of its ATK and makes it take 10% more damage from your team.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 10% | 11% | 12% | 13% | 14% | 15% | …in the target (max 3). · Each pin takes away 10% of its ATK and makes it take 10% more damage… |
| 2 | 10% | 11% | 12% | 13% | 14% | 15% | …takes away 10% of its ATK and makes it take 10% more damage from your team. |

*Note: Sold in the PvP shop (paid in Trophies) for 2K Trophies. Buying it unlocks it in your rolls.*

---

### Wraith Mask Fragment

Support card · Rarity: unknown · Origin: unknown

**Traits:** Support

**Roles (wiki labels):** Self-scaling

**Ability: Wraith Mask Fragment**

> Below 50% HP, gain +75% attack.

**Ability numbers** (base, then Awakening Lv 1–5)

| # | Base | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 | Where in the text |
|---|---|---|---|---|---|---|---|
| 1 | 50% | 55% | 60% | 65% | 70% | 75% | Below 50% HP, gain +75% attack. |
| 2 | +75% | +82.5% | +90% | +97.5% | +105% | +112.5% | Below 50% HP, gain +75% attack. |

---

## Part 8 — Results app (team viewer with a rarity filter)

Build a small **local app** that shows the simulator's results as pictures of each team, and lets the user **limit the search to cards at or below a rarity**, so they can find the best teams they can realistically get.

### Card images
- The user has attached **`card-images.zip`**. Each file is named after the card's `id` (for example `hawkeye-sniper.webp`), and each card in `prestige-sim-cards.json` has an `image` field with that path (`card-images/<id>.webp`).
- A few cards have no image yet (`image` is `null`). Show a plain placeholder tile with the card's name instead. When the user adds an image later, it should only need dropping into the folder.

### How rarity works
- Rarity is **"1 in N"**: a higher N means rarer. Each card in the JSON has three rarity fields:
  - `rarity`: the rarity shown in game, where it is known (only a few cards so far).
  - `rarityFromStats`: worked out from the card's base DMG. **Rarity and stats follow the same rule as variants: every 10x rarer = 2x stats.** So base DMG = K × 2^(log10 of the rarity), and rarity = 10^(log2(DMG ÷ K)). K (about 12.5) is fitted on the cards whose rarity is known, and they agree within 1%. Treat this as an estimate. A card can be off by a few times either way (Golden Requiem, 1/300Qa in game, comes out at about 1/550Qa).
  - `rarityForFilter`: use this one. It is `rarity` when known, otherwise `rarityFromStats`.
- The user types caps in game notation. Parse these suffixes (each is 1,000 times the one before): K (thousand), M (million), B (billion), T (trillion), Qa (quadrillion, 10^15), Qi (quintillion, 10^18), Sx (10^21), Sp (10^24), Oc (10^27), No (10^30), Dc (10^33). So **"30Qi" = 30 × 10^18 = 3 × 10^19**. Accept plain numbers and e-notation too, and show the parsed value next to the box so the user can see what it understood.
- **A variant changes the rarity.** A card's rarity with a variant = base rarity × the variant's rarity multiplier (Part 2). The filter applies to the rarity of the card **as it is used in the team**: a card may pass at Base but fail as Shiny Galactic.
- Because stats and rarity follow the same rule, a cap is the same as a **DMG cap**: a card is allowed as a variant when base DMG × the variant's stat multiplier ≤ the DMG of a card at the cap. For example, 30Qi is about 9.1M DMG: a 1Qa card is allowed up to Cosmic (10Qi), but not as Shiny Gold (100Qi).
- **Supports have no stats**, so their rarity can't be worked out. Allow every support unless its `rarity` is known and above the cap.
- Read rarity from the JSON at run time, never hard-code it, so the user can add or correct rarities later. Show each card's rarity in the app, marked "est." when it comes from stats.

### The filter must change the search, not just hide results
The best team under a cap is often not in the overall top 25, so hiding rows is not enough.
- Let the search take a **card pool**: a max rarity, the unknown-rarity switch, a "never use" list, and a "must include" list. Only cards in the pool can be picked, at every search stage (singles, pairs, full teams, exhaustive check).
- **Precompute** results for a ladder of caps so the app answers instantly: every 10x from 1M up to the rarest card in the data, plus "no cap". Keep the top 100 teams per cap. The app snaps to the nearest precomputed cap at or below the one typed, and says which one it used.
- Add a **"Run a search with exactly this filter"** button that starts a new search in the background for the exact cap and lists. Show its progress, and add its results to the app when it finishes.
- Save every result set with the filter, config and date it was made with, so old runs can still be opened.

### What the app shows
**Results list** (the main screen):
- One row per team, best first. Each row is a **picture of the team**: the 4 slots left to right, each showing the battle card's image with its support's image attached underneath, the card and support names, and the variant and Awakening level if not Base.
- Next to it: the **highest floor cleared** (90% or more wins), the win rate there, the highest floor won at least once, average turns per win, the rarest card in the team ("rarest: 1 in 2.5Qi"), and a one-line reason it works.
- Sort by highest floor (default), win rate, or rarest card (lowest first, for the easiest team to collect).

**Filters** (always visible):
- Max rarity (text box with the suffix parser above), the unknown-rarity switch, "never use" and "must include" card pickers with search by name.
- Variant and Awakening setting (Base / no Awakening, or the best-case pass), and a minimum floor.
- The filters go into the page URL, so a filtered view can be bookmarked.

**Team details** (click a team):
- A large team picture, every card's ability text, and the key interaction explained.
- Its results across floors: a small chart of win rate by floor.
- The full **battle log** at its highest cleared floor, readable turn by turn, with each card's image beside its actions.
- The assumptions the result depends on (from `ASSUMPTIONS.md`).
- A **"Save team as image"** button that saves the team picture as a PNG with the floor and win rate on it, to share or keep.

### How it runs
- One command starts it, and it opens in the browser at a `localhost` address. It works offline, with no accounts and no internet.
- It reads the results from `results/` (add a `results/teams.json` with everything the CSV has, plus each team's card ids, variant, Awakening, rarest-card rarity and filter). The CSV and `RESULTS.md` stay as they are.
- A simple, clean look: a dark background, the card images as the main thing on the screen, readable on a laptop screen.
- Add the start command and a short "how to use" to the project README.
