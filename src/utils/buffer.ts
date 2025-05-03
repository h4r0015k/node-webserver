import { parseHTTPReq } from "./http";
import { HTTPReq } from "./types";

const kMaxHeaderLen = 1024 * 8;

const bufPush = (buf: DynBuff, data: Buffer): void => {
  const newLen = buf.length + data.length;

  if (newLen > buf.length) {
    let cap = Math.max(buf.length, 32);
    while (cap < newLen) {
      cap *= 2;
    }

    const grown = Buffer.alloc(cap);
    buf.data.copy(grown, 0, 0);
    buf.data = grown;
  }

  data.copy(buf.data, buf.length, 0);
  buf.length = newLen;
};

const cutMessage = (buf: DynBuff): Buffer | null => {
  const index = buf.data.subarray(0, buf.length).indexOf("\n", buf.start);

  if (index < 0) {
    return null;
  }

  const msg = Buffer.from(buf.data.subarray(buf.start, index + 1));
  buf.start = index + 1;

  // only push forward when wasted space reaches thresold size
  if (buf.start >= 32 && buf.start >= buf.length / 2) {
    bufPop(buf, buf.start);
    buf.start = 0;
  }

  return msg;
};

const bufPop = (buf: DynBuff, len: number) => {
  buf.data.copyWithin(0, len, buf.length);
  buf.length -= len;
};

const splitLines = (
  data: Buffer,
  delimiter: string = "\r\n",
  length: number = 2
): Array<Buffer> => {
  const lines = [];
  let start = 0;

  while (true) {
    let index = data.indexOf(delimiter, start);
    if (index < 0) {
      let last = data.subarray(start, data.length);
      if (last.length) {
        lines.push(Buffer.from(last));
      }
      break;
    }

    lines.push(Buffer.from(data.subarray(start, index)));
    start = index + length;
  }

  return lines;
};

const cutMessageV2 = (buf: DynBuff): null | HTTPReq => {
  const index = buf.data.subarray(buf.start, buf.length).indexOf("\r\n\r\n");
  if (index < 0) {
    if (buf.length > kMaxHeaderLen) {
      throw Error("header is too large");
    }
    return null;
  }

  const msg = parseHTTPReq(buf.data.subarray(buf.start, index + 4));
  buf.start = index + 4;

  if (buf.start >= 32 && buf.start > buf.length / 2) {
    bufPop(buf, buf.start);
  }

  return msg;
};

type DynBuff = {
  data: Buffer;
  length: number;
  start: number;
};

export { bufPush, DynBuff, bufPop, cutMessage, splitLines, cutMessageV2 };
