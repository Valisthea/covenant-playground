import { useState } from 'react';
import {
  ceremonyContribute,
  ceremonyDestroy,
  ceremonyFinalize,
  ceremonySetup,
  newCeremony,
  shortBytes,
  type AmnesiaCeremony,
} from '../../lib/privacy-sim';

const CONTRIBUTORS = ['Alice', 'Bob', 'Carol', 'Dave'];

/**
 * Walk-through of a one-way MPC + cryptographic amnesia ceremony.
 * State machine: idle → gathering → finalized → destroyed.
 * The destroyed state is terminal — the language enforces that no
 * action body can return to an earlier variant.
 */
export function AmnesiaSandbox() {
  const [c, setC] = useState<AmnesiaCeremony>(() => newCeremony());
  const [error, setError] = useState<string | null>(null);
  const [entropyHex, setEntropyHex] = useState('0xdeadbeef');
  const [contributor, setContributor] = useState(CONTRIBUTORS[0]);

  const safe = (fn: () => AmnesiaCeremony) => {
    try {
      setC(fn());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="sandbox">
      <p className="sandbox-intro">
        ERC-8228 cryptographic amnesia. Contributors fold entropy into the
        transcript, the ceremony finalizes, then a Wesolowski VDF + keccak-bound
        destruction proof terminates the state machine. The language guarantees
        no path back to an earlier state.
      </p>

      <ol className="amn-states">
        <StateNode label="Idle" active={c.state === 'idle'} done={c.state !== 'idle'} />
        <StateNode label="Gathering" active={c.state === 'gathering'} done={['finalized', 'destroyed'].includes(c.state)} />
        <StateNode label="Finalized" active={c.state === 'finalized'} done={c.state === 'destroyed'} />
        <StateNode label="Destroyed" active={c.state === 'destroyed'} done={false} terminal />
      </ol>

      {error && (
        <div className="sandbox-error" role="alert">
          {error}
        </div>
      )}

      <div className="amn-actions">
        <button
          type="button"
          className="pg-btn pg-btn--primary"
          disabled={c.state !== 'idle'}
          onClick={() => safe(() => ceremonySetup(c))}
        >
          1. setup()
        </button>

        <div className="amn-contribute">
          <label>
            <span>contributor</span>
            <select
              value={contributor}
              onChange={(e) => setContributor(e.target.value)}
              disabled={c.state !== 'gathering'}
            >
              {CONTRIBUTORS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>entropy (hex)</span>
            <input
              type="text"
              value={entropyHex}
              onChange={(e) => setEntropyHex(e.target.value)}
              disabled={c.state !== 'gathering'}
            />
          </label>
          <button
            type="button"
            className="pg-btn"
            disabled={c.state !== 'gathering'}
            onClick={() =>
              safe(() => ceremonyContribute(c, contributor, entropyHex))
            }
          >
            2. contribute()
          </button>
        </div>

        <button
          type="button"
          className="pg-btn"
          disabled={c.state !== 'gathering' || c.contributions.length === 0}
          onClick={() => safe(() => ceremonyFinalize(c))}
        >
          3. finalize()
        </button>

        <button
          type="button"
          className="pg-btn pg-btn--danger"
          disabled={c.state !== 'finalized'}
          onClick={() => safe(() => ceremonyDestroy(c))}
        >
          4. @destroy()
        </button>

        <button
          type="button"
          className="pg-btn pg-btn--ghost"
          onClick={() => {
            setC(newCeremony());
            setError(null);
          }}
        >
          Restart
        </button>
      </div>

      {c.contributions.length > 0 && (
        <section className="amn-section">
          <h4>Contributions</h4>
          <ul className="amn-contrib-list">
            {c.contributions.map((x, i) => (
              <li key={i}>
                <span className="amn-contrib-name">{x.contributor}</span>
                <code className="amn-contrib-hash">
                  transcript → {shortBytes(x.transcriptAfter)}
                </code>
              </li>
            ))}
          </ul>
        </section>
      )}

      {c.state === 'destroyed' && (
        <section className="amn-section amn-destroyed">
          <h4>Destruction proof</h4>
          <dl className="chain-meta">
            <dt>VDF output</dt>
            <dd>
              <code>{shortBytes(c.vdfOutput, 10, 6)}</code>
            </dd>
            <dt>keccak bind</dt>
            <dd>
              <code>{shortBytes(c.destructionProof, 10, 6)}</code>
            </dd>
            <dt>destroyed at</dt>
            <dd>{c.destroyedAt ? new Date(c.destroyedAt).toISOString().slice(11, 19) : '—'}</dd>
          </dl>
          <p className="amn-terminal-note">
            Terminal state — the on-chain enum can never return to Idle, Gathering,
            or Finalized. Private material is provably gone.
          </p>
        </section>
      )}
    </div>
  );
}

function StateNode({
  label,
  active,
  done,
  terminal,
}: {
  label: string;
  active: boolean;
  done: boolean;
  terminal?: boolean;
}) {
  return (
    <li
      className={`amn-state ${active ? 'amn-state--active' : ''} ${done ? 'amn-state--done' : ''} ${terminal ? 'amn-state--terminal' : ''}`}
    >
      <span className="amn-state-dot" aria-hidden="true" />
      <span className="amn-state-label">{label}</span>
    </li>
  );
}
