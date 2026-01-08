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

let dbInstance: SqlJsDatabase | null = null;
let SQL: any = null;
let dbPath: string | null = null;

function getDataPath(): string {
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

export async function getDb(): Promise<SqlJsDatabase> {
  if (!dbInstance) {
    if (!SQL) {
      SQL = await initSqlJs();
    }
    
    dbPath = getDataPath();
    
    // Load existing database or create new one
    let db: SqlJsDatabase;
    if (existsSync(dbPath)) {
      const buffer = readFileSync(dbPath);
      db = new SQL.Database(buffer);
    } else {
      db = new SQL.Database();
    }
    
    dbInstance = db;
    initializeDatabase(db);
  }
  return dbInstance;
}

function initializeDatabase(db: SqlJsDatabase): void {
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
  
  saveDb();
}

export function saveDb(): void {
  if (dbInstance && dbPath) {
    const data = dbInstance.export();
    writeFileSync(dbPath, data);
  }
}

export function closeDb(): void {
  if (dbInstance) {
    saveDb();
    dbInstance.close();
    dbInstance = null;
  }
}