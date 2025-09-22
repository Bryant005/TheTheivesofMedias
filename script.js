// RetroTube full client script: videos, delete/edit, gallery, news/events, contact.
// Storage keys
const STORAGE_VIDEOS = 'retrotube_videos_v1';
const STORAGE_NEWS = 'retrotube_news_v1';

// Utils
function load(key){ try { return JSON.parse(localStorage.getItem(key)||'[]') } catch(e){ return [] } }
function save(key, arr){ localStorage.setItem(key, JSON.stringify(arr)) }

// Init
document.addEventListener('DOMContentLoaded', ()=> {
  initUploadForm();
  initContactForm();
  renderBrowse();
  renderGallery();
  initNewsForm();
  renderNewsList();
});

// Upload form
function initUploadForm(){
  const uploadForm = document.getElementById('uploadForm');
  if(!uploadForm) return;
  uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const status = document.getElementById('uploadStatus');
    status.textContent = 'Processing upload...';
    const title = document.getElementById('title').value.trim();
    const description = document.getElementById('description').value.trim();
    const videoFileInput = document.getElementById('videoFile');
    const captionFileInput = document.getElementById('captionFile');
    const posterFileInput = document.getElementById('posterFile');
    const transcriptText = document.getElementById('transcript').value.trim();

    if(!videoFileInput.files.length){
      status.textContent = 'Please select a video file.';
      return;
    }
    const file = videoFileInput.files[0];
    const blobUrl = URL.createObjectURL(file);
    let vtt = '';
    if(captionFileInput.files.length) vtt = await captionFileInput.files[0].text();

    let posterUrl = '';
    if(posterFileInput && posterFileInput.files.length){
      posterUrl = URL.createObjectURL(posterFileInput.files[0]);
    }

    const id = 'v' + Date.now();
    const videoObj = { id, title, description, blobUrl, created: new Date().toISOString(), vtt, transcript: transcriptText, poster: posterUrl };
    const arr = load(STORAGE_VIDEOS);
    arr.unshift(videoObj);
    save(STORAGE_VIDEOS, arr);
    status.textContent = 'Upload saved locally. Video available in Browse and Gallery.';
    uploadForm.reset();
    renderBrowse();
    renderGallery();
    setTimeout(()=> URL.revokeObjectURL(blobUrl), 5000);
    if(posterUrl) setTimeout(()=> URL.revokeObjectURL(posterUrl), 5000);
  });
}

