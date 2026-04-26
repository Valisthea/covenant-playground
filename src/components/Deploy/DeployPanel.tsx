import { useStore } from '../../lib/store';
import { AccountSwitcher } from './AccountSwitcher';
import { ContractList } from './ContractList';
import { ChainControls } from './ChainControls';
import { InteractionPanel } from './InteractionPanel';
import { RecentDeployBanner } from './RecentDeployBanner';
import { WalletPanel } from './WalletPanel';

/**
 * Deploy tab root. Sprint 24 turned the Sepolia branch from a stub
 * pane into a fully functional flow:
 *
 *   - The same ContractList, InteractionPanel, and TxHistoryPane work
 *     for both targets — they're target-aware via the store.
 *   - On Sepolia, the WalletPanel renders alongside (instead of
 *     replacing) the contract surface, so the user can deploy +
 *     interact + see Etherscan links in one view.
 *   - The Deploy button label and styling adapt to the target. On
 *     Sepolia the button is red (`--primary-live`) to communicate
 *     the gravity of broadcasting a real-money tx.
 *
 * Layout (Sepolia target):
 *
 *   ┌──────────────────────────────────────────┐
 *   │ Target: [MockChain] [Sepolia LIVE]       │
 *   ├──────────────────────────────────────────┤
 *   │  [ Deploy to Sepolia (red) ]   [error]   │
 *   ├──────────────────────────────────────────┤
 *   │  WalletPanel (balance, faucet, network)  │
 *   ├──────────────────────────────────────────┤
 *   │  ContractList (Sepolia, with Etherscan)  │
 *   ├──────────────────────────────────────────┤
 *   │  InteractionPanel (routes via MetaMask)  │
 *   └──────────────────────────────────────────┘
 */
export function DeployPanel() {
  const target = useStore((s) => s.target);
  const setTarget = useStore((s) => s.setTarget);
  const compileResult = useStore((s) => s.compileResult);
  const deploy = useStore((s) => s.deploy);
  const isDeploying = useStore((s) => s.isDeploying);
  const deployError = useStore((s) => s.deployError);
  const currentFile = useStore((s) => s.currentFile);
  const wallet = useStore((s) => s.wallet);

  const isSepolia = target === 'sepolia';
  // Sepolia deploy needs a connected wallet; MockChain is always ready.
  const sepoliaReady = !isSepolia || (wallet?.address && wallet.isSepolia);
  const canDeploy = !!compileResult?.ok && !isDeploying && sepoliaReady;

  const deployBtnClass = isSepolia
    ? 'pg-btn pg-btn--primary pg-btn--live'
    : 'pg-btn pg-btn--primary';

  const deployBtnLabel = isDeploying
    ? `Deploying to ${isSepolia ? 'Sepolia' : 'MockChain'}…`
    : `Deploy ${currentFile}${isSepolia ? ' to Sepolia' : ''}`;

  return (
    <div className="deploy-panel">
      <div className="deploy-target-row">
        <span className="deploy-target-label">Target</span>
        <div className="deploy-target-seg" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={target === 'mockchain'}
            className={target === 'mockchain' ? 'active' : ''}
            onClick={() => setTarget('mockchain')}
            title="Deterministic in-tab EVM. Free, instant, perfect for iteration."
          >
            MockChain
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={target === 'sepolia'}
            className={`${target === 'sepolia' ? 'active' : ''} deploy-target-seg__sepolia`}
            onClick={() => setTarget('sepolia')}
            title="Real Ethereum testnet. Costs Sepolia ETH, ~30s per tx, opens MetaMask."
          >
            Sepolia
            <span className="deploy-target-seg__live-badge" aria-label="real network, costs ETH">
              LIVE
            </span>
          </button>
        </div>
      </div>

      <div className="deploy-action-row">
        <button
          type="button"
          className={deployBtnClass}
          disabled={!canDeploy}
          onClick={() => void deploy()}
          title={
            !compileResult?.ok
              ? 'Compile cleanly before deploying'
              : isSepolia && !sepoliaReady
                ? 'Connect wallet and switch to Sepolia first'
                : `Deploy ${currentFile} to ${isSepolia ? 'Sepolia' : 'MockChain'}`
          }
        >
          {deployBtnLabel}
        </button>
        {deployError && (
          <span className="deploy-error" role="alert">
            {deployError}
          </span>
        )}
      </div>

      {/* Sprint 26 audit (KSR-CVN-PRELIM-008): post-deploy success
          banner shown right under the Deploy button so a fresh
          contract is unmissable, even after the user's eye returns
          from the MetaMask popup. */}
      <RecentDeployBanner />

      {isSepolia && (
        <>
          <WalletPanel />
          {/* ContractList + InteractionPanel are target-aware now —
              they render whatever's deployed on the active target. */}
          <ContractList />
          <InteractionPanel />
        </>
      )}

      {!isSepolia && (
        <>
          <div className="deploy-grid">
            <AccountSwitcher />
            <ChainControls />
          </div>
          <ContractList />
          <InteractionPanel />
        </>
      )}
    </div>
  );
}
