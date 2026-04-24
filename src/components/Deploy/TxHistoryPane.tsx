import { useStore } from '../../lib/store';
import { getMockChain, shortAddress, type TxReceipt } from '../../lib/mockchain';

/**
 * Dedicated pane showing the MockChain transaction log, newest first.
 */
export function TxHistoryPane() {
  useStore((s) => s.chainRev);
  const txs = getMockChain().txs;

  if (txs.length === 0) {
    return (
      <div className="pane-empty">
        <p>No transactions yet.</p>
        <p className="pane-empty__sub">
          Deploy a contract or call an action to populate the history.
        </p>
      </div>
    );
  }

  return (
    <div className="tx-list">
      {txs.map((tx) => (
        <TxRow key={tx.hash} tx={tx} />
      ))}
    </div>
  );
}

function TxRow({ tx }: { tx: TxReceipt }) {
  const statusClass = tx.status === 'success' ? 'tx-ok' : 'tx-bad';
  const kindLabel =
    tx.kind === 'deploy' ? 'deploy' : tx.kind === 'view' ? 'view' : 'call';

  return (
    <article className={`tx-row ${statusClass}`}>
      <header className="tx-row__head">
        <span className={`tx-kind tx-kind--${tx.kind}`}>{kindLabel}</span>
        <code className="tx-hash" title={tx.hash}>
          {tx.hash.slice(0, 12)}…
        </code>
        <span className="tx-block">#{tx.blockNumber}</span>
        <span className="tx-status">{tx.status}</span>
      </header>

      <dl className="tx-meta">
        <dt>from</dt>
        <dd title={tx.from}>
          <code>{shortAddress(tx.from)}</code>
        </dd>
        {tx.to && (
          <>
            <dt>to</dt>
            <dd title={tx.to}>
              <code>{shortAddress(tx.to)}</code>
            </dd>
          </>
        )}
        {tx.action && (
          <>
            <dt>action</dt>
            <dd>
              <code>{tx.action}</code>
              {tx.args && tx.args.length > 0 && (
                <span className="tx-args">({tx.args.map(String).join(', ')})</span>
              )}
            </dd>
          </>
        )}
        {tx.kind === 'view' && tx.returnValue !== undefined && (
          <>
            <dt>returns</dt>
            <dd>
              <code>{formatReturn(tx.returnValue)}</code>
            </dd>
          </>
        )}
        {tx.status === 'reverted' && tx.revertReason && (
          <>
            <dt>reason</dt>
            <dd className="tx-revert">{tx.revertReason}</dd>
          </>
        )}
        {tx.kind !== 'view' && (
          <>
            <dt>gas</dt>
            <dd>{tx.gasUsed.toString()}</dd>
          </>
        )}
      </dl>

      {tx.events.length > 0 && (
        <ul className="tx-events">
          {tx.events.map((ev, i) => (
            <li key={i}>
              <code className="tx-event-name">{ev.name}</code>
              <span className="tx-event-args">
                {Object.entries(ev.args)
                  .map(([k, v]) => `${k}: ${formatEventArg(v)}`)
                  .join(', ')}
              </span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

function formatReturn(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'string') return v === '' ? '""' : v;
  if (typeof v === 'bigint') return v.toString();
  try {
    return JSON.stringify(v, (_k, val) =>
      typeof val === 'bigint' ? val.toString() : val,
    );
  } catch {
    return String(v);
  }
}

function formatEventArg(v: unknown): string {
  if (typeof v === 'string' && v.startsWith('0x') && v.length > 10) {
    return shortAddress(v);
  }
  return String(v);
}
