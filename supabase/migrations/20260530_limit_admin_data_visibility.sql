-- Keep admin privileges for user/profile/inquiry management, but do not let
-- admins see every user's customer records by default.

create or replace function public.can_access_customer(p_customer_id uuid)
returns boolean as $$
  select exists (
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
        'support_tags',
        'visits',
        'visit_photos',
        'billing',
        'customer_contracts',
        'visit_billing',
        'customer_activities',
        'planning_sessions'
      )
      and policy.polname like 'profile can %'
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
    and user_id = auth.uid()
  );

create policy "profile can insert own customers" on public.customers
  for insert with check (
    public.can_write_app_data()
    and user_id = auth.uid()
  );

create policy "profile can update own customers" on public.customers
  for update using (
    public.can_write_app_data()
    and user_id = auth.uid()
  )
  with check (
    public.can_write_app_data()
    and user_id = auth.uid()
  );

create policy "profile can delete own customers" on public.customers
  for delete using (
    public.can_write_app_data()
    and user_id = auth.uid()
  );

create policy "profile can read own support tags" on public.support_tags
  for select using (
    public.can_read_app_data()
    and user_id = auth.uid()
  );

create policy "profile can write own support tags" on public.support_tags
  for all using (
    public.can_write_app_data()
    and user_id = auth.uid()
  )
  with check (
    public.can_write_app_data()
    and user_id = auth.uid()
  );

create policy "profile can read own visits" on public.visits
  for select using (
    public.can_read_app_data()
    and user_id = auth.uid()
    and public.can_access_customer(customer_id)
  );

create policy "profile can write own visits" on public.visits
  for all using (
    public.can_write_app_data()
    and user_id = auth.uid()
    and public.can_access_customer(customer_id)
  )
  with check (
    public.can_write_app_data()
    and user_id = auth.uid()
    and public.can_access_customer(customer_id)
  );

create policy "profile can read own visit photos" on public.visit_photos
  for select using (
    public.can_read_app_data()
    and user_id = auth.uid()
    and exists (
      select 1
      from public.visits
      where visits.id = visit_photos.visit_id
        and visits.user_id = auth.uid()
    )
  );

create policy "profile can write own visit photos" on public.visit_photos
  for all using (
    public.can_write_app_data()
    and user_id = auth.uid()
    and exists (
      select 1
      from public.visits
      where visits.id = visit_photos.visit_id
        and visits.user_id = auth.uid()
    )
  )
  with check (
    public.can_write_app_data()
    and user_id = auth.uid()
    and exists (
      select 1
      from public.visits
      where visits.id = visit_photos.visit_id
        and visits.user_id = auth.uid()
    )
  );

create policy "profile can read own billing" on public.billing
  for select using (
    public.can_read_app_data()
    and user_id = auth.uid()
    and public.can_access_customer(customer_id)
  );

create policy "profile can write own billing" on public.billing
  for all using (
    public.can_write_app_data()
    and user_id = auth.uid()
    and public.can_access_customer(customer_id)
  )
  with check (
    public.can_write_app_data()
    and user_id = auth.uid()
    and public.can_access_customer(customer_id)
  );

create policy "profile can read own customer contracts" on public.customer_contracts
  for select using (
    public.can_read_app_data()
    and user_id = auth.uid()
    and public.can_access_customer(customer_id)
  );

create policy "profile can write own customer contracts" on public.customer_contracts
  for all using (
    public.can_write_app_data()
    and user_id = auth.uid()
    and public.can_access_customer(customer_id)
  )
  with check (
    public.can_write_app_data()
    and user_id = auth.uid()
    and public.can_access_customer(customer_id)
  );

create policy "profile can read own visit billing" on public.visit_billing
  for select using (
    public.can_read_app_data()
    and user_id = auth.uid()
    and public.can_access_customer(customer_id)
    and exists (
      select 1
      from public.visits
      where visits.id = visit_billing.visit_id
        and visits.customer_id = visit_billing.customer_id
        and visits.user_id = auth.uid()
    )
  );

create policy "profile can write own visit billing" on public.visit_billing
  for all using (
    public.can_write_app_data()
    and user_id = auth.uid()
    and public.can_access_customer(customer_id)
    and exists (
      select 1
      from public.visits
      where visits.id = visit_billing.visit_id
        and visits.customer_id = visit_billing.customer_id
        and visits.user_id = auth.uid()
    )
  )
  with check (
    public.can_write_app_data()
    and user_id = auth.uid()
    and public.can_access_customer(customer_id)
    and exists (
      select 1
      from public.visits
      where visits.id = visit_billing.visit_id
        and visits.customer_id = visit_billing.customer_id
        and visits.user_id = auth.uid()
    )
    and (
      contract_id is null
      or exists (
        select 1
        from public.customer_contracts
        where customer_contracts.id = visit_billing.contract_id
          and customer_contracts.customer_id = visit_billing.customer_id
          and customer_contracts.user_id = auth.uid()
      )
    )
  );

create policy "profile can read own customer activities" on public.customer_activities
  for select using (
    public.can_read_app_data()
    and user_id = auth.uid()
    and public.can_access_customer(customer_id)
  );

create policy "profile can write own customer activities" on public.customer_activities
  for all using (
    public.can_write_app_data()
    and user_id = auth.uid()
    and public.can_access_customer(customer_id)
  )
  with check (
    public.can_write_app_data()
    and user_id = auth.uid()
    and public.can_access_customer(customer_id)
  );

create policy "profile can read own planning sessions" on public.planning_sessions
  for select using (
    public.can_read_app_data()
    and staff_id = auth.uid()
    and public.can_access_customer(customer_id)
  );

create policy "profile can write own planning sessions" on public.planning_sessions
  for all using (
    public.can_write_app_data()
    and staff_id = auth.uid()
    and public.can_access_customer(customer_id)
  )
  with check (
    public.can_write_app_data()
    and staff_id = auth.uid()
    and public.can_access_customer(customer_id)
    and (
      contract_id is null
      or exists (
        select 1
        from public.customer_contracts
        where customer_contracts.id = planning_sessions.contract_id
          and customer_contracts.customer_id = planning_sessions.customer_id
          and customer_contracts.user_id = auth.uid()
      )
    )
  );
