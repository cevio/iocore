import { Application } from '@iocore/component';
import Redis, { RedisOptions } from 'ioredis';

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      IOCORE_IOREDIS_CONFIGS: RedisOptions,
    }
  }
}

@Application.Server
export class IORedis extends Application {
  public conn: Redis;
  protected async initialize() {
    if (!process.env.IOREDIS_CONFIGS) {
      throw new Error('`@iocore/ioredis` miss configs');
    }
    const connection = new Redis(process.env.IOCORE_IOREDIS_CONFIGS);

    await new Promise<void>((resolve, reject) => {
      const onerror = (e: any) => reject(e);
      connection.on('error', onerror);
      connection.on('connect', () => {
        connection.off('error', onerror);
        resolve();
      })
    });

    this.conn = connection;
  }

  public terminate() {
    if (this.conn) {
      this.conn.disconnect();
      this.conn = undefined;
    }
  }
}

export default IORedis;