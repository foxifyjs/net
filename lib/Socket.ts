import { EventEmitter } from "events";

namespace Socket {
  export interface Options {
    fd?: number;
    allowHalfOpen?: boolean;
    readable?: boolean;
    writable?: boolean;
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
  emit(
    event:
      | "connect"
      | "drain"
      | "end"
      | "ready"
      | "timeout",
  ): boolean;

  eventNames(): Array<Socket.Event>;

  listenerCount(type: Socket.Event): number;
}

class Socket extends EventEmitter {
  public allowHalfOpen: boolean;
  public readable: boolean;
  public writable: boolean;

  constructor(options: Socket.Options | number = {}) {
    super();

    if (typeof options === "number") options = { fd: options };

    const {
      fd,
      allowHalfOpen = false,
      readable = false,
      writable = false,
    } = options;

    this.allowHalfOpen = allowHalfOpen;
    this.readable = readable;
    this.writable = writable;
  }
}

export default Socket;
