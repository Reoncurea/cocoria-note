-- Close two production launch gaps:
-- 1. direct Supabase signups must not become usable accounts without an invite;
-- 2. expired trial accounts must not keep write access through direct Supabase calls.

create or replace function public.is_invited_user()
returns boolean as $$
  select exists (
    select 1
    from public.user_profiles
    where user_profiles.user_id = auth.uid()
      and (
        user_profiles.invited_by is not null
        or user_profiles.role = 'admin'
      )
  );
$$ language sql stable security definer set search_path = public;

create or replace function public.is_trial_current(
  p_subscription_status text,
  p_accepted_at timestamptz,
  p_trial_ends_at timestamptz
)
returns boolean as $$
  select
    p_subscription_status = 'trialing'
    and coalesce(p_trial_ends_at, p_accepted_at + interval '1 month') is not null
    and coalesce(p_trial_ends_at, p_accepted_at + interval '1 month') >= now();
$$ language sql stable set search_path = public;

create or replace function public.has_active_app_access()
returns boolean as $$
  select exists (
    select 1
    from public.user_profiles
    where user_profiles.user_id = auth.uid()
      and (
        user_profiles.invited_by is not null
        or user_profiles.role = 'admin'
      )
      and user_profiles.onboarding_status = 'completed'
      and (
        user_profiles.subscription_status = 'active'
        or public.is_trial_current(
          user_profiles.subscription_status,
          user_profiles.accepted_at,
          user_profiles.trial_ends_at
        )
      )
  );
$$ language sql stable security definer set search_path = public;

create or replace function public.is_admin_user()
returns boolean as $$
  select exists (
    select 1
    from public.user_profiles
    where user_profiles.user_id = auth.uid()
      and user_profiles.role = 'admin'
      and public.has_active_app_access()
  );
$$ language sql stable security definer set search_path = public;

create or replace function public.can_read_app_data()
returns boolean as $$
  select exists (
    select 1
    from public.user_profiles
    where user_profiles.user_id = auth.uid()
      and (
        user_profiles.invited_by is not null
        or user_profiles.role = 'admin'
      )
      and user_profiles.onboarding_status = 'completed'
      and (
        user_profiles.subscription_status in ('active', 'past_due', 'canceled')
        or public.is_trial_current(
          user_profiles.subscription_status,
          user_profiles.accepted_at,
          user_profiles.trial_ends_at
        )
      )
  );
$$ language sql stable security definer set search_path = public;

create or replace function public.can_write_app_data()
returns boolean as $$
  select public.has_active_app_access();
$$ language sql stable security definer set search_path = public;

do $$
declare
  existing_policy record;
begin
  for existing_policy in
    select policy.polname as policyname
    from pg_catalog.pg_policy policy
    join pg_catalog.pg_class relation on relation.oid = policy.polrelid
    join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'storage'
      and relation.relname = 'objects'
      and policy.polname like '%visit photo%'
  loop
    execute format('drop policy if exists %I on storage.objects', existing_policy.policyname);
  end loop;
end $$;

create policy "profile can read own visit photo objects" on storage.objects
  for select using (
    bucket_id = 'visit-photos'
    and public.can_read_app_data()
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "profile can insert own visit photo objects" on storage.objects
  for insert with check (
    bucket_id = 'visit-photos'
    and public.can_write_app_data()
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "profile can delete own visit photo objects" on storage.objects
  for delete using (
    bucket_id = 'visit-photos'
    and public.can_write_app_data()
    and auth.uid()::text = (storage.foldername(name))[1]
  );
