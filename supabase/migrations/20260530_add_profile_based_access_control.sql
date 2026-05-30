-- Add profile-based access control as the foundation for roles and subscriptions.
-- This keeps the current single-owner data model, while making user_profiles
-- the gate for application data access.

do $$
declare
  constraint_name text;
begin
  select conname into constraint_name
  from pg_constraint
  where conrelid = 'public.user_profiles'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%role%';

  if constraint_name is not null then
    execute format('alter table public.user_profiles drop constraint %I', constraint_name);
  end if;
end $$;

alter table public.user_profiles
  add constraint user_profiles_role_check
  check (role in ('admin', 'user', 'supporter'));

alter table public.user_profiles
  add column if not exists trial_ends_at timestamptz,
  add column if not exists current_period_end timestamptz,
  add column if not exists grace_until timestamptz;

create or replace function public.is_admin_user()
returns boolean as $$
  select exists (
    select 1
    from public.user_profiles
    where user_profiles.user_id = auth.uid()
      and user_profiles.role = 'admin'
      and user_profiles.onboarding_status = 'completed'
      and user_profiles.subscription_status in ('trialing', 'active')
  );
$$ language sql stable security definer set search_path = public;

create or replace function public.can_read_app_data()
returns boolean as $$
  select exists (
    select 1
    from public.user_profiles
    where user_profiles.user_id = auth.uid()
      and user_profiles.onboarding_status = 'completed'
      and (
        user_profiles.role = 'admin'
        or user_profiles.subscription_status in ('trialing', 'active', 'past_due', 'canceled')
      )
  );
$$ language sql stable security definer set search_path = public;

create or replace function public.can_write_app_data()
returns boolean as $$
  select exists (
    select 1
    from public.user_profiles
    where user_profiles.user_id = auth.uid()
      and user_profiles.onboarding_status = 'completed'
      and user_profiles.subscription_status in ('trialing', 'active')
  );
$$ language sql stable security definer set search_path = public;

create or replace function public.can_access_customer(p_customer_id uuid)
returns boolean as $$
  select public.is_admin_user()
    or exists (
      select 1
      from public.customers
      where customers.id = p_customer_id
        and customers.user_id = auth.uid()
    );
$$ language sql stable security definer set search_path = public;

do $$
declare
  existing_policy record;
begin
  for existing_policy in
    select
      namespace.nspname as schemaname,
      relation.relname as tablename,
      policy.polname as policyname
    from pg_catalog.pg_policy policy
    join pg_catalog.pg_class relation on relation.oid = policy.polrelid
    join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname in (
        'customers',
        'babies',
        'family_members',
        'support_tags',
        'visits',
        'visit_tags',
        'service_records',
        'visit_photos',
        'breath_checks',
        'breath_check_cells',
        'billing',
        'customer_contracts',
        'visit_billing',
        'customer_activities',
        'planning_sessions',
        'planning_answers',
        'planning_suggestions',
        'inquiries'
      )
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      existing_policy.policyname,
      existing_policy.schemaname,
      existing_policy.tablename
    );
  end loop;
end $$;

create policy "profile can read own customers" on public.customers
  for select using (
    public.can_read_app_data()
    and (public.is_admin_user() or user_id = auth.uid())
  );

create policy "profile can insert own customers" on public.customers
  for insert with check (
    public.can_write_app_data()
    and (public.is_admin_user() or user_id = auth.uid())
  );

create policy "profile can update own customers" on public.customers
  for update using (
    public.can_write_app_data()
    and (public.is_admin_user() or user_id = auth.uid())
  )
  with check (
    public.can_write_app_data()
    and (public.is_admin_user() or user_id = auth.uid())
  );

create policy "profile can delete own customers" on public.customers
  for delete using (
    public.can_write_app_data()
    and (public.is_admin_user() or user_id = auth.uid())
  );

create policy "profile can read own babies" on public.babies
  for select using (
    public.can_read_app_data()
    and public.can_access_customer(customer_id)
  );

create policy "profile can write own babies" on public.babies
  for all using (
    public.can_write_app_data()
    and public.can_access_customer(customer_id)
  )
  with check (
    public.can_write_app_data()
    and public.can_access_customer(customer_id)
  );

create policy "profile can read own family members" on public.family_members
  for select using (
    public.can_read_app_data()
    and public.can_access_customer(customer_id)
  );