// Contact form
function initContactForm(){
  const contactForm = document.getElementById('contactForm');
  if(!contactForm) return;
  contactForm.addEventListener('submit', (e)=>{
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

// Browse rendering, delete, edit
function renderBrowse(){
  const container = document.getElementById('videoList');
  if(!container) return;
  container.innerHTML = '';
  const arr = load(STORAGE_VIDEOS);
  if(!arr.length){
    container.appendChild(document.createElement('p')).textContent = 'No videos uploaded yet. Use Upload to add a video.';
    return;
  }
  arr.forEach((v, idx) => {
    const article = document.createElement('article');
    article.className = 'video-card';
    article.id = 'video-' + v.id;

    const title = document.createElement('h3');
    title.className = 'video-title';
    title.textContent = v.title || ('Untitled video ' + (idx+1));
    article.appendChild(title);

    const videoEl = document.createElement('video');
    videoEl.controls = true;
    videoEl.preload = 'metadata';
    videoEl.className = 'video-player';
    videoEl.src = v.blobUrl || '';
    videoEl.setAttribute('aria-label', v.title || 'Video player');
    article.appendChild(videoEl);

    if(v.vtt){
      const track = document.createElement('track');
      track.kind = 'subtitles'; track.label = 'English'; track.srclang = 'en';
      const blob = new Blob([v.vtt], {type:'text/vtt'});
      const url = URL.createObjectURL(blob);
      track.src = url;
      videoEl.appendChild(track);
      videoEl.addEventListener('loadeddata', ()=> setTimeout(()=> URL.revokeObjectURL(url), 5000));
    }

    const desc = document.createElement('p');
    desc.className = 'video-desc';
    desc.textContent = v.description || '';
    article.appendChild(desc);

    const download = document.createElement('a');
    download.className = 'download-transcript';
    download.textContent = 'Download transcript';
    if(v.transcript){
      const blob = new Blob([v.transcript], {type:'text/plain'});
      const url = URL.createObjectURL(blob);
      download.href = url;
      download.download = (v.title||'transcript') + '.txt';
      download.addEventListener('click', ()=> setTimeout(()=> URL.revokeObjectURL(url), 2000));
    } else {
      download.href = '#';
      download.setAttribute('aria-disabled','true');
      download.style.opacity = '0.6';
      download.addEventListener('click', (e)=> e.preventDefault());
    }
    article.appendChild(download);

    const actions = document.createElement('div');
    actions.className = 'card-actions';
    const delBtn = document.createElement('button');
    delBtn.className = 'btn btn-delete';
    delBtn.textContent = 'Delete';
    delBtn.addEventListener('click', ()=> handleDeleteVideo(v.id));
    actions.appendChild(delBtn);

    const editBtn = document.createElement('button');
    editBtn.className = 'btn btn-edit';
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', ()=> handleEditVideo(v.id));
    actions.appendChild(editBtn);

    article.appendChild(actions);
    container.appendChild(article);
  });
}

function handleDeleteVideo(id){
  if(!confirm('Delete this video? This action cannot be undone.')) return;
  let arr = load(STORAGE_VIDEOS);
  arr = arr.filter(v => v.id !== id);
  save(STORAGE_VIDEOS, arr);
  renderBrowse();
  renderGallery();
  const statusEl = document.getElementById('uploadStatus') || document.getElementById('contactStatus');
  if(statusEl) statusEl.textContent = 'Video deleted.';
}

function handleEditVideo(id){
  const arr = load(STORAGE_VIDEOS);
  const item = arr.find(v => v.id === id);
  if(!item) return alert('Video not found.');
  const newTitle = prompt('Edit title', item.title) || item.title;
  const newDesc = prompt('Edit description', item.description) || item.description;
  item.title = newTitle;
  item.description = newDesc;
  save(STORAGE_VIDEOS, arr);
  renderBrowse();
  renderGallery();
}

// Gallery rendering
function renderGallery(){
  const gallery = document.getElementById('galleryGrid');
  if(!gallery) return;
  gallery.innerHTML = '';
  const arr = load(STORAGE_VIDEOS);
  if(!arr.length){ gallery.appendChild(document.createElement('p')).textContent = 'No gallery items yet.'; return; }
  arr.forEach(v => {
    const div = document.createElement('div');
    div.className = 'gallery-item';
    div.tabIndex = 0;
    const img = document.createElement('img');
    img.className = 'gallery-thumb';
    img.src = v.poster || 'images/video-placeholder.png';
    img.alt = v.title || 'Video thumbnail';
    div.appendChild(img);
    const caption = document.createElement('div');
    caption.textContent = v.title || 'Untitled';
    div.appendChild(caption);
    div.addEventListener('click', ()=> {
      window.location.href = 'browse.html#video-' + v.id;
    });
    div.addEventListener('keydown', (e)=> { if(e.key === 'Enter') div.click(); });
    gallery.appendChild(div);
  });
}

// News & Events
function initNewsForm(){
  const newsForm = document.getElementById('newsForm');
  if(!newsForm) return;
  newsForm.addEventListener('submit', (e)=>{
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
      if(!confirm('Delete this news item?')) return;
      let list = load(STORAGE_NEWS); list = list.filter(x => x.id !== n.id); save(STORAGE_NEWS, list); renderNewsList();
    });
    item.appendChild(h3); item.appendChild(meta); item.appendChild(p); item.appendChild(del);
    container.appendChild(item);
  });
}
