import binding from "./binding";

// tslint:disable-next-line:no-empty
function noop() {}

const HANDLE = binding.sizeof_uv_write_t;

namespace WritableState {
  export interface Options {
    highWaterMark?: number;
    encoding?: string;
  }

  export type Chunk<T extends "one" | "many"> = T extends "one"
    ? {
        type: T;
        buffer: Buffer | Uint8Array;
        callback: (err: Error | null) => void;
        length: number;
        handle: Buffer;
      }
    : {
        type: T;
        buffers: Array<Buffer | Uint8Array>;
        callback: (err: Error | null) => void;
        lengths: number[];
        handle: Buffer;
      };
}

class WritableState {
  public highWaterMark: number;

  public chunks: Array<WritableState.Chunk<"one" | "many">> = [];

  public encoding?: string = "utf8";

  public writing = false;

  public ended = false;

  public ending = false;

  public length = 0;

  public sent = 0;

  public corked = false;

  constructor(options: WritableState.Options = {}) {
    const { highWaterMark = 1024 * 1024, encoding } = options;

    this.highWaterMark = highWaterMark;
    this.encoding = encoding;
  }

  public push<T extends "one" | "many">(
    type: T,
    buffer: T extends "one"
      ? (Buffer | Uint8Array | string)
      : Array<Buffer | Uint8Array | string>,
    encoding?: string,
    callback?: (err: Error | null) => void,
  ): WritableState.Chunk<T> {
    if (type === "many") {
      return this._appendMany(buffer as any, encoding, callback) as any;
    }

    return this._appendOne(buffer as any, encoding, callback) as any;
  }

  public shouldConsume() {
    return (
      !this.ended &&
      !this.writing &&
      !this.corked &&
      (this.chunks.length !== 0 || this.ending)
    );
  }

  public consume() {
    return this.chunks[0];
  }

  public shift(err: Error | null) {
    const chunk = this.chunks.shift()!;

    let diff = 0;

    if (chunk.type === "many") chunk.lengths.forEach(l => (diff += l));
    else diff = chunk.length;

    this.length -= diff;
    this.sent += diff;

    return process.nextTick(chunk.callback, err);
  }

  private _appendOne(
    buffer: Buffer | Uint8Array | string,
    encoding = this.encoding,
    callback: (err: Error | null) => void = noop,
  ) {
    if (typeof buffer === "string") buffer = Buffer.from(buffer, encoding as any);

    const length = buffer.length;

    const chunk: WritableState.Chunk<"one"> = {
      buffer,
      callback,
      length,
      handle: Buffer.alloc(HANDLE),
      type: "one",
    } as any;

    this.chunks.push(chunk);

    this.length += length;

    return chunk;
  }

  private _appendMany(
    buffers: Array<Buffer | Uint8Array | string>,
    encoding = this.encoding,
    callback: (err: Error | null) => void = noop,
  ) {
    const lengths: number[] = [];
    let length = 0;

    buffers = buffers.map(buffer => {
      if (typeof buffer === "string") buffer = Buffer.from(buffer, encoding as any);

      const l = buffer.length;
      lengths.push(l);
      length += l;

      return buffer;
    });

    const chunk: WritableState.Chunk<"many"> = {
      callback,
      lengths,
      buffers: buffers as any,
      handle: Buffer.alloc(HANDLE),
      type: "many",
    };

    this.chunks.push(chunk);

    this.length += length;

    return chunk;
  }
}

export default WritableState;
