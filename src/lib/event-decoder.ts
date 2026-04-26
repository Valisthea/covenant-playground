/**
 * Event log decoder (V0.9 Sprint 37 Phase 37.3).
 *
 * Translates raw `TransactionReceipt.logs[]` from ethers v6 into the
 * `MockEvent[]` shape the playground's TxHistoryPane already renders
 * for MockChain. By unifying the format across MockChain (events are
 * pre-decoded by the WASM runtime) and Sepolia (events arrive as raw
 * topics + data hex), the rendering layer doesn't have to special-case.
 *
 * The decoder is *defensive*:
 *
 *   1. If the log's first topic matches an event in the contract's
 *      ABI, ethers' `iface.parseLog` returns a structured `LogDescription`
 *      with a name + decoded args. We use it.
 *
 *   2. If the log doesn't match (e.g. a log from a different contract
 *      bubbled up via DELEGATECALL, or an event the playground's local
 *      ABI doesn't have), we surface a stub event named `<unknown>`
 *      with the raw topics + data preserved, so power users can still
 *      see what happened without crashing the UI.
 *
 *   3. If `iface.parseLog` throws (malformed input), we catch and
 *      produce the same `<unknown>` stub. Never throw out of decodeLogs;
 *      the playground should always render something.
 */

import type { Interface } from 'ethers';
import type { MockEvent } from './mockchain';

interface RawLog {
  topics: readonly string[];
  data: string;
  address?: string;
}

/**
 * Decode a list of raw logs via the given ethers Interface. Returns
 * one `MockEvent` per log; logs that can't be decoded against the
 * Interface fall back to a `<unknown>` event with raw topics/data.
 */
export function decodeLogs(
  iface: Interface,
  logs: ReadonlyArray<RawLog>,
): MockEvent[] {
  return logs.map((log) => decodeOneLog(iface, log));
}

function decodeOneLog(iface: Interface, log: RawLog): MockEvent {
  try {
    const parsed = iface.parseLog({
      topics: [...log.topics],
      data: log.data,
    });
    if (parsed === null) {
      return makeUnknown(log);
    }
    const args: Record<string, unknown> = {};
    parsed.fragment.inputs.forEach((input, i) => {
      const key = input.name && input.name.length > 0 ? input.name : `arg${i}`;
      args[key] = normalizeArgValue(parsed.args[i]);
    });
    return {
      name: parsed.name,
      args,
    };
  } catch {
    return makeUnknown(log);
  }
}

function makeUnknown(log: RawLog): MockEvent {
  return {
    name: '<unknown>',
    args: {
      address: log.address ?? '<no-address>',
      topics: [...log.topics],
      data: log.data,
    },
  };
}

/**
 * Normalize the ethers Result entry into something JSON-serializable
 * the UI can render. ethers returns a Result-like proxy for tuples,
 * bigint for uint*, etc. The TxHistoryPane already handles bigint and
 * arrays gracefully, so we keep the shape close to what ethers gives
 * us — only converting bigint → string at write time inside
 * `persistence.ts` (so persisted snapshots survive JSON.stringify).
 */
function normalizeArgValue(v: unknown): unknown {
  // ethers `Result` is array-like; spread into a plain array.
  if (Array.isArray(v)) {
    return v.map((x) => normalizeArgValue(x));
  }
  // bigint passes through; serialization layer handles it.
  return v;
}
