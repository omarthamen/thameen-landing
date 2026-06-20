import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const BASE_PROMPT = [
  "أنت المساعد الذكي لـ ثَمين (Thameen)، علامة تجارية متخصصة في تعليم المونتاج الاحترافي.",
  "",
  "## المؤسس: عمر ثمين",
  "- مونتير محترف اشتغل مع أكثر من 50 صانع محتوى عربي",
  "- عمل مع: BanderitaX، oCMz، Suhaib، Ahmed Show، Peaks",
  "- درّب مئات الطلاب على المونتاج الاحترافي",
  "",
  "## الدورة الرئيسية: احترف المونتاج من الصفر خلال 90 يوم",
  "- 3 دورات متكاملة: التأسيس التقني، الاحتراف البصري، الـ 3D والذكاء الاصطناعي",
  "- السعر: 179$ دفعة واحدة",
  "- يشمل: ملفات تدريب + 3 جلسات جماعية + كوميونيتي + وصول مدى الحياة",
  "",
  "## أسلوبك",
  "- مختصر جداً: سطر أو سطرين فقط",
  "- عربي بسيط (لهجة بيضاء)",
  "- لا مقدمات، فقط الحل مباشرة",
  "- لا تستخدم إيموجي",
  "- إيجابي دائماً",
  "",
  "## قواعد صارمة",
  "- لا تخترع أرقام أو معلومات - لو ما تعرف، قل: ما عندي معلومة دقيقة",
  "- لا تجيب عن أسعار الصرف - قل: تواصل مع الدعم لمعرفة المبلغ بعملتك",
  "- لا تجيب عن مواضيع خارج المونتاج - قل: أنا متخصص بالمونتاج ودورات ثَمين"
].join("\n");

interface ProgressRow {
  lesson_id: string;
  completed: boolean;
  percent?: number;
  updated_at?: string;
}

interface LessonRow {
  id: string;
  title: string;
  description?: string;
  section_id: string;
  embed_url?: string;
}

interface SectionRow {
  id: string;
  title: string;
}

function buildUserContext(progress: ProgressRow[], lessons: LessonRow[], sections: SectionRow[]): string {
  const totalLessons = lessons.length;
  const completedLessons = progress.filter(p => p.completed).length;
  const percent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  const lastWatched = progress
    .filter(p => p.lesson_id && p.updated_at)
    .sort((a, b) => new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime())[0];

  const lastLesson = lastWatched ? lessons.find(l => l.id === lastWatched.lesson_id) : null;

  const completedIds = new Set(progress.filter(p => p.completed).map(p => p.lesson_id));
  const incompleteLessons = lessons.filter(l => !completedIds.has(l.id));

  const sectionMap = new Map(sections.map(s => [s.id, s.title]));

  const lessonListStr = lessons.map(l => {
    const mark = completedIds.has(l.id) ? "done" : "pending";
    const sec = sectionMap.get(l.section_id) || "عام";
    return "- [" + mark + "] " + l.title + " (" + sec + ")";
  }).join("\n");

  const lines = [
    "",
    "## معلومات المشترك الحالي",
    "- التقدم: " + completedLessons + " من " + totalLessons + " درس (" + percent + "%)",
    "- آخر درس شاهده: " + (lastLesson?.title || "لم يبدأ بعد"),
    "- الدروس الناقصة: " + incompleteLessons.length + " درس",
    "",
    "## قائمة الدروس المتاحة",
    lessonListStr,
    "",
    "## تعليمات الرد",
    "1. لما يسأل عن تقدّمه: أعطه الإحصائيات أعلاه",
    "2. لما يسأل عن موضوع معيّن: اقترح الدرس المناسب من القائمة",
    "3. لو ما خلّص درس سابق مهم: ذكّره بلطف",
    "4. لما تقترح درس: اذكر اسمه بالضبط"
  ];

  return lines.join("\n");
}

Deno.serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "غير مصرح" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const token = authHeader.replace("Bearer ", "");

    const supabaseUser = createClient(SUPABASE_URL, token, {
      auth: { persistSession: false }
    });

    const { data: userData, error: authError } = await supabaseUser.auth.getUser();

    if (authError || !userData?.user) {
      return new Response(JSON.stringify({ error: "جلسة غير صالحة" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const user = userData.user;
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const [lessonsRes, sectionsRes, progressRes] = await Promise.all([
      supabaseAdmin.from("lessons").select("id, title, description, section_id, embed_url").order("sort_order"),
      supabaseAdmin.from("sections").select("id, title").order("sort_order"),
      supabaseAdmin.from("progress").select("lesson_id, completed, percent, updated_at").eq("user_id", user.id),
    ]);

    const lessons: LessonRow[] = lessonsRes.data || [];
    const sections: SectionRow[] = sectionsRes.data || [];
    const progress: ProgressRow[] = progressRes.data || [];

    const body = await req.json();
    const messages = body.messages;
    const lesson = body.lesson;

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    let fullPrompt = BASE_PROMPT + buildUserContext(progress, lessons, sections);

    if (lesson?.title) {
      fullPrompt += "\n\n## الدرس الحالي\nالمشترك يشاهد الآن: " + lesson.title;
      if (lesson.section) {
        fullPrompt += " من قسم " + lesson.section;
      }
    }

    const groqMessages = [
      { role: "system", content: fullPrompt },
      ...messages.slice(-10),
    ];

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + GROQ_API_KEY,
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
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "عذراً، حدث خطأ. حاول مرة ثانية.";

    return new Response(JSON.stringify({ reply }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: "خطأ داخلي" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
