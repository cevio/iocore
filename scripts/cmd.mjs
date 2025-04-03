import { createPromptModule } from 'inquirer';
import { fileURLToPath } from 'node:url';
import { readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { logger } from './logger.mjs';

const prompt = createPromptModule();
const command = process.argv.slice(2)[0];

if (!command) throw new Error('缺少命令');

const require = createRequire(import.meta.url)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const __packages = resolve(__dirname, '../packages');
const directories = readdirSync(__packages);
const packages = [];
for (let i = 0 ; i < directories.length; i++) {
  const directory = directories[i];
  const dir = resolve(__packages, directory);
  const __file = resolve(dir, 'package.json');
  const pkg = require(__file);
  packages.push(pkg.name)
}

prompt([
  {
    type: 'list',
    name: 'target',
    message: '选择目标模块',
    choices: packages,
  }
]).then(({target}) => {
  const ls = spawn('pnpm', ['--filter', target, 'run', command], {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
  })
  ls.on('error', err => logger.error('spawn', err.message));
});