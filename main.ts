// main.ts — build script for the GULLWING MAIL entry.
// Node 22, standard library only. Copies game/ and screenshots/ into the
// output directory and writes the dossier with the kit's buildDossier.
// Deterministic: sorted traversal, byte-exact copies, no timestamps.
// The output directory itself is never removed — on the grader it is a
// mount point, so only its contents are cleared.
import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const GAME_MAX_FILES = 993;
const GAME_MAX_BYTES = 50331648;
const INDEX_MAX_BYTES = 1048576;
const SCREENSHOT_MAX_BYTES = 262144;
const SCREENSHOT_MAX_COUNT = 4;

// Sorted recursive file list, so every run walks the tree in the same order.
function listFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string): void => {
    for (const name of readdirSync(d).sort()) {
      const p = join(d, name);
      const st = statSync(p);
      if (st.isDirectory()) walk(p);
      else if (st.isFile()) out.push(p);
    }
  };
  walk(dir);
  return out;
}

function copyTree(srcDir: string, destDir: string): { files: number; bytes: number } {
  let files = 0;
  let bytes = 0;
  for (const src of listFiles(srcDir)) {
    const rel = src.slice(srcDir.length + 1);
    const dest = join(destDir, rel);
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(src, dest);
    files++;
    bytes += statSync(src).size;
  }
  return { files, bytes };
}

// The game must make zero network requests: every reference has to be a
// data: URI or a file inside game/. Fail the build if any non-vendored
// source file mentions a URL. (Vendored *.min.* files are skipped — they are
// listed by path only and their internal strings are not references.)
function checkNoNetworkRefs(gameDir: string): void {
  const urlPattern = /https?:\/\//;
  for (const src of listFiles(gameDir)) {
    if (/\.min\.(js|mjs|css)$/.test(src)) continue;
    if (!/\.(html|js|mjs|css|json)$/.test(src)) continue;
    const text = readFileSync(src, 'utf8');
    if (urlPattern.test(text)) throw new Error(`${src} contains a network URL reference`);
  }
}

function main(): void {
  mkdirSync(outputDir, { recursive: true });
  // Clear previous contents (files only) so stale files never leak in.
  for (const name of readdirSync(outputDir).sort()) {
    rmSync(join(outputDir, name), { recursive: true, force: true });
  }
  mkdirSync(join(outputDir, 'game'), { recursive: true });
  mkdirSync(join(outputDir, 'screenshots'), { recursive: true });

  const game = copyTree(join(repoRoot, 'game'), join(outputDir, 'game'));
  if (game.files > GAME_MAX_FILES) throw new Error(`game has ${game.files} files, max ${GAME_MAX_FILES}`);
  if (game.bytes > GAME_MAX_BYTES) throw new Error(`game is ${game.bytes} bytes, max ${GAME_MAX_BYTES}`);
  const indexBytes = statSync(join(repoRoot, 'game', 'index.html')).size;
  if (indexBytes > INDEX_MAX_BYTES) throw new Error(`index.html is ${indexBytes} bytes, max ${INDEX_MAX_BYTES}`);
  checkNoNetworkRefs(join(outputDir, 'game'));

  const shots = copyTree(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'));
  if (shots.files > SCREENSHOT_MAX_COUNT) throw new Error(`${shots.files} screenshots, max ${SCREENSHOT_MAX_COUNT}`);
  for (const src of listFiles(join(repoRoot, 'screenshots'))) {
    if (statSync(src).size > SCREENSHOT_MAX_BYTES) throw new Error(`${src} exceeds ${SCREENSHOT_MAX_BYTES} bytes`);
  }

  writeFileSync(
    join(outputDir, 'dossier.json'),
    buildDossier(outputDir, {
      text_max_bytes: 163840,
      screenshots: { max: 4, max_bytes: 262144 },
      game_max_files: 993,
      game_max_bytes: 50331648,
    }),
  );
  console.log(`built ${game.files} game files (${game.bytes} bytes) + ${shots.files} screenshots into ${outputDir}`);
}

main();
