/**
 * Image URLs come from the API as relative paths such as /api/images/<uuid>.webp.
 * They are used as-is (same origin, served through the Vite proxy in development),
 * so no host name is hard-coded anywhere (U-03).
 */
const API_ORIGIN = (import.meta.env.VITE_API_URL || '').replace(/\/api\/?$/, '');

export const PLACEHOLDER_IMAGE =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="250"><rect width="400" height="250" fill="#e2e8f0"/><path d="M0 250 L120 140 L200 200 L280 120 L400 250Z" fill="#cbd5e1"/></svg>');

export const getImageUrl = (imageUrl) => {
  if (!imageUrl) return PLACEHOLDER_IMAGE;
  if (/^(https?:|data:|blob:)/.test(imageUrl)) return imageUrl;
  return `${API_ORIGIN}${imageUrl}`;
};
