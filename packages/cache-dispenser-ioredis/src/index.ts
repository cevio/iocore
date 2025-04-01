import { CacheDispenser } from '@iocore/cache';
import { Application } from '@iocore/component';
import { IORedis } from '@iocore/ioredis';

@Application.Server
export class IoRedisCacheDispenser<R = any> extends CacheDispenser<R> {
  @Application.Inject(IORedis)
  private readonly redis: IORedis;

  protected initialize() { }
  protected terminate() { }

  public async set(key: string, value: R, time: number = 0) {
    const data = JSON.stringify(value);
    if (time) {
      await this.redis.conn.setex(key, time, data);
    } else {
      await this.redis.conn.set(key, data);
    }
    return value;
  }

  public async has(key: string) {
    return !!(await this.redis.conn.exists(key));
  }

  public async get(key: string) {
    const text = await this.redis.conn.get(key);
    return JSON.parse(text) as R;
  }

  public async ttl(key: string) {
    const expire = await this.redis.conn.ttl(key);
    return expire === -1 ? 0 : expire;
  }

  public delete(key: string) {
    return this.redis.conn.del(key);
  }
}

export default IoRedisCacheDispenser;