import { Lesson } from '../types';

// ─────────────────────────────────────────────────────────────────
// Module 4 — V0.9 Features (Sprint 49 — NEW module)
// 5 lessons covering the V0.9 additions:
//   M4L1 — nft (ERC-721 auto-synthesis)
//   M4L2 — registry (ERC-8231 PQ key registry)
//   M4L3 — interface + call_interface (typed cross-contract calls)
//   M4L4 — covenant test (Foundry-class testing)
//   M4L5 — Deploy to Sepolia (graduation)
// ─────────────────────────────────────────────────────────────────

export const M4_v09: Lesson[] = [
  // ───────── M4L1 — NFT in 5 Lines ─────────
  {
    id: 'M4L1',
    moduleId: 'M4',
    order: 1,
    title: 'NFT Collection',
    description: 'Create an ERC-721 NFT collection — the V0.9 way',
    estimatedMinutes: 5,
    difficulty: 'beginner',
    explanation: `## The \`nft\` construct (V0.9)

Just like \`token\` auto-generates ERC-20, the new \`nft\` keyword auto-generates **ERC-721** — the NFT standard. 11 functions synthesized from 3 metadata fields.

\`\`\`covenant
nft CoolApes {
    name: "Cool Apes"
    symbol: "APE"
    base_uri: "https://api.example.com/metadata/"
}
\`\`\`

Auto-synthesized: \`mint\`, \`transfer\`, \`approve\`, \`set_approval_for_all\`, \`owner_of\`, \`balance_of\`, \`token_uri\`, \`get_approved\`, \`is_approved_for_all\`, \`Transfer\` event, \`Approval\` event, \`ApprovalForAll\` event.

## Your task

Create your own NFT collection.
`,
    codeStarter: `-- Create an NFT collection using the \`nft\` keyword
-- TODO: fill in name, symbol, and base_uri

`,
    codeSolution: `nft PixelPunks {
    name: "Pixel Punks"
    symbol: "PXPK"
    base_uri: "https://api.pixelpunks.io/token/"
}
`,
    objective: 'Declare an `nft` with name, symbol, and base_uri.',
    hints: [
      'Start with `nft YourName {`',
      'Three metadata fields: name (string), symbol (string), base_uri (string)',
      'base_uri is the URL prefix for token metadata (ends with `/`)',
    ],
    validator: {
      type: 'custom',
      fn: (source) => {
        const hasNft = /^nft\s+\w+/im.test(source);
        const hasName = /name\s*:\s*"[^"]+"/i.test(source);
        const hasSymbol = /symbol\s*:\s*"[^"]+"/i.test(source);
        const hasUri = /base_uri\s*:\s*"[^"]+"/i.test(source);
        if (hasNft && hasName && hasSymbol && hasUri) {
          return { passed: true, message: '✓ Full ERC-721 NFT from 5 lines!' };
        }
        const missing: string[] = [];
        if (!hasNft) missing.push('`nft` keyword');
        if (!hasName) missing.push('name field');
        if (!hasSymbol) missing.push('symbol field');
        if (!hasUri) missing.push('base_uri field');
        return { passed: false, message: 'Missing: ' + missing.join(', ') };
      },
    },
    next: 'M4L2',
  },

  // ───────── M4L2 — PQ Key Registry ─────────
  {
    id: 'M4L2',
    moduleId: 'M4',
    order: 2,
    title: 'PQ Key Registry',
    description: 'ERC-8231 auto-synthesis — quantum-resistant key management in 1 line',
    estimatedMinutes: 5,
    difficulty: 'beginner',
    explanation: `## The \`registry\` construct (V0.9)

When quantum computers break ECDSA, you need a migration path. The \`registry\` construct auto-generates the entire ERC-8231 surface: \`register\`, \`update_key\`, \`revoke\`, \`key_of\`, \`is_registered\`.

\`\`\`covenant
registry KeyDirectory {
    -- That's it. Entire ERC-8231 auto-generated.
}
\`\`\`

Users call \`register(pk)\` with their Dilithium-5 public key. Later they can \`update_key(new_pk, sig)\` (signed by old key) or \`revoke()\`.

This is the **migration path** from ECDSA to post-quantum. When (not if) quantum computers break current signatures, accounts that registered PQ keys are protected.

## Your task

Create a registry. Yes, it's that simple.
`,
    codeStarter: `-- Create a post-quantum key registry
-- Hint: the keyword is \`registry\`
-- The body can be empty — everything is auto-generated

`,
    codeSolution: `registry IdentityVault {
}
`,
    objective: 'Declare a `registry` construct.',
    hints: [
      'Just `registry YourName { }` — the body can be empty',
      'The compiler auto-generates register, update_key, revoke, key_of, is_registered',
      'The simplest construct in Covenant — 2 lines for a complete ERC-8231',
    ],
    validator: {
      type: 'custom',
      fn: (source) => {
        if (/^registry\s+\w+/im.test(source)) {
          return { passed: true, message: '✓ ERC-8231 post-quantum registry — 2 lines!' };
        }
        return { passed: false, message: 'Use the `registry` keyword to declare a key registry' };
      },
    },
    next: 'M4L3',
  },

  // ───────── M4L3 — Cross-Contract Calls ─────────
  {
    id: 'M4L3',
    moduleId: 'M4',
    order: 3,
    title: 'Cross-Contract Calls',
    description: 'Call another contract via typed interface declaration',
    estimatedMinutes: 12,
    difficulty: 'intermediate',
    explanation: `## The \`interface\` construct (V0.9)

In V0.8, each contract was isolated — it couldn't call other contracts. V0.9 introduces \`interface\`: a typed declaration of another contract's surface.

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

Key concepts:
- \`interface\` declares signatures only — no implementations
- \`call_interface(addr, IFaceName)\` creates a typed handle
- Method calls on the handle (\`iface.transfer(...)\`) compile to real EVM CALL opcodes
- Views compile to STATICCALL (gas-free)
- Default reentrancy protection on all external calls

## Your task

Declare an interface for a token and write a module that calls it.
`,
    codeStarter: `-- TODO 1: declare interface IToken with:
--   action transfer(to: address, value: amount) returns bool
--   view balance_of(who: address) returns amount

module Treasury {
    field token_addr: address
    field admin: address

    action initialize(token: address, who: address) {
        token_addr = token
        admin = who
    }

    action send_tokens(to: address, value: amount) only admin {
        -- TODO 2: create interface handle with call_interface
        -- TODO 3: call transfer on the handle
    }
}
`,
    codeSolution: `interface IToken {
    action transfer(to: address, value: amount) returns bool
    view balance_of(who: address) returns amount
}

module Treasury {
    field token_addr: address
    field admin: address

    action initialize(token: address, who: address) {
        token_addr = token
        admin = who
    }

    action send_tokens(to: address, value: amount) only admin {
        let iface = call_interface(token_addr, IToken)
        iface.transfer(to, value)
    }
}
`,
    objective: 'Declare an interface and use call_interface to call it.',
    hints: [
      'Interface syntax: `interface IToken { action transfer(...) returns bool ... }`',
      'Create handle: `let iface = call_interface(token_addr, IToken)`',
      'Call method: `iface.transfer(to, value)` — just like a method call',
    ],
    validator: {
      type: 'custom',
      fn: (source) => {
        const hasInterface = /^interface\s+\w+/im.test(source);
        const hasCallInterface = /call_interface\s*\(/i.test(source);
        const hasMethodCall = /\w+\.transfer\s*\(/i.test(source);
        if (hasInterface && hasCallInterface && hasMethodCall) {
          return { passed: true, message: '✓ Cross-contract call via typed interface!' };
        }
        const missing: string[] = [];
        if (!hasInterface) missing.push('`interface` declaration');
        if (!hasCallInterface) missing.push('`call_interface(addr, IFace)` expression');
        if (!hasMethodCall)
          missing.push('method call on interface handle (e.g. `iface.transfer(...)`)');
        return { passed: false, message: 'Missing: ' + missing.join(', ') };
      },
    },
    next: 'M4L4',
  },

  // ───────── M4L4 — Testing Your Contract ─────────
  {
    id: 'M4L4',
    moduleId: 'M4',
    order: 4,
    title: 'Testing Your Contract',
    description: 'Write a .test.cov file with assert and assert_reverts',
    estimatedMinutes: 10,
    difficulty: 'intermediate',
    explanation: `## \`covenant test\` (V0.9 CLI)

Covenant V0.9 ships a Foundry-class test runner. You write tests in \`.test.cov\` files.

\`\`\`covenant
test "deposit increases balance" {
    let (chain, alice, bob) = setup()
    let vault = chain.deploy(SimpleVault)

    chain.call(vault, alice, "deposit(uint256)", [100])
    assert chain.balance_of(vault, alice) == 100
}

test "withdraw reverts on insufficient balance" {
    let (chain, alice, _) = setup()
    let vault = chain.deploy(SimpleVault)

    assert_reverts {
        chain.call(vault, alice, "withdraw(uint256)", [999])
    }
}
\`\`\`

Key patterns:
- \`test "name" { ... }\` — declares a test case
- \`setup()\` — creates a test chain + funded accounts
- \`chain.deploy(Contract)\` — deploys
- \`chain.call(contract, sender, sig, args)\` — calls action
- \`assert expr\` — assertion
- \`assert_reverts { ... }\` — expect a revert

## Your task

Write 2 tests for a simple counter contract.
`,
    codeStarter: `-- Tests for a counter contract
-- The counter has: action increment(), view get_count() returns amount

-- TODO 1: test that increment increases count to 1

-- TODO 2: test that two increments give count = 2

`,
    codeSolution: `test "increment sets count to 1" {
    let (chain, alice, _) = setup()
    let counter = chain.deploy(Counter)

    chain.call(counter, alice, "increment()", [])
    assert chain.view(counter, "get_count()") == 1
}

test "two increments give count 2" {
    let (chain, alice, _) = setup()
    let counter = chain.deploy(Counter)

    chain.call(counter, alice, "increment()", [])
    chain.call(counter, alice, "increment()", [])
    assert chain.view(counter, "get_count()") == 2
}
`,
    objective: 'Write 2 test blocks with assert statements.',
    hints: [
      'Each test starts with `test "description" { ... }`',
      'Call `setup()` to get a chain + accounts',
      '`assert <expression>` checks a condition — test fails if false',
    ],
    validator: {
      type: 'custom',
      fn: (source) => {
        const testCount = (source.match(/^test\s+"/gm) || []).length;
        const assertCount = (source.match(/\bassert\b/g) || []).length;
        if (testCount >= 2 && assertCount >= 2) {
          return { passed: true, message: `✓ ${testCount} tests with ${assertCount} assertions!` };
        }
        return {
          passed: false,
          message: `Need 2+ test blocks (found ${testCount}) with 2+ asserts (found ${assertCount})`,
        };
      },
    },
    next: 'M4L5',
  },

  // ───────── M4L5 — Deploy to Sepolia ─────────
  {
    id: 'M4L5',
    moduleId: 'M4',
    order: 5,
    title: 'Deploy to Sepolia',
    description: 'Your first real-network deployment — a ceremony on Sepolia',
    estimatedMinutes: 15,
    difficulty: 'advanced',
    explanation: `## Real deployment

You've been deploying to MockChain — an in-tab simulator. Now you'll deploy to **Sepolia**, a real Ethereum testnet.

### What changes:
- You need **MetaMask** connected with Sepolia ETH
- Transactions take **~30 seconds** instead of being instant
- Your contract gets a **real Etherscan address**
- The state is **permanent** (until the next testnet reset)

### V0.9 milestone

In V0.9, cryptographic primitives work on Sepolia for real. The ceremony lifecycle (setup → finalize → destroy) executes via the helper-contract bridge, not mocks.

### Instructions

1. Switch the Chain Target selector to **Sepolia**
2. Connect MetaMask (install if needed + get Sepolia ETH from a faucet)
3. Compile the ceremony below
4. Click Deploy → confirm in MetaMask
5. Wait ~30 seconds → Etherscan link appears
6. Call \`setup()\` → confirm in MetaMask
7. Your ceremony is now live on a real network

## Your task

Write a ceremony and deploy it. This lesson validates when you have a working ceremony source.
`,
    codeStarter: `-- Your graduation ceremony (literally)
-- Write a ceremony, compile it, deploy it to Sepolia

-- TODO: create a ceremony with guardians: 3, threshold: 2, and on_destroy

`,
    codeSolution: `ceremony Graduation {
    guardians: 3
    threshold: 2

    on_destroy {
        destroy(0)
    }
}
`,
    objective:
      'Write a ceremony and deploy it (MockChain is fine for validation; Sepolia is the stretch goal).',
    hints: [
      '`ceremony Name { guardians: N threshold: M on_destroy { destroy(0) } }`',
      'To deploy on Sepolia: switch target, connect MetaMask, click Deploy',
      "Don't have Sepolia ETH? Deploy on MockChain first — this lesson validates the source, not the deploy target",
    ],
    validator: {
      type: 'custom',
      fn: (source) => {
        const hasCeremony = /ceremony\s+\w+/i.test(source);
        const hasGuardians = /guardians\s*:\s*\d+/i.test(source);
        const hasThreshold = /threshold\s*:\s*\d+/i.test(source);
        const hasOnDestroy = /on_destroy\s*\{[\s\S]*destroy/i.test(source);
        if (hasCeremony && hasGuardians && hasThreshold && hasOnDestroy) {
          return {
            passed: true,
            message:
              "🎓 Congratulations! You've completed the Covenant Tour. Deploy this to Sepolia to make it permanent.",
          };
        }
        return {
          passed: false,
          message: 'Need a complete ceremony with guardians, threshold, and on_destroy',
        };
      },
    },
    next: null,
  },
];
