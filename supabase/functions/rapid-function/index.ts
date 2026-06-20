import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const BASE_PROMPT = [
  "أنت المساعد الذكي لـ ثَمين (Thameen)، علامة تجارية متخصصة في تعليم المونتاج الاحترافي.",
  "",
  "## المؤسس: عمر ثمين",
  "- مونتير محترف اشتغل مع أكثر من 50 صانع محتوى عربي",
  "- عمل مع: BanderitaX، oCMz، Suhaib، Ahmed Show، Peaks",
  "",
  "## الدورة الرئيسية: احترف المونتاج من الصفر خلال 90 يوم",
  "- 3 دورات متكاملة: التأسيس التقني، الاحتراف البصري، الـ 3D والذكاء الاصطناعي",
  "- السعر: 179$ دفعة واحدة",
  "- يشمل: ملفات تدريب + 3 جلسات جماعية + كوميونيتي + وصول مدى الحياة",
  "",
  "## أسلوبك",
  "- مختصر جداً: سطر أو سطرين فقط",
  "- عربي بسيط",
  "- لا مقدمات، فقط الحل مباشرة",
  "- لا تستخدم إيموجي",
  "",
  "## قواعد صارمة",
  "- لا تخترع معلومات",
  "- لا تجيب عن أسعار الصرف",
  "- لا تجيب عن مواضيع خارج المونتاج"
].join("\n");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

Deno.serve(async (req) => {
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
    // استخراج التوكن من الـ header
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");

    // إنشاء Supabase client مع الـ anon key
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } }
    });

    // التحقق من المستخدم
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    let userContext = "";

    if (user && !userError) {
      // جلب البيانات بالـ service key
      const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

      const [lessonsRes, sectionsRes, progressRes] = await Promise.all([
        admin.from("lessons").select("id, title, section_id").order("sort_order"),
        admin.from("sections").select("id, title").order("sort_order"),
        admin.from("progress").select("lesson_id, completed").eq("user_id", user.id),
      ]);

      const lessons = lessonsRes.data || [];
      const sections = sectionsRes.data || [];
      const progress = progressRes.data || [];

      const totalLessons = lessons.length;
      const completedLessons = progress.filter((p: any) => p.completed).length;
      const percent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

      const completedIds = new Set(progress.filter((p: any) => p.completed).map((p: any) => p.lesson_id));
      const sectionMap = new Map(sections.map((s: any) => [s.id, s.title]));

      const lessonList = lessons.map((l: any) => {
        const done = completedIds.has(l.id) ? "done" : "pending";
        const sec = sectionMap.get(l.section_id) || "";
        return "- [" + done + "] " + l.title + " (" + sec + ")";
      }).join("\n");

      userContext = [
        "",
        "## معلومات المشترك",
        "- التقدم: " + completedLessons + " من " + totalLessons + " درس (" + percent + "%)",
        "- الدروس الناقصة: " + (totalLessons - completedLessons) + " درس",
        "",
        "## قائمة الدروس",
        lessonList,
        "",
        "## تعليمات",
        "- لما يسأل عن تقدّمه: أعطه الإحصائيات",
        "- لما يسأل عن موضوع: اقترح الدرس المناسب"
      ].join("\n");
    }

    // قراءة الرسائل
    const body = await req.json();
    const messages = body.messages || [];
    const lesson = body.lesson;

    let fullPrompt = BASE_PROMPT + userContext;

    if (lesson && lesson.title) {
      fullPrompt += "\n\n## الدرس الحالي\nالمشترك يشاهد: " + lesson.title;
    }

    // إرسال للـ Groq
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + GROQ_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: fullPrompt },
          ...messages.slice(-10)
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Groq error:", errText);
      return new Response(JSON.stringify({ error: "AI error", details: errText }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "عذراً، حدث خطأ.";

    return new Response(JSON.stringify({ reply }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (err: any) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: "Internal error", details: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
