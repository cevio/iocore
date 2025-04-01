#!/usr/bin/env node
import pkg from '../package.json' with { type: 'json' };
import Boot from '@iocore/boot';
import { program } from 'commander';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';

program.version(pkg.name, '-v, --version', '当前版本号');

program
  .command('start [yaml]')
  .option('-e, --entry <file>', '入口文件', 'src/main.ts')
  .option('-d, --dev', '开发模式', false)
  .description('启动服务')
  .action(async (yaml: string = 'iocore.configs.yaml', options: { entry: string, dev: boolean }) => {
    if (options.dev) {
      // @ts-ignore
      await import('tsx/esm');
    }
    const yamlPath = resolve(process.cwd(), yaml);
    const file = resolve(process.cwd(), options.entry);
    if (!existsSync(file)) throw new Error('找不到入口文件');
    const entry = await import(file);
    if (!entry.default) throw new Error('入口文件缺少default');
    Boot.Strap(existsSync(yamlPath) ? yamlPath : {}, entry.default);
  })

program.parseAsync();