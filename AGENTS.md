# AGENTS.md

Primary docs for onboarding and change locations:

- `README.md`
- `api/README.md`
- `web/README.md`

- Encoding/i18n: keep UI source strings in English and use `t(...)` via `react-i18next`. For now, ignore Russian entirely: do not edit `web/src/locales/ru/*` and keep translations in English only (use `web/src/locales/en/common.json`). If mojibake shows up, recover the original text with `git show` and keep it in English.

- When you finish replying the the user, if the your task is long running, find the "Foxy jumpscare" app, and run it (if it exists, if not ignore this instruction), unless prompted otherwise.
- To avoid repeated searches, cache the app path in `.foxy` at the repo root. If the cache file exists, use it before searching. If you find a new path, update the cache.
