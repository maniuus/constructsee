import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../lib/api'
import { ErrorBox, useConfirm } from '../components/ui'
import { parseNum } from '../lib/num'
import type { KatalogRow, MasterKatalog, Pekerjaan, RefDivisi } from '../../../shared/types'

const fmtNum = (n: number | null | undefined, dp = 2): string =>
  n == null ? '—' : new Intl.NumberFormat('id-ID', { maximumFractionDigits: dp }).format(n)

const numOrNull = (s: string): number | null => {
  const p = parseNum(s)
  return p.ok ? p.value : null
}
const badNum = (label: string, raw: string): string | null => {
  const p = parseNum(raw)
  return p.ok ? null : `${label}: ${p.message}`
}

type ColType = 'text' | 'number'

interface Col {
  key: string
  label: string
  type?: ColType
  align?: 'right'
  mono?: boolean
  placeholder?: string
  width?: number
}

interface EntityApi {
  list: () => Promise<any[]>
  save: (input: any) => Promise<unknown>
  remove: (id: number) => Promise<void>
}

const emptyForm = (cols: Col[]): Record<string, string> =>
  Object.fromEntries(cols.map((c) => [c.key, '']))

const rowToForm = (cols: Col[], row: Record<string, unknown>): Record<string, string> =>
  Object.fromEntries(cols.map((c) => [c.key, row[c.key] == null ? '' : String(row[c.key])]))

const buildInput = (cols: Col[], form: Record<string, string>, id: number | null): Record<string, unknown> => {
  const o: Record<string, unknown> = { id }
  for (const c of cols) {
    const raw = (form[c.key] ?? '').trim()
    o[c.key] = c.type === 'number' ? numOrNull(raw) : raw === '' ? null : raw
  }
  return o
}

const fmtCell = (c: Col, v: unknown): string =>
  v == null || v === '' ? '—' : c.type === 'number' ? fmtNum(Number(v), 2) : String(v)

