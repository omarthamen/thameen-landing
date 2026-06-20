import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// ═══════════════════════════════════════════════════════════
// الراوتر: يقرر أي محرّك يستخدم
// ═══════════════════════════════════════════════════════════
function routeMessage(message: string): "claude" | "groq" {
  const claudeKeywords = [
    "إكسبريشن", "expression", "كود", "code",
    "wiggle", "loopout", "loopin", "linear", "ease",
    "مشكلة", "خطأ", "error", "ليش ما يشتغل", "ما يشتغل",
    "اشرحلي بالتفصيل", "شنو الفرق", "كيف يعمل",
    "سكربت", "script", "اكتبلي", "سويلي"
  ];

  const msgLower = message.toLowerCase();
  const needsClaude = claudeKeywords.some(kw => msgLower.includes(kw.toLowerCase()));

  // سؤال طويل ومعقد
  if (message.length > 150) return "claude";

  return needsClaude ? "claude" : "groq";
}

// ═══════════════════════════════════════════════════════════
// البرومبت الأساسي
// ═══════════════════════════════════════════════════════════
const BASE_PROMPT = [
  "أنت مدرّب مونتاج عراقي ودّي من فريق ثَمين. تحكي بلهجة عراقية طبيعية.",
  "",
  "## المهم جداً - صيغة الرد:",
  "يجب أن ترد بـ JSON فقط بهذا الشكل:",
  '{"reply": "النص العربي هنا", "actions": [...]}',
  "",
  "## أنواع الـ actions المتاحة:",
  '1. فتح درس: {"type": "open_lesson", "lessonId": "uuid", "title": "اسم الدرس", "timestamp": 0}',
  '2. كود/إكسبريشن: {"type": "code_block", "language": "expression", "code": "الكود", "hint": "على أي خاصية"}',
  '3. اقتراح دروس: {"type": "suggest_lessons", "lessons": [{"lessonId": "uuid", "title": "اسم"}]}',
  "",
  "## قواعد الرد:",
  "- افهم نية السؤال أولاً: تحية؟ سؤال تقني؟ طلب درس؟ طلب إكسبريشن؟",
  "- لو طلب درس: ابحث بالقائمة أدناه وأرجع open_lesson مع الـ lessonId الصحيح",
  "- لو طلب إكسبريشن: أرجع code_block مع كود صحيح ومجرّب",
  "- لو سؤال بسيط: أرجع reply فقط بدون actions",
  "",
  "## أسلوبك:",
  "- لهجة عراقية بسيطة",
  "- جمل قصيرة وعملية",
  "- لا تستخدم إيموجي",
  "",
  "## اللغة:",
  "اكتب بالعربية فقط. ممنوع حروف صينية أو يابانية.",
  "المصطلحات الإنجليزية التقنية (Premiere, Timeline, wiggle) مسموحة.",
  "",
  "## قاعدة ذهبية:",
  "استخدم فقط الـ lessonId من قائمة الدروس أدناه. لا تخترع أي uuid."
].join("\n");

// برومبت خاص بالإكسبريشنز
const EXPRESSION_PROMPT = [
  "",
  "## أنت خبير After Effects Expressions:",
  "- اكتب إكسبريشنات صحيحة ومجرّبة فقط",
  "- الإكسبريشنات الشائعة:",
  "  • اهتزاز: wiggle(freq, amp)",
  "  • لوب: loopOut('cycle') أو loopOut('pingpong')",
  "  • وقت: time * speed",
  "  • ربط: thisComp.layer('name').transform.position",
  "  • شرطي: if(condition) value1 else value2",
  "  • عشوائي: random(min, max) أو seedRandom(index, true)",
  "  • انتقال سلس: linear(time, t1, t2, v1, v2) أو ease()",
  "- دائماً وضّح على أي خاصية ينحط (Position, Rotation, Opacity, Scale)",
  "- لا تخترع دوال غير موجودة"
].join("\n");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// ═══════════════════════════════════════════════════════════
// استدعاء Groq (للمهام البسيطة)
// ═══════════════════════════════════════════════════════════
async function callGroq(messages: any[], systemPrompt: string): Promise<string> {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + GROQ_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.slice(-10)
      ],
      max_tokens: 1000,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    throw new Error("Groq error: " + await response.text());
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

