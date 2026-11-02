# Highlights board

Page: `highlights.html` (`src/pages/Highlights.tsx`). Menu: Play > Highlights. SQL: `supabase/11_highlights.sql` + `supabase/13_restream_highlights.sql`. Auto-drops: edge function `restream-highlights` (verify_jwt=false, cron every 3 minutes).

## Why there is no “direct PS5 connection”
Sony does not give fan sites an API to read the PS5 Media Gallery or to sign a player in through the console. The old phone-code / device-login path was a workaround for typing on a D-pad; it was never a real PlayStation integration and could not pull captures. Highlights now uses **the same Hub sign-in** as Community, News and RP (header Log in / Join). Players copy a capture to phone (PlayStation App) or USB and upload it here.

## Player uploads
- Signed-in players post JPG/PNG/WebP/MP4/WebM/MOV up to 50 MB. Direct to Storage bucket `highlights` (RLS: owner folder), then a row in `highlights`.
- Daily cap: 10 **user** uploads / 24 h. Restream auto-drops do not count against that cap.
- Reports: 3 established accounts hide a post. No human queue.

## Restream auto-capture (owner stream)
While VCH is live through Restream (Twitch / X / Instagram, etc.):

1. Cron hits `GET /functions/v1/restream-highlights/tick`.
2. The job lists in-progress Restream events and writes `restream_state` (`live`, title) so the page can show a LIVE banner.
3. It starts (or reuses) a Restream **Clips project** on that event. Restream’s AI picks engaging moments from the recording that is already growing during the live show.
4. Chat spikes (`analytics/messages` per minute, plus keywords like pog / clip that / clutch) request extra `selectedTimeRange` clips on the same project.
5. Finished clips with a virality score are downloaded and inserted as `source='restream'` videos authored by the VCH account (max 8 auto posts / 24 h, 3 per tick).
6. After the stream ends, the next ticks harvest leftover AI clips from recent history.

### One-time Restream connect
1. In [Restream Developers](https://developers.restream.io/) create an API app.
2. Redirect URI: `https://lpglkglhjdqnktybksth.supabase.co/functions/v1/restream-highlights/oauth/callback`
3. Enable scopes: `stream.read`, `chat.read`, `clips.read`, `clips.write`, `storage.read`.
4. Set function secrets `RESTREAM_CLIENT_ID` and `RESTREAM_CLIENT_SECRET` (optional `HIGHLIGHTS_OWNER_USER_ID`, defaults to the VCH profile).
5. Sign in to the Hub as VCH, open Highlights, click **Connect Restream**, approve the app.

Tokens rotate in `restream_oauth` (service-role only). `restream_state` is publicly readable (`live`, `connected`, `title` only).

## Ops
```sql
select live, connected, title, updated_at from restream_state;
select source, status, count(*) from highlights group by 1, 2;
-- hide / restore
update highlights set status = 'hidden' where id = 123;
```
Kick a tick by hand: `curl -sS https://lpglkglhjdqnktybksth.supabase.co/functions/v1/restream-highlights/tick`
