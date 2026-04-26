// Basics — Sprint 27 rewrite (Phase 27.2)
//
// Two examples derived from verified compiler fixtures:
//   A1 — example_01_hello.cov  (record + view + action minimal)
//   A2 — example_02_coin.cov   (token construct, ERC-20 auto-synthesis)

import type { Example } from './types';

export const basicsExamples: Example[] = [
  {
    id: 'A1',
    category: 'basics',
    order: 1,
    title: 'Hello',
    shortDescription:
      'The minimal viable Covenant file: a record with one field, a setter action, and a getter view.',
    longDescription: `The simplest possible Covenant contract. Demonstrates the three building blocks every contract uses: a \`record\` type, a \`field\`, and an \`action\` paired with a \`view\`.

Notice the syntax compared to Solidity:

- Comments start with \`--\` (Haskell-style), not \`//\`.
- The top-level keyword is \`record\` — Covenant's minimal kv-store. Other top-level keywords (\`token\`, \`ballot\`, \`encrypted counter\`, \`ceremony\`...) trigger different stdlib auto-synthesis.
- Field declarations inside \`record\` don't need the \`field\` keyword (it's implicit).
- Views with zero arguments don't take parentheses: \`view read returns text\` (not \`view read() returns text\`).

This is the right starting point for any Covenant developer. Read the source, then click "Open in Playground" and try modifying it.`,
    difficulty: 'beginner',
    tags: ['basic', 'no-privacy', 'reference'],
    estimatedReadMinutes: 3,
    prerequisites: [],
    tourLessons: ['M1L1'],
    sourcePath: 'A1-hello.cov',
    whatToModify: [
      'Add a `field updates: amount = 0` and increment it inside `update`.',
      'Add a `view last_updater returns address` that returns who last called update (you\'ll need a `field last_updater: address`).',
      'Restrict `update` to the deployer with `when caller == deployer`.',
      'Emit an event each time the greeting changes (`event GreetingChanged(who: address, old: text, new: text)` then `emit ...`).',
    ],
    relatedExamples: ['A2', 'A3'],
    docsLinks: [
      { title: 'Real Covenant Syntax (V0.9)', url: 'https://github.com/Valisthea/covenant-playground/blob/main/docs/REAL_COVENANT_SYNTAX.md' },
      { title: 'docs.covenant-lang.org', url: 'https://docs.covenant-lang.org' },
    ],
    deployable: true,
    gasEstimate: '~80k gas (deploy)',
    usedInProduction: false,
  },
  {
    id: 'A2',
    category: 'basics',
    order: 2,
    title: 'Coin (ERC-20)',
    shortDescription:
      'A standard ERC-20 token. The `token` keyword auto-synthesizes the entire ERC-20 surface from just metadata.',
    longDescription: `An ERC-20-conformant token in 6 lines of code. The \`token\` keyword tells the compiler to auto-synthesize:

- **Fields**: \`supply\`, \`balances\`, \`allowances\`, \`name\`, \`symbol\`, \`decimals\`
- **Actions**: \`transfer\`, \`approve\`, \`transfer_from\`
- **Views**: \`balance_of\`, \`allowance\`, \`total_supply\`, \`name\`, \`symbol\`, \`decimals\`
- **Events**: \`Transfer\`, \`Approval\`

You only write the metadata (name, symbol, decimals, initial supply). The implementation is the ERC-20 spec — no need to copy-paste OpenZeppelin.

\`supply: 1_000_000 to deployer\` mints 1M tokens at deploy time to the deployer's balance.

To customize: write your own \`action transfer(...) { ... }\` after the metadata. The synthesis honors your override.`,
    difficulty: 'beginner',
    tags: ['tokens', 'reference'],
    estimatedReadMinutes: 4,
    prerequisites: ['Read A1 — Hello first'],
    tourLessons: ['M1L1', 'M1L2'],
    sourcePath: 'A2-coin.cov',
    whatToModify: [
      'Change the symbol and name to your own token.',
      'Change `decimals: 18` to `decimals: 6` (USDC-style).',
      'Change supply to a different number (try `100_000_000` for 100M).',
      'Add a custom `action burn(value: amount) { /* ... */ }` to allow burning.',
    ],
    relatedExamples: ['A1', 'A3', 'B2'],
    docsLinks: [
      { title: 'Token construct', url: 'https://docs.covenant-lang.org/reference/language/token/' },
      { title: 'ERC-20 spec', url: 'https://eips.ethereum.org/EIPS/eip-20' },
    ],
    deployable: true,
    gasEstimate: '~450k gas (deploy)',
    usedInProduction: false,
  },
];
