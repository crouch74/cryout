import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('src');

const HEX_PATTERN = /#[0-9A-Fa-f]{3,8}\b/g;
const Z_INDEX_LITERAL_PATTERN = /\bz-index\s*:\s*\d+\b|\bzIndex\s*:\s*\d+\b/g;
const INLINE_STYLE_PATTERN = /style=\{\{/g;
const EMOJI_PATTERN = /[\u{1F300}-\u{1FAFF}]/gu;
const HOME_VARIABLE_DECLARATION_PATTERN = /--home-[\w-]+\s*:/g;

function walk(dir: string, filter: (filePath: string) => boolean): string[] {
  const results: string[] = [];

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      results.push(...walk(fullPath, filter));
      continue;
    }

    if (filter(fullPath)) {
      results.push(fullPath);
    }
  }

  return results;
}

function relative(filePath: string): string {
  return path.relative(process.cwd(), filePath).replaceAll(path.sep, '/');
}

const PLAYER_STYLE_ROOTS = [
  path.join(ROOT, 'styles'),
];

const PLAYER_UI_ROOTS = [
  path.join(ROOT, 'game'),
  path.join(ROOT, 'ui'),
  path.join(ROOT, 'features'),
];

const HEX_ALLOWLIST = new Set<string>([
  'src/styles/foundation/tokens.css',
]);

const HEX_ALLOWLIST_PREFIXES = [
  'src/ui/tokens/',
];

const Z_INDEX_ALLOWLIST = new Set<string>([
  'src/game/board/worldMapTokenLayout.ts',
]);

const INLINE_STYLE_ALLOWLIST = new Set<string>([
  'src/game/board/WorldMapBoard.tsx',
  'src/game/screens/GameSessionScreen.tsx',
  'src/ui/layout/tabletop.tsx',
]);

test('no hardcoded hex literals remain in player-facing style and UI files', () => {
  const files = [
    ...PLAYER_STYLE_ROOTS.flatMap((rootDir) => walk(rootDir, (filePath) => filePath.endsWith('.css'))),
    ...PLAYER_UI_ROOTS.flatMap((rootDir) => walk(rootDir, (filePath) => filePath.endsWith('.ts') || filePath.endsWith('.tsx'))),
  ];

  const offenders: string[] = [];

  for (const filePath of files) {
    const rel = relative(filePath);
    if (HEX_ALLOWLIST.has(rel) || HEX_ALLOWLIST_PREFIXES.some((prefix) => rel.startsWith(prefix))) {
      continue;
    }

    const source = readFileSync(filePath, 'utf8');
    const match = source.match(HEX_PATTERN);
    if (match && match.length > 0) {
      offenders.push(`${rel} => ${match[0]}`);
    }
  }

  assert.deepEqual(offenders, []);
});

test('no direct numeric z-index values remain in player-facing source', () => {
  const files = [
    ...PLAYER_STYLE_ROOTS.flatMap((rootDir) => walk(rootDir, (filePath) => filePath.endsWith('.css'))),
    ...PLAYER_UI_ROOTS.flatMap((rootDir) => walk(rootDir, (filePath) => filePath.endsWith('.ts') || filePath.endsWith('.tsx'))),
  ];

  const offenders: string[] = [];

  for (const filePath of files) {
    const rel = relative(filePath);
    if (Z_INDEX_ALLOWLIST.has(rel)) {
      continue;
    }

    const source = readFileSync(filePath, 'utf8');
    const match = source.match(Z_INDEX_LITERAL_PATTERN);
    if (match && match.length > 0) {
      offenders.push(`${rel} => ${match[0]}`);
    }
  }

  assert.deepEqual(offenders, []);
});

test('player-facing UI rendering has no emoji literals', () => {
  const tsxFiles = PLAYER_UI_ROOTS.flatMap((rootDir) => walk(rootDir, (filePath) => filePath.endsWith('.tsx')));
  const localeFiles = [
    path.join(ROOT, 'i18n', 'en.json'),
    path.join(ROOT, 'i18n', 'fr.json'),
    path.join(ROOT, 'i18n', 'ar.json'),
    path.join(ROOT, 'i18n', 'ar-EG.json'),
  ];

  const offenders: string[] = [];

  for (const filePath of [...tsxFiles, ...localeFiles]) {
    const rel = relative(filePath);
    const source = readFileSync(filePath, 'utf8');
    const match = source.match(EMOJI_PATTERN);
    if (match && match.length > 0) {
      offenders.push(`${rel} => ${match[0]}`);
    }
  }

  assert.deepEqual(offenders, []);
});

test('inline styles only exist in layout-critical allowlisted files', () => {
  const files = PLAYER_UI_ROOTS.flatMap((rootDir) => walk(rootDir, (filePath) => filePath.endsWith('.tsx')));
  const offenders: string[] = [];

  for (const filePath of files) {
    const rel = relative(filePath);
    const source = readFileSync(filePath, 'utf8');
    const hasInlineStyle = INLINE_STYLE_PATTERN.test(source);
    INLINE_STYLE_PATTERN.lastIndex = 0;

    if (!hasInlineStyle) {
      continue;
    }

    if (!INLINE_STYLE_ALLOWLIST.has(rel)) {
      offenders.push(rel);
    }
  }

  assert.deepEqual(offenders, []);
});

test('home-only css variables stay scoped to home.css', () => {
  const styleFiles = PLAYER_STYLE_ROOTS.flatMap((rootDir) => walk(rootDir, (filePath) => filePath.endsWith('.css')));
  const offenders: string[] = [];

  for (const filePath of styleFiles) {
    const rel = relative(filePath);
    if (rel === 'src/styles/shell/home.css') {
      continue;
    }

    const source = readFileSync(filePath, 'utf8');
    const match = source.match(HOME_VARIABLE_DECLARATION_PATTERN);
    if (match && match.length > 0) {
      offenders.push(`${rel} => ${match[0]}`);
    }
  }

  assert.deepEqual(offenders, []);
});

test('shared shell primitive section avoids legacy color variables', () => {
  const tabletopPath = path.join(ROOT, 'styles', 'tabletop', 'tabletop.css');
  const source = readFileSync(tabletopPath, 'utf8');
  const startMarker = '/* Shared shell primitives start */';
  const endMarker = '/* Shared shell primitives end */';
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker);

  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  assert.equal(end > start, true);

  const sharedShellSection = source.slice(start, end);
  assert.equal(sharedShellSection.includes('var(--legacy-color-'), false);
});
