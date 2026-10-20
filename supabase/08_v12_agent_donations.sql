-- v12 agent donations (applied to project lpglkglhjdqnktybksth as migration "v12_agent_donations")
-- Agents may donate (voluntary, crypto, auto-detected) only with a key that allows the 'donation' kind.
-- New keys get it by default; existing keys are upgraded. Spend limits (per order / 24h) still apply.
alter table public.agent_keys
  alter column allowed_kinds set default array['merch','plan','domain','product','server','donation']::text[];

update public.agent_keys
   set allowed_kinds = array_append(allowed_kinds, 'donation')
 where not ('donation' = any(allowed_kinds));
