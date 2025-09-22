// RetroTube full script.js
// Features: admin unlock (client-side), upload YouTube links (localStorage), fetch shared data/videos.json & data/news.json from repo,
// merge shared with local, render Browse, Gallery, News, Contact, Export helpers.

// CONFIG
const STORAGE_VIDEOS = 'retrotube_videos_v1';
const STORAGE_NEWS = 'retrotube_news_v1';
const SESSION_KEY = 'retrotube_admin_unlocked';
const SHARED_VIDEOS_PATH = 'data/videos.json';
const SHARED_NEWS_PATH = 'data/news.json';
// Set your admin password here (change before publishing)
const ADMIN_PASSWORD = 'enter_your_admin_password_here';

// -------------------- Admin unlock logic --------------------
function setUnlocked(unlocked){
  const overlay = document.getElementById('adminOverlay');
  const uploadForm = document.getElementById('uploadForm');
  const lockedNotice = document.getElementById('lockedNotice');
  const logoutBtn = document.getElementById('logoutBtn');
  if(unlocked){
    sessionStorage.setItem(SESSION_KEY, '1');
    if(overlay) overlay.style.display = 'none';
    if(uploadForm) uploadForm.classList.remove('hidden');
    if(lockedNotice) lockedNotice.classList.add('hidden');
    if(logoutBtn) logoutBtn.classList.remove('hidden');
  } else {
    sessionStorage.removeItem(SESSION_KEY);
    if(overlay) overlay.style.display = '';
    if(uploadForm) uploadForm.classList.add('hidden');
    if(lockedNotice) lockedNotice.classList.remove('hidden');
    if(logoutBtn) logoutBtn.classList.add('hidden');
  }
}

// -------------------- DOM Ready --------------------
document.addEventListener('DOMContentLoaded', ()=> {
  initAdminOverlay();
  initUploadForm();
  initContactForm();
  initNewsForm();
  // initial renders (async functions are triggered)
  renderBrowse();
  renderGallery();
  renderNewsList();
});

// -------------------- Init helpers --------------------
function initAdminOverlay(){
  const overlay = document.getElementById('adminOverlay');
  if(!overlay) return;
  const unlockBtn = document.getElementById('unlockBtn');
  const cancelBtn = document.getElementById('cancelBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const adminPass = document.getElementById('adminPass');
  const adminStatus = document.getElementById('adminStatus');

  if(sessionStorage.getItem(SESSION_KEY) === '1') setUnlocked(true);
  else setUnlocked(false);

  unlockBtn && unlockBtn.addEventListener('click', (e) => {
    e.preventDefault();
    const val = (adminPass.value || '').trim();
    if(!val){ if(adminStatus) adminStatus.textContent = 'Enter password.'; return; }
    if(val === ADMIN_PASSWORD){
      if(adminStatus) adminStatus.textContent = 'Unlocked for this session.';
      setUnlocked(true);
      adminPass.value = '';
    } else {
      if(adminStatus) adminStatus.textContent = 'Incorrect password.';
    }
  });

  cancelBtn && cancelBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if(!sessionStorage.getItem(SESSION_KEY)) window.location.href = 'index.html';
  });

  logoutBtn && logoutBtn.addEventListener('click', (e) => {
    e.preventDefault();
    setUnlocked(false);
    if(adminStatus) adminStatus.textContent = 'Locked.';
  });

  document.addEventListener('keydown', (e) => {
    if(overlay.style.display !== 'none' && e.key === 'Escape') {
      if(!sessionStorage.getItem(SESSION_KEY)) window.location.href = 'index.html';
    }
  });
}

// -------------------- Storage utilities --------------------
function load(key){ try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch (e) { return []; } }
function save(key, arr){ localStorage.setItem(key, JSON.stringify(arr)); }
function loadVideos(){ return load(STORAGE_VIDEOS); }
function saveVideos(arr){ save(STORAGE_VIDEOS, arr); }

// -------------------- Shared videos & news fetch & merge --------------------
async function fetchSharedJson(path){
  try {
    const res = await fetch(path, { cache: 'no-store' });
    if(!res.ok) return [];
    const arr = await res.json();
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    console.warn('Error fetching shared JSON', path, e);
    return [];
  }
}

