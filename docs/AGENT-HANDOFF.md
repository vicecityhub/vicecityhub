# AGENT HANDOFF: Vice City Hub

Единая точка входа (контекст-память проекта и Repowise: docs/REPOWISE.md, решения: docs/decisions/) для любого агента/модели (Claude, GPT, Gemini, Codex и т.д.), которые продолжают проект,
пока у основного агента сброшены лимиты. **Прочитай этот файл первым. Обнови его в конце своей сессии.**

Язык общения с владельцем (Ser): только русский. Язык интерфейса сайта: американский английский с ядовитым GTA-сарказмом.
Принцип: «действуй, затем докладывай». Не выдумывай данные (никаких фейковых онлайн-счётчиков, цен, кодов серверов).

## 0. Как работать
- Репозиторий: github.com/vicecityhub/vicecityhub, пушить **только в `main`**. Сайт: https://vicecityhub.github.io/vicecityhub/
- Локально: `C:\Users\sarma\Documents\deployd\hub`. Supabase project ref: `lpglkglhjdqnktybksth`.
- PowerShell пользователя имеет `NODE_ENV=production`: перед установкой делай `$env:NODE_ENV=''; npm install --include=dev`.
- Проверка перед коммитом: `npm run typecheck; npm run test:unit; npm run build; npm run verify:dist` (всё должно быть PASS). Если трогал `src/shell/`, `mountPage`, общий скрипт статических страниц или добавлял тип страницы: ещё `node scripts/e2e-shell.mjs` (см. журнал 2026-11-22).
- `prebuild` сам запускает: `build-shell` (`public/vch-shell.js` из `src/shell/`) → `gen-agent-surface` → `gen-og` → `gen-seo-pages`. Каждая страница обязана подключать `vch-shell.js`, переходы между страницами делает он: в коде страниц не писать `location.href =` и `location.reload()` (есть `navigateTo`/`refreshPage` в `src/lib/shellBridge.ts`).
- Страница новости `/n/<id>-…/` живёт, пока её история есть в живой ленте (`public/data/news.json`, в CI это только последние ~12) или в архиве `scripts/data/news-archive.json` (не публикуется). Чтобы новость осталась страницей после выпадения из ленты: `node scripts/gen-seo-pages.mjs --archive` и закоммитить архив. Страница без данных не пересобирается и остаётся в старом шаблоне (`WARN` в `verify:dist`).
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
| ИИ-поддержка и анализ | `HubAIWidget` (Support Chat + Neural Search + Recent Searches в `Layout.tsx`), `HubQueryAnalyticsPanel` (`agents.html#ai-analytics`, алерты аномалий, UX-отчёт), Edge Function `ai-support` (`--no-verify-jwt`, `GEMINI_API_KEY`), таблица `ai_query_analytics` |
| OG-картинки | `scripts/gen-og.mjs` → `public/og/<id>.png` (28 шт., ~2 МБ), `release.png`, `is-out.png` |
| Монетизация | Платные слоты RP ($100/$200/$300), Ko-fi + Wall of Legends, x402 `agent-premium` ($0.02 USDC) |
| Агентная поверхность | llms.txt, MCP, agent-api, `docs/MCP-LISTINGS.md` |
| Музыка | Бакет `muz`: плейлист строится листингом бакета (нужна политика `muz_public_read`, см. `supabase/16_muz_public_read.sql`). С 2026-11-10 там два трека владельца (10,5 и 13,2 МБ) вместо прежних 1–5.ogg (Opus ~85 кбит/с). Радио живёт в общей оболочке `public/vch-shell.js` (исходники `src/shell/`, ADR-0006): один `<audio>` на всё время вкладки, страницы переключаются без перезагрузки, поэтому музыка не прерывается и на телефоне не просит нового касания. Проверка: `tests/shellRadio.test.mjs`, `tests/shellNav.test.mjs`, блок оболочки в `verify:dist`, `scripts/e2e-shell.mjs` (настоящий Chromium). Выключатель: `?softnav=off`. Страницы старых новостей `/n/<id>-…/` пересобираются из архива `scripts/data/news-archive.json` (запись 2026-11-23), поэтому они тоже на общей оболочке |

