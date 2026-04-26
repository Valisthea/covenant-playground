// Privacy — Sprint 27 rewrite (Phase 27.2)
//
// Two examples derived from verified compiler fixtures:
//   B1 — example_04_shielded_counter.cov  (encrypted counter — TFHE primitives)
//   B2 — example_06_secret_coin.cov       (confidential token — ERC-8227)

import type { Example } from './types';

export const privacyExamples: Example[] = [
  {
    id: 'B1',
    category: 'privacy',
    order: 1,
    title: 'Shielded Counter (FHE)',
    shortDescription:
      'A counter where the value is encrypted on-chain. Increments are homomorphic — no decryption needed.',
    longDescription: `Demonstrates Covenant's first-class FHE support via the \`encrypted counter\` construct. The \`total\` field is auto-encrypted as a TFHE ciphertext (ERC-8227 handle, 32 bytes on chain). Every observer sees ciphertext bytes; no one except the \`owner\` can see the actual value.

The \`bump(by: amount)\` action uses \`total += by\` — but this is a **homomorphic add**: it operates on the ciphertext directly, no decryption ever happens on chain. The result remains encrypted.

The \`reveal total to owner\` line declares an access policy: only the address designated as \`owner\` can request a threshold-decrypt of the value. On real chain this requires validator consensus (TFHE threshold decryption); in the playground's MockChain it returns a mocked plaintext.

This pattern is the building block for confidential tokens, sealed-bid auctions, and private accumulators of any kind.`,
    difficulty: 'intermediate',
    tags: ['FHE', 'reference'],
    estimatedReadMinutes: 5,
    prerequisites: ['A1 — Hello'],
    tourLessons: ['M2L1'],
    sourcePath: 'B1-shielded-counter.cov',
    whatToModify: [
      'Add a `decrement(by: amount)` action with `total -= by`.',
      'Add a second encrypted counter (`negatives: amount`) that tracks calls below zero.',
      'Add a guard `when by > 0` so calls with zero are rejected before touching the ciphertext.',
      'Change `reveal total to owner` to `reveal total to deployer` — observe the difference (or sameness).',
    ],
    relatedExamples: ['B2', 'B3'],
    docsLinks: [
      { title: 'encrypted counter', url: 'https://docs.covenant-lang.org/reference/language/encrypted-counter/' },
      { title: 'ERC-8227 spec', url: 'https://eips.ethereum.org/EIPS/eip-8227' },
    ],
    deployable: true,
    gasEstimate: '~320k gas (deploy)',
    usedInProduction: false,
  },
  {
    id: 'B2',
    category: 'privacy',
    order: 2,
    title: 'Secret Coin (Confidential Token)',
    shortDescription:
      'An ERC-8227 confidential token. Same syntax as `token`, but balances are TFHE ciphertexts.',
    longDescription: `\`confidential token\` is the FHE-encrypted analog of \`token\`. Same metadata-only declaration; same auto-synthesis pattern; but the balances and allowances are TFHE ciphertexts (ERC-8227 handles) instead of plaintext uint256.

Auto-synthesized surface:

- **Fields**: \`total_supply\` (plaintext), \`balances\` (map<address, ciphertext<amount>>), \`allowances\` (map<hash, ciphertext<amount>>)
- **Actions**: \`transferEncrypted\`, \`transferFromEncrypted\`, \`approveEncrypted\`
- **Views**: \`balanceOfEncrypted\`, \`allowanceEncrypted\`, \`totalSupply\`, \`decimals\`, \`symbol\`, \`name\`
- **Events**: \`TransferEncrypted\`, \`ApprovalEncrypted\`

\`supply: 1_000_000 to deployer\` mints an FHE-encrypted genesis balance to the deployer.

For an external observer, every transfer reveals **only that a transfer happened** — not the amount, not the recipient's new balance. The chain stores nothing decryptable.

In the playground's MockChain, the FHE precompiles are mocked (return deterministic plaintexts) so you can iterate on UX. Real chain deployment requires TFHE-enabled validators.`,
    difficulty: 'intermediate',
    tags: ['FHE', 'tokens'],
    estimatedReadMinutes: 5,
    prerequisites: ['A2 — Coin', 'B1 — Shielded Counter'],
    tourLessons: ['M2L3'],
    sourcePath: 'B2-secret-coin.cov',
    whatToModify: [
      'Change name to "MyConfToken" and symbol to "MCT".',
      'Change decimals to 6 (USDC-style).',
      'Try a smaller supply: `supply: 1_000 to deployer`.',
      'Add an explicit `action burnEncrypted(value: amount) { /* TODO */ }` to override the default behavior.',
    ],
    relatedExamples: ['A2', 'B1', 'B3'],
    docsLinks: [
      { title: 'confidential token', url: 'https://docs.covenant-lang.org/reference/language/confidential-token/' },
      { title: 'ERC-8227 spec', url: 'https://eips.ethereum.org/EIPS/eip-8227' },
    ],
    deployable: true,
    gasEstimate: '~520k gas (deploy)',
    usedInProduction: false,
  },
];
