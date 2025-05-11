import * as fs from "fs/promises";
import { HTTPRes } from "./types";
import { resp404 } from "./http";
import { dirname } from "path";
import { fileURLToPath } from "url";

const serveStaticFile = async (path: string): Promise<HTTPRes> => {
  let fp: null | fs.FileHandle = null;
  try {
    fp = await fs.open(dirname(fileURLToPath(import.meta.url)) + "/" + path, "r");
    const stat = await fp.stat();
    if (!stat.isFile()) {
      return resp404();
    }
    const size = stat.size;
    const reader = readerFromStaticFile(fp, size);
    fp = null;

    return {
      code: 200,
      headers: [],
      body: reader,
    };
  } catch (error) {
    console.log(error);
    return resp404();
  } finally {
    await fp?.close();
  }
};

const readerFromStaticFile = (fp: fs.FileHandle, size: number) => {
  let got = 0;
  return {
    length: size,
    read: async () => {
      const r: fs.FileReadResult<Buffer> = await fp.read();
      got += r.bytesRead;

      if (got > size || (got < size && r.bytesRead == 0)) {
        throw new Error("file changed");
      }

      return r.buffer.subarray(0, r.bytesRead);
    },
    close: async () => fp.close(),
  };
};

export { serveStaticFile };
