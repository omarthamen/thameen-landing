// ثَمين — لوحة التحكّم (اتصال REST مباشر، بدون مكتبات خارجية)
const SUPABASE_URL = "https://hwzpjxxfdqsjymxbjokv.supabase.co";
const SUPABASE_KEY = "sb_publishable_mcKOUcVtNy5BkLEd5UcRDA_foJbp3YK";
let TOKEN = null;

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
// أيقونات SVG بريميوم (بدل الإيموجي)
function ic(n) {
  const p = {
    calendar: '<rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M3 9h18M8 2.5v4M16 2.5v4"/>',
    chart: '<path d="M3 3v18h18"/><path d="M7 14l3-3 3 3 5-6"/>',
    bars: '<path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="5"/><rect x="12" y="8" width="3" height="9"/><rect x="17" y="14" width="3" height="3"/>',
    chat: '<path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 21l2.1-5.4A8.5 8.5 0 1 1 21 11.5z"/>',
    trophy: '<path d="M8 4h8v3a4 4 0 0 1-8 0z"/><path d="M8 5H5v1a3 3 0 0 0 3 3M16 5h3v1a3 3 0 0 1-3 3"/><path d="M12 11v4M9 19h6M10.5 19v-2h3v2"/>',
    bag: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    device: '<rect x="7" y="3" width="10" height="18" rx="2"/><path d="M11 18h2"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 2.5 15.4 0 18M12 3c-2.5 2.6-2.5 15.4 0 18"/>',
    pencil: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    play: '<path d="M6 4l14 8-14 8z" fill="currentColor" stroke="none"/>',
    pause: '<rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none"/><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none"/>',
    book: '<path d="M4 5a2 2 0 0 1 2-2h6v16H6a2 2 0 0 0-2 2zM20 5a2 2 0 0 0-2-2h-6v16h6a2 2 0 0 1 2 2z"/>',
    film: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M10 9l5 3-5 3z" fill="currentColor" stroke="none"/>',
    folder: '<path d="M4 7a1 1 0 0 1 1-1h4l2 2h8a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/>',
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
  };
  return `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${p[n] || ""}</svg>`;
}
const setMsg = (el, text, ok) => { el.textContent = text; el.className = "msg " + (ok ? "ok" : "err"); };

// fetch بمهلة (ما يعلّق أبدًا)
function fetchT(url, opts = {}, ms = 15000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(id));
}
const authHeaders = (extra) => Object.assign(
  { apikey: SUPABASE_KEY, Authorization: "Bearer " + (TOKEN || SUPABASE_KEY) }, extra || {});

async function dbGet(path) {
  // إعادة محاولة تلقائية (٣ مرات) لتحمّل تذبذب الشبكة
  let lastErr;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetchT(`${SUPABASE_URL}/rest/v1/${path}`, { headers: authHeaders() }, 22000);
      if (!r.ok) { if (r.status === 401) { logout(); throw new Error(await r.text()); } throw new Error(await r.text()); }
      return r.json();
    } catch (e) { lastErr = e; if (i < 2) await new Promise((res) => setTimeout(res, 700)); }
  }
  throw lastErr;
}
async function dbSend(method, path, body, prefer) {
  const r = await fetchT(`${SUPABASE_URL}/rest/v1/${path}`, {
    method, headers: authHeaders({ "Content-Type": "application/json", Prefer: prefer || "return=representation" }),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) { if (r.status === 401) logout(); throw new Error(await r.text()); }
  return r.status === 204 ? null : r.json().catch(() => null);
}

// رفع ملف للتخزين وإرجاع الرابط العام
async function uploadFile(file) {
  const ext = (file.name.split(".").pop() || "bin").toLowerCase();
  const path = `${crypto.randomUUID()}.${ext}`;
  const r = await fetchT(`${SUPABASE_URL}/storage/v1/object/media/${path}`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + TOKEN, "x-upsert": "true", "Content-Type": file.type || "application/octet-stream" },
    body: file,
  }, 180000);
  if (!r.ok) throw new Error(await r.text());
  return `${SUPABASE_URL}/storage/v1/object/public/media/${path}`;
}

// ====== المصادقة ======
const loginView = $("loginView"), dashView = $("dashView");
function showDash(on) { loginView.hidden = on; dashView.hidden = !on; if (on) loadAll(); }
function logout() {
  TOKEN = null;
  showDash(false);
}

$("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = $("loginBtn"); btn.disabled = true;
  setMsg($("loginMsg"), "جارٍ الدخول…", true);
  try {
    const r = await fetchT(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email: $("email").value.trim(), password: $("password").value }),
    });
    const data = await r.json();
    if (!r.ok) {
      const m = data.msg || data.error_description || data.error || "بيانات غير صحيحة";
      setMsg($("loginMsg"), "فشل الدخول: " + m, false); btn.disabled = false; return;
    }
    TOKEN = data.access_token;
    // حفظ الجلسة لمدة ٦ ساعات
    const expiry = Date.now() + (6 * 60 * 60 * 1000);
    try { localStorage.setItem("thameen_admin_token", TOKEN); localStorage.setItem("thameen_admin_exp", expiry); } catch (_) {}
    setMsg($("loginMsg"), "", true);
    showDash(true);
  } catch (err) {
    setMsg($("loginMsg"), "خطأ بالاتصال: " + (err && err.message ? err.message : err), false);
    btn.disabled = false;
  }
});

$("logoutBtn").addEventListener("click", logout);

// استعادة الجلسة المحفوظة (صالحة لـ ٦ ساعات)
(function restoreSession() {
  try {
    const savedToken = localStorage.getItem("thameen_admin_token");
    const savedExp = localStorage.getItem("thameen_admin_exp");
    if (savedToken && savedExp && Date.now() < parseInt(savedExp)) {
      TOKEN = savedToken;
      showDash(true);
      return;
    }
    localStorage.removeItem("thameen_admin_token");
    localStorage.removeItem("thameen_admin_exp");
  } catch (_) {}
  showDash(false);
})();

// ====== التبويبات ======
document.querySelectorAll(".tab").forEach((t) => {
  t.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((x) => x.classList.remove("on"));
    document.querySelectorAll(".panel").forEach((p) => { p.classList.remove("on"); p.hidden = true; });
    t.classList.add("on");
    const p = $("tab-" + t.dataset.tab); p.classList.add("on"); p.hidden = false;
    if (t.dataset.tab === "calls") loadCallsTab();
    if (t.dataset.tab === "leads") { loadLeads(); startLeadsAutoRefresh(); }
    else { stopLeadsAutoRefresh(); }
  });
});

function loadAll() { loadComments(); loadVideo(); loadMedia("channel"); loadMedia("work"); loadCourses(); loadSubscribers(); loadGroupCall(); loadNotifsAdmin(); loadFeedback(); }

