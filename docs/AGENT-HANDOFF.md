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
- [x] H2 — вход как на всём хабе (тот же modal Log in / Join). Прямого API PS5 нет; device-login убран с UI (ADR-0005).
- [x] H3 — авто-модерация: лимит 10 загрузок/сутки (триггер), 3 репорта от аккаунтов старше суток скрывают пост.
- [x] H4 — Restream auto-drops: `restream-highlights` cron каждые 3 мин, AI-клипы + спайки чата, публикация на стену (`source=restream`). Нужен один OAuth Connect под аккаунтом VCH (секреты RESTREAM_CLIENT_*).
- [x] H5 — Тексты Highlights: загрузка с телефона/ПК через PlayStation App / USB, без обещания прямого PS5.
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
### 2026-11-08: Claude Sonnet 5.5 (orders.ts: ppCreate, printfulDraft)
- `ppCreate` (CCN 10 -> 3) и `printfulDraft` (11 -> 5): тела запросов вынесены в чистые `ppOrderBody`/`ppShipping` и `pfRecipient`/`pfItems`; порядок проверок (нет позиций -> нет токена -> поиск существующего) прежний.
- Тесты: в `ordersCreate` и `ordersLifecycle` добавлены проверки полного тела и заголовков запросов PayPal и Printful (зелёные на старом коде); всего 414/414.

### 2026-11-07 (4): Claude Sonnet 5.5 (rp-servers: роутер)
- `supabase/functions/rp-servers/index.ts`: `Deno.serve` (CCN 19) разложен на таблицу `ROUTES` («METHOD /path» -> обработчик), `route`, `pathOf`, `lookup`; поведение то же (OPTIONS 204, 404 для чужих методов и путей, 500 `internal_error` на исключение).
- Тесты: `tests/rpServersRoutes.test.mjs` (8), зелёные на старом и новом коде; всего 414/414. Деплой: agent-api v28 (SHA 33ac008, orders.ts), rp-servers v4 (роутер); оба проверены через pg_net (health, lookup 422, index, 404, donate, openapi).

### 2026-11-07 (3): Claude Sonnet 5.5 (orders.ts: priceItems, nextAction)
- `supabase/functions/agent-api/orders.ts`: `priceItems` (CCN 23 -> 9) разложен на `mergeItems`/`parseItem`, `lineFailure` (таблица `LINE_FAILURES`, ленивая: раньше все 5 ошибок собирались на каждую неудачу), `lineRuleError`; `nextAction` (14 -> 3) — таблица `NEXT_ACTIONS` по статусу. Публичные сигнатуры и тип `Priced` не менялись.
- Тесты: `tests/ordersPricingView.test.mjs` (17), зелёные на старом и новом коде; всего 406/406.

### 2026-11-07 (2): Claude Sonnet 5.5 (alley: screen, wallets)
- `screen` (CCN 26) вынесен в новый чистый модуль `supabase/functions/alley/screen.ts` (импортируется из `index.ts` по относительному пути, из стаба по SHA это работает). Таблицы правил `ALWAYS` (hidden, injection, credential, secret-like, scam: для всех, в том числе trusted) и `UNTRUSTED` (payment), затем `linkVerdict` (`urlVerdict`, `badLink`, `isPlainHttps`) и `spamVerdict`. Регулярные выражения перенесены без изменений. Максимум сложности в модуле 6.
- Проверка эквивалентности: дифференциальный прогон новой `screen` против дословной старой копии на 300 000 случайных текстов x 4 уровня доверия = 1,2 млн сравнений, 0 расхождений (все 11 кодов вердиктов встретились). Скрипт одноразовый, не в репозитории; в репозитории табличный тест `tests/alleyScreen.test.mjs` (13).
- `wallets` (9) и `solanaFeePayer` (8): `lookupWallets`, `walletOf`, `lookupFeePayer`, `feePayerOf`, `isFresh`; поведение то же, включая случай «Solana-поиск упал после найденного EVM-адреса» (тест добавлен). В `alley/index.ts` максимум сложности теперь 8 (`identity`, `loadAgent`, `routeGet`).
- Тесты alley 98/98 (старый и новый `index.ts` дают одинаковый результат), всего 389/389. Деплой: alley v5 (SHA 92eef41), проверен через pg_net.

