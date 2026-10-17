// The app must never reach the public internet. The CSP below makes the
// browser refuse any script, style, font, image or connection that is not
// served by this local server. The one exception is frame-src: a YouTube
// exhibit is shown in YouTube's privacy-enhanced (no-cookie) player, which
// only loads on a device that can reach the internet.
export const CSP = "default-src 'self'; connect-src 'self' ws: ; img-src 'self' blob: data:; font-src 'self'; frame-src 'self' https://www.youtube-nocookie.com";

export function securityHeaders(_req, res, next) {
  res.setHeader('Content-Security-Policy', CSP);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  next();
}