// ====== تبويب المكالمات (تجميع تلقائي حسب نافذة الجاهزية + إشعارات) ======
function daysSinceJoin(iso) { try { return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000); } catch (_) { return 0; } }
function readyThreshold(used) { return used * 30 + 15; }   // نافذة الجاهزية: ١٥ يوم داخل شهر المكالمة
const CALL_STAGES = [
  { used: 0, ready: true, title: "🟢 جاهزون للمكالمة الأولى", hint: "مرّ ١٥ يوم أو أكثر على اشتراكهم", suggest: "حان وقت مكالمتك الأولى مع ثَمين 📞" },
  { used: 1, ready: true, title: "🟢 جاهزون للمكالمة الثانية", hint: "دخلوا شهرهم الثاني (٤٥ يوم+)", suggest: "جاهز لمكالمتك الثانية؟ 📞" },
  { used: 2, ready: true, title: "🟢 جاهزون للمكالمة الثالثة", hint: "دخلوا شهرهم الثالث (٧٥ يوم+)", suggest: "مكالمتك الثالثة والأخيرة بانتظارك 📞" },
  { soon: true, title: "⏳ لم يحن وقتهم بعد", hint: "ما وصلوا نافذة المكالمة (أقل من ١٥ يوم في شهرهم)" },
  { done: true, title: "✓ اكتملت مكالماتهم", hint: "خلّصوا الـ٣ مكالمات" },
];
function stageMembers(st) {
  return CALLS_DATA.filter((m) => {
    if (!callsJoinPass(m.joined)) return false;
    const D = daysSinceJoin(m.joined), u = m.calls_used;
    if (st.done) return u >= 3;
    if (st.ready) return u === st.used && D >= readyThreshold(u);
    if (st.soon) return u < 3 && D < readyThreshold(u);
    return false;
  });
}
let CALLS_DATA = [];
async function loadCallsTab() {
  const wrap = $("callsStages"); if (!wrap) return;
  wrap.innerHTML = '<p class="hint">جارٍ التحميل…</p>';
  try { CALLS_DATA = await rpc("admin_calls_overview"); }
  catch (e) { wrap.innerHTML = `<p class="empty">خطأ: ${esc(e.message)}<br>(تأكّد إنك شغّلت SQL الدوال)</p>`; return; }
  renderCallsTab();
}
function callsJoinPass(iso) {
  const sel = $("callsJoinFilter"); const f = sel ? sel.value : "all";
  if (f === "all") return true;
  const d = new Date(iso), now = new Date();
  if (f === "thismonth") return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  if (f === "lastmonth") { const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1); return d.getMonth() === lm.getMonth() && d.getFullYear() === lm.getFullYear(); }
  return true;
}
function renderCallsTab() {
  const wrap = $("callsStages"); if (!wrap) return;
  $("callsTabCount").textContent = (CALLS_DATA.length || 0) + " مشترك";
  // نظرة شاملة: كل المواعيد المجدولة مرتّبة بالتاريخ
  const now = Date.now();
  const sched = CALLS_DATA.filter((m) => m.call_at && callsJoinPass(m.joined)).sort((a, b) => new Date(a.call_at) - new Date(b.call_at));
  const schedHtml = `<div class="card"><h3>📅 المواعيد المجدولة <span class="stage-count">${sched.length}</span></h3>` +
    (sched.length ? `<div class="sched-list">` + sched.map((m) => {
      const days = Math.round((new Date(m.call_at).getTime() - now) / 86400000);
      const tag = days < 0 ? "فاتت" : days === 0 ? "اليوم" : days === 1 ? "بكرة" : `بعد ${days} يوم`;
      const cls = days < 0 ? "past" : days <= 1 ? "soon" : "";
      const doneBtn = days < 0 ? `<button class="btn btn-primary btn-sm sched-done" data-uid="${esc(m.user_id)}">✓ تم إنجازها</button>` : `<span class="sched-tag">${tag}</span>`;
      return `<div class="sched-row ${cls}"><div class="sched-id"><b>${esc(m.name || "—")}</b><small>${fmtCallDT(m.call_at)} · المكالمة ${m.calls_used + 1}</small></div>${doneBtn}</div>`;
    }).join("") + `</div>` : '<p class="hint">ما في مواعيد مجدولة بعد. حدّد موعدًا لمجموعة من تحت 👇</p>') + `</div>`;
  wrap.innerHTML = schedHtml + CALL_STAGES.map((st) => {
    const members = stageMembers(st);
    const memHtml = members.length
      ? members.map((m) => `<div class="stage-mem"><b>${esc(m.name || "—")}</b><small>اشترك ${fmtJoin(m.joined)} · ${daysSinceJoin(m.joined)} يوم · ${m.calls_used}/${m.calls_total}${m.call_at ? ' · 📅 ' + fmtCallDT(m.call_at) : ""}</small></div>`).join("")
      : '<p class="hint">لا أحد بهذه المجموعة.</p>';
    const sendBox = (members.length && st.ready) ? `<div class="stage-send">
      <label class="lbl">موعد المكالمة لهذه المجموعة (تاريخ وساعة)</label>
      <input type="datetime-local" class="fld st-at" />
      <input type="text" class="fld st-title" value="موعد مكالمتك مع ثَمين 📞" />
      <textarea class="fld st-body" rows="2" placeholder="${esc(st.suggest)} (يُكتب الموعد تلقائيًا لو تركته فاضي)"></textarea>
      <button class="btn btn-primary btn-sm st-schedule" data-ids="${members.map((m) => m.user_id).join(",")}">📅 جدولة + إشعار (${members.length})</button>
      <span class="msg st-msg"></span>
    </div>` : "";
    return `<div class="card call-stage ${(st.done || st.soon) ? "done" : ""}">
      <h3>${st.title} <span class="stage-count">${members.length}</span></h3>
      <p class="hint">${st.hint}</p>
      <div class="stage-members">${memHtml}</div>
      ${sendBox}
    </div>`;
  }).join("");
  wrap.querySelectorAll(".st-schedule").forEach((b) => b.addEventListener("click", () => scheduleStage(b)));
  wrap.querySelectorAll(".sched-done").forEach((b) => b.addEventListener("click", () => completeCall(b.dataset.uid)));
}
async function completeCall(uid) {
  if (!confirm("تأكيد: تمّت هذه المكالمة؟\nراح تنحسب وينتقل المشترك لمكالمته التالية.")) return;
  try { await rpc("admin_complete_call", { p_user: uid }); loadCallsTab(); }
  catch (e) { alert("خطأ: " + e.message + "\n(تأكّد إنك شغّلت SQL الدالة)"); }
}
async function scheduleStage(btn) {
  const card = btn.closest(".call-stage"), msg = card.querySelector(".st-msg");
  const atRaw = card.querySelector(".st-at").value;
  const title = card.querySelector(".st-title").value.trim();
  let body = card.querySelector(".st-body").value.trim();
  const ids = (btn.dataset.ids || "").split(",").filter(Boolean);
  if (!atRaw) { setMsg(msg, "حدّد تاريخ وساعة المكالمة.", false); return; }
  if (!title) { setMsg(msg, "اكتب عنوان الإشعار.", false); return; }
  if (!ids.length) { setMsg(msg, "لا مستلمين.", false); return; }
  const iso = new Date(atRaw).toISOString();
  let human = atRaw; try { human = new Date(atRaw).toLocaleString("ar", { dateStyle: "full", timeStyle: "short" }); } catch (_) {}
  if (!body) body = "تم تحديد موعد مكالمتك: " + human + " — راح نذكّرك تلقائيًا قبلها.";
  btn.disabled = true; setMsg(msg, "جارٍ الجدولة…", true);
  try {
    const n = await rpc("admin_schedule_calls", { p_users: ids, p_at: iso, p_title: title, p_body: body });
    setMsg(msg, `تم جدولة وإشعار ${n} مشترك ✅ — النظام راح يذكّرهم تلقائيًا.`, true);
  } catch (e) { setMsg(msg, "خطأ: " + e.message, false); }
  btn.disabled = false;
}
document.addEventListener("change", (e) => { if (e.target && e.target.id === "callsJoinFilter") renderCallsTab(); });

// ====== طلبات التسجيل (Leads) ======
let lastLeadsCount = 0;
let leadsInterval = null;
const LEADS_SOUND = new Audio("data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYZNIBLmAAAAAAD/+9DEAAAIAANIAAAAEikAbSAAAAETEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//vQxFMAAADSAAAAAAAAANIAAAAATEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVU=");

