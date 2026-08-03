const { generateRssXml } = require('../services/rssService');

/**
 * Controller to handle RSS feed requests
 */
exports.getFeed = (req, res) => {
  try {
    const xml = generateRssXml();
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400');
    return res.status(200).send(xml);
  } catch (error) {
    console.error('Error generating RSS feed:', error);
    return res.status(500).type('application/xml').send('<?xml version="1.0" encoding="UTF-8"?><error>Failed to generate RSS feed</error>');
  }
};
