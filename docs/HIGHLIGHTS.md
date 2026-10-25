# Highlights board (PS5 screenshots and clips)

Page: `highlights.html` (React, `src/pages/Highlights.tsx`, entry `src/main-highlights.tsx`). Menu: Play > Highlights. SQL: `supabase/11_highlights.sql` (migration `highlights_v1`). Edge function: `supabase/functions/device-login/index.ts` (verify_jwt=false).

## What it does
- Signed-in players upload a screenshot or a short clip (JPG, PNG, WebP, MP4, WebM, MOV; max 50 MB) with a title, game and platform. Everything is public on "the wall": filter by screenshots/clips, sort by newest/top, like, report, delete your own.
- Uploads go straight from the browser to Supabase Storage (bucket `highlights`, public read, owner-only write under `<user_id>/...`, mime and size enforced by the bucket) and then into table `highlights` through RLS. No server code in the upload path.
- Console friendly UI: 56 px buttons, visible yellow focus ring, no drag and drop, no hover-only controls, XHR upload with a progress percentage, console detection banner.

## Sign-in without typing on a console (device code)
1. Console page: "Get a phone code" calls `POST device-login/start` and shows an 8-character code (like `ABCD-2345`), then polls `POST device-login/poll` every 3 s.
2. Phone (already signed in): open `highlights.html#link`, enter the code. `POST /inspect` shows what is asking ("PlayStation console browser, 12s ago"), the user confirms, `POST /approve` stores a Supabase magic-link `token_hash` for that code.
3. The next console poll receives the `token_hash` once and calls `supabase.auth.verifyOtp({ token_hash, type: 'magiclink' })`, which creates a normal session on the console.
Security: codes live 10 minutes; the console keeps a random secret and only its SHA-256 is stored; the token is single use and wiped after hand-over; start/poll/approve are rate limited (`agent_rate`); /approve needs a valid user JWT. Residual risk: classic device-flow phishing (someone shows a victim a code and asks them to approve). The phone UI warns about it in plain words. Table `device_logins` is service-role only and garbage-collected by pg_cron (`device-logins-gc`).

## Automatic moderation (no humans)
- DB trigger: max 10 uploads per user per 24 hours; status is forced to `approved`; `author_name` comes from `player_profiles.display_name` (never from the email).
- Reports (`highlight_reports`, write-only for users): 3 distinct reporters whose accounts are at least one day old set `status='hidden'` (trigger `highlight_reports_auto_hide`). You cannot report your own post.
- Bucket allows images and video only, so HTML/SVG cannot be hosted.
- NOT covered: there is no image/video classifier. An abusive upload stays visible until three established accounts report it. If that becomes a problem, add a classifier call before the insert (edge function) or require an account age for posting.

## PS5 caveats (verify on a real console)
- Whether the PS5 browser opens a file picker for `<input type=file>` and can reach Media Gallery captures was NOT verified (no console here, and web sources are inconclusive). The page works either way: the phone route (send capture to the PlayStation App, save to camera roll, upload from the phone with the same account) is the documented fallback.
- PS5 video clips are WebM. Older iOS Safari cannot play WebM, so some phone viewers may see a black player; screenshots are fine everywhere.
- Supabase free plan caps uploads at 50 MB (bucket limit matches). A 1080p clip of 15-30 s usually fits after trimming.
- The device login flow has been tested up to start/poll/approve error paths; the full approve -> verifyOtp -> session path needs one run with a real account.

## Ops
```sql
select status, count(*) from highlights group by status;
-- hide or restore
update highlights set status = 'hidden' where id = 123;
update highlights set status = 'approved' where id = 123;
-- storage objects of deleted/hidden rows are not purged automatically
```
