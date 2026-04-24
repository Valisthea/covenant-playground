import { useStore } from '../../lib/store';
import {
  formatMockToken,
  getMockChain,
  shortAddress,
  type Address,
} from '../../lib/mockchain';

/**
 * Compact account switcher. The active account becomes `msg.sender`
 * for subsequent deploys and calls against MockChain.
 */
export function AccountSwitcher() {
  // Subscribe to chainRev so balance mutations re-render.
  useStore((s) => s.chainRev);
  const setActiveAccount = useStore((s) => s.setActiveAccount);

  const chain = getMockChain();
  const active = chain.activeAccount;

  return (
    <section className="deploy-card">
      <h3 className="deploy-card__title">Accounts</h3>
      <ul className="account-list">
        {chain.accounts.map((acc) => (
          <li
            key={acc.address}
            className={`account-row ${acc.address === active ? 'account-row--active' : ''}`}
          >
            <button
              type="button"
              className="account-row__btn"
              onClick={() => setActiveAccount(acc.address as Address)}
              aria-pressed={acc.address === active}
              title={acc.address}
            >
              <span className="account-row__label">{acc.label}</span>
              <span className="account-row__addr">{shortAddress(acc.address)}</span>
              <span className="account-row__bal">
                {formatMockToken(acc.balance)} MOCK
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
