-- v12 security hardening (applied to project lpglkglhjdqnktybksth on 2026-10-18 as migration "v12_security_hardening")

-- 1. Admin dashboard view leaked store lease requests (emails, admin notes) to anon via SECURITY DEFINER + full grants.
alter view public.lease_requests_dashboard set (security_invoker = true);
revoke all on public.lease_requests_dashboard from anon, authenticated, public;

-- 2. Trigger / event-trigger functions must not be callable through /rest/v1/rpc.
--    (Trigger execution does not require EXECUTE for the calling role.)
revoke execute on function public.notify_lease_request()     from public, anon, authenticated;
revoke execute on function public.notify_store_application() from public, anon, authenticated;
revoke execute on function public.recalc_comment_score()     from public, anon, authenticated;
revoke execute on function public.recalc_comments_count()    from public, anon, authenticated;
revoke execute on function public.recalc_post_score()        from public, anon, authenticated;
revoke execute on function public.rls_auto_enable()          from public, anon, authenticated;

-- 3. Pin search_path on SECURITY DEFINER functions that had a mutable one.
alter function public.notify_lease_request()     set search_path = public, pg_catalog;
alter function public.notify_store_application() set search_path = public, pg_catalog;
alter function public.recalc_comment_score()     set search_path = public, pg_catalog;
alter function public.recalc_comments_count()    set search_path = public, pg_catalog;
alter function public.recalc_post_score()        set search_path = public, pg_catalog;

-- 4. Owner-console RPCs: signed-in only (they check auth.uid() internally); never anon.
revoke execute on function public.create_agent_key(text, numeric, numeric, text[]) from public, anon;
revoke execute on function public.revoke_agent_key(uuid) from public, anon;
grant  execute on function public.create_agent_key(text, numeric, numeric, text[]) to authenticated;
grant  execute on function public.revoke_agent_key(uuid) to authenticated;
-- agent_rate_hit is only called by the edge function (service role).
revoke execute on function public.agent_rate_hit(text, integer, integer) from public, anon, authenticated;

-- Not fixable by SQL: enable "Leaked password protection" in Dashboard > Auth > Providers/Policies.
-- pg_net is non-relocatable; left in public on purpose (notify_store_application uses net.http_post).
