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
5. **Add the Prestige Tower model:** enemy stats per floor from the formula in Part 5, and which cards can appear there.
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
- **The player always gets the first turn**: on entry, your card attacks first, then the enemy acts.
- For now, **any card in the game can be an enemy**. The user will later send which cards actually appear in the Prestige Tower (Part 5).
- Many abilities refer to the **front** card (the active one), the **bench** (cards waiting their turn), "the next card that comes in", and "fallen" cards. Model a lineup where one card per side is in front and the others wait.

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
- **Enemies get stronger every time the player prestiges.** At floor 3,001, enemies are about **130–143x their base strength**.
- **The player's own cards are also boosted in battle by their prestige floor.** At the user's current floor, cards in the battle menu showed about **281x their base stats** (5 cards measured: 280.7x to 281.8x).
- The enemy stat formula per floor is **not known yet** (see Part 5).

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

1. **Prestige Tower enemy formula**: enemy HP and DMG for any floor, and how the player's prestige count changes it. The user will send floor samples. Fit a formula to them and show the fit.
2. **Which cards appear as enemies in the Prestige Tower**, and how enemy teams are picked per floor (random? fixed? does a team size or ordering change?).
3. **Player boost**: exactly how the player's prestige floor boosts their own cards (about 281x was observed at one floor).
4. **Turn order in detail**: after the player's first attack, do sides alternate one action each? When does a new card enter, and does it act immediately?
5. **Targeting**: does a normal attack always hit the enemy in front? Can the bench be hit except where an ability says so?
6. **Team rules**: team size (4?), how many supports each battle card can equip, and whether copies of a card are allowed (cards with **One Per Party** are limited to one).
7. **Timing words**: exactly when "on entry", "start of turn", "end of turn", "end of round" and "at the start of each enemy turn" trigger, relative to each other.
8. **Stacking**: do two damage reductions add or multiply? Do buffs from several cards stack?
9. **"X% damage" without ATK**: confirm it means X% of a normal attack.
10. **Awakening exceptions**: which percentages do not scale.

When the user answers, update `ASSUMPTIONS.md` and re-run the affected tests.

---

## Part 6 — Finding broken teams

The full space is huge: {{battleCount}} battle cards make about {{fourCardTeams}} different 4-card teams before order, variants, Awakening and supports. Simulating all of them is not realistic, so search in stages. The goal is that nothing promising is skipped:

1. **Single cards.** Simulate every card alone against a fixed set of reference enemy teams at several floors. Record damage dealt, damage taken, turns survived, and how much each card's power comes from its ability rather than raw stats.
2. **Pairs.** Test promising cards in pairs to find **synergies**: cards whose abilities feed each other (status combos, "works from anywhere in your party", buffs to the team, death triggers).
3. **Full teams.** Use beam search or a genetic algorithm over 4-card teams (and their order, supports and variants), seeded with the best singles and pairs.
4. **Exhaustive check on the shortlist.** Take the best few dozen cards and try every 4-card team and order among them.
5. **Measure strength as the highest floor cleared.** For each finalist, find the highest Prestige Tower floor it clears at least 90% of the time, at Base variant and at the user's chosen variants and Awakening levels.

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
