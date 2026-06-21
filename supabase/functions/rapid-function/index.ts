import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// ═══════════════════════════════════════════════════════════
// معلومات ثمين الأساسية
// ═══════════════════════════════════════════════════════════
const THAMEEN_INFO = `
## عن ثمين
ثمين هي أكاديمية لتعليم المونتاج الاحترافي من الصفر خلال 90 يوم.
المدرب: عمر ثمين، مونتير محترف اشتغل مع أكثر من 50 صانع محتوى كبير.

## الدورات (3 دورات في باقة واحدة)
1. المونتاج من الصفر (Premiere Pro) - للمبتدئين - 6 دروس
2. تطوير المحترفين (Premiere Pro) - للمتوسطين - 11 درس
3. الـ 3D في After Effects - متقدم

## السعر
179$ فقط (بدلاً من 380$)
يشمل: الدورات الثلاث + ماتيريال + جلسات شهرية + دعم مباشر + وصول مدى الحياة

## ما يحصل عليه المشترك
- دروس مرتبة من الصفر للاحتراف
- جلسات توجيه جماعية شهرية (3 أشهر)
- دعم شخصي عبر الرسائل
- ملفات جاهزة (انتقالات، ساوند إيفكتس، اختصارات)
- وصول مدى الحياة للمحتوى

## طرق الدفع
بطاقة بنكية أو تواصل واتساب لترتيب طريقة تناسبك

## الأسئلة الشائعة
- "أنا مبتدئ": الدورة تبدأ من الصفر تماماً
- "عندي أساسيات": قسم الاحتراف و3D سيرفعك لمستوى جديد
- "ما عندي وقت": ساعة إلى ساعتين يومياً تكفي
- "أخاف أوقف": عندك دعم مباشر وجلسات شهرية
- "ليش مو يوتيوب؟": اليوتيوب أدوات مبعثرة، هنا مسار كامل مع متابعة
`;

const LINKS = {
  whatsapp: "https://wa.me/9647518838203",
  website: "https://thameen.shop",
  academy: "https://thameen.shop/academy.html",
  instagram: "https://www.instagram.com/thameen.j/",
  youtube: "https://www.youtube.com/channel/UCMeR85JgB5jXCZTQy1C69pA"
};

// ═══════════════════════════════════════════════════════════
// البرومبت الأساسي
// ═══════════════════════════════════════════════════════════
const SYSTEM_PROMPT = `أنت مساعد أكاديمية ثمين. تتحدث بالعربية الفصحى الواضحة.

${THAMEEN_INFO}

## طريقة الرد
أرجع JSON بهذا الشكل فقط:
{"reply": "ردك هنا", "actions": []}

## أنواع الـ actions المتاحة:
- {"type": "open_whatsapp", "text": "تواصل معنا"} — لفتح واتساب
- {"type": "open_lesson", "lessonId": "uuid", "title": "اسم الدرس"} — للمشتركين فقط
- {"type": "code_block", "language": "expression", "code": "...", "hint": "..."} — للإكسبريشنات

## قواعد مهمة:
1. أجب من المعلومات المذكورة أو من نتائج البحث فقط
2. لا تخترع معلومات غير موجودة
3. للأسئلة عن الاشتراك/السعر/الدفع: أضف زر واتساب
4. ردود قصيرة ومفيدة (2-4 جمل)
5. تحدث بالفصحى الواضحة
`;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// ═══════════════════════════════════════════════════════════
// مرادفات للبحث
// ═══════════════════════════════════════════════════════════
const SYNONYMS: Record<string, string[]> = {
  "باونس": ["bounce", "ارتداد", "نطة"],
  "bounce": ["باونس", "ارتداد", "نطة"],
  "ويقل": ["wiggle", "اهتزاز", "رجفة"],
  "wiggle": ["ويقل", "اهتزاز", "رجفة"],
  "لوب": ["loop", "تكرار"],
  "loop": ["لوب", "تكرار"],
  "بريمير": ["premiere", "pr"],
  "premiere": ["بريمير", "pr"],
  "افتر": ["aftereffects", "ae", "أفتر"],
  "aftereffects": ["افتر", "ae"],
  "تصدير": ["export", "رندر", "render"],
  "export": ["تصدير", "رندر"],
};

