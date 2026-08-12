#!/usr/bin/env node
//
// Compile every gallery example and check it against the status the registry
// claims for it.
//
// This script is written because the registry already said it existed. The
// header of src/examples/e-series.ts read "the inventory CI gate
// (scripts/inventory-content.mjs --strict) ensures every entry compiles", and
// there was no such file and no CI in this repository at all. Under that
// sentence, five of seventeen examples did not compile, two of them written
// against an `interface` keyword the language never had, and all five carried
// compileStatus: 'verified'. A badge nobody computes is worse than no badge:
// it transfers the reader's trust to a claim nothing backs.
//
// Usage:
//   node scripts/inventory-content.mjs [--strict]
//
// Needs a Covenant compiler. Set COVENANT to its path, or leave it and the
// script looks for a sibling checkout. --strict makes any mismatch exit 1;
// without it the report is printed and the exit code stays 0.

import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const strict = process.argv.includes('--strict')

function findCompiler() {
  if (process.env.COVENANT) return process.env.COVENANT
  const candidates = [
    ['..', 'covenant-src', 'target', 'release', 'covenant.exe'],
    ['..', 'covenant-src', 'target', 'release', 'covenant'],
    ['..', 'covenant-language', 'target', 'release', 'covenant.exe'],
    ['..', 'covenant-language', 'target', 'release', 'covenant'],
  ]
  for (const parts of candidates) {
    const p = resolve(root, ...parts)
    if (existsSync(p)) return p
  }
  return null
}

const compiler = findCompiler()
if (!compiler) {
  console.error(
    'No Covenant compiler found. Set COVENANT to its path, or build one:\n' +
      '  cargo build --release --bin covenant',
  )
  process.exit(2)
}

/** Declared status per example id, read out of the registry source. */
function declaredStatuses() {
  const src = readFileSync(join(root, 'src', 'examples', 'e-series.ts'), 'utf8')
  const out = new Map()
  // Entries are object literals; id comes first, compileStatus last. Split on
  // the id and take the first compileStatus that follows it.
  const parts = src.split(/\bid:\s*'/).slice(1)
  for (const part of parts) {
    const id = part.slice(0, part.indexOf("'"))
    const m = part.match(/compileStatus:\s*'(verified|failing|untested)'/)
    if (m) out.set(id, m[1])
  }
  return out
}

/** null when the source builds, otherwise the first diagnostic code. */
function build(file) {
  const out = mkdtempSync(join(tmpdir(), 'covinv-'))
  try {
    execFileSync(compiler, ['build', file, '--out', out], { stdio: 'pipe' })
    return null
  } catch (err) {
    const text = String(err.stdout ?? '') + String(err.stderr ?? '')
    const m = text.replace(/\[[0-9;]*m/g, '').match(/\[([EW]\d+)\]/)
    return m ? m[1] : 'unknown'
  } finally {
    rmSync(out, { recursive: true, force: true })
  }
}

const declared = declaredStatuses()
const dir = join(root, 'public', 'examples')
const files = readdirSync(dir)
  .filter((f) => /^E\d+-.*\.cov$/.test(f))
  .sort()

const problems = []
let built = 0
let failed = 0

for (const f of files) {
  const id = f.slice(0, f.indexOf('-'))
  const code = build(join(dir, f))
  const observed = code === null ? 'verified' : 'failing'
  if (code === null) built++
  else failed++

  const claim = declared.get(id)
  if (claim === undefined) {
    problems.push(`${f} has no entry in e-series.ts, so nothing describes it`)
  } else if (claim !== observed && claim !== 'untested') {
    problems.push(
      code === null
        ? `${f} is marked '${claim}' and builds; the registry understates it`
        : `${f} is marked '${claim}' but does not build (${code})`,
    )
  }
}

// A gate that stops finding anything certifies nothing. This is the same
// meta-assertion the compiler repo's own documentation gate carries.
if (files.length === 0) {
  problems.push('no .cov files were found at all; the path is wrong')
}
if (declared.size === 0) {
  problems.push('no compileStatus was parsed from e-series.ts; the parser is broken')
}

console.log(`compiler: ${compiler}`)
console.log(`examples: ${files.length}, build: ${built}, refused: ${failed}`)
console.log(`registry entries with a status: ${declared.size}`)

if (problems.length === 0) {
  console.log('every example matches the status the registry claims for it')
  process.exit(0)
}

console.log('')
for (const p of problems) console.log(`  ${p}`)
process.exit(strict ? 1 : 0)
