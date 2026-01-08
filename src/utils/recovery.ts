import { getDb, saveDb, Session, rowToSession } from "../db/database";
import { formatDuration } from "./time";
import chalk from "chalk";
import * as readline from "readline";

const promptUser = (question: string): Promise<string> => {
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
};

const findOrphanedSession = async (): Promise<Session | undefined> => {
  const db = await getDb();
  const today = new Date().toISOString().split("T")[0];

  const result = db.exec(
    "SELECT * FROM sessions WHERE status IN ('running', 'paused') AND date(start_time) < ? ORDER BY start_time DESC LIMIT 1",
    [today]
  );

  return result.length > 0 && result[0].values.length > 0
    ? rowToSession(result[0].columns, result[0].values[0])
    : undefined;
};

const calculateElapsedTime = (session: Session): number => {
  const startTime = new Date(session.start_time);
  const now = new Date();
  let elapsed = Math.floor((now.getTime() - startTime.getTime()) / 1000);

  if (session.paused_seconds) {
    elapsed -= session.paused_seconds;
  }

  return elapsed;
};

const displayOrphanedSession = (session: Session, elapsed: number): void => {
  const startTime = new Date(session.start_time);
  console.log(
    chalk.yellow(
      `\n⚠️  Found an unfinished session from ${startTime.toLocaleDateString()} (${formatDuration(elapsed)})`
    )
  );
  if (session.project) {
    console.log(chalk.gray(`   Project: ${session.project}`));
  }
};

const handleKeep = (): void => {
  console.log(chalk.gray("Session kept as-is.\n"));
};

const handleDiscard = async (sessionId: number): Promise<void> => {
  const db = await getDb();
  db.run("DELETE FROM sessions WHERE id = ?", [sessionId]);
  saveDb();
  console.log(chalk.green("✓ Session discarded.\n"));
};

const handleStop = async (session: Session): Promise<void> => {
  const db = await getDb();
  const startTime = new Date(session.start_time);
  const endOfDay = new Date(session.start_time);
  endOfDay.setHours(23, 59, 59, 999);

  let totalSeconds = Math.floor((endOfDay.getTime() - startTime.getTime()) / 1000);

  if (session.paused_seconds) {
    totalSeconds -= session.paused_seconds;
  }

  db.run(
    "UPDATE sessions SET end_time = ?, status = 'completed', total_seconds = ? WHERE id = ?",
    [endOfDay.toISOString(), totalSeconds, session.id!]
  );
  saveDb();

  console.log(
    chalk.green(`✓ Session stopped at end of day (${formatDuration(totalSeconds)}).\n`)
  );
};

export const checkForOrphanedSessions = async (): Promise<void> => {
  const orphanedSession = await findOrphanedSession();

  if (!orphanedSession) {
    return;
  }

  const elapsed = calculateElapsedTime(orphanedSession);
  displayOrphanedSession(orphanedSession, elapsed);

  const answer = await promptUser(
    "What would you like to do? [k]eep it as-is, [d]iscard it, or [s]top it now: "
  );

  const action = answer.toLowerCase();

  switch (action) {
    case "k":
    case "keep":
      handleKeep();
      break;

    case "d":
    case "discard":
      if (orphanedSession.id !== undefined) {
        await handleDiscard(orphanedSession.id);
      }
      break;

    case "s":
    case "stop":
      await handleStop(orphanedSession);
      break;

    default:
      console.log(chalk.gray("Invalid choice. Session kept as-is.\n"));
  }
};