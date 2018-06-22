import {
  Connection,
  Request,
  TYPES,
  TediousType,
  ConnectionConfig as Config
} from "tedious";

export { ConnectionConfig as Config } from "tedious";

const getType = (x: any): TediousType => {
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

export const execute = <A>(config: Config, query: Query<A>): Promise<A[]> =>
  new Promise((res, rej) => {
    const rows: A[] = [];
    let columns: string[] = [];
    const connection = new Connection(config);
    connection.on("connect", (err: any) => {
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
          .on("row", row => {
            const obj = row.reduce(
              (p: any, c: any, i: number) => ({
                ...p,
                [columns[i]]: c.value
              }),
              {}
            );
            rows.push(obj);
          })
          .on("columnMetadata", (meta: any[]) => {
            columns = meta.map(x => x.colName);
          });

        if (query.params) {
          Object.keys(query.params).forEach(x => {
            const val = query.params[x];
            request.addParameter(x, getType(val), val);
          });
        }
        connection.execSql(request);
      }
    });
  });
