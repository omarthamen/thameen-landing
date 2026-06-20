// ثَمين — أكاديمية المشتركين (REST مباشر)
const SUPABASE_URL = "https://hwzpjxxfdqsjymxbjokv.supabase.co";
const SUPABASE_KEY = "sb_publishable_mcKOUcVtNy5BkLEd5UcRDA_foJbp3YK";
let TOKEN = null, USER = null, AVATARS = {};
const ADMIN_EMAIL = "omarthamen@gmail.com";

// روابط التواصل بالفوتر (عدّلها هنا) — معرّفة بالأعلى لتفادي مشكلة الترتيب
const SOCIALS = [
  { n: "إنستقرام", u: "https://www.instagram.com/thameen.j/", ic: "instagram" },
  { n: "يوتيوب", u: "https://www.youtube.com/channel/UCMeR85JgB5jXCZTQy1C69pA", ic: "youtube" },
];
const SOCIAL_SVG = {
  instagram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="5.5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r="1.1" fill="currentColor" stroke="none"/></svg>',
  youtube: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="5.5" width="19" height="13" rx="4"/><path d="M10.3 9.2l5 2.8-5 2.8z" fill="currentColor" stroke="none"/></svg>',
  tiktok: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 3c.3 2.1 1.5 3.4 3.5 3.6v2.4c-1.2.1-2.3-.3-3.4-.9v4.9c0 4.6-5 6-7.4 2.7-1.6-2.1-.8-5.7 3-5.8v2.5c-.3.05-.6.13-.9.25-.9.4-1.2 1.3-1 2 .4 1.4 2.9 1.3 2.9-.9V3z"/></svg>',
  whatsapp: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.5 15.3L2 22l4.8-1.4A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-2.9.8.8-2.8-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.4-.7-1.7-.8-.2-.1-.4-.1-.5.1l-.7.9c-.1.1-.3.2-.5.1-.7-.3-1.5-.6-2.1-1.4-.2-.3.2-.3.5-1 .1-.1 0-.3 0-.4l-.7-1.7c-.2-.5-.4-.4-.5-.4h-.5c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 1.9s.8 2.2.9 2.4c.1.1 1.6 2.5 4 3.4 1.4.6 2 .6 2.7.5.4-.1 1.4-.6 1.6-1.1.2-.6.2-1 .1-1.1z"/></svg>',
};

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const setMsg = (el, t, ok) => { el.textContent = t; el.className = "msg " + (ok ? "ok" : "err"); };
const linkify = (t) => esc(t || "").replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>').replace(/\n/g, "<br>");

function fetchT(url, opts = {}, ms = 15000) {
  const c = new AbortController(); const id = setTimeout(() => c.abort(), ms);
  return fetch(url, { ...opts, signal: c.signal }).finally(() => clearTimeout(id));
}
const authHeaders = (extra) => Object.assign({ apikey: SUPABASE_KEY, Authorization: "Bearer " + (TOKEN || SUPABASE_KEY) }, extra || {});
async function dbGet(path) {
  const r = await fetchT(`${SUPABASE_URL}/rest/v1/${path}`, { headers: authHeaders(), cache: "no-store" });
  if (!r.ok) { if (r.status === 401) logout(); throw new Error(await r.text()); }
  return r.json();
}
async function dbSend(method, path, body, prefer) {
  const r = await fetchT(`${SUPABASE_URL}/rest/v1/${path}`, {
    method, headers: authHeaders({ "Content-Type": "application/json", Prefer: prefer || "return=minimal" }),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) { if (r.status === 401) logout(); throw new Error(await r.text()); }
  return r.status === 204 ? null : r.json().catch(() => null);
}

// ====== المصادقة (مع حفظ جلسة للمشترك) ======
const loginView = $("loginView"), appView = $("appView");
function showApp(on) { loginView.hidden = on; appView.hidden = !on; if (on) loadAcademy(); }
function saveSession(d) {
  TOKEN = d.access_token; USER = d.user;
  localStorage.setItem("thameen_acad", JSON.stringify({
    at: d.access_token, rt: d.refresh_token, exp: Date.now() + (d.expires_in || 3600) * 1000, user: d.user,
  }));
}
function logout() { TOKEN = null; USER = null; localStorage.removeItem("thameen_acad"); showApp(false); }

$("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = $("loginBtn"); btn.disabled = true; setMsg($("loginMsg"), "جارٍ الدخول…", true);
  try {
    const r = await fetchT(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST", headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email: $("email").value.trim(), password: $("password").value }),
    });
    const d = await r.json();
    if (!r.ok) { setMsg($("loginMsg"), "فشل الدخول: " + (d.msg || d.error_description || d.error || ""), false); btn.disabled = false; return; }
    saveSession(d); setMsg($("loginMsg"), "", true); showApp(true);
  } catch (err) { setMsg($("loginMsg"), "خطأ: " + (err.message || err), false); btn.disabled = false; }
});
$("logoutBtn").addEventListener("click", logout);

async function refresh(rt) {
  try {
    const r = await fetchT(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST", headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: rt }),
    });
    if (!r.ok) return false;
    saveSession(await r.json()); return true;
  } catch (_) { return false; }
}
(async function restore() {
  let s; try { s = JSON.parse(localStorage.getItem("thameen_acad") || "null"); } catch (_) { s = null; }
  if (!s) { showApp(false); return; }
  if (s.exp > Date.now() + 60000) { TOKEN = s.at; USER = s.user; showApp(true); }
  else if (s.rt && await refresh(s.rt)) { showApp(true); }
  else { showApp(false); }
})();

// ====== قائمة الملف الشخصي (تجمع الأزرار الثانوية) ======
function setNavProfile() {
  const name = myName();
  if ($("meName")) $("meName").textContent = name;
  if ($("meEmail")) $("meEmail").textContent = (USER && USER.email) || "";
  const init = initialOf(name), col = avColor((USER && USER.id) || name);
  const url = AVATARS[USER && USER.id];
  [$("navAvatar"), $("navAvatarLg")].forEach((el) => {
    if (!el) return;
    if (url) { el.innerHTML = `<img src="${esc(url)}" alt="" class="av-img">`; el.style.background = "none"; }
    else { el.textContent = init; el.style.background = col; }
  });
}
(function () {
  const btn = $("navMenuBtn"), menu = $("navMenu"); if (!btn || !menu) return;
  const close = () => { menu.hidden = true; btn.classList.remove("on"); };
  btn.addEventListener("click", (e) => { e.stopPropagation(); const willOpen = menu.hidden; menu.hidden = !willOpen; btn.classList.toggle("on", willOpen); });
  menu.querySelectorAll(".nav-menu-item").forEach((b) => b.addEventListener("click", close));
  document.addEventListener("click", (e) => { if (!menu.hidden && !btn.contains(e.target) && !menu.contains(e.target)) close(); });
})();

// ====== الفوتر: روابط التواصل ======
function renderSocials() {
  const el = $("footSocials"); if (!el) return;
  el.innerHTML = SOCIALS.map((s) => `<a class="soc-link" href="${s.u}"${s.u !== "#" ? ' target="_blank" rel="noopener"' : ""}><span class="soc-ic ${s.ic ? "si-" + s.ic : ""}">${SOCIAL_SVG[s.ic] || ""}</span><span>${esc(s.n)}</span></a>`).join("");
}

// ====== حماية: قفل الجهاز + علامة مائية ======
function deviceId() {
  let d = null; try { d = localStorage.getItem("thameen_device"); } catch (_) {}
  if (!d) { d = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : ("d" + Date.now() + Math.floor(Math.random() * 1e6)); try { localStorage.setItem("thameen_device", d); } catch (_) {} }
  return d;
}
// مراقبة بدل حظر تلقائي: نفحص الإيقاف اليدوي فقط، ونسجّل الدخول (جهاز + IP) للأدمن
async function guardAccess() {
  if (USER && USER.email === ADMIN_EMAIL) return true;      // الأدمن مستثنى
  try {
    const r = await dbGet(`profiles?select=suspended&user_id=eq.${USER.id}`);
    if (r && r[0] && r[0].suspended) { showBlocked("suspended"); return false; }  // إيقاف يدوي من الأدمن فقط
  } catch (_) {}
  return true;
}
// سجّل الدخول: الجهاز + IP + الوقت (مرة كل ٣٠ دقيقة) — للمراقبة فقط
async function recordLogin() {
  try {
    let last = 0; try { last = parseInt(localStorage.getItem("thameen_login_log") || "0", 10); } catch (_) {}
    if (Date.now() - last < 30 * 60 * 1000) return;          // ما نكرّر كل رفرش
    let ip = null;
    try { const r = await fetchT("https://api.ipify.org?format=json", {}, 6000); ip = (await r.json()).ip; } catch (_) {}
    await dbSend("POST", "login_events", { user_id: USER.id, ip, device: deviceId() }, "return=minimal");
    try { localStorage.setItem("thameen_login_log", String(Date.now())); } catch (_) {}
  } catch (_) {}
}
function showBlocked(kind) {
  stopCommPoll();
  try { localStorage.removeItem("thameen_acad"); } catch (_) {}
  TOKEN = null; USER = null;
  const suspended = kind === "suspended";
  const title = suspended ? "تم إيقاف الحساب" : "الوصول ممنوع";
  const msg = suspended
    ? "تم إيقاف وصولك للدورات.<br>للاستفسار تواصل مع الدعم."
    : "هذا الحساب مُفعّل على جهاز آخر.<br>مشاركة الحساب أو الدخول من أكثر من جهاز غير مسموح.";
  const btn = suspended ? "تواصل مع الدعم" : "تواصل مع الدعم لفك الجهاز";
  document.body.innerHTML = `<div class="blocked-screen"><div class="blocked-card">
    <div class="blocked-ic">⛔</div>
    <h1>${title}</h1>
    <p>${msg}</p>
    <a class="blocked-btn" href="https://www.instagram.com/thameen.j/" target="_blank" rel="noopener">${btn}</a>
  </div></div>`;
}
// ====== تحميل المنصّة ======
let SECTIONS = [], LESSONS = [], DONE = new Set(), CURSEC = null, CURLESSON = null;
let PCT = {}, lastSaved = {}, MEMBER = null;
let curPlayer = null, curPlayerTime = 0, noteCaptureT = 0;
// جلب درس/قسم مع إعادة محاولة — يرجّع null لو فشل فعلاً (مو فاضي)
let lastLoadErr = "";
async function fetchRetry(path, tries) {
  for (let i = 0; i < (tries || 2); i++) {
    try { return await dbGet(path); } catch (e) { lastLoadErr = (e && e.message) ? String(e.message) : String(e); if (i < (tries || 2) - 1) await new Promise((r) => setTimeout(r, 600)); }
  }
  return null;
}
// تحميل الدورات عبر دالة RPC (تتجاوز مشاكل القراءة المباشرة) مع احتياط
async function loadCourseData() {
  try {
    const r = await fetchT(`${SUPABASE_URL}/rest/v1/rpc/get_academy_data`, {
      method: "POST", headers: authHeaders({ "Content-Type": "application/json" }), body: "{}",
    }, 25000);
    if (r.ok) { const d = await r.json(); if (d && Array.isArray(d.sections)) return { sections: d.sections, lessons: d.lessons || [] }; }
  } catch (e) { lastLoadErr = (e && e.message) ? String(e.message) : String(e); }
  // احتياط: قراءة مباشرة
  return { sections: await fetchRetry("sections?select=*&order=sort.asc,created_at.asc"), lessons: await fetchRetry("lessons?select=*&order=sort.asc,created_at.asc") };
}
async function loadAcademy() {
  const guardP = guardAccess();
  const dataP = Promise.all([
    loadCourseData(),
    dbGet("progress?select=lesson_id,percent,completed").catch(() => dbGet("progress?select=lesson_id,completed").catch(() => [])),
    dbGet("members?select=calls_total,calls_used,created_at,call_at").catch(() => dbGet("members?select=calls_total,calls_used,created_at").catch(() => dbGet("members?select=calls_total,calls_used").catch(() => []))),
  ]);
  if (!(await guardP)) return;           // موقوف من الأدمن
  showOnboarding();
  checkCommUnread();                      // شارة رسائل المجتمع الجديدة
  setNavProfile();
  renderSocials();
  const wrap = $("coursesCol");
  try {
    const [courses, progress, members] = await dataP;
    const sections = courses.sections, lessons = courses.lessons;
    // فشل تحميل حقيقي (null) — اعرض زر إعادة بدل "لا دورات"
    if (sections === null || lessons === null) {
      // غالبًا التوكن قديم → جدّده تلقائيًا وأعد التحميل مرة وحدة
      if (!window.__acadRetried) {
        window.__acadRetried = true;
        let s = null; try { s = JSON.parse(localStorage.getItem("thameen_acad") || "null"); } catch (_) {}
        if (s && s.rt && await refresh(s.rt)) { return loadAcademy(); }   // بالتوكن الجديد
        logout(); return;                                                 // التوكن منتهي → سجّل دخول من جديد
      }
      wrap.innerHTML = `<p class="hint" style="padding:14px">تعذّر تحميل الدورات.<br><b style="color:#ff8f8f;font-size:12px;word-break:break-all">${esc(lastLoadErr || "خطأ")}</b><br><button class="btn btn-primary btn-sm" onclick="location.reload()">إعادة المحاولة</button></p>`;
      $("lTitle").textContent = "—";
      return;
    }
    SECTIONS = sections || []; LESSONS = lessons || [];
    injectAISeries();
    PCT = {}; DONE = new Set();
    (progress || []).forEach((p) => { PCT[p.lesson_id] = p.percent != null ? p.percent : (p.completed ? 100 : 0); if (p.completed) DONE.add(p.lesson_id); });
    MEMBER = (members && members[0]) || null;
    const m = MEMBER;
    $("callsLeft").textContent = DONE.size;
    renderProgress();
    renderChallenge();
    renderCourses();
    loadAvatars();                       // مؤجّل — بعد عرض الدورات (يقلل التزاحم)
    recordLogin();                       // تسجيل الدخول للمراقبة — مؤجّل وغير حاجب
    loadNotifs(); startNotifPoll();      // مركز الإشعارات (الجرس) + تحديث حيّ كل ١٥ث
    checkCallReminders();                // تذكير المكالمة التلقائي حسب موعدها
    if (SECTIONS.length) {
      let savedLid = null; try { savedLid = localStorage.getItem("thameen_lesson"); } catch (_) {}
      const savedLesson = savedLid && LESSONS.find((l) => l.id === savedLid);
      if (savedLesson) { CURSEC = savedLesson.section_id; renderCourses(); playLesson(savedLesson.id); }
      else {
        // المشترك الجديد يبدأ من دورة المبتدئين، المقطع الأول
        const beginner = SECTIONS.find((s) => /مبتدئ|الصفر|الأولى/.test(s.title || "") && LESSONS.some((l) => l.section_id === s.id));
        const firstSec = beginner || SECTIONS.find((s) => LESSONS.some((l) => l.section_id === s.id)) || SECTIONS[0];
        openCourse(firstSec.id);
      }
      restoreView();
    } else {
      wrap.innerHTML = '<p class="hint" style="padding:14px">لا توجد دورات بعد.</p>';
      $("lTitle").textContent = "—";
    }
  } catch (e) {
    wrap.innerHTML = '<p class="hint" style="padding:14px">تعذّر التحميل. <button class="btn btn-primary btn-sm" onclick="location.reload()">إعادة المحاولة</button></p>';
    $("lTitle").textContent = "—";
  }
}

function renderProgress() {
  const total = LESSONS.length || 1;
  $("progPct").textContent = Math.round((DONE.size / total) * 100) + "%";
}

