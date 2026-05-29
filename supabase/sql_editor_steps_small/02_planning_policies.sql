-- Step 2/6
-- Planning data isolation.

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
