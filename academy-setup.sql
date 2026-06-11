-- ===========================================================
--  ثَمين — منصّة الدورات (المرحلة الأولى) — شغّله مرة وحدة
--  Supabase ▸ مشروع Omar ▸ SQL Editor ▸ الصق كله ▸ Run
-- ===========================================================

-- ------- جداول المنصّة -------
create table if not exists public.sections (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  sort int default 0,
  created_at timestamptz default now()
);

create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  section_id uuid references public.sections(id) on delete cascade,
  title text not null,
  embed_url text,                 -- رابط Bunny iframe
  thumb_url text,                 -- صورة مصغّرة
  chapters jsonb default '[]'::jsonb,
  sort int default 0,
  created_at timestamptz default now()
);

create table if not exists public.progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  completed boolean default true,
  updated_at timestamptz default now(),
  primary key (user_id, lesson_id)
);

create table if not exists public.members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text,
  calls_total int default 3,
  calls_used int default 0,
  created_at timestamptz default now()
);

-- ------- تفعيل الحماية -------
alter table public.sections enable row level security;
alter table public.lessons  enable row level security;
alter table public.progress enable row level security;
alter table public.members  enable row level security;

-- الأقسام والدروس: يقرأها أي مشترك مسجّل دخول؛ التعديل للأدمن فقط
drop policy if exists "read sections" on public.sections;
create policy "read sections" on public.sections for select to authenticated using (true);
drop policy if exists "admin sections" on public.sections;
create policy "admin sections" on public.sections for all to authenticated
  using (auth.jwt()->>'email' = 'omarthamen@gmail.com')
  with check (auth.jwt()->>'email' = 'omarthamen@gmail.com');

drop policy if exists "read lessons" on public.lessons;
create policy "read lessons" on public.lessons for select to authenticated using (true);
drop policy if exists "admin lessons" on public.lessons;
create policy "admin lessons" on public.lessons for all to authenticated
  using (auth.jwt()->>'email' = 'omarthamen@gmail.com')
  with check (auth.jwt()->>'email' = 'omarthamen@gmail.com');

-- التقدّم: كل مشترك يشوف/يعدّل تقدّمه فقط؛ الأدمن يقرأ الكل
drop policy if exists "own progress" on public.progress;
create policy "own progress" on public.progress for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "admin read progress" on public.progress;
create policy "admin read progress" on public.progress for select to authenticated
  using (auth.jwt()->>'email' = 'omarthamen@gmail.com');

-- المشتركون: كل واحد يشوف ملفّه؛ الأدمن يدير الكل
drop policy if exists "own member read" on public.members;
create policy "own member read" on public.members for select to authenticated using (user_id = auth.uid());
drop policy if exists "own member insert" on public.members;
create policy "own member insert" on public.members for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "admin members" on public.members;
create policy "admin members" on public.members for all to authenticated
  using (auth.jwt()->>'email' = 'omarthamen@gmail.com')
  with check (auth.jwt()->>'email' = 'omarthamen@gmail.com');

-- ===========================================================
--  تشديد أمان الجداول القديمة: الكتابة للأدمن فقط
--  (مهم الآن لأن صار في مشتركين مسجّلين)
-- ===========================================================
drop policy if exists "admin write site_content" on public.site_content;
create policy "admin write site_content" on public.site_content for all to authenticated
  using (auth.jwt()->>'email' = 'omarthamen@gmail.com') with check (auth.jwt()->>'email' = 'omarthamen@gmail.com');

drop policy if exists "admin write media" on public.media;
create policy "admin write media" on public.media for all to authenticated
  using (auth.jwt()->>'email' = 'omarthamen@gmail.com') with check (auth.jwt()->>'email' = 'omarthamen@gmail.com');

drop policy if exists "admin update reviews" on public.reviews;
create policy "admin update reviews" on public.reviews for update to authenticated
  using (auth.jwt()->>'email' = 'omarthamen@gmail.com') with check (auth.jwt()->>'email' = 'omarthamen@gmail.com');

drop policy if exists "admin delete reviews" on public.reviews;
create policy "admin delete reviews" on public.reviews for delete to authenticated
  using (auth.jwt()->>'email' = 'omarthamen@gmail.com');

drop policy if exists "admin write media bucket" on storage.objects;
create policy "admin write media bucket" on storage.objects for all to authenticated
  using (bucket_id = 'media' and auth.jwt()->>'email' = 'omarthamen@gmail.com')
  with check (bucket_id = 'media' and auth.jwt()->>'email' = 'omarthamen@gmail.com');

-- تم ✅
