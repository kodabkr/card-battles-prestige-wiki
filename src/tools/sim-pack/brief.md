# Card Battles: Prestige — Prestige Tower Battle Simulator Pack

*Generated {{generatedAt}} from the Card Battles: Prestige fan wiki data. {{cardCount}} cards ({{battleCount}} battle, {{supportCount}} support). Companion file: `prestige-sim-cards.json` (the same card data, machine-readable).*

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
| Player boost | Every player card's DMG and HP x281, the same on every floor |
| Player variants and Awakening | Base variant, no Awakening. Then a second pass of the finalists at Shiny Galactic and Awakening Lv 5, to show the best case |
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
- **The player's own cards are boosted in battle by their prestige floor.** At the user's current floor, cards in the battle menu showed about **281x their base stats** (5 cards measured: 280.7x to 281.8x). **But it is not the same for every card:** comparing battle-menu stats with base stats from the deck view on 14 more cards gave anything from 1x to about 3,300x (most between 25x and 530x). So the battle-menu number depends on more than the floor, probably the copy the user owns (its variant, and maybe pack upgrade levels or other boosts). The exact rule is still unknown (Part 5). Make the player boost a per-card setting with 281x as the default, so real numbers for the user's copies can be dropped in later.
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
3. **Player boost**: exactly how the player's prestige floor boosts their own cards. About 281x was observed on 5 cards at one floor, but other cards showed 1x to 3,300x (Part 3).
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

The full space is huge: {{battleCount}} battle cards make about {{fourCardTeams}} different 4-card teams before order, variants, Awakening and supports. Simulating all of them is not realistic, so search in stages. The goal is that nothing promising is skipped:

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
   - **Run summary:** the date, how many battles and teams were simulated, the random seed, and the config used (boost, variants, Awakening, Difficulty Cut).
   - **Top 25 teams:** a table with rank, slot 1–4 battle cards, slot 1–4 supports, highest floor cleared (90%+ win rate), win rate there, the highest floor won at least once, and average turns per win. Show Base / no Awakening and the best-case pass (Shiny Galactic, Awakening Lv 5) in separate tables.
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

Card stats are **base** (no variant, Awakening or prestige boost). Rarity is "1 in N" before variants. Cards marked **(estimated)** had their base stats worked out from boosted battle-menu numbers; treat them as approximate. "Roles" are the wiki's own summary labels, not from the game.

For each ability, the **Ability numbers** table lists every percentage in the text, in order, with its value at each Awakening level (base x 1.1, 1.2, 1.3, 1.4, 1.5).
