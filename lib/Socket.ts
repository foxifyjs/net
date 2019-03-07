import { EventEmitter } from "events";

const HANDLE = Symbol("handle");

namespace Socket {
  export interface Options {
    allowHalfOpen?: boolean;
    readable?: boolean;
    writable?: boolean;
  }

  export interface ConnectOptions {
    port: number;
    host?: string;
    localAddress?: string;
    localPort?: number;
    family?: 4 | 6;
    hints?: number;
    lookup?: Function;
  }

  export type Event =
    | "close"
    | "connect"
    | "data"
    | "drain"
    | "end"
    | "error"
    | "lookup"
    | "ready"
    | "timeout";

  export type EventListener<E extends Event> = E extends "close"
    ? (hadError: boolean) => void
    : E extends "data"
    ? (data: Buffer | string) => void
    : E extends "error"
    ? (error: Error) => void
    : E extends "lookup"
    ? (
        err: Error | null,
        address: string,
        family: string | null,
        host: string,
      ) => void
    : () => void;
}

interface Socket extends EventEmitter {
  addListener<E extends Socket.Event>(
    event: E,
    listener: Socket.EventListener<E>,
  ): this;

  on<E extends Socket.Event>(event: E, listener: Socket.EventListener<E>): this;

  once<E extends Socket.Event>(
    event: E,
    listener: Socket.EventListener<E>,
  ): this;

  prependListener<E extends Socket.Event>(
    event: E,
    listener: Socket.EventListener<E>,
  ): this;

  prependOnceListener<E extends Socket.Event>(
    event: E,
    listener: Socket.EventListener<E>,
  ): this;

  removeListener<E extends Socket.Event>(
    event: E,
    listener: Socket.EventListener<E>,
  ): this;

  off<E extends Socket.Event>(
    event: E,
    listener: Socket.EventListener<E>,
  ): this;

  removeAllListeners(event?: Socket.Event): this;

  setMaxListeners(n: number): this;

  getMaxListeners(): number;

  listeners(event: Socket.Event): Function[];

  rawListeners(event: Socket.Event): Function[];

  emit(event: "close", hadError: boolean): boolean;
  emit(event: "data", data: Buffer | string): boolean;
  emit(event: "error", error: Error): boolean;
  emit(
    event: "lookup",
    err: Error | null,
    address: string,
    family: string | null,
    host: string,
  ): boolean;
  emit(event: "connect" | "drain" | "end" | "ready" | "timeout"): boolean;

  eventNames(): Array<Socket.Event>;

  listenerCount(type: Socket.Event): number;
}

class Socket extends EventEmitter {
  public connecting = false;

  public destroyed = false;

  public allowHalfOpen: boolean;

  public readable: boolean;

  public writable: boolean;

  public localAddress?: string;

  public localPort?: number;

  public remoteAddress?: string;

  public remoteFamily?: "IPv4" | "IPv6";

  public remotePort?: number;

  constructor(options: Socket.Options = {}) {
    super();

    const {
      allowHalfOpen = false,
      readable = false,
      writable = false,
    } = options;

    this.allowHalfOpen = allowHalfOpen;
    this.readable = readable;
    this.writable = writable;
  }

  public address() {}

  public connect(
    options: Socket.ConnectOptions,
    connectListener?: () => void,
  ): this;
  public connect(
    port: number,
    host?: string,
    connectListener?: () => void,
  ): this;
  public connect(
    port: number | Socket.ConnectOptions,
    host?: string | (() => void),
    connectListener?: () => void,
  ) {
    return this;
  }

  public destroy(exception?: Error) {
    return this;
  }

  public end(
    data?: string | Buffer | Uint8Array,
    encoding = "utf8",
    callback = () => {},
  ) {
    return this;
  }

  pause() {
    return this;
  }

  ref() {
    return this;
  }

  resume() {
    return this;
  }

  setEncoding(encoding?: string) {
    return this;
  }

  setKeepAlive(enable = false, initialDelay = 0) {
    return this;
  }

  setNoDelay(noDelay = true) {
    return this;
  }

  setTimeout(timeout: number, callback?: () => void) {
    return this;
  }

  unref() {
    return this;
  }

  write(
    data?: string | Buffer | Uint8Array,
    encoding = "utf8",
    callback = () => {},
  ) {}
}

export default Socket;
