/**
 * /contract/:chain/:address — auto-generated Read/Write UI from ABI.
 *
 * For each function in the saved ABI :
 *   - view / pure → read panel : input fields per param, "call" button,
 *                                 displays return value
 *   - nonpayable / payable → write panel : input fields per param,
 *                                          "send" button, requires wallet,
 *                                          displays tx hash + Etherscan link
 *
 * Plus :
 *   - events panel (V0.9.x — listens to logs and decodes via Interface)
 *   - errors registry (decoded if a tx reverts)
 *   - recent tx history (this session)
 *
 * If the ABI isn't in localStorage for this (chain, address) pair,
 * redirect to /contract landing.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  BrowserProvider,
  Contract,
  Interface,
  JsonRpcProvider,
  isAddress,
  type FunctionFragment,
  type InterfaceAbi,
  type ParamType,
} from 'ethers';
import { ShowcaseLayout } from '../Showcases/ShowcaseLayout';
import { getNetwork, explorerAddressUrl, explorerTxUrl } from '../../lib/networks';
import { loadContract } from '../../lib/contract-storage';

type FnKind = 'view' | 'pure' | 'nonpayable' | 'payable';

interface CallResult {
  ok: boolean;
  value?: string;
  error?: string;
  txHash?: string;
}

function shortAddr(a: string): string {
  if (!a || a.length < 10) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '(null)';
  if (typeof v === 'bigint') return v.toString();
  if (typeof v === 'string') return v;
  if (typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return `[ ${v.map(formatValue).join(', ')} ]`;
  if (typeof v === 'object') {
    try {
      return JSON.stringify(v, (_k, val) => (typeof val === 'bigint' ? val.toString() : val));
    } catch {
      return '(unserializable)';
    }
  }
  return String(v);
}

function parseInputValue(raw: string, paramType: ParamType): unknown {
  const t = paramType.type;
  if (t === 'address') {
    if (!raw.trim()) throw new Error(`${paramType.name || 'address'}: empty`);
    return raw.trim();
  }
  if (t === 'bool') {
    return raw.toLowerCase() === 'true';
  }
  if (t.startsWith('uint') || t.startsWith('int')) {
    if (!raw.trim()) throw new Error(`${paramType.name || t}: empty`);
    return BigInt(raw.trim());
  }
  if (t === 'string') return raw;
  if (t === 'bytes' || t.startsWith('bytes')) {
    return raw.trim();
  }
  // Arrays / tuples / etc. — parse as JSON for now.
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`${paramType.name || t}: expected JSON for type ${t}`);
  }
}

interface FnPanelProps {
  iface: Interface;
  contractRead: Contract;
  contractWrite: Contract | null;
  fragment: FunctionFragment;
  net: ReturnType<typeof getNetwork>;
}

function FnPanel({ iface, contractRead, contractWrite, fragment, net }: FnPanelProps) {
  const kind = fragment.stateMutability as FnKind;
  const isRead = kind === 'view' || kind === 'pure';
  const [inputs, setInputs] = useState<string[]>(() => fragment.inputs.map(() => ''));
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CallResult | null>(null);

  async function call() {
    setBusy(true);
    setResult(null);
    try {
      let parsedArgs: unknown[];
      try {
        parsedArgs = fragment.inputs.map((p, i) => parseInputValue(inputs[i] ?? '', p));
      } catch (e) {
        throw e instanceof Error ? e : new Error('Invalid input');
      }

      if (isRead) {
        const fn = contractRead.getFunction(fragment.name);
        const value = await fn.staticCall(...parsedArgs);
        setResult({ ok: true, value: formatValue(value) });
      } else {
        if (!contractWrite) {
          throw new Error('Connect a wallet first.');
        }
        const fn = contractWrite.getFunction(fragment.name);
        const tx = await fn(...parsedArgs);
        setResult({ ok: true, txHash: tx.hash, value: 'tx sent — waiting for confirm' });
        const receipt = await tx.wait();
        setResult({
          ok: true,
          txHash: tx.hash,
          value: `tx confirmed in block ${receipt?.blockNumber ?? '?'}`,
        });
      }
    } catch (e: unknown) {
      // Try to decode revert data if error looks like a custom error.
      let msg = e instanceof Error ? e.message : String(e);
      const errData = (e as { data?: string }).data;
      if (errData && typeof errData === 'string' && errData.startsWith('0x')) {
        try {
          const decoded = iface.parseError(errData);
          if (decoded) {
            msg = `revert ${decoded.name}(${decoded.args.map(formatValue).join(', ')})`;
          }
        } catch {
          /* fallthrough — keep raw msg */
        }
      }
      setResult({ ok: false, error: msg });
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className={`fn-panel fn-panel-${isRead ? 'read' : 'write'}`}>
      <header className="fn-panel-header">
        <span className="fn-panel-kind">{kind}</span>
        <code className="fn-panel-sig">
          {fragment.name}(
          {fragment.inputs.map((p) => `${p.type}${p.name ? ' ' + p.name : ''}`).join(', ')})
          {fragment.outputs.length > 0 && (
            <>
              <span className="fn-panel-arrow"> → </span>
              {fragment.outputs.map((p) => p.type).join(', ')}
            </>
          )}
        </code>
      </header>

      {fragment.inputs.length > 0 && (
        <div className="fn-panel-inputs">
          {fragment.inputs.map((p, i) => (
            <label key={i} className="fn-panel-input">
              <span>
                <code>{p.name || `arg${i}`}</code>{' '}
                <small>: {p.type}</small>
              </span>
              <input
                type="text"
                value={inputs[i] ?? ''}
                onChange={(e) => {
                  const next = [...inputs];
                  next[i] = e.target.value;
                  setInputs(next);
                }}
                placeholder={p.type}
                spellCheck={false}
                autoComplete="off"
              />
            </label>
          ))}
        </div>
      )}

      <button
        type="button"
        className="fn-panel-call-btn"
        onClick={() => void call()}
        disabled={busy || (!isRead && !contractWrite)}
        title={!isRead && !contractWrite ? 'Connect wallet to enable writes' : undefined}
      >
        {busy ? '⟳' : isRead ? 'Call' : 'Send'}
      </button>

      {result && (
        <div className={`fn-panel-result fn-panel-result-${result.ok ? 'ok' : 'err'}`}>
          {result.ok ? (
            <>
              <code>{result.value}</code>
              {result.txHash && net && (
                <a
                  href={explorerTxUrl(net, result.txHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="fn-panel-tx-link"
                >
                  view on {net.explorerBase.replace('https://', '').split('/')[0]} →
                </a>
              )}
            </>
          ) : (
            <code className="fn-panel-err-text">{result.error}</code>
          )}
        </div>
      )}
    </article>
  );
}