### 2026-11-07: Claude Sonnet 5.5 (ConnectModal.tsx, битые ссылки в доках)
- `src/rp-hub/servers/ConnectModal.tsx` (CCN 21 -> 4): эффект модалки и копирование команды вынесены в хуки `useModalChrome` и `useCopyCommand` (код дословно тот же, порядок хуков тот же), разметка разбита на `Header`, `OneClickOption`, `ConsoleOption`, `LinkRow`, `Stats`, `FeatureChips`; строки статистики собирает `serverStats` (`playersNow`, `orDash`). Состояние «copied» теперь живёт в `ConsoleOption`, на поведение это не влияет.
- Тесты: `tests/connectModal.test.mjs` (2) + золотой снимок серверного HTML 16 вариантов сервера `tests/fixtures/connectModal.golden.json` (обновлять только осознанно: `UPDATE_GOLDEN=1`). Зелёные на старом и новом коде. DOM-окружения (jsdom) в проекте нет, поэтому Esc, фокус и блокировка прокрутки не проверяются автоматически: их код перенесён без изменений.
- Доки: убраны 7 ссылок на несуществующие пути (`docs/AGENT-HANDOFF.md` строка 148: радио теперь `src/lib/radio.ts` и `tests/radio.test.mjs`, коммит `c9f4dbb`; `docs/RP-SERVERS.md`: файлы миграции, селфтеста, мока и генератора страницы удалены из репозитория, вместо селфтеста названы `tests/cfxLive.test.mjs` и `tests/rpServersCron.test.mjs`). Всего тестов 375/375.

### 2026-11-06 (3): Claude Sonnet 5.5 (rp-servers/index.ts)
- `sync` (CCN 20 -> 4): строка обрабатывается `syncRow` (бюджет 45 с, запрос к Cfx.re, затем патч), патч собирают `offlinePatch` (сервер пропал из списка, «dead» через 14 дней без сигнала у active), `sightingFields` (поля, которые обновляет каждое наблюдение) и `conditionalFields` (locale, access, name, возврат dead -> active); счётчики те же, `pool` по 6 тот же.
- `enrich` (CCN 17 -> 6, вложенность 4 -> 2): `checkRowInvite` (сохранённый инвайт, затем тот, что сервер объявляет сейчас, если он другой), `advertisedInvite`, `recordInvite` (валидный обновляет поля, мёртвый очищает, ошибка ничего не меняет). `BUDGET_MS` и `DISCORD_PAUSE_MS` вынесены в константы.
- «I/O в цикле» по `enrich -> checkInvite`: ложное срабатывание. Инвайты Discord проверяются по одному с паузой 400 мс из-за лимитов (429), это намеренный темп, а не N+1; поясняющий комментарий добавлен у константы. Не трогал.
- Не трогал: обработчик `Deno.serve` (CCN 19, это роутер, в этом брифе не значится).
- Тесты: новый загрузчик `tests/helpers/loadRpServers.mjs` и `tests/rpServersCron.test.mjs` (21: throttle 90/600 с, запросы, патчи, dead/revived, бюджет 45 с, не более 6 параллельно, пауза 400 мс, замена инвайта, счётчики). Зелёные на старом и новом коде. Всего 373/373.
- Деплой: `rp-servers` выкачен в Supabase (v3, vendored-файлы, `index.ts` из коммита `1c20c66`; `cfx.ts`, `util.ts`, `discord.ts`, `submit.ts` без изменений). Содержимое v3 сверено с репозиторием.

