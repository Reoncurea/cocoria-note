-- Step 3/6
-- Visit and billing data isolation.

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
