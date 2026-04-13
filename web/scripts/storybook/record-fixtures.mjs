import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const BASE_URL = (process.env.STORYBOOK_CAPTURE_BASE_URL || 'http://localhost:18080').replace(/\/+$/, '');
const COOKIE = process.env.STORYBOOK_CAPTURE_COOKIE || '';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, '..', '..');
const fixturesDir = path.join(rootDir, 'src', 'mocks', 'storybook', 'fixtures');

const endpoints = [
  { name: 'me.json', path: '/api/me' },
  { name: 'telegram-status.json', path: '/api/me/channels/telegram' },
  { name: 'tbank-status.json', path: '/api/me/tbank' },
  { name: 'users-page-1.json', path: '/api/users?page=1&pageSize=20&search=' },
];

const sortKeys = value => {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }

  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = sortKeys(value[key]);
        return acc;
      }, {});
  }

  return value;
};

const fetchJson = async endpoint => {
  const url = `${BASE_URL}${endpoint.path}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      ...(COOKIE ? { Cookie: COOKIE } : {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GET ${url} failed (${response.status}): ${body}`);
  }

  return response.json();
};

const main = async () => {
  await fs.mkdir(fixturesDir, { recursive: true });

  for (const endpoint of endpoints) {
    const data = await fetchJson(endpoint);
    const normalized = sortKeys(data);
    const targetPath = path.join(fixturesDir, endpoint.name);
    await fs.writeFile(targetPath, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
    process.stdout.write(`Recorded ${endpoint.path} -> ${path.relative(rootDir, targetPath)}\n`);
  }
};

main().catch(error => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
