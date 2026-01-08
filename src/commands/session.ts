import { getDb, saveDb, Session, rowToSession } from "../db/database";
import { formatDuration } from "../utils/time";
import chalk from "chalk";

const getActiveSession = async (): Promise<Session | undefined> => {
  const db = await getDb();
  const result = db.exec(
    "SELECT * FROM sessions WHERE status IN ('running', 'paused') ORDER BY id DESC LIMIT 1"
  );
  
  return result.length > 0 && result[0].values.length > 0
    ? rowToSession(result[0].columns, result[0].values[0])
    : undefined;
};

const calculateElapsedTime = (session: Session, endTime: Date): number => {
  const startTime = new Date(session.start_time);
  let totalSeconds = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);

  if (session.paused_seconds) {
    totalSeconds -= session.paused_seconds;
  }

  if (session.status === "paused" && session.pause_time) {
    const pauseStart = new Date(session.pause_time);
    const pauseDuration = Math.floor((endTime.getTime() - pauseStart.getTime()) / 1000);
    totalSeconds -= pauseDuration;
  }

  return totalSeconds;
};

const formatTime = (date: Date): string => {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const displaySessionInfo = (session: Session, includeProject: boolean = true): void => {
  if (includeProject && session.project) {
    console.log(chalk.gray(`  Project: ${session.project}`));
  }
  if (session.tag) {
    console.log(chalk.gray(`  Tag: ${session.tag}`));
  }
  if (session.note) {
    console.log(chalk.gray(`  Note: ${session.note}`));
  }
};

export const startSession = async (
  project?: string,
  tag?: string,
  note?: string
): Promise<void> => {
  const existingSession = await getActiveSession();

  if (existingSession) {
    const startTime = formatTime(new Date(existingSession.start_time));
    console.log(
      chalk.yellow(
        `⚠️  A session is already ${existingSession.status} (started at ${startTime}).`
      )
    );
    console.log(chalk.yellow(`   Use 'tally stop' first or 'tally status' to check.`));
    process.exit(1);
  }

  const db = await getDb();
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
  console.log(chalk.gray(`  Started at: ${formatTime(new Date(now))}`));
};

export const stopSession = async (additionalNote?: string): Promise<void> => {
  const session = await getActiveSession();

  if (!session) {
    console.log(chalk.yellow("⚠️  No active session to stop."));
    process.exit(1);
  }

  const db = await getDb();
  const now = new Date();
  const totalSeconds = calculateElapsedTime(session, now);

  const finalNote = additionalNote
    ? session.note
      ? `${session.note} | ${additionalNote}`
      : additionalNote
    : session.note;

  if (session.id !== undefined) {
    db.run(
      "UPDATE sessions SET end_time = ?, status = 'completed', total_seconds = ?, note = ? WHERE id = ?",
      [now.toISOString(), totalSeconds, finalNote || null, session.id]
    );

    saveDb();

    console.log(chalk.green("✓ Session stopped!"));
    if (session.project) console.log(chalk.gray(`  Project: ${session.project}`));
    console.log(chalk.gray(`  Duration: ${formatDuration(totalSeconds)}`));
    console.log(chalk.gray(`  Ended at: ${formatTime(now)}`));
  }
};

export const pauseSession = async (): Promise<void> => {
  const db = await getDb();
  const result = db.exec("SELECT * FROM sessions WHERE status = 'running' ORDER BY id DESC LIMIT 1");
  
  const session = result.length > 0 && result[0].values.length > 0
    ? rowToSession(result[0].columns, result[0].values[0])
    : undefined;

  if (!session) {
    console.log(chalk.yellow("⚠️  No running session to pause."));
    process.exit(1);
  }

  const now = new Date();

  if (session.id !== undefined) {
    db.run(
      "UPDATE sessions SET status = 'paused', pause_time = ? WHERE id = ?",
      [now.toISOString(), session.id]
    );
    saveDb();

    const elapsed = calculateElapsedTime(session, now);

    console.log(chalk.green("⏸  Session paused"));
    if (session.project) console.log(chalk.gray(`  Project: ${session.project}`));
    console.log(chalk.gray(`  Elapsed: ${formatDuration(elapsed)}`));
    console.log(chalk.gray(`  Use 'tally resume' to continue`));
  }
};

export const resumeSession = async (): Promise<void> => {
  const db = await getDb();
  const result = db.exec("SELECT * FROM sessions WHERE status = 'paused' ORDER BY id DESC LIMIT 1");
  
  const session = result.length > 0 && result[0].values.length > 0
    ? rowToSession(result[0].columns, result[0].values[0])
    : undefined;

  if (!session) {
    console.log(chalk.yellow("⚠️  No paused session to resume."));
    process.exit(1);
  }

  const now = new Date();
  const pauseStart = new Date(session.pause_time!);
  const pauseDuration = Math.floor((now.getTime() - pauseStart.getTime()) / 1000);
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
};