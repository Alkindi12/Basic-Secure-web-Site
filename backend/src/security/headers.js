'use strict';
/**
 * Security headers, written by hand so every header is visible and explained (finding S-11).
 * Library alternative: helmet.
 */
module.exports = function securityHeaders({ isProd }) {
  return (req, res, next) => {
    res.removeHeader('X-Powered-By');
    res.set({
      // Never guess a content type: an "image" must not be run as HTML.
      'X-Content-Type-Options': 'nosniff',
      // The API must never be shown inside a frame (click-jacking).
      'X-Frame-Options': 'DENY',
      // Do not leak URLs to other sites.
      'Referrer-Policy': 'no-referrer',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Resource-Policy': 'same-site',
      // The API only returns JSON and images, so it can use the strictest policy.
      'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    });
    // Only over HTTPS: tell browsers to never use plain HTTP again.
    if (isProd) res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
  };
};
