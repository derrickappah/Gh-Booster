const fs = require('fs');
const path = require('path');

const root = __dirname;
const dist = path.join(root, 'dist');
const publicDir = path.join(root, 'public');

const { execSync } = require('child_process');

// Compile Tailwind CSS & Run esbuild minification
try {
  console.log('Compiling Tailwind CSS...');
  execSync('npx -y tailwindcss -i ./src/tailwind/tailwindcss.css -o ./src/css/style.css', { stdio: 'inherit' });
  execSync('npx -y esbuild src/js/theme.js --minify --outfile=src/js/theme.min.js', { stdio: 'inherit' });
  execSync('npx -y esbuild src/js/api-client.js --minify --outfile=src/js/api-client.min.js', { stdio: 'inherit' });
  execSync('npx -y esbuild src/js/analytics.js --minify --outfile=src/js/analytics.min.js', { stdio: 'inherit' });
  execSync('npx -y esbuild src/css/style.css --minify --outfile=src/css/style.min.css', { stdio: 'inherit' });
} catch (e) {
  console.warn('CSS & Minification step warning:', e.message);
}

// Generate static RSS feed for Pinterest
try {
  console.log('Generating RSS Feed XML...');
  require('./scripts/generate-rss');
} catch (e) {
  console.warn('RSS Feed generation warning:', e.message);
}

// Copy all assets to dist (Vercel output directory)
if (!fs.existsSync(dist)) {
  fs.mkdirSync(dist, { recursive: true });
}

fs.readdirSync(root).forEach(file => {
  if (file.endsWith('.html') || file === 'robots.txt' || file === 'sitemap.xml' || file === 'rss.xml' || file === 'llms.txt' || file === 'llms-full.txt' || file === 'manifest.json' || file === 'service-worker.js' || file === 'favicon.ico' || file.endsWith('.txt')) {
    fs.copyFileSync(path.join(root, file), path.join(dist, file));
  }
});
if (fs.existsSync(path.join(root, 'src'))) {
  fs.cpSync(path.join(root, 'src'), path.join(dist, 'src'), { recursive: true });
}

console.log('Successfully generated static assets in root and dist/');
