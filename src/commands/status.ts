import { getDb, Session, rowToSession } from "../db/database";
import { formatDuration } from "../utils/time";
import chalk from "chalk";

const formatTime = (date: Date): string => {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const calculateElapsedTime = (session: Session, now: Date): number => {
  const startTime = new Date(session.start_time);
  let elapsed = Math.floor((now.getTime() - startTime.getTime()) / 1000);

  if (session.paused_seconds) {
    elapsed -= session.paused_seconds;
  }

  if (session.status === "paused" && session.pause_time) {
    const pauseStart = new Date(session.pause_time);
    const pauseDuration = Math.floor((now.getTime() - pauseStart.getTime()) / 1000);
    elapsed -= pauseDuration;
  }

  return elapsed;
};

const getActiveSession = async (): Promise<Session | undefined> => {
  const db = await getDb();
  const result = db.exec(
    "SELECT * FROM sessions WHERE status IN ('running', 'paused') ORDER BY id DESC LIMIT 1"
  );
  
  return result.length > 0 && result[0].values.length > 0
    ? rowToSession(result[0].columns, result[0].values[0])
    : undefined;
};

const getTodaySessions = async (): Promise<Session[]> => {
  const db = await getDb();
  const today = new Date().toISOString().split("T")[0];
  const result = db.exec(
    "SELECT * FROM sessions WHERE date(start_time) = ? AND status = 'completed'",
    [today]
  );
  
  return result.length > 0 && result[0].values
    ? result[0].values.map((row: any) => rowToSession(result[0].columns, row))
    : [];
};

const displaySessionDetails = (session: Session): void => {
  if (session.project) {
    console.log(chalk.gray(`   Project: ${session.project}`));
  }
  if (session.tag) {
    console.log(chalk.gray(`   Tag: ${session.tag}`));
  }
  if (session.note) {
    console.log(chalk.gray(`   Note: ${session.note}`));
  }
};

const showStaticStatus = (session: Session, todayTotal: number): void => {
  const now = new Date();
  const startTime = new Date(session.start_time);
  const elapsed = calculateElapsedTime(session, now);

  const statusIcon = session.status === "running" ? "▶" : "⏸";
  const statusColor = session.status === "running" ? chalk.green : chalk.yellow;
  const statusText = session.status.charAt(0).toUpperCase() + session.status.slice(1);

  console.log(
    statusColor(
      `${statusIcon}  ${statusText}: ${formatDuration(elapsed)} (started at ${formatTime(startTime)})`
    )
  );

  displaySessionDetails(session);
  console.log(chalk.cyan(`   Today: ${formatDuration(todayTotal + elapsed)} total`));
};

const showLiveStatus = (session: Session, todayTotal: number): void => {
  const startTime = new Date(session.start_time);

  console.log(chalk.gray("Press Ctrl+C to exit\n"));

  const updateInterval = setInterval(() => {
    const now = new Date();
    const elapsed = calculateElapsedTime(session, now);

    process.stdout.write("\x1B[2J\x1B[0f");

    console.log(
      chalk.green(
        `▶  Running: ${formatDuration(elapsed)} (started at ${formatTime(startTime)})`
      )
    );

    displaySessionDetails(session);
    console.log(chalk.cyan(`   Today: ${formatDuration(todayTotal + elapsed)} total`));
    console.log(chalk.gray("\nPress Ctrl+C to exit"));
  }, 1000);

  process.on("SIGINT", () => {
    clearInterval(updateInterval);
    console.log(chalk.gray("\n\nStopped live view"));
    process.exit(0);
  });
};

export const showStatus = async (live: boolean = false): Promise<void> => {
  const activeSession = await getActiveSession();
  const todaySessions = await getTodaySessions();
  const todayTotal = todaySessions.reduce((sum, s) => sum + (s.total_seconds || 0), 0);

  if (!activeSession && todaySessions.length === 0) {
    console.log(chalk.gray("No sessions today. Use 'tally start' to begin tracking."));
    return;
  }

  const isInteractive = process.stdout.isTTY && live;

  if (activeSession) {
    if (isInteractive && activeSession.status === "running") {
      showLiveStatus(activeSession, todayTotal);
    } else {
      showStaticStatus(activeSession, todayTotal);
    }
  } else {
    console.log(chalk.gray("No active session"));
    console.log(
      chalk.cyan(`Today: ${formatDuration(todayTotal)} across ${todaySessions.length} session(s)`)
    );
  }
};