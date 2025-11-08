-- Make the name column nullable in people table so we can have unnamed person clusters
ALTER TABLE public.people ALTER COLUMN name DROP NOT NULL;