Удалено осознанно (не возвращать): рассылка (нет домена отправки), счётчики онлайна RP-серверов, генераторы доменов/мерча,
партнёрки/спонсоры, сценарии для YouTube, автопостинг в Telegram/Discord (владелец отказался: пункт 4),
плашка Gift Set на главной (владелец заменил её плашкой стрима, 2026-11-11), таймер обратного отсчёта и плашка анонса стрима с трейлером и кнопкой Twitch на главной (владелец убрал таймер и заменил плашку на «Полное прохождение», 2026-11-24).

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
- [ ] T19 · P0 · Проверить на реальных телефонах (iPhone Safari, Android Chrome), что музыка не обрывается и не просит нового касания при переходах между разделами (React-страницы и статика: `/n/`, страницы старых новостей `/n/43xx-…/`, `/vehicles/`, `/map/`), что «назад/вперёд» работают, а Market `?p=slug` и профиль ведут себя как раньше. Готово: владелец подтвердил или прислал консоль с `?softnav=on`. В песочнице проверено только настоящим Chromium (`scripts/e2e-shell.mjs`, журнал 2026-11-22).

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

### 2026-11-24: Claude Sonnet 5.5 (главная: таймер убран, вместо плашки стрима плашка «Полное прохождение»)
- По просьбе владельца: таймер на главной убран, плашка анонса стрима заменена плашкой с полным прохождением игры. Ссылка владельца: плейлист «GTA 6 STORY MODE // Full Walkthrough & Gameplay (Let's Play)» канала VICE CITY HUB (при проверке 14 видео): `https://www.youtube.com/playlist?list=PLChbuGXLVT8w`. Служебный параметр `si=` из ссылки для шаринга не перенесён (он только помечает, кто поделился). ID в ссылке короче обычных, но страница открылась и показала плейлист; если по клику что-то не так, менять нужно одну строку: `WALKTHROUGH_URL` в `src/components/home/WalkthroughBanner.tsx`.
- Что сделано: новый `src/components/home/WalkthroughBanner.tsx` стоит в `HeroSection` между описанием и кнопками «Explore Hub / Become a Member», во всю ширину контейнера (до 1280 px). Слева постер: чистый SVG в духе Вайс-Сити (закат с полосами, сетка, силуэт города, две пальмы, кнопка Play с пульсирующим кольцом, `motion-reduce` отключает пульс), справа заголовок, короткий текст с сарказмом (американский английский), кнопка «Watch the Playlist» и строка «Free on YouTube. No paywall, no battle pass, no crypto broker.» Обе ссылки открывают плейлист в новой вкладке (`rel="noopener noreferrer"`); ссылка на постере скрыта от клавиатуры и скринридеров (`tabindex="-1"`, `aria-hidden`), чтобы не дублировать кнопку. Ни iframe, ни превью с YouTube: при загрузке главной нет ни одного запроса к YouTube (в отличие от прежней плашки), страница стала легче.
- Удалено: `StreamBanner.tsx` (трейлер `qL266kKP5E4` и кнопка Twitch), `useCountdown.ts`, блок счётчика в `HeroSection`, функции `computeTimeLeft`, `COUNTDOWN_INITIAL`, `RELEASE_DATE_MS` из `src/lib/homeLogic.ts` с их 4 тестами, CSS `.countdown`/`.cd-*` (и мобильный блок) из `src/index.css`, `tests/streamBanner.test.mjs`. Таймер на главной считал до 19.11.2026 и после этой даты просто стоял на нулях. Файл `public/media/twitch-logo.jpeg` (4 КБ) остался на случай, если плашка стрима вернётся; ссылки на Twitch на главной больше нет.
- Не менял (владелец просил только главную): страницы `gta-6-release-date/` и `is-gta-6-out-yet/` со своим счётчиком и фактами из `site.config.json -> release` (дата 2026-11-19, проверена 2026-10-23); при необходимости обновить их отдельно.
- Тесты: новый `tests/walkthroughBanner.test.mjs` (9: обе ссылки с `rel` и без `si=`, кнопка единственная именованная ссылка, ничего стороннего не грузится, SVG с уникальными `id` и рабочими ссылками, `motion-reduce`, на главной нет счётчика и Twitch, порядок: заголовок, плашка, кнопки). Всего 495 из 495, `tsc`, `build`, `verify:dist` зелёные. Вид проверен в настоящем Chromium (десктоп 1440 и iPhone 13): без горизонтальной прокрутки, баннер на всю ширину, на телефоне колонкой.
- Не проверено: Lighthouse главной (T3) и вид на реальных телефонах.

