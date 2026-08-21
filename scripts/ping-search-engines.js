const https = require('https');

// IndexNow Protocol (Supported by Bing, Yandex, Seznam, Naver & AI search crawlers)
const indexNowData = JSON.stringify({
  host: "ghbooster.com",
  key: "ghbooster2026indexnow",
  keyLocation: "https://ghbooster.com/ghbooster2026indexnow.txt",
  urlList: [
    "https://ghbooster.com/",
    "https://ghbooster.com/services",
    "https://ghbooster.com/smm-panel-ghana",
    "https://ghbooster.com/smm-panel-nigeria",
    "https://ghbooster.com/smm-panel-kenya",
    "https://ghbooster.com/smm-panel-south-africa",
    "https://ghbooster.com/smm-panel-instagram",
    "https://ghbooster.com/smm-panel-tiktok",
    "https://ghbooster.com/smm-panel-youtube",
    "https://ghbooster.com/smm-panel-telegram",
    "https://ghbooster.com/smm-panel-facebook",
    "https://ghbooster.com/smm-panel-twitter",
    "https://ghbooster.com/smm-panel-spotify",
    "https://ghbooster.com/smm-panel-linkedin",
    "https://ghbooster.com/buy-instagram-followers-ghana",
    "https://ghbooster.com/buy-tiktok-views-ghana",
    "https://ghbooster.com/buy-youtube-subscribers-ghana",
    "https://ghbooster.com/buy-telegram-members-ghana",
    "https://ghbooster.com/buy-facebook-followers-ghana",
    "https://ghbooster.com/buy-whatsapp-channel-followers",
    "https://ghbooster.com/blog",
    "https://ghbooster.com/blog-how-to-monetize-tiktok-ghana",
    "https://ghbooster.com/blog-how-to-get-4000-youtube-watch-hours",
    "https://ghbooster.com/blog-start-smm-reseller-business",
    "https://ghbooster.com/blog-instagram-followers",
    "https://ghbooster.com/blog-tiktok-views",
    "https://ghbooster.com/blog-youtube-subscribers",
    "https://ghbooster.com/blog-telegram-members",
    "https://ghbooster.com/blog-smm-panel-api-guide",
    "https://ghbooster.com/reviews",
    "https://ghbooster.com/review-ghbooster-smm",
    "https://ghbooster.com/review-aba-ecommerce-case-study",
    "https://ghbooster.com/gallery",
    "https://ghbooster.com/api-docs",
    "https://ghbooster.com/faq",
    "https://ghbooster.com/child-panel",
    "https://ghbooster.com/login",
    "https://ghbooster.com/register",
    "https://ghbooster.com/terms"
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
