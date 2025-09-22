// RetroTube script: YouTube-link workflow, owner-only admin unlock, localStorage persistence.

// Constants
const STORAGE_VIDEOS = 'retrotube_videos_v1';
const STORAGE_NEWS = 'retrotube_news_v1';
const SESSION_KEY = 'retrotube_admin_unlocked';

// === Admin unlock logic (client-side simple protection) ===
// Replace the ADMIN_PASSWORD string below with your chosen password.
const ADMIN_PASSWORD = 'Greg';

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

document.addEventListener('DOMContentLoaded', ()=> {
  // initialize admin overlay if present
  const overlay = document.getElementById('adminOverlay');
  if(overlay){
    const unlockBtn = document.getElementById('unlockBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const adminPass = document.getElementById('adminPass');
    const adminStatus = document.getElementById('adminStatus');

    if(sessionStorage.getItem(SESSION_KEY) === '1') setUnlocked(true);
    else setUnlocked(false);

    unlockBtn && unlockBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const val = adminPass.value || '';
      if(!val){ adminStatus.textContent = 'Enter password.'; return; }
      if(val === ADMIN_PASSWORD){
        adminStatus.textContent = 'Unlocked for this session.';
        setUnlocked(true);
        adminPass.value = '';
      } else {
        adminStatus.textContent = 'Incorrect password.';
      }
    });

    cancelBtn && cancelBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if(!sessionStorage.getItem(SESSION_KEY)) window.location.href = 'index.html';
    });

    logoutBtn && logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      setUnlocked(false);
      const adminStatus = document.getElementById('adminStatus');
      if(adminStatus) adminStatus.textContent = 'Locked.';
    });

    document.addEventListener('keydown', (e) => {
      if(overlay.style.display !== 'none' && e.key === 'Escape') {
        if(!sessionStorage.getItem(SESSION_KEY)) window.location.href = 'index.html';
      }
    });
  }

  // initialize upload form handler (YouTube link)
  const uploadForm = document.getElementById('uploadForm');
  if(uploadForm){
    uploadForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if(sessionStorage.getItem(SESSION_KEY) !== '1'){
        document.getElementById('uploadStatus').textContent = 'Unlock admin first to add videos.';
        return;
      }
      const statusEl = document.getElementById('uploadStatus');
      statusEl.textContent = 'Validating...';
      const ytUrl = (document.getElementById('ytUrl') || {}).value || '';
      const title = (document.getElementById('title') || {}).value.trim() || '';
      const description = (document.getElementById('description') || {}).value.trim() || '';
      const transcript = (document.getElementById('transcript') || {}).value.trim() || '';
      const posterInput = document.getElementById('posterFile');

      const youtubeId = extractYouTubeId(ytUrl);
      if(!youtubeId){
        statusEl.textContent = 'Invalid YouTube URL. Use a full https://youtu.be/ or youtube.com/watch?v= link.';
        return;
      }

      // optional poster image as data URL (limit size)
      let posterData = '';
      if(posterInput && posterInput.files && posterInput.files.length){
        const file = posterInput.files[0];
        if(file.size > 250 * 1024){
          statusEl.textContent = 'Poster image too large. Please use an image under ~250 KB.';
          return;
        }
        try {
          posterData = await fileToDataUrl(file);
        } catch (err) {
          statusEl.textContent = 'Error reading poster image.';
          return;
        }
      }

      const id = 'y' + Date.now();
      const record = { id, title, description, youtubeId, transcript, posterData, created: new Date().toISOString() };
      const arr = loadVideos();
      arr.unshift(record);
      saveVideos(arr);
      statusEl.textContent = 'Video added. It will appear in Browse and Gallery.';
      uploadForm.reset();
      renderBrowse();
      renderGallery();
    });
  }

  // contact form
  const contactForm = document.getElementById('contactForm');
  if(contactForm){
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

  // news form
  const newsForm = document.getElementById('newsForm');
  if(newsForm){
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
      status.textContent = 'News published locally.';
      newsForm.reset();
      renderNewsList();
    });
  }

  // initial render
  renderBrowse();
  renderGallery();
  renderNewsList();
});

