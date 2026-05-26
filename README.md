# saperly-dial

Type a message. Call a phone number. Saperly reads it aloud.

A minimal CLI built on the [`@saperly/sdk`](https://github.com/Saperly/saperly-node). Useful as a getting-started reference or a scriptable notification tool for AI agents.

## Demo

```
$ npx saperly-dial

  saperly-dial
  Type a message → Saperly calls a number and reads it aloud

  ✔ Phone number to call (E.164, e.g. +14155551234) … +14155551234
  ✔ Message to read aloud … Your deployment to production just completed.

  ✔ Call placed!

  Call details
  From     +14155550123
  To       +14155551234
  Call ID  call_abc123
  Status   queued

  Track it at https://saperly.com/calls/call_abc123
```

## Install

Requires Node.js 18+.

**Run without installing:**
```bash
npx saperly-dial
```

**Install globally:**
```bash
npm install -g saperly-dial
```

## Quickstart

1. Get an API key at [saperly.com/settings/keys](https://saperly.com/settings/keys).

2. Export it:
   ```bash
   export SAPERLY_API_KEY=sk_live_...
   ```

3. Run:
   ```bash
   npx saperly-dial
   ```
   The CLI prompts for a phone number and message, then places the call.

## Usage

### Interactive (default)

```bash
saperly-dial
```

Prompts for phone number and message.

### Non-interactive (scripted / CI)

```bash
saperly-dial --to +14155551234 --message "Your package has shipped."
```

All flags:

| Flag        | Description                                          | Required |
| ----------- | ---------------------------------------------------- | -------- |
| `--to`      | E.164 destination number (e.g. `+14155551234`)       | yes      |
| `--message` | Text Saperly's hosted agent will read aloud          | yes      |
| `--voice`   | Saperly voice ID (see `saperly_list_voices` in MCP)  | no       |
| `-h`        | Print help                                           | no       |

### Environment variables

| Variable          | Description                              | Required |
| ----------------- | ---------------------------------------- | -------- |
| `SAPERLY_API_KEY` | Your Saperly API key (`sk_live_…`)       | yes      |
| `SAPERLY_BASE_URL`| Override API base URL (for local dev)    | no       |

## How it works

Each call goes through three steps, matching Saperly's recommended pattern from [`AGENTS.md`](https://github.com/Saperly/saperly-mcp/blob/main/AGENTS.md):

1. **Line** — Looks for an existing hosted line named `saperly-dial-cli`. Creates one on first run. Reuses it on every subsequent run, so you're never charged for extra numbers.

2. **Consent** — Calls `client.consent.grant()` with `consentType: "explicit_outbound"` before dialling. `ConsentAlreadyGrantedError` is silently swallowed — if consent is already on file the call proceeds normally.

3. **Call** — Calls `client.calls.create()`. Saperly's hosted agent answers, reads the message word-for-word via TTS, says goodbye, and hangs up.

```
┌───────────┐    list/create    ┌──────────────┐
│  CLI      │ ──────────────── ▶│  Saperly API │
│           │                   │  lines       │
│           │    grant consent  │  consent     │
│           │ ──────────────── ▶│              │
│           │                   │  calls       │
│           │    create call    │              │
│           │ ──────────────── ▶│              │
└───────────┘                   └──────────────┘
                                      │
                                 TTS + hosted agent
                                      │
                                 ┌────▼─────┐
                                 │  Phone   │
                                 └──────────┘
```

## Development

```bash
git clone https://github.com/your-username/saperly-dial
cd saperly-dial
npm install

# Run from source
export SAPERLY_API_KEY=sk_test_...
npm run dev -- --to +14155550100 --message "Hello from dev"

# Type-check
npm run lint

# Run tests
npm test

# Build
npm run build
```

## Project structure

```
saperly-dial/
├── src/
│   ├── cli.ts        # Entry point — arg parsing, prompts, output
│   ├── dial.ts       # Core logic — line, consent, call
│   ├── config.ts     # Env-var loading and validation
│   └── dial.test.ts  # Unit tests (vitest)
├── package.json
├── tsconfig.json
└── tsconfig.build.json
```

## Notes

- **Line cost** — Saperly charges $2.50/month per number after the first (free for 30 days). `saperly-dial` reuses a single line named `saperly-dial-cli` to avoid surprise charges.
- **Outbound SMS** — not yet in scope. Saperly's outbound SMS is marked as coming soon in the SDK.
- **Billing balance** — `client.billing.balance()` throws `NotFoundError` in the current SDK (Phase 5, not yet shipped). This tool does not call it.

## License

MIT