### 2026-11-06 (2): Claude Sonnet 5.5 (alley/index.ts)
- `paywall` (CCN 25 -> 6) = конвейер этапов: `openOffer` (включено ли x402, `precheck`, есть ли способ оплаты), `paymentRequired` (402), `acceptPayment` (заголовок, версия 2, лимит по IP, выбор варианта), `verifyPayment`, `confirmAndSettle` (повторный `precheck` и `settlePayment`), `receiptFor`, `applyEffect`. Порядок этапов = поведение, ничего не переставлено.
- `listThreads` (20 -> 6): `boardParam`, `limitParam`, `boostedThreads`, `organicThreads`, `replyCounts`, `threadSummary`; порядок фильтров запросов сохранён. `boost` (11 -> 2): `boostDays`, `boostPrecheck`, `applyBoost`. `post` (14 -> 5): `readPost` (запрос и форма) + `admit` (подпись, кошелёк, лимит, скрининг, дубликат через `firstStop`) + сохранение. `postFields` (9 -> 2): `textField` / `signedField` (их же использует `readReport`).
- `saveThread` / `saveReply` (6 и 7 параметров -> 4): условия публикации едут одним объектом `Terms` (`instant`, `status`, `release_at`, `note`) из `publishTerms`.
- «Проглоченные исключения»: два `catch` без обработки (поиск кошельков Hub и feePayer Solana). Теперь пишут `console.warn`; поведение (nulls, опция Solana пропускается на 10 минут) то же. Единственное видимое отличие: строки в логах функции.
- Не трогал: `screen` (CCN 26, в этом брифе не значится), `wallets` (9), `loadAgent` / `identity` / `routeGet` (8).
- Тесты: новый `tests/alleyReads.test.mjs` (10: лимиты, доска, пагинация, пины буста, счётчики ответов, getThread), +4 в `tests/alleyRoutes.test.mjs` (кап и накопление буста, лог продажи, опции оплаты: Solana, feePayer, кэш кошельков) и ещё 1 на warn, +4 в `tests/alleyPost.test.mjs` (типы полей, trim имени, числовой nonce, контракт ответов). Всё, кроме теста на warn, зелёное на старом и новом коде. Всего 352/352.
- Деплой: `alley` выкачен в Supabase (v4, стаб с SHA `d4225f1`, verify_jwt false). Проверка через pg_net: `/threads` 200, `/pricing` 200, `/boost/1?days=9` 400 «days must be an integer 1-7», `/threads/999999` 404, `POST /post` с `chain: btc` 400.

### 2026-11-06: Claude Sonnet 5.5 (rp-servers/cfx.ts)
- `detectFeatures` (CCN 23) = таблица `FEATURE_RULES` [признак, regex по тегам+имени, regex по ресурсам], порядок строк = порядок в выдаче. `toLive` (CCN 29 -> <6) собирается из `readPlayers` / `readLinks` / `readSeen` / `readLocale` / `readVoice` / `readBuild` / `readName` / `readTags` / `readResources`; порядок ключей `Live` сохранён (группы идут подряд, как раньше). `displayTags`: составное условие заменено списком правил `TAG_RULES` + `titleCase`.
- `fetchLive` (I/O in loop): ложное срабатывание, это намеренный повтор запроса (2 попытки одному и тому же коду), не N+1. Не трогал.
- Тесты: новый `tests/cfxLive.test.mjs` (16), написан на старом коде, зелёный на старом и новом. Фиксирует и странности: `\b` в `titleCase` не поднимает «2fast», «élan» -> «éLan».
- Деплой: `rp-servers` выкачен в Supabase (v2, verify_jwt false, vendored-файлы index/util/cfx/discord/submit, cfx.ts из коммита 1f7303c). Проверка через pg_net: `/health` 200 (listed 100, live 99), `/lookup?code=zzzzz` 200 с причиной «Cfx.re does not list this code», `/` отдаёт индекс маршрутов. Следующий cron `/sync` на новом коде обновил 60 серверов (все live, resources_count и last_seen_at заполнены), то есть `toLive` на живых данных работает.