// ====== تحدّي ٩٠ يوم + الرسائل التحفيزية ======
function toAr(n) { return String(n).replace(/[0-9]/g, (d) => "٠١٢٣٤٥٦٧٨٩"[d]); }
// مدة الفيديو: mm:ss أو h:mm:ss
function fmtDur(s) {
  s = Math.round(s || 0); if (!s) return "";
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
}
// إجمالي بالعربي: «X س Y د»
function fmtDurAr(s) {
  s = Math.round(s || 0); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${toAr(h)} س ${toAr(m)} د`;
  if (m > 0) return `${toAr(m)} د`;
  return "";
}
const CHAL_MILE = {
  1: "ألف مبروك بدء التحدّي! تذكّر ليش دخلت من البداية: قرّرت تطوّر نفسك وتصير مونتير محترف تشتغل بشغفك. اليوم قرار، و٩٠ يوم تحوّل كامل.",
  7: "أسبوع كامل وأنت ثابت! الاستمرار هو اللي يفرّقك عن ٩٩٪ من الناس. كمّل بنفس الزخم ولا تكسر العادة.",
  14: "أسبوعين! صارت عندك عادة تعلّم حقيقية. حافظ على توازنك: تعلّم + تطبيق + راحة، عشان توصل ٩٠ يوم بدون احتراق.",
  21: "٢١ يوم — العلم يقول هنا تتكوّن العادة. صرت مونتير في طور التكوّن. لا توقف الآن أبدًا.",
  30: "شهر كامل! خطوة مهمة. اكتب إنجازك بقسم «الإنجازات» في المجتمع وشارك المتدربين تطوّرك — تحفّزهم ويحفّزونك، وعلاقاتك تكبر.",
  45: "نص الطريق! وصلت لمنتصف التحدّي. ارجع لورقة هدفك وتخيّل نفسك يوم ٩٠ — أنت أقرب مما تتصوّر.",
  60: "شهرين! مستواك صار يأهّلك لفرص حقيقية. افتح قسم «فرص عمل» في المجتمع، جهّز معرض أعمالك، واستعد لأول عميل.",
  75: "باقي ١٥ يوم فقط! النهاية قريبة جدًا. اعطِ هالأيام أقوى ما عندك — هي اللي تصنع الفرق.",
  90: "أكملت تحدّي ٩٠ يوم! صدقت وعدك لنفسك وصرت مونتير محترف. شارك إنجازك الكامل في المجتمع، وابدأ تشتغل بشغفك من قسم فرص العمل.",
};
const CHAL_POOL = [
  "كل يوم تتعلّم فيه مونتاج تقترب خطوة من الاحتراف. لا توقف الزخم اليوم.",
  "تذكّر ليش بدأت — قرّرت تغيّر مستواك. كمّل درس اليوم ولو بسيط.",
  "ساعة تركيز اليوم أفضل من عشر ساعات تسويف بكرة. ابدأ الحين.",
  "الموهبة تبدأ بالتكرار. أعد الدرس وطبّق بيدك على لقطة.",
  "ما تحتاج تكون مثالي، تحتاج تكون مستمر. درس واحد اليوم يكفي.",
  "وازن وقتك: تعلّم + تطبيق + راحة — التوازن سرّ الاستمرار ٩٠ يوم.",
  "كل محترف بدأ مبتدئ، الفرق إنه ما وقف. لا توقف أنت.",
  "تقدّمك اليوم مو واضح، بس بعد ٩٠ يوم بتشوف فرق جبّار. ثق بالعملية.",
  "طبّق اللي تعلّمته اليوم — العمل بيدك أهم بكثير من مجرّد المشاهدة.",
  "اكتب هدفك وحطه قدامك: وين تبي توصل بعد ٩٠ يوم؟",
  "الإتقان يجي من التفاصيل الصغيرة. ركّز على درس اليوم بكل تركيزك.",
  "ما في يوم ضائع طول ما تتعلّم فيه شي جديد. خلّ اليوم نقلة.",
  "نفس النَفَس اللي بدأت فيه — احتفظ فيه للنهاية. أنت قادر.",
  "لو فاتك يوم أو يومين، عادي جدًا — المهم ترجع. التحدّي مو سباق، هو رحلة.",
  "تذكّر: كل درس تخلّصه يقربك خطوة من أول فيديو احترافي ينبهر فيه الكل.",
  "الناس اللي وصلت، ما كانت أذكى منك — بس كانت أصبر. اصبر يوم بيوم.",
  "اليوم فرصة جديدة، حتى لو أمس ما كان مثالي. ابدأ من جديد بكل طاقتك 💪",
  "تخيّل نفسك بعد ما تخلّص التحدّي: مونتير محترف يشتغل بشغفه. هذا اللي تبنيه الحين.",
  "ما يحتاج وقت طويل — ٣٠ دقيقة تركيز اليوم تفرق. ابدأ بدرس واحد بس.",
  "إنجازك الصغير اليوم هو أساس إنجازك الكبير بكرة. لا تستهين بأي خطوة.",
  "إذا حسّيت بإحباط، هذا دليل إنك تتطوّر فعلاً — استمر، الجزء الصعب يعني إنك تكبر.",
];
const CHAL_COMM = [
  "شارك تطبيقك اليوم في قسم المجتمع — التغذية الراجعة تسرّع تطوّرك أضعاف.",
  "ادخل المجتمع، علّق على شغل غيرك وكوّن علاقات — شبكتك اليوم = فرصك بكرة.",
  "اكتب سؤالك أو فكرتك في المجتمع، ما أحد يكمّل لحاله. نحن وياك.",
];
const CHAL_JOBS = [
  "تذكّر: في قسم «فرص عمل» بالمجتمع مشاريع وفرص حقيقية — جهّز نفسك لها.",
  "كل ما تطوّرت، قربت من أول عميل. تابع فرص العمل في المجتمع باستمرار.",
];
function challengeMsg(day) {
  if (CHAL_MILE[day]) return CHAL_MILE[day];
  if (day % 7 === 0) return CHAL_COMM[(day / 7) % CHAL_COMM.length];
  if (day % 5 === 0) return CHAL_JOBS[Math.floor(day / 5) % CHAL_JOBS.length];
  return CHAL_POOL[day % CHAL_POOL.length];
}
function renderChallenge() {
  const banner = $("challengeBanner"); if (!banner) return;
  const raw = (MEMBER && MEMBER.created_at) || (USER && USER.created_at);
  if (!raw) { banner.hidden = true; return; }
  const start = new Date(raw);
  const diff = Math.round((dayOf(new Date()) - dayOf(start)) / 86400000);
  const done = diff >= 90;
  const dayNum = currentChalDay();
  const left = Math.max(0, 90 - dayNum);
  const pct = Math.round((dayNum / 90) * 100);
  $("chalDay").textContent = done ? "٩٠" : toAr(dayNum);
  $("chalLeft").textContent = done ? "اكتمل التحدّي ✓" : `باقي ${toAr(left)} يوم`;
  $("chalBar").style.width = pct + "%";
  const ring = $("chalRing");
  if (ring) ring.style.background = `conic-gradient(#5BB8E8 ${pct * 3.6}deg, rgba(255,255,255,.1) 0deg)`;
  $("chalMsg").textContent = (done ? CHAL_MILE[90] : challengeMsg(dayNum)) + " " + progressLine();
  let dis = null; try { dis = localStorage.getItem("thameen_chal_dismiss"); } catch (_) {}
  banner.hidden = (dis === String(dayNum));
  const x = $("chalX");
  if (x && !x._wired) { x._wired = true; x.addEventListener("click", () => { try { localStorage.setItem("thameen_chal_dismiss", String(dayNum)); } catch (_) {} banner.hidden = true; }); }
}

// صندوق «رسائلي» — سلايدر: شريحة وحدة بالمرّة. onlyNew=الجديد فقط (يظهر مرة عند الدخول)
function renderInbox(onlyNew) {
  const box = $("inboxList"); if (!box) return;
  const raw = (MEMBER && MEMBER.created_at) || (USER && USER.created_at);
  if (!raw) { box.innerHTML = '<p class="hint">رسائلك التحفيزية بتبدأ توصلك من أول يوم اشتراك.</p>'; return; }
  const base = dayOf(new Date(raw));
  const today = currentChalDay();
  const from = onlyNew ? Math.min(today, inboxSeen() + 1) : 1;
  const items = [];
  for (let d = from; d <= today; d++) {
    const date = new Date(base.getTime() + (d - 1) * 86400000);
    let msg = d >= 90 ? CHAL_MILE[90] : challengeMsg(d);
    if (d === today) msg += " " + progressLine();
    items.push({ d, date, msg, mile: !!CHAL_MILE[d], isToday: d === today });
  }
  if (!items.length) { box.innerHTML = '<p class="hint">لا رسائل جديدة — كل رسائلك مقروءة 🤍</p>'; return; }
  // الأحدث فوق + قابلة للطيّ: المفتوح = الجديد كله (تلقائي) أو الأحدث فقط (تصفّح)
  items.reverse();   // الأحدث أولاً
  box.innerHTML = items.map((it, i) => {
    const open = (onlyNew || i === 0) ? " open" : "";
    return `<details class="inbox-item ${it.mile ? "mile" : ""}"${open}>
      <summary><span class="inbox-day">اليوم ${toAr(it.d)}</span><span class="inbox-date">${fmtDate(it.date)}</span>${it.isToday ? '<span class="inbox-new">جديد</span>' : ""}<span class="inbox-chev">▸</span></summary>
      <p>${esc(it.msg)}</p></details>`;
  }).join("");
}

// تتبّع الرسائل الجديدة + نقطة التنبيه على البروفايل
function dayOf(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }   // منتصف الليل المحلي
function currentChalDay() {
  const raw = (MEMBER && MEMBER.created_at) || (USER && USER.created_at);
  if (!raw) return 0;
  // فرق الأيام التقويمية (الرسالة تتغيّر مع كل يوم جديد، مو حسب ساعة التسجيل)
  const diff = Math.round((dayOf(new Date()) - dayOf(new Date(raw))) / 86400000);
  return Math.min(90, Math.max(1, diff + 1));
}
// سطر شخصي يذكّره بإنجازه ويطمئنه — يُضاف لرسالة اليوم فقط
function progressLine() {
  const doneN = DONE.size, total = LESSONS.length || 0, left = Math.max(0, 90 - currentChalDay());
  if (total && doneN >= total) return `وأنجزت كل الدروس (${toAr(doneN)}) 👑 — فخورين فيك، كمّل تطبيق وإبداع!`;
  if (doneN === 0) return `ما عليك لو اليوم كان مشغول — باقي لك ${toAr(left)} يوم، وكل يوم فرصة جديدة. افتح درس واحد بس اليوم وبتلقى نفسك بلشت 🚀`;
  return `لين الحين أنجزت ${toAr(doneN)}${total ? " من " + toAr(total) : ""} درس 👏 وباقي لك ${toAr(left)} يوم — تقدر تنجز أكثر، خطوة كل يوم تكفي. ولو فاتك يوم لا تشيل هم، رجّاع وكمّل.`;
}
function inboxSeen() { try { return parseInt(localStorage.getItem("thameen_inbox_seen") || "0", 10) || 0; } catch (_) { return 0; } }
function hasNewInbox() { return currentChalDay() > inboxSeen(); }
function updateInboxBadge() {
  const on = hasNewInbox();
  const mb = $("navMenuBtn"); if (mb) mb.classList.toggle("has-new", on);
  const gi = $("guideBtn"); if (gi) gi.classList.toggle("has-new", on);
}
function markInboxSeen() { try { localStorage.setItem("thameen_inbox_seen", String(currentChalDay())); } catch (_) {} updateInboxBadge(); }

// ====== عمود دوراتي ======
function renderCourses() {
  const wrap = $("coursesCol");
  if (!SECTIONS.length) { wrap.innerHTML = '<p class="hint">لا دورات بعد.</p>'; return; }
  wrap.innerHTML = SECTIONS.map((sec) => {
    const ls = LESSONS.filter((l) => l.section_id === sec.id);
    const done = ls.filter((l) => DONE.has(l.id)).length;
    const pct = ls.length ? Math.round((done / ls.length) * 100) : 0;
    const full = ls.length && done === ls.length;
    const cover = sec.cover_url ? `<img src="${esc(sec.cover_url)}" alt="" loading="lazy" decoding="async">` : `<span class="crs-ph">📚</span>`;
    const secs = ls.reduce((a, l) => a + (l.duration || 0), 0);
    const durTxt = secs ? ` · ${fmtDurAr(secs)}` : "";
    return `<button class="crs-card ${sec.id === CURSEC ? "on" : ""}" data-sid="${sec.id}">
      <div class="crs-cover">${cover}${full ? '<span class="crs-badge full">✓</span>' : ""}</div>
      <div class="crs-info">
        <b>${esc(sec.title)}</b>
        <div class="crs-line">${ls.length} درس · ${done}/${ls.length} مكتمل${durTxt}</div>
        <div class="crs-bar"><span style="width:${pct}%"></span></div>
      </div>
    </button>`;
  }).join("");
  wrap.querySelectorAll(".crs-card").forEach((b) => b.addEventListener("click", () => openCourse(b.dataset.sid)));
}

function openCourse(sid) {
  CURSEC = sid;
  renderCourses();
  const ls = LESSONS.filter((l) => l.section_id === sid);
  if (ls.length) { playLesson((ls.find((l) => !DONE.has(l.id)) || ls[0]).id); }
  else { CURLESSON = null; renderPlaylist([]); $("lTitle").textContent = "—"; $("playerHost").innerHTML = '<p class="hint" style="padding:30px;text-align:center">لا دروس في هذا القسم بعد.</p>'; $("lDesc").innerHTML = ""; }
}

// إزالة الإيموجي من النصوص (عناوين أنظف)
function stripEmoji(s) {
  return String(s || "")
    .replace(/[\u{1F000}-\u{1FAFF}\u{1F1E6}-\u{1F1FF}\u{2300}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{2122}\u{2139}]/gu, "")
    .replace(/\s{2,}/g, " ").trim();
}
// وصف الدرس: روابط كبطاقات مرتبة + زر عرض المزيد/أقل
function svgIc(paths) { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`; }
function descIcon(u) {
  if (/youtube\.com|youtu\.be/i.test(u)) return svgIc('<circle cx="12" cy="12" r="9"/><path d="M10 8.5l5.5 3.5-5.5 3.5z" fill="currentColor" stroke="none"/>');
  if (/drive\.google|docs\.google/i.test(u)) return svgIc('<path d="M4 7a1 1 0 0 1 1-1h4l2 2h8a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/>');
  if (/notion\.|notion\.site/i.test(u)) return svgIc('<path d="M7 3h8l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v5h5"/><path d="M9 12h6M9 16h4"/>');
  if (/github\./i.test(u)) return svgIc('<path d="M9 8l-4 4 4 4"/><path d="M15 8l4 4-4 4"/>');
  if (/thameen\.shop/i.test(u)) return svgIc('<path d="M9 7V6a3 3 0 0 1 6 0v1"/><path d="M4.5 7h15l-1.1 12.1a1 1 0 0 1-1 .9H6.6a1 1 0 0 1-1-.9z"/>');
  if (/\.(com|io|net|org|sg|shop|site|sa)\b/i.test(u)) return svgIc('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 2.5 15.4 0 18M12 3c-2.5 2.6-2.5 15.4 0 18"/>');
  return svgIc('<path d="M9.5 14.5l5-5"/><path d="M10.8 7.2l1-1a3.5 3.5 0 0 1 5 5l-2 2"/><path d="M13.2 16.8l-1 1a3.5 3.5 0 0 1-5-5l2-2"/>');
}
function descHost(u) { try { return new URL(u).hostname.replace(/^www\./, ""); } catch (_) { return u; } }
function renderLessonDesc(text) {
  const box = $("lDesc"); if (!box) return;
  box.classList.remove("desc-expanded");
  const raw = String(text || "");
  if (!raw.trim()) { box.innerHTML = ""; return; }
  const urlRe = /^https?:\/\//i; const items = [];
  // ```...``` = صندوق أوامر قابل للنسخ، وبقية النص روابط/ملاحظات (سطر عنوان ثم سطر رابط)
  raw.split("```").forEach((seg, si) => {
    if (si % 2 === 1) { const code = seg.replace(/^\n+/, "").replace(/\s+$/, ""); if (code) items.push({ code: true, text: code }); return; }
    let pending = null;
    seg.split("\n").map((s) => s.trim()).filter(Boolean).forEach((ln) => {
      if (urlRe.test(ln)) { items.push({ link: true, label: pending || descHost(ln), url: ln }); pending = null; }
      else { if (pending) items.push({ link: false, text: pending }); pending = ln; }
    });
    if (pending) items.push({ link: false, text: pending });
  });
  const copyIc = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>';
  const LIMIT = 8; let nLink = 0;
  const rows = items.map((it) => {
    if (it.code) return `<div class="desc-code"><button type="button" class="desc-code-copy" title="نسخ">${copyIc}<span>نسخ</span></button><pre>${esc(it.text)}</pre></div>`;
    if (!it.link) return `<div class="desc-note">${esc(stripEmoji(it.text))}</div>`;
    const extra = nLink >= LIMIT ? " desc-extra" : ""; nLink++;
    return `<div class="desc-item${extra}">
      <span class="desc-ic">${descIcon(it.url)}</span>
      <a class="desc-label" href="${esc(it.url)}" target="_blank" rel="noopener">${esc(stripEmoji(it.label))}</a>
      <button type="button" class="desc-copy-url" data-url="${esc(it.url)}" title="نسخ الرابط">${copyIc}<span>نسخ</span></button>
      <a class="desc-open" href="${esc(it.url)}" target="_blank" rel="noopener">فتح <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7M9 7h8v8"/></svg></a>
    </div>`;
  }).join("");
  const hidden = Math.max(0, nLink - LIMIT);
  const more = hidden > 0 ? `<button type="button" class="desc-toggle" data-n="${hidden}">عرض جميع التفاصيل (${hidden}+)</button>` : "";
  const hIcon = '<svg class="desc-h-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5l-8.5 8.5a5 5 0 0 1-7-7l8.5-8.5a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3l7.8-7.8"/></svg>';
  box.innerHTML = `<div class="desc-card"><h4 class="desc-h">${hIcon} الروابط والمرفقات</h4><div class="desc-list">${rows}</div>${more}</div>`;
  const tg = box.querySelector(".desc-toggle");
  if (tg) tg.addEventListener("click", () => {
    const exp = box.classList.toggle("desc-expanded");
    tg.textContent = exp ? "عرض أقل ▲" : `عرض جميع التفاصيل (${tg.dataset.n}+)`;
  });
}
// نسخ أوامر صناديق الكود + روابط التحميل في وصف الدرس
function descCopy(text, btn) {
  const s = btn.querySelector("span"); const o = s ? s.textContent : "";
  const done = () => { btn.classList.add("ok"); if (s) s.textContent = "تم النسخ ✓"; setTimeout(() => { btn.classList.remove("ok"); if (s) s.textContent = o; }, 1500); };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done).catch(() => {});
  else { const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); } catch (_) {} ta.remove(); done(); }
}
document.addEventListener("click", (e) => {
  const u = e.target.closest(".desc-copy-url");
  if (u) { e.preventDefault(); descCopy(u.dataset.url, u); return; }
  const b = e.target.closest(".desc-code-copy");
  if (b) { const pre = b.parentElement.querySelector("pre"); if (pre) descCopy(pre.innerText, b); }
});

