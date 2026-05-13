# Plant Logger - Supabase Edition

A beautiful web app for tracking your plants with photos and notes. Now with user authentication and cloud storage!

## Features

- 📱 Responsive design with Tailwind CSS
- 🔐 User authentication (email/password with email verification)
- 🌱 Plant tracking with categories
- 📸 Photo uploads for plants and notes
- ☁️ Cloud storage with Supabase
- 👤 User-specific data (each user sees only their own plants)

## Setup Instructions

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Create a new project
3. Wait for the project to be set up

### 2. Configure Authentication

1. In your Supabase dashboard, go to Authentication > Settings
2. Configure your site URL (where you'll host the app)
3. Enable email confirmation if desired

### 3. Create Database Tables

Run these SQL commands in your Supabase SQL Editor:

```sql
-- Create plants table
CREATE TABLE plants (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  plant_name TEXT NOT NULL,
  category TEXT NOT NULL,
  date_added TIMESTAMPTZ DEFAULT NOW(),
  profile_photo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create notes table
CREATE TABLE notes (
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

-- Create policies for plants
CREATE POLICY "Users can view their own plants" ON plants
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own plants" ON plants
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own plants" ON plants
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own plants" ON plants
  FOR DELETE USING (auth.uid() = user_id);

-- Create policies for notes
CREATE POLICY "Users can view their own notes" ON notes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own notes" ON notes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notes" ON notes
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notes" ON notes
  FOR DELETE USING (auth.uid() = user_id);
```

### 4. Get Your API Keys

1. In your Supabase dashboard, go to Settings > API
2. Copy your Project URL and anon/public key

### 5. Configure the App

1. Open `supabase-config.js`
2. Replace `YOUR_SUPABASE_URL` with your Project URL
3. Replace `YOUR_SUPABASE_ANON_KEY` with your anon/public key

### 6. Deploy

Upload all files to your web server or hosting platform. The app will work locally with `file://` protocol but authentication features work better when served from a web server.

## Usage

1. Open the app in your browser
2. Click "Register" to create an account
3. Check your email for verification (if enabled)
4. Login with your credentials
5. Start adding plants and notes!

## Technologies Used

- HTML5
- Tailwind CSS
- JavaScript (ES6+)
- Supabase (Backend as a Service)
- Lucide Icons

## File Structure

```
├── index.html          # Main HTML file
├── styles.css          # Custom styles
├── script.js           # Main application logic
├── supabase-config.js  # Supabase configuration
└── README.md          # This file
```

## Security Notes

- All data is stored securely in Supabase with Row Level Security
- Users can only access their own data
- Photos are stored as base64 strings (consider using Supabase Storage for production)
- Authentication uses Supabase's built-in auth system