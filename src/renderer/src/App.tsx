import { useCallback, useEffect, useState } from 'react'
import { api } from './lib/api'
import { Icon, type IconName } from './components/Icons'
import {
  CommandPalette,
  ConfirmProvider,
  ErrorBox,
  ToastProvider,
  useConfirm,
  useToast,
  type Command
} from './components/ui'
import { parseNum, toInputNum } from './lib/num'
import { setSaved, setSaving, useStatus } from './lib/status'
import MasterModule from './modules/MasterModule'
import LegalModule from './modules/LegalModule'
import ProgressModule from './modules/ProgressModule'
import RabModule from './modules/RabModule'
import ReportModule from './modules/ReportModule'
import DashboardModule from './modules/DashboardModule'
import type {
  ContractTimeline,
  OrgInput,
  Project,
  ProjectDetail,
  ProjectInput,
  TimelineInput
} from '../../shared/types'

const IN_TAURI = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

const fmtRp = (n: number | null | undefined): string =>
  n == null ? '—' : new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)

const STATUSES = ['perencanaan', 'berlangsung', 'selesai', 'bermasalah']
const JENIS = ['', 'gedung', 'sipil', 'jalan', 'MEP', 'EPC']

interface ModuleDef {
  id: string
  label: string
  hint: string
  icon: IconName
  ready: boolean
}

const MODULES: ModuleDef[] = [
  { id: 'project', label: 'Project', hint: 'Proyek & kontrak', icon: 'project', ready: true },
  { id: 'rab', label: 'RAB', hint: 'Rincian anggaran', icon: 'rab', ready: true },
  { id: 'progress', label: 'Progress', hint: 'Realisasi lapangan', icon: 'progress', ready: true },
  { id: 'master', label: 'Master Data', hint: 'AHSP, harga, personel', icon: 'master', ready: true },
  { id: 'legal', label: 'Legal / Admin', hint: 'Dokumen & izin', icon: 'legal', ready: true },
  { id: 'report', label: 'Report', hint: 'Laporan & ekspor', icon: 'report', ready: true },
  { id: 'dashboard', label: 'Dashboard', hint: 'Ringkasan portofolio', icon: 'dashboard', ready: true }
]

const MODULE_GROUPS: { label: string; ids: string[] }[] = [
  { label: 'Operasional', ids: ['project', 'rab', 'progress'] },
  { label: 'Data', ids: ['master', 'legal'] },
  { label: 'Insight', ids: ['report', 'dashboard'] }
]

type ProjectForm = {
  kode: string
  nama: string
  klien: string
  konsultan: string
  nilai_kontrak: string
  jenis: string
  lokasi_prov: string
  lokasi_kab: string
  lokasi_alamat: string
  status: string
  tanggal_mulai: string
  tanggal_selesai: string
  masa_pemeliharaan: string
  keterangan: string
}

const emptyProjectForm = (): ProjectForm => ({
  kode: '',
  nama: '',
  klien: '',
  konsultan: '',
  nilai_kontrak: '',
  jenis: '',
  lokasi_prov: '',
  lokasi_kab: '',
  lokasi_alamat: '',
  status: 'perencanaan',
  tanggal_mulai: '',
  tanggal_selesai: '',
  masa_pemeliharaan: '',
  keterangan: ''
})

const formFromProject = (p: Project): ProjectForm => ({
  kode: p.kode,
  nama: p.nama,
  klien: p.klien ?? '',
  konsultan: p.konsultan ?? '',
  nilai_kontrak: toInputNum(p.nilai_kontrak),
  jenis: p.jenis ?? '',
  lokasi_prov: p.lokasi_prov ?? '',
  lokasi_kab: p.lokasi_kab ?? '',
  lokasi_alamat: p.lokasi_alamat ?? '',
  status: p.status || 'perencanaan',
  tanggal_mulai: p.tanggal_mulai ?? '',
  tanggal_selesai: p.tanggal_selesai ?? '',
  masa_pemeliharaan: toInputNum(p.masa_pemeliharaan),
  keterangan: p.keterangan ?? ''
})

const nn = (s: string): string | null => (s.trim() === '' ? null : s.trim())
const numOrNull = (s: string): number | null => {
  const p = parseNum(s)
  return p.ok ? p.value : null
}
/** Pesan error bila kolom angka tidak valid, atau null bila aman. */
const badNum = (label: string, raw: string): string | null => {
  const p = parseNum(raw)
  return p.ok ? null : `${label}: ${p.message}`
}