const STOP_WORDS = new Set([
  "شلون", "كيف", "ممكن", "اريد", "أريد", "عندي", "شنو", "ليش",
  "هل", "لو", "في", "على", "من", "الى", "عن", "مع", "ما",
  "please", "help", "want", "need", "how", "what", "the", "is"
]);

// ═══════════════════════════════════════════════════════════
// استخراج كلمات البحث
// ═══════════════════════════════════════════════════════════
function extractSearchWords(query: string): string[] {
  const words = query
    .toLowerCase()
    .replace(/[؟?!.,،؛:]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 1 && w.length < 30)
    .filter(w => !STOP_WORDS.has(w));
  return [...new Set(words)];
}

function expandWithSynonyms(words: string[]): string[] {
  const expanded = new Set(words);
  for (const word of words) {
    const syns = SYNONYMS[word.toLowerCase()];
    if (syns) syns.forEach(s => expanded.add(s.toLowerCase()));
  }
  return [...expanded];
}

// ═══════════════════════════════════════════════════════════
// حساب الـ score
// ═══════════════════════════════════════════════════════════
function calculateScore(keywords: string[], queryWords: string[]): number {
  let score = 0;
  const keywordsLower = keywords.map(k => String(k || "").toLowerCase());
  const expandedQuery = expandWithSynonyms(queryWords);

  for (const word of expandedQuery) {
    if (keywordsLower.includes(word)) {
      score += 10;
    } else {
      for (const kw of keywordsLower) {
        if (kw.includes(word) || word.includes(kw)) {
          score += 5;
          break;
        }
      }
    }
  }
  return score;
}

// ═══════════════════════════════════════════════════════════
// البحث في قاعدة المعرفة
// ═══════════════════════════════════════════════════════════
const MIN_SCORE = 10;

async function searchKnowledgeDB(
  admin: any,
  queryWords: string[],
  maxResults: number = 3
): Promise<any[]> {
  if (!queryWords || queryWords.length === 0) return [];

  const expandedWords = expandWithSynonyms(queryWords);

  // المحاولة 1: overlap على keywords
  const { data: overlapResults } = await admin
    .from("knowledge_base")
    .select("*")
    .overlaps("keywords", expandedWords)
    .limit(15);

  if (overlapResults && overlapResults.length > 0) {
    const scored = overlapResults.map((item: any) => ({
      ...item,
      _score: calculateScore(item.keywords || [], queryWords)
    }));
    scored.sort((a: any, b: any) => b._score - a._score);
    return scored.filter((r: any) => r._score >= MIN_SCORE).slice(0, maxResults);
  }

  // المحاولة 2: ILIKE على title (مع تطبيق MIN_SCORE)
  for (const word of expandedWords.slice(0, 3)) {
    if (word.length < 2) continue;
    const { data: titleResults } = await admin
      .from("knowledge_base")
      .select("*")
      .ilike("title", `%${word}%`)
      .limit(10);

    if (titleResults && titleResults.length > 0) {
      const scored = titleResults.map((item: any) => ({
        ...item,
        _score: calculateScore(item.keywords || [], queryWords)
      }));
      const filtered = scored.filter((r: any) => r._score >= MIN_SCORE);
      if (filtered.length > 0) {
        return filtered.slice(0, maxResults);
      }
    }
  }

  return [];
}

// ═══════════════════════════════════════════════════════════
// تصنيف نوع السؤال
// ═══════════════════════════════════════════════════════════
type QueryType = "technical" | "subscription" | "progress" | "chat";

function detectQueryType(query: string): QueryType {
  const q = query.toLowerCase();

  // أسئلة التقدم
  if (/تقدم|وصلت|أكملت|خلصت|شفت|الجاي|التالي|كم درس|كم يوم/.test(q)) {
    return "progress";
  }

  // أسئلة الاشتراك (بدون "كم" لأنها تخطف أسئلة التقدم)
  if (/اشتراك|سعر|باقة|أدوبي|adobe|شراء|دفع|فلوس|دولار/.test(q)) {
    return "subscription";
  }

  // أسئلة تقنية
  if (/بريمير|premiere|افتر|aftereffects|expression|إكسبريشن|كود|code|wiggle|bounce|loop|تصدير|export|كي فريم|keyframe|ماسك|mask|تراك|افكت|effect|تلوين|color/.test(q)) {
    return "technical";
  }

  return "chat";
}

