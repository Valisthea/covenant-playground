import { useStore } from '../../lib/store';
import { getMockChain } from '../../lib/mockchain';

/**
 * Mine blocks / advance time / reset the MockChain. Useful for demoing
 * examples that gate on `block.timestamp` (auctions, vesting, ceremonies).
 */
export function ChainControls() {
  useStore((s) => s.chainRev);
  const mineBlocks = useStore((s) => s.mineBlocks);
  const advanceTime = useStore((s) => s.advanceTime);
  const resetChain = useStore((s) => s.resetChain);

  const chain = getMockChain();
  const timestamp = new Date(chain.clock.timestamp * 1000).toISOString();

  return (
    <section className="deploy-card">
      <h3 className="deploy-card__title">Chain</h3>
      <dl className="chain-meta">
        <dt>Block</dt>
        <dd>#{chain.clock.blockNumber}</dd>
        <dt>Clock</dt>
        <dd title={String(chain.clock.timestamp)}>{timestamp.slice(11, 19)} UTC</dd>
      </dl>
      <div className="chain-controls">
        <button type="button" className="pg-btn pg-btn--ghost" onClick={() => mineBlocks(1)}>
          +1 block
        </button>
        <button type="button" className="pg-btn pg-btn--ghost" onClick={() => advanceTime(3600)}>
          +1 hour
        </button>
        <button type="button" className="pg-btn pg-btn--ghost" onClick={() => advanceTime(86400)}>
          +1 day
        </button>
        <button
          type="button"
          className="pg-btn pg-btn--ghost pg-btn--danger"
          onClick={resetChain}
          title="Wipe deployed contracts and transactions"
        >
          Reset
        </button>
      </div>
    </section>
  );
}
