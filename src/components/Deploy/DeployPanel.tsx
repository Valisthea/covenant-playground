import { useStore } from '../../lib/store';
import { AccountSwitcher } from './AccountSwitcher';
import { ContractList } from './ContractList';
import { ChainControls } from './ChainControls';
import { InteractionPanel } from './InteractionPanel';
import { WalletPanel } from './WalletPanel';

/**
 * Deploy tab root. Layout:
 *
 *   ┌──────────────────────────────────────────┐
 *   │ Target: [MockChain] [Sepolia]            │
 *   ├──────────────────────────────────────────┤
 *   │  [ Deploy button + status ]              │
 *   ├──────────────────────────────────────────┤
 *   │  Accounts / Wallet         Chain clock   │
 *   │                                          │
 *   │  Deployed contracts                      │
 *   │                                          │
 *   │  Interaction panel (actions + views)     │
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

  const canDeploy = !!compileResult?.ok && !isDeploying;

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
          >
            MockChain
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={target === 'sepolia'}
            className={target === 'sepolia' ? 'active' : ''}
            onClick={() => setTarget('sepolia')}
          >
            Sepolia
          </button>
        </div>
      </div>

      <div className="deploy-action-row">
        <button
          type="button"
          className="pg-btn pg-btn--primary"
          disabled={!canDeploy}
          onClick={() => void deploy()}
          title={
            canDeploy
              ? `Deploy ${currentFile} to ${target}`
              : 'Compile cleanly before deploying'
          }
        >
          {isDeploying ? 'Deploying…' : `Deploy ${currentFile}`}
        </button>
        {deployError && (
          <span className="deploy-error" role="alert">
            {deployError}
          </span>
        )}
      </div>

      {target === 'mockchain' ? (
        <>
          <div className="deploy-grid">
            <AccountSwitcher />
            <ChainControls />
          </div>
          <ContractList />
          <InteractionPanel />
        </>
      ) : (
        <WalletPanel />
      )}
    </div>
  );
}
