-- Step 5/6
-- User profile table, admin helper, and inquiry admin access.

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
