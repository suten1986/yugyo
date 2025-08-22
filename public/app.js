/*
 * Client-side JavaScript to fetch posts from the server and render them on
 * the page. Supports pagination via the "after" cursor returned by the
 * Graph API. Posts are displayed in descending order (latest first).
 */

const timelineEl = document.getElementById('timeline');
const loadMoreBtn = document.getElementById('loadMore');
const loaderEl = document.getElementById('loader');

// Store pagination cursor for the next page of results
let nextCursor = null;
// Track IDs of posts that have already been rendered. This prevents
// duplicates when paginating. The Graph API returns an "id" for each
// post which we include via the server. See server.js for details.
const loadedIds = new Set();

/**
 * Format a date string into a human readable form in the user's locale.
 *
 * @param {string} isoDate ISO8601 date string
 * @returns {string}
 */
function formatDate(isoDate) {
  const date = new Date(isoDate);
  return date.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
}

/**
 * Render an array of posts into the DOM
 *
 * @param {Array<object>} posts
 */
function renderPosts(posts) {
  posts.forEach(post => {
    // Use the post.id if available (server includes it) to avoid
    // rendering duplicates. If id is missing, fall back to a
    // composite key of created_time + message. This ensures that
    // pagination using the "after" cursor does not re‑add the same
    // posts when Facebook returns overlapping data.
    const uniqueKey = post.id || `${post.created_time}-${post.message || post.story}`;
    if (loadedIds.has(uniqueKey)) {
      return;
    }
    loadedIds.add(uniqueKey);
    const el = document.createElement('div');
    el.className = 'post';
    const date = document.createElement('div');
    date.className = 'date';
    date.textContent = formatDate(post.created_time);
    const message = document.createElement('div');
    message.className = 'message';
    // Prefer message field; fall back to story if message is empty
    message.textContent = post.message || post.story || '[投稿テキストなし]';
    el.appendChild(date);
    el.appendChild(message);
    timelineEl.appendChild(el);
  });
}

/**
 * Fetch posts from the server API. If `cursor` is provided, it will be
 * sent as the `after` query param to fetch the next page.
 *
 * @param {string|null} cursor
 */
async function fetchPosts(cursor = null) {
  loaderEl.classList.remove('hidden');
  loadMoreBtn.classList.add('hidden');
  try {
    const params = new URLSearchParams({ limit: 10 });
    if (cursor) params.set('after', cursor);
    const res = await fetch(`/api/posts?${params.toString()}`);
    const data = await res.json();
    if (res.ok) {
      renderPosts(data.posts);
      // Update next cursor if present
      nextCursor = data.paging && data.paging.cursors && data.paging.cursors.after;
      if (nextCursor) {
        loadMoreBtn.classList.remove('hidden');
      }
    } else {
      alert(data.error || 'エラーが発生しました');
    }
  } catch (err) {
    console.error(err);
    alert('投稿の取得中にエラーが発生しました');
  } finally {
    loaderEl.classList.add('hidden');
  }
}

// Initial load
fetchPosts();

// Load more button handler
loadMoreBtn.addEventListener('click', () => {
  if (nextCursor) {
    fetchPosts(nextCursor);
  }
});