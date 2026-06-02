#!/bin/zsh
# ثَمين — يفحص مجلد الصور ويكتب gallery.js تلقائيًا.
# الاستخدام: انقر مرتين على هذا الملف بعد ما تضيف صورك في assets/images/

cd "$(dirname "$0")" || exit 1
IMG_DIR="assets/images"

setopt nullglob nocaseglob extendedglob

# اجمع الصور (jpg/jpeg/png/webp/gif/svg) مرتبة أبجديًا، تجاهل الملفات المخفية
files=()
for f in "$IMG_DIR"/*.(jpg|jpeg|png|webp|gif|svg); do
  base="${f:t}"
  [[ "$base" == .* ]] && continue
  files+=("$base")
done
files=(${(o)files})   # ترتيب أبجدي

# اكتب gallery.js
{
  echo "/* ملف مولّد تلقائيًا بواسطة update-gallery.command — لا تعدّله يدويًا */"
  echo "window.GALLERY = ["
  for b in $files; do
    # هروب علامات الاقتباس المفردة في اسم الملف
    safe="${b//\'/\\\'}"
    echo "  'assets/images/${safe}',"
  done
  echo "];"
} > gallery.js

echo "تم تحديث المعرض: ${#files} صورة."
echo "حدّث الصفحة في المتصفح لرؤية التغيير."
