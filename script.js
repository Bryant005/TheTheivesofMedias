// RetroTube client script: handles uploads, listing, simple validation, transcripts.
// Storage key
const STORAGE_KEY = 'retrotube_videos_v1';

// Utility: load and save
function loadVideos(){
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]') } catch(e){ return [] }
}
function saveVideos(arr){ localStorage.setItem(STORAGE_KEY, JSON.stringify(arr)) }

// Initialize pages
document.addEventListener('DOMContentLoaded', ()=> {
  const uploadForm = document.getElementById('uploadForm');
  const contactForm = document.getElementById('contactForm');
  const videoListEl = document.getElementById('videoList');

  if(videoListEl) renderVideoList(videoListEl);

  if(uploadForm){
    uploadForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const status = document.getElementById('uploadStatus');
      status.textContent = 'Processing upload...';
      const title = document.getElementById('title').value.trim();
      const description = document.getElementById('description').value.trim();
      const videoFileInput = document.getElementById('videoFile');
      const captionFileInput = document.getElementById('captionFile');
      const transcriptText = document.getElementById('transcript').value.trim();

      if(!videoFileInput.files.length){
        status.textContent = 'Please select a video file.';
        return;
      }
      const file = videoFileInput.files[0];
      // Read file as blob URL
      const blobUrl = URL.createObjectURL(file);
      let vtt = '';
      if(captionFileInput.files.length){
        vtt = await captionFileInput.files[0].text();
      }
      const id = 'v' + Date.now();
      const videoObj = {
        id, title, description, blobUrl, created: new Date().toISOString(), vtt, transcript: transcriptText
      };
      const arr = loadVideos();
      arr.unshift(videoObj);
      saveVideos(arr);
      status.textContent = 'Upload saved locally. Video available in Browse.';
      uploadForm.reset();
      // release blob URL after short time (browse will create new object URLs when needed)
      setTimeout(()=> URL.revokeObjectURL(blobUrl), 5000);
    });
  }

  if(contactForm){
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const status = document.getElementById('contactStatus');
      const name = document.getElementById('name').value.trim();
      const email = document.getElementById('email').value.trim();
      const message = document.getElementById('message').value.trim();
      if(!name || !email || !message){
        status.textContent = 'Please complete all fields.';
        return;
      }
      status.textContent = 'Message sent (simulated). Thank you!';
      contactForm.reset();
    });
  }
});

// Render video list on browse page
function renderVideoList(container){
  container.innerHTML = '';
  const arr = loadVideos();
  if(!arr.length){
    const p = document.createElement('p');
    p.textContent = 'No videos uploaded yet. Use Upload to add a video.';
    container.appendChild(p);
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
    // create object URL from stored blob: we saved a blob URL originally, but after reload that URL may be revoked.
    // As a simple fallback, we keep the original blobUrl if present. This is intentionally a browser-only demo.
    videoEl.src = v.blobUrl || '';
    videoEl.setAttribute('aria-label', v.title || 'Video player');
    article.appendChild(videoEl);

    if(v.vtt){
      const track = document.createElement('track');
      track.kind = 'subtitles';
      track.label = 'English';
      track.srclang = 'en';
      // create blob url for captions
      const blob = new Blob([v.vtt], {type:'text/vtt'});
      const url = URL.createObjectURL(blob);
      track.src = url;
      videoEl.appendChild(track);
      // revoke after use
      videoEl.addEventListener('loadeddata', ()=> setTimeout(()=> URL.revokeObjectURL(url), 5000));
    }

    const desc = document.createElement('p');
    desc.className = 'video-desc';
    desc.textContent = v.description || '';
    article.appendChild(desc);

    // transcript download link
    const download = document.createElement('a');
    download.className = 'download-transcript';
    download.href = '#';
    download.textContent = 'Download transcript';
    if(v.transcript){
      const blob = new Blob([v.transcript], {type:'text/plain'});
      const url = URL.createObjectURL(blob);
      download.href = url;
      download.download = (v.title||'transcript') + '.txt';
      // revoke after click
      download.addEventListener('click', ()=> setTimeout(()=> URL.revokeObjectURL(url), 2000));
    } else {
      download.setAttribute('aria-disabled', 'true');
      download.style.opacity = '0.6';
      download.addEventListener('click', (e)=> e.preventDefault());
    }
    article.appendChild(download);

    container.appendChild(article);
  });
}
