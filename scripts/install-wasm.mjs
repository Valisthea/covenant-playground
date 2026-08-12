#!/usr/bin/env node
//
// Install a wasm-pack build into public/covenant-wasm under content-hashed
// names, and write the manifest the loader reads.
//
// The playground served a compiler five weeks older than the one it claimed,
// and had done so before: in July it served a build with a known Critical. The
// wasm is a separate artifact from the compiler repository and nothing
// regenerates it, so the only defence is making the regeneration one command.
//
// Hashing the filenames matters as much as rebuilding. The wasm was served
// with `Cache-Control: immutable, max-age=31536000` at a FIXED name, so a
// browser that had loaded the stale build would keep it for a year no matter
// how many times the file was replaced. With the hash in the name, immutable
// becomes true instead of a trap: a new build is a new URL.
//
// Usage:
//   node scripts/install-wasm.mjs <wasm-pack-out-dir> [--commit <sha>]
//
// Produce the input with, from the compiler checkout:
//   wasm-pack build crates/covenant-wasm-bindings --target web --release --out-dir <dir>

import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const dest = join(root, 'public', 'covenant-wasm')

const srcDir = process.argv[2]
if (!srcDir) {
  console.error('usage: node scripts/install-wasm.mjs <wasm-pack-out-dir> [--commit <sha>]')
  process.exit(2)
}
const commitFlag = process.argv.indexOf('--commit')
const commit = commitFlag > 0 ? process.argv[commitFlag + 1] : null

const JS = 'covenant_wasm_bindings.js'
const WASM = 'covenant_wasm_bindings_bg.wasm'
const DTS = 'covenant_wasm_bindings.d.ts'

for (const f of [JS, WASM]) {
  if (!existsSync(join(srcDir, f))) {
    console.error(`missing ${f} in ${srcDir}; is that a wasm-pack --target web output?`)
    process.exit(2)
  }
}

const wasmBytes = readFileSync(join(srcDir, WASM))
const hash = createHash('sha256').update(wasmBytes).digest('hex').slice(0, 12)

// The crate version, from the package.json wasm-pack writes beside the binary.
//
// Scanning the wasm for a version-shaped string does not work: the first match
// in this build is 0.17.1, a dependency's version, not the compiler's. The
// generated package.json carries `version.workspace`, which is the workspace
// version by definition.
const pkgPath = join(srcDir, 'package.json')
if (!existsSync(pkgPath)) {
  console.error(`missing package.json in ${srcDir}; the version cannot be established`)
  process.exit(2)
}
const version = JSON.parse(readFileSync(pkgPath, 'utf8')).version
if (!version) {
  console.error('package.json carries no version')
  process.exit(2)
}

const jsName = `covenant_wasm_bindings-${hash}.js`
const wasmName = `covenant_wasm_bindings_bg-${hash}.wasm`

mkdirSync(dest, { recursive: true })

// Drop every previous artifact. Leaving old hashed copies behind would grow
// the deployment without bound and make it impossible to tell what is live.
for (const f of readdirSync(dest)) {
  rmSync(join(dest, f), { force: true })
}

copyFileSync(join(srcDir, WASM), join(dest, wasmName))
if (existsSync(join(srcDir, DTS))) {
  copyFileSync(join(srcDir, DTS), join(dest, DTS))
}

// wasm-pack's glue defaults to loading a sibling named after itself. The loader
// passes an explicit URL, but rewriting the default keeps the module usable on
// its own and stops it reaching for a filename that no longer exists.
let glue = readFileSync(join(srcDir, JS), 'utf8')
glue = glue.split(WASM).join(wasmName)
writeFileSync(join(dest, jsName), glue)

const manifest = {
  _comment:
    'Written by scripts/install-wasm.mjs. Filenames carry a content hash so the immutable cache header is safe. Do not edit by hand: the loader reads this, and a hand-edited name will not match the bytes.',
  version,
  js: jsName,
  wasm: wasmName,
  sha256: createHash('sha256').update(wasmBytes).digest('hex'),
  builtFrom: commit,
}
writeFileSync(join(dest, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')

console.log(`installed covenant ${version} wasm`)
console.log(`  ${wasmName} (${(wasmBytes.length / 1024).toFixed(0)} KiB)`)
console.log(`  ${jsName}`)
console.log(`  manifest.json${commit ? ` (built from ${commit})` : ''}`)
