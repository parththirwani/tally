import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getDb, rowToSession, resetDbForTesting } from '../src/db/database';
import { unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

describe('Database', () => {
  let testDbPath: string;

  beforeEach(() => {
    resetDbForTesting();
    
    const platform = process.platform;
    let dataPath: string;

    if (platform === "win32") {
      dataPath = join(process.env.LOCALAPPDATA || join(homedir(), "AppData", "Local"), "tally");
    } else if (platform === "darwin") {
      dataPath = join(homedir(), "Library", "Application Support", "tally");
    } else {
      dataPath = join(process.env.XDG_DATA_HOME || join(homedir(), ".local", "share"), "tally");
    }

    testDbPath = join(dataPath, "tally.db");
    
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
  });

  afterEach(() => {
    resetDbForTesting();
    
    if (existsSync(testDbPath)) {
      try {
        unlinkSync(testDbPath);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  describe('getDb', () => {
    it('should create and return a database instance', async () => {
      const db = await getDb();
      expect(db).toBeDefined();
      expect(typeof db.exec).toBe('function');
    });

    it('should create sessions table', async () => {
      const db = await getDb();
      const result = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='sessions'");
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].values[0][0]).toBe('sessions');
    });

    it('should create indexes', async () => {
      const db = await getDb();
      const result = db.exec("SELECT name FROM sqlite_master WHERE type='index'");
      const indexNames = result[0].values.map(row => row[0]);
      expect(indexNames).toContain('idx_start_time');
      expect(indexNames).toContain('idx_status');
      expect(indexNames).toContain('idx_project');
    });
  });

  describe('rowToSession', () => {
    it('should convert database row to Session object', () => {
      const columns = ['id', 'start_time', 'status', 'project', 'total_seconds'];
      const values = [1, '2024-01-15T10:00:00', 'completed', 'Test Project', 3600];

      const session = rowToSession(columns, values);

      expect(session.id).toBe(1);
      expect(session.start_time).toBe('2024-01-15T10:00:00');
      expect(session.status).toBe('completed');
      expect(session.project).toBe('Test Project');
      expect(session.total_seconds).toBe(3600);
    });

    it('should handle null values', () => {
      const columns = ['id', 'start_time', 'end_time', 'project', 'status'];
      const values = [1, '2024-01-15T10:00:00', null, null, 'running'];

      const session = rowToSession(columns, values);

      expect(session.end_time).toBeNull();
      expect(session.project).toBeNull();
    });
  });

  describe('Database operations', () => {
    it('should insert and retrieve a session', async () => {
      const db = await getDb();
      const now = new Date().toISOString();

      db.run(
        "INSERT INTO sessions (start_time, project, status) VALUES (?, ?, ?)",
        [now, 'Test Project', 'running']
      );

      const result = db.exec("SELECT * FROM sessions WHERE project = 'Test Project'");
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].values.length).toBe(1);
    });

    it('should update a session', async () => {
      const db = await getDb();
      const now = new Date().toISOString();

      db.run(
        "INSERT INTO sessions (start_time, project, status) VALUES (?, ?, ?)",
        [now, 'Test Project', 'running']
      );

      db.run(
        "UPDATE sessions SET status = 'completed' WHERE project = 'Test Project'"
      );

      const result = db.exec("SELECT status FROM sessions WHERE project = 'Test Project'");
      const session = rowToSession(result[0].columns, result[0].values[0]);
      expect(session.status).toBe('completed');
    });

    it('should delete a session', async () => {
      const db = await getDb();
      const now = new Date().toISOString();

      db.run(
        "INSERT INTO sessions (start_time, project, status) VALUES (?, ?, ?)",
        [now, 'Test Project', 'running']
      );

      db.run("DELETE FROM sessions WHERE project = 'Test Project'");

      const result = db.exec("SELECT * FROM sessions WHERE project = 'Test Project'");
      expect(result.length === 0 || result[0].values.length === 0).toBe(true);
    });

    it('should enforce status constraint', async () => {
      const db = await getDb();
      const now = new Date().toISOString();

      expect(() => {
        db.run(
          "INSERT INTO sessions (start_time, status) VALUES (?, ?)",
          [now, 'invalid_status']
        );
      }).toThrow();
    });
  });
});