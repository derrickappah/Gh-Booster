const fs = require('fs');
const path = require('path');

const root = __dirname;
const dist = path.join(root, 'dist');
const publicDir = path.join(root, 'public');

// Keep static pages discoverable while excluding authenticated and admin surfaces.
const noindexPages = new Set([
  'account.html', 'add-funds.html', 'bulk-order.html', 'dashboard.html',
  'login.html', 'order-detail.html', 'orders.html', 'referrals.html',
  'register.html', 'tickets.html', 'transactions.html'
]);

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
    const source = path.join(root, file);
    const destination = path.join(dist, file);
    if (!file.endsWith('.html')) {
      fs.copyFileSync(source, destination);
      return;
    }

    let html = fs.readFileSync(source, 'utf8');
    const isPrivate = noindexPages.has(file) || file.startsWith('admin-');
    const robots = isPrivate
      ? 'noindex, nofollow'
      : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';
    if (!/<meta\s+name=["']robots["']/i.test(html)) {
      html = html.replace(/<meta name=["']viewport["'][^>]*>/i, match => `${match}\\n  <meta name="robots" content="${robots}">`);
    }
    if (!/<meta\s+name=["']theme-color["']/i.test(html)) {
      html = html.replace(/<meta name=["']viewport["'][^>]*>/i, match => `${match}\\n  <meta name="theme-color" content="#0b1220">`);
    }
    fs.writeFileSync(destination, html);
  }
});
if (fs.existsSync(path.join(root, 'src'))) {
  fs.cpSync(path.join(root, 'src'), path.join(dist, 'src'), { recursive: true });
}

console.log('Successfully generated static assets in root and dist/');
