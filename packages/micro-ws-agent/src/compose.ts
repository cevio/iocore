export type Next = () => Promise<void>;
export type IMiddleware = (next: Next) => Promise<unknown>;

export function compose(args: IMiddleware[]) {
  return (next?: Next) => {
    const dispatch = (i: number) => async () => {
      const fn = i === args.length ? next : args[i];
      if (!fn) return;
      return await fn(dispatch(i + 1))
    }
    return dispatch(0)();
  }
}