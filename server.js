/*
 * webapp/server.js
 *
 * A small Express server that proxies requests to the Facebook Graph API and
 * serves a simple frontend for viewing posts from a Facebook page. This
 * server abstracts away the access token from the client, prevents CORS
 * issues and keeps your access token out of the browser. Posts are
 * returned in descending order by creation time (most recent first).
 */

const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from a .env file if present
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Read configuration from environment variables. Users should set
// FACEBOOK_PAGE_ID to the numeric ID of the page (or username) and
// FACEBOOK_ACCESS_TOKEN to a long-lived page access token with
// pages_read_engagement/pages_read_user_content permissions.
const PAGE_ID = process.env.FACEBOOK_PAGE_ID;
const ACCESS_TOKEN = process.env.FACEBOOK_ACCESS_TOKEN;

if (!PAGE_ID || !ACCESS_TOKEN) {
  console.warn(
    'FACEBOOK_PAGE_ID and FACEBOOK_ACCESS_TOKEN environment variables are not set.\n' +
    'API routes will return an error until these are configured.'
  );
}

// Serve static files from the webapp/public directory
app.use(express.static(path.join(__dirname, 'public')));

/**
 * Utility function to call the Graph API. Wraps node-fetch and handles
 * non‑200 responses gracefully.
 *
 * @param {string} url The full Graph API URL (including query string).
 * @returns {Promise<object>} Parsed JSON response.
 */
async function callGraphAPI(url) {
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok) {
    // Graph API returns errors in the body even when statusCode is 200.
    // If error is present, throw it so client sees meaningful message.
    const err = json.error || { message: 'Unknown error', type: 'Unknown' };
    const error = new Error(err.message);
    error.type = err.type;
    error.code = err.code;
    throw error;
  }
  return json;
}

/**
 * GET /api/posts
 *
 * Query parameters:
 *   - limit: number of posts to return (default: 10, max: 50)
 *   - since: ISO8601 timestamp to fetch posts created after this time
 *   - until: ISO8601 timestamp to fetch posts created before this time
 *   - after: pagination cursor returned by a previous request (optional)
 *
 * Returns the data array from the Graph API and the next pagination cursor if
 * available. Errors are returned with a 500 status code.
 */
app.get('/api/posts', async (req, res) => {
  if (!PAGE_ID || !ACCESS_TOKEN) {
    return res.status(500).json({ error: 'Server not configured with Facebook credentials.' });
  }
  // Parse query params
  const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);
  const since = req.query.since;
  const until = req.query.until;
  const after = req.query.after;

  // Build Graph API URL
  // Request id so the client can deduplicate posts across pages using a
  // stable identifier. Without id we would have to rely on created_time
  // which can lead to duplicates when multiple posts have the same
  // timestamp. See https://developers.facebook.com/docs/graph-api/reference/v23.0/page/feed/
  const params = new URLSearchParams({
    fields: 'id,message,story,created_time',
    limit: limit.toString(),
    access_token: ACCESS_TOKEN,
  });
  if (since) params.set('since', since);
  if (until) params.set('until', until);
  if (after) params.set('after', after);

  const url = `https://graph.facebook.com/v23.0/${encodeURIComponent(PAGE_ID)}/feed?${params.toString()}`;
  try {
    const data = await callGraphAPI(url);
    // Respond with posts and paging cursors
    res.json({
      posts: data.data || [],
      paging: data.paging || null,
    });
  } catch (error) {
    console.error('Graph API error:', error);
    res.status(500).json({ error: error.message || 'Unknown error' });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Facebook Timeline WebApp running at http://localhost:${PORT}`);
});