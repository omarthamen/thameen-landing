import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const BASE_PROMPT = [
  "أنت مدرّب مونتاج عراقي ودّي من فريق ثَمين. تحكي بلهجة عراقية طبيعية، حماسي بس مو مزعج. تخاطب المشترك كصديق يساعده يتقدّم، مو كروبوت يرص أرقام.",
  "",
  "## قبل ما تجاوب — افهم نية السؤال:",
  "1. سؤال تقني/تعليمي (شلون أسوي X؟) → اشرح بإيجاز + اقترح الدرس المناسب من القائمة أدناه. لا تذكر تقدّمه.",
  "2. سؤال عن تقدّمه (وين وصلت؟ كم باقي؟) → هنا فقط اعطيه إحصائيته بصيغة بشرية.",
  "3. سؤال عن درس معيّن (وين أتعلم التلوين؟) → دلّه على الدرس من القائمة أدناه مباشرة.",
  "4. دردشة/تحية → جاوب بشكل طبيعي ودّي.",
  "",
  "## أسلوبك:",
  "- لهجة عراقية بسيطة وطبيعية",
  "- جمل قصيرة وعملية",
  "- لا تكرر نفس الصيغة — نوّع كلماتك كل رد",
  "- لا تستخدم إيموجي",
  "- خطوة واحدة واضحة بنهاية كل رد",
  "",
  "## التحفيز (مهم جداً):",
  "- اربط كلامك بنتيجة ملموسة: شنو راح يقدر يسوي بعد ما يتعلّم هالشي",
  "- أمثلة نتائج: هالمهارة تخليك تشتغل بسعر أعلى، توفّر ساعة من وقتك كل مشروع، العملاء يطلبون هالستايل",
  "- تجنّب العبارات الفارغة مثل أنت تقدر أو استمر — خلّي تحفيزك واقعي ومحدد",
  "- لو تقدّمه واطي أو متوقّف: شجّعه بذكر قيمة الدرس الجاي الفعلي، اقترح درس واحد بس يبدأ منه",
  "- لو أنجز شي: اعترف بإنجازه بصدق وادفعه للخطوة اللي بعدها",
  "",
  "## قاعدة ذهبية:",
  "استخدم فقط الأرقام وأسماء الدروس الموجودة في معلومات المشترك وقائمة الدروس أدناه.",
  "لا تذكر أي رقم أو اسم درس من راسك — إذا مو موجود بالبيانات، لا تذكره.",
  "",
  "## اللغة (مهم جداً):",
  "اكتب كل ردودك بالعربية فقط (لهجة عراقية).",
  "ممنوع منعاً باتاً أي حرف صيني أو ياباني أو كوري.",
  "المصطلحات التقنية الإنجليزية (مثل Premiere، Timeline، Cut) مسموحة فقط كما هي.",
  "لا تخلط حروف لاتينية عشوائية داخل الكلام العربي.",
  "",
  "## ممنوع:",
  "- ترص إحصائيات بدون ما تُسأل عنها",
  "- تكرر نفس القالب كل مرة",
  "- تذكر درس أو رقم غير موجود بالبيانات المحقونة",
  "- تجيب عن أسعار صرف أو مواضيع خارج المونتاج",
  "- تخترع معلومات — لو ما تعرف قل ما عندي معلومة دقيقة عن هذا",
  "- تستخدم حروف صينية أو يابانية أو رموز غريبة"
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

    // === تشخيص ===
    console.log("=== DIAG 1: Auth ===");
    console.log("user_id:", user?.id);
    console.log("user_email:", user?.email);
    console.log("auth_error:", userError?.message);

    let userContext = "";

    if (user && !userError) {
      // جلب البيانات بالـ service key
      const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

      const [lessonsRes, sectionsRes, progressRes] = await Promise.all([
        admin.from("lessons").select("id, title, section_id").order("sort"),
        admin.from("sections").select("id, title").order("sort"),
        admin.from("progress").select("lesson_id, completed").eq("user_id", user.id),
      ]);

      // === تشخيص البيانات ===
      console.log("=== DIAG 2: Data ===");
      console.log("lessons_count:", lessonsRes.data?.length);
      console.log("lessons_error:", lessonsRes.error?.message);
      console.log("progress_raw:", JSON.stringify(progressRes.data));
      console.log("progress_error:", progressRes.error?.message);

      const lessons = lessonsRes.data || [];
      const sections = sectionsRes.data || [];
      const progress = progressRes.data || [];

      // === تشخيص الفلترة ===
      console.log("=== DIAG 3: Filter ===");
      console.log("progress_length:", progress.length);
      console.log("completed_filter:", progress.filter((p: any) => p.completed));
      console.log("completed_type_check:", progress.map((p: any) => ({ lesson_id: p.lesson_id, completed: p.completed, type: typeof p.completed })));

      const totalLessons = lessons.length;
      const completedLessons = progress.filter((p: any) => p.completed).length;

      console.log("=== DIAG 4: Result ===");
      console.log("totalLessons:", totalLessons);
      console.log("completedLessons:", completedLessons);
      const percent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

      const completedIds = new Set(progress.filter((p: any) => p.completed).map((p: any) => p.lesson_id));
      const sectionMap = new Map(sections.map((s: any) => [s.id, s.title]));

      // الدرس الجاي (أول درس غير مكتمل)
      const nextLesson = lessons.find((l: any) => !completedIds.has(l.id));
      const nextLessonInfo = nextLesson
        ? nextLesson.title + " (" + (sectionMap.get(nextLesson.section_id) || "") + ")"
        : "أكمل كل الدروس";

      const lessonList = lessons.map((l: any) => {
        const done = completedIds.has(l.id) ? "done" : "pending";
        const sec = sectionMap.get(l.section_id) || "";
        return "- [" + done + "] " + l.title + " (" + sec + ")";
      }).join("\n");

      userContext = [
        "",
        "## معلومات المشترك",
        "- التقدم: " + completedLessons + " من " + totalLessons + " درس (" + percent + "%)",
        "- الدرس الجاي: " + nextLessonInfo,
        "",
        "## قائمة الدروس",
        lessonList
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
