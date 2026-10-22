import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import cookieParser from 'cookie-parser';
import { CLIENT_DIST, HOST, IS_PROD, PORT } from './config.js';
import { db, initDb } from './db.js';
import { authenticate } from './auth.js';
import { initAudit } from './services/audit.js';
import { securityHeaders } from './lib/security.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import caseRoutes from './routes/cases.js';
import catalogRoutes from './routes/catalog.js';
import auditRoutes from './routes/audit.js';

await initDb();
initAudit();

const app = express();
app.disable('x-powered-by');
app.use(securityHeaders);
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(authenticate);

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/cases', caseRoutes);
app.use('/api/catalog', catalogRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

const hasClientBuild = fs.existsSync(path.join(CLIENT_DIST, 'index.html'));
if (hasClientBuild) {
  app.use(express.static(CLIENT_DIST, { index: false, maxAge: IS_PROD ? '1h' : 0 }));
  app.get('/{*splat}', (_req, res) => res.sendFile(path.join(CLIENT_DIST, 'index.html')));
}

app.use((err, _req, res, _next) => {
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'File is too large (2 GB max)' });
  const status = err.status ?? err.statusCode ?? 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.expose || status < 500 ? err.message : 'Something went wrong on the court admin server' });
});

const lanAddresses = () => Object.values(os.networkInterfaces()).flat()
  .filter((a) => a && a.family === 'IPv4' && !a.internal).map((a) => a.address);

http.createServer(app).listen(PORT, HOST, () => {
  console.log('\n  Court Admin is running\n');
  console.log(`  This machine:  http://localhost:${PORT}`);
  if (HOST === '0.0.0.0') for (const ip of lanAddresses()) console.log(`  Office network: http://${ip}:${PORT}`);
  if (!db.data.users.length) console.log('\n  No accounts yet. Create the first admin with: npm run admin:create-user');
  if (!hasClientBuild) console.log('\n  (No client build found. In development, open the Vite URL instead.)');
  console.log('');
});