### 2026-11-23: Claude Sonnet 5.5 (старые страницы новостей `/n/43xx/` больше не рвут музыку: архив новостей)
- Что показал CI после выкладки оболочки (`208e687`): `WARN 26 stale static page(s)`. 26 страниц `public/n/4372…4397` лежат в git в шаблоне до оболочки: свой `<audio>`, нет `vch-shell.js`. Живая лента в CI (`/v1/news`) отдаёт только последние 12 новостей, поэтому генератор их не пересобирал, и вход на такую страницу или выход с неё был обычной загрузкой документа: музыка начиналась заново, а на телефоне нужно было новое касание. То есть жалоба владельца для этих страниц оставалась в силе.
- Проверено до правки: содержимое этих 26 страниц совпадает с тем, что даёт пересборка из тех же данных (сверено по заголовку, описанию, canonical, og:image, JSON-LD NewsArticle, тексту статьи и списку связанных ссылок); отличается только шаблон. Поэтому не чинил HTML вслепую, а сохранил данные: `scripts/data/news-archive.json` (26 историй, как их отдаёт лента на момент коммита; лежит вне `public/`, на сайт не публикуется).
- Как работает: `scripts/lib/news-archive.mjs` (`mergeNews`: живые + архивные, одна запись на id, живая копия побеждает, порядок как раньше; `readArchive`; `writeArchive`). `scripts/gen-seo-pages.mjs` строит страницы из слияния, поэтому архивная новость пересобирается на актуальном шаблоне при КАЖДОЙ сборке (оболочка, общий радио-скрипт, шапка, футер, AI-виджет) и снова попадает в архив `/n/`, sitemap и RSS (в CI их там не было: туда попадали только 12 живых). OG-картинки `public/og/43xx.png` уже в git. Страница без данных (нет ни в ленте, ни в архиве) остаётся как есть: сообщение `[seo] N news page(s) have no story data…` и `WARN` в `verify:dist`.
- Как оставить новость страницей после выпадения из ленты: `node scripts/gen-seo-pages.mjs --archive` (дописывает в архив всё, что сейчас в `public/data/news.json`; живая копия побеждает) и закоммитить `scripts/data/news-archive.json`. Автодобавление из CI не делалось: CI ничего не коммитит в этот репозиторий. Прежнее поведение осталось: новость, которой нет ни в ленте, ни в архиве, исчезает из сайта при следующем деплое.
- `verify:dist` строже: только для страниц новостей `n/<id>-…/index.html` без `data-vch-radio` остаётся `WARN`; любая другая страница без маркера теперь `FAIL` (раньше сбой генератора прошёл бы деплой лишь с предупреждением).
- Проверки: `tests/newsArchive.test.mjs` (19): слияние, чтение/запись архива, целостность файла, и реальный запуск генератора в чистой копии (архивная история получает страницу текущего шаблона рядом с живой; ссылки в `/n/`, sitemap, RSS; старая копия перезаписывается; сирота не трогается и попадает в сообщение; без архива не падает; `--archive`); три намеренные поломки (архив игнорируется, архив побеждает живую копию, нет сообщения о сироте) тесты ловят. Прогон «как в CI» (старые 26 страниц из git, живая лента из 3 новостей): typecheck, 494 теста, build, `verify:dist` без `WARN`, `[seo] 26 news pages (3 live, 23 from the archive)`. `scripts/e2e-shell.mjs` теперь проходит и через страницу новости (вход из `/n/`, уход в другой раздел; на телефоне тапом по карточке, меню при этом не открывается): 163/163 в настоящем Chromium (было 159). С подложенной в `dist` старой страницей проверка падает (новый документ, музыка с нуля), то есть ловит именно эту ошибку.
- Не проверено на реальном телефоне (см. T19). Не делалось: бейдж Twitch live; пережатие больших файлов `muz`.

