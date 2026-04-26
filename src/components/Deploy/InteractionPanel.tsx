import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../lib/store';
import {
  shortAddress,
  type AbiFunction,
  type TxReceipt,
} from '../../lib/mockchain';

/**
 * Per-action input form. Sprint 24 made this target-aware: the active
 * contract is resolved via the store's `getDeployedContracts` selector
 * so the same panel works against MockChain or Sepolia. The actual
 * call dispatch happens in `callAction` / `callActionOnSepolia`.
 */
export function InteractionPanel() {
  useStore((s) => s.chainRev);
  const activeContract = useStore((s) => s.activeContract);
  const target = useStore((s) => s.target);
  const isCallingSepolia = useStore((s) => s.isCallingSepolia);
  const getDeployedContracts = useStore((s) => s.getDeployedContracts);

  if (!activeContract) return null;
  const contract = getDeployedContracts().find(
    (c) => c.address.toLowerCase() === activeContract.toLowerCase(),
  );
  if (!contract) return null;

  const views = contract.abi.filter(
    (f) => f.stateMutability === 'view' || f.stateMutability === 'pure',
  );
  const mutating = contract.abi.filter(
    (f) => f.stateMutability !== 'view' && f.stateMutability !== 'pure',
  );

  return (
    <section className="deploy-card interaction-card">
      <h3 className="deploy-card__title">
        Interact · <span className="interaction-sub">{contract.name}</span>
      </h3>
      <p className="interaction-addr">
        at <code>{shortAddress(contract.address)}</code>
      </p>

      {target === 'sepolia' && isCallingSepolia && (
        <div className="interaction-pending">
          Awaiting MetaMask + 1 confirmation… (~30s)
        </div>
      )}

      {mutating.length > 0 && (
        <>
          <h4 className="interaction-section">Actions</h4>
          <div className="interaction-list">
            {mutating.map((fn) => (
              <ActionRow key={fn.name} fn={fn} target={target} />
            ))}
          </div>
        </>
      )}

      {views.length > 0 && (
        <>
          <h4 className="interaction-section">Views</h4>
          <div className="interaction-list">
            {views.map((fn) => (
              <ActionRow key={fn.name} fn={fn} target={target} isView />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function ActionRow({
  fn,
  isView,
  target,
}: {
  fn: AbiFunction;
  isView?: boolean;
  target: 'mockchain' | 'sepolia';
}) {
  const callAction = useStore((s) => s.callAction);
  // Sprint 26 audit (KSR-CVN-PRELIM-007): subscribe to sepoliaTxs so
  // we can hydrate `lastResult` once the async tx confirms — without
  // this, every Sepolia action call left the inline result block
  // empty even though the data was sitting in TxHistoryPane.
  const sepoliaTxs = useStore((s) => s.sepoliaTxs);
  const [args, setArgs] = useState<string>('');
  const [lastResult, setLastResult] = useState<TxReceipt | null>(null);
  // Capture the moment the user clicked Call, so we can match the
  // resulting Sepolia receipt by timestamp window without false
  // positives from earlier txs of the same action.
  const callStartedAtRef = useRef<number>(0);

  const onCall = () => {
    const parsed = args.trim()
      ? args.split(',').map((s) => s.trim())
      : [];
    callStartedAtRef.current = Math.floor(Date.now() / 1000);
    const receipt = callAction(fn.name, parsed);
    // MockChain returns the receipt synchronously. Sepolia returns null
    // here; the matching receipt arrives via sepoliaTxs (handled by
    // the useEffect below).
    if (receipt) setLastResult(receipt);
  };

  // Sepolia hydration: when a new tx with this action's name lands in
  // sepoliaTxs after `callStartedAt`, surface it inline. Skipped on
  // MockChain because callAction already populated lastResult sync.
  useEffect(() => {
    if (target !== 'sepolia') return;
    if (callStartedAtRef.current === 0) return;
    // sepoliaTxs is newest-first per the store. Find the first tx for
    // this action since the click; ignore stale matches from earlier
    // calls of the same action name.
    const match = sepoliaTxs.find(
      (tx) => tx.action === fn.name && tx.timestamp >= callStartedAtRef.current,
    );
    if (match && match !== lastResult) {
      setLastResult(match);
    }
  }, [sepoliaTxs, target, fn.name, lastResult]);

  const buttonClass = isView
    ? 'pg-btn pg-btn--ghost pg-btn--sm'
    : target === 'sepolia'
      ? 'pg-btn pg-btn--primary pg-btn--live pg-btn--sm'
      : 'pg-btn pg-btn--primary pg-btn--sm';

  return (
    <div className="action-row">
      <div className="action-row__head">
        <code className="action-row__name">{fn.name}</code>
        <button
          type="button"
          className={buttonClass}
          onClick={onCall}
        >
          {isView ? 'Query' : target === 'sepolia' ? 'Call (Sepolia)' : 'Call'}
        </button>
      </div>
      <input
        type="text"
        className="action-row__args"
        placeholder="args (comma-separated, optional)"
        value={args}
        onChange={(e) => setArgs(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onCall();
        }}
      />
      {lastResult && (
        <div
          className={`action-row__result action-row__result--${lastResult.status}`}
        >
          {lastResult.status === 'reverted' ? (
            <span>reverted: {lastResult.revertReason ?? 'unknown'}</span>
          ) : isView ? (
            <span>
              returned{' '}
              <code>{formatReturn(lastResult.returnValue)}</code>
            </span>
          ) : (
            <span>
              tx <code>{lastResult.hash.slice(0, 10)}…</code> · gas{' '}
              {lastResult.gasUsed.toString()} · block #{lastResult.blockNumber}
            </span>
          )}
        </div>
      )}
    </div>
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
