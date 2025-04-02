import { Middleware, Next } from "@iocore/http";
import { Logger } from '@iocore/logger';

@Middleware.Injectable()
export default class extends Middleware {
  @Middleware.Inject(Logger)
  private readonly logger: Logger;

  public async use(next: Next) {
    this.logger.debug('access on Middleware.');
    await next();
  }
}