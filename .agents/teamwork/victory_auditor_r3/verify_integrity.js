import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const rootDir = path.resolve('.');

function walk(dir, out = []) {
  const fullDir = path.join(rootDir, dir);
  if (!fs.existsSync(fullDir)) return out;
  for (const ent of fs.readdirSync(fullDir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    const fullP = path.join(rootDir, p);
    if (ent.isDirectory()) walk(p, out);
    else if (p.endsWith('.js')) out.push(p);
  }
  return out;
}

console.log('=== FORENSIC TEST AUDIT ===');
const testFiles = walk('tests/unit').concat(walk('tests/e2e'));
let totalTestsFound = 0;
let testsWithoutAssertions = 0;
let emptyTests = 0;

for (const relFile of testFiles) {
  const fullFile = path.join(rootDir, relFile);
  const content = fs.readFileSync(fullFile, 'utf-8');

  // Regex to match it('name', async () => { ... })
  // We can parse line-by-line or with AST / state machine
  const lines = content.split('\n');
  let currentTestName = null;
  let currentTestBody = [];
  let inTest = false;
  let braceDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!inTest) {
      const match = line.match(/(?:it|test)\s*\(\s*['"`](.*?)['"`]/);
      if (match) {
        currentTestName = match[1];
        inTest = true;
        totalTestsFound++;
        currentTestBody = [];
        braceDepth = 0;
        for (const char of line.slice(match.index)) {
          if (char === '{') braceDepth++;
          else if (char === '}') braceDepth--;
        }
        if (braceDepth === 0 && line.includes('=>') && line.includes('{') && line.includes('}')) {
          // One-liner test
          inTest = false;
          analyzeTest(relFile, currentTestName, [line]);
        }
      }
    } else {
      currentTestBody.push(line);
      for (const char of line) {
        if (char === '{') braceDepth++;
        else if (char === '}') braceDepth--;
      }
      if (braceDepth <= 0) {
        inTest = false;
        analyzeTest(relFile, currentTestName, currentTestBody);
      }
    }
  }
}

function analyzeTest(file, name, bodyLines) {
  const text = bodyLines.join('\n');
  const clean = text.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '').trim();
  if (clean.length === 0) {
    console.log(`[EMPTY TEST] ${file} :: ${name}`);
    emptyTests++;
  }
  const hasAssert = text.includes('assert') || text.includes('expect');
  if (!hasAssert) {
    console.log(`[NO ASSERTION] ${file} :: ${name}`);
    testsWithoutAssertions++;
  }
}

console.log(`Total tests parsed: ${totalTestsFound}`);
console.log(`Empty tests: ${emptyTests}`);
console.log(`Tests without assertion calls: ${testsWithoutAssertions}`);

console.log('\n=== PRE-POPULATED LOG/OUTPUT ARTIFACT CHECK ===');
const rootEntries = fs.readdirSync(rootDir);
const suspiciousFiles = rootEntries.filter(f => f.endsWith('.log') || f.includes('result') || f.includes('output'));
console.log('Root suspicious log/result files:', suspiciousFiles);

console.log('\n=== FACADE IMPLEMENTATION CHECK IN src/ ===');
const srcFiles = walk('src');
let dummyMethods = 0;
for (const relFile of srcFiles) {
  const fullFile = path.join(rootDir, relFile);
  const content = fs.readFileSync(fullFile, 'utf-8');
  if (content.includes('NotImplementedError')) {
    console.log(`[FACADE NotImplementedError] ${relFile}`);
    dummyMethods++;
  }
  // Check for dummy stubs like function foo() {}
  const emptyFnMatches = content.match(/function\s+[a-zA-Z0-9_]+\s*\([^)]*\)\s*\{\s*\}/g);
  if (emptyFnMatches) {
    console.log(`[EMPTY FUNCTION] ${relFile}:`, emptyFnMatches);
    dummyMethods++;
  }
}
console.log(`Total src files checked: ${srcFiles.length}, dummy methods found: ${dummyMethods}`);
