import * as net from "net";
import { DynBuff, cutMessage, bufPush } from "../utils/buffer";
import { TCPConn, TCPListener } from "../utils/types";
import { soRead, soWrite } from "../utils/socket";

// initialize socket
const soInit = (socket: net.Socket) => {
  const Conn: TCPConn = {
    socket,
    reader: null,
    err: null,
    ended: false,
  };

  socket.on("data", (data: Buffer) => {
    socket.pause();

    Conn.reader?.resolve(data);
    Conn.reader = null;
  });

  socket.on("error", (error: Error) => {
    Conn.err = error;

    if (Conn.reader) {
      Conn.reader.reject(error);
      Conn.reader = null;
    }
  });

  socket.on("end", () => {
    Conn.ended = true;

    if (Conn.reader) {
      Conn.reader.resolve(Buffer.from(""));
      Conn.reader = null;
    }
  });

  return Conn;
};

const serveClient = async (Conn: TCPConn) => {
  try {
    // dynamic buffer
    const buff = { data: Buffer.alloc(0), length: 0, start: 0 } as DynBuff;

    while (true) {
      let message = cutMessage(buff);
      if (!message) {
        let data = await soRead(Conn);

        if (data.length == 0) {
          return;
        }
        bufPush(buff, data);

        continue;
      }
      if (message.equals(Buffer.from("quit\n"))) {
        await soWrite(Conn, Buffer.from("GoodBye\n"));
        Conn.socket.destroy();
      } else {
        await soWrite(Conn, Buffer.concat([Buffer.from("Echo: "), message]));
      }
    }
  } catch (err) {
    console.log(err);
  }
};

// creates listener
const soListen = (host: string, port: number) => {
  let server = net.createServer({
    pauseOnConnect: true,
  });

  server.listen({
    host,
    port,
  });

  return {
    server,
  } as TCPListener;
};

// accept new connections
const soAccept = (listener: TCPListener): Promise<TCPConn> => {
  return new Promise((resolve, reject) => {
    listener.server.once("connection", async (socket: net.Socket) => {
      try {
        return resolve(soInit(socket));
      } catch (err) {
        console.log(err);
        return reject(err);
      }
    });
  });
};

(async () => {
  try {
    const listener = soListen("127.0.0.1", 7777);
    while (true) {
      console.log("Waiting for new connection...");
      let Conn = await soAccept(listener);
      console.log("Found new connection");
      serveClient(Conn);
    }
  } catch (err) {
    console.log(err);
  }
})();