// ==================== Utilities: storage, file read ====================
function load(key){ try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch (e) { return []; } }
function save(key, arr){ localStorage.setItem(key, JSON.stringify(arr)); }
function loadVideos(){ return load(STORAGE_VIDEOS); }
function saveVideos(arr){ save(STORAGE_VIDEOS, arr); }

// file to data URL (for poster images)
function fileToDataUrl(file){
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => res(reader.result);
    reader.onerror = () => rej(new Error('File read error'));
    reader.readAsDataURL(file);
  });
}

// Extract YouTube ID from multiple URL formats
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

// ==================== Render functions ====================
function renderBrowse(){
  const container = document.getElementById('videoList');
  if(!container) return;
  container.innerHTML = '';
  const arr = loadVideos();
  if(!arr.length){
    const p = document.createElement('p');
    p.textContent = 'No videos yet. Owner can add YouTube links on Upload.';
    container.appendChild(p);
    return;
  }
  arr.forEach(v => {
    const art = document.createElement('article');
    art.className = 'video-card';
    art.id = 'video-' + v.id;

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
      if(!confirm('Delete this video?')) return;
      const list = loadVideos().filter(x => x.id !== v.id);
      saveVideos(list);
      renderBrowse();
      renderGallery();
    });
    actions.appendChild(delBtn);

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

function renderGallery(){
  const gallery = document.getElementById('galleryGrid');
  if(!gallery) return;
  gallery.innerHTML = '';
  const arr = loadVideos();
  if(!arr.length){ gallery.appendChild(document.createElement('p')).textContent = 'No gallery items yet.'; return; }
  arr.forEach(v => {
    const div = document.createElement('div');
    div.className = 'gallery-item';
    div.tabIndex = 0;

    const img = document.createElement('img');
    img.className = 'gallery-thumb';
    img.alt = v.title || 'Video thumbnail';
    if(v.posterData) img.src = v.posterData;
    else img.src = `https://img.youtube.com/vi/${v.youtubeId}/hqdefault.jpg`;
    div.appendChild(img);

    const caption = document.createElement('div'); caption.textContent = v.title || 'Untitled';
    div.appendChild(caption);

    div.addEventListener('click', ()=> { window.location.href = 'browse.html#video-' + v.id; });
    div.addEventListener('keydown', (e)=> { if(e.key === 'Enter') div.click(); });

    gallery.appendChild(div);
  });
}

// ==================== News rendering ====================
function renderNewsList(){
  const container = document.getElementById('newsList');
  if(!container) return;
  container.innerHTML = '';
  const arr = load(STORAGE_NEWS);
  if(!arr.length){ container.appendChild(document.createElement('p')).textContent = 'No news yet.'; return; }
  arr.forEach(n => {
    const item = document.createElement('div');
    item.className = 'news-item';
    const h3 = document.createElement('h3'); h3.textContent = n.title;
    const meta = document.createElement('div'); meta.className = 'news-date'; meta.textContent = new Date(n.date).toLocaleDateString();
    const p = document.createElement('p'); p.textContent = n.body;
    const del = document.createElement('button'); del.className = 'btn btn-delete'; del.textContent = 'Delete'; del.addEventListener('click', ()=>{
      if(sessionStorage.getItem(SESSION_KEY) !== '1'){ alert('Admin unlocked only'); return; }
      if(!confirm('Delete this news item?')) return;
      let list = load(STORAGE_NEWS); list = list.filter(x => x.id !== n.id); save(STORAGE_NEWS, list); renderNewsList();
    });
    item.appendChild(h3); item.appendChild(meta); item.appendChild(p); item.appendChild(del);
    container.appendChild(item);
  });
}
