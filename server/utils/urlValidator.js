const dns = require('dns').promises;
const net = require('net');

/**
 * Validates whether a given URL is safe from SSRF attacks.
 * Rejects non-HTTP/HTTPS protocols, loopbacks, link-local, private IP ranges,
 * cloud metadata endpoints (e.g. 169.254.169.254), and local hostnames.
 *
 * @param {string} urlString
 * @returns {Promise<{safe: boolean, reason?: string}>}
 */
async function validateSafeUrl(urlString) {
  if (!urlString || typeof urlString !== 'string') {
    return { safe: false, reason: 'URL must be a non-empty string' };
  }

  let parsed;
  try {
    parsed = new URL(urlString);
  } catch (err) {
    return { safe: false, reason: 'Invalid URL format' };
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { safe: false, reason: 'Only HTTP and HTTPS protocols are allowed' };
  }

  const hostname = (parsed.hostname || '').toLowerCase().trim();
  if (!hostname) {
    return { safe: false, reason: 'Missing hostname in URL' };
  }

  // Reject obvious localhost and internal domains
  const blockedHostnames = ['localhost', '127.0.0.1', '::1', '0.0.0.0', 'metadata.google.internal'];
  if (blockedHostnames.includes(hostname) || hostname.endsWith('.internal') || hostname.endsWith('.local')) {
    return { safe: false, reason: 'Internal and localhost endpoints are not permitted' };
  }

  // If hostname is directly an IP literal
  if (net.isIP(hostname)) {
    if (isPrivateOrRestrictedIP(hostname)) {
      return { safe: false, reason: 'Private or restricted IP address is not permitted' };
    }
  }

  // Resolve hostname via DNS to prevent DNS rebinding / internal routing
  try {
    const addrs4 = await dns.resolve4(hostname).catch(() => []);
    const addrs6 = await dns.resolve6(hostname).catch(() => []);
    const allAddrs = [...addrs4, ...addrs6];

    if (allAddrs.length === 0 && !net.isIP(hostname)) {
      return { safe: false, reason: 'Could not resolve hostname via DNS' };
    }

    for (const addr of allAddrs) {
      if (isPrivateOrRestrictedIP(addr)) {
        return { safe: false, reason: `Resolved IP (${addr}) is within a private or restricted network range` };
      }
    }
  } catch (dnsErr) {
    return { safe: false, reason: `DNS resolution failed: ${dnsErr.message}` };
  }

  return { safe: true };
}

/**
 * Helper to check if an IP address belongs to RFC 1918, RFC 3927 (link-local/metadata), loopback, or broadcast ranges.
 * @param {string} ip
 * @returns {boolean}
 */
function isPrivateOrRestrictedIP(ip) {
  const version = net.isIP(ip);
  if (version === 4) {
    const parts = ip.split('.').map(Number);
    if (
      parts[0] === 0 ||                              // Current network (RFC 1122)
      parts[0] === 10 ||                             // 10.0.0.0/8 (RFC 1918)
      parts[0] === 127 ||                            // 127.0.0.0/8 (Loopback)
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || // 172.16.0.0/12 (RFC 1918)
      (parts[0] === 192 && parts[1] === 168) ||      // 192.168.0.0/16 (RFC 1918)
      (parts[0] === 169 && parts[1] === 254) ||      // 169.254.0.0/16 (Link-Local / Cloud Metadata)
      parts[0] === 224 ||                            // 224.0.0.0/4 (Multicast)
      parts[0] === 255                               // 255.255.255.255 (Broadcast)
    ) {
      return true;
    }
  } else if (version === 6) {
    const lower = ip.toLowerCase();
    if (
      lower === '::' ||
      lower === '::1' ||
      lower.startsWith('fe80:') ||                   // Link-local
      lower.startsWith('fc00:') ||                   // Unique Local Address (ULA)
      lower.startsWith('fd00:') ||                   // Unique Local Address (ULA)
      lower.startsWith('::ffff:127.') ||             // IPv4-mapped loopback
      lower.startsWith('::ffff:10.') ||              // IPv4-mapped private
      lower.startsWith('::ffff:192.168.') ||         // IPv4-mapped private
      lower.startsWith('::ffff:169.254.')            // IPv4-mapped metadata
    ) {
      return true;
    }
  }
  return false;
}

module.exports = {
  validateSafeUrl,
  isPrivateOrRestrictedIP
};
