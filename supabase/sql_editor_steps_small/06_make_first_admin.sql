-- Step 6/6
-- Replace your-email@example.com with your login email before running.

insert into public.user_profiles (
  user_id,
  email,
  role,
  onboarding_status,
  subscription_status,
  accepted_at
)
select
  id,
  email,
  'admin',
  'completed',
  'active',
  now()
from auth.users
where email = 'your-email@example.com'
on conflict (user_id) do update
set
  role = 'admin',
  onboarding_status = 'completed',
  subscription_status = 'active',
  accepted_at = coalesce(public.user_profiles.accepted_at, now()),
  updated_at = now();
