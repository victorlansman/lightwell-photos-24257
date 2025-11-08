-- Make person_id nullable in photo_people table to support unknown/untagged faces
ALTER TABLE public.photo_people 
ALTER COLUMN person_id DROP NOT NULL;