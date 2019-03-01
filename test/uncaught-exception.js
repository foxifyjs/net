const proc = require("child_process");
const turbo = require("..");

// FIXME: jest has problem with process.on("uncaughtException")

// test("uncaughts are not swallowed", done => {
//   const server = turbo.createServer(socket => socket.end());

//   server.listen(() => {
//     const client = turbo.connect(server.address().port);

//     process.removeAllListeners("uncaughtException");
//     process.on("uncaughtException", err => {
//       client.close();
//       server.close();

//       expect(err.message).toBe("stop");

//       done();
//     });

//     client.on("connect", () => {
//       throw new Error("stop");
//     });
//   });
// });

test("uncaughts are not swallowed (child process)", done => {
  const child = proc.spawn(
    process.execPath,
    [
      "-e",
      `
    const turbo = require('../')
    const server = turbo.createServer(socket => socket.end())

    server.listen(function () {
      const client = turbo.connect(server.address().port)
      client.on('connect', function () {
        throw new Error('stop')
      })
    })
  `
    ],
    {
      cwd: __dirname
    }
  );

  const buf = [];

  child.stderr.on("data", data => buf.push(data));

  child.stderr.on("end", () => {
    expect(buf.join("").indexOf("Error: stop") > -1).toBe(true);

    done();
  });
});
