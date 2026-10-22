import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import cookieParser from 'cookie-parser';
import { Server } from 'socket.io';
import { CLIENT_DIST, HOST, IS_PROD, PORT } from './config.js';
import { initDb } from './db.js';
import { authenticate } from './auth.js';
import { initAudit } from './services/audit.js';
import { loadVotes } from './services/voting.js';
import { securityHeaders } from './middleware/security.js';
import { setIo } from './realtime.js';
import { registerSockets } from './sockets/index.js';
import authRoutes from './routes/auth.js';
import exhibitRoutes from './routes/exhibits.js';
import jurorRoutes from './routes/juror.js';
import adminRoutes from './routes/admin.js';

await initDb();
initAudit();
await loadVotes();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { serveClient: false, maxHttpBufferSize: 256 * 1024 });
setIo(io);
registerSockets(io);

app.disable('x-powered-by');
app.use(securityHeaders);
app.use(express.json({ limit: '256kb' }));
app.use(cookieParser());
app.use(authenticate);

app.use('/api/auth', authRoutes);
app.use('/api/exhibits', exhibitRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', jurorRoutes);
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

// Production: serve the built client and fall back to index.html for client-side routes.
const hasClientBuild = fs.existsSync(path.join(CLIENT_DIST, 'index.html'));
if (hasClientBuild) {
  app.use(express.static(CLIENT_DIST, { index: false, maxAge: IS_PROD ? '1h' : 0 }));
  app.get('/{*splat}', (_req, res) => res.sendFile(path.join(CLIENT_DIST, 'index.html')));
}

app.use((err, _req, res, _next) => {
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'File is too large (50 MB max)' });
  const status = err.status ?? err.statusCode ?? 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.expose || status < 500 ? err.message : 'Something went wrong on the court server' });
});

function lanAddresses() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((a) => a && a.family === 'IPv4' && !a.internal)
    .map((a) => a.address);
}

server.listen(PORT, HOST, () => {
  const urls = lanAddresses().map((ip) => `http://${ip}:${PORT}`);
  console.log('\n  Deliberation server is running (offline / LAN only)\n');
  console.log(`  This machine:  http://localhost:${PORT}`);
  if (urls.length) {
    console.log('  Juror devices on the LAN can connect at:');
    for (const u of urls) console.log(`    → ${u}`);
  } else {
    console.log('  No LAN network interface found. Connect this laptop to the jury-room network.');
  }
  if (!hasClientBuild) console.log('\n  (No client build found. In development, open the Vite URL instead.)');
  console.log('');
});
