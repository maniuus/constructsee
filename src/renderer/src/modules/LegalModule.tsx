import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import { ErrorBox, useConfirm, useToast } from '../components/ui'
import { parseNum } from '../lib/num'
import { Icon } from '../components/Icons'
import type { Document, DocumentInput, Project } from '../../../shared/types'

const KATEGORI: { v: string; label: string }[] = [
  { v: '', label: 'Semua' },
  { v: 'kontrak', label: 'Kontrak' },
  { v: 'surat', label: 'Surat' },
  { v: 'berita_acara', label: 'Berita Acara' },
  { v: 'izin', label: 'Izin' },
  { v: 'gambar', label: 'Gambar' },
  { v: 'laporan', label: 'Laporan' },
  { v: 'tagihan', label: 'Tagihan' },
  { v: 'jaminan', label: 'Jaminan' },
  { v: 'lainnya', label: 'Lainnya' }
]

const KATEGORI_LABEL: Record<string, string> = KATEGORI.reduce<Record<string, string>>((acc, k) => {
  if (k.v) acc[k.v] = k.label
  return acc
}, {})

const STATUS: { v: string; label: string }[] = [
  { v: 'draft', label: 'Draft' },
  { v: 'aktif', label: 'Aktif' },
  { v: 'selesai', label: 'Selesai' },
  { v: 'expired', label: 'Expired' },
  { v: 'dibatalkan', label: 'Dibatalkan' }
]

const STATUS_LABEL: Record<string, string> = STATUS.reduce<Record<string, string>>((acc, s) => {
  acc[s.v] = s.label
  return acc
}, {})

const ARAH: { v: string; label: string }[] = [
  { v: 'masuk', label: 'Masuk' },
  { v: 'keluar', label: 'Keluar' }
]

const ALERT_DAYS = 30

const today = (): string => new Date().toISOString().slice(0, 10)

const daysUntil = (date: string | null): number | null => {
  if (!date) return null
  const d = new Date(`${date}T00:00:00`)
  if (Number.isNaN(d.getTime())) return null
  const t = new Date()
  t.setHours(0, 0, 0, 0)
  return Math.round((d.getTime() - t.getTime()) / 86400000)
}

interface FormState {
  kategori: string
  arah: string
  nomor: string
  judul: string
  tanggal: string
  dari: string
  kepada: string
  instansi: string
  status: string
  mbdari: string
  mbsampai: string
  reminder: string
  keterangan: string
}

const emptyForm = (): FormState => ({
  kategori: 'surat',
  arah: 'masuk',
  nomor: '',
  judul: '',
  tanggal: today(),
  dari: '',
  kepada: '',
  instansi: '',
  status: 'draft',
  mbdari: '',
  mbsampai: '',
  reminder: String(ALERT_DAYS),
  keterangan: ''
})

const formFromDoc = (d: Document): FormState => ({
  kategori: d.kategori,
  arah: d.arah ?? 'masuk',
  nomor: d.nomor ?? '',
  judul: d.judul,
  tanggal: d.tanggal ?? '',
  dari: d.dari_pihak ?? '',
  kepada: d.kepada_pihak ?? '',
  instansi: d.instansi ?? '',
  status: d.status,
  mbdari: d.masa_berlaku_dari ?? '',
  mbsampai: d.masa_berlaku_sampai ?? '',
  reminder: d.reminder_days != null ? String(d.reminder_days) : String(ALERT_DAYS),
  keterangan: d.keterangan ?? ''
})

const toInput = (f: FormState, projectId: number, id?: number): DocumentInput => ({
  id: id ?? null,
  project_id: projectId,
  kategori: f.kategori || 'surat',
  arah: f.kategori === 'surat' ? f.arah || null : null,
  nomor: f.nomor.trim() || null,
  judul: f.judul.trim(),
  tanggal: f.tanggal || null,
  dari_pihak: f.dari.trim() || null,
  kepada_pihak: f.kepada.trim() || null,
  instansi: f.instansi.trim() || null,
  status: f.status || 'draft',
  masa_berlaku_dari: f.mbdari || null,
  masa_berlaku_sampai: f.mbsampai || null,
  reminder_days: (() => {
    const p = parseNum(f.reminder)
    return p.ok ? p.value : null
  })(),
  keterangan: f.keterangan.trim() || null
})

