-- ===========================================================
--  ثَمين — إضافة «سلسلة الذكاء الاصطناعي» (٣ حلقات) لدورة المحترفين
--  Supabase ▸ مشروعك ▸ SQL Editor ▸ الصق هذا كله ▸ Run
--  آمن: يتأكد من الأعمدة أولًا، وما يكرّر الحلقات لو شغّلته مرتين.
-- ===========================================================

-- 1) التأكد من وجود الأعمدة المستخدمة (آمنة لو موجودة أصلًا)
alter table public.lessons add column if not exists description text;
alter table public.lessons add column if not exists folder text;
alter table public.lessons add column if not exists duration int default 0;

-- 2) إضافة الحلقات تحت قسم «دورة المحترفين» داخل مجلّد واحد
insert into public.lessons (section_id, title, embed_url, description, folder, sort)
select s.id, v.title, v.embed_url, v.description, 'سلسلة الذكاء الاصطناعي', v.sort
from (
  select id from public.sections
  where title ilike '%محترف%'           -- قسم المحترفين (عدّلها لو اسم القسم مختلف)
  order by sort, created_at limit 1
) s
cross join (values
  ('تحميل التطبيقات وربطها بالـ MCP',
   'https://iframe.mediadelivery.net/embed/281396/5b04f5da-9b96-480a-81c1-11d1776faea1',
   'التأسيس — تحميل التطبيقات وربطها بالـ MCP مرة واحدة.', 900),
  ('Claude + فيقما + الأفتر إفكتس',
   'https://iframe.mediadelivery.net/embed/281396/8c2fc5f2-f543-46fe-aa5f-4757afd163fb',
   'تصميم وحركة بالذكاء الاصطناعي.', 901),
  ('Claude AI + بريمير برو',
   'https://iframe.mediadelivery.net/embed/281396/e4a8f102-c0c8-4e0c-a89e-ccab446d7b8a',
   'مونتاج وتحكم كامل في التايملاين.', 902)
) as v(title, embed_url, description, sort)
where not exists (                       -- ما يكرّر لو الحلقة مضافة من قبل
  select 1 from public.lessons l where l.embed_url = v.embed_url
);

-- تم ✅  بعد التشغيل: حدّث صفحة الأكاديمية — راح تظهر نفس المجلّد بس بتقدّم محفوظ.
-- (نسخة الكود تتجاهل نفسها تلقائيًا لمّا تلقى الحلقات في قاعدة البيانات — ما فيه تكرار.)