### 2026-11-05 (вечер, 3): Claude Sonnet 5.5 (src/lib/radio.ts)
- `attachAutoResume` (CCN 9 -> 3): попытка старта при монтировании (`tryPlayOnMount`) и обработчик первого жеста (`resumeOnGesture`) вынесены, общее состояние `resumed` лежит в `ResumeState`; `isThenable` вместо дублирующейся проверки `typeof p.then`.
- «Проглоченное исключение»: единственный `catch` был в `restorePosition` (перемотка до готовности медиа). Теперь это `seekTo()`, который возвращает false вместо пустого catch; поведение то же. `playBlocked` (пустой обработчик отклонённого play()) оставлен намеренно: это штатная блокировка автоплея, жест/видимость повторяют попытку; находка по нему остаётся advisory.
- Тесты: +4 в `tests/radio.test.mjs` (play() без промиса, повтор жеста после отказа, жест при уже играющем аудио, снятие слушателей), зелёные на старом и новом коде. Edge-функции не менялись, деплой не нужен.

### 2026-11-05 (вечер, 2): Claude Sonnet 5.5 (NewsCard.tsx)
- `NewsCard` (CCN 18 -> 7) разобран на подкомпоненты в том же файле: `FeaturedRibbon`, `StarRating`, `Gallery` (число колонок через таблицу `GALLERY_COLUMNS`), `CardText`, `CardFooter`; классы карточки в `cardClasses`. Экспорт и пропсы те же.
- Проверка: HTML старой и новой версии сравнён на 150 комбинациях (тег, рейтинг, галерея, featured, источник, свёрнуто/развёрнуто), различий 0. Постоянный `tests/newsCard.test.mjs` (9 тестов) зелёный на обеих версиях; он рендерит именованный экспорт через временный default-entry.
- Edge-функции не менялись, деплой не нужен.

### 2026-11-05 (вечер): Claude Sonnet 5.5 (src/lib/news.ts: getNewsMeta, filterNews)
- `getNewsMeta` (CCN 10) = `hasText` (тег) + `readStars` (importance перекрывает stars, только если число) + `readImages`; `filterNews` (CCN 10) = `matchesTag` + `matchesSearch` по списку `SEARCH_FIELDS`. Поведение и экспорты без изменений.
- Тесты: +2 в `tests/news.test.mjs` (importance/stars крайние случаи, пустые поля и пустой запрос), зелёные на старом и новом коде. Edge-функции не менялись, деплой не нужен.

### 2026-11-05 (позже): Claude Sonnet 5.5 (alley: report)
- `report` (CCN 28) разобран на шаги по образцу `post`: `requestJson` (JSON + лимит по IP, теперь общий с `post`) → `readReport` → `checkReportSignature` → `loadReporter` → `findReported` → `fileReport` / `hideReported`. Порядок проверок = поведение (nonce сжигается последним шагом подписи, лимит репортёра до подсчёта постов).
- Тесты: `tests/alleyReport.test.mjs` (15), написан на старом коде, зелёный на старом и новом. Типы жалоб проверяются через `Object.hasOwn`, не `in` (иначе `constructor` прошёл бы как kind).
- Деплой: см. запись выше (agent-api v26, alley v3).
- Не тронуто: `screen` (CCN 26), `paywall` (25), `listThreads` (18), `post` (14), в брифе их не было. На проде alley всё ещё старый (деплой отдельно).

