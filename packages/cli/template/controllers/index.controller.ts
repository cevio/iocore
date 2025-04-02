import AccessMiddleware from '../middlewares/access.middle';
import { Controller } from "@iocore/http";

@Controller.Injectable()
@Controller.Method('GET')
@Controller.Middleware(AccessMiddleware)
export default class extends Controller {
  public response() {
    return 'hello world'
  }
}