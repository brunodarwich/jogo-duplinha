#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { registry } from './helpers/framework.js';

const isWindows = process.platform === 'win32';
const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  white: '\x1b[37m'
};

function formatDuration(ms) {
  if (ms < 1000) return `${ms.toFixed(1)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function findTestFiles(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      findTestFiles(fullPath, files);
    } else if (entry.isFile() && (entry.name.endsWith('.test.js') || entry.name.endsWith('.spec.js'))) {
      files.push(fullPath);
    }
  }
  return files;
}

async function runSuite(suite, depth = 0, ancestors = []) {
  const currentPath = [...ancestors, suite.name];
  const prefix = '  '.repeat(depth);
  console.log(`${prefix}${COLORS.bold}${COLORS.cyan}● ${suite.name}${COLORS.reset}`);

  let passed = 0;
  let failed = 0;
  const failures = [];

  // Run beforeAll hooks
  for (const hook of suite.beforeAll) {
    await hook();
  }

  // Run tests in this suite
  for (const t of suite.tests) {
    const testFullName = [...currentPath, t.name].join(' > ');
    const testPrefix = '  '.repeat(depth + 1);

    // Run beforeEach hooks
    try {
      for (const hook of suite.beforeEach) {
        await hook();
      }

      const startTime = performance.now();
      await t.fn();
      const duration = performance.now() - startTime;

      console.log(`${testPrefix}${COLORS.green}✔ PASS${COLORS.reset} ${t.name} ${COLORS.dim}(${formatDuration(duration)})${COLORS.reset}`);
      passed++;

      // Run afterEach hooks
      for (const hook of suite.afterEach) {
        await hook();
      }
    } catch (err) {
      console.log(`${testPrefix}${COLORS.red}✖ FAIL${COLORS.reset} ${t.name}`);
      failed++;
      failures.push({
        fullName: testFullName,
        error: err
      });

      // Still try to run afterEach hooks
      for (const hook of suite.afterEach) {
        try { await hook(); } catch (_) {}
      }
    }
  }

  // Run child suites recursively
  for (const child of suite.children) {
    const childResult = await runSuite(child, depth + 1, currentPath);
    passed += childResult.passed;
    failed += childResult.failed;
    failures.push(...childResult.failures);
  }

  // Run afterAll hooks
  for (const hook of suite.afterAll) {
    try { await hook(); } catch (_) {}
  }

  return { passed, failed, failures };
}

async function main() {
  const args = process.argv.slice(2);
  const filterArg = args.find(a => !a.startsWith('-'));
  const testRoot = path.resolve(import.meta.dirname ? import.meta.dirname : path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')));

  const searchDirs = [
    path.join(testRoot, 'unit'),
    path.join(testRoot, 'e2e')
  ];

  let testFiles = [];
  for (const dir of searchDirs) {
    findTestFiles(dir, testFiles);
  }

  if (filterArg) {
    const regex = new RegExp(filterArg, 'i');
    testFiles = testFiles.filter(f => regex.test(f));
  }

  if (testFiles.length === 0) {
    console.log(`${COLORS.yellow}No test files found matching criteria.${COLORS.reset}`);
    process.exit(0);
  }

  console.log(`\n${COLORS.bold}======================================================${COLORS.reset}`);
  console.log(`${COLORS.bold}  Jogo Duplinha MOBA 2.5D — Automated Test Runner    ${COLORS.reset}`);
  console.log(`${COLORS.bold}======================================================${COLORS.reset}\n`);
  console.log(`Discovered ${testFiles.length} test file(s).\n`);

  let totalPassed = 0;
  let totalFailed = 0;
  const allFailures = [];
  const globalStart = performance.now();

  for (const file of testFiles) {
    const relPath = path.relative(path.join(testRoot, '..'), file);
    console.log(`\n${COLORS.dim}──────────────────────────────────────────────────────${COLORS.reset}`);
    console.log(`${COLORS.bold}File: ${relPath}${COLORS.reset}`);
    console.log(`${COLORS.dim}──────────────────────────────────────────────────────${COLORS.reset}`);

    registry.clear();
    const fileUrl = pathToFileURL(file).href;

    try {
      await import(fileUrl);
    } catch (importErr) {
      console.log(`${COLORS.red}✖ FAILED TO LOAD TEST FILE: ${file}${COLORS.reset}`);
      console.error(importErr);
      totalFailed++;
      allFailures.push({
        fullName: `[LOAD ERROR] ${relPath}`,
        error: importErr
      });
      continue;
    }

    for (const suite of registry.suites) {
      const result = await runSuite(suite, 0, []);
      totalPassed += result.passed;
      totalFailed += result.failed;
      allFailures.push(...result.failures);
    }
  }

  const globalDuration = performance.now() - globalStart;

  console.log(`\n${COLORS.bold}======================================================${COLORS.reset}`);
  console.log(`${COLORS.bold}                   TEST SUMMARY                       ${COLORS.reset}`);
  console.log(`${COLORS.bold}======================================================${COLORS.reset}`);
  console.log(`Test Files:   ${testFiles.length} passed (${testFiles.length} total)`);
  console.log(`Total Tests:  ${totalPassed + totalFailed}`);
  console.log(`Passed:       ${COLORS.green}${totalPassed}${COLORS.reset}`);
  console.log(`Failed:       ${totalFailed > 0 ? COLORS.red : COLORS.reset}${totalFailed}${COLORS.reset}`);
  console.log(`Duration:     ${formatDuration(globalDuration)}`);
  console.log(`${COLORS.bold}======================================================${COLORS.reset}\n`);

  if (allFailures.length > 0) {
    console.log(`${COLORS.bold}${COLORS.red}FAILURES DETAIL:${COLORS.reset}\n`);
    for (const f of allFailures) {
      console.log(`${COLORS.red}● ${f.fullName}${COLORS.reset}`);
      if (f.error && f.error.stack) {
        console.log(`${COLORS.dim}${f.error.stack}${COLORS.reset}\n`);
      } else {
        console.log(`${COLORS.dim}${String(f.error)}${COLORS.reset}\n`);
      }
    }
    process.exit(1);
  } else {
    console.log(`${COLORS.bold}${COLORS.green}✔ ALL TEST SUITES PASSED CLEANLY!${COLORS.reset}\n`);
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
