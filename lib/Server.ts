import { EventEmitter } from "events";
import Socket from "./Socket";

namespace Server {
  export interface Options {
    allowHalfOpen?: boolean;
    pauseOnConnect?: boolean;
  }

  export interface ListenOptions {
    port?: number;
    host?: string;
    backlog?: number;
    exclusive?: boolean;
    readableAll?: boolean;
    writableAll?: boolean;
  }

  export type Event = "close" | "connection" | "error" | "listening";

  export type EventListener<E extends Event> = E extends "connection"
    ? (socket: Socket) => void
    : E extends "error"
    ? (error: Error) => void
    : () => void;
}

interface Server extends EventEmitter {
  addListener<E extends Server.Event>(
    event: E,
    listener: Server.EventListener<E>,
  ): this;

  on<E extends Server.Event>(event: E, listener: Server.EventListener<E>): this;

  once<E extends Server.Event>(
    event: E,
    listener: Server.EventListener<E>,
  ): this;

  prependListener<E extends Server.Event>(
    event: E,
    listener: Server.EventListener<E>,
  ): this;

  prependOnceListener<E extends Server.Event>(
    event: E,
    listener: Server.EventListener<E>,
  ): this;

  removeListener<E extends Server.Event>(
    event: E,
    listener: Server.EventListener<E>,
  ): this;

  off<E extends Server.Event>(
    event: E,
    listener: Server.EventListener<E>,
  ): this;

  removeAllListeners(event?: Server.Event): this;

  setMaxListeners(n: number): this;

  getMaxListeners(): number;

  listeners(event: Server.Event): Function[];

  rawListeners(event: Server.Event): Function[];

  emit(event: "connection", socket: Socket): boolean;
  emit(event: "error", error: Error): boolean;
  emit(event: "close" | "listening"): boolean;

  eventNames(): Array<Server.Event>;

  listenerCount(type: Server.Event): number;
}

class Server extends EventEmitter {
  public listening = false;

  public maxConnections?: number;

  constructor(options: Server.Options = {}, connectionListener?: () => void) {
    super();

    const { allowHalfOpen = false, pauseOnConnect = false } = options;
  }

  public address() {}

  public close(callback?: () => void) {
    return this;
  }

  public getConnections(callback?: (err: Error | null, count: number) => void) {
    return this;
  }

  public listen(handle: object, backlog?: number, callback?: () => void): this;
  public listen(options: Server.ListenOptions, callback?: () => void): this;
  public listen(
    port?: number,
    host?: string,
    backlog?: number,
    callback?: () => void,
  ): this;
  public listen(
    port?: Server.ListenOptions | object | number,
    host?: string | number | (() => void),
    backlog?: number | (() => void),
    callback?: () => void,
  ) {
    return this;
  }

  public ref() {
    return this;
  }

  public unref() {
    return this;
  }
}

export default Server;
