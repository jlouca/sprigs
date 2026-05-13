// State
let allData = [];
let currentFilter = 'all';
let currentSearch = '';
let currentPlantId = null;
let pendingPhotos = [];
let pendingPlantProfilePhoto = null;
let pendingIdentifyPhoto = null;
let currentUser = null;
let editingNoteId = null;

const categoryEmojis = { annual: '🌸', perennial: '🌿', tropical: '🌴', herb: '🌾', vegetable: '🥕', fruit: '🍎' };

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
  ]);
}

// Authentication state management
async function checkAuthState() {
  try {
    const { data: { user } } = await withTimeout(supabaseClient.auth.getUser(), 10000);
    currentUser = user;
    updateAuthUI();
    if (user) {
      await loadUserData();
    } else {
      allData = [];
      renderPlants();
      showAuthRequired();
    }
  } catch (error) {
    console.error('Auth check failed:', error);
    currentUser = null;
    updateAuthUI();
    showAuthRequired();
  }
}

function updateAuthUI() {
  const loginBtn = document.getElementById('loginBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const userEmail = document.getElementById('userEmail');
  const userFooter = document.getElementById('userFooter');
  const deleteAccountBtn = document.getElementById('deleteAccountBtn');

  if (currentUser) {
    loginBtn.classList.add('hidden');
    logoutBtn.classList.remove('hidden');
    deleteAccountBtn.classList.remove('hidden');
    userEmail.textContent = currentUser.email;
    if (userFooter) userFooter.classList.remove('hidden');
  } else {
    loginBtn.classList.remove('hidden');
    logoutBtn.classList.add('hidden');
    deleteAccountBtn.classList.add('hidden');
    if (userFooter) userFooter.classList.add('hidden');
  }
}

function showAuthRequired() {
  const main = document.querySelector('main');
  main.innerHTML = `
    <div class="text-center py-16 fade-in">
     <div class="mb-3" style="display:flex;justify-content:center;"><i data-lucide="sprout" style="width:56px;height:56px;color:#2d6a4f;"></i></div>
     <p class="text-green-800 mb-6 text-2xl" style="font-family: 'Salt', cursive;">Log Each Leaf<br>Celebrate Each Bloom</p>
     <div class="flex flex-col items-center gap-3">
      <button onclick="openAuthModal('login')" class="w-36 py-3 rounded-full text-white font-semibold text-sm shadow-md hover:shadow-lg transition" style="background: #2d6a4f;">Login</button>
      <button onclick="openAuthModal('register')" class="w-36 py-3 rounded-full text-white font-semibold text-sm shadow-md hover:shadow-lg transition" style="background: #2d6a4f;">Register</button>
     </div>
    </div>
  `;
  lucide.createIcons();
}

const MAIN_CONTENT_HTML = `
  <button id="addPlantBtn" onclick="openAddPlantModal()" class="mb-6 flex items-center gap-2 px-6 py-3 rounded-full text-white font-semibold text-sm shadow-md hover:shadow-lg transition-all" style="background: #2d6a4f;"> <i data-lucide="plus" style="width:18px;height:18px;"></i> <span id="addPlantBtnText">Add New Plant</span> </button>
  <div class="w-full mb-4">
    <input id="searchInput" type="text" placeholder="Search plants..." oninput="filterSearch(this.value)" class="w-full border border-green-300 rounded-full px-4 py-2 text-sm bg-white" style="outline:none;">
  </div>
  <div class="flex flex-wrap justify-center gap-2 mb-6"><button onclick="filterCategory('all')" class="cat-pill px-4 py-1.5 rounded-full text-xs font-semibold border-2 border-green-700 bg-green-700 text-white" data-cat="all">All</button> <button onclick="filterCategory('annual')" class="cat-pill px-4 py-1.5 rounded-full text-xs font-semibold border-2 border-green-700 text-green-800 bg-transparent" data-cat="annual">Annual</button> <button onclick="filterCategory('perennial')" class="cat-pill px-4 py-1.5 rounded-full text-xs font-semibold border-2 border-green-700 text-green-800 bg-transparent" data-cat="perennial">Perennial</button> <button onclick="filterCategory('tropical')" class="cat-pill px-4 py-1.5 rounded-full text-xs font-semibold border-2 border-green-700 text-green-800 bg-transparent" data-cat="tropical">Tropical</button> <button onclick="filterCategory('herb')" class="cat-pill px-4 py-1.5 rounded-full text-xs font-semibold border-2 border-green-700 text-green-800 bg-transparent" data-cat="herb">Herb</button> <button onclick="filterCategory('vegetable')" class="cat-pill px-4 py-1.5 rounded-full text-xs font-semibold border-2 border-green-700 text-green-800 bg-transparent" data-cat="vegetable">Vegetable</button> <button onclick="filterCategory('fruit')" class="cat-pill px-4 py-1.5 rounded-full text-xs font-semibold border-2 border-green-700 text-green-800 bg-transparent" data-cat="fruit">Fruit</button>
  </div>
  <div id="plantList" class="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-max"></div>
  <div id="emptyState" class="text-center py-16 fade-in">
   <div class="text-5xl mb-3">🌱</div>
   <p class="text-green-700 font-medium">No plants yet. Add your first one!</p>
  </div>
`;

async function loadUserData() {
  if (!currentUser) return;

  try {
    showLoading(true);

    const { data: plants, error: plantsError } = await withTimeout(
      supabaseClient.from('plants').select('*').eq('user_id', currentUser.id).order('date_added', { ascending: false }),
      10000
    );

    if (plantsError) throw plantsError;

    const { data: notes, error: notesError } = await withTimeout(
      supabaseClient.from('notes').select('*').eq('user_id', currentUser.id).order('note_date', { ascending: false }),
      10000
    );

    if (notesError) throw notesError;

    // Fix: map type and __backendId so getPlants()/getNotes() work after page load
    allData = [
      ...plants.map(p => ({ ...p, type: 'plant', __backendId: p.id })),
      ...notes.map(n => ({ ...n, type: 'note', __backendId: n.id }))
    ];

    // Restore main content if it was replaced by auth-required screen
    const main = document.querySelector('main');
    if (!document.getElementById('plantList')) {
      main.innerHTML = MAIN_CONTENT_HTML;
    }

    renderPlants();

  } catch (error) {
    console.error('Error loading user data:', error);
    const msg = error.message === 'timeout'
      ? 'Could not reach the server. Please check your connection and try again.'
      : 'Failed to load your data. Please try refreshing.';
    showToast(msg);
  } finally {
    showLoading(false);
  }
}

function showLoading(show) {
  const overlay = document.getElementById('loadingOverlay');
  if (show) overlay.classList.remove('hidden');
  else overlay.classList.add('hidden');
}

// Photo helpers
async function uploadPhoto(file) {
  if (!currentUser) throw new Error('Not authenticated');
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const filename = `${currentUser.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabaseClient.storage
    .from('plant-photos')
    .upload(filename, file, { upsert: false });
  if (error) throw error;
  const { data: { publicUrl } } = supabaseClient.storage
    .from('plant-photos')
    .getPublicUrl(filename);
  return publicUrl;
}

function readAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function photoToUrl(file) {
  try {
    return await uploadPhoto(file);
  } catch (err) {
    console.warn('Supabase Storage upload failed, falling back to base64. Ensure the plant-photos bucket exists and RLS policies are applied.', err);
    return await readAsBase64(file);
  }
}

function getPlantPhoto(plant) { return plant?.profile_photo || ''; }
function getNotePhotos(note) { return Array.isArray(note?.note_photos) ? note.note_photos : []; }

const defaultConfig = {
  app_title: 'Sprigs',
  add_plant_button_text: 'Add New Plant',
  background_color: '#e8f7eb',
  surface_color: '#ffffff',
  text_color: '#1b4332',
  primary_action_color: '#2d6a4f',
  secondary_action_color: '#95d5b2',
  font_family: 'Fraunces',
  font_size: 16
};

window.elementSdk = window.elementSdk || { init: async () => {}, setConfig: () => {} };
window.elementSdk.init({
  defaultConfig,
  onConfigChange: async (config) => {
    const bg = config.background_color || defaultConfig.background_color;
    const surface = config.surface_color || defaultConfig.surface_color;
    const text = config.text_color || defaultConfig.text_color;
    const primary = config.primary_action_color || defaultConfig.primary_action_color;
    const font = config.font_family || defaultConfig.font_family;

    document.body.style.background = bg;
    document.querySelector('header').style.background = bg;

    const appTitleImage = document.getElementById('appTitleImage');
    const appTitleText = document.getElementById('appTitleText');
    if (appTitleImage) appTitleImage.alt = config.app_title || defaultConfig.app_title;
    if (appTitleText) appTitleText.textContent = config.app_title || defaultConfig.app_title;

    const addPlantBtnText = document.getElementById('addPlantBtnText');
    if (addPlantBtnText) addPlantBtnText.textContent = config.add_plant_button_text || defaultConfig.add_plant_button_text;

    const addPlantBtn = document.getElementById('addPlantBtn');
    if (addPlantBtn) addPlantBtn.style.background = primary;

    document.querySelectorAll('.plant-card').forEach(c => {
      c.style.background = surface;
      const nameEl = c.querySelector('.pc-name');
      if (nameEl) { nameEl.style.color = text; nameEl.style.fontFamily = `${font}, Fraunces, serif`; }
    });

    document.querySelectorAll('.cat-pill').forEach(btn => {
      btn.style.borderColor = primary;
      if (btn.classList.contains('active') || btn.dataset.cat === currentFilter) {
        btn.style.background = primary; btn.style.color = '#fff';
      } else {
        btn.style.background = 'transparent'; btn.style.color = text;
      }
    });
  },
  mapToCapabilities: (config) => ({
    recolorables: [
      { get: () => config.background_color || defaultConfig.background_color, set: (v) => { config.background_color = v; window.elementSdk.setConfig({ background_color: v }); } },
      { get: () => config.surface_color || defaultConfig.surface_color, set: (v) => { config.surface_color = v; window.elementSdk.setConfig({ surface_color: v }); } },
      { get: () => config.text_color || defaultConfig.text_color, set: (v) => { config.text_color = v; window.elementSdk.setConfig({ text_color: v }); } },
      { get: () => config.primary_action_color || defaultConfig.primary_action_color, set: (v) => { config.primary_action_color = v; window.elementSdk.setConfig({ primary_action_color: v }); } },
      { get: () => config.secondary_action_color || defaultConfig.secondary_action_color, set: (v) => { config.secondary_action_color = v; window.elementSdk.setConfig({ secondary_action_color: v }); } }
    ],
    borderables: [],
    fontEditable: { get: () => config.font_family || defaultConfig.font_family, set: (v) => { config.font_family = v; window.elementSdk.setConfig({ font_family: v }); } },
    fontSizeable: { get: () => config.font_size || defaultConfig.font_size, set: (v) => { config.font_size = v; window.elementSdk.setConfig({ font_size: v }); } }
  }),
  mapToEditPanelValues: (config) => new Map([
    ['app_title', config.app_title || defaultConfig.app_title],
    ['add_plant_button_text', config.add_plant_button_text || defaultConfig.add_plant_button_text]
  ])
});

// Supabase Data SDK
const supabaseDataSdk = {
  async create(obj) {
    if (!currentUser) return { isOk: false, error: 'User not authenticated' };
    try {
      obj.user_id = currentUser.id;
      obj.id = generateId();

      let table, data;
      if (obj.type === 'plant') {
        table = 'plants';
        data = { id: obj.id, user_id: obj.user_id, plant_name: obj.plant_name, category: obj.category, date_added: obj.date_added, profile_photo: obj.profile_photo || null };
      } else if (obj.type === 'note') {
        table = 'notes';
        data = { id: obj.id, user_id: obj.user_id, note_text: obj.note_text, note_date: obj.note_date, parent_id: obj.parent_id, note_photos: obj.note_photos || [] };
      }

      const { error } = await supabaseClient.from(table).insert(data);
      if (error) throw error;

      allData.push({ ...obj, __backendId: obj.id });
      dataHandler.onDataChanged(allData);
      return { isOk: true, id: obj.id };
    } catch (error) {
      console.error('Error creating data:', error);
      return { isOk: false, error: error.message };
    }
  },

  async delete(obj) {
    if (!currentUser) return { isOk: false, error: 'User not authenticated' };
    try {
      const table = obj.type === 'plant' ? 'plants' : 'notes';
      const { error } = await supabaseClient.from(table).delete().eq('id', obj.__backendId).eq('user_id', currentUser.id);
      if (error) throw error;
      allData = allData.filter(d => d.__backendId !== obj.__backendId);
      dataHandler.onDataChanged(allData);
      return { isOk: true };
    } catch (error) {
      console.error('Error deleting data:', error);
      return { isOk: false, error: error.message };
    }
  }
};

const dataHandler = {
  onDataChanged(data) {
    allData = data;
    renderPlants();
    if (currentPlantId) renderNotes();
  }
};

function getDataSdk() { return supabaseDataSdk; }

// Auth modal
function openAuthModal(mode) {
  const modal = document.getElementById('authModal');
  const title = document.getElementById('authModalTitle');
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const forgotForm = document.getElementById('forgotForm');

  loginForm.classList.add('hidden');
  registerForm.classList.add('hidden');
  if (forgotForm) forgotForm.classList.add('hidden');

  if (mode === 'login') {
    title.textContent = 'Login';
    loginForm.classList.remove('hidden');
    const rememberMe = document.getElementById('rememberMe');
    if (rememberMe) rememberMe.checked = localStorage.getItem('sprigs_remember_me') !== 'false';
  } else if (mode === 'register') {
    title.textContent = 'Register';
    registerForm.classList.remove('hidden');
  } else if (mode === 'forgot') {
    title.textContent = 'Reset Password';
    if (forgotForm) forgotForm.classList.remove('hidden');
  }

  modal.classList.remove('hidden');
  loginForm.reset();
  registerForm.reset();
  if (forgotForm) forgotForm.reset();
  document.getElementById('loginError').classList.add('hidden');
  document.getElementById('registerError').classList.add('hidden');
  const forgotError = document.getElementById('forgotError');
  const forgotSuccess = document.getElementById('forgotSuccess');
  if (forgotError) forgotError.classList.add('hidden');
  if (forgotSuccess) forgotSuccess.classList.add('hidden');
}

function closeAuthModal() { document.getElementById('authModal').classList.add('hidden'); }
function switchAuthMode(mode) { openAuthModal(mode); }

async function handleLogin(event) {
  event.preventDefault();
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  const rememberMe = document.getElementById('rememberMe').checked;
  const submitBtn = document.getElementById('loginSubmit');
  const errorEl = document.getElementById('loginError');

  // Save preference before login so AdaptiveStorage uses the right backend
  localStorage.setItem('sprigs_remember_me', rememberMe ? 'true' : 'false');

  submitBtn.disabled = true;
  submitBtn.textContent = 'Logging in...';
  errorEl.classList.add('hidden');

  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) { error.message = 'Invalid email or password.'; throw error; }
    currentUser = data.user;
    updateAuthUI();
    await loadUserData();
    closeAuthModal();
    showToast('Welcome back! 🌱');
  } catch (error) {
    errorEl.textContent = error.message;
    errorEl.classList.remove('hidden');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Login';
  }
}

async function handleRegister(event) {
  event.preventDefault();
  const email = document.getElementById('registerEmail').value;
  const password = document.getElementById('registerPassword').value;
  const submitBtn = document.getElementById('registerSubmit');
  const errorEl = document.getElementById('registerError');

  submitBtn.disabled = true;
  submitBtn.textContent = 'Registering...';
  errorEl.classList.add('hidden');

  try {
    const { data, error } = await supabaseClient.auth.signUp({ email, password });
    if (error) throw error;
    if (data.user && !data.session) {
      showToast('Please check your email to confirm your account! 📧');
      closeAuthModal();
    } else {
      currentUser = data.user;
      updateAuthUI();
      await loadUserData();
      closeAuthModal();
      showToast('Welcome to Sprigs! 🌱');
    }
  } catch (error) {
    errorEl.textContent = error.message;
    errorEl.classList.remove('hidden');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Register';
  }
}

async function handleForgotPassword(event) {
  event.preventDefault();
  const email = document.getElementById('forgotEmail').value;
  const submitBtn = document.getElementById('forgotSubmit');
  const errorEl = document.getElementById('forgotError');
  const successEl = document.getElementById('forgotSuccess');

  submitBtn.disabled = true;
  submitBtn.textContent = 'Sending...';
  errorEl.classList.add('hidden');
  successEl.classList.add('hidden');

  try {
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email);
    if (error) throw error;
    successEl.textContent = 'Password reset email sent! Check your inbox.';
    successEl.classList.remove('hidden');
  } catch (error) {
    errorEl.textContent = error.message;
    errorEl.classList.remove('hidden');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Send Reset Link';
  }
}

async function handleLogout() {
  try {
    const { error } = await supabaseClient.auth.signOut();
    if (error) throw error;
    currentUser = null;
    allData = [];
    updateAuthUI();
    showAuthRequired();
    showToast('Logged out successfully');
  } catch (error) {
    console.error('Logout error:', error);
    showToast('Error logging out');
  }
}

// Initialize app
(async () => {
  supabaseClient.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN') {
      currentUser = session?.user || null;
      updateAuthUI();
      if (currentUser) await loadUserData();
    } else if (event === 'SIGNED_OUT') {
      currentUser = null;
      allData = [];
      updateAuthUI();
      showAuthRequired();
    }
  });
  await checkAuthState();
  checkDueReminders();
})();

// Helpers
function getPlants() { return allData.filter(d => d.type === 'plant'); }
function getNotes(plantId) {
  return allData.filter(d => d.type === 'note' && d.parent_id === plantId)
    .sort((a, b) => (b.note_date || '').localeCompare(a.note_date || ''));
}
function generateId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

function showToast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2500);
}

// Render plants
function renderPlants() {
  const list = document.getElementById('plantList');
  const empty = document.getElementById('emptyState');
  if (!list || !empty) return;

  let plants = getPlants();
  if (currentFilter !== 'all') plants = plants.filter(p => p.category === currentFilter);
  if (currentSearch) plants = plants.filter(p => p.plant_name.toLowerCase().includes(currentSearch.toLowerCase()));

  if (plants.length === 0) {
    list.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  const existingMap = new Map([...list.children].map(el => [el.dataset.pid, el]));
  const fragment = document.createDocumentFragment();

  plants.forEach(p => {
    const pid = p.__backendId;
    let card = existingMap.get(pid);
    if (card) {
      card.querySelector('.pc-name').textContent = p.plant_name;
      const noteCount = getNotes(pid).length;
      card.querySelector('.pc-notes').textContent = noteCount + ' note' + (noteCount !== 1 ? 's' : '');
      const profileImg = card.querySelector('.pc-profile-img');
      const emojiEl = card.querySelector('.pc-emoji');
      const plantPhoto = getPlantPhoto(p);
      if (plantPhoto) {
        if (profileImg) { profileImg.src = plantPhoto; profileImg.style.display = 'block'; }
        if (emojiEl) emojiEl.style.display = 'none';
      } else {
        if (profileImg) profileImg.style.display = 'none';
        if (emojiEl) emojiEl.style.display = 'block';
      }
      existingMap.delete(pid);
    } else {
      card = document.createElement('div');
      card.className = 'plant-card bg-white rounded-2xl p-4 w-full cursor-pointer shadow-sm fade-in flex flex-col';
      card.dataset.pid = pid;
      card.onclick = () => openDetail(pid);
      const noteCount = getNotes(pid).length;
      const plantPhoto = getPlantPhoto(p);
      const profileImgHtml = plantPhoto
        ? `<img class="pc-profile-img w-full h-32 rounded-xl object-cover flex-shrink-0 mb-2" src="${plantPhoto}" alt="Plant">`
        : `<div class="pc-emoji w-full h-32 rounded-xl flex items-center justify-center text-5xl flex-shrink-0 mb-2" style="background:#e8f7eb;">${categoryEmojis[p.category] || '🌱'}</div>`;
      card.innerHTML = `
        <div class="flex flex-col gap-2">
          ${profileImgHtml}
          <div class="flex-1 min-w-0">
            <div class="pc-name font-bold text-green-900 line-clamp-2" style="font-family:Fraunces,serif;">${escapeHtml(p.plant_name)}</div>
          </div>
          <div class="flex items-center gap-2 mt-auto">
            <span class="pc-notes text-xs text-green-400">${noteCount} note${noteCount !== 1 ? 's' : ''}</span>
          </div>
        </div>`;
      fragment.appendChild(card);
    }
  });

  existingMap.forEach(el => el.remove());
  list.appendChild(fragment);
  lucide.createIcons();
}

// Filter
function filterCategory(cat) {
  currentFilter = cat;
  document.querySelectorAll('.cat-pill').forEach(btn => {
    if (btn.dataset.cat === cat) {
      btn.classList.add('active'); btn.style.background = '#2d6a4f'; btn.style.color = '#fff';
    } else {
      btn.classList.remove('active'); btn.style.background = 'transparent'; btn.style.color = '#1b4332';
    }
  });
  renderPlants();
}

function filterSearch(query) {
  currentSearch = query;
  renderPlants();
}

// Add Plant Modal
function openAddPlantModal() {
  document.getElementById('addPlantModal').classList.remove('hidden');
  document.getElementById('addPlantForm').reset();
  document.getElementById('addPlantError').classList.add('hidden');
  document.getElementById('addPlantError').textContent = '';
  document.getElementById('addPlantSubmit').disabled = false;
  document.getElementById('addPlantSubmit').textContent = 'Add Plant';
  document.getElementById('plantNoteDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('plantProfilePhotoCount').textContent = '';
  document.getElementById('plantProfilePhotoPreview').innerHTML = '';
  pendingPlantProfilePhoto = null;
}

function closeAddPlantModal() {
  document.getElementById('addPlantModal').classList.add('hidden');
  document.getElementById('addPlantForm').reset();
  document.getElementById('addPlantError').classList.add('hidden');
  document.getElementById('addPlantError').textContent = '';
  document.getElementById('addPlantSubmit').disabled = false;
  document.getElementById('addPlantSubmit').textContent = 'Add Plant';
  pendingPlantProfilePhoto = null;
  resetReminderSection('plant');
  document.getElementById('plantIdentifySection')?.classList.add('hidden');
  document.getElementById('plantIdResults')?.classList.add('hidden');
}
document.getElementById('addPlantModal').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeAddPlantModal(); });

function updatePlantProfilePhoto(input) {
  const file = input.files[0];
  if (!file) {
    pendingPlantProfilePhoto = null;
    document.getElementById('plantProfilePhotoCount').textContent = '';
    document.getElementById('plantProfilePhotoPreview').innerHTML = '';
    document.getElementById('plantIdentifySection')?.classList.add('hidden');
    return;
  }
  pendingPlantProfilePhoto = file;
  document.getElementById('plantProfilePhotoCount').textContent = 'Profile photo selected';
  const img = document.createElement('img');
  img.src = URL.createObjectURL(file);
  img.style.cssText = 'width:80px;height:80px;object-fit:cover;border-radius:8px;';
  document.getElementById('plantProfilePhotoPreview').innerHTML = '';
  document.getElementById('plantProfilePhotoPreview').appendChild(img);
  document.getElementById('plantIdentifySection')?.classList.remove('hidden');
  document.getElementById('plantIdResults')?.classList.add('hidden');
  document.getElementById('plantIdApiKeySection')?.classList.add('hidden');
  lucide.createIcons();
}

async function handleAddPlant(e) {
  e.preventDefault();
  if (!currentUser) { showToast('Please login first'); openAuthModal('login'); return; }

  const btn = document.getElementById('addPlantSubmit');
  const errEl = document.getElementById('addPlantError');
  btn.disabled = true; btn.textContent = 'Adding...';
  errEl.classList.add('hidden'); errEl.textContent = '';

  const name = document.getElementById('plantName').value.trim();
  const cat = document.getElementById('plantCategory').value;
  const noteDate = document.getElementById('plantNoteDate').value;
  const noteText = document.getElementById('plantNoteText').value.trim();

  if (!name) {
    errEl.textContent = 'Plant name is required.'; errEl.classList.remove('hidden');
    btn.disabled = false; btn.textContent = 'Add Plant'; return;
  }
  if (!cat) {
    errEl.textContent = 'Category is required.'; errEl.classList.remove('hidden');
    btn.disabled = false; btn.textContent = 'Add Plant'; return;
  }

  try {
    let profilePhotoUrl = '';
    if (pendingPlantProfilePhoto) {
      btn.textContent = 'Uploading photo...';
      profilePhotoUrl = await photoToUrl(pendingPlantProfilePhoto);
      btn.textContent = 'Adding...';
    }

    const sdk = getDataSdk();
    const result = await sdk.create({
      type: 'plant', plant_name: name, category: cat,
      date_added: new Date().toISOString(), profile_photo: profilePhotoUrl
    });

    if (!result.isOk) {
      errEl.textContent = 'Failed to save plant: ' + (result.error || 'Unknown error');
      errEl.classList.remove('hidden');
      btn.disabled = false; btn.textContent = 'Add Plant'; return;
    }

    if (result.id && noteText) {
      try {
        const noteResult = await getDataSdk().create({
          type: 'note', note_text: noteText, note_date: noteDate,
          parent_id: result.id, note_photos: []
        });
        if (!noteResult.isOk) showToast('Plant added, but note failed to save.');
      } catch (noteError) {
        console.error('Note save error:', noteError);
        showToast('Plant added, but note failed to save.');
      }
    }

    const plantReminders = collectReminderRows('plant');
    if (plantReminders.length) persistReminders(plantReminders, result.id, name, 'plant');
    closeAddPlantModal();
    showToast(`${name} added! 🌱`);
  } catch (error) {
    console.error('Add plant error:', error);
    errEl.textContent = 'Unexpected error: ' + (error?.message || String(error));
    errEl.classList.remove('hidden');
  } finally {
    btn.disabled = false; btn.textContent = 'Add Plant';
  }
}

// Detail Modal
function openDetail(pid) {
  currentPlantId = pid;
  editingNoteId = null;
  const plant = allData.find(d => d.__backendId === pid);
  if (!plant) return;
  document.getElementById('detailName').textContent = plant.plant_name;
  document.getElementById('detailCategory').textContent = (categoryEmojis[plant.category] || '🌱') + ' ' + (plant.category ? plant.category.charAt(0).toUpperCase() + plant.category.slice(1) : '');
  document.getElementById('detailDate').textContent = 'Added ' + new Date(plant.date_added).toLocaleDateString();
  document.getElementById('addNoteForm').reset();
  document.getElementById('noteDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('photoCount').textContent = '';
  document.getElementById('photoPreview').innerHTML = '';
  document.getElementById('addNoteError').classList.add('hidden');
  document.getElementById('deleteConfirm').classList.add('hidden');
  document.getElementById('deletePlantBtn').classList.remove('hidden');
  document.getElementById('editPlantForm').classList.add('hidden');
  pendingPhotos = [];
  renderDetailProfilePhoto();
  renderNotes();
  document.getElementById('detailModal').classList.remove('hidden');
  lucide.createIcons();
}

function renderDetailProfilePhoto() {
  const previewContainer = document.getElementById('detailProfilePhotoPreview');
  const plant = allData.find(d => d.__backendId === currentPlantId);
  const photo = getPlantPhoto(plant);
  if (photo) {
    previewContainer.innerHTML = `<img src="${photo}" alt="Plant profile" style="width:120px;height:120px;object-fit:cover;border-radius:12px;">`;
  } else {
    const emoji = categoryEmojis[plant?.category] || '🌱';
    previewContainer.innerHTML = `<div style="width:120px;height:120px;border-radius:12px;background:#e8f7eb;display:flex;align-items:center;justify-content:center;font-size:48px;">${emoji}</div>`;
  }
}

function updateDetailProfilePhoto(input) {
  const file = input.files[0];
  if (!file || !currentPlantId || !currentUser) return;
  (async () => {
    try {
      const photoUrl = await photoToUrl(file);
      const { error } = await supabaseClient.from('plants').update({ profile_photo: photoUrl }).eq('id', currentPlantId).eq('user_id', currentUser.id);
      if (error) throw error;
      const plant = allData.find(d => d.__backendId === currentPlantId);
      plant.profile_photo = photoUrl;
      renderDetailProfilePhoto();
      renderPlants();
      showToast('Profile photo updated! 📸');
    } catch (error) {
      console.error('Error updating profile photo:', error);
      showToast('Failed to update profile photo');
    }
  })();
  input.value = '';
}

function closeDetailModal() {
  currentPlantId = null;
  editingNoteId = null;
  document.getElementById('detailModal').classList.add('hidden');
  resetReminderSection('note');
}
document.getElementById('detailModal').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeDetailModal(); });

// Edit Plant
function openEditPlant() {
  const plant = allData.find(d => d.__backendId === currentPlantId);
  if (!plant) return;
  document.getElementById('editPlantName').value = plant.plant_name;
  document.getElementById('editPlantCategory').value = plant.category;
  document.getElementById('editPlantForm').classList.remove('hidden');
}

function closeEditPlant() {
  document.getElementById('editPlantForm').classList.add('hidden');
}

async function saveEditPlant() {
  const name = document.getElementById('editPlantName').value.trim();
  const cat = document.getElementById('editPlantCategory').value;
  if (!name || !cat || !currentUser) return;

  try {
    const { error } = await supabaseClient.from('plants').update({ plant_name: name, category: cat }).eq('id', currentPlantId).eq('user_id', currentUser.id);
    if (error) throw error;
    const plant = allData.find(d => d.__backendId === currentPlantId);
    plant.plant_name = name;
    plant.category = cat;
    document.getElementById('detailName').textContent = name;
    document.getElementById('detailCategory').textContent = (categoryEmojis[cat] || '🌱') + ' ' + cat.charAt(0).toUpperCase() + cat.slice(1);
    closeEditPlant();
    renderPlants();
    showToast('Plant updated!');
  } catch (error) {
    console.error('Error updating plant:', error);
    showToast('Failed to update plant');
  }
}

// Photos
function updatePhotoLabel(input) {
  const files = Array.from(input.files);
  document.getElementById('photoCount').textContent = files.length ? `${files.length} photo(s) selected` : '';
  pendingPhotos = files;
  const preview = document.getElementById('photoPreview');
  preview.innerHTML = '';
  files.forEach(file => {
    const img = document.createElement('img');
    img.src = URL.createObjectURL(file);
    img.style.cssText = 'width:48px;height:48px;object-fit:cover;border-radius:6px;';
    preview.appendChild(img);
  });
}

// Add Note
async function handleAddNote(e) {
  e.preventDefault();
  if (!currentUser) { showToast('Please login first'); openAuthModal('login'); return; }

  const btn = document.getElementById('addNoteSubmit');
  const errEl = document.getElementById('addNoteError');
  btn.disabled = true; btn.textContent = 'Saving...';
  errEl.classList.add('hidden');

  const noteDate = document.getElementById('noteDate').value;
  const noteText = document.getElementById('noteText').value.trim();

  if (!noteText) {
    errEl.textContent = 'Note text is required.';
    errEl.classList.remove('hidden');
    btn.disabled = false; btn.textContent = 'Save Note';
    return;
  }
  if (!noteDate) {
    errEl.textContent = 'Date is required.';
    errEl.classList.remove('hidden');
    btn.disabled = false; btn.textContent = 'Save Note';
    return;
  }

  try {
    const photoUrls = [];
    for (let i = 0; i < pendingPhotos.length; i++) {
      btn.textContent = `Uploading photo ${i + 1}/${pendingPhotos.length}...`;
      photoUrls.push(await photoToUrl(pendingPhotos[i]));
    }
    if (pendingPhotos.length > 0) btn.textContent = 'Saving...';

    const result = await getDataSdk().create({
      type: 'note', note_text: noteText, note_date: noteDate,
      parent_id: currentPlantId, note_photos: photoUrls
    });

    if (result.isOk) {
      document.getElementById('addNoteForm').reset();
      document.getElementById('noteDate').value = new Date().toISOString().split('T')[0];
      document.getElementById('photoCount').textContent = '';
      document.getElementById('photoPreview').innerHTML = '';
      pendingPhotos = [];
      const notePlant = allData.find(d => d.__backendId === currentPlantId);
      const noteReminders = collectReminderRows('note');
      if (noteReminders.length) persistReminders(noteReminders, currentPlantId, notePlant?.plant_name || 'Plant', 'note');
      resetReminderSection('note');
      showToast('Note saved! 📝');
    } else {
      errEl.textContent = 'Failed to save note. Try again.';
      errEl.classList.remove('hidden');
    }
  } catch (error) {
    console.error('Add note error:', error);
    errEl.textContent = 'Unexpected error saving note.';
    errEl.classList.remove('hidden');
  } finally {
    btn.disabled = false; btn.textContent = 'Save Note';
  }
}

// Render Notes
function renderNotes() {
  const notes = getNotes(currentPlantId);
  const container = document.getElementById('notesList');
  const noNotes = document.getElementById('noNotes');
  if (notes.length === 0) {
    container.innerHTML = '';
    noNotes.classList.remove('hidden');
    return;
  }
  noNotes.classList.add('hidden');
  container.innerHTML = notes.map(n => {
    if (editingNoteId === n.__backendId) {
      return `<div class="note-item pl-3 py-2 fade-in">
        <input id="editNoteDate_${n.__backendId}" type="date" value="${n.note_date || ''}" class="w-full border border-green-300 rounded-lg px-3 py-2 text-sm bg-white mb-2">
        <textarea id="editNoteText_${n.__backendId}" rows="3" class="w-full border border-green-300 rounded-lg px-3 py-2 text-sm bg-white resize-none mb-2">${escapeHtml(n.note_text)}</textarea>
        <div class="flex gap-2">
          <button onclick="saveEditNote('${n.__backendId}')" class="flex-1 py-1.5 rounded-lg text-white text-xs font-semibold" style="background:#2d6a4f;">Save</button>
          <button onclick="cancelEditNote()" class="flex-1 py-1.5 rounded-lg text-xs font-semibold bg-green-100 text-green-800">Cancel</button>
        </div>
      </div>`;
    }
    const photos = getNotePhotos(n);
    const photoHtml = photos.length ? `<div class="photo-grid flex flex-wrap gap-2 mt-2">${photos.map(p => `<img src="${p}" alt="Plant photo" onclick="openLightbox(this.src)" loading="lazy" onerror="this.style.display='none';">`).join('')}</div>` : '';
    return `<div class="note-item pl-3 py-2 fade-in">
      <div class="flex justify-between items-start">
        <div class="flex-1">
          <span class="text-xs font-semibold text-green-600">${n.note_date ? new Date(n.note_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}</span>
          <p class="text-sm text-green-900 mt-0.5">${escapeHtml(n.note_text)}</p>
          ${photoHtml}
        </div>
        <div class="flex gap-1 ml-2">
          <button onclick="editNote('${n.__backendId}')" class="p-1 rounded hover:bg-green-50 transition" title="Edit note"><i data-lucide="pencil" style="width:14px;height:14px;color:#2d6a4f;"></i></button>
          <button onclick="deleteNote('${n.__backendId}')" class="p-1 rounded hover:bg-red-50 transition" title="Delete note"><i data-lucide="trash-2" style="width:14px;height:14px;color:#ef4444;"></i></button>
        </div>
      </div>
    </div>`;
  }).join('');
  lucide.createIcons();
}

// Edit Note
function editNote(noteId) { editingNoteId = noteId; renderNotes(); }
function cancelEditNote() { editingNoteId = null; renderNotes(); }

async function saveEditNote(noteId) {
  const textEl = document.getElementById(`editNoteText_${noteId}`);
  const dateEl = document.getElementById(`editNoteDate_${noteId}`);
  if (!textEl || !dateEl || !currentUser) return;
  const newText = textEl.value.trim();
  const newDate = dateEl.value;
  if (!newText || !newDate) return;

  try {
    const { error } = await supabaseClient.from('notes').update({ note_text: newText, note_date: newDate }).eq('id', noteId).eq('user_id', currentUser.id);
    if (error) throw error;
    const note = allData.find(d => d.__backendId === noteId);
    if (note) { note.note_text = newText; note.note_date = newDate; }
    editingNoteId = null;
    renderNotes();
    showToast('Note updated!');
  } catch (error) {
    console.error('Error updating note:', error);
    showToast('Failed to update note');
  }
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

async function deleteNote(backendId) {
  if (!currentUser) return;
  const note = allData.find(d => d.__backendId === backendId);
  if (!note) return;
  try {
    const { error } = await supabaseClient.from('notes').delete().eq('id', backendId).eq('user_id', currentUser.id);
    if (error) throw error;
    allData = allData.filter(d => d.__backendId !== backendId);
    dataHandler.onDataChanged(allData);
    showToast('Note deleted');
  } catch (error) {
    console.error('Error deleting note:', error);
    showToast('Failed to delete note');
  }
}

// Delete Plant
function confirmDeletePlant() {
  document.getElementById('deletePlantBtn').classList.add('hidden');
  document.getElementById('deleteConfirm').classList.remove('hidden');
}
function cancelDeletePlant() {
  document.getElementById('deleteConfirm').classList.add('hidden');
  document.getElementById('deletePlantBtn').classList.remove('hidden');
}
async function executeDeletePlant() {
  if (!currentUser) return;
  const plant = allData.find(d => d.__backendId === currentPlantId);
  if (!plant) return;
  try {
    const notes = getNotes(currentPlantId);
    await Promise.all(notes.map(n =>
      supabaseClient.from('notes').delete().eq('id', n.__backendId).eq('user_id', currentUser.id)
    ));
    const { error } = await supabaseClient.from('plants').delete().eq('id', currentPlantId).eq('user_id', currentUser.id);
    if (error) throw error;
    allData = allData.filter(d => d.__backendId !== currentPlantId && d.parent_id !== currentPlantId);
    closeDetailModal();
    renderPlants();
    showToast('Plant deleted');
  } catch (error) {
    console.error('Error deleting plant:', error);
    showToast('Failed to delete plant');
  }
}

// Delete Account (PIPEDA / Quebec Law 25 right to erasure)
function openDeleteAccountModal() {
  document.getElementById('deleteAccountModal').classList.remove('hidden');
  document.getElementById('deleteAccountError').classList.add('hidden');
  document.getElementById('deleteAccountConfirmBtn').disabled = false;
  document.getElementById('deleteAccountConfirmBtn').textContent = 'Yes, delete everything';
}

function closeDeleteAccountModal() {
  document.getElementById('deleteAccountModal').classList.add('hidden');
}

async function executeDeleteAccount() {
  if (!currentUser) return;
  const btn = document.getElementById('deleteAccountConfirmBtn');
  const errEl = document.getElementById('deleteAccountError');
  btn.disabled = true;
  btn.textContent = 'Deleting...';
  errEl.classList.add('hidden');

  try {
    // Remove all storage files for this user
    const { data: files } = await supabaseClient.storage
      .from('plant-photos')
      .list(currentUser.id);
    if (files && files.length > 0) {
      const paths = files.map(f => `${currentUser.id}/${f.name}`);
      await supabaseClient.storage.from('plant-photos').remove(paths);
    }

    // Delete auth account via RPC (cascades to plants + notes via ON DELETE CASCADE)
    const { error } = await supabaseClient.rpc('delete_user');
    if (error) throw error;

    currentUser = null;
    allData = [];
    closeDeleteAccountModal();
    updateAuthUI();
    showAuthRequired();
    showToast('Your account has been permanently deleted.');
  } catch (error) {
    console.error('Error deleting account:', error);
    errEl.textContent = 'Failed to delete account. Please contact privacy@sprigs.ca for manual removal.';
    errEl.classList.remove('hidden');
    btn.disabled = false;
    btn.textContent = 'Yes, delete everything';
  }
}

// Lightbox
function openLightbox(src) {
  const lb = document.createElement('div');
  lb.className = 'lightbox';
  lb.onclick = () => lb.remove();
  const img = document.createElement('img');
  img.src = src;
  img.alt = 'Plant photo';
  lb.appendChild(img);
  document.body.appendChild(lb);
}

// --- Plant Identification (Plant.id API) ---

function getPlantIdApiKey() {
  return localStorage.getItem('sprigs_plantid_key') || '';
}

function savePlantIdApiKey() {
  const key = (document.getElementById('plantIdApiKeyInput')?.value || '').trim();
  if (!key) return;
  localStorage.setItem('sprigs_plantid_key', key);
  document.getElementById('plantIdApiKeySection')?.classList.add('hidden');
  identifyPlant();
}

async function identifyPlant() {
  if (!pendingPlantProfilePhoto) return;

  const apiKey = getPlantIdApiKey();
  if (!apiKey) {
    document.getElementById('plantIdApiKeySection')?.classList.remove('hidden');
    return;
  }

  const btn = document.getElementById('identifyBtn');
  const resultsEl = document.getElementById('plantIdResults');
  btn.disabled = true;
  btn.textContent = 'Identifying…';
  resultsEl?.classList.add('hidden');

  try {
    const base64 = await fileToBase64(pendingPlantProfilePhoto);
    const res = await fetch('https://api.plant.id/v3/identification', {
      method: 'POST',
      headers: { 'Api-Key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ images: [base64], details: ['common_names'] })
    });

    if (res.status === 401) {
      localStorage.removeItem('sprigs_plantid_key');
      throw new Error('Invalid API key — please re-enter it.');
    }
    if (!res.ok) throw new Error(`API error ${res.status}`);

    const data = await res.json();

    if (!data.result?.is_plant?.binary) {
      resultsEl.innerHTML = `<p class="text-xs text-amber-700 mt-1">No plant detected in this photo. Try a clearer image.</p>`;
      resultsEl.classList.remove('hidden');
      return;
    }

    const suggestions = (data.result?.classification?.suggestions || []).slice(0, 3);
    if (!suggestions.length) {
      resultsEl.innerHTML = `<p class="text-xs text-amber-700 mt-1">Could not identify this plant.</p>`;
      resultsEl.classList.remove('hidden');
      return;
    }

    resultsEl.innerHTML = `
      <p class="text-xs font-semibold text-green-800 mb-1.5">Top matches — click to use:</p>
      <div class="flex flex-col gap-1.5">
        ${suggestions.map(s => {
          const common = s.details?.common_names?.[0] || s.name;
          const pct = Math.round((s.probability || 0) * 100);
          return `<div class="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg border border-green-200" style="background:#f0faf2;">
            <div class="min-w-0 flex-1">
              <p class="text-xs font-semibold text-green-900 truncate">${escapeHtml(common)}</p>
              <p class="text-xs text-green-600 italic truncate">${escapeHtml(s.name)} &middot; ${pct}%</p>
            </div>
            <button type="button" class="text-xs text-white px-2.5 py-1 rounded-md shrink-0 font-semibold" style="background:#2d6a4f;" data-name="${escapeHtml(common)}" onclick="applyPlantIdResult(this.dataset.name)">Use</button>
          </div>`;
        }).join('')}
      </div>
      <button type="button" onclick="forgetPlantIdKey()" class="text-xs text-green-400 hover:text-green-600 mt-2">Change API key</button>`;
    resultsEl.classList.remove('hidden');
  } catch (err) {
    console.error('Plant ID error:', err);
    resultsEl.innerHTML = `<p class="text-xs text-red-600 mt-1">${escapeHtml(err.message)}</p>`;
    if (err.message.includes('API key')) {
      document.getElementById('plantIdApiKeySection')?.classList.remove('hidden');
    }
    resultsEl.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="search" style="width:12px;height:12px;"></i> Identify Again';
    lucide.createIcons();
  }
}

function applyPlantIdResult(name) {
  const nameInput = document.getElementById('plantName');
  if (nameInput) {
    nameInput.value = name;
    nameInput.focus();
  }
  document.getElementById('plantIdResults')?.classList.add('hidden');
  showToast('Plant name filled in!');
}

function forgetPlantIdKey() {
  localStorage.removeItem('sprigs_plantid_key');
  document.getElementById('plantIdResults')?.classList.add('hidden');
  document.getElementById('plantIdApiKeySection')?.classList.remove('hidden');
  document.getElementById('plantIdApiKeyInput').value = '';
}

// --- Home Page Identify Modal ---

function openIdentifyModal() {
  pendingIdentifyPhoto = null;
  document.getElementById('identifyPhotoPreview').innerHTML = '';
  document.getElementById('identifyPhotoCount').textContent = '';
  document.getElementById('identifyBtnHome').classList.add('hidden');
  document.getElementById('homeIdentifyApiKeySection').classList.add('hidden');
  document.getElementById('homeIdentifyResults').classList.add('hidden');
  document.getElementById('identifyPhotoInput').value = '';
  document.getElementById('identifyModal').classList.remove('hidden');
  lucide.createIcons();
}

function closeIdentifyModal() {
  document.getElementById('identifyModal').classList.add('hidden');
  pendingIdentifyPhoto = null;
}

function updateIdentifyPhotoHome(input) {
  const file = input.files[0];
  if (!file) {
    pendingIdentifyPhoto = null;
    document.getElementById('identifyPhotoPreview').innerHTML = '';
    document.getElementById('identifyPhotoCount').textContent = '';
    document.getElementById('identifyBtnHome').classList.add('hidden');
    return;
  }
  pendingIdentifyPhoto = file;
  document.getElementById('identifyPhotoCount').textContent = file.name;
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById('identifyPhotoPreview').innerHTML = `<img src="${e.target.result}" class="rounded-lg mt-1 max-h-32 object-cover w-full">`;
  };
  reader.readAsDataURL(file);
  document.getElementById('identifyBtnHome').classList.remove('hidden');
  document.getElementById('homeIdentifyResults').classList.add('hidden');
  document.getElementById('homeIdentifyApiKeySection').classList.add('hidden');
  lucide.createIcons();
}

function savePlantIdApiKeyHome() {
  const key = (document.getElementById('homeIdentifyApiKeyInput')?.value || '').trim();
  if (!key) return;
  localStorage.setItem('sprigs_plantid_key', key);
  document.getElementById('homeIdentifyApiKeySection')?.classList.add('hidden');
  identifyPlantHome();
}

async function identifyPlantHome() {
  if (!pendingIdentifyPhoto) return;

  const apiKey = getPlantIdApiKey();
  if (!apiKey) {
    document.getElementById('homeIdentifyApiKeySection')?.classList.remove('hidden');
    return;
  }

  const btn = document.getElementById('identifyBtnHome');
  const resultsEl = document.getElementById('homeIdentifyResults');
  btn.disabled = true;
  btn.textContent = 'Identifying…';
  resultsEl?.classList.add('hidden');

  try {
    const base64 = await fileToBase64(pendingIdentifyPhoto);
    const res = await fetch('https://api.plant.id/v3/identification', {
      method: 'POST',
      headers: { 'Api-Key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ images: [base64], details: ['common_names'] })
    });

    if (res.status === 401) {
      localStorage.removeItem('sprigs_plantid_key');
      throw new Error('Invalid API key — please re-enter it.');
    }
    if (!res.ok) throw new Error(`API error ${res.status}`);

    const data = await res.json();

    if (!data.result?.is_plant?.binary) {
      resultsEl.innerHTML = `<p class="text-xs text-amber-700 mt-1">No plant detected in this photo. Try a clearer image.</p>`;
      resultsEl.classList.remove('hidden');
      return;
    }

    const suggestions = (data.result?.classification?.suggestions || []).slice(0, 3);
    if (!suggestions.length) {
      resultsEl.innerHTML = `<p class="text-xs text-amber-700 mt-1">Could not identify this plant.</p>`;
      resultsEl.classList.remove('hidden');
      return;
    }

    resultsEl.innerHTML = `
      <p class="text-xs font-semibold text-green-800 mb-1.5">Top matches — click to add:</p>
      <div class="flex flex-col gap-1.5">
        ${suggestions.map(s => {
          const common = s.details?.common_names?.[0] || s.name;
          const pct = Math.round((s.probability || 0) * 100);
          return `<div class="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg border border-green-200" style="background:#f0faf2;">
            <div class="min-w-0 flex-1">
              <p class="text-xs font-semibold text-green-900 truncate">${escapeHtml(common)}</p>
              <p class="text-xs text-green-600 italic truncate">${escapeHtml(s.name)} &middot; ${pct}%</p>
            </div>
            <button type="button" class="text-xs text-white px-2.5 py-1 rounded-md shrink-0 font-semibold" style="background:#2d6a4f;" data-name="${escapeHtml(common)}" onclick="applyPlantIdResultHome(this)">Add</button>
          </div>`;
        }).join('')}
      </div>
      <button type="button" onclick="forgetPlantIdKeyHome()" class="text-xs text-green-400 hover:text-green-600 mt-2">Change API key</button>`;
    resultsEl.classList.remove('hidden');
  } catch (err) {
    console.error('Plant ID error:', err);
    resultsEl.innerHTML = `<p class="text-xs text-red-600 mt-1">${escapeHtml(err.message)}</p>`;
    if (err.message.includes('API key')) {
      document.getElementById('homeIdentifyApiKeySection')?.classList.remove('hidden');
    }
    resultsEl.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="search" style="width:12px;height:12px;"></i> Identify Again';
    lucide.createIcons();
  }
}

function applyPlantIdResultHome(btn) {
  const name = btn.getAttribute('data-name');
  closeIdentifyModal();
  openAddPlantModal();
  const nameInput = document.getElementById('plantName');
  if (nameInput) { nameInput.value = name; nameInput.focus(); }
}

function forgetPlantIdKeyHome() {
  localStorage.removeItem('sprigs_plantid_key');
  document.getElementById('homeIdentifyResults')?.classList.add('hidden');
  document.getElementById('homeIdentifyApiKeySection')?.classList.remove('hidden');
  const keyInput = document.getElementById('homeIdentifyApiKeyInput');
  if (keyInput) keyInput.value = '';
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// --- Reminders (localStorage) ---

function toggleReminderSection(type) {
  const sectionId = type === 'plant' ? 'plantReminderSection' : 'noteReminderSection';
  const rowsId   = type === 'plant' ? 'plantReminderRows'   : 'noteReminderRows';
  const section  = document.getElementById(sectionId);
  if (!section) return;
  const willShow = section.classList.contains('hidden');
  section.classList.toggle('hidden');
  if (willShow) {
    const rows = document.getElementById(rowsId);
    if (rows && rows.children.length === 0) addReminderRow(type);
  }
}

function addReminderRow(type) {
  const rowsId = type === 'plant' ? 'plantReminderRows' : 'noteReminderRows';
  const rows = document.getElementById(rowsId);
  if (!rows) return;
  const today = new Date().toISOString().split('T')[0];
  const row = document.createElement('div');
  row.className = 'reminder-row flex gap-2 items-center';
  row.innerHTML = `<input type="date" class="reminder-date border border-green-300 rounded-lg px-2 py-1.5 text-sm bg-white" style="flex:1" min="${today}"><input type="text" placeholder="Label (optional)" class="reminder-label border border-green-300 rounded-lg px-2 py-1.5 text-sm bg-white" style="flex:1" maxlength="60"><button type="button" onclick="removeReminderRow(this)" class="text-red-400 hover:text-red-600 font-bold text-lg leading-none px-1 shrink-0" aria-label="Remove">×</button>`;
  rows.appendChild(row);
}

function removeReminderRow(btn) {
  btn.closest('.reminder-row')?.remove();
}

function collectReminderRows(type) {
  const rowsId = type === 'plant' ? 'plantReminderRows' : 'noteReminderRows';
  const reminders = [];
  document.querySelectorAll(`#${rowsId} .reminder-row`).forEach(row => {
    const date  = row.querySelector('.reminder-date')?.value;
    const label = (row.querySelector('.reminder-label')?.value || '').trim();
    if (date) reminders.push({ date, label });
  });
  return reminders;
}

