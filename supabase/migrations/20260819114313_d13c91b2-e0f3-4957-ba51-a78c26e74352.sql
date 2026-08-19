UPDATE public.families SET name = 'Familia ' || left(id::text, 8) WHERE name IS NULL;
ALTER TABLE public.families ALTER COLUMN name SET NOT NULL;
DROP TABLE IF EXISTS public.client_family_members CASCADE;