import { useCallback, useEffect, useMemo, useState, type KeyboardEvent as ReactKeyEvent } from 'react'
import { api } from '../lib/api'
import { Drawer, ErrorBox, useConfirm, useToast } from '../components/ui'
import { Icon } from '../components/Icons'
import { parseNum, toInputNum } from '../lib/num'
import { setSaved, setSaving } from '../lib/status'
import type {
  HitungKomponen,
  HitungResult,
  Project,
  Rab,
  RabDetail,
  RabRekap,
  RefDivisi,
  RefItem,
  RabVolume,
  VolumeInput
} from '../../../shared/types'

const fmtRp = (n: number | null | undefined): string =>
  n == null
    ? '—'
    : new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)

const fmtNum = (n: number | null | undefined, dp = 4): string =>
  n == null ? '—' : new Intl.NumberFormat('id-ID', { maximumFractionDigits: dp }).format(n)

/** Angka polos untuk input (koma desimal); `null` bila kosong/tidak valid. */

/** Enter = commit (blur), Esc = kembalikan nilai awal lalu blur. */
const commitKeys = (e: ReactKeyEvent<HTMLInputElement>): void => {
  if (e.key === 'Enter') {
    e.preventDefault()
    e.currentTarget.blur()
  } else if (e.key === 'Escape') {
    e.preventDefault()
    e.currentTarget.value = e.currentTarget.defaultValue
    e.currentTarget.blur()
  }
}

type Group = 'A' | 'B' | 'C' | 'L'
const groupOf = (jenis: string | null): Group => {
  const s = (jenis ?? '').toLowerCase()
  if (s.includes('tenaga kerja') || s.includes('tenaga_kerja')) return 'A'
  if (s.includes('bahan')) return 'B'
  if (s.includes('peralatan') || s.includes('alat')) return 'C'
  return 'L'
}

const GROUP_LABEL: Record<Group, string> = {
  A: 'A · Tenaga Kerja',
  B: 'B · Bahan',
  C: 'C · Peralatan',
  L: 'Lainnya'
}

