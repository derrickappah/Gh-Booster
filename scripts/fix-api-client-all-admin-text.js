const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const apiClientPath = path.join(rootDir, 'src', 'js', 'api-client.js');
let apiContent = fs.readFileSync(apiClientPath, 'utf8');

// 1. Target provider table cells
apiContent = apiContent.replace(/class="py-4 px-4 font-bold text-gray-900"/g, 'class="py-4 px-4 font-bold text-gray-900 dark:text-white"');
apiContent = apiContent.replace(/class="py-4 px-4 font-mono text-gray-600 text-\[11px\]"/g, 'class="py-4 px-4 font-mono text-gray-600 dark:text-gray-300 text-[11px]"');
apiContent = apiContent.replace(/class="py-4 px-4 font-mono text-xs text-gray-500"/g, 'class="py-4 px-4 font-mono text-xs text-gray-500 dark:text-gray-300"');

// 2. Target service table cells
apiContent = apiContent.replace(/class="py-4 px-4 font-mono text-gray-500 text-xs font-bold"/g, 'class="py-4 px-4 font-mono text-gray-500 dark:text-gray-300 text-xs font-bold"');
apiContent = apiContent.replace(/class="py-4 px-4 font-bold text-gray-900 text-xs"/g, 'class="py-4 px-4 font-bold text-gray-900 dark:text-white text-xs"');
apiContent = apiContent.replace(/class="py-4 px-4 text-gray-600 text-xs"/g, 'class="py-4 px-4 text-gray-600 dark:text-gray-300 text-xs"');
apiContent = apiContent.replace(/class="py-4 px-4 text-xs"/g, 'class="py-4 px-4 text-xs text-gray-800 dark:text-gray-200"');

// 3. Target any other dynamic text-gray-900 / text-gray-800 / text-gray-700 / text-gray-600 / text-gray-500 in admin tables inside api-client.js
apiContent = apiContent.replace(/class="([^"]*text-gray-900(?![\w-]*\/)[^"]*)"/g, (match, classes) => {
  if (!classes.includes('dark:text-')) {
    return `class="${classes} dark:text-white"`;
  }
  return match;
});

apiContent = apiContent.replace(/class="([^"]*text-gray-800(?![\w-]*\/)[^"]*)"/g, (match, classes) => {
  if (!classes.includes('dark:text-')) {
    return `class="${classes} dark:text-gray-200"`;
  }
  return match;
});

apiContent = apiContent.replace(/class="([^"]*text-gray-700(?![\w-]*\/)[^"]*)"/g, (match, classes) => {
  if (!classes.includes('dark:text-')) {
    return `class="${classes} dark:text-gray-300"`;
  }
  return match;
});

apiContent = apiContent.replace(/class="([^"]*text-gray-600(?![\w-]*\/)[^"]*)"/g, (match, classes) => {
  if (!classes.includes('dark:text-')) {
    return `class="${classes} dark:text-gray-300"`;
  }
  return match;
});

apiContent = apiContent.replace(/class="([^"]*text-gray-500(?![\w-]*\/)[^"]*)"/g, (match, classes) => {
  if (!classes.includes('dark:text-')) {
    return `class="${classes} dark:text-gray-400"`;
  }
  return match;
});

fs.writeFileSync(apiClientPath, apiContent, 'utf8');
console.log('Fixed all dynamic admin text colors in src/js/api-client.js');