create policy "profile can write own family members" on public.family_members
  for all using (
    public.can_write_app_data()
    and public.can_access_customer(customer_id)
  )
  with check (
    public.can_write_app_data()
    and public.can_access_customer(customer_id)
  );

create policy "profile can read own support tags" on public.support_tags
  for select using (
    public.can_read_app_data()
    and (public.is_admin_user() or user_id = auth.uid())
  );

create policy "profile can write own support tags" on public.support_tags
  for all using (
    public.can_write_app_data()
    and (public.is_admin_user() or user_id = auth.uid())
  )
  with check (
    public.can_write_app_data()
    and (public.is_admin_user() or user_id = auth.uid())
  );

create policy "profile can read own visits" on public.visits
  for select using (
    public.can_read_app_data()
    and (public.is_admin_user() or user_id = auth.uid())
    and public.can_access_customer(customer_id)
  );

create policy "profile can write own visits" on public.visits
  for all using (
    public.can_write_app_data()
    and (public.is_admin_user() or user_id = auth.uid())
    and public.can_access_customer(customer_id)
  )
  with check (
    public.can_write_app_data()
    and (public.is_admin_user() or user_id = auth.uid())
    and public.can_access_customer(customer_id)
  );

create policy "profile can read own visit tags" on public.visit_tags
  for select using (
    public.can_read_app_data()
    and exists (
      select 1
      from public.visits
      where visits.id = visit_tags.visit_id
        and (public.is_admin_user() or visits.user_id = auth.uid())
    )
  );

create policy "profile can write own visit tags" on public.visit_tags
  for all using (
    public.can_write_app_data()
    and exists (
      select 1
      from public.visits
      where visits.id = visit_tags.visit_id
        and (public.is_admin_user() or visits.user_id = auth.uid())
    )
    and exists (
      select 1
      from public.support_tags
      where support_tags.id = visit_tags.tag_id
        and (public.is_admin_user() or support_tags.user_id = auth.uid())
    )
  )
  with check (
    public.can_write_app_data()
    and exists (
      select 1
      from public.visits
      where visits.id = visit_tags.visit_id
        and (public.is_admin_user() or visits.user_id = auth.uid())
    )
    and exists (
      select 1
      from public.support_tags
      where support_tags.id = visit_tags.tag_id
        and (public.is_admin_user() or support_tags.user_id = auth.uid())
    )
  );

create policy "profile can read own service records" on public.service_records
  for select using (
    public.can_read_app_data()
    and exists (
      select 1
      from public.visits
      where visits.id = service_records.visit_id
        and (public.is_admin_user() or visits.user_id = auth.uid())
    )
  );

create policy "profile can write own service records" on public.service_records
  for all using (
    public.can_write_app_data()
    and exists (
      select 1
      from public.visits
      where visits.id = service_records.visit_id
        and (public.is_admin_user() or visits.user_id = auth.uid())
    )
  )
  with check (
    public.can_write_app_data()
    and exists (
      select 1
      from public.visits
      where visits.id = service_records.visit_id
        and (public.is_admin_user() or visits.user_id = auth.uid())
    )
  );

create policy "profile can read own visit photos" on public.visit_photos
  for select using (
    public.can_read_app_data()
    and (public.is_admin_user() or user_id = auth.uid())
    and exists (
      select 1
      from public.visits
      where visits.id = visit_photos.visit_id
        and (public.is_admin_user() or visits.user_id = auth.uid())
    )
  );

create policy "profile can write own visit photos" on public.visit_photos
  for all using (
    public.can_write_app_data()
    and (public.is_admin_user() or user_id = auth.uid())
    and exists (
      select 1
      from public.visits
      where visits.id = visit_photos.visit_id
        and (public.is_admin_user() or visits.user_id = auth.uid())
    )
  )
  with check (
    public.can_write_app_data()
    and (public.is_admin_user() or user_id = auth.uid())
    and exists (
      select 1
      from public.visits
      where visits.id = visit_photos.visit_id
        and (public.is_admin_user() or visits.user_id = auth.uid())
    )
  );

create policy "profile can read own breath checks" on public.breath_checks
  for select using (
    public.can_read_app_data()
    and exists (
      select 1
      from public.visits
      where visits.id = breath_checks.visit_id
        and (public.is_admin_user() or visits.user_id = auth.uid())
    )
  );