const toInput = (f: ProjectForm): ProjectInput => ({
  kode: f.kode.trim(),
  nama: f.nama.trim(),
  klien: nn(f.klien),
  konsultan: nn(f.konsultan),
  nilai_kontrak: numOrNull(f.nilai_kontrak),
  jenis: nn(f.jenis),
  lokasi_prov: nn(f.lokasi_prov),
  lokasi_kab: nn(f.lokasi_kab),
  lokasi_alamat: nn(f.lokasi_alamat),
  status: f.status,
  tanggal_mulai: nn(f.tanggal_mulai),
  tanggal_selesai: nn(f.tanggal_selesai),
  masa_pemeliharaan: numOrNull(f.masa_pemeliharaan),
  keterangan: nn(f.keterangan)
})

type TimelineForm = {
  tgl_kontrak: string
  tgl_spmk: string
  tgl_mulai_kerja: string
  tgl_selesai_rencana: string
  tgl_pho: string
  tgl_fho: string
  perpanjangan_hari: string
  masa_pemeliharaan_selesai: string
  catatan: string
}

const emptyTimelineForm = (): TimelineForm => ({
  tgl_kontrak: '',
  tgl_spmk: '',
  tgl_mulai_kerja: '',
  tgl_selesai_rencana: '',
  tgl_pho: '',
  tgl_fho: '',
  perpanjangan_hari: '',
  masa_pemeliharaan_selesai: '',
  catatan: ''
})

const timelineToForm = (t: ContractTimeline | null): TimelineForm =>
  t == null
    ? emptyTimelineForm()
    : {
        tgl_kontrak: t.tgl_kontrak ?? '',
        tgl_spmk: t.tgl_spmk ?? '',
        tgl_mulai_kerja: t.tgl_mulai_kerja ?? '',
        tgl_selesai_rencana: t.tgl_selesai_rencana ?? '',
        tgl_pho: t.tgl_pho ?? '',
        tgl_fho: t.tgl_fho ?? '',
        perpanjangan_hari: toInputNum(t.perpanjangan_hari),
        masa_pemeliharaan_selesai: t.masa_pemeliharaan_selesai ?? '',
        catatan: t.catatan ?? ''
      }

const toTimelineInput = (f: TimelineForm): TimelineInput => ({
  tgl_kontrak: nn(f.tgl_kontrak),
  tgl_spmk: nn(f.tgl_spmk),
  tgl_mulai_kerja: nn(f.tgl_mulai_kerja),
  tgl_selesai_rencana: nn(f.tgl_selesai_rencana),
  tgl_pho: nn(f.tgl_pho),
  tgl_fho: nn(f.tgl_fho),
  perpanjangan_hari: numOrNull(f.perpanjangan_hari),
  masa_pemeliharaan_selesai: nn(f.masa_pemeliharaan_selesai),
  catatan: nn(f.catatan)
})

