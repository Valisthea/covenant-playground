/**
 * /verify — Covenant source verification.
 *
 * No block explorer can verify a Covenant contract: Blockscout ships 8
 * verification methods and every one of them is Solidity or Vyper. So the
 * source of a deployed Covenant contract is unauditable by anyone but its
 * author — which is exactly the trust gap this page closes.
 *
 * The check is simple and total: recompile the source in-browser with the
 * pinned compiler, read the deployed runtime code over RPC, compare the bytes.
 * Either they are identical or they are not.
 */

import { useState } from 'react';
import { ShowcaseLayout } from '../Showcases/ShowcaseLayout';
import { networkOptions } from '../../lib/networks';
import { verifyContract, type VerifyResult } from '../../lib/verify';
import '../../styles/verify.css';

const M6_ADDRESS = '0x3E80F8c7911240e6092D523af79B13c046bd2FdE';
const M6_NETWORK = 'robinhood-testnet';
const M6_SOURCE_URL = '/examples/kairos_coin.cov';

export function VerifyPage() {
  const nets = networkOptions();
  const [networkId, setNetworkId] = useState(M6_NETWORK);
  const [address, setAddress] = useState('');
  const [source, setSource] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      setResult(await verifyContract({ source, networkId, address }));
    } catch (err) {
      setResult({
        status: 'error',
        summary: `Unexpected failure: ${String(err)}`,
        compilerVersion: null,
        local: null,
        onchain: null,
        firstDiffAt: null,
        abi: null,
        selectors: [],
        storageLayout: [],
        diagnostics: [],
      });
    } finally {
      setBusy(false);
    }
  }

  const badge =
    result?.status === 'match'
      ? { cls: 'is-match', label: 'Verified' }
      : result?.status === 'mismatch'
        ? { cls: 'is-mismatch', label: 'No match' }
        : { cls: 'is-warn', label: 'Inconclusive' };

  return (
    <ShowcaseLayout milestone="Tools" title="Verify source" network="any EVM chain">
      <div className="verify-page">
        <header className="verify-hero">
          <h1>Verify a Covenant contract</h1>
          <p>
            Recompiles your <code>.cov</code> source in this browser and compares the result,
            byte for byte, against the runtime code deployed on chain. Nothing is uploaded —
            the compiler runs client-side.
          </p>
          <p className="verify-hero-note">
            Block explorers can&apos;t do this: Blockscout offers 8 verification methods and all
            of them are Solidity or Vyper. This page exists because Covenant contracts would
            otherwise be permanently unverifiable.
          </p>
        </header>

        <form onSubmit={handleVerify} className="contract-form">
          <div className="contract-form-row">
            <label className="contract-form-field">
              <span className="contract-form-label">Network</span>
              <select
                value={networkId}
                onChange={(e) => setNetworkId(e.target.value)}
                className="contract-form-input"
              >
                {nets.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="contract-form-field contract-form-field-grow">
              <span className="contract-form-label">Contract address</span>
              <input
                type="text"
                placeholder="0x…"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="contract-form-input"
                spellCheck={false}
              />
            </label>
          </div>

          <label className="contract-form-field">
            <span className="contract-form-label">Covenant source (.cov)</span>
            <textarea
              className="contract-form-textarea contract-form-textarea-mono"
              rows={14}
              placeholder={'token MyCoin {\n    symbol: "MYC"\n    …\n}'}
              value={source}
              onChange={(e) => setSource(e.target.value)}
              spellCheck={false}
            />
          </label>

          <div className="verify-actions">
            <button type="submit" className="pg-btn" disabled={busy || !source.trim() || !address.trim()}>
              {busy ? 'Verifying…' : 'Verify'}
            </button>
            <button
              type="button"
              className="pg-btn"
              onClick={async () => {
                setResult(null);
                setNetworkId(M6_NETWORK);
                setAddress(M6_ADDRESS);
                try {
                  const res = await fetch(M6_SOURCE_URL);
                  setSource(await res.text());
                } catch {
                  /* leave the textarea as-is; the user can paste manually */
                }
              }}
            >
              Load M6 example
            </button>
          </div>
          <small className="contract-form-hint">
            Paste the exact source that was compiled. Comments and formatting are free —
            they don&apos;t reach the bytecode — but a different compiler version will not match.
          </small>
        </form>

        {result && (
          <section className={`verify-result ${badge.cls}`} aria-live="polite">
            <header className="verify-result-head">
              <span className="verify-badge">{badge.label}</span>
              <p className="verify-summary">{result.summary}</p>
            </header>

            {(result.local || result.onchain) && (
              <table className="verify-table">
                <thead>
                  <tr>
                    <th>Source</th>
                    <th>Bytes</th>
                    <th>sha256 of runtime bytecode</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Your source, recompiled</td>
                    <td>{result.local?.bytes ?? '—'}</td>
                    <td className="verify-hash">{result.local?.sha256 ?? '—'}</td>
                  </tr>
                  <tr>
                    <td>Deployed on chain</td>
                    <td>{result.onchain?.bytes ?? '—'}</td>
                    <td className="verify-hash">{result.onchain?.sha256 ?? '—'}</td>
                  </tr>
                </tbody>
              </table>
            )}

            <dl className="verify-meta">
              <div>
                <dt>Compiler</dt>
                <dd>{result.compilerVersion ? `Covenant ${result.compilerVersion}` : '—'}</dd>
              </div>
              {result.firstDiffAt !== null && (
                <div>
                  <dt>First differing nibble</dt>
                  <dd>{result.firstDiffAt}</dd>
                </div>
              )}
            </dl>

            {result.diagnostics.length > 0 && (
              <div className="verify-diags">
                <h3>Compiler diagnostics</h3>
                <ul>
                  {result.diagnostics.map((d, i) => (
                    <li key={i}>
                      <code>{d.code}</code> {d.message}
                      {d.line ? ` (line ${d.line})` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.status === 'match' && result.selectors.length > 0 && (
              <div className="verify-surface">
                <h3>Verified surface — {result.selectors.length} functions</h3>
                <ul className="verify-selectors">
                  {result.selectors.map((s) => (
                    <li key={s.name}>
                      <code>{s.selector}</code> {s.name}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}
      </div>
    </ShowcaseLayout>
  );
}