export function ContractInspector() {
  const { chain: chainParam, address: addressParam } = useParams<{
    chain: string;
    address: string;
  }>();
  const navigate = useNavigate();

  const chain = chainParam ?? '';
  const address = addressParam ?? '';
  const net = getNetwork(chain);
  const saved = useMemo(() => loadContract(chain, address), [chain, address]);

  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [chainOk, setChainOk] = useState(false);
  const [walletErr, setWalletErr] = useState<string | null>(null);

  // Validate route + saved
  useEffect(() => {
    if (!net || !isAddress(address) || !saved) {
      const t = setTimeout(() => navigate('/contract'), 100);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [net, address, saved, navigate]);

  // Build read provider + interface + contract
  const { iface, readContract } = useMemo(() => {
    if (!net || !saved) return { iface: null, readContract: null };
    try {
      const i = new Interface(saved.abi as InterfaceAbi);
      const provider = new JsonRpcProvider(net.publicRpc);
      const c = new Contract(address, i, provider);
      return { iface: i, readContract: c };
    } catch {
      return { iface: null, readContract: null };
    }
  }, [net, saved, address]);

  // Wallet write contract — refreshed when wallet connects
  const [writeContract, setWriteContract] = useState<Contract | null>(null);

  async function connectWallet() {
    setWalletErr(null);
    try {
      const eth = (window as unknown as { ethereum?: { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum;
      if (!eth) {
        setWalletErr('No wallet detected. Install MetaMask.');
        return;
      }
      const accounts = (await eth.request({ method: 'eth_requestAccounts' })) as string[];
      const chainHex = (await eth.request({ method: 'eth_chainId' })) as string;
      setWalletAddress(accounts[0] ?? null);
      const ok = chainHex === net?.chainIdHex;
      setChainOk(ok);
      if (!ok) {
        setWalletErr(`Wallet on wrong network. Switch to ${net?.label ?? chain}.`);
      } else {
        await refreshWriteContract();
      }
    } catch (e: unknown) {
      setWalletErr(e instanceof Error ? e.message : 'Connect cancelled.');
    }
  }

  async function refreshWriteContract() {
    if (!iface) return;
    try {
      const eth = (window as unknown as { ethereum?: unknown }).ethereum;
      if (!eth) return;
      const provider = new BrowserProvider(eth as ConstructorParameters<typeof BrowserProvider>[0]);
      const signer = await provider.getSigner();
      setWriteContract(new Contract(address, iface, signer));
    } catch (e) {
      setWriteContract(null);
      setWalletErr(e instanceof Error ? e.message : 'Failed to bind signer.');
    }
  }

  async function switchChain() {
    if (!net) return;
    try {
      const eth = (window as unknown as { ethereum?: { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum;
      if (!eth) return;
      await eth.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: net.chainIdHex }],
      });
      setChainOk(true);
      setWalletErr(null);
      await refreshWriteContract();
    } catch (e: unknown) {
      // If the chain isn't added, wallet_addEthereumChain would be the next step ;
      // for now just show the error.
      setWalletErr(e instanceof Error ? e.message : 'Network switch failed.');
    }
  }

  if (!net || !isAddress(address) || !saved || !iface || !readContract) {
    return (
      <ShowcaseLayout milestone="Tools" title="Contract" network={chain || 'unknown'}>
        <div className="contract-loading">
          <p>
            No saved ABI for <code>{chain}/{address}</code>. Redirecting to{' '}
            <Link to="/contract">/contract landing</Link>…
          </p>
        </div>
      </ShowcaseLayout>
    );
  }

  // Partition functions by read vs write.
  const fragments = iface.fragments.filter((f) => f.type === 'function') as FunctionFragment[];
  const readFns = fragments.filter((f) => f.stateMutability === 'view' || f.stateMutability === 'pure');
  const writeFns = fragments.filter((f) => f.stateMutability === 'nonpayable' || f.stateMutability === 'payable');
  const events = iface.fragments.filter((f) => f.type === 'event');
  const errors = iface.fragments.filter((f) => f.type === 'error');

  return (
    <ShowcaseLayout milestone="Tools" title="Contract" network={net.label}>
      <div className="contract-inspector">
        <header className="ci-header">
          <div className="ci-header-main">
            <h1>Contract Inspector</h1>
            <p className="ci-header-sub">
              Auto-generated Read/Write UI from your saved ABI ·{' '}
              <code>{address}</code>
            </p>
          </div>
          <a
            href={explorerAddressUrl(net, address)}
            target="_blank"
            rel="noopener noreferrer"
            className="ci-explorer-link"
          >
            View on explorer →
          </a>
        </header>

        <section className="ci-summary">
          <div>
            <span className="ci-summary-label">Network</span>
            <strong>{net.label}</strong>
          </div>
          <div>
            <span className="ci-summary-label">Address</span>
            <code>{address}</code>
          </div>
          <div>
            <span className="ci-summary-label">ABI</span>
            <span>
              {readFns.length} read · {writeFns.length} write · {events.length} events ·{' '}
              {errors.length} errors
            </span>
          </div>
          {saved.source && (
            <div className="ci-summary-source">
              <span className="ci-summary-label">Source</span>
              <details>
                <summary>show .cov</summary>
                <pre>{saved.source}</pre>
              </details>
            </div>
          )}
        </section>

        <section className="ci-wallet">
          {walletAddress ? (
            <span className="ci-wallet-status">
              🦊 {shortAddr(walletAddress)} ·{' '}
              {chainOk ? `${net.label} ✓` : `wrong network`}
              {!chainOk && (
                <button
                  type="button"
                  className="ci-switch-btn"
                  onClick={() => void switchChain()}
                >
                  Switch to {net.label}
                </button>
              )}
            </span>
          ) : (
            <button
              type="button"
              className="ci-connect-btn"
              onClick={() => void connectWallet()}
            >
              🦊 Connect MetaMask
            </button>
          )}
          {walletErr && <div className="ci-wallet-err">{walletErr}</div>}
        </section>

        <div className="ci-grid">
          <section className="ci-panel-group">
            <h2>Read ({readFns.length})</h2>
            {readFns.length === 0 ? (
              <p className="ci-empty">No view/pure functions in this ABI.</p>
            ) : (
              <div className="ci-panels">
                {readFns.map((f) => (
                  <FnPanel
                    key={f.format()}
                    iface={iface}
                    contractRead={readContract}
                    contractWrite={writeContract}
                    fragment={f}
                    net={net}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="ci-panel-group">
            <h2>Write ({writeFns.length})</h2>
            {writeFns.length === 0 ? (
              <p className="ci-empty">No state-mutating functions in this ABI.</p>
            ) : (
              <div className="ci-panels">
                {writeFns.map((f) => (
                  <FnPanel
                    key={f.format()}
                    iface={iface}
                    contractRead={readContract}
                    contractWrite={writeContract}
                    fragment={f}
                    net={net}
                  />
                ))}
              </div>
            )}
          </section>
        </div>

        {(events.length > 0 || errors.length > 0) && (
          <section className="ci-meta-section">
            {events.length > 0 && (
              <details className="ci-meta-block">
                <summary>Events ({events.length})</summary>
                <ul>
                  {events.map((e) => (
                    <li key={e.format()}>
                      <code>{e.format()}</code>
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {errors.length > 0 && (
              <details className="ci-meta-block">
                <summary>Custom errors ({errors.length})</summary>
                <ul>
                  {errors.map((e) => (
                    <li key={e.format()}>
                      <code>{e.format()}</code>
                    </li>
                  ))}
                </ul>
                <small>
                  These will be decoded automatically if a write tx reverts
                  with one of these signatures.
                </small>
              </details>
            )}
          </section>
        )}

        <footer className="ci-footer-nav">
          <Link to="/contract" className="ci-footer-link">
            ← Connect a different contract
          </Link>
        </footer>
      </div>
    </ShowcaseLayout>
  );
}
