type Queue<T> = {
  pushBack(item: T): Promise<void>;
  popFront(take: (item: T) => void): Promise<void>;
  close(): void;
};

const createQueue = (): Queue<any> => {
  type Taker = (item: any) => void;
  type Giver = (take: Taker) => void;
  type Rejector = (err: Error) => void;

  const producers: { give: Giver; reject: Rejector }[] = [];
  const consumers: Taker[] = [];
  let closed = false;

  return {
    pushBack: (item) => {
      return new Promise((resolve, reject) => {
        const give = (take: Taker) => {
          take(item);
          resolve();
        };

        if (consumers.length) {
          give(consumers.shift()!);
        } else {
          producers.push({ give, reject });
        }
      });
    },
    popFront: (take: any) => {
      return new Promise((resolve) => {
        const taker = (item: any) => {
          take(item);
          resolve();
        };

        if (producers.length) {
          producers.shift()!.give(taker);
        } else {
          consumers.push(taker);
        }
      });
    },
    close: () => {
      closed = true;

      while (producers.length) {
        producers.shift()!.reject(new Error("queue closed"));
      }

      while (consumers.length) {
        consumers.shift()!(null);
      }
    },
  };
};

// (async () => {
//   const queue = createQueue();
//   queue.pushBack("hello");
//   queue.pushBack("world");

//   await queue.popFront(console.log);
//   await queue.popFront(console.log);
// })();
