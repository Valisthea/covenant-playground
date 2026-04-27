/**
 * Network registry for the generic /contract dApp.
 *
 * Each network entry has the data needed to :
 *   - select via UI (label, native currency)
 *   - read state via public RPC (no API key required for public nodes)
 *   - write state via wallet (chainId hex for wallet_switchEthereumChain)
 *   - link to a block explorer (address + tx pages)
 *
 * Add a new network here and it appears everywhere — landing dropdown,
 * read provider routing, wallet network switch, explorer links.
 */

export interface NetworkConfig {
  id: string; // URL slug — stable, lowercase
  label: string; // UI display
  chainId: number; // EVM chain id (decimal)
  chainIdHex: string; // for wallet_switchEthereumChain (e.g. "0xaa36a7")
  publicRpc: string; // public RPC URL (no API key)
  explorerBase: string; // block explorer base URL (no trailing slash)
  nativeSymbol: string; // for gas display (ETH, BNB, MATIC, ...)
  testnet: boolean;
}

export const NETWORKS: Record<string, NetworkConfig> = {
  sepolia: {
    id: 'sepolia',
    label: 'Sepolia (Ethereum testnet)',
    chainId: 11155111,
    chainIdHex: '0xaa36a7',
    publicRpc: 'https://ethereum-sepolia-rpc.publicnode.com',
    explorerBase: 'https://sepolia.etherscan.io',
    nativeSymbol: 'ETH',
    testnet: true,
  },
  bsc: {
    id: 'bsc',
    label: 'BNB Smart Chain (mainnet)',
    chainId: 56,
    chainIdHex: '0x38',
    publicRpc: 'https://bsc-dataseed.binance.org',
    explorerBase: 'https://bscscan.com',
    nativeSymbol: 'BNB',
    testnet: false,
  },
  'bsc-testnet': {
    id: 'bsc-testnet',
    label: 'BNB Smart Chain (testnet)',
    chainId: 97,
    chainIdHex: '0x61',
    publicRpc: 'https://data-seed-prebsc-1-s1.binance.org:8545',
    explorerBase: 'https://testnet.bscscan.com',
    nativeSymbol: 'tBNB',
    testnet: true,
  },
  polygon: {
    id: 'polygon',
    label: 'Polygon (mainnet)',
    chainId: 137,
    chainIdHex: '0x89',
    publicRpc: 'https://polygon-rpc.com',
    explorerBase: 'https://polygonscan.com',
    nativeSymbol: 'MATIC',
    testnet: false,
  },
  arbitrum: {
    id: 'arbitrum',
    label: 'Arbitrum One (mainnet)',
    chainId: 42161,
    chainIdHex: '0xa4b1',
    publicRpc: 'https://arb1.arbitrum.io/rpc',
    explorerBase: 'https://arbiscan.io',
    nativeSymbol: 'ETH',
    testnet: false,
  },
  optimism: {
    id: 'optimism',
    label: 'Optimism (mainnet)',
    chainId: 10,
    chainIdHex: '0xa',
    publicRpc: 'https://mainnet.optimism.io',
    explorerBase: 'https://optimistic.etherscan.io',
    nativeSymbol: 'ETH',
    testnet: false,
  },
  base: {
    id: 'base',
    label: 'Base (mainnet)',
    chainId: 8453,
    chainIdHex: '0x2105',
    publicRpc: 'https://mainnet.base.org',
    explorerBase: 'https://basescan.org',
    nativeSymbol: 'ETH',
    testnet: false,
  },
  aster: {
    id: 'aster',
    label: 'Aster Chain (mainnet) — V0.9.x deploy pending',
    chainId: 1996,
    chainIdHex: '0x7cc',
    publicRpc: 'https://tapi.asterdex.com', // confirm exact endpoint
    explorerBase: 'https://explorer.asterdex.com',
    nativeSymbol: 'ASTER',
    testnet: false,
  },
};

export function getNetwork(id: string): NetworkConfig | undefined {
  return NETWORKS[id];
}

export function networkOptions(): NetworkConfig[] {
  // Testnets first — that's where dev contracts live.
  return Object.values(NETWORKS).sort((a, b) => {
    if (a.testnet !== b.testnet) return a.testnet ? -1 : 1;
    return a.label.localeCompare(b.label);
  });
}

export function explorerAddressUrl(net: NetworkConfig, address: string): string {
  return `${net.explorerBase}/address/${address}`;
}

export function explorerTxUrl(net: NetworkConfig, hash: string): string {
  return `${net.explorerBase}/tx/${hash}`;
}
