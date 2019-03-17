import * as dns from "dns";
import { EventEmitter } from "events";
import { Readable, Writable } from "stream";
import { binding, ReadableState, WritableState } from "./internals";

const EMPTY = Buffer.alloc(0);

// tslint:disable-next-line:no-empty
function noop() {}

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

  protected _readableState: ReadableState;
  protected _writableState: WritableState;

  protected _destroying = false;

  protected _timeout?: NodeJS.Timeout;

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

  public get bytesRead() {
    const state = this._readableState;

    return state.length + state.consumed;
  }

  constructor(options: Socket.Options = {}) {
    super();

    const {
      allowHalfOpen = false,
      readableHighWaterMark,
      writableHighWaterMark,
    } = options;

    this._readableState = new ReadableState({
      highWaterMark: readableHighWaterMark,
    });

    this._writableState = new WritableState({
      highWaterMark: writableHighWaterMark,
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

  public setEncoding(encoding?: string) {
    this._readableState.encoding = encoding;

    return this;
  }

  public setDefaultEncoding(encoding?: string) {
    this._writableState.encoding = encoding;

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

        this.read(0);
      } else if (event === "readable") {
        state.flowing = false;

        this.read(0);
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
    const length = state.length;
    let size = state.highWaterMark - length;

    if (length && state.flowing) {
      const data = state.consume(bytes)!;

      process.nextTick(state.pipe.bind(state), data);

      process.nextTick(this.emit.bind(this), "data", data);

      size = state.highWaterMark;
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

      this.read(0);
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

    const encoded = state.encode(chunk);

    process.nextTick(state.pipe.bind(state), encoded);

    process.nextTick(this.emit.bind(this), "data", encoded);

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
    callback?: (err: Error | null) => void,
  ): boolean;
  public write(
    data: string | Buffer | Uint8Array,
    encoding?: string,
    callback?: (err: Error | null) => void,
  ): boolean;
  public write(
    data: string | Buffer | Uint8Array,
    encoding?: string | ((err: Error | null) => void),
    callback?: (err: Error | null) => void,
  ) {
    const state = this._writableState;
    const highWaterMark = state.highWaterMark;

    if (state.length >= highWaterMark) return false;

    if (typeof encoding === "function") {
      callback = encoding;
      encoding = undefined;
    }

    if (!this.writable && (state.ending || state.ended)) {
      this._notWritable(callback, data);

      return false;
    }

    state.push("one", data, encoding, callback);

    this._write();

    return state.length < highWaterMark;
  }

  public writev(
    datas: Array<string | Buffer | Uint8Array>,
    encoding?: string | ((err: Error | null) => void),
    callback?: (err: Error | null) => void,
  ) {
    const state = this._writableState;
    const highWaterMark = state.highWaterMark;

    if (state.length >= highWaterMark) return false;

    if (typeof encoding === "function") {
      callback = encoding;
      encoding = undefined;
    }

    if (!this.writable && (state.ending || state.ended)) {
      this._notWritable(callback, datas);

      return false;
    }

    state.push("many", datas, encoding, callback);

    this._write();

    return state.length < highWaterMark;
  }

  public end(callback?: () => void): void;
  public end(data: string | Buffer | Uint8Array, callback?: () => void): void;
  public end(
    data: string | Buffer | Uint8Array,
    encoding?: string,
    callback?: () => void,
  ): void;
  public end(
    data?: string | Buffer | Uint8Array | (() => void),
    encoding?: string | (() => void),
    callback?: () => void,
  ) {
    if (typeof data === "function") {
      callback = data;
      data = undefined;
    } else if (typeof encoding === "function") {
      callback = encoding;
      encoding = undefined;
    }

    if (data !== undefined) {
      this.write(data, encoding as (string | undefined));
    }

    this._end(callback);
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

  protected _write() {
    const state = this._writableState;

    if (!this.writable || !state.shouldConsume()) return;

    if (state.chunks.length === 0) {
      this.writable = false;

      binding.socket_tcp_shutdown(this._handle);

      return;
    }

    const chunk = state.consume();

    state.writing = true;

    if (chunk.type === "one") {
      // tslint:disable-next-line:no-shadowed-variable
      const { handle, buffer, length } = chunk;

      binding.socket_tcp_write(this._handle, handle, buffer, length);

      return;
    }

    const { handle, buffers, lengths } = chunk;

    if (buffers.length === 2) {
      // faster c case for just two buffers which is common
      binding.socket_tcp_write_two(
        this._handle,
        handle,
        buffers[0],
        lengths[0],
        buffers[1],
        lengths[1],
      );

      return;
    }

    binding.socket_tcp_writev(this._handle, handle, buffers, lengths);
  }

  protected _destroy(err: Error | null, callback: (err: Error | null) => void) {
    if (this.destroyed || this._destroying) return;

    this.connecting = false;
    this._destroying = true;

    this.readable = this.writable = false;

    this._hadError = !!err;

    this.once("close", () => callback(err));

    binding.socket_tcp_close(this._handle);
  }

  protected _end(callback?: () => void) {
    const state = this._writableState;

    if (!this.writable && (state.ending || state.ended)) {
      return this._notWritable(callback);
    }

    if (callback) this.once("finish", callback);

    if (state.ending) return;

    state.ending = true;

    this._write();
  }

  private _onConnect(status: number) {
    if (status < 0) {
      this._write();

      return this.emit("error", new Error("Connect failed"));
    }

    this.readable = true;
    this.writable = true;

    this._write();

    this.emit("connect");

    this._write();
  }

  private _onWrite(status: number) {
    const state = this._writableState;

    state.shift(status < 0 ? new Error("Write failed") : null);

    state.writing = false;

    process.nextTick(this._write.bind(this));
  }

  private _onRead(size: number) {
    const state = this._readableState;

    if (size === 0) {
      this.readable = false;

      state.ended = true;

      this._onEnd();

      return EMPTY;
    }

    if (size < 0) {
      this.destroy(new Error("Read failed"));

      return EMPTY;
    }

    const data = state.queued!.slice(0, size);
    const encoded = state.encode(data);

    process.nextTick(state.pipe.bind(state), encoded);

    process.nextTick(this.emit.bind(this), "data", encoded);

    if (state.flowing) {
      state.consumed += size;

      if (state.encoding) return state.queued;

      return state.queue(state.highWaterMark);
    }

    state.append(data, size);

    this.emit("readable");

    return state.queue();
  }

  private _onFinish(status: number) {
    this.finished = true;

    if (this._readableState.ended || !this.allowHalfOpen) this.destroy();

    this.emit("finish");

    if (status < 0) this.destroy(new Error("End failed"));
  }

  private _onClose() {
    if (this._timeout) clearTimeout(this._timeout);

    this.destroyed = true;

    if (this._readableState.length) {
      this._onEnd(new Error("Closed"));
    }

    binding.socket_tcp_destroy(this._handle);

    this._handle = null as any;

    this.emit("close", this._hadError);
  }

  private _onEnd(err: Error | null = null) {
    // while (this._readableState.length) {
    // this._reads.shift().done(err, 0);
    // }

    if (err) return;

    if (this.finished || !this.allowHalfOpen) this.destroy();

    this.emit("end");
  }

  private _notWritable(cb: Function = noop, data?: any) {
    process.nextTick(
      cb,
      this.finished ? null : new Error("Not writable"),
      data,
    );
  }
}

export default Socket;
