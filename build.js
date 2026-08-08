const fs = require('fs');
const path = require('path');

const root = __dirname;
const dist = path.join(root, 'dist');
const publicDir = path.join(root, 'public');

const { execSync } = require('child_process');

// Run esbuild minification
try {
  execSync('npx -y esbuild src/js/theme.js --minify --outfile=src/js/theme.min.js', { stdio: 'inherit' });
  execSync('npx -y esbuild src/js/api-client.js --minify --outfile=src/js/api-client.min.js', { stdio: 'inherit' });
  execSync('npx -y esbuild src/js/analytics.js --minify --outfile=src/js/analytics.min.js', { stdio: 'inherit' });
  execSync('npx -y esbuild src/css/style.css --minify --outfile=src/css/style.min.css', { stdio: 'inherit' });
} catch (e) {
  console.warn('Minification step warning:', e.message);
}

// Generate static RSS feed for Pinterest
try {
  console.log('Generating RSS Feed XML...');
  require('./scripts/generate-rss');
} catch (e) {
  console.warn('RSS Feed generation warning:', e.message);
}

[dist, publicDir].forEach(targetDir => {
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // Copy all .html files, robots.txt, sitemap.xml, rss.xml, llms.txt, manifest.json, and service-worker.js
  fs.readdirSync(root).forEach(file => {
    if (file.endsWith('.html') || file === 'robots.txt' || file === 'sitemap.xml' || file === 'rss.xml' || file === 'llms.txt' || file === 'manifest.json' || file === 'service-worker.js') {
      fs.copyFileSync(path.join(root, file), path.join(targetDir, file));
    }
  });

  // Copy src folder recursively
  if (fs.existsSync(path.join(root, 'src'))) {
    fs.cpSync(path.join(root, 'src'), path.join(targetDir, 'src'), { recursive: true });
  }
});

console.log('Successfully generated static assets in root, dist/, and public/');
