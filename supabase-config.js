// Supabase configuration
const SUPABASE_URL = 'https://tduslqvsxwvapepfcmbf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRkdXNscXZzeHd2YXBlcGZjbWJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2OTE5MjksImV4cCI6MjA5MjI2NzkyOX0.NGoAIGJsbNiWcKwbfk-VqxyRCqdcQBvGzCqACj99xh8';

// Initialize Supabase client
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Export for use in other files
window.supabaseClient = supabaseClient;