const net = require('..')
const speedometer = require('speedometer')

const server = net.createServer({}, function (socket) {
  socket.pipe(socket)
})

server.listen(8080, function () {
  const socket = net.connect(8080, 'localhost')
  const range = Array(8).join(',').split(',')
  const speed = speedometer()

  socket.on("data", function(data) {
    speed(data.length);
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