const COUNTRIES = {SA:"السعودية",AE:"الإمارات",KW:"الكويت",QA:"قطر",BH:"البحرين",OM:"عُمان",EG:"مصر",JO:"الأردن",IQ:"العراق",SY:"سوريا",LB:"لبنان",PS:"فلسطين",YE:"اليمن",SD:"السودان",LY:"ليبيا",TN:"تونس",DZ:"الجزائر",MA:"المغرب",MR:"موريتانيا",OTHER:"أخرى"};

function renderLeadCard(l) {
  const date = new Date(l.created_at);
  const dateStr = date.toLocaleDateString("ar-EG", {day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"});
  const countryName = COUNTRIES[l.country] || l.country;
  const statusClass = l.status === "contacted" ? "contacted" : (l.status === "converted" ? "converted" : "new");
  return `<div class="lead-card ${statusClass}" data-id="${l.id}">
    <div class="lead-header">
      <b class="lead-name">${esc(l.name)}</b>
      <span class="lead-status ${statusClass}">${l.status === "contacted" ? "تم التواصل" : (l.status === "converted" ? "مشترك" : "جديد")}</span>
    </div>
    <div class="lead-info">
      <span class="lead-item">📧 <a href="mailto:${esc(l.email)}">${esc(l.email)}</a></span>
      <span class="lead-item">📱 <a href="https://wa.me/${l.phone.replace(/[^0-9]/g,'')}" target="_blank">${esc(l.phone)}</a></span>
      <span class="lead-item">🌍 ${esc(countryName)}</span>
      <span class="lead-item">💵 ${l.confirmed_payment ? "مؤكد الدفع ✓" : "غير مؤكد"}</span>
    </div>
    ${l.notes ? `<div class="lead-notes">${esc(l.notes)}</div>` : ""}
    <div class="lead-footer">
      <span class="lead-date">${dateStr}</span>
      <div class="lead-actions">
        ${l.status !== "contacted" ? `<button class="btn btn-sm lead-status-btn" data-id="${l.id}" data-status="contacted">تم التواصل</button>` : ""}
        ${l.status !== "converted" ? `<button class="btn btn-sm btn-primary lead-status-btn" data-id="${l.id}" data-status="converted">تحويل لمشترك</button>` : ""}
      </div>
    </div>
  </div>`;
}

async function loadLeads(silent = false) {
  const list = $("leadsList"); if (!list) return;
  if (!silent) list.innerHTML = '<p class="hint">جارٍ التحميل…</p>';
  try {
    const leads = await dbGet("leads?select=*&order=created_at.desc&limit=200");
    const total = leads?.length || 0;
    $("leadsCount").textContent = total + " طلب";

    // إشعار صوتي للطلبات الجديدة
    const newCount = leads.filter(l => l.status === "new" || !l.status).length;
    if (silent && newCount > lastLeadsCount) {
      try { LEADS_SOUND.play(); } catch (_) {}
    }
    lastLeadsCount = newCount;

    if (!leads || !leads.length) { list.innerHTML = '<p class="empty">لا توجد طلبات بعد.</p>'; return; }

    // تقسيم حسب الحالة
    const newLeads = leads.filter(l => l.status === "new" || !l.status);
    const contactedLeads = leads.filter(l => l.status === "contacted");
    const convertedLeads = leads.filter(l => l.status === "converted");

    let html = "";

    if (newLeads.length) {
      html += `<div class="leads-section"><h3 class="leads-section-title new">🆕 طلبات جديدة <span>${newLeads.length}</span></h3><div class="leads-grid">${newLeads.map(renderLeadCard).join("")}</div></div>`;
    }
    if (contactedLeads.length) {
      html += `<div class="leads-section"><h3 class="leads-section-title contacted">📞 تم التواصل <span>${contactedLeads.length}</span></h3><div class="leads-grid">${contactedLeads.map(renderLeadCard).join("")}</div></div>`;
    }
    if (convertedLeads.length) {
      html += `<div class="leads-section"><h3 class="leads-section-title converted">✅ تم التحويل لمشترك <span>${convertedLeads.length}</span></h3><div class="leads-grid">${convertedLeads.map(renderLeadCard).join("")}</div></div>`;
    }

    list.innerHTML = html || '<p class="empty">لا توجد طلبات بعد.</p>';
    list.querySelectorAll(".lead-status-btn").forEach((b) => b.addEventListener("click", () => updateLeadStatus(b.dataset.id, b.dataset.status)));
  } catch (e) { if (!silent) list.innerHTML = `<p class="empty">خطأ: ${esc(e.message)}</p>`; }
}

// تحديث تلقائي كل ٣٠ ثانية
function startLeadsAutoRefresh() {
  if (leadsInterval) clearInterval(leadsInterval);
  leadsInterval = setInterval(() => loadLeads(true), 30000);
}
function stopLeadsAutoRefresh() {
  if (leadsInterval) { clearInterval(leadsInterval); leadsInterval = null; }
}

async function updateLeadStatus(id, status) {
  try {
    await fetchT(`${SUPABASE_URL}/rest/v1/leads?id=eq.${id}`, {
      method: "PATCH",
      headers: authHeaders({"Content-Type": "application/json", "Prefer": "return=minimal"}),
      body: JSON.stringify({ status })
    });
    loadLeads();
  } catch (e) { alert("خطأ: " + e.message); }
}

// ====== المشتركون ======
async function loadSubscribers() {
  const list = $("subsList"); if (!list) return;
  list.innerHTML = '<p class="hint">جارٍ التحميل…</p>';
  try {
    let ps;
    try { ps = await rpc("admin_subscriber_stats"); }
    catch (_) {
      const raw = await dbGet("profiles?select=user_id,name,created_at,device_id,suspended&order=created_at.desc&limit=500").catch(() => []);
      ps = (raw || []).map((p) => ({ user_id: p.user_id, name: p.name, joined: p.created_at, device_id: p.device_id, suspended: p.suspended, completed: 0, total: 0, messages: 0, achievements: 0, jobs: 0 }));
    }
    $("subsCount").textContent = (ps?.length || 0) + " مشترك";
    if (!ps || !ps.length) { list.innerHTML = '<p class="empty">لا مشتركين بعد.</p>'; return; }
    let callsMap = {};
    try { (await rpc("admin_member_calls") || []).forEach((r) => { callsMap[r.user_id] = r; }); } catch (_) {}
    list.innerHTML = ps.map((p) => {
      const cm = callsMap[p.user_id] || {}; const cu = cm.calls_used || 0, ct = cm.calls_total || 3;
      const susp = !!p.suspended;
      const devN = p.devices || 0, ipN = p.ips || 0;
      const sharing = devN > 2 || ipN > 3;
      const pct = p.total ? Math.round((p.completed / p.total) * 100) : 0;
      const statusClass = susp ? "stop" : (sharing ? "warn" : "ok");
      const statusText = susp ? "موقوف" : (sharing ? "مشاركة؟" : "نشط");
      return `<div class="sub-card ${susp ? "is-susp" : ""} ${sharing ? "is-sharing" : ""}">
        <div class="sub-header">
          <div class="sub-name">${esc(p.name || "—")}</div>
          <span class="sub-status ${statusClass}">${statusText}</span>
        </div>
        ${p.email ? `<div class="sub-email">${esc(p.email)}</div>` : ""}
        <div class="sub-date">اشترك ${fmtJoin(p.joined)}</div>
        <div class="sub-progress-section">
          <div class="sub-progress-header">
            <span>التقدّم في الدورة</span>
            <span class="sub-progress-num">${p.completed || 0} من ${p.total || 0} درس</span>
          </div>
          <div class="sub-progress-bar"><div class="sub-progress-fill" style="width:${pct}%"></div></div>
          ${p.started > 0 ? `<div class="sub-watching">يشاهد الآن: وصل ${p.top_percent || 0}% من الدرس الحالي</div>` : ""}
        </div>
        <div class="sub-activity">
          ${p.messages > 0 ? `<span class="sub-act-item">${ic("chat")} ${p.messages} رسالة</span>` : ""}
          ${cu > 0 ? `<span class="sub-act-item">📞 ${cu}/${ct} مكالمة</span>` : ""}
        </div>
        <div class="sub-actions">
          <button class="btn btn-primary btn-sm details-sub" data-uid="${esc(p.user_id)}" data-name="${esc(p.name || "")}">تفاصيل</button>
          <div class="sub-calls">
            <button class="call-btn call-dec" data-uid="${esc(p.user_id)}">−</button>
            <span>📞 ${cu}/${ct}</span>
            <button class="call-btn call-inc" data-uid="${esc(p.user_id)}">+</button>
          </div>
          <button class="btn btn-ghost btn-sm susp-sub" data-uid="${esc(p.user_id)}" data-name="${esc(p.name || "")}" data-susp="${susp ? 1 : 0}">${susp ? "تفعيل" : "إيقاف"}</button>
          <button class="btn btn-danger btn-sm del-sub" data-uid="${esc(p.user_id)}" data-name="${esc(p.name || "")}">حذف</button>
        </div>
      </div>`;
    }).join("");
    list.querySelectorAll(".susp-sub").forEach((b) => b.addEventListener("click", () => subAction(b, "set_suspended")));
    list.querySelectorAll(".del-sub").forEach((b) => b.addEventListener("click", () => subAction(b, "delete_subscriber")));
    list.querySelectorAll(".call-inc").forEach((b) => b.addEventListener("click", () => markCall(b.dataset.uid, 1)));
    list.querySelectorAll(".call-dec").forEach((b) => b.addEventListener("click", () => markCall(b.dataset.uid, -1)));
    list.querySelectorAll(".details-sub").forEach((b) => b.addEventListener("click", () => showSubDetails(b.dataset.uid, b.dataset.name)));
  } catch (x) { list.innerHTML = `<p class="empty">خطأ: ${esc(x.message)}</p>`; }
}

async function markCall(uid, delta) {
  try { await rpc("admin_mark_call", { p_user: uid, p_delta: delta }); loadSubscribers(); }
  catch (e) { alert("خطأ: " + e.message + "\n(تأكّد إنك شغّلت SQL الدوال)"); }
}

async function showSubDetails(uid, name) {
  let modal = $("detailsModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "detailsModal";
    modal.className = "modal-overlay";
    modal.innerHTML = `<div class="modal-box">
      <div class="modal-header"><h3 id="detailsTitle">تفاصيل</h3><button class="modal-close" onclick="$('detailsModal').hidden=true">✕</button></div>
      <div class="modal-body" id="detailsBody"></div>
    </div>`;
    document.body.appendChild(modal);
    modal.addEventListener("click", (e) => { if (e.target === modal) modal.hidden = true; });
  }
  $("detailsTitle").textContent = `تفاصيل مشاهدات ${name}`;
  $("detailsBody").innerHTML = '<p class="hint">جارٍ التحميل…</p>';
  modal.hidden = false;
  try {
    const [progressData, lessonsData, sectionsData] = await Promise.all([
      dbGet(`progress?select=lesson_id,percent,completed,updated_at&user_id=eq.${uid}&order=updated_at.desc`),
      dbGet("lessons?select=id,title,section_id&order=sort.asc"),
      dbGet("sections?select=id,title&order=sort.asc")
    ]);
    const lessonMap = {}; (lessonsData || []).forEach((l) => { lessonMap[l.id] = l; });
    const sectionMap = {}; (sectionsData || []).forEach((s) => { sectionMap[s.id] = s; });
    if (!progressData || !progressData.length) {
      $("detailsBody").innerHTML = '<p class="empty">ما بدأ أي درس بعد.</p>';
      return;
    }
    const rows = progressData.map((pr) => {
      const lesson = lessonMap[pr.lesson_id] || {};
      const section = sectionMap[lesson.section_id] || {};
      const pct = pr.percent || (pr.completed ? 100 : 0);
      const done = pr.completed || pct >= 90;
      return `<div class="detail-row ${done ? "done" : ""}">
        <div class="detail-info">
          <div class="detail-lesson">${esc(lesson.title || "درس محذوف")}</div>
          <div class="detail-section">${esc(section.title || "")}</div>
        </div>
        <div class="detail-pct">
          <div class="detail-bar"><div class="detail-fill" style="width:${pct}%"></div></div>
          <span>${pct}%</span>
        </div>
      </div>`;
    });
    $("detailsBody").innerHTML = `<div class="detail-summary">${progressData.length} درس بدأه · ${progressData.filter((p) => p.completed || (p.percent || 0) >= 90).length} مكتمل</div>` + rows.join("");
  } catch (e) {
    $("detailsBody").innerHTML = `<p class="empty">خطأ: ${esc(e.message)}</p>`;
  }
}
function fmtJoin(iso) { try { const d = new Date(iso); return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`; } catch (_) { return "—"; } }
function fmtCallDT(iso) { try { return new Date(iso).toLocaleString("ar", { dateStyle: "medium", timeStyle: "short" }); } catch (_) { return "—"; } }
function toLocalInput(iso) { if (!iso) return ""; try { const d = new Date(iso), p = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; } catch (_) { return ""; } }
function fmtCallDate(iso) { try { const d = new Date(iso), p = (n) => String(n).padStart(2, "0"); let h = d.getHours(); const ap = h < 12 ? "ص" : "م"; h = h % 12 || 12; return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()} · ${h}:${p(d.getMinutes())} ${ap}`; } catch (_) { return "—"; } }
async function loadGroupCall() {
  let rows = [];
  try { rows = await dbGet("group_calls?select=id,call_at,duration_min&order=call_at.desc"); } catch (_) {}
  const now = Date.now();
  // املأ الحقل بأقرب مكالمة قادمة/جارية (إن وُجدت)
  const active = (rows || []).filter((r) => now < new Date(r.call_at).getTime() + (r.duration_min || 75) * 60000).sort((a, b) => new Date(a.call_at) - new Date(b.call_at))[0];
  if ($("groupCallAt")) $("groupCallAt").value = active ? toLocalInput(active.call_at) : "";
  if ($("groupCallDur")) $("groupCallDur").value = active ? (active.duration_min || 75) : 75;
  // قائمة كل المكالمات (مكتملة بعلامة ✓)
  const list = $("callsAdminList");
  if (list) {
    if (!rows || !rows.length) { list.innerHTML = '<p class="hint">ما في مكالمات مجدولة بعد.</p>'; }
    else list.innerHTML = rows.map((r) => {
      const ended = now >= new Date(r.call_at).getTime() + (r.duration_min || 75) * 60000;
      return `<div class="call-adm-row ${ended ? "done" : ""}">
        <span class="call-adm-ic">${ended ? "✓" : "📅"}</span>
        <div class="call-adm-body"><b>${fmtCallDate(r.call_at)}</b><small>${ended ? "اكتملت" : "قادمة"} · ${toLocalNum(r.duration_min || 75)} دقيقة</small></div>
        <button class="btn btn-danger btn-sm del-call" data-id="${r.id}">حذف</button>
      </div>`;
    }).join("");
    list.querySelectorAll(".del-call").forEach((b) => b.addEventListener("click", async () => {
      if (!confirm("حذف هذه المكالمة؟")) return;
      try { await dbSend("DELETE", `group_calls?id=eq.${b.dataset.id}`, null, "return=minimal"); loadGroupCall(); } catch (e) { alert("خطأ: " + e.message); }
    }));
  }
}
function toLocalNum(n) { return String(n).replace(/[0-9]/g, (d) => "٠١٢٣٤٥٦٧٨٩"[d]); }
(function () {
  const b = $("saveGroupCall"); if (!b) return;
  b.addEventListener("click", async () => {
    const msg = $("groupCallMsg"), v = $("groupCallAt").value;
    if (!v) { setMsg(msg, "اختر التاريخ والوقت أولاً", false); return; }
    const iso = new Date(v).toISOString(), dur = parseInt(($("groupCallDur") || {}).value || "75", 10) || 75;
    b.disabled = true; setMsg(msg, "جارٍ الحفظ…", true);
    try {
      // مكالمة جديدة تتراكم في الأرشيف (تظهر مكتملة تلقائيًا بعد انتهاء وقتها)
      await dbSend("POST", "group_calls", { call_at: iso, duration_min: dur }, "return=minimal");
      // إشعار تلقائي لكل المشتركين
      await dbSend("POST", "notifications", { title: "موعد مكالمة جماعية جديدة", body: `المكالمة يوم ${fmtCallDate(iso)} — جهّز أسئلتك من صفحة «مكالماتي».`, kind: "call" }, "return=minimal");
      setMsg(msg, "تم — وانرسل إشعار لكل المشتركين ✅", true);
      loadGroupCall();
    } catch (e) { setMsg(msg, "خطأ: " + e.message, false); }
    b.disabled = false;
  });
})();
// إرسال إشعار عام لكل المشتركين
(function () {
  const b = $("sendNotifBtn"); if (!b) return;
  b.addEventListener("click", async () => {
    const msg = $("notifMsg"), t = ($("notifTitle").value || "").trim(), body = ($("notifBody").value || "").trim();
    if (!t) { setMsg(msg, "اكتب عنوان الإشعار", false); return; }
    b.disabled = true; setMsg(msg, "جارٍ الإرسال…", true);
    try {
      await dbSend("POST", "notifications", { title: t, body: body || null, kind: "general" }, "return=minimal");
      $("notifTitle").value = ""; $("notifBody").value = "";
      setMsg(msg, "تم إرسال الإشعار لكل المشتركين ✅", true);
      loadNotifsAdmin();
    } catch (e) { setMsg(msg, "خطأ: " + e.message, false); }
    b.disabled = false;
  });
})();
async function loadNotifsAdmin() {
  const list = $("notifAdminList"); if (!list) return;
  let rows = [];
  try { rows = await dbGet("notifications?select=id,title,body,kind,created_at&order=created_at.desc&limit=20"); } catch (_) {}
  if (!rows || !rows.length) { list.innerHTML = '<p class="hint">ما أرسلت إشعارات بعد.</p>'; return; }
  list.innerHTML = rows.map((n) => `<div class="notif-adm-row"><div class="notif-adm-body"><b>${esc(n.title)}</b>${n.body ? `<small>${esc(n.body)}</small>` : ""}</div><button class="btn btn-danger btn-sm del-notif" data-id="${n.id}">حذف</button></div>`).join("");
  list.querySelectorAll(".del-notif").forEach((b) => b.addEventListener("click", async () => {
    try { await dbSend("DELETE", `notifications?id=eq.${b.dataset.id}`, null, "return=minimal"); loadNotifsAdmin(); } catch (e) { alert("خطأ: " + e.message); }
  }));
}
async function rpc(fn, body) {
  const r = await fetchT(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: "Bearer " + TOKEN },
    body: JSON.stringify(body || {}),
  }, 20000);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
async function callEdge(body, ms = 20000) {
  const r = await fetchT(`${SUPABASE_URL}/functions/v1/hyper-action`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: "Bearer " + TOKEN },
    body: JSON.stringify(body),
  }, ms);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || ("HTTP " + r.status));
  return d;
}

