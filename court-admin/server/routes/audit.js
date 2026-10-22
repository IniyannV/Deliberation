import { Router } from 'express';
import { ROLES, requireRole } from '../auth.js';
import { auditAs, readAudit, toCsv, verifyChain } from '../services/audit.js';
import { withSummary } from '../lib/auditText.js';
import { nowIso } from '../lib/shared.js';

const router = Router();
router.use(requireRole(ROLES.ANY));

router.get('/', (req, res) => {
  const all = readAudit();
  const action = req.query.action ? String(req.query.action) : '';
  const filtered = action ? all.filter((e) => e.action.startsWith(action)) : all;
  const limit = Math.min(Number(req.query.limit) || 300, 2000);
  res.json({ entries: filtered.slice(-limit).reverse().map(withSummary), total: filtered.length, chain: verifyChain(all) });
});

router.get('/csv', (req, res) => {
  auditAs(req.user, 'audit.exported');
  const stamp = nowIso().replace(/[:.]/g, '-');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="court-admin-audit-${stamp}.csv"`);
  res.send(toCsv(readAudit().map(withSummary)));
});

export default router;
