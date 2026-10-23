import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import { ErrorBox, useConfirm, useToast } from '../components/ui'
import { Icon } from '../components/Icons'
import { parseNum } from '../lib/num'
import { setSaved, setSaving } from '../lib/status'
import type { ProgressEntry, ProgressItemRow, ProgressSummary, Project, Rab } from '../../../shared/types'

const fmtRp = (n: number | null | undefined): string =>
  n == null
    ? '—'
    : new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)

const fmtNum = (n: number | null | undefined, dp = 4): string =>
  n == null ? '—' : new Intl.NumberFormat('id-ID', { maximumFractionDigits: dp }).format(n)

const numOrNull = (s: string): number | null => {
  const p = parseNum(s)
  return p.ok ? p.value : null
}

const clamp = (n: number): number => Math.max(0, Math.min(100, n))

const today = (): string => new Date().toISOString().slice(0, 10)

export default function ProgressModule() {
  const [projects, setProjects] = useState<Project[]>([])
  const [projectId, setProjectId] = useState<number | null>(null)
  const [rabs, setRabs] = useState<Rab[]>([])
  const [rabId, setRabId] = useState<number | null>(null)

  const [summary, setSummary] = useState<ProgressSummary | null>(null)
  const [selItem, setSelItem] = useState<number | null>(null)
  const [entries, setEntries] = useState<ProgressEntry[]>([])

  const [form, setForm] = useState({ tanggal: today(), pct: '', volume: '', keterangan: '' })
  const [error, setError] = useState<string | null>(null)
  const confirm = useConfirm()
  const toast = useToast()
  const [busy, setBusy] = useState(false)

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
      const rs = await api.rabList(pid)
      setRabs(rs)
      setRabId(rs.length > 0 ? rs[0].id : null)
      setError(null)
    } catch (e) {
      setError(String(e))
    }
  }, [])

  useEffect(() => {
    if (projectId != null) {
      setSummary(null)
      setSelItem(null)
      setEntries([])
      loadRabs(projectId)
    }
  }, [projectId, loadRabs])

  const loadSummary = useCallback(async (rid: number) => {
    try {
      setSummary(await api.progressSummary(rid))
      setError(null)
    } catch (e) {
      setError(String(e))
    }
  }, [])

  useEffect(() => {
    if (rabId != null) loadSummary(rabId)
    else setSummary(null)
  }, [rabId, loadSummary])

  const selRow: ProgressItemRow | null = useMemo(
    () => (summary && selItem != null ? summary.items.find((i) => i.item_id === selItem) ?? null : null),
    [summary, selItem]
  )

  const openItem = useCallback(async (row: ProgressItemRow) => {
    setSelItem(row.item_id)
    setForm({ tanggal: today(), pct: String(row.pct), volume: '', keterangan: '' })
    try {
      setEntries(await api.progressEntries(row.item_id))
      setError(null)
    } catch (e) {
      setError(String(e))
    }
  }, [])

  const addEntry = async () => {
    if (rabId == null || selItem == null) return
    const pctRaw = parseNum(form.pct)
    if (!pctRaw.ok) {
      toast.push(`% kumulatif: ${pctRaw.message}`, 'err')
      return
    }
    const vol = parseNum(form.volume)
    if (!vol.ok) {
      toast.push(`Volume: ${vol.message}`, 'err')
      return
    }
    // Aturan: bila volume diisi, progress dihitung dari volume; jika tidak, pakai % kumulatif.
    const fromVolume = vol.value != null && selRow != null && selRow.volume > 0
    const pct = fromVolume ? (vol.value! / selRow.volume) * 100 : pctRaw.value
    if (pct == null) {
      toast.push('Isi % kumulatif atau volume terpasang.', 'err')
      return
    }
    setBusy(true)
    setSaving()
    try {
      await api.progressAdd({
        item_id: selItem,
        tanggal: form.tanggal || today(),
        pct: clamp(pct),
        volume: vol.value,
        keterangan: form.keterangan.trim() || null
      })
      const row = summary?.items.find((i) => i.item_id === selItem) ?? null
      await loadSummary(rabId)
      setEntries(await api.progressEntries(selItem))
      setForm({ tanggal: today(), pct: row ? String(row.pct) : '', volume: '', keterangan: '' })
      setError(null)
      setSaved('Progress disimpan')
      toast.push('Progress tersimpan.', 'ok')
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }

  const removeEntry = async (id: number) => {
    if (rabId == null || selItem == null) return
    const snap = entries.find((e) => e.id === id)
    if (!(await confirm({ title: 'Hapus Catatan', message: 'Hapus catatan progress ini?', confirmLabel: 'Hapus', danger: true }))) return
    setBusy(true)
    try {
      await api.progressRemove(id)
      await loadSummary(rabId)
      setEntries(await api.progressEntries(selItem))
      setError(null)
      setSaved('Catatan progress dihapus')
      if (snap) {
        toast.push('Catatan progress dihapus.', 'ok', {
          label: 'Undo',
          run: async () => {
            try {
              await api.progressAdd({
                item_id: selItem,
                tanggal: snap.tanggal,
                pct: snap.pct,
                volume: snap.volume,
                keterangan: snap.keterangan
              })
              await loadSummary(rabId)
              setEntries(await api.progressEntries(selItem))
              setSaved('Catatan progress dipulihkan')
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

  const formVol = numOrNull(form.volume)
  const autoPct =
    selRow && formVol != null && selRow.volume > 0 ? clamp((formVol / selRow.volume) * 100) : null

  if (projects.length === 0) {
    return (
      <div className="module">
        <div className="module-head">
          <h1>Progress</h1>
        </div>
        <div className="empty">
        <div className="empty-title">Belum ada proyek</div>
        <p className="muted">Buat proyek dulu di modul Project.</p>
      </div>
      </div>
    )
  }

  const selRab = rabs.find((r) => r.id === rabId) ?? null

  return (
    <div className="module">
      <div className="module-head">
        <h1>Progress</h1>
        <div className="actions">
          <label className="field compact">
            <span>Proyek</span>
            <select
              value={projectId ?? ''}
              onChange={(e) => setProjectId(Number(e.target.value))}
              style={{ minWidth: 240 }}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.kode} — {p.nama}
                </option>
              ))}
            </select>
          </label>
          <label className="field compact">
            <span>RAB</span>
            <select
              value={rabId ?? ''}
              onChange={(e) => setRabId(e.target.value === '' ? null : Number(e.target.value))}
              style={{ minWidth: 200 }}
              disabled={rabs.length === 0}
            >
              {rabs.length === 0 && <option value="">Tidak ada RAB</option>}
              {rabs.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nama}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <ErrorBox error={error} />

      {rabs.length === 0 && <div className="empty">
        <div className="empty-title">Belum ada RAB</div>
        <p className="muted">Buat RAB dulu di modul RAB.</p>
      </div>}

      {summary && (
        <>
          <section className="panel">
            <div className="progress-head">
              <div>
                <h2>{selRab?.nama ?? 'RAB'}</h2>
                <div className="muted">
                  Total RAB {fmtRp(summary.total_nilai)} · Terpasang {fmtRp(summary.nilai_actual)}
                </div>
              </div>
              <div className="bigpct">{fmtNum(summary.progress_pct, 2)}%</div>
            </div>
            <div className="pbar">
              <span style={{ width: `${clamp(summary.progress_pct)}%` }} />
            </div>
          </section>

          <div className="rab-layout">
            <section className="panel rab-left">
              <h2>Item ({summary.items.length})</h2>
              <table className="tbl compact">
                <thead>
                  <tr>
                    <th>Kode</th>
                    <th>Uraian</th>
                    <th className="right">Vol</th>
                    <th className="right">Nilai</th>
                    <th className="right">Bobot</th>
                    <th className="right">%</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.items.length === 0 && (
                    <tr>
                      <td colSpan={6} className="muted center">
                        RAB ini belum punya item.
                      </td>
                    </tr>
                  )}
                  {summary.items.map((it) => (
                    <tr
                      key={it.item_id}
                      className={`rowlink${selItem === it.item_id ? ' sel' : ''}`}
                      onClick={() => openItem(it)}
                    >
                      <td className="mono">{it.kode ?? '—'}</td>
                      <td>{it.uraian}</td>
                      <td className="right">
                        {fmtNum(it.volume, 2)} <span className="muted">{it.satuan ?? ''}</span>
                      </td>
                      <td className="right mono">{fmtRp(it.nilai)}</td>
                      <td className="right mono">{fmtNum(it.bobot_pct, 2)}%</td>
                      <td className="right mono">{fmtNum(it.pct, 2)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="panel rab-right term">
              <h2>Pengukuran Progress</h2>
              {!selRow && <p className="muted">Pilih item di kiri untuk mencatat progress.</p>}
              {selRow && (
                <>
                  <div className="analisa-head">
                    <div>
                      <span className="mono kode">{selRow.kode ?? '—'}</span> {selRow.uraian}
                    </div>
                    <div className="muted mono">
                      {fmtNum(selRow.volume, 2)} {selRow.satuan ?? ''} · bobot {fmtNum(selRow.bobot_pct, 2)}%
                    </div>
                  </div>
                  <div className="facts">
                    <dl className="fact">
                      <dt>Nilai</dt>
                      <dd className="mono">{fmtRp(selRow.nilai)}</dd>
                    </dl>
                    <dl className="fact">
                      <dt>Progress</dt>
                      <dd className="mono">{fmtNum(selRow.pct, 2)}%</dd>
                    </dl>
                    <dl className="fact">
                      <dt>Nilai terpasang</dt>
                      <dd className="mono">{fmtRp(selRow.nilai_actual)}</dd>
                    </dl>
                    <dl className="fact">
                      <dt>Volume terpasang</dt>
                      <dd className="mono">
                        {selRow.volume_actual == null ? '—' : fmtNum(selRow.volume_actual, 2)}
                      </dd>
                    </dl>
                  </div>

                  <div className="inline-form">
                    <input
                      type="date"
                      value={form.tanggal}
                      onChange={(e) => setForm({ ...form, tanggal: e.target.value })}
                    />
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="% kumulatif"
                      value={autoPct != null ? String(Number(autoPct.toFixed(4))) : form.pct}
                      readOnly={autoPct != null}
                      onChange={(e) => setForm({ ...form, pct: e.target.value })}
                      style={{ maxWidth: 110 }}
                      title={autoPct != null ? 'Dihitung otomatis dari volume terpasang' : undefined}
                    />
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="Volume (opsional)"
                      value={form.volume}
                      onChange={(e) => setForm({ ...form, volume: e.target.value })}
                      style={{ maxWidth: 150 }}
                    />
                    <input
                      placeholder="Keterangan (opsional)"
                      value={form.keterangan}
                      onChange={(e) => setForm({ ...form, keterangan: e.target.value })}
                      style={{ flex: '2 1 160px' }}
                    />
                    <button
                      className="btn primary"
                      onClick={addEntry}
                      disabled={busy || (form.pct.trim() === '' && form.volume.trim() === '')}
                    >
                      <Icon name="plus" size={15} /> Catat
                    </button>
                  </div>
                  <p className="panel-sub">
                    {autoPct != null
                      ? `Progress dihitung dari volume: ${fmtNum(autoPct, 2)}% (volume terpasang ÷ volume item).`
                      : 'Isi % kumulatif, atau isi volume terpasang agar % dihitung otomatis.'}
                  </p>

                  <table className="tbl compact">
                    <thead>
                      <tr>
                        <th>Tanggal</th>
                        <th className="right">%</th>
                        <th className="right">Volume</th>
                        <th>Keterangan</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {entries.length === 0 && (
                        <tr>
                          <td colSpan={5} className="muted center">
                            Belum ada catatan progress.
                          </td>
                        </tr>
                      )}
                      {entries.map((en) => (
                        <tr key={en.id}>
                          <td className="mono">{en.tanggal}</td>
                          <td className="right mono">{fmtNum(en.pct, 2)}%</td>
                          <td className="right mono">{en.volume == null ? '—' : fmtNum(en.volume, 2)}</td>
                          <td className="muted">{en.keterangan ?? '—'}</td>
                          <td className="right">
                            <button
                              className="btn tiny danger"
                              onClick={() => removeEntry(en.id)}
                              disabled={busy}
                            >
                              ×
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </section>
          </div>

          <div className="rab-layout">
            <section className="panel rab-left">
              <h2>Progress per Divisi</h2>
              <table className="tbl compact">
                <thead>
                  <tr>
                    <th>Divisi</th>
                    <th>Nama</th>
                    <th className="right">Nilai</th>
                    <th className="right">Terpasang</th>
                    <th className="right">%</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.divisi.length === 0 && (
                    <tr>
                      <td colSpan={5} className="muted center">
                        Belum ada data.
                      </td>
                    </tr>
                  )}
                  {summary.divisi.map((d) => (
                    <tr key={d.divisi_no}>
                      <td className="mono">{d.divisi_no}</td>
                      <td>{d.nama}</td>
                      <td className="right mono">{fmtRp(d.nilai)}</td>
                      <td className="right mono">{fmtRp(d.nilai_actual)}</td>
                      <td className="right mono">{fmtNum(d.progress_pct, 2)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="panel rab-right">
              <h2>Kurva-S</h2>
              <table className="tbl compact">
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th className="right">Progress</th>
                    <th className="right">Nilai terpasang</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.curve.length === 0 && (
                    <tr>
                      <td colSpan={3} className="muted center">
                        Belum ada titik pengukuran.
                      </td>
                    </tr>
                  )}
                  {summary.curve.map((p) => (
                    <tr key={p.tanggal}>
                      <td className="mono">{p.tanggal}</td>
                      <td className="right mono">{fmtNum(p.progress_pct, 2)}%</td>
                      <td className="right mono">{fmtRp(p.nilai_actual)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>
        </>
      )}
    </div>
  )
}
