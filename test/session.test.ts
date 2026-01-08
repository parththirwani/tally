import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { startSession, stopSession, pauseSession, resumeSession } from '../src/commands/session';
import { getDb, saveDb, rowToSession, resetDbForTesting } from '../src/db/database';
import { unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

describe('Session Commands', () => {
  let testDbPath: string;
  let exitSpy: any;
  let consoleLogSpy: any;

  beforeEach(async () => {
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
    
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error('process.exit called');
    }) as any);

    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(async () => {
    exitSpy.mockRestore();
    consoleLogSpy.mockRestore();
    resetDbForTesting();

    if (existsSync(testDbPath)) {
      try {
        unlinkSync(testDbPath);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  describe('startSession', () => {
    it('should create a new session', async () => {
      await startSession('Test Project', 'test-tag', 'Test note');

      const db = await getDb();
      const result = db.exec("SELECT * FROM sessions WHERE status = 'running'");
      
      expect(result.length).toBeGreaterThan(0);
      const session = rowToSession(result[0].columns, result[0].values[0]);
      expect(session.project).toBe('Test Project');
      expect(session.tag).toBe('test-tag');
      expect(session.note).toBe('Test note');
      expect(session.status).toBe('running');
    });

    it('should create session without optional parameters', async () => {
      await startSession();

      const db = await getDb();
      const result = db.exec("SELECT * FROM sessions WHERE status = 'running'");
      
      expect(result.length).toBeGreaterThan(0);
      const session = rowToSession(result[0].columns, result[0].values[0]);
      expect(session.project).toBeNull();
      expect(session.tag).toBeNull();
      expect(session.note).toBeNull();
    });

    it('should prevent starting when session already running', async () => {
      await startSession('First Project');

      try {
        await startSession('Second Project');
        expect.fail('Should have thrown error');
      } catch (error: any) {
        expect(error.message).toBe('process.exit called');
      }
    });

    it('should prevent starting when session is paused', async () => {
      await startSession('Test Project');
      
      const db = await getDb();
      db.run("UPDATE sessions SET status = 'paused', pause_time = ? WHERE status = 'running'", [new Date().toISOString()]);
      saveDb();

      try {
        await startSession('Second Project');
        expect.fail('Should have thrown error');
      } catch (error: any) {
        expect(error.message).toBe('process.exit called');
      }
    });
  });

  describe('stopSession', () => {
    it('should stop a running session', async () => {
      await startSession('Test Project');
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      await stopSession();

      const db = await getDb();
      const result = db.exec("SELECT * FROM sessions WHERE status = 'completed'");
      
      expect(result.length).toBeGreaterThan(0);
      const session = rowToSession(result[0].columns, result[0].values[0]);
      expect(session.status).toBe('completed');
      expect(session.end_time).toBeDefined();
      expect(session.total_seconds).toBeGreaterThan(0);
    });

    it('should add additional note when stopping', async () => {
      await startSession('Test Project', undefined, 'Initial note');
      await stopSession('Final note');

      const db = await getDb();
      const result = db.exec("SELECT * FROM sessions WHERE status = 'completed'");
      const session = rowToSession(result[0].columns, result[0].values[0]);
      
      expect(session.note).toBe('Initial note | Final note');
    });

    it('should fail when no active session', async () => {
      try {
        await stopSession();
        expect.fail('Should have thrown error');
      } catch (error: any) {
        expect(error.message).toBe('process.exit called');
      }
    });
  });

  describe('pauseSession', () => {
    it('should pause a running session', async () => {
      await startSession('Test Project');
      await pauseSession();

      const db = await getDb();
      const result = db.exec("SELECT * FROM sessions WHERE status = 'paused'");
      
      expect(result.length).toBeGreaterThan(0);
      const session = rowToSession(result[0].columns, result[0].values[0]);
      expect(session.status).toBe('paused');
      expect(session.pause_time).toBeDefined();
    });

    it('should fail when no running session', async () => {
      try {
        await pauseSession();
        expect.fail('Should have thrown error');
      } catch (error: any) {
        expect(error.message).toBe('process.exit called');
      }
    });
  });

  describe('resumeSession', () => {
    it('should resume a paused session', async () => {
      await startSession('Test Project');
      await pauseSession();
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      await resumeSession();

      const db = await getDb();
      const result = db.exec("SELECT * FROM sessions WHERE status = 'running'");
      
      expect(result.length).toBeGreaterThan(0);
      const session = rowToSession(result[0].columns, result[0].values[0]);
      expect(session.status).toBe('running');
      expect(session.pause_time).toBeNull();
      expect(session.paused_seconds).toBeGreaterThan(0);
    });

    it('should fail when no paused session', async () => {
      try {
        await resumeSession();
        expect.fail('Should have thrown error');
      } catch (error: any) {
        expect(error.message).toBe('process.exit called');
      }
    });
  });
});