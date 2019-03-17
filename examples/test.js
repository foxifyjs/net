// const net = require("net");
const net = require("..");

const server = net.createServer({}, socket => {
  // socket.setEncoding("utf8");
  const chunks = [];

  socket.on("data", data => {
    chunks.push(data);

    console.log("read ->", chunks.map(ch => ch.toString()), `(${chunks.join("").length})`);
    // console.log("read ->", `(${chunks.join("").length})`);
  });
});

server.listen(8080, () => {
  const socket = net.connect(8080, "localhost");

  // let string = "";
  // for (let i = 0; i < 17 * 1024; i++) string += "1";
  // socket.write(string, undefined, console.log);

  // setTimeout(socket.write.bind(socket), 3000, "0");

  socket.write("Hello");
  socket.write(" ");
  socket.end("World!");
});
