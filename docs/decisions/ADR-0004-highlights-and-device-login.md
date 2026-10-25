# ADR-0004: Highlights board with direct-to-storage uploads and a phone-approved device login

Status: accepted (2026-10-25). Related: ADR-0002 (cookieless analytics), ADR-0003 (Back Alley).

## Context
The owner wants players to post screenshots and short clips from a PS5 straight to the Hub, under their own account, ideally from the console's built-in browser. Typing credentials with a D-pad is painful, and no human moderator is available.

## Decision
1. Uploads go from the browser directly to a public Supabase Storage bucket (`highlights`) guarded by RLS (owner-only folder) with bucket-level mime and size limits. Metadata rows are inserted through RLS. No custom upload server.
2. Sign-in on the console uses an OAuth-device-flow style code: console gets a short code, a signed-in phone approves it, console exchanges a one-time magic-link token hash for a session. Implemented as one edge function (`device-login`) and one service-only table.
3. Moderation is automatic: daily cap by trigger, bucket restrictions, peer reports from accounts older than a day (3 reports hide). No manual queue.

## Consequences
- Cheap and simple; nothing to operate. Storage egress is paid by the Supabase plan (watch it if clips go viral).
- No content classifier: abusive uploads rely on reports. Accepted risk, documented in docs/HIGHLIGHTS.md; the upgrade path is an edge-function classifier or an account-age gate.
- Device flow can be phished by social engineering; the approval UI states it and shows the requesting device. Sessions are normal Supabase sessions (no scoped tokens available).
- PS5 browser capabilities (file picker, WebM decoding) are unverified; the phone upload path is the fallback.
