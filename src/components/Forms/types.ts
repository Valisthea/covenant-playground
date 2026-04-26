/**
 * Shared types for the AbiFormBuilder primitive (Sprint 25).
 *
 * The shapes deliberately mirror Solidity / ethers `AbiFragment.inputs`
 * so a fragment lifted from a `CompileResult.abi` can be passed in
 * verbatim with no remapping.
 */

export interface AbiInput {
  /** Parameter name. May be empty for anonymous params; the form falls
   *  back to `_<index>` in that case. */
  name: string;
  /** Solidity ABI type string: `"address"`, `"uint256"`, `"bytes32"`,
   *  `"bool"`, `"string"`, `"bytes"`, `"uintN[]"`, `"tuple"`, … */
  type: string;
  /** For `tuple` and `tuple[]`. */
  components?: AbiInput[];
  /** ethers internal — we ignore at the form layer. */
  indexed?: boolean;
}

export interface ValidationError {
  field: string;
  message: string;
}