async function fetchSharedVideos(){ return await fetchSharedJson(SHARED_VIDEOS_PATH); }
async function fetchSharedNews(){ return await fetchSharedJson(SHARED_NEWS_PATH); }

async function loadCombinedVideos(){
  const shared = await fetchSharedVideos();
  const local = loadVideos();
  const map = new Map();
  shared.forEach(v => {
    if(!v) return;
    const key = v.youtubeId || v.id;
    if(key) map.set(key, v);
  });
  local.forEach(v => {
    if(!v) return;
    const key = v.youtubeId || v.id;
    if(key && !map.has(key)) map.set(key, v);
  });
  // Return shared first (in their order), then local-only (as inserted)
  return Array.from(map.values());
}

async function loadCombinedNews(){
  const shared = await fetchSharedNews();
  const local = load(STORAGE_NEWS);
  const map = new Map();
  shared.forEach(n => { if(n && n.id) { n._fromRepo = true; map.set(n.id, n); } });
  local.forEach(n => { if(n && n.id && !map.has(n.id)) map.set(n.id, n); });
  // Sort by created/date desc
  const arr = Array.from(map.values());
  arr.sort((a,b) => {
    const ta = new Date(a.created || a.date || 0).getTime();
    const tb = new Date(b.created || b.date || 0).getTime();
    return tb - ta;
  });
  return arr;
}

// -------------------- File helper --------------------
function fileToDataUrl(file){
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => res(reader.result);
    reader.onerror = () => rej(new Error('File read error'));
    reader.readAsDataURL(file);
  });
}

// -------------------- YouTube ID extraction --------------------
function extractYouTubeId(url){
  if(!url) return null;
  try {
    url = url.trim();
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtube\.com\/v\/|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/,
      /youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/
    ];
    for(const p of patterns){
      const m = url.match(p);
      if(m && m[1]) return m[1];
    }
    const u = new URL(url);
    if(u.searchParams && u.searchParams.get('v') && u.searchParams.get('v').length === 11) return u.searchParams.get('v');
    return null;
  } catch (e) { return null; }
}

// -------------------- Upload form (owner adds YouTube links) --------------------
function initUploadForm(){
  const uploadForm = document.getElementById('uploadForm');
  if(!uploadForm) return;
  uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if(sessionStorage.getItem(SESSION_KEY) !== '1'){
      const statusEl = document.getElementById('uploadStatus');
      if(statusEl) statusEl.textContent = 'Unlock admin first to add videos.';
      return;
    }
    const statusEl = document.getElementById('uploadStatus');
    statusEl && (statusEl.textContent = 'Validating...');
    const ytUrl = (document.getElementById('ytUrl') || {}).value || '';
    const title = (document.getElementById('title') || {}).value.trim() || '';
    const description = (document.getElementById('description') || {}).value.trim() || '';
    const transcript = (document.getElementById('transcript') || {}).value.trim() || '';
    const posterInput = document.getElementById('posterFile');

    const youtubeId = extractYouTubeId(ytUrl);
    if(!youtubeId){
      statusEl && (statusEl.textContent = 'Invalid YouTube URL. Use a standard youtube.com or youtu.be link.');
      return;
    }

    let posterData = '';
    if(posterInput && posterInput.files && posterInput.files.length){
      const file = posterInput.files[0];
      if(file.size > 250 * 1024){
        statusEl && (statusEl.textContent = 'Poster image too large. Use <250 KB.');
        return;
      }
      try { posterData = await fileToDataUrl(file); } catch { statusEl && (statusEl.textContent = 'Error reading poster image.'); return; }
    }

    const id = 'y' + Date.now();
    const record = { id, title, description, youtubeId, transcript, posterData, created: new Date().toISOString() };
    const arr = loadVideos();
    arr.unshift(record);
    saveVideos(arr);
    statusEl && (statusEl.textContent = 'Video added locally. To make it public, add it to data/videos.json in the repo.');
    uploadForm.reset();
    renderBrowse();
    renderGallery();
  });
}

