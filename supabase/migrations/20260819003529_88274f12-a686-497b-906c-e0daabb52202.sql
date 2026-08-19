-- Phase 2: data backfill + family naming (idempotent, no policy/function changes)

-- 1. Household owners become family members
INSERT INTO public.family_members (family_id, user_id, relationship)
SELECT f.id, f.profile_id, 'primary'
FROM public.families f
WHERE f.profile_id IS NOT NULL
ON CONFLICT (family_id, user_id) DO NOTHING;

-- 2. Existing per-recipient links promoted to family level
INSERT INTO public.family_members (family_id, user_id, relationship)
SELECT DISTINCT r.family_id, cfm.user_id, cfm.relationship
FROM public.client_family_members cfm
JOIN public.care_recipients r ON r.id = cfm.care_recipient_id
WHERE r.family_id IS NOT NULL
ON CONFLICT (family_id, user_id) DO NOTHING;

-- 3. Name families that have none
UPDATE public.families f
SET name = COALESCE(
  'Familia ' || NULLIF(split_part(p.full_name, ' ', 2), ''),
  'Familia ' || NULLIF(p.full_name, ''),
  'Familia ' || left(f.id::text, 8)
)
FROM public.profiles p
WHERE p.id = f.profile_id AND f.name IS NULL;

UPDATE public.families f
SET name = 'Familia ' || left(f.id::text, 8)
WHERE f.name IS NULL;