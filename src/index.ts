import {
  Connection,
  ConnectionConfig,
  Request,
  TYPES,
  TediousType,
} from "tedious";
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

const toNewConfig = (config: Config): ConnectionConfig => ({
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

type ConnectionCycle = { connection: Connection; release: () => any };

const executeInternal = <A>(
  cycle: ConnectionCycle,
  query: Query<A>
): Promise<A[]> =>
  new Promise(async (res, rej) => {
    const rows: A[] = [];
    let columns: string[] = [];

    const { connection, release } = cycle;
    connection.connect((err: any) => {
      if (err) {
        rej(err);
      }
    });
    connection
      .on("connect", (err: any) => {
        if (err) {
          rej(err);
        } else {
          const request = new Request(query.sql, (err: any, count: number) => {
            if (err) {
              rej(err);
            } else {
              res(rows);
            }
            release();
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
        }
      })
      .on("error", rej)
      .on("errorMessage", rej);
  });

export const execute = <A>(config: Config, query: Query<A>): Promise<A[]> => {
  const connection = new Connection(toNewConfig(config));
  return executeInternal(
    { connection, release: () => connection.close() },
    query
  );
};
export const executePool = async <A>(
  pool: ConnectionPool,
  query: Query<A>
): Promise<A[]> => {
  const connection = await pool.getConnection();

  return executeInternal(
    { connection, release: () => pool.releaseConnection(connection) },
    query
  );
};

export const createPool = async (config: Config, poolSize: number) => {
  const pool = new ConnectionPool(toNewConfig(config), poolSize);
  await pool.initialize();
  return pool;
};

export const executeBulk = async (
  config: Config,
  queries: Query<any>[]
): Promise<void> => {
  const pool = await createPool(config, 1);
  for (const query of queries) {
    await executePool(pool, query);
  }
};
