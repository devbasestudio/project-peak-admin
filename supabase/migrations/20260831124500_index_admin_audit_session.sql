create index if not exists admin_audit_actor_session_idx
on public.admin_audit_log(actor_session_id);
