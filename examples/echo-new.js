const turbo = require('..')
const speedometer = require('speedometer')

const server = turbo.createServer()

server.on('connection', function (socket) {
  socket.pipe(socket)
})

server.listen(8080, function () {
  const socket = turbo.connect(8080, 'localhost')
  const range = Array(8).join(',').split(',')
  const speed = speedometer()

  socket.read(1024 * 1024, function onread(err, buf, len) {
    if (err) throw err;
    speed(len);
    socket.read(1024 * 1024, onread);
  });

  range.forEach(function () {
    const buf = Buffer.alloc(1024 * 1024)
    socket.write(buf, undefined, function onwrite(err) {
      if (err) throw err;
      socket.write(buf, undefined, onwrite);
    });
  })

  setInterval(() => console.log(speed()), 1000)
})
