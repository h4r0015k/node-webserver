import { bufPop, bufPush, DynBuff, splitLines } from "./buffer";
import { soRead, soWrite } from "./socket";
import { BodyReader, HTTPReq, HTTPRes, TCPConn } from "./types";

const parseHTTPReq = (data: Buffer) => {
  const lines = splitLines(data);
  const [method, uri, version] = splitLines(lines[0], " ", 1);

  const headers = [];

  for (let i = 1; i < lines.length; i++) {
    // to-do: add validation
    headers.push(lines[i]);
  }

  return {
    method: method?.toString(),
    uri,
    version: version?.toString(),
    headers,
  };
};

const readFromReq = (conn: TCPConn, buf: DynBuff, req: HTTPReq) => {
  let bodyLen = -1;
  const contentLen = fieldGet(req.headers, "Content-Length");
  if (contentLen) {
    bodyLen = parseInt(contentLen.toString());
  }

  if (isNaN(bodyLen)) {
    throw Error("bad content length");
  }

  const bodyAllowed = !(req.method === "GET" || req.method == "HEAD");

  const chunked =
    fieldGet(req.headers, "Transfer-Encoding")?.equals(
      Buffer.from("chunked")
    ) || false;

  if (!bodyAllowed && (chunked || bodyLen > 0)) {
    throw Error("HTTP body not allowed");
  }

  if (!bodyAllowed) {
    bodyLen = 0;
  }

  if (bodyLen >= 0) {
    return readerFromConnLength(conn, buf, bodyLen);
  } else if (chunked) {
    throw Error("TO DO: chunked");
  } else {
    throw Error("TO DO: reading rest of body");
  }
};

const readerFromConnLength = (conn: TCPConn, buf: DynBuff, remain: number) => {
  return {
    length: remain,
    read: async () => {
      if (!remain) {
        return Buffer.from("");
      }

      if (!buf.length) {
        let data = await soRead(conn);
        bufPush(buf, data);

        if (!buf.length) {
          throw Error("Unexpected EOF from HTTP Body");
        }
      }

      const consume = Math.min(buf.length, remain);
      remain -= consume;
      const data = Buffer.from(buf.data.subarray(0, consume));
      bufPop(buf, consume);
      return data;
    },
  };
};

const readerFromMemory = (data: Buffer) => {
  let done = false;

  return {
    length: data.length,
    read: async () => {
      if (done) {
        return Buffer.from("");
      } else {
        done = true;
        return data;
      }
    },
  };
};

const fieldGet = (headers: Array<Buffer>, field: string) => {
  let mappedHeaders: Array<Array<Buffer>> = [];

  headers.forEach((header) => mappedHeaders.push(splitLines(header, ":", 1)));

  return (
    mappedHeaders.find(
      (heads) => heads[0] && heads[0].equals(Buffer.from(field))
    )?.[1] || null
  );
};

const handleReq = async (req: HTTPReq, body: BodyReader) => {
  let resp;
  switch (req.uri.toString()) {
    case "/echo": {
      resp = body;
      break;
    }
    case "/version": {
      if (req.method == "GET") {
        resp = readerFromMemory(Buffer.from("VERSION: 0.1"));
        break;
      }
    }
    default: {
      resp = readerFromMemory(Buffer.from("BASIC SERVER"));
    }
  }

  return {
    code: 200,
    headers: [Buffer.from("Server:Basic HTTP Protocol")],
    body: resp,
  };
};

const writeHTTPResp = async (conn: TCPConn, resp: HTTPRes) => {
  if (resp.body && resp.body.length < 0) {
    throw new Error("TODO: chunked encoding");
  }
  resp.headers.push(Buffer.from(`Content-Length: ${resp.body?.length || 0}`));
  await soWrite(conn, encodeHTTPResp(resp));

  while (true) {
    const data = await resp.body?.read();

    if (!data?.length) {
      break;
    }

    await soWrite(conn, data);
  }
};

const encodeHTTPResp = (resp: HTTPRes) => {
  const heads = [
    Buffer.from(`HTTP/1.1 ${resp.code} Success\r\n`),
    ...resp.headers.map((head) => Buffer.concat([head, Buffer.from("\r\n")])),
    Buffer.from("\r\n"),
  ];

  return Buffer.concat(heads);
};

export { readFromReq, parseHTTPReq, handleReq, writeHTTPResp };
