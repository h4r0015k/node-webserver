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

type DynBuff = {
  data: Buffer;
  length: number;
  start: number;
};

export { bufPush, DynBuff, bufPop, cutMessage };