async function subAction(btn, action) {
  const uid = btn.dataset.uid, name = btn.dataset.name || "المشترك";
  const susp = btn.dataset.susp === "1";
  let body, ok;
  if (action === "reset_device") { if (!confirm(`فك ربط الجهاز عن «${name}»؟\nراح يقدر يدخل من جهاز جديد.`)) return; body = { action, user_id: uid }; }
  else if (action === "set_suspended") { const turnOn = !susp; if (!confirm(turnOn ? `إيقاف «${name}»؟\nراح ينحظر وصوله للدورات فورًا.` : `تفعيل «${name}» من جديد؟`)) return; body = { action, user_id: uid, suspended: turnOn }; }
  else if (action === "delete_subscriber") { if (!confirm(`⚠️ حذف «${name}» نهائيًا؟\nراح ينحذف حسابه وكل بياناته ولا يقدر يدخل أبدًا.\nهذا الإجراء لا يمكن التراجع عنه.`)) return; body = { action, user_id: uid }; }
  btn.disabled = true; const old = btn.textContent; btn.textContent = "…";
  try { await callEdge(body); loadSubscribers(); }
  catch (e) { alert("خطأ: " + e.message); btn.disabled = false; btn.textContent = old; }
}

$("createSubBtn").addEventListener("click", async () => {
  const msg = $("subMsg"), btn = $("createSubBtn");
  const name = $("subName").value.trim(), email = $("subEmail").value.trim(), password = $("subPass").value;
  if (!email || !password) { setMsg(msg, "اكتب الإيميل وكلمة السر.", false); return; }
  btn.disabled = true; setMsg(msg, "جارٍ إنشاء الحساب…", true);
  try {
    const r = await fetchT(`${SUPABASE_URL}/functions/v1/hyper-action`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: "Bearer " + TOKEN },
      body: JSON.stringify({ name, email, password }),
    }, 25000);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || ("HTTP " + r.status + " — تأكّد إنك نشرت الدالة hyper-action"));
    setMsg(msg, `تم إنشاء حساب «${d.name || email}» ✅ — أرسل له الإيميل وكلمة السر.`, true);
    $("subName").value = ""; $("subEmail").value = ""; $("subPass").value = "";
    loadSubscribers();
  } catch (e) { setMsg(msg, "خطأ: " + e.message, false); }
  btn.disabled = false;
});

