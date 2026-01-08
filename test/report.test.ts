import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { generateReport } from '../src/commands/report';
import { getDb, resetDbForTesting } from '../src/db/database';
import { unlinkSync, existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

describe('Report Command', () => {
  let testDbPath: string;
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

    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const db = await getDb();
    const today = new Date().toISOString().split('T')[0];
    
    db.run(
      "INSERT INTO sessions (start_time, end_time, total_seconds, project, status) VALUES (?, ?, ?, ?, 'completed')",
      [`${today}T10:00:00`, `${today}T11:30:00`, 5400, 'Project A']
    );
    db.run(
      "INSERT INTO sessions (start_time, end_time, total_seconds, project, status) VALUES (?, ?, ?, ?, 'completed')",
      [`${today}T14:00:00`, `${today}T16:00:00`, 7200, 'Project B']
    );
  });

  afterEach(async () => {
    consoleLogSpy.mockRestore();
    resetDbForTesting();

    if (existsSync(testDbPath)) {
      try {
        unlinkSync(testDbPath);
      } catch (error) {
        // Ignore cleanup errors
      }
    }

    const files = readdirSync('.');
    files.forEach(file => {
      if (file.startsWith('tally-report-')) {
        try {
          unlinkSync(file);
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    });
  });

  describe('generateReport', () => {
    it('should generate report for today', async () => {
      await generateReport('today', false);

      expect(consoleLogSpy).toHaveBeenCalled();
      const calls = consoleLogSpy.mock.calls.map((call: any) => call[0]).join('\n');
      expect(calls).toContain('Report for Today');
      expect(calls).toContain('Project A');
      expect(calls).toContain('Project B');
    });

    it('should generate detailed report', async () => {
      await generateReport('today', true);

      const calls = consoleLogSpy.mock.calls.map((call: any) => call[0]).join('\n');
      expect(calls).toContain('Session 1:');
      expect(calls).toContain('Session 2:');
      expect(calls).toContain('Duration:');
    });

    it('should handle no sessions found', async () => {
      await generateReport('yesterday', false);

      const calls = consoleLogSpy.mock.calls.map((call: any) => call[0]).join('\n');
      expect(calls).toContain('No sessions found');
    });

    it('should export to JSON', async () => {
      await generateReport('today', false, 'json');

      const files = readdirSync('.');
      const reportFile = files.find(f => f.startsWith('tally-report-') && f.endsWith('.json'));
      
      expect(reportFile).toBeDefined();
      
      if (reportFile) {
        const content = readFileSync(reportFile, 'utf-8');
        const data = JSON.parse(content);
        
        expect(data.period).toBe('Today');
        expect(data.sessions).toHaveLength(2);
        expect(data.totalSeconds).toBe(12600);
      }
    });

    it('should export to CSV', async () => {
      await generateReport('today', false, 'csv');

      const files = readdirSync('.');
      const reportFile = files.find(f => f.startsWith('tally-report-') && f.endsWith('.csv'));
      
      expect(reportFile).toBeDefined();
      
      if (reportFile) {
        const content = readFileSync(reportFile, 'utf-8');
        
        expect(content).toContain('Start,End,Duration,Project,Tag,Note');
        expect(content).toContain('Project A');
        expect(content).toContain('Project B');
      }
    });

    it('should calculate correct total time', async () => {
      await generateReport('today', false);

      const calls = consoleLogSpy.mock.calls.map((call: any) => call[0]).join('\n');
      expect(calls).toContain('3.50 hours');
    });
  });

  describe('Date range handling', () => {
    it('should handle specific date format', async () => {
      const today = new Date().toISOString().split('T')[0];
      await generateReport(today, false);

      const calls = consoleLogSpy.mock.calls.map((call: any) => call[0]).join('\n');
      expect(calls).toContain('Report for');
    });

    it('should handle week period', async () => {
      await generateReport('week', false);

      const calls = consoleLogSpy.mock.calls.map((call: any) => call[0]).join('\n');
      expect(calls).toContain('This Week');
    });

    it('should handle month period', async () => {
      await generateReport('month', false);

      const calls = consoleLogSpy.mock.calls.map((call: any) => call[0]).join('\n');
      expect(calls).toMatch(/Report for \w+ \d{4}/);
    });
  });
});