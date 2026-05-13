-- Supabase Setup SQL for Sprigs
-- Run this in your Supabase SQL Editor
--
-- CANADIAN LEGAL NOTE (PIPEDA / Quebec Law 25):
-- Data is stored on Supabase infrastructure (AWS us-east-1 by default).
-- This constitutes a cross-border transfer of personal information.
-- Before going live, complete a Privacy Impact Assessment (PIA) if serving
-- Quebec residents, and disclose this transfer in your Privacy Policy.
-- Consider enabling a Canadian Supabase region if/when available.

-- Create storage bucket for plant photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('plant-photos', 'plant-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies (allow authenticated users to upload under their own user_id folder)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can upload their own photos' AND polrelid = 'storage.objects'::regclass) THEN
    CREATE POLICY "Users can upload their own photos" ON storage.objects
      FOR INSERT WITH CHECK (bucket_id = 'plant-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Anyone can view plant photos' AND polrelid = 'storage.objects'::regclass) THEN
    CREATE POLICY "Anyone can view plant photos" ON storage.objects
      FOR SELECT USING (bucket_id = 'plant-photos');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can delete their own photos' AND polrelid = 'storage.objects'::regclass) THEN
    CREATE POLICY "Users can delete their own photos" ON storage.objects
      FOR DELETE USING (bucket_id = 'plant-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
END $$;

-- Create plants table if it does not already exist
CREATE TABLE IF NOT EXISTS plants (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  plant_name TEXT NOT NULL,
  category TEXT NOT NULL,
  date_added TIMESTAMPTZ DEFAULT NOW(),
  profile_photo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create notes table if it does not already exist
CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  note_text TEXT NOT NULL,
  note_date DATE NOT NULL,
  parent_id TEXT NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  note_photos TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE plants ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

-- Create policies for plants if they do not already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polname = 'Users can view their own plants'
      AND polrelid = 'plants'::regclass
  ) THEN
    CREATE POLICY "Users can view their own plants" ON plants
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polname = 'Users can insert their own plants'
      AND polrelid = 'plants'::regclass
  ) THEN
    CREATE POLICY "Users can insert their own plants" ON plants
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polname = 'Users can update their own plants'
      AND polrelid = 'plants'::regclass
  ) THEN
    CREATE POLICY "Users can update their own plants" ON plants
      FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polname = 'Users can delete their own plants'
      AND polrelid = 'plants'::regclass
  ) THEN
    CREATE POLICY "Users can delete their own plants" ON plants
      FOR DELETE USING (auth.uid() = user_id);
  END IF;
END
$$;

-- Create policies for notes if they do not already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polname = 'Users can view their own notes'
      AND polrelid = 'notes'::regclass
  ) THEN
    CREATE POLICY "Users can view their own notes" ON notes
      FOR SELECT USING (auth.uid() = user_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polname = 'Users can insert their own notes'
      AND polrelid = 'notes'::regclass
  ) THEN
    CREATE POLICY "Users can insert their own notes" ON notes
      FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polname = 'Users can update their own notes'
      AND polrelid = 'notes'::regclass
  ) THEN
    CREATE POLICY "Users can update their own notes" ON notes
      FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polname = 'Users can delete their own notes'
      AND polrelid = 'notes'::regclass
  ) THEN
    CREATE POLICY "Users can delete their own notes" ON notes
      FOR DELETE USING (auth.uid() = user_id);
  END IF;
END
$$;

-- PIPEDA / Quebec Law 25: Right to Erasure
-- Allows a user to delete their own account from client-side via supabaseClient.rpc('delete_user').
-- ON DELETE CASCADE on plants/notes means all their data is removed automatically.
CREATE OR REPLACE FUNCTION delete_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;