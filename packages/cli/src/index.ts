#!/usr/bin/env node
import pkg from '../package.json' with { type: 'json' };
import Boot from '@iocore/boot';
import MicroWsRegistry from '@iocore/micro-ws-registry';
import { program } from 'commander';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { createProject } from './create';

program.version(pkg.version, '-v, --version', '当前版本号');

program
  .command('start [yaml]')
  .option('-e, --entry <file>', '入口文件')
  .option('-m, --module <module>', '启动模块')
  .option('-d, --dev', '开发模式', false)
  .description('启动服务')
  .action(async (yaml: string = 'iocore.configs.yaml', options: {
    entry?: string,
    dev?: boolean,
    module?: string
  }) => {
    if (options.dev) {
      // @ts-ignore
      await import('tsx/esm');
    }
    const yamlPath = resolve(process.cwd(), yaml);

    let file: string;
    if (options.entry) {
      file = resolve(process.cwd(), options.entry);
      if (!existsSync(file)) throw new Error('找不到入口文件');
    } else if (options.module) {
      file = options.module;
    } else {
      throw new Error('未知的入口');
    }

    const entry = await import(file);
    if (!entry.default) throw new Error('入口文件缺少default');

    Boot.Strap(existsSync(yamlPath) ? yamlPath : {}, entry.default);
  })

program
  .command('create')
  .description('创建新项目')
  .action(createProject)

program
  .command('registry <protocol>')
  .description('启动微服务的注册中心')
  .requiredOption('-p, --port <port>', '启动端口')
  .action(async (protocol: 'ws', options: { port: string }) => {
    switch (protocol) {
      case 'ws':
        Boot.Strap({
          IOCORE_MICRO_WEBSOCKET_REGISTRY_PORT: options.port
        }, MicroWsRegistry);
        break;
      default: throw new Error('非法协议');
    }
  })

program.parseAsync();