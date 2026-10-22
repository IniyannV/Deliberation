import { ALLOW_ONLINE_EXHIBITS } from '../config.js';

// The app must never reach the public internet. The CSP below makes the
// browser refuse any script, style, font, image or connection that is not
// served by this local server. The one possible exception is frame-src: when
// the court turns on online exhibits (ALLOW_ONLINE_EXHIBITS=1), a YouTube
// exhibit is shown in YouTube's privacy-enhanced (no-cookie) player, which
// only loads on a device that can reach the internet.
const FRAME_SRC = ALLOW_ONLINE_EXHIBITS ? "frame-src 'self' https://www.youtube-nocookie.com" : "frame-src 'self'";
export const CSP = `default-src 'self'; connect-src 'self' ws: ; img-src 'self' blob: data:; font-src 'self'; ${FRAME_SRC}`;

export function securityHeaders(_req, res, next) {
  res.setHeader('Content-Security-Policy', CSP);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  next();
}
