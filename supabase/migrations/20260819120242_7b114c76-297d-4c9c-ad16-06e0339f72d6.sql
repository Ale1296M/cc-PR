CREATE OR REPLACE FUNCTION public.user_can_view_recipient(_user_id uuid, _recipient_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.has_role(_user_id,'admin')
    OR public.user_in_family_of_recipient(_user_id, _recipient_id)
    OR EXISTS (
      SELECT 1 FROM public.care_shifts s
      JOIN public.caregivers c ON c.id = s.caregiver_id
      WHERE s.care_recipient_id = _recipient_id AND c.profile_id = _user_id);
$function$;

CREATE OR REPLACE FUNCTION public.user_can_access_family(_user_id uuid, _family_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.has_role(_user_id,'admin')
    OR public.user_in_family(_user_id, _family_id)
    OR EXISTS (
      SELECT 1 FROM public.care_recipients r
      JOIN public.care_shifts s ON s.care_recipient_id = r.id
      JOIN public.caregivers c ON c.id = s.caregiver_id
      WHERE r.family_id = _family_id AND c.profile_id = _user_id);
$function$;