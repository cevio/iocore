import { Application } from "@iocore/component";

export abstract class CacheDispenser<R = any> extends Application {
  public abstract set(key: string, value: R, time?: number/*秒*/): Promise<R>;
  public abstract has(key: string): Promise<boolean>;
  public abstract get(key: string): Promise<R>;
  public abstract ttl(key: string): Promise<number>; // 秒
  public abstract delete(key: string): Promise<unknown>
}