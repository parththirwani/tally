#!/usr/bin/env node

import { Command } from "commander";
import { startSession, stopSession, pauseSession, resumeSession } from "./commands/session";
import { showStatus } from "./commands/status";
import { generateReport } from "./commands/report";
import { checkForOrphanedSessions } from "./utils/recovery";

const program = new Command();

program
  .name("tally")
  .description("A simple CLI tool for tracking daily work hours")
  .version("1.0.0");

// Start command
program
  .command("start")
  .description("Start a new work session")
  .argument("[project]", "Project name")
  .option("-p, --project <name>", "Project name")
  .option("-t, --tag <tag>", "Tag for the session")
  .option("-n, --note <note>", "Note or description")
  .action(async (projectArg, options) => {
    await checkForOrphanedSessions();
    const project = options.project || projectArg;
    await startSession(project, options.tag, options.note);
  });

// Stop command
program
  .command("stop")
  .description("Stop the current work session")
  .option("-n, --note <note>", "Add a note when stopping")
  .action(async (options) => {
    await stopSession(options.note);
  });

// Pause command
program
  .command("pause")
  .description("Pause the current work session")
  .action(async () => {
    await pauseSession();
  });

// Resume command
program
  .command("resume")
  .description("Resume a paused work session")
  .action(async () => {
    await checkForOrphanedSessions();
    await resumeSession();
  });

// Status command
program
  .command("status")
  .description("Show current session status and today's total")
  .option("-l, --live", "Show live updating timer")
  .action(async (options) => {
    await showStatus(options.live);
  });

// Report command
program
  .command("report")
  .description("Generate work reports")
  .argument("[period]", "Report period: today (default), yesterday, week, month, or YYYY-MM-DD")
  .option("-d, --detailed", "Show detailed session breakdown")
  .option("--export <format>", "Export format: json or csv")
  .action(async (period, options) => {
    await generateReport(period || "today", options.detailed, options.export);
  });

// Default action if no command provided
program.action(() => {
  program.help();
});

program.parse(process.argv);