export default function App() {
  const [module, setModule] = useState('project')
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [clock, setClock] = useState(() => new Date())
  const [newProjectSignal, setNewProjectSignal] = useState(0)
  const status = useStatus()

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!IN_TAURI) {
    return (
      <div className="app">
        <header className="appbar">
          <span className="brand">
            <span className="mark" />
            CONSTRUCTSEE
          </span>
        </header>
        <div className="notice">
          <h2>Buka lewat jendela desktop</h2>
          <p>
            Halaman ini dibuka di browser. Jalankan <code>npm run dev</code> lalu gunakan jendela
            desktop <b>Constructsee</b> — data hanya tersedia lewat aplikasi desktop (Tauri).
          </p>
        </div>
      </div>
    )
  }

  const current = MODULES.find((m) => m.id === module)

  const commands: Command[] = [
    ...MODULES.map((m) => ({
      id: `go-${m.id}`,
      label: `Buka ${m.label}`,
      group: 'Navigasi',
      icon: m.icon,
      run: () => setModule(m.id)
    })),
    {
      id: 'new-project',
      label: 'Proyek Baru',
      group: 'Aksi',
      icon: 'plus',
      run: () => {
        setModule('project')
        setNewProjectSignal((n) => n + 1)
      }
    }
  ]

  return (
    <ToastProvider>
      <ConfirmProvider>
        <div className="app">
          <header className="appbar">
            <span className="brand">
              <span className="mark" />
              CONSTRUCTSEE
            </span>
            <span className="tagline">ERP Konstruksi</span>
            <span className="appbar-spacer" />
            <button className="appbar-search" onClick={() => setPaletteOpen(true)}>
              <Icon name="search" size={14} />
              <span className="grow">Cari perintah…</span>
              <span className="kbd">Ctrl K</span>
            </button>
          </header>
          <div className="shell">
            <nav className="sidenav">
              {MODULE_GROUPS.map((g) => (
                <div key={g.label}>
                  <div className="navgroup-label">{g.label}</div>
                  {g.ids.map((id) => {
                    const m = MODULES.find((x) => x.id === id)!
                    return (
                      <button
                        key={m.id}
                        className={`navbtn${module === m.id ? ' active' : ''}`}
                        disabled={!m.ready}
                        onClick={() => m.ready && setModule(m.id)}
                        title={m.ready ? m.label : 'Belum tersedia'}
                      >
                        <span className="ico">
                          <Icon name={m.icon} />
                        </span>
                        <span className="navlabel grow">
                          <span className="navtext">{m.label}</span>
                          <span className="navhint">{m.hint}</span>
                        </span>
                        {!m.ready && <span className="soon">soon</span>}
                      </button>
                    )
                  })}
                </div>
              ))}
            </nav>
            <main className="content">
              <div className="breadcrumb">
                <span>Constructsee</span>
                <span className="sep">/</span>
                <span className="cur">{current?.label ?? ''}</span>
              </div>
              {module === 'project' ? (
                <ProjectModule openNewSignal={newProjectSignal} />
              ) : module === 'rab' ? (
                <RabModule />
              ) : module === 'master' ? (
                <MasterModule />
              ) : module === 'progress' ? (
                <ProgressModule />
              ) : module === 'legal' ? (
                <LegalModule />
              ) : module === 'report' ? (
                <ReportModule />
              ) : module === 'dashboard' ? (
                <DashboardModule />
              ) : (
                <p className="muted">Modul belum tersedia.</p>
              )}
            </main>
          </div>
          <footer className="statusbar">
            <span className="seg">
              <span className={`dot${status.tone === 'busy' ? ' busy' : status.tone === 'ok' ? ' ok' : ''}`} />
              {status.text}
            </span>
            <span className="seg">
              <strong>{current?.label ?? ''}</strong>
            </span>
            <span className="sp" />
            <span className="seg">Lokal · SQLite</span>
            <span className="seg">{clock.toLocaleTimeString('id-ID', { hour12: false })}</span>
          </footer>
        </div>
        <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} commands={commands} />
      </ConfirmProvider>
    </ToastProvider>
  )
}