function resetReminderSection(type) {
  const sectionId = type === 'plant' ? 'plantReminderSection' : 'noteReminderSection';
  const rowsId    = type === 'plant' ? 'plantReminderRows'    : 'noteReminderRows';
  const section = document.getElementById(sectionId);
  const rows    = document.getElementById(rowsId);
  if (section) section.classList.add('hidden');
  if (rows) rows.innerHTML = '';
}

function getStoredReminders() {
  try { return JSON.parse(localStorage.getItem('sprigs_reminders') || '[]'); }
  catch { return []; }
}

function saveStoredReminders(list) {
  localStorage.setItem('sprigs_reminders', JSON.stringify(list));
}

function persistReminders(pending, plantId, plantName, sourceType) {
  if (!pending.length) return;
  const stored = getStoredReminders();
  pending.forEach(r => stored.push({ id: generateId(), plantId, plantName, label: r.label, date: r.date, createdFrom: sourceType }));
  saveStoredReminders(stored);
}

function checkDueReminders() {
  const today = new Date().toISOString().split('T')[0];
  const due = getStoredReminders().filter(r => r.date <= today);
  if (due.length) showReminderBanner(due);
}

function showReminderBanner(due) {
  const banner = document.getElementById('reminderBanner');
  const list   = document.getElementById('reminderBannerList');
  if (!banner || !list) return;
  list.innerHTML = due.map(r =>
    `<div class="reminder-item flex items-center justify-between gap-2" data-id="${r.id}">
      <span class="text-xs text-amber-900 min-w-0"><strong>${escapeHtml(r.plantName)}</strong>${r.label ? ' — ' + escapeHtml(r.label) : ''}<span class="text-amber-500 ml-1">(${formatReminderDate(r.date)})</span></span>
      <button onclick="dismissReminder('${r.id}')" class="text-amber-600 hover:text-amber-800 text-xs font-medium underline shrink-0">Done</button>
    </div>`
  ).join('');
  banner.classList.remove('hidden');
}

function formatReminderDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function dismissReminder(id) {
  saveStoredReminders(getStoredReminders().filter(r => r.id !== id));
  document.querySelector(`.reminder-item[data-id="${id}"]`)?.remove();
  if (!document.querySelector('.reminder-item')) document.getElementById('reminderBanner')?.classList.add('hidden');
}

function dismissAllReminders() {
  const today = new Date().toISOString().split('T')[0];
  saveStoredReminders(getStoredReminders().filter(r => r.date > today));
  document.getElementById('reminderBanner')?.classList.add('hidden');
}

lucide.createIcons();
