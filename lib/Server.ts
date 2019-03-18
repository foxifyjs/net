import * as cluster from "cluster";
import * as dns from "dns";
import { EventEmitter } from "events";
import * as os from "os";
import * as semver from "semver";
import * as unorderedSet from "unordered-set";
import { binding } from "./internals";
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
  }

  export type Event = "close" | "connection" | "error" | "listening" | string;

  export type EventListener<E extends Event> = E extends "connection"
    ? (socket: Socket) => void
    : E extends "error"
    ? (error: Error) => void
    : E extends "close" | "listening"
    ? () => void
    : (...args: any[]) => void;
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
  emit(event: string, ...args: any[]): boolean;

  eventNames(): Server.Event[];

  listenerCount(type: Server.Event): number;
}

class Server extends EventEmitter {
  public readonly allowHalfOpen: boolean;

  public readonly pauseOnConnect: boolean;

  public listening = false;

  public maxConnections?: number;

  protected _handle?: Buffer;

  protected _connections: Socket[] = [];

  protected _reusePort = 0;

  protected _socketName?: Socket.Address;

  constructor(
    options: Server.Options = {},
    connectionListener?: Server.EventListener<"connection">,
  ) {
    super();

    if (typeof options === "function") {
      connectionListener = options;
      options = {};
    }

    const { allowHalfOpen = false, pauseOnConnect = false } = options;

    this.allowHalfOpen = allowHalfOpen;
    this.pauseOnConnect = pauseOnConnect;

    // SO_REUSEPORT is only supported on kernel 3.9+
    if (
      cluster.isWorker &&
      (os.platform() !== "linux" ||
        semver.satisfies(semver.coerce(os.release()) as semver.SemVer, ">=3.9"))
    ) {
      this._reusePort = 1;
    }

    if (connectionListener) {
      this.prependListener("connection", connectionListener);
    }
  }

  public address() {
    if (!this._socketName) {
      if (!this._handle) return {};

      this._socketName = binding.socket_tcp_socketname(this._handle);
    }

    return this._socketName as Socket.Address;
  }

  public close(callback?: () => void) {
    if (!this.listening) return this;

    if (callback) this.prependOnceListener("close", callback);

    if (!this._handle) return this;

    binding.socket_tcp_close(this._handle);

    return this;
  }

  public getConnections(callback?: (err: Error | null, count: number) => void) {
    return this;
  }

  public listen(options: Server.ListenOptions, callback?: () => void): this;
  public listen(port?: number, callback?: () => void): this;
  public listen(port: number, host: string, callback?: () => void): this;
  public listen(
    port: number,
    host: string,
    backlog: number,
    callback?: () => void,
  ): this;
  public listen(
    port?: Server.ListenOptions | number,
    host?: string | (() => void),
    backlog?: number | (() => void),
    callback?: () => void,
  ) {
    let exclusive = 0;

    if (port !== undefined) {
      if (typeof port === "object") {
        exclusive = Number(port.exclusive);
        backlog = port.backlog;
        host = port.host;
        port = port.port;
      } else if (typeof host === "function") {
        callback = host;
        host = undefined;
      } else if (typeof backlog === "function") {
        callback = backlog;
        backlog = undefined;
      }
    }

    if (!port) port = 0;
    if (!host) host = "0.0.0.0";
    if (!backlog) backlog = 511;

    if (callback) this.prependOnceListener("listening", callback);

    dns.lookup(host as string, (err, ip) => {
      if (err) return this.emit("error", err);

      if (this.listening) this.emit("error", new Error("Already bound"));

      if (!this._handle) {
        this._handle = Buffer.alloc(binding.sizeof_socket_tcp_t);

        binding.socket_tcp_init(
          this._handle,
          this,
          this._onAllocConnection,
          null,
          null,
          null,
          null,
          this._onClose,
          this._reusePort || exclusive,
        );
      }

      try {
        binding.socket_tcp_listen(this._handle, port, ip, backlog);
      } catch (err) {
        return this.emit("error", err);
      }

      this.listening = true;

      this.emit("listening");
    });

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

  protected _allocConnection() {
    const socket = new Socket({
      allowHalfOpen: this.allowHalfOpen,
    });

    unorderedSet.add(this._connections, socket);

    socket
      .once("connect", () => this.emit("connection", socket))
      .once("close", () => unorderedSet.remove(this._connections, socket));

    return socket;
  }

  private _onClose() {
    this.listening = false;
    this._socketName = undefined;

    binding.socket_tcp_destroy(this._handle);

    this._handle = undefined;

    this.emit("close");
  }

  private _onAllocConnection() {
    return (this._allocConnection() as any)._handle;
  }
}

export default Server;