function ProjectModule({ openNewSignal }: { openNewSignal: number }) {
  const toast = useToast()
  const confirm = useConfirm()

  const [projects, setProjects] = useState<Project[]>([])
  const [selId, setSelId] = useState<number | null>(null)
  const [detail, setDetail] = useState<ProjectDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  const [editing, setEditing] = useState<'none' | 'new' | 'edit'>('none')
  const [form, setForm] = useState<ProjectForm>(emptyProjectForm())

  const [tl, setTl] = useState<TimelineForm>(emptyTimelineForm())
  const [orgForm, setOrgForm] = useState({ nama: '', jabatan: '', institusi: '', telepon: '', email: '' })

  // Palet perintah "Proyek Baru" → langsung buka form (bukan hanya pindah modul).
  useEffect(() => {
    if (openNewSignal === 0) return
    setForm(emptyProjectForm())
    setEditing('new')
    setDetail(null)
    setSelId(null)
    setError(null)
  }, [openNewSignal])

  const refresh = useCallback(async () => {
    try {
      setProjects(await api.projectList())
      setError(null)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const openProject = useCallback(async (id: number) => {
    try {
      const d = await api.projectGet(id)
      setDetail(d)
      setTl(timelineToForm(d.timeline))
      setSelId(id)
      setEditing('none')
      setError(null)
    } catch (e) {
      setError(String(e))
    }
  }, [])

  // Cegah kehilangan isian saat pindah proyek ketika form masih terbuka.
  const selectProject = async (id: number) => {
    if (editing !== 'none') {
      const ok = await confirm({
        title: 'Buang Perubahan?',
        message: 'Form masih terbuka dan ada isian yang belum disimpan. Pilih proyek lain dan buang perubahan?',
        confirmLabel: 'Buang & Lanjut',
        danger: true
      })
      if (!ok) return
    }
    await openProject(id)
  }

  const startNew = () => {
    setForm(emptyProjectForm())
    setEditing('new')
    setDetail(null)
    setSelId(null)
  }

  const startEdit = () => {
    if (!detail) return
    setForm(formFromProject(detail.project))
    setEditing('edit')
  }

  const closeDrawer = () => {
    setEditing('none')
    setSelId(null)
    setDetail(null)
  }

  useEffect(() => {
    if (editing === 'none') return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDrawer()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editing])

  const tlDirty = detail != null && JSON.stringify(tl) !== JSON.stringify(timelineToForm(detail.timeline))

  const saveForm = async () => {
    if (form.kode.trim() === '' || form.nama.trim() === '') {
      setError('Kode dan Nama proyek wajib diisi.')
      return
    }
    const bad =
      badNum('Nilai Kontrak', form.nilai_kontrak) ?? badNum('Masa Pemeliharaan', form.masa_pemeliharaan)
    if (bad) {
      setError(bad)
      toast.push(bad, 'err')
      return
    }
    setBusy(true)
    setSaving()
    try {
      if (editing === 'new') {
        const p = await api.projectCreate(toInput(form))
        await refresh()
        await openProject(p.id)
      } else if (editing === 'edit' && selId != null) {
        await api.projectUpdate(selId, toInput(form))
        await refresh()
        await openProject(selId)
      }
      setEditing('none')
      setError(null)
      setSaved('Proyek disimpan')
      toast.push('Proyek disimpan.', 'ok')
    } catch (e) {
      setError(String(e))
      toast.push('Gagal menyimpan proyek.', 'err')
    } finally {
      setBusy(false)
    }
  }

  const removeProject = async (p: Project) => {
    const ok = await confirm({
      title: 'Hapus Proyek',
      message: `Hapus proyek "${p.nama}"? Semua data terkait (RAB, item, take-off, progress, dokumen) ikut terhapus. Kamu bisa membatalkan lewat tombol Undo selama 20 detik.`,
      confirmLabel: 'Hapus',
      danger: true
    })
    if (!ok) return
    setBusy(true)
    try {
      const snap = await api.projectSnapshot(p.id)
      await api.projectRemove(p.id)
      if (selId === p.id) closeDrawer()
      await refresh()
      setError(null)
      toast.push(
        'Proyek dihapus.',
        'ok',
        {
          label: 'Undo',
          run: async () => {
            try {
              const id = await api.projectRestore(snap)
              await refresh()
              await openProject(id)
              toast.push('Proyek dipulihkan.', 'ok')
            } catch (e) {
              setError(String(e))
              toast.push('Gagal memulihkan proyek.', 'err')
            }
          }
        },
        20000
      )
    } catch (e) {
      setError(String(e))
      toast.push('Gagal menghapus proyek.', 'err')
    } finally {
      setBusy(false)
    }
  }

  const saveTimeline = async () => {
    if (selId == null) return
    const bad = badNum('Perpanjangan (hari)', tl.perpanjangan_hari)
    if (bad) {
      setError(bad)
      toast.push(bad, 'err')
      return
    }
    setBusy(true)
    setSaving()
    try {
      await api.timelineSave(selId, toTimelineInput(tl))
      await openProject(selId)
      setError(null)
      setSaved('Timeline disimpan')
      toast.push('Timeline tersimpan.', 'ok')
    } catch (e) {
      setError(String(e))
      toast.push('Gagal menyimpan timeline.', 'err')
    } finally {
      setBusy(false)
    }
  }

  const addOrg = async () => {
    if (selId == null || orgForm.nama.trim() === '') return
    const input: OrgInput = {
      nama: orgForm.nama.trim(),
      jabatan: nn(orgForm.jabatan),
      institusi: nn(orgForm.institusi),
      telepon: nn(orgForm.telepon),
      email: nn(orgForm.email)
    }
    setBusy(true)
    try {
      await api.orgAdd(selId, input)
      setOrgForm({ nama: '', jabatan: '', institusi: '', telepon: '', email: '' })
      await openProject(selId)
      setError(null)
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }

  const removeOrg = async (id: number) => {
    if (selId == null) return
    setBusy(true)
    try {
      await api.orgRemove(id)
      await openProject(selId)
      setError(null)
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }

  const [q, setQ] = useState('')
  const filtered = projects.filter((p) => {
    const s = q.trim().toLowerCase()
    if (!s) return true
    return [p.kode, p.nama, p.klien, p.jenis].some((v) => (v ?? '').toLowerCase().includes(s))
  })

  return (
    <div className="module fill">
      <div className="module-head">
        <div>
          <h1>Project</h1>
          <span className="sub">
            {projects.length} proyek terdaftar
            {projects.some((p) => p.status === 'berlangsung') &&
              ` · ${projects.filter((p) => p.status === 'berlangsung').length} berlangsung`}
          </span>
        </div>
        <div className="actions">
          <button className="btn primary" onClick={startNew}>
            <Icon name="plus" size={14} /> Proyek Baru
          </button>
        </div>
      </div>

      <div className="toolbar">
        <span className="search-input">
          <span className="ico">
            <Icon name="search" size={14} />
          </span>
          <input placeholder="Cari proyek…" value={q} onChange={(e) => setQ(e.target.value)} />
        </span>
        <span className="grow" />
        <span className="muted mono">
          {filtered.length} / {projects.length}
        </span>
      </div>

      <ErrorBox error={error} />
      <div className="split">
        <section className="panel fill">
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Kode</th>
                <th>Nama</th>
                <th>Klien</th>
                <th>Jenis</th>
                <th className="right">Nilai Kontrak</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loading &&
                [0, 1, 2].map((i) => (
                  <tr key={`sk-${i}`}>
                    <td colSpan={7}>
                      <div className="skeleton rows" />
                    </td>
                  </tr>
                ))}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="center">
                    <div className="empty">
                      <div className="empty-title">
                        {q.trim() ? 'Tidak ada yang cocok' : 'Belum ada proyek'}
                      </div>
                      <p className="muted">
                        {q.trim()
                          ? `Tidak ada proyek yang memuat “${q.trim()}”.`
                          : 'Buat proyek pertama untuk mulai menyusun RAB dan progres.'}
                      </p>
                      {q.trim() ? (
                        <button className="btn tiny" onClick={() => setQ('')}>
                          Bersihkan pencarian
                        </button>
                      ) : (
                        <button className="btn primary" onClick={startNew}>
                          <Icon name="plus" size={14} /> Proyek Baru
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
              {filtered.map((p) => (
                <tr
                  key={p.id}
                  className={`rowlink${selId === p.id ? ' sel' : ''}`}
                  tabIndex={0}
                  onClick={() => selectProject(p.id)}
                  onKeyDown={(e) => {
                    if (e.target !== e.currentTarget) return
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      selectProject(p.id)
                    }
                  }}
                >
                  <td className="mono">{p.kode}</td>
                  <td>{p.nama}</td>
                  <td>{p.klien ?? '—'}</td>
                  <td>{p.jenis ?? '—'}</td>
                  <td className="num">{fmtRp(p.nilai_kontrak)}</td>
                  <td>
                    <span className={`badge st-${p.status}`}>{p.status}</span>
                  </td>
                  <td className="right">
                    <span className="row-actions">
                      <button
                        className="icon-btn danger"
                        title={`Hapus proyek ${p.nama}`}
                        aria-label={`Hapus proyek ${p.nama}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          removeProject(p)
                        }}
                        disabled={busy}
                      >
                        <Icon name="trash" size={15} />
                      </button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

        <div className="pane-detail">
          {editing !== 'none' ? (
            <>
              <div className="panel-head">
                <h2>{editing === 'new' ? 'Proyek Baru' : 'Edit Proyek'}</h2>
                <div className="actions">
                  <button className="btn ghost" onClick={closeDrawer} disabled={busy}>
                    Batal
                  </button>
                  <button className="btn primary" onClick={saveForm} disabled={busy}>
                    {busy ? 'Menyimpan…' : 'Simpan'}
                  </button>
                </div>
              </div>
              <form className="grid2" onSubmit={(e) => e.preventDefault()}>
                <div className="form-section">Identitas</div>
                <Field label="Kode *" value={form.kode} autoFocus={editing === 'new'} onChange={(v) => setForm({ ...form, kode: v })} />
                <Field label="Nama Proyek *" value={form.nama} onChange={(v) => setForm({ ...form, nama: v })} />
                <Field label="Klien / Owner" value={form.klien} onChange={(v) => setForm({ ...form, klien: v })} />
                <Field label="Konsultan Pengawas" value={form.konsultan} onChange={(v) => setForm({ ...form, konsultan: v })} />

                <div className="form-section">Kontrak &amp; Status</div>
                <Field label="Nilai Kontrak (Rp)" inputMode="decimal" value={form.nilai_kontrak} onChange={(v) => setForm({ ...form, nilai_kontrak: v })} />
                <Select label="Jenis Pekerjaan" value={form.jenis} options={JENIS} onChange={(v) => setForm({ ...form, jenis: v })} />
                <Select label="Status" value={form.status} options={STATUSES} onChange={(v) => setForm({ ...form, status: v })} />
                <Field label="Masa Pemeliharaan (bulan)" inputMode="decimal" value={form.masa_pemeliharaan} onChange={(v) => setForm({ ...form, masa_pemeliharaan: v })} />

                <div className="form-section">Lokasi &amp; Jadwal</div>
                <Field label="Lokasi — Provinsi" value={form.lokasi_prov} onChange={(v) => setForm({ ...form, lokasi_prov: v })} />
                <Field label="Lokasi — Kab/Kota" value={form.lokasi_kab} onChange={(v) => setForm({ ...form, lokasi_kab: v })} />
                <Field label="Tanggal Mulai" type="date" value={form.tanggal_mulai} onChange={(v) => setForm({ ...form, tanggal_mulai: v })} />
                <Field label="Tanggal Selesai" type="date" value={form.tanggal_selesai} onChange={(v) => setForm({ ...form, tanggal_selesai: v })} />
                <Field label="Alamat Lokasi" value={form.lokasi_alamat} onChange={(v) => setForm({ ...form, lokasi_alamat: v })} full />

                <div className="form-section">Catatan</div>
                <Field label="Keterangan" value={form.keterangan} onChange={(v) => setForm({ ...form, keterangan: v })} full />
              </form>
            </>
          ) : detail ? (
            <>
              <div className="panel-head">
                <h2>{detail.project.nama}</h2>
                <div className="actions">
                  <span className={`badge st-${detail.project.status}`}>{detail.project.status}</span>
                  <button className="btn" onClick={startEdit}>
                    <Icon name="edit" size={14} /> Edit
                  </button>
                </div>
              </div>
            <section className="panel">
              <h2>Profil Proyek</h2>
              <dl className="facts">
                <Fact k="Klien / Owner" v={detail.project.klien} />
                <Fact k="Konsultan Pengawas" v={detail.project.konsultan} />
                <Fact k="Nilai Kontrak" v={fmtRp(detail.project.nilai_kontrak)} />
                <Fact k="Jenis" v={detail.project.jenis} />
                <Fact
                  k="Lokasi"
                  v={[detail.project.lokasi_alamat, detail.project.lokasi_kab, detail.project.lokasi_prov]
                    .filter(Boolean)
                    .join(', ')}
                />
                <Fact k="Tanggal Mulai" v={detail.project.tanggal_mulai} />
                <Fact k="Tanggal Selesai" v={detail.project.tanggal_selesai} />
                <Fact
                  k="Masa Pemeliharaan"
                  v={detail.project.masa_pemeliharaan == null ? null : `${detail.project.masa_pemeliharaan} bulan`}
                />
                <Fact k="Keterangan" v={detail.project.keterangan} />
              </dl>
            </section>

            <section className="panel">
              <div className="panel-head">
                <h2>Timeline Kontrak</h2>
                <div className="actions">
                  <span className={`panel-sub${tlDirty ? '' : ' ok'}`}>
                    {tlDirty ? 'Belum disimpan' : 'Tersimpan'}
                  </span>
                  <button className="btn primary" onClick={saveTimeline} disabled={busy || !tlDirty}>
                    {busy ? 'Menyimpan…' : 'Simpan Timeline'}
                  </button>
                </div>
              </div>
              <div className="grid2">
                <Field label="Tgl Kontrak" type="date" value={tl.tgl_kontrak} onChange={(v) => setTl({ ...tl, tgl_kontrak: v })} />
                <Field label="Tgl SPMK" type="date" value={tl.tgl_spmk} onChange={(v) => setTl({ ...tl, tgl_spmk: v })} />
                <Field label="Tgl Mulai Kerja" type="date" value={tl.tgl_mulai_kerja} onChange={(v) => setTl({ ...tl, tgl_mulai_kerja: v })} />
                <Field label="Tgl Selesai Rencana" type="date" value={tl.tgl_selesai_rencana} onChange={(v) => setTl({ ...tl, tgl_selesai_rencana: v })} />
                <Field label="Tgl PHO" type="date" value={tl.tgl_pho} onChange={(v) => setTl({ ...tl, tgl_pho: v })} />
                <Field label="Tgl FHO" type="date" value={tl.tgl_fho} onChange={(v) => setTl({ ...tl, tgl_fho: v })} />
                <Field label="Perpanjangan (hari)" inputMode="decimal" value={tl.perpanjangan_hari} onChange={(v) => setTl({ ...tl, perpanjangan_hari: v })} />
                <Field label="Masa Pemeliharaan Selesai" type="date" value={tl.masa_pemeliharaan_selesai} onChange={(v) => setTl({ ...tl, masa_pemeliharaan_selesai: v })} />
                <Field label="Catatan" value={tl.catatan} onChange={(v) => setTl({ ...tl, catatan: v })} full />
              </div>
            </section>

            <section className="panel">
              <h2>Struktur Organisasi</h2>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Nama</th>
                    <th>Jabatan</th>
                    <th>Institusi</th>
                    <th>Telepon</th>
                    <th>Email</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {detail.orgs.length === 0 && (
                    <tr>
                      <td colSpan={6} className="muted center">
                        Belum ada personil.
                      </td>
                    </tr>
                  )}
                  {detail.orgs.map((o) => (
                    <tr key={o.id}>
                      <td>{o.nama}</td>
                      <td>{o.jabatan ?? '—'}</td>
                      <td>{o.institusi ?? '—'}</td>
                      <td>{o.telepon ?? '—'}</td>
                      <td>{o.email ?? '—'}</td>
                      <td className="right">
                        <button className="icon-btn danger" title="Hapus" onClick={() => removeOrg(o.id)} disabled={busy}>
                          <Icon name="trash" size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="inline-form">
                <input placeholder="Nama" value={orgForm.nama} onChange={(e) => setOrgForm({ ...orgForm, nama: e.target.value })} />
                <input placeholder="Jabatan" value={orgForm.jabatan} onChange={(e) => setOrgForm({ ...orgForm, jabatan: e.target.value })} />
                <input placeholder="Institusi" value={orgForm.institusi} onChange={(e) => setOrgForm({ ...orgForm, institusi: e.target.value })} />
                <input placeholder="Telepon" value={orgForm.telepon} onChange={(e) => setOrgForm({ ...orgForm, telepon: e.target.value })} />
                <input placeholder="Email" value={orgForm.email} onChange={(e) => setOrgForm({ ...orgForm, email: e.target.value })} />
                <button className="btn" onClick={addOrg} disabled={busy || orgForm.nama.trim() === ''}>
                  <Icon name="plus" size={14} /> Tambah
                </button>
              </div>
            </section>
            </>
          ) : (
            <div className="empty">
              <div className="empty-title">Pilih proyek</div>
              <p className="muted">Pilih proyek pada daftar untuk melihat detail.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  inputMode,
  full = false,
  autoFocus = false
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  inputMode?: 'decimal' | 'numeric' | 'text'
  full?: boolean
  autoFocus?: boolean
}) {
  return (
    <label className={`field${full ? ' full' : ''}`}>
      <span>{label}</span>
      <input
        type={type}
        inputMode={inputMode}
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  )
}

function Select({
  label,
  value,
  options,
  onChange
}: {
  label: string
  value: string
  options: string[]
  onChange: (v: string) => void
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o} value={o}>
            {o === '' ? '—' : o}
          </option>
        ))}
      </select>
    </label>
  )
}

function Fact({ k, v }: { k: string; v: string | null | undefined }) {
  return (
    <div className="fact">
      <dt>{k}</dt>
      <dd>{v == null || v === '' ? '—' : v}</dd>
    </div>
  )
}