### 2026-11-22: Claude Sonnet 5.5 (музыка не обрывается при переходах: общая оболочка `vch-shell.js` и переходы без перезагрузки)
- Жалоба владельца: на телефоне музыка играет, но после перехода в другой раздел звук отключён до нового касания. Нужно: после первого касания играть плавно дальше по всем разделам. Прежние требования те же: тот же трек при переходах, новый только когда закончился прежний, порядок случайный.
- Причина: каждый раздел это отдельный HTML-документ, переход по меню загружал новый документ и создавал новый `<audio>`. Десктопный Chrome часто переносит пользовательскую активацию между страницами одного сайта, а iOS Safari и строгие WebView нет: новому элементу нужно своё касание. Запоминание трека и секунды (`72f7ebd`) скрывало рестарт, но не тишину.
- Решение (подробно: `docs/decisions/ADR-0006-persistent-shell-and-soft-navigation.md`): один скрипт `public/vch-shell.js` (собирается из `src/shell/` скриптом `scripts/build-shell.mjs` в начале `prebuild`/`predev`; подключён на ВСЕХ страницах, кроме `reset-password.html`, ссылкой с хешем `?v=`) держит единственный `<audio>` (радио: `src/shell/radio.ts`, плейлист: `playlist.ts`) и сам переключает страницы без перезагрузки документа (`softNav.ts`, правила: `navRules.ts`): забирает страницу через `fetch`, готовит стили и модуль страницы, затем одним синхронным шагом меняет `<head>` и `<body>`, добавляет запись в историю и запускает страницу. Любой сбой означает обычный переход (`location.assign`), то есть худший случай такой же, как раньше. «Назад/вперёд» и положение прокрутки работают.
- Что изменено: 11 входов `src/main-*.tsx` теперь `mountPage(import.meta.url, …)` (`src/lib/mountPage.tsx`); вместо `location.href=`/`reload()` везде `navigateTo`/`refreshPage` (`src/lib/shellBridge.ts`); `useRadio` стал привязкой к `window.vchShell.radio`, кнопки радио помечены `data-vch-radio`; статические страницы (`scripts/lib/seo.mjs`): тег оболочки стоит перед общим inline-скриптом, который теперь безопасно запускается повторно после каждого перехода, своего радио-кода в нём нет; `public/ai-widget.js` убирает свои стили при уходе со страницы; `scripts/gen-seo-pages.mjs`: `/supporters/` при недоступных данных перерисовывается из сохранённого содержимого по актуальному шаблону. Удалены `src/lib/radio.ts`, `src/lib/AudioManager.ts`, их тесты и `shouldResumeOnVisible`.
- Заодно исправлено: счётчик пропуска битых треков сбрасывался на событии `play` (оно приходит при вызове `play()` даже для файла, который не загрузится), и бакет из битых файлов пропускался бы бесконечно; теперь сброс по `playing`. Тест это ловит (`tests/shellRadio.test.mjs`).
- Выключатели: `?softnav=off` / `?softnav=on` (запоминается в `localStorage.vch_softnav`) выключает/включает переходы без перезагрузки в этом браузере; `data-vch-hard` или `rel="external"` на ссылке даёт обычный переход; dev-сервер Vite страницы не подменяет. Консоль при откате на обычный переход: `[vch-shell] soft navigation failed, loading the page normally: …`.
- Проверки: `npm run typecheck`, `npm run test:unit` (475: новые `tests/shellNav.test.mjs` 23 и `tests/shellRadio.test.mjs` 46), `npm run build`, `npm run verify:dist` PASS. В `verify:dist` новый блок: `vch-shell.js` собран, это обычный скрипт, на каждой странице стоит ровно один раз с актуальным хешем и раньше скрипта, которому он нужен, своей копии радио нигде нет. Страница-снимок от старого шаблона (новость, которой уже нет в данных) даёт только `WARN`: на ней оболочки нет и уход с неё это обычный переход. (Обновлено 2026-11-23: истории старых новостей лежат в архиве `scripts/data/news-archive.json` и пересобираются, `WARN` остаётся только для страниц без данных.)
- Настоящий браузер: `npm run build && node scripts/e2e-shell.mjs` (Playwright + ffmpeg, в CI не входит). Chromium с `--autoplay-policy=document-user-activation-required` (так ведут себя телефоны), профили десктоп и iPhone 13, 159 проверок: один `<audio>`, нет паузы, нет нового документа и нового `src` по всем разделам (React и статика), назад/вперёд, смена трека по окончании без жеста, mute, запасные пути; с `?softnav=off` старая ошибка воспроизводится (значит, проверка её ловит). Прогонять после любых правок `src/shell/`, `mountPage`, общего скрипта статики или нового типа страницы.
- **Не проверено на реальном телефоне** (в песочнице его нет). Ожидание: первое касание на свежем документе нужно один раз (ввод адреса, обновление, переход по ссылке с другого сайта, `reset-password.html`, устаревшая страница-снимок): это правило автовоспроизведения, его не обойти; дальше переходы по разделам без обрыва. Если на iPhone звук всё же пропадает при переходе: открыть сайт с `?softnav=on`, смотреть консоль.
- Не делалось: бейдж Twitch live; пережатие новых больших файлов `muz` (10,5 и 13,2 МБ) в Opus ~85 кбит/с; миграция устаревших страниц-снимков (сделано 2026-11-23 иначе: архив новостей, см. запись выше).