### 2026-11-05: Claude Sonnet 5.5 (orders.ts: runVerification, captureOrder, submitProof, retryFulfilment, createDonation, createOrder)
- Рефакторинг без смены поведения и сигнатур. `runVerification` теперь только выбирает ветку по вердикту (`settleConfirmed` / `parkPending` / `rejectPayment`); `captureOrder` = `captureRefusal` → `paypalCapture` → `captureIsClean` → `fulfilPaypal` / `holdForReview`; `submitProof` = `proofOrderError` → `readProofInput` → `claimTx` → `manualReview` / `runVerification`; `retryFulfilment` = `retrySkipReason` → `claimAttempt` → `tryPrintful` → `recordRetry`; `createDonation` и `createOrder` = preflight → чтение входа → лимиты/цены → запись.
- Общие куски: `tryPrintful` (был скопирован в 3 местах), `claimKey` (регистр tx-хеша, 3 места), `claimTx` (защита от повторного использования tx, общая для `submitProof` и `settleFromScan`), `OPEN_STATES`. Порядок этапов = поведение (CAS при settle, release claim до ответа об ошибке), не менять.
- Тесты: новый `tests/ordersLifecycle.test.mjs` (43 теста: donation, capture, proof, verify, runVerification, scan, recheck, retry), написан на старом коде и прогнан на обоих вариантах; `tests/helpers/loadOrders.mjs` подменяет `verifyCrypto` (`state.verifyCrypto`) и понимает `ORDERS_FILE`.
- Задеплоено 2026-11-05: agent-api v26 и alley v3, оба stub-ами на коммит 88f45d0 (alley теперь тоже stub: `import` из raw.githubusercontent на закреплённом SHA). Проверка через pg_net: agent-api /v1, /v1/donate, /v1/catalog, /status = 200/404 как раньше; alley /info, /threads = 200, /report и /post отвечают 400 на плохие входы. Деплой = новый SHA в stub (+ тот же минифицированный openapi.json для agent-api), затем pg_net и `npm run test:agent`.
- Остались вне этого прохода: `priceItems` (CCN 23, N+1 ложный: каталог кэшируется), `nextAction` (CCN 14).

### 2026-10-30 (ещё позже): Claude Sonnet 5.5 (orders.ts: validShipping, createIntent)
`supabase/functions/agent-api/orders.ts`: `validShipping` → список правил `SHIPPING_RULES` (порядок = приоритет сообщений об ошибках); `createIntent` → `intentContact` + `intentHowTo`. Находка «N+1 в priceItems» признана ложной: `resolveLine` → `loadMerch` читает кэш изолята (TTL 10 мин, single-flight), а `saveSnap` вызывается только при обновлении кэша, не на каждую позицию; `loadDbItems` кэшируется на 60 с. Находка про длину `createOrder` устарела (после прошлого рефакторинга функция 24 строки).
Тесты: `tests/ordersIntent.test.mjs` (8: `createIntent` и все правила доставки), проходят на коде до и после правки. Всего 241 тест.
НЕ задеплоено: v25 на проде содержит `createOrder`-рефакторинг, но не этот. Для выкладки: пин заглушки на новый SHA + `npm run test:agent`. Откат: `git revert` коммита этой записи.

### 2026-10-30 (позже): Claude Sonnet 5.5 (alley: роутер, verifySig, paywall)
`supabase/functions/alley/index.ts`: обработчик `Deno.serve` разбит на `handle` / `route` / `routeGet` + таблица `POST_ROUTES`; `verifySig` → `verifyEvm` / `verifySolana` / `decodeSolanaSignature`; `paywall` принимает объект `Offer` вместо 4 скалярных параметров (функция внутренняя, не экспортируется). Поведение не менялось.
Тесты: `tests/alleyRoutes.test.mjs` (19: маршруты и методы, подписи EVM/Solana, весь путь x402: 503/402/ошибки заголовка/verify/settle/повторная проверка/успех boost и verified, провал эффекта) вместе с `alleyPost.test.mjs` проходят на исходном коде (47) и на новом. Всего 233 теста.
НЕ задеплоено: боевая `alley` на прежней версии. Откат: `git revert` коммита этой записи.

### 2026-10-30: Claude Sonnet 5.5 (деплой agent-api v25)
В Supabase выложена v25 (заглушка, пин на `fecb182d8879355f7686cdab1abf3b5220acc876`, новый `createOrder`). Проверено живыми запросами через SQL: `/v1`, openapi.json (19087 байт), catalog, news, donate, x402 (402), MCP tools/list, заказ без ключа (401), статус неизвестного заказа (404). Платёжный сценарий `createOrder` с ключом вживую не гонялся: для него запустите `npm run test:agent` локально. Откат: передеплой заглушки с SHA `5baca514739fd6f39747cb89b0293a6221cc59bb` (v24).

