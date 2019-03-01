const turbo = require("..");

test("connect with hostname", done => {
  const server = turbo.createServer(socket => socket.end());

  server.listen(() => {
    const client = turbo.connect(server.address().port, "localhost");

    client.on("connect", () => {
      server.close();

      done();
    });
  });
});

test("connect with error", done => {
  const server = turbo.createServer(socket => socket.end());

  server.listen(() => {
    const port = server.address().port;

    server.close(() => {
      const client = turbo.connect(port, "localhost");

      client.on("error", err => {
        expect(err).not.toBeNull();

        done();
      });
    });
  });
});

test("connect with and read/write and error", done => {
  expect.assertions(3);

  const server = turbo.createServer(socket => socket.end());

  server.listen(() => {
    const port = server.address().port;

    server.close(() => {
      const client = turbo.connect(port, "localhost");

      client.on("error", err => {
        expect(err).not.toBeNull();

        done();
      });

      client.read(Buffer.alloc(1024), err => expect(err).not.toBeNull());
      client.write(Buffer.alloc(1024), err => expect(err).not.toBeNull());
    });
  });
});

test("close before connect", done => {
  const server = turbo.createServer(socket => socket.end());

  server.listen(() => {
    const port = server.address().port;
    const client = turbo.connect(port);

    client.close(() => {
      server.close();

      done();
    });
  });
});
