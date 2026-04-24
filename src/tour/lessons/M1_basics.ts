import { Lesson } from '../types';

export const M1_basics: Lesson[] = [
  // ─────────────────────────── M1L1 · Hello Covenant ───────────────────────────
  {
    id: 'M1L1',
    moduleId: 'M1',
    order: 1,
    title: 'Hello Covenant',
    description: 'Your first Covenant contract',
    estimatedMinutes: 5,
    difficulty: 'beginner',

    explanation: `
## Welcome to Covenant!

Covenant is a smart contract language where **cryptographic guarantees become language primitives**. Unlike Solidity, features like encryption, zero-knowledge proofs, and key destruction are built into the syntax — not bolted on as libraries.

Your first contract stores a greeting on-chain that anyone can read, and that the contract creator can update.

## Key syntax

| Keyword | Purpose |
|---|---|
| \`record\` | Declares a contract |
| \`field\` | Persistent on-chain storage |
| \`action\` | A function that modifies state (costs gas) |
| \`view\` | A read-only query (free, no transaction) |
| \`only deployer\` | Guard: only the creator can call this |

## The pattern

\`\`\`covenant
record MyContract {
    field some_data: text = "default"

    action update_data(new_value: text) only deployer {
        some_data = new_value
    }

    view read_data() returns text {
        some_data
    }
}
\`\`\`

Notice: no \`function\` keyword, no \`public\`/\`external\` modifiers. Covenant infers what it needs. Now write yours.
`,

    codeStarter: `-- Your first Covenant contract
-- 🎯 Goal: add an update action so this contract compiles and works

record HelloCovenant {
    field greeting: text = "Hello, Covenant!"

    -- TODO: add action \`update\` that:
    --   • accepts param  new_greeting: text
    --   • restricts to deployer only
    --   • sets greeting = new_greeting

    view read() returns text {
        greeting
    }
}
`,

    codeSolution: `record HelloCovenant {
    field greeting: text = "Hello, Covenant!"

    action update(new_greeting: text) only deployer {
        greeting = new_greeting
    }

    view read() returns text {
        greeting
    }
}
`,

    objective: 'Add an action named `update` that accepts `new_greeting: text`, is restricted to the deployer, and assigns `greeting = new_greeting`.',

    hints: [
      'Action syntax: `action name(param: type) { ... }`',
      'To restrict: `action name(param: type) only deployer { ... }`',
      'Inside the body: `greeting = new_greeting`',
    ],

    validator: {
      type: 'custom',
      fn: (source) => {
        // Flexible: allow extra whitespace, any casing for keywords
        const hasAction = /action\s+update\s*\(\s*new_greeting\s*:\s*text\s*\)/i.test(source);
        const hasOnlyDeployer = /only\s+deployer/i.test(source);
        const hasAssignment = /greeting\s*=\s*new_greeting/i.test(source);

        if (hasAction && hasOnlyDeployer && hasAssignment) {
          return { passed: true, message: '✓ Contract complete! The greeting can now be updated securely.' };
        }

        const missing: string[] = [];
        if (!hasAction) missing.push('`action update(new_greeting: text)`');
        if (!hasOnlyDeployer) missing.push('`only deployer` guard');
        if (!hasAssignment) missing.push('`greeting = new_greeting` assignment');

        return {
          passed: false,
          message: 'Not quite — a few things are missing.',
          details: 'Missing: ' + missing.join(', '),
        };
      },
    },

    next: 'M1L2',
  },

  // ─────────────────────────── M1L2 · Fields and Storage ───────────────────────
  {
    id: 'M1L2',
    moduleId: 'M1',
    order: 2,
    title: 'Fields and Storage',
    description: 'Learn how to declare persistent on-chain data',
    estimatedMinutes: 7,
    difficulty: 'beginner',

    explanation: `
## Fields and Storage

In Covenant, **fields** are the persistent variables stored on-chain. Every field lives in the contract's storage; every transaction that changes a field writes to the blockchain.

## Declaring fields

\`\`\`covenant
field count:         amount  = 0         -- with default
field last_caller:   address             -- no default (zero value)
field active:        bool    = true
field label:         text    = "unnamed"
\`\`\`

## Core types at a glance

| Type | Description |
|---|---|
| \`text\` | UTF-8 string |
| \`amount\` | Non-negative integer (like uint256) |
| \`address\` | 20-byte wallet or contract address |
| \`bool\` | true / false |
| \`time\` | Unix timestamp (seconds) |
| \`map<K, V>\` | On-chain key → value mapping |

## Special values

- \`deployer\` — the address that deployed the contract (available at declaration time)
- \`caller\` — the address currently calling an action
- \`now\` — current block timestamp

Fields without a default are initialized to the type's zero value (\`0\`, \`""\`, zero-address, etc.).
`,

    codeStarter: `-- A simple counter contract
-- 🎯 Goal: declare the 3 fields the action and view already reference

record Counter {
    -- TODO 1: field \`count\` of type \`amount\`, default 0
    -- TODO 2: field \`last_updater\` of type \`address\` (no default)
    -- TODO 3: field \`total_updates\` of type \`amount\`, default 0

    action increment() {
        count = count + 1
        total_updates = total_updates + 1
        last_updater = caller
    }

    view state() returns (amount, address, amount) {
        (count, last_updater, total_updates)
    }
}
`,

    codeSolution: `record Counter {
    field count: amount = 0
    field last_updater: address
    field total_updates: amount = 0

    action increment() {
        count = count + 1
        total_updates = total_updates + 1
        last_updater = caller
    }

    view state() returns (amount, address, amount) {
        (count, last_updater, total_updates)
    }
}
`,

    objective: 'Declare `count: amount = 0`, `last_updater: address`, and `total_updates: amount = 0`.',

    hints: [
      'Syntax: `field name: type = default_value`',
      'No default needed? Write: `field name: type`',
      'Three fields total — one per TODO comment',
    ],

    validator: {
      type: 'custom',
      fn: (source) => {
        const hasCount = /field\s+count\s*:\s*amount\s*=\s*0/i.test(source);
        const hasLastUpdater = /field\s+last_updater\s*:\s*address/i.test(source);
        const hasTotalUpdates = /field\s+total_updates\s*:\s*amount\s*=\s*0/i.test(source);

        if (hasCount && hasLastUpdater && hasTotalUpdates) {
          return { passed: true, message: '✓ All 3 fields declared correctly! The counter is ready.' };
        }

        const missing: string[] = [];
        if (!hasCount) missing.push('`count: amount = 0`');
        if (!hasLastUpdater) missing.push('`last_updater: address`');
        if (!hasTotalUpdates) missing.push('`total_updates: amount = 0`');

        return {
          passed: false,
          message: `${[hasCount, hasLastUpdater, hasTotalUpdates].filter(Boolean).length}/3 fields correct`,
          details: 'Missing: ' + missing.join(', '),
        };
      },
    },

    next: 'M1L3',
  },

  // ─────────────────────────── M1L3 · Actions and Views ────────────────────────
  {
    id: 'M1L3',
    moduleId: 'M1',
    order: 3,
    title: 'Actions and Views',
    description: 'Understand the difference between state changes and queries',
    estimatedMinutes: 8,
    difficulty: 'beginner',

    explanation: `
## Actions vs Views — why it matters

**Actions** change the contract's state. They must be submitted as transactions, cost gas, and execute serially.

**Views** read state without changing it. They're free, can run in parallel, and cannot accidentally modify anything.

\`\`\`covenant
-- Action: modifies state, costs gas
action deposit(value: amount) {
    balance = balance + value
}

-- View: reads state, free
view get_balance() returns amount {
    balance
}
\`\`\`

## The big picture difference from Solidity

In Solidity, you write \`public\`, \`external\`, \`pure\`, \`view\` — four modifiers that partially overlap and confuse. In Covenant it's binary: **action** (writes) or **view** (reads). The compiler enforces this; views physically cannot write.

## Map access

Maps are declared as \`map<KeyType, ValueType>\` and accessed with bracket syntax:

\`\`\`covenant
field balances: map<address, amount>

-- In action:
balances[caller] = balances[caller] + value

-- In view:
view balance_of(who: address) returns amount {
    balances[who]
}
\`\`\`

Notice: the last expression in a view **is** the return value — no \`return\` keyword.
`,

    codeStarter: `record SimpleVault {
    field deposits: map<address, amount>
    field total_deposited: amount = 0

    -- TODO 1: action \`deposit(value: amount)\` that:
    --   • adds value to deposits[caller]
    --   • adds value to total_deposited

    -- TODO 2: view \`balance_of(who: address) returns amount\`
    --   • returns deposits[who]

    -- TODO 3: view \`get_total() returns amount\`
    --   • returns total_deposited
}
`,

    codeSolution: `record SimpleVault {
    field deposits: map<address, amount>
    field total_deposited: amount = 0

    action deposit(value: amount) {
        deposits[caller] = deposits[caller] + value
        total_deposited = total_deposited + value
    }

    view balance_of(who: address) returns amount {
        deposits[who]
    }

    view get_total() returns amount {
        total_deposited
    }
}
`,

    objective: 'Implement action `deposit` and views `balance_of` + `get_total`.',

    hints: [
      'Map assignment: `deposits[caller] = deposits[caller] + value`',
      'View return: last expression is the return value, no `return` keyword',
      'Two views needed: one with a parameter, one without',
    ],

    validator: {
      type: 'custom',
      fn: (source) => {
        const hasDeposit =
          /action\s+deposit\s*\(\s*value\s*:\s*amount\s*\)/i.test(source) &&
          /deposits\s*\[\s*caller\s*\]/i.test(source);
        const hasBalanceOf = /view\s+balance_of\s*\(\s*who\s*:\s*address\s*\)\s*returns\s+amount/i.test(source);
        const hasGetTotal = /view\s+get_total\s*\(\s*\)\s*returns\s+amount/i.test(source);

        if (hasDeposit && hasBalanceOf && hasGetTotal) {
          return { passed: true, message: '✓ Action and both views implemented correctly!' };
        }

        const missing: string[] = [];
        if (!hasDeposit) missing.push('`action deposit` (with deposits[caller] update)');
        if (!hasBalanceOf) missing.push('`view balance_of(who: address)`');
        if (!hasGetTotal) missing.push('`view get_total()`');

        return {
          passed: false,
          message: 'Implementation incomplete',
          details: 'Missing: ' + missing.join(', '),
        };
      },
    },

    next: 'M1L4',
  },

  // ─────────────────────────── M1L4 · Primitive Types ──────────────────────────
  {
    id: 'M1L4',
    moduleId: 'M1',
    order: 4,
    title: 'Primitive Types',
    description: 'Master the core types of Covenant',
    estimatedMinutes: 6,
    difficulty: 'beginner',

    explanation: `
## Covenant's type system

Covenant's types are designed for the realities of smart contracts: big numbers, identity, time, and cryptography.

## Numeric types

| Type | Range | Use case |
|---|---|---|
| \`amount\` | 0 → 2²⁵⁶−1 | Token balances, prices |
| \`u256\` / \`u128\` / \`u64\` / \`u32\` / \`u8\` | Fixed bit-width | Fees, counters, flags |
| \`i256\` / \`i128\` | Signed | Deltas, signed math |

## Identity types

| Type | Size | Use case |
|---|---|---|
| \`address\` | 20 bytes | Wallet / contract address |
| \`hash\` | 32 bytes | Keccak-256 digest |
| \`bytes\` | Variable | Arbitrary binary |

## Other primitives

- \`bool\` — true or false
- \`text\` — UTF-8 string
- \`time\` — Unix timestamp (seconds)
- \`duration\` — time delta in seconds

## Why \`u8\` for decimals?

ERC-20 tokens always have a \`decimals\` field between 0 and 255. \`u8\` (8-bit unsigned) captures that exactly and signals intent to readers. Using \`amount\` would waste space and hide meaning.

Covenant's type system encodes semantics, not just storage size.
`,

    codeStarter: `-- Token metadata contract
-- 🎯 Goal: add 5 fields with correct types

record TokenInfo {
    -- TODO 1: \`name\`           — a string like "My Token"
    -- TODO 2: \`symbol\`         — a short string like "MTK"
    -- TODO 3: \`decimals\`       — a number 0-255 (use the smallest fitting type)
    -- TODO 4: \`total_supply\`   — a very large non-negative integer
    -- TODO 5: \`creator\`        — the contract deployer's address

    view metadata() returns (text, text, u8, amount, address) {
        (name, symbol, decimals, total_supply, creator)
    }
}
`,

    codeSolution: `record TokenInfo {
    field name: text = "My Token"
    field symbol: text = "MTK"
    field decimals: u8 = 18
    field total_supply: amount = 1_000_000
    field creator: address = deployer

    view metadata() returns (text, text, u8, amount, address) {
        (name, symbol, decimals, total_supply, creator)
    }
}
`,

    objective: 'Declare 5 fields with precisely correct types: `text`, `text`, `u8`, `amount`, `address`.',

    hints: [
      '`name` and `symbol` are strings → `text`',
      '`decimals` fits in 0-255 → `u8` (not `amount`)',
      '`total_supply` is a huge number → `amount`',
      '`creator` is a wallet address → `address`; initialize with `deployer`',
    ],

    validator: {
      type: 'custom',
      fn: (source) => {
        const checks = [
          { label: 'name: text', ok: /field\s+name\s*:\s*text/i.test(source) },
          { label: 'symbol: text', ok: /field\s+symbol\s*:\s*text/i.test(source) },
          { label: 'decimals: u8', ok: /field\s+decimals\s*:\s*u8/i.test(source) },
          { label: 'total_supply: amount', ok: /field\s+total_supply\s*:\s*amount/i.test(source) },
          { label: 'creator: address', ok: /field\s+creator\s*:\s*address/i.test(source) },
        ];
        const passing = checks.filter((c) => c.ok);
        if (passing.length === 5) {
          return { passed: true, message: '✓ All 5 fields with correct types!' };
        }
        return {
          passed: false,
          message: `${passing.length}/5 fields correctly typed`,
          details: 'Incorrect: ' + checks.filter((c) => !c.ok).map((c) => c.label).join(', '),
        };
      },
    },

    next: 'M1L5',
  },

  // ─────────────────────────── M1L5 · Guards ───────────────────────────────────
  {
    id: 'M1L5',
    moduleId: 'M1',
    order: 5,
    title: 'Guards',
    description: 'Restrict actions with only, when, and given',
    estimatedMinutes: 10,
    difficulty: 'beginner',

    explanation: `
## Guards — Covenant's safety layer

Guards are **pre-conditions checked before an action runs**. If any guard fails, the transaction reverts. They replace the defensive \`require(...)\` pattern from Solidity with expressive, named constructs.

## Three guard types

### \`only\` — identity
Who is allowed to call this?

\`\`\`covenant
action pause() only deployer { ... }
action claim() only members  { ... }   -- members = a map<address, bool>
\`\`\`

### \`when\` — state / time condition
What must be true about the contract state?

\`\`\`covenant
action withdraw() when now >= unlock_time    { ... }
action finalize() when phase == closed       { ... }
\`\`\`

### \`given\` — input validation
What must be true about the arguments?

\`\`\`covenant
action transfer(to: address, value: amount)
        given balance >= value
        given to != caller { ... }
\`\`\`

## Stacking guards

Multiple guards can chain — all must pass:

\`\`\`covenant
action sensitive()
        only admin
        when phase == ready
        given amount > 0 {
    -- runs only when all 3 conditions hold
}
\`\`\`

Guards make intent explicit. A reader can see the pre-conditions at a glance, without parsing the body.
`,

    codeStarter: `record TimeLockVault {
    field balance: amount = 0
    field unlock_time: time
    field owner: address = deployer

    action deposit(value: amount) {
        balance = balance + value
    }

    -- TODO: add action \`withdraw(value: amount)\` with 3 guards:
    --   1. only the owner can call
    --   2. only after unlock_time has passed  (now >= unlock_time)
    --   3. requested value must not exceed balance  (balance >= value)
    --   Body: balance = balance - value

    view get_balance() returns amount { balance }
    view get_unlock()  returns time   { unlock_time }
}
`,

    codeSolution: `record TimeLockVault {
    field balance: amount = 0
    field unlock_time: time
    field owner: address = deployer

    action deposit(value: amount) {
        balance = balance + value
    }

    action withdraw(value: amount)
            only owner
            when now >= unlock_time
            given balance >= value {
        balance = balance - value
    }

    view get_balance() returns amount { balance }
    view get_unlock()  returns time   { unlock_time }
}
`,

    objective: 'Add `action withdraw(value: amount)` with guards: `only owner`, `when now >= unlock_time`, and `given balance >= value`.',

    hints: [
      'Guards go between the parameter list and the opening `{`',
      '`only owner` checks identity',
      '`when now >= unlock_time` checks timing — `now` is the block timestamp',
      '`given balance >= value` checks the input against stored state',
    ],

    validator: {
      type: 'custom',
      fn: (source) => {
        const hasWithdraw = /action\s+withdraw\s*\(\s*value\s*:\s*amount\s*\)/i.test(source);
        const hasOnlyOwner = /only\s+owner/i.test(source);
        const hasWhenUnlock = /when\s+now\s*>=\s*unlock_time/i.test(source);
        const hasGivenBalance = /given\s+balance\s*>=\s*value/i.test(source);
        const hasBody = /balance\s*=\s*balance\s*-\s*value/i.test(source);

        if (hasWithdraw && hasOnlyOwner && hasWhenUnlock && hasGivenBalance && hasBody) {
          return { passed: true, message: '✓ All 3 guards applied — Module 1 complete! 🎉' };
        }

        const missing: string[] = [];
        if (!hasWithdraw) missing.push('`action withdraw(value: amount)`');
        if (!hasOnlyOwner) missing.push('`only owner`');
        if (!hasWhenUnlock) missing.push('`when now >= unlock_time`');
        if (!hasGivenBalance) missing.push('`given balance >= value`');
        if (!hasBody) missing.push('`balance = balance - value` in body');

        return {
          passed: false,
          message: 'Guards incomplete',
          details: 'Missing: ' + missing.join(', '),
        };
      },
    },

    next: 'M2L1',
  },
];
