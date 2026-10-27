/**
 * Vendors the Bionis dashboard block + its shadcn dependencies from
 * https://registry.watermelon.sh into frontend/src, bypassing the shadcn CLI
 * (ui.shadcn.com is unreachable from this network, but watermelon mirrors it).
 *
 * Usage: node scripts/vendor-shadcn.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const FRONTEND = path.join(ROOT, 'frontend');
const BIONIS_JSON = path.join(ROOT, 'bionis-dashboard.json');
const REGISTRY = 'https://registry.watermelon.sh/r';

const START_ITEMS = [
  'utils',
  'button',
  'dropdown-menu',
  'sidebar',
  'sheet',
  'separator',
  'skeleton',
  'input',
  'use-mobile',
];

const written = new Set();
const pkgDeps = new Set();

function writeRegistryFile(rel, content) {
  const dest = path.join(FRONTEND, 'src', rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, content);
  written.add(rel);
}

async function fetchItem(name) {
  const res = await fetch(`${REGISTRY}/${name}.json`);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${name}: HTTP ${res.status}`);
  }
  return res.json();
}

async function vendorItem(name, { overwrite = true } = {}) {
  const json = await fetchItem(name);

  for (const dep of json.dependencies ?? []) {
    pkgDeps.add(dep);
  }
  for (const dep of json.devDependencies ?? []) {
    pkgDeps.add(dep);
  }

  for (const file of json.files ?? []) {
    if (!file.content) continue;
    const rel = (file.target || file.path).replace(/^src\//, '');
    if (!overwrite && fs.existsSync(path.join(FRONTEND, 'src', rel))) continue;
    writeRegistryFile(rel, file.content);
  }

  for (const dep of json.registryDependencies ?? []) {
    await vendorItem(dep, { overwrite });
  }
}

async function main() {
  for (const name of START_ITEMS) {
    await vendorItem(name);
  }

  // The bionis dashboard block itself
  const bionis = JSON.parse(fs.readFileSync(BIONIS_JSON, 'utf8'));
  for (const dep of bionis.dependencies ?? []) pkgDeps.add(dep);
  for (const dep of bionis.devDependencies ?? []) pkgDeps.add(dep);
  for (const file of bionis.files ?? []) {
    if (!file.content) continue;
    const rel = (file.target || file.path).replace(/^src\//, '');
    writeRegistryFile(rel, file.content);
  }

  console.log(`Wrote ${written.size} files.`);
  for (const rel of [...written].sort()) console.log(`  ${rel}`);
  console.log('\nDependencies to install:');
  console.log([...pkgDeps].sort().join(' '));

  // Record for the install step
  fs.writeFileSync(
    path.join(ROOT, 'scripts', '.vendor-deps.txt'),
    [...pkgDeps].sort().join(' '),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
