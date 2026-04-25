/**
 * Move the chain clock forward by `seconds`.
 * @param {bigint} seconds
 */
export function chain_advance_time(seconds) {
    wasm.chain_advance_time(seconds);
}

/**
 * State-mutating call.
 * @param {string} args_json
 * @returns {any}
 */
export function chain_call(args_json) {
    const ptr0 = passStringToWasm0(args_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.chain_call(ptr0, len0);
    return ret;
}

/**
 * Deploy a contract. Returns a `TxReceipt` JSON object.
 * @param {string} args_json
 * @returns {any}
 */
export function chain_deploy(args_json) {
    const ptr0 = passStringToWasm0(args_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.chain_deploy(ptr0, len0);
    return ret;
}

/**
 * @returns {any}
 */
export function chain_get_accounts() {
    const ret = wasm.chain_get_accounts();
    return ret;
}

/**
 * @returns {any}
 */
export function chain_get_contracts() {
    const ret = wasm.chain_get_contracts();
    return ret;
}

/**
 * Block number, timestamp, contract count, account count, tx count.
 * Sized for the playground's status bar — refresh on every UI tick.
 * @returns {any}
 */
export function chain_get_state() {
    const ret = wasm.chain_get_state();
    return ret;
}

/**
 * Read a storage slot directly. Useful for the Inspector's "Storage
 * inspector" sub-pane.
 * @param {string} address_hex
 * @param {string} slot_hex
 * @returns {any}
 */
export function chain_get_storage(address_hex, slot_hex) {
    const ptr0 = passStringToWasm0(address_hex, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passStringToWasm0(slot_hex, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.chain_get_storage(ptr0, len0, ptr1, len1);
    return ret;
}

/**
 * @returns {any}
 */
export function chain_get_tx_log() {
    const ret = wasm.chain_get_tx_log();
    return ret;
}

/**
 * Reset the chain to genesis: 5 prefunded accounts, no deployments,
 * block 1, clock at `DEFAULT_GENESIS`.
 */
export function chain_init() {
    wasm.chain_init();
}

/**
 * Mine `count` blocks. Each block also bumps the clock by 12s.
 * @param {bigint} count
 */
export function chain_mine_blocks(count) {
    wasm.chain_mine_blocks(count);
}

/**
 * Alias for `chain_init`. The playground's UI uses "Reset", the
 * underlying op is identical — having both names lets the JS side
 * pick whichever reads better at the call site.
 */
export function chain_reset() {
    wasm.chain_reset();
}

/**
 * Read-only call. Storage changes are dropped, no receipt is appended
 * to the chain's tx_log. The returned `TxReceipt` carries the raw
 * return data hex for the playground's view-action UI to decode.
 * @param {string} args_json
 * @returns {any}
 */
export function chain_static_call(args_json) {
    const ptr0 = passStringToWasm0(args_json, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.chain_static_call(ptr0, len0);
    return ret;
}

/**
 * Run only frontend stages (lex → parse → resolve → typecheck →
 * privacy). Cheap enough for keystroke-rate calls; used by Monaco's
 * live diagnostics.
 * @param {string} source
 * @returns {any}
 */
export function check(source) {
    const ptr0 = passStringToWasm0(source, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.check(ptr0, len0);
    return ret;
}

/**
 * Compile a Covenant source string targeting EVM bytecode.
 *
 * Returns a JS object matching the `JsCompileResult` schema.
 * Panics are caught by `console_error_panic_hook` and surface as
 * JS exceptions; the playground catches those and shows a generic
 * "internal compiler error" diagnostic.
 * @param {string} source
 * @returns {any}
 */
export function compile_to_evm(source) {
    const ptr0 = passStringToWasm0(source, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.compile_to_evm(ptr0, len0);
    return ret;
}

/**
 * Compile up to IR construction and return the IR as printable text.
 * Used by the Inspector and Layer Explorer panes.
 * @param {string} source
 * @returns {any}
 */
export function compile_to_ir_text(source) {
    const ptr0 = passStringToWasm0(source, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.compile_to_ir_text(ptr0, len0);
    return ret;
}

/**
 * Diagnostic-code → prose-explanation table. Reserved surface;
 * returns `[]` until the compiler's diagnostic registry exposes
 * long-form explanations (filed in DEBT.md as "diagnostic prose
 * registry").
 * @returns {any}
 */
export function diagnostic_explanations() {
    const ret = wasm.diagnostic_explanations();
    return ret;
}

/**
 * Initialize the WASM module. Wires up the panic hook (when the
 * `panic-hook` feature is enabled) so that Rust panics surface as
 * readable JS exceptions in the browser console.
 */
export function init() {
    wasm.init();
}

/**
 * Compiler version, e.g. `"0.8.2"`.
 * @returns {string}
 */
export function version() {
    let deferred1_0;
    let deferred1_1;
    try {
        const ret = wasm.version();
        deferred1_0 = ret[0];
        deferred1_1 = ret[1];
        return getStringFromWasm0(ret[0], ret[1]);
    } finally {
        wasm.__wbindgen_free(deferred1_0, deferred1_1, 1);
    }
}
function __wbg_get_imports() {
    const import0 = {
        __proto__: null,
        __wbg_Error_960c155d3d49e4c2: function(arg0, arg1) {
            const ret = Error(getStringFromWasm0(arg0, arg1));
            return ret;
        },
        __wbg___wbindgen_is_string_6df3bf7ef1164ed3: function(arg0) {
            const ret = typeof(arg0) === 'string';
            return ret;
        },
        __wbg___wbindgen_throw_6b64449b9b9ed33c: function(arg0, arg1) {
            throw new Error(getStringFromWasm0(arg0, arg1));
        },
        __wbg_new_34d45cc8e36aaead: function() {
            const ret = new Map();
            return ret;
        },
        __wbg_new_682678e2f47e32bc: function() {
            const ret = new Array();
            return ret;
        },
        __wbg_new_aa8d0fa9762c29bd: function() {
            const ret = new Object();
            return ret;
        },
        __wbg_now_a9b7df1cbee90986: function() {
            const ret = Date.now();
            return ret;
        },
        __wbg_set_3bf1de9fab0cd644: function(arg0, arg1, arg2) {
            arg0[arg1 >>> 0] = arg2;
        },
        __wbg_set_6be42768c690e380: function(arg0, arg1, arg2) {
            arg0[arg1] = arg2;
        },
        __wbg_set_fde2cec06c23692b: function(arg0, arg1, arg2) {
            const ret = arg0.set(arg1, arg2);
            return ret;
        },
        __wbindgen_cast_0000000000000001: function(arg0) {
            // Cast intrinsic for `F64 -> Externref`.
            const ret = arg0;
            return ret;
        },
        __wbindgen_cast_0000000000000002: function(arg0) {
            // Cast intrinsic for `I64 -> Externref`.
            const ret = arg0;
            return ret;
        },
        __wbindgen_cast_0000000000000003: function(arg0, arg1) {
            // Cast intrinsic for `Ref(String) -> Externref`.
            const ret = getStringFromWasm0(arg0, arg1);
            return ret;
        },
        __wbindgen_cast_0000000000000004: function(arg0) {
            // Cast intrinsic for `U64 -> Externref`.
            const ret = BigInt.asUintN(64, arg0);
            return ret;
        },
        __wbindgen_init_externref_table: function() {
            const table = wasm.__wbindgen_externrefs;
            const offset = table.grow(4);
            table.set(0, undefined);
            table.set(offset + 0, undefined);
            table.set(offset + 1, null);
            table.set(offset + 2, true);
            table.set(offset + 3, false);
        },
    };
    return {
        __proto__: null,
        "./covenant_wasm_bindings_bg.js": import0,
    };
}

function getStringFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return decodeText(ptr, len);
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function passStringToWasm0(arg, malloc, realloc) {
    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;

    const mem = getUint8ArrayMemory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }
    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        const ret = cachedTextEncoder.encodeInto(arg, view);

        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(ptr, len) {
    numBytesDecoded += len;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
        cachedTextDecoder.decode();
        numBytesDecoded = len;
    }
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

const cachedTextEncoder = new TextEncoder();

if (!('encodeInto' in cachedTextEncoder)) {
    cachedTextEncoder.encodeInto = function (arg, view) {
        const buf = cachedTextEncoder.encode(arg);
        view.set(buf);
        return {
            read: arg.length,
            written: buf.length
        };
    };
}

let WASM_VECTOR_LEN = 0;

let wasmModule, wasm;
function __wbg_finalize_init(instance, module) {
    wasm = instance.exports;
    wasmModule = module;
    cachedUint8ArrayMemory0 = null;
    wasm.__wbindgen_start();
    return wasm;
}

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);
            } catch (e) {
                const validResponse = module.ok && expectedResponseType(module.type);

                if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else { throw e; }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);
    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };
        } else {
            return instance;
        }
    }

    function expectedResponseType(type) {
        switch (type) {
            case 'basic': case 'cors': case 'default': return true;
        }
        return false;
    }
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (module !== undefined) {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();
    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }
    const instance = new WebAssembly.Instance(module, imports);
    return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;


    if (module_or_path !== undefined) {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (module_or_path === undefined) {
        module_or_path = new URL('covenant_wasm_bindings_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync, __wbg_init as default };
