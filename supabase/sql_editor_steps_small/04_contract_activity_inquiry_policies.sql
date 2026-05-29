-- Step 4/6
-- Contract, activity, and inquiry policies.

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
