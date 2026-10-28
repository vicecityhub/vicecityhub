# AGENT HANDOFF: Vice City Hub

Единая точка входа (контекст-память проекта и Repowise: docs/REPOWISE.md, решения: docs/decisions/) для любого агента/модели (Claude, GPT, Gemini, Codex и т.д.), которые продолжают проект,
пока у основного агента сброшены лимиты. **Прочитай этот файл первым. Обнови его в конце своей сессии.**

Язык общения с владельцем (Ser): только русский. Язык интерфейса сайта: американский английский с ядовитым GTA-сарказмом.
Принцип: «действуй, затем докладывай». Не выдумывай данные (никаких фейковых онлайн-счётчиков, цен, кодов серверов).

## 0. Как работать
- Репозиторий: github.com/vicecityhub/vicecityhub, пушить **только в `main`**. Сайт: https://vicecityhub.github.io/vicecityhub/
- Локально: `C:\Users\sarma\Documents\deployd\hub`. Supabase project ref: `lpglkglhjdqnktybksth`.
- PowerShell пользователя имеет `NODE_ENV=production`: перед установкой делай `$env:NODE_ENV=''; npm install --include=dev`.
- Проверка перед коммитом: `npx tsc --noEmit -p tsconfig.app.json; npm run build; npm run verify:dist` (всё должно быть PASS).
- `prebuild` сам запускает: `gen-agent-surface` → `gen-og` → `gen-seo-pages`.
- Секреты (.env, service role key) в коммит не класть. Перед коммитом: `git diff --cached | Select-String -Pattern "service_role|sk_|secret"`.
- Часы на устройстве неточные: дату бери из внешнего источника.
- Параллельно могут работать другие сессии: перед правками смотри `git status`, `git log -5`, список edge functions и таблиц.

## 1. Что уже сделано (не повторять)
| Область | Состояние |
|---|---|
| SEO | Статические страницы новостей `/n/…`, техники `/vehicles/…`, `/gta-6-release-date/`, `/supporters/`, `/is-gta-6-out-yet/`, RSS, sitemap, JSON-LD, Search Console тег стоит |
| Дизайн | Статические страницы в стиле хаба (лого, шрифты, футер, радио, меню в две строки) |
| Производительность | Self-hosted WOFF2, lazy video/TradingView, WebP-превью мерча, Hustle-игра грузится по требованию (`OnView` + `React.lazy`) |
| Аналитика | Без cookie: edge function `hit` → таблица `page_hits`. Клиент `src/lib/analytics.ts` + inline-маяк в статике. `?notrack` и DNT уважаются |
| OG-картинки | `scripts/gen-og.mjs` → `public/og/<id>.png` (28 шт., ~2 МБ), `release.png`, `is-out.png` |
| Монетизация | Платные слоты RP ($100/$200/$300), Ko-fi + Wall of Legends, x402 `agent-premium` ($0.02 USDC) |
| Агентная поверхность | llms.txt, MCP, agent-api, `docs/MCP-LISTINGS.md` |
| Музыка | Бакет `muz`, треки 1–5.ogg уже Opus 48 кГц ~85 кбит/с: повторно не сжимать |

Удалено осознанно (не возвращать): рассылка (нет домена отправки), счётчики онлайна RP-серверов, генераторы доменов/мерча,
партнёрки/спонсоры, сценарии для YouTube, автопостинг в Telegram/Discord (владелец отказался: пункт 4).

## 2b. EPIC: Back Alley (доска для агентов), см. docs/decisions/ADR-0003-back-alley-agent-exchange.md и docs/ALLEY.md
Решения владельца (2026-10-25): **никаких сплитов, комиссий с чужих услуг и ручных схем**. Только автоматические прямые платежи на кошельки хаба (те же, что у `agent-premium`, читаются из `public/data/donate.json`) и донаты. Чужие деньги не хранить.

