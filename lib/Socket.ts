import * as dns from "dns";
import { EventEmitter } from "events";
import { Readable, Writable } from "stream";
import { binding, Queue, Request, state as State } from "./internals";

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

namespace Socket {
  export interface Options {
    allowHalfOpen?: boolean;
    readableHighWaterMark?: number;
    writableHighWaterMark?: number;
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
  /**
   * unordered-set property
   */
  public _index = 0;

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

  protected _readableState: State.Readable;

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

  private _hadError = false;

  public get remoteAddress() {
    return this.remote().address;
  }

  public get remoteFamily() {
    return this.remote().family;
  }

  public get remotePort() {
    return this.remote().port || 0;
  }

  public get readableHighWaterMark() {
    return this._readableState.highWaterMark;
  }

  public get readableLength() {
    return this._readableState.length;
  }

  constructor(options: Socket.Options = {}) {
    super();

    const { allowHalfOpen = false, readableHighWaterMark } = options;

    this._readableState = new State.Readable({
      highWaterMark: readableHighWaterMark,
    });

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

  public isPaused() {
    return this._readableState.flowing === false;
  }

  public pause() {
    this._readableState.flowing = false;

    return this;
  }

  public resume() {
    this._readableState.flowing = true;

    return this;
  }

  public ref() {
    binding.socket_tcp_ref(this._handle);

    return this;
  }

  public unref() {
    binding.socket_tcp_unref(this._handle);

    return this;
  }

  // TODO:
  public setEncoding(encoding?: string) {
    this._readableState.encoding = encoding;

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

  public on<E extends Socket.Event>(
    event: E,
    listener: Socket.EventListener<E>,
  ) {
    super.on(event, listener);

    const state = this._readableState;

    if (state.flowing === null) {
      if (event === "data") {
        state.flowing = true;

        this._read();
      } else if (event === "readable") {
        state.flowing = false;

        this._read();
      }
    }

    return this;
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

  public read(bytes?: number) {
    const state = this._readableState;
    let size = state.highWaterMark - state.length;

    if (state.flowing) {
      const data = state.consume(bytes);

      if (data !== null) {
        process.nextTick(state.pipe.bind(state), data);

        process.nextTick(this.emit.bind(this), "data", data);

        size = state.highWaterMark;
      }
    }

    if (size) this._read(size);

    if (bytes === 0) return null;

    return state.consume(bytes);
  }

  public pipe(destination: Writable | Socket, options: { end?: boolean } = {}) {
    const state = this._readableState.addPipe(destination, this);

    if (options.end) this.once("end", () => destination.end());

    if (state.flowing === null) {
      state.flowing = true;

      this._read();
    }

    return destination;
  }

  public unpipe(destination: Writable | Socket) {
    this.removeListener("end", () => destination.end());

    this._readableState.removePipe(destination, this);

    return this;
  }

  public push(chunk: Buffer | Uint8Array | string, encoding?: string) {
    const state = this._readableState;

    if (typeof chunk === "string") {
      chunk = Buffer.from(chunk, encoding);
    }

    process.nextTick(state.pipe.bind(state), chunk);

    process.nextTick(this.emit.bind(this), "data", chunk);

    if (state.flowing) {
      state.consumed += chunk.length;

      return true;
    }

    state.append(chunk);

    return !state.ended || state.length < state.highWaterMark;
  }

  public unshift(chunk: Buffer | Uint8Array | string) {
    const state = this._readableState;

    if (typeof chunk === "string") {
      chunk = Buffer.from(chunk, state.encoding);
    }

    state.prepend(chunk);

    return !state.ended || state.length < state.highWaterMark;
  }

  // TODO: implement
  // public wrap() {}

  // TODO: implement
  // public [Symbol.asyncIterator]() {}

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

  public destroy(exception: Error | null = null) {
    this._destroy(exception, err => err && this.emit("error", err));

    return this;
  }

  protected _read(n?: number) {
    const state = this._readableState;

    if (!state.ended) {
      if (!this.readable) {
        this.once("connect", () => this._read(n));
      } else if (!state.reading) {
        state.reading = true;

        process.nextTick(binding.socket_tcp_read, this._handle, state.queue(n));
      }
    }
  }

  protected _destroy(err: Error | null, callback: (err: Error | null) => void) {
    if (this.destroyed) return;

    if (this._queue) {
      this._queue.push([4, null, noop]);

      return;
    }

    if (this._destroying) return;

    this.connecting = false;
    this._destroying = true;

    this.readable = this.writable = false;

    this._hadError = !!err;

    this.once("close", () => callback(err));

    binding.socket_tcp_close(this._handle);
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
          // this.read(data, cb);
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

  private _onRead(size: number | null) {
    const state = this._readableState;

    if (size === null) {
      state.reading = false;

      return this.read(0);
    }

    if (!size) {
      this.readable = false;

      state.ended = true;
      this.ended = true;

      this._onEnd();

      return EMPTY;
    }

    if (size < 0) {
      this.destroy(new Error("Read failed"));

      return EMPTY;
    }

    const data = state.queued!.slice(0, size);

    process.nextTick(state.pipe.bind(state), data);

    process.nextTick(this.emit.bind(this), "data", data);

    if (state.flowing) {
      state.consumed += size;

      return state.queued;
    }

    state.append(data, size);

    this.emit("readable");

    return state.queue();
  }

  private _onFinish(status: number) {
    console.log("FINISHED");

    this.finished = true;
    if (this.ended || !this.allowHalfOpen) this.destroy();
    this.emit("finish");

    const err = status < 0 ? new Error("End failed") : null;

    if (err) this.destroy(err);
  }

  private _onClose() {
    console.log("CLOSED");

    if (this._timeout) clearTimeout(this._timeout);

    this.destroyed = true;

    if (this._reads.top !== this._reads.bottom) {
      this._onEnd(new Error("Closed"));
    }

    binding.socket_tcp_destroy(this._handle);

    this._handle = null as any;

    this.emit("close", this._hadError);
  }

  private _onEnd(err: Error | null = null) {
    console.log("ENDED");

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
