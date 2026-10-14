// The app must never reach the public internet. The CSP below makes the
// browser refuse any script, style, font, image or connection that is not
// served by this local server.
export const CSP = "default-src 'self'; connect-src 'self' ws: ; img-src 'self' blob: data:; font-src 'self'";

export function securityHeaders(_req, res, next) {
  res.setHeader('Content-Security-Policy', CSP);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  next();
}
