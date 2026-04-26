import { Lesson } from '../types';

// ─────────────────────────────────────────────────────────────────
// Module 2 — Privacy (Sprint 49 rewrite)
// 5 real lessons covering: encrypted counter, confidential token,
// post-quantum signatures, amnesia ceremony, private voting.
// ─────────────────────────────────────────────────────────────────

export const M2_privacy: Lesson[] = [
  // ───────── M2L1 — Encrypted Counter ─────────
  {
    id: 'M2L1',
    moduleId: 'M2',
    order: 1,
    title: 'Encrypted Counter',
    description: 'Your first private state — a counter nobody can read except the owner',
    estimatedMinutes: 8,
    difficulty: 'intermediate',
    explanation: `## Private state with \`encrypted counter\`

In V0.8, every field you wrote was visible to anyone reading the blockchain. A map of balances? Public. A vote count? Public. In real applications, that's often unacceptable.

Covenant solves this with the \`encrypted counter\` construct. The field is stored on-chain as **ciphertext** — encrypted data that can be computed on without ever decrypting.

\`\`\`covenant
encrypted counter SecretTally {
    total: amount

    action bump(by: amount) {
        total += by        -- homomorphic addition: works on ciphertext
    }

    reveal total to owner  -- only owner can see the plaintext value
}
\`\`\`

Key concepts:
- \`encrypted counter\` — the \`total\` field is automatically a TFHE ciphertext
- \`total += by\` — this is **homomorphic addition**: adding to encrypted data without decrypting it
- \`reveal total to owner\` — declares who can decrypt the value

Nobody except \`owner\` can see what \`total\` actually is. On-chain, it's just opaque bytes.

## Your task

Complete the encrypted counter below: implement \`increment\` (adds 1 to count) and add a reveal statement so only the deployer can read the value.
`,
    codeStarter: `encrypted counter PrivateScore {
    count: amount

    -- TODO 1: action \`increment\` that adds 1 to count

    -- TODO 2: reveal count to deployer
}
`,
    codeSolution: `encrypted counter PrivateScore {
    count: amount

    action increment() {
        count += 1
    }

    reveal count to deployer
}
`,
    objective: 'Implement `increment` action and add `reveal count to deployer`.',
    hints: [
      'The action body is simple: `count += 1` — the encryption happens automatically',
      '`reveal` is a declaration, not an action. It goes at the same level as `action` and `field`',
      'Full reveal syntax: `reveal count to deployer` — where `deployer` is a built-in principal',
    ],
    validator: {
      type: 'custom',
      fn: (source) => {
        const hasIncrement =
          /action\s+increment\s*\(\s*\)/i.test(source) && /count\s*\+=\s*1/i.test(source);
        const hasReveal = /reveal\s+count\s+to\s+deployer/i.test(source);
        if (hasIncrement && hasReveal) {
          return { passed: true, message: '✓ Encrypted counter with reveal policy!' };
        }
        const missing: string[] = [];
        if (!hasIncrement) missing.push('`action increment()` with `count += 1`');
        if (!hasReveal) missing.push('`reveal count to deployer`');
        return { passed: false, message: 'Missing: ' + missing.join(' and ') };
      },
    },
    next: 'M2L2',
  },

  // ───────── M2L2 — Confidential Token ─────────
  {
    id: 'M2L2',
    moduleId: 'M2',
    order: 2,
    title: 'Confidential Token',
    description: 'An ERC-20 where nobody can see your balance — not even validators',
    estimatedMinutes: 6,
    difficulty: 'intermediate',
    explanation: `## Confidential tokens (ERC-8227)

Remember \`token Coin { ... }\` from Module 1? It auto-generates an ERC-20 where everyone can see every balance.

\`confidential token\` does the same thing but with **encrypted balances**. Transfer amounts are ciphertexts. Nobody sees who has how much — the EVM executes transfers on encrypted values.

\`\`\`covenant
confidential token SecretCoin {
    symbol: "SCOIN"
    name: "Secret Coin"
    decimals: 18
    supply: 1_000_000 to deployer
}
\`\`\`

5 lines. The compiler generates: \`transferEncrypted\`, \`balanceOfEncrypted\`, \`approveEncrypted\`, \`TransferEncrypted\` event — the entire ERC-8227 surface.

## Your task

Create a confidential token with your chosen name and symbol. The metadata fields are the same as a regular token.
`,
    codeStarter: `-- Create a confidential token
-- Use the \`confidential token\` keywords (not just \`token\`)

-- TODO: fill in the metadata

`,
    codeSolution: `confidential token MySecret {
    symbol: "MSEC"
    name: "My Secret Token"
    decimals: 18
    supply: 500_000 to deployer
}
`,
    objective: 'Declare a `confidential token` with symbol, name, decimals, and supply.',
    hints: [
      'Start with `confidential token YourName {`',
      'The 4 metadata fields are: symbol, name, decimals, supply',
      '`supply: N to deployer` mints N tokens to the deployer at deploy time',
    ],
    validator: {
      type: 'custom',
      fn: (source) => {
        const isConfidential = /confidential\s+token\s+\w+/i.test(source);
        const hasSymbol = /symbol\s*:\s*"[^"]+"/i.test(source);
        const hasName = /name\s*:\s*"[^"]+"/i.test(source);
        const hasDecimals = /decimals\s*:\s*\d+/i.test(source);
        const hasSupply = /supply\s*:\s*[\d_]+\s+to\s+deployer/i.test(source);
        if (isConfidential && hasSymbol && hasName && hasDecimals && hasSupply) {
          return { passed: true, message: '✓ Confidential token with full ERC-8227 surface!' };
        }
        const missing: string[] = [];
        if (!isConfidential) missing.push('`confidential token` keyword');
        if (!hasSymbol) missing.push('symbol field');
        if (!hasName) missing.push('name field');
        if (!hasDecimals) missing.push('decimals field');
        if (!hasSupply) missing.push('supply field with `to deployer`');
        return { passed: false, message: 'Missing: ' + missing.join(', ') };
      },
    },
    next: 'M2L3',
  },

  // ───────── M2L3 — Post-Quantum Signatures ─────────
  {
    id: 'M2L3',
    moduleId: 'M2',
    order: 3,
    title: 'Post-Quantum Signatures',
    description: 'Future-proof your contracts with Dilithium-5 verification',
    estimatedMinutes: 12,
    difficulty: 'intermediate',
    explanation: `## Why post-quantum?

Today's blockchain signatures (ECDSA) will be broken by quantum computers. When — not if — that happens, every smart contract that relied on \`ecrecover\` becomes vulnerable.

Covenant has **built-in** post-quantum signature verification via the \`pq_signed\` guard. No library imports. No precompile addresses. Just a guard clause.

\`\`\`covenant
board QuantumBoard {
    post {
        author: address
        content: hash
        at: time
    }

    field keys: map<address, pq_key>

    action register(pk: pq_key) {
        keys[caller] = pk
    }

    action submit(content: hash, sig: bytes)
            pq_signed(content, sig, keys[caller]) {
        append post {
            author: caller
            content: content
            at: now
        }
    }
}
\`\`\`

The \`pq_signed(content, sig, keys[caller])\` guard verifies a **Dilithium-5** signature inline. If the signature is invalid, the action reverts before the body runs.

## Your task

Add a \`pq_key\` registry field and a \`pq_signed\` guard to the submit action below.
`,
    codeStarter: `board SecureBoard {
    post {
        author: address
        content: hash
        at: time
    }

    -- TODO 1: field \`keys\` of type map<address, pq_key>

    action register(pk: pq_key) {
        -- TODO 2: store pk for caller
    }

    action submit(content: hash, sig: bytes)
            -- TODO 3: add pq_signed guard here
            {
        append post {
            author: caller
            content: content
            at: now
        }
    }
}
`,
    codeSolution: `board SecureBoard {
    post {
        author: address
        content: hash
        at: time
    }

    field keys: map<address, pq_key>

    action register(pk: pq_key) {
        keys[caller] = pk
    }

    action submit(content: hash, sig: bytes)
            pq_signed(content, sig, keys[caller]) {
        append post {
            author: caller
            content: content
            at: now
        }
    }
}
`,
    objective: 'Add a pq_key map, store keys on register, and add pq_signed guard to submit.',
    hints: [
      'Field declaration: `field keys: map<address, pq_key>`',
      'Store the key: `keys[caller] = pk`',
      'The guard goes after the signature, before the `{`: `pq_signed(content, sig, keys[caller])`',
    ],
    validator: {
      type: 'custom',
      fn: (source) => {
        const hasKeys = /field\s+keys\s*:\s*map\s*<\s*address\s*,\s*pq_key\s*>/i.test(source);
        const hasStore = /keys\s*\[\s*caller\s*\]\s*=\s*pk/i.test(source);
        const hasPqGuard =
          /pq_signed\s*\(\s*content\s*,\s*sig\s*,\s*keys\s*\[\s*caller\s*\]\s*\)/i.test(source);
        if (hasKeys && hasStore && hasPqGuard) {
          return { passed: true, message: '✓ Post-quantum authenticated board!' };
        }
        const missing: string[] = [];
        if (!hasKeys) missing.push('`field keys: map<address, pq_key>`');
        if (!hasStore) missing.push('`keys[caller] = pk` in register');
        if (!hasPqGuard) missing.push('`pq_signed(content, sig, keys[caller])` guard');
        return { passed: false, message: 'Missing: ' + missing.join(', ') };
      },
    },
    next: 'M2L4',
  },

  // ───────── M2L4 — Amnesia Ceremony ─────────
  {
    id: 'M2L4',
    moduleId: 'M2',
    order: 4,
    title: 'Amnesia Ceremony',
    description: 'Provably destroy keys forever — the ceremony lifecycle',
    estimatedMinutes: 10,
    difficulty: 'advanced',
    explanation: `## Cryptographic amnesia (ERC-8228)

This is Covenant's most unique feature. The \`ceremony\` construct lets you **provably destroy** cryptographic keys. Not "delete" — **destroy**, with a mathematical proof that reconstruction is impossible.

The lifecycle:
1. **Setup** — initialize the ceremony, generate session
2. **Active** — guardians submit their key shares (Shamir Secret Sharing)
3. **Finalized** — enough shares collected (threshold met)
4. **Destroyed** — irrevocable destruction proof emitted (Wesolowski VDF)

Once destroyed, **there is no recovery**. By design.

\`\`\`covenant
ceremony AmnesiaCeremony {
    guardians: 3
    threshold: 2

    on_destroy {
        destroy(0)
    }
}
\`\`\`

7 lines generate the entire ERC-8228 surface: \`setup()\`, \`submit_share()\`, \`finalize()\`, \`destroy()\`, \`phase()\`, \`is_destroyed()\`.

**V0.9 milestone**: this lifecycle now executes on real Sepolia via the helper-contract bridge. The M1 milestone deployment is the first ceremony destruction ever verified on Etherscan.

## Your task

Create a ceremony with 5 guardians, threshold 3, and an on_destroy hook.
`,
    codeStarter: `-- Create an amnesia ceremony
-- TODO: use the \`ceremony\` keyword with guardians, threshold, and on_destroy

`,
    codeSolution: `ceremony VaultDestruction {
    guardians: 5
    threshold: 3

    on_destroy {
        destroy(0)
    }
}
`,
    objective: 'Declare a `ceremony` with guardians: 5, threshold: 3, and on_destroy block.',
    hints: [
      'Start with `ceremony YourName {`',
      'Two metadata fields: `guardians: 5` and `threshold: 3`',
      'The on_destroy block calls `destroy(0)` to emit the destruction proof',
    ],
    validator: {
      type: 'custom',
      fn: (source) => {
        const hasCeremony = /ceremony\s+\w+/i.test(source);
        const hasGuardians = /guardians\s*:\s*5/i.test(source);
        const hasThreshold = /threshold\s*:\s*3/i.test(source);
        const hasOnDestroy = /on_destroy\s*\{[\s\S]*destroy\s*\(\s*0\s*\)/i.test(source);
        if (hasCeremony && hasGuardians && hasThreshold && hasOnDestroy) {
          return { passed: true, message: '✓ Ceremony with ERC-8228 lifecycle ready!' };
        }
        const missing: string[] = [];
        if (!hasCeremony) missing.push('`ceremony` keyword');
        if (!hasGuardians) missing.push('guardians: 5');
        if (!hasThreshold) missing.push('threshold: 3');
        if (!hasOnDestroy) missing.push('on_destroy block with destroy(0)');
        return { passed: false, message: 'Missing: ' + missing.join(', ') };
      },
    },
    next: 'M2L5',
  },

  // ───────── M2L5 — Private Voting ─────────
  {
    id: 'M2L5',
    moduleId: 'M2',
    order: 5,
    title: 'Private Voting',
    description: 'Encrypted vote tallies — nobody sees the count until the deadline',
    estimatedMinutes: 10,
    difficulty: 'intermediate',
    explanation: `## Private voting with encrypted counters

In Module 1, you built an \`OpenBallot\` where every vote is public. Real elections need secrecy — encrypted tallies that nobody can read during voting.

Combine \`encrypted counter\` with ballot-style guards:

\`\`\`covenant
encrypted counter PrivateVote {
    yes_votes: amount
    no_votes: amount

    action vote_yes() only first_time_caller {
        yes_votes += 1
    }

    action vote_no() only first_time_caller {
        no_votes += 1
    }

    reveal yes_votes to owner
    reveal no_votes to owner
}
\`\`\`

Each vote is an encrypted +1. Nobody can peek at the running total. After the vote closes, \`owner\` reveals results.

## Your task

Add an \`abstain_count\` field, a \`vote_abstain\` action, and reveal all three counts to \`deployer\`.
`,
    codeStarter: `encrypted counter SecretPoll {
    yes_count: amount
    no_count: amount
    -- TODO 1: add field \`abstain_count: amount\`

    action vote_yes() only first_time_caller {
        yes_count += 1
    }

    action vote_no() only first_time_caller {
        no_count += 1
    }

    -- TODO 2: add action \`vote_abstain\` with first_time_caller guard

    -- TODO 3: reveal all three counts to deployer
}
`,
    codeSolution: `encrypted counter SecretPoll {
    yes_count: amount
    no_count: amount
    abstain_count: amount

    action vote_yes() only first_time_caller {
        yes_count += 1
    }

    action vote_no() only first_time_caller {
        no_count += 1
    }

    action vote_abstain() only first_time_caller {
        abstain_count += 1
    }

    reveal yes_count to deployer
    reveal no_count to deployer
    reveal abstain_count to deployer
}
`,
    objective: 'Add abstain_count field, vote_abstain action, and reveal all three to deployer.',
    hints: [
      'New field: `abstain_count: amount` — same level as yes_count',
      'New action: `action vote_abstain() only first_time_caller { abstain_count += 1 }`',
      'Three reveal statements: one per count, each `to deployer`',
    ],
    validator: {
      type: 'custom',
      fn: (source) => {
        const hasAbstainField = /abstain_count\s*:\s*amount/i.test(source);
        const hasAbstainAction =
          /action\s+vote_abstain\s*\(\s*\)\s*(only\s+first_time_caller)?/i.test(source) &&
          /abstain_count\s*\+=\s*1/i.test(source);
        const reveals = (source.match(/reveal\s+\w+\s+to\s+deployer/gi) || []).length;
        if (hasAbstainField && hasAbstainAction && reveals >= 3) {
          return { passed: true, message: '✓ Private three-way vote with encrypted tallies!' };
        }
        const missing: string[] = [];
        if (!hasAbstainField) missing.push('`abstain_count: amount` field');
        if (!hasAbstainAction) missing.push('`vote_abstain` action');
        if (reveals < 3) missing.push(`3 reveal statements (found ${reveals})`);
        return { passed: false, message: 'Missing: ' + missing.join(', ') };
      },
    },
    next: 'M3L1',
  },
];
