const fs = require('fs');
const path = require('path');

const root = __dirname;
const dist = path.join(root, 'dist');
const publicDir = path.join(root, 'public');

[dist, publicDir].forEach(targetDir => {
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // Copy all .html files
  fs.readdirSync(root).forEach(file => {
    if (file.endsWith('.html')) {
      fs.copyFileSync(path.join(root, file), path.join(targetDir, file));
    }
  });

  // Copy src folder recursively
  if (fs.existsSync(path.join(root, 'src'))) {
    fs.cpSync(path.join(root, 'src'), path.join(targetDir, 'src'), { recursive: true });
  }
});

console.log('Successfully generated static assets in root, dist/, and public/');
