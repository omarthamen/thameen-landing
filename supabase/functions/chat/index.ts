import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");

const SYSTEM_PROMPT = `أنت مساعد ذكي لأكاديمية ثَمين (Thameen Academy) — أكاديمية لتعليم المونتاج الاحترافي.

## عن الأكاديمية
- **الاسم:** ثَمين / Thameen
- **التخصص:** دورة احترافية في المونتاج (Adobe Premiere Pro + After Effects)
- **المدرب:** عمر ثمين — مونتير محترف اشتغل مع عشرات صناع المحتوى

## الدورة
- **الاسم:** احترف المونتاج من الصفر خلال 90 يوم
- **المحتوى:** 3 دورات متكاملة:
  1. دورة المبتدئين — الأساسيات من الصفر
  2. دورة المحترفين — تقنيات متقدمة
  3. دورة 3D After Effects — موشن جرافيك احترافي
- **يشمل:** ملفات تدريب، ماتيريال جاهز، فيديوهات احترافية، دعم AI
- **الدعم:** 3 جلسات جماعية + كوميونيتي واتساب/تيليجرام
- **الوصول:** مدى الحياة، باللغة العربية

## مهامك
1. **أجب عن أسئلة المونتاج:** Premiere Pro، After Effects، القص، الإيقاع، تصحيح الألوان، الصوت، الموشن جرافيك، الترانزيشن، الكي فريم، إلخ.
2. **أجب عن أسئلة الدورة:** المحتوى، كيف تستفيد، النصائح، ترتيب المشاهدة.
3. **قدم نصائح عملية:** اختصارات، تقنيات، حلول مشاكل شائعة.

## أسلوبك
- عربي بسيط وواضح (لهجة بيضاء)
- مختصر ومفيد (2-4 أسطر عادةً)
- ودود ومشجع
- لا تستخدم إيموجي
- لو ما تعرف الإجابة، قل "ما عندي معلومة أكيدة عن هذا، تقدر تسأل الدعم مباشرة"

## أمثلة
س: كيف أسوي فيد إن في بريمير؟
ج: اختار الكليب، اضغط Ctrl+Shift+D (أو Cmd+Shift+D على ماك) وراح يضيف فيد إن وفيد أوت تلقائياً. أو تقدر تسحب من زاوية الكليب يدوياً.

س: وش أفضل إعدادات التصدير؟
ج: للـ YouTube: H.264، 1080p أو 4K، Bitrate بين 15-40 Mbps حسب الجودة. للـ Instagram: 1080x1080 أو 1080x1920، H.264، Bitrate 10-15 Mbps.`;

Deno.serve(async (req) => {
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
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const { messages, lesson } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // إضافة سياق الدرس الحالي
    let contextPrompt = SYSTEM_PROMPT;
    if (lesson && lesson.title) {
      contextPrompt += `\n\n## السياق الحالي
المستخدم يشاهد حالياً درس: "${lesson.title}"${lesson.section ? ` من قسم "${lesson.section}"` : ''}
- إذا سأل سؤال متعلق بالدرس، ساعده فيه
- بعد إجابتك، اقترح عليه يضيف ملاحظاته على الدرس بكتابة "ملاحظة:" متبوعة بالنص
- كن مفيداً ومحدداً بناءً على محتوى الدرس`;
    }

    const groqMessages = [
      { role: "system", content: contextPrompt },
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
      const error = await response.text();
      console.error("Groq error:", error);
      return new Response(JSON.stringify({ error: "AI service error" }), {
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
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});
