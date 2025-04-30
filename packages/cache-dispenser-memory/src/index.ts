import { CacheDispenser } from "@iocore/cache";
import { Application } from "@iocore/component";

@Application.Server
export class MemoryCacheDispenser<R = any> extends CacheDispenser {
  private readonly stacks = new Map<string, { data: any, expire: number }>();

  private timer: NodeJS.Timeout;
  private checking = false;

  public initialize() {
    this.timer = setInterval(() => {
      if (this.checking) return;
      this.checking = true;

      const now = Date.now();
      for (const [key, { expire }] of this.stacks.entries()) {
        if (!expire) continue;
        if (now >= expire) {
          this.stacks.delete(key);
        }
      }

      this.checking = false;
    }, 1000);
  }

  public terminate() {
    clearInterval(this.timer);
  }

  public async set(key: string, value: R, time: number = 0) {
    if (this.stacks.has(key)) {
      const cache = this.stacks.get(key);
      cache.data = value;
      if (time) {
        cache.expire = Date.now() + time * 1000;
      }
    } else {
      this.stacks.set(key, {
        data: value,
        expire: time ? Date.now() + time * 1000 : 0,
      })
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
      this.stacks.delete(key);
    }
  }
}

export default MemoryCacheDispenser;