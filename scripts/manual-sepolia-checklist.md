# Manual Sepolia smoke checklist — Sprint 26 audit Phase 3

Operator-driven. Cannot be automated cleanly because Puppeteer +
MetaMask popups is brittle. Estimated time: **30-60 minutes**.

## Prerequisites

- Browser with MetaMask installed
- Wallet imported with at least 0.05 Sepolia ETH (faucet links are
  in WalletPanel itself — sepoliafaucet.com / Alchemy / Infura)
- Playground URL ready: `https://playground.covenant-lang.org/` (prod)
  or `http://localhost:5173/` (local dev)

## Pass criteria

Every step's "Expected" matches "Observed". Any deviation = a finding
in `audits/2026-04-25-omega-v4-covenant-v0.8/02-findings/`.

## Happy path (16 steps)

| # | Action | Expected |
|---|---|---|
| 1 | Open the playground, MetaMask connected, on Sepolia, balance > 0 | Page loads, header shows compiler ready |
| 2 | Toggle Deploy target → Sepolia | Red **LIVE** badge appears next to "Sepolia" tab |
| 3 | Click "Connect wallet" in WalletPanel | MetaMask popup; click Connect |
| 4 | Observe WalletPanel | Address + balance shown; Network = "Sepolia ✓" green badge |
| 5 | Compile `example_01_hello.cov` (or any example) | Bytecode appears in Output panel |
| 6 | Click "Deploy to Sepolia" (red button) | MetaMask popup with `Contract creation` tx |
| 7 | Inspect MetaMask popup | Shows: From your address, gas estimate, contract creation data starting with the bytecode |
| 8 | Confirm in MetaMask | Pending state; ~12-30s wait |
| 9 | After confirmation | Contract appears in ContractList with the **real** Sepolia address |
| 10 | Click "Etherscan ↗" link on the contract row | Opens `sepolia.etherscan.io/address/0x...` showing the deployed contract |
| 11 | TxHistoryPane | Shows the deploy tx with `kind=deploy`, `status=success`, Etherscan link in row header |
| 12 | Click "set" action in InteractionPanel with arg `"hello world"` | MetaMask popup with calldata |
| 13 | Confirm | Pending banner: "Awaiting MetaMask + 1 confirmation… (~30s)" |
| 14 | After confirmation | Receipt added to TxHistoryPane with Etherscan link |
| 15 | Click "get" view in InteractionPanel | **No** MetaMask popup (eth_call is free) |
| 16 | Observe view result | Returns `"hello world"` decoded as string |

If steps 1-16 all match: **happy path verified**.

## Adversarial cases (10 vectors)

| # | Action | Expected |
|---|---|---|
| A1 | Click Deploy, then click Reject in MetaMask popup | UI shows "User rejected the transaction in MetaMask" toast; button re-enabled |
| A2 | Switch wallet network to Mainnet (chainId 0x1) inside MetaMask without reloading | (Sprint 26 PRELIM-001 fix) WalletPanel banner updates to red "Mainnet detected" within ~1s; **no** reload required |
| A3 | While on mainnet, click Deploy | Red error: "Mainnet detected — playground refuses to deploy"; **no** tx broadcast on mainnet (verify in MetaMask Activity tab — should be empty) |
| A4 | Switch back to Sepolia in MetaMask | Banner updates back to green "Sepolia ✓" within ~1s (PRELIM-001 fix) |
| A5 | Switch wallet account inside MetaMask (if you have multiple) | WalletPanel address + balance update to new account (PRELIM-001 fix) |
| A6 | Drain wallet to 0 ETH (or use a fresh empty account); attempt Deploy | Red error: "Wallet has zero Sepolia ETH"; faucet hint visible in WalletPanel |
| A7 | Compile a contract with a syntax error; attempt Deploy | Deploy button disabled; tooltip explains "Compile cleanly before deploying" |
| A8 | Compile clean, click Deploy twice rapidly | Second click is a no-op (button disabled during isDeploying); only one MetaMask popup |
| A9 | Disable MetaMask extension mid-pending-tx | Graceful timeout error; UI does not crash |
| A10 | After successful Sepolia deploy, switch target back to MockChain | ContractList shows MockChain contracts only; Sepolia contract is hidden (re-appears on switch back) |

## Cross-target isolation (4 vectors)

| # | Action | Expected |
|---|---|---|
| X1 | Deploy on MockChain, switch to Sepolia | ContractList empty (MockChain contracts hidden); switching back restores |
| X2 | Deploy on MockChain, then deploy same contract on Sepolia | Two distinct addresses; both retrievable via target toggle |
| X3 | Reset chain on MockChain | Sepolia deployments untouched (verify by toggling) |
| X4 | Sepolia tx fails (e.g. constructor reverts) | MockChain state unchanged; Sepolia tx_log shows the reverted tx |

## Reporting failures

For each step that fails:

1. Note the step number + observed behaviour
2. Open `audits/2026-04-25-omega-v4-covenant-v0.8/02-findings/`
3. Create `KSR-CVN-NNN-<slug>.md` from the existing PRELIM-001 template
4. Include browser console output, MetaMask state, screenshots if useful
5. If it's a Critical/High (real money at risk path): tag this as
   blocking V0.8.0 GA in the executive summary

## After completion

Update `audits/.../phase3-report.md` with the results table. Sign and
date. Move to Phase 4 (remediation) for any failures, or to Phase 5
(re-audit) if zero failures.
