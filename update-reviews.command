#!/bin/zsh
# ثَمين — يسحب تعليقات المتجر الحقيقية ويولّد reviews.js تلقائيًا.
# الاستخدام: انقر مرتين على هذا الملف، ثم ارفع التحديث بـ git push.

cd "$(dirname "$0")" || exit 1

python3 - <<'PY'
import json, re, os, urllib.request

URL = "https://www.thameen.shop/api/comments/comments"
req = urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0"})
data = json.load(urllib.request.urlopen(req, timeout=25))
comments = data.get("comments", [])

# كلمات تستبعد التعليق (شكاوى/سلبي/ناقص)
BAD = ["دفعت", "مشكل", "ما اشتغل", "ما يشتغل", "للأحسن", "ما عجب",
       "سيء", "رديء", "بطيء", "لم يعمل", "ماراح", "للاسف", "للأسف"]

seen, out = set(), []
for c in comments:
    txt = (c.get("comment") or "").strip()
    name = (c.get("name") or "").strip()
    stars = c.get("stars") or 5
    if stars < 5:                continue   # 5 نجوم فقط
    if len(txt) < 20:            continue   # تجاهل القصير جدًا/الفاضي
    if txt == name:              continue
    if any(b in txt for b in BAD): continue
    txt = re.sub(r"\s+", " ", txt).strip()
    key = txt[:40]
    if key in seen:              continue
    seen.add(key)
    out.append({"name": name, "comment": txt, "stars": 5})

out = out[:20]  # حد معقول للسلايدر
js = ("/* مولّد تلقائيًا بواسطة update-reviews.command — لا تعدّله يدويًا */\n"
      "window.REVIEWS = " + json.dumps(out, ensure_ascii=False, indent=2) + ";\n")
open("reviews.js", "w", encoding="utf-8").write(js)
print(f"تم توليد reviews.js بعدد {len(out)} تعليق رهيب من متجرك.")
PY

echo "----"
echo "لرفع التحديث للموقع، شغّل:"
echo "   cd ~/thameen-landing && git add -A && git commit -m 'تحديث الشهادات' && git push"