// ====== التعليقات ======
async function loadComments() {
  const rows = $("commentsRows");
  rows.innerHTML = '<p class="hint">جارٍ التحميل…</p>';
  try {
    const data = await dbGet("reviews?select=*&order=created_at.desc");
    $("commentsCount").textContent = (data?.length || 0) + " تعليق";
    if (!data || !data.length) { rows.innerHTML = '<p class="empty">لا توجد تعليقات بعد.</p>'; return; }
    rows.innerHTML = data.map((r) => {
      const n = Math.max(1, Math.min(5, r.stars || 5));
      return `<div class="crow ${r.hidden ? "hidden-row" : ""}" data-id="${r.id}">
        <div class="c-main">
          <div class="c-stars">${"★".repeat(n)}</div>
          <div class="c-name">${esc(r.name)}</div>
          <div class="c-text">${esc(r.comment)}</div>
        </div>
        <div class="c-actions">
          <button class="btn btn-ghost btn-sm act-hide">${r.hidden ? "إظهار" : "إخفاء"}</button>
          <button class="btn btn-danger btn-sm act-del">حذف</button>
        </div>
      </div>`;
    }).join("");
    rows.querySelectorAll(".crow").forEach((row) => {
      const id = row.dataset.id;
      row.querySelector(".act-hide").addEventListener("click", async (e) => {
        const hide = e.target.textContent === "إخفاء";
        e.target.disabled = true;
        try { await dbSend("PATCH", `reviews?id=eq.${id}`, { hidden: hide }); loadComments(); }
        catch (x) { e.target.disabled = false; alert("خطأ: " + x.message); }
      });
      row.querySelector(".act-del").addEventListener("click", async () => {
        if (!confirm("حذف هذا التعليق نهائيًا؟")) return;
        try { await dbSend("DELETE", `reviews?id=eq.${id}`); loadComments(); }
        catch (x) { alert("خطأ: " + x.message); }
      });
    });
  } catch (x) { rows.innerHTML = `<p class="empty">خطأ: ${esc(x.message)}</p>`; }
}

