const fs = require('fs');
const path = require('path');
const { generateRssXml } = require('../server/services/rssService');

try {
  console.log('Generating static rss.xml for Pinterest & RSS subscribers...');
  const xmlContent = generateRssXml();
  const outputPath = path.join(__dirname, '..', 'rss.xml');
  fs.writeFileSync(outputPath, xmlContent, 'utf8');
  console.log(`Successfully generated rss.xml at ${outputPath}`);
} catch (error) {
  console.error('Error generating rss.xml:', error);
  process.exit(1);
}
