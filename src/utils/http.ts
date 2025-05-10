import { bufPop, bufPush, DynBuff, splitLines } from "./buffer";
import { BufferGenerator, countSheep } from "./helpers";
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
      Buffer.from(" chunked")
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
    return readFromGenerator(readChunks(conn, buf));
  } else {
    throw Error("TO DO: reading rest of body");
  }
};

const readChunks = async function* (
  conn: TCPConn,
  buf: DynBuff
): BufferGenerator {
  for (let last = false; !last; ) {
    const idx = buf.data.subarray(0, buf.length).indexOf("\r\n");
    if (idx < 0) {
      continue;
    }

    let remain = buf.data.subarray(0, idx).length;
    bufPop(buf, remain);

    last = remain == 0;

    while (remain > 0) {
      const consume = Math.min(remain, buf.length);
      const data = Buffer.from(buf.data.subarray(0, consume));
      bufPop(buf, consume);
      remain -= consume;
      yield data;
    }

    bufPop(buf, 2);
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
    case "/sheep": {
      resp = readFromGenerator(countSheep());
      break;
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

const writeHTTPRespV2 = async (conn: TCPConn, resp: HTTPRes) => {
  if (resp.body && resp.body.length < 0) {
    resp.headers.push(Buffer.from("Transfer-Encoding: Chunked"));
  } else {
    resp.headers.push(Buffer.from(`Content-Length: ${resp.body?.length || 0}`));
  }

  await soWrite(conn, encodeHTTPResp(resp));

  const crlf = Buffer.from("\r\n");

  for (let last = false; !last; ) {
    let data = await resp.body?.read();
    last = data?.length == 0;

    if (resp.body?.length && resp.body.length < 0) {
      data = Buffer.concat([
        Buffer.from(data?.length?.toString(16) || "0"),
        crlf,
        data as Buffer,
        crlf,
      ]);
    }

    if (data?.length) {
      await soWrite(conn, data);
    }
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

const readFromGenerator = (generator: BufferGenerator) => {
  return {
    length: -1,
    read: async () => {
      let gen = await generator.next();
      if (gen.done) {
        return Buffer.from("");
      } else {
        return gen.value;
      }
    },
  };
};

export { readFromReq, parseHTTPReq, handleReq, writeHTTPResp, writeHTTPRespV2 };
