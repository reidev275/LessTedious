import { waitForDebugger } from "inspector";
import { Connection, Request, TYPES, TediousType } from "tedious";
import ConnectionPool from "./pool";

export interface Config {
  server: string;
  userName: string;
  password: string;
  options?: {
    database?: string;
    encrypt?: boolean;
    instanceName?: string;
    requestTimeout?: number;
    [key: string]: any;
  };
}

const getType = (x: any): TediousType => {
  if (x && typeof x == "string" && x.length && x.length > 1000) {
    return TYPES.Text;
  }
  switch (typeof x) {
    case "number":
      return x % 1 === 0 ? TYPES.Int : TYPES.Float;
    case "boolean":
      return TYPES.Bit;
    case "string":
      return TYPES.NVarChar;
    default:
      return TYPES.NVarChar;
  }
};

export const toNewConfig = (config: Config) => ({
  server: config.server,
  options: config.options,
  authentication: {
    type: "default",
    options: {
      userName: config.userName,
      password: config.password,
    },
  },
});

export interface Query<A> {
  sql: string;
  params?: any;
}

export const connect = (config: Config): Promise<Connection> =>
  new Promise((res, rej) => {
    let connection = new Connection(toNewConfig(config));
    connection.connect((err: any) => {
      if (err) {
        rej(err);
      }
    });
    connection
      .on("connect", (err: any) => {
        if (err) {
          rej(err);
        }
        res(connection);
      })
      .on("error", rej)
      .on("errorMessage", rej);
  });

const reset = (connection: Connection): Promise<void> =>
  new Promise((res, rej) =>
    connection.reset((err) => {
      if (err) {
        rej(err);
      } else {
        res(undefined);
      }
    })
  );

export const connectPersistent = async (
  config: Config
): Promise<Connection> => {
  let connection = await connect(config);

  //@ts-ignore
  connection.available = true;

  connection.on("end", async () => {
    //@ts-ignore
    connection.available = false;

    let success = false;
    while (!success) {
      try {
        await reset(connection);
        success = true;
        //@ts-ignore
        connection.available = true;
      } catch {}
    }
  });

  return connection;
};

export const executePool = <A>(
  connection: Connection,
  query: Query<A>
): Promise<A[]> =>
  new Promise((res, rej) => {
    const rows: A[] = [];
    let columns: string[] = [];
    const request = new Request(query.sql, (err: any, count: number) => {
      if (err) {
        rej(err);
      } else {
        res(rows);
      }
    });

    request.on("row", (row) => {
      const obj = row.reduce(
        (p: any, c: any, i: number) => ({
          ...p,
          [columns[i]]: c.value,
        }),
        {}
      );
      rows.push(obj);
    });
    request.on("columnMetadata", (meta: any[]) => {
      columns = meta.map((x) => x.colName);
    });
    request.on("error", rej);

    if (query.params) {
      Object.keys(query.params).forEach((x) => {
        const val = query.params[x];
        request.addParameter(x, getType(val), val);
      });
    }

    connection.execSql(request);

    //@ts-ignore
    // if (connection.available) {
    //   connection.execSql(request);
    // } else {
    //   rej("connection unavailable");
    // }
  });

export const execute = async <A>(
  pool: ConnectionPool,
  query: Query<A>
): Promise<A[]> => {
  const connection = await pool.getConnection();
  const result = await executePool(connection, query);
  pool.releaseConnection(connection);
  return result;
};

export const executeBulk = async (
  config: Config,
  queries: Query<any>[]
): Promise<void> => {
  const connection = await connect(config);
  for (const query of queries) {
    await executePool(connection, query);
  }
  connection.close();
};

export const createPool = (config: Config, poolSize: number) =>
  new ConnectionPool(config, poolSize);
