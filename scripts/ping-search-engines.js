const https = require('https');

const sitemapUrl = encodeURIComponent('https://ghbooster.com/sitemap.xml');

const pingUrls = [
  `https://www.google.com/ping?sitemap=${sitemapUrl}`,
  `https://www.bing.com/ping?sitemap=${sitemapUrl}`
];

console.log('🚀 Pinging Google & Bing Search Engines for instant sitemap re-indexing...');

pingUrls.forEach(url => {
  https.get(url, (res) => {
    console.log(`Pinged: ${url} -> Status Code: ${res.statusCode}`);
  }).on('error', (err) => {
    console.error(`Error pinging ${url}:`, err.message);
  });
});