create policy "profile can write own breath checks" on public.breath_checks
  for all using (
    public.can_write_app_data()
    and exists (
      select 1
      from public.visits
      where visits.id = breath_checks.visit_id
        and (public.is_admin_user() or visits.user_id = auth.uid())
    )
  )
  with check (
    public.can_write_app_data()
    and exists (
      select 1
      from public.visits
      where visits.id = breath_checks.visit_id
        and (public.is_admin_user() or visits.user_id = auth.uid())
    )
  );

create policy "profile can read own breath check cells" on public.breath_check_cells
  for select using (
    public.can_read_app_data()
    and exists (
      select 1
      from public.breath_checks
      join public.visits on visits.id = breath_checks.visit_id
      where breath_checks.id = breath_check_cells.breath_check_id
        and (public.is_admin_user() or visits.user_id = auth.uid())
    )
  );

create policy "profile can write own breath check cells" on public.breath_check_cells
  for all using (
    public.can_write_app_data()
    and exists (
      select 1
      from public.breath_checks
      join public.visits on visits.id = breath_checks.visit_id
      where breath_checks.id = breath_check_cells.breath_check_id
        and (public.is_admin_user() or visits.user_id = auth.uid())
    )
  )
  with check (
    public.can_write_app_data()
    and exists (
      select 1
      from public.breath_checks
      join public.visits on visits.id = breath_checks.visit_id
      where breath_checks.id = breath_check_cells.breath_check_id
        and (public.is_admin_user() or visits.user_id = auth.uid())
    )
  );

create policy "profile can read own billing" on public.billing
  for select using (
    public.can_read_app_data()
    and (public.is_admin_user() or user_id = auth.uid())
    and public.can_access_customer(customer_id)
  );

create policy "profile can write own billing" on public.billing
  for all using (
    public.can_write_app_data()
    and (public.is_admin_user() or user_id = auth.uid())
    and public.can_access_customer(customer_id)
  )
  with check (
    public.can_write_app_data()
    and (public.is_admin_user() or user_id = auth.uid())
    and public.can_access_customer(customer_id)
  );

create policy "profile can read own customer contracts" on public.customer_contracts
  for select using (
    public.can_read_app_data()
    and (public.is_admin_user() or user_id = auth.uid())
    and public.can_access_customer(customer_id)
  );

create policy "profile can write own customer contracts" on public.customer_contracts
  for all using (
    public.can_write_app_data()
    and (public.is_admin_user() or user_id = auth.uid())
    and public.can_access_customer(customer_id)
  )
  with check (
    public.can_write_app_data()
    and (public.is_admin_user() or user_id = auth.uid())
    and public.can_access_customer(customer_id)
  );

create policy "profile can read own visit billing" on public.visit_billing
  for select using (
    public.can_read_app_data()
    and (public.is_admin_user() or user_id = auth.uid())
    and public.can_access_customer(customer_id)
    and exists (
      select 1
      from public.visits
      where visits.id = visit_billing.visit_id
        and visits.customer_id = visit_billing.customer_id
        and (public.is_admin_user() or visits.user_id = auth.uid())
    )
  );

create policy "profile can write own visit billing" on public.visit_billing
  for all using (
    public.can_write_app_data()
    and (public.is_admin_user() or user_id = auth.uid())
    and public.can_access_customer(customer_id)
    and exists (
      select 1
      from public.visits
      where visits.id = visit_billing.visit_id
        and visits.customer_id = visit_billing.customer_id
        and (public.is_admin_user() or visits.user_id = auth.uid())
    )
  )
  with check (
    public.can_write_app_data()
    and (public.is_admin_user() or user_id = auth.uid())
    and public.can_access_customer(customer_id)
    and exists (
      select 1
      from public.visits
      where visits.id = visit_billing.visit_id
        and visits.customer_id = visit_billing.customer_id
        and (public.is_admin_user() or visits.user_id = auth.uid())
    )
    and (
      contract_id is null
      or exists (
        select 1
        from public.customer_contracts
        where customer_contracts.id = visit_billing.contract_id
          and customer_contracts.customer_id = visit_billing.customer_id
          and (public.is_admin_user() or customer_contracts.user_id = auth.uid())
      )
    )
  );

create policy "profile can read own customer activities" on public.customer_activities
  for select using (
    public.can_read_app_data()
    and (public.is_admin_user() or user_id = auth.uid())
    and public.can_access_customer(customer_id)
  );

