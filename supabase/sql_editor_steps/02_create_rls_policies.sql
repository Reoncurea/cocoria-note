-- Step 2/3
-- Run this after 01_drop_old_policies.sql.
-- It recreates stricter data-isolation policies.

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
