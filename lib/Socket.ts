import * as dns from "dns";
import { EventEmitter } from "events";
import { Readable } from "stream";
import { binding, Queue, Request } from "./internals";

const EMPTY = Buffer.alloc(0);

// tslint:disable-next-line:no-empty
function noop() {}

function writeDone(req: Request, err: Error | null = null) {
  if (req.buffers) {
    req.donev(err);
  } else {
    req.done(err, req.length);
  }
}

function callAll(
  list: Array<(err: Error | null) => void>,
  err: Error | null = null,
) {
  for (let i = 0; i < list.length; i++) {
    list[i](err);
  }

  return null;
}

namespace Socket {
  export interface Options {
    allowHalfOpen?: boolean;
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
  public readonly allowHalfOpen: boolean;

  public readable = false;
  public writable = false;

  public connecting = false;

  public destroyed = false;
  public ended = false;
  public finished = false;

  public localAddress?: string;
  public localPort?: number;

  protected _handle = Buffer.alloc(binding.sizeof_socket_tcp_t);

  protected _reads = new Queue(8, 0);
  protected _writes = new Queue(16, binding.sizeof_uv_write_t);

  protected _destroying = false;
  protected _ending = false;
  protected _finishing = [];
  protected _closing = [];
  protected _queue?: any[] = [];

  protected _paused = true;

  protected _timeout?: NodeJS.Timeout;

  protected _encoding?: string;

  protected _socketName?: Socket.Address;
  protected _peerName?: Socket.Address;

  public get remoteAddress() {
    return this.remote().address;
  }

  public get remoteFamily() {
    return this.remote().family;
  }

  public get remotePort() {
    return this.remote().port || 0;
  }

  constructor(options: Socket.Options = {}) {
    super();

    const { allowHalfOpen = false } = options;

    this.allowHalfOpen = allowHalfOpen;

    binding.socket_tcp_init(
      this._handle,
      this,
      null,
      this._onConnect,
      this._onWrite,
      this._onRead,
      this._onFinish,
      this._onClose,
      0,
    );
  }

  public address() {
    if (!this._socketName) {
      this._socketName = binding.socket_tcp_socketname(this._handle);
    }

    return this._socketName as Socket.Address;
  }

  public remote() {
    if (!this._peerName) {
      this._peerName = binding.socket_tcp_peername(this._handle);
    }

    return this._peerName as Partial<Socket.Address>;
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
    if (this.destroyed) return this;

    if (this._queue) {
      this._queue.push([4, null, noop]);

      return;
    }

    if (this._destroying) return this;

    this._destroying = true;

    this.readable = this.writable = false;

    binding.socket_tcp_close(this._handle);

    return this;
  }

  public end(
    data?: string | Buffer | Uint8Array,
    encoding = "utf8",
    callback = noop,
  ) {
    if (typeof data === "function") {
      callback = data;
      data = undefined;
    }

    if (!data) {
      this._end(callback);

      return this;
    }

    this.write(data, encoding, () => this._end(callback));

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
    cb: (err: Error | null, buffer: Buffer, bytesRead: number) => void = noop,
  ) {
    if (!this.readable) return this._notReadable(cb, n);

    const reading = this._reads.push();

    const data = Buffer.allocUnsafe(n);

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
      data = Buffer.from(data, encoding);
    }

    if (!this.writable) {
      this._notWritable(callback, data);

      return false;
    }

    const writing = this._writes.push();

    const length = data.length;

    writing.buffer = data as Buffer;
    writing.length = length;
    writing.callback = callback;

    binding.socket_tcp_write(
      this._handle,
      writing.handle,
      writing.buffer,
      length,
    );

    return true;
  }

