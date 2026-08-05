/**
 * RSS Feed Generator Service
 * Generates Pinterest & RSS 2.0 compliant XML feed with Media RSS specification.
 */

const SITE_URL = process.env.SITE_URL || 'https://ghbooster.com';

const FEED_ITEMS = [
  {
    title: 'Master Social Media Panel Growth: Automated Order Execution & High Velocity',
    link: `${SITE_URL}/gallery#media-12`,
    guid: `${SITE_URL}/gallery#media-12`,
    description: 'Discover how automated order routing and high-velocity social media engagement accelerate account reach without algorithmic flags.',
    content: 'Comprehensive breakdown of high-speed SMM panel infrastructure, automated order execution, zero-password requirements, and non-drop refill guarantees for creators and digital agencies.',
    pubDate: 'Wed, 05 Aug 2026 21:00:00 GMT',
    author: 'GhBooster Media Team',
    category: 'SMM Strategy',
    image: `${SITE_URL}/src/img/gallery/ghbooster-media-12.png`
  },
  {
    title: 'Organic Social Proof Blueprint: Scaling Brand Trust Across Channels',
    link: `${SITE_URL}/gallery#media-13`,
    guid: `${SITE_URL}/gallery#media-13`,
    description: 'Learn the exact social proof framework used by top brands to triple customer confidence and boost conversion rates.',
    content: 'Step-by-step framework detailing how social proof counters, high follower velocity, and authentic post engagement transform brand perception and conversion rates.',
    pubDate: 'Wed, 05 Aug 2026 20:30:00 GMT',
    author: 'GhBooster Growth Team',
    category: 'Social Proof',
    image: `${SITE_URL}/src/img/gallery/ghbooster-media-13.png`
  },
  {
    title: 'Creator Channel Acceleration: Instant Delivery Speed & High-Retention Services',
    link: `${SITE_URL}/gallery#media-14`,
    guid: `${SITE_URL}/gallery#media-14`,
    description: 'Unlock maximum channel authority with instant delivery speed, high retention rates, and 24/7 automated order processing.',
    content: 'Explore creator growth strategies leveraging real-time engagement counters, instant order startup, and high-retention views for YouTube, TikTok, and Instagram.',
    pubDate: 'Wed, 05 Aug 2026 20:00:00 GMT',
    author: 'GhBooster Growth Team',
    category: 'Creator Growth',
    image: `${SITE_URL}/src/img/gallery/ghbooster-media-14.png`
  },
  {
    title: 'Viral Engagement Engine: Boosting TikTok & Instagram Reach Safely',
    link: `${SITE_URL}/gallery#media-15`,
    guid: `${SITE_URL}/gallery#media-15`,
    description: 'Understand how watch time velocity and targeted social signals trigger algorithmic recommendation engines for viral reach.',
    content: 'Detailed analysis of algorithmic recommendation triggers across TikTok FYP and Instagram Reels. How strategic view boosts jumpstart organic discovery.',
    pubDate: 'Wed, 05 Aug 2026 19:30:00 GMT',
    author: 'GhBooster Analytics',
    category: 'Viral Growth',
    image: `${SITE_URL}/src/img/gallery/ghbooster-media-15.png`
  },
  {
    title: 'Digital Agency Reseller Guide: Integrating High-Speed SMM APIs',
    link: `${SITE_URL}/gallery#media-16`,
    guid: `${SITE_URL}/gallery#media-16`,
    description: 'Automate your SMM panel reselling agency with v2 API integration, dynamic balance checking, and instant status updates.',
    content: 'Complete developer guide to integrating GhBooster v2 API endpoints into custom dashboards, WordPress panels, and reseller platforms.',
    pubDate: 'Wed, 05 Aug 2026 19:00:00 GMT',
    author: 'GhBooster Developer Team',
    category: 'Reseller API',
    image: `${SITE_URL}/src/img/gallery/ghbooster-media-16.png`
  },
  {
    title: 'Multi-Platform Audience Scaling: Instagram, YouTube & Telegram Metrics',
    link: `${SITE_URL}/gallery#media-17`,
    guid: `${SITE_URL}/gallery#media-17`,
    description: 'Build a cohesive cross-platform presence by synchronizing engagement velocity across Instagram, YouTube, TikTok, and Telegram.',
    content: 'Cross-platform growth tactics for digital marketers looking to build unified multi-channel authority and active community engagement.',
    pubDate: 'Wed, 05 Aug 2026 18:30:00 GMT',
    author: 'GhBooster Media Team',
    category: 'Audience Building',
    image: `${SITE_URL}/src/img/gallery/ghbooster-media-17.png`
  },
  {
    title: 'E-Commerce Conversion Booster: How Social Signals Drive Sales',
    link: `${SITE_URL}/gallery#media-18`,
    guid: `${SITE_URL}/gallery#media-18`,
    description: 'Case study insights on how social media presence and verified subscriber proof directly impact e-commerce checkout conversions.',
    content: 'An analysis of consumer purchasing behavior when interacting with social-proof-verified brands versus unverified competitors.',
    pubDate: 'Wed, 05 Aug 2026 18:00:00 GMT',
    author: 'GhBooster Growth Team',
    category: 'E-Commerce Growth',
    image: `${SITE_URL}/src/img/gallery/ghbooster-media-18.png`
  },
  {
    title: 'SMM Panel Security & Refill Guarantees: Non-Drop Delivery Protocol',
    link: `${SITE_URL}/gallery#media-19`,
    guid: `${SITE_URL}/gallery#media-19`,
    description: 'Learn how automated 30-day refill buttons and strict passwordless security safeguard your social media accounts.',
    content: 'Security protocols overview for SMM panel users. Zero account access required, passwordless processing, and 30-day automatic refill protection.',
    pubDate: 'Wed, 05 Aug 2026 17:30:00 GMT',
    author: 'GhBooster Security Team',
    category: 'Platform Security',
    image: `${SITE_URL}/src/img/gallery/ghbooster-media-19.png`
  },
  {
    title: 'How to Get More Instagram Followers in 2026: The Ultimate SMM Strategy',
    link: `${SITE_URL}/blog-instagram-followers`,
    guid: `${SITE_URL}/blog-instagram-followers`,
    description: 'Unlock the Instagram algorithm secrets. Discover how high-retention SMM panel services, non-drop refill guarantees, and Reels positioning build organic social proof safely.',
    content: 'Master the 2026 Instagram recommendation engine. Combining organic video hooks, high-retention engagement velocity, and targeted social proof allows creators and agencies to scale faster without risk of shadowbans.',
    pubDate: 'Thu, 30 Jul 2026 05:00:00 GMT',
    author: 'GhBooster Growth Team',
    category: 'Instagram Growth',
    image: `${SITE_URL}/src/img/gallery/ghbooster-media-1.png`
  },
  {
    title: 'TikTok Algorithm Secrets 2026: Skyrocket Views & For You Page Reach',
    link: `${SITE_URL}/blog-tiktok-views`,
    guid: `${SITE_URL}/blog-tiktok-views`,
    description: 'Learn how high-completion rates, watch time velocity, and targeted TikTok views trigger the FYP algorithm for exponential organic growth.',
    content: 'Discover how the TikTok recommendation algorithm evaluates video completion rates, re-watches, and share triggers. Optimize your video posting schedule and leverage instant view boosts for initial FYP push.',
    pubDate: 'Wed, 29 Jul 2026 08:00:00 GMT',
    author: 'GhBooster Growth Team',
    category: 'TikTok Strategy',
    image: `${SITE_URL}/src/img/gallery/ghbooster-media-2.png`
  },
  {
    title: 'YouTube Monetization & Watch Time Guide: 4,000 Hours Fast',
    link: `${SITE_URL}/blog-youtube-subscribers`,
    guid: `${SITE_URL}/blog-youtube-subscribers`,
    description: 'Step-by-step roadmap to hit YouTube Partner Program monetization requirements using high-retention watch hours and authentic subscriber growth.',
    content: 'Fast-track your channel monetization with safe, high-retention YouTube watch hours and real subscriber velocity. Complete guide to YouTube CTR optimization, end screen strategies, and algorithmic authority.',
    pubDate: 'Tue, 28 Jul 2026 10:00:00 GMT',
    author: 'GhBooster Growth Team',
    category: 'YouTube Monetization',
    image: `${SITE_URL}/src/img/gallery/ghbooster-media-3.png`
  },
  {
    title: 'Telegram Channel Growth Strategies: Building Active Communities',
    link: `${SITE_URL}/blog-telegram-members`,
    guid: `${SITE_URL}/blog-telegram-members`,
    description: 'Master Telegram channel promotion, targeted member additions, and post view engagement to build trusted crypto and digital communities.',
    content: 'Learn key strategies to scale Telegram channels and groups efficiently. How targeted member growth combined with instant post views increases social proof and drives high community retention.',
    pubDate: 'Mon, 27 Jul 2026 12:00:00 GMT',
    author: 'GhBooster Growth Team',
    category: 'Telegram Marketing',
    image: `${SITE_URL}/src/img/gallery/ghbooster-media-4.png`
  },
  {
    title: 'GhBooster SMM Panel Review 2026: Features, Speed & Reseller API',
    link: `${SITE_URL}/review-ghbooster-smm`,
    guid: `${SITE_URL}/review-ghbooster-smm`,
    description: 'In-depth review of GhBooster automated social media growth platform, high-speed API endpoints, instant refill system, and reseller capabilities.',
    content: 'A comprehensive evaluation of the GhBooster SMM platform. Features automated multi-provider routing, zero-drop guarantees, 24/7 API integration, and wholesale rates for digital marketing agencies.',
    pubDate: 'Sun, 26 Jul 2026 14:00:00 GMT',
    author: 'SMM Industry Insights',
    category: 'SMM Reviews',
    image: `${SITE_URL}/src/img/gallery/ghbooster-media-5.png`
  },
  {
    title: 'ABA E-Commerce Case Study: 300% Conversion Lift via Social Proof',
    link: `${SITE_URL}/review-aba-ecommerce-case-study`,
    guid: `${SITE_URL}/review-aba-ecommerce-case-study`,
    description: 'Case study analyzing how strategic social proof, Instagram verified engagement, and store brand velocity tripled conversion rates for ABA Store.',
    content: 'How e-commerce store ABA leveraged social proof and high-trust social signals to boost conversion rate from 1.2% to 3.8% in 30 days. Read full analytics breakdown and strategy rollout.',
    pubDate: 'Sat, 25 Jul 2026 16:00:00 GMT',
    author: 'GhBooster Analytics',
    category: 'Case Studies',
    image: `${SITE_URL}/src/img/gallery/ghbooster-media-6.png`
  },
  {
    title: 'Full Spectrum Social Growth Infographic & Analytics Showcase',
    link: `${SITE_URL}/gallery`,
    guid: `${SITE_URL}/gallery`,
    description: 'Explore visual growth charts, engagement dashboards, and verified delivery proofs across Instagram, TikTok, YouTube, and X.',
    content: 'Visual showcase of top-performing social media growth campaigns, automated metric counters, passwordless security protocols, and global distribution network stats.',
    pubDate: 'Fri, 24 Jul 2026 18:00:00 GMT',
    author: 'GhBooster Media',
    category: 'Growth Gallery',
    image: `${SITE_URL}/src/img/gallery/ghbooster-media-9.png`
  }
];

