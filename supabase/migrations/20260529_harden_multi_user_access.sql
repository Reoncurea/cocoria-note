-- Harden public access before inviting external users.
-- Existing policy names include mojibake in older migrations, so this migration
-- resets only the affected public-table policies and recreates stricter ones.

do $$
declare
  existing_policy record;
begin
  for existing_policy in
    select tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'planning_sessions',
        'planning_answers',
        'planning_suggestions',
        'visits',
        'billing',
        'customer_contracts',
        'visit_billing',
        'customer_activities',
        'inquiries'
      )
  loop
    execute format(
      'drop policy if exists %I on public.%I',
      existing_policy.policyname,
      existing_policy.tablename
    );
  end loop;
end $$;

create policy "users can manage own planning sessions" on planning_sessions
  for all
  using (
    auth.uid() = staff_id
    and exists (
      select 1
      from customers
      where customers.id = planning_sessions.customer_id
        and customers.user_id = auth.uid()
    )
  )
  with check (
    auth.uid() = staff_id
    and exists (
      select 1
      from customers
      where customers.id = planning_sessions.customer_id
        and customers.user_id = auth.uid()
    )
  );

create policy "users can manage own planning answers" on planning_answers
  for all
  using (
    exists (
      select 1
      from planning_sessions
      join customers on customers.id = planning_sessions.customer_id
      where planning_sessions.id = planning_answers.session_id
        and planning_sessions.staff_id = auth.uid()
        and customers.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from planning_sessions
      join customers on customers.id = planning_sessions.customer_id
      where planning_sessions.id = planning_answers.session_id
        and planning_sessions.staff_id = auth.uid()
        and customers.user_id = auth.uid()
    )
  );

create policy "users can manage own planning suggestions" on planning_suggestions
  for all
  using (
    exists (
      select 1
      from planning_sessions
      join customers on customers.id = planning_sessions.customer_id
      where planning_sessions.id = planning_suggestions.session_id
        and planning_sessions.staff_id = auth.uid()
        and customers.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from planning_sessions
      join customers on customers.id = planning_sessions.customer_id
      where planning_sessions.id = planning_suggestions.session_id
        and planning_sessions.staff_id = auth.uid()
        and customers.user_id = auth.uid()
    )
  );

create policy "users can manage own visits" on visits
  for all
  using (
    auth.uid() = user_id
    and exists (
      select 1
      from customers
      where customers.id = visits.customer_id
        and customers.user_id = auth.uid()
    )
  )
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from customers
      where customers.id = visits.customer_id
        and customers.user_id = auth.uid()
    )
  );

create policy "users can manage own billing" on billing
  for all
  using (
    auth.uid() = user_id
    and exists (
      select 1
      from customers
      where customers.id = billing.customer_id
        and customers.user_id = auth.uid()
    )
  )
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from customers
      where customers.id = billing.customer_id
        and customers.user_id = auth.uid()
    )
  );

create policy "users can manage own customer contracts" on customer_contracts
  for all
  using (
    auth.uid() = user_id
    and exists (
      select 1
      from customers
      where customers.id = customer_contracts.customer_id
        and customers.user_id = auth.uid()
    )
  )
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from customers
      where customers.id = customer_contracts.customer_id
        and customers.user_id = auth.uid()
    )
  );

create policy "users can manage own visit billing" on visit_billing
  for all
  using (
    auth.uid() = user_id
    and exists (
      select 1
      from customers
      where customers.id = visit_billing.customer_id
        and customers.user_id = auth.uid()
    )
    and exists (
      select 1
      from visits
      where visits.id = visit_billing.visit_id
        and visits.user_id = auth.uid()
        and visits.customer_id = visit_billing.customer_id
    )
  )
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from customers
      where customers.id = visit_billing.customer_id
        and customers.user_id = auth.uid()
    )
    and exists (
      select 1
      from visits
      where visits.id = visit_billing.visit_id
        and visits.user_id = auth.uid()
        and visits.customer_id = visit_billing.customer_id
    )
  );

create policy "users can manage own customer activities" on customer_activities
  for all
  using (
    auth.uid() = user_id
    and exists (
      select 1
      from customers
      where customers.id = customer_activities.customer_id
        and customers.user_id = auth.uid()
    )
  )
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from customers
      where customers.id = customer_activities.customer_id
        and customers.user_id = auth.uid()
    )
  );

create policy "anyone can submit inquiries" on inquiries
  for insert with check (true);

create table if not exists user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  role text not null default 'user' check (role in ('admin', 'user')),
  onboarding_status text not null default 'pending' check (onboarding_status in ('pending', 'completed')),
  subscription_status text not null default 'trialing' check (subscription_status in ('trialing', 'active', 'past_due', 'canceled')),
  invited_by uuid references auth.users(id) on delete set null,
  invited_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table user_profiles enable row level security;

do $$
declare
  existing_policy record;
begin
  for existing_policy in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_profiles'
  loop
    execute format('drop policy if exists %I on public.user_profiles', existing_policy.policyname);
  end loop;
end $$;

create or replace function is_admin_user()
returns boolean as $$
  select exists (
    select 1
    from user_profiles
    where user_profiles.user_id = auth.uid()
      and user_profiles.role = 'admin'
  );
$$ language sql security definer set search_path = public;

create policy "users can read own profile" on user_profiles
  for select using (auth.uid() = user_id);

create policy "admins can manage user profiles" on user_profiles
  for all
  using (is_admin_user())
  with check (is_admin_user());

create policy "admins can read inquiries" on inquiries
  for select using (is_admin_user());

create policy "admins can update inquiries" on inquiries
  for update using (is_admin_user())
  with check (is_admin_user());

create or replace function create_user_profile_for_new_user()
returns trigger as $$
begin
  insert into public.user_profiles (user_id, email, invited_at)
  values (new.id, new.email, now())
  on conflict (user_id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists create_user_profile_for_new_user on auth.users;
create trigger create_user_profile_for_new_user
  after insert on auth.users
  for each row execute procedure create_user_profile_for_new_user();

drop trigger if exists update_user_profiles_updated_at on user_profiles;
create trigger update_user_profiles_updated_at before update on user_profiles
  for each row execute procedure update_updated_at();
