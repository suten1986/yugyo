/* 正しいページング実装
 * - 最初の呼び出しで最新投稿を取得（Graph APIのデフォルトは新しい→古い）
 * - レスポンスの paging.next URL をそのまま保持し、次回はそれを叩く（＝より古い投稿）
 * - ID重複を避けるために Set を使用
 * - スクロール終端で自動ロード（IntersectionObserver）
 */
const feedEl = document.getElementById('feed');
const loadBtn = document.getElementById('loadBtn');
const pageIdEl = document.getElementById('pageId');
const tokenEl = document.getElementById('token');
const sentinel = document.getElementById('sentinel');

let nextPageUrl = null;       // 次ページ（より古い投稿）の完全URL
let seenIds = new Set();      // 重複防止
let isLoading = false;

const FIELDS = [
  'id',
  'message',
  'created_time',
  'permalink_url',
  'attachments{media_type,media,url,unshimmed_url,subattachments}'
].join(',');

function buildInitialUrl(pageId, token, limit=10){
  const base = new URL(`https://graph.facebook.com/v19.0/${encodeURIComponent(pageId)}/posts`);
  base.searchParams.set('fields', FIELDS);
  base.searchParams.set('access_token', token);
  base.searchParams.set('limit', String(limit));
  // デフォルトは新→古。ここでは特に since/until は使わず、paging.next を信頼する。
  return base.toString();
}

async function fetchUrl(url){
  const res = await fetch(url);
  if(!res.ok){
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

function fmtDate(iso){
  try {
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const day = String(d.getDate()).padStart(2,'0');
    const hh = String(d.getHours()).padStart(2,'0');
    const mm = String(d.getMinutes()).padStart(2,'0');
    return `${y}-${m}-${day} ${hh}:${mm}`;
  } catch {
    return iso;
  }
}

function renderAttachment(container, att){
  if(!att) return;
  // シンプル対応：写真とリンクのみ
  if(att.media_type === 'photo' && att.media && att.media.image && att.media.image.src){
    const img = document.createElement('img');
    img.loading = 'lazy';
    img.src = att.media.image.src;
    img.alt = '';
    container.appendChild(img);
  } else if(att.media_type === 'album' && att.subattachments){
    att.subattachments.data.forEach(sub => renderAttachment(container, sub));
  } else if(att.url){
    const a = document.createElement('a');
    a.href = att.url;
    a.target = '_blank';
    a.textContent = 'リンクを開く';
    container.appendChild(a);
  }
}

function renderPost(post){
  if(seenIds.has(post.id)) return;
  seenIds.add(post.id);

  const tpl = document.getElementById('post-tpl');
  const node = tpl.content.firstElementChild.cloneNode(true);
  node.dataset.id = post.id;
  node.querySelector('.created').textContent = fmtDate(post.created_time);
  node.querySelector('.permalink').href = post.permalink_url || '#';
  node.querySelector('.message').textContent = post.message || '';

  const mediaEl = node.querySelector('.media');
  const atts = post.attachments && post.attachments.data ? post.attachments.data : [];
  atts.forEach(att => renderAttachment(mediaEl, att));

  feedEl.appendChild(node);
}

async function loadInitial(){
  const pageId = pageIdEl.value.trim();
  const token = tokenEl.value.trim();
  if(!pageId || !token){
    alert('PAGE_ID と ACCESS_TOKEN を入力してください。');
    return;
  }
  feedEl.innerHTML = '';
  seenIds.clear();
  nextPageUrl = null;

  const url = buildInitialUrl(pageId, token);
  await loadFrom(url);
}

async function loadMore(){
  if(!nextPageUrl) return;
  await loadFrom(nextPageUrl);
}

async function loadFrom(url){
  if(isLoading) return;
  isLoading = true;
  sentinel.textContent = '読み込み中...';
  try {
    const json = await fetchUrl(url);
    const data = Array.isArray(json.data) ? json.data : [];
    data.forEach(renderPost);

    // 重要：より古い投稿のページURLを保持
    nextPageUrl = json.paging && json.paging.next ? json.paging.next : null;
    if(!nextPageUrl){
      sentinel.textContent = 'これ以上はありません';
      observer.disconnect();
    } else {
      sentinel.textContent = '下までスクロールで次を読み込み';
    }
  } catch (e) {
    console.error(e);
    sentinel.textContent = '読み込みエラー。コンソールを確認してください。';
  } finally {
    isLoading = false;
  }
}

loadBtn.addEventListener('click', loadInitial);

// スクロール終端で自動ロード
const observer = new IntersectionObserver((entries)=>{
  for(const entry of entries){
    if(entry.isIntersecting){
      loadMore();
    }
  }
});
observer.observe(sentinel);
