# Hermes Meal Plan Bot

A Telegram bot that asks a few questions, then generates a daily meal plan using
your locally-hosted Hermes model through an OpenAI-compatible API (llama.cpp
server, or text-generation-webui's OpenAI extension).

## 1. Start your local Hermes server

Pick whichever you're already using:

**llama.cpp (`llama-server`)**
```bash
./llama-server -m /path/to/hermes.gguf -c 4096 --port 8080
```
This exposes an OpenAI-compatible API at `http://127.0.0.1:8080/v1`.

**text-generation-webui**
Load Hermes in the UI, then enable the "openai" extension (either in the UI's
Session tab, or by launching with `--extensions openai`). By default it serves
at `http://127.0.0.1:5000/v1`.

Either way, confirm it works before wiring up the bot:
```bash
curl http://127.0.0.1:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"hermes","messages":[{"role":"user","content":"say hi"}]}'
```
If that returns a JSON response with a `choices[0].message.content`, you're good.

## 2. Create the Telegram bot

1. Message [@BotFather](https://t.me/BotFather) on Telegram.
2. `/newbot`, follow the prompts, and copy the token it gives you.

## 3. Configure

```bash
cp .env.example .env
```
Edit `.env`:
- `TELEGRAM_BOT_TOKEN` — from BotFather
- `LLM_BASE_URL` — `http://127.0.0.1:8080/v1` (llama.cpp) or `http://127.0.0.1:5000/v1` (text-gen-webui)
- `LLM_MODEL` — whatever your server expects (llama-server mostly ignores this but still requires the field)

## 4. Install and run

```bash
npm install
npm start
```

Then in Telegram, message your bot: `/start`, then `/mealplan`, and answer the
questions (goal → restrictions → allergies → calorie target → meals/day →
cuisine). It sends your answers to Hermes and replies with the plan.

## 5. Run persistently with PM2 (optional)

```bash
pm2 start ecosystem.config.cjs
pm2 save
```

## Notes / things you'll likely want to tweak

- **Sessions are in-memory** (Telegraf's built-in `session()`), so they reset
  if the process restarts mid-conversation. Fine for a single-user local bot;
  swap in `@telegraf/session` with a file/Redis store if you want persistence
  across restarts.
- **Prompt lives in `llmClient.js`** (`SYSTEM_PROMPT`) — edit it directly to
  change tone, add macros (protein/carbs/fat breakdown), enforce a specific
  format, or ask for a shopping list.
- **No conversation memory across days** — each `/mealplan` run is stateless.
  If you want it to remember yesterday's plan (for variety) or track history,
  you'd persist `answers` + generated plans per user (e.g. a small JSON file
  or SQLite) and feed the last plan into the prompt.
- **Single-user assumption** — sessions are keyed per Telegram chat, so it
  already supports multiple users talking to the same bot concurrently.