export default function RabModule() {
  const [projects, setProjects] = useState<Project[]>([])
  const [projectId, setProjectId] = useState<number | null>(null)
  const [rabs, setRabs] = useState<Rab[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const confirm = useConfirm()
  const toast = useToast()

  const [newNama, setNewNama] = useState('')
  const [newPpn, setNewPpn] = useState('11')

  const [detail, setDetail] = useState<RabDetail | null>(null)
  const [hitung, setHitung] = useState<HitungResult[]>([])
  const [rekap, setRekap] = useState<RabRekap | null>(null)
  const [selItem, setSelItem] = useState<number | null>(null)
  const [volItem, setVolItem] = useState<HitungResult | null>(null)
  const [ppnEdit, setPpnEdit] = useState('11')

  const [showAdd, setShowAdd] = useState(false)
  const [addMode, setAddMode] = useState<'ahsp' | 'user'>('ahsp')
  const [addQ, setAddQ] = useState('')
  const [addDivisi, setAddDivisi] = useState<number | null>(null)
  const [refDivisi, setRefDivisi] = useState<RefDivisi[]>([])
  const [refItems, setRefItems] = useState<RefItem[]>([])
  const [userForm, setUserForm] = useState({ uraian: '', satuan: '', volume: '', divisi_no: '' })

  const [hEdit, setHEdit] = useState<Record<number, string>>({})
  const [volEdit, setVolEdit] = useState<Record<number, string>>({})
  const [itemQ, setItemQ] = useState('')
  const [hargaGlobal, setHargaGlobal] = useState(false)

  const rabId = detail?.rab.id ?? null

  useEffect(() => {
    api
      .projectList()
      .then((ps) => {
        setProjects(ps)
        if (ps.length > 0) setProjectId(ps[0].id)
      })
      .catch((e) => setError(String(e)))
  }, [])

  const loadRabs = useCallback(async (pid: number) => {
    try {
      setRabs(await api.rabList(pid))
      setError(null)
    } catch (e) {
      setError(String(e))
    }
  }, [])

  useEffect(() => {
    if (projectId != null) {
      setDetail(null)
      loadRabs(projectId)
    }
  }, [projectId, loadRabs])

  const reload = useCallback(async (rid: number) => {
    const [d, h, r] = await Promise.all([api.rabGet(rid), api.rabHitung(rid), api.rabRekap(rid)])
    setDetail(d)
    setHitung(h)
    setRekap(r)
    setPpnEdit(String(d.rab.ppn_pct))
  }, [])

  const openRab = async (rid: number) => {
    try {
      await reload(rid)
      setSelItem(null)
      setShowAdd(false)
      setHEdit({})
      setVolEdit({})
      setError(null)
    } catch (e) {
      setError(String(e))
    }
  }

  const createRab = async () => {
    if (projectId == null || newNama.trim() === '') return
    const ppn = parseNum(newPpn)
    if (!ppn.ok) {
      toast.push(`PPN: ${ppn.message}`, 'err')
      return
    }
    setBusy(true)
    setSaving()
    try {
      const r = await api.rabCreate(projectId, newNama.trim(), ppn.value)
      setNewNama('')
      await loadRabs(projectId)
      await openRab(r.id)
      setError(null)
      setSaved('RAB dibuat')
      toast.push('RAB dibuat.', 'ok')
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }

  /** Salin RAB lengkap (item + komponen + take-off) sebagai revisi baru. */
  const duplicateRab = async (r: Rab) => {
    if (projectId == null) return
    setBusy(true)
    setSaving()
    try {
      const copy = await api.rabDuplicate(r.id, `${r.nama} (salinan)`)
      await loadRabs(projectId)
      await openRab(copy.id)
      setError(null)
      setSaved('RAB diduplikat')
      toast.push('RAB diduplikat lengkap dengan item & take-off.', 'ok')
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }

  const removeRab = async (r: Rab) => {
    if (projectId == null) return
    const pid = projectId
    if (
      !(await confirm({
        title: 'Hapus RAB',
        message: `Hapus RAB "${r.nama}"? Semua item, komponen, take-off, dan catatan progress ikut terhapus. Kamu bisa membatalkan lewat tombol Undo selama 20 detik.`,
        confirmLabel: 'Hapus',
        danger: true
      }))
    )
      return
    setBusy(true)
    try {
      const snap = await api.rabSnapshot(r.id)
      await api.rabRemove(r.id)
      if (detail?.rab.id === r.id) setDetail(null)
      await loadRabs(pid)
      setError(null)
      setSaved('RAB dihapus')
      toast.push(
        'RAB dihapus.',
        'ok',
        {
          label: 'Undo',
          run: async () => {
            try {
              await api.rabRestore(pid, snap)
              await loadRabs(pid)
              setSaved('RAB dipulihkan')
              toast.push('RAB dipulihkan.', 'ok')
            } catch (e) {
              setError(String(e))
            }
          }
        },
        20000
      )
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }

  // ---- add panel ----
  useEffect(() => {
    if (!showAdd || addMode !== 'ahsp') return
    const t = setTimeout(() => {
      api.refItems(addQ, addDivisi).then(setRefItems).catch((e) => setError(String(e)))
    }, 250)
    return () => clearTimeout(t)
  }, [showAdd, addMode, addQ, addDivisi])

  useEffect(() => {
    if (showAdd && refDivisi.length === 0) {
      api.refDivisi().then(setRefDivisi).catch((e) => setError(String(e)))
    }
  }, [showAdd, refDivisi.length])

  const addAhsp = async (kode: string) => {
    if (rabId == null) return
    setBusy(true)
    try {
      await api.rabAddItem(rabId, kode, 0)
      await reload(rabId)
      setError(null)
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }

  const addUser = async () => {
    if (rabId == null || userForm.uraian.trim() === '') return
    const vol = parseNum(userForm.volume)
    if (!vol.ok) {
      toast.push(`Volume: ${vol.message}`, 'err')
      return
    }
    setBusy(true)
    setSaving()
    try {
      await api.rabAddUserItem(
        rabId,
        userForm.uraian.trim(),
        userForm.satuan.trim() || null,
        vol.value,
        userForm.divisi_no.trim() || null
      )
      setUserForm({ uraian: '', satuan: '', volume: '', divisi_no: '' })
      await reload(rabId)
      setError(null)
      setSaved('Item ditambahkan')
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }

  const commitVolume = async (itemId: number, raw: string) => {
    if (rabId == null) return
    const p = parseNum(raw)
    if (!p.ok) {
      setVolEdit((prev) => {
        const n = { ...prev }
        delete n[itemId]
        return n
      })
      toast.push(`Volume: ${p.message} Nilai lama dipertahankan.`, 'err')
      return
    }
    const current = hitung.find((h) => h.item.id === itemId)?.item.volume ?? 0
    const value = p.value ?? 0
    setVolEdit((prev) => {
      const n = { ...prev }
      delete n[itemId]
      return n
    })
    if (Math.abs(value - current) < 1e-9) return
    setSaving()
    try {
      await api.rabUpdateItem(itemId, null, null, value, null)
      await reload(rabId)
      setError(null)
      setSaved('Volume disimpan')
    } catch (e) {
      setError(String(e))
    }
  }

  const removeItem = async (itemId: number) => {
    if (rabId == null) return
    const h = hitung.find((x) => x.item.id === itemId)
    setBusy(true)
    try {
      await api.rabRemoveItem(itemId)
      if (selItem === itemId) setSelItem(null)
      await reload(rabId)
      setError(null)
      setSaved('Item dihapus')
      if (h) {
        const snap = h.item
        toast.push('Item dihapus.', 'ok', {
          label: 'Undo',
          run: async () => {
            try {
              if (snap.kode) await api.rabAddItem(rabId, snap.kode, snap.volume)
              else
                await api.rabAddUserItem(
                  rabId,
                  snap.uraian,
                  snap.satuan,
                  snap.volume,
                  snap.divisi_no
                )
              await reload(rabId)
              setSaved('Item dipulihkan')
              toast.push('Item dipulihkan (harga mengikuti AHSP terkini).', 'ok')
            } catch (e) {
              setError(String(e))
            }
          }
        })
      }
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }

  const commitHarga = async (k: HitungKomponen, raw: string) => {
    if (rabId == null) return
    const p = parseNum(raw)
    if (!p.ok) {
      setHEdit((prev) => {
        const n = { ...prev }
        delete n[k.id]
        return n
      })
      toast.push(`Harga: ${p.message} Nilai lama dipertahankan.`, 'err')
      return
    }
    setHEdit((prev) => {
      const n = { ...prev }
      delete n[k.id]
      return n
    })
    setSaving()
    try {
      await api.rabSetHargaKomponen(rabId, k.jenis, k.uraian, p.value, hargaGlobal)
      await reload(rabId)
      setError(null)
      setSaved('Harga disimpan')
      toast.push(
        hargaGlobal
          ? `Harga "${k.uraian}" diperbarui di RAB ini dan katalog AHSP.`
          : `Harga "${k.uraian}" diperbarui di RAB ini (katalog AHSP tidak diubah).`,
        'ok'
      )
    } catch (e) {
      setError(String(e))
    }
  }

  const savePpn = async () => {
    if (rabId == null) return
    const p = parseNum(ppnEdit)
    if (!p.ok) {
      toast.push(`PPN: ${p.message}`, 'err')
      setPpnEdit(String(detail?.rab.ppn_pct ?? 11))
      return
    }
    setBusy(true)
    setSaving()
    try {
      await api.rabUpdate(rabId, null, p.value, null, null)
      await reload(rabId)
      setError(null)
      setSaved('PPN disimpan')
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }

  /** Overhead analisa (%) → disimpan sebagai fraksi (10% = 0.1). */
  const commitOverhead = async (raw: string) => {
    if (rabId == null || selItem == null) return
    const p = parseNum(raw)
    if (!p.ok) {
      toast.push(`Overhead: ${p.message}`, 'err')
      return
    }
    setSaving()
    try {
      await api.rabUpdateItem(selItem, null, null, null, (p.value ?? 0) / 100)
      await reload(rabId)
      setError(null)
      setSaved('Overhead disimpan')
    } catch (e) {
      setError(String(e))
    }
  }

  const selHitung = useMemo(
    () => (selItem == null ? null : hitung.find((h) => h.item.id === selItem) ?? null),
    [hitung, selItem]
  )

  const usedKode = useMemo(
    () => new Set(hitung.map((h) => h.item.kode).filter((k): k is string => !!k)),
    [hitung]
  )

  const shownHitung = useMemo(() => {
    const s = itemQ.trim().toLowerCase()
    if (!s) return hitung
    return hitung.filter((h) =>
      [h.item.kode, h.item.uraian, h.item.satuan].some((v) => (v ?? '').toLowerCase().includes(s))
    )
  }, [hitung, itemQ])

  if (projects.length === 0) {
    return (
      <div className="module">
        <div className="module-head">
          <h1>RAB</h1>
        </div>
        <div className="empty">
          <div className="empty-title">Belum ada proyek</div>
          <p className="muted">Buat proyek dulu di modul Project.</p>
        </div>
      </div>
    )
  }

  // ---------------- Builder ----------------
  if (detail) {
    const r = detail.rab
    return (
      <div className="module">
        <div className="module-head">
          <div>
            <button className="btn ghost" onClick={() => setDetail(null)}>
              <Icon name="arrow-left" size={15} /> Daftar RAB
            </button>
            <h1>{r.nama}</h1>
          </div>
          <div className="actions">
            <label className="field compact">
              <span>PPN %</span>
              <input
                type="text"
                inputMode="decimal"
                value={ppnEdit}
                style={{ width: 80 }}
                onChange={(e) => setPpnEdit(e.target.value)}
                onBlur={savePpn}
                onKeyDown={commitKeys}
              />
            </label>
            <button className="btn" onClick={() => setShowAdd((s) => !s)}>
              <Icon name={showAdd ? 'close' : 'plus'} size={15} /> {showAdd ? 'Tutup' : 'Item'}
            </button>
          </div>
        </div>
        <ErrorBox error={error} />

        {showAdd && (
          <section className="panel">
            <div className="panel-head">
              <h2>Tambah Item</h2>
              <div className="actions">
                <button
                  className={`btn tiny${addMode === 'ahsp' ? ' primary' : ''}`}
                  onClick={() => setAddMode('ahsp')}
                >
                  Dari AHSP
                </button>
                <button
                  className={`btn tiny${addMode === 'user' ? ' primary' : ''}`}
                  onClick={() => setAddMode('user')}
                >
                  Item Manual
                </button>
              </div>
            </div>

            {addMode === 'ahsp' ? (
              <>
                <div className="inline-form">
                  <input
                    placeholder="Cari kode / uraian AHSP…"
                    value={addQ}
                    onChange={(e) => setAddQ(e.target.value)}
                  />
                  <select
                    value={addDivisi ?? ''}
                    onChange={(e) => setAddDivisi(e.target.value === '' ? null : Number(e.target.value))}
                  >
                    <option value="">Semua divisi</option>
                    {refDivisi.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.no}. {d.nama} ({d.item_count})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="pick-list">
                  {refItems.length === 0 && <p className="muted">Tidak ada hasil.</p>}
                  {refItems.map((it) => {
                    const used = usedKode.has(it.kode)
                    return (
                      <div
                        key={it.id}
                        className="pick-row"
                        onClick={() => addAhsp(it.kode)}
                        title={used ? 'Kode ini sudah ada di RAB — menambah akan membuat baris kedua.' : undefined}
                      >
                        <span className="mono kode">{it.kode}</span>
                        <span className="grow">{it.uraian}</span>
                        {used && <span className="badge">sudah ada</span>}
                        <span className="muted">{it.satuan ?? '—'}</span>
                        <button className="btn tiny primary" disabled={busy}>
                          +
                        </button>
                      </div>
                    )
                  })}
                </div>
              </>
            ) : (
              <div className="inline-form">
                <input
                  placeholder="Uraian pekerjaan"
                  value={userForm.uraian}
                  onChange={(e) => setUserForm({ ...userForm, uraian: e.target.value })}
                  style={{ flex: '2 1 220px' }}
                />
                <input
                  placeholder="Satuan"
                  value={userForm.satuan}
                  onChange={(e) => setUserForm({ ...userForm, satuan: e.target.value })}
                />
                <input
                  placeholder="Volume"
                  value={userForm.volume}
                  onChange={(e) => setUserForm({ ...userForm, volume: e.target.value })}
                />
                <input
                  placeholder="Divisi (opsional)"
                  value={userForm.divisi_no}
                  onChange={(e) => setUserForm({ ...userForm, divisi_no: e.target.value })}
                />
                <button className="btn primary" onClick={addUser} disabled={busy || userForm.uraian.trim() === ''}>
                  <Icon name="plus" size={15} /> Tambah
                </button>
              </div>
            )}
          </section>
        )}

        <div className="rab-layout">
          <section className="panel rab-left">
            <div className="panel-head">
              <h2>Daftar Item ({hitung.length})</h2>
            </div>
            {hitung.length > 0 && (
              <div className="toolbar" style={{ marginBottom: 8 }}>
                <span className="search-input">
                  <span className="ico">
                    <Icon name="search" size={14} />
                  </span>
                  <input
                    placeholder="Cari kode / uraian item…"
                    value={itemQ}
                    onChange={(e) => setItemQ(e.target.value)}
                  />
                </span>
                <span className="grow" />
                <span className="muted mono">
                  {shownHitung.length} / {hitung.length}
                </span>
              </div>
            )}
            <table className="tbl compact">
              <thead>
                <tr>
                  <th>Kode</th>
                  <th>Uraian</th>
                  <th className="right">Vol</th>
                  <th className="right">Harga Sat.</th>
                  <th className="right">Total</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {hitung.length === 0 && (
                  <tr>
                    <td colSpan={6} className="muted center">
                      Belum ada item. Klik “+ Item”.
                    </td>
                  </tr>
                )}
                {shownHitung.length === 0 && hitung.length > 0 && (
                  <tr>
                    <td colSpan={6} className="muted center">
                      Tidak ada item yang cocok dengan “{itemQ}”.
                    </td>
                  </tr>
                )}
                {shownHitung.map((h) => (
                  <tr
                    key={h.item.id}
                    className={`rowlink${selItem === h.item.id ? ' sel' : ''}`}
                    onClick={() => setSelItem(h.item.id)}
                  >
                    <td className="mono">{h.item.kode ?? '—'}</td>
                    <td>{h.item.uraian}</td>
                    <td className="right">
                      <input
                        className="cell-input"
                        inputMode="decimal"
                        value={volEdit[h.item.id] ?? toInputNum(h.item.volume)}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setVolEdit({ ...volEdit, [h.item.id]: e.target.value })}
                        onBlur={(e) => commitVolume(h.item.id, e.target.value)}
                        onKeyDown={commitKeys}
                      />
                      <span className="muted"> {h.item.satuan ?? ''}</span>
                    </td>
                    <td className="right mono">{fmtRp(h.subtotal.f)}</td>
                    <td className="right mono">{fmtRp(h.total)}</td>
                    <td className="right">
                      <button
                        className="btn tiny"
                        title="Take-off volume"
                        onClick={(e) => {
                          e.stopPropagation()
                          setVolItem(h)
                        }}
                        disabled={busy}
                      >
                        <Icon name="layers" size={14} />
                      </button>{' '}
                      <button
                        className="btn tiny danger"
                        onClick={(e) => {
                          e.stopPropagation()
                          removeItem(h.item.id)
                        }}
                        disabled={busy}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="panel rab-right term">
            <h2>Analisa Harga Satuan</h2>
            <p className="panel-sub">
              Mengubah harga komponen hanya berlaku untuk komponen dengan jenis &amp; uraian sama di
              RAB ini. Katalog AHSP (dipakai item baru) tidak berubah kecuali dicentang di bawah.
            </p>
            <label className="panel-sub" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={hargaGlobal}
                onChange={(e) => setHargaGlobal(e.target.checked)}
              />
              Terapkan juga ke katalog AHSP
            </label>
            {!selHitung && <p className="muted">Pilih item di kiri untuk melihat analisa.</p>}
            {selHitung && (
              <AnalisaCard
                h={selHitung}
                hEdit={hEdit}
                setHEdit={setHEdit}
                onCommit={commitHarga}
                onOverhead={commitOverhead}
              />
            )}
          </section>
        </div>

        {rekap && (
          <section className="panel">
            <h2>Rekapitulasi</h2>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Divisi</th>
                  <th>Nama</th>
                  <th className="right">Jumlah</th>
                </tr>
              </thead>
              <tbody>
                {rekap.rows.map((row) => (
                  <tr key={row.divisi_no ?? '0'}>
                    <td className="mono">{row.divisi_no ?? '—'}</td>
                    <td>{row.nama}</td>
                    <td className="right mono">{fmtRp(row.total)}</td>
                  </tr>
                ))}
                <tr className="subtd">
                  <td colSpan={2}>Subtotal</td>
                  <td className="right mono">{fmtRp(rekap.subtotal)}</td>
                </tr>
                <tr className="subtd">
                  <td colSpan={2}>PPN {fmtNum(rekap.ppn_pct, 2)}%</td>
                  <td className="right mono">{fmtRp(rekap.ppn)}</td>
                </tr>
                <tr className="subtd total">
                  <td colSpan={2}>TOTAL</td>
                  <td className="right mono">{fmtRp(rekap.total)}</td>
                </tr>
              </tbody>
            </table>
          </section>
        )}

        <Drawer
          open={volItem != null}
          title="Take-off Volume"
          subtitle={volItem?.item.uraian}
          onClose={() => setVolItem(null)}
        >
          {volItem && (
            <VolumeEditor
              item={{ id: volItem.item.id, uraian: volItem.item.uraian, satuan: volItem.item.satuan, volume: volItem.item.volume }}
              onChanged={() => {
                if (rabId != null) reload(rabId)
              }}
            />
          )}
        </Drawer>
      </div>
    )
  }

  // ---------------- List ----------------
  return (
    <div className="module fill">
      <div className="module-head">
        <h1>RAB</h1>
        <label className="field compact">
          <span>Proyek</span>
          <select
            value={projectId ?? ''}
            onChange={(e) => setProjectId(Number(e.target.value))}
            style={{ minWidth: 260 }}
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.kode} — {p.nama}
              </option>
            ))}
          </select>
        </label>
      </div>
      <ErrorBox error={error} />

      <section className="panel">
        <h2>RAB Baru</h2>
        <div className="inline-form">
          <input
            placeholder="Nama RAB (mis. RAB Revisi 1)"
            value={newNama}
            onChange={(e) => setNewNama(e.target.value)}
            style={{ flex: '2 1 260px' }}
          />
          <input
            placeholder="PPN %"
            inputMode="decimal"
            value={newPpn}
            onChange={(e) => setNewPpn(e.target.value)}
            style={{ maxWidth: 90 }}
          />
          <button className="btn primary" onClick={createRab} disabled={busy || newNama.trim() === ''}>
            <Icon name="plus" size={15} /> Buat RAB
          </button>
        </div>
      </section>

      <section className="panel fill">
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Nama</th>
            <th>Status</th>
            <th className="right">PPN %</th>
            <th>Diperbarui</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rabs.length === 0 && (
            <tr>
              <td colSpan={5} className="muted center">
                Belum ada RAB untuk proyek ini.
              </td>
            </tr>
          )}
          {rabs.map((r) => (
            <tr
              key={r.id}
              className={`rowlink${rabId === r.id ? ' sel' : ''}`}
              tabIndex={0}
              onClick={() => openRab(r.id)}
              onKeyDown={(e) => {
                if (e.target !== e.currentTarget) return
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  openRab(r.id)
                }
              }}
            >
              <td>{r.nama}</td>
              <td>
                <span className="badge">{r.status}</span>
              </td>
              <td className="right mono">{fmtNum(r.ppn_pct, 2)}</td>
              <td className="muted">{r.updated_at}</td>
              <td className="right">
                <span className="row-actions">
                  <button
                    className="btn tiny"
                    title="Duplikat RAB (item, komponen, take-off ikut tersalin)"
                    onClick={(e) => {
                      e.stopPropagation()
                      duplicateRab(r)
                    }}
                    disabled={busy}
                  >
                    Salin
                  </button>{' '}
                  <button
                    className="btn tiny danger"
                    title={`Hapus RAB ${r.nama}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      removeRab(r)
                    }}
                    disabled={busy}
                  >
                    Hapus
                  </button>
                </span>
              </td>
            </tr>
          ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function AnalisaCard({
  h,
  hEdit,
  setHEdit,
  onCommit,
  onOverhead
}: {
  h: HitungResult
  hEdit: Record<number, string>
  setHEdit: (v: Record<number, string>) => void
  onCommit: (k: HitungKomponen, raw: string) => void
  onOverhead: (raw: string) => void
}) {
  const groups = useMemo(() => {
    const map: Record<Group, HitungKomponen[]> = { A: [], B: [], C: [], L: [] }
    for (const k of h.komponen) map[groupOf(k.jenis)].push(k)
    return map
  }, [h])

  const st = h.subtotal

  return (
    <div className="analisa">
      <div className="analisa-head">
        <div>
          <span className="mono kode">{h.item.kode ?? '—'}</span> {h.item.uraian}
        </div>
        <div className="muted mono">
          {fmtNum(h.item.volume)} {h.item.satuan ?? ''} × {fmtRp(st.f)} = <b>{fmtRp(h.total)}</b>
        </div>
      </div>

      <table className="tbl komp">
        <thead>
          <tr>
            <th>Komponen</th>
            <th className="right">Koef</th>
            <th className="right">Harga Sat.</th>
            <th className="right">Jumlah</th>
          </tr>
        </thead>
        <tbody>
          {(['A', 'B', 'C', 'L'] as Group[]).map((g) =>
            groups[g].length === 0 ? null : (
              <GroupBlock
                key={g}
                label={GROUP_LABEL[g]}
                rows={groups[g]}
                hEdit={hEdit}
                setHEdit={setHEdit}
                onCommit={onCommit}
              />
            )
          )}
        </tbody>
        <tfoot>
          <tr className="subtd">
            <td colSpan={3}>D = A + B + C</td>
            <td className="right mono">{fmtRp(st.d)}</td>
          </tr>
          <tr className="subtd">
            <td colSpan={3}>
              E = Overhead{' '}
              <input
                key={`${h.item.id}-${h.overhead_pct}`}
                className="cell-input"
                inputMode="decimal"
                defaultValue={toInputNum(h.overhead_pct * 100)}
                style={{ width: 58, textAlign: 'right' }}
                title="Overhead analisa (%) — tersimpan per item"
                onBlur={(e) => onOverhead(e.target.value)}
                onKeyDown={commitKeys}
              />
              %
            </td>
            <td className="right mono">{fmtRp(st.e)}</td>
          </tr>
          <tr className="subtd total">
            <td colSpan={3}>F = Harga Satuan Pekerjaan</td>
            <td className="right mono">{fmtRp(st.f)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function GroupBlock({
  label,
  rows,
  hEdit,
  setHEdit,
  onCommit
}: {
  label: string
  rows: HitungKomponen[]
  hEdit: Record<number, string>
  setHEdit: (v: Record<number, string>) => void
  onCommit: (k: HitungKomponen, raw: string) => void
}) {
  const sub = rows.reduce((s, k) => s + (k.harga_jumlah ?? 0), 0)
  return (
    <>
      <tr className="grp">
        <td colSpan={4}>{label}</td>
      </tr>
      {rows.map((k) => (
        <tr key={k.id}>
          <td>
            {k.uraian ?? '—'} {k.satuan ? <span className="muted">({k.satuan})</span> : null}
          </td>
          <td className="right mono">{fmtNum(k.koefisien, 4)}</td>
          <td className="right">
            <input
              className="cell-input"
              inputMode="decimal"
              value={hEdit[k.id] ?? (k.harga_satuan == null ? '' : toInputNum(k.harga_satuan))}
              placeholder="0"
              title="Harga satuan — berlaku untuk semua komponen dengan jenis & uraian sama"
              onChange={(e) => setHEdit({ ...hEdit, [k.id]: e.target.value })}
              onBlur={(e) => onCommit(k, e.target.value)}
              onKeyDown={commitKeys}
            />
          </td>
          <td className="right mono">{fmtRp(k.harga_jumlah)}</td>
        </tr>
      ))}
      <tr className="subtd">
        <td colSpan={3} className="right muted">
          Subtotal {label.slice(0, 1)}
        </td>
        <td className="right mono">{fmtRp(sub)}</td>
      </tr>
    </>
  )
}

type Bentuk = 'kotak' | 'trapesium' | 'silinder'

const BENTUK_OPTS: { value: Bentuk; label: string }[] = [
  { value: 'kotak', label: 'Kotak / balok — L × T' },
  { value: 'trapesium', label: 'Trapesium / pondasi — ((La + Lb) / 2) × T' },
  { value: 'silinder', label: 'Silinder / tiang — ¼πd²' }
]

function detectBentuk(uraian: string): Bentuk {
  const s = uraian.toLowerCase()
  if (/tiang|pancang|bor|borpile|silinder|bulat|sumur|cerucuk/.test(s)) return 'silinder'
  if (/pondasi|fondasi|foot ?plat|telapak|menerus|tapak|batu kali|batu belah|aanstamping|rollag|siklop/.test(s))
    return 'trapesium'
  return 'kotak'
}

function VolumeEditor({
  item,
  onChanged
}: {
  item: { id: number; uraian: string; satuan: string | null; volume: number }
  onChanged: () => void
}) {
  const toast = useToast()
  const [rows, setRows] = useState<RabVolume[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const PI = Math.PI

  const sat = (item.satuan ?? '').trim().toLowerCase()
  const isM3 = sat === 'm3'
  const [bentuk, setBentuk] = useState<Bentuk>(() => (sat === 'm3' ? detectBentuk(item.uraian) : 'kotak'))
  const showPanjang = isM3 || sat === 'm1' || sat === 'm2' || sat === 'ha' || sat === 'kg'
  const showLebar = isM3 || sat === 'm2' || sat === 'ha'
  const showLebar2 = isM3 && bentuk === 'trapesium'
  const showTinggi = isM3 ? bentuk !== 'silinder' : false

  /** Dimensi kosong = 0 (baris tidak dihitung), bukan 1. */
  const rowVolume = (r: RabVolume): number => {
    const p = r.panjang ?? 0
    const l = r.lebar ?? 0
    const l2 = r.lebar2 ?? 0
    const t = r.tinggi ?? 0
    const q = r.jumlah ?? 0
    const b = (r.bentuk ?? bentuk) as Bentuk
    if (!isM3) return p * l * t * q
    if (b === 'silinder') return (PI / 4) * l * l * p * q
    if (b === 'trapesium') return ((l + l2) / 2) * t * p * q
    return l * t * p * q
  }

  const total = rows.reduce((n, r) => n + rowVolume(r), 0)
  const dirty = rows.length > 0 && Math.abs(total - item.volume) > 1e-6

  const load = useCallback(async () => {
    try {
      const rs = await api.rabVolumes(item.id)
      setRows(rs)
      // Ikuti bentuk yang tersimpan (jangan menimpa pilihan user).
      const saved = rs[0]?.bentuk as Bentuk | undefined
      if (saved && (saved === 'kotak' || saved === 'trapesium' || saved === 'silinder')) {
        setBentuk((cur) => (rs.some((r) => r.bentuk !== cur) ? saved : cur))
      }
      setError(null)
    } catch (e) {
      setError(String(e))
    }
  }, [item.id])

  useEffect(() => {
    load()
  }, [load])

  const komponen = isM3
    ? bentuk === 'trapesium'
      ? 'A = ((Lebar Atas + Lebar Bawah) / 2) × Tinggi → × Panjang × Jumlah'
      : bentuk === 'silinder'
        ? 'A = ¼πd² → × Panjang × Jumlah'
        : 'A = Lebar × Tinggi → × Panjang × Jumlah'
    : [
        showPanjang ? 'Panjang' : null,
        showLebar ? 'Lebar' : null,
        showTinggi ? 'Tinggi' : null,
        'Jumlah'
      ]
        .filter(Boolean)
        .join(' × ')

  const dimCols = isM3
    ? bentuk === 'trapesium'
      ? 4
      : bentuk === 'silinder'
        ? 2
        : 3
    : (showPanjang ? 1 : 0) + (showLebar ? 1 : 0) + (showTinggi ? 1 : 0)
  const cols = 4 + dimCols

  const addRow = async () => {
    setBusy(true)
    try {
      await api.rabVolumeAdd({
        item_id: item.id,
        uraian: '',
        bentuk,
        panjang: showPanjang ? 1 : null,
        lebar: showLebar ? 1 : null,
        lebar2: showLebar2 ? 1 : null,
        tinggi: showTinggi ? 1 : null,
        jumlah: 1,
        pos: rows.length
      })
      await load()
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }

  /** Ganti bentuk: diterapkan ke semua baris take-off item ini (aksi eksplisit user). */
  const changeBentuk = async (next: Bentuk) => {
    setBentuk(next)
    if (rows.length === 0) return
    setBusy(true)
    try {
      await Promise.all(rows.map((r) => api.rabVolumeUpdate({ item_id: item.id, id: r.id, bentuk: next })))
      await load()
      setSaved('Bentuk volume disimpan')
      toast.push(`Bentuk semua baris diubah ke ${next}.`, 'ok')
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }

  const updateUraian = async (r: RabVolume, raw: string) => {
    if (raw === (r.uraian ?? '')) return
    try {
      await api.rabVolumeUpdate({ item_id: item.id, id: r.id, uraian: raw })
      await load()
      setSaved()
    } catch (e) {
      setError(String(e))
    }
  }

  const updateNum = async (
    r: RabVolume,
    key: 'panjang' | 'lebar' | 'lebar2' | 'tinggi' | 'jumlah',
    raw: string
  ) => {
    const p = parseNum(raw)
    if (!p.ok) {
      toast.push(`${key}: ${p.message} Nilai lama dipertahankan.`, 'err')
      await load()
      return
    }
    const v = p.value ?? 0
    if (Math.abs(v - (r[key] ?? 0)) < 1e-9) return
    const input: VolumeInput = { item_id: item.id, id: r.id }
    input[key] = v
    try {
      await api.rabVolumeUpdate(input)
      await load()
      setSaved()
    } catch (e) {
      setError(String(e))
    }
  }

  const removeRow = async (id: number) => {
    const snap = rows.find((r) => r.id === id)
    setBusy(true)
    try {
      await api.rabVolumeRemove(id)
      await load()
      setSaved('Baris take-off dihapus')
      if (snap) {
        toast.push('Baris take-off dihapus.', 'ok', {
          label: 'Undo',
          run: async () => {
            try {
              await api.rabVolumeAdd({
                item_id: item.id,
                uraian: snap.uraian ?? '',
                bentuk: snap.bentuk as Bentuk,
                panjang: snap.panjang,
                lebar: snap.lebar,
                lebar2: snap.lebar2,
                tinggi: snap.tinggi,
                jumlah: snap.jumlah,
                pos: snap.pos
              })
              await load()
              setSaved('Baris take-off dipulihkan')
            } catch (e) {
              setError(String(e))
            }
          }
        })
      }
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }

  const apply = async () => {
    setBusy(true)
    try {
      const v = await api.rabVolumeApply(item.id)
      await load()
      setSaved('Volume diterapkan')
      toast.push(`Volume diterapkan ke RAB: ${fmtNum(v)}`, 'ok')
      onChanged()
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <ErrorBox error={error} />
      <div className="facts" style={{ marginBottom: 12 }}>
        <div className="fact">
          <dt>Item</dt>
          <dd className="mono">{item.uraian}</dd>
        </div>
        <div className="fact">
          <dt>Satuan</dt>
          <dd className="mono">{item.satuan ?? '—'}</dd>
        </div>
        <div className="fact">
          <dt>Volume saat ini (RAB)</dt>
          <dd className="mono">{fmtNum(item.volume)}</dd>
        </div>
        <div className="fact">
          <dt>Total take-off</dt>
          <dd className="mono">
            {fmtNum(total)}
            {dirty && <span className="badge warn"> belum diterapkan</span>}
          </dd>
        </div>
        <div className="fact">
          <dt>Komponen volume</dt>
          <dd className="mono">{komponen}</dd>
        </div>
      </div>

      {isM3 && (
        <label className="field" style={{ marginBottom: 10, maxWidth: 360 }}>
          <span>Bentuk penampang</span>
          <select value={bentuk} onChange={(e) => changeBentuk(e.target.value as Bentuk)} disabled={busy}>
            {BENTUK_OPTS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="toolbar">
        <button className="btn tiny" onClick={addRow} disabled={busy}>
          <Icon name="plus" size={14} /> Baris
        </button>
        <span className="grow" />
        <button className={dirty ? 'btn primary' : 'btn'} onClick={apply} disabled={busy || rows.length === 0}>
          {dirty ? 'Terapkan ke Volume RAB' : 'Terapkan ulang ke Volume RAB'}
        </button>
      </div>
      {dirty && (
        <p className="panel-sub">
          Total take-off ({fmtNum(total)}) berbeda dari volume RAB ({fmtNum(item.volume)}) — klik
          Terapkan agar volume item ikut berubah.
        </p>
      )}

      <div className="table-wrap">
        <table className="tbl compact">
          <thead>
            <tr>
              <th>Uraian</th>
              {isM3 ? (
                <>
                  <th className="right">Panjang</th>
                  <th className="right">
                    {bentuk === 'trapesium' ? 'Lebar Atas' : bentuk === 'silinder' ? 'Diameter (d)' : 'Lebar'}
                  </th>
                  {bentuk === 'trapesium' && <th className="right">Lebar Bawah</th>}
                  {bentuk !== 'silinder' && <th className="right">Tinggi</th>}
                </>
              ) : (
                <>
                  {showPanjang && <th className="right">Panjang</th>}
                  {showLebar && <th className="right">Lebar</th>}
                  {showTinggi && <th className="right">Tinggi</th>}
                </>
              )}
              <th className="right">Jumlah</th>
              <th className="right">Volume</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={cols} className="muted center">
                  Belum ada baris take-off.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className={rowVolume(r) <= 0 ? 'row-warn' : undefined}>
                <td>
                  <input
                    className="cell-input"
                    style={{ textAlign: 'left' }}
                    key={`u-${r.id}-${r.uraian ?? ''}`}
                    defaultValue={r.uraian ?? ''}
                    placeholder="mis. Galian pondasi"
                    onBlur={(e) => updateUraian(r, e.target.value)}
                    onKeyDown={commitKeys}
                  />
                </td>
                {isM3 ? (
                  <>
                    <td className="right">
                      <input
                        className="cell-input"
                        inputMode="decimal"
                        key={`p-${r.id}-${r.panjang ?? ''}`}
                        defaultValue={toInputNum(r.panjang)}
                        placeholder="—"
                        onBlur={(e) => updateNum(r, 'panjang', e.target.value)}
                        onKeyDown={commitKeys}
                      />
                    </td>
                    <td className="right">
                      <input
                        className="cell-input"
                        inputMode="decimal"
                        key={`l-${r.id}-${r.lebar ?? ''}`}
                        defaultValue={toInputNum(r.lebar)}
                        placeholder="—"
                        onBlur={(e) => updateNum(r, 'lebar', e.target.value)}
                        onKeyDown={commitKeys}
                      />
                    </td>
                    {bentuk === 'trapesium' && (
                      <td className="right">
                        <input
                          className="cell-input"
                          inputMode="decimal"
                          key={`l2-${r.id}-${r.lebar2 ?? ''}`}
                          defaultValue={toInputNum(r.lebar2)}
                          placeholder="—"
                          onBlur={(e) => updateNum(r, 'lebar2', e.target.value)}
                          onKeyDown={commitKeys}
                        />
                      </td>
                    )}
                    {bentuk !== 'silinder' && (
                      <td className="right">
                        <input
                          className="cell-input"
                          inputMode="decimal"
                          key={`t-${r.id}-${r.tinggi ?? ''}`}
                          defaultValue={toInputNum(r.tinggi)}
                          placeholder="—"
                          onBlur={(e) => updateNum(r, 'tinggi', e.target.value)}
                          onKeyDown={commitKeys}
                        />
                      </td>
                    )}
                  </>
                ) : (
                  <>
                    {showPanjang && (
                      <td className="right">
                        <input
                          className="cell-input"
                          inputMode="decimal"
                          key={`p-${r.id}-${r.panjang ?? ''}`}
                          defaultValue={toInputNum(r.panjang)}
                          placeholder="—"
                          onBlur={(e) => updateNum(r, 'panjang', e.target.value)}
                          onKeyDown={commitKeys}
                        />
                      </td>
                    )}
                    {showLebar && (
                      <td className="right">
                        <input
                          className="cell-input"
                          inputMode="decimal"
                          key={`l-${r.id}-${r.lebar ?? ''}`}
                          defaultValue={toInputNum(r.lebar)}
                          placeholder="—"
                          onBlur={(e) => updateNum(r, 'lebar', e.target.value)}
                          onKeyDown={commitKeys}
                        />
                      </td>
                    )}
                    {showTinggi && (
                      <td className="right">
                        <input
                          className="cell-input"
                          inputMode="decimal"
                          key={`t-${r.id}-${r.tinggi ?? ''}`}
                          defaultValue={toInputNum(r.tinggi)}
                          placeholder="—"
                          onBlur={(e) => updateNum(r, 'tinggi', e.target.value)}
                          onKeyDown={commitKeys}
                        />
                      </td>
                    )}
                  </>
                )}
                <td className="right">
                  <input
                    className="cell-input"
                    inputMode="decimal"
                    key={`q-${r.id}-${r.jumlah ?? ''}`}
                    defaultValue={toInputNum(r.jumlah)}
                    placeholder="—"
                    onBlur={(e) => updateNum(r, 'jumlah', e.target.value)}
                    onKeyDown={commitKeys}
                  />
                </td>
                <td className="right mono">{fmtNum(rowVolume(r))}</td>
                <td className="right">
                  <button className="btn tiny danger" onClick={() => removeRow(r.id)} disabled={busy}>
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
