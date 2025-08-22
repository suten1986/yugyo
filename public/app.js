
const timelineEl = document.getElementById('timeline');
const loadMoreBtn = document.getElementById('loadMore');
const loaderEl = document.getElementById('loader');
const refreshBtn = document.getElementById('refreshBtn');
const fallbackEl = document.getElementById('fallback');

let nextCursor = null;
const loadedIds = new Set();

refreshBtn.addEventListener('click', () => window.location.reload());

function ensureFbSdk() {
  if (window.FB) { window.FB.XFBML.parse(); return; }
  const s = document.createElement('script');
  s.async = true; s.defer = true; s.crossOrigin = 'anonymous';
  s.src = 'https://connect.facebook.net/ja_JP/sdk.js#xfbml=1&version=v18.0';
  s.onload = () => window.FB && window.FB.XFBML.parse();
  document.body.appendChild(s);
}

function showFallback() {
  if (!fallbackEl.hasChildNodes()) {
    fallbackEl.innerHTML = `
      <div id="fb-root"></div>
      <div class="fb-page" data-href="https://www.facebook.com/SHIKIMARU2008"
           data-tabs="timeline" data-width="500"
           data-hide-cover="false" data-show-facepile="false"></div>`;
    ensureFbSdk();
  }
  timelineEl.style.display = 'none';
  loadMoreBtn.style.display = 'none';
  loaderEl.style.display = 'none';
  fallbackEl.hidden = false;
}

async function fetchPosts(after=null) {
  loaderEl.style.display = 'block';
  try {
    const url = after ? `/api/posts?after=${encodeURIComponent(after)}` : '/api/posts';
    const r = await fetch(url);
    const data = await r.json();
    if (!r.ok || data.error) {
      // permission/credential/etc. error -> fallback without alert
      showFallback();
      return { data: [], paging: {} };
    }
    return data;
  } catch (_e) {
    // network/server error -> fallback
    showFallback();
    return { data: [], paging: {} };
  } finally {
    loaderEl.style.display = 'none';
  }
}

function renderPosts(posts){
  for(const post of posts){
    const idKey = post.id || (post.created_time + '|' + (post.message || post.story || ''));
    if (loadedIds.has(idKey)) continue;
    loadedIds.add(idKey);

    const card = document.createElement('article');
    card.className = 'post';

    const date = document.createElement('div');
    date.className = 'date';
    date.textContent = new Date(post.created_time).toLocaleString('ja-JP');
    card.appendChild(date);

    if (post.message || post.story){
      const msg = document.createElement('div');
      msg.className = 'message';
      msg.textContent = post.message || post.story;
      card.appendChild(msg);
    }

    // video embedding (only when API succeeded)
    const isVideo = Array.isArray(post.attachments?.data) &&
                    post.attachments.data.some(a => (a.media_type||'').toLowerCase().includes('video'));
    if (isVideo && post.permalink_url){
      const wrap = document.createElement('div');
      wrap.className = 'fb-page-wrapper';
      wrap.innerHTML = `<div class="fb-video" data-href="${post.permalink_url}" data-allowfullscreen="true" data-width="500"></div>`;
      card.appendChild(wrap);
      ensureFbSdk();
    }

    timelineEl.appendChild(card);
  }
}

async function init(){
  const first = await fetchPosts();
  renderPosts(first.data || []);
  nextCursor = first?.paging?.cursors?.after || null;
  loadMoreBtn.style.display = nextCursor ? 'block' : 'none';
}

loadMoreBtn.addEventListener('click', async ()=>{
  if (!nextCursor) return;
  const page = await fetchPosts(nextCursor);
  renderPosts(page.data || []);
  nextCursor = page?.paging?.cursors?.after || null;
  loadMoreBtn.style.display = nextCursor ? 'block' : 'none';
});

init();
