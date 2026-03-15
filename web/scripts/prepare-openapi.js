/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const source = path.resolve(root, '../api/docs/swagger.json');
const outDir = path.resolve(root, 'tmp', 'openapi');
const target = path.join(outDir, 'swagger.json');

if (!fs.existsSync(source)) {
  console.error(`OpenAPI spec not found at ${source}. Run "cd ../api && task api:gen" first.`);
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });
fs.copyFileSync(source, target);

console.log(`OpenAPI spec copied to ${target}`);
