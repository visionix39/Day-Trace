-- DayTrace: one-time Supabase setup.
-- Paste this whole file into Supabase → SQL Editor → New query, and press Run.
--
-- It makes a private storage bucket for notebooks, and rules that let each
-- signed-in person read and write only their own folder (notebooks/<their id>/).
-- Nobody - not other users, not the public - can see anyone else's notebook.

-- 1. A private bucket. Each notebook is one small SQLite file (20 MB cap).
insert into storage.buckets (id, name, public, file_size_limit)
values ('notebooks', 'notebooks', false, 20971520)
on conflict (id) do nothing;

-- 2. Row-level security rules on stored files. The first folder in a file's
--    path must be the signed-in person's own user id.
create policy "notebooks: read own"
  on storage.objects for select to authenticated
  using (bucket_id = 'notebooks' and (storage.foldername(name))[1] = (select auth.uid()::text));

create policy "notebooks: create own"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'notebooks' and (storage.foldername(name))[1] = (select auth.uid()::text));

create policy "notebooks: update own"
  on storage.objects for update to authenticated
  using (bucket_id = 'notebooks' and (storage.foldername(name))[1] = (select auth.uid()::text))
  with check (bucket_id = 'notebooks' and (storage.foldername(name))[1] = (select auth.uid()::text));

create policy "notebooks: delete own"
  on storage.objects for delete to authenticated
  using (bucket_id = 'notebooks' and (storage.foldername(name))[1] = (select auth.uid()::text));
