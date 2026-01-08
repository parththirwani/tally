import { getDb, saveDb, Session } from "../db/database";
import { formatDuration } from "./time";
import chalk from "chalk";
import * as readline from "readline";

export async function checkForOrphanedSessions(): Promise<void> {
  const db = await getDb();

  // Find sessions that are still "running" or "paused" from previous days
  const today = new Date().toISOString().split("T")[0];

  const result = db.exec(
    "SELECT * FROM sessions WHERE status IN ('running', 'paused') AND date(start_time) < ? ORDER BY start_time DESC LIMIT 1",
    [today]
  );
  
  const orphanedSession = result.length > 0 && result[0].values.length > 0
    ? rowToSession(result[0].columns, result[0].values[0])
    : undefined;

  if (!orphanedSession) {
    return;
  }

  const startTime = new Date(orphanedSession.start_time);
  const now = new Date();
  let elapsed = Math.floor((now.getTime() - startTime.getTime()) / 1000);

  if (orphanedSession.paused_seconds) {
    elapsed -= orphanedSession.paused_seconds;
  }

  console.log(
    chalk.yellow(
      `\n⚠️  Found an unfinished session from ${startTime.toLocaleDateString()} (${formatDuration(elapsed)})`
    )
  );
  if (orphanedSession.project) {
    console.log(chalk.gray(`   Project: ${orphanedSession.project}`));
  }

  const answer = await promptUser(
    "What would you like to do? [k]eep it as-is, [d]iscard it, or [s]top it now: "
  );

  switch (answer.toLowerCase()) {
    case "k":
    case "keep":
      console.log(chalk.gray("Session kept as-is.\n"));
      break;

    case "d":
    case "discard":
      if (orphanedSession.id !== undefined) {
        db.run("DELETE FROM sessions WHERE id = ?", [orphanedSession.id]);
        saveDb();
        console.log(chalk.green("✓ Session discarded.\n"));
      }
      break;

    case "s":
    case "stop":
      // Calculate total time from start to end of that day
      const endOfDay = new Date(orphanedSession.start_time);
      endOfDay.setHours(23, 59, 59, 999);

      let totalSeconds = Math.floor(
        (endOfDay.getTime() - startTime.getTime()) / 1000
      );

      if (orphanedSession.paused_seconds) {
        totalSeconds -= orphanedSession.paused_seconds;
      }

      if (orphanedSession.id !== undefined) {
        db.run(
          "UPDATE sessions SET end_time = ?, status = 'completed', total_seconds = ? WHERE id = ?",
          [endOfDay.toISOString(), totalSeconds, orphanedSession.id]
        );
        saveDb();

        console.log(
          chalk.green(`✓ Session stopped at end of day (${formatDuration(totalSeconds)}).\n`)
        );
      }
      break;

    default:
      console.log(chalk.gray("Invalid choice. Session kept as-is.\n"));
  }
}

function promptUser(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function rowToSession(columns: string[], values: any[]): Session {
  const session: any = {};
  columns.forEach((col, idx) => {
    session[col] = values[idx];
  });
  return session as Session;
}