function plItemHtml(l, i) {
  const dur = l.duration ? `<span class="pl-dur">${fmtDur(l.duration)}</span>` : "";
  return `<button class="pl-item ${l.id === CURLESSON ? "on" : ""}" data-lid="${l.id}">
      <span class="pl-num ${DONE.has(l.id) ? "done" : ""}">${DONE.has(l.id) ? "✓" : i + 1}</span>
      <span class="pl-name">${esc(stripEmoji(l.title))}</span>
      ${dur}
    </button>`;
}
// سلسلة الذكاء الاصطناعي — ٣ حلقات تُعرض كمجلّد فعلي داخل «دورة المحترفين» (بدل بوكس «قريبًا»)
const AI_SERIES_FOLDER = "سلسلة الذكاء الاصطناعي";
const AI_SERIES = [
  { id: "ai-figma-ae", title: "Claude + فيقما + الأفتر إفكتس",
    embed_url: "https://iframe.mediadelivery.net/embed/281396/8c2fc5f2-f543-46fe-aa5f-4757afd163fb",
    description: [
      "تصميم وحركة موشن جرافيكس بالكامل عبر الذكاء الاصطناعي.",
      "ملفات المهارة (Skill) — حمّلها ثم حطّها داخل مجلد ‎~/.claude/skills/‎ وأعد تشغيل كلود:",
      "تحميل ملفات المهارة (Google Drive)",
      "https://drive.google.com/drive/folders/1BnLz4YtHOw42LOw7e34_n7pyeBxxFEcK",
      "خطوة التثبيت — أنشئ مجلّد المهارات (انسخ والصق في التيرمنال):",
      "```", "mkdir -p ~/.claude/skills", "```",
      "بعدها فك ضغط مجلّد ai-motion-graphics داخل ‎~/.claude/skills/‎ ثم أعد فتح كلود — وتطلب منه: «سوّي لي موشن جرافيكس».",
    ].join("\n") },
  { id: "ai-mcp-setup", title: "تحميل التطبيقات وربطها بالـ MCP",
    embed_url: "https://iframe.mediadelivery.net/embed/281396/5b04f5da-9b96-480a-81c1-11d1776faea1",
    description: [
      "Claude Desktop", "https://claude.ai/download",
      "VS Code", "https://code.visualstudio.com",
      "Node.js (LTS)", "https://nodejs.org",
      "Git for Windows — ويندوز فقط", "https://git-scm.com/download/win",
      "Premiere MCP", "https://github.com/hetpatel-11/Adobe_Premiere_Pro_MCP",
      "After Effects MCP", "https://github.com/ishu86/after-effects-mcp",
      "طريقة تثبيت الـ MCP — انسخ والصق في التيرمنال:",
      "```", "cd ~/Downloads", "git clone https://github.com/ishu86/Adobe_Premiere_Pro_MCP-main.git", "cd after-effects-mcp", "npm install", "npm run build", "cd scripts", "```",
      "على ماك:", "```", "bash install-cep.sh", "```",
      "على ويندوز:", "```", "./install-cep.bat", "```",
      "ربط بريمير برو على ماك:", "```", "cd ~/Downloads/Adobe_Premiere_Pro_MCP", "npm run setup:mac", "```",
    ].join("\n") },
  { id: "ai-premiere", title: "Claude AI + بريمير برو",
    embed_url: "https://iframe.mediadelivery.net/embed/281396/e4a8f102-c0c8-4e0c-a89e-ccab446d7b8a",
    description: "مونتاج وتحكم كامل في التايملاين." },
  { id: "ai-motion-no-app", title: "سويت موشن جرافكس بدون أي برنامج… بس بالكلام! 🤯",
    embed_url: "https://iframe.mediadelivery.net/embed/281396/d21a8f32-d6bb-42ed-b6a3-452744020b1e",
    description: [
      "موشن جرافيكس احترافي بالكامل عبر الذكاء الاصطناعي — بدون أي برنامج (لا أفتر ولا بريمير)، فقط بالكلام عبر Claude.",
      "ملفات المهارة (Skill) — حمّلها ثم حطّها داخل مجلد ‎~/.claude/skills/‎ وأعد تشغيل كلود:",
      "تحميل ملفات المهارة (Google Drive)",
      "https://drive.google.com/drive/folders/1BnLz4YtHOw42LOw7e34_n7pyeBxxFEcK",
      "خطوة التثبيت — أنشئ مجلّد المهارات (انسخ والصق في التيرمنال):",
      "```", "mkdir -p ~/.claude/skills", "```",
      "بعدها فك ضغط مجلّد ai-motion-graphics داخل ‎~/.claude/skills/‎ ثم أعد فتح كلود — وتطلب منه: «سوّي لي موشن جرافيكس».",
    ].join("\n") },
];
// تُحقن في قائمة الدروس كمجلّد داخل القسم الاحترافي — تظهر وتشتغل فورًا بدون قاعدة بيانات
function injectAISeries() {
  const pro = SECTIONS.find((s) => /محترف|احتراف|تطوير|pro/i.test(s.title || ""));
  if (!pro) return;
  // لو الحلقات مضافة في قاعدة البيانات (نفس رابط Bunny) لا تُكرَّر — نسخة الكود احتياطية فقط
  const have = new Set(LESSONS.map((l) => (l.embed_url || "").split("?")[0]));
  AI_SERIES.forEach((v, i) => {
    if (have.has(v.embed_url.split("?")[0])) return;
    LESSONS.push({
      id: v.id, section_id: pro.id, title: v.title, embed_url: v.embed_url,
      description: v.description, folder: AI_SERIES_FOLDER, sort: 900 + i, duration: 0,
    });
  });
}
function renderPlaylist(ls) {
  const wrap = $("plList");
  if (!wrap) return;
  if (!ls.length) { wrap.innerHTML = '<p class="hint" style="padding:14px">لا دروس بعد.</p>'; bindPlaylist(wrap); return; }
  const folderSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7a1 1 0 0 1 1-1h4l2 2h8a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/></svg>';
  const chevron = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 10l4 4 4-4"/></svg>';
  const seen = new Set(); let html = "";
  ls.forEach((l, idx) => {
    const f = (l.folder || "").trim();
    if (!f) { html += plItemHtml(l, idx); return; }
    if (seen.has(f)) return;
    seen.add(f);
    const group = ls.filter((x) => (x.folder || "").trim() === f);
    const doneN = group.filter((x) => DONE.has(x.id)).length;
    const open = group.some((x) => x.id === CURLESSON);
    html += `<div class="pl-folder ${open ? "open" : ""}">
      <button class="pl-fold-head" type="button">
        <span class="pl-fold-ic">${folderSvg}</span>
        <span class="pl-fold-name">${esc(stripEmoji(f))}</span>
        <span class="pl-fold-meta">${doneN}/${group.length}${(() => { const fs = group.reduce((a, x) => a + (x.duration || 0), 0); return fs ? " · " + fmtDur(fs) : ""; })()}</span>
        <span class="pl-fold-arrow">${chevron}</span>
      </button>
      <div class="pl-fold-body">${group.map((g) => plItemHtml(g, ls.indexOf(g))).join("")}<div class="pl-fold-end">نهاية المجلّد</div></div>
    </div>`;
  });
  wrap.innerHTML = html;
  bindPlaylist(wrap);
}
function bindPlaylist(wrap) {
  wrap.querySelectorAll(".pl-item").forEach((b) => b.addEventListener("click", () => playLesson(b.dataset.lid)));
  wrap.querySelectorAll(".pl-fold-head").forEach((b) => b.addEventListener("click", () => b.closest(".pl-folder").classList.toggle("open")));
}

function playLesson(id) {
  const l = LESSONS.find((x) => x.id === id); if (!l) return;
  CURLESSON = id;
  try { localStorage.setItem("thameen_lesson", id); } catch (_) {}
  $("lTitle").textContent = stripEmoji(l.title);
  const host = $("playerHost");
  host.innerHTML = l.embed_url
    ? `<iframe src="${esc(l.embed_url)}" loading="lazy" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`
    : '<p class="hint" style="padding:30px;text-align:center">لا يوجد فيديو لهذا الدرس.</p>';
  const ifr = host.querySelector("iframe");
  if (ifr && window.playerjs) attachPlayer(ifr, id);
  renderLessonDesc(l.description);
  updateWatchUI(id);
  renderPlaylist(LESSONS.filter((x) => x.section_id === CURSEC));
  loadNotes(id);
}

// تحديث شريط المشاهدة
function updateWatchUI(id) {
  const done = DONE.has(id);
  const pct = done ? 100 : (PCT[id] || 0);
  const fill = $("watchFill"), label = $("watchLabel");
  if (fill) { fill.style.width = pct + "%"; fill.classList.toggle("done", done); }
  if (label) {
    label.classList.toggle("done", done);
    label.textContent = done ? "✓ أكملت هذا الدرس" : `شاهدت ${Math.round(pct)}% · يكتمل تلقائيًا عند ٩٠٪`;
  }
}

// التقاط مدة الفيديو تلقائيًا وحفظها (مرة وحدة لكل درس) — يزيد الإجمالي تلقائيًا
let savedDur = {};
async function saveDuration(id, secs) {
  try {
    await fetchT(`${SUPABASE_URL}/rest/v1/rpc/set_lesson_duration`, {
      method: "POST", headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ p_id: id, p_secs: secs }),
    });
  } catch (_) {}
}
function maybeCaptureDuration(id, d) {
  d = Math.round(d || 0);
  if (d <= 0 || savedDur[id]) return;
  const lo = LESSONS.find((x) => x.id === id);
  if (lo && (!lo.duration || lo.duration === 0)) {
    savedDur[id] = true;
    lo.duration = d;
    saveDuration(id, d);
    renderCourses();
    renderPlaylist(LESSONS.filter((x) => x.section_id === CURSEC));
  }
}

// مشغّل Bunny عبر مكتبة player.js + عدّاد مشاهدة مضاد للتخطّي
function attachPlayer(ifr, id) {
  const player = new playerjs.Player(ifr);
  curPlayer = player; curPlayerTime = 0;
  let lastT = null, watched = null, dur = 0;
  player.on("ready", () => {
    // التقط مدة الفيديو تلقائيًا وسجّلها (مرة وحدة لكل درس)
    try { player.getDuration((d) => maybeCaptureDuration(id, d)); } catch (_) {}
    // كمّل من مكان ما وقف (لو فيه تقدّم محفوظ بين ١٪ و٩٠٪)
    const savedPct = PCT[id] || 0;
    if (savedPct > 1 && savedPct < 90) {
      try { player.getDuration((d) => { if (d > 0) player.setCurrentTime(Math.max(0, (savedPct / 100) * d - 2)); }); } catch (_) {}
    }
    player.on("timeupdate", (e) => {
      const t = (e && e.seconds) || 0;
      const d = (e && e.duration) || dur; dur = d;
      curPlayerTime = t;
      const nl = $("noteAtLabel"); if (nl) nl.textContent = fmtDur(Math.floor(t));
      if (d > 0) maybeCaptureDuration(id, d);
      if (watched === null) watched = ((PCT[id] || 0) / 100) * (d || 0); // ابدأ من المحفوظ
      // احسب فقط المشاهدة الطبيعية (تقدّم ≤ ثانيتين) — السكِب ما ينحسب
      if (lastT !== null && t > lastT && (t - lastT) <= 2) watched += (t - lastT);
      lastT = t;
      if (d > 0) recordWatch(id, Math.min(100, (watched / d) * 100));
    });
    // ملاحظة: ما نعتمد على حدث "ended" — الإكمال فقط من الثواني المُشاهَدة فعليًا (يمنع السكِب للآخر)
  });
}

