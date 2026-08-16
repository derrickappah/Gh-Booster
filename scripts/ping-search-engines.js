const https = require('https');

// IndexNow Protocol (Supported by Bing, Yandex, Seznam, Naver & AI search crawlers)
const indexNowData = JSON.stringify({
  host: "ghbooster.com",
  key: "ghbooster2026indexnow",
  keyLocation: "https://ghbooster.com/ghbooster2026indexnow.txt",
  urlList: [
    "https://ghbooster.com/",
    "https://ghbooster.com/services.html",
    "https://ghbooster.com/smm-panel-ghana.html",
    "https://ghbooster.com/smm-panel-nigeria.html",
    "https://ghbooster.com/smm-panel-kenya.html",
    "https://ghbooster.com/smm-panel-south-africa.html",
    "https://ghbooster.com/smm-panel-instagram.html",
    "https://ghbooster.com/smm-panel-tiktok.html",
    "https://ghbooster.com/smm-panel-youtube.html",
    "https://ghbooster.com/smm-panel-telegram.html",
    "https://ghbooster.com/smm-panel-facebook.html",
    "https://ghbooster.com/smm-panel-twitter.html",
    "https://ghbooster.com/smm-panel-spotify.html",
    "https://ghbooster.com/smm-panel-linkedin.html",
    "https://ghbooster.com/buy-instagram-followers-ghana.html",
    "https://ghbooster.com/buy-tiktok-views-ghana.html",
    "https://ghbooster.com/buy-youtube-subscribers-ghana.html",
    "https://ghbooster.com/buy-telegram-members-ghana.html",
    "https://ghbooster.com/buy-facebook-followers-ghana.html",
    "https://ghbooster.com/buy-whatsapp-channel-followers.html",
    "https://ghbooster.com/blog.html",
    "https://ghbooster.com/blog-how-to-monetize-tiktok-ghana.html",
    "https://ghbooster.com/blog-how-to-get-4000-youtube-watch-hours.html",
    "https://ghbooster.com/blog-start-smm-reseller-business.html",
    "https://ghbooster.com/blog-instagram-followers.html",
    "https://ghbooster.com/blog-tiktok-views.html",
    "https://ghbooster.com/blog-youtube-subscribers.html",
    "https://ghbooster.com/blog-telegram-members.html",
    "https://ghbooster.com/blog-smm-panel-api-guide.html",
    "https://ghbooster.com/reviews.html",
    "https://ghbooster.com/gallery.html"
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