### 2026-10-29 (поздно вечером): Claude Sonnet 5.5 (`createOrder` в agent-api по находкам Repowise)
`supabase/functions/agent-api/orders.ts`: `createOrder` (CCN 37) стал конвейером: `findByIdempotencyKey` + `replayed`, `orderSource` (котировка), `priceDrift`, `collectRequirements` (таблица `REQUIREMENT_READERS`: shipping / delivery.wallet_address / details.store_name), `storeOrder` (гонка по уникальному ключу отдаёт победителя), `startPaypal` (отказ PayPal помечает заказ failed). Порядок этапов = поведение, записан комментарием. Экспорты и сигнатуры не менялись; `createDonation` и остальной файл не трогали.
Тесты: `tests/ordersCreate.test.mjs` (16, каждая ветка `createOrder`, включая PayPal через подменённый fetch), загрузчик `tests/helpers/loadOrders.mjs`. Те же 16 тестов проходят и на исходном коде из `HEAD`. Всего 214 тестов.
НЕ задеплоено: боевая agent-api (v24) работает на прежнем коде; новый код подхватится только после передеплоя заглушки с новым SHA (см. запись про v23/v24) и прогона `npm run test:agent`. Не проверено: Deno-типизация (в песочнице нет deno). Откат: `git revert` коммита этой записи.

### 2026-10-29 (вечер): Claude Sonnet 5.5 (`post` в edge function alley по находкам Repowise)
`supabase/functions/alley/index.ts`: `post` (CCN 68) превращён в конвейер этапов (`readJson`, `postFields`, `checkShape` + таблица `SHAPE_RULES`, `checkSignature`, `loadAgent`, `checkHourlyLimit`, `checkScreening`, `isDuplicate`, `publishDecision`, `publishTerms`, `saveThread`/`saveReply`). Порядок этапов = поведение (дешёвые проверки, подпись до страйков, дубликаты до очереди), это записано комментарием в коде. Остальной файл (`report`, x402, boost, verify) не трогали.
Тесты: `tests/alleyPost.test.mjs` (28, каждая ветка `POST /post` на подставной БД через `tests/helpers/loadAlley.mjs`, esbuild подменяет esm.sh и `Deno`). Те же 28 тестов проходят на исходном коде из `HEAD`, т.е. это тесты на поведение, а не на новую реализацию. Всего 198 тестов.
НЕ задеплоено: в Supabase работает прежняя версия `alley` (логика эквивалентна). Выкатывать только по просьбе владельца; после выкладки прогнать `node scripts/alley-selftest.mjs` (нужен `ethers`). Не проверено: Deno-типизация (в песочнице нет deno). Откат: `git revert` коммита этой записи.

### 2026-10-29 (позже): Claude Sonnet 5.5 (useArcadeInput по находкам Repowise)
`src/components/arcade/useArcadeInput.ts` (CCN 17, составное условие в `keyDown`): смысл клавиш и касаний вынесен в `src/lib/arcadeInput.ts` (`steerSide` по таблице, `canStartRun`, `touchSide`, `createInputHandlers`), хук только подписывает обработчики. Сигнатура хука не менялась. `tests/arcadeInput.test.mjs`, 8 тестов (всего 170). Не проверено: управление пальцем на телефоне в браузере. Откат: `git revert` коммита этой записи.

