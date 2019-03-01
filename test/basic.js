const turbo = require("..");

test("basic", done => {
  const opts = { allowHalfOpen: true };

  function onSocket(socket) {
    socket.read(Buffer.alloc(3), function onRead(err, buf, read) {
      if (!read) return socket.end();

      expect(err).toBeNull();

      socket.write(buf, read, () => socket.read(buf, onRead));
    });
  }

  const server = turbo.createServer(opts, onSocket);

  server.listen(0, () => {
    const socket = turbo.connect(server.address().port, opts);
    const chunks = [];

    socket.read(Buffer.alloc(3), function onRead(err, buf, n) {
      expect(err).toBeNull();

      chunks.push(buf.slice(0, n));

      if (n) return socket.read(Buffer.alloc(3), onRead);

      socket.close();
      server.close();

      expect(Buffer.concat(chunks)).toEqual(Buffer.from("abc"));

      done();
    });

    socket.write(Buffer.from("a"));
    socket.write(Buffer.from("b"));
    socket.write(Buffer.from("c"));

    socket.end();
  });
});
