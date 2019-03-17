const turbo = require('../')

const server = turbo.createServer(function (socket) {
  console.log(socket.remoteFamily, socket.remoteAddress, socket.remotePort)

  socket.destroy()
})

server.listen(8080)
