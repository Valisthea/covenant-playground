/**
 * Curated example manifest. Each entry maps a short id to metadata + a
 * public path. The `.cov` files themselves live in `public/examples/` so
 * they are served as static assets and the fetch happens lazily on click.
 *
 * Keep this list in sync with `public/examples/`. Order defines display
 * order in the gallery.
 */

export type Difficulty = 'beginner' | 'intermediate' | 'advanced';
export type Category =
  | 'tokens'
  | 'auth'
  | 'privacy'
  | 'upgrades'
  | 'amnesia'
  | 'integration';

export interface Example {
  id: string;           // filename without extension
  title: string;
  description: string;
  category: Category;
  difficulty: Difficulty;
}

export const EXAMPLES: Example[] = [
  {
    id: '01-hello',
    title: 'Hello Contract',
    description:
      'The minimal viable Covenant file: a single record with one field and one action.',
    category: 'tokens',
    difficulty: 'beginner',
  },
  {
    id: '02-coin',
    title: 'Simple Coin',
    description:
      'Standard ERC-20-shaped token. The `token` keyword synthesizes the usual transfer/approve/balance surface.',
    category: 'tokens',
    difficulty: 'beginner',
  },
  {
    id: '03-encrypted-token',
    title: 'Encrypted Token',
    description:
      'FHE-wrapped balances (ERC-8227). Balances stay ciphertext on-chain; only holders can decrypt.',
    category: 'privacy',
    difficulty: 'intermediate',
  },
  {
    id: '04-multi-sig-admin',
    title: 'Multi-Sig Admin',
    description: 'M-of-N admin guard protecting upgrade + pause actions.',
    category: 'auth',
    difficulty: 'intermediate',
  },
  {
    id: '05-time-locked-admin',
    title: 'Time-Locked Admin',
    description: 'Queue, 48h delay, execute. Governance-grade change control.',
    category: 'auth',
    difficulty: 'intermediate',
  },
  {
    id: '06-pq-signed-admin',
    title: 'PQ-Signed Admin',
    description:
      'Dilithium5 post-quantum signatures on the admin surface (@pq_signed, ERC-8231).',
    category: 'auth',
    difficulty: 'advanced',
  },
  {
    id: '07-sealed-bid-auction',
    title: 'Sealed-Bid Auction',
    description:
      'Bids submitted as FHE ciphertexts. No one — including the auctioneer — can see bids before settlement.',
    category: 'privacy',
    difficulty: 'advanced',
  },
  {
    id: '08-private-voting',
    title: 'Private Voting',
    description:
      'ZK proofs of eligibility + FHE-encrypted tallies. Ballots stay hidden; the result is verifiable.',
    category: 'privacy',
    difficulty: 'advanced',
  },
  {
    id: '09-confidential-payroll',
    title: 'Confidential Payroll',
    description:
      'Salaries are ciphertext. Employers can add/remove employees; only the employee can decrypt their balance.',
    category: 'privacy',
    difficulty: 'intermediate',
  },
  {
    id: '10-zk-airdrop',
    title: 'ZK Airdrop',
    description:
      'Claim without revealing eligibility. Merkle proof of inclusion + nullifier to prevent double-claim.',
    category: 'privacy',
    difficulty: 'advanced',
  },
  {
    id: '11-uups-upgradeable',
    title: 'UUPS Upgradeable',
    description:
      'EIP-1822 proxy pattern with upgrade logic colocated with the implementation.',
    category: 'upgrades',
    difficulty: 'intermediate',
  },
  {
    id: '12-diamond-storage',
    title: 'Diamond Storage',
    description:
      'Namespaced storage slots for modular, upgrade-safe state layouts.',
    category: 'upgrades',
    difficulty: 'advanced',
  },
  {
    id: '13-safe-multisig',
    title: 'Safe Multisig',
    description:
      'Gnosis Safe integration: guard callback + module-style hooks.',
    category: 'integration',
    difficulty: 'intermediate',
  },
  {
    id: '14-uniswap-hook',
    title: 'Uniswap V4 Hook',
    description:
      'Hook contract for pool lifecycle callbacks (beforeSwap, afterModifyLiquidity).',
    category: 'integration',
    difficulty: 'advanced',
  },
  {
    id: '15-amnesia-ceremony',
    title: 'Amnesia Ceremony',
    description:
      'Cryptographic amnesia (ERC-8228): contributions, Wesolowski VDF, destruction proof. One-way — no reset.',
    category: 'amnesia',
    difficulty: 'advanced',
  },
];

export async function loadExampleSource(id: string): Promise<string> {
  const response = await fetch(`/examples/${id}.cov`);
  if (!response.ok) {
    throw new Error(`Failed to load example "${id}" (${response.status})`);
  }
  return response.text();
}
