/**
 * M2 — Audit NFT showcase data.
 *
 * First Covenant-compiled ERC-721 NFT deployed and exercised on Sepolia
 * (full lifecycle : deploy → mint → mint → transfer → transferFrom-to-zero).
 * See covenant-src/MILESTONES.md M2 for the full record.
 *
 * This module is the SINGLE SOURCE OF TRUTH for the M2 showcase :
 * address, ABI, source, links, network. Both the playground (if it
 * wants to pre-load this contract) and the showcase page consume it.
 */

export const M2_NFT = {
  // ─── On-chain identity ──────────────────────────────────────────────
  address: '0xf8d9895cc265886d958841af8d9a6469be94bc25' as const,
  network: 'sepolia' as const,
  chainId: 11155111,
  deployBlock: 10737903,
  deployer: '0x409D61d3582AD5A655927E615AC3CF366c165a55' as const,

  // ─── Metadata (matches what's on-chain) ─────────────────────────────
  name: 'Audit NFT',
  symbol: 'ANFT',
  baseUri: 'https://example.com/api/',

  // ─── Build artifacts ────────────────────────────────────────────────
  deployBytecodeBytes: 1235,
  runtimeBytecodeBytes: 1208,
  compilerVersion: 'V0.9.0 (commit 71d0e1b, tag v0.9.0)',

  // ─── Lifecycle txs (5-tx exploration) ───────────────────────────────
  txs: [
    {
      n: 1,
      action: 'deploy (--create $BYTECODE)',
      hash: '0x9a40b8ca1b18c3029aeccef50692292ea2aac79984f588d124b420978198054c',
      block: 10737903,
      gas: 336458,
      note: 'contract creation',
    },
    {
      n: 2,
      action: 'mint(deployer, 1)',
      hash: '0x2107c1a2761a6f030a6ef5279462e3bbf6885fd87de1dd71727e2179a5b97fe6',
      block: 10737907,
      gas: 72571,
      note: 'first token minted to deployer',
    },
    {
      n: 3,
      action: 'mint(deployer, 2)',
      hash: '0xe88e72ee8bcefc164e98aabfe517b4478d050b07a90d85cb2980487a7bfcc910',
      block: 10738723,
      gas: 55471,
      note: 'second token minted',
    },
    {
      n: 4,
      action: 'transferFrom(deployer, 0x...dEaD, 1)',
      hash: '0xe9e75df2ab1068407c6dc059476f4f571b3ef889cf41ea53f5be5002e081c293',
      block: 10738724,
      gas: 63087,
      note: 'token #1 transferred to black-hole address',
    },
    {
      n: 5,
      action: 'transferFrom(deployer, 0x000…0000, 2)',
      hash: '0xbcd0e1a2dd57a0962ac4e5525bebbb0c8a3840b2174fb6b819320f58582ed4d0',
      block: 10738725,
      gas: 53463,
      note: 'transferFrom-to-zero — succeeded (V0.9.0 permissive, see MILESTONES M2)',
    },
  ],

  // ─── External links ─────────────────────────────────────────────────
  etherscanContract: 'https://sepolia.etherscan.io/address/0xf8d9895cc265886d958841af8d9a6469be94bc25',
  etherscanToken: 'https://sepolia.etherscan.io/token/0xf8d9895cc265886d958841af8d9a6469be94bc25',
  openseaCollection: 'https://testnets.opensea.io/assets/sepolia/0xf8d9895cc265886d958841af8d9a6469be94bc25',
  githubMilestone: 'https://github.com/Valisthea/covenant/blob/main/MILESTONES.md',
  githubSource: 'https://github.com/Valisthea/covenant/blob/main/examples/audit/04_nft_minimal.cov',

  // ─── The 4 lines of source ──────────────────────────────────────────
  source: `nft AuditNFT {
    name: "Audit NFT"
    symbol: "ANFT"
    base_uri: "https://example.com/api/"
}`,
};

// ─── ABI (matches build/AuditNFT.abi.json from covenant-src) ──────────
import type { InterfaceAbi } from 'ethers';

export const M2_NFT_ABI: InterfaceAbi = [
  { name: 'name', type: 'function', inputs: [], outputs: [{ name: '', type: 'string' }], stateMutability: 'view' },
  { name: 'symbol', type: 'function', inputs: [], outputs: [{ name: '', type: 'string' }], stateMutability: 'view' },
  { name: 'tokenURI', type: 'function', inputs: [{ name: 'token_id', type: 'uint256' }], outputs: [{ name: '', type: 'string' }], stateMutability: 'view' },
  { name: 'balanceOf', type: 'function', inputs: [{ name: 'owner', type: 'address' }], outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view' },
  { name: 'ownerOf', type: 'function', inputs: [{ name: 'token_id', type: 'uint256' }], outputs: [{ name: '', type: 'address' }], stateMutability: 'view' },
  { name: 'getApproved', type: 'function', inputs: [{ name: 'token_id', type: 'uint256' }], outputs: [{ name: '', type: 'address' }], stateMutability: 'view' },
  { name: 'isApprovedForAll', type: 'function', inputs: [{ name: 'owner', type: 'address' }, { name: 'operator', type: 'address' }], outputs: [{ name: '', type: 'bool' }], stateMutability: 'view' },
  { name: 'approve', type: 'function', inputs: [{ name: 'spender', type: 'address' }, { name: 'token_id', type: 'uint256' }], outputs: [], stateMutability: 'nonpayable' },
  { name: 'setApprovalForAll', type: 'function', inputs: [{ name: 'operator', type: 'address' }, { name: 'approved', type: 'bool' }], outputs: [], stateMutability: 'nonpayable' },
  { name: 'transferFrom', type: 'function', inputs: [{ name: 'from', type: 'address' }, { name: 'to', type: 'address' }, { name: 'token_id', type: 'uint256' }], outputs: [], stateMutability: 'nonpayable' },
  { name: 'mint', type: 'function', inputs: [{ name: 'to', type: 'address' }, { name: 'token_id', type: 'uint256' }], outputs: [], stateMutability: 'nonpayable' },
  { name: 'Transfer', type: 'event', inputs: [{ name: 'from', type: 'address', indexed: true }, { name: 'to', type: 'address', indexed: true }, { name: 'token_id', type: 'uint256', indexed: true }], anonymous: false },
  { name: 'Approval', type: 'event', inputs: [{ name: 'owner', type: 'address', indexed: true }, { name: 'approved', type: 'address', indexed: true }, { name: 'token_id', type: 'uint256', indexed: true }], anonymous: false },
  { name: 'ApprovalForAll', type: 'event', inputs: [{ name: 'owner', type: 'address', indexed: true }, { name: 'operator', type: 'address', indexed: true }, { name: 'approved', type: 'bool', indexed: false }], anonymous: false },
  { name: 'NotTokenOwner', type: 'error', inputs: [] },
  { name: 'TokenAlreadyMinted', type: 'error', inputs: [] },
  { name: 'TokenDoesNotExist', type: 'error', inputs: [] },
  { name: 'NotApprovedOrOwner', type: 'error', inputs: [] },
];
