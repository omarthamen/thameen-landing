-- ===========================================================
--  إصلاح تتبع المشاهدات — شغّله مرة في SQL Editor
-- ===========================================================

-- 1) إضافة عمود percent لجدول progress (لو ما كان موجود)
ALTER TABLE public.progress ADD COLUMN IF NOT EXISTS percent int DEFAULT 0;

-- 2) دالة إحصائيات المشتركين للأدمن
CREATE OR REPLACE FUNCTION public.admin_subscriber_stats()
RETURNS TABLE (
  user_id uuid,
  name text,
  joined timestamptz,
  device_id text,
  suspended boolean,
  completed bigint,
  started bigint,
  top_percent int,
  total bigint,
  messages bigint,
  achievements bigint,
  jobs bigint,
  devices bigint,
  ips bigint,
  last_ip text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  has_device_logs boolean;
BEGIN
  -- تحقق من صلاحية الأدمن
  IF auth.jwt()->>'email' <> 'omarthamen@gmail.com' THEN
    RETURN;
  END IF;

  -- تحقق من وجود جدول device_logs
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'device_logs'
  ) INTO has_device_logs;

  IF has_device_logs THEN
    RETURN QUERY
    SELECT
      p.user_id,
      p.name,
      p.created_at AS joined,
      p.device_id,
      COALESCE(p.suspended, false) AS suspended,
      COALESCE((SELECT COUNT(*) FROM progress pr WHERE pr.user_id = p.user_id AND (pr.completed = true OR COALESCE(pr.percent, 0) >= 90)), 0)::bigint AS completed,
      COALESCE((SELECT COUNT(*) FROM progress pr WHERE pr.user_id = p.user_id AND COALESCE(pr.percent, 0) > 0), 0)::bigint AS started,
      COALESCE((SELECT MAX(COALESCE(pr.percent, 0)) FROM progress pr WHERE pr.user_id = p.user_id), 0)::int AS top_percent,
      (SELECT COUNT(*) FROM lessons)::bigint AS total,
      COALESCE((SELECT COUNT(*) FROM community_messages cm WHERE cm.user_id = p.user_id), 0)::bigint AS messages,
      COALESCE((SELECT COUNT(*) FROM community_messages cm WHERE cm.user_id = p.user_id AND cm.channel = 'achievements'), 0)::bigint AS achievements,
      COALESCE((SELECT COUNT(*) FROM community_messages cm WHERE cm.user_id = p.user_id AND cm.channel = 'jobs'), 0)::bigint AS jobs,
      COALESCE((SELECT COUNT(DISTINCT dl.device_id) FROM device_logs dl WHERE dl.user_id = p.user_id), 1)::bigint AS devices,
      COALESCE((SELECT COUNT(DISTINCT dl.ip) FROM device_logs dl WHERE dl.user_id = p.user_id), 1)::bigint AS ips,
      (SELECT dl.ip FROM device_logs dl WHERE dl.user_id = p.user_id ORDER BY dl.created_at DESC LIMIT 1) AS last_ip
    FROM profiles p
    ORDER BY p.created_at DESC;
  ELSE
    -- بدون device_logs
    RETURN QUERY
    SELECT
      p.user_id,
      p.name,
      p.created_at AS joined,
      p.device_id,
      COALESCE(p.suspended, false) AS suspended,
      COALESCE((SELECT COUNT(*) FROM progress pr WHERE pr.user_id = p.user_id AND (pr.completed = true OR COALESCE(pr.percent, 0) >= 90)), 0)::bigint AS completed,
      COALESCE((SELECT COUNT(*) FROM progress pr WHERE pr.user_id = p.user_id AND COALESCE(pr.percent, 0) > 0), 0)::bigint AS started,
      COALESCE((SELECT MAX(COALESCE(pr.percent, 0)) FROM progress pr WHERE pr.user_id = p.user_id), 0)::int AS top_percent,
      (SELECT COUNT(*) FROM lessons)::bigint AS total,
      COALESCE((SELECT COUNT(*) FROM community_messages cm WHERE cm.user_id = p.user_id), 0)::bigint AS messages,
      COALESCE((SELECT COUNT(*) FROM community_messages cm WHERE cm.user_id = p.user_id AND cm.channel = 'achievements'), 0)::bigint AS achievements,
      COALESCE((SELECT COUNT(*) FROM community_messages cm WHERE cm.user_id = p.user_id AND cm.channel = 'jobs'), 0)::bigint AS jobs,
      1::bigint AS devices,
      1::bigint AS ips,
      NULL::text AS last_ip
    FROM profiles p
    ORDER BY p.created_at DESC;
  END IF;
END;
$$;

-- صلاحية تنفيذ الدالة للمستخدمين المصادقين
GRANT EXECUTE ON FUNCTION public.admin_subscriber_stats() TO authenticated;

-- تم ✅
