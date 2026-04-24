import { useState } from 'react';
import { shortBytes, zkProve, zkVerify, type ZkProof } from '../../lib/privacy-sim';

/**
 * Demo of a zero-knowledge proof flow. The prover has a private secret
 * and claims a public hash commits to it. The verifier accepts the proof
 * + public inputs without learning the secret.
 */
export function ZkSandbox() {
  const [secret, setSecret] = useState('42');
  const [claim, setClaim] = useState('100');
  const [nullifierSecret, setNullifierSecret] = useState('0xdeadbeef');
  const [proof, setProof] = useState<ZkProof | null>(null);
  const [verifyResult, setVerifyResult] = useState<{
    ok: boolean;
    reason?: string;
  } | null>(null);
  const [tamperedClaim, setTamperedClaim] = useState('');

  const generate = () => {
    try {
      const sec = BigInt(secret);
      const c = BigInt(claim);
      const ns = BigInt(nullifierSecret);
      setProof(
        zkProve({
          privateInputs: [sec],
          publicInputs: [c],
          nullifierSecret: ns,
        }),
      );
      setVerifyResult(null);
      setTamperedClaim('');
    } catch {
      // ignore bad bigint
    }
  };

  const verify = (useTampered: boolean) => {
    if (!proof) return;
    const expected = useTampered && tamperedClaim.trim()
      ? [BigInt(tamperedClaim)]
      : [BigInt(claim)];
    setVerifyResult(zkVerify(proof, expected));
  };

  return (
    <div className="sandbox">
      <p className="sandbox-intro">
        The prover generates a SNARK over (private, public) inputs. The verifier
        only sees the proof bytes and the public inputs — the private secret
        stays local. The nullifier is a public value that prevents
        double-spending without revealing which UTXO was spent.
      </p>

      <div className="sandbox-inputs">
        <label>
          <span>private · secret</span>
          <input
            type="text"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="42"
          />
        </label>
        <label>
          <span>public · claim</span>
          <input
            type="text"
            value={claim}
            onChange={(e) => setClaim(e.target.value)}
            placeholder="100"
          />
        </label>
        <label>
          <span>nullifier seed</span>
          <input
            type="text"
            value={nullifierSecret}
            onChange={(e) => setNullifierSecret(e.target.value)}
            placeholder="0x…"
          />
        </label>
      </div>

      <div className="sandbox-actions">
        <button type="button" className="pg-btn pg-btn--primary" onClick={generate}>
          Generate proof
        </button>
      </div>

      {proof && (
        <>
          <div className="sandbox-row">
            <div className="ct-card">
              <h5>commitment</h5>
              <dl>
                <dt>bytes</dt>
                <dd>
                  <code>{shortBytes(proof.commitment)}</code>
                </dd>
              </dl>
            </div>
            <div className="ct-card">
              <h5>nullifier</h5>
              <dl>
                <dt>bytes</dt>
                <dd>
                  <code>{shortBytes(proof.nullifier)}</code>
                </dd>
              </dl>
            </div>
            <div className="ct-card ct-card--accent">
              <h5>proof (Groth16-shaped)</h5>
              <dl>
                <dt>size</dt>
                <dd>{proof.proof.length} B</dd>
                <dt>bytes</dt>
                <dd>
                  <code>{shortBytes(proof.proof, 10, 6)}</code>
                </dd>
                <dt>public inputs</dt>
                <dd>[{proof.publicInputs.map((x) => x.toString()).join(', ')}]</dd>
              </dl>
            </div>
          </div>

          <div className="sandbox-op-row">
            <button type="button" className="pg-btn" onClick={() => verify(false)}>
              Verify (honest)
            </button>
            <label className="sandbox-op-label">
              <span>or tamper</span>
              <input
                type="text"
                value={tamperedClaim}
                onChange={(e) => setTamperedClaim(e.target.value)}
                placeholder="999"
                style={{ width: '80px' }}
              />
            </label>
            <button
              type="button"
              className="pg-btn pg-btn--ghost"
              onClick={() => verify(true)}
              disabled={!tamperedClaim.trim()}
            >
              Verify with tampered claim
            </button>
          </div>

          {verifyResult && (
            <div
              className={`sandbox-verdict ${verifyResult.ok ? 'sandbox-verdict--ok' : 'sandbox-verdict--bad'}`}
            >
              {verifyResult.ok ? (
                <>
                  <strong>verified ✓</strong>
                  <span> proof accepts the public inputs without revealing the secret.</span>
                </>
              ) : (
                <>
                  <strong>rejected ✗</strong>
                  <span> reason: {verifyResult.reason ?? 'unknown'}</span>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