// ====== الفيديو ======
async function getContent(key) {
  const rows = await dbGet(`site_content?key=eq.${key}&select=value`);
  return rows && rows[0] ? rows[0].value : null;
}
async function setContent(key, value) {
  return dbSend("POST", "site_content?on_conflict=key",
    { key, value, updated_at: new Date().toISOString() },
    "resolution=merge-duplicates,return=minimal");
}

let videoVal = {};
async function loadVideo() {
  try { videoVal = (await getContent("video")) || {}; } catch (_) { videoVal = {}; }
  if (videoVal.url) { $("videoPreview").src = videoVal.url; $("videoUrlNow").textContent = videoVal.url; }
  else $("videoUrlNow").textContent = "يُستخدم الفيديو الافتراضي بالموقع.";
  if (videoVal.poster) { $("posterPreview").src = videoVal.poster; $("posterPreview").hidden = false; }
  renderChapters(videoVal.chapters || [{ t: 0, label: "الانترو" }]);
}

$("saveVideoBtn").addEventListener("click", async () => {
  const btn = $("saveVideoBtn"), msg = $("videoMsg"); btn.disabled = true;
  try {
    let url = $("videoUrl").value.trim();
    const file = $("videoFile").files[0];
    if (file) { setMsg(msg, "جارٍ رفع الفيديو… قد ياخذ وقت", true); url = await uploadFile(file); }
    if (!url) { setMsg(msg, "اختر ملف أو الصق رابط.", false); btn.disabled = false; return; }
    videoVal.url = url;
    await setContent("video", videoVal);
    setMsg(msg, "تم حفظ الفيديو ✅", true); loadVideo();
  } catch (e) { setMsg(msg, "خطأ: " + e.message, false); }
  btn.disabled = false;
});

$("savePosterBtn").addEventListener("click", async () => {
  const btn = $("savePosterBtn"), msg = $("posterMsg"); btn.disabled = true;
  try {
    const file = $("posterFile").files[0];
    if (!file) { setMsg(msg, "اختر صورة غلاف.", false); btn.disabled = false; return; }
    setMsg(msg, "جارٍ الرفع…", true);
    videoVal.poster = await uploadFile(file);
    await setContent("video", videoVal);
    setMsg(msg, "تم حفظ الغلاف ✅", true); loadVideo();
  } catch (e) { setMsg(msg, "خطأ: " + e.message, false); }
  btn.disabled = false;
});

$("delPosterBtn").addEventListener("click", async () => {
  const msg = $("posterMsg");
  if (!confirm("حذف صورة الغلاف؟")) return;
  try {
    videoVal.poster = null;
    await setContent("video", videoVal);
    $("posterPreview").hidden = true; $("posterPreview").src = "";
    setMsg(msg, "تم حذف الغلاف ✅", true);
  } catch (e) { setMsg(msg, "خطأ: " + e.message, false); }
});

// الفصول
function renderChapters(chs) { $("chaptersRows").innerHTML = ""; chs.forEach((ch) => addChapterRow(ch.label, ch.t)); }
function addChapterRow(label = "", t = 0) {
  const div = document.createElement("div");
  div.className = "chapter-row";
  div.innerHTML = `<input class="fld ch-l" placeholder="اسم الفصل" value="${esc(label)}" />
    <input class="fld ch-t" type="number" min="0" placeholder="ثانية" value="${t}" />
    <button class="x" title="حذف">✕</button>`;
  div.querySelector(".x").addEventListener("click", () => div.remove());
  $("chaptersRows").appendChild(div);
}
$("addChapterBtn").addEventListener("click", () => addChapterRow());
$("saveChaptersBtn").addEventListener("click", async () => {
  const msg = $("chaptersMsg");
  const chapters = [...document.querySelectorAll(".chapter-row")].map((r) => ({
    label: r.querySelector(".ch-l").value.trim(),
    t: parseFloat(r.querySelector(".ch-t").value) || 0,
  })).filter((c) => c.label).sort((a, b) => a.t - b.t);
  videoVal.chapters = chapters;
  try { await setContent("video", videoVal); setMsg(msg, "تم حفظ الفصول ✅", true); }
  catch (e) { setMsg(msg, "خطأ: " + e.message, false); }
});

// ====== الصور (قنوات + نماذج شغل) ======
async function loadMedia(kind) {
  const grid = kind === "channel" ? $("channelsGrid") : $("worksGrid");
  grid.innerHTML = '<p class="hint">جارٍ التحميل…</p>';
  try {
    const data = await dbGet(`media?kind=eq.${kind}&select=*&order=sort.asc,created_at.asc`);
    if (!data || !data.length) { grid.innerHTML = `<p class="empty">لا توجد عناصر بعد.</p>`; return; }
    grid.innerHTML = data.map((m) => {
      const isVid = /\.(mp4|webm|mov)$/i.test(m.url);
      const media = isVid ? `<video src="${esc(m.url)}" muted></video>` : `<img src="${esc(m.url)}" alt="" />`;
      const cap = kind === "channel" ? (m.title || "") : (m.meta ? "▶ " + m.meta : "");
      return `<div class="media-item ${kind === "work" ? "work-item" : ""}" data-id="${m.id}">
        ${media}${cap ? `<span class="cap">${esc(cap)}</span>` : ""}
        <button class="del" title="حذف">✕</button></div>`;
    }).join("");
    grid.querySelectorAll(".media-item").forEach((it) => {
      it.querySelector(".del").addEventListener("click", async () => {
        if (!confirm("حذف هذا العنصر؟")) return;
        try { await dbSend("DELETE", `media?id=eq.${it.dataset.id}`); loadMedia(kind); }
        catch (x) { alert("خطأ: " + x.message); }
      });
    });
  } catch (x) { grid.innerHTML = `<p class="empty">خطأ: ${esc(x.message)}</p>`; }
}

async function addMedia(kind, fileInput, titleVal, metaVal, msgEl, titleInput, metaInput) {
  const file = fileInput.files[0];
  if (!file) { setMsg(msgEl, "اختر ملف أول.", false); return; }
  setMsg(msgEl, "جارٍ الرفع…", true);
  try {
    const url = await uploadFile(file);
    await dbSend("POST", "media", { kind, url, title: titleVal || null, meta: metaVal || null }, "return=minimal");
    setMsg(msgEl, "تمت الإضافة ✅", true);
    fileInput.value = ""; if (titleInput) titleInput.value = ""; if (metaInput) metaInput.value = "";
    loadMedia(kind);
  } catch (e) { setMsg(msgEl, "خطأ: " + e.message, false); }
}

$("addChannelBtn").addEventListener("click", () =>
  addMedia("channel", $("channelFile"), $("channelTitle").value.trim(), null, $("channelMsg"), $("channelTitle"), null));
$("addWorkBtn").addEventListener("click", () =>
  addMedia("work", $("workFile"), null, $("workMeta").value.trim(), $("workMsg"), null, $("workMeta")));

// ====== الدورات (أقسام + دروس) ======
function parseEmbed(s) {
  s = (s || "").trim();
  const m = s.match(/src=["']([^"']+)["']/i);
  return m ? m[1] : s; // لو لصق iframe كامل ناخذ src، وإلا الرابط نفسه
}
function parseChapters(text) {
  return (text || "").split("\n").map((l) => l.trim()).filter(Boolean).map((line) => {
    const m = line.match(/^(?:(\d+):)?(\d{1,2}(?:\.\d+)?)\s+(.+)$/); // «M:SS عنوان» أو «SS عنوان»
    if (!m) return null;
    const t = m[1] ? (+m[1]) * 60 + parseFloat(m[2]) : parseFloat(m[2]);
    return { t, label: m[3].trim() };
  }).filter(Boolean).sort((a, b) => a.t - b.t);
}

