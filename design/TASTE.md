# CashFlow UI direction

## Design direction

A calm, ledger-inspired personal debt tracker, designed to answer three questions at a glance: how much money is in each account, who owes you, and whom you owe. The interface is Myanmar-first, precise with amounts, and reassuring without looking like a bank portal.

## Principles

- Put current account balances and the two debt lists above the fold.
- Use warm, low-contrast surfaces with deep forest-green emphasis and restrained teal for positive movement.
- Keep person-level debt totals and repayment actions easy to scan on small screens.
- Format every monetary value consistently in Myanmar Kyat.
- Use Burmese labels by default and offer English as a complete alternate locale.
- Keep the interface focused: one history list (with edit and delete) on Home, read-only lists on People and Spending, and no charts or reports.
- Reserve shadows for popovers and other floating surfaces.

## Typography and layout

- Use Noto Sans Myanmar for Burmese text and a neutral sans-serif fallback for numerals and English.
- Use two font weights on a screen: regular for supporting information and semibold for hierarchy.
- Use a single row of top tabs (Home, People, Spending) under the header instead of a navigation rail.
- Prefer aligned amounts and tabular figures over decorative charts.

## Color and component tokens

The source of truth is `src/app/globals.css` (CSS variables) and `tailwind.config.ts` (Tailwind semantic colors and spacing). Components must consume these tokens; do not add ad-hoc color, spacing, radius, shadow, or duration values.

## Reference imagery

No external images are required for this data-focused product. The `design/references/` directory is reserved for user-provided references.
