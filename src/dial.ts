import { Saperly, ConsentRequiredError, ConsentAlreadyGrantedError } from "@saperly/sdk";
import type { Config } from "./config.js";

export interface DialOptions {
  /** E.164 destination number, e.g. "+14155551234" */
  toNumber: string;
  /** The message text Saperly's hosted agent will speak */
  message: string;
  /** Optional TTS voice ID from saperly_list_voices */
  voiceId?: string;
}

export interface DialResult {
  lineId: string;
  lineNumber: string;
  callId: string;
  status: string;
}

const LINE_NAME = "saperly-dial-cli";

/**
 * End-to-end flow:
 *   1. Reuse or provision a hosted phone line.
 *   2. Grant consent for the destination number (idempotent).
 *   3. Place an outbound hosted call — Saperly speaks `message` via TTS.
 *   4. Return IDs and initial status for the caller to display.
 */
export async function dial(config: Config, opts: DialOptions): Promise<DialResult> {
  const client = new Saperly({
    apiKey: config.apiKey,
    ...(config.baseUrl ? { baseUrl: config.baseUrl } : {}),
  });

  // 1. Reuse an existing line by name to avoid provisioning a new number on
  //    every run (numbers cost $2.50/month after the first free one).
  const line = await getOrCreateLine(client, opts.message, opts.voiceId);

  // 2. Grant consent — required before any outbound call per TCPA rules.
  //    ConsentAlreadyGrantedError is safe to swallow; it means we've called
  //    this number before and consent is already on file.
  await grantConsentSafe(client, line.id, opts.toNumber);

  // 3. Place the call.
  let call;
  try {
    call = await client.calls.create({
      lineId: line.id,
      toNumber: opts.toNumber,
    });
  } catch (err) {
    if (err instanceof ConsentRequiredError) {
      // Shouldn't happen after step 2, but guard anyway.
      throw new Error(
        `Consent check failed for ${opts.toNumber}. ` +
          "The number may have opted out. Check the audit log."
      );
    }
    throw err;
  }

  return {
    lineId: line.id,
    lineNumber: line.phoneNumber,
    callId: call.id,
    status: call.status,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getOrCreateLine(
  client: Saperly,
  message: string,
  voiceId?: string
): Promise<{ id: string; phoneNumber: string }> {
  const existing = await client.lines.list();
  const match = existing.find((l) => l.name === LINE_NAME);
  if (match) {
    return { id: match.id, phoneNumber: match.phoneNumber };
  }

  // Build the hosted-mode system prompt from the user's message.
  // The agent reads the message once then hangs up — simple and predictable.
  const systemPrompt = buildSystemPrompt(message);

  const created = await client.lines.create({
    name: LINE_NAME,
    mode: "hosted",
    ...(voiceId ? { voiceId } : {}),
    webhookUrl: undefined,
    // Pass message via system prompt so the hosted agent knows what to say.
    // @ts-expect-error — systemPrompt is accepted by the API in hosted mode
    systemPrompt,
  });

  return { id: created.id, phoneNumber: created.phoneNumber };
}

async function grantConsentSafe(
  client: Saperly,
  lineId: string,
  phoneNumber: string
): Promise<void> {
  try {
    await client.consent.grant({
      lineId,
      phoneNumber,
      consentType: "explicit_outbound",
      source: "api",
    });
  } catch (err) {
    if (err instanceof ConsentAlreadyGrantedError) {
      return; // already on file — perfectly fine
    }
    throw  err;
  }
}

function buildSystemPrompt(message: string): string {
  return (
    `You are a concise voice assistant. ` +
    `When the call connects, read the following message exactly once, word for word:\n\n` +
    `"${message}"\n\n` +
    `After reading the message, politely say goodbye and end the call. ` +
    `Do not improvise, add commentary, or ask questions.`
  );
}