async function loadCourses() {
  const wrap = $("sectionsList");
  if (!wrap) return;
  wrap.innerHTML = '<p class="hint">جارٍ التحميل…</p>';
  try {
    const sections = await dbGet("sections?select=*&order=sort.asc,created_at.asc");
    const lessons = await dbGet("lessons?select=*&order=sort.asc,created_at.asc");
    if (!sections.length) { wrap.innerHTML = '<p class="empty">لا توجد أقسام بعد. أضف قسمًا من فوق.</p>'; return; }
    wrap.innerHTML = sections.map((sec) => {
      const ls = lessons.filter((l) => l.section_id === sec.id);
      return `<div class="card sec-card" data-sid="${sec.id}">
        <div class="sec-head"><h3>${esc(sec.title)}</h3><button class="btn btn-danger btn-sm sec-del">حذف القسم</button></div>
        <div class="sec-cover-row">
          ${sec.cover_url ? `<img src="${esc(sec.cover_url)}" class="sec-cover-img" alt="">` : `<div class="sec-cover-img empty-thumb">${ic("book")}</div>`}
          <input type="file" class="fld sec-cover-file" accept="image/*" />
          <button class="btn btn-ghost btn-sm sec-cover-btn">حفظ غلاف الدورة</button>
          <span class="msg sec-cover-msg"></span>
        </div>
        <div class="lessons">${ls.map((l) => `<div class="lesson-row" data-lid="${l.id}">
          ${l.thumb_url ? `<img src="${esc(l.thumb_url)}" class="lesson-thumb" alt="">` : `<div class="lesson-thumb empty-thumb">${ic("film")}</div>`}
          <div class="lesson-info"><b>${esc(l.title)}</b><small>${(l.chapters || []).length} فصل · ${l.embed_url ? "فيديو ✔" : "بلا فيديو"}${l.description ? " · وصف ✔" : ""}${l.folder ? ` · مجلّد: ${esc(l.folder)}` : ""}</small></div>
          <button class="btn btn-ghost btn-sm icon-btn lesson-edit">${ic("pencil")} تعديل</button>
          <button class="btn btn-danger btn-sm lesson-del">حذف</button>
          <div class="lesson-editor" hidden>
            <label class="lbl">عنوان الفيديو</label>
            <input type="text" class="fld le-title" value="${esc(l.title)}" />
            <label class="lbl">المجلد / الموضوع (اختياري) — اكتب نفس الاسم لعدة دروس ليتجمّعون تحت مجلّد واحد</label>
            <input type="text" class="fld le-folder" value="${esc(l.folder || "")}" placeholder="مثلاً: أساسيات التلوين" />
            <label class="lbl">رابط Bunny (iframe) — اتركه فاضي إذا ما تبي تغيّره</label>
            <input type="text" class="fld le-embed" value="${esc(l.embed_url || "")}" placeholder="https://iframe.mediadelivery.net/embed/..." />
            <label class="lbl">الوصف / الروابط والمرفقات (يظهر تحت الفيديو للمشترك)</label>
            <textarea class="fld le-desc" rows="4" placeholder="اكتب الوصف والروابط هنا...">${esc(l.description || "")}</textarea>
            <button class="btn btn-primary btn-sm le-save">حفظ التعديلات</button>
            <span class="msg le-msg"></span>
          </div></div>`).join("") || '<p class="hint">لا دروس بعد.</p>'}</div>
        <p class="hint folder-hint"><b>تبي تجمع فيديوهات بمجلّد؟</b> اضغط «تعديل» على الدروس واكتب لهم <b>نفس اسم المجلّد</b> في خانة «المجلد/الموضوع» — وراح يتجمّعون تلقائيًا تحت مجلّد واحد عند المشترك.</p>
        <details class="add-lesson">
          <summary>＋ إضافة درس</summary>
          <input type="text" class="fld l-title" placeholder="عنوان الدرس" />
          <input type="text" class="fld l-folder" placeholder="المجلد/الموضوع (اختياري) — نفس الاسم يجمع عدة دروس" />
          <input type="text" class="fld l-embed" placeholder="رابط Bunny (iframe embed) أو الصق كود iframe" />
          <label class="lbl">صورة مصغّرة (ثَمنيل)</label>
          <input type="file" class="fld l-thumb" accept="image/*" />
          <label class="lbl">الفصول — سطر لكل فصل: «1:30 عنوان الفصل»</label>
          <textarea class="fld l-chapters" rows="3" placeholder="0:00 المقدمة
1:30 الجزء الأول"></textarea>
          <button class="btn btn-primary btn-sm l-add">حفظ الدرس</button>
          <p class="msg l-msg"></p>
        </details></div>`;
    }).join("");

    wrap.querySelectorAll(".sec-card").forEach((card) => {
      const sid = card.dataset.sid;
      card.querySelector(".sec-del").addEventListener("click", async () => {
        if (!confirm("حذف القسم وكل دروسه؟")) return;
        try { await dbSend("DELETE", `sections?id=eq.${sid}`); loadCourses(); } catch (x) { alert("خطأ: " + x.message); }
      });
      const cvBtn = card.querySelector(".sec-cover-btn");
      cvBtn.addEventListener("click", async () => {
        const msg = card.querySelector(".sec-cover-msg");
        const file = card.querySelector(".sec-cover-file").files[0];
        if (!file) { setMsg(msg, "اختر صورة.", false); return; }
        cvBtn.disabled = true; setMsg(msg, "جارٍ الرفع…", true);
        try {
          const url = await uploadFile(file);
          await dbSend("PATCH", `sections?id=eq.${sid}`, { cover_url: url });
          loadCourses();
        } catch (x) { setMsg(msg, "خطأ: " + x.message, false); cvBtn.disabled = false; }
      });
      card.querySelectorAll(".lesson-row").forEach((row) => {
        row.querySelector(".lesson-del").addEventListener("click", async () => {
          if (!confirm("حذف الدرس؟")) return;
          try { await dbSend("DELETE", `lessons?id=eq.${row.dataset.lid}`); loadCourses(); } catch (x) { alert("خطأ: " + x.message); }
        });
        const editBtn = row.querySelector(".lesson-edit"), editor = row.querySelector(".lesson-editor");
        if (editBtn && editor) editBtn.addEventListener("click", () => { editor.hidden = !editor.hidden; });
        const saveBtn = row.querySelector(".le-save");
        if (saveBtn) saveBtn.addEventListener("click", async () => {
          const msg = row.querySelector(".le-msg");
          const title = row.querySelector(".le-title").value.trim();
          if (!title) { setMsg(msg, "العنوان مطلوب.", false); return; }
          const embedRaw = row.querySelector(".le-embed").value.trim();
          const desc = row.querySelector(".le-desc").value.trim();
          const folder = row.querySelector(".le-folder").value.trim();
          const patch = { title, description: desc || null, folder: folder || null };
          if (embedRaw) patch.embed_url = parseEmbed(embedRaw);
          saveBtn.disabled = true; setMsg(msg, "جارٍ الحفظ…", true);
          try {
            await dbSend("PATCH", `lessons?id=eq.${row.dataset.lid}`, patch);
            setMsg(msg, "تم الحفظ ✅", true);
            row.querySelector(".lesson-info b").textContent = title;
          } catch (x) { setMsg(msg, "خطأ: " + x.message, false); }
          saveBtn.disabled = false;
        });
      });
      const addBtn = card.querySelector(".l-add");
      addBtn.addEventListener("click", async () => {
        const msg = card.querySelector(".l-msg");
        const title = card.querySelector(".l-title").value.trim();
        if (!title) { setMsg(msg, "اكتب عنوان الدرس.", false); return; }
        const embed = parseEmbed(card.querySelector(".l-embed").value);
        const folder = card.querySelector(".l-folder").value.trim();
        const chapters = parseChapters(card.querySelector(".l-chapters").value);
        const file = card.querySelector(".l-thumb").files[0];
        addBtn.disabled = true; setMsg(msg, "جارٍ الحفظ…", true);
        try {
          let thumb = null;
          if (file) thumb = await uploadFile(file);
          await dbSend("POST", "lessons", { section_id: sid, title, embed_url: embed || null, thumb_url: thumb, chapters, folder: folder || null }, "return=minimal");
          loadCourses();
        } catch (x) { setMsg(msg, "خطأ: " + x.message, false); addBtn.disabled = false; }
      });
    });
  } catch (x) { wrap.innerHTML = `<p class="empty">خطأ: ${esc(x.message)}</p>`; }
}

