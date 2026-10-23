-- Security hardening (2026-10-23)
-- Read access to shared canonical ingredients stays available to authenticated users.
-- Direct client inserts/updates are disabled; controlled backend functions retain their elevated rights.
DROP POLICY IF EXISTS "ingredients authenticated insert" ON public.ingredients;
DROP POLICY IF EXISTS "ingredients authenticated update" ON public.ingredients;
REVOKE INSERT, UPDATE ON TABLE public.ingredients FROM anon, authenticated;
