import { createPromptModule } from 'inquirer';
import { resolve, dirname } from 'node:path';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { copy } from 'fs-extra';
import { HttpResolve } from './http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const __template = resolve(__dirname, '../../template/project');
const __controller = resolve(__dirname, '../../template/controllers');
const __middleware = resolve(__dirname, '../../template/middlewares');

const http_yaml = `\n\nIOCORE_HTTP_CONFIGS:
  port: 3000
  keys:
    - iocore
    - http`
const ioredis_yaml = `\n\nIOCORE_IOREDIS_CONFIGS:
  host: 127.0.0.1
  port: 6379
  db: 1
  username: xxxxxx
  password: xxxxxx`
const typeorm_yaml = `\n\nIOCORE_TYPEORM_CONFIGS:
  type: mysql
  host: 127.0.0.1
  port: 3306
  username: root
  password: xxxxxx
  database: xxxxxx
  charset: utf8mb4
  entityPrefix: iocore_orm_
  entities: src/entities/*.dto.{js,ts}`

export async function createProject() {
  const prompt = createPromptModule();
  const { project } = await prompt([{
    type: 'input',
    name: 'project',
    message: '请输入项目名称'
  }]);

  // 创建文件夹
  const directory = resolve(process.cwd(), project);
  if (!existsSync(directory)) {
    mkdirSync(directory);
  }

  await copy(__template, directory);

  const pkgFile = resolve(directory, 'package.json');
  const pkg = await import(pkgFile, { with: { type: 'json' } });
  const yamlFile = resolve(directory, 'iocore.configs.yaml');
  let yaml = readFileSync(yamlFile, 'utf8');

  const { funcs } = await prompt([{
    type: 'checkbox',
    name: 'funcs',
    message: '请选择需要的服务',
    choices: [
      { name: 'Http服务', value: 'http' },
      { name: 'IORedis服务', value: 'ioredis' },
      { name: 'TypeORM服务', value: 'typeorm' },
    ]
  }]);

  for (let i = 0; i < funcs.length; i++) {
    const func: string = funcs[i];
    switch (func) {
      case 'http':
        const controllers = resolve(directory, 'src', 'controllers');
        const middlewares = resolve(directory, 'src', 'middlewares');
        pkg.default.dependencies['@iocore/http'] = '^1.0.2';
        pkg.default.dependencies['@iocore/logger'] = '^1.0.4';
        writeFileSync(pkgFile, JSON.stringify(pkg.default, null, 2), 'utf8');
        if (!yaml.includes('IOCORE_HTTP_CONFIGS:')) {
          writeFileSync(yamlFile, yaml += http_yaml, 'utf8');
        }
        await copy(__controller, controllers);
        await copy(__middleware, middlewares);
        HttpResolve(directory);
        break;
      case 'ioredis':
        pkg.default.dependencies['@iocore/ioredis'] = '^1.0.10';
        writeFileSync(pkgFile, JSON.stringify(pkg.default, null, 2), 'utf8');
        if (!yaml.includes('IOCORE_IOREDIS_CONFIGS:')) {
          writeFileSync(yamlFile, yaml += ioredis_yaml, 'utf8');
        }
        break;
      case 'typeorm':
        mkdirSync(resolve(directory, 'src', 'entities'));
        pkg.default.dependencies['@iocore/typeorm'] = '^1.0.0';
        writeFileSync(pkgFile, JSON.stringify(pkg.default, null, 2), 'utf8');
        if (!yaml.includes('IOCORE_TYPEORM_CONFIGS:')) {
          writeFileSync(yamlFile, yaml += typeorm_yaml, 'utf8');
        }
        break;
    }
  }
}