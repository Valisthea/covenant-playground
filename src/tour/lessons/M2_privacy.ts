import { Lesson } from '../types';

// ─────────────────────────────────────────────────────────────────
// Module 2 — Privacy
// Status: stubs — full content coming in Sprint 18 week 3
// ─────────────────────────────────────────────────────────────────

const COMING_SOON = `
## Coming soon

This lesson is being authored. Check back shortly!

In the meantime, explore the **Privacy tab** in the free playground —
load the *Encrypted Token* or *Private Voting* example to see FHE and ZK in action.
`;

export const M2_privacy: Lesson[] = [
  {
    id: 'M2L1',
    moduleId: 'M2',
    order: 1,
    title: 'Public vs Private',
    description: "Understand Covenant's privacy qualifiers",
    estimatedMinutes: 8,
    difficulty: 'intermediate',
    explanation: COMING_SOON,
    codeStarter: `-- Coming soon: public vs private fields
record PrivacyIntro {
    field public_name: text = "Covenant"
    -- TODO: more to come
}
`,
    codeSolution: `record PrivacyIntro {
    field public_name: text = "Covenant"
}
`,
    objective: 'Coming soon — content being authored.',
    hints: ['This lesson is under construction.'],
    validator: { type: 'compile-succeeds' },
    next: 'M2L2',
  },

  {
    id: 'M2L2',
    moduleId: 'M2',
    order: 2,
    title: 'Encrypted Values (FHE)',
    description: 'Your first encrypted field — balances that never leave the chain in plaintext',
    estimatedMinutes: 12,
    difficulty: 'intermediate',
    explanation: COMING_SOON,
    codeStarter: `-- Coming soon: FHE encrypted balances
token EncryptedCoin {
    symbol: "eCOIN"
    name: "Encrypted Coin"
    decimals: 18
    supply: 1_000_000 to deployer
}
`,
    codeSolution: `token EncryptedCoin {
    symbol: "eCOIN"
    name: "Encrypted Coin"
    decimals: 18
    supply: 1_000_000 to deployer
}
`,
    objective: 'Coming soon — content being authored.',
    hints: ['This lesson is under construction.'],
    validator: { type: 'compile-succeeds' },
    next: 'M2L3',
  },

  {
    id: 'M2L3',
    moduleId: 'M2',
    order: 3,
    title: 'Zero-Knowledge Proofs',
    description: 'Prove something without revealing it — using verified_by',
    estimatedMinutes: 15,
    difficulty: 'intermediate',
    explanation: COMING_SOON,
    codeStarter: `-- Coming soon: ZK verified_by guard
record AgeGate {
    -- prove age >= 18 without revealing date of birth
}
`,
    codeSolution: `record AgeGate {
    field min_age: amount = 18
}
`,
    objective: 'Coming soon — content being authored.',
    hints: ['This lesson is under construction.'],
    validator: { type: 'compile-succeeds' },
    next: 'M2L4',
  },

  {
    id: 'M2L4',
    moduleId: 'M2',
    order: 4,
    title: 'Post-Quantum Signatures',
    description: 'Future-proof your contracts with Dilithium5',
    estimatedMinutes: 10,
    difficulty: 'advanced',
    explanation: COMING_SOON,
    codeStarter: `-- Coming soon: pq_signed guard
record PQAdmin {
    field admin: pq_key
}
`,
    codeSolution: `record PQAdmin {
    field admin: pq_key
}
`,
    objective: 'Coming soon — content being authored.',
    hints: ['This lesson is under construction.'],
    validator: { type: 'compile-succeeds' },
    next: 'M2L5',
  },

  {
    id: 'M2L5',
    moduleId: 'M2',
    order: 5,
    title: 'Amnesia Ceremonies',
    description: 'Provably destroy keys forever — the ceremony lifecycle',
    estimatedMinutes: 20,
    difficulty: 'advanced',
    explanation: COMING_SOON,
    codeStarter: `-- Coming soon: ceremony lifecycle
-- idle → gathering → finalized → destroyed
record AmnesiaCeremony {
    -- phases to come
}
`,
    codeSolution: `record AmnesiaCeremony {
    field phase: text = "idle"
}
`,
    objective: 'Coming soon — content being authored.',
    hints: ['This lesson is under construction.'],
    validator: { type: 'compile-succeeds' },
    next: 'M3L1',
  },
];
