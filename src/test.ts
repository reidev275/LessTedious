import { Config, connectPersistent, executePool, Query } from "./index";

//@ts-ignore sample config
const config: Config = {};

const wait = (ms) =>
  new Promise((res, rej) => setTimeout(() => res(undefined), ms));

const test = async () => {
  const connection = await connectPersistent(config);

  const query: Query<any> = {
    sql: "select top 1 * from history",
  };

  for (let i = 0; i < 100; i++) {
    await wait(10);
    console.log(i);
    console.time("executePool");
    await executePool(connection, query).catch(() => console.log("failed", i));
    console.timeEnd("executePool");

    if (i === 50) {
      connection.emit("end");
    }
  }
};

test();
