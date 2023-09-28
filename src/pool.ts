import { toNewConfig, Config } from "./index";
import { Connection } from "tedious";

class ConnectionPool {
  private connections: Connection[] = [];
  private config: Config;
  private poolSize: number;

  constructor(config: Config, poolSize: number) {
    this.config = config;
    this.poolSize = poolSize;
  }

  async initialize() {
    for (let i = 0; i < this.poolSize; i++) {
      const connection = new Connection(toNewConfig(this.config));
      await this.connect(connection);
      this.connections.push(connection);
    }
  }

  private async connect(connection: Connection) {
    return new Promise<void>((resolve, reject) => {
      connection.on("connect", (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
      connection.connect();
    });
  }

  async getConnection(): Promise<Connection> {
    if (this.connections.length === 0) {
      throw new Error("Connection pool exhausted");
    }
    return this.connections.pop()!;
  }

  releaseConnection(connection: Connection) {
    this.connections.push(connection);
  }

  async close() {
    await Promise.all(this.connections.map((connection) => connection.close()));
  }
}

export default ConnectionPool;
