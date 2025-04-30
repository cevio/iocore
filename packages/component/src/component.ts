import { Context } from "./context";
import { Meta } from "./meta";
import { INewAble } from "./types";
import { Wrap } from "./wrap";

export const NativeComponents = new Map<INewAble, Wrap>();
export type IInjectableCallback<T extends Component = Component> = (ctx: Context<T>) => unknown;

export class Component {
  static readonly InjectNameSpace = Symbol('#Component:Inject');
  static readonly SingletonNameSpace = Symbol('#Component:Singleton');
  static readonly InjectableNameSpace = Symbol('#Component:Injectable');
  static readonly StateNameSpace = Symbol('#Component:State');
  static readonly WatchNameSpace = Symbol('#Component:Watch');
  static readonly Singleton = Meta.createClassDecorator(Component.SingletonNameSpace, () => true);

  static Inject<T extends Component>(clazz: INewAble<T>) {
    return Meta.createPropertyDecorator(Component.InjectNameSpace, () => clazz);
  }

  static Injectable<T extends Component = Component>(callback?: IInjectableCallback<T>) {
    return Meta.createClassDecorator<IInjectableCallback<T>[]>(Component.InjectableNameSpace, ({ value }) => {
      const current = value ?? [];
      if (!callback) return current;
      if (!current.includes(callback)) {
        current.push(callback);
      }
      return current;
    })
  }

  static async create<T extends Component>(clazz: INewAble<T>): Promise<T> {
    const wrap = await Component.preload(clazz);
    if (wrap.isSingleton) return wrap.context.value;
    const ctx = await wrap.create();
    return ctx.value;
  }

  static async preload<T extends Component>(clazz: INewAble<T>): Promise<Wrap<T>> {
    let wrap: Wrap<T>;

    if (NativeComponents.has(clazz)) {
      wrap = NativeComponents.get(clazz) as Wrap<T>;
    } else {
      wrap = new Wrap(clazz);
      NativeComponents.set(clazz, wrap);
    }

    await wrap.start();

    return wrap;
  }

  static readonly State = Meta.createPropertyDecorator(Component.StateNameSpace, () => true);
  static Watch(key: string | symbol) {
    if (!key) throw new Error('watching `key` is required');
    return Meta.createMethodDecorator(Component.WatchNameSpace, () => key);
  }
}