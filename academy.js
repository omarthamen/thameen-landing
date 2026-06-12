// ثَمين — أكاديمية المشتركين (REST مباشر)
const SUPABASE_URL = "https://hwzpjxxfdqsjymxbjokv.supabase.co";
const SUPABASE_KEY = "sb_publishable_mcKOUcVtNy5BkLEd5UcRDA_foJbp3YK";
let TOKEN = null, USER = null, AVATARS = {};
const ADMIN_EMAIL = "omarthamen@gmail.com";

// روابط التواصل بالفوتر (عدّلها هنا) — معرّفة بالأعلى لتفادي مشكلة الترتيب
const SOCIALS = [
  { n: "📷 إنستقرام", u: "https://www.instagram.com/thameen.j/" },
  { n: "▶️ يوتيوب", u: "https://www.youtube.com/channel/UCMeR85JgB5jXCZTQy1C69pA" },
];

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
  const r = await fetchT(`${SUPABASE_URL}/rest/v1/${path}`, { headers: authHeaders() });
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

// ====== الفوتر: روابط التواصل ======
function renderSocials() {
  const el = $("footSocials"); if (!el) return;
  el.innerHTML = SOCIALS.map((s) => `<a href="${s.u}"${s.u !== "#" ? ' target="_blank" rel="noopener"' : ""}>${s.n}</a>`).join("");
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
    dbGet("members?select=calls_total,calls_used,created_at").catch(() => dbGet("members?select=calls_total,calls_used").catch(() => [])),
  ]);
  if (!(await guardP)) return;           // موقوف من الأدمن
  showOnboarding();
  $("meName").textContent = (USER && (USER.user_metadata?.name || USER.email)) || "";
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
    PCT = {}; DONE = new Set();
    (progress || []).forEach((p) => { PCT[p.lesson_id] = p.percent != null ? p.percent : (p.completed ? 100 : 0); if (p.completed) DONE.add(p.lesson_id); });
    MEMBER = (members && members[0]) || null;
    const m = MEMBER;
    $("callsLeft").textContent = m ? Math.max(0, (m.calls_total || 3) - (m.calls_used || 0)) : 3;
    renderProgress();
    renderChallenge();
    renderCourses();
    loadAvatars();                       // مؤجّل — بعد عرض الدورات (يقلل التزاحم)
    recordLogin();                       // تسجيل الدخول للمراقبة — مؤجّل وغير حاجب
    if (SECTIONS.length) {
      let savedLid = null; try { savedLid = localStorage.getItem("thameen_lesson"); } catch (_) {}
      const savedLesson = savedLid && LESSONS.find((l) => l.id === savedLid);
      if (savedLesson) { CURSEC = savedLesson.section_id; renderCourses(); playLesson(savedLesson.id); }
      else { const firstSec = SECTIONS.find((s) => LESSONS.some((l) => l.section_id === s.id)) || SECTIONS[0]; openCourse(firstSec.id); }
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
  const start = new Date(raw), now = new Date();
  const elapsed = (now - start) / 86400000;
  const dayNum = Math.min(90, Math.max(1, Math.floor(elapsed) + 1));
  const done = elapsed >= 90;
  const left = Math.max(0, 90 - dayNum);
  const pct = Math.round((dayNum / 90) * 100);
  $("chalDay").textContent = done ? "٩٠" : toAr(dayNum);
  $("chalLeft").textContent = done ? "اكتمل التحدّي ✓" : `باقي ${toAr(left)} يوم`;
  $("chalBar").style.width = pct + "%";
  const ring = $("chalRing");
  if (ring) ring.style.background = `conic-gradient(#5BB8E8 ${pct * 3.6}deg, rgba(255,255,255,.1) 0deg)`;
  $("chalMsg").textContent = done ? CHAL_MILE[90] : challengeMsg(dayNum);
  let dis = null; try { dis = localStorage.getItem("thameen_chal_dismiss"); } catch (_) {}
  banner.hidden = (dis === String(dayNum));
  const x = $("chalX");
  if (x && !x._wired) { x._wired = true; x.addEventListener("click", () => { try { localStorage.setItem("thameen_chal_dismiss", String(dayNum)); } catch (_) {} banner.hidden = true; }); }
}

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
  const lines = String(text || "").split("\n").map((s) => s.trim()).filter(Boolean);
  if (!lines.length) { box.innerHTML = ""; return; }
  const items = []; let pending = null; const urlRe = /^https?:\/\//i;
  for (const ln of lines) {
    if (urlRe.test(ln)) { items.push({ link: true, label: pending || descHost(ln), url: ln }); pending = null; }
    else { if (pending) items.push({ link: false, text: pending }); pending = ln; }
  }
  if (pending) items.push({ link: false, text: pending });
  const LIMIT = 4;
  const rows = items.map((it, i) => {
    const extra = i >= LIMIT ? " desc-extra" : "";
    if (!it.link) return `<div class="desc-note${extra}">${esc(stripEmoji(it.text))}</div>`;
    return `<a class="desc-item${extra}" href="${esc(it.url)}" target="_blank" rel="noopener">
      <span class="desc-ic">${descIcon(it.url)}</span>
      <span class="desc-label">${esc(stripEmoji(it.label))}</span>
      <span class="desc-open">فتح <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7M9 7h8v8"/></svg></span></a>`;
  }).join("");
  const hidden = items.length - LIMIT;
  const more = hidden > 0 ? `<button type="button" class="desc-toggle" data-n="${hidden}">عرض جميع التفاصيل (${hidden}+)</button>` : "";
  const hIcon = '<svg class="desc-h-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5l-8.5 8.5a5 5 0 0 1-7-7l8.5-8.5a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3l7.8-7.8"/></svg>';
  box.innerHTML = `<div class="desc-card"><h4 class="desc-h">${hIcon} الروابط والمرفقات</h4><div class="desc-list">${rows}</div>${more}</div>`;
  const tg = box.querySelector(".desc-toggle");
  if (tg) tg.addEventListener("click", () => {
    const exp = box.classList.toggle("desc-expanded");
    tg.textContent = exp ? "عرض أقل ▲" : `عرض جميع التفاصيل (${tg.dataset.n}+)`;
  });
}

