import { useEffect, useState } from 'react'
import { api, isDemoAdminDomain } from '../lib/api'
import { toast } from '../store/ui'
import { Button, Card, IconButton, Input, PageHeader } from '../components/ui'

function ItemRows({ items, setItems, withCategory }) {
  const update = (i, patch) => setItems(items.map((it, j) => (j === i ? { ...it, ...patch } : it)))
  return (
    <div className="flex flex-col gap-2">
      {items.map((it, i) => (
        <div key={it.id ?? `new-${i}`} className="flex items-center gap-2">
          <Input value={it.name} onChange={(e) => update(i, { name: e.target.value })} placeholder="Name" aria-label="Name" className="flex-[2]" />
          {withCategory && <Input value={it.category ?? ''} onChange={(e) => update(i, { category: e.target.value })} placeholder="Category" aria-label="Category" className="flex-1" />}
          {withCategory && <Input value={it.dietary ?? ''} onChange={(e) => update(i, { dietary: e.target.value })} placeholder="Dietary notes" aria-label="Dietary notes" className="flex-1" />}
          <label className="flex items-center gap-1.5 text-sm whitespace-nowrap">
            <input type="checkbox" checked={it.available !== false} onChange={(e) => update(i, { available: e.target.checked })} role="switch" className="switch" />
            Available
          </label>
          <IconButton icon="trash" label={`Remove ${it.name || 'item'}`} onClick={() => setItems(items.filter((_, j) => j !== i))} />
        </div>
      ))}
      <Button size="sm" variant="ghost" icon="plus" className="self-start" onClick={() => setItems([...items, { name: '', category: withCategory ? 'Main' : undefined, available: true }])}>Add item</Button>
    </div>
  )
}

export default function Catalog() {
  const [menu, setMenu] = useState([])
  const [supplies, setSupplies] = useState([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api('/catalog').then((c) => { setMenu(c.menu); setSupplies(c.supplies) })
  }, [])

  async function save() {
    setBusy(true)
    try {
      const c = await api('/catalog', { method: 'PUT', body: { menu: menu.filter((m) => m.name.trim()), supplies: supplies.filter((s) => s.name.trim()) } })
      setMenu(c.menu)
      setSupplies(c.supplies)
      toast('Menu and supplies saved. They go to the jury iPads with every case sent from now on.')
    } catch (err) {
      toast(err.message, { tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const isDemoDomain = isDemoAdminDomain()

  return (
    <div>
      <PageHeader
        title="Menu & supplies"
        subtitle="What jurors can choose from when they ask for a meal or supplies. One list for every case; each package carries a copy, and the bailiff can still adjust it on the jury laptop."
        actions={
          <Button
            variant="primary"
            onClick={save}
            disabled={busy}
          >
            Save changes
          </Button>
        }
      />
      <Card className="mb-6 p-6">
        <h2 className="mb-4 text-xl font-bold">Meal menu</h2>
        <ItemRows items={menu} setItems={setMenu} withCategory />
      </Card>
      <Card className="p-6">
        <h2 className="mb-4 text-xl font-bold">Supplies</h2>
        <ItemRows items={supplies} setItems={setSupplies} />
      </Card>
    </div>
  )
}
