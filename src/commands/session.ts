import { getDb, saveDb, Session } from "../db/database";
import { formatDuration } from "../utils/time";
import chalk from "chalk";

export async function startSession(project?: string, tag?: string, note?: string): Promise<void> {
  const db = await getDb();

  // Check for existing running or paused session
  const result = db.exec("SELECT * FROM sessions WHERE status IN ('running', 'paused') ORDER BY id DESC LIMIT 1");
  const existingSession = result.length > 0 && result[0].values.length > 0 
    ? rowToSession(result[0].columns, result[0].values[0]) 
    : undefined;

  if (existingSession) {
    const startTime = new Date(existingSession.start_time).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    console.log(
      chalk.yellow(
        `⚠️  A session is already ${existingSession.status} (started at ${startTime}).`
      )
    );
    console.log(chalk.yellow(`   Use 'tally stop' first or 'tally status' to check.`));
    process.exit(1);
  }

  // Create new session
  const now = new Date().toISOString();
  db.run(
    "INSERT INTO sessions (start_time, project, tag, note, status) VALUES (?, ?, ?, ?, 'running')",
    [now, project || null, tag || null, note || null]
  );
  
  saveDb();

  console.log(chalk.green("✓ Session started!"));
  if (project) console.log(chalk.gray(`  Project: ${project}`));
  if (tag) console.log(chalk.gray(`  Tag: ${tag}`));
  if (note) console.log(chalk.gray(`  Note: ${note}`));
  console.log(chalk.gray(`  Started at: ${new Date(now).toLocaleTimeString()}`));
}

export async function stopSession(additionalNote?: string): Promise<void> {
  const db = await getDb();

  const result = db.exec("SELECT * FROM sessions WHERE status IN ('running', 'paused') ORDER BY id DESC LIMIT 1");
  const session = result.length > 0 && result[0].values.length > 0 
    ? rowToSession(result[0].columns, result[0].values[0]) 
    : undefined;

  if (!session) {
    console.log(chalk.yellow("⚠️  No active session to stop."));
    process.exit(1);
  }

  const now = new Date().toISOString();
  const startTime = new Date(session.start_time);
  const endTime = new Date(now);

  let totalSeconds = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);

  // Subtract paused time if any
  if (session.paused_seconds) {
    totalSeconds -= session.paused_seconds;
  }

  // Add any additional pause time if currently paused
  if (session.status === "paused" && session.pause_time) {
    const pauseStart = new Date(session.pause_time);
    const pauseDuration = Math.floor((endTime.getTime() - pauseStart.getTime()) / 1000);
    totalSeconds -= pauseDuration;
  }

  const finalNote = additionalNote
    ? session.note
      ? `${session.note} | ${additionalNote}`
      : additionalNote
    : session.note;

  if (session.id !== undefined) {
    db.run(
      "UPDATE sessions SET end_time = ?, status = 'completed', total_seconds = ?, note = ? WHERE id = ?",
      [now, totalSeconds, finalNote || null, session.id]
    );
    
    saveDb();

    console.log(chalk.green("✓ Session stopped!"));
    if (session.project) console.log(chalk.gray(`  Project: ${session.project}`));
    console.log(chalk.gray(`  Duration: ${formatDuration(totalSeconds)}`));
    console.log(chalk.gray(`  Ended at: ${endTime.toLocaleTimeString()}`));
  }
}

export async function pauseSession(): Promise<void> {
  const db = await getDb();

  const result = db.exec("SELECT * FROM sessions WHERE status = 'running' ORDER BY id DESC LIMIT 1");
  const session = result.length > 0 && result[0].values.length > 0 
    ? rowToSession(result[0].columns, result[0].values[0]) 
    : undefined;

  if (!session) {
    console.log(chalk.yellow("⚠️  No running session to pause."));
    process.exit(1);
  }

  const now = new Date().toISOString();
  
  if (session.id !== undefined) {
    db.run("UPDATE sessions SET status = 'paused', pause_time = ? WHERE id = ?", [now, session.id]);
    saveDb();

    const startTime = new Date(session.start_time);
    const pauseTime = new Date(now);
    const elapsed = Math.floor((pauseTime.getTime() - startTime.getTime()) / 1000);

    console.log(chalk.green("⏸  Session paused"));
    if (session.project) console.log(chalk.gray(`  Project: ${session.project}`));
    console.log(chalk.gray(`  Elapsed: ${formatDuration(elapsed)}`));
    console.log(chalk.gray(`  Use 'tally resume' to continue`));
  }
}

export async function resumeSession(): Promise<void> {
  const db = await getDb();

  const result = db.exec("SELECT * FROM sessions WHERE status = 'paused' ORDER BY id DESC LIMIT 1");
  const session = result.length > 0 && result[0].values.length > 0 
    ? rowToSession(result[0].columns, result[0].values[0]) 
    : undefined;

  if (!session) {
    console.log(chalk.yellow("⚠️  No paused session to resume."));
    process.exit(1);
  }

  const now = new Date().toISOString();
  const pauseStart = new Date(session.pause_time!);
  const resumeTime = new Date(now);
  const pauseDuration = Math.floor((resumeTime.getTime() - pauseStart.getTime()) / 1000);

  const totalPausedSeconds = (session.paused_seconds || 0) + pauseDuration;

  if (session.id !== undefined) {
    db.run(
      "UPDATE sessions SET status = 'running', pause_time = NULL, paused_seconds = ? WHERE id = ?",
      [totalPausedSeconds, session.id]
    );
    saveDb();

    console.log(chalk.green("▶  Session resumed"));
    if (session.project) console.log(chalk.gray(`  Project: ${session.project}`));
    console.log(chalk.gray(`  Paused for: ${formatDuration(pauseDuration)}`));
  }
}

function rowToSession(columns: string[], values: any[]): Session {
  const session: any = {};
  columns.forEach((col, idx) => {
    session[col] = values[idx];
  });
  return session as Session;
}