// ═══════════════════════════════════════════════════════════
// استدعاء Groq (Llama 3.3 70B) مع تاريخ المحادثة
// ═══════════════════════════════════════════════════════════
async function callGroq(messages: any[], systemPrompt: string): Promise<string> {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + GROQ_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.slice(-6).map((m: any) => ({
          role: m.role || "user",
          content: String(m.content || "").slice(0, 500)
        }))
      ],
      max_tokens: 350,
      temperature: 0.3,
      response_format: { type: "json_object" }
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("[Groq] Error:", errText);
    throw new Error("Groq API error");
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

// ═══════════════════════════════════════════════════════════
// معالجة الرد
// ═══════════════════════════════════════════════════════════
function parseResponse(raw: string): { reply: string; actions?: any[] } {
  try {
    const parsed = JSON.parse(raw);
    return {
      reply: parsed.reply || "عذراً، لم أفهم. كيف أساعدك؟",
      actions: Array.isArray(parsed.actions) ? parsed.actions.filter((a: any) => a && a.type) : undefined
    };
  } catch {
    return { reply: raw || "عذراً، حدث خطأ." };
  }
}

// ═══════════════════════════════════════════════════════════
// المعالج الرئيسي
// ═══════════════════════════════════════════════════════════
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ reply: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } }
    });
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data: { user } } = await supabase.auth.getUser(token);
    console.log("[Auth] User ID:", user?.id || "NO USER");

    const body = await req.json();
    const messages = body.messages || [];
    const lastMessage = String(messages[messages.length - 1]?.content || "");

    console.log("[Main] Message:", lastMessage.slice(0, 100));

    // === تصنيف السؤال ===
    const queryType = detectQueryType(lastMessage);
    const queryWords = extractSearchWords(lastMessage);
    console.log("[Main] Type:", queryType, "Words:", queryWords);

    // === جمع معلومات تقدم المشترك ===
    let progressInfo = "";
    let incompleteLessonsList = "";

    if (user) {
      try {
        const [lessonsRes, sectionsRes, progressRes, memberRes] = await Promise.all([
          admin.from("lessons").select("id, title, section_id, sort").order("sort"),
          admin.from("sections").select("id, title, sort").order("sort"),
          admin.from("progress").select("lesson_id, completed, percent").eq("user_id", user.id),
          admin.from("members").select("created_at").eq("user_id", user.id).single(),
        ]);

        const lessons = lessonsRes.data || [];
        const sections = sectionsRes.data || [];
        const progress = progressRes.data || [];
        const member = memberRes.data;

        // إنشاء خريطة للدورات
        const sectionMap = new Map(sections.map((s: any) => [s.id, s.title]));

        // الدرس مكتمل لما percent >= 90 أو completed = true
        // Debug: طباعة بيانات التقدم
        console.log("[Progress] Raw progress data:", JSON.stringify(progress.slice(0, 5)));

        const completedIds = new Set(
          progress
            .filter((p: any) => p.completed || (p.percent && p.percent >= 90))
            .map((p: any) => p.lesson_id)
        );

        console.log("[Progress] Completed IDs count:", completedIds.size);
        console.log("[Progress] Completed IDs:", Array.from(completedIds).slice(0, 5));

        const totalLessons = lessons.length;
        const completedLessons = completedIds.size;
        const progressPercent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

        // الدرس التالي = أول درس غير مكتمل
        const nextLesson = lessons.find((l: any) => !completedIds.has(l.id));

        // حساب رقم الدرس ضمن الدورة واسم الدورة
        let nextLessonInfo = "";
        if (nextLesson) {
          const sectionLessons = lessons.filter((l: any) => l.section_id === nextLesson.section_id);
          const lessonIndex = sectionLessons.findIndex((l: any) => l.id === nextLesson.id) + 1;
          const sectionTitle = sectionMap.get(nextLesson.section_id) || "الدورة";
          nextLessonInfo = `الدرس ${lessonIndex} من ${sectionLessons.length} في "${sectionTitle}"`;
        }
        console.log("[Progress] Next lesson:", nextLesson?.title, "Info:", nextLessonInfo);

        // حساب الأيام
        let daysInfo = "";
        if (member?.created_at) {
          const startDate = new Date(member.created_at);
          const today = new Date();
          const diffTime = today.getTime() - startDate.getTime();
          const daysPassed = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
          const daysLeft = Math.max(0, 90 - daysPassed);

          if (daysPassed >= 90) {
            daysInfo = "أكمل تحدي الـ 90 يوم!";
          } else {
            daysInfo = `اليوم ${daysPassed} من 90، متبقي ${daysLeft} يوم`;
          }
        }

        // قائمة الدروس غير المكتملة
        const incompleteLessons = lessons
          .filter((l: any) => !completedIds.has(l.id))
          .slice(0, 5);

        incompleteLessonsList = incompleteLessons
          .map((l: any) => {
            const secLessons = lessons.filter((x: any) => x.section_id === l.section_id);
            const idx = secLessons.findIndex((x: any) => x.id === l.id) + 1;
            const secTitle = sectionMap.get(l.section_id) || "";
            return `  - "${l.title}" (رقم ${idx} في ${secTitle}) (lessonId: ${l.id}, sectionId: ${l.section_id})`;
          })
          .join("\n");

        // قائمة كل الدورات والدروس
        const allCoursesInfo = sections.map((sec: any) => {
          const secLessons = lessons.filter((l: any) => l.section_id === sec.id);
          const lessonsList = secLessons.map((l: any, i: number) =>
            `    ${i+1}. ${l.title}${completedIds.has(l.id) ? ' ✓' : ''}`
          ).join('\n');
          return `- ${sec.title} (${secLessons.length} درس):\n${lessonsList}`;
        }).join('\n');

        progressInfo = `
## تقدم المشترك الحالي:
- أكمل ${completedLessons} من ${totalLessons} درس (${progressPercent}%)
- ${daysInfo}
- الدرس التالي: ${nextLesson ? nextLesson.title : "أكمل جميع الدروس!"}
${nextLesson ? `- ${nextLessonInfo}` : ""}
${nextLesson ? `- معرّف الدرس التالي (lessonId): ${nextLesson.id}, sectionId: ${nextLesson.section_id}` : ""}

## كل الدورات والدروس المتاحة:
${allCoursesInfo}

## الدروس غير المكتملة (رشّح منها):
${incompleteLessonsList || "- أكمل جميع الدروس!"}

## قواعد الترشيح:
- لا ترشّح درس أكمله المشترك (عليه ✓)
- استخدم open_lesson مع lessonId الصحيح
- لو سأل عن درس معين، ابحث في القائمة أعلاه
`;
      } catch (e) {
        console.error("[Progress] Error:", e);
      }
    }

    // === بناء البرومبت حسب نوع السؤال ===
    let fullPrompt = SYSTEM_PROMPT;
    let knowledgeContext = "";

    if (queryType === "technical" && queryWords.length > 0) {
      // بحث في قاعدة المعرفة
      const results = await searchKnowledgeDB(admin, queryWords, 3);
      console.log("[Main] Knowledge results:", results.length);

      if (results.length > 0) {
        knowledgeContext = "\n## نتائج البحث (أجب منها):\n";
        results.forEach((r: any) => {
          // استخدام الأعمدة الموجودة فقط: title, category, software
          knowledgeContext += `- ${r.title} (${r.software || "عام"})\n`;
        });
        fullPrompt += knowledgeContext;
      } else {
        fullPrompt += "\n## لم أجد نتيجة تقنية مطابقة. أجب بشكل عام أو اطلب توضيح.";
      }
    } else if (queryType === "subscription") {
      fullPrompt += "\n## سؤال عن الاشتراك: أجب من معلومات ثمين أعلاه وأضف زر واتساب.";
    } else if (queryType === "progress") {
      // لا حاجة لبحث، المعلومات في progressInfo
    }

    // إضافة معلومات التقدم للمشتركين
    if (progressInfo) {
      fullPrompt += progressInfo;
    }

    // === استدعاء Groq مع تاريخ المحادثة ===
    const rawResponse = await callGroq(messages, fullPrompt);
    console.log("[Main] Response:", rawResponse.slice(0, 200));

    const result = parseResponse(rawResponse);

    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (err: any) {
    console.error("[Main] Error:", err?.message || err);
    return new Response(JSON.stringify({
      reply: "عذراً، حدث خطأ تقني. يرجى المحاولة مرة أخرى."
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
