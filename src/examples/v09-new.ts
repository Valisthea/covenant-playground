// V0.9 New — three new top-level constructs introduced in V0.9 GA
//   D1 — nft (ERC-721 auto-synthesis)
//   D2 — registry (ERC-8231 PQ key registry auto-synthesis)
//   D3 — interface + call_interface (typed cross-contract calls)

import type { Example } from './types';

export const v09NewExamples: Example[] = [
  {
    id: 'D1',
    category: 'v09-new',
    order: 1,
    title: 'NFT in 5 Lines',
    shortDescription:
      'ERC-721 auto-synthesized from a 5-line declaration via the V0.9 `nft` construct.',
    longDescription: `V0.9 introduces the \`nft\` keyword — a top-level construct that auto-synthesizes the entire ERC-721 surface from metadata only.

\`\`\`covenant
nft CoolApes {
    name: "Cool Apes"
    symbol: "APE"
    base_uri: "https://api.example.com/"
}
\`\`\`

That's the entire contract. The compiler emits 11 functions:

- **Fields:** \`owners\`, \`balances\`, \`token_approvals\`, \`operator_approvals\`
- **Views:** \`name\`, \`symbol\`, \`tokenURI\`, \`balanceOf\`, \`ownerOf\`, \`getApproved\`, \`isApprovedForAll\`
- **Actions:** \`approve\`, \`setApprovalForAll\`, \`transferFrom\`, \`mint\`
- **Events:** \`Transfer\`, \`Approval\`, \`ApprovalForAll\` (properly indexed per ERC-721)
- **Errors:** \`NotTokenOwner\`, \`TokenAlreadyMinted\`, \`TokenDoesNotExist\`, \`NotApprovedOrOwner\`

Bytecode is a drop-in replacement for an OpenZeppelin-based ERC-721 — wallets, marketplaces, and indexers see the same interface.

V0.9.0 limits: \`mint\` is open-access (add \`only deployer\` to gate), \`tokenURI(id)\` returns \`base_uri\` verbatim (id concat in V0.9.x), \`safeTransferFrom\` reserved but not yet emitted.`,
    difficulty: 'beginner',
    tags: ['tokens', 'erc721', 'v09', 'reference'],
    estimatedReadMinutes: 4,
    prerequisites: ['A2 — Coin'],
    tourLessons: [],
    sourcePath: 'D1-nft.cov',
    whatToModify: [
      'Change `name` and `symbol` to anything you like — the contract still compiles.',
      'Add a `field minted_count: u256` and increment it on each mint.',
      'Add `only deployer` to the synthesized `mint` action by re-declaring it inline.',
      'Change `base_uri` to `"ipfs://Qm..."` to point to IPFS metadata.',
    ],
    relatedExamples: ['A2', 'D2'],
    docsLinks: [
      { title: 'Reference: ERC-721', url: 'https://covenant-lang.org/docs/examples/16-nft' },
      { title: 'Fixture (compiler tests)', url: 'https://github.com/Valisthea/covenant/blob/main/crates/covenant-lexer/tests/fixtures/example_13_nft_minimal.cov' },
    ],
    deployable: true,
    gasEstimate: '~1.2M gas (deploy)',
    usedInProduction: false,
  },

  {
    id: 'D2',
    category: 'v09-new',
    order: 2,
    title: 'PQ Key Registry',
    shortDescription:
      'ERC-8231 post-quantum key registry auto-synthesized from one line via the V0.9 `registry` construct.',
    longDescription: `\`registry\` auto-synthesizes [ERC-8231](https://github.com/Valisthea/styx-protocol/blob/main/ercs/ERC-8231.md) — the post-quantum key registry standard. It's the migration vehicle from ECDSA to Dilithium-5.

\`\`\`covenant
registry KeyRegistry {
}
\`\`\`

One line. Entire contract.

The compiler emits:

- **Fields:** \`keys: map<address, pq_key>\`, \`registered: map<address, bool>\`
- **Views:** \`is_registered(account)\`, \`key_of(account)\`, \`algorithm_id()\`
- **Actions:** \`register(pk: pq_key)\`, \`revoke()\`
- **Events:** \`KeyRegistered\`, \`KeyRevoked\`, \`KeyUpdated\` (reserved)
- **Errors:** \`NotRegistered\`, \`AlreadyRegistered\`

\`algorithm_id()\` returns 1 (Dilithium-5 per FIPS 204). V1.0 may add Falcon-512, SPHINCS+, or hybrid IDs.

**Why this exists**: by 2030 a cryptographically relevant quantum computer could break ECDSA. ERC-8231 lets users register their PQ keys on-chain so wallets, multisigs, and signature schemes can migrate when needed.

V0.9.0 limits: \`update_key(new_pk, sig)\` (PQ-signed key rotation) is reserved but not yet emitted; for now, users \`revoke()\` then \`register()\` to rotate.`,
    difficulty: 'intermediate',
    tags: ['PQ', 'identity', 'erc8231', 'v09', 'reference'],
    estimatedReadMinutes: 5,
    prerequisites: ['B3 — Private DAO'],
    tourLessons: [],
    sourcePath: 'D2-registry.cov',
    whatToModify: [
      'Add a `field approved: map<address, bool>` and gate `register` with `given approved[caller]`.',
      'Add a custom `revoke()` that requires a PQ signature for cryptographic proof of intent.',
      'Add a `view total_registered returns u256` that counts registered addresses.',
    ],
    relatedExamples: ['D1', 'C4'],
    docsLinks: [
      { title: 'Docs: ERC-8231', url: 'https://covenant-lang.org/docs/examples/17-registry' },
      { title: 'Fixture (compiler tests)', url: 'https://github.com/Valisthea/covenant/blob/main/crates/covenant-lexer/tests/fixtures/example_14_registry_minimal.cov' },
    ],
    deployable: true,
    gasEstimate: '~600K gas (deploy)',
    usedInProduction: false,
  },

  {
    id: 'D3',
    category: 'v09-new',
    order: 3,
    title: 'Cross-Contract Calls',
    shortDescription:
      'Typed external calls via the V0.9 `interface` declaration. Compile-time selector + auto-decode.',
    longDescription: `V0.9 introduces \`interface\` — a top-level declaration that defines the surface of an external contract for typed cross-contract calls.

\`\`\`covenant
interface IERC20 {
    action transfer(to: address, value: amount) returns bool
    view balance_of(who: address) returns amount
}

module Withdrawer {
    field token: address

    action withdraw(value: amount) {
        let iface = call_interface(token, IERC20)
        iface.transfer(caller, value)
    }
}
\`\`\`

**Why this matters**: Solidity's \`address.call(bytes)\` is untyped — you encode arguments by hand and the compiler can't tell you when you got it wrong. Covenant's \`interface\` declarations solve that:

- **Type-checked at compile time.** Wrong types → compile error.
- **No selector typos.** Selector is computed from the interface, not from a string literal.
- **Auto-decode on return.** \`iface.balance_of(addr)\` returns \`amount\` directly, not raw bytes.

**What \`interface\` does NOT do**: it's not an import, no inheritance. The interface is a *type signature* the compiler uses to verify your calls — runtime behavior at the EVM layer is the same as a hand-rolled CALL.`,
    difficulty: 'intermediate',
    tags: ['interface', 'cross-chain', 'integrations', 'v09', 'advanced-patterns'],
    estimatedReadMinutes: 6,
    prerequisites: ['A3 — Safe Transfer'],
    tourLessons: [],
    sourcePath: 'D3-external-call.cov',
    whatToModify: [
      'Add a `view get_token_balance() returns amount` that calls `iface.balance_of(self)`.',
      'Add a precondition `given iface.balance_of(self) >= value` before `transfer`.',
      'Define a second interface `IFactory` with `create_pair` and use both in the same module.',
    ],
    relatedExamples: ['A3', 'D1'],
    docsLinks: [
      { title: 'Docs: Interfaces', url: 'https://covenant-lang.org/docs/examples/18-external-call' },
      { title: 'Reference: Compiler — Interface Lowering', url: 'https://covenant-lang.org/docs/reference/compiler/interface' },
    ],
    deployable: true,
    gasEstimate: '~400K gas (deploy)',
    usedInProduction: false,
  },
];
