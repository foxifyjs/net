const turbo = require("..");

test("writev", done => {
  const server = turbo.createServer(echo, { reusePort: false });

  server.listen(() => {
    const client = turbo.connect(server.address().port);

    read(client, 11, (err, buf) => {
      expect(err).toBeNull();
      expect(buf).toEqual(Buffer.from("hello world"));

      server.close();
      client.destroy().on("close", () => done());
    });

    client.writev([Buffer.from("hello "), Buffer.from("world")]);
  });
});

test("writev after connect", done => {
  const server = turbo.createServer(echo, { reusePort: false });

  server.listen(() => {
    const client = turbo.connect(server.address().port);

    read(client, 11, (err, buf) => {
      expect(err).toBeNull();
      expect(buf).toEqual(Buffer.from("hello world"));

      server.close();
      client.destroy().on("close", () => done());
    });

    client.on("connect", () => {
      client.writev([Buffer.from("hello "), Buffer.from("world")]);
    });
  });
});

test("writev before and after connect", done => {
  const server = turbo.createServer(echo, { reusePort: false });

  server.listen(() => {
    const client = turbo.connect(server.address().port);

    read(client, 14 + 11, (err, buf) => {
      expect(err).toBeNull();
      expect(buf).toEqual(Buffer.from("hej verden og hello world"));

      server.close();
      client.destroy().on("close", () => done());
    });

    client.writev([
      Buffer.from("hej "),
      Buffer.from("verden "),
      Buffer.from("og ")
    ]);

    client.on("connect", () => {
      client.writev([Buffer.from("hello "), Buffer.from("world")]);
    });
  });
});

test("writev twice", done => {
  const server = turbo.createServer(echo, { reusePort: false });

  server.listen(() => {
    const client = turbo.connect(server.address().port);

    read(client, 14 + 11, (err, buf) => {
      expect(err).toBeNull();
      expect(buf).toEqual(Buffer.from("hej verden og hello world"));

      server.close();
      client.destroy().on("close", () => done());
    });

    client.writev([
      Buffer.from("hej "),
      Buffer.from("verden "),
      Buffer.from("og ")
    ]);

    client.writev([Buffer.from("hello "), Buffer.from("world")]);
  });
});

test("write 256 buffers", done => {
  const server = turbo.createServer(echo, { reusePort: false });

  server.listen(() => {
    const client = turbo.connect(server.address().port);
    const expected = Buffer.alloc(256);

    read(client, 256, (err, buf) => {
      expect(err).toBeNull();
      expect(buf).toEqual(expected);

      server.close();
      client.destroy().on("close", () => done());
    });

    for (let i = 0; i < 256; i++) {
      expected[i] = i;
      client.write(Buffer.from([i]));
    }
  });
});

function read(socket, read, cb) {
  const buf = Buffer.alloc(read);

  socket.read(read, (err, next, n) => {
    if (err) return cb(err);

    read -= n;

    if (!read) return cb(null, next);

    socket.read(read, cb);
  });
}

function echo(socket) {
  socket.read(65536, function onRead(err, buf, n) {
    if (err) return;

    socket.write(buf, n, err => {
      if (err) return;

      socket.read(buf.length, onRead);
    });
  });
}