  public writev(
    datas: Array<string | Buffer | Uint8Array>,
    encoding = "utf8",
    callback: (
      err: Error | null,
      buffer: Buffer,
      length: number,
    ) => void = noop,
  ) {
    datas = datas.map(data => {
      if (typeof data === "string") {
        return Buffer.from(data, encoding);
      }

      return data;
    });

    if (!this.writable) {
      this._notWritable(callback, datas);

      return false;
    }

    const writing = this._writes.push();

    const lengths = datas.map(data => data.length);

    writing.buffers = datas as Buffer[];
    writing.lengths = lengths;
    writing.callback = callback;

    if (datas.length === 2) {
      // faster c case for just two buffers which is common
      binding.socket_tcp_write_two(
        this._handle,
        writing.handle,
        datas[0],
        lengths[0],
        datas[1],
        lengths[1],
      );
    } else {
      binding.socket_tcp_writev(this._handle, writing.handle, datas, lengths);
    }

    return true;
  }

  protected _end(cb = noop) {
    if (!this.writable) return this._notWritable(cb);

    this.once("end", cb);

    if (this._ending) return;

    this._ending = true;

    this.writable = false;

    binding.socket_tcp_shutdown(this._handle);
  }

  protected _unQueue() {
    if (!this._queue) return;

    const queue = this._queue;

    this._queue = undefined;

    while (queue.length) {
      const [cmd, data, cb] = queue.shift();

      switch (cmd) {
        case 0:
          this.write(data, undefined, cb);
          break;
        case 1:
          this.writev(data, undefined, cb);
          break;
        case 2:
          this._end(cb);
          break;
        case 3:
          this.read(data, cb);
          break;
        case 4:
          this.once("close", cb).destroy();
          break;
      }
    }
  }

  private _onConnect(status: number) {
    if (status < 0) {
      this._unQueue();

      return this.emit("error", new Error("Connect failed"));
    }

    this.readable = true;
    this.writable = true;

    this._unQueue();

    this.emit("connect");
  }

  private _onWrite(status: number) {
    const writing = this._writes.shift();

    const err = status < 0 ? new Error("Write failed") : null;

    if (err) {
      this.destroy(err);

      writeDone(writing, err);

      return;
    }

    writeDone(writing);
  }

  private _onRead(read: number) {
    if (!read) {
      this.readable = false;

      this.ended = true;

      this._onEnd();

      return EMPTY;
    }

    const reading = this._reads.shift();
    const err = read < 0 ? new Error("Read failed") : null;

    if (err) {
      this.destroy(err);

      reading.done(err, 0);

      return EMPTY;
    }

    reading.done(err, read);

    if (this._reads.top === this._reads.bottom) {
      this._paused = true;

      return EMPTY;
    }

    return this._reads.peek().buffer;
  }

  private _onFinish(status: number) {
    this.finished = true;
    if (this.ended || !this.allowHalfOpen) this.destroy();
    this.emit("finish");

    const err = status < 0 ? new Error("End failed") : null;

    if (err) this.destroy(err);
  }

  private _onClose() {
    if (this._timeout) clearTimeout(this._timeout);

    this.destroyed = true;

    if (this._reads.top !== this._reads.bottom) {
      this._onEnd(new Error("Closed"));
    }

    binding.socket_tcp_destroy(this._handle);

    this._handle = null as any;

    this.emit("close");
  }

  private _onEnd(err: Error | null = null) {
    while (this._reads.top !== this._reads.bottom) {
      this._reads.shift().done(err, 0);
    }

    if (err) return;

    if (this.finished || !this.allowHalfOpen) this.destroy();

    this.emit("end");
  }

  private _notReadable(cb: Function, data: any) {
    if (this._queue) {
      this._queue.push([3, data, cb]);

      return;
    }

    process.nextTick(
      cb,
      this.ended ? null : new Error("Not readable"),
      data,
      0,
    );
  }

  private _notWritable(cb: Function, data?: any) {
    if (this._queue) {
      const type = data ? (Array.isArray(data) ? 1 : 0) : 2;

      this._queue.push([type, data, cb]);

      return;
    }

    process.nextTick(
      cb,
      this.destroyed ? null : new Error("Not writable"),
      data,
    );
  }
}

export default Socket;
