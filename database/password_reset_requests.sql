-- Password reset approvals for e-Likha.
-- Apply this once in Supabase SQL Editor before using the Forgot Password approval flow.

create table if not exists public.password_reset_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  user_agent text,
  rejection_reason text,
  requested_at timestamptz not null default now(),
  reset_sent_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint password_reset_requests_email_format
    check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);

create index if not exists password_reset_requests_status_idx
  on public.password_reset_requests(status, created_at desc);

create index if not exists password_reset_requests_email_idx
  on public.password_reset_requests(lower(email), created_at desc);

create or replace function public.set_password_reset_requests_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists password_reset_requests_set_updated_at
  on public.password_reset_requests;

create trigger password_reset_requests_set_updated_at
before update on public.password_reset_requests
for each row
execute function public.set_password_reset_requests_updated_at();

alter table public.password_reset_requests enable row level security;

drop policy if exists "Anyone can request password reset approval"
  on public.password_reset_requests;

create policy "Anyone can request password reset approval"
on public.password_reset_requests
for insert
to anon, authenticated
with check (
  status = 'pending'
  and reviewed_at is null
  and reviewed_by is null
  and reset_sent_at is null
);

drop policy if exists "Super admins can read password reset approvals"
  on public.password_reset_requests;

create policy "Super admins can read password reset approvals"
on public.password_reset_requests
for select
to authenticated
using (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and lower(replace(replace(coalesce(u.role, ''), '_', ''), '-', '')) = 'superadmin'
  )
);

drop policy if exists "Super admins can update password reset approvals"
  on public.password_reset_requests;

create policy "Super admins can update password reset approvals"
on public.password_reset_requests
for update
to authenticated
using (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and lower(replace(replace(coalesce(u.role, ''), '_', ''), '-', '')) = 'superadmin'
  )
)
with check (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and lower(replace(replace(coalesce(u.role, ''), '_', ''), '-', '')) = 'superadmin'
  )
);

create or replace function public.get_password_reset_request_status(p_email text)
returns table (
  id uuid,
  email text,
  status text,
  requested_at timestamptz,
  reviewed_at timestamptz,
  reset_sent_at timestamptz,
  rejection_reason text
)
language sql
security definer
set search_path = public
as $$
  select
    prr.id,
    prr.email,
    prr.status,
    prr.requested_at,
    prr.reviewed_at,
    prr.reset_sent_at,
    prr.rejection_reason
  from public.password_reset_requests prr
  where lower(prr.email) = lower(trim(p_email))
  order by prr.created_at desc
  limit 1;
$$;

revoke all on function public.get_password_reset_request_status(text)
from public;

grant execute on function public.get_password_reset_request_status(text)
to anon, authenticated;
