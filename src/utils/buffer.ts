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
  const index = buf.data.subarray(0, buf.length).indexOf("\n");

  if (index < 0) {
    return null;
  }

  const msg = Buffer.from(buf.data.subarray(0, index + 1));
  bufPop(buf, index + 1);
  return msg;
};

const bufPop = (buf: DynBuff, len: number) => {
  buf.data.copyWithin(0, len, buf.length);
  buf.length -= len;
};

type DynBuff = {
  data: Buffer;
  length: number;
};

export { bufPush, DynBuff, bufPop, cutMessage };
