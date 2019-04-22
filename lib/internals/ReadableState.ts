import * as assert from "assert";
import * as unorderedSet from "unordered-set";
import { Socket } from "..";

const EMPTY = Buffer.alloc(0);

namespace ReadableState {
  export interface Options {
    highWaterMark?: number;
    encoding?: string;
  }
}

class ReadableState {
  public highWaterMark: number;

  public buffer = EMPTY;

  public consumed = 0;

  public queued: Buffer = EMPTY;

  public pipes: Array<Socket<any>> = [];

  public reading = false;

  public ended = false;

  public flowing: boolean | null = null;

  public encoding?: string;

  public get length() {
    return this.buffer.length;
  }

  constructor(options: ReadableState.Options = {}) {
    const { highWaterMark = 1024 * 1024, encoding } = options;

    this.highWaterMark = highWaterMark;
    this.encoding = encoding;
  }

  public prepend(data: Buffer | Uint8Array, length = data.length) {
    assert(Buffer.isBuffer(data), "'data' argument must be a buffer");

    const buffer = this.buffer;

    this.buffer = Buffer.concat([data, buffer], buffer.length + length);

    return this;
  }

  public append(data: Buffer | Uint8Array, length = data.length) {
    assert(Buffer.isBuffer(data), "'data' argument must be a buffer");

    const buffer = this.buffer;

    this.buffer = Buffer.concat([buffer, data], buffer.length + length);

    return this;
  }

  public consume(bytes?: number) {
    assert(
      bytes === undefined || typeof bytes === "number" || !Number.isNaN(bytes),
      "'bytes' argument must be a valid number",
    );

    const buffer = this.buffer;
    const length = buffer.length;

    if (length === 0) return null;

    if (
      bytes === undefined ||
      length === bytes ||
      (length < bytes && this.ended)
    ) {
      this.buffer = EMPTY;

      this.consumed += length;

      return this.encode(buffer);
    }

    if (length < bytes) return null;

    this.buffer = buffer.slice(bytes);

    this.consumed += bytes;

    return this.encode(buffer.slice(0, bytes));
  }

  public queue(size = this.highWaterMark - this.length) {
    return (this.queued = Buffer.allocUnsafe(size));
  }

  public addPipe(destination: Socket<any>, socket: Socket<any>) {
    unorderedSet.add(this.pipes, destination);

    destination.emit("pipe", socket as any);

    return this;
  }

  public removePipe(destination: Socket<any>, socket: Socket<any>) {
    unorderedSet.remove(this.pipes, destination);

    destination.emit("unpipe", socket as any);

    return this;
  }

  public pipe(data: Buffer) {
    if (!this.pipes.length) return this;

    const pipes = this.pipes;

    for (let i = pipes.length - 1; i >= 0; i--) pipes[i].write(data);

    return this;
  }

  public encode(data: Buffer | Uint8Array) {
    const encoding = this.encoding;

    if (!encoding) return data;

    return data.toString(encoding);
  }
}

export default ReadableState;
