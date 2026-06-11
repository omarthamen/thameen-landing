// ثَمين — منطق لوحة التحكّم (Supabase Auth + إدارة المحتوى)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://hwzpjxxfdqsjymxbjokv.supabase.co";
const SUPABASE_KEY = "sb_publishable_mcKOUcVtNy5BkLEd5UcRDA_foJbp3YK";
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const setMsg = (el, text, ok) => { el.textContent = text; el.className = "msg " + (ok ? "ok" : "err"); };

// رفع ملف للتخزين وإرجاع الرابط العام
async function uploadFile(file) {
  const ext = (file.name.split(".").pop() || "bin").toLowerCase();
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await sb.storage.from("media").upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  return sb.storage.from("media").getPublicUrl(path).data.publicUrl;
}

// ====== المصادقة ======
const loginView = $("loginView"), dashView = $("dashView");
function showDash(on) { loginView.hidden = on; dashView.hidden = !on; if (on) loadAll(); }

$("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = $("loginBtn"); btn.disabled = true;
  setMsg($("loginMsg"), "جارٍ الدخول…", true);
  try {
    const signIn = sb.auth.signInWithPassword({
      email: $("email").value.trim(),
      password: $("password").value,
    });
    const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error("انتهت المهلة — تحقّق من الاتصال")), 15000));
    const { data, error } = await Promise.race([signIn, timeout]);
    if (error) { setMsg($("loginMsg"), "بيانات غير صحيحة: " + error.message, false); btn.disabled = false; return; }
    if (data && data.session) { showDash(true); return; }
    setMsg($("loginMsg"), "تعذّر الدخول، حاول مرة ثانية.", false); btn.disabled = false;
  } catch (err) {
    setMsg($("loginMsg"), "خطأ: " + (err && err.message ? err.message : err), false);
    btn.disabled = false;
  }
});

$("logoutBtn").addEventListener("click", async () => { await sb.auth.signOut(); showDash(false); });

sb.auth.getSession().then(({ data }) => showDash(!!data.session));
sb.auth.onAuthStateChange((_e, session) => showDash(!!session));

// ====== التبويبات ======
document.querySelectorAll(".tab").forEach((t) => {
  t.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((x) => x.classList.remove("on"));
    document.querySelectorAll(".panel").forEach((p) => { p.classList.remove("on"); p.hidden = true; });
    t.classList.add("on");
    const p = $("tab-" + t.dataset.tab); p.classList.add("on"); p.hidden = false;
  });
});

function loadAll() { loadComments(); loadVideo(); loadMedia("channel"); loadMedia("work"); }

// ====== التعليقات ======
async function loadComments() {
  const rows = $("commentsRows");
  rows.innerHTML = '<p class="hint">جارٍ التحميل…</p>';
  const { data, error } = await sb.from("reviews").select("*").order("created_at", { ascending: false });
  if (error) { rows.innerHTML = `<p class="empty">خطأ: ${esc(error.message)}</p>`; return; }
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
      const { error } = await sb.from("reviews").update({ hidden: hide }).eq("id", id);
      if (!error) loadComments();
    });
    row.querySelector(".act-del").addEventListener("click", async () => {
      if (!confirm("حذف هذا التعليق نهائيًا؟")) return;
      const { error } = await sb.from("reviews").delete().eq("id", id);
      if (!error) loadComments();
    });
  });
}

// ====== الفيديو ======
async function getContent(key) {
  const { data } = await sb.from("site_content").select("value").eq("key", key).maybeSingle();
  return data?.value || null;
}
async function setContent(key, value) {
  return sb.from("site_content").upsert({ key, value, updated_at: new Date().toISOString() });
}

let videoVal = {};
async function loadVideo() {
  videoVal = (await getContent("video")) || {};
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
    const { error } = await setContent("video", videoVal);
    if (error) throw error;
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
    const { error } = await setContent("video", videoVal);
    if (error) throw error;
    setMsg(msg, "تم حفظ الغلاف ✅", true); loadVideo();
  } catch (e) { setMsg(msg, "خطأ: " + e.message, false); }
  btn.disabled = false;
});

// الفصول
function renderChapters(chs) {
  const wrap = $("chaptersRows"); wrap.innerHTML = "";
  chs.forEach((ch) => addChapterRow(ch.label, ch.t));
}
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
  const { error } = await setContent("video", videoVal);
  setMsg(msg, error ? "خطأ: " + error.message : "تم حفظ الفصول ✅", !error);
});

// ====== الصور (قنوات + نماذج شغل) ======
async function loadMedia(kind) {
  const grid = kind === "channel" ? $("channelsGrid") : $("worksGrid");
  grid.innerHTML = '<p class="hint">جارٍ التحميل…</p>';
  const { data, error } = await sb.from("media").select("*").eq("kind", kind).order("sort").order("created_at");
  if (error) { grid.innerHTML = `<p class="empty">خطأ: ${esc(error.message)}</p>`; return; }
  if (!data || !data.length) { grid.innerHTML = `<p class="empty">لا توجد عناصر بعد.</p>`; return; }
  grid.innerHTML = data.map((m) => {
    const isVid = /\.(mp4|webm|mov)$/i.test(m.url) || m.url.includes("video");
    const media = isVid ? `<video src="${esc(m.url)}" muted></video>` : `<img src="${esc(m.url)}" alt="" />`;
    const cap = kind === "channel" ? (m.title || "") : (m.meta ? "▶ " + m.meta : "");
    return `<div class="media-item ${kind === "work" ? "work-item" : ""}" data-id="${m.id}">
      ${media}${cap ? `<span class="cap">${esc(cap)}</span>` : ""}
      <button class="del" title="حذف">✕</button></div>`;
  }).join("");
  grid.querySelectorAll(".media-item").forEach((it) => {
    it.querySelector(".del").addEventListener("click", async () => {
      if (!confirm("حذف هذا العنصر؟")) return;
      const { error } = await sb.from("media").delete().eq("id", it.dataset.id);
      if (!error) loadMedia(kind);
    });
  });
}

async function addMedia(kind, fileInput, titleVal, metaVal, msgEl, titleInput, metaInput) {
  const file = fileInput.files[0];
  if (!file) { setMsg(msgEl, "اختر ملف أول.", false); return; }
  setMsg(msgEl, "جارٍ الرفع…", true);
  try {
    const url = await uploadFile(file);
    const row = { kind, url, title: titleVal || null, meta: metaVal || null };
    const { error } = await sb.from("media").insert(row);
    if (error) throw error;
    setMsg(msgEl, "تمت الإضافة ✅", true);
    fileInput.value = ""; if (titleInput) titleInput.value = ""; if (metaInput) metaInput.value = "";
    loadMedia(kind);
  } catch (e) { setMsg(msgEl, "خطأ: " + e.message, false); }
}

$("addChannelBtn").addEventListener("click", () =>
  addMedia("channel", $("channelFile"), $("channelTitle").value.trim(), null, $("channelMsg"), $("channelTitle"), null));
$("addWorkBtn").addEventListener("click", () =>
  addMedia("work", $("workFile"), null, $("workMeta").value.trim(), $("workMsg"), null, $("workMeta")));
