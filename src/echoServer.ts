import * as net from "net";

const newConn = (socket: net.Socket): void => {
  console.log("New connection: ", socket.remoteAddress, socket.remotePort);

  // reads and echos messages
  socket.on("data", (data: Buffer) => {
    let message = data.toString();
    console.log(
      "From: ",
      socket.remoteAddress,
      socket.remotePort,
      " : ",
      message
    );

    if (message.includes("q")) {
      socket.write("Closing...");
      socket.end(); // send FIN and close connection
    } else {
      socket.write(message);
    }
  });

  socket.on("error", (error: Error) => {
    console.error(error);
  });

  socket.on("end", () => {
    console.log("EOF.");
  });
};

// creates a listening socket whose type is net.Server
let server = net.createServer();

server.on("connection", newConn);

// bind listener
server.listen({
  host: "127.0.0.1",
  port: 7777,
});
