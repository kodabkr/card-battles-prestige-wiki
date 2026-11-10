---
title: Borders (Variants)
navTitle: Borders
description: Every card variant, from Gold to Rainbow, and exactly how much it multiplies rarity, DMG and HP.
icon: card
---
A **variant** (shown on the card as its border) is a rarer version of a card. Each variant multiplies the card's base rarity and base stats by a fixed amount.

## Variant multipliers

{{variant-rules}}

## Rules

- **Every 10x in rarity doubles the stats.** Stat multiplier = 2^(log10 of the rarity multiplier). For example, Gold is x100 rarity, which is 10x twice, so stats double twice: x4.
- **Shiny combos multiply.** Shiny Gold = Shiny x Gold, Shiny Prismatic = Shiny x Prismatic, Shiny Cosmic = Shiny x Cosmic, Shiny Galactic = Shiny x Galactic. Both the rarity and the stat multipliers multiply.
- **Rainbow is standalone.** It can never be combined with Shiny or any other variant.
- **Variant rarity** = base rarity x rarity multiplier.
- **Variant DMG and HP** = base DMG and HP x stat multiplier.
- **HP is exactly 2x DMG** on every card seen so far.

:::note Rounding
In-game numbers may differ slightly from these calculations because the game rounds what it shows.
:::

## Abilities and variants

Ability damage written as **"X% of ATK"** scales with the variant's DMG. Every [[Card Database|card profile]] has a variant table that works out each of those hits for every variant.

Effects with no percentage (stuns, blocks, turn counts, disables) are the same on every variant.

## Variants and scrap

Each variant counts as its own card when you sacrifice duplicates for [[currency:scrap]]. You keep 4 copies of each version:

- 5 Shiny Galactic copies → 1 to sacrifice.
- 4 plain Galactic copies → nothing to sacrifice.

## Every variant

{{panels kind="border" layout="grid"}}
