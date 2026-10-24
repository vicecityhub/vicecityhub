# AGENT HANDOFF: Vice City Hub

Единая точка входа для любого агента/модели (Claude, GPT, Gemini, Codex и т.д.), которые продолжают проект,
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

## 2. ОЧЕРЕДЬ ЗАДАЧ (бери сверху, отмечай [x] и дату)
Формат: `- [ ] ID · приоритет · описание · критерий готовности`

### Высокий приоритет
- [ ] T1 · P0 · Визуально проверить OG-карточки (`public/og/4389.png`, `release.png`, `is-out.png`): перенос строк, свечение, обрезка заголовка. Готово: открыто в браузере/просмотрщике, дизайн подправлен в `scripts/gen-og.mjs`. (Основной агент не смог открыть картинки: проверка была только программной.)
- [ ] T2 · P0 · После деплоя проверить в проде: `curl -I https://vicecityhub.github.io/vicecityhub/og/release.png`, og:image на `/n/…` и `/is-gta-6-out-yet/` через Facebook Sharing Debugger / opengraph.xyz.
- [ ] T3 · P0 · Перемерить Lighthouse (mobile) на проде: home, market, news. Было: home 85, market 80, news 99. Цель 90+. Если home < 90: смотреть LCP-элемент и размер `Layout`-чанка (65 КБ) и `supabase-vendor` (200 КБ), подгружать supabase только там, где нужен.
- [ ] T4 · P1 · Страница статистики для владельца (не публичная или за токеном): сводка из `page_hits` (топ страниц, источники, устройства, уники по дням). Запросы в разделе 4.
- [ ] T5 · P1 · Удалить retired-заглушки edge functions в дашборде Supabase: `audio-swap-tmp`, `rp-online` (оба отвечают 410; через MCP удалить нельзя). Также удалить `backup_muz_original` на диске, когда владелец убедится, что музыка играет.

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
