import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const TELEGRAM_BOT_TOKEN = "8908650845:AAGO2wZJniD51K3YRtHVrBuN_vpKVK-SY-c";
const TELEGRAM_CHAT_ID = "5607995875";

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

  try {
    const payload = await req.json();
    console.log("[Notify] Received:", JSON.stringify(payload));

    // البيانات من Database Webhook أو استدعاء مباشر
    const record = payload.record || payload;
    const name = record.name || "—";
    const email = record.email || "—";
    const phone = record.phone || "—";
    const notes = record.notes || "";

    let message = `🔔 طلب اشتراك جديد!

الاسم: ${name}
الإيميل: ${email}
الهاتف: ${phone}`;

    if (notes) {
      message += `\nملاحظات: ${notes}`;
    }

    message += `\n\nافتح لوحة التحكم لمراجعة الطلب.`;

    // إرسال لـ Telegram
    const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const telegramRes = await fetch(telegramUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: "HTML",
      }),
    });

    const telegramData = await telegramRes.json();
    console.log("[Notify] Telegram response:", JSON.stringify(telegramData));

    if (!telegramData.ok) {
      throw new Error(telegramData.description || "Telegram error");
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("[Notify] Error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
