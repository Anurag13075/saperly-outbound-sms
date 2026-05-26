#!/usr/bin/env node
/**
 * saperly-dial  —  type a message, call a phone number, Saperly reads it aloud.
 *
 * Usage (interactive):
 *   npx saperly-dial
 *
 * Usage (non-interactive / scripted):
 *   saperly-dial --to +14155551234 --message "Your package has shipped."
 *
 * Environment:
 *   SAPERLY_API_KEY   required
 *   SAPERLY_BASE_URL  optional (for local dev)
 */

import { parseArgs } from "node:util";
import prompts from "prompts";
import ora from "ora";
import chalk from "chalk";
import { loadConfig } from "./config.js";
import { dial } from "./dial.js";

async function main(): Promise<void> {
  // ── Parse optional CLI flags ──────────────────────────────────────────────
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      to: { type: "string" },
      message: { type: "string" },
      voice: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
    strict: false,
  });

  if (values.help) {
    printHelp();
    process.exit(0);
  }

  printBanner();

  // ── Load config (throws with a clear message if SAPERLY_API_KEY is absent) ─
  let config;
  try {
    config = loadConfig();
  } catch (err) {
    console.error(chalk.red("\n✖ " + (err as Error).message));
    process.exit(1);
  }

  // ── Collect inputs (flags first, then interactive prompts for anything missing)
  const to = values.to ?? (await askTo());
  const message = values.message ?? (await askMessage());
  const voiceId = values.voice; // optional

  if (!to || !message) {
    console.error(chalk.red("\n✖ Phone number and message are required."));
    process.exit(1);
  }

  // ── Validate E.164 ────────────────────────────────────────────────────────
  if (!/^\+[1-9]\d{6,14}$/.test(to)) {
    console.error(
      chalk.red(
        `\n✖ "${to}" doesn't look like a valid E.164 number.\n` +
          `   Use the format +14155551234 (country code first).`
      )
    );
    process.exit(1);
  }

  // ── Place the call ────────────────────────────────────────────────────────
  console.log();
  const spinner = ora("Provisioning line and placing call…").start();

  try {
    const result = await dial(config, { toNumber: to, message, voiceId });

    spinner.succeed(chalk.green("Call placed!"));
    console.log();
    console.log(chalk.bold("  Call details"));
    console.log(`  ${chalk.dim("From")}     ${result.lineNumber}`);
    console.log(`  ${chalk.dim("To")}       ${to}`);
    console.log(`  ${chalk.dim("Call ID")}  ${result.callId}`);
    console.log(`  ${chalk.dim("Status")}   ${result.status}`);
    console.log();
    console.log(
      chalk.dim(
        `  Track it at https://saperly.com/calls/${result.callId}`
      )
    );
    console.log();
  } catch (err) {
    spinner.fail(chalk.red("Call failed"));
    console.error(chalk.red("\n✖ " + (err as Error).message));
    process.exit(1);
  }
}

// ── Interactive prompts ──────────────────────────────────────────────────────

async function askTo(): Promise<string> {
  const { to } = await prompts({
    type: "text",
    name: "to",
    message: "Phone number to call (E.164, e.g. +14155551234)",
    validate: (v: string) =>
      /^\+[1-9]\d{6,14}$/.test(v.trim()) || "Enter a valid E.164 number",
  });
  return (to as string | undefined)?.trim() ?? "";
}

async function askMessage(): Promise<string> {
  const { message } = await prompts({
    type: "text",
    name: "message",
    message: "Message to read aloud",
    validate: (v: string) =>
      v.trim().length > 0 || "Message cannot be empty",
  });
  return (message as string | undefined)?.trim() ?? "";
}

// ── Formatting ───────────────────────────────────────────────────────────────

function printBanner(): void {
  console.log();
  console.log(chalk.bold.cyan("  saperly-dial"));
  console.log(chalk.dim("  Type a message → Saperly calls a number and reads it aloud"));
  console.log();
}

function printHelp(): void {
  console.log(`
  ${chalk.bold("saperly-dial")} — call a phone number and read a message aloud

  ${chalk.bold("Usage")}
    npx saperly-dial [options]

  ${chalk.bold("Options")}
    --to        E.164 phone number to call  (e.g. +14155551234)
    --message   Text to read aloud
    --voice     Saperly voice ID (optional, see saperly-dial voices)
    -h, --help  Show this help

  ${chalk.bold("Environment")}
    SAPERLY_API_KEY   your Saperly API key  (required)
    SAPERLY_BASE_URL  override API base URL (optional)

  ${chalk.bold("Examples")}
    $ saperly-dial
    $ saperly-dial --to +14155551234 --message "Your order has shipped."
    $ SAPERLY_API_KEY=sk_test_... saperly-dial --to +14155550100 --message "Test"
  `);
}

main();
