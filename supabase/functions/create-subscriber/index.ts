// ثَمين — Edge Function: إنشاء حساب مشترك (آمن، للأدمن فقط)
// انشرها من Supabase ▸ Edge Functions ▸ Create a new function ▸ باسم: create-subscriber
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ADMIN_EMAIL = "omarthamen@gmail.com";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") || "";

    // 1) تحقّق إن المُرسِل هو الأدمن
    const caller = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await caller.auth.getUser();
    if (!user || user.email !== ADMIN_EMAIL) return json({ error: "غير مصرّح — للأدمن فقط" }, 403);

    // 2) أنشئ الحساب
    const { name, email, password } = await req.json();
    if (!email || !password) return json({ error: "الإيميل وكلمة السر مطلوبة" }, 400);
    const display = (name && String(name).trim()) || String(email).split("@")[0];

    const admin = createClient(url, service);
    const { data, error } = await admin.auth.admin.createUser({
      email: String(email).trim(),
      password: String(password),
      email_confirm: true,
      user_metadata: { name: display },
    });
    if (error) return json({ error: error.message }, 400);

    const uid = data.user.id;
    // 3) جهّز البروفايل وملف العضو (٣ مكالمات)
    await admin.from("profiles").upsert({ user_id: uid, name: display });
    await admin.from("members").upsert({ user_id: uid, name: display, calls_total: 3, calls_used: 0 });

    return json({ ok: true, id: uid, name: display });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
