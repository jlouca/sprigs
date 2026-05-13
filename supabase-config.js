// Supabase configuration
const SUPABASE_URL = 'https://tduslqvsxwvapepfcmbf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRkdXNscXZzeHd2YXBlcGZjbWJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2OTE5MjksImV4cCI6MjA5MjI2NzkyOX0.NGoAIGJsbNiWcKwbfk-VqxyRCqdcQBvGzCqACj99xh8';

// Routes auth token to localStorage (persistent) or sessionStorage (tab-only)
// based on the sprigs_remember_me preference saved at login time.
class AdaptiveStorage {
  _persist() { return localStorage.getItem('sprigs_remember_me') !== 'false'; }
  getItem(key) { return this._persist() ? localStorage.getItem(key) : sessionStorage.getItem(key); }
  setItem(key, value) {
    if (this._persist()) { localStorage.setItem(key, value); sessionStorage.removeItem(key); }
    else { sessionStorage.setItem(key, value); localStorage.removeItem(key); }
  }
  removeItem(key) { localStorage.removeItem(key); sessionStorage.removeItem(key); }
}

// Initialize Supabase client
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { storage: new AdaptiveStorage() }
});

// Export for use in other files
window.supabaseClient = supabaseClient;