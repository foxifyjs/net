import { isIP, isIPv4, isIPv6 } from "./internals";
import Server from "./Server";
import Socket from "./Socket";

export = {
  Server,
  Socket,
  connect: () => {},
  createConnection: () => {},
  createServer: () => {},
  isIP,
  isIPv4,
  isIPv6,
};
