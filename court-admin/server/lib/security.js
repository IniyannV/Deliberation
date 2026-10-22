// Like the jury app, the admin app loads nothing from the internet.
export const CSP = "default-src 'self'; connect-src 'self'; img-src 'self' blob: data:; media-src 'self'; font-src 'self'; frame-src 'none'; object-src 'none'; frame-ancestors 'self'";

export function securityHeaders(_req, res, next) {
  res.setHeader('Content-Security-Policy', CSP);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  next();
}

// For exhibit files opened directly in a tab. The browser's PDF viewer counts
// as an embedded object, so the page policy's object-src 'none' would leave
// a PDF blank. This one allows that viewer and nothing else. (Previews in
// the app draw PDFs with pdf.js instead.)
export const FILE_CSP = "default-src 'none'; object-src 'self'; img-src 'self'; media-src 'self'; frame-ancestors 'self'";
