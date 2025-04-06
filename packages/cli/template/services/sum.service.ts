import { Service } from '@iocore/micro-ws-agent';

@Service.Injectable()
export default class extends Service<[number, number], number> {
  public exec(a: number, b: number) {
    return a + b;
  }
}