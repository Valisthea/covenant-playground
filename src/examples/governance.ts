// Governance — Sprint 27 rewrite (Phase 27.2)
//
// Two examples derived from verified compiler fixtures:
//   B3 — example_07_private_dao.cov   (FHE governance — encrypted vote tallies)
//   C1 — example_03_open_ballot.cov   (transparent ballot with deadline + winner reveal)

import type { Example } from './types';

export const governanceExamples: Example[] = [
  {
    id: 'C1',
    category: 'governance',
    order: 1,
    title: 'Open Ballot',
    shortDescription:
      'A transparent on-chain vote with a deadline. Demonstrates `ballot`, time-bounded actions, and `tally.argmax`.',
    longDescription: `Every vote is visible the moment it is cast — this is the transparency baseline. For private voting, see B3 (Private DAO).

Three patterns to notice:

**1. The \`ballot\` construct.** Tells the compiler to auto-synthesize a \`tally: map<choice, amount>\` field, an \`opened_at: time\` (set at deploy), and the timing machinery. You only declare the options + duration + the actions.

**2. Multi-guard action.** \`cast\` uses three guards in sequence:
- \`when now < opened_at + duration\` — within the voting window
- \`only first_time_caller\` — caller hasn't voted yet
- \`given pick in options\` — the vote is one of the declared choices

All three must hold. Comma-separated, NOT \`&&\`.

**3. \`reveal\` over \`view\`.** \`reveal winner\` returns a \`choice\`. The \`when now >= opened_at + duration\` guard means the winner can't be revealed until the ballot closes. \`tally.argmax\` is a built-in that returns the option with the most votes.

The choice between \`view\` and \`reveal\` matters in privacy contracts (B3 uses \`reveal\` because the underlying values are encrypted). For public ballots they're functionally equivalent.`,
    difficulty: 'intermediate',
    tags: ['governance', 'time'],
    estimatedReadMinutes: 6,
    prerequisites: ['A1 — Hello'],
    tourLessons: ['M3L1'],
    sourcePath: 'C1-open-ballot.cov',
    whatToModify: [
      'Change the duration to `1 hour` so the ballot closes faster (useful for testing).',
      'Add a fourth option: `["yes", "no", "abstain", "veto"]`.',
      'Add a `view turnout returns amount { tally["yes"] + tally["no"] + tally["abstain"] }`.',
      'Add a `view leading returns choice { tally.argmax }` that returns the current leader BEFORE the ballot closes.',
    ],
    relatedExamples: ['B3', 'A1'],
    docsLinks: [
      { title: 'ballot construct', url: 'https://docs.covenant-lang.org/reference/language/ballot/' },
      { title: 'Guards (when/only/given)', url: 'https://github.com/Valisthea/covenant-playground/blob/main/docs/REAL_COVENANT_SYNTAX.md#8-guards' },
    ],
    deployable: true,
    gasEstimate: '~340k gas (deploy)',
    usedInProduction: false,
  },
  {
    id: 'B3',
    category: 'governance',
    order: 2,
    title: 'Private DAO (FHE Voting)',
    shortDescription:
      'A DAO where every vote tally is FHE-encrypted. Results revealed only via threshold decrypt.',
    longDescription: `Combines B1 (encrypted counter) with governance. All vote tallies are stored as TFHE ciphertexts — no individual vote, no running total, is visible during active voting. This prevents both front-running and voter coercion.

Two encrypted counters: \`yes_votes\` and \`no_votes\`. Each \`vote_yes\` / \`vote_no\` action adds 1 homomorphically to its respective counter. The chain sees only ciphertext math; observers learn that *someone* voted (a 1-bit side channel — see lesson notes for V0.7+ mitigations) but not which option they picked.

The two \`reveal\` declarations expose the final tallies to \`owner\` only. Real on-chain reveal requires validator consensus to threshold-decrypt; in the playground's MockChain the FHE precompiles are mocked.

Note from the source comments: this is V0.2 — access control via \`to owner\` is IR-level metadata, EVM enforcement is V1. Production deployment of a DAO with this contract today would have nominal access control only.`,
    difficulty: 'advanced',
    tags: ['FHE', 'governance'],
    estimatedReadMinutes: 8,
    prerequisites: ['B1 — Shielded Counter', 'C1 — Open Ballot'],
    tourLessons: ['M2L4'],
    sourcePath: 'B3-private-dao.cov',
    whatToModify: [
      'Add a third encrypted counter `abstain_votes: amount` and a `vote_abstain` action.',
      'Add a `reveal total returns amount { yes_votes + no_votes }` that aggregates the two encrypted counters homomorphically.',
      'Add a `view has_voted(who: address) returns bool` (you\'ll need to track that separately).',
      'Replace `reveal X to owner` with `reveal X to deployer` — observe behavior.',
    ],
    relatedExamples: ['B1', 'C1', 'B2'],
    docsLinks: [
      { title: 'encrypted counter', url: 'https://docs.covenant-lang.org/reference/language/encrypted-counter/' },
      { title: 'Threshold decryption', url: 'https://docs.covenant-lang.org/reference/privacy/threshold/' },
    ],
    deployable: true,
    gasEstimate: '~410k gas (deploy)',
    usedInProduction: false,
  },
];