// تسجيل نسبة المشاهدة (تنمو فقط) + إكمال تلقائي عند ٩٠٪
async function recordWatch(id, pct) {
  pct = Math.round(pct);
  if (pct <= (PCT[id] || 0)) return;
  PCT[id] = pct;
  const completed = pct >= 90;
  const wasDone = DONE.has(id);
  if (completed && !wasDone) {
    DONE.add(id);
    renderProgress(); renderCourses();
    renderPlaylist(LESSONS.filter((x) => x.section_id === CURSEC));
  }
  if (id === CURLESSON) updateWatchUI(id);
  // حفظ مخفّف: كل +٥٪ أو عند الإكمال
  if (completed !== wasDone || pct - (lastSaved[id] || 0) >= 5) {
    lastSaved[id] = pct;
    const base = { user_id: USER.id, lesson_id: id, completed, updated_at: new Date().toISOString() };
    try {
      await dbSend("POST", "progress?on_conflict=user_id,lesson_id",
        { ...base, percent: pct }, "resolution=merge-duplicates,return=minimal");
    } catch (_) {
      // لو عمود percent مو موجود، احفظ الإكمال على الأقل
      try { await dbSend("POST", "progress?on_conflict=user_id,lesson_id", base, "resolution=merge-duplicates,return=minimal"); } catch (_) {}
    }
  }
}

// ====== ملاحظات الدرس (Notes على اللحظة) ======
async function loadNotes(lessonId) {
  const list = $("notesList"); if (!list) return;
  const ed = $("noteEditor"); if (ed) ed.hidden = true;
  let notes = [];
  try { notes = await dbGet(`notes?select=id,seconds,text&lesson_id=eq.${lessonId}&user_id=eq.${USER.id}&order=seconds.asc`); } catch (_) {}
  if (!notes || !notes.length) {
    list.innerHTML = '<p class="notes-empty">ما عندك ملاحظات على هذا الدرس بعد — شغّل الفيديو وأضف ملاحظة على أي لحظة تحبها 👆</p>';
    return;
  }
  list.innerHTML = notes.map((n) => `<div class="note-item">
    <button class="note-time" data-s="${n.seconds}" title="انتقل لهذه اللحظة">▸ ${fmtDur(n.seconds)}</button>
    <div class="note-body">${esc(n.text)}</div>
    <button class="note-del" data-id="${n.id}" title="حذف الملاحظة">✕</button>
  </div>`).join("");
  list.querySelectorAll(".note-time").forEach((b) => b.addEventListener("click", () => jumpToTime(parseInt(b.dataset.s, 10))));
  list.querySelectorAll(".note-del").forEach((b) => b.addEventListener("click", async () => {
    if (!confirm("حذف هذه الملاحظة؟")) return;
    try { await dbSend("DELETE", `notes?id=eq.${b.dataset.id}`, null, "return=minimal"); loadNotes(lessonId); } catch (e) { alert("تعذّر الحذف"); }
  }));
}
function jumpToTime(seconds) {
  if (curPlayer) { try { curPlayer.setCurrentTime(seconds); curPlayer.play(); } catch (_) {} }
  const pb = document.querySelector(".player-box"); if (pb) pb.scrollIntoView({ behavior: "smooth", block: "center" });
}
(function () {
  const addBtn = $("addNoteBtn"), ed = $("noteEditor"), save = $("saveNoteBtn"), cancel = $("cancelNoteBtn"), txt = $("noteText"), atFixed = $("noteAtFixed");
  if (!addBtn) return;
  addBtn.addEventListener("click", () => {
    noteCaptureT = Math.floor(curPlayerTime || 0);
    if (atFixed) atFixed.textContent = fmtDur(noteCaptureT);
    ed.hidden = false; txt.value = ""; txt.focus();
  });
  if (cancel) cancel.addEventListener("click", () => { ed.hidden = true; });
  if (save) save.addEventListener("click", async () => {
    const t = txt.value.trim();
    if (!t || !CURLESSON || !USER) { ed.hidden = true; return; }
    save.disabled = true;
    try {
      await dbSend("POST", "notes", { user_id: USER.id, lesson_id: CURLESSON, seconds: noteCaptureT, text: t }, "return=minimal");
      ed.hidden = true;
      loadNotes(CURLESSON);
    } catch (e) { alert("تعذّر حفظ الملاحظة: " + (e.message || "")); }
    save.disabled = false;
  });
})();

// ====== المجتمع ======
let commTimer = null, CURCHAN = "general", commSearch = "", pendingFile = null, MSGS = [];
let MEMBERS = [], pendingMentions = [];
let renderedIds = new Set(), rLastDay = null, rLastUid = null, rLastTime = 0, rChan = null, lastDynSig = "";
const CHAN_INFO = {
  general: { t: "العام", d: "شارك، اسأل، وتفاعل مع باقي المتدربين" },
  achievements: { t: "الإنجازات", d: "اعرض شغلك وإنجازاتك وارفع فيديوهاتك 🚀" },
  jobs: { t: "فرص عمل", d: "فرص ومشاريع مونتاج — للجادّين ✦" },
};
const EMOJIS = "😀 😂 🤣 😊 😍 😎 🥳 🔥 👍 👏 🙏 💪 🎬 🎥 ✨ ⭐ 💯 ❤️ 🎉 ✅ 👀 🤔 😅 🥰 😱 💎 🚀 📈 🏆 🎯 👌 🤝 💡 ⚡ 🌟 😭 🙌 💥 🤩 😏".split(" ");

function myName() {
  if (USER && USER.user_metadata && USER.user_metadata.name) return USER.user_metadata.name;
  return USER && USER.email ? USER.email.split("@")[0] : "متدرب";
}
function avColor(s) { let h = 0; s = s || ""; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360; return `linear-gradient(135deg,hsl(${h},70%,55%),hsl(${(h + 40) % 360},65%,42%))`; }
function initialOf(n) { return (n || "؟").trim().charAt(0) || "؟"; }
// صورة البروفايل: img لو موجودة، وإلا أول حرف بخلفية ملوّنة
function avInner(uid, nm) { const u = AVATARS[uid]; return u ? `<img src="${esc(u)}" alt="" class="av-img" loading="lazy">` : esc(initialOf(nm)); }
function avStyle(uid, nm) { return AVATARS[uid] ? "" : `background:${avColor(uid || nm)}`; }
async function loadAvatars() {
  try { const ps = await dbGet("profiles?select=user_id,avatar_url&limit=500"); AVATARS = {}; (ps || []).forEach((p) => { if (p.avatar_url) AVATARS[p.user_id] = p.avatar_url; }); }
  catch (_) {}
  setNavProfile();   // حدّث أفتار القائمة بصورة البروفايل بعد ما تحمّل
}
function fmtTime(iso) { try { const d = new Date(iso); let h = d.getHours(); const ap = h < 12 ? "ص" : "م"; h = h % 12 || 12; return `${h}:${String(d.getMinutes()).padStart(2, "0")} ${ap}`; } catch (_) { return ""; } }

// رفع ملف للمجتمع
async function uploadCommFile(file) {
  const ext = (file.name.split(".").pop() || "bin").toLowerCase();
  const path = `community/${crypto.randomUUID()}.${ext}`;
  const r = await fetchT(`${SUPABASE_URL}/storage/v1/object/media/${path}`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + TOKEN, "x-upsert": "true", "Content-Type": file.type || "application/octet-stream" },
    body: file,
  }, 180000);
  if (!r.ok) throw new Error(await r.text());
  return `${SUPABASE_URL}/storage/v1/object/public/media/${path}`;
}

async function registerProfile() {
  if (!USER) return;
  try { await dbSend("POST", "profiles?on_conflict=user_id", { user_id: USER.id, name: myName() }, "resolution=merge-duplicates,return=minimal"); } catch (_) {}
}
async function loadMembers() {
  const el = $("memList"); if (!el) return;
  let ps; try { ps = await dbGet("profiles?select=user_id,name,avatar_url&order=created_at.asc&limit=300"); }
  catch (_) { try { ps = await dbGet("profiles?select=user_id,name&order=created_at.asc&limit=300"); } catch (_) { return; } }
  ps.forEach((p) => { if (p.avatar_url) AVATARS[p.user_id] = p.avatar_url; });
  MEMBERS = ps.filter((p) => p.name && p.user_id !== (USER && USER.id)).map((p) => ({ id: p.user_id, name: p.name }));
  const c = $("memCount"); if (c) c.textContent = `(${ps.length})`;
  el.innerHTML = ps.map((p) => `<div class="mem"><div class="mem-av" style="${avStyle(p.user_id, p.name)}">${avInner(p.user_id, p.name)}</div><span class="mem-name">${esc(p.name || "متدرب")}</span></div>`).join("");
}

// تضمين الروابط داخل الرسالة (يوتيوب/إنستقرام/تيك توك/فيديو مباشر)
function embedFor(text) {
  if (!text) return "";
  const url = (text.match(/https?:\/\/[^\s]+/) || [])[0];
  if (!url) return "";
  let m = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([\w-]{11})/);
  if (m) return `<div class="embed16"><iframe src="https://www.youtube.com/embed/${m[1]}" allow="encrypted-media;picture-in-picture;fullscreen" allowfullscreen loading="lazy"></iframe></div>`;
  m = url.match(/instagram\.com\/(reel|p|tv)\/([\w-]+)/);
  if (m) return `<div class="embed-ig"><iframe src="https://www.instagram.com/${m[1]}/${m[2]}/embed" loading="lazy" scrolling="no"></iframe></div>`;
  m = url.match(/tiktok\.com\/.*\/video\/(\d+)/);
  if (m) return `<div class="embed-tt"><iframe src="https://www.tiktok.com/embed/v2/${m[1]}" loading="lazy" allowfullscreen></iframe></div>`;
  if (/\.(mp4|webm|mov)(\?|$)/i.test(url)) return `<video src="${esc(url)}" controls preload="metadata"></video>`;
  return "";
}
function dayKey(d) { return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; }
function dayLabel(d) {
  const now = new Date();
  if (dayKey(d) === dayKey(now)) return "اليوم";
  const y = new Date(); y.setDate(y.getDate() - 1);
  if (dayKey(d) === dayKey(y)) return "أمس";
  return fmtDate(d);
}
function msgHtml(m, isAdmin, grouped) {
  if (CURCHAN === "jobs") return jobCard(m, isAdmin);
  if (CURCHAN === "achievements") return achCard(m, isAdmin);
  return bubbleHtml(m, isAdmin, grouped);
}
function wireDeletes(box) {
  box.querySelectorAll(".del-msg").forEach((b) => {
    if (b._wired) return; b._wired = true;
    b.addEventListener("click", async (e) => {
      const el = e.target.closest("[data-id]"); if (!el) return;
      if (!confirm("حذف الرسالة؟")) return;
      try { await dbSend("DELETE", `community_messages?id=eq.${el.dataset.id}`); loadMessages(false); }
      catch (err) { alert("ما قدرت تحذف هذي الرسالة (مو رسالتك)."); }
    });
  });
}
// رسم كامل (تبديل قناة / بحث / حذف / أول تحميل)
function renderMessages(forceScroll) {
  const box = $("commMessages"); if (!box) return;
  let list = MSGS;
  if (commSearch) { const q = commSearch.toLowerCase(); list = list.filter((m) => (m.text || "").toLowerCase().includes(q) || (m.name || "").toLowerCase().includes(q)); }
  renderedIds = new Set(); rLastDay = null; rLastUid = null; rLastTime = 0; rChan = CURCHAN;
  if (!list.length) { box.innerHTML = `<p class="comm-empty">${commSearch ? "لا نتائج للبحث" : "لا رسائل بعد — كن أول من يبدأ 👋"}</p>`; return; }
  const isAdmin = USER && USER.email === ADMIN_EMAIL;
  let html = "";
  for (const m of list) {
    const dt = new Date(m.created_at), dk = dayKey(dt);
    if (dk !== rLastDay) { html += `<div class="day-sep"><span>${dayLabel(dt)}</span></div>`; rLastDay = dk; rLastUid = null; }
    html += msgHtml(m, isAdmin, m.user_id === rLastUid && (dt - rLastTime) < 5 * 60 * 1000);
    rLastUid = m.user_id; rLastTime = dt; renderedIds.add(m.id);
  }
  box.innerHTML = html;
  wireDeletes(box);
  lastDynSig = dynSig();
  if (forceScroll) { box.scrollTop = box.scrollHeight; updateScrollBtn(); }
}
// إضافة الرسائل الجديدة فقط — بدون إعادة رسم (يمنع الوميض وقفز التمرير)
function appendNew(newMsgs) {
  const box = $("commMessages"); if (!box || commSearch) return;
  if (!renderedIds.size) { renderMessages(false); box.scrollTop = box.scrollHeight; updateScrollBtn(); return; }
  const isAdmin = USER && USER.email === ADMIN_EMAIL;
  const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 90;
  let html = "";
  for (const m of newMsgs) {
    const dt = new Date(m.created_at), dk = dayKey(dt);
    if (dk !== rLastDay) { html += `<div class="day-sep"><span>${dayLabel(dt)}</span></div>`; rLastDay = dk; rLastUid = null; }
    html += msgHtml(m, isAdmin, m.user_id === rLastUid && (dt - rLastTime) < 5 * 60 * 1000);
    rLastUid = m.user_id; rLastTime = dt; renderedIds.add(m.id);
  }
  box.insertAdjacentHTML("beforeend", html);
  wireDeletes(box);
  lastDynSig = dynSig();
  if (atBottom) { box.scrollTop = box.scrollHeight; updateScrollBtn(); }
}
function mediaHtml(m) {
  if (!m.media_url) return "";
  return m.media_type === "video" ? `<video src="${esc(m.media_url)}" controls preload="metadata"></video>` : `<img src="${esc(m.media_url)}" alt="" loading="lazy">`;
}