### 2026-11-15: Claude Sonnet 5.5 (радио Leonida FM: плейлист из muz снова играет)
- Причина тишины после замены музыки: список треков сайт берёт запросом `POST /storage/v1/object/list/muz`, а у бакета `muz` не было политики чтения на `storage.objects` (у `photos`, `player-media`, `post-media` она есть). Прямые ссылки публичного бакета работают без политики, а list-эндпоинт без неё отдаёт `[]` для anon. Радио молча брало запасной список `1.ogg`/`2.ogg`; после замены файлов их не стало (HTTP 400). Вероятно, та же причина стояла за прежней жалобой «играют только две старые мелодии».
- В базе (применено на проде 2026-11-13): политика `muz_public_read` (select, `to public`, `bucket_id = 'muz'`), SQL в `supabase/16_muz_public_read.sql`. Проверено запросами: list отдаёт оба новых трека, ссылки с пробелами, скобками и двойным пробелом в именах дают 200 `audio/ogg`, запросы с `Range` дают 206, `Cache-Control: max-age=3600`.
- В коде (`72f7ebd`): `AudioManager.ts` запоминает последний рабочий плейлист в `localStorage` (`radioTracks`), и на следующей странице сохранённый трек ставится сразу, без ожидания запроса списка при каждом переходе (раньше `play()` при монтировании вызывался до того, как у `<audio>` появлялся `src`). Если трека уже нет в бакете, после ответа списка подставляется существующий. Запасных `1.ogg`/`2.ogg` больше нет ни в приложении, ни в `scripts/lib/seo.mjs` (статические страницы читают тот же кэш). Тесты: `tests/audioManager.test.mjs` (12). tsc, юнит-тесты, build, verify:dist: PASS; Actions success; на проде проверены бандл приложения, статическая страница и листинг бакета.
- Если музыка снова молчит: сначала `POST /storage/v1/object/list/muz` с anon-ключом (должен вернуть файлы) и проверить, что политика `muz_public_read` на месте (пропадёт, если бакет пересоздать).
- Известно, не делалось: около 36 старых страниц `public/n/43xx` (новости, которых нет в БД) не перегенерируются и сохраняют прежний скрипт радио со старым запасным списком; на работу не влияет, список теперь отдаётся. (Решено 2026-11-23: архив новостей, запись выше.) Новые файлы в `muz` (10,5 и 13,2 МБ) в 3–4 раза тяжелее прежних `1–5.ogg` (Opus ~85 кбит/с): для мобильного трафика их стоит пережать так же. На телефоне не проверено: возобновление звука после перехода между страницами упирается в правила автовоспроизведения браузера (iOS Safari может ждать первого касания; код возобновляет с того же трека и секунды по первому касанию).

