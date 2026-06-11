-- ===========================================================
--  ثَمين — إعداد قاعدة بيانات الداشبورد (شغّله مرة وحدة)
--  Supabase ▸ مشروعك ▸ SQL Editor ▸ الصق هذا كله ▸ Run
-- ===========================================================

-- 1) جدول التعليقات (reviews): إضافة أعمدة الإدارة لو مو موجودة
alter table public.reviews add column if not exists hidden boolean default false;
alter table public.reviews add column if not exists created_at timestamptz default now();

-- 2) محتوى مفرد (الفيديو، البوستر، نصوص لاحقًا) — مفتاح/قيمة
create table if not exists public.site_content (
  key        text primary key,
  value      jsonb,
  updated_at timestamptz default now()
);

-- 3) الوسائط (صور القنوات + نماذج الشغل + معرض)
create table if not exists public.media (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null,           -- 'channel' | 'work' | 'gallery'
  url        text not null,           -- رابط الصورة/الفيديو
  title      text,                    -- اسم القناة / عنوان
  meta       text,                    -- مثلاً "2.3M مشاهدة"
  sort       int  default 0,
  created_at timestamptz default now()
);

-- ---------- تفعيل حماية الصفوف ----------
alter table public.site_content enable row level security;
alter table public.media        enable row level security;
alter table public.reviews      enable row level security;

-- ---------- القراءة: متاحة للجميع (الموقع العام) ----------
drop policy if exists "read site_content" on public.site_content;
create policy "read site_content" on public.site_content for select using (true);

drop policy if exists "read media" on public.media;
create policy "read media" on public.media for select using (true);

drop policy if exists "read reviews" on public.reviews;
create policy "read reviews" on public.reviews for select using (true);

-- ---------- إضافة التعليقات: متاحة للزوّار (بدون حساب) ----------
drop policy if exists "insert reviews" on public.reviews;
create policy "insert reviews" on public.reviews for insert with check (true);

-- ---------- الكتابة/الحذف: فقط للمسجّل دخوله (أنت) ----------
drop policy if exists "admin write site_content" on public.site_content;
create policy "admin write site_content" on public.site_content
  for all to authenticated using (true) with check (true);

drop policy if exists "admin write media" on public.media;
create policy "admin write media" on public.media
  for all to authenticated using (true) with check (true);

drop policy if exists "admin update reviews" on public.reviews;
create policy "admin update reviews" on public.reviews
  for update to authenticated using (true) with check (true);

drop policy if exists "admin delete reviews" on public.reviews;
create policy "admin delete reviews" on public.reviews
  for delete to authenticated using (true);

-- ---------- التخزين: bucket عام اسمه media للرفع ----------
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

drop policy if exists "read media bucket" on storage.objects;
create policy "read media bucket" on storage.objects
  for select using (bucket_id = 'media');

drop policy if exists "admin write media bucket" on storage.objects;
create policy "admin write media bucket" on storage.objects
  for all to authenticated using (bucket_id = 'media') with check (bucket_id = 'media');

-- تم ✅  بعدها: Authentication ▸ Users ▸ Add user (إيميلك + كلمة سرّك)
