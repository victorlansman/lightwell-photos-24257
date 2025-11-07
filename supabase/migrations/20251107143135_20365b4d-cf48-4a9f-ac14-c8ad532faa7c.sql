-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum for user roles
CREATE TYPE app_role AS ENUM ('owner', 'admin', 'viewer');

-- Users table (profiles linked to Supabase auth)
CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  storage_quota BIGINT DEFAULT 10737418240, -- 10GB in bytes
  preferences JSONB DEFAULT '{}'::jsonb,
  supabase_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Collections table (family workspaces)
CREATE TABLE public.collections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  shopify_order_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Collection members (many-to-many with roles)
CREATE TABLE public.collection_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  collection_id UUID REFERENCES public.collections(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'viewer',
  invited_by UUID REFERENCES public.users(id),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(collection_id, user_id)
);

-- Photos table
CREATE TABLE public.photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  collection_id UUID REFERENCES public.collections(id) ON DELETE CASCADE NOT NULL,
  path TEXT NOT NULL,
  thumbnail_url TEXT,
  original_filename TEXT NOT NULL,
  taken_at TIMESTAMPTZ,
  title TEXT,
  description TEXT,
  tags TEXT[] DEFAULT '{}',
  width INTEGER,
  height INTEGER,
  rotation INTEGER DEFAULT 0,
  camera_model TEXT,
  location JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- People table (detected faces)
CREATE TABLE public.people (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  collection_id UUID REFERENCES public.collections(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  thumbnail_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Photo people (faces in photos with bounding boxes)
CREATE TABLE public.photo_people (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  photo_id UUID REFERENCES public.photos(id) ON DELETE CASCADE NOT NULL,
  person_id UUID REFERENCES public.people(id) ON DELETE CASCADE NOT NULL,
  face_bbox JSONB, -- {x, y, width, height} normalized 0-1
  UNIQUE(photo_id, person_id)
);

-- Favorites (user-specific)
CREATE TABLE public.favorites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  photo_id UUID REFERENCES public.photos(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, photo_id)
);

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photo_people ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

-- Security definer function to check user role in collection
CREATE OR REPLACE FUNCTION public.user_has_role_in_collection(
  _collection_id UUID,
  _user_id UUID,
  _required_role app_role
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.collection_members
    WHERE collection_id = _collection_id
      AND user_id = _user_id
      AND (
        CASE 
          WHEN _required_role = 'viewer' THEN role IN ('viewer', 'admin', 'owner')
          WHEN _required_role = 'admin' THEN role IN ('admin', 'owner')
          WHEN _required_role = 'owner' THEN role = 'owner'
        END
      )
  );
$$;

-- Security definer function to check if user is member of collection
CREATE OR REPLACE FUNCTION public.user_is_member_of_collection(
  _collection_id UUID,
  _user_id UUID
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.collection_members
    WHERE collection_id = _collection_id
      AND user_id = _user_id
  );
$$;

-- RLS Policies for users table
CREATE POLICY "Users can view their own profile"
  ON public.users FOR SELECT
  USING (supabase_user_id = auth.uid());

CREATE POLICY "Users can update their own profile"
  ON public.users FOR UPDATE
  USING (supabase_user_id = auth.uid());

CREATE POLICY "Users can insert their own profile"
  ON public.users FOR INSERT
  WITH CHECK (supabase_user_id = auth.uid());

-- RLS Policies for collections table
CREATE POLICY "Members can view their collections"
  ON public.collections FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.collection_members
      WHERE collection_id = collections.id
        AND user_id IN (SELECT id FROM public.users WHERE supabase_user_id = auth.uid())
    )
  );

CREATE POLICY "Authenticated users can create collections"
  ON public.collections FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Owners can update collections"
  ON public.collections FOR UPDATE
  USING (
    public.user_has_role_in_collection(
      id,
      (SELECT id FROM public.users WHERE supabase_user_id = auth.uid()),
      'owner'
    )
  );

CREATE POLICY "Owners can delete collections"
  ON public.collections FOR DELETE
  USING (
    public.user_has_role_in_collection(
      id,
      (SELECT id FROM public.users WHERE supabase_user_id = auth.uid()),
      'owner'
    )
  );

-- RLS Policies for collection_members table
CREATE POLICY "Members can view collection members"
  ON public.collection_members FOR SELECT
  USING (
    user_id IN (SELECT id FROM public.users WHERE supabase_user_id = auth.uid())
    OR public.user_is_member_of_collection(
      collection_id,
      (SELECT id FROM public.users WHERE supabase_user_id = auth.uid())
    )
  );

CREATE POLICY "Owners can invite members"
  ON public.collection_members FOR INSERT
  WITH CHECK (
    public.user_has_role_in_collection(
      collection_id,
      (SELECT id FROM public.users WHERE supabase_user_id = auth.uid()),
      'owner'
    )
  );

CREATE POLICY "Owners can update member roles"
  ON public.collection_members FOR UPDATE
  USING (
    public.user_has_role_in_collection(
      collection_id,
      (SELECT id FROM public.users WHERE supabase_user_id = auth.uid()),
      'owner'
    )
  );

CREATE POLICY "Owners can remove members"
  ON public.collection_members FOR DELETE
  USING (
    public.user_has_role_in_collection(
      collection_id,
      (SELECT id FROM public.users WHERE supabase_user_id = auth.uid()),
      'owner'
    )
  );

-- RLS Policies for photos table
CREATE POLICY "Members can view photos in their collections"
  ON public.photos FOR SELECT
  USING (
    public.user_is_member_of_collection(
      collection_id,
      (SELECT id FROM public.users WHERE supabase_user_id = auth.uid())
    )
  );

CREATE POLICY "Owner/admin can upload photos"
  ON public.photos FOR INSERT
  WITH CHECK (
    public.user_has_role_in_collection(
      collection_id,
      (SELECT id FROM public.users WHERE supabase_user_id = auth.uid()),
      'admin'
    )
  );

CREATE POLICY "Owner/admin can update photos"
  ON public.photos FOR UPDATE
  USING (
    public.user_has_role_in_collection(
      collection_id,
      (SELECT id FROM public.users WHERE supabase_user_id = auth.uid()),
      'admin'
    )
  );

CREATE POLICY "Owner/admin can delete photos"
  ON public.photos FOR DELETE
  USING (
    public.user_has_role_in_collection(
      collection_id,
      (SELECT id FROM public.users WHERE supabase_user_id = auth.uid()),
      'admin'
    )
  );

-- RLS Policies for people table
CREATE POLICY "Members can view people in their collections"
  ON public.people FOR SELECT
  USING (
    public.user_is_member_of_collection(
      collection_id,
      (SELECT id FROM public.users WHERE supabase_user_id = auth.uid())
    )
  );

CREATE POLICY "Owner/admin can create people"
  ON public.people FOR INSERT
  WITH CHECK (
    public.user_has_role_in_collection(
      collection_id,
      (SELECT id FROM public.users WHERE supabase_user_id = auth.uid()),
      'admin'
    )
  );

CREATE POLICY "Owner/admin can update people"
  ON public.people FOR UPDATE
  USING (
    public.user_has_role_in_collection(
      collection_id,
      (SELECT id FROM public.users WHERE supabase_user_id = auth.uid()),
      'admin'
    )
  );

-- RLS Policies for photo_people table
CREATE POLICY "Members can view photo people tags"
  ON public.photo_people FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.photos
      WHERE photos.id = photo_people.photo_id
        AND public.user_is_member_of_collection(
          photos.collection_id,
          (SELECT id FROM public.users WHERE supabase_user_id = auth.uid())
        )
    )
  );

CREATE POLICY "Owner/admin can tag people in photos"
  ON public.photo_people FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.photos
      WHERE photos.id = photo_people.photo_id
        AND public.user_has_role_in_collection(
          photos.collection_id,
          (SELECT id FROM public.users WHERE supabase_user_id = auth.uid()),
          'admin'
        )
    )
  );

CREATE POLICY "Owner/admin can update photo people tags"
  ON public.photo_people FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.photos
      WHERE photos.id = photo_people.photo_id
        AND public.user_has_role_in_collection(
          photos.collection_id,
          (SELECT id FROM public.users WHERE supabase_user_id = auth.uid()),
          'admin'
        )
    )
  );

CREATE POLICY "Owner/admin can delete photo people tags"
  ON public.photo_people FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.photos
      WHERE photos.id = photo_people.photo_id
        AND public.user_has_role_in_collection(
          photos.collection_id,
          (SELECT id FROM public.users WHERE supabase_user_id = auth.uid()),
          'admin'
        )
    )
  );

-- RLS Policies for favorites table
CREATE POLICY "Users can view their own favorites"
  ON public.favorites FOR SELECT
  USING (user_id = (SELECT id FROM public.users WHERE supabase_user_id = auth.uid()));

CREATE POLICY "Users can add favorites"
  ON public.favorites FOR INSERT
  WITH CHECK (
    user_id = (SELECT id FROM public.users WHERE supabase_user_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.photos
      WHERE photos.id = favorites.photo_id
        AND public.user_is_member_of_collection(
          photos.collection_id,
          user_id
        )
    )
  );

CREATE POLICY "Users can remove their favorites"
  ON public.favorites FOR DELETE
  USING (user_id = (SELECT id FROM public.users WHERE supabase_user_id = auth.uid()));

-- Function to auto-create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (supabase_user_id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$;

-- Trigger to create user profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE PLPGSQL
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Trigger for photos updated_at
CREATE TRIGGER update_photos_updated_at
  BEFORE UPDATE ON public.photos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('photos', 'photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for photos bucket
CREATE POLICY "Members can view photos in their collections"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'photos'
    AND EXISTS (
      SELECT 1 
      FROM public.photos p
      WHERE p.path = storage.objects.name
        AND public.user_is_member_of_collection(
          p.collection_id,
          (SELECT id FROM public.users WHERE supabase_user_id = auth.uid())
        )
    )
  );

CREATE POLICY "Owner/admin can upload photos to their collections"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'photos'
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "Owner/admin can delete photos from their collections"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'photos'
    AND EXISTS (
      SELECT 1 
      FROM public.photos p
      WHERE p.path = storage.objects.name
        AND public.user_has_role_in_collection(
          p.collection_id,
          (SELECT id FROM public.users WHERE supabase_user_id = auth.uid()),
          'admin'
        )
    )
  );