// ═══════════════════════════════════════════════════════════
// استدعاء Claude (للمهام الذكية)
// ═══════════════════════════════════════════════════════════
async function callClaude(messages: any[], systemPrompt: string): Promise<string> {
  // تحويل الرسائل لصيغة Claude
  const claudeMessages = messages.slice(-10).map((m: any) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: m.content
  }));

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY || "",
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6-20250514",
      max_tokens: 1500,
      system: systemPrompt,
      messages: claudeMessages,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("Claude error:", errText);
    // fallback to Groq if Claude fails
    return callGroq(messages, systemPrompt);
  }

  const data = await response.json();
  return data.content?.[0]?.text || "";
}

// ═══════════════════════════════════════════════════════════
// معالجة الرد وتحويله لـ JSON
// ═══════════════════════════════════════════════════════════
function parseResponse(raw: string): { reply: string; actions?: any[] } {
  // محاولة استخراج JSON
  try {
    // إزالة أي نص قبل/بعد الـ JSON
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.reply) {
        return {
          reply: parsed.reply,
          actions: parsed.actions || undefined
        };
      }
    }
  } catch (e) {
    // فشل التحليل، نرجع النص كما هو
  }

  // fallback: نرجع النص الخام
  return { reply: raw.replace(/```json|```/g, "").trim() };
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

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    let userContext = "";
    let lessonsList: any[] = [];

    if (user && !userError) {
      const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

      const [lessonsRes, sectionsRes, progressRes] = await Promise.all([
        admin.from("lessons").select("id, title, section_id, description").order("sort"),
        admin.from("sections").select("id, title").order("sort"),
        admin.from("progress").select("lesson_id, completed").eq("user_id", user.id),
      ]);

      const lessons = lessonsRes.data || [];
      const sections = sectionsRes.data || [];
      const progress = progressRes.data || [];

      lessonsList = lessons;

      const totalLessons = lessons.length;
      const completedLessons = progress.filter((p: any) => p.completed).length;
      const percent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

      const completedIds = new Set(progress.filter((p: any) => p.completed).map((p: any) => p.lesson_id));
      const sectionMap = new Map(sections.map((s: any) => [s.id, s.title]));

      const nextLesson = lessons.find((l: any) => !completedIds.has(l.id));
      const nextLessonInfo = nextLesson
        ? nextLesson.title + " (lessonId: " + nextLesson.id + ")"
        : "أكمل كل الدروس";

      // قائمة الدروس مع الـ IDs للبوت
      const lessonList = lessons.map((l: any) => {
        const done = completedIds.has(l.id) ? "done" : "pending";
        const sec = sectionMap.get(l.section_id) || "";
        return "- [" + done + "] " + l.title + " | lessonId: " + l.id + " | قسم: " + sec;
      }).join("\n");

      userContext = [
        "",
        "## معلومات المشترك",
        "- التقدم: " + completedLessons + " من " + totalLessons + " درس (" + percent + "%)",
        "- الدرس الجاي: " + nextLessonInfo,
        "",
        "## قائمة الدروس (استخدم الـ lessonId بالضبط)",
        lessonList
      ].join("\n");
    }

    const body = await req.json();
    const messages = body.messages || [];
    const lesson = body.lesson;
    const lastMessage = messages[messages.length - 1]?.content || "";

    // تحديد المحرّك
    const engine = routeMessage(lastMessage);
    console.log("=== Router: " + engine + " ===");

    // بناء البرومبت
    let fullPrompt = BASE_PROMPT + userContext;

    // إضافة برومبت الإكسبريشنز لو الطلب يتعلق بإكسبريشن
    if (lastMessage.toLowerCase().includes("إكسبريشن") ||
        lastMessage.toLowerCase().includes("expression") ||
        lastMessage.toLowerCase().includes("wiggle")) {
      fullPrompt += EXPRESSION_PROMPT;
    }

    if (lesson && lesson.title) {
      fullPrompt += "\n\n## الدرس الحالي\nالمشترك يشاهد: " + lesson.title;
    }

    // استدعاء المحرّك المناسب
    let rawResponse: string;
    if (engine === "claude" && ANTHROPIC_API_KEY) {
      rawResponse = await callClaude(messages, fullPrompt);
    } else {
      rawResponse = await callGroq(messages, fullPrompt);
    }

    // تحليل الرد
    const result = parseResponse(rawResponse);

    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (err: any) {
    console.error("Error:", err);
    return new Response(JSON.stringify({
      reply: "عذراً، حدث خطأ. حاول مرة ثانية.",
      error: err.message
    }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