function plItemHtml(l, i) {
  const dur = l.duration ? `<span class="pl-dur">${fmtDur(l.duration)}</span>` : "";
  return `<button class="pl-item ${l.id === CURLESSON ? "on" : ""}" data-lid="${l.id}">
      <span class="pl-num ${DONE.has(l.id) ? "done" : ""}">${DONE.has(l.id) ? "✓" : i + 1}</span>
      <span class="pl-name">${esc(stripEmoji(l.title))}</span>
      ${dur}
    </button>`;
}
function renderPlaylist(ls) {
  const wrap = $("plList");
  if (!wrap) return;
  if (!ls.length) { wrap.innerHTML = '<p class="hint" style="padding:14px">لا دروس بعد.</p>'; return; }
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
      <div class="pl-fold-body">${group.map((g) => plItemHtml(g, ls.indexOf(g))).join("")}</div>
    </div>`;
  });
  wrap.innerHTML = html;
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

// ====== المجتمع ======
let commTimer = null, CURCHAN = "general", commSearch = "", pendingFile = null, MSGS = [];
let renderedIds = new Set(), rLastDay = null, rLastUid = null, rLastTime = 0, rChan = null;
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
  if (atBottom) { box.scrollTop = box.scrollHeight; updateScrollBtn(); }
}
function mediaHtml(m) {
  if (!m.media_url) return "";
  return m.media_type === "video" ? `<video src="${esc(m.media_url)}" controls preload="metadata"></video>` : `<img src="${esc(m.media_url)}" alt="" loading="lazy">`;
}
function bubbleHtml(m, isAdmin, grouped) {
  const me = m.user_id === (USER && USER.id), nm = m.name || "متدرب";
  const inner = `${m.text ? linkify(m.text) : ""}${mediaHtml(m)}${embedFor(m.text)}`;
  if (grouped) {
    return `<div class="cmsg grouped ${me ? "me" : ""}" data-id="${m.id}">
      <div class="cmsg-av-sp"></div>
      <div class="cmsg-body">
        <div class="cmsg-bubble">${inner}<span class="cmsg-t">${fmtTime(m.created_at)}</span></div>
        ${(isAdmin || me) ? '<button class="del-msg mini" type="button" title="حذف">×</button>' : ""}
      </div></div>`;
  }
  return `<div class="cmsg ${me ? "me" : ""}" data-id="${m.id}">
    <div class="cmsg-av" style="${avStyle(m.user_id, nm)}">${avInner(m.user_id, nm)}</div>
    <div class="cmsg-body">
      <div class="cmsg-meta"><span class="cmsg-name">${me ? "أنت" : esc(nm)}</span><span class="cmsg-time">${fmtTime(m.created_at)}</span>${(isAdmin || me) ? '<button class="del-msg" type="button">حذف</button>' : ""}</div>
      <div class="cmsg-bubble">${inner}</div>
    </div></div>`;
}
function achCard(m, isAdmin) {
  const nm = m.name || "متدرب", me = m.user_id === (USER && USER.id);
  return `<div class="ach-card" data-id="${m.id}">${(isAdmin || me) ? '<button class="del-msg" type="button">حذف</button>' : ""}
    <div class="ach-head"><div class="ach-av" style="${avStyle(m.user_id, nm)}">${avInner(m.user_id, nm)}</div><div><b>${esc(nm)}</b><small>🏆 إنجاز · ${fmtTime(m.created_at)}</small></div></div>
    ${mediaHtml(m)}${embedFor(m.text)}
    ${m.text ? `<div class="ach-text">${linkify(m.text)}</div>` : ""}</div>`;
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
  const ch = normLink(meta.channel), ct = normLink(meta.contact);
  return `<div class="job-card" data-id="${m.id}">${(isAdmin || me) ? '<button class="del-msg" type="button">حذف</button>' : ""}
    <div class="job-top"><div class="job-av" style="${avStyle(m.user_id, nm)}">${avInner(m.user_id, nm)}</div><div><b>${esc(nm)}</b><small>✦ فرصة عمل · ${fmtTime(m.created_at)}</small></div></div>
    <div class="job-desc">${linkify(m.text || "")}</div>
    ${meta.price ? `<span class="job-price">💰 ${esc(meta.price)}</span>` : ""}
    <div class="job-actions">${ch ? `<a class="job-btn" href="${esc(ch)}" target="_blank" rel="noopener">معرض الأعمال</a>` : ""}${ct ? `<a class="job-btn primary" href="${esc(ct)}" target="_blank" rel="noopener">📞 تواصل مباشر</a>` : ""}</div></div>`;
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
  if (newMsgs.length) appendNew(newMsgs);                  // رسائل جديدة فقط → إضافة سلسة
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
function switchView(view) {
  try { localStorage.setItem("thameen_view", view); } catch (_) {}
  document.querySelectorAll(".nav-tab").forEach((t) => t.classList.toggle("on", t.dataset.view === view));
  const vc = $("viewCourses"), vm = $("viewCommunity"), va = $("viewAccount");
  if (vc) vc.hidden = view !== "courses";
  if (vm) vm.hidden = view !== "community";
  if (va) va.hidden = view !== "account";
  if (view === "community") { registerProfile(); loadMembers(); loadMessages(true); startCommPoll(); } else stopCommPoll();
  if (view === "account") loadAccount();
}
document.querySelectorAll(".nav-tab").forEach((t) => t.addEventListener("click", () => switchView(t.dataset.view)));

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
      await dbSend("POST", "community_messages", { user_id: USER.id, name: myName(), text: t || null, channel: CURCHAN, media_url, media_type }, "return=minimal");
      inp.value = ""; clearPending();
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

// ====== نافذة التعليمات الترحيبية ======
let onboarding = false;
(function () {
  const modal = $("guideModal"); if (!modal) return;
  const done = () => { const wasOnb = onboarding; onboarding = false; if (wasOnb) maybeShowChannels(); };  // بعد الترحيب → القنوات
  const close = () => closeM(modal, done);
  const hideForever = () => { try { localStorage.setItem("thameen_guide_hidden", "1"); } catch (_) {} close(); };
  const x = $("guideX"); if (x) x.addEventListener("click", close);
  const ok = $("guideOk"); if (ok) ok.addEventListener("click", close);
  const hide = $("guideHide"); if (hide) hide.addEventListener("click", hideForever);
  const gb = $("guideBtn"); if (gb) gb.addEventListener("click", () => { onboarding = false; openM(modal); });
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
  let guideHidden = null, chJoined = null;
  try { guideHidden = localStorage.getItem("thameen_guide_hidden"); chJoined = localStorage.getItem("thameen_channels_joined"); } catch (_) {}
  if (!guideHidden) { onboarding = true; openM($("guideModal")); }
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

  // المكالمات الشهرية (٣ أشهر من تاريخ الاشتراك)
  const callsTotal = (MEMBER && MEMBER.calls_total) || 3;
  const callsUsed = (MEMBER && MEMBER.calls_used) || 0;
  const now = new Date();
  const ord = ["الأولى", "الثانية", "الثالثة", "الرابعة", "الخامسة", "السادسة"];
  let calls = "";
  for (let i = 0; i < callsTotal; i++) {
    const date = sub ? addMonths(sub, i + 1) : null;
    let state, cls;
    if (i < callsUsed) { state = "تمّت ✓"; cls = "used"; }
    else if (date && date <= now) { state = "متاحة الآن"; cls = "ready"; }
    else { state = "قادمة"; cls = "soon"; }
    calls += `<div class="acc-call ${cls}">
      <div class="acc-call-n">${i + 1}</div>
      <div class="acc-call-body"><b>المكالمة ${ord[i] || i + 1}</b><small>${date ? fmtDate(date) : "—"}</small></div>
      <span class="acc-call-tag">${state}</span></div>`;
  }
  $("accCalls").innerHTML = calls;

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
      setMsg(msg, "تم تحديث صورتك ✅", true);
    } catch (err) {
      const m = String(err.message || err);
      setMsg(msg, /avatar_url/.test(m) ? "لازم تضيف عمود avatar_url بقاعدة البيانات أول (راجع الخطوة)." : "خطأ: " + m, false);
    }
    fi.value = "";
  });
})();
