export class Context<T = any> {
  public headers: Record<string, string | string[]>;
  public query: Record<string, string | string[]>;
  public params: Record<string, string>;
  public cookie: Record<string, string>;
  public body: T;
}