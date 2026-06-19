-- جدول صور ردود الفعل
-- الصق هذا في Supabase SQL Editor واضغط Run

CREATE TABLE IF NOT EXISTS feedback_images (
  id SERIAL PRIMARY KEY,
  url TEXT NOT NULL,
  sort INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- السماح بالقراءة للجميع
ALTER TABLE feedback_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read" ON feedback_images FOR SELECT USING (true);

-- الأدمن فقط يقدر يضيف/يعدل/يحذف
CREATE POLICY "Admin insert" ON feedback_images FOR INSERT WITH CHECK (auth.jwt()->>'email' = 'omarthamen@gmail.com');
CREATE POLICY "Admin update" ON feedback_images FOR UPDATE USING (auth.jwt()->>'email' = 'omarthamen@gmail.com');
CREATE POLICY "Admin delete" ON feedback_images FOR DELETE USING (auth.jwt()->>'email' = 'omarthamen@gmail.com');
