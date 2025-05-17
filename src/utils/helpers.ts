type BufferGenerator = AsyncGenerator<Buffer, void, void>;

const countSheep = async function* (): BufferGenerator {
  for (let i = 0; i < 100; i++) {
    await new Promise((res) => setTimeout(res, 1000));
    yield Buffer.from(`Sheep ${i}\n`);
  }
};

const parseHTTPDate = (date: Buffer) => {
  return Math.floor(new Date(date.toString().trim()).getTime() / 1000);
};

export { countSheep, BufferGenerator, parseHTTPDate };
