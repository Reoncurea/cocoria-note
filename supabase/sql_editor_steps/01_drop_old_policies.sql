-- Step 1/3
-- Run this first in Supabase SQL Editor.
-- It removes only policies on the tables hardened by this setup.

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
        'inquiries',
        'user_profiles'
      )
  loop
    execute format(
      'drop policy if exists %I on public.%I',
      existing_policy.policyname,
      existing_policy.tablename
    );
  end loop;
end $$;
