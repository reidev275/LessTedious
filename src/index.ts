import { Connection, Request, TYPES, TediousType } from "tedious";

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

const toNewConfig = (config: Config) => ({
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
        }
        res(connection);
      })
      .on("error", rej)
      .on("errorMessage", rej);
  });

export const executePool =
  (connection: Connection) =>
  <A>(query: Query<A>): Promise<A[]> =>
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
    });

export const execute = async <A>(
  config: Config,
  query: Query<A>
): Promise<A[]> => {
  const connection = await connect(config);
  const execSql = executePool(connection);
  const result = await execSql(query);
  connection.close();
  return result;
};

export const executeBulk = async (
  config: Config,
  queries: Query<any>[]
): Promise<void> => {
  const connection = await connect(config);
  const execSql = executePool(connection);
  for (const query of queries) {
    await execSql(query);
  }
  connection.close();
};
