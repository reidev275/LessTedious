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

const executeCommand = (
  query: Query<any>,
  connection: Connection
): Promise<void> =>
  new Promise((res, rej) => {
    const request = new Request(query.sql, (err: any, count: number) => {
      if (err) {
        rej(err);
      } else {
        res();
      }
    });

    if (query.params) {
      Object.keys(query.params).forEach((x) => {
        const val = query.params[x];
        request.addParameter(x, getType(val), val);
      });
    }
    connection.execSql(request);
  });

export const executeBulk = (
  config: Config,
  queries: Query<any>[]
): Promise<void> =>
  new Promise((res, rej) => {
    try {
      const connection = new Connection(toNewConfig(config));
      connection.connect((err: any) => {
        if (err) {
          rej(err);
        }
      });
      connection
        .on("connect", async (err: any) => {
          if (err) {
            rej(err);
          } else {
            for (const query of queries) {
              await executeCommand(query, connection);
            }
            res();
            connection.close();
          }
        })
        .on("error", rej)
        .on("errorMessage", rej);
    } catch (e) {
      rej(e);
    }
  });

export const execute = <A>(config: Config, query: Query<A>): Promise<A[]> =>
  new Promise((res, rej) => {
    const rows: A[] = [];
    let columns: string[] = [];
    const connection = new Connection(toNewConfig(config));
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
            connection.close();
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

export const executePool = <A>(
  config: Config,
  pool: ConnectionPool,
  query: Query<A>
): Promise<A[]> =>
  new Promise(async (res, rej) => {
    const rows: A[] = [];
    let columns: string[] = [];

    const connection = await pool.getConnection();
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
            pool.releaseConnection(connection);
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

export const createPool = (config: Config, poolSize) =>
  new ConnectionPool(config, poolSize);
