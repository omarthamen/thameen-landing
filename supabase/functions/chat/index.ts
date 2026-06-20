import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// ========== الـ Prompt الأساسي ==========
const BASE_PROMPT = `أنت المساعد الذكي لـ ثَمين (Thameen)، علامة تجارية متخصصة في تعليم المونتاج الاحترافي.

## المؤسس: عمر ثمين
- مونتير محترف اشتغل مع أكثر من 50 صانع محتوى عربي
- عمل مع: BanderitaX (20.8M)، oCMz (9.78M)، Suhaib (8.11M)، Ahmed Show (5.91M)، Peaks (1.14M)
- درّب مئات الطلاب على المونتاج الاحترافي

## الدورة الرئيسية: احترف المونتاج من الصفر خلال 90 يوم
- **3 دورات متكاملة:**
  1. التأسيس التقني (Premiere Pro من الصفر)
  2. الاحتراف البصري (تلوين متقدم، مالتي كام، الإيقاع)
  3. الـ 3D والذكاء الاصطناعي (After Effects + Claude AI)
- **السعر:** 179$ (بدل 380$) — دفعة واحدة
- **يشمل:** ملفات تدريب + 3 جلسات جماعية + كوميونيتي + وصول مدى الحياة

## أسلوبك
- مختصر جداً: سطر أو سطرين فقط
- عربي بسيط (لهجة بيضاء)
- لا مقدمات، فقط الحل مباشرة
- لا تستخدم إيموجي
- إيجابي دائماً

## قواعد صارمة
- **لا تخترع أرقام أو معلومات** — لو ما تعرف، قل "ما عندي معلومة دقيقة"
- **لا تجيب عن أسعار الصرف** — قل "تواصل مع الدعم لمعرفة المبلغ بعملتك"
- **لا تجيب عن مواضيع خارج المونتاج** — قل "أنا متخصص بالمونتاج ودورات ثَمين"`;

// ========== بناء سياق المشترك ==========
function buildUserContext(progress: any[], lessons: any[], sections: any[]): string {
  const totalLessons = lessons.length;
  const completedLessons = progress.filter(p => p.completed).length;
  const percent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  // آخر درس شاهده (الأحدث حسب updated_at)
  const lastWatched = progress
    .filter(p => p.lesson_id)
    .sort((a, b) => new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime())[0];

  const lastLesson = lastWatched ? lessons.find(l => l.id === lastWatched.lesson_id) : null;

  // الدروس الناقصة (غير مكتملة)
  const completedIds = new Set(progress.filter(p => p.completed).map(p => p.lesson_id));
  const incompleteLessons = lessons.filter(l => !completedIds.has(l.id));

  // بناء قائمة الدروس المختصرة مع الأقسام
  const sectionMap = new Map(sections.map(s => [s.id, s.title]));
  const lessonList = lessons.map(l => ({
    id: l.id,
    title: l.title,
    section: sectionMap.get(l.section_id) || "عام",
    completed: completedIds.has(l.id),
    topics: l.description?.slice(0, 100) || ""
  }));

  return `
## معلومات المشترك الحالي
- **التقدم:** ${completedLessons} من ${totalLessons} درس (${percent}%)
- **آخر درس شاهده:** ${lastLesson?.title || "لم يبدأ بعد"}
- **الدروس الناقصة:** ${incompleteLessons.length} درس

## قائمة الدروس المتاحة
${lessonList.map(l => `- [${l.completed ? "✓" : "○"}] ${l.title} (${l.section})`).join("\n")}

## تعليمات الرد
1. لما يسأل "كم خلّصت" أو "شنو تقدّمي": أعطه الإحصائيات أعلاه
2. لما يسأل عن موضوع معيّن: اقترح الدرس المناسب من القائمة
3. لو ما خلّص درس سابق مهم: ذكّره بلطف
4. لما تقترح درس: اذكر اسمه بالضبط حتى يقدر يبحث عنه`;
}

// ========== المعالج الرئيسي ==========
Deno.serve(async (req) => {
  // CORS
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  try {
    // ========== 1. استخراج هوية المستخدم من الـ JWT ==========
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "غير مصرح" }), {
        status: 401,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const token = authHeader.replace("Bearer ", "");

    // إنشاء Supabase client مع توكن المستخدم للتحقق
    const supabaseUser = createClient(SUPABASE_URL, token, {
      auth: { persistSession: false }
    });

    // التحقق من هوية المستخدم
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "جلسة غير صالحة" }), {
        status: 401,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    // ========== 2. جلب البيانات من القاعدة (بالـ service key) ==========
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // جلب الدروس والأقسام والتقدم بالتوازي
    const [lessonsRes, sectionsRes, progressRes] = await Promise.all([
      supabaseAdmin.from("lessons").select("id, title, description, section_id, embed_url").order("sort_order"),
      supabaseAdmin.from("sections").select("id, title").order("sort_order"),
      supabaseAdmin.from("progress").select("lesson_id, completed, percent, updated_at").eq("user_id", user.id),
    ]);

    const lessons = lessonsRes.data || [];
    const sections = sectionsRes.data || [];
    const progress = progressRes.data || [];

    // ========== 3. بناء الـ prompt الديناميكي ==========
    const { messages, lesson } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    // دمج الـ prompt الأساسي + سياق المشترك + سياق الدرس الحالي
    let fullPrompt = BASE_PROMPT + "\n" + buildUserContext(progress, lessons, sections);

    if (lesson?.title) {
      fullPrompt += `\n\n## الدرس الحالي\nالمشترك يشاهد الآن: "${lesson.title}"${lesson.section ? ` من قسم "${lesson.section}"` : ""}`;
    }

    // ========== 4. إرسال للـ AI ==========
    const groqMessages = [
      { role: "system", content: fullPrompt },
      ...messages.slice(-10),
    ];

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: groqMessages,
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      console.error("Groq error:", await response.text());
      return new Response(JSON.stringify({ error: "خطأ في خدمة الذكاء الاصطناعي" }), {
        status: 500,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "عذراً، حدث خطأ. حاول مرة ثانية.";

    return new Response(JSON.stringify({ reply }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });

  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: "خطأ داخلي" }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});
