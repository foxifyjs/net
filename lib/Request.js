class Request {
  constructor(handle) {
    this.callback = null;
    this.buffer = null;
    this.buffers = null;
    this.length = 0;
    this.lengths = null;
    this.handle = handle ? Buffer.alloc(handle) : null;
  }

  donev(err) {
    const cb = this.callback;
    const buffers = this.buffers;
    const lengths = this.lengths;

    this.callback = this.buffers = this.lengths = null;
    cb(err, buffers, lengths);
  }

  done(err, len) {
    const cb = this.callback;
    const buf = this.buffer;

    this.callback = this.buffer = null;
    cb(err, buf, len);
  }
}

module.exports = Request;
