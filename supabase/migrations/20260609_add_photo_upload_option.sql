alter table public.user_profiles
  add column if not exists photo_upload_enabled boolean not null default false;

create or replace function public.can_use_photo_upload()
returns boolean as $$
  select exists (
    select 1
    from public.user_profiles
    where user_profiles.user_id = auth.uid()
      and user_profiles.photo_upload_enabled = true
      and public.can_write_app_data()
  );
$$ language sql stable security definer set search_path = public;

create or replace function public.count_customer_photos(p_customer_id uuid)
returns integer as $$
  select
    (
      select count(*)::integer
      from public.visit_photos
      join public.visits on visits.id = visit_photos.visit_id
      where visits.customer_id = p_customer_id
    )
    +
    (
      select count(*)::integer
      from public.planning_photos
      join public.planning_sessions on planning_sessions.id = planning_photos.session_id
      where planning_sessions.customer_id = p_customer_id
    );
$$ language sql stable security definer set search_path = public;

create or replace function public.enforce_visit_photo_limit()
returns trigger as $$
declare
  target_customer_id uuid;
begin
  if not public.can_use_photo_upload() then
    raise exception 'photo upload option is required';
  end if;

  select visits.customer_id
    into target_customer_id
  from public.visits
  where visits.id = new.visit_id;

  if target_customer_id is null then
    raise exception 'visit not found';
  end if;

  if public.count_customer_photos(target_customer_id) >= 20 then
    raise exception 'customer photo limit reached';
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.enforce_planning_photo_limit()
returns trigger as $$
declare
  target_customer_id uuid;
begin
  if not public.can_use_photo_upload() then
    raise exception 'photo upload option is required';
  end if;

  select planning_sessions.customer_id
    into target_customer_id
  from public.planning_sessions
  where planning_sessions.id = new.session_id;

  if target_customer_id is null then
    raise exception 'planning session not found';
  end if;

  if public.count_customer_photos(target_customer_id) >= 20 then
    raise exception 'customer photo limit reached';
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists enforce_visit_photo_limit_before_insert on public.visit_photos;
create trigger enforce_visit_photo_limit_before_insert
  before insert on public.visit_photos
  for each row execute function public.enforce_visit_photo_limit();

drop trigger if exists enforce_planning_photo_limit_before_insert on public.planning_photos;
create trigger enforce_planning_photo_limit_before_insert
  before insert on public.planning_photos
  for each row execute function public.enforce_planning_photo_limit();

drop policy if exists "profile can insert own visit photo objects" on storage.objects;
create policy "profile can insert own visit photo objects" on storage.objects
  for insert with check (
    bucket_id = 'visit-photos'
    and public.can_use_photo_upload()
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "profile can insert own planning photo objects" on storage.objects;
create policy "profile can insert own planning photo objects" on storage.objects
  for insert with check (
    bucket_id = 'planning-photos'
    and public.can_use_photo_upload()
    and auth.uid()::text = (storage.foldername(name))[1]
  );
