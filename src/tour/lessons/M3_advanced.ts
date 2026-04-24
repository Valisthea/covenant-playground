import { Lesson } from '../types';

// ─────────────────────────────────────────────────────────────────
// Module 3 — Advanced
// Status: stubs — full content coming in Sprint 18 week 3
// ─────────────────────────────────────────────────────────────────

const COMING_SOON = `
## Coming soon

This lesson is being authored. Check back shortly!

Explore the **free playground** to experiment with advanced contracts in the meantime.
`;

export const M3_advanced: Lesson[] = [
  {
    id: 'M3L1',
    moduleId: 'M3',
    order: 1,
    title: 'Cross-Chain Bridges',
    description: 'Transfer value between chains with the bridge construct',
    estimatedMinutes: 15,
    difficulty: 'advanced',
    explanation: COMING_SOON,
    codeStarter: `-- Coming soon: cross-chain bridge
record BridgedVault {
    field balance: amount = 0
}
`,
    codeSolution: `record BridgedVault {
    field balance: amount = 0
}
`,
    objective: 'Coming soon.',
    hints: ['This lesson is under construction.'],
    validator: { type: 'compile-succeeds' },
    next: 'M3L2',
  },

  {
    id: 'M3L2',
    moduleId: 'M3',
    order: 2,
    title: 'Aggregate Operators',
    description: 'Sum, max, count on maps and collections',
    estimatedMinutes: 10,
    difficulty: 'advanced',
    explanation: COMING_SOON,
    codeStarter: `-- Coming soon: .sum, .count, .max
record Leaderboard {
    field scores: map<address, amount>
}
`,
    codeSolution: `record Leaderboard {
    field scores: map<address, amount>
}
`,
    objective: 'Coming soon.',
    hints: ['This lesson is under construction.'],
    validator: { type: 'compile-succeeds' },
    next: 'M3L3',
  },

  {
    id: 'M3L3',
    moduleId: 'M3',
    order: 3,
    title: 'Optimization Annotations',
    description: 'Make your contracts faster and cheaper with @batch_up_to, @precompute',
    estimatedMinutes: 12,
    difficulty: 'advanced',
    explanation: COMING_SOON,
    codeStarter: `-- Coming soon: optimization annotations
record OptimizedToken {
    field balances: map<address, amount>
}
`,
    codeSolution: `record OptimizedToken {
    field balances: map<address, amount>
}
`,
    objective: 'Coming soon.',
    hints: ['This lesson is under construction.'],
    validator: { type: 'compile-succeeds' },
    next: 'M3L4',
  },

  {
    id: 'M3L4',
    moduleId: 'M3',
    order: 4,
    title: 'Upgrade Patterns',
    description: 'Versioning, proxies, and safe upgrades',
    estimatedMinutes: 15,
    difficulty: 'advanced',
    explanation: COMING_SOON,
    codeStarter: `-- Coming soon: upgrade patterns
record UpgradeableVault {
    field version: u32 = 1
}
`,
    codeSolution: `record UpgradeableVault {
    field version: u32 = 1
}
`,
    objective: 'Coming soon.',
    hints: ['This lesson is under construction.'],
    validator: { type: 'compile-succeeds' },
    next: 'M3L5',
  },

  {
    id: 'M3L5',
    moduleId: 'M3',
    order: 5,
    title: 'Testing and Deployment',
    description: 'Ship your contract — MockChain tests, then Sepolia',
    estimatedMinutes: 20,
    difficulty: 'advanced',
    explanation: COMING_SOON,
    codeStarter: `-- Coming soon: test blocks and Sepolia deployment
record ProductionReady {
    field launched: bool = false
}
`,
    codeSolution: `record ProductionReady {
    field launched: bool = false
}
`,
    objective: 'Coming soon.',
    hints: ['This lesson is under construction.'],
    validator: { type: 'compile-succeeds' },
    next: null,
  },
];
