/**
 * Runtime configuration loaded from environment variables.
 *
 * SAPERLY_API_KEY  – required. Obtain from https://saperly.com/settings/keys
 * SAPERLY_BASE_URL – optional. Override for local dev / staging.
 */

export interface Config {
  apiKey: string;
  baseUrl?: string;
  status?:string ;
}

export function loadConfig(): Config {
  const apiKey = process.env["SAPERLY_API_KEY"];
  if (!apiKey) {
    throw new Error(
      "SAPERLY_API_KEY is not set.\n" +
        "Get your API key at https://saperly.com/settings/keys and run:\n" +
        "  export SAPERLY_API_KEY=sk_live_..."
    );
  }
  return {
    apiKey,
    baseUrl: process.env["SAPERLY_BASE_URL"],
  };
}
