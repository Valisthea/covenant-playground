// Advanced — Sprint 27 rewrite (Phase 27.2)
//
// Three examples derived from verified compiler fixtures:
//   C2 — example_08_amnesia_ceremony.cov  (ERC-8228 lifecycle)
//   C3 — example_09_encrypted_bridge.cov  (cross-chain escrow with map<>+events)
//   C4 — example_05_quantum_board.cov     (board + post-quantum signatures)

import type { Example } from './types';

export const advancedExamples: Example[] = [
  {
    id: 'C2',
    category: 'advanced',
    order: 1,
    title: 'Amnesia Ceremony',
    shortDescription:
      'An ERC-8228 amnesia ceremony with guardian shares. Demonstrates the `ceremony` construct.',
    longDescription: `Cryptographic amnesia: a ceremony where N guardians each hold a share of a secret, T must agree to reveal, and after \`destroy()\` the secret is provably unrecoverable forever.

The \`ceremony\` keyword auto-synthesizes the entire ERC-8228 lifecycle:

| Function | Returns | Purpose |
|---|---|---|
| \`setup()\` | \`uint256\` | initialize ceremony, returns session_id |
| \`submit_share(bytes32)\` | \`bool\` | a guardian submits their share |
| \`finalize()\` | \`bool\` | organizer closes share collection |
| \`destroy()\` | \`bool\` | irrevocably destroy the secret + emit destruction event |
| \`phase()\` | \`uint256\` | 0=Setup, 1=Active, 2=Finalized, 3=Destroyed |
| \`session_id()\` | \`uint256\` | the active session id |
| \`is_destroyed()\` | \`bool\` | true once destroy() was called |
| \`owner()\` | \`address\` | the ceremony organizer |

You only declare metadata: \`guardians: 3\` (number of share holders) and \`threshold: 2\` (minimum to reconstruct).

The \`on_destroy { destroy(0) }\` block runs when the ceremony reaches the Destroyed phase, generating an irrevocable destruction proof event.

Use cases: trusted setup ceremonies for ZK circuits, cryptographic key sharding, time-locked secret reveals, dead-man-switch contracts.`,
    difficulty: 'expert',
    tags: ['Amnesia', 'cross-chain', 'PQ'],
    estimatedReadMinutes: 10,
    prerequisites: ['B1 — Shielded Counter', 'C1 — Open Ballot'],
    tourLessons: ['M3L3'],
    sourcePath: 'C2-amnesia-ceremony.cov',
    whatToModify: [
      'Increase `guardians: 5` and `threshold: 3` for stronger Byzantine tolerance.',
      'Try `guardians: 1, threshold: 1` to model a single-key ceremony (no sharding).',
      'Add a `view ceremony_owner returns address { owner() }` to expose the deployer.',
      'Remove the `on_destroy` block and observe the lifecycle still works (destroy proof is auto-emitted by stdlib).',
    ],
    relatedExamples: ['B1', 'C3'],
    docsLinks: [
      { title: 'ceremony construct', url: 'https://docs.covenant-lang.org/reference/language/ceremony/' },
      { title: 'ERC-8228 spec', url: 'https://eips.ethereum.org/EIPS/eip-8228' },
      { title: 'Amnesia primitives', url: 'https://docs.covenant-lang.org/reference/privacy/amnesia/' },
    ],
    deployable: true,
    gasEstimate: '~480k gas (deploy)',
    usedInProduction: false,
  },
  {
    id: 'C3',
    category: 'advanced',
    order: 2,
    title: 'Encrypted Bridge',
    shortDescription:
      'A cross-chain asset escrow module. Per-depositor balance tracking with `when` guards.',
    longDescription: `A foundational cross-chain pattern. Users \`lock\` assets on this side; an off-chain watcher observes the \`Locked\` event and mints/releases on the target chain. \`unlock\` requires a prior lock from the same caller — enforced by the \`when deposits[caller] >= value\` guard.

Three patterns to notice:

**1. \`map<address, amount>\` for per-account state.** \`deposits[caller] += value\` indexes the map by the caller's address. The \`-=\` on unlock ensures balance accuracy.

**2. \`when\` guards for safety.** \`unlock\` reverts before the body runs if \`deposits[caller] < value\`. Cleaner than checking inside the action.

**3. Events for off-chain coordination.** \`emit Locked(caller, value)\` and \`emit Unlocked(caller, value)\` are how the bridge watcher knows what to do on the other side. The events are deterministic: indexed by caller, value as data.

This is the \`module\` construct — no auto-synthesis, every line is yours. For a privacy-preserving variant where amounts are FHE-encrypted, see B3 (PrivateDAO) for the encrypted accumulator pattern.`,
    difficulty: 'advanced',
    tags: ['bridges', 'cross-chain', 'defi'],
    estimatedReadMinutes: 7,
    prerequisites: ['A3 — Safe Transfer'],
    tourLessons: ['M3L4'],
    sourcePath: 'C3-encrypted-bridge.cov',
    whatToModify: [
      'Add a `view total_locked returns amount` that returns the global `locked_total`.',
      'Add an `error InsufficientLocked(requested: amount, available: amount)` and use `revert_with` instead of the `when` guard.',
      'Track lock times: add `field lock_times: map<address, time>` and update on each lock.',
      'Add a `view locked_at(who: address) returns time` query.',
    ],
    relatedExamples: ['A3', 'B3'],
    docsLinks: [
      { title: 'Cross-chain primitives', url: 'https://docs.covenant-lang.org/reference/cross-chain/' },
      { title: 'module construct', url: 'https://docs.covenant-lang.org/reference/language/module/' },
    ],
    deployable: true,
    gasEstimate: '~290k gas (deploy)',
    usedInProduction: false,
  },
  {
    id: 'C4',
    category: 'advanced',
    order: 3,
    title: 'Quantum Board',
    shortDescription:
      'An append-only message board with post-quantum (Dilithium-5) signatures on every post.',
    longDescription: `Combines two advanced patterns:

**1. The \`board\` construct.** A nested \`post { ... }\` block defines a record type for entries. \`append post { ... }\` adds a new entry. The list is implicit (\`posts: <list of post>\`); access via \`posts[i]\` and \`posts.length\`.

**2. The \`pq_signed(...)\` guard.** Post-quantum signature verification. Submitting a post requires:
- Calling \`register(pk: pq_key)\` once to register a Dilithium-5 public key
- All subsequent \`submit\` calls include a Dilithium signature over the content hash
- The compiler emits the precompile call for verification

Why post-quantum? Today's Ed25519 / ECDSA signatures will be forgeable once quantum computers reach ~4000 logical qubits. Posts signed with Dilithium-5 today remain verifiable in 2050+.

The \`only registered_key\` qualifier enforces that only addresses with a registered \`pq_key\` can submit. Combined with \`pq_signed(content, sig, keys[caller])\`, posts are authentic and quantum-secure.

In the playground's MockChain, the PQ verification precompile is mocked — any non-empty signature passes. Real chain deployment requires PQ-enabled validators (Aster Chain ships with Dilithium-5 by default).`,
    difficulty: 'expert',
    tags: ['PQ', 'security'],
    estimatedReadMinutes: 9,
    prerequisites: ['B1 — Shielded Counter', 'C2 — Amnesia Ceremony'],
    tourLessons: ['M2L4'],
    sourcePath: 'C4-quantum-board.cov',
    whatToModify: [
      'Add a `view get_key(who: address) returns pq_key { keys[who] }` to expose registered keys.',
      'Add a `view total_posts returns amount { posts.length }` (different name from `count`).',
      'Add an `event PostSubmitted(author: address, idx: amount)` that fires inside `submit`.',
      'Try removing the `pq_signed` guard — the post is still appended but loses quantum security.',
    ],
    relatedExamples: ['C2', 'C3'],
    docsLinks: [
      { title: 'board construct', url: 'https://docs.covenant-lang.org/reference/language/board/' },
      { title: 'Post-quantum primitives', url: 'https://docs.covenant-lang.org/reference/privacy/pq/' },
      { title: 'NIST PQC announcement', url: 'https://csrc.nist.gov/projects/post-quantum-cryptography' },
    ],
    deployable: true,
    gasEstimate: '~620k gas (deploy)',
    usedInProduction: false,
  },
];
