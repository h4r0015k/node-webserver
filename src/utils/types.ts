import * as net from "net";

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

type HTTPReq = {
  method: string;
  uri: Buffer;
  version: string;
  headers: Buffer[];
};

type HTTPRes = {
  code: number;
  headers: Buffer[];
  body: BodyReader | undefined;
};

type BodyReader = {
  length: number;
  read: () => Promise<Buffer>;
  close?: () => Promise<void>;
};

export { TCPConn, TCPListener, HTTPRes, HTTPReq, BodyReader };