// ====== تفاعلات + ردود ======
const REACT_EMOJIS = ["🔥", "👍", "❤️", "😂", "👏", "🙏"];
let replyTo = null;
async function rpc(fn, body) {
  try { await fetchT(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, { method: "POST", headers: authHeaders({ "Content-Type": "application/json" }), body: JSON.stringify(body) }, 12000); } catch (_) {}
}
function reactionsInner(m) {
  const r = m.reactions || {}; const myId = USER && USER.id;
  return Object.keys(r).filter((k) => (r[k] || []).length).map((k) => {
    const arr = r[k] || [];
    return `<button class="react-chip ${arr.indexOf(myId) >= 0 ? "mine" : ""}" type="button" data-emoji="${esc(k)}">${k} ${arr.length}</button>`;
  }).join("");
}
function reactionsHtml(m) { const i = reactionsInner(m); return i ? `<div class="cmsg-reacts">${i}</div>` : ""; }
function replyQuoteHtml(m) {
  if (!m.reply_to) return "";
  const o = MSGS.find((x) => x.id === m.reply_to);
  const nm = o ? (o.name || "متدرب") : "رسالة";
  const txt = o ? (o.text || "📎 مرفق") : "رسالة محذوفة";
  return `<div class="cmsg-reply"><b>${esc(nm)}</b><span>${esc(String(txt).slice(0, 90))}</span></div>`;
}
async function reactTo(msgId, emoji) {
  const m = MSGS.find((x) => x.id === msgId);
  if (m && USER) {
    m.reactions = m.reactions || {};
    const arr = m.reactions[emoji] || [];
    const i = arr.indexOf(USER.id);
    if (i >= 0) arr.splice(i, 1); else arr.push(USER.id);
    if (arr.length) m.reactions[emoji] = arr; else delete m.reactions[emoji];
    const box = $("commMessages"), st = box ? box.scrollTop : 0;
    renderMessages(false); if (box) box.scrollTop = st;
  }
  await rpc("toggle_reaction", { p_msg: msgId, p_emoji: emoji });
  loadMessages(false);
}
async function toggleJobTaken(msgId, taken) {
  const m = MSGS.find((x) => x.id === msgId);
  if (m) { m.meta = m.meta || {}; m.meta.taken = taken; const box = $("commMessages"), st = box ? box.scrollTop : 0; renderMessages(false); if (box) box.scrollTop = st; }
  await rpc("set_job_taken", { p_msg: msgId, p_taken: taken });
  loadMessages(false);
}
// شريط التفاعل عند الضغط المزدوج
let reactBarEl = null;
function closeReactBar() { if (reactBarEl) { reactBarEl.remove(); reactBarEl = null; document.removeEventListener("click", reactBarOutside, true); } }
function reactBarOutside(e) { if (reactBarEl && !reactBarEl.contains(e.target)) closeReactBar(); }
function openReactBar(anchor, msgId) {
  closeReactBar();
  const bar = document.createElement("div");
  bar.className = "react-bar";
  bar.innerHTML = REACT_EMOJIS.map((em) => `<button type="button" data-em="${em}">${em}</button>`).join("") + `<button type="button" class="react-reply" data-reply="1">↩ رد</button>`;
  document.body.appendChild(bar);
  const r = anchor.getBoundingClientRect();
  let left = Math.max(10, Math.min(r.left + r.width / 2 - bar.offsetWidth / 2, window.innerWidth - bar.offsetWidth - 10));
  let top = r.top - bar.offsetHeight - 8; if (top < 8) top = r.bottom + 8;
  bar.style.left = left + "px"; bar.style.top = top + "px";
  bar.querySelectorAll("button").forEach((b) => b.addEventListener("click", (ev) => {
    ev.stopPropagation();
    if (b.dataset.reply) startReply(msgId); else reactTo(msgId, b.dataset.em);
    closeReactBar();
  }));
  reactBarEl = bar;
  setTimeout(() => document.addEventListener("click", reactBarOutside, true), 0);
}
function startReply(msgId) {
  const o = MSGS.find((x) => x.id === msgId); if (!o) return;
  replyTo = msgId;
  const bar = $("replyBar");
  if (bar) {
    bar.hidden = false;
    bar.innerHTML = `<div class="reply-bar-in"><b>ترد على ${esc(o.name || "متدرب")}</b><span>${esc(String(o.text || "📎 مرفق").slice(0, 80))}</span></div><button type="button" id="replyCancel" aria-label="إلغاء">✕</button>`;
    const c = bar.querySelector("#replyCancel"); if (c) c.addEventListener("click", cancelReply);
  }
  const inp = $("commInput"); if (inp) inp.focus();
}
function cancelReply() { replyTo = null; const bar = $("replyBar"); if (bar) { bar.hidden = true; bar.innerHTML = ""; } }
function dynSig() { return MSGS.map((m) => m.id + ":" + JSON.stringify(m.reactions || 0) + ":" + ((m.meta && m.meta.taken) ? 1 : 0)).join("|"); }
// أحداث: ضغط مزدوج للتفاعل/الرد، نقر على تفاعل، استلام العمل
(function () {
  const box = $("commMessages"); if (!box) return;
  box.addEventListener("dblclick", (e) => {
    if (CURCHAN === "jobs") return;
    const el = e.target.closest(".cmsg[data-id], .ach-card[data-id]"); if (!el) return;
    openReactBar(el, el.dataset.id);
  });
  box.addEventListener("click", (e) => {
    const chip = e.target.closest(".react-chip");
    if (chip) { const el = chip.closest("[data-id]"); if (el) reactTo(el.dataset.id, chip.dataset.emoji); return; }
    const take = e.target.closest(".job-take");
    if (take) { const el = take.closest("[data-id]"); if (el) toggleJobTaken(el.dataset.id, take.dataset.take === "1"); return; }
  });
})();
// تمييز المنشن @اسم داخل النص (بعد linkify)
function highlightMentions(html) {
  if (!html || html.indexOf("@") < 0) return html;
  let out = html.split("@الكل").join('<span class="mention">@الكل</span>');
  for (const mem of MEMBERS) {
    const at = "@" + esc(mem.name);
    if (out.indexOf(at) >= 0) out = out.split(at).join(`<span class="mention">${at}</span>`);
  }
  return out;
}
function bubbleHtml(m, isAdmin, grouped) {
  const me = m.user_id === (USER && USER.id), nm = m.name || "متدرب";
  const inner = `${replyQuoteHtml(m)}${m.text ? highlightMentions(linkify(m.text)) : ""}${mediaHtml(m)}${embedFor(m.text)}`;
  const reacts = reactionsHtml(m);
  if (grouped) {
    return `<div class="cmsg grouped ${me ? "me" : ""}" data-id="${m.id}">
      <div class="cmsg-av-sp"></div>
      <div class="cmsg-body">
        <div class="cmsg-bubble">${inner}<span class="cmsg-t">${fmtTime(m.created_at)}</span></div>
        ${reacts}
        ${(isAdmin || me) ? '<button class="del-msg mini" type="button" title="حذف">×</button>' : ""}
      </div></div>`;
  }
  return `<div class="cmsg ${me ? "me" : ""}" data-id="${m.id}">
    <div class="cmsg-av" style="${avStyle(m.user_id, nm)}">${avInner(m.user_id, nm)}</div>
    <div class="cmsg-body">
      <div class="cmsg-meta"><span class="cmsg-name">${me ? "أنت" : esc(nm)}</span><span class="cmsg-time">${fmtTime(m.created_at)}</span>${(isAdmin || me) ? '<button class="del-msg" type="button">حذف</button>' : ""}</div>
      <div class="cmsg-bubble">${inner}</div>
      ${reacts}
    </div></div>`;
}
function achCard(m, isAdmin) {
  const nm = m.name || "متدرب", me = m.user_id === (USER && USER.id);
  return `<div class="ach-card" data-id="${m.id}">${(isAdmin || me) ? '<button class="del-msg" type="button">حذف</button>' : ""}
    <div class="ach-head"><div class="ach-av" style="${avStyle(m.user_id, nm)}">${avInner(m.user_id, nm)}</div><div><b>${esc(nm)}</b><small>🏆 إنجاز · ${fmtTime(m.created_at)}</small></div></div>
    ${replyQuoteHtml(m)}${mediaHtml(m)}${embedFor(m.text)}
    ${m.text ? `<div class="ach-text">${highlightMentions(linkify(m.text))}</div>` : ""}
    ${reactionsHtml(m)}</div>`;
}
// تحويل الأرقام العربية/الفارسية (٠١٢٣ / ۰۱۲۳) إلى إنجليزية (0123)
function toLatinDigits(s) {
  return String(s || "")
    .replace(/[٠-٩]/g, (d) => d.charCodeAt(0) - 0x0660)
    .replace(/[۰-۹]/g, (d) => d.charCodeAt(0) - 0x06F0);
}
function normLink(s) {
  s = toLatinDigits((s || "").trim());
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;                       // رابط كامل
  if (/wa\.me|whatsapp\.com|t\.me|instagram\.com|youtube\.com|tiktok\.com/i.test(s)) return "https://" + s.replace(/^\/+/, "");
  if (/^\+?[\d\s\-().]{7,}$/.test(s)) {                          // رقم هاتف/واتساب
    let d = s.replace(/[^\d]/g, "");
    if (d.startsWith("00")) d = d.slice(2);                     // إزالة بادئة الاتصال الدولي 00
    return "https://wa.me/" + d;
  }
  return "https://" + s.replace(/^\/+/, "");
}
function jobCard(m, isAdmin) {
  const nm = m.name || "متدرب", meta = m.meta || {}, me = m.user_id === (USER && USER.id);
  const ch = normLink(meta.channel), ct = normLink(meta.contact), taken = !!meta.taken, canManage = isAdmin || me;
  return `<div class="job-card ${taken ? "taken" : ""}" data-id="${m.id}">${(isAdmin || me) ? '<button class="del-msg" type="button">حذف</button>' : ""}
    <div class="job-top"><div class="job-av" style="${avStyle(m.user_id, nm)}">${avInner(m.user_id, nm)}</div><div><b>${esc(nm)}</b><small>✦ فرصة عمل · ${fmtTime(m.created_at)}</small></div>${taken ? '<span class="job-taken-badge">✓ تم الاستلام</span>' : ""}</div>
    <div class="job-desc">${linkify(m.text || "")}</div>
    ${meta.price ? `<span class="job-price">💰 ${esc(meta.price)}</span>` : ""}
    <div class="job-actions">
      ${ch ? `<a class="job-btn" href="${esc(ch)}" target="_blank" rel="noopener">معرض الأعمال</a>` : ""}
      ${taken
        ? '<span class="job-btn done" aria-disabled="true">✓ تم استلام العمل</span>'
        : (ct ? `<a class="job-btn primary" href="${esc(ct)}" target="_blank" rel="noopener">📞 تواصل مباشر</a>` : "")}
      ${canManage ? `<button class="job-take" type="button" data-take="${taken ? 0 : 1}">${taken ? "إلغاء الاستلام" : "تحديد: تم الاستلام"}</button>` : ""}
    </div></div>`;
}
function applyChannelUI() {
  const isJobs = CURCHAN === "jobs";
  const cf = $("commForm"), jf = $("jobForm");
  if (cf) cf.hidden = isJobs;
  if (jf) jf.hidden = !isJobs;
  const inp = $("commInput");
  if (inp) inp.placeholder = CURCHAN === "achievements" ? "اكتب إنجازك وأرفق عملك… 🏆" : "اكتب رسالتك…";
}
async function loadMessages(forceScroll) {
  const box = $("commMessages"); if (!box) return;
  let data;
  try { data = await dbGet(`community_messages?select=*&channel=eq.${CURCHAN}&order=created_at.asc&limit=200`); }
  catch (e) { box.innerHTML = `<p class="comm-empty">تعذّر التحميل:<br>${esc(e.message)}</p>`; return; }
  MSGS = data || [];
  if (commSearch && !forceScroll) return;                  // أثناء البحث: حدّث البيانات بصمت بدون إزعاج
  if (forceScroll || rChan !== CURCHAN) { renderMessages(forceScroll); return; }  // تبديل قناة / أول تحميل
  const curIds = new Set(MSGS.map((m) => m.id));
  for (const id of renderedIds) { if (!curIds.has(id)) { renderMessages(false); return; } }  // حُذفت رسالة → رسم كامل
  const newMsgs = MSGS.filter((m) => !renderedIds.has(m.id));
  if (newMsgs.length) { appendNew(newMsgs); return; }      // رسائل جديدة فقط → إضافة سلسة
  // لا جديد ولا حذف → افحص التفاعلات/الاستلام (تحديث حيّ بدون قفز التمرير)
  if (dynSig() !== lastDynSig) { const st = box.scrollTop; renderMessages(false); box.scrollTop = st; }
}
function updateScrollBtn() {
  const box = $("commMessages"), btn = $("commScrollBtn"); if (!box || !btn) return;
  const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 90;
  btn.hidden = atBottom;
}
(function () {
  const box = $("commMessages"), btn = $("commScrollBtn"); if (!box || !btn) return;
  box.addEventListener("scroll", updateScrollBtn);
  btn.addEventListener("click", () => { box.scrollTop = box.scrollHeight; updateScrollBtn(); });
})();
function startCommPoll() { stopCommPoll(); commTimer = setInterval(() => loadMessages(false), 4000); }
// أوقف التحديث الدوري لما المستخدم يغادر التبويب، وارجّعه لما يرجع (يوفّر طلبات ويسرّع)
document.addEventListener("visibilitychange", () => {
  const onComm = document.querySelector(".nav-tab.on")?.dataset.view === "community";
  if (document.hidden) stopCommPoll();
  else if (onComm && appView && !appView.hidden) { loadMessages(false); startCommPoll(); }
});
function stopCommPoll() { if (commTimer) { clearInterval(commTimer); commTimer = null; } }

function restoreView() {
  let sc = null, v = null;
  try { sc = localStorage.getItem("thameen_chan"); v = localStorage.getItem("thameen_view"); } catch (_) {}
  if (sc && CHAN_INFO[sc]) {
    CURCHAN = sc;
    document.querySelectorAll("#commChannels .chan").forEach((x) => x.classList.toggle("on", x.dataset.ch === sc));
    const info = CHAN_INFO[sc];
    if ($("chanTitle")) $("chanTitle").textContent = info.t;
    if ($("chanDesc")) $("chanDesc").textContent = info.d;
    applyChannelUI();
  }
  if (v && v !== "courses") switchView(v);
}
// ===== شارة رسائل المجتمع الجديدة =====
let CURVIEW = "courses";
function setCommBadge(n) {
  const b = $("commTabBadge"); if (!b) return;
  if (n > 0) { b.textContent = n > 50 ? "٥٠+" : toAr(n); b.hidden = false; }
  else b.hidden = true;
}
function markCommSeen() { try { localStorage.setItem("thameen_comm_seen", new Date().toISOString()); } catch (_) {} setCommBadge(0); }
async function checkCommUnread() {
  let seen = null; try { seen = localStorage.getItem("thameen_comm_seen"); } catch (_) {}
  if (!seen) { markCommSeen(); return; }
  try {
    const rows = await dbGet(`community_messages?select=user_id&created_at=gt.${encodeURIComponent(seen)}&limit=80`);
    const n = (rows || []).filter((r) => r.user_id !== (USER && USER.id)).length;   // لا تحسب رسائلي
    setCommBadge(n);
  } catch (_) {}
}

function switchView(view) {
  const prev = CURVIEW; CURVIEW = view;
  try { localStorage.setItem("thameen_view", view); } catch (_) {}
  document.querySelectorAll(".nav-tab").forEach((t) => t.classList.toggle("on", t.dataset.view === view));
  const vc = $("viewCourses"), vm = $("viewCommunity"), va = $("viewAccount"), vcl = $("viewCalls");
  if (vc) vc.hidden = view !== "courses";
  if (vm) vm.hidden = view !== "community";
  if (va) va.hidden = view !== "account";
  if (vcl) vcl.hidden = view !== "calls";
  if (view === "community") { markCommSeen(); registerProfile(); loadMembers(); loadMessages(true); startCommPoll(); } else stopCommPoll();
  if (prev === "community" && view !== "community") markCommSeen();   // علّم مقروء عند الخروج
  if (view === "account") loadAccount();
  if (view === "calls") loadCalls(); else stopCalls();   // أوقف عدّاد المكالمة لو طلع من الصفحة
}
document.querySelectorAll(".nav-tab").forEach((t) => t.addEventListener("click", () => switchView(t.dataset.view)));
// فحص دوري للرسائل الجديدة (لما المستخدم مو داخل المجتمع)
setInterval(() => { if (USER && appView && !appView.hidden && CURVIEW !== "community") checkCommUnread(); }, 25000);

// القنوات
document.querySelectorAll("#commChannels .chan").forEach((c) => c.addEventListener("click", () => {
  CURCHAN = c.dataset.ch;
  try { localStorage.setItem("thameen_chan", CURCHAN); } catch (_) {}
  document.querySelectorAll("#commChannels .chan").forEach((x) => x.classList.toggle("on", x === c));
  const info = CHAN_INFO[CURCHAN]; $("chanTitle").textContent = info.t; $("chanDesc").textContent = info.d;
  commSearch = ""; if ($("commSearch")) $("commSearch").value = "";
  applyChannelUI();
  loadMessages(true);
}));

// البحث
(function () { const s = $("commSearch"); if (s) s.addEventListener("input", (e) => { commSearch = e.target.value.trim(); renderMessages(false); }); })();

