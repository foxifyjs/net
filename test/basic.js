const turbo = require("..");

test("basic", done => {
  const opts = { allowHalfOpen: true };

  function onSocket(socket) {
    socket.read(3, function onRead(err, buf, read) {
      if (!read) return socket.end();

      expect(err).toBeNull();

      socket.write(buf, undefined, () => socket.read(read, onRead));
    });
  }

  const server = turbo.createServer(opts, onSocket);

  server.listen(0, () => {
    const socket = turbo.connect({ ...opts, port: server.address().port });
    const chunks = [];

    socket.read(3, function onRead(err, buf, n) {
      expect(err).toBeNull();

      chunks.push(buf.slice(0, n));

      if (n) return socket.read(3, onRead);

      socket.destroy();
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
