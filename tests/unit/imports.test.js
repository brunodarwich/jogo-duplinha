import { describe, it } from '../helpers/framework.js';
import { assertTrue, assertFalse } from '../helpers/assert.js';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

function findJsFiles(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  for (const file of fs.readdirSync(dir)) {
    const full = path.join(dir, file);
    if (fs.statSync(full).isDirectory()) {
      results.push(...findJsFiles(full));
    } else if (file.endsWith('.js')) {
      results.push(full);
    }
  }
  return results;
}

describe('Tier 1 Unit: ES Module Static Import & Export Integrity', () => {
  it('TC-IMP-01: All named imports across src/ must match existing exports', async () => {
    const projectRoot = path.resolve(
      import.meta.dirname ? path.join(import.meta.dirname, '../..') : path.resolve('.')
    );
    const srcDir = path.join(projectRoot, 'src');
    const files = findJsFiles(srcDir);
    const errors = [];

    for (const f of files) {
      const content = fs.readFileSync(f, 'utf8');
      const importRegex = /import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g;
      let match;
      while ((match = importRegex.exec(content)) !== null) {
        const specifiers = match[1].split(',').map(s => s.trim().split(/\s+as\s+/)[0].trim()).filter(Boolean);
        const importPath = match[2];
        if (importPath.startsWith('.')) {
          const resolved = path.resolve(path.dirname(f), importPath);
          if (!fs.existsSync(resolved)) {
            errors.push(`File not found: ${resolved} imported from ${f}`);
            continue;
          }
          try {
            const mod = await import(pathToFileURL(resolved).href);
            for (const s of specifiers) {
              if (!(s in mod)) {
                errors.push(`MISSING EXPORT: "${s}" in ${resolved} (imported by ${f})`);
              }
            }
          } catch (err) {
            errors.push(`Error importing ${resolved} from ${f}: ${err.message}`);
          }
        }
      }
    }

    if (errors.length > 0) {
      console.error('Module import errors found:\n' + errors.join('\n'));
    }
    assertTrue(errors.length === 0, `Expected 0 import/export errors, found: ${errors.length}`);
  });

  it('TC-IMP-02: All JavaScript source files in src/ have valid syntax', () => {
    const projectRoot = path.resolve(
      import.meta.dirname ? path.join(import.meta.dirname, '../..') : path.resolve('.')
    );
    const srcDir = path.join(projectRoot, 'src');
    const files = findJsFiles(srcDir);
    const syntaxErrors = [];

    for (const f of files) {
      try {
        execFileSync(process.execPath, ['-c', f], { stdio: 'pipe' });
      } catch (err) {
        syntaxErrors.push(`Syntax error in ${f}: ${err.message}`);
      }
    }

    assertTrue(syntaxErrors.length === 0, `Expected 0 syntax errors across src/, found:\n${syntaxErrors.join('\n')}`);
  });
});


