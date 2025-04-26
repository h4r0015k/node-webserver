import * as net from "net";

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

// read from socket
const soRead = (Conn: TCPConn): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    if (Conn.err) {
      return reject(Conn.err);
    }

    if (Conn.ended) {
      return resolve(Buffer.from(""));
    }

    Conn.reader = { resolve, reject };
    Conn.socket.resume();
  });
};

// write to socket
const soWrite = async (Conn: TCPConn, data: Buffer): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (Conn.err) {
      return reject(Conn.err);
    }

    Conn.socket.write(data, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
};

const serveClient = async (Conn: TCPConn) => {
  try {
    while (true) {
      let data = await soRead(Conn);
      console.log(data?.toString());

      if (data.length == 1) {
        console.log("end connection");
        break;
      }

      await soWrite(Conn, data);
    }

    await soWrite(Conn, Buffer.from("GoodBye\n"));
    Conn.socket.end();
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

type TCPConn = {
  socket: net.Socket;
  reader: null | {
    resolve: (value: Buffer) => void;
    reject: (value: Error) => void;
  };
  err: null | Error;
  ended: Boolean;
};

type TCPListener = {
  server: net.Server;
};
