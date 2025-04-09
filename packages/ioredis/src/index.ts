import { Application } from '@iocore/component';
import Redis, { RedisOptions } from 'ioredis';

export type IOCORE_IOREDIS_CONFIGS = RedisOptions;

@Application.Server
export class IORedis extends Application {
  public conn: Redis;
  public readonly props: IOCORE_IOREDIS_CONFIGS;

  constructor() {
    super();
    if (!process.env.IOCORE_IOREDIS_CONFIGS) {
      throw new Error('`@iocore/ioredis` miss configs: IOCORE_IOREDIS_CONFIGS');
    }
    this.props = JSON.parse(process.env.IOCORE_IOREDIS_CONFIGS);
  }

  public async initialize() {
    const connection = new Redis(this.props);

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