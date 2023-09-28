import {
  Config,
  connectPersistent,
  executePool,
  Query,
  execute,
} from "./index";
import ConnectionPool from "./pool";

//@ts-ignore sample config
const config: Config = {
  password: "pH378B7x!&JRek",
  server: "siteprostg.database.windows.net",
  userName: "siteprostg-admin",
  options: {
    database: "trackunit",
    encrypt: true,
  },
};

const wait = (ms) =>
  new Promise((res, rej) => setTimeout(() => res(undefined), ms));

const test = async () => {
  const poolSize = 10;
  const pool = new ConnectionPool(config, poolSize);

  await pool.initialize();

  const query: Query<any> = {
    sql: "select top 1 * from history",
  };

  const history = await execute(pool, query);

  console.log(history);

  // for (let i = 0; i < 100; i++) {
  //   await wait(10);
  //   console.log(i);
  //   console.time("executePool");
  //   await executePool(connection, query).catch(() => console.log("failed", i));
  //   console.timeEnd("executePool");

  //   if (i === 50) {
  //     connection.emit("end");
  //   }
  // }
};

test();
