import initSqlJs, { Database as SqlJsDatabase } from "sql.js";
import { join } from "path";
import { mkdirSync, existsSync, readFileSync, writeFileSync } from "fs";
import { homedir } from "os";

export interface Session {
  id?: number;
  start_time: string;
  end_time?: string | null;
  pause_time?: string | null;
  total_seconds?: number | null;
  paused_seconds?: number | null;
  project?: string | null;
  tag?: string | null;
  note?: string | null;
  status: "running" | "paused" | "completed";
}

class DatabaseManager {
  private static instance: DatabaseManager | null = null;
  private db: SqlJsDatabase | null = null;
  private SQL: any = null;
  private dbPath: string | null = null;

  private constructor() {}

  static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  private getDataPath(): string {
    const platform = process.platform;
    let dataPath: string;

    if (platform === "win32") {
      dataPath = join(process.env.LOCALAPPDATA || join(homedir(), "AppData", "Local"), "tally");
    } else if (platform === "darwin") {
      dataPath = join(homedir(), "Library", "Application Support", "tally");
    } else {
      dataPath = join(process.env.XDG_DATA_HOME || join(homedir(), ".local", "share"), "tally");
    }

    if (!existsSync(dataPath)) {
      mkdirSync(dataPath, { recursive: true });
    }

    return join(dataPath, "tally.db");
  }

  private initializeSchema(db: SqlJsDatabase): void {
    db.run(`
      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        start_time TEXT NOT NULL,
        end_time TEXT,
        pause_time TEXT,
        total_seconds INTEGER DEFAULT 0,
        paused_seconds INTEGER DEFAULT 0,
        project TEXT,
        tag TEXT,
        note TEXT,
        status TEXT NOT NULL CHECK(status IN ('running', 'paused', 'completed'))
      )
    `);

    db.run("CREATE INDEX IF NOT EXISTS idx_start_time ON sessions(start_time)");
    db.run("CREATE INDEX IF NOT EXISTS idx_status ON sessions(status)");
    db.run("CREATE INDEX IF NOT EXISTS idx_project ON sessions(project)");

    this.save();
  }

  async getDatabase(): Promise<SqlJsDatabase> {
    if (!this.db) {
      if (!this.SQL) {
        this.SQL = await initSqlJs();
      }

      this.dbPath = this.getDataPath();

      let database: SqlJsDatabase;
      if (existsSync(this.dbPath)) {
        const buffer = readFileSync(this.dbPath);
        database = new this.SQL.Database(buffer);
      } else {
        database = new this.SQL.Database();
      }

      this.db = database;
      this.initializeSchema(database);
    }
    return this.db;
  }

  save(): void {
    if (this.db && this.dbPath) {
      const data = this.db.export();
      writeFileSync(this.dbPath, data);
    }
  }

  close(): void {
    if (this.db) {
      this.save();
      this.db.close();
      this.db = null;
    }
  }

  // For testing: reset the singleton instance
  static resetInstance(): void {
    if (DatabaseManager.instance) {
      DatabaseManager.instance.close();
      DatabaseManager.instance = null;
    }
  }
}

// Utility functions
export const rowToSession = (columns: string[], values: any[]): Session => {
  const session: any = {};
  columns.forEach((col, idx) => {
    session[col] = values[idx];
  });
  return session as Session;
};

// Public API
export const getDb = async (): Promise<SqlJsDatabase> => {
  return DatabaseManager.getInstance().getDatabase();
};

export const saveDb = (): void => {
  DatabaseManager.getInstance().save();
};

export const closeDb = (): void => {
  DatabaseManager.getInstance().close();
};

// Test utility - resets the singleton for test isolation
export const resetDbForTesting = (): void => {
  DatabaseManager.resetInstance();
};