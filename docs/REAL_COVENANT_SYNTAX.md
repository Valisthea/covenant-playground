# Real Covenant Syntax — V0.8 Reference

> **Source of truth.** Every claim in this document is verified against
> the 11 fixtures in `covenant/crates/covenant-lexer/tests/fixtures/example_*.cov`,
> all of which compile cleanly via the Covenant compiler used by the
> playground (`covenant-wasm-bindings::adapt::compile_evm`).
>
> If something compiles, you can document it here. If it doesn't, you
> can't. The compiler is the arbiter.
>
> **Audience.** Authors of playground content (Examples Gallery, Tour
> lessons, blog posts, demos). If you're writing a `.cov` file that the
> playground will load, read this first.
>
> **Version.** V0.8 (compiler `f6065fc`, playground `v0.8.0-rc6`).
> When the language extends, this document grows. New top-level
> keywords and syntax forms must be added here BEFORE they're used in
> shipped content — otherwise content drifts ahead of compiler again
> (see Sprint 26 audit finding KSR-CVN-PRELIM-009).

---

## Table of contents

1. [The 9 top-level keywords](#1-the-9-top-level-keywords)
2. [Comments](#2-comments)
3. [Field declarations](#3-field-declarations)
4. [Built-in types](#4-built-in-types)
5. [Composite types](#5-composite-types-map-list)
6. [Actions](#6-actions)
7. [Views and reveals](#7-views-and-reveals)
8. [Guards: when, only, given, pq_signed, verified_by](#8-guards)
9. [Built-in symbols](#9-built-in-symbols)
10. [Events](#10-events)
11. [Errors and revert_with](#11-errors-and-revert_with)
12. [Token construct](#12-token-construct)
13. [Confidential token construct](#13-confidential-token-construct)
14. [Encrypted counter construct](#14-encrypted-counter-construct)
15. [Ballot construct](#15-ballot-construct)
16. [Ceremony construct](#16-ceremony-construct)
17. [Board construct](#17-board-construct)
18. [Module / hybrid module constructs](#18-module--hybrid-module-constructs)
19. [Anti-patterns: what does NOT exist](#19-anti-patterns-what-does-not-exist)

---

## 1. The 9 top-level keywords

Every `.cov` file starts with one of these. The choice IS the
architectural decision — different keywords trigger different
auto-synthesis from the standard library.

| Keyword | Synthesized stdlib | When to use |
|---|---|---|
| `record` | none | Minimal kv store. Fields + actions + views, no automatic functions. Smallest and simplest. |
| `token` | ERC-20 surface (transfer, approve, balance_of, allowance, transfer_from, totalSupply, decimals, symbol, name) | Standard fungible token. Just write the metadata, the implementation is auto. |
| `confidential token` | ERC-8227 surface (transferEncrypted, balanceOfEncrypted, etc.) | TFHE-encrypted token. Same metadata shape as `token`. |
| `ballot` | tally management, `tally` field auto-declared | On-chain voting with a deadline. |
| `encrypted counter` | TFHE counter, `+=` is homomorphic | Privacy-preserving accumulator. |
| `ceremony` | ERC-8228 lifecycle (setup, submit_share, finalize, destroy, phase, session_id, is_destroyed, owner) | Amnesia ceremony with guardian shares. |
| `board` | append-only post storage, `posts.length`, `posts[i]` | Message board pattern with nested record type. |
| `module` | none | Generic logic container. No auto-synthesis; you write everything explicitly. |
| `hybrid module` | none + per-field privacy qualifiers | Mixed-privacy module (some fields plaintext, some encrypted). |

### Examples (one per keyword)

```covenant
record Hello {
    greeting: text
    action update(new_text: text) { greeting = new_text }
    view read returns text { greeting }
}

token Coin {
    symbol: "COIN"
    name: "Covenant Coin"
    decimals: 18
    supply: 1_000_000 to deployer
}

confidential token SecretCoin {
    symbol: "SCOIN"
    name: "Secret Coin"
    decimals: 18
    supply: 1_000_000 to deployer
}

ballot OpenBallot {
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

encrypted counter ShieldedCounter {
    total: amount
    action bump(by: amount) { total += by }
    reveal total to owner
}

ceremony AmnesiaCeremony {
    guardians: 3
    threshold: 2
    on_destroy { destroy(0) }
}

board QuantumBoard {
    post {
        author: address
        content: hash
        at: time
        pq_sig: bytes
    }
    field keys: map<address, pq_key>

    action register(pk: pq_key) {
        keys[caller] = pk
        emit KeyRegistered(caller)
    }
    -- ...
}

module SafeTransfer {
    error InsufficientBalance(required: amount, actual: amount)
    field balances: map<address, amount>
    field owner: address
    -- explicit actions, no auto-synthesis
}

hybrid module HybridState {
    field headcount: amount
    field treasury: address
    field locked: amount
    -- per-field privacy qualifiers allowed (`field encrypted X: T`)
}
```

---

## 2. Comments

Covenant uses `--` for line comments. **Not** `//`. Multi-line: prefix
each line with `--`.

```covenant
-- This is a single-line comment.

-- Multi-line comment ?
-- Just multiple `--` lines.

record Foo {
    -- Comments inside a body work the same.
    greeting: text  -- Trailing comments OK too.
}
```

The Covenant compiler explicitly rejects C-style `/* ... */` with
diagnostic `E004 — C-style multi-line comments are reserved; use (* ... *) in Covenant`.
The `(* ... *)` form may be reserved for future use but is not
documented as currently working. Use `--` exclusively.

---

## 3. Field declarations

Two forms. Inside `record`, `token`, `ballot`, `ceremony` etc., the
`field` keyword is **implicit** — you write the field name + type
directly:

```covenant
record Hello {
    greeting: text          -- implicit field
    counter: amount         -- implicit field
}
```

Inside `module` and `hybrid module`, the `field` keyword is **explicit**:

```covenant
module SafeTransfer {
    field balances: map<address, amount>
    field owner: address
    field total_deposits: amount
}
```

### Privacy qualifiers

Privacy qualifiers prefix the field type **inside `hybrid module`** to
mark a single field as encrypted/etc. while others remain plaintext:

```covenant
hybrid module Mixed {
    field headcount: amount             -- plaintext
    field encrypted treasury: address   -- TFHE-encrypted (hypothetical)
    field locked: amount                -- plaintext
}
```

(The fixtures don't use `field encrypted` directly — verify with the
compiler before using in shipped content.)

---

## 4. Built-in types

Verified to work in fixtures:

| Type | Meaning | Example use |
|---|---|---|
| `address` | 20-byte Ethereum address | `field owner: address` |
| `amount` | uint256 (semantic alias for monetary/numeric values) | `field balance: amount` |
| `text` | UTF-8 string | `field greeting: text` |
| `hash` | bytes32 (e.g. keccak256 output) | `field content_hash: hash` |
| `bytes` | variable-length bytes | `field signature: bytes` |
| `time` | Unix timestamp seconds | `field deadline: time` |
| `duration` | seconds interval | `field lock_period: duration = 7 days` |
| `choice` | enum-like string for ballot options | `options: [choice] = ["yes", "no"]` |
| `pq_key` | post-quantum public key (Dilithium-5) | `field pk: pq_key` |

### Duration literals

```
1 second / 1 seconds
1 minute / 1 minutes
1 hour  / 1 hours
1 day   / 1 days
1 week  / 1 weeks
```

Used as: `duration: duration = 7 days`.

### Number literals

Underscore separators allowed: `1_000_000`. Hex: `0xff` (must have
even digit count per error E006).

---

## 5. Composite types: `map`, `list`, arrays

`map<K, V>` — keyed storage. Verified in fixtures (5/11 use it):

```covenant
field balances: map<address, amount>
field keys: map<address, pq_key>

-- Indexing:
balances[caller] = 100
balances[caller] += 50

-- Read:
view balance_of(who: address) returns amount {
    balances[who]
}
```

`[T]` — array literal. Verified in `ballot` for the `options` field:

```covenant
options: [choice] = ["yes", "no", "abstain"]
```

The exact rules for general arrays vs. lists vs. nested record
collections are not fully covered by the 11 fixtures. The `board`
construct provides a `posts.length` accessor and `posts[i]` indexing
on its nested `post` record automatically. For other collection
patterns, prefer `map<index, T>` until the array story is documented.

---

## 6. Actions

The state-mutating entry point. Syntax:

```
action name(arg1: type1, arg2: type2)
        guard1,
        guard2,
        guard3 {
    -- statements
    -- can mutate state
    -- can `emit Event(args)`
    -- can `revert_with ErrorName(args)`
}
```

Multiple guards are **comma-separated** (NOT `&&` or `and`). All
must hold for the action to execute.

### Examples from fixtures

```covenant
-- Single guard (boolean expression):
action safe_withdraw(value: amount)
        when balances[caller] >= value {
    balances[caller] -= value
}

-- Multiple guards:
action cast(pick: choice)
        when now < opened_at + duration,
        only first_time_caller,
        given pick in options {
    tally[pick] += 1
}

-- No guards (anyone can call):
action lock(value: amount) {
    deposits[caller] += value
    locked_total += value
    emit Locked(caller, value)
}

-- Crypto guards:
action submit(content: hash, sig: bytes)
        pq_signed(content, sig, keys[caller]),
        only registered_key {
    append post {
        author: caller
        content: content
        at: now
        pq_sig: sig
    }
}
```

### Statement forms inside an action body

| Pattern | Meaning |
|---|---|
| `field = expr` | assign |
| `field += expr` | add-assign (also `-=`, `*=`, `/=`) |
| `map[key] = expr` | map assign |
| `map[key] += expr` | map add-assign |
| `emit EventName(args)` | emit a typed event |
| `revert_with ErrorName(args)` | revert with a typed error |
| `append post { field: value, ... }` | append to a board's post list |

---

## 7. Views and reveals

`view` is read-only (does not mutate state). `reveal` is for FHE/ZK
contexts where the data needs threshold-decrypt before being read.

### View syntax

```
view name returns T { expression }                    -- no args
view name(arg: type) returns T { expression }         -- with args
view name(arg: type) returns T when guard { expr }    -- guarded
```

**Important**: when a view has zero args, **no parentheses**. This
matches what the fixtures do:

```covenant
view read returns text { greeting }              -- no parens
view count returns amount { posts.length }       -- no parens
view balance_of(who: address) returns amount {   -- parens for args
    balances[who]
}
```

### Reveal syntax

```
reveal name to role                              -- access policy declaration
reveal name returns T { expr }                   -- like view but FHE-aware
reveal name returns T when guard { expr }
reveal name(arg: type) returns T { expr }
```

Examples:

```covenant
-- Access policy only (used in encrypted counter):
reveal total to owner
reveal yes_votes to owner

-- Reveal with body (used in ballot):
reveal winner returns choice
        when now >= opened_at + duration {
    tally.argmax
}
```

---

## 8. Guards

Five guard forms verified in fixtures:

### `when expr`

Arbitrary boolean expression on contract state, args, or built-in symbols.

```covenant
when caller == owner
when balances[caller] >= value
when now < opened_at + duration
when now >= opened_at + duration
when posts.length > 0
when i < posts.length            -- NOTE: used on view
```

### `only role_qualifier`

Predefined symbol indicating an authorization role. Available in
fixtures:

```covenant
only first_time_caller     -- caller hasn't called this action before
only registered_key        -- caller has registered a pq_key (board pattern)
```

The compiler may support more `only` qualifiers (e.g., `only deployer`,
`only owner`) but only these two appear in the verified fixtures. If
you need a custom role check, use `when caller == role_field` instead.

### `given X in collection`

Membership check on a value-in-set. Used to validate that an arg
belongs to an enum-like list:

```covenant
action cast(pick: choice)
        given pick in options {
    -- pick is guaranteed to be one of options
}
```

### `pq_signed(content, sig, key)`

Post-quantum signature verification. Reverts if `sig` doesn't validate
the `content` against `key`. Used in the `board` construct's submit
pattern.

```covenant
action submit(content: hash, sig: bytes)
        pq_signed(content, sig, keys[caller]) {
    -- ...
}
```

### `verified_by(zk_proof)`

ZK proof verification guard. Mentioned in language design docs but not
demonstrated in the 11 fixtures. Use with caution; verify behavior
against compiler before shipping content that depends on it.

---

## 9. Built-in symbols

Available without import inside any action / view / reveal body:

| Symbol | Type | Meaning |
|---|---|---|
| `caller` | `address` | Address that initiated the current call |
| `now` | `time` | Current block timestamp |
| `deployer` | `address` | Address that originally deployed the contract |
| `owner` | `address` | Default owner (= deployer); settable in stdlib if construct supports |
| `opened_at` | `time` | When the contract was deployed (used in ballot) |

For `record`, `module`, `hybrid module`: `owner` may not be
auto-available — check the fixtures or rely on an explicit `field
owner: address` you initialize in an `initialize(who: address)`
action.

---

## 10. Events

Declare with `event Name(args)`. Emit with `emit Name(args)`. Both
inside the same construct body.

```covenant
event Deposited(who: address, value: amount)
event KeyRegistered(who: address)
event Cast(who: address, pick: choice)

emit Deposited(caller, value)
emit KeyRegistered(caller)
emit Cast(caller, pick)
```

Event args are typed. Zero-arg events are valid (`event Done()`).

Events compile down to LOG opcodes; the playground's TxHistoryPane
displays them in receipts.

---

## 11. Errors and revert_with

Declare with `error Name(args)`. Trigger with `revert_with Name(args)`.

```covenant
error InsufficientBalance(required: amount, actual: amount)
error Unauthorized(caller: address)
error ZeroAmount()                    -- zero-arg error

action force_insufficient(required: amount, actual: amount) {
    revert_with InsufficientBalance(required, actual)
}

action force_unauthorized() {
    revert_with Unauthorized(caller)
}

action force_zero_amount() {
    revert_with ZeroAmount()
}
```

The error ABI encoding follows Solidity's custom error pattern:
selector = `keccak256("Name(types,...)")[..4]`, args ABI-encoded.
The playground's RevertDisplay decodes these against the contract's
ABI.

### `when` guard vs `revert_with`

Two ways to fail a call:

```covenant
-- Approach A: `when` guard reverts before the body runs.
-- Cleaner; no error type info exposed.
action safe_withdraw(value: amount)
        when balances[caller] >= value {
    balances[caller] -= value
}

-- Approach B: explicit revert_with inside the body.
-- More expressive; error name + args ABI-encoded for the caller.
action checked_withdraw(value: amount) {
    -- (Covenant doesn't have if/else; this is conceptual)
    -- if balances[caller] < value : revert_with InsufficientBalance(value, balances[caller])
    balances[caller] -= value
}
```

For typed errors with diagnostic context, prefer `revert_with`. For
simple precondition checks, prefer `when` guards.

(Note: Covenant's in-action conditional flow is not fully demonstrated
in the 11 fixtures. Most error-checking happens via `when` guards on
the action signature itself.)

---

## 12. `token` construct

```covenant
token Coin {
    symbol: "COIN"
    name: "Covenant Coin"
    decimals: 18
    supply: 1_000_000 to deployer
}
```

Auto-synthesized:

| Surface | Function |
|---|---|
| Field | `supply: amount` (total supply) |
| Field | `balances: map<address, amount>` |
| Field | `allowances: map<hash, amount>` (key = keccak256(owner, spender)) |
| Field | `name: text`, `symbol: text`, `decimals: amount` |
| Action | `transfer(to: address, value: amount) returns bool` |
| Action | `approve(spender: address, value: amount) returns bool` |
| Action | `transfer_from(from: address, to: address, value: amount) returns bool` |
| View | `balance_of(who: address) returns amount` |
| View | `allowance(owner: address, spender: address) returns amount` |
| View | `total_supply returns amount`, `name returns text`, `symbol returns text`, `decimals returns amount` |
| Event | `Transfer(from: address, to: address, value: amount)` |
| Event | `Approval(owner: address, spender: address, value: amount)` |

**Customization**: write your own `action transfer(...) { ... }` after
the metadata to override the synthesized one.

`supply: N to deployer` mints N tokens at deploy time to the deployer.
Variants like `supply: N to <address-literal>` may be supported but
aren't demonstrated in fixtures.

---

## 13. `confidential token` construct

Identical syntax to `token`. Synthesizes ERC-8227 instead of ERC-20:
balances are TFHE ciphertext handles, transfers are homomorphic.

```covenant
confidential token SecretCoin {
    symbol: "SCOIN"
    name: "Secret Coin"
    decimals: 18
    supply: 1_000_000 to deployer
}
```

Surface includes `transferEncrypted`, `transferFromEncrypted`,
`approveEncrypted`, `balanceOfEncrypted`, `allowanceEncrypted`, plus
the plaintext-equivalent views (`totalSupply`, `decimals`, `symbol`,
`name`).

---

## 14. `encrypted counter` construct

```covenant
encrypted counter ShieldedCounter {
    total: amount

    action bump(by: amount) {
        total += by         -- HOMOMORPHIC add (no decryption)
    }

    reveal total to owner
}
```

The field `total` is auto-encrypted (TFHE ciphertext). `+=` performs
homomorphic addition. `reveal total to owner` declares an access
policy: only the `owner` can threshold-decrypt.

Multiple counters in one construct:

```covenant
encrypted counter PrivateDAO {
    yes_votes: amount
    no_votes: amount

    action vote_yes() { yes_votes += 1 }
    action vote_no()  { no_votes += 1 }

    reveal yes_votes to owner
    reveal no_votes to owner
}
```

---

## 15. `ballot` construct

Auto-synthesized: `tally: map<choice, amount>`, `opened_at: time` (set
at deploy), and the timing machinery for `now`/deadline checks.

```covenant
ballot OpenBallot {
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
```

`tally.argmax` is a method-style accessor that returns the option
with the highest count.

---

## 16. `ceremony` construct

ERC-8228 lifecycle synthesis:

```covenant
ceremony AmnesiaCeremony {
    guardians: 3
    threshold: 2

    on_destroy {
        destroy(0)
    }
}
```

| Synthesized | Returns | Meaning |
|---|---|---|
| `setup()` | `uint256` (session_id) | initialize ceremony session |
| `submit_share(bytes32)` | `bool` | guardian submits their key share |
| `finalize()` | `bool` | organizer finalizes share collection |
| `destroy()` | `bool` | irrevocably destroy the secret, emit event |
| `phase()` | `uint256` (0=Setup, 1=Active, 2=Finalized, 3=Destroyed) | current phase |
| `session_id()` | `uint256` | current session id |
| `is_destroyed()` | `bool` | true once `destroy()` was called |
| `owner()` | `address` | the ceremony organizer (deployer) |

The optional `on_destroy { ... }` block runs when ceremony reaches
the Destroyed phase. Calling `destroy(0)` inside it generates an
irrevocable destruction proof event.

---

## 17. `board` construct

Append-only message board with a nested `post` record type:

```covenant
board QuantumBoard {
    post {
        author:  address
        content: hash
        at:      time
        pq_sig:  bytes
    }

    field keys: map<address, pq_key>

    action register(pk: pq_key) {
        keys[caller] = pk
        emit KeyRegistered(caller)
    }

    action submit(content: hash, sig: bytes)
            pq_signed(content, sig, keys[caller]),
            only registered_key {
        append post {
            author:  caller
            content: content
            at:      now
            pq_sig:  sig
        }
    }

    view count returns amount { posts.length }
    view get(i: amount) returns post when i < posts.length { posts[i] }
}
```

The `post { ... }` block defines a nested record type. `append post
{ field: value, ... }` adds an entry. `posts.length` and `posts[i]`
are auto-available.

The `board` construct also auto-declares `posts: <list of post>`.

---

## 18. `module` and `hybrid module` constructs

Generic logic containers. No auto-synthesis — every action, view,
field, event, and error is explicit.

```covenant
module SafeTransfer {
    error InsufficientBalance(required: amount, actual: amount)
    error Unauthorized(caller: address)
    error ZeroAmount()

    field balances: map<address, amount>
    field owner: address
    field total_deposits: amount

    event Deposited(who: address, value: amount)
    event Withdrawn(who: address, value: amount)

    action initialize(who: address) {
        owner = who
    }

    action deposit(value: amount) {
        balances[caller] += value
        total_deposits += value
        emit Deposited(caller, value)
    }

    action safe_withdraw(value: amount)
            when balances[caller] >= value {
        balances[caller] -= value
        total_deposits -= value
        emit Withdrawn(caller, value)
    }

    view balance_of(who: address) returns amount {
        balances[who]
    }
}
```

`hybrid module` is the same but allows per-field privacy qualifiers:

```covenant
hybrid module HybridState {
    field headcount: amount             -- plaintext
    field treasury: address             -- plaintext
    field locked: amount                -- plaintext
    -- field encrypted xxx: T          -- per-field encryption (verify before use)
}
```

---

## 19. Anti-patterns: what does NOT exist

The Sprint 26 audit found 27 of 29 examples + 13 of 15 lessons broken
because they used these constructs that **do not exist in Covenant**.
Every appearance of these in shipped content is a bug:

| Pseudo-Solidity (WRONG) | Real Covenant (RIGHT) |
|---|---|
| `// comment` | `-- comment` |
| `/* multi-line */` | `--` per line (or reserved `(* ... *)`) |
| `contract Foo { ... }` | `record Foo { ... }`, `token`, `module`, etc. |
| `mapping(K => V) public xs;` | `field xs: map<K, V>` |
| `mapping(K => V) xs;` (no `public`) | `field xs: map<K, V>` |
| `function name() public { ... }` | `action name() { ... }` or `view name returns T { ... }` |
| `function name() view returns (T) { ... }` | `view name returns T { ... }` |
| `require(cond, "msg")` | `when cond` guard, OR `revert_with ErrorName(args)` |
| `if (cond) { ... } else { ... }` | Use `when` guards on actions; in-action branching not directly demonstrated in fixtures |
| `uint256` | `amount` |
| `int256` | (no signed type demonstrated; use `amount` if non-negative) |
| `string` | `text` |
| `bytes32` | `hash` |
| `bool` (in field decl) | (not demonstrated in fixtures; verify before using) |
| `address public owner;` | `field owner: address` |
| `import "..."` | (no imports yet; stdlib is auto-available per top-level keyword) |
| `constructor() { ... }` | No constructor; use `action initialize(...)` called once after deploy, OR `supply: N to deployer` for token-style state |
| `modifier onlyOwner { ... }` | Inline guards: `when caller == owner`, `only deployer`, etc. |
| `payable` | Not demonstrated in fixtures; value handling is implicit through action signatures |
| `emit Event(args)` | ✅ This one IS valid — keep it |
| `revert("msg")` | `revert_with ErrorName(args)` (typed errors only; no plain string revert in fixtures) |
| `assert(cond)` | `when cond` guard on the action |
| `msg.sender` | `caller` |
| `block.timestamp` | `now` |
| `block.number` | (not demonstrated in fixtures; check compiler) |
| `msg.value` | (not demonstrated; value is via action signature) |
| `>>` (closing nested generic) | Covenant's `map<K, V>` doesn't nest in fixtures; `map<K, map<...>>` works in CLI but verify before shipping |
| `enum Status { Active, Paused }` | Not demonstrated; use `text` field + `given x in [...]` guard |
| `struct Point { x: uint; y: uint; }` | The `board` construct's `post { ... }` is the only nested-record demo |

---

## How to use this document

If you're writing new content for the playground:

1. **Start from a fixture.** Pick one of the 11 `example_*.cov` files
   that matches your pattern. Copy it, modify it, run it through the
   inventory test (`scripts/inventory-content.mjs`).
2. **Cross-reference this doc.** Every construct you use must have a
   section here. If it doesn't, it's not verified — don't ship it.
3. **Run the inventory test.** Before shipping any new `.cov` file or
   tour lesson `codeStarter`, run the inventory test and confirm 100%
   pass.
4. **If you discover new working syntax** (via experiment with the
   compiler), add it here. Update the cheat sheet first; ship the
   content second.

This document is the social contract for content authors. Sprint 26
audit found that bypassing it costs an entire sprint of rework. Don't
bypass it.
