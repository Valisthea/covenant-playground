/**
 * /contract — landing form.
 *
 * The Etherscan-Read/Write-tab equivalent for any Covenant (or any
 * EVM) contract. The user fills :
 *   - Network (Sepolia / BSC / Polygon / Aster / etc.)
 *   - Contract address (0x...)
 *   - ABI source : .cov source (compile in-browser) OR raw ABI JSON
 *
 * Then click "Open contract" → routes to /contract/:chain/:address
 * with the ABI saved to localStorage.
 *
 * Recent contracts (saved across sessions) listed for one-click revisit.
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isAddress } from 'ethers';
import { ShowcaseLayout } from '../Showcases/ShowcaseLayout';
import { networkOptions, getNetwork } from '../../lib/networks';
import { saveContract, recentContracts, forgetContract } from '../../lib/contract-storage';
import { compile } from '../../lib/covenant-compiler';

type AbiSource = 'cov-source' | 'raw-abi';

const EXAMPLE_M2_NFT_ADDR = '0xf8d9895cc265886d958841af8d9a6469be94bc25';
const EXAMPLE_M2_NFT_SOURCE = `nft AuditNFT {
    name: "Audit NFT"
    symbol: "ANFT"
    base_uri: "https://example.com/api/"
}`;

export function ContractLanding() {
  const navigate = useNavigate();
  const networks = useMemo(() => networkOptions(), []);

  const [chain, setChain] = useState('sepolia');
  const [address, setAddress] = useState('');
  const [abiSource, setAbiSource] = useState<AbiSource>('cov-source');
  const [covSource, setCovSource] = useState('');
  const [rawAbi, setRawAbi] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recents, setRecents] = useState(recentContracts(8));

  useEffect(() => {
    setRecents(recentContracts(8));
  }, []);

  function loadExample() {
    setChain('sepolia');
    setAddress(EXAMPLE_M2_NFT_ADDR);
    setAbiSource('cov-source');
    setCovSource(EXAMPLE_M2_NFT_SOURCE);
    setRawAbi('');
    setError(null);
  }

  function openRecent(chain: string, address: string) {
    navigate(`/contract/${chain}/${address}`);
  }

  function deleteRecent(chain: string, address: string, e: React.MouseEvent) {
    e.stopPropagation();
    forgetContract(chain, address);
    setRecents(recentContracts(8));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!getNetwork(chain)) {
      setError('Unknown network.');
      return;
    }
    if (!isAddress(address)) {
      setError('Invalid contract address (must be a 20-byte hex with 0x prefix).');
      return;
    }

    let abi: unknown[];
    let source: string | undefined;

    setBusy(true);
    try {
      if (abiSource === 'cov-source') {
        if (!covSource.trim()) {
          throw new Error('Paste your .cov source first.');
        }
        const result = await compile(covSource);
        if (!result.ok || !result.abi) {
          const errMsg = result.diagnostics
            .filter((d) => d.severity === 'error')
            .map((d) => `${d.code ?? ''} ${d.message}`)
            .join(' · ');
          throw new Error(
            `Compile failed${errMsg ? `: ${errMsg}` : '.'} Check your source or paste the ABI JSON instead.`
          );
        }
        abi = result.abi;
        source = covSource;
      } else {
        if (!rawAbi.trim()) {
          throw new Error('Paste the ABI JSON first.');
        }
        try {
          const parsed = JSON.parse(rawAbi);
          if (!Array.isArray(parsed)) {
            throw new Error('ABI must be a JSON array.');
          }
          abi = parsed;
        } catch (jsonErr) {
          throw new Error(
            `Invalid ABI JSON: ${jsonErr instanceof Error ? jsonErr.message : 'parse error'}`
          );
        }
      }

      saveContract({
        chain,
        address,
        abi: abi as never,
        source,
        savedAt: Date.now(),
      });

      navigate(`/contract/${chain}/${address}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ShowcaseLayout milestone="Tools" title="Connect contract" network="any EVM chain">
      <div className="contract-landing">
        <header className="contract-landing-hero">
          <h1>Connect to a Covenant contract</h1>
          <p>
            Paste your deployed contract address + the source (or ABI) and
            this dApp generates a Read/Write interface — like Etherscan&apos;s
            Read/Write tabs, but for Covenant contracts that Etherscan
            can&apos;t verify.
          </p>
          <p className="contract-landing-subtle">
            Works for any EVM chain (Sepolia, BSC, Polygon, Arbitrum,
            Optimism, Base, Aster Chain). State reads work without a
            wallet ; writes require MetaMask connected to the right
            network and gas.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="contract-form">
          <div className="contract-form-row">
            <label className="contract-form-field">
              <span className="contract-form-label">Network</span>
              <select
                value={chain}
                onChange={(e) => setChain(e.target.value)}
                className="contract-form-input"
              >
                {networks.map((n) => (
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
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="0x..."
                className="contract-form-input"
                autoComplete="off"
                spellCheck={false}
              />
            </label>
          </div>

          <fieldset className="contract-form-abi">
            <legend>ABI source</legend>

            <div className="contract-form-tabs">
              <button
                type="button"
                className={abiSource === 'cov-source' ? 'is-active' : ''}
                onClick={() => setAbiSource('cov-source')}
              >
                Compile from .cov source
              </button>
              <button
                type="button"
                className={abiSource === 'raw-abi' ? 'is-active' : ''}
                onClick={() => setAbiSource('raw-abi')}
              >
                Paste ABI JSON
              </button>
            </div>

            {abiSource === 'cov-source' ? (
              <>
                <textarea
                  value={covSource}
                  onChange={(e) => setCovSource(e.target.value)}
                  placeholder={'nft MyNFT {\n    name: "My NFT"\n    symbol: "MNFT"\n    base_uri: "..."\n}'}
                  className="contract-form-textarea"
                  rows={10}
                  spellCheck={false}
                />
                <small className="contract-form-hint">
                  Paste the same .cov source you compiled to deploy.
                  In-browser WASM compiler extracts the ABI.
                </small>
              </>
            ) : (
              <>
                <textarea
                  value={rawAbi}
                  onChange={(e) => setRawAbi(e.target.value)}
                  placeholder={'[{"name":"transfer","type":"function","inputs":[{"name":"to","type":"address"},{"name":"value","type":"uint256"}],"outputs":[{"name":"","type":"bool"}],"stateMutability":"nonpayable"}]'}
                  className="contract-form-textarea contract-form-textarea-mono"
                  rows={10}
                  spellCheck={false}
                />
                <small className="contract-form-hint">
                  JSON array of ABI fragments. Compatible with{' '}
                  <code>build/&lt;Contract&gt;.abi.json</code> output of{' '}
                  <code>covenant build</code>.
                </small>
              </>
            )}
          </fieldset>

          {error && <div className="contract-form-error">{error}</div>}

          <div className="contract-form-actions">
            <button
              type="button"
              onClick={loadExample}
              className="contract-form-link-btn"
              disabled={busy}
            >
              ↻ Try with M2 Audit NFT example
            </button>
            <button
              type="submit"
              disabled={busy || !address || (abiSource === 'cov-source' ? !covSource.trim() : !rawAbi.trim())}
              className="contract-form-submit"
            >
              {busy ? '⟳ Loading…' : 'Open contract →'}
            </button>
          </div>
        </form>

        {recents.length > 0 && (
          <section className="contract-recents">
            <h2>Recent contracts</h2>
            <ul className="contract-recents-list">
              {recents.map((r) => {
                const net = getNetwork(r.chain);
                return (
                  <li
                    key={`${r.chain}:${r.address}`}
                    className="contract-recent-item"
                    onClick={() => openRecent(r.chain, r.address)}
                  >
                    <div className="contract-recent-main">
                      <code className="contract-recent-addr">
                        {r.address.slice(0, 8)}…{r.address.slice(-6)}
                      </code>
                      <span className="contract-recent-net">
                        {net?.label ?? r.chain}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => deleteRecent(r.chain, r.address, e)}
                      className="contract-recent-forget"
                      aria-label="Forget this contract"
                    >
                      ×
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <aside className="contract-landing-note">
          <strong>Why this exists :</strong> Etherscan / BSCScan / Polygonscan
          can show Read/Write tabs only after verifying a contract&apos;s
          Solidity / Vyper / Yul source. They don&apos;t support Covenant
          source verification yet. This dApp is the workaround : you give
          us the ABI (we extract it from your <code>.cov</code> in-browser),
          we give you the same UX.
        </aside>
      </div>
    </ShowcaseLayout>
  );
}
