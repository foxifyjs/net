const turbo = require("..");
const cluster = require("cluster");
const os = require("os");
const semver = require("semver");

test("listen", done => {
  const server = turbo.createServer();

  server.listen(() => {
    const addr = server.address();

    expect(typeof addr.port).toBe("number");
    expect(addr.family).toBe("IPv4");
    expect(addr.address).toBe("0.0.0.0");

    server.close(() => {
      server.listen(addr.port, () => {
        expect(server.address()).toEqual(addr);

        server.close();

        done();
      });
    });
  });
});

test("listen stringed port", done => {
  const server = turbo.createServer();

  server.listen(() => {
    const addr = server.address();
    server.close(() => {
      server.listen("" + addr.port, () => {
        expect(server.address()).toEqual(addr);

        server.close();

        done();
      });
    });
  });
});

test("address no listen", () => {
  const server = turbo.createServer();

  expect(server.address()).toEqual({});
});

test("listen on used port", done => {
  const server = turbo.createServer({ reusePort: false });

  server.listen(() => {
    const another = turbo.createServer({ reusePort: false });

    another.on("error", err => {
      server.close();

      expect(err).not.toBeNull();

      done();
    });

    another.listen(server.address().port);
  });
});

test(`listen on used port (SO_REUSEPORT) (${os.platform()}:${os.release()})`, done => {
  if (
    !cluster.isWorker &&
    os.platform() === "linux" &&
    !semver.satisfies(semver.coerce(os.release()), ">=3.9")
  ) {
    done();
    return;
  }

  const server = turbo.createServer();

  server.listen(() => {
    const another = turbo.createServer();

    another.listen(server.address().port, () => {
      server.close();
      another.close();

      done();
    });
  });
});
