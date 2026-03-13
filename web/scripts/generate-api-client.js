/* eslint-disable @typescript-eslint/no-require-imports */
const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const source = path.resolve(root, '../api/docs/swagger.json');
const tmpDir = path.resolve(root, 'tmp', 'openapi');
const localSpecPath = path.join(tmpDir, 'swagger.json');
const openApiToolsConfigPath = path.resolve(root, 'openapitools.json');

if (!fs.existsSync(source)) {
  console.error(`OpenAPI spec not found at ${source}. Run "cd ../api && task api:gen" first.`);
  process.exit(1);
}

fs.mkdirSync(tmpDir, { recursive: true });
fs.copyFileSync(source, localSpecPath);
console.log(`OpenAPI spec copied to ${localSpecPath}`);

let useDocker = false;
if (fs.existsSync(openApiToolsConfigPath)) {
  try {
    const config = JSON.parse(fs.readFileSync(openApiToolsConfigPath, 'utf8'));
    useDocker = Boolean(config?.['generator-cli']?.useDocker);
  } catch (error) {
    console.warn(
      `Failed to parse ${openApiToolsConfigPath}: ${String(error)}. Falling back to local paths.`,
    );
  }
}

const generatorInputPath = useDocker ? '/local/tmp/openapi/swagger.json' : localSpecPath;
const generatorOutputPath = useDocker
  ? '/local/src/api-client'
  : path.resolve(root, 'src', 'api-client');
const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const args = [
  '@openapitools/openapi-generator-cli',
  'generate',
  '-i',
  generatorInputPath,
  '-g',
  'typescript-axios',
  '-o',
  generatorOutputPath,
];

console.log(
  `Generating client (${useDocker ? 'docker mode' : 'local mode'}) from ${generatorInputPath} to ${generatorOutputPath}`,
);

childProcess.execFileSync(npxCommand, args, { stdio: 'inherit' });