function MasterTable({ title, subtitle, cols, api }: { title: string; subtitle?: string; cols: Col[]; api: EntityApi }) {
  const [rows, setRows] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<Record<string, string>>(() => emptyForm(cols))
  const confirm = useConfirm()

  const load = useCallback(async () => {
    try {
      setRows(await api.list())
      setError(null)
    } catch (e) {
      setError(String(e))
    }
  }, [api])

  useEffect(() => {
    load()
  }, [load])

  const startAdd = () => {
    setEditingId(null)
    setForm(emptyForm(cols))
  }

  const startEdit = (row: any) => {
    setEditingId(row.id as number)
    setForm(rowToForm(cols, row))
  }

  const cancel = () => {
    setEditingId(null)
    setForm(emptyForm(cols))
  }

  const save = async () => {
    if ((form.nama ?? '').trim() === '') {
      setError('Nama wajib diisi.')
      return
    }
    const bad = cols
      .filter((c) => c.type === 'number')
      .map((c) => badNum(c.label, form[c.key] ?? ''))
      .find((m) => m != null)
    if (bad) {
      setError(bad)
      return
    }
    setBusy(true)
    try {
      await api.save(buildInput(cols, form, editingId))
      cancel()
      await load()
      setError(null)
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }

  const remove = async (row: any) => {
    if (!(await confirm({ title: 'Hapus', message: `Hapus "${row.nama}"?`, confirmLabel: 'Hapus', danger: true }))) return
    setBusy(true)
    try {
      await api.remove(row.id as number)
      if (editingId === row.id) cancel()
      await load()
      setError(null)
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="panel fill">
      <h2>{title}</h2>
      {subtitle && <p className="muted">{subtitle}</p>}
      <ErrorBox error={error} />
      <div className="inline-form">
        {cols.map((c) => (
          <input
            key={c.key}
            type="text"
            inputMode={c.type === 'number' ? 'decimal' : undefined}
            placeholder={c.placeholder ?? c.label}
            value={form[c.key] ?? ''}
            onChange={(e) => setForm({ ...form, [c.key]: e.target.value })}
            style={{
              flex: c.type === 'number' ? '0 1 130px' : '1 1 170px',
              maxWidth: c.width
            }}
          />
        ))}
        <button className="btn primary" onClick={save} disabled={busy}>
          {editingId == null ? '+ Tambah' : 'Simpan'}
        </button>
        {editingId != null && (
          <button className="btn ghost" onClick={cancel} disabled={busy}>
            Batal
          </button>
        )}
        {editingId == null && (
          <button className="btn ghost" onClick={startAdd} disabled={busy}>
            Bersihkan
          </button>
        )}
      </div>
      <table className="tbl">
        <thead>
          <tr>
            {cols.map((c) => (
              <th key={c.key} className={c.align === 'right' ? 'right' : undefined}>
                {c.label}
              </th>
            ))}
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={cols.length + 1} className="muted center">
                Belum ada data.
              </td>
            </tr>
          )}
          {rows.map((row) => (
            <tr
              key={row.id as number}
              className={`rowlink${editingId === row.id ? ' sel' : ''}`}
              onClick={() => startEdit(row)}
            >
              {cols.map((c) => (
                <td
                  key={c.key}
                  className={`${c.align === 'right' ? 'right ' : ''}${c.mono || c.type === 'number' ? 'mono' : ''}`.trim() || undefined}
                >
                  {fmtCell(c, row[c.key])}
                </td>
              ))}
              <td className="right">
                <button
                  className="btn tiny danger"
                  onClick={(e) => {
                    e.stopPropagation()
                    remove(row)
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
  )
}

const JENIS_OPTS = ['tenaga_kerja', 'bahan', 'alat']
const JENIS_LABEL: Record<string, string> = {
  tenaga_kerja: 'Tenaga Kerja',
  bahan: 'Bahan',
  alat: 'Peralatan'
}

function KatalogTable() {
  const [rows, setRows] = useState<KatalogRow[]>([])
  const [q, setQ] = useState('')
  const [jenis, setJenis] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [edit, setEdit] = useState<Record<string, string>>({})
  const confirm = useConfirm()
  const [nf, setNf] = useState({ jenis: 'bahan', uraian: '', harga: '' })

  const load = useCallback(async () => {
    try {
      setRows(await api.katalogList(q, jenis || null))
      setError(null)
    } catch (e) {
      setError(String(e))
    }
  }, [q, jenis])

  useEffect(() => {
    const t = setTimeout(load, 200)
    return () => clearTimeout(t)
  }, [load])

  const keyOf = (jenis: string, uraian: string) => `${jenis}|${uraian}`

  const commit = async (r: KatalogRow) => {
    const k = keyOf(r.jenis, r.uraian)
    const s = edit[k]
    if (s == null) return
    const bad = badNum('Harga', s)
    if (bad) {
      setError(bad)
      setEdit({})
      return
    }
    setBusy(true)
    try {
      await api.katalogSave({
        jenis: r.jenis,
        uraian: r.uraian,
        harga: numOrNull(s)
      })
      setEdit({})
      await load()
      setError(null)
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }

  const add = async () => {
    if (nf.uraian.trim() === '') {
      setError('Uraian wajib diisi.')
      return
    }
    const bad = badNum('Harga', nf.harga)
    if (bad) {
      setError(bad)
      return
    }
    setBusy(true)
    try {
      await api.katalogSave({ jenis: nf.jenis, uraian: nf.uraian.trim(), harga: numOrNull(nf.harga) })
      setNf({ jenis: nf.jenis, uraian: '', harga: '' })
      await load()
      setError(null)
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }

  const remove = async (r: KatalogRow) => {
    if (!(await confirm({ title: 'Hapus Harga', message: `Hapus harga "${r.uraian}"?`, confirmLabel: 'Hapus', danger: true }))) return
    setBusy(true)
    try {
      await api.katalogRemove(r.jenis, r.uraian)
      await load()
      setError(null)
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="panel fill">
      <h2>Harga Katalog</h2>
      <p className="muted">
        Harga satuan komponen (tenaga kerja, bahan, peralatan) yang dipakai otomatis saat item AHSP
        ditambahkan ke RAB. Edit harga di sini untuk memperbarui semua item berikutnya.
      </p>
      <ErrorBox error={error} />
      <div className="inline-form">
        <select value={jenis} onChange={(e) => setJenis(e.target.value)} style={{ maxWidth: 180 }}>
          <option value="">Semua jenis</option>
          {JENIS_OPTS.map((j) => (
            <option key={j} value={j}>
              {JENIS_LABEL[j]}
            </option>
          ))}
        </select>
        <input
          placeholder="Cari uraian…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ flex: '2 1 260px' }}
        />
      </div>

      <div className="inline-form">
        <select value={nf.jenis} onChange={(e) => setNf({ ...nf, jenis: e.target.value })} style={{ maxWidth: 180 }}>
          {JENIS_OPTS.map((j) => (
            <option key={j} value={j}>
              {JENIS_LABEL[j]}
            </option>
          ))}
        </select>
        <input
          placeholder="Uraian komponen"
          value={nf.uraian}
          onChange={(e) => setNf({ ...nf, uraian: e.target.value })}
          style={{ flex: '2 1 260px' }}
        />
        <input
          type="text"
          inputMode="decimal"
          placeholder="Harga"
          value={nf.harga}
          onChange={(e) => setNf({ ...nf, harga: e.target.value })}
          style={{ maxWidth: 140 }}
        />
        <button className="btn primary" onClick={add} disabled={busy}>
          + Tambah
        </button>
      </div>

      <table className="tbl">
        <thead>
          <tr>
            <th>Jenis</th>
            <th>Uraian</th>
            <th className="right">Harga</th>
            <th className="right" style={{ width: 60 }} />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} className="muted center">
                Belum ada harga katalog.
              </td>
            </tr>
          )}
          {rows.map((r) => {
            const k = keyOf(r.jenis, r.uraian)
            return (
              <tr key={k}>
                <td>{JENIS_LABEL[r.jenis] ?? r.jenis}</td>
                <td>{r.uraian}</td>
                <td className="right">
                  <input
                    className="cell-input"
                    type="text"
                    inputMode="decimal"
                    value={edit[k] ?? (r.harga == null ? '' : String(r.harga))}
                    onChange={(e) => setEdit({ ...edit, [k]: e.target.value })}
                    onBlur={() => commit(r)}
                    disabled={busy}
                  />
                </td>
                <td className="right">
                  <button className="btn tiny danger" onClick={() => remove(r)} disabled={busy}>
                    ×
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}

const RES_JENIS = [
  { id: 'bahan', label: 'Bahan' },
  { id: 'alat', label: 'Alat' },
  { id: 'tenaga_kerja', label: 'Tenaga Kerja' }
]
const RES_LABEL: Record<string, string> = {
  bahan: 'Bahan',
  alat: 'Alat',
  tenaga_kerja: 'Tenaga Kerja'
}

interface ResForm {
  jenis: string
  kode: string
  nama: string
  satuan: string
  suplier: string
  brand: string
  harga_acuan: string
  catatan: string
}
const emptyRes = (): ResForm => ({
  jenis: 'bahan',
  kode: '',
  nama: '',
  satuan: '',
  suplier: '',
  brand: '',
  harga_acuan: '',
  catatan: ''
})
const resFromRow = (r: MasterKatalog): ResForm => ({
  jenis: r.jenis,
  kode: r.kode ?? '',
  nama: r.nama,
  satuan: r.satuan ?? '',
  suplier: r.suplier ?? '',
  brand: r.brand ?? '',
  harga_acuan: r.harga_acuan == null ? '' : String(r.harga_acuan),
  catatan: r.catatan ?? ''
})

function ResourceCatalog() {
  const [rows, setRows] = useState<MasterKatalog[]>([])
  const [jenis, setJenis] = useState('')
  const [q, setQ] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<ResForm>(emptyRes)
  const confirm = useConfirm()

  const load = useCallback(async () => {
    try {
      setRows(await api.masterKatalogList(jenis || null, q))
      setError(null)
    } catch (e) {
      setError(String(e))
    }
  }, [jenis, q])

  useEffect(() => {
    const t = setTimeout(load, 200)
    return () => clearTimeout(t)
  }, [load])

  const counts = useMemo(() => {
    const c: Record<string, number> = { bahan: 0, alat: 0, tenaga_kerja: 0 }
    for (const r of rows) c[r.jenis] = (c[r.jenis] ?? 0) + 1
    return c
  }, [rows])

  const cancel = () => {
    setEditingId(null)
    setForm(emptyRes())
  }

  const startEdit = (r: MasterKatalog) => {
    setEditingId(r.id)
    setForm(resFromRow(r))
  }

  const save = async () => {
    if (form.nama.trim() === '') {
      setError('Nama wajib diisi.')
      return
    }
    const bad = badNum('Harga Acuan', form.harga_acuan)
    if (bad) {
      setError(bad)
      return
    }
    setBusy(true)
    try {
      await api.masterKatalogSave({
        id: editingId,
        jenis: form.jenis,
        kode: form.kode.trim() || null,
        nama: form.nama.trim(),
        satuan: form.satuan.trim() || null,
        suplier: form.suplier.trim() || null,
        brand: form.brand.trim() || null,
        harga_acuan: numOrNull(form.harga_acuan),
        catatan: form.catatan.trim() || null
      })
      cancel()
      await load()
      setError(null)
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }

  const remove = async (r: MasterKatalog) => {
    if (!(await confirm({ title: 'Hapus Resource', message: `Hapus "${r.nama}" dari katalog?`, confirmLabel: 'Hapus', danger: true }))) return
    setBusy(true)
    try {
      await api.masterKatalogRemove(r.id)
      if (editingId === r.id) cancel()
      await load()
      setError(null)
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }

  const importAhsp = async () => {
    setBusy(true)
    try {
      const res = await api.masterKatalogImportAhsp()
      await load()
      setInfo(`Impor dari AHSP selesai: ${res.inserted} baru, ${res.skipped} dilewati (total ${res.total}).`)
      setError(null)
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="panel fill">
      <div className="panel-head">
        <h2>Katalog Resource</h2>
        <div className="actions">
          <span className="muted">Bahan {counts.bahan} · Alat {counts.alat} · Tenaga Kerja {counts.tenaga_kerja}</span>
          <button className="btn" onClick={importAhsp} disabled={busy}>
            Muat dari AHSP
          </button>
        </div>
      </div>
      <p className="muted">
        Katalog material/alat/tenaga kerja beserta suplier dan brand. Dipakai sebagai referensi harga
        pengadaan. Klik baris untuk mengubah.
      </p>
      <ErrorBox error={error} />
      {info && <p className="muted">{info}</p>}

      <div className="inline-form">
        <select value={jenis} onChange={(e) => setJenis(e.target.value)} style={{ maxWidth: 180 }}>
          <option value="">Semua jenis</option>
          {RES_JENIS.map((j) => (
            <option key={j.id} value={j.id}>
              {j.label}
            </option>
          ))}
        </select>
        <input
          placeholder="Cari nama / kode / suplier / brand…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ flex: '2 1 260px' }}
        />
      </div>

      <div className="doc-form-grid">
        <label className="field">
          <span>Jenis</span>
          <select value={form.jenis} onChange={(e) => setForm({ ...form, jenis: e.target.value })}>
            {RES_JENIS.map((j) => (
              <option key={j.id} value={j.id}>
                {j.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Kode</span>
          <input value={form.kode} onChange={(e) => setForm({ ...form, kode: e.target.value })} placeholder="Kode" />
        </label>
        <label className="field">
          <span>Nama</span>
          <input value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} placeholder="Nama item" />
        </label>
        <label className="field">
          <span>Satuan</span>
          <input value={form.satuan} onChange={(e) => setForm({ ...form, satuan: e.target.value })} placeholder="mis. kg, m3, OH" />
        </label>
        <label className="field">
          <span>Suplier</span>
          <input value={form.suplier} onChange={(e) => setForm({ ...form, suplier: e.target.value })} placeholder="Nama suplier" />
        </label>
        <label className="field">
          <span>Brand</span>
          <input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} placeholder="Merek / brand" />
        </label>
        <label className="field">
          <span>Harga Acuan</span>
          <input
            type="text"
            inputMode="decimal"
            value={form.harga_acuan}
            onChange={(e) => setForm({ ...form, harga_acuan: e.target.value })}
            placeholder="Harga acuan"
          />
        </label>
        <label className="field full">
          <span>Catatan</span>
          <input value={form.catatan} onChange={(e) => setForm({ ...form, catatan: e.target.value })} placeholder="Catatan" />
        </label>
      </div>
      <div className="inline-form">
        <button className="btn primary" onClick={save} disabled={busy}>
          {editingId == null ? '+ Tambah' : 'Simpan'}
        </button>
        {editingId != null && (
          <button className="btn ghost" onClick={cancel} disabled={busy}>
            Batal
          </button>
        )}
      </div>

      <table className="tbl compact">
        <thead>
          <tr>
            <th>Jenis</th>
            <th>Kode</th>
            <th>Nama</th>
            <th>Satuan</th>
            <th>Suplier</th>
            <th>Brand</th>
            <th className="right">Harga Acuan</th>
            <th className="right" style={{ width: 50 }} />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={8} className="muted center">
                Belum ada data. Klik &quot;Muat dari AHSP&quot; untuk memuat dari perpustakaan AHSP.
              </td>
            </tr>
          )}
          {rows.map((r) => (
            <tr key={r.id} className={`rowlink${editingId === r.id ? ' sel' : ''}`} onClick={() => startEdit(r)}>
              <td>{RES_LABEL[r.jenis] ?? r.jenis}</td>
              <td className="mono">{r.kode ?? '—'}</td>
              <td>{r.nama}</td>
              <td>{r.satuan ?? '—'}</td>
              <td>{r.suplier ?? '—'}</td>
              <td>{r.brand ?? '—'}</td>
              <td className="right mono">{fmtNum(r.harga_acuan, 2)}</td>
              <td className="right">
                <button
                  className="btn tiny danger"
                  onClick={(e) => {
                    e.stopPropagation()
                    remove(r)
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
  )
}

interface PekForm {
  divisi_no: string
  kode_ahsp: string
  nama: string
  satuan: string
  catatan: string
}

const emptyPek = (): PekForm => ({
  divisi_no: '',
  kode_ahsp: '',
  nama: '',
  satuan: '',
  catatan: ''
})

const pekFromRow = (r: Pekerjaan): PekForm => ({
  divisi_no: r.divisi_no ?? '',
  kode_ahsp: r.kode_ahsp ?? '',
  nama: r.nama,
  satuan: r.satuan ?? '',
  catatan: r.catatan ?? ''
})

function PekerjaanCatalog() {
  const [rows, setRows] = useState<Pekerjaan[]>([])
  const [divisi, setDivisi] = useState<RefDivisi[]>([])
  const [filterDiv, setFilterDiv] = useState('')
  const [q, setQ] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<PekForm>(emptyPek)
  const confirm = useConfirm()
  const seeded = useRef(false)

  const load = useCallback(async () => {
    try {
      setRows(await api.pekerjaanList(filterDiv || null, q))
      setError(null)
    } catch (e) {
      setError(String(e))
    }
  }, [filterDiv, q])

  useEffect(() => {
    if (!ready) return
    const t = setTimeout(load, 200)
    return () => clearTimeout(t)
  }, [load, ready])

  useEffect(() => {
    if (seeded.current) return
    seeded.current = true
    ;(async () => {
      try {
        let existing = await api.pekerjaanList(null, null)
        if (existing.length === 0) {
          const res = await api.pekerjaanImportAhsp()
          setInfo(`Impor dari AHSP selesai: ${res.inserted} baru, ${res.skipped} dilewati (total ${res.total}).`)
          existing = await api.pekerjaanList(null, null)
        }
        setRows(existing)
        setError(null)
      } catch (e) {
        setError(String(e))
      } finally {
        setReady(true)
      }
    })()
  }, [])

  useEffect(() => {
    api.refDivisi().then(setDivisi).catch(() => {})
  }, [])

  const divName = useMemo(() => {
    const m: Record<string, string> = {}
    for (const d of divisi) m[d.no] = d.nama
    return m
  }, [divisi])

  const groups = useMemo(() => {
    const m = new Map<string, Pekerjaan[]>()
    for (const r of rows) {
      const k = r.divisi_no ?? ''
      if (!m.has(k)) m.set(k, [])
      m.get(k)!.push(r)
    }
    const num = (s: string): number => {
      if (s === '') return 9999
      const n = Number(s)
      return Number.isFinite(n) ? n : 9998
    }
    return [...m.entries()].sort((a, b) => num(a[0]) - num(b[0]))
  }, [rows])

  const cancel = () => {
    setEditingId(null)
    setForm(emptyPek())
  }

  const startEdit = (r: Pekerjaan) => {
    setEditingId(r.id)
    setForm(pekFromRow(r))
  }

  const save = async () => {
    if (form.nama.trim() === '') {
      setError('Nama wajib diisi.')
      return
    }
    setBusy(true)
    try {
      await api.pekerjaanSave({
        id: editingId,
        nama: form.nama.trim(),
        satuan: form.satuan.trim() || null,
        kode_ahsp: form.kode_ahsp.trim() || null,
        divisi_no: form.divisi_no.trim() || null,
        catatan: form.catatan.trim() || null
      })
      cancel()
      await load()
      setError(null)
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }

  const remove = async (r: Pekerjaan) => {
    if (!(await confirm({ title: 'Hapus Pekerjaan', message: `Hapus pekerjaan "${r.nama}"?`, confirmLabel: 'Hapus', danger: true }))) return
    setBusy(true)
    try {
      await api.pekerjaanRemove(r.id)
      if (editingId === r.id) cancel()
      await load()
      setError(null)
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }

  const importAhsp = async () => {
    setBusy(true)
    try {
      const res = await api.pekerjaanImportAhsp()
      await load()
      setInfo(`Impor dari AHSP selesai: ${res.inserted} baru, ${res.skipped} dilewati (total ${res.total}).`)
      setError(null)
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }

  const pricedCount = useMemo(() => rows.reduce((n, r) => n + (r.harga_acuan != null ? 1 : 0), 0), [rows])

  return (
    <section className="panel fill">
      <div className="panel-head">
        <h2>Pekerjaan (AHSP)</h2>
        <div className="actions">
          <span className="muted">
            Total {rows.length} pekerjaan · {pricedCount} berharga
          </span>
          <button className="btn" onClick={importAhsp} disabled={busy}>
            Muat dari AHSP
          </button>
        </div>
      </div>
      <p className="muted">
        Daftar pekerjaan dari perpustakaan AHSP, dikelompokkan per divisi. Harga dihitung otomatis
        dari Σ (koefisien × harga komponen) memakai harga pada tab <strong>Katalog Resource</strong> —
        tampil &quot;—&quot; selama komponennya belum punya harga. Klik baris untuk mengubah.
      </p>
      <ErrorBox error={error} />
      {info && <p className="muted">{info}</p>}

      <div className="inline-form">
        <select value={filterDiv} onChange={(e) => setFilterDiv(e.target.value)} style={{ maxWidth: 280 }}>
          <option value="">Semua divisi</option>
          {divisi.map((d) => (
            <option key={d.id} value={d.no}>
              Divisi {d.no} · {d.nama}
            </option>
          ))}
        </select>
        <input
          placeholder="Cari nama / kode AHSP…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ flex: '2 1 260px' }}
        />
      </div>

      <div className="doc-form-grid">
        <label className="field">
          <span>Divisi</span>
          <select value={form.divisi_no} onChange={(e) => setForm({ ...form, divisi_no: e.target.value })}>
            <option value="">Tanpa divisi</option>
            {divisi.map((d) => (
              <option key={d.id} value={d.no}>
                Divisi {d.no} · {d.nama}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Kode AHSP</span>
          <input
            value={form.kode_ahsp}
            onChange={(e) => setForm({ ...form, kode_ahsp: e.target.value })}
            placeholder="mis. 1.1.1.1"
          />
        </label>
        <label className="field">
          <span>Nama Pekerjaan</span>
          <input value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} placeholder="Nama pekerjaan" />
        </label>
        <label className="field">
          <span>Satuan</span>
          <input value={form.satuan} onChange={(e) => setForm({ ...form, satuan: e.target.value })} placeholder="mis. m3, m2, unit" />
        </label>
        <label className="field full">
          <span>Catatan</span>
          <input value={form.catatan} onChange={(e) => setForm({ ...form, catatan: e.target.value })} placeholder="Catatan" />
        </label>
      </div>
      <div className="inline-form">
        <button className="btn primary" onClick={save} disabled={busy}>
          {editingId == null ? '+ Tambah' : 'Simpan'}
        </button>
        {editingId != null && (
          <button className="btn ghost" onClick={cancel} disabled={busy}>
            Batal
          </button>
        )}
      </div>

      <table className="tbl compact">
        <thead>
          <tr>
            <th style={{ width: 150 }}>Kode AHSP</th>
            <th>Nama Pekerjaan</th>
            <th style={{ width: 90 }}>Satuan</th>
            <th className="right" style={{ width: 130 }}>
              Harga (Komponen)
            </th>
            <th className="right" style={{ width: 50 }} />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="muted center">
                Belum ada data. Klik &quot;Muat dari AHSP&quot; untuk memuat dari perpustakaan AHSP.
              </td>
            </tr>
          )}
          {groups.map(([div, list]) => (
            <Fragment key={div || 'none'}>
              <tr className="divider">
                <td colSpan={5}>{div ? `DIVISI ${div} · ${divName[div] ?? ''}` : 'TANPA DIVISI'}</td>
              </tr>
              {list.map((r) => (
                <tr key={r.id} className={`rowlink${editingId === r.id ? ' sel' : ''}`} onClick={() => startEdit(r)}>
                  <td className="mono">{r.kode_ahsp ?? '—'}</td>
                  <td>{r.nama}</td>
                  <td>{r.satuan ?? '—'}</td>
                  <td className="right mono">{fmtNum(r.harga_acuan, 2)}</td>
                  <td className="right">
                    <button
                      className="btn tiny danger"
                      onClick={(e) => {
                        e.stopPropagation()
                        remove(r)
                      }}
                      disabled={busy}
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </section>
  )
}

const SUBKON_COLS: Col[] = [
  { key: 'nama', label: 'Nama', placeholder: 'Nama subkontraktor' },
  { key: 'kualifikasi', label: 'Kualifikasi', placeholder: 'Kualifikasi' },
  { key: 'spesialisasi', label: 'Spesialisasi', placeholder: 'Spesialisasi' },
  { key: 'telepon', label: 'Telepon', placeholder: 'Telepon' },
  { key: 'npwp', label: 'NPWP', mono: true, placeholder: 'NPWP' },
  { key: 'rating', label: 'Rating', type: 'number', align: 'right' }
]

type Tab = 'resource' | 'katalog' | 'subkon' | 'pekerjaan'

const TABS: { id: Tab; label: string }[] = [
  { id: 'resource', label: 'Katalog Resource' },
  { id: 'katalog', label: 'Harga Katalog' },
  { id: 'subkon', label: 'Subkontraktor' },
  { id: 'pekerjaan', label: 'Pekerjaan' }
]

export default function MasterModule() {
  const [tab, setTab] = useState<Tab>('resource')

  return (
    <div className="module fill">
      <div className="module-head">
        <h1>Master Data</h1>
        <span className="muted">Referensi data yang dipakai modul lain</span>
      </div>
      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={`tab${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'resource' && <ResourceCatalog />}
      {tab === 'katalog' && <KatalogTable />}
      {tab === 'subkon' && (
        <MasterTable
          title="Subkontraktor"
          subtitle="Daftar subkontraktor / vendor."
          cols={SUBKON_COLS}
          api={{ list: api.subkonList, save: api.subkonSave, remove: api.subkonRemove }}
        />
      )}
      {tab === 'pekerjaan' && <PekerjaanCatalog />}
    </div>
  )
}
