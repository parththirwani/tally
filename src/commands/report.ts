import { getDb, Session, rowToSession } from "../db/database";
import { formatDuration, getDateRange } from "../utils/time";
import chalk from "chalk";
import { writeFileSync } from "fs";

const formatTime = (date: Date): string => {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const getSessions = async (startDate: string, endDate: string): Promise<Session[]> => {
  const db = await getDb();
  const result = db.exec(
    "SELECT * FROM sessions WHERE date(start_time) >= ? AND date(start_time) <= ? AND status = 'completed' ORDER BY start_time ASC",
    [startDate, endDate]
  );

  return result.length > 0 && result[0].values
    ? result[0].values.map((row: any) => rowToSession(result[0].columns, row))
    : [];
};

const showDailyReport = (sessions: Session[], detailed: boolean): void => {
  if (detailed) {
    sessions.forEach((session, index) => {
      const start = new Date(session.start_time);
      const end = session.end_time ? new Date(session.end_time) : null;

      console.log(chalk.cyan(`\nSession ${index + 1}:`));
      console.log(
        chalk.gray(
          `  ${formatTime(start)} - ${end ? formatTime(end) : "ongoing"}`
        )
      );
      console.log(chalk.white(`  Duration: ${formatDuration(session.total_seconds || 0)}`));
      if (session.project) console.log(chalk.gray(`  Project: ${session.project}`));
      if (session.tag) console.log(chalk.gray(`  Tag: ${session.tag}`));
      if (session.note) console.log(chalk.gray(`  Note: ${session.note}`));
    });
  } else {
    console.log();
    sessions.forEach((session) => {
      const start = new Date(session.start_time);
      const projectInfo = session.project ? chalk.blue(`[${session.project}]`) : "";
      console.log(
        `  ${chalk.gray(formatTime(start))} ${projectInfo} ${chalk.white(formatDuration(session.total_seconds || 0))}`
      );
    });
  }
};

const showGroupedReport = (sessions: Session[]): void => {
  const grouped = new Map<string, Session[]>();

  sessions.forEach((session) => {
    const date = session.start_time.split("T")[0];
    if (!grouped.has(date)) {
      grouped.set(date, []);
    }
    grouped.get(date)!.push(session);
  });

  console.log();
  grouped.forEach((daySessions, date) => {
    const total = daySessions.reduce((sum, s) => sum + (s.total_seconds || 0), 0);
    const dateObj = new Date(date + "T00:00:00");
    const dayName = dateObj.toLocaleDateString("en-US", { weekday: "short" });
    const formattedDate = dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" });

    console.log(
      `  ${chalk.gray(dayName)} ${chalk.white(formattedDate)}: ${chalk.cyan(formatDuration(total))} ${chalk.gray(`(${daySessions.length} session${daySessions.length > 1 ? "s" : ""})`)}`
    );
  });
};

const exportToJSON = (sessions: Session[], label: string): string => {
  const filename = `tally-report-${label.replace(/\s+/g, "-")}-${Date.now()}.json`;
  const data = {
    period: label,
    sessions: sessions.map((s) => ({
      start: s.start_time,
      end: s.end_time,
      duration: formatDuration(s.total_seconds || 0),
      durationSeconds: s.total_seconds,
      project: s.project,
      tag: s.tag,
      note: s.note,
    })),
    totalSeconds: sessions.reduce((sum, s) => sum + (s.total_seconds || 0), 0),
  };

  writeFileSync(filename, JSON.stringify(data, null, 2));
  return filename;
};

const exportToCSV = (sessions: Session[], label: string): string => {
  const filename = `tally-report-${label.replace(/\s+/g, "-")}-${Date.now()}.csv`;
  const headers = "Start,End,Duration,Project,Tag,Note\n";
  const rows = sessions
    .map((s) => {
      const start = new Date(s.start_time).toISOString();
      const end = s.end_time ? new Date(s.end_time).toISOString() : "";
      const duration = formatDuration(s.total_seconds || 0);
      return `"${start}","${end}","${duration}","${s.project || ""}","${s.tag || ""}","${s.note || ""}"`;
    })
    .join("\n");

  writeFileSync(filename, headers + rows);
  return filename;
};

const exportReport = (sessions: Session[], format: string, label: string): void => {
  const filename = format === "json"
    ? exportToJSON(sessions, label)
    : exportToCSV(sessions, label);

  console.log(chalk.green(`✓ Report exported to ${filename}`));
};

export const generateReport = async (
  period: string,
  detailed: boolean = false,
  exportFormat?: string
): Promise<void> => {
  const { startDate, endDate, label } = getDateRange(period);
  const sessions = await getSessions(startDate, endDate);

  if (sessions.length === 0) {
    console.log(chalk.gray(`No sessions found for ${label}`));
    return;
  }

  if (exportFormat) {
    exportReport(sessions, exportFormat, label);
    return;
  }

  const totalSeconds = sessions.reduce((sum, s) => sum + (s.total_seconds || 0), 0);

  console.log(chalk.bold(`\n📊 Report for ${label}`));
  console.log(chalk.gray("─".repeat(50)));

  if (period === "week" || period === "month") {
    showGroupedReport(sessions);
  } else {
    showDailyReport(sessions, detailed);
  }

  console.log(chalk.gray("─".repeat(50)));
  console.log(
    chalk.bold.cyan(
      `Total: ${formatDuration(totalSeconds)} (${(totalSeconds / 3600).toFixed(2)} hours) across ${sessions.length} session(s)`
    )
  );
  console.log();
};