// نشر فرصة عمل
(function () {
  const f = $("jobForm"); if (!f) return;
  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const desc = $("jobDesc").value.trim();
    if (!desc) { alert("اكتب وصف العمل / الفرصة أولاً."); return; }
    const meta = { channel: $("jobChannel").value.trim() || null, price: $("jobPrice").value.trim() || null, contact: $("jobContact").value.trim() || null };
    const btn = $("jobSend"); btn.disabled = true;
    try {
      await dbSend("POST", "community_messages", { user_id: USER.id, name: myName(), text: desc, channel: "jobs", meta }, "return=minimal");
      $("jobDesc").value = ""; $("jobChannel").value = ""; $("jobPrice").value = ""; $("jobContact").value = "";
      await loadMessages(true);
    } catch (err) { alert("خطأ: " + err.message); }
    btn.disabled = false;
  });
})();

// الإيموجي
(function () {
  const p = $("emojiPanel"); if (!p) return;
  p.innerHTML = EMOJIS.map((e) => `<button type="button">${e}</button>`).join("");
  p.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => { const inp = $("commInput"); inp.value += b.textContent; inp.focus(); }));
  const eb = $("emojiBtn"); if (eb) eb.addEventListener("click", () => { p.hidden = !p.hidden; });
})();

// الإرفاق
(function () {
  const ab = $("attachBtn"), fi = $("commFile"); if (!ab || !fi) return;
  ab.addEventListener("click", () => fi.click());
  fi.addEventListener("change", (e) => {
    const f = e.target.files[0]; if (!f) return;
    const MAX = 45 * 1024 * 1024; // ٤٥ م.ب (حد Supabase المجاني)
    if (f.size > MAX) {
      alert(`الملف كبير (${(f.size / 1048576).toFixed(0)} م.ب).\nالحد الأقصى ٤٥ م.ب.\n\nللفيديوهات الكبيرة: ارفعها على يوتيوب/درايف والصق الرابط كرسالة.`);
      fi.value = ""; return;
    }
    pendingFile = f; showPending(f);
  });
})();
function showPending(f) {
  const pv = $("filePreview"); if (!pv) return;
  pv.hidden = false;
  const url = URL.createObjectURL(f);
  pv.innerHTML = `${f.type.startsWith("video") ? `<video src="${url}" muted></video>` : `<img src="${url}">`}<span class="fp-name">${esc(f.name)}</span><button type="button" class="fp-x">✕</button>`;
  pv.querySelector(".fp-x").addEventListener("click", clearPending);
}
function clearPending() { pendingFile = null; const pv = $("filePreview"); if (pv) { pv.hidden = true; pv.innerHTML = ""; } const fi = $("commFile"); if (fi) fi.value = ""; }

// الإرسال
(function wireCommForm() {
  const f = $("commForm"); if (!f) return;
  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const inp = $("commInput"), btn = $("commSend");
    const t = inp.value.trim();
    if (!t && !pendingFile) return;
    btn.disabled = true;
    const ep = $("emojiPanel"); if (ep) ep.hidden = true;
    try {
      let media_url = null, media_type = null;
      if (pendingFile) {
        btn.textContent = "جارٍ الرفع…";
        media_url = await uploadCommFile(pendingFile);
        media_type = pendingFile.type.startsWith("video") ? "video" : "image";
      }
      await dbSend("POST", "community_messages", { user_id: USER.id, name: myName(), text: t || null, channel: CURCHAN, media_url, media_type, reply_to: replyTo || null }, "return=minimal");
      const hasAll = pendingMentions.some((p) => p.id === "all") && t.includes("@الكل");
      const targets = [...new Set(pendingMentions.filter((p) => p.id !== "all" && t.includes("@" + p.name)).map((p) => p.id))];
      if (hasAll) rpc("notify_all", { p_text: t });                          // إشعار للجميع
      else if (targets.length) rpc("notify_mention", { p_targets: targets, p_text: t });   // إشعار للمذكورين
      pendingMentions = [];
      inp.value = ""; clearPending(); cancelReply();
      await loadMessages(true);
    } catch (err) { alert("خطأ: " + err.message); }
    btn.disabled = false; btn.textContent = "إرسال"; inp.focus();
  });
})();

// ====== نوافذ بأنميشن سموث (فتح/إغلاق) ======
function openM(modal) { if (!modal) return; modal.classList.remove("closing"); modal.hidden = false; void modal.offsetWidth; modal.classList.add("show"); }
function closeM(modal, cb) { if (!modal) return; modal.classList.remove("show"); modal.classList.add("closing"); setTimeout(() => { modal.hidden = true; modal.classList.remove("closing"); if (cb) cb(); }, 430); }
function maybeShowChannels() {
  let joined = null; try { joined = localStorage.getItem("thameen_channels_joined"); } catch (_) {}
  if (!joined) openM($("channelsModal"));
}

// ====== نافذة الترحيب والإرشادات (تظهر مرة + بالقائمة) ======
let welcomeOnb = false;
(function () {
  const modal = $("welcomeModal"); if (!modal) return;
  const after = () => { const wasOnb = welcomeOnb; welcomeOnb = false; if (wasOnb) maybeShowChannels(); };
  const dismiss = () => { try { localStorage.setItem("thameen_welcome_hidden", "1"); } catch (_) {} closeM(modal, after); };
  const x = $("welcomeX"); if (x) x.addEventListener("click", dismiss);
  const ok = $("welcomeOk"); if (ok) ok.addEventListener("click", dismiss);
  const sk = $("welcomeSkip"); if (sk) sk.addEventListener("click", dismiss);
  const wb = $("welcomeBtn"); if (wb) wb.addEventListener("click", () => { welcomeOnb = false; openM(modal); });
  modal.addEventListener("click", (e) => { if (e.target === modal) dismiss(); });
})();

// ====== نافذة رسائلي (التقدّم + الرسائل التحفيزية) ======
(function () {
  const modal = $("guideModal"); if (!modal) return;
  const close = () => closeM(modal, markInboxSeen);   // علّم الرسائل مقروءة عند الإغلاق
  const x = $("guideX"); if (x) x.addEventListener("click", close);
  const ok = $("guideOk"); if (ok) ok.addEventListener("click", close);
  const gb = $("guideBtn"); if (gb) gb.addEventListener("click", () => { renderInbox(false); openM(modal); });   // كل الرسائل للتصفّح
  modal.addEventListener("click", (e) => { if (e.target === modal) close(); });
})();

// ====== القنوات والتحديثات ======
const CHANNELS = [
  { group: "قنوات البريمير (المونتاج)", links: [
    { label: "تليجرام — الشروحات والشات العام", url: "https://t.me/+KLKOJdJxgNdlMTk8", type: "tg" },
    { label: "تليجرام — شات الملفات", url: "https://t.me/+shlLzDzF7w8wMTlk", type: "tg" },
    { label: "واتساب — الأعمال والمهم", url: "https://chat.whatsapp.com/J1i4vsDFb6I8LtbyOfXBa9", type: "wa" },
  ] },
  { group: "قناة الثري دي (3D)", links: [
    { label: "تليجرام — الملفات والشروحات والشات", url: "https://t.me/+x4w8xiMjg3dmNTBk", type: "tg" },
    { label: "واتساب — الأعمال والمهم", url: "https://chat.whatsapp.com/Flc5nwuQdbF0O7hHsQBbEH", type: "wa" },
  ] },
];
function channelsHtml() {
  const tg = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.9 4.3 18.7 19.4c-.2 1-.9 1.3-1.7.8l-4.7-3.5-2.3 2.2c-.3.3-.5.5-1 .5l.3-4.9 8.9-8c.4-.3-.1-.5-.6-.2L6.7 13.2l-4.7-1.5c-1-.3-1-1 .2-1.5L20.6 3c.8-.3 1.5.2 1.3 1.3z"/></svg>';
  const wa = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.5 15.3L2 22l4.8-1.4A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-2.9.8.8-2.8-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.4-.7-1.7-.8-.2-.1-.4-.1-.5.1l-.7.9c-.1.1-.3.2-.5.1-.7-.3-1.5-.6-2.1-1.4-.2-.3.2-.3.5-1 .1-.1 0-.3 0-.4l-.7-1.7c-.2-.5-.4-.4-.5-.4h-.5c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 1.9s.8 2.2.9 2.4c.1.1 1.6 2.5 4 3.4 1.4.6 2 .6 2.7.5.4-.1 1.4-.6 1.6-1.1.2-.6.2-1 .1-1.1z"/></svg>';
  return CHANNELS.map((g) =>
    `<div class="ch-group"><h4 class="ch-group-h">${esc(g.group)}</h4>` +
    g.links.map((l) => `<a class="ch-link ${l.type}" href="${l.url}" target="_blank" rel="noopener"><span class="ch-ic">${l.type === "tg" ? tg : wa}</span><span class="ch-label">${esc(l.label)}</span></a>`).join("") +
    `</div>`).join("");
}
(function () {
  const list = $("channelsList"); if (list) list.innerHTML = channelsHtml();
  const modal = $("channelsModal"); if (!modal) return;
  const close = () => closeM(modal);
  const x = $("channelsX"); if (x) x.addEventListener("click", close);
  const cb = $("channelsBtn"); if (cb) cb.addEventListener("click", () => openM(modal));
  const joined = $("channelsJoined"); if (joined) joined.addEventListener("click", () => { try { localStorage.setItem("thameen_channels_joined", "1"); } catch (_) {} close(); });
  const later = $("channelsLater"); if (later) later.addEventListener("click", close);
  modal.addEventListener("click", (e) => { if (e.target === modal) close(); });
})();
// أول دخول: الترحيب أولاً، وبعد إغلاقه تظهر القنوات تلقائيًا
function showOnboarding() {
  let welcomeHidden = null, chJoined = null;
  try { welcomeHidden = localStorage.getItem("thameen_welcome_hidden"); chJoined = localStorage.getItem("thameen_channels_joined"); } catch (_) {}
  updateInboxBadge();   // نقطة «جديد» على البروفايل لو فيه رسالة ما انقرت
  if (!welcomeHidden) { welcomeOnb = true; openM($("welcomeModal")); }   // أول دخول: الترحيب والإرشادات (مرة)
  else if (hasNewInbox()) { renderInbox(true); openM($("guideModal")); }   // رسالة جديدة → الجديد فقط (مرة وحدة)
  else if (!chJoined) { openM($("channelsModal")); }
}

// ====== حسابي ======
function addMonths(d, n) { const x = new Date(d.getTime()); const day = x.getDate(); x.setMonth(x.getMonth() + n); if (x.getDate() < day) x.setDate(0); return x; }
function fmtDate(d) {
  const months = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

async function loadAccount() {
  await loadAvatars();
  const name = myName();
  const av = $("accAvatar");
  if (av) {
    const myUrl = AVATARS[USER && USER.id];
    if (myUrl) { av.style.background = ""; av.innerHTML = `<img src="${esc(myUrl)}" alt="" class="av-img">`; }
    else { av.textContent = initialOf(name); av.style.background = avColor((USER && USER.id) || name); }
  }
  $("accName").textContent = name;
  $("accEmail").textContent = (USER && USER.email) || "";

  // تاريخ الاشتراك
  const subRaw = (MEMBER && MEMBER.created_at) || (USER && USER.created_at) || null;
  const sub = subRaw ? new Date(subRaw) : null;
  $("accSince").textContent = sub ? "مشترك منذ " + fmtDate(sub) : "";

  // التقدّم العام
  const total = LESSONS.length, done = DONE.size;
  const pct = total ? Math.round((done / total) * 100) : 0;
  $("accPct").textContent = pct + "%";
  $("accDone").textContent = done;
  $("accTotal").textContent = total;
  const ring = $("accRing");
  if (ring) ring.style.background = `conic-gradient(#5BB8E8 ${pct * 3.6}deg, rgba(255,255,255,.1) 0deg)`;

  // تفصيل الدورات
  $("accCourses").innerHTML = SECTIONS.map((sec) => {
    const ls = LESSONS.filter((l) => l.section_id === sec.id);
    const d = ls.filter((l) => DONE.has(l.id)).length;
    const p = ls.length ? Math.round((d / ls.length) * 100) : 0;
    return `<div class="acc-crow"><span class="acc-cname">${esc(sec.title)}</span>
      <div class="acc-cbar"><span style="width:${p}%"></span></div>
      <span class="acc-cpct">${d}/${ls.length}</span></div>`;
  }).join("") || '<p class="hint">لا دورات بعد.</p>';

  // المكالمات الشهرية — الموعد يُنسّق مع الإدارة (مو تلقائي)
  const callsTotal = (MEMBER && MEMBER.calls_total) || 3;
  const callsUsed = (MEMBER && MEMBER.calls_used) || 0;
  const ord = ["الأولى", "الثانية", "الثالثة", "الرابعة", "الخامسة", "السادسة"];
  let calls = "";
  for (let i = 0; i < callsTotal; i++) {
    const done = i < callsUsed;
    calls += `<div class="acc-call ${done ? "used" : "ready"}">
      <div class="acc-call-n">${toAr(i + 1)}</div>
      <div class="acc-call-body"><b>المكالمة ${ord[i] || i + 1}</b><small>${done ? "تمّت بنجاح" : "يُنسّق موعدها معك"}</small></div>
      <span class="acc-call-tag">${done ? "تمّت ✓" : "متبقّية"}</span></div>`;
  }
  const nextAt = MEMBER && MEMBER.call_at;
  let nextHtml = "";
  if (nextAt && new Date(nextAt).getTime() > Date.now() - 3 * 3600000) {
    nextHtml = `<div class="acc-next-call"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="16" rx="2.5"/><path d="M3 9h18M8 2.5v4M16 2.5v4"/></svg> موعد مكالمتك القادمة: <b>${fmtCallDateTime(nextAt)}</b></div>`;
  }
  $("accCalls").innerHTML = nextHtml + calls;

  // شارات الإنجاز
  const fullCourses = SECTIONS.filter((s) => { const ls = LESSONS.filter((l) => l.section_id === s.id); return ls.length && ls.every((l) => DONE.has(l.id)); }).length;
  const badges = [];
  if (done >= 1) badges.push("🎬 أول درس");
  if (done >= 5) badges.push("⚡ ٥ دروس");
  if (done >= 10) badges.push("🔥 ١٠ دروس");
  if (fullCourses >= 1) badges.push("🏅 أكملت دورة");
  if (pct === 100 && total) badges.push("👑 أكملت كل الدورات");
  $("accBadges").innerHTML = badges.length ? badges.map((b) => `<span class="acc-badge">${b}</span>`).join("") : '<p class="hint">ابدأ بمشاهدة الدروس لتفتح إنجازاتك 🚀</p>';

  // إنجازاتي المنشورة بالمجتمع
  try {
    const posts = await dbGet(`community_messages?select=text,created_at,media_url&channel=eq.achievements&user_id=eq.${USER.id}&order=created_at.desc&limit=20`);
    $("accAchPosts").innerHTML = (posts && posts.length)
      ? `<h4 class="acc-sub">إنجازاتك المنشورة (${posts.length})</h4>` + posts.map((p) => `<div class="acc-post">${p.media_url ? "📎 " : "🏆 "}${esc((p.text || "مرفق").slice(0, 90))}<small>${fmtDate(new Date(p.created_at))}</small></div>`).join("")
      : "";
  } catch (_) { $("accAchPosts").innerHTML = ""; }
}

// تغيير كلمة السر
(function () {
  const btn = $("accPassBtn"); if (!btn) return;
  btn.addEventListener("click", async () => {
    const p1 = $("accPass1").value, p2 = $("accPass2").value, msg = $("accPassMsg");
    if (p1.length < 6) { setMsg(msg, "كلمة السر قصيرة — ٦ أحرف على الأقل.", false); return; }
    if (p1 !== p2) { setMsg(msg, "الكلمتان غير متطابقتين.", false); return; }
    btn.disabled = true; setMsg(msg, "جارٍ الحفظ…", true);
    try {
      const r = await fetchT(`${SUPABASE_URL}/auth/v1/user`, {
        method: "PUT", headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ password: p1 }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.msg || d.error_description || d.error || "تعذّر الحفظ");
      setMsg(msg, "تم تغيير كلمة السر ✅", true);
      $("accPass1").value = ""; $("accPass2").value = "";
    } catch (e) { setMsg(msg, "خطأ: " + e.message, false); }
    btn.disabled = false;
  });
})();

// تغيير صورة البروفايل
(function () {
  const btn = $("accAvBtn"), fi = $("accAvFile"); if (!btn || !fi) return;
  btn.addEventListener("click", () => fi.click());
  fi.addEventListener("change", async (e) => {
    const f = e.target.files[0]; if (!f) return;
    const msg = $("accAvMsg");
    if (!f.type.startsWith("image")) { setMsg(msg, "اختر صورة فقط.", false); fi.value = ""; return; }
    if (f.size > 5 * 1024 * 1024) { setMsg(msg, "الصورة كبيرة — الحد ٥ م.ب.", false); fi.value = ""; return; }
    setMsg(msg, "جارٍ رفع الصورة…", true);
    try {
      const url = await uploadCommFile(f);
      await dbSend("POST", "profiles?on_conflict=user_id",
        { user_id: USER.id, name: myName(), avatar_url: url }, "resolution=merge-duplicates,return=minimal");
      AVATARS[USER.id] = url;
      const av = $("accAvatar"); if (av) { av.style.background = ""; av.innerHTML = `<img src="${esc(url)}" alt="" class="av-img">`; }
      setNavProfile();   // حدّث أفتار القائمة فورًا
      setMsg(msg, "تم تحديث صورتك ✅", true);
    } catch (err) {
      const m = String(err.message || err);
      setMsg(msg, /avatar_url/.test(m) ? "لازم تضيف عمود avatar_url بقاعدة البيانات أول (راجع الخطوة)." : "خطأ: " + m, false);
    }
    fi.value = "";
  });
})();

// ====== المكالمة الجماعية الشهرية (Jitsi مجاني) ======
const GROUP_ROOM = "thameenAcademyGroupCall2026";
let callTimer = null, GROUP_AT = null, GROUP_DUR = 75, GROUP_CALLS = [], _doneSig = "";

function fmtDateTime(d) { let h = d.getHours(); const ap = h < 12 ? "ص" : "م"; h = h % 12 || 12; return `${fmtDate(d)} · ${h}:${String(d.getMinutes()).padStart(2, "0")} ${ap}`; }
function arDigits(s) { return String(s).replace(/[0-9]/g, (d) => "٠١٢٣٤٥٦٧٨٩"[d]); }
function fmtCountdown(ms) {
  const s = Math.floor(ms / 1000), days = Math.floor(s / 86400), hrs = Math.floor((s % 86400) / 3600), mins = Math.floor((s % 3600) / 60);
  if (days > 0) return `${toAr(days)} يوم و${toAr(hrs)} ساعة`;
  if (hrs > 0) return `${toAr(hrs)} ساعة و${toAr(mins)} دقيقة`;
  return `${toAr(Math.max(1, mins))} دقيقة`;
}
function fmtClock(ms) {
  ms = Math.max(0, ms);
  const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60, p = (n) => String(n).padStart(2, "0");
  return arDigits(h > 0 ? `${p(h)}:${p(m)}:${p(sec)}` : `${p(m)}:${p(sec)}`);
}
// تذكير متجدّد حسب الوقت المتبقّي — يحثّه يجهّز أسئلته
function callReminder(diff) {
  const days = Math.floor(diff / 86400000), hrs = Math.floor(diff / 3600000);
  if (days >= 14) return `تبقّى ${toAr(days)} يوم على المكالمة — عندك وقت كافي، ابدأ من الحين تجمّع كل سؤال أو نقطة تحتاج تسأل عنها بصندوق التجهيز تحت 👇`;
  if (days >= 7) return `باقي ${toAr(days)} يوم — راجع شغلك وحدّد النقاط اللي تبي رأينا فيها، وسجّلها بالأسئلة تحت.`;
  if (days >= 2) return `باقي ${toAr(days)} يوم فقط! تأكّد إن كل أسئلتك مكتوبة بصندوق التجهيز عشان تستغل المكالمة كاملة.`;
  if (hrs >= 12) return "بكرة المكالمة! راجع قائمة أسئلتك الآن وكمّل أي نقطة ناقصة.";
  if (hrs >= 1) return `المكالمة اليوم — باقي ${toAr(hrs)} ساعة! جهّز نفسك وراجع قائمة أسئلتك.`;
  return "المكالمة قريبة جدًا — جهّز نفسك وخلّي أسئلتك جنبك!";
}
function renderGroupCall() {
  const whenEl = $("groupWhen"), cdEl = $("groupCountdown"), remEl = $("groupReminder"), btn = $("joinGroupCall");
  if (!whenEl) return;
  if (!GROUP_AT || isNaN(GROUP_AT.getTime())) {
    whenEl.textContent = "لم يُحدّد موعد بعد";
    cdEl.hidden = true; remEl.textContent = "بنعلمك أول ما يتحدّد موعد المكالمة الجاية.";
    if (btn) btn.disabled = true;
    return;
  }
  whenEl.textContent = fmtDateTime(GROUP_AT);
  const now = Date.now(), start = GROUP_AT.getTime(), end = start + GROUP_DUR * 60000;
  const toStart = start - now, toEnd = end - now;
  cdEl.hidden = false;
  if (now < start - 10 * 60000) {            // قبل الموعد بأكثر من ١٠ دقائق
    if (btn) btn.disabled = true;
    cdEl.innerHTML = "باقي على المكالمة<br><b>" + fmtCountdown(toStart) + "</b>";
    remEl.textContent = callReminder(toStart);
  } else if (now < start) {                  // آخر ١٠ دقائق قبل البداية
    if (btn) btn.disabled = false;
    cdEl.innerHTML = "تبدأ بعد<br><b>" + fmtClock(toStart) + "</b>";
    remEl.textContent = "المكالمة على وشك تبدأ — جهّز نفسك واضغط «انضم».";
  } else if (now < end) {                    // المكالمة جارية — عدّاد لانتهائها
    if (btn) btn.disabled = false;
    cdEl.innerHTML = '<b class="cd-live">● جارية الآن</b><br>تنتهي بعد <b>' + fmtClock(toEnd) + "</b>";
    remEl.textContent = "اضغط «انضم» إذا لسة ما دخلت — المكالمة تنتهي تلقائيًا بعد انتهاء الوقت.";
  } else {                                   // انتهت
    if (btn) btn.disabled = true;
    cdEl.innerHTML = '<span class="cd-done">انتهت المكالمة ✓</span>';
    remEl.textContent = "ننتظر الموعد الجاي.";
  }
}
function renderCallsDone(list) {
  const el = $("callsDone"); if (!el) return;
  const sig = list.map((c) => c.at.getTime()).join(",");
  if (sig === _doneSig) return; _doneSig = sig;
  if (!list.length) { el.hidden = true; el.innerHTML = ""; return; }
  el.hidden = false;
  el.innerHTML = '<h4 class="cdone-title">المكالمات المكتملة</h4>' + list.map((c) =>
    `<div class="cdone-item"><span class="cdone-ic">✓</span><div class="cdone-body"><b>المكالمة الشهرية</b><small>${fmtDate(c.at)}</small></div><span class="cdone-tag">اكتملت</span></div>`
  ).join("");
}
function tickCalls() {
  const now = Date.now();
  const active = GROUP_CALLS.filter((c) => now < c.at.getTime() + c.dur * 60000).sort((a, b) => a.at - b.at)[0] || null;
  GROUP_AT = active ? active.at : null; GROUP_DUR = active ? active.dur : 75;
  renderGroupCall();
  renderCallsDone(GROUP_CALLS.filter((c) => now >= c.at.getTime() + c.dur * 60000).sort((a, b) => b.at - a.at));
}
async function loadCalls() {
  try { const r = await dbGet("group_calls?select=call_at,duration_min&order=call_at.asc"); GROUP_CALLS = (r || []).map((x) => ({ at: new Date(x.call_at), dur: x.duration_min || 75 })).filter((c) => !isNaN(c.at.getTime())); } catch (_) { GROUP_CALLS = []; }
  _doneSig = ""; tickCalls();
  if (callTimer) clearInterval(callTimer);
  callTimer = setInterval(tickCalls, 1000);
  loadQuestions();
}
function stopCalls() { if (callTimer) { clearInterval(callTimer); callTimer = null; } }
// تسجيل حضور مكالمة تلقائيًا (مرة وحدة باليوم، وبس إذا متاح)
async function attendCall() {
  try {
    await fetchT(`${SUPABASE_URL}/rest/v1/rpc/attend_call`, { method: "POST", headers: authHeaders({ "Content-Type": "application/json" }), body: "{}" }, 12000);
  } catch (_) {}
}
// تفتح بنافذة جديدة (بدون حد ٥ دقائق، مجاني تمامًا)
function startCall(room) {
  const url = "https://meet.jit.si/" + room + "#userInfo.displayName=" + encodeURIComponent('"' + myName() + '"') + "&config.prejoinPageEnabled=false";
  window.open(url, "_blank", "noopener");
}

// ====== مركز الإشعارات ======
let NOTIFS = [];
function notifSeenTs() { try { return parseInt(localStorage.getItem("thameen_notif_seen") || "0", 10); } catch (_) { return 0; } }
function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "الآن";
  const m = Math.floor(s / 60); if (m < 60) return `قبل ${toAr(m)} دقيقة`;
  const h = Math.floor(m / 60); if (h < 24) return `قبل ${toAr(h)} ساعة`;
  return `قبل ${toAr(Math.floor(h / 24))} يوم`;
}
// صوت إشعار لطيف (Web Audio — بدون ملف)
let _actx = null, notifNewest = 0, notifTimer = null;
function audioCtx() { try { if (!_actx) _actx = new (window.AudioContext || window.webkitAudioContext)(); if (_actx.state === "suspended") _actx.resume(); return _actx; } catch (_) { return null; } }
function playBeep() {
  const ctx = audioCtx(); if (!ctx) return;
  const now = ctx.currentTime;
  [[880, 0], [1320, 0.13]].forEach(([f, t]) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "sine"; o.frequency.value = f; o.connect(g); g.connect(ctx.destination);
    g.gain.setValueAtTime(0.0001, now + t);
    g.gain.exponentialRampToValueAtTime(0.16, now + t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.2);
    o.start(now + t); o.stop(now + t + 0.22);
  });
}
// فك قفل الصوت — يُستأنف مع كل تفاعل (iOS يعلّق سياق الصوت عند الخلفية، فلا يكفي مرة وحدة)
["pointerdown", "touchstart", "keydown"].forEach((ev) =>
  document.addEventListener(ev, () => audioCtx(), { passive: true }));
async function loadNotifs() {
  let all = [];
  try { all = await dbGet("notifications?select=id,title,body,kind,created_at,target_user&order=created_at.desc&limit=40"); }
  catch (_) { try { all = await dbGet("notifications?select=id,title,body,kind,created_at&order=created_at.desc&limit=30"); } catch (_) { all = []; } }
  const me = USER && USER.id;
  const joined = (MEMBER && MEMBER.created_at) || (USER && USER.created_at);
  const joinTs = joined ? new Date(joined).getTime() - 60000 : 0;   // قبل الاشتراك بدقيقة (هامش)
  // عام أو موجّه لي + بعد تاريخ اشتراكي فقط (الحساب الجديد يبدأ فريش بلا إشعارات قديمة)
  NOTIFS = (all || []).filter((n) => (!n.target_user || n.target_user === me) && new Date(n.created_at).getTime() >= joinTs).slice(0, 30);
  const newest = NOTIFS.length ? Math.max.apply(null, NOTIFS.map((n) => new Date(n.created_at).getTime())) : 0;
  if (notifNewest && newest > notifNewest && newest > notifSeenTs()) playBeep();   // إشعار جديد فعلاً → صوت
  notifNewest = Math.max(notifNewest, newest);
  renderNotifs();
}
function startNotifPoll() { if (notifTimer) return; notifTimer = setInterval(() => { loadNotifs(); checkCallReminders(); }, 10000); }
// رجوع المستخدم للصفحة/التبويب → حدّث الإشعارات فورًا (المؤقّت يتوقف بالخلفية) + استأنف الصوت
function refreshNotifsOnReturn() { if (USER && appView && !appView.hidden) { audioCtx(); loadNotifs(); checkCallReminders(); } }
document.addEventListener("visibilitychange", () => { if (!document.hidden) refreshNotifsOnReturn(); });
window.addEventListener("focus", refreshNotifsOnReturn);
// تذكير المكالمة التلقائي حسب موعدها (call_at): ٣ أيام / يوم / اليوم / ساعات — كل مرحلة مرة وحدة
function fmtCallDateTime(iso) { try { return new Date(iso).toLocaleString("ar", { dateStyle: "full", timeStyle: "short" }); } catch (_) { return ""; } }
async function checkCallReminders() {
  const at = MEMBER && MEMBER.call_at; if (!at) return;
  const t = new Date(at).getTime(), now = Date.now(); const hrs = (t - now) / 3600000;
  if (hrs < -3) return;                       // فاتت المكالمة
  const key = "thameen_callrem_" + at; let done = {};
  try { done = JSON.parse(localStorage.getItem(key) || "{}"); } catch (_) {}
  const when = fmtCallDateTime(at);
  let ms = null, title = null, body = null;
  if (hrs <= 3 && !done.h) { ms = "h"; title = "مكالمتك بعد ساعات قليلة ⏰"; body = "موعدك " + when + " — جهّز أسئلتك وكن جاهزًا."; }
  else if (hrs <= 24 && hrs > 3 && !done.d0) { ms = "d0"; title = "مكالمتك اليوم 📞"; body = "موعد مكالمتك اليوم: " + when + "."; }
  else if (hrs <= 48 && hrs > 24 && !done.d1) { ms = "d1"; title = "بكرة موعد مكالمتك 📞"; body = "تذكير: مكالمتك " + when + "."; }
  else if (hrs <= 72 && hrs > 48 && !done.d3) { ms = "d3"; title = "بعد ٣ أيام: مكالمتك القادمة"; body = "موعد مكالمتك " + when + " — لا تنساها."; }
  if (!ms) return;
  done[ms] = 1; try { localStorage.setItem(key, JSON.stringify(done)); } catch (_) {}
  try { await rpc("add_self_notif", { p_title: title, p_body: body }); } catch (_) {}
  playBeep(); loadNotifs();
}
const NOTIF_ICONS = {
  call: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/></svg>',
  video: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M10 9.2l5 2.8-5 2.8z"/></svg>',
  general: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>',
};
NOTIF_ICONS.mention = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M16 8v5a2.5 2.5 0 0 0 5 0v-1a9 9 0 1 0-3.5 7.1"/></svg>';
function notifIcon(kind) {
  if (kind === "call") return { cls: "ni-call", svg: NOTIF_ICONS.call };
  if (kind === "video") return { cls: "ni-video", svg: NOTIF_ICONS.video };
  if (kind === "mention") return { cls: "ni-gen", svg: NOTIF_ICONS.mention };
  return { cls: "ni-gen", svg: NOTIF_ICONS.general };
}
// إكمال المنشن @ في صندوق الكتابة
(function () {
  const inp = $("commInput"), list = $("mentionList"); if (!inp || !list) return;
  const close = () => { list.hidden = true; list.innerHTML = ""; };
  inp.addEventListener("input", () => {
    const pos = inp.selectionStart || inp.value.length;
    const before = inp.value.slice(0, pos);
    const at = before.match(/@([^\s@]{0,20})$/);
    if (!at || !MEMBERS.length) { close(); return; }
    const q = at[1].toLowerCase();
    const allOpt = ("الكل".includes(at[1]) || at[1] === "") ? [{ id: "all", name: "الكل", all: true }] : [];
    const matches = allOpt.concat(MEMBERS.filter((mem) => mem.name.toLowerCase().includes(q))).slice(0, 6);
    if (!matches.length) { close(); return; }
    list.innerHTML = matches.map((mem) => mem.all
      ? `<button type="button" data-id="all" data-name="الكل"><span class="mention-av all">📣</span>الكل — إشعار للجميع</button>`
      : `<button type="button" data-id="${esc(mem.id)}" data-name="${esc(mem.name)}"><span class="mention-av" style="${avStyle(mem.id, mem.name)}">${avInner(mem.id, mem.name)}</span>${esc(mem.name)}</button>`).join("");
    list.hidden = false;
    list.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
      const name = b.dataset.name, id = b.dataset.id;
      const start = before.length - at[0].length;
      inp.value = inp.value.slice(0, start) + "@" + name + " " + inp.value.slice(pos);
      if (!pendingMentions.some((p) => p.id === id)) pendingMentions.push({ id, name });
      close(); inp.focus();
      const np = start + name.length + 2; try { inp.setSelectionRange(np, np); } catch (_) {}
    }));
  });
  inp.addEventListener("blur", () => setTimeout(close, 160));
})();
function renderNotifs() {
  const list = $("notifList"), badge = $("bellBadge"); if (!list) return;
  const seen = notifSeenTs(); let unread = 0;
  if (!NOTIFS || !NOTIFS.length) { list.innerHTML = '<p class="notif-empty">ما في إشعارات بعد.</p>'; }
  else {
    list.innerHTML = NOTIFS.map((n) => {
      const ts = new Date(n.created_at).getTime(), isNew = ts > seen; if (isNew) unread++;
      const ic = notifIcon(n.kind);
      return `<div class="notif-item ${isNew ? "unread" : ""}">
        <span class="notif-ic ${ic.cls}">${ic.svg}</span>
        <div class="notif-c"><b>${esc(n.title)}</b>${n.body ? `<p>${esc(n.body)}</p>` : ""}<small>${timeAgo(ts)}</small></div>
        ${isNew ? '<span class="notif-dot"></span>' : ""}
      </div>`;
    }).join("");
  }
  if (badge) { if (unread > 0) { badge.textContent = toAr(unread); badge.hidden = false; } else badge.hidden = true; }
}
function markNotifsSeen() {
  if (!NOTIFS || !NOTIFS.length) return;
  const newest = Math.max.apply(null, NOTIFS.map((n) => new Date(n.created_at).getTime()));
  try { localStorage.setItem("thameen_notif_seen", String(newest)); } catch (_) {}
  renderNotifs();
}
(function () {
  const bell = $("bellBtn"), panel = $("notifPanel");
  if (!bell || !panel) return;
  bell.addEventListener("click", (e) => { e.stopPropagation(); const opening = panel.hidden; panel.hidden = !opening; if (opening) markNotifsSeen(); });
  document.addEventListener("click", (e) => { if (!panel.hidden && !panel.contains(e.target) && !bell.contains(e.target)) panel.hidden = true; });
})();

