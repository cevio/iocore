import { CacheDispenser } from "@iocore/cache";
import { Application } from "@iocore/component";
import { existsSync, unlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ensureDir } from 'fs-extra';
import { glob } from 'glob';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
export type IOCORE_FILE_CACHE_DISPENSER_CONFIGS = string;

@Application.Server
export class FileCacheDispenser<R = any> extends CacheDispenser {
  private readonly directory: string;
  private readonly stacks = new Map<string, { data: any, expire?: number, path: string }>();

  private timer: NodeJS.Timeout;
  private checking = false;

  constructor() {
    super();
    if (!process.env.IOCORE_FILE_CACHE_DISPENSER_CONFIGS) {
      throw new Error('`@iocore/cache-dispenser-file` miss configs: IOCORE_FILE_CACHE_DISPENSER_CONFIGS');
    }
    this.directory = resolve(process.cwd(), process.env.IOCORE_HTTP_CONFIGS);
  }

  protected async initialize() {
    if (!existsSync(this.directory)) {
      await ensureDir(this.directory);
    }
    const files = await glob(`*.json`, { cwd: this.directory });
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const path = resolve(this.directory, file);
      const key = file.substring(0, file.length - '.json'.length);
      const { data, expire } = require(path);
      this.stacks.set(key, { data, expire, path });
    }

    this.timer = setInterval(() => {
      if (this.checking) return;
      this.checking = true;

      try {
        const now = Date.now();
        for (const [key, { expire, path }] of this.stacks.entries()) {
          if (!expire) continue;
          if (now >= expire) {
            unlinkSync(path);
            this.stacks.delete(key);
            if (!!require.cache[path]) {
              delete require.cache[path];
            }
          }
        }
      } catch (e) {
        this.checking = false;
      }
    }, 1000);
  }
  protected terminate() {
    clearInterval(this.timer);
  }

  public async set(key: string, value: R, time: number = 0) {
    if (this.stacks.has(key)) {
      const cache = this.stacks.get(key);
      cache.data = value;
      if (time) {
        cache.expire = Date.now() + time * 1000;
      }
      writeFileSync(cache.path, JSON.stringify(cache, null, 2), 'utf8');
    } else {
      const path = resolve(this.directory, key + '.json');
      const state = {
        data: value,
        expire: time ? Date.now() + time * 1000 : 0,
        path,
      }
      writeFileSync(state.path, JSON.stringify(state, null, 2), 'utf8');
      this.stacks.set(key, state);
    }
    return value;
  }

  public async has(key: string) {
    return this.stacks.has(key);
  }

  public async get(key: string) {
    return this.stacks.get(key).data;
  }

  public async ttl(key: string) {
    if (this.stacks.has(key)) {
      const { expire } = this.stacks.get(key);
      if (!expire) return 0;
      return Math.floor((expire - Date.now()) / 1000);
    }
  }

  public async delete(key: string) {
    if (this.stacks.has(key)) {
      const { path } = this.stacks.get(key);
      unlinkSync(path);
      this.stacks.delete(key);
    }
  }
}