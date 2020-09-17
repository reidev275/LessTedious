import { Connection, Request, TYPES, TediousType } from "tedious";

export interface Config {
  server: string;
  userName: string;
  password: string;
  options?: {
    database?: string;
    encrypt?: boolean;
    instanceName?: string;
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
    const connection = new Connection(config);
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
  });

export const execute = <A>(config: Config, query: Query<A>): Promise<A[]> =>
  new Promise((res, rej) => {
    const rows: A[] = [];
    let columns: string[] = [];
    const connection = new Connection(config);
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
          })
            .on("row", (row) => {
              const obj = row.reduce(
                (p: any, c: any, i: number) => ({
                  ...p,
                  [columns[i]]: c.value,
                }),
                {}
              );
              rows.push(obj);
            })
            .on("columnMetadata", (meta: any[]) => {
              columns = meta.map((x) => x.colName);
            });

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
