// DeFi — Sprint 27 rewrite (Phase 27.2)
//
// One example derived from a verified compiler fixture:
//   A3 — example_11_safe_transfer.cov  (module + typed errors + revert_with)

import type { Example } from './types';

export const defiExamples: Example[] = [
  {
    id: 'A3',
    category: 'defi',
    order: 1,
    title: 'Safe Transfer',
    shortDescription:
      'A vault-style module with deposits/withdrawals, typed errors, and the `revert_with` pattern.',
    longDescription: `A working example of how to handle errors in Covenant. Three patterns to notice:

**1. Typed errors with arguments.** \`error InsufficientBalance(required: amount, actual: amount)\` declares an error that carries diagnostic context. When triggered, the ABI-encoded error gets returned to the caller — the playground's RevertDisplay decodes it and shows the args inline.

**2. \`when\` guards as preconditions.** \`safe_withdraw\` uses \`when balances[caller] >= value\` — if the guard fails, the call reverts before the body runs, no error type info.

**3. \`revert_with\` for explicit failures.** Three "force" actions (\`force_insufficient\`, \`force_unauthorized\`, \`force_zero_amount\`) demonstrate triggering each error type explicitly. Useful for testing that the playground's error decoder works.

This is the \`module\` construct — it does NO auto-synthesis. Every action, view, field, error, and event is explicit. Use this when you need full control.`,
    difficulty: 'intermediate',
    tags: ['defi', 'security', 'reference'],
    estimatedReadMinutes: 6,
    prerequisites: ['A1 — Hello', 'A2 — Coin'],
    tourLessons: ['M1L4'],
    sourcePath: 'A3-safe-transfer.cov',
    whatToModify: [
      'Add a `view get_balance(who: address) returns amount` that handles missing entries.',
      'Add a `withdraw_all` action that withdraws the caller\'s entire balance.',
      'Add an `error WithdrawalLocked(unlocks_at: time)` and a `field unlock_time: time` for time-locked withdrawals.',
      'Replace the `when` guard on `safe_withdraw` with a `revert_with InsufficientBalance(value, balances[caller])` so the user sees the actual balance.',
    ],
    relatedExamples: ['A1', 'A2', 'C3'],
    docsLinks: [
      { title: 'Module construct', url: 'https://docs.covenant-lang.org/reference/language/module/' },
      { title: 'Errors and revert_with', url: 'https://github.com/Valisthea/covenant-playground/blob/main/docs/REAL_COVENANT_SYNTAX.md#11-errors-and-revert_with' },
    ],
    deployable: true,
    gasEstimate: '~280k gas (deploy)',
    usedInProduction: false,
  },
];
