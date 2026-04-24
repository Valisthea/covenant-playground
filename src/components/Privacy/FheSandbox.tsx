import { useState } from 'react';
import {
  fheAdd,
  fheDecrypt,
  fheEncrypt,
  fheGt,
  fheMul,
  fheSub,
  shortBytes,
  type FheCiphertext,
} from '../../lib/privacy-sim';

type Op = 'add' | 'sub' | 'mul' | 'gt';

/**
 * Interactive FHE playground. Pick two plaintext values, encrypt them,
 * run a homomorphic op, decrypt the result. Values are arbitrary bigints.
 */
export function FheSandbox() {
  const [a, setA] = useState('100');
  const [b, setB] = useState('25');
  const [op, setOp] = useState<Op>('add');
  const [encA, setEncA] = useState<FheCiphertext | null>(null);
  const [encB, setEncB] = useState<FheCiphertext | null>(null);
  const [encRes, setEncRes] = useState<FheCiphertext | null>(null);
  const [decResult, setDecResult] = useState<bigint | null>(null);

  const encryptBoth = () => {
    try {
      const va = BigInt(a);
      const vb = BigInt(b);
      setEncA(fheEncrypt(va, 'a'));
      setEncB(fheEncrypt(vb, 'b'));
      setEncRes(null);
      setDecResult(null);
    } catch {
      // ignore — input not a valid bigint
    }
  };

  const runOp = () => {
    if (!encA || !encB) return;
    const res =
      op === 'add'
        ? fheAdd(encA, encB)
        : op === 'sub'
          ? fheSub(encA, encB)
          : op === 'mul'
            ? fheMul(encA, encB)
            : fheGt(encA, encB);
    setEncRes(res);
    setDecResult(null);
  };

  const decrypt = () => {
    if (!encRes) return;
    setDecResult(fheDecrypt(encRes));
  };

  return (
    <div className="sandbox">
      <p className="sandbox-intro">
        Homomorphic ops run over ciphertexts — the chain never sees the
        plaintexts. Encrypt two values, apply an op, then decrypt the result
        to see the equivalence hold.
      </p>

      <div className="sandbox-inputs">
        <label>
          <span>a =</span>
          <input
            type="text"
            value={a}
            onChange={(e) => setA(e.target.value)}
            placeholder="100"
          />
        </label>
        <label>
          <span>b =</span>
          <input
            type="text"
            value={b}
            onChange={(e) => setB(e.target.value)}
            placeholder="25"
          />
        </label>
      </div>

      <div className="sandbox-actions">
        <button type="button" className="pg-btn pg-btn--primary" onClick={encryptBoth}>
          Encrypt both
        </button>
      </div>

      {encA && encB && (
        <div className="sandbox-row">
          <CiphertextCard label="enc(a)" ct={encA} />
          <CiphertextCard label="enc(b)" ct={encB} />
        </div>
      )}

      <div className="sandbox-op-row">
        <label className="sandbox-op-label">
          <span>op</span>
          <select value={op} onChange={(e) => setOp(e.target.value as Op)}>
            <option value="add">fhe_add</option>
            <option value="sub">fhe_sub</option>
            <option value="mul">fhe_mul</option>
            <option value="gt">fhe_gt</option>
          </select>
        </label>
        <button
          type="button"
          className="pg-btn"
          disabled={!encA || !encB}
          onClick={runOp}
        >
          Run {op}
        </button>
      </div>

      {encRes && (
        <>
          <div className="sandbox-row">
            <CiphertextCard
              label={`enc(a ${opSymbol(op)} b)`}
              ct={encRes}
              accent
            />
          </div>

          <div className="sandbox-actions">
            <button type="button" className="pg-btn pg-btn--ghost" onClick={decrypt}>
              Decrypt result
            </button>
          </div>

          {decResult !== null && (
            <div className="sandbox-verdict">
              <span>plaintext result:</span>{' '}
              <code>{decResult.toString()}</code>
              {op === 'gt' && (
                <span className="sandbox-verdict__note">
                  {decResult === 1n ? '(a > b ✓)' : '(a ≤ b)'}
                </span>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function CiphertextCard({
  label,
  ct,
  accent,
}: {
  label: string;
  ct: FheCiphertext;
  accent?: boolean;
}) {
  return (
    <div className={`ct-card ${accent ? 'ct-card--accent' : ''}`}>
      <h5>{label}</h5>
      <dl>
        <dt>scheme</dt>
        <dd>{ct.scheme}</dd>
        <dt>size</dt>
        <dd>{ct.bytes.length} B</dd>
        <dt>bytes</dt>
        <dd>
          <code title={bytesFull(ct.bytes)}>{shortBytes(ct.bytes, 8, 6)}</code>
        </dd>
      </dl>
    </div>
  );
}

function opSymbol(op: Op): string {
  switch (op) {
    case 'add':
      return '+';
    case 'sub':
      return '−';
    case 'mul':
      return '×';
    case 'gt':
      return '>';
  }
}

function bytesFull(b: Uint8Array): string {
  let s = '0x';
  for (let i = 0; i < b.length; i++) s += b[i].toString(16).padStart(2, '0');
  return s;
}
