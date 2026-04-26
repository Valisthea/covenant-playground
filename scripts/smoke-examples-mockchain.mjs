#!/usr/bin/env node
/**
 * Sprint 26 audit Phase 3 — Puppeteer smoke for the 14 examples on
 * MockChain target.
 *
 * Goal: confirm every shipped example actually compiles, deploys, and
 * (where applicable) interacts on the in-tab MockChain. No real
 * Sepolia involvement — that test is the operator-driven manual
 * checklist (`scripts/manual-sepolia-checklist.md`) since Puppeteer +
 * MetaMask is brittle.
 *
 * Setup:
 *
 *   cd covenant-playground
 *   npm install --no-save puppeteer
 *   npm run dev   # in another terminal
 *   node scripts/smoke-examples-mockchain.mjs
 *
 * Or against production:
 *
 *   PLAYGROUND_URL=https://playground.covenant-lang.org \
 *     node scripts/smoke-examples-mockchain.mjs
 *
 * Acceptance: 14/15 examples (skip 15-deploy-to-sepolia) reach the
 * "Compile clean → Deploy → contract appears in ContractList" state
 * without error. Any failure → a finding in
 * `audits/<date>-omega-v4-covenant-v0.8/02-findings/`.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import puppeteer from 'puppeteer';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const URL_BASE = process.env.PLAYGROUND_URL ?? 'http://localhost:5173';

// IDs from src/examples/registry.ts. Keep in sync if examples are
// added/removed.
const EXAMPLE_IDS = [
  '01-hello',
  '02-coin',
  '03-open-ballot',
  '04-shielded-counter',
  '05-quantum-board',
  '06-secret-coin',
  '07-private-dao',
  '08-amnesia-ceremony',
  '09-encrypted-bridge',
  '10-hybrid-state',
  '11-ceremony',
  '12-uups',
  '13-beacon-proxy',
  '14-oracle',
  // '15-deploy-to-sepolia' deliberately skipped — manual Sepolia test
];

async function main() {
  console.log(`==> Smoke testing MockChain deploy on ${URL_BASE}`);
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });

  let pass = 0;
  let fail = 0;
  const failures = [];

  for (const id of EXAMPLE_IDS) {
    const page = await browser.newPage();
    page.on('pageerror', (e) => console.error(`  page error: ${e.message}`));

    try {
      const url = `${URL_BASE}/?example=${encodeURIComponent(id)}`;
      await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });

      // Wait for the WASM compiler to load + first compile to land.
      await page.waitForFunction(
        () => {
          const w = window;
          return w.__covenantBundle?.compileResult?.ok === true;
        },
        { timeout: 30000 },
      ).catch(() => {});

      // Trigger Deploy via the store (more robust than clicking the
      // button — bypasses any UI race / overlay).
      const result = await page.evaluate(async () => {
        const store = (await import('/src/lib/store.ts')).useStore;
        const state = store.getState();
        if (!state.compileResult?.ok) {
          return { ok: false, stage: 'compile', diags: state.diagnostics };
        }
        try {
          const receipt = await state.deploy();
          return { ok: !!receipt, stage: 'deploy', receipt };
        } catch (e) {
          return { ok: false, stage: 'deploy', error: String(e) };
        }
      });

      if (result.ok) {
        console.log(`  ✓ ${id} → deployed ${result.receipt?.to ?? '(no addr)'}`);
        pass++;
      } else {
        console.error(`  ✗ ${id} failed at stage ${result.stage}`);
        if (result.diags) console.error('    diags:', JSON.stringify(result.diags).slice(0, 200));
        if (result.error) console.error('    error:', result.error);
        fail++;
        failures.push({ id, ...result });
      }
    } catch (e) {
      console.error(`  ✗ ${id} threw: ${e.message}`);
      fail++;
      failures.push({ id, error: String(e) });
    } finally {
      await page.close();
    }
  }

  await browser.close();

  console.log('');
  console.log(`==> RESULTS: ${pass}/${EXAMPLE_IDS.length} passed, ${fail} failed`);

  if (fail > 0) {
    console.log('');
    console.log('Failures (file findings against the audit folder):');
    for (const f of failures) {
      console.log(`  - ${f.id}: stage=${f.stage ?? 'unknown'}`);
    }
    process.exit(1);
  }

  process.exit(0);
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(2);
});