### 2026-11-13 UTC: Глобальный AI-виджет на всех страницах + поиск по интернету
- **Покрытие всего хаба**:
  - React-страницы без `Layout.tsx`: `HubAIWidget` подключён в `src/pages/RPHub.tsx` (`rp.html`) и `src/main-reset-password.tsx` (`reset-password.html`).
  - Все статические SEO/утилитарные страницы (`/n/*`, `/vehicles/*`, `/alley/`, `/map/`, `/gta-6-release-date/`, `/is-gta-6-out-yet/`, `/supporters/`): добавлен лёгкий автономный скрипт `public/ai-widget.js` в `scripts/lib/seo.mjs` (переносится в `dist/` при `npm run build`, разделяет историю `vch_recent_searches_v1` в `sessionStorage`).
- **Поиск по интернету (Web Grounding + Free Web Fallback)**:
  - В `HubAIWidget.tsx`, `public/ai-widget.js` и `src/lib/aiSupport.ts` добавлен переключатель режима `Web: Auto / Web: On / Hub Only` и отображение кликабельных ссылок **Web Sources**.
  - В Edge Function `supabase/functions/ai-support/index.ts` добавлена поддержка нативного `googleSearch` в Gemini + быстрый бесплатный живой веб-поиск через Google News RSS и Wikipedia API с синтезом ответа в Gemini (и детерминированным фолбэком `200` при исчерпании бесплатных лимитов RPM).
- **Проверки**: `npm run typecheck`, `npm run test:unit`, `npm run build`, `npm run verify:dist`, live smoke-test `ai-support` (web search + RU/EN chat + analytics; тестовые строки удалены).

### 2026-11-12 / 2026-11-13 UTC: Gemini AI Integration (виджет поддержки, нейропоиск, аналитика и деплой Supabase)
- **Фронтенд (`main`, коммит `eb20482`)**:
  - `src/lib/aiSupport.ts` + `src/components/HubAIWidget.tsx` подключены в `src/components/Layout.tsx` после `SiteFooter` (левый нижний угол, не перекрывает `Toasts` справа и не ломает порядок DOM в `tests/layout.test.mjs`): чат поддержки и нейропоиск по живым JSON-фидам хаба (`news`, `catalog`, `rp-servers`, `rp-factions`, `rp-jobs`, `rp-mods`), плюс компактный сессионный виджет **Recent Searches** (`sessionStorage`, до 8 уникальных запросов, повтор в 1 клик). Интерфейс на American English с автоответом на языке пользователя (RU/ES/EN и др.).
  - `src/components/HubQueryAnalyticsPanel.tsx` встроен в `src/pages/Agents.tsx` (секция `#ai-analytics`): live-классификация запросов, детектор аномалий (статус-баннер и всплывающие alert-уведомления при всплеске негатива ≥40% или резком росте темы ≥35%) и кнопка **Generate UX Report**.
- **Сервер в Supabase (`lpglkglhjdqnktybksth`)**:
  - Применена миграция `supabase/16_ai_support_analytics.sql`: таблица `public.ai_query_analytics` с индексами, RLS включён, прямые права `anon`/`authenticated` отозваны.
  - Прописан секрет `GEMINI_API_KEY` в Supabase Secrets, функция `supabase/functions/ai-support/index.ts` зарегистрирована в `supabase/config.toml` (`verify_jwt = false`) и задеплоена (`ai-support`).
  - Цепочки моделей Gemini настроены на актуальные рабочие модели (`gemini-3.5-flash-lite` / `gemini-3.1-flash-lite` для быстрого поиска/чата/классификации и `gemini-4-hydrogen` для глубокого UX-отчёта) с фолбэком по статусам `404/429/5xx` и `await` записи аналитики в БД. Проверка: `search`/`analytics`/`insights` отдали `200`, тестовая строка удалена.