// صندوق الأسئلة — تجهيز أسئلة المكالمة
async function loadQuestions() {
  const list = $("qList"); if (!list) return;
  let qs = [];
  try { qs = await dbGet(`call_questions?select=id,text&user_id=eq.${USER.id}&order=created_at.asc`); } catch (_) {}
  if (!qs || !qs.length) { list.innerHTML = '<p class="q-empty">ما عندك أسئلة بعد — اكتب أول سؤال فوق 👆</p>'; return; }
  list.innerHTML = qs.map((q, i) => `<div class="q-item"><span class="q-n">${toAr(i + 1)}</span><div class="q-body">${esc(q.text)}</div><button class="q-del" data-id="${q.id}" title="حذف">✕</button></div>`).join("");
  list.querySelectorAll(".q-del").forEach((b) => b.addEventListener("click", async () => {
    try { await dbSend("DELETE", `call_questions?id=eq.${b.dataset.id}`, null, "return=minimal"); loadQuestions(); } catch (_) {}
  }));
}
async function addQuestion() {
  const inp = $("qInput"); if (!inp) return;
  const t = inp.value.trim(); if (!t || !USER) return;
  inp.value = "";
  try { await dbSend("POST", "call_questions", { user_id: USER.id, text: t }, "return=minimal"); loadQuestions(); } catch (e) { alert("تعذّر الحفظ"); }
}
(function () {
  const gp = $("joinGroupCall"); if (gp) gp.addEventListener("click", () => { attendCall(); startCall(GROUP_ROOM); });
  const qa = $("qAddBtn"); if (qa) qa.addEventListener("click", addQuestion);
  const qi = $("qInput"); if (qi) qi.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); addQuestion(); } });
})();

// ===== Scroll Reveal Animations =====
(function () {
  const reveals = document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale');
  if (!reveals.length) return;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('visible'); }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
  reveals.forEach(el => observer.observe(el));
})();

// ===== AI Chatbot =====
(function () {
  const widget = document.getElementById('chatWidget');
  const toggle = document.getElementById('chatToggle');
  const box = document.getElementById('chatBox');
  const form = document.getElementById('chatForm');
  const input = document.getElementById('chatInput');
  const messagesEl = document.getElementById('chatMessages');

  if (!widget || !toggle || !box) return;

  let messages = [];
  let chatLoaded = false;

  // تحميل المحادثات السابقة
  async function loadChatHistory() {
    if (chatLoaded || !USER) return;
    try {
      const history = await dbGet(`chat_messages?select=role,content&user_id=eq.${USER.id}&order=created_at.desc&limit=20`);
      if (history && history.length) {
        messagesEl.innerHTML = '';
        history.reverse().forEach(m => {
          messages.push({ role: m.role, content: m.content });
          appendMessage(m.content, m.role === 'user' ? 'user' : 'bot', false);
        });
      }
      chatLoaded = true;
    } catch (e) { console.log('Chat history load failed:', e); }
  }

  // حفظ رسالة
  async function saveMessage(role, content) {
    if (!USER) return;
    const lessonId = window.CURLESSON || null;
    try {
      await dbSend('POST', 'chat_messages', { user_id: USER.id, role, content, lesson_id: lessonId }, 'return=minimal');
    } catch (e) { console.log('Save message failed:', e); }
  }

  // الحصول على سياق الدرس الحالي
  function getLessonContext() {
    if (!window.CURLESSON || !window.LESSONS) return null;
    const lesson = window.LESSONS.find(l => l.id === window.CURLESSON);
    if (!lesson) return null;
    return {
      id: lesson.id,
      title: lesson.title,
      section: lesson.section_title || '',
    };
  }

  toggle.addEventListener('click', () => {
    const isOpen = widget.classList.toggle('open');
    if (isOpen) {
      loadChatHistory();
      input.focus();
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;

    // إضافة رسالة المستخدم
    messages.push({ role: 'user', content: text });
    appendMessage(text, 'user');
    saveMessage('user', text);
    input.value = '';

    // إظهار "جارٍ الكتابة"
    const loadingEl = appendMessage('جارٍ الكتابة...', 'bot loading');

    try {
      const lessonContext = getLessonContext();
      const res = await fetch(`${SUPABASE_URL}/functions/v1/rapid-function`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_KEY}` },
        body: JSON.stringify({
          messages: messages.slice(-10),
          lesson: lessonContext
        }),
      });

      const data = await res.json();
      loadingEl.remove();

      if (data.reply) {
        messages.push({ role: 'assistant', content: data.reply });
        appendMessage(data.reply, 'bot');
        saveMessage('assistant', data.reply);
      } else {
        appendMessage('عذراً، حدث خطأ. حاول مرة ثانية.', 'bot');
      }
    } catch (err) {
      loadingEl.remove();
      appendMessage('تعذر الاتصال. تأكد من اتصالك بالإنترنت.', 'bot');
    }
  });

  function appendMessage(text, type, scroll = true) {
    const div = document.createElement('div');
    div.className = `chat-msg ${type}`;
    div.textContent = text;
    messagesEl.appendChild(div);
    if (scroll) messagesEl.scrollTop = messagesEl.scrollHeight;
    return div;
  }
})();

// ====== تبويبات الدخول/التسجيل ======
(function() {
  const tabs = document.querySelectorAll(".login-tab");
  const loginForm = document.getElementById("loginForm");
  const registerCard = document.getElementById("registerCard");
  const form = document.getElementById("regForm");
  const statusView = document.getElementById("regStatusView");
  const success = document.getElementById("regSuccess");
  const msg = document.getElementById("regMsg");

  if (!tabs.length || !form) return;

  // نفس الـ keys المستخدمة في index.html
  let currentLeadId = localStorage.getItem("thameen_lead_id") || null;
  let lastSubmittedData = JSON.parse(localStorage.getItem("thameen_lead_data") || "{}");

  // التحقق من حالة الطلب
  async function checkLeadStatus() {
    if (!currentLeadId) return null;
    try {
      const res = await fetch(SUPABASE_URL + "/rest/v1/leads?id=eq." + currentLeadId + "&select=*", {
        headers: { "apikey": SUPABASE_KEY, "Authorization": "Bearer " + SUPABASE_KEY }
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data && data[0] ? data[0] : null;
    } catch (e) { return null; }
  }

  // عرض حالة الطلب
  function showStatusView(lead) {
    form.style.display = "none";
    success.hidden = true;
    statusView.hidden = false;

    const icon = document.getElementById("regStatusIcon");
    const badge = document.getElementById("regStatusBadge");
    const title = document.getElementById("regStatusTitle");
    const desc = document.getElementById("regStatusDesc");

    if (lead.status === "converted") {
      icon.innerHTML = `<svg class="status-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" opacity="0.2"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`;
      icon.style.background = "linear-gradient(135deg,rgba(80,200,120,.15),rgba(80,200,120,.05))";
      icon.style.borderColor = "rgba(80,200,120,.3)";
      badge.className = "status-badge converted";
      badge.textContent = "تم القبول!";
      title.textContent = "مبروك! تم قبول طلبك";
      desc.textContent = "راح نرسل لك بيانات الدخول قريبًا.";
    } else if (lead.status === "contacted") {
      icon.innerHTML = `<svg class="status-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.1.8.3 1.6.6 2.3a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.7.3 1.5.5 2.3.6a2 2 0 0 1 1.7 2z"/></svg>`;
      icon.style.background = "linear-gradient(135deg,rgba(241,198,107,.15),rgba(241,198,107,.05))";
      icon.style.borderColor = "rgba(241,198,107,.3)";
      badge.className = "status-badge contacted";
      badge.textContent = "تم التواصل";
      title.textContent = "تواصلنا معك";
      desc.textContent = "تحقق من الواتساب أو الإيميل.";
    } else {
      icon.innerHTML = `<svg class="status-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10" opacity="0.2"/><path d="M12 6v6l4 2"/></svg>`;
      icon.style.background = "linear-gradient(135deg,rgba(91,184,232,.15),rgba(91,184,232,.05))";
      icon.style.borderColor = "rgba(91,184,232,.25)";
      badge.className = "status-badge pending";
      badge.textContent = "قيد المراجعة";
      title.textContent = "طلبك قيد المراجعة";
      desc.textContent = "سجّلت طلبك — راح نتواصل معك قريبًا.";
    }

    lastSubmittedData = { name: lead.name, email: lead.email, phone: lead.phone, country: lead.country, notes: lead.notes || "" };
  }

  // عرض النموذج مع البيانات السابقة للتعديل
  function showFormForEdit() {
    statusView.hidden = true;
    success.hidden = true;
    form.style.display = "grid";

    if (lastSubmittedData.name) document.getElementById("regName").value = lastSubmittedData.name;
    if (lastSubmittedData.email) document.getElementById("regEmail").value = lastSubmittedData.email;
    if (lastSubmittedData.phone) document.getElementById("regPhone").value = lastSubmittedData.phone;
    if (lastSubmittedData.country) document.getElementById("regCountry").value = lastSubmittedData.country;
    if (lastSubmittedData.notes) document.getElementById("regNotes").value = lastSubmittedData.notes;

    document.getElementById("regSubmit").textContent = currentLeadId ? "حفظ التعديلات" : "أرسل طلبي";
  }

  // زر تعديل البيانات
  document.getElementById("regEditBtn")?.addEventListener("click", showFormForEdit);

  // التبويبات
  tabs.forEach(tab => {
    tab.addEventListener("click", async () => {
      tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");

      if (tab.dataset.tab === "login") {
        loginForm.hidden = false;
        registerCard.hidden = true;
      } else {
        loginForm.hidden = true;
        registerCard.hidden = false;

        // التحقق من طلب سابق
        if (currentLeadId) {
          const lead = await checkLeadStatus();
          if (lead) {
            showStatusView(lead);
            return;
          } else {
            // الطلب محذوف
            currentLeadId = null;
            localStorage.removeItem("thameen_lead_id");
            localStorage.removeItem("thameen_lead_data");
          }
        }
        showFormForEdit();
      }
    });
  });

  // إرسال النموذج
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("regName").value.trim();
    const email = document.getElementById("regEmail").value.trim();
    const phone = document.getElementById("regPhone").value.trim();
    const country = document.getElementById("regCountry").value;
    const notes = document.getElementById("regNotes").value.trim();
    const confirmed = document.getElementById("regConfirm").checked;

    msg.textContent = "";
    msg.className = "rform-msg";

    if (!name || !email || !phone || !country) {
      msg.textContent = "عبّي كل الحقول المطلوبة";
      msg.className = "rform-msg err";
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      msg.textContent = "الإيميل غير صحيح";
      msg.className = "rform-msg err";
      return;
    }

    if (!phone.startsWith("+") || phone.length < 8) {
      msg.textContent = "رقم الهاتف لازم يبدأ بـ + وكود الدولة";
      msg.className = "rform-msg err";
      return;
    }

    if (!confirmed) {
      msg.textContent = "لازم تأكد قدرتك على الدفع";
      msg.className = "rform-msg err";
      return;
    }

    const btn = document.getElementById("regSubmit");
    btn.disabled = true;
    btn.textContent = "جارٍ الإرسال…";

    const isUpdate = !!currentLeadId;

    try {
      const url = isUpdate
        ? SUPABASE_URL + "/rest/v1/leads?id=eq." + currentLeadId
        : SUPABASE_URL + "/rest/v1/leads";

      const res = await fetch(url, {
        method: isUpdate ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_KEY,
          "Authorization": "Bearer " + SUPABASE_KEY,
          "Prefer": isUpdate ? "return=minimal" : "return=representation"
        },
        body: JSON.stringify({ name, email, phone, country, notes, confirmed_payment: confirmed, status: "new" })
      });

      if (!res.ok) throw new Error("فشل الإرسال");

      // حفظ البيانات في localStorage
      lastSubmittedData = { name, email, phone, country, notes };
      localStorage.setItem("thameen_lead_data", JSON.stringify(lastSubmittedData));

      if (!isUpdate) {
        const data = await res.json();
        if (data && data[0] && data[0].id) {
          currentLeadId = data[0].id;
          localStorage.setItem("thameen_lead_id", currentLeadId);
        }
      }

      // عرض رسالة النجاح ثم حالة الانتظار
      form.style.display = "none";
      success.hidden = false;

      setTimeout(async () => {
        const lead = await checkLeadStatus();
        if (lead) showStatusView(lead);
      }, 2000);

    } catch (err) {
      msg.textContent = "حدث خطأ، حاول مرة ثانية";
      msg.className = "rform-msg err";
      btn.disabled = false;
      btn.textContent = isUpdate ? "حفظ التعديلات" : "أرسل طلبي";
    }
  });
})();
