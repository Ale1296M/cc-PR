CREATE OR REPLACE FUNCTION public.profiles_share_care_circle(_viewer uuid, _target uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  -- family member <-> caregiver assigned to a recipient of a family they share
  SELECT EXISTS (
    SELECT 1
    FROM public.family_members fm
    JOIN public.care_recipients r ON r.family_id = fm.family_id
    JOIN public.care_shifts s ON s.care_recipient_id = r.id
    JOIN public.caregivers c ON c.id = s.caregiver_id
    WHERE (fm.user_id = _viewer AND c.profile_id = _target)
       OR (fm.user_id = _target AND c.profile_id = _viewer)
  )
  -- two family members belonging to the SAME family
  OR EXISTS (
    SELECT 1
    FROM public.family_members a
    JOIN public.family_members b ON b.family_id = a.family_id
    WHERE a.user_id = _viewer AND b.user_id = _target
  );
$function$;