const turbo = require('..')
const speedometer = require('speedometer')

const server = turbo.createServer()

server.on('connection', function (c) {
  pipe(c, c)
})

server.listen(8080, function () {
  const c = turbo.connect(8080, 'localhost')
  const range = Array(8).join(',').split(',')
  const speed = speedometer()

  c.read(1024 * 1024, function onread(err, buf, len) {
    if (err) throw err;
    speed(len);
    c.read(1024 * 1024, onread);
  });

  range.forEach(function () {
    const buf = Buffer.alloc(1024 * 1024)
    c.write(buf, undefined, function onwrite(err) {
      if (err) throw err;
      c.write(buf, undefined, onwrite);
    });
  })

  setInterval(() => console.log(speed()), 1000)
})

function pipe (a, b) {
  let bufferSize = 16 * 1024
  let max = 8 // up to 8mb
  let full = 4

  for (var i = 0; i < 4; i++) {
    a.read(bufferSize, onread);
  }

  function onread (_, buf, n) {
    if (!n) return

    if (n === buf.length) {
      if (!--full && max) {
        full = 4
        bufferSize *= 2
        max--
      }
    } else {
      full = 4
    }

    b.write(buf, undefined, onwrite)
  }

  function onwrite (err, buf, n) {
    if (err) return
    if (n < bufferSize) n = bufferSize
    a.read(n, onread)
  }
}
