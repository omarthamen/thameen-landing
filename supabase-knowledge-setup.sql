-- تفعيل extension للبحث النصي (مطلوب للـ ILIKE fallback)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ═══════════════════════════════════════════════════════════
-- جدول قاعدة المعرفة
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS knowledge_base (
  id TEXT PRIMARY KEY,
  software TEXT NOT NULL,        -- premiere, aftereffects, figma, cross
  category TEXT NOT NULL,        -- timeline, effects, expressions, problems...
  keywords TEXT[] NOT NULL,      -- مصفوفة كلمات مفتاحية
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  code TEXT,                     -- للإكسبريشنات فقط
  property TEXT,                 -- على أي خاصية (للإكسبريشنات)
  hint TEXT                      -- ملاحظة إضافية
);

-- Index للبحث بالـ overlap
CREATE INDEX IF NOT EXISTS idx_kb_keywords ON knowledge_base USING GIN (keywords);
CREATE INDEX IF NOT EXISTS idx_kb_software ON knowledge_base (software);
CREATE INDEX IF NOT EXISTS idx_kb_category ON knowledge_base (category);

-- Index للـ ILIKE fallback
CREATE INDEX IF NOT EXISTS idx_kb_title_trgm ON knowledge_base USING GIN (title gin_trgm_ops);

-- RLS
ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read" ON knowledge_base FOR SELECT USING (true);

-- ═══════════════════════════════════════════════════════════
-- جدول الأسئلة بدون جواب
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS unanswered_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  search_words TEXT[],           -- الكلمات اللي بحثنا فيها
  asked_at TIMESTAMPTZ DEFAULT now(),
  resolved BOOLEAN DEFAULT false,
  resolved_item_id TEXT          -- لما نضيف عنصر يغطيها
);

-- RLS
ALTER TABLE unanswered_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users insert own" ON unanswered_questions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admin read all" ON unanswered_questions FOR SELECT USING (auth.jwt()->>'email' = 'omarthamen@gmail.com');

