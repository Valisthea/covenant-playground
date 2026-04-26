/**
 * /showcases — landing page listing every Covenant deployment showcase.
 *
 * Each card links to a dedicated /showcases/<id> page with a live
 * read/write interface for the deployed contract. New showcases get
 * added here as new milestones land.
 */

import { Link } from 'react-router-dom';
import { ShowcaseLayout } from './ShowcaseLayout';
import { M2_NFT } from '../../lib/showcases/m2-nft';

interface ShowcaseCard {
  id: string;
  milestone: string;
  title: string;
  description: string;
  network: string;
  address: string;
  status: 'live' | 'coming-soon';
  href: string;
}

const SHOWCASES: ShowcaseCard[] = [
  {
    id: 'm2-nft',
    milestone: 'M2',
    title: M2_NFT.name,
    description:
      'First Covenant-compiled ERC-721 NFT — auto-synthesized from 4 lines of source. Live on Sepolia. Mint, transfer, view metadata.',
    network: 'Sepolia testnet',
    address: M2_NFT.address,
    status: 'live',
    href: '/showcases/m2-nft',
  },
  {
    id: 'm3-cross-contract',
    milestone: 'M3',
    title: 'Cross-contract call (coming soon)',
    description:
      'Covenant contract calling another deployed contract via the `interface` + `call_interface` syntax. V0.9.x roadmap.',
    network: 'Sepolia testnet',
    address: 'TBD',
    status: 'coming-soon',
    href: '#',
  },
  {
    id: 'm4-aster-ceremony',
    milestone: 'M4',
    title: 'Aster ceremony (coming soon)',
    description:
      'First end-to-end Covenant amnesia ceremony lifecycle on Aster Chain. Gated on Arachnid factory verification.',
    network: 'Aster testnet',
    address: 'TBD',
    status: 'coming-soon',
    href: '#',
  },
  {
    id: 'm5-pq-registry',
    milestone: 'M5',
    title: 'ERC-8231 PQ key registry (coming soon)',
    description:
      'First Covenant-compiled post-quantum key registry on Sepolia using `registry` keyword auto-synthesis.',
    network: 'Sepolia testnet',
    address: 'TBD',
    status: 'coming-soon',
    href: '#',
  },
];

export function ShowcasesIndex() {
  return (
    <ShowcaseLayout>
      <div className="showcase-index-hero">
        <h1>Covenant — Live Showcases</h1>
        <p>
          Real Covenant contracts deployed to public chains. Each showcase
          lets you interact with the live deployment via your wallet, see
          the original 4-to-10-line `.cov` source that produced it, and
          read the milestone record on GitHub.
        </p>
        <p className="showcase-index-subtle">
          The compiler turns concise source into standard EVM bytecode.
          Indistinguishable from Solidity output to wallets, indexers,
          and marketplaces — only the source experience differs.
        </p>
      </div>

      <div className="showcase-index-grid">
        {SHOWCASES.map((s) => (
          <article
            key={s.id}
            className={`showcase-card showcase-card-${s.status}`}
            aria-labelledby={`card-${s.id}`}
          >
            <header className="showcase-card-header">
              <span className="showcase-card-milestone">{s.milestone}</span>
              {s.status === 'live' ? (
                <span className="showcase-card-status-live">● Live</span>
              ) : (
                <span className="showcase-card-status-soon">Coming soon</span>
              )}
            </header>

            <h2 id={`card-${s.id}`} className="showcase-card-title">
              {s.title}
            </h2>

            <p className="showcase-card-desc">{s.description}</p>

            <dl className="showcase-card-meta">
              <dt>Network</dt>
              <dd>{s.network}</dd>
              <dt>Address</dt>
              <dd>
                <code>
                  {s.address.length > 10
                    ? `${s.address.slice(0, 6)}…${s.address.slice(-4)}`
                    : s.address}
                </code>
              </dd>
            </dl>

            {s.status === 'live' ? (
              <Link to={s.href} className="showcase-card-cta">
                Open showcase →
              </Link>
            ) : (
              <span className="showcase-card-cta-disabled">
                Pending milestone
              </span>
            )}
          </article>
        ))}
      </div>
    </ShowcaseLayout>
  );
}
