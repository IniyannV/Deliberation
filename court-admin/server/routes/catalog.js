import { Router } from 'express';
import { db, save } from '../db.js';
import { ROLES, requireRole } from '../auth.js';
import { auditAs } from '../services/audit.js';
import { bad, newId, optStr, str } from '../lib/shared.js';

/* The meal menu and supplies list, shared by every case and included in each package. */

const router = Router();
router.use(requireRole(ROLES.ANY));

function readList(list, withCategory) {
  if (!Array.isArray(list) || list.length > 60) throw bad('Invalid list');
  return list.map((item) => ({
    id: typeof item?.id === 'string' && item.id ? item.id.slice(0, 40) : newId(withCategory ? 'menu' : 'sup'),
    name: str(item?.name, { min: 1, max: 80, field: 'Name' }),
    ...(withCategory ? {
      category: optStr(item.category, { max: 40, field: 'Category' }) || 'Main',
      dietary: optStr(item.dietary, { max: 60, field: 'Dietary notes' }),
    } : {}),
    available: item?.available !== false,
  }));
}

router.get('/', (_req, res) => res.json({ menu: db.data.menu, supplies: db.data.supplies }));

router.put('/', async (req, res) => {
  const { menu, supplies } = req.body ?? {};
  if (menu) db.data.menu = readList(menu, true);
  if (supplies) db.data.supplies = readList(supplies, false);
  await save();
  auditAs(req.user, 'catalog.updated', null, { itemCount: db.data.menu.length + db.data.supplies.length });
  res.json({ menu: db.data.menu, supplies: db.data.supplies });
});

export default router;
