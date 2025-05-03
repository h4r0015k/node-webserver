import { TCPConn } from "./types";

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

export { soRead, soWrite };
