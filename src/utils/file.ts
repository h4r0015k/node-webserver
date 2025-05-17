import * as fs from "fs/promises";
import { HTTPReq, HTTPRes } from "./types";
import { fieldGet, readerFromMemory, resp404 } from "./http";
import { dirname } from "path";
import { fileURLToPath } from "url";
import { Stats } from "fs";
import { parseHTTPDate } from "./helpers";

const serveStaticFile = async (
  path: string,
  req: HTTPReq
): Promise<HTTPRes> => {
  let fp: null | fs.FileHandle = null;
  try {
    fp = await fs.open(
      dirname(fileURLToPath(import.meta.url)) + "/" + path,
      "r"
    );

    const stat = await fp.stat();
    if (!stat.isFile()) {
      return resp404();
    }

    try {
      return staticFileResp(req, fp, stat);
    } finally {
      fp = null;
    }
  } catch (error) {
    console.log(error);
    return resp404();
  } finally {
    await fp?.close();
  }
};

const readerFromStaticFile = (
  fp: fs.FileHandle,
  start: number,
  end: number
) => {
  let got = 0;
  const buf = Buffer.allocUnsafe(65536);
  const len = end - start;

  return {
    length: len,
    read: async () => {
      const maxRead = Math.min(buf.length, end - start);
      const r: fs.FileReadResult<Buffer> = await fp.read({
        position: start,
        buffer: buf,
        length: maxRead,
      });

      got += r.bytesRead;
      start += r.bytesRead;

      if (got > len || (got < len && r.bytesRead == 0)) {
        throw new Error("file changed");
      }

      return r.buffer.subarray(0, r.bytesRead);
    },
    close: async () => fp.close(),
  };
};

const staticFileResp = (req: HTTPReq, fp: fs.FileHandle, stat: Stats) => {
  let headers = [
    Buffer.from("Accept-Ranges: bytes"),
    Buffer.from(`Last-Modified: ${stat.mtime.toUTCString()}`),
  ];

  const ts = Math.floor(stat.mtime.getTime() / 1000);
  const lastModified = fieldGet(req.headers, "If-Modified-Since");

  if (lastModified && ts == parseHTTPDate(lastModified)) {
    return {
      code: 304,
      headers,
      body: readerFromMemory(Buffer.from("")),
    };
  }

  let range = fieldGet(req.headers, "Range");
  const rangeTime = fieldGet(req.headers, "If-Range");

  if (rangeTime && parseHTTPDate(rangeTime) !== ts) {
    range = null;
  }

  const size = stat.size;
  let start = 0;
  let end = size;
  let partial = false;

  if (range) {
    partial = true;
    let [startNum, endNum] =
      range?.toString().trim().replace("bytes=", "").split("-") || [];

    if (startNum || endNum) {
      if (!startNum?.length && endNum?.length) {
        start = size - Number(endNum);
        end = size;
      } else if (endNum?.length) {
        start = Number(startNum);
        end = Number(endNum);
      } else {
        partial = false;
      }

      if (start > size || end > size || start < 0 || end < 0) {
        fp.close();
        return {
          code: 416,
          headers: [
            Buffer.from(
              `Accept-Ranges: bytes\r\nContent-Range: bytes */${size}`
            ),
          ],
          body: readerFromMemory(Buffer.from("Invalid range")),
        };
      }
    }
  }

  const reader = readerFromStaticFile(
    fp,
    Number(start || 0),
    Number(end || size)
  );

  if (partial) {
    headers.push(
      Buffer.from(`Content-Range: bytes ${range?.toString().trim()}/${size}`)
    );
  }

  return {
    code: partial ? 204 : 200,
    headers,
    body: reader,
  };
};

export { serveStaticFile };
