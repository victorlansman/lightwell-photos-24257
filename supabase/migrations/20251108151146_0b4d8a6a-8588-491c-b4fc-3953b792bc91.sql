-- Add thumbnail_url to photo_people table for storing face thumbnails
ALTER TABLE public.photo_people 
ADD COLUMN thumbnail_url TEXT;

-- Create thumbnails storage bucket for face thumbnails
INSERT INTO storage.buckets (id, name, public)
VALUES ('thumbnails', 'thumbnails', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for thumbnails bucket
CREATE POLICY "Authenticated users can view thumbnails"
ON storage.objects FOR SELECT
USING (bucket_id = 'thumbnails' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can upload thumbnails"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'thumbnails' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can update thumbnails"
ON storage.objects FOR UPDATE
USING (bucket_id = 'thumbnails' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete thumbnails"
ON storage.objects FOR DELETE
USING (bucket_id = 'thumbnails' AND auth.role() = 'authenticated');