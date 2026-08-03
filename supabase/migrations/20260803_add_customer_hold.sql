-- 顧客を「いま追わない」状態にできるようにする。
--
-- 背景（2026-08-03 ユーザー要望）
--   - 問い合わせや申込は来たが契約まで行かなかった方を、それ以上追わないようにしたい
--   - ただし、あとから「やっぱりお願いしたい」となる前提で、情報は残しておきたい
--   - 産前に申込があり出産の連絡待ち、のようにすぐ次へ進めない場合も止めておきたい
--
-- 設計
--   進行ステータス（pipeline_stage）とは別軸で持つ。ステータスはそのまま残るので、
--   解除すれば元の段階から再開できる。
--
--   hold_state
--     active  … 通常。追いかける
--     waiting … 待ち。出産の連絡待ちなど、そのうち動く見込みがあるもの
--     paused  … 保留。契約に至らず、こちらからは追わないもの
--
--   hold_until を入れると、その日が来た時点で自動的に通常へ戻る（アラートに復帰する）。
--   空のままなら、手動で解除するまで通知は一切出ない。

alter table public.customers
  add column if not exists hold_state  text not null default 'active',
  add column if not exists hold_reason text,
  add column if not exists hold_until  date;

comment on column public.customers.hold_state  is '追跡状態: active(通常) / waiting(待ち) / paused(保留)';
comment on column public.customers.hold_reason is '止めている理由。一覧にも出す';
comment on column public.customers.hold_until  is 'この日が来たら自動で通常へ戻る。空なら手動解除まで止めたまま';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.customers'::regclass
      and conname = 'customers_hold_state_check'
  ) then
    alter table public.customers
      add constraint customers_hold_state_check
      check (hold_state in ('active', 'waiting', 'paused'));
  end if;
end $$;

-- 「いま追う必要がある顧客」を引くときに使う
create index if not exists customers_hold_state_idx
  on public.customers (user_id, hold_state);
