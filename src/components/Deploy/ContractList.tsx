import { useStore } from '../../lib/store';
import { shortAddress } from '../../lib/mockchain';
import { etherscanAddressUrl } from '../../lib/wallet';

export function ContractList() {
  useStore((s) => s.chainRev);
  const target = useStore((s) => s.target);
  const activeContract = useStore((s) => s.activeContract);
  const setActiveContract = useStore((s) => s.setActiveContract);
  const getDeployedContracts = useStore((s) => s.getDeployedContracts);

  // Sprint 24: read via the target-aware selector so the list shows
  // MockChain or Sepolia contracts depending on which target is active.
  const contracts = getDeployedContracts();

  if (contracts.length === 0) {
    return (
      <section className="deploy-card">
        <h3 className="deploy-card__title">Deployed contracts</h3>
        <p className="deploy-empty">
          No contracts deployed yet on{' '}
          <strong>{target === 'sepolia' ? 'Sepolia' : 'MockChain'}</strong>.
          Compile a contract and hit <kbd>Deploy</kbd>.
        </p>
      </section>
    );
  }

  return (
    <section className="deploy-card">
      <h3 className="deploy-card__title">
        Deployed contracts
        {target === 'sepolia' && (
          <span className="deploy-card__chain-badge deploy-card__chain-badge--live">
            on Sepolia
          </span>
        )}
      </h3>
      <ul className="contract-list">
        {contracts.map((c) => (
          <li
            key={c.address}
            className={`contract-row ${c.address === activeContract ? 'contract-row--active' : ''}`}
          >
            <button
              type="button"
              className="contract-row__btn"
              onClick={() => setActiveContract(c.address)}
              aria-pressed={c.address === activeContract}
              title={c.address}
            >
              <span className="contract-row__name">{c.name}</span>
              <span className="contract-row__addr">{shortAddress(c.address)}</span>
              <span className="contract-row__meta">
                {c.abi.length} action{c.abi.length === 1 ? '' : 's'}
              </span>
            </button>
            {target === 'sepolia' && (
              <a
                href={etherscanAddressUrl(c.address)}
                target="_blank"
                rel="noopener noreferrer"
                className="contract-row__explorer"
                aria-label={`View ${shortAddress(c.address)} on Etherscan`}
                title="Open on Sepolia Etherscan"
              >
                Etherscan ↗
              </a>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