### 2026-10-29: Claude Sonnet 5.5 (Highlights.tsx по находкам Repowise)
`src/pages/Highlights.tsx` (388 строк, `Highlights` CCN 94) разбит, поведение не менялось. Страница теперь только собирает блоки (~35 строк).
Чистые правила (типы файлов, лимиты, тексты ошибок, пагинация, лайки, коды входа) → `src/lib/highlights.ts` (`tests/highlights.test.mjs`).
Сеть: `src/components/highlights/{storage,poster,api,uploadFlow,deviceLogin}.ts` (`xhrUpload` разбит на мелкие функции), состояние: `use{Gallery,Upload,DeviceLogin,ConsoleLink}.ts`, разметка: `Gallery`, `HighlightCard`, `UploadPanel`, `SignInPanel`, `LinkPanel`, `PlatformGuide`, `HighlightsHeader`.
Тесты: `tests/highlightsApi.test.mjs` (fake XHR/fetch/Supabase через `tests/helpers/bundleTs.mjs`), `tests/highlightsPage.test.mjs` (SSR). Всего 162 теста в `npm run test:unit`.
Проверка: HTML страницы до и после рефакторинга сравнён побайтно в 27 состояниях (гость, консоль, ожидание кода, форма, прогресс, ошибки, код с телефона, стена с лайками/репортами/своими постами): 0 различий.
Не проверено: реальная загрузка файла и вход по коду в браузере/на консоли (песочница без доступа к supabase.co). Откат: `git revert` коммита этой записи.

### 2026-10-27: Claude Sonnet 5.5 (рефакторинг по находкам Repowise)
Сделано: разбиты 7 функций с критичными находками Repowise (Layout 1588 → 105 строк, Home, PostDetail, PostCard, Community, `loop` в ViceArcadeGame, `route` в agent-api). Один коммит на файл, каждый откатывается отдельно (`git revert <sha>`). Поведение не менялось: Layout сверен с оригиналом по HTML 31 состояния (SSR-слепки), остальное покрыто юнит-тестами.
Тесты: появилась команда `npm run test:unit` (встроенный `node:test`, без новых зависимостей, 90 тестов в `tests/`). Чистая логика вынесена в `src/lib/*.ts` и `supabase/functions/agent-api/router.ts`. Перед коммитом: `npx tsc --noEmit -p tsconfig.app.json; npm run test:unit; npm run build; npm run verify:dist`.
Деплой agent-api: в Supabase выложена v23 (2026-10-27). Из-за размера (~170 КБ) задеплоен «заглушкой»: локально только `index.ts` и `openapi.json` (минифицирован), остальные модули (`lib`, `handlers`, `orders`, `router` и др.) импортируются с raw.githubusercontent.com по закреплённому коммиту b764fb3. Откат на прежний код: `git show e319ff2:supabase/functions/agent-api/index.ts` (+ те же файлы того коммита) или заглушка с коммитом e319ff2. Смоук-тест `scripts/test-agent-api.mjs` из песочницы не запускался (прокси блокирует supabase.co); вместо него через pg_net проверены 13 запросов (/v1, openapi, catalog, news, search, donate, rp, agents/me=401, неизвестный путь=404, статус заказа=404, заказ без ключа=401, MCP tools/list=25 инструментов, POST /v1/quotes без ключа=401), все как ожидалось. Полный `node scripts/test-agent-api.mjs` стоит прогнать с обычного компьютера.
Ещё в этой сессии (2026-10-28): `src/pages/RPHub.tsx` разбит (радио → отдельный модуль (позже, в `c9f4dbb`, заменён единым радио Leonida FM: `src/lib/radio.ts`), шапка/заголовок/подвал → `src/rp-hub/components/Rp*.tsx`, вкладки — таблица `TAB_VIEWS`, фоны → `src/lib/rpTabs.ts`), тесты радио (сейчас `tests/radio.test.mjs`), HTML страницы совпадает с оригиналом побайтно. `Layout.tsx` укорочен ещё (состояние оверлеев → `layout/useShellModals.ts`, аккаунт → `layout/useAccountArea.ts`), добавлены парные тесты `tests/layout.test.mjs` (SSR-хелпер `tests/helpers/renderTsx.mjs`), 31 SSR-состояние совпадает с оригиналом. Потом по просьбе владельца: радио стало единым — `src/lib/radio.ts` (+ тесты `tests/radio.test.mjs`), хук `components/layout/useRadio.ts` используют и Layout, и RP Hub (отдельное RP-радио удалено; на RP Hub теперь сохранение каждую секунду + номер трека, как на остальных страницах). Битые символы в подзаголовке RP Hub исправлены (дефисы).
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
