import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const projectRoot = path.resolve(
  import.meta.dirname ? path.join(import.meta.dirname, '../..') : path.resolve('.')
);

/**
 * Resolves a module either from src/ (if implemented) or fallback to tests/oracles/.
 * @param {string} moduleRelPath - e.g. 'core/isometric'
 */
export async function resolveModule(moduleRelPath) {
  const cleanPath = moduleRelPath.replace(/\.js$/, '');
  const srcFile = path.join(projectRoot, 'src', `${cleanPath}.js`);
  const oracleFile = path.join(projectRoot, 'tests', 'oracles', `${cleanPath}.js`);

  if (fs.existsSync(srcFile)) {
    const srcUrl = pathToFileURL(srcFile).href + `?t=${Date.now()}`;
    const mod = await import(srcUrl);
    return { module: mod, isOracle: false, sourcePath: srcFile };
  }

  if (fs.existsSync(oracleFile)) {
    const oracleUrl = pathToFileURL(oracleFile).href;
    const mod = await import(oracleUrl);
    return { module: mod, isOracle: true, sourcePath: oracleFile };
  }

  throw new Error(`Neither src file nor oracle found for module: ${moduleRelPath}`);
}

/**
 * Always returns the authoritative specification oracle for comparison.
 */
export async function getOracle(moduleRelPath) {
  const cleanPath = moduleRelPath.replace(/\.js$/, '');
  const oracleFile = path.join(projectRoot, 'tests', 'oracles', `${cleanPath}.js`);
  if (!fs.existsSync(oracleFile)) {
    throw new Error(`Specification oracle not found: ${oracleFile}`);
  }
  const oracleUrl = pathToFileURL(oracleFile).href;
  return await import(oracleUrl);
}