- [x] B1 · Фаза 1 · Меню из 5 групп (`src/lib/nav.json`), нижняя панель на телефоне, `/map/`, чистый футер. Готово 2026-10-25 (см. ADR-0001). Визуально не проверено: проверить в браузере (десктоп hover/клик, телефон: бургер и нижняя панель).
- [x] B2 · Фаза 2 · Таблицы alley_*, edge function `alley` (подпись EVM/Solana, nonce, лимиты, очередь модерации), самотесты `scripts/alley-selftest*.mjs`. Готово 2026-10-25, проверено боевым вызовом.
- [x] B3 — MCP-инструменты `alley_info`, `alley_list_threads`, `alley_get_thread`, `alley_post`, `alley_report`, `alley_pricing` в `agent-api` (mcp.ts + alley.ts), теперь 25 tools. Сделано 2026-10-25.
- [x] B4 · Фаза 2 · Страница `/alley/` (чтение, noindex) и пункт «Back Alley» в группе Agents. Открыть для индекса, когда будет модерированный контент (docs/ALLEY.md).
- [x] B5 — платные действия в `alley` только прямым x402 на кошельки хаба: `GET /boost/{id}?days=1..7` ($0.10/день, закреплённый тред помечен `sponsored`) и `GET /verify?chain=&address=` ($1, бейдж verified: 12 постов/час, до 2 https-ссылок). Продажи в `alley_sales`. Проверено вживую до 402 (Base+Solana); реальную оплату надо один раз прогнать кошельком. Сделано 2026-10-25.
- [x] B6 — полностью автоматическая модерация без человека: скрининг (инъекции, ключи/сикреты, скам, адреса для переводов, шортенеры), страйки → авто-мьют/бан, репутация → мгновенная публикация, новые кошельки через авто-релиз по cron (~10 мин), пир-репорты (3 репорта скрывают пост). См. docs/ALLEY.md. Сделано 2026-10-25.

## 2c. EPIC: Highlights (скриншоты и клипы с PS5), см. docs/HIGHLIGHTS.md и docs/decisions/ADR-0004-highlights-and-device-login.md

- [x] H1 — `highlights.html` + `src/pages/Highlights.tsx`: стена, фильтры, лайки, репорты, удаление своих, загрузка прямо в Storage (bucket `highlights`, RLS по папке user_id, 50 МБ, только image/video).
- [x] H2 — вход с консоли по коду: edge function `device-login` (start/poll/inspect/approve), подтверждение с телефона на `highlights.html#link`.
- [x] H3 — авто-модерация: лимит 10 загрузок/сутки (триггер), 3 репорта от аккаунтов старше суток скрывают пост.
- [ ] H4 — P1: один раз руками прогнать полный путь approve → verifyOtp → сессия на консоли с реальным аккаунтом (в тестах проверены только start/poll/ошибки).
- [ ] H5 — P1: на реальном PS5 проверить, открывается ли файловый диалог в браузере консоли и воспроизводится ли WebM; если нет — оставить маршрут через телефон и поправить тексты на странице.
- [ ] H6 — P2: классификатор изображений/видео (сейчас только репорты) или ограничение «загрузка только с аккаунта старше N часов».
- [ ] H7 — P2: чистка файлов в Storage для скрытых/удалённых записей (сейчас не удаляются автоматически).

## 2. ОЧЕРЕДЬ ЗАДАЧ (бери сверху, отмечай [x] и дату)
Формат: `- [ ] ID · приоритет · описание · критерий готовности`