// -------------------- Contact form --------------------
function initContactForm(){
  const contactForm = document.getElementById('contactForm');
  if(!contactForm) return;
  contactForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const status = document.getElementById('contactStatus');
    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const message = document.getElementById('message').value.trim();
    if(!name || !email || !message){ status.textContent = 'Please complete all fields.'; return; }
    status.textContent = 'Message sent (simulated). Thank you!';
    contactForm.reset();
  });
}

// -------------------- News form (local) --------------------
function initNewsForm(){
  const newsForm = document.getElementById('newsForm');
  if(!newsForm) return;
  newsForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const status = document.getElementById('newsStatus');
    const title = document.getElementById('newsTitle').value.trim();
    const date = document.getElementById('newsDate').value;
    const body = document.getElementById('newsBody').value.trim();
    if(!title || !date || !body){ status.textContent = 'Please complete all fields.'; return; }
    const id = 'n' + Date.now();
    const arr = load(STORAGE_NEWS);
    arr.unshift({ id, title, date, body, created: new Date().toISOString() });
    save(STORAGE_NEWS, arr);
    status.textContent = 'News published locally. To publish globally, add it to data/news.json in the repo.';
    newsForm.reset();
    renderNewsList();
  });
}

// -------------------- Render Browse (async) --------------------
async function renderBrowse(){
  const container = document.getElementById('videoList');
  if(!container) return;
  container.innerHTML = '';
  const arr = await loadCombinedVideos();
  if(!arr || !arr.length){
    const p = document.createElement('p');
    p.textContent = 'No videos yet. Owner can add YouTube links on Upload or update data/videos.json in the repo.';
    container.appendChild(p);
    return;
  }
  arr.forEach(v => {
    const art = document.createElement('article');
    art.className = 'video-card';
    art.id = 'video-' + (v.id || ('y' + (v.youtubeId || Date.now())));

    const h3 = document.createElement('h3'); h3.className = 'video-title'; h3.textContent = v.title || 'Untitled';
    art.appendChild(h3);

    const iframe = document.createElement('iframe');
    iframe.width = '560';
    iframe.height = '315';
    iframe.src = `https://www.youtube.com/embed/${v.youtubeId}`;
    iframe.title = v.title || 'YouTube video player';
    iframe.setAttribute('frameborder','0');
    iframe.setAttribute('allow','accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
    iframe.setAttribute('allowfullscreen','');
    art.appendChild(iframe);

    const desc = document.createElement('p'); desc.className = 'video-desc'; desc.textContent = v.description || '';
    art.appendChild(desc);

    const actions = document.createElement('div'); actions.className = 'card-actions';
    const ytLink = document.createElement('a'); ytLink.href = `https://www.youtube.com/watch?v=${v.youtubeId}`; ytLink.target = '_blank'; ytLink.rel = 'noopener'; ytLink.textContent = 'Watch on YouTube';
    ytLink.style.marginRight = '0.6rem';
    actions.appendChild(ytLink);

    const delBtn = document.createElement('button'); delBtn.className = 'btn btn-delete'; delBtn.textContent = 'Delete';
    delBtn.addEventListener('click', ()=> {
      if(sessionStorage.getItem(SESSION_KEY) !== '1'){ alert('Admin unlocked only'); return; }
      if(!confirm('Delete this video locally? (Repo videos must be edited in data/videos.json)')) return;
      const list = loadVideos().filter(x => x.id !== v.id);
      saveVideos(list);
      renderBrowse();
      renderGallery();
    });
    // show delete only if this id exists in local storage
    const localIds = loadVideos().map(x => x.id);
    if(localIds.includes(v.id)) actions.appendChild(delBtn);

    art.appendChild(actions);

    if(v.transcript){
      const blob = new Blob([v.transcript], {type:'text/plain'});
      const url = URL.createObjectURL(blob);
      const dl = document.createElement('a');
      dl.href = url;
      dl.download = (v.title || 'transcript') + '.txt';
      dl.textContent = 'Download transcript';
      dl.style.display = 'inline-block';
      dl.style.marginTop = '0.5rem';
      dl.addEventListener('click', ()=> setTimeout(()=> URL.revokeObjectURL(url), 2000));
      art.appendChild(dl);
    }

    container.appendChild(art);
  });
}

// -------------------- Render Gallery (async) --------------------
async function renderGallery(){
  const gallery = document.getElementById('galleryGrid');
  if(!gallery) return;
  gallery.innerHTML = '';
  const arr = await loadCombinedVideos();
  if(!arr.length){ gallery.appendChild(document.createElement('p')).textContent = 'No gallery items yet.'; return; }
  arr.forEach(v => {
    const div = document.createElement('div');
    div.className = 'gallery-item';
    div.tabIndex = 0;

    const img = document.createElement('img');
    img.className = 'gallery-thumb';
    img.alt = v.title || 'Video thumbnail';
    if(v.posterData) img.src = v.posterData;
    else if(v.posterUrl) img.src = v.posterUrl;
    else img.src = `https://img.youtube.com/vi/${v.youtubeId}/hqdefault.jpg`;
    div.appendChild(img);

    const caption = document.createElement('div'); caption.textContent = v.title || 'Untitled';
    div.appendChild(caption);

    div.addEventListener('click', ()=> { window.location.href = 'browse.html#video-' + (v.id || ('y' + (v.youtubeId || Date.now()))); });
    div.addEventListener('keydown', (e)=> { if(e.key === 'Enter') div.click(); });

    gallery.appendChild(div);
  });
}

// -------------------- Render News (async) --------------------
async function renderNewsList(){
  const container = document.getElementById('newsList');
  if(!container) return;
  container.innerHTML = '';
  const arr = await loadCombinedNews();
  if(!arr.length){ container.appendChild(document.createElement('p')).textContent = 'No news yet.'; return; }
  const localIds = load(STORAGE_NEWS).map(x => x.id);
  arr.forEach(n => {
    const item = document.createElement('div');
    item.className = 'news-item';
    const h3 = document.createElement('h3'); h3.textContent = n.title;
    const meta = document.createElement('div'); meta.className = 'news-date';
    meta.textContent = n.date ? new Date(n.date).toLocaleDateString() : (n.created ? new Date(n.created).toLocaleDateString() : '');
    const p = document.createElement('p'); p.textContent = n.body;
    item.appendChild(h3); item.appendChild(meta); item.appendChild(p);
    // Allow delete only for local items
    if(localIds.includes(n.id)){
      const del = document.createElement('button'); del.className = 'btn btn-delete'; del.textContent = 'Delete';
      del.addEventListener('click', ()=>{
        if(sessionStorage.getItem(SESSION_KEY) !== '1'){ alert('Admin unlocked only'); return; }
        if(!confirm('Delete this news item locally? (Repo news must be edited in data/news.json)')) return;
        let list = load(STORAGE_NEWS); list = list.filter(x => x.id !== n.id); save(STORAGE_NEWS, list); renderNewsList();
      });
      item.appendChild(del);
    }
    container.appendChild(item);
  });
}

// -------------------- Export helpers (build shared JSON for copy-paste) --------------------
// Useful to produce ready-to-paste JSON you can commit to data/videos.json or data/news.json.

function buildSharedVideosJson(){
  // combine shared + local, prefer shared (but include all)
  fetchSharedVideos().then(shared => {
    const local = loadVideos();
    const all = [...shared];
    // include local items that are not duplicates by youtubeId
    const ids = new Set(shared.map(s => s.youtubeId || s.id));
    local.forEach(l => {
      const key = l.youtubeId || l.id;
      if(!ids.has(key)){
        // convert posterData to posterUrl placeholder (manual step): keep posterData as-is so you can inspect
        all.push(Object.assign({}, l));
      }
    });
    const json = JSON.stringify(all, null, 2);
    copyToClipboard(json);
    alert('Combined videos JSON copied to clipboard. Paste into data/videos.json in your repo and commit.');
  });
}

function buildSharedNewsJson(){
  fetchSharedNews().then(shared => {
    const local = load(STORAGE_NEWS);
    const all = [...shared];
    const ids = new Set(shared.map(s => s.id));
    local.forEach(l => { if(!ids.has(l.id)) all.push(l); });
    const json = JSON.stringify(all, null, 2);
    copyToClipboard(json);
    alert('Combined news JSON copied to clipboard. Paste into data/news.json in your repo and commit.');
  });
}

function copyToClipboard(text){
  try {
    navigator.clipboard.writeText(text);
  } catch (e) {
    // fallback
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
}
