const https = require('https');

// IndexNow Protocol (Supported by Bing, Yandex, Seznam, Naver)
const indexNowData = JSON.stringify({
  host: "ghbooster.com",
  key: "ghbooster2026indexnow",
  keyLocation: "https://ghbooster.com/ghbooster2026indexnow.txt",
  urlList: [
    "https://ghbooster.com/",
    "https://ghbooster.com/smm-panel-ghana.html",
    "https://ghbooster.com/smm-panel-instagram.html",
    "https://ghbooster.com/smm-panel-tiktok.html",
    "https://ghbooster.com/smm-panel-youtube.html",
    "https://ghbooster.com/smm-panel-telegram.html",
    "https://ghbooster.com/smm-panel-facebook.html",
    "https://ghbooster.com/smm-panel-twitter.html",
    "https://ghbooster.com/smm-panel-spotify.html",
    "https://ghbooster.com/buy-instagram-followers-ghana.html",
    "https://ghbooster.com/buy-tiktok-views-ghana.html"
  ]
});

const options = {
  hostname: 'api.indexnow.org',
  port: 443,
  path: '/IndexNow',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(indexNowData)
  }
};

console.log('🚀 Submitting updated URLs via IndexNow API protocol...');

const req = https.request(options, (res) => {
  console.log(`IndexNow Submission Status: ${res.statusCode}`);
  res.on('data', (d) => {
    process.stdout.write(d);
  });
});

req.on('error', (e) => {
  console.error(`IndexNow Request Error: ${e.message}`);
});

req.write(indexNowData);
req.end();