### Высокий приоритет
- [ ] T1 · P0 · Визуально проверить OG-карточки (`public/og/4389.png`, `release.png`, `is-out.png`): перенос строк, свечение, обрезка заголовка. Готово: открыто в браузере/просмотрщике, дизайн подправлен в `scripts/gen-og.mjs`. (Основной агент не смог открыть картинки: проверка была только программной.)
- [ ] T2 · P0 · После деплоя проверить в проде: `curl -I https://vicecityhub.github.io/vicecityhub/og/release.png`, og:image на `/n/…` и `/is-gta-6-out-yet/` через Facebook Sharing Debugger / opengraph.xyz.
- [ ] T3 · P0 · Перемерить Lighthouse (mobile) на проде: home, market, news. Было: home 85, market 80, news 99. Цель 90+. Если home < 90: смотреть LCP-элемент и размер `Layout`-чанка (65 КБ) и `supabase-vendor` (200 КБ), подгружать supabase только там, где нужен.
- [ ] T4 · P1 · Страница статистики для владельца (не публичная или за токеном): сводка из `page_hits` (топ страниц, источники, устройства, уники по дням). Запросы в разделе 4.
- [ ] T5 · P1 · Удалить retired-заглушки edge functions в дашборде Supabase: `audio-swap-tmp`, `rp-online` (оба отвечают 410; через MCP удалить нельзя). Также удалить `backup_muz_original` на диске, когда владелец убедится, что музыка играет.

- [ ] T16 · P1 · Bing Webmaster: после выкатки проверить, что ошибка «H1 tag missing» ушла у index.html и news.html (добавлен скрытый H1 и описание в статический HTML всех индексируемых входных страниц). Нажать «Request indexing» заново, если ошибка осталась.
- [ ] T17 · P2 · Игра перенесена с главной на `community.html` (после форума). Проверить в браузере, что она грузится по прокрутке и главная стала быстрее (Lighthouse).
- [ ] T18 · P2 · Supabase advisor: функции `create_agent_key` и `revoke_agent_key` (SECURITY DEFINER) вызываются ролью authenticated через /rest/v1/rpc. Проверить, нужно ли это, иначе `revoke execute ... from authenticated`.

### Средний приоритет
- [ ] T6 · P1 · Страницы «долгого хвоста»: по одной на каждого известного персонажа/район Leonida (только из подтверждённых фактов в `news.json`), с JSON-LD и внутренней перелинковкой.
- [ ] T7 · P1 · Блок «Trending now» на главной и в `/n/` на основе `page_hits` за 7 дней (реальные данные, без накрутки).
- [ ] T8 · P1 · Hustle: карточка результата для шаринга (OG-картинка с очками) и недельный сброс лидерборда. Таблица `hustle_scores`.
- [ ] T9 · P2 · Страница «Advertise on Vice City Hub» с реальными тарифами (`server_promo_plans`) и формой `server_promo_requests`; ссылка из футера.
- [ ] T10 · P2 · Вкладка Wall of Legends: подтянуть новые донаты (Ko-fi webhook → `supporters`), проверить, что вебхук живой.
- [ ] T11 · P2 · Проверить `robots.txt`, `sitemap.xml` в Google Search Console и Bing Webmaster (нужен вход владельца: подготовить инструкцию, если не сделано).

### Низкий приоритет / идеи
- [ ] T12 · P3 · Дайджест «Week in Vice City» как отдельная страница `/weekly/<дата>/` (генерация из `news.json`).
- [ ] T13 · P3 · Мини-игры/квизы («Which Vice City character are you?»): виральность, шаринг с OG-картинкой.
- [ ] T14 · P3 · Локализованные мета-описания (ES/PT-BR) для статических страниц: только если есть трафик из этих стран в `page_hits`.
- [ ] T15 · P3 · Проверить a11y (контраст неоновых цветов, focus-стили) и добавить `prefers-reduced-motion`.

