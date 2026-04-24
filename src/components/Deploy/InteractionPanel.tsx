import { useState } from 'react';
import { useStore } from '../../lib/store';
import {
  getMockChain,
  shortAddress,
  type AbiFunction,
  type TxReceipt,
} from '../../lib/mockchain';

/**
 * Per-action input form. Inputs are stored as raw strings; MockChain
 * doesn't parse them today (the stub ABI has no input schema). When
 * real ABI types come online this becomes a typed decoder.
 */
export function InteractionPanel() {
  useStore((s) => s.chainRev);
  const activeContract = useStore((s) => s.activeContract);

  if (!activeContract) return null;
  const contract = getMockChain().contracts.get(activeContract);
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

      {mutating.length > 0 && (
        <>
          <h4 className="interaction-section">Actions</h4>
          <div className="interaction-list">
            {mutating.map((fn) => (
              <ActionRow key={fn.name} fn={fn} />
            ))}
          </div>
        </>
      )}

      {views.length > 0 && (
        <>
          <h4 className="interaction-section">Views</h4>
          <div className="interaction-list">
            {views.map((fn) => (
              <ActionRow key={fn.name} fn={fn} isView />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function ActionRow({ fn, isView }: { fn: AbiFunction; isView?: boolean }) {
  const callAction = useStore((s) => s.callAction);
  const [args, setArgs] = useState<string>('');
  const [lastResult, setLastResult] = useState<TxReceipt | null>(null);

  const onCall = () => {
    const parsed = args.trim()
      ? args.split(',').map((s) => s.trim())
      : [];
    const receipt = callAction(fn.name, parsed);
    if (receipt) setLastResult(receipt);
  };

  return (
    <div className="action-row">
      <div className="action-row__head">
        <code className="action-row__name">{fn.name}</code>
        <button
          type="button"
          className={`pg-btn ${isView ? 'pg-btn--ghost' : 'pg-btn--primary'} pg-btn--sm`}
          onClick={onCall}
        >
          {isView ? 'Query' : 'Call'}
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
