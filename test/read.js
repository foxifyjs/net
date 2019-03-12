const turbo = require("..");

test("read", done => {
  const server = turbo.createServer(socket => {
    socket.write(Buffer.from("hello world"));

    socket.end();
  });

  server.listen(() => {
    const socket = turbo.connect(server.address().port);

    socket.on("connect", () => {
      socket.read(1024, (err, buf, n) => {
        expect(err).toBeNull();

        expect(n > 0).toBe(true);
        expect(buf.slice(0, n)).toEqual(
          Buffer.from("hello world").slice(0, n),
        );

        socket.destroy();
        server.close();

        done();
      });
    });
  });
});

test("many reads", done => {
  const expected = Buffer.from("hello world hello world hello world");

  expect.assertions(2 * expected.length + 2);

  const server = turbo.createServer(socket => {
    socket.write(expected);
    socket.end();
  });

  server.listen(() => {
    const socket = turbo.connect(server.address().port);

    for (let i = 0; i < expected.length; i++) {
      const next = expected[i];

      socket.read(1, (err, buf) => {
        expect(err).toBeNull();

        expect(buf).toEqual(Buffer.from([next]));
      });
    }

    socket.read(1024, (err, buf, n) => {
      server.close();

      expect(err).toBeNull();

      expect(n).toBe(0);

      done();
    });
  });
});
