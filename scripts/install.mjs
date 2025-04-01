import { createPromptModule } from 'inquirer';
import { fileURLToPath } from 'node:url';
import { readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { registry } from './configs.mjs';
import { logger } from './logger.mjs';

const prompt = createPromptModule();
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

(async () => {
  const { target } = await prompt([
    {
      type: 'list',
      name: 'target',
      message: '选择目标模块',
      choices: packages,
    }
  ])
  const { type } = await prompt([
    {
      type: 'list',
      name: 'type',
      message: '选择依赖源',
      choices: [
        { name: 'WorkSpace(本地)', value: 'workspace' },
        { name: 'NPM(外部)', value: 'npm' }
      ],
    }
  ])

  const isnpm = type === 'npm';
  let answers = [];

  if (isnpm) {
    const npm = await prompt([
      {
        type: 'input',
        name: 'value',
        message: '请输入模块名称'
      }
    ])
    answers = npm.value.split(/\s+/g);
  } else {
    const workspace = await prompt([
      {
        type: 'checkbox',
        name: 'value',
        message: '请选择模块',
        choices: packages.filter(s => s !== target),
      }
    ])
    answers = workspace.value;
  }

  const { isprod } = await prompt([{
    type: 'confirm',
    name: 'isprod',
    message: '是否生产环境？'
  }])

  const cmd = ['add', ...answers, '--filter', target];
    
  if (isprod) {
    cmd.push('--save-prod');
  } else {
    cmd.push('--save-dev');
  }

  if (!isnpm) {
    cmd.push('--workspace');
  }

  cmd.push('--registry=' + registry);

  const error = await new Promise((resolve) => {
    const ls = spawn('pnpm', cmd, {
      cwd: process.cwd(),
      env: process.env,
    })
    ls.on('exit', code => {
      if (code === 0) return resolve(undefined);
      return resolve(new Error(`exit with code ${code}`));
    })
    ls.on('error', err => logger.error('', err.message))
  })

  if (error) return logger.error('-', error.message);
  logger.info('+', target + ':', ...answers);
})();

