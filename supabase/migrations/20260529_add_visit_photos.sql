alter table visits
  add column if not exists drive_link text;

create table if not exists visit_photos (
  id          uuid primary key default uuid_generate_v4(),
  visit_id    uuid references visits(id) on delete cascade not null,
  user_id     uuid references auth.users(id) on delete cascade not null,
  file_path   text not null,
  caption     text,
  sort_order  integer default 0,
  created_at  timestamptz default now()
);

alter table visit_photos enable row level security;

drop policy if exists "自分の訪問写真のみ" on visit_photos;
create policy "自分の訪問写真のみ" on visit_photos
  for all using (
    auth.uid() = user_id
    and exists (select 1 from visits where visits.id = visit_photos.visit_id and visits.user_id = auth.uid())
  )
  with check (
    auth.uid() = user_id
    and exists (select 1 from visits where visits.id = visit_photos.visit_id and visits.user_id = auth.uid())
  );

insert into storage.buckets (id, name, public)
values ('visit-photos', 'visit-photos', false)
on conflict (id) do nothing;

drop policy if exists "自分の訪問写真ファイルのみ参照" on storage.objects;
create policy "自分の訪問写真ファイルのみ参照" on storage.objects
  for select using (
    bucket_id = 'visit-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "自分の訪問写真ファイルのみ追加" on storage.objects;
create policy "自分の訪問写真ファイルのみ追加" on storage.objects
  for insert with check (
    bucket_id = 'visit-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "自分の訪問写真ファイルのみ削除" on storage.objects;
create policy "自分の訪問写真ファイルのみ削除" on storage.objects
  for delete using (
    bucket_id = 'visit-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
