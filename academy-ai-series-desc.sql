-- ===========================================================
--  ثَمين — تعبئة وصف الحلقة الأولى «تحميل التطبيقات وربطها بالـ MCP»
--  شغّله فقط لو أضفت الحلقات في قاعدة البيانات (عبر academy-ai-series.sql).
--  Supabase ▸ SQL Editor ▸ الصق ▸ Run.
--  ملاحظة: ``` تعمل صندوق أوامر بزر نسخ في صفحة الأكاديمية.
-- ===========================================================
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
