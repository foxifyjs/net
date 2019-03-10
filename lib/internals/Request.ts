class Request {
  public callback:
    | null
    | ((err: Error | null, buf: any, len: any) => void) = null;

  public buffer: null | Buffer = null;

  public buffers: null | Buffer[] = null;

  public length = 0;

  public lengths: null | number[] = null;

  public handle: null | Buffer;

  constructor(handle?: number) {
    this.handle = handle ? Buffer.alloc(handle) : null;
  }

  public donev(err: Error | null) {
    const cb = this.callback;
    const buffers = this.buffers;
    const lengths = this.lengths;

    this.callback = this.buffers = this.lengths = null;

    if (cb) cb(err, buffers, lengths);
  }

  public done(err: Error | null, len: number) {
    const cb = this.callback;
    const buf = this.buffer;

    this.callback = this.buffer = null;

    if (cb) cb(err, buf, len);
  }
}

export default Request;
