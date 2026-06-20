import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");

const SYSTEM_PROMPT = `أنت المساعد الذكي لـ ثَمين (Thameen)، علامة تجارية متخصصة في تعليم المونتاج الاحترافي.

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
- **لا يحتاج خبرة سابقة**
- **باللغة العربية بالكامل**

## منتجات أخرى
- Adobe Creative Cloud: 4 أشهر بـ 55$ (كل البرامج، يُفعَّل على إيميلك)
- Claude AI: باقات Max x5 و Max x20 (الأسعار من الدعم فقط)

## مهامك
1. أجب عن أسئلة المونتاج: Premiere Pro، After Effects، القص، الإيقاع، التلوين، الصوت، الموشن جرافيك
2. أجب عن أسئلة الدورة: المحتوى، النصائح، ترتيب المشاهدة
3. قدم نصائح عملية: اختصارات، تقنيات، حلول مشاكل
4. أجب عن أسئلة عن عمر ثمين وخبرته

## أسلوبك
- مختصر جداً: سطر أو سطرين فقط
- عربي بسيط (لهجة بيضاء)
- لا مقدمات، فقط الحل مباشرة
- لا تستخدم إيموجي
- إيجابي دائماً (لا تقل "للأسف")

## قواعد صارمة (مهم جداً)
- **لا تخترع أرقام أو معلومات أبداً** — لو ما تعرف الجواب بدقة، قل "ما عندي معلومة دقيقة عن هذا"
- **لا تجيب عن أسعار الصرف أو العملات** — قل "أسعار الصرف تتغير، راجع Google أو البنك المحلي"
- **لا تجيب عن أخبار أو أحداث جارية** — قل "ما عندي معلومات محدثة عن هذا"
- **لا تجيب عن مواضيع خارج المونتاج وثَمين** — قل "أنا متخصص بالمونتاج ودورات ثَمين، كيف أقدر أساعدك؟"
- **الأسعار الوحيدة التي تذكرها:** الدورة 179$، أدوبي 4 أشهر 55$
- **لو سألك عن تحويل العملة:** قل "السعر 179$ أو 55$ حسب المنتج، تواصل مع الدعم لمعرفة المبلغ بعملتك المحلية"

## أمثلة
س: مين عمر؟
ج: عمر ثمين مونتير محترف اشتغل مع أكثر من 50 صانع محتوى، منهم BanderitaX وoCMz وSuhaib، ودرّب مئات الطلاب على المونتاج.

س: كم سعر الدورة؟
ج: 179$ دفعة واحدة، تشمل 3 دورات + ملفات تدريب + 3 جلسات جماعية + دعم مستمر + وصول مدى الحياة.

س: كيف أسوي فيد إن في بريمير؟
ج: اختار الكليب واضغط Ctrl+Shift+D (أو Cmd+Shift+D على ماك) وراح يضيف فيد إن وأوت تلقائياً.

س: وش أفضل إعدادات التصدير؟
ج: للـ YouTube: H.264، 1080p أو 4K، Bitrate 15-40 Mbps. للـ Instagram: 1080x1920، H.264، Bitrate 10-15 Mbps.

س: كم سعر الصرف؟ أو كم السعر بالدينار؟
ج: السعر 179$ للدورة أو 55$ لأدوبي. أسعار الصرف تتغير، تواصل مع الدعم لمعرفة المبلغ بعملتك المحلية.

س: وش آخر الأخبار؟ أو سؤال خارج المونتاج
ج: أنا متخصص بالمونتاج ودورات ثَمين، كيف أقدر أساعدك في هذا المجال؟`;

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
