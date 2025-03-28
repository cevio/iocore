import { Meta } from "./meta";
import { INewAble } from "./types";
import { Wrap } from "./wrap";

export const NativeComponents = new Map<INewAble, Wrap>();

export class Component {
  static readonly InjectNameSpace = Symbol('#Component:Inject');
  static readonly SingletonNameSpace = Symbol('#Component:Singleton');
  static readonly InjectableNameSpace = Symbol('#Component:Injectable');

  static Injectable<T extends Component = Component>(callback?: (t: T, w: Wrap<T>) => unknown) {
    return Meta.createClassDecorator<((t: T, w: Wrap<T>) => unknown)[]>(Component.InjectableNameSpace, ({ value }) => {
      const current = value ?? [];
      if (!callback) return current;
      const index = current.indexOf(callback);
      if (index === -1) current.push(callback);
      return current;
    })
  }

  static Inject<T extends Component>(clazz: INewAble<T>) {
    return Meta.createPropertyDecorator(Component.InjectNameSpace, () => clazz);
  }

  static readonly Singleton = Meta.createClassDecorator(Component.SingletonNameSpace, () => true);

  static async create<T extends Component>(clazz: INewAble<T>) {
    let wrap: Wrap;

    if (NativeComponents.has(clazz)) {
      wrap = NativeComponents.get(clazz);
    } else {
      wrap = new Wrap(clazz);
      NativeComponents.set(clazz, wrap);
    }

    await wrap.start();

    return wrap.isSingleton
      ? wrap.context.value
      : await wrap.create();
  }
}