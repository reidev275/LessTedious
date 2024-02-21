import { Connection, ConnectionConfig } from "tedious";

class ConnectionPool {
  private connections: Connection[] = [];
  private config: ConnectionConfig;
  private poolSize: number;

  constructor(config: ConnectionConfig, poolSize: number) {
    this.config = config;
    this.poolSize = poolSize;
  }

  async initialize() {
    for (let i = 0; i < this.poolSize; i++) {
      const connection = new Connection(this.config);
      await this.connect(connection);
      this.connections.push(connection);
    }
  }

  private async connect(connection: Connection) {
    return new Promise<void>((res, rej) => {
      connection.on("connect", (err) => (err ? rej(err) : res()));
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
