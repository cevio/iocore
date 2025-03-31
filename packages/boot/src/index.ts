import exitHook from 'async-exit-hook';
import { Application, INewAble, Wrap } from '@iocore/component';
import { resolve } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { Logger } from '@iocore/logger';
import { glob } from 'glob';

const pushConfigsToProcessEnv = Symbol('#Boot.pushConfigsToProcessEnv');

@Application.Server
export abstract class Boot<T extends object = any> extends Application {
  @Application.Inject(Logger)
  protected readonly logger: Logger;

  private [pushConfigsToProcessEnv]<T extends object = any>(configs: T) {
    for (const key in configs) {
      // @ts-ignore
      process.env[key] = configs[key];
    }
  }

  constructor(yaml: string | T) {
    super();

    let configs: T = yaml as T;

    if (typeof yaml === 'string') {
      const file = resolve(process.cwd(), yaml);
      if (!existsSync(file)) {
        throw new Error('cannot find the configs file: ' + file);
      }
      configs = parse(readFileSync(file, 'utf8')) as T;
    }

    this[pushConfigsToProcessEnv](configs);

    process.on('uncaughtException', e => this.logger.error(e));
    process.on('unhandledRejection', e => this.logger.error(e));
    process.on('uncaughtExceptionMonitor', e => this.logger.error(e));
    process.on('error', e => this.logger.error(e));

    exitHook(exit => {
      Application.terminate()
        .catch(e => this.logger.error(e))
        .finally(exit);
    })
  }

  public async preloadComponents(
    directory: string, suffix: string,
    callback?: (options: {
      file: string,
      path: string,
      wrap: Wrap,
      clazz: INewAble,
    }) => unknown | Promise<unknown>,
  ) {
    const files = await glob(`**/*.${suffix}.{ts,js}`, { cwd: directory });
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const path = resolve(directory, file);
      const target: { default: INewAble } = await await import(resolve(directory, file));
      if (target.default) {
        const wrap = await Application.preload(target.default);
        if (typeof callback === 'function') {
          await Promise.resolve(callback({
            file, wrap, path,
            clazz: target.default,
          }));
        }
      }
    }
  }
}

export default Boot;