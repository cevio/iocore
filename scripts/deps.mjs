import { createPromptModule } from 'inquirer';
import { fileURLToPath } from 'node:url';
import { readdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { logger } from './logger.mjs';

const prompt = createPromptModule();

const require = createRequire(import.meta.url)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const __packages = resolve(__dirname, '../packages');
const directories = readdirSync(__packages);
const packages = new Map();
for (let i = 0 ; i < directories.length; i++) {
  const directory = directories[i];
  const dir = resolve(__packages, directory);
  const __file = resolve(dir, 'package.json');
  const pkg = require(__file);
  if (!packages.has(pkg.name)) {
    packages.set(pkg.name, {
      file: __file,
      pkg,
      pool: new Set()
    })
  }
  const _deps = packages.get(pkg.name).pool;
  if (pkg.dependencies) {
    for (const key in pkg.dependencies) {
      const value = pkg.dependencies[key];
      if (value === 'workspace:^') {
        _deps.add(key);
      }
    }
  }
}

prompt([
  {
    type: 'checkbox',
    name: 'target',
    message: '选择目标模块',
    choices: Array.from(packages.keys()),
  }
]).then(({target}) => {
  if (!Array.isArray(target)) return;
  const relatives = new Set(target);
  
  const doit = () => {
    let next = false;
    for (const name of relatives.values()) {
      for (const [key, { pool }] of packages.entries()) {
        if (key !== name && pool.has(name) && !relatives.has(key)) {
          relatives.add(key);
          next = true;
        }
      }
    }
    return next;
  }

  let next = true
  while(next) {
    next = doit();
  }

  return prompt([
    {
      type: 'confirm',
      name: 'ok',
      message: '是否修改版本号'
    }
  ]).then(({ok}) => {
    if (ok){
      for (const [key,{pkg, file}] of packages.entries()) {
        if (relatives.has(key)) {
          const version = pkg.version;
          const sp = version.split('.');
          pkg.version = `${sp[0]}.${sp[1]}.${Number(sp[2]) + 1}`;
          writeFileSync(file, JSON.stringify(pkg, null, 2), 'utf8');
          logger.info('-', key + '@' + pkg.version);
        }
      }
    }
  })
})