
const express = require('express');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

app.get('/healthz', (_req,res)=>res.json({ok:true}));

app.get('/api/posts', async (req,res)=>{
  const PAGE_ID = process.env.FACEBOOK_PAGE_ID;
  const ACCESS_TOKEN = process.env.FACEBOOK_ACCESS_TOKEN;
  const after = req.query.after || null;
  const limit = Number(req.query.limit || 10);

  if (!PAGE_ID || !ACCESS_TOKEN) {
    return res.status(400).json({error:{code:400, message:'Missing credentials'}});
  }

  try{
    const params = new URLSearchParams({
      fields: 'id,message,story,created_time,permalink_url,attachments{media_type,media,url,unshimmed_url}',
      limit: String(limit),
      access_token: ACCESS_TOKEN,
    });
    if (after) params.set('after', after);
    const url = `https://graph.facebook.com/v18.0/${encodeURIComponent(PAGE_ID)}/posts?` + params.toString();
    const r = await fetch(url);
    const body = await r.json();
    // pass through status and body; client decides fallback
    return res.status(r.status).json(body);
  }catch(e){
    return res.status(500).json({error:{message:e.message || 'Server error'}});
  }
});

app.listen(PORT, ()=>console.log('listening on :' + PORT));
