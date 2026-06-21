-- إضافة محتوى كلود والذكاء الاصطناعي
INSERT INTO knowledge_base (id, software, category, keywords, title, content, code, property, hint)
VALUES
  ('cross-claude-intro', 'cross', 'ai-tools', 
   ARRAY['كلود', 'claude', 'كلاود', 'ذكاء', 'اصطناعي', 'AI', 'شات', 'محادثة', 'anthropic'],
   'ما هو Claude AI', 
   'كلود هو نموذج ذكاء اصطناعي من شركة Anthropic. يساعدك بالكتابة، البرمجة، التحليل، والإجابة على الأسئلة. اشتراك Claude متوفر عندنا بباقتي Max x5 و Max x20 — رسمي وأصلي على إيميلك الشخصي.',
   NULL, NULL, 'للاشتراك تواصل واتساب'),
   
  ('cross-claude-features', 'cross', 'ai-tools',
   ARRAY['كلود', 'claude', 'مميزات', 'فوائد', 'استخدامات', 'ذكاء اصطناعي'],
   'مميزات Claude AI',
   'كلود يتميز بـ: 1) كتابة محتوى إبداعي ومقالات 2) مساعدة بالبرمجة والكود 3) تحليل الملفات والوثائق 4) محادثة طبيعية وفهم السياق 5) آمن ويحترم الخصوصية. الباقات المتوفرة: Max x5 للاستخدام المتوسط، Max x20 للاستخدام المكثف.',
   NULL, NULL, NULL),
   
  ('cross-claude-vs-chatgpt', 'cross', 'ai-tools',
   ARRAY['كلود', 'chatgpt', 'شات جي بي تي', 'مقارنة', 'فرق', 'أفضل'],
   'كلود vs ChatGPT',
   'كلود وChatGPT كلاهما نماذج ذكاء اصطناعي قوية. كلود يتميز بالدقة والأمان وفهم السياق الطويل. ChatGPT يتميز بالانتشار والإضافات. كلاهما ممتاز — اختر حسب احتياجك.',
   NULL, NULL, NULL),
   
  ('cross-ai-video-editing', 'cross', 'ai-tools',
   ARRAY['ذكاء اصطناعي', 'AI', 'مونتاج', 'فيديو', 'أدوات', 'مساعدة'],
   'الذكاء الاصطناعي بالمونتاج',
   'الذكاء الاصطناعي يساعد بالمونتاج: 1) Auto Reframe لتحويل الأبعاد 2) Scene Edit Detection لكشف القطعات 3) Auto Transcribe للترجمة التلقائية 4) Content-Aware Fill لإزالة العناصر. هذي الأدوات موجودة ببريمير وأفتر إفكتس.',
   NULL, NULL, NULL),
   
  ('cross-ai-subscription', 'cross', 'subscriptions',
   ARRAY['اشتراك', 'كلود', 'claude', 'سعر', 'باقة', 'max'],
   'اشتراك Claude AI',
   'اشتراك Claude AI متوفر عندنا بباقتي Max x5 و Max x20. الاشتراك رسمي وأصلي يُفعَّل على إيميلك الشخصي. الأسعار يحددها فريق الدعم حسب الباقة الأنسب لاستخدامك.',
   NULL, NULL, 'للاشتراك تواصل واتساب')
ON CONFLICT (id) DO UPDATE SET
  keywords = EXCLUDED.keywords,
  title = EXCLUDED.title,
  content = EXCLUDED.content;
