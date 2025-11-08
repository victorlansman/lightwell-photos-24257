-- Add thumbnail_bbox column to people table to store the face bounding box for the thumbnail
ALTER TABLE public.people 
ADD COLUMN thumbnail_bbox JSONB;