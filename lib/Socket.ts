import * as dns from "dns";
import { EventEmitter } from "events";
import { Readable } from "stream";
import binding from "./binding";
import Request from "./internals/Request";

const ON_CONNECT = Symbol("on-connect");
const ON_WRITE = Symbol("on-write");
const ON_READ = Symbol("on-read");
const ON_FINISH = Symbol("on-finish");
const ON_CLOSE = Symbol("on-close");
const ON_END = Symbol("on-end");
const NOT_READABLE = Symbol("not-readable");
const NOT_WRITABLE = Symbol("not-writable");

const EMPTY = Buffer.alloc(0);

// tslint:disable-next-line:no-empty
function noop() {}

function writeDone(req: Request, err: Error | null) {
  if (req.buffers) {
    req.donev(err);
  } else {
    req.done(err, req.length);
  }
}

function callAll(list: Array<(err: Error) => void>, err: Error) {
  for (let i = 0; i < list.length; i++) {
    list[i](err);
  }

  return null;
}

namespace Socket {
  export interface Options {
    allowHalfOpen?: boolean;
    readable?: boolean;
    writable?: boolean;
  }

  export type Family = "IPv4" | "IPv6";

  export interface Address {
    port: number;
    family: Family;
    address: string;
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
    | "finish"
    | "pipe"
    | "unpipe"
    | "readable"
    | "close"
    | "connect"
    | "data"
    | "drain"
    | "end"
    | "error"
    | "lookup"
    | "ready"
    | "timeout";

  export type EventListener<E extends Event> = E extends "pipe" | "unpipe"
    ? (stream: Readable) => void
    : E extends "close"
    ? (hadError?: boolean) => void
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

  emit(event: "pipe" | "unpipe", stream: Readable): boolean;
  emit(event: "close", hadError?: boolean): boolean;
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
      | "finish"
      | "readable"
      | "connect"
      | "drain"
      | "end"
      | "ready"
      | "timeout",
  ): boolean;

  eventNames(): Socket.Event[];

  listenerCount(type: Socket.Event): number;
}

class Socket extends EventEmitter {
  public connecting = false;

  public destroyed = false;

  public readonly allowHalfOpen: boolean;

  public readonly readable: boolean;

  public readonly writable: boolean;

  public localAddress?: string;

  public localPort?: number;

  public remoteAddress?: string;

  public remoteFamily?: Socket.Family;

  public remotePort?: number;

  private _handle = Buffer.alloc(binding.sizeof_socket_tcp_t);

  private _timeout?: NodeJS.Timeout;

  private _encoding?: string;

  private _socketName?: Socket.Address;

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

    binding.socket_tcp_init(
      this._handle,
      this,
      null,
      this[ON_CONNECT],
      this[ON_WRITE],
      this[ON_READ],
      this[ON_FINISH],
      this[ON_CLOSE],
      0,
    );
  }

  public address() {
    if (!this._socketName) {
      // const out = {} as any;

      this._socketName = binding.socket_tcp_socketname(this._handle);

      // this._socketName = out;
    }

    return this._socketName as Socket.Address;
  }

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
    const options: dns.LookupOptions = {};
    let lookup = dns.lookup;

    if (typeof port === "object") {
      host = port.host || "0.0.0.0";

      const {
        localAddress,
        localPort,
        lookup: lookupParam,
        family,
        hints,
      } = port;

      options.family = family;
      options.hints = hints;

      if (localAddress) this.localAddress = localAddress;
      if (localPort) this.localPort = localPort;
      if (lookupParam) lookup = lookupParam as any;

      port = port.port || 0;
    } else if (typeof host === "function") {
      connectListener = host;
      host = "0.0.0.0";
    }

    lookup(host as string, options, (err, ip) => {
      if (err) return this.emit("error", err);

      if (connectListener) this.prependOnceListener("connect", connectListener);

      binding.socket_tcp_connect(this._handle, port, ip);
    });

    return this;
  }

  public destroy(exception?: Error) {
    return this;
  }

  public end(
    data?: string | Buffer | Uint8Array,
    encoding = "utf8",
    callback = noop,
  ) {
    return this;
  }

  // TODO: implement
  // public pause() {
  //   return this;
  // }

  // TODO: implement
  // public resume() {
  //   return this;
  // }

  public ref() {
    binding.socket_tcp_ref(this._handle);

    return this;
  }

  public unref() {
    binding.socket_tcp_unref(this._handle);

    return this;
  }

  public setEncoding(encoding?: string) {
    this._encoding = encoding;

    return this;
  }

  public setKeepAlive(enable = false, initialDelay = 0) {
    binding.socket_tcp_keep_alive(this._handle, Number(enable), initialDelay);

    return this;
  }

  public setNoDelay(noDelay = true) {
    binding.socket_tcp_keep_alive(this._handle, Number(noDelay));

    return this;
  }

  public setTimeout(timeout: number, callback?: () => void) {
    if (this._timeout) clearTimeout(this._timeout);

    if (timeout > 0) {
      this._timeout = setTimeout(
        this.emit.bind(this),
        timeout,
        "timeout",
      ) as any;

      if (callback) {
        this.once("timeout", callback);
      }
    } else if (callback) {
      this.removeListener("timeout", callback);
    }

    return this;
  }

  public read(
    n: number,
    cb: (err: Error | null, buffer: Buffer, bytesRead: number) => void,
  ) {
    const data = Buffer.allocUnsafe(n);

    if (!this.readable) return this[NOT_READABLE](cb, data);

    const reading = this._reads.push();

    reading.buffer = data;
    reading.callback = cb;

    if (this._paused) {
      this._paused = false;

      binding.socket_tcp_read(this._handle, data);
    }
  }

  public write(
    data: string | Buffer | Uint8Array,
    encoding = "utf8",
    callback: (
      err: Error | null,
      buffer: Buffer,
      length: number,
    ) => void = noop,
  ) {
    if (typeof data === "string") {
      data = new Buffer(data, encoding);
    } else if (data instanceof Uint8Array) {
      data = new Buffer(data);
    }

    const length = data.length;

    if (!this.writable) return this[NOT_WRITABLE](callback, data, length);

    const writing = this._writes.push();

    writing.buffer = data;
    writing.length = length;
    writing.callback = callback;

    binding.socket_tcp_write(
      this._handle,
      writing.handle,
      writing.buffer,
      length,
    );
  }

  private [ON_CONNECT](status: number) {
    if (status < 0) {
      if (this._queued) this._unqueue();
      this.emit("error", new Error("Connect failed"));
      return;
    }

    this.remoteFamily = "IPv4";
    this.remoteAddress = binding.socket_tcp_remote_address(this._handle);
    this.remotePort = binding.socket_tcp_remote_port(this._handle);

    this.readable = true;
    this.writable = true;
    if (this._queued) this._unqueue();

    if (this._server) this._server.emit("connection", this);
    else this.emit("connect");
  }

  private [ON_WRITE](status: number) {
    const writing = this._writes.shift();

    const err = status < 0 ? new Error("Write failed") : null;

    if (err) {
      this.close();

      writeDone(writing, err);

      return;
    }

    writeDone(writing, null);
  }

  private [ON_READ](read: number) {
    if (!read) {
      this.readable = false;
      this.ended = true;
      this[ON_END](null);
      return EMPTY;
    }

    const reading = this._reads.shift();
    const err = read < 0 ? new Error("Read failed") : null;

    if (err) {
      this.close();
      reading.done(err, 0);
      return EMPTY;
    }

    reading.done(err, read);

    if (this._reads.top === this._reads.btm) {
      this._paused = true;
      return EMPTY;
    }

    return this._reads.peek().buffer;
  }

  private [ON_FINISH](status: number) {
    this.finished = true;
    if (this.ended || !this.allowHalfOpen) this.close();
    this.emit("finish");

    const err = status < 0 ? new Error("End failed") : null;

    if (err) this.close();

    this._finishing = callAll(this._finishing, err);
  }

  private [ON_CLOSE]() {
    if (this._timeout) clearTimeout(this._timeout);

    if (this._server) unordered.remove(this._server.connections, this);

    this.closed = true;
    this._closing = callAll(this._closing, null);

    if (this._reads.top !== this._reads.btm) this[ON_END](new Error("Closed"));

    binding.socket_tcp_destroy(this._handle);
    this._handle = this._server = null;

    this.emit("close");
  }

  private [ON_END](err: Error | null) {
    while (this._reads.top !== this._reads.btm) {
      this._reads.shift().done(err, 0);
    }

    if (err) return;

    if (this.finished || !this.allowHalfOpen) this.close();

    this.emit("end");
  }

  private [NOT_READABLE](cb, data) {
    if (this._queued) {
      this._queued.push([3, data, 0, cb]);

      return;
    }

    process.nextTick(
      cb,
      this.ended ? null : new Error("Not readable"),
      data,
      0,
    );
  }

  private [NOT_WRITABLE](cb, data, len) {
    if (this._queued) {
      const type = data ? (Array.isArray(data) ? 1 : 0) : 2;

      this._queued.push([type, data, len || 0, cb]);

      return;
    }

    process.nextTick(
      cb,
      this.finished ? null : new Error("Not writable"),
      data,
    );
  }
}

export default Socket;