export default function LegalModule() {
  const [projects, setProjects] = useState<Project[]>([])
  const [projectId, setProjectId] = useState<number | null>(null)

  const [docs, setDocs] = useState<Document[]>([])
  const [alerts, setAlerts] = useState<Document[]>([])
  const [katFilter, setKatFilter] = useState('')
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')

  const [editing, setEditing] = useState<'none' | 'new' | 'edit'>('none')
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())

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

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 250)
    return () => clearTimeout(t)
  }, [search])

  const projectName = useCallback(
    (id: number): string => {
      const p = projects.find((x) => x.id === id)
      return p ? `${p.kode} — ${p.nama}` : `#${id}`
    },
    [projects]
  )

  const loadDocs = useCallback(async (pid: number, kat: string, q: string) => {
    try {
      setDocs(await api.documentList(pid, kat || null, q || null))
      setError(null)
    } catch (e) {
      setError(String(e))
    }
  }, [])

  const loadAlerts = useCallback(async () => {
    try {
      setAlerts(await api.documentsExpiring(ALERT_DAYS))
    } catch (e) {
      setError(String(e))
    }
  }, [])

  useEffect(() => {
    if (projectId != null) loadDocs(projectId, katFilter, debounced)
  }, [projectId, katFilter, debounced, loadDocs])

  useEffect(() => {
    loadAlerts()
  }, [loadAlerts])

  const startNew = () => {
    setEditing('new')
    setEditId(null)
    setForm(emptyForm())
  }

  const startEdit = (d: Document) => {
    setEditing('edit')
    setEditId(d.id)
    setForm(formFromDoc(d))
  }

  const cancel = () => {
    setEditing('none')
    setEditId(null)
    setForm(emptyForm())
  }

  const save = async () => {
    if (projectId == null) return
    if (!form.judul.trim()) {
      setError('Judul dokumen wajib diisi.')
      return
    }
    if (!parseNum(form.reminder).ok) {
      setError('Pengingat (hari) harus berupa angka.')
      return
    }
    setBusy(true)
    try {
      await api.documentSave(toInput(form, projectId, editing === 'edit' && editId != null ? editId : undefined))
      await loadDocs(projectId, katFilter, debounced)
      await loadAlerts()
      cancel()
      setError(null)
      toast.push('Dokumen tersimpan.', 'ok')
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }

  const remove = async (d: Document) => {
    if (projectId == null) return
    if (!(await confirm({ title: 'Hapus Dokumen', message: `Hapus dokumen "${d.judul}"?`, confirmLabel: 'Hapus', danger: true }))) return
    setBusy(true)
    try {
      await api.documentRemove(d.id)
      await loadDocs(projectId, katFilter, debounced)
      await loadAlerts()
      if (editId === d.id) cancel()
      setError(null)
      toast.push('Dokumen dihapus.', 'ok')
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }

  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }))

  const counts = useMemo(() => {
    const m: Record<string, number> = {}
    for (const d of docs) m[d.kategori] = (m[d.kategori] ?? 0) + 1
    return m
  }, [docs])

  if (projects.length === 0) {
    return (
      <div className="module">
        <div className="module-head">
          <h1>Legal / Admin</h1>
        </div>
        <div className="empty">
        <div className="empty-title">Belum ada proyek</div>
        <p className="muted">Buat proyek dulu di modul Project.</p>
      </div>
      </div>
    )
  }

  return (
    <div className="module fill">
      <div className="module-head">
        <h1>Legal / Admin</h1>
        <div className="actions">
          <label className="field compact">
            <span>Proyek</span>
            <select
              value={projectId ?? ''}
              onChange={(e) => {
                setProjectId(Number(e.target.value))
                cancel()
              }}
              style={{ minWidth: 260 }}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.kode} — {p.nama}
                </option>
              ))}
            </select>
          </label>
          <button className="btn primary" onClick={startNew} disabled={busy}>
            <Icon name="plus" size={15} />
            Dokumen
          </button>
        </div>
      </div>

      <ErrorBox error={error} />

      {alerts.length > 0 && (
        <section className="panel">
          <h2>Peringatan Masa Berlaku (≤ {ALERT_DAYS} hari)</h2>
          <table className="tbl compact">
            <thead>
              <tr>
                <th>Kategori</th>
                <th>Dokumen</th>
                <th>Proyek</th>
                <th>Berlaku sampai</th>
                <th className="center">Sisa</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((d) => {
                const dleft = daysUntil(d.masa_berlaku_sampai)
                const cls = dleft != null && dleft < 0 ? 'danger' : dleft != null && dleft <= 7 ? 'warn' : ''
                return (
                  <tr key={d.id}>
                    <td>
                      <span className="badge">{KATEGORI_LABEL[d.kategori] ?? d.kategori}</span>
                    </td>
                    <td>
                      <span className="mono muted">{d.nomor ?? '—'}</span> {d.judul}
                    </td>
                    <td className="muted">{projectName(d.project_id)}</td>
                    <td className="mono">{d.masa_berlaku_sampai}</td>
                    <td className="center">
                      <span className={`badge ${cls}`}>
                        {dleft == null ? '—' : dleft < 0 ? `lewat ${Math.abs(dleft)} hr` : `${dleft} hr`}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>
      )}

      {editing !== 'none' && (
        <section className="panel">
          <h2>{editing === 'edit' ? 'Ubah Dokumen' : 'Dokumen Baru'}</h2>
          <div className="doc-form-grid">
            <label className="field">
              <span>Kategori</span>
              <select value={form.kategori} onChange={(e) => set({ kategori: e.target.value })}>
                {KATEGORI.filter((k) => k.v).map((k) => (
                  <option key={k.v} value={k.v}>
                    {k.label}
                  </option>
                ))}
              </select>
            </label>
            {form.kategori === 'surat' && (
              <label className="field">
                <span>Arah</span>
                <select value={form.arah} onChange={(e) => set({ arah: e.target.value })}>
                  {ARAH.map((a) => (
                    <option key={a.v} value={a.v}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="field">
              <span>Nomor</span>
              <input value={form.nomor} onChange={(e) => set({ nomor: e.target.value })} placeholder="Nomor dokumen" />
            </label>
            <label className="field">
              <span>Status</span>
              <select value={form.status} onChange={(e) => set({ status: e.target.value })}>
                {STATUS.map((s) => (
                  <option key={s.v} value={s.v}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field full">
              <span>Judul / Perihal *</span>
              <input value={form.judul} onChange={(e) => set({ judul: e.target.value })} placeholder="Perihal dokumen" />
            </label>
            <label className="field">
              <span>Tanggal</span>
              <input type="date" value={form.tanggal} onChange={(e) => set({ tanggal: e.target.value })} />
            </label>
            <label className="field">
              <span>Dari</span>
              <input value={form.dari} onChange={(e) => set({ dari: e.target.value })} placeholder="Pengirim" />
            </label>
            <label className="field">
              <span>Kepada</span>
              <input value={form.kepada} onChange={(e) => set({ kepada: e.target.value })} placeholder="Penerima" />
            </label>
            <label className="field">
              <span>{form.kategori === 'izin' ? 'Instansi Penerbit' : 'Instansi'}</span>
              <input value={form.instansi} onChange={(e) => set({ instansi: e.target.value })} placeholder="Instansi" />
            </label>
            <label className="field">
              <span>Masa berlaku dari</span>
              <input type="date" value={form.mbdari} onChange={(e) => set({ mbdari: e.target.value })} />
            </label>
            <label className="field">
              <span>Masa berlaku sampai</span>
              <input type="date" value={form.mbsampai} onChange={(e) => set({ mbsampai: e.target.value })} />
            </label>
            <label className="field">
              <span>Pengingat (hari)</span>
              <input
                type="text"
                inputMode="numeric"
                value={form.reminder}
                onChange={(e) => set({ reminder: e.target.value })}
                placeholder="30"
              />
            </label>
            <label className="field full">
              <span>Keterangan</span>
              <input value={form.keterangan} onChange={(e) => set({ keterangan: e.target.value })} placeholder="Catatan" />
            </label>
          </div>
          <div className="actions" style={{ marginTop: 12 }}>
            <button className="btn primary" onClick={save} disabled={busy}>
              Simpan
            </button>
            <button className="btn ghost" onClick={cancel} disabled={busy}>
              Batal
            </button>
          </div>
        </section>
      )}

      <section className="panel fill">
        <h2>Register Dokumen ({docs.length})</h2>
        <div className="chips">
          {KATEGORI.map((k) => (
            <button
              key={k.v || 'all'}
              className={`tab${katFilter === k.v ? ' active' : ''}`}
              onClick={() => setKatFilter(k.v)}
            >
              {k.label}
              {k.v && counts[k.v] ? ` (${counts[k.v]})` : ''}
            </button>
          ))}
        </div>
        <div className="inline-form" style={{ marginBottom: 12 }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nomor, judul, pihak, instansi..."
            style={{ flex: 1 }}
          />
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th>Kategori</th>
              <th>Nomor</th>
              <th>Judul / Perihal</th>
              <th>Tanggal</th>
              <th>Dari → Kepada</th>
              <th className="center">Status</th>
              <th>Masa Berlaku</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {docs.length === 0 && (
              <tr>
                <td colSpan={8} className="muted center">
                  Belum ada dokumen.
                </td>
              </tr>
            )}
            {docs.map((d) => {
              const dleft = daysUntil(d.masa_berlaku_sampai)
              const expCls = dleft == null ? '' : dleft < 0 ? 'danger' : dleft <= 7 ? 'warn' : ''
              return (
                <tr key={d.id} className={`rowlink${editId === d.id ? ' sel' : ''}`} onClick={() => startEdit(d)}>
                  <td>
                    <span className="badge">{KATEGORI_LABEL[d.kategori] ?? d.kategori}</span>
                    {d.kategori === 'surat' && d.arah && <span className="muted"> {d.arah}</span>}
                  </td>
                  <td className="mono">{d.nomor ?? '—'}</td>
                  <td>{d.judul}</td>
                  <td className="mono">{d.tanggal ?? '—'}</td>
                  <td className="muted">
                    {(d.dari_pihak ?? '—') + ' → ' + (d.kepada_pihak ?? '—')}
                  </td>
                  <td className="center">
                    <span className={`badge st-${d.status}`}>{STATUS_LABEL[d.status] ?? d.status}</span>
                  </td>
                  <td className="mono">
                    {d.masa_berlaku_sampai ? (
                      <>
                        {d.masa_berlaku_sampai}{' '}
                        {dleft != null && <span className={`badge ${expCls}`}>{dleft < 0 ? `lewat ${Math.abs(dleft)} hr` : `${dleft} hr`}</span>}
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="center">
                    <button className="btn tiny danger" onClick={(e) => { e.stopPropagation(); remove(d) }} disabled={busy}>
                      ×
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>
    </div>
  )
}
