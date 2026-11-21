## Part 8 — Results app (team viewer with a rarity filter)

Build a small **local app** that shows the simulator's results as pictures of each team, and lets the user **limit the search to cards at or below a rarity**, so they can find the best teams they can realistically get.

### Card images
- The user has attached **`card-images.zip`**. Each file is named after the card's `id` (for example `hawkeye-sniper.webp`), and each card in `prestige-sim-cards.json` has an `image` field with that path (`card-images/<id>.webp`).
- A few cards have no image yet (`image` is `null`). Show a plain placeholder tile with the card's name instead. When the user adds an image later, it should only need dropping into the folder.

### How rarity works
- `rarity` in the JSON is the card's base rarity, **"1 in N"**, as a number. A higher N means rarer.
- The user types caps in game notation. Parse these suffixes (each is 1,000 times the one before): K (thousand), M (million), B (billion), T (trillion), Qa (quadrillion, 10^15), Qi (quintillion, 10^18), Sx (10^21), Sp (10^24), Oc (10^27), No (10^30), Dc (10^33). So **"30Qi" = 30 × 10^18 = 3 × 10^19**. Accept plain numbers and e-notation too, and show the parsed value next to the box so the user can see what it understood.
- **A variant changes the rarity.** A card's rarity with a variant = base rarity × the variant's rarity multiplier (Part 2). The filter applies to the rarity of the card **as it is used in the team**: a card may pass at Base but fail as Shiny Galactic.
- Supports have rarities too. The filter applies to **every battle card and every support** in the team.
- **Most cards don't have a rarity in the data yet**, and the user will add them later. Read rarity from the JSON at run time, never hard-code it. Add an "Include cards with unknown rarity" switch (on by default), and mark those cards in the results with a "rarity unknown" badge.

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
