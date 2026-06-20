-- جدول محادثات الشات بوت
-- الصق هذا في Supabase SQL Editor واضغط Run

CREATE TABLE IF NOT EXISTS chat_messages (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  lesson_id INTEGER REFERENCES lessons(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index للبحث السريع
CREATE INDEX IF NOT EXISTS idx_chat_messages_user ON chat_messages(user_id, created_at DESC);

-- RLS
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- المستخدم يشوف رسائله فقط
CREATE POLICY "Users read own messages" ON chat_messages
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users insert own messages" ON chat_messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own messages" ON chat_messages
  FOR DELETE USING (auth.uid() = user_id);