create policy "profile can write own customer activities" on public.customer_activities
  for all using (
    public.can_write_app_data()
    and (public.is_admin_user() or user_id = auth.uid())
    and public.can_access_customer(customer_id)
  )
  with check (
    public.can_write_app_data()
    and (public.is_admin_user() or user_id = auth.uid())
    and public.can_access_customer(customer_id)
  );

create policy "profile can read own planning sessions" on public.planning_sessions
  for select using (
    public.can_read_app_data()
    and (public.is_admin_user() or staff_id = auth.uid())
    and public.can_access_customer(customer_id)
  );

create policy "profile can write own planning sessions" on public.planning_sessions
  for all using (
    public.can_write_app_data()
    and (public.is_admin_user() or staff_id = auth.uid())
    and public.can_access_customer(customer_id)
  )
  with check (
    public.can_write_app_data()
    and (public.is_admin_user() or staff_id = auth.uid())
    and public.can_access_customer(customer_id)
    and (
      contract_id is null
      or exists (
        select 1
        from public.customer_contracts
        where customer_contracts.id = planning_sessions.contract_id
          and customer_contracts.customer_id = planning_sessions.customer_id
          and (public.is_admin_user() or customer_contracts.user_id = auth.uid())
      )
    )
  );

create policy "profile can read own planning answers" on public.planning_answers
  for select using (
    public.can_read_app_data()
    and exists (
      select 1
      from public.planning_sessions
      where planning_sessions.id = planning_answers.session_id
        and (public.is_admin_user() or planning_sessions.staff_id = auth.uid())
        and public.can_access_customer(planning_sessions.customer_id)
    )
  );

create policy "profile can write own planning answers" on public.planning_answers
  for all using (
    public.can_write_app_data()
    and exists (
      select 1
      from public.planning_sessions
      where planning_sessions.id = planning_answers.session_id
        and (public.is_admin_user() or planning_sessions.staff_id = auth.uid())
        and public.can_access_customer(planning_sessions.customer_id)
    )
  )
  with check (
    public.can_write_app_data()
    and exists (
      select 1
      from public.planning_sessions
      where planning_sessions.id = planning_answers.session_id
        and (public.is_admin_user() or planning_sessions.staff_id = auth.uid())
        and public.can_access_customer(planning_sessions.customer_id)
    )
  );

create policy "profile can read own planning suggestions" on public.planning_suggestions
  for select using (
    public.can_read_app_data()
    and exists (
      select 1
      from public.planning_sessions
      where planning_sessions.id = planning_suggestions.session_id
        and (public.is_admin_user() or planning_sessions.staff_id = auth.uid())
        and public.can_access_customer(planning_sessions.customer_id)
    )
  );

create policy "profile can write own planning suggestions" on public.planning_suggestions
  for all using (
    public.can_write_app_data()
    and exists (
      select 1
      from public.planning_sessions
      where planning_sessions.id = planning_suggestions.session_id
        and (public.is_admin_user() or planning_sessions.staff_id = auth.uid())
        and public.can_access_customer(planning_sessions.customer_id)
    )
  )
  with check (
    public.can_write_app_data()
    and exists (
      select 1
      from public.planning_sessions
      where planning_sessions.id = planning_suggestions.session_id
        and (public.is_admin_user() or planning_sessions.staff_id = auth.uid())
        and public.can_access_customer(planning_sessions.customer_id)
    )
  );

create policy "public can submit inquiries" on public.inquiries
  for insert with check (true);

create policy "admins can read inquiries" on public.inquiries
  for select using (public.is_admin_user());

create policy "admins can update inquiries" on public.inquiries
  for update using (public.is_admin_user())
  with check (public.is_admin_user());

do $$
declare
  existing_policy record;
begin
  for existing_policy in
    select
      policy.polname as policyname
    from pg_catalog.pg_policy policy
    join pg_catalog.pg_class relation on relation.oid = policy.polrelid
    join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'storage'
      and relation.relname = 'objects'
      and policy.polname like '%visit%'
  loop
    execute format('drop policy if exists %I on storage.objects', existing_policy.policyname);
  end loop;
end $$;

create policy "profile can read own visit photo objects" on storage.objects
  for select using (
    bucket_id = 'visit-photos'
    and public.can_read_app_data()
    and (public.is_admin_user() or auth.uid()::text = (storage.foldername(name))[1])
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
    and (public.is_admin_user() or auth.uid()::text = (storage.foldername(name))[1])
  );
