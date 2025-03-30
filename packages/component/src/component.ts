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
  static readonly Singleton = Meta.createClassDecorator(Component.SingletonNameSpace, () => true);

  static Inject<T extends Component>(clazz: INewAble<T>) {
    return Meta.createPropertyDecorator(Component.InjectNameSpace, () => clazz);
  }

  static Injectable<T extends Component = Component>(callback?: IInjectableCallback<T>) {
    return Meta.createClassDecorator<IInjectableCallback<T>[]>(Component.InjectableNameSpace, ({ value }) => {
      const current = value ?? [];
      if (!callback) return current;
      const index = current.indexOf(callback);
      if (index === -1) current.push(callback);
      return current;
    })
  }

  static async create<T extends Component>(clazz: INewAble<T>) {
    const wrap = await Component.preload(clazz);
    if (wrap.isSingleton) return wrap.context.value;
    const ctx = await wrap.create();
    return ctx.value;
  }

  static async preload<T extends Component>(clazz: INewAble<T>) {
    let wrap: Wrap;

    if (NativeComponents.has(clazz)) {
      wrap = NativeComponents.get(clazz);
    } else {
      wrap = new Wrap(clazz);
      NativeComponents.set(clazz, wrap);
    }

    await wrap.start();

    return wrap;
  }
}