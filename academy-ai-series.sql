-- ===========================================================
--  ثَمين — ترتيب «سلسلة الذكاء الاصطناعي» (٣ حلقات) في دورة المحترفين
--  Supabase ▸ SQL Editor ▸ الصق هذا كله ▸ Run.
--  آمن وقابل للإعادة: يمسح أي نسخ قديمة ثم يضيفها بالترتيب الصحيح + الوصف.
-- ===========================================================

-- 1) التأكد من الأعمدة
alter table public.lessons add column if not exists description text;
alter table public.lessons add column if not exists folder text;
alter table public.lessons add column if not exists duration int default 0;

-- 2) مسح أي نسخ سابقة لهذه الحلقات (يشيل التكرار والترتيب الغلط)
delete from public.lessons where embed_url in (
  'https://iframe.mediadelivery.net/embed/281396/5b04f5da-9b96-480a-81c1-11d1776faea1',
  'https://iframe.mediadelivery.net/embed/281396/8c2fc5f2-f543-46fe-aa5f-4757afd163fb',
  'https://iframe.mediadelivery.net/embed/281396/e4a8f102-c0c8-4e0c-a89e-ccab446d7b8a'
);

-- 3) إضافة الثلاثة بالترتيب الصحيح داخل قسم المحترفين، في مجلّد واحد
insert into public.lessons (section_id, title, embed_url, description, folder, sort)
select s.id, v.title, v.embed_url, v.description, 'سلسلة الذكاء الاصطناعي', v.sort
from (select id from public.sections where title ilike '%محترف%' order by sort, created_at limit 1) s
cross join (values
  ('Claude + فيقما + الأفتر إفكتس',
   'https://iframe.mediadelivery.net/embed/281396/8c2fc5f2-f543-46fe-aa5f-4757afd163fb',
   'تصميم وحركة بالذكاء الاصطناعي.', 901),
  ('تحميل التطبيقات وربطها بالـ MCP',
   'https://iframe.mediadelivery.net/embed/281396/5b04f5da-9b96-480a-81c1-11d1776faea1',
   'التأسيس — تحميل التطبيقات وربطها بالـ MCP مرة واحدة.', 902),
  ('Claude AI + بريمير برو',
   'https://iframe.mediadelivery.net/embed/281396/e4a8f102-c0c8-4e0c-a89e-ccab446d7b8a',
   'مونتاج وتحكم كامل في التايملاين.', 903)
) as v(title, embed_url, description, sort);

-- 4) وصف المقطع الأول (الروابط + الأوامر — ``` تعمل صندوق نسخ في الأكاديمية)
update public.lessons
set description = $desc$Claude Desktop
https://claude.ai/download
VS Code
https://code.visualstudio.com
Node.js (LTS)
https://nodejs.org
Git for Windows — ويندوز فقط
https://git-scm.com/download/win
Premiere MCP
https://github.com/hetpatel-11/Adobe_Premiere_Pro_MCP
After Effects MCP
https://github.com/ishu86/after-effects-mcp
طريقة تثبيت الـ MCP — انسخ والصق في التيرمنال:
```
cd ~/Downloads
git clone https://github.com/ishu86/Adobe_Premiere_Pro_MCP-main.git
cd after-effects-mcp
npm install
npm run build
cd scripts
```
على ماك:
```
bash install-cep.sh
```
على ويندوز:
```
./install-cep.bat
```
ربط بريمير برو على ماك:
```
cd ~/Downloads/Adobe_Premiere_Pro_MCP
npm run setup:mac
```$desc$
where embed_url = 'https://iframe.mediadelivery.net/embed/281396/5b04f5da-9b96-480a-81c1-11d1776faea1';

-- تم ✅  حدّث صفحة الأكاديمية — الثلاثة بالترتيب الصحيح + وصف المقطع الأول.