- **Инструкция для следующих агентов**: для обновления Edge Function используй `npx supabase functions deploy ai-support --no-verify-jwt --project-ref lpglkglhjdqnktybksth`. Секрет `GEMINI_API_KEY` хранится только в Supabase Secrets (и в CI/AI Studio не коммитится).
- **Тесты**: `tests/aiSupport.test.mjs` (3 теста), `npm run typecheck`, `npm run test:unit` (421/421), `npm run build`, `npm run verify:dist` — PASS. Откат: `git revert eb20482`.
### 2026-11-11: Claude Sonnet 5.5 (главная: плашка стрима вместо Gift Set)
- По просьбе владельца плашка Gift Set убрана: `GiftSetBanner.tsx` и `public/media/pozor.webm` (1,6 МБ, нигде больше не использовался). `LazyVideo.tsx` остался без пользователей, не трогал.
- Новая плашка `src/components/home/StreamBanner.tsx` стоит в `HeroSection` между описанием и счётчиком, во всю ширину контейнера (до 1280 px): слева трейлер стрима (YouTube `qL266kKP5E4` через `YouTubePlayer`, до клика с YouTube ничего не грузится), справа кнопка на https://www.twitch.tv/vicecityhub со значком `public/media/twitch-logo.jpeg`. Значок: присланная картинка 1920x1080 (логотип в ней растянут по горизонтали) сжата в квадрат 128x128 (4 КБ) и лежит в репозитории, чтобы не зависеть от подписанной ссылки Supabase (`logos/tvitch.jpeg`, истекает в ноябре 2027).
- Бейджа «LIVE» нет сознательно: страница не знает, идёт ли эфир. Статус эфира потребует серверного запроса к Twitch API (не делалось).
- Тесты: `tests/streamBanner.test.mjs` (4: ссылка с `rel`, значок, превью без iframe, плашка между заголовком и счётчиком). tsc, юнит-тесты, build, verify:dist: PASS. Деплой: коммит 822bd45, Actions success; в собранном `dist` есть id трейлера и ссылка на Twitch, упоминаний Gift Set нет.
- Не проверено: вид в браузере (десктоп и телефон) и Lighthouse главной (T3): плашка выше сгиба, превью-картинка ленивая, но замера не было. Откат: `git revert 822bd45`.

### 2026-11-08: Claude Sonnet 5.5 (orders.ts: ppCreate, printfulDraft)
- `ppCreate` (CCN 10 -> 3) и `printfulDraft` (11 -> 5): тела запросов вынесены в чистые `ppOrderBody`/`ppShipping` и `pfRecipient`/`pfItems`; порядок проверок (нет позиций -> нет токена -> поиск существующего) прежний.
- Тесты: в `ordersCreate` и `ordersLifecycle` добавлены проверки полного тела и заголовков запросов PayPal и Printful (зелёные на старом коде); всего 414/414.  Деплой: agent-api v29 (SHA 678b628), проверен через pg_net (donate 200, catalog 200, quotes без ключа 401).

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

### Полезные запросы к `ai_query_analytics` (Supabase SQL)

```sql
-- Топ болевых точек и кластеров тем за 7 дней
select topic_cluster, hub_section, pain_point, count(*) requests
from ai_query_analytics
where created_at > now() - interval '7 days'
group by 1, 2, 3 order by requests desc limit 20;

-- Негативные/срочные обращения для разбора UX
select created_at, hub_section, sentiment, urgency, query, pain_point
from ai_query_analytics
where sentiment = 'frustrated' or urgency = 'high'
order by created_at desc limit 30;
```

## 5. Приватность и границы
- Аналитика не хранит IP и User-Agent, только хэш с ежедневной солью. Не добавляй cookie, localStorage-идентификаторы или сторонние трекеры.
- Никаких фейковых отзывов, накрутки, выдуманных цифр и поддельных «инсайдов»: слухи помечай как Rumors/Leaks, как в `news.json`.
- Платежи/донаты: только реальные реквизиты из `public/data/donate.json`. Не меняй адреса кошельков без прямого указания владельца.
- Платные фичи Claude (расписания, управление браузером/компьютером) на тарифе владельца недоступны.

## 6. Как стартовать новому агенту (шаблон промпта для владельца)
> Прочитай `docs/AGENT-HANDOFF.md` в репозитории vicecityhub/vicecityhub. Возьми верхнюю невыполненную задачу из раздела 2,
> выполни, проверь сборкой (`npm run build && npm run verify:dist`), закоммить в `main`, отметь задачу `[x]` и допиши запись в раздел 3.
> Отвечай мне по-русски в формате таблицы «Модуль / Действие / SEO и маркетинг эффект / Статус».