/**
 * Escapes XML special characters safely
 */
function escapeXml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generates valid RSS 2.0 XML string with Media RSS tags for Pinterest
 */
function generateRssXml() {
  const lastBuildDate = new Date().toUTCString();

  const itemsXml = FEED_ITEMS.map(item => {
    return `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(item.link)}</link>
      <guid isPermaLink="true">${escapeXml(item.guid)}</guid>
      <dc:creator>${escapeXml(item.author)}</dc:creator>
      <category>${escapeXml(item.category)}</category>
      <pubDate>${item.pubDate}</pubDate>
      <description><![CDATA[${escapeXml(item.description)}]]></description>
      <content:encoded><![CDATA[
        <p><img src="${escapeXml(item.image)}" alt="${escapeXml(item.title)}" style="max-width:100%;height:auto;" /></p>
        <p>${escapeXml(item.content)}</p>
        <p><a href="${escapeXml(item.link)}">Read the full strategy guide on GhBooster</a></p>
      ]]></content:encoded>
      <media:content url="${escapeXml(item.image)}" medium="image" type="image/png" />
      <media:title>${escapeXml(item.title)}</media:title>
      <media:description>${escapeXml(item.description)}</media:description>
      <enclosure url="${escapeXml(item.image)}" length="0" type="image/png" />
    </item>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" 
     xmlns:content="http://purl.org/rss/1.0/modules/content/"
     xmlns:wfw="http://wellformedweb.org/CommentAPI/"
     xmlns:dc="http://purl.org/dc/elements/1.1/"
     xmlns:atom="http://www.w3.org/2005/Atom"
     xmlns:sy="http://purl.org/rss/1.0/modules/syndication/"
     xmlns:slash="http://purl.org/rss/1.0/modules/slash/"
     xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>GhBooster - Social Media Growth &amp; SMM Panel Insights</title>
    <atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml" />
    <link>${SITE_URL}</link>
    <description>The official RSS feed for GhBooster. In-depth social media growth strategies, Instagram follower guides, TikTok FYP growth, YouTube monetization, and SMM panel updates formatted for Pinterest auto-publishing.</description>
    <language>en-US</language>
    <sy:updatePeriod>hourly</sy:updatePeriod>
    <sy:updateFrequency>1</sy:updateFrequency>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <image>
      <url>${SITE_URL}/src/img/logo.png</url>
      <title>GhBooster</title>
      <link>${SITE_URL}</link>
      <width>166</width>
      <height>48</height>
    </image>
${itemsXml}
  </channel>
</rss>`;
}

module.exports = {
  generateRssXml,
  FEED_ITEMS
};
