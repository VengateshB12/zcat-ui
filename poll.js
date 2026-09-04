const https = require('https');
const want = '82065957';
const get = () => new Promise(res => {
  https.get('https://zcatdocs.onslate.in/docs/snippets.html?p=' + Date.now(),
    r => { let d=''; r.on('data',c=>d+=c); r.on('end',()=>res(d)); }).on('error',()=>res(''));
});
(async () => {
  for (let i = 1; i <= 20; i++) {
    const html = await get();
    const m = html.match(/zcat\.css\?v=([a-z0-9]+)/);
    const v = m ? m[1] : 'none';
    if (v === want) { console.log(`LIVE after ${i*15}s — stylesheet ?v=${v}`); return; }
    await new Promise(r => setTimeout(r, 15000));
  }
  console.log('still not live after 5 minutes');
})();
