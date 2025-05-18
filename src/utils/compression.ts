import Stream from "node:stream";
import { pipeline } from "node:stream/promises";
import { fieldGet } from "./http";
import { BodyReader, HTTPReq, HTTPRes } from "./types";
import * as zlib from "zlib";

const enableCompression = (req: HTTPReq, res: HTTPRes) => {
  res.headers.push(Buffer.from("Vary: content-encoding"));

  if (fieldGet(req.headers, "Range")) {
    return;
  }

  const codecs = fieldGet(req.headers, "Accept-Encoding");
  if (!codecs?.includes("gzip")) {
    return;
  }

  res.headers.push(Buffer.from("Content-Encoding: gzip"));
  res.body = gzipFilter(res.body);
};

const body2Stream = (reader: BodyReader) => {
  let self: null | Stream.Readable = null;

  self = new Stream.Readable({
    read: async () => {
      try {
        const data = await reader.read();
        self?.push(data.length > 0 ? data : null);
      } catch (err) {
        self?.destroy(err instanceof Error ? err : new Error("IO"));
      }
    },
  });

  return self;
};

const gzipFilter = (reader: BodyReader): BodyReader => {
  const gz: Stream.Duplex = zlib.createGzip();
  const input: Stream.Readable = body2Stream(reader);

  pipeline(input, gz);

  const iter: AsyncIterator<Buffer> = gz.iterator();

  return {
    length: -1,
    read: async () => {
      const r: IteratorResult<Buffer, void> = await iter.next();
      return r.done ? Buffer.from("") : r.value;
    },
    close: reader.close
  };
};

export { enableCompression };
