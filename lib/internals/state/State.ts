import * as assert from "assert";

namespace State {
  export interface Options {
    highWaterMark?: number;
  }
}

class State {
  public highWaterMark: number;

  public buffer = Buffer.alloc(0);

  public consumed = 0;

  public get length() {
    return this.buffer.length;
  }

  constructor(options: State.Options = {}) {
    const { highWaterMark = 16 * 1024 } = options;

    this.highWaterMark = highWaterMark;
  }

  public append(data: Buffer, length: number) {
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

    if (bytes === undefined || length === bytes) {
      this.buffer = Buffer.alloc(0);

      this.consumed += length;

      return buffer;
    }

    if (length < bytes) return null;

    this.buffer = buffer.slice(bytes);

    this.consumed += bytes;

    return buffer.slice(0, bytes);
  }
}

export default State;
