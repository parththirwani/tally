import { getDb, Session } from "../db/database";
import { formatDuration } from "../utils/time";
import chalk from "chalk";

export async function showStatus(live: boolean = false): Promise<void> {
  const db = await getDb();

  // Get current active session
  const activeResult = db.exec("SELECT * FROM sessions WHERE status IN ('running', 'paused') ORDER BY id DESC LIMIT 1");
  const activeSession = activeResult.length > 0 && activeResult[0].values.length > 0
    ? rowToSession(activeResult[0].columns, activeResult[0].values[0])
    : undefined;

  // Get today's completed sessions
  const today = new Date().toISOString().split("T")[0];
  const todayResult = db.exec(
    "SELECT * FROM sessions WHERE date(start_time) = ? AND status = 'completed'",
    [today]
  );
  const todaySessions = todayResult.length > 0 && todayResult[0].values
    ? todayResult[0].values.map((row: any) => rowToSession(todayResult[0].columns, row))
    : [];

  // Calculate today's total
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
    // Only completed sessions today
    console.log(chalk.gray("No active session"));
    console.log(chalk.cyan(`Today: ${formatDuration(todayTotal)} across ${todaySessions.length} session(s)`));
  }
}

function showStaticStatus(session: Session, todayTotal: number): void {
  const now = new Date();
  const startTime = new Date(session.start_time);
  let elapsed = Math.floor((now.getTime() - startTime.getTime()) / 1000);

  // Subtract paused time
  if (session.paused_seconds) {
    elapsed -= session.paused_seconds;
  }

  if (session.status === "paused" && session.pause_time) {
    const pauseStart = new Date(session.pause_time);
    const pauseDuration = Math.floor((now.getTime() - pauseStart.getTime()) / 1000);
    elapsed -= pauseDuration;
  }

  const statusIcon = session.status === "running" ? "▶" : "⏸";
  const statusColor = session.status === "running" ? chalk.green : chalk.yellow;

  console.log(
    statusColor(
      `${statusIcon}  ${session.status.charAt(0).toUpperCase() + session.status.slice(1)}: ${formatDuration(elapsed)} (started at ${startTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})`
    )
  );

  if (session.project) {
    console.log(chalk.gray(`   Project: ${session.project}`));
  }
  if (session.tag) {
    console.log(chalk.gray(`   Tag: ${session.tag}`));
  }
  if (session.note) {
    console.log(chalk.gray(`   Note: ${session.note}`));
  }

  console.log(chalk.cyan(`   Today: ${formatDuration(todayTotal + elapsed)} total`));
}

function showLiveStatus(session: Session, todayTotal: number): void {
  const startTime = new Date(session.start_time);

  console.log(chalk.gray("Press Ctrl+C to exit\n"));

  const updateInterval = setInterval(() => {
    const now = new Date();
    let elapsed = Math.floor((now.getTime() - startTime.getTime()) / 1000);

    if (session.paused_seconds) {
      elapsed -= session.paused_seconds;
    }

    process.stdout.write("\x1B[2J\x1B[0f"); // Clear screen

    console.log(
      chalk.green(
        `▶  Running: ${formatDuration(elapsed)} (started at ${startTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})`
      )
    );

    if (session.project) {
      console.log(chalk.gray(`   Project: ${session.project}`));
    }
    if (session.tag) {
      console.log(chalk.gray(`   Tag: ${session.tag}`));
    }
    if (session.note) {
      console.log(chalk.gray(`   Note: ${session.note}`));
    }

    console.log(chalk.cyan(`   Today: ${formatDuration(todayTotal + elapsed)} total`));
    console.log(chalk.gray("\nPress Ctrl+C to exit"));
  }, 1000);

  process.on("SIGINT", () => {
    clearInterval(updateInterval);
    console.log(chalk.gray("\n\nStopped live view"));
    process.exit(0);
  });
}

function rowToSession(columns: string[], values: any[]): Session {
  const session: any = {};
  columns.forEach((col, idx) => {
    session[col] = values[idx];
  });
  return session as Session;
}