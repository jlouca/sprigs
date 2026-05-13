-- Storage bucket for plant photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('plant-photos', 'plant-photos', true)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can upload their own photos' AND polrelid = 'storage.objects'::regclass) THEN
    CREATE POLICY "Users can upload their own photos" ON storage.objects
      FOR INSERT WITH CHECK (bucket_id = 'plant-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Anyone can view plant photos' AND polrelid = 'storage.objects'::regclass) THEN
    CREATE POLICY "Anyone can view plant photos" ON storage.objects
      FOR SELECT USING (bucket_id = 'plant-photos');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can delete their own photos' AND polrelid = 'storage.objects'::regclass) THEN
    CREATE POLICY "Users can delete their own photos" ON storage.objects
      FOR DELETE USING (bucket_id = 'plant-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
END $$;

-- Plants table
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

ALTER TABLE plants ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can view their own plants' AND polrelid = 'plants'::regclass) THEN
    CREATE POLICY "Users can view their own plants" ON plants FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can insert their own plants' AND polrelid = 'plants'::regclass) THEN
    CREATE POLICY "Users can insert their own plants" ON plants FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can update their own plants' AND polrelid = 'plants'::regclass) THEN
    CREATE POLICY "Users can update their own plants" ON plants FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can delete their own plants' AND polrelid = 'plants'::regclass) THEN
    CREATE POLICY "Users can delete their own plants" ON plants FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- Notes table
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

ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can view their own notes' AND polrelid = 'notes'::regclass) THEN
    CREATE POLICY "Users can view their own notes" ON notes FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can insert their own notes' AND polrelid = 'notes'::regclass) THEN
    CREATE POLICY "Users can insert their own notes" ON notes FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can update their own notes' AND polrelid = 'notes'::regclass) THEN
    CREATE POLICY "Users can update their own notes" ON notes FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can delete their own notes' AND polrelid = 'notes'::regclass) THEN
    CREATE POLICY "Users can delete their own notes" ON notes FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- PIPEDA / Quebec Law 25: Right to Erasure
CREATE OR REPLACE FUNCTION delete_user()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;
