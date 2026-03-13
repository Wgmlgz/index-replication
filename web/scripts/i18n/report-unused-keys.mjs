#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const localePath = path.resolve('src/locales/en/common.json');
const ciMode = process.argv.includes('--ci');

const flattenLeafKeys = (value, prefix = '', output = new Set()) => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [key, nested] of Object.entries(value)) {
      const nextPrefix = prefix ? `${prefix}.${key}` : key;
      flattenLeafKeys(nested, nextPrefix, output);
    }
    return output;
  }

  if (prefix) {
    output.add(prefix);
  }
  return output;
};

const formatList = (title, keys) => {
  if (keys.length === 0) return;
  console.log(title);
  for (const key of keys) {
    console.log(`- ${key}`);
  }
  console.log('');
};

const run = async () => {
  let originalRaw = '';
  let extractedRaw = '';

  try {
    originalRaw = await readFile(localePath, 'utf8');
  } catch (error) {
    console.error(`Failed to read ${localePath}:`, error);
    process.exit(1);
  }

  try {
    const result = spawnSync(
      process.platform === 'win32' ? 'npx.cmd' : 'npx',
      ['i18next-cli', 'extract', '--quiet'],
      { encoding: 'utf8' }
    );

    if (result.status !== 0) {
      if (result.stdout) process.stdout.write(result.stdout);
      if (result.stderr) process.stderr.write(result.stderr);
      process.exit(result.status ?? 1);
    }

    extractedRaw = await readFile(localePath, 'utf8');
  } finally {
    if (originalRaw) {
      await writeFile(localePath, originalRaw, 'utf8');
    }
  }

  const before = flattenLeafKeys(JSON.parse(originalRaw));
  const after = flattenLeafKeys(JSON.parse(extractedRaw));

  const unused = Array.from(before).filter(key => !after.has(key)).sort();
  const missing = Array.from(after).filter(key => !before.has(key)).sort();

  if (unused.length === 0 && missing.length === 0) {
    console.log('No i18n key-set changes detected.');
    process.exit(0);
  }

  formatList('Unused keys (present now, removed by extract):', unused);
  formatList('Missing keys (added by extract):', missing);

  console.log(
    `Summary: ${unused.length} unused, ${missing.length} missing key(s).`
  );

  if (ciMode) {
    process.exit(1);
  }
};

void run();
