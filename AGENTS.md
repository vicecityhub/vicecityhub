# AGENTS.md

Любой ИИ-агент, работающий в этом репозитории: **сначала прочитай `docs/AGENT-HANDOFF.md`**
(очередь задач, журнал сессий, правила, запросы к аналитике). После работы обнови его.

Кратко:
- Язык диалога с владельцем: русский. Интерфейс сайта: американский английский (GTA-сарказм; виджет `Ask Hub AI` поддерживает ответы на языке пользователя).
- Пушить **только в `main`**. Перед коммитом: `npm run typecheck && npm run test:unit && npm run build && npm run verify:dist`.
- Секреты (токены, `service_role`, `GEMINI_API_KEY`) в коммит не класть; данные не выдумывать.
- ИИ-поддержка и аналитика запросов: `HubAIWidget` (глобально в `Layout.tsx`), `HubQueryAnalyticsPanel` (`agents.html#ai-analytics`), Edge Function `supabase/functions/ai-support/index.ts` (`--no-verify-jwt`, секрет `GEMINI_API_KEY`), таблица `public.ai_query_analytics`.

Память проекта и Repowise: `docs/REPOWISE.md`. Решения (ADR): `docs/decisions/`.