## 3. Журнал сессий (дописывай сверху, новая запись первой)
### 2026-10-27: Claude Sonnet 5.5 (рефакторинг по находкам Repowise)
Сделано: разбиты 7 функций с критичными находками Repowise (Layout 1588 → 105 строк, Home, PostDetail, PostCard, Community, `loop` в ViceArcadeGame, `route` в agent-api). Один коммит на файл, каждый откатывается отдельно (`git revert <sha>`). Поведение не менялось: Layout сверен с оригиналом по HTML 31 состояния (SSR-слепки), остальное покрыто юнит-тестами.
Тесты: появилась команда `npm run test:unit` (встроенный `node:test`, без новых зависимостей, 90 тестов в `tests/`). Чистая логика вынесена в `src/lib/*.ts` и `supabase/functions/agent-api/router.ts`. Перед коммитом: `npx tsc --noEmit -p tsconfig.app.json; npm run test:unit; npm run build; npm run verify:dist`.
Деплой agent-api: в Supabase выложена v23 (2026-10-27). Из-за размера (~170 КБ) задеплоен «заглушкой»: локально только `index.ts` и `openapi.json` (минифицирован), остальные модули (`lib`, `handlers`, `orders`, `router` и др.) импортируются с raw.githubusercontent.com по закреплённому коммиту b764fb3. Откат на прежний код: `git show e319ff2:supabase/functions/agent-api/index.ts` (+ те же файлы того коммита) или заглушка с коммитом e319ff2. Смоук-тест `scripts/test-agent-api.mjs` из песочницы не запускался (прокси блокирует supabase.co); вместо него через pg_net проверены 13 запросов (/v1, openapi, catalog, news, search, donate, rp, agents/me=401, неизвестный путь=404, статус заказа=404, заказ без ключа=401, MCP tools/list=25 инструментов, POST /v1/quotes без ключа=401), все как ожидалось. Полный `node scripts/test-agent-api.mjs` стоит прогнать с обычного компьютера.
Ещё в этой сессии (2026-10-28): `src/pages/RPHub.tsx` разбит (радио → `src/lib/rpRadio.ts` + `src/rp-hub/useRpRadio.ts`, шапка/заголовок/подвал → `src/rp-hub/components/Rp*.tsx`, вкладки — таблица `TAB_VIEWS`, фоны → `src/lib/rpTabs.ts`), 12 тестов `tests/rpRadio.test.mjs`, HTML страницы совпадает с оригиналом побайтно. `Layout.tsx` укорочен ещё (состояние оверлеев → `layout/useShellModals.ts`, аккаунт → `layout/useAccountArea.ts`), добавлены парные тесты `tests/layout.test.mjs` (SSR-хелпер `tests/helpers/renderTsx.mjs`), 31 SSR-состояние совпадает с оригиналом. Потом по просьбе владельца: радио стало единым — `src/lib/radio.ts` (+ тесты `tests/radio.test.mjs`), хук `components/layout/useRadio.ts` используют и Layout, и RP Hub (отдельное RP-радио удалено; на RP Hub теперь сохранение каждую секунду + номер трека, как на остальных страницах). Битые символы в подзаголовке RP Hub исправлены (дефисы).
`src/pages/News.tsx` (The Wire) разбит: логика → `src/lib/news.ts` (+ `tests/news.test.mjs`, 14 тестов), состояние/загрузка → `src/components/news/useNews.ts`, разметка → `NewsHero/NewsFilters/NewsFeed/NewsCard`. Удалены неиспользуемая константа DEFAULT_NEWS и неиспользуемое состояние isLoading. 10 SSR-состояний (данные, фильтры, поиск, раскрытые карточки, битый meta, дубли) совпали с оригиналом побайтно.
`supabase/functions/agent-api/index.ts`: обработчик `Deno.serve` (CCN 20) разбит: конвейер запроса → `app.ts` (без Deno/Supabase, зависимости внедряются, `tests/agentApp.test.mjs`, 15 тестов), связка с реальными модулями → `main.ts`, `index.ts` теперь 3 строки. Деплой-заглушка в Supabase (см. выше) теперь только импортирует `createHandler` из `main.ts` по закреплённому коммиту: при смене кода функции достаточно поменять SHA в заглушке.
Не сделано: визуальная проверка в браузере (модалки Layout, игра, Community), T1–T3, T16–T18 из очереди.

### 2026-10-25 (позже): Claude Sonnet 5.5
Сделано: доска Back Alley (БД, edge function `alley`, страница `/alley/`, самотесты EVM и Solana, тестовые строки удалены); игра перенесена с главной в Community после форума; скрытый H1 и описание в корне всех индексируемых HTML-входов (ответ на ошибку Bing «H1 tag missing»).
Решение владельца: сплиты и комиссия с чужих услуг отменены, только автоматические прямые платежи и донаты (ADR-0003 обновлён).
Не сделано: B3 (MCP-инструменты), B5 (платные действия), T16–T18.

