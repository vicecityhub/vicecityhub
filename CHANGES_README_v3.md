# Vice City Hub — Social Layer v3: что нового

## ВАЖНО: сначала SQL, потом код

Перед заменой файлов выполни в Supabase Dashboard -> SQL Editor, по порядку:

### Шаг 1: создать бакет post-media вручную
Storage -> New Bucket -> name: `post-media` -> Public bucket: ON

### Шаг 2: запустить SQL
1. supabase/03_post_media_bucket.sql — права доступа для нового бакета
2. supabase/04_add_media_type_to_feed_posts.sql — добавляет колонку,
   без которой код не отличит фото от видео в посте

## Что изменилось в этой версии

### 1. Загрузка фото/видео в посты ленты
Community.tsx — в окне создания/редактирования поста теперь есть
поле "Upload image or video". Файл уходит в новый бакет post-media
(отдельный от player-media, который используется в личной галерее
профиля). PostCard.tsx и PostDetail.tsx теперь показывают video-плеер,
если в посте видео, а не просто img-тег.

### 2. Редактирование и удаление своих постов
PostCard.tsx — у владельца поста появилось меню (три точки в углу
карточки) с пунктами Edit и Delete. Edit открывает тот же composer,
что и создание нового поста, с уже заполненными полями. Delete
спрашивает подтверждение перед удалением (window.confirm).

### 3. Перенос раздела "Форумы" с главной страницы
Home.tsx — секция "The Underground" (старые форумные посты из
таблицы posts, type='forum') удалена с главной страницы. Нумерация
следующей секции "Mapping Project" исправлена с 05 на 04.
Community.tsx — та же секция добавлена в самый низ страницы под
названием "Legacy Forum", в виде архива (без формы создания новых
постов туда — это исторический контент, новые посты теперь идут
через Reddit-style ленту выше).

## Куда копировать (как и раньше — в корень репозитория, НЕ в dist)

```
твой-репозиторий/
├── (post.html, profile.html, community.html, reset-password.html — уже скопированы в прошлый раз, без изменений)
├── vite.config.ts                  <- уже скопирован в v2, без изменений в этой версии
└── src/
    ├── pages/
    │   ├── Home.tsx                 <- ЗАМЕНИТЬ (убрана секция форума)
    │   └── Community.tsx             <- ЗАМЕНИТЬ (медиа, edit/delete, Legacy Forum)
    └── components/
        ├── Layout.tsx                <- без изменений в этой версии (уже актуален из v2)
        └── PostCard.tsx                <- ЗАМЕНИТЬ (видео, owner-меню)
```

## Что всё ещё не сделано

1. Реальный Steam OAuth (описан в STEAM_OAUTH_NOTES.md из первого
   архива, код Edge Function не написан)
2. Форма загрузки скриншота на verification_requests + админка
   модератора для approve/reject
3. Диагностика "Invalid login credentials" — жду, что ты посмотришь
   Authentication -> Users в Supabase Dashboard
