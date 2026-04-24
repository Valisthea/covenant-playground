import { useStore } from '../../lib/store';
import { getMockChain, shortAddress } from '../../lib/mockchain';

export function ContractList() {
  useStore((s) => s.chainRev);
  const activeContract = useStore((s) => s.activeContract);
  const setActiveContract = useStore((s) => s.setActiveContract);

  const contracts = Array.from(getMockChain().contracts.values());

  if (contracts.length === 0) {
    return (
      <section className="deploy-card">
        <h3 className="deploy-card__title">Deployed contracts</h3>
        <p className="deploy-empty">
          No contracts deployed yet. Compile a contract and hit <kbd>Deploy</kbd>.
        </p>
      </section>
    );
  }

  return (
    <section className="deploy-card">
      <h3 className="deploy-card__title">Deployed contracts</h3>
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
          </li>
        ))}
      </ul>
    </section>
  );
}
