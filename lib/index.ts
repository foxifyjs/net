export { isIP, isIPv4, isIPv6 } from "./internals";
import Server from "./Server";
import Socket from "./Socket";

export { Server, Socket };

export function createConnection() {}

export function createServer(
  options: Server.Options,
  connectionListener?: Server.EventListener<"connection">,
) {
  return new Server(options, connectionListener);
}

export function connect(
  port: number | (Socket.Options & Socket.ConnectOptions),
  host?: string | (() => void),
  connectListener?: () => void,
) {
  if (typeof port === "object") {
    return new Socket(port).connect(port as any, host as (() => void));
  }

  return new Socket().connect(port, host as any, connectListener);
}
