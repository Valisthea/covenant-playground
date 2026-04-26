import { Lesson } from '../types';

// ─────────────────────────────────────────────────────────────────
// Module 3 — Advanced Patterns (Sprint 49 rewrite)
// 5 real lessons covering: ballot with deadlines, custom errors,
// escrow bridge, token auto-synthesis, hybrid privacy module.
// ─────────────────────────────────────────────────────────────────

export const M3_advanced: Lesson[] = [
  // ───────── M3L1 — Ballot with Deadline ─────────
  {
    id: 'M3L1',
    moduleId: 'M3',
    order: 1,
    title: 'Ballot with Deadline',
    description: 'A time-bounded public vote using the ballot construct',
    estimatedMinutes: 10,
    difficulty: 'advanced',
    explanation: `## The \`ballot\` construct

Covenant has a dedicated construct for voting: \`ballot\`. It auto-synthesizes \`tally\` (a map from choice to count), \`opened_at\` (deploy timestamp), and the \`Cast\` event.

Key idioms:
- \`options: [choice] = ["yes", "no", "abstain"]\` — the valid choices
- \`duration: duration = 7 days\` — how long the vote lasts
- \`when now < opened_at + duration\` — time guard (deadline check)
- \`only first_time_caller\` — one vote per address
- \`given pick in options\` — choice must be from the valid set
- \`tally[pick] += 1\` — increment the auto-synthesized tally
- \`tally.argmax\` — returns the choice with the highest count

## Your task

Add three guards to the \`cast\` action: deadline check, one-vote-per-address, and valid choice.
`,
    codeStarter: `ballot OpenBallot {
    options: [choice] = ["yes", "no", "abstain"]
    duration: duration = 7 days

    action cast(pick: choice)
            -- TODO: add 3 guards:
            -- 1. when now < opened_at + duration
            -- 2. only first_time_caller
            -- 3. given pick in options
            {
        tally[pick] += 1
        emit Cast(caller, pick)
    }

    reveal winner returns choice
            when now >= opened_at + duration {
        tally.argmax
    }
}
`,
    codeSolution: `ballot OpenBallot {
    options: [choice] = ["yes", "no", "abstain"]
    duration: duration = 7 days

    action cast(pick: choice)
            when now < opened_at + duration,
            only first_time_caller,
            given pick in options {
        tally[pick] += 1
        emit Cast(caller, pick)
    }

    reveal winner returns choice
            when now >= opened_at + duration {
        tally.argmax
    }
}
`,
    objective: 'Add the three guard clauses to the cast action.',
    hints: [
      'Guards go between the action signature and the opening `{`, comma-separated',
      'Time guard: `when now < opened_at + duration`',
      'All three on separate lines, each indented under the action signature',
    ],
    validator: {
      type: 'custom',
      fn: (source) => {
        const hasTimeGuard = /when\s+now\s*<\s*opened_at\s*\+\s*duration/i.test(source);
        const hasFirstTime = /only\s+first_time_caller/i.test(source);
        const hasGiven = /given\s+pick\s+in\s+options/i.test(source);
        if (hasTimeGuard && hasFirstTime && hasGiven) {
          return { passed: true, message: '✓ Time-bounded, one-vote, valid-choice ballot!' };
        }
        const missing: string[] = [];
        if (!hasTimeGuard) missing.push('`when now < opened_at + duration`');
        if (!hasFirstTime) missing.push('`only first_time_caller`');
        if (!hasGiven) missing.push('`given pick in options`');
        return { passed: false, message: 'Missing guards: ' + missing.join(', ') };
      },
    },
    next: 'M3L2',
  },

  // ───────── M3L2 — Custom Errors ─────────
  {
    id: 'M3L2',
    moduleId: 'M3',
    order: 2,
    title: 'Custom Errors',
    description: "Typed errors and revert_with — Covenant's error pattern",
    estimatedMinutes: 8,
    difficulty: 'advanced',
    explanation: `## Typed errors

Covenant errors are typed, like Solidity 0.8.4+ custom errors. The compiler generates ABI-compatible selectors.

\`\`\`covenant
error InsufficientBalance(required: amount, actual: amount)
error Unauthorized(caller: address)
error ZeroAmount()

revert_with InsufficientBalance(100, 50)
\`\`\`

When a \`when\` guard fails, the action reverts with a generic message. When you need specific error data, use \`revert_with\` in the action body.

## Your task

Add 2 error declarations and use a \`when\` guard to handle the withdraw case.
`,
    codeStarter: `module SafeVault {
    -- TODO 1: declare error InsufficientBalance(required: amount, actual: amount)
    -- TODO 2: declare error Unauthorized(caller: address)

    field balances: map<address, amount>
    field owner: address

    action initialize(who: address) {
        owner = who
    }

    action deposit(value: amount) {
        balances[caller] += value
    }

    action withdraw(value: amount) only owner {
        -- TODO 3: guard with \`when balances[caller] >= value\`
        balances[caller] -= value
    }

    view balance_of(who: address) returns amount {
        balances[who]
    }
}
`,
    codeSolution: `module SafeVault {
    error InsufficientBalance(required: amount, actual: amount)
    error Unauthorized(caller: address)

    field balances: map<address, amount>
    field owner: address

    action initialize(who: address) {
        owner = who
    }

    action deposit(value: amount) {
        balances[caller] += value
    }

    action withdraw(value: amount)
            only owner,
            when balances[caller] >= value {
        balances[caller] -= value
    }

    view balance_of(who: address) returns amount {
        balances[who]
    }
}
`,
    objective: 'Add error declarations and guard the withdraw action.',
    hints: [
      'Error syntax: `error ErrorName(field: type)` — same level as `field` and `action`',
      'You can use a `when` guard instead of in-body revert_with: `when balances[caller] >= value`',
      'The guard approach is more idiomatic Covenant',
    ],
    validator: {
      type: 'custom',
      fn: (source) => {
        const hasInsufficient = /error\s+InsufficientBalance\s*\(/i.test(source);
        const hasUnauthorized = /error\s+Unauthorized\s*\(/i.test(source);
        const hasGuardOrRevert =
          /when\s+balances\s*\[\s*caller\s*\]\s*>=\s*value/i.test(source) ||
          /revert_with\s+InsufficientBalance/i.test(source);
        if (hasInsufficient && hasUnauthorized && hasGuardOrRevert) {
          return { passed: true, message: '✓ Typed errors with safe withdrawal!' };
        }
        const missing: string[] = [];
        if (!hasInsufficient) missing.push('error InsufficientBalance declaration');
        if (!hasUnauthorized) missing.push('error Unauthorized declaration');
        if (!hasGuardOrRevert) missing.push('guard or revert_with for insufficient balance');
        return { passed: false, message: 'Missing: ' + missing.join(', ') };
      },
    },
    next: 'M3L3',
  },

  // ───────── M3L3 — Cross-Chain Escrow ─────────
  {
    id: 'M3L3',
    moduleId: 'M3',
    order: 3,
    title: 'Cross-Chain Escrow',
    description: 'Lock-and-release pattern using module + events',
    estimatedMinutes: 10,
    difficulty: 'advanced',
    explanation: `## The escrow pattern

A cross-chain bridge locks assets on one chain and releases on another. In Covenant, this is a \`module\` with a map of deposits, lock/unlock actions, and events for watchers.

Key pattern:
- \`field deposits: map<address, amount>\` — tracks per-user locked value
- \`when deposits[caller] >= value\` — can't unlock more than locked
- Events (\`Locked\`, \`Unlocked\`) trigger off-chain watchers

## Your task

Complete the unlock action with a balance guard and event emission.
`,
    codeStarter: `module Escrow {
    field deposits: map<address, amount>
    field locked_total: amount

    event Locked(who: address, value: amount)
    event Unlocked(who: address, value: amount)

    action lock(value: amount) {
        deposits[caller] += value
        locked_total += value
        emit Locked(caller, value)
    }

    action unlock(value: amount)
            -- TODO: add guard: when deposits[caller] >= value
            {
        deposits[caller] -= value
        locked_total -= value
        -- TODO: emit Unlocked event
    }

    view total_locked returns amount {
        locked_total
    }
}
`,
    codeSolution: `module Escrow {
    field deposits: map<address, amount>
    field locked_total: amount

    event Locked(who: address, value: amount)
    event Unlocked(who: address, value: amount)

    action lock(value: amount) {
        deposits[caller] += value
        locked_total += value
        emit Locked(caller, value)
    }

    action unlock(value: amount)
            when deposits[caller] >= value {
        deposits[caller] -= value
        locked_total -= value
        emit Unlocked(caller, value)
    }

    view total_locked returns amount {
        locked_total
    }
}
`,
    objective: 'Add the when guard and emit Unlocked in the unlock action.',
    hints: [
      'Guard: `when deposits[caller] >= value` — goes between signature and `{`',
      'Event: `emit Unlocked(caller, value)` — same syntax as Locked',
    ],
    validator: {
      type: 'custom',
      fn: (source) => {
        const hasGuard = /when\s+deposits\s*\[\s*caller\s*\]\s*>=\s*value/i.test(source);
        const hasEmit = /emit\s+Unlocked\s*\(\s*caller\s*,\s*value\s*\)/i.test(source);
        if (hasGuard && hasEmit) {
          return { passed: true, message: '✓ Escrow with balance guard and event!' };
        }
        const missing: string[] = [];
        if (!hasGuard) missing.push('`when deposits[caller] >= value` guard');
        if (!hasEmit) missing.push('`emit Unlocked(caller, value)`');
        return { passed: false, message: 'Missing: ' + missing.join(', ') };
      },
    },
    next: 'M3L4',
  },

  // ───────── M3L4 — Token from Scratch ─────────
  {
    id: 'M3L4',
    moduleId: 'M3',
    order: 4,
    title: 'Token in 5 Lines',
    description: 'The power of auto-synthesis — a complete ERC-20 in one breath',
    estimatedMinutes: 5,
    difficulty: 'advanced',
    explanation: `## The \`token\` construct

You've been writing \`record\` and \`module\` — explicit contracts where you declare everything. The \`token\` construct is different: you write **only metadata**, and the compiler generates the entire ERC-20 surface.

\`\`\`covenant
token Coin {
    symbol: "COIN"
    name: "Covenant Coin"
    decimals: 18
    supply: 1_000_000 to deployer
}
\`\`\`

Auto-synthesized: \`transfer\`, \`approve\`, \`transfer_from\`, \`balance_of\`, \`allowance\`, \`Transfer\` event, \`Approval\` event. Full ABI-compatible with any ERC-20 frontend.

To **customize**, add an action after the metadata — the synthesizer honors your override.

## Your task

Create a token with your chosen branding. The supply should mint to the deployer.
`,
    codeStarter: `-- Create a standard ERC-20 token
-- Hint: \`token\` keyword, not \`record\` or \`module\`

-- TODO: declare a token with symbol, name, decimals, and supply

`,
    codeSolution: `token GameGold {
    symbol: "GOLD"
    name: "Game Gold"
    decimals: 18
    supply: 10_000_000 to deployer
}
`,
    objective: 'Declare a `token` with all 4 metadata fields.',
    hints: [
      'Start with `token YourName {`',
      'Four fields: symbol (string), name (string), decimals (number), supply (number to deployer)',
      '`supply: 10_000_000 to deployer` — the `to deployer` part mints at deploy time',
    ],
    validator: {
      type: 'custom',
      fn: (source) => {
        const hasToken = /^token\s+\w+/im.test(source);
        const hasAll =
          /symbol\s*:/i.test(source) &&
          /name\s*:/i.test(source) &&
          /decimals\s*:/i.test(source) &&
          /supply\s*:.*to\s+deployer/i.test(source);
        if (hasToken && hasAll) {
          return { passed: true, message: '✓ Full ERC-20 token from 5 lines of metadata!' };
        }
        return {
          passed: false,
          message:
            'Need `token Name { symbol, name, decimals, supply to deployer }` — all 4 fields',
        };
      },
    },
    next: 'M3L5',
  },

  // ───────── M3L5 — Hybrid Privacy ─────────
  {
    id: 'M3L5',
    moduleId: 'M3',
    order: 5,
    title: 'Hybrid Privacy',
    description: 'Mix public and encrypted fields in one contract',
    estimatedMinutes: 10,
    difficulty: 'advanced',
    explanation: `## \`hybrid module\`

Sometimes you need **some** fields public and **some** encrypted. A \`hybrid module\` allows per-field privacy qualifiers.

\`\`\`covenant
hybrid module Treasury {
    field headcount: amount              -- public
    field encrypted budget: amount       -- encrypted
    field encrypted salary_pool: amount  -- encrypted

    action hire() {
        headcount += 1
    }

    reveal budget to deployer
}
\`\`\`

## Your task

Create a hybrid module with 2 public fields and 1 encrypted field.
`,
    codeStarter: `hybrid module ProjectFund {
    -- TODO 1: field \`contributors: amount\` (public)
    -- TODO 2: field \`milestone: text\` (public)
    -- TODO 3: field encrypted \`treasury: amount\` (encrypted)

    action add_contributor() {
        contributors += 1
    }

    -- TODO 4: reveal treasury to deployer
}
`,
    codeSolution: `hybrid module ProjectFund {
    field contributors: amount
    field milestone: text
    field encrypted treasury: amount

    action add_contributor() {
        contributors += 1
    }

    reveal treasury to deployer
}
`,
    objective: 'Declare 2 public fields, 1 encrypted field, and reveal to deployer.',
    hints: [
      'Public field: `field name: type` — no qualifier',
      'Encrypted field: `field encrypted name: type` — `encrypted` goes before the name',
      'Reveal: `reveal treasury to deployer`',
    ],
    validator: {
      type: 'custom',
      fn: (source) => {
        const hasHybrid = /hybrid\s+module/i.test(source);
        const hasEncrypted = /field\s+encrypted\s+\w+/i.test(source);
        const hasPublic = (source.match(/field\s+\w+\s*:\s*\w+/gi) || []).length >= 2;
        const hasReveal = /reveal\s+\w+\s+to\s+deployer/i.test(source);
        if (hasHybrid && hasEncrypted && hasPublic && hasReveal) {
          return { passed: true, message: '✓ Hybrid module with mixed privacy!' };
        }
        const missing: string[] = [];
        if (!hasHybrid) missing.push('`hybrid module` keyword');
        if (!hasEncrypted) missing.push('at least 1 `field encrypted` declaration');
        if (!hasPublic) missing.push('at least 2 public field declarations');
        if (!hasReveal) missing.push('`reveal ... to deployer`');
        return { passed: false, message: 'Missing: ' + missing.join(', ') };
      },
    },
    next: 'M4L1',
  },
];
