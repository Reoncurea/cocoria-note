create table if not exists planning_photos (
  id          uuid primary key default uuid_generate_v4(),
  session_id  uuid references planning_sessions(id) on delete cascade not null,
  user_id     uuid references auth.users(id) on delete cascade not null,
  file_path   text not null,
  caption     text,
  sort_order  integer default 0,
  created_at  timestamptz default now()
);

alter table planning_photos enable row level security;

drop policy if exists "profile can read own planning photos" on planning_photos;
create policy "profile can read own planning photos" on planning_photos
  for select using (
    public.can_read_app_data()
    and (public.is_admin_user() or user_id = auth.uid())
    and exists (
      select 1
      from public.planning_sessions
      where planning_sessions.id = planning_photos.session_id
        and (public.is_admin_user() or planning_sessions.staff_id = auth.uid())
        and public.can_access_customer(planning_sessions.customer_id)
    )
  );

drop policy if exists "profile can write own planning photos" on planning_photos;
create policy "profile can write own planning photos" on planning_photos
  for all using (
    public.can_write_app_data()
    and (public.is_admin_user() or user_id = auth.uid())
    and exists (
      select 1
      from public.planning_sessions
      where planning_sessions.id = planning_photos.session_id
        and (public.is_admin_user() or planning_sessions.staff_id = auth.uid())
        and public.can_access_customer(planning_sessions.customer_id)
    )
  )
  with check (
    public.can_write_app_data()
    and (public.is_admin_user() or user_id = auth.uid())
    and exists (
      select 1
      from public.planning_sessions
      where planning_sessions.id = planning_photos.session_id
        and (public.is_admin_user() or planning_sessions.staff_id = auth.uid())
        and public.can_access_customer(planning_sessions.customer_id)
    )
  );

insert into storage.buckets (id, name, public)
values ('planning-photos', 'planning-photos', false)
on conflict (id) do nothing;

drop policy if exists "profile can read own planning photo objects" on storage.objects;
create policy "profile can read own planning photo objects" on storage.objects
  for select using (
    bucket_id = 'planning-photos'
    and public.can_read_app_data()
    and (public.is_admin_user() or auth.uid()::text = (storage.foldername(name))[1])
  );

drop policy if exists "profile can insert own planning photo objects" on storage.objects;
create policy "profile can insert own planning photo objects" on storage.objects
  for insert with check (
    bucket_id = 'planning-photos'
    and public.can_write_app_data()
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "profile can delete own planning photo objects" on storage.objects;
create policy "profile can delete own planning photo objects" on storage.objects
  for delete using (
    bucket_id = 'planning-photos'
    and public.can_write_app_data()
    and (public.is_admin_user() or auth.uid()::text = (storage.foldername(name))[1])
  );