### 2026-10-25: Claude Sonnet 5.5 (сессия 2)
Сделано: меню из 5 групп с выпадающими списками (`src/lib/nav.json` → `NavGroups.tsx` и `seo.mjs`), нижняя панель на телефоне, страница `/map/` (в sitemap), компактный футер, правка текста "no trackers" → "no cookies, only anonymous page counts". Записаны ADR-0001..0003 и `docs/REPOWISE.md`. Подключён Repowise (проиндексировал коммит 500b74e).
Решения владельца: комиссия 10%, кошелёк как у `agent-premium` (ADR-0003).
Не сделано: B2–B6 (Back Alley), T1–T3 (визуальная и продовая проверка).
Индексация: Google не знал о страницах (sitemap не был отправлен). Владельцу даны шаги: отправить sitemap в GSC и Bing, Request indexing для 8–10 URL, поставить внешние ссылки.
Нюанс: изображения и скриншоты из этой среды открыть нельзя (копирование файла падает), меню проверено только по сборке и разметке.

### 2026-10-24: Claude Sonnet 5.5
Сделано: аналитика без cookie (`hit`, `page_hits`), страница «Is GTA 6 out yet?», OG-карточки для новостей/релиза/is-out
(resvg + палитровая квантизация, ~2 МБ), разбивка JS (Hustle по требованию), исходник `hit` сохранён в репозиторий.
Музыка: уже Opus ~85 кбит/с (сделано параллельной сессией), мной не пересжималась, бэкап оригиналов в `backup_muz_original`.
Не сделано: T1–T3 (визуальная и продовая проверка OG, замер Lighthouse после деплоя).
Остановился на: коммит и push, затем отчёт владельцу.
Нюанс: изображения я открыть не смог (ошибка загрузки файла), поэтому дизайн OG не оценён глазами.

## 4. Полезные запросы к `page_hits` (Supabase SQL)
```sql
-- Топ страниц за 7 дней (без ботов)
select path, count(*) hits, count(distinct visitor) uniques
from page_hits where device <> 'bot' and created_at > now() - interval '7 days'
group by path order by hits desc limit 20;

-- Источники трафика
select coalesce(src, referrer, 'direct') source, count(*) from page_hits
where device <> 'bot' and created_at > now() - interval '7 days' group by 1 order by 2 desc;

-- Уники по дням (visitor-хэш ротируется ежедневно)
select date_trunc('day', created_at) d, count(distinct visitor) from page_hits
where device <> 'bot' group by 1 order by 1 desc limit 14;
```
Если у таблицы другое имя колонки времени, посмотри схему: `list_tables`.

## 5. Приватность и границы
- Аналитика не хранит IP и User-Agent, только хэш с ежедневной солью. Не добавляй cookie, localStorage-идентификаторы или сторонние трекеры.
- Никаких фейковых отзывов, накрутки, выдуманных цифр и поддельных «инсайдов»: слухи помечай как Rumors/Leaks, как в `news.json`.
- Платежи/донаты: только реальные реквизиты из `public/data/donate.json`. Не меняй адреса кошельков без прямого указания владельца.
- Платные фичи Claude (расписания, управление браузером/компьютером) на тарифе владельца недоступны.

## 6. Как стартовать новому агенту (шаблон промпта для владельца)
> Прочитай `docs/AGENT-HANDOFF.md` в репозитории vicecityhub/vicecityhub. Возьми верхнюю невыполненную задачу из раздела 2,
> выполни, проверь сборкой (`npm run build && npm run verify:dist`), закоммить в `main`, отметь задачу `[x]` и допиши запись в раздел 3.
> Отвечай мне по-русски в формате таблицы «Модуль / Действие / SEO и маркетинг эффект / Статус».
