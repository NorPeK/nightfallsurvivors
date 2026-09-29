# Evolutions shop — 0.5.0 verification

September 29, 2026. Local candidate; no deployment or YouTube submission.

## Rules

Evolutions is a permanent Power-Up with five ranks. Capacity is **1 + owned rank**, so rank 0 gives one slot and rank 5 gives six. Rank prices are **1,000 / 2,000 / 4,000 / 8,000 / 16,000 gold** (31,000 total). The shop shows current and next capacity and disables purchase at rank 5. These prices are an initial design choice, not a measured economy result.

Each weapon still requires its maximum ordinary rank, paired passive and a chest. Each eligible chest evolves one weapon until capacity is filled; later chests retain ordinary rewards. Capacity is captured when a hunt starts. Purchases apply to the next hunt, while resumed hunts retain their saved capacity. Refunds return recorded paid costs and reset future hunts to one slot.

Profile schema remains 2. Engine snapshots are version 4; version-3 hunts receive one slot without repeating the earlier combat/XP migration. Version-1/2 hunts retain that older migration and receive one slot. See [save compatibility](save-policy.md) for rollback limits.

## Automated results

- `npm run typecheck`, `npm run lint`: passed.
- `npm test`: **188 passed, 0 failed, 1 optional long fixture skipped**. The long fixture was not rerun for this shop change.
- Nineteen new tests cover five purchases, prices, insufficient funds, rank limits, profile reload, exact refunds, old/malformed profiles, sequential chest evolution limits, remaining-slot readiness, six-evolution resume, invalid snapshots and captured hunt capacity.
- `npm run build:all`, `npm run build:qa`, `npm run validate:playables`: passed.
- `git diff --check`: passed.

While testing direct checkpoint restoration, scheduled player casts were found to store an undefined optional owner. They now omit that property, matching their serialized form and allowing immediate checkpoint validation.

## Observed Chrome checks

Used the separate development QA build at `127.0.0.1:4300/?debug=1`, with its temporary 100,000-gold profile. No real player currency or storage was changed.

- Bought all five ranks and observed every price/capacity transition. Rank 4 showed five slots; rank 5 showed six and a disabled “Fully blessed” button.
- Inspected the actual shop rendering at 1470×742: card text, five rank bars and purchase button were readable and reachable by scrolling.
- Started a new hunt and opened Your build: **0 / 6 slots used**.
- Ended the temporary hunt and refunded: **31,000 gold refunded**, treasury restored to 100,000 and the card returned to rank 0 / one slot.
- No captured browser warning/error logs during this flow. Durable reload and multi-evolution combat gates were checked by automated tests, not claimed as browser observations.

## Artifacts and remaining checks

Website: `out/`. Standalone: `game.html`, **432,743 bytes**. Playables ZIP: **137,113 bytes**, five files, **435,946 uncompressed bytes**.

ZIP SHA-256: `bbe0f58a254aac347c71ea03a9e2e413dc5b9016f2eba3eb379133cc4cf1fa89`.

The previous [0.4.0 difficulty measurements](difficulty-update-0.4.0.md) describe the default one-slot rules. Natural balance and sustained performance with two to six evolutions have not been established. Physical Android/iPhone and official YouTube checks remain in the [release checklist](release-checklist.md).