$("bulkBtn").addEventListener("click", async () => {
  const msg = $("bulkMsg");
  const lines = $("bulkBox").value.split("\n").map((l) => l.trim()).filter(Boolean);
  if (!lines.length) { setMsg(msg, "الصق الدروس أول.", false); return; }
  const btn = $("bulkBtn"); btn.disabled = true; setMsg(msg, "جارٍ الاستيراد…", true);
  try {
    let sections = await dbGet("sections?select=id,title");
    const findOrCreate = async (name) => {
      let s = sections.find((x) => x.title === name);
      if (s) return s.id;
      const created = await dbSend("POST", "sections", { title: name, sort: sections.length }, "return=representation");
      const id = created[0].id; sections.push({ id, title: name }); return id;
    };
    let count = 0;
    for (const line of lines) {
      const parts = line.split("|").map((p) => p.trim());
      if (parts.length < 3) continue;
      const sid = await findOrCreate(parts[0]);
      await dbSend("POST", "lessons", { section_id: sid, title: parts[1], embed_url: parseEmbed(parts[2]), description: parts[3] || null, sort: count }, "return=minimal");
      count++;
    }
    setMsg(msg, `تم استيراد ${count} درس ✅`, true);
    $("bulkBox").value = ""; loadCourses();
  } catch (e) { setMsg(msg, "خطأ: " + e.message, false); }
  btn.disabled = false;
});

$("addSectionBtn").addEventListener("click", async () => {
  const msg = $("sectionMsg");
  const title = $("newSectionTitle").value.trim();
  if (!title) { setMsg(msg, "اكتب اسم القسم.", false); return; }
  try {
    const n = await dbGet("sections?select=sort&order=sort.desc&limit=1");
    const sort = n && n[0] ? (n[0].sort || 0) + 1 : 0;
    await dbSend("POST", "sections", { title, sort }, "return=minimal");
    $("newSectionTitle").value = ""; setMsg(msg, "تمت الإضافة ✅", true); loadCourses();
  } catch (x) { setMsg(msg, "خطأ: " + x.message, false); }
});

// ========== صور ردود الفعل ==========
// الصور المحلية كـ fallback
const LOCAL_FEEDBACK = [
  { id: 1, url: "assets/feedback/feedback-1.png", sort: 0 },
  { id: 2, url: "assets/feedback/feedback-2.png", sort: 1 },
  { id: 3, url: "assets/feedback/feedback-3.png", sort: 2 },
];
let feedbackUsingLocal = false;

async function loadFeedback() {
  const grid = $("feedbackGrid");
  if (!grid) return;
  grid.innerHTML = '<p class="empty">جارٍ التحميل…</p>';

  let items = [];
  feedbackUsingLocal = false;

  try {
    items = await dbGet("feedback_images?select=*&order=sort.asc");
  } catch (x) {
    // أي خطأ = استخدم الصور المحلية
    console.log("Feedback DB error, using local:", x.message);
    feedbackUsingLocal = true;
    items = LOCAL_FEEDBACK;
    const msg = $("feedbackMsg");
    if (msg) setMsg(msg, "⚠️ الجدول مو موجود. شغّل feedback-setup.sql", false);
  }

  if (!items.length) { grid.innerHTML = '<p class="empty">لا توجد صور. أضف صورة أعلاه.</p>'; return; }

  grid.innerHTML = items.map((it, i) => `
    <div class="feedback-item" draggable="true" data-id="${it.id}" data-sort="${it.sort}" data-url="${esc(it.url)}">
      <span class="fb-order">${i + 1}</span>
      <img src="${esc(it.url)}" alt="ردود فعل" />
      ${feedbackUsingLocal ? '' : '<button class="del" title="حذف">✕</button>'}
    </div>
  `).join("");

  initFeedbackDrag();

  if (!feedbackUsingLocal) {
    grid.querySelectorAll(".del").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (!confirm("حذف الصورة؟")) return;
        const id = btn.closest(".feedback-item").dataset.id;
        try { await dbSend("DELETE", `feedback_images?id=eq.${id}`); loadFeedback(); } catch (x) { alert("خطأ: " + x.message); }
      });
    });
  }
}

function initFeedbackDrag() {
  const grid = $("feedbackGrid");
  const items = grid.querySelectorAll(".feedback-item");
  let dragItem = null;

  items.forEach(item => {
    item.addEventListener("dragstart", () => { dragItem = item; item.classList.add("dragging"); });
    item.addEventListener("dragend", () => { item.classList.remove("dragging"); saveFeedbackOrder(); });
    item.addEventListener("dragover", (e) => { e.preventDefault(); });
    item.addEventListener("drop", (e) => {
      e.preventDefault();
      if (dragItem && dragItem !== item) {
        const allItems = [...grid.querySelectorAll(".feedback-item")];
        const fromIdx = allItems.indexOf(dragItem);
        const toIdx = allItems.indexOf(item);
        if (fromIdx < toIdx) item.after(dragItem);
        else item.before(dragItem);
      }
    });
  });
}

async function saveFeedbackOrder() {
  const grid = $("feedbackGrid");
  const items = grid.querySelectorAll(".feedback-item");

  // لو الصور محلية، حدّث الأرقام بس بدون حفظ
  if (feedbackUsingLocal) {
    items.forEach((el, i) => {
      el.querySelector(".fb-order").textContent = i + 1;
    });
    return;
  }

  const updates = [...items].map((el, i) => ({ id: parseInt(el.dataset.id), sort: i }));
  for (const u of updates) {
    try { await dbSend("PATCH", `feedback_images?id=eq.${u.id}`, { sort: u.sort }); } catch (x) { console.error(x); }
  }
  loadFeedback();
}

$("addFeedbackBtn")?.addEventListener("click", async () => {
  const msg = $("feedbackMsg");

  // لو الجدول مو موجود، ما نقدر نضيف
  if (feedbackUsingLocal) {
    setMsg(msg, "⚠️ شغّل feedback-setup.sql في Supabase أولًا عشان تقدر تضيف صور.", false);
    return;
  }

  const file = $("feedbackFile").files[0];
  if (!file) { setMsg(msg, "اختر صورة.", false); return; }
  const btn = $("addFeedbackBtn"); btn.disabled = true; setMsg(msg, "جارٍ الرفع…", true);
  try {
    const url = await uploadFile(file);
    const n = await dbGet("feedback_images?select=sort&order=sort.desc&limit=1");
    const sort = n && n[0] ? (n[0].sort || 0) + 1 : 0;
    await dbSend("POST", "feedback_images", { url, sort }, "return=minimal");
    $("feedbackFile").value = ""; setMsg(msg, "تمت الإضافة ✅", true); loadFeedback();
  } catch (x) { setMsg(msg, "خطأ: " + x.message, false); }
  btn.disabled = false;
});

// تحميل الصور عند الدخول
if ($("feedbackGrid")) loadFeedback();
