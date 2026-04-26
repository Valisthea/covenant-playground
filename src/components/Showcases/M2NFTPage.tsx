/**
 * /showcases/m2-nft — M2 Audit NFT live showcase.
 *
 * Side-by-side : the 4-line `.cov` source that produced the contract
 * (left) and a live read/write panel that talks to the deployed
 * Sepolia contract via the user's wallet (right).
 *
 * Reads (state queries) work without a wallet — uses a public Sepolia
 * RPC. Writes (mint, transferFrom) require MetaMask connected to
 * Sepolia and gas (Sepolia ETH is free from faucets).
 */

import { useEffect, useState } from 'react';
import { BrowserProvider, Contract, JsonRpcProvider, isAddress } from 'ethers';
import { ShowcaseLayout } from './ShowcaseLayout';
import { M2_NFT, M2_NFT_ABI } from '../../lib/showcases/m2-nft';

// ─── Public read provider (no wallet needed) ──────────────────────────
// Uses Sepolia public RPC for read-only views. Replace with Alchemy/Infura
// if rate-limited.
const SEPOLIA_PUBLIC_RPC = 'https://ethereum-sepolia-rpc.publicnode.com';

const ZERO_ADDR = '0x0000000000000000000000000000000000000000';

function shortAddr(a: string): string {
  if (!a || a.length < 10) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

interface ReadState {
  totalSupply: number; // computed from txs : current best-known max token id
  loading: boolean;
  error?: string;
  views: Record<string, string>; // ownerOf(1), balanceOf(deployer), etc.
}

export function M2NFTPage() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [chainOk, setChainOk] = useState<boolean>(false);

  // ─── Read state ────────────────────────────────────────────────────
  const [readState, setReadState] = useState<ReadState>({
    totalSupply: 2,
    loading: true,
    views: {},
  });

  // ─── Write panel state ─────────────────────────────────────────────
  const [mintRecipient, setMintRecipient] = useState('');
  const [mintTokenId, setMintTokenId] = useState('3');
  const [transferTo, setTransferTo] = useState('');
  const [transferTokenId, setTransferTokenId] = useState('');
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<{ kind: 'ok' | 'err'; msg: string; txHash?: string } | null>(null);

  // ─── Initial read load ─────────────────────────────────────────────
  useEffect(() => {
    void loadReadState();
  }, []);

  async function loadReadState() {
    setReadState((s) => ({ ...s, loading: true, error: undefined }));
    try {
      const provider = new JsonRpcProvider(SEPOLIA_PUBLIC_RPC);
      const c = new Contract(M2_NFT.address, M2_NFT_ABI, provider);
      const [name, symbol, balDeployer, balDead, balZero, owner1, owner2, uri1] = await Promise.all([
        c.name(),
        c.symbol(),
        c.balanceOf(M2_NFT.deployer),
        c.balanceOf('0x000000000000000000000000000000000000dEaD'),
        c.balanceOf(ZERO_ADDR),
        c.ownerOf(1).catch(() => '(not minted)'),
        c.ownerOf(2).catch(() => '(not minted)'),
        c.tokenURI(1).catch(() => '(no URI)'),
      ]);
      setReadState({
        totalSupply: 2,
        loading: false,
        views: {
          'name()': String(name),
          'symbol()': String(symbol),
          [`balanceOf(deployer)`]: String(balDeployer),
          [`balanceOf(0x...dEaD)`]: String(balDead),
          [`balanceOf(0x000…0000)`]: String(balZero),
          'ownerOf(1)': String(owner1),
          'ownerOf(2)': String(owner2),
          'tokenURI(1)': String(uri1),
        },
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setReadState({ totalSupply: 0, loading: false, views: {}, error: msg });
    }
  }

  // ─── Wallet connect ────────────────────────────────────────────────
  async function connectWallet() {
    setWalletError(null);
    try {
      const eth = (window as unknown as { ethereum?: { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum;
      if (!eth) {
        setWalletError('No wallet detected. Install MetaMask to interact.');
        return;
      }
      const accounts = (await eth.request({ method: 'eth_requestAccounts' })) as string[];
      const chainHex = (await eth.request({ method: 'eth_chainId' })) as string;
      setWalletAddress(accounts[0] ?? null);
      const isSepolia = chainHex === '0xaa36a7';
      setChainOk(isSepolia);
      if (!isSepolia) {
        setWalletError('Connected wallet is on the wrong network. Switch to Sepolia testnet.');
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Wallet connect cancelled.';
      setWalletError(msg);
    }
  }

  async function switchToSepolia() {
    try {
      const eth = (window as unknown as { ethereum?: { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum;
      if (!eth) return;
      await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0xaa36a7' }] });
      setChainOk(true);
      setWalletError(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Network switch failed.';
      setWalletError(msg);
    }
  }

  // ─── Write actions ─────────────────────────────────────────────────
  async function getSigner() {
    const eth = (window as unknown as { ethereum?: unknown }).ethereum;
    if (!eth) throw new Error('No wallet detected.');
    const provider = new BrowserProvider(eth as ConstructorParameters<typeof BrowserProvider>[0]);
    return provider.getSigner();
  }

  async function doMint() {
    if (!walletAddress) {
      setActionResult({ kind: 'err', msg: 'Connect your wallet first.' });
      return;
    }
    if (!chainOk) {
      setActionResult({ kind: 'err', msg: 'Switch to Sepolia testnet first.' });
      return;
    }
    const recipient = mintRecipient.trim() || walletAddress;
    if (!isAddress(recipient)) {
      setActionResult({ kind: 'err', msg: 'Invalid recipient address.' });
      return;
    }
    const id = Number(mintTokenId);
    if (!Number.isInteger(id) || id < 0) {
      setActionResult({ kind: 'err', msg: 'Token id must be a non-negative integer.' });
      return;
    }
    setPendingAction('mint');
    setActionResult(null);
    try {
      const signer = await getSigner();
      const c = new Contract(M2_NFT.address, M2_NFT_ABI, signer);
      const tx = await c.mint(recipient, id);
      setActionResult({ kind: 'ok', msg: `mint(${shortAddr(recipient)}, ${id}) sent`, txHash: tx.hash });
      await tx.wait();
      setActionResult({ kind: 'ok', msg: `mint(${shortAddr(recipient)}, ${id}) confirmed`, txHash: tx.hash });
      void loadReadState();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Mint failed.';
      setActionResult({ kind: 'err', msg });
    } finally {
      setPendingAction(null);
    }
  }

  async function doTransfer() {
    if (!walletAddress) {
      setActionResult({ kind: 'err', msg: 'Connect your wallet first.' });
      return;
    }
    if (!chainOk) {
      setActionResult({ kind: 'err', msg: 'Switch to Sepolia testnet first.' });
      return;
    }
    if (!isAddress(transferTo)) {
      setActionResult({ kind: 'err', msg: 'Invalid recipient address.' });
      return;
    }
    const id = Number(transferTokenId);
    if (!Number.isInteger(id) || id < 0) {
      setActionResult({ kind: 'err', msg: 'Token id must be a non-negative integer.' });
      return;
    }
    setPendingAction('transfer');
    setActionResult(null);
    try {
      const signer = await getSigner();
      const c = new Contract(M2_NFT.address, M2_NFT_ABI, signer);
      const tx = await c.transferFrom(walletAddress, transferTo, id);
      setActionResult({ kind: 'ok', msg: `transferFrom(${shortAddr(walletAddress)}, ${shortAddr(transferTo)}, ${id}) sent`, txHash: tx.hash });
      await tx.wait();
      setActionResult({ kind: 'ok', msg: `transferFrom confirmed`, txHash: tx.hash });
      void loadReadState();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Transfer failed.';
      setActionResult({ kind: 'err', msg });
    } finally {
      setPendingAction(null);
    }
  }

  // ─── Render ────────────────────────────────────────────────────────
  return (
    <ShowcaseLayout milestone="M2" title={M2_NFT.name} network="Sepolia">
      <div className="m2-grid">
        {/* ── LEFT : Source + compile + deploy lineage ─────────────── */}
        <section className="m2-source-panel" aria-labelledby="src-heading">
          <h2 id="src-heading">The 4 lines that produced this contract</h2>

          <pre className="m2-source-code">
            <code>{M2_NFT.source}</code>
          </pre>

          <div className="m2-lineage">
            <div className="m2-lineage-step">
              <span className="m2-lineage-arrow">↓</span>
              <strong>Covenant compile</strong>
              <small>{M2_NFT.compilerVersion}</small>
              <small>
                deploy bytecode {M2_NFT.deployBytecodeBytes} bytes ·
                runtime {M2_NFT.runtimeBytecodeBytes} bytes
              </small>
            </div>

            <div className="m2-lineage-step">
              <span className="m2-lineage-arrow">↓</span>
              <strong>Deploy to Sepolia</strong>
              <small>block #{M2_NFT.deployBlock}</small>
              <small>
                tx{' '}
                <a
                  href={`https://sepolia.etherscan.io/tx/${M2_NFT.txs[0]?.hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {M2_NFT.txs[0]?.hash.slice(0, 10)}…
                </a>
              </small>
            </div>
          </div>

          <h3>Lifecycle exploration (5 transactions)</h3>
          <ol className="m2-tx-list">
            {M2_NFT.txs.map((tx) => (
              <li key={tx.hash} className="m2-tx-item">
                <span className="m2-tx-n">#{tx.n}</span>
                <code className="m2-tx-action">{tx.action}</code>
                <a
                  href={`https://sepolia.etherscan.io/tx/${tx.hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="m2-tx-link"
                >
                  {tx.hash.slice(0, 10)}…
                </a>
                <small className="m2-tx-note">{tx.note}</small>
              </li>
            ))}
          </ol>

          <div className="m2-external-links">
            <a href={M2_NFT.etherscanContract} target="_blank" rel="noopener noreferrer">
              📍 Contract on Etherscan
            </a>
            <a href={M2_NFT.etherscanToken} target="_blank" rel="noopener noreferrer">
              🪙 Token tracker
            </a>
            <a href={M2_NFT.openseaCollection} target="_blank" rel="noopener noreferrer">
              🌊 OpenSea (testnet)
            </a>
            <a href={M2_NFT.githubSource} target="_blank" rel="noopener noreferrer">
              📖 Source on GitHub
            </a>
            <a href={M2_NFT.githubMilestone} target="_blank" rel="noopener noreferrer">
              📜 MILESTONES.md M2 record
            </a>
          </div>
        </section>

        {/* ── RIGHT : Live state + write panel ─────────────────────── */}
        <section className="m2-live-panel" aria-labelledby="live-heading">
          <h2 id="live-heading">Live on Sepolia</h2>

          <div className="m2-contract-id">
            <span>📍 Contract</span>
            <code>{M2_NFT.address}</code>
          </div>

          {/* Read panel — works without wallet */}
          <div className="m2-read-section">
            <header className="m2-section-header">
              <h3>Read (no wallet needed)</h3>
              <button
                type="button"
                onClick={() => void loadReadState()}
                disabled={readState.loading}
                className="m2-refresh-btn"
              >
                {readState.loading ? '⟳ Loading…' : '⟳ Refresh'}
              </button>
            </header>

            {readState.error && (
              <div className="m2-error">RPC error: {readState.error}</div>
            )}

            <dl className="m2-read-grid">
              {Object.entries(readState.views).map(([k, v]) => (
                <div key={k} className="m2-read-item">
                  <dt>
                    <code>{k}</code>
                  </dt>
                  <dd>
                    <code>{v}</code>
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Write panel — requires wallet */}
          <div className="m2-write-section">
            <header className="m2-section-header">
              <h3>Write (wallet + Sepolia ETH required)</h3>
              {walletAddress ? (
                <span className="m2-wallet-status">
                  🦊 {shortAddr(walletAddress)}
                  {chainOk ? ' · Sepolia ✓' : ' · wrong network'}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => void connectWallet()}
                  className="m2-connect-btn"
                >
                  🦊 Connect MetaMask
                </button>
              )}
            </header>

            {walletError && (
              <div className="m2-error">
                {walletError}
                {walletAddress && !chainOk && (
                  <button
                    type="button"
                    onClick={() => void switchToSepolia()}
                    className="m2-switch-btn"
                  >
                    Switch to Sepolia
                  </button>
                )}
              </div>
            )}

            <fieldset
              className="m2-action-form"
              disabled={!walletAddress || !chainOk || pendingAction !== null}
            >
              <legend>mint(to, token_id)</legend>
              <label>
                Recipient address
                <input
                  type="text"
                  placeholder={walletAddress ?? '0x...'}
                  value={mintRecipient}
                  onChange={(e) => setMintRecipient(e.target.value)}
                />
              </label>
              <label>
                Token id
                <input
                  type="number"
                  min={0}
                  value={mintTokenId}
                  onChange={(e) => setMintTokenId(e.target.value)}
                />
              </label>
              <button type="button" onClick={() => void doMint()}>
                {pendingAction === 'mint' ? '⟳ Sending…' : 'Mint NFT'}
              </button>
            </fieldset>

            <fieldset
              className="m2-action-form"
              disabled={!walletAddress || !chainOk || pendingAction !== null}
            >
              <legend>transferFrom(me, to, token_id)</legend>
              <label>
                To
                <input
                  type="text"
                  placeholder="0x..."
                  value={transferTo}
                  onChange={(e) => setTransferTo(e.target.value)}
                />
              </label>
              <label>
                Token id (you must own it)
                <input
                  type="number"
                  min={0}
                  value={transferTokenId}
                  onChange={(e) => setTransferTokenId(e.target.value)}
                />
              </label>
              <button type="button" onClick={() => void doTransfer()}>
                {pendingAction === 'transfer' ? '⟳ Sending…' : 'Transfer'}
              </button>
            </fieldset>

            {actionResult && (
              <div className={`m2-action-result m2-action-${actionResult.kind}`}>
                <span>{actionResult.msg}</span>
                {actionResult.txHash && (
                  <a
                    href={`https://sepolia.etherscan.io/tx/${actionResult.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    view on Etherscan →
                  </a>
                )}
              </div>
            )}
          </div>

          <aside className="m2-empirical-note">
            <strong>Note — empirical finding from this contract:</strong>{' '}
            V0.9.0&apos;s auto-synthesized <code>transferFrom</code> does
            NOT check <code>to != address(0)</code>. A burn-via-zero call
            succeeds and creates state where <code>balanceOf(0x0) {`>`} 0</code>{' '}
            — non-conforming to strict ERC-721 semantics. See{' '}
            <a href={M2_NFT.githubMilestone} target="_blank" rel="noopener noreferrer">
              MILESTONES.md M2
            </a>{' '}
            and the <code>DEBT.md</code> V0.9.1 fix candidate.
          </aside>
        </section>
      </div>
    </ShowcaseLayout>
  );
}
