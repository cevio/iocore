import { Application } from '@iocore/component';
import { DataSource, DataSourceOptions, QueryRunner } from 'typeorm';

export type IOCORE_TYPEORM_CONFIGS = DataSourceOptions;

@Application.Server
export class TypeORM extends Application {
  private conn: DataSource;
  public readonly props: IOCORE_TYPEORM_CONFIGS;
  constructor() {
    super();
    if (!process.env.IOCORE_TYPEORM_CONFIGS) {
      throw new Error('`@iocore/typeorm` miss configs: IOCORE_TYPEORM_CONFIGS');
    }
    this.props = JSON.parse(process.env.IOCORE_TYPEORM_CONFIGS);
  }
  protected async initialize() {
    const connection = new DataSource({
      ...this.props,
      synchronize: true,
      logging: process.env.NODE_ENV === 'development',
    });
    await connection.initialize();
    this.conn = connection;
  }

  protected async terminate() {
    if (this.conn) {
      await this.conn.destroy();
      this.conn = undefined;
    }
  }

  static async transaction<T>(datasource: DataSource, callback: (
    runner: QueryRunner,
    rollback: (roll: () => unknown | Promise<unknown>) => number
  ) => Promise<T>) {
    const rollbacks: (() => unknown | Promise<unknown>)[] = [];
    const runner = datasource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    const push = (roll: () => unknown | Promise<unknown>) => rollbacks.push(roll);
    try {
      const res = await callback(runner, push);
      await runner.commitTransaction();
      return res;
    } catch (e) {
      await runner.rollbackTransaction();
      let i = rollbacks.length;
      while (i--) await Promise.resolve(rollbacks[i]());
      throw e;
    } finally {
      await runner.release();
    }
  }

  public transaction<T>(callback: (
    runner: QueryRunner,
    rollback: (roll: () => unknown | Promise<unknown>) => number
  ) => Promise<T>) {
    return TypeORM.transaction<T>(this.conn, callback);
  }
}

export default TypeORM;