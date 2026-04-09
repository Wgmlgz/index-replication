# Telegram Login Verification

This project supports optional two-step login verification via Telegram.

## How It Works

1. User enters username/password.
2. If Telegram login verification is enabled for that user, API creates a login challenge.
3. API sends an approval message to the user's linked Telegram chat.
4. User taps `Approve login` or `Deny`.
5. Frontend checks challenge status via `/api/login/verify` and completes session login on approval.

Telegram polling runs as a dedicated bot process (`telegram-bot`) that shares the same database as the API.

## Developer Setup

1. Create a bot in Telegram via `@BotFather`.
2. Copy the bot token.
3. Set environment variables:

```bash
TELEGRAM_BOT_TOKEN=<your_bot_token>
TELEGRAM_BOT_USERNAME=<your_bot_username_without_@>
TELEGRAM_SOCKS5_PROXY=socks5://user:pass@host:port
TELEGRAM_POLL_TIMEOUT_SEC=30
LOGIN_VERIFICATION_TTL_SECONDS=300
```

4. Run API migrations:

```bash
cd api
task migrate:up
```

5. Start the stack:

```bash
task docker
```

When `TELEGRAM_BOT_TOKEN` is set, the `telegram-bot` service starts long-polling Telegram updates.

For local non-Docker development:

```bash
cd api
task telegram:dev
```

## User Setup Flow (In App)

1. Open `Settings`.
2. In `Telegram verification`, click `Generate connect link`.
3. Open the generated link and press `Start` in bot chat.
4. Press `Connect account` button in Telegram.
5. Return to app and enable `Telegram login verification`.

To disconnect Telegram later, use `Unlink Telegram` in the same settings section.

## Notes

- If bot is unavailable, login verification cannot be completed for users with Telegram login verification enabled.
- Login verification is single-use and expires after `LOGIN_VERIFICATION_TTL_SECONDS`.
- Keep `TELEGRAM_BOT_TOKEN` secret. Do not commit real tokens.
