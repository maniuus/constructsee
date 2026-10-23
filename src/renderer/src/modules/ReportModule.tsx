import { Fragment, useCallback, useEffect, useMemo, useState, type ReactElement } from 'react'
import { api } from '../lib/api'
import { Icon } from '../components/Icons'
import { ErrorBox } from '../components/ui'
import {
  aggKomponen,
  BENTUK_LABEL,
  GROUP_LABEL,
  groupOf,
  kodeCmp,
  normKompKey,
  ROUND_STEPS,
  roundUp,
  type AggKomp,
  type AggRes
} from '../lib/report-model'
import { buildReportWorkbook } from '../lib/report-xlsx'
import { parseNum } from '../lib/num'
import type {
  HitungKomponen,
  HitungResult,
  HitungSubtotal,
  Project,
  ProjectDetail,
  ProgressPoint,
  ProgressSummary,
  Rab,
  RabRekap,
  RabVolume
} from '../../../shared/types'

type Tab = 'rab' | 'progress'

const rp = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0
})
const num = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 4 })
/** Nominal tanpa prefix "Rp" — untuk RpCell yang menaruh label "Rp" sendiri. */
const rpNum = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 })

const fmtRp = (n: number | null | undefined) => (n == null ? '—' : rp.format(n))
const fmtNum = (n: number | null | undefined) => (n == null ? '—' : num.format(n))
const fmtPct = (n: number | null | undefined) => (n == null ? '—' : `${num.format(n)}%`)
const today = () => new Date().toISOString().slice(0, 10)

const fmtIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const addDays = (iso: string, days: number): string => {
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return ''
  d.setDate(d.getDate() + Math.max(0, Math.ceil(days || 0)))
  return fmtIso(d)
}

/** Baris komponen — sub-header per jenis (A/B/C/L) + subtotal biaya per jenis.
 *  `withKode`: tampilkan kolom Kode. `showQty`: tampilkan kolom Kebutuhan = koefisien × volume (seksi 7). */
function KompRows({
  komps,
  volume,
  cols,
  withKode = false,
  showQty = true
}: {
  komps: AggKomp[]
  volume: number
  cols: number
  withKode?: boolean
  showQty?: boolean
}): ReactElement {
  const sums = new Map<string, number>()
  komps.forEach((k) => {
    sums.set(k.js, (sums.get(k.js) ?? 0) + k.koefisien * volume * (k.harga_satuan ?? 0))
  })
  const out: ReactElement[] = []
  let last: string | null = null
  komps.forEach((k) => {
    if (k.js !== last) {
      last = k.js
      out.push(
        <tr className="r-subhead" key={`sh-${k.js}`}>
          <td colSpan={Math.max(1, cols - 1)}>{k.label}</td>
          <td className="right"><RpCell n={sums.get(k.js) ?? 0} /></td>
        </tr>
      )
    }
    const qty = k.koefisien * volume
    out.push(
      <tr key={k.key}>
        {withKode && <td className="mono">{k.kode ?? '—'}</td>}
        <td>{k.uraian}</td>
        <td>{k.satuan ?? '—'}</td>
        <td className="right">{fmtNum(k.koefisien)}</td>
        {showQty && <td className="right">{fmtNum(qty)}</td>}
        <td className="right"><RpCell n={k.harga_satuan} /></td>
        <td className="right"><RpCell n={qty * (k.harga_satuan ?? 0)} /></td>
      </tr>
    )
  })
  return <>{out}</>
}

/** Sel mata uang: label "Rp" rata kiri, nominalnya rata kanan (satu sel). */
function RpCell({ n }: { n: number | null | undefined }): ReactElement {
  if (n == null) return <span className="r-rp"><span className="r-rp-amt">—</span></span>
  return (
    <span className="r-rp">
      <span className="r-rp-cur">Rp</span>
      <span className="r-rp-amt">{rpNum.format(n)}</span>
    </span>
  )
}

/** Baris rekap kebutuhan sumber daya — sub-header per jenis, tanpa kolom Jenis. */
function ResRows({ rows }: { rows: AggRes[] }): ReactElement {
  const sums = new Map<string, number>()
  rows.forEach((r) => {
    const js = groupOf(r.jenis)
    sums.set(js, (sums.get(js) ?? 0) + r.biaya)
  })
  const out: ReactElement[] = []
  let last: string | null = null
  rows.forEach((r) => {
    const js = groupOf(r.jenis)
    if (js !== last) {
      last = js
      out.push(
        <tr className="r-subhead" key={`sh-${js}`}>
          <td colSpan={3}>{GROUP_LABEL[js]}</td>
          <td className="right"><RpCell n={sums.get(js) ?? 0} /></td>
        </tr>
      )
    }
    out.push(
      <tr key={`${r.jenis}|${r.uraian}|${r.satuan}`}>
        <td>{r.uraian}</td>
        <td>{r.satuan ?? '—'}</td>
        <td className="right">{fmtNum(r.qty)}</td>
        <td className="right"><RpCell n={r.biaya} /></td>
      </tr>
    )
  })
  return <>{out}</>
}

export default function ReportModule() {
  const [projects, setProjects] = useState<Project[]>([])
  const [projectId, setProjectId] = useState<number | null>(null)
  const [detail, setDetail] = useState<ProjectDetail | null>(null)
  const [rabs, setRabs] = useState<Rab[]>([])
  const [rabId, setRabId] = useState<number | null>(null)
  const [rab, setRab] = useState<Rab | null>(null)
  const [hitung, setHitung] = useState<HitungResult[]>([])
  const [rekap, setRekap] = useState<RabRekap | null>(null)
  const [summary, setSummary] = useState<ProgressSummary | null>(null)
  const [volumes, setVolumes] = useState<RabVolume[]>([])
  const [tab, setTab] = useState<Tab>('rab')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [baseDate, setBaseDate] = useState('')
  const [roundDigits, setRoundDigits] = useState(0)

  const project = detail?.project ?? null
  const lokasi = [project?.lokasi_alamat, project?.lokasi_kab, project?.lokasi_prov]
    .filter(Boolean)
    .join(', ')
  const startDate = baseDate || project?.tanggal_mulai || today()

  useEffect(() => {
    api
      .projectList()
      .then((ps) => {
        setProjects(ps)
        setProjectId((cur) => cur ?? ps[0]?.id ?? null)
      })
      .catch((e) => setError(String(e)))
  }, [])

  useEffect(() => {
    if (projectId == null) {
      setDetail(null)
      setRabs([])
      setRabId(null)
      return
    }
    let alive = true
    Promise.all([api.projectGet(projectId), api.rabList(projectId)])
      .then(([d, rs]) => {
        if (!alive) return
        setDetail(d)
        setRabs(rs)
        setRabId((cur) => (cur && rs.some((r) => r.id === cur) ? cur : rs[0]?.id ?? null))
      })
      .catch((e) => setError(String(e)))
    return () => {
      alive = false
    }
  }, [projectId])

  const loadReport = useCallback(async (id: number) => {
    setBusy(true)
    setError(null)
    try {
      const [r, h, rk, s, vs] = await Promise.all([
        api.rabGet(id),
        api.rabHitung(id),
        api.rabRekap(id),
        api.progressSummary(id),
        api.rabVolumesRab(id)
      ])
      setRab(r.rab)
      setHitung(h)
      setRekap(rk)
      setSummary(s)
      setVolumes(vs)
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => {
    if (rabId == null) {
      setRab(null)
      setHitung([])
      setRekap(null)
      setSummary(null)
      setVolumes([])
      return
    }
    void loadReport(rabId)
  }, [rabId, loadReport])

  const divName = useMemo(() => {
    const m = new Map<string, string>()
    rekap?.rows.forEach((r) => {
      if (r.divisi_no) m.set(r.divisi_no, r.nama)
    })
    return m
  }, [rekap])

  const sorted = useMemo(
    () => [...hitung].sort((a, b) => kodeCmp(a.item.kode ?? '', b.item.kode ?? '')),
    [hitung]
  )

  const groups = useMemo(() => {
    const m = new Map<string, HitungResult[]>()
    sorted.forEach((h) => {
      const key = h.item.divisi_no ?? '—'
      const list = m.get(key)
      if (list) list.push(h)
      else m.set(key, [h])
    })
    const arr = Array.from(m.entries())
    arr.sort((a, b) => kodeCmp(a[0], b[0]))
    return arr
  }, [sorted])

  const analisaRekap = useMemo(() => {
    const m = new Map<
      string,
      {
        id: number
        kode: string
        uraian: string
        satuan: string | null
        harga: number
        komponen: HitungKomponen[]
        sub: HitungSubtotal
        ov: number
        n: number
      }
    >()
    sorted.forEach((h) => {
      const key = h.item.kode ?? `#${h.item.id}`
      const cur = m.get(key)
      if (cur) {
        cur.n += 1
      } else {
        m.set(key, {
          id: h.item.id,
          kode: h.item.kode ?? '—',
          uraian: h.item.uraian,
          satuan: h.item.satuan,
          harga: h.subtotal.f,
          komponen: h.komponen,
          sub: h.subtotal,
          ov: h.overhead_pct,
          n: 1
        })
      }
    })
    return Array.from(m.values()).sort((a, b) => kodeCmp(a.kode, b.kode))
  }, [sorted])

  const volByItem = useMemo(() => {
    const m = new Map<number, RabVolume[]>()
    volumes.forEach((v) => {
      const l = m.get(v.item_id)
      if (l) l.push(v)
      else m.set(v.item_id, [v])
    })
    return m
  }, [volumes])

  const resourceAgg = useMemo(() => {
    const m = new Map<
      string,
      { jenis: string; uraian: string; satuan: string | null; qty: number; biaya: number }
    >()
    sorted.forEach((h) =>
      h.komponen.forEach((k) => {
        const jenis = k.jenis ?? ''
        const qty = (k.koefisien ?? 0) * h.item.volume
        const biaya = qty * (k.harga_satuan ?? 0)
        const key = normKompKey(k.jenis, k.uraian, k.satuan)
        const cur = m.get(key)
        if (cur) {
          cur.qty += qty
          cur.biaya += biaya
        } else {
          m.set(key, { jenis, uraian: k.uraian ?? '', satuan: k.satuan, qty, biaya })
        }
      })
    )
    return Array.from(m.values()).sort((a, b) => {
      const g = groupOf(a.jenis).localeCompare(groupOf(b.jenis))
      if (g !== 0) return g
      return a.uraian.localeCompare(b.uraian)
    })
  }, [sorted])

  const schedule = useMemo(() => {
    const rows = sorted.map((h) => {
      const dur = h.item.durasi_hari ?? 0
      const mulai = h.item.tgl_mulai ?? ''
      return { h, dur, mulai, selesai: mulai ? addDays(mulai, dur) : '' }
    })
    const starts = rows.map((r) => r.mulai).filter(Boolean) as string[]
    const ends = rows.map((r) => r.selesai).filter(Boolean) as string[]
    const min = starts.length ? starts.reduce((a, b) => (a < b ? a : b)) : ''
    const max = ends.length ? ends.reduce((a, b) => (a > b ? a : b)) : ''
    const spanDays = min && max ? Math.max(1, Math.round((Date.parse(max) - Date.parse(min)) / 86400000)) : 0
    const totalDur = rows.reduce((n, r) => n + (r.dur || 0), 0)
    return { rows, min, max, spanDays, totalDur }
  }, [sorted])

  const barPos = (mulai: string, selesai: string) => {
    if (!schedule.min || !schedule.max || !mulai || !selesai) return null
    const t0 = Date.parse(schedule.min)
    const t1 = Date.parse(schedule.max) + 86400000
    const span = Math.max(1, t1 - t0)
    const left = ((Date.parse(mulai) - t0) / span) * 100
    const width = Math.max(1, ((Date.parse(selesai) + 86400000 - Date.parse(mulai)) / span) * 100)
    return { left: Math.max(0, left), width: Math.min(100 - left, width) }
  }

  const handlePrint = () => window.print()

  /** Pembulatan Total seksi 1 (selalu ke atas), pilihan digit oleh user. */
  const roundOpt = ROUND_STEPS.find((o) => o.digits === roundDigits) ?? ROUND_STEPS[0]
  const totalRounded = roundUp(rekap?.total ?? 0, roundDigits)

  const commitSchedule = async (
    h: HitungResult,
    patch: { durasi?: string; mulai?: string }
  ) => {
    let dur = h.item.durasi_hari ?? null
    if (patch.durasi !== undefined) {
      const p = parseNum(patch.durasi)
      if (!p.ok) {
        setError(`Durasi: ${p.message}`)
        return
      }
      dur = p.value
    }
    const mulai =
      patch.mulai !== undefined
        ? patch.mulai.trim() === ''
          ? null
          : patch.mulai
        : (h.item.tgl_mulai ?? null)
    try {
      await api.rabSetSchedule(h.item.id, dur, mulai)
      setError(null)
      if (rabId != null) await loadReport(rabId)
    } catch (e) {
      setError(String(e))
    }
  }

  const autoSchedule = async () => {
    if (rabId == null) return
    setBusy(true)
    setError(null)
    try {
      let cursor = startDate
      for (const h of sorted) {
        const dur = h.item.durasi_hari ?? 0
        await api.rabSetSchedule(h.item.id, h.item.durasi_hari ?? null, cursor)
        cursor = addDays(cursor, dur > 0 ? dur : 1)
      }
      await loadReport(rabId)
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }

  const handleExportExcel = async () => {
    setError(null)
    setSaved(null)
    if (rabId == null) return
    try {
      const data = buildReportWorkbook({
        tab,
        title: tab === 'rab' ? 'RENCANA ANGGARAN BIAYA (RAB)' : 'LAPORAN PROGRESS PEKERJAAN',
        projectName: project?.nama ?? '',
        projectCode: project?.kode ?? '',
        rabName: rab?.nama ?? '',
        printed: today(),
        rekap,
        groups,
        sorted,
        analisaRekap,
        volByItem,
        schedule,
        resourceAgg,
        divName,
        roundDigits,
        roundLabel: roundOpt.label,
        summary
      })
      const name = `${tab === 'rab' ? 'RAB' : 'Progress'}_${project?.kode ?? 'proyek'}_AHS.xlsx`
      const p = await api.reportSaveBytes(name, data)
      setSaved(p)
    } catch (e) {
      setError(String(e))
    }
  }

  return (
    <div className="module">
      <div className="module-head">
        <h1>Report</h1>
        <div className="actions no-print">
          <button
            className="btn primary"
            onClick={handlePrint}
            disabled={!rabId}
            title="Di dialog cetak: Margins Default, Scale 100%, matikan 'Headers and footers' agar judul/tanggal bawaan browser tidak ikut tercetak"
          >
            <Icon name="print" size={15} />
            Cetak / PDF
          </button>
          <button className="btn" onClick={handleExportExcel} disabled={!rabId}>
            <Icon name="download" size={15} />
            Ekspor Excel
          </button>
        </div>
      </div>

      <div className="toolbar no-print">
        <div className="tabs">
          <button className={`tab${tab === 'rab' ? ' active' : ''}`} onClick={() => setTab('rab')}>
            RAB
          </button>
          <button
            className={`tab${tab === 'progress' ? ' active' : ''}`}
            onClick={() => setTab('progress')}
          >
            Progress
          </button>
        </div>
        <select
          value={projectId ?? ''}
          onChange={(e) => setProjectId(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">— Pilih Proyek —</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.kode} · {p.nama}
            </option>
          ))}
        </select>
        <select
          value={rabId ?? ''}
          onChange={(e) => setRabId(e.target.value ? Number(e.target.value) : null)}
          disabled={rabs.length === 0}
        >
          <option value="">— Pilih RAB —</option>
          {rabs.map((r) => (
            <option key={r.id} value={r.id}>
              {r.nama}
            </option>
          ))}
        </select>
        <span className="grow" />
        <span className="muted mono">{tab === 'rab' ? '7 SEKSI · PEMISAH HALAMAN' : 'LAPORAN PROGRES'}</span>
      </div>

      {error && (
        <div className="no-print">
          <ErrorBox error={error} />
        </div>
      )}
      {saved && <div className="notice no-print">Berkas CSV tersimpan di: {saved}</div>}
      {busy && <p className="muted no-print">Memuat data…</p>}

      {rabId == null ? (
        <p className="muted no-print">Pilih proyek dan RAB untuk menyusun laporan.</p>
      ) : (
        <div className="report-sheet">
          <header className="r-kop">
            <div>
              <div className="r-kop-brand">CONSTRUCTSEE</div>
              <div className="r-kop-sub">Manajemen Proyek Konstruksi</div>
            </div>
            <div className="r-kop-meta">
              Dicetak: {today()}
              <br />
              {tab === 'rab' ? 'Dokumen RAB' : 'Laporan Progress'}
            </div>
          </header>

          <div className="r-title">
            {tab === 'rab' ? 'RENCANA ANGGARAN BIAYA (RAB)' : 'LAPORAN PROGRESS PEKERJAAN'}
          </div>

          <div className="r-proj">
            <div className="r-proj-nama">{project?.nama ?? '—'}</div>
            <div className="r-proj-info">
              <span>Kode: {project?.kode ?? '—'}</span>
              {project?.klien && <span>Klien: {project.klien}</span>}
              {lokasi && <span>Lokasi: {lokasi}</span>}
              {project?.jenis && <span>Jenis: {project.jenis}</span>}
              {project?.nilai_kontrak != null && (
                <span>Nilai Kontrak: {fmtRp(project.nilai_kontrak)}</span>
              )}
            </div>
          </div>

          {tab === 'rab' ? (
            <>
              {/* 1. REKAPITULASI */}
              <section className="r-section">
                <div className="r-sec-title">
                  <span className="r-sec-num">1</span> REKAPITULASI
                </div>
                <table className="r-tbl g3">
                  <thead>
                    <tr>
                      <th>No</th>
                      <th>Divisi</th>
                      <th className="mid">Jumlah</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rekap?.rows.map((r) => (
                      <tr key={r.divisi_no ?? r.nama}>
                        <td className="mono">{r.divisi_no}</td>
                        <td>{r.nama}</td>
                        <td className="right"><RpCell n={r.total} /></td>
                      </tr>
                    ))}
                    <tr className="r-total">
                      <td colSpan={2}>Subtotal</td>
                      <td className="right"><RpCell n={rekap?.subtotal} /></td>
                    </tr>
                    {(rekap?.ppn ?? 0) > 0 && (
                      <tr>
                        <td colSpan={2}>PPN {fmtNum(rekap?.ppn_pct)}%</td>
                        <td className="right"><RpCell n={rekap?.ppn} /></td>
                      </tr>
                    )}
                    <tr className="r-total">
                      <td colSpan={2}>Total</td>
                        <td className="right"><RpCell n={rekap?.total} /></td>
                    </tr>
                    <tr className="r-round">
                      <td colSpan={2}>
                        Dibulatkan
                        <select
                          className="r-select no-print"
                          value={roundDigits}
                          onChange={(e) => setRoundDigits(Number(e.target.value))}
                          aria-label="Pembulatan total"
                        >
                          {ROUND_STEPS.map((o) => (
                            <option key={o.digits} value={o.digits}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                        <span className="print-only">
                          {' '}
                          (ke atas, {roundOpt.label.toLowerCase()})
                        </span>
                      </td>
                      <td className="right"><RpCell n={totalRounded} /></td>
                    </tr>
                  </tbody>
                </table>
              </section>

              {/* 2. RAB — divisi sebagai subheader dalam satu tabel */}
              <section className="r-section">
                <div className="r-sec-title">
                  <span className="r-sec-num">2</span> RENCANA ANGGARAN BIAYA
                </div>
                <table className="r-tbl g6">
                  <thead>
                    <tr>
                      <th>Kode</th>
                      <th>Uraian</th>
                      <th className="mid">SAT</th>
                      <th className="mid">VOL</th>
                      <th className="mid">Harga Satuan</th>
                      <th className="mid">Jumlah</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map(([no, list]) => (
                      <Fragment key={no}>
                        <tr className="r-div">
                          <td colSpan={5}>{divName.get(no) ?? `DIVISI ${no}`}</td>
                          <td className="right">
                            <RpCell n={list.reduce((n, h) => n + h.total, 0)} />
                          </td>
                        </tr>
                        {list.map((h) => (
                          <tr key={h.item.id}>
                            <td className="mono">{h.item.kode}</td>
                            <td>{h.item.uraian}</td>
                            <td>{h.item.satuan}</td>
                            <td className="right">{fmtNum(h.item.volume)}</td>
                          <td className="right"><RpCell n={h.subtotal.f} /></td>
                          <td className="right"><RpCell n={h.total} /></td>
                          </tr>
                        ))}
                      </Fragment>
                    ))}
                    <tr className="r-total">
                      <td colSpan={5}>TOTAL</td>
                      <td className="right"><RpCell n={rekap?.subtotal} /></td>
                    </tr>
                  </tbody>
                </table>
              </section>

              {/* 3. BOQ */}
              <section className="r-section">
                <div className="r-sec-title">
                  <span className="r-sec-num">3</span> BILL OF QUANTITIES (BOQ)
                </div>
                <table className="r-tbl g6">
                  <thead>
                    <tr>
                      <th>Kode</th>
                      <th>Uraian</th>
                      <th className="mid">SAT</th>
                      <th className="mid">VOL</th>
                      <th className="mid">Harga Satuan</th>
                      <th className="mid">Jumlah</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((h) => (
                      <tr key={h.item.id}>
                        <td className="mono">{h.item.kode}</td>
                        <td>{h.item.uraian}</td>
                        <td>{h.item.satuan}</td>
                        <td className="right">{fmtNum(h.item.volume)}</td>
                        <td className="right"><RpCell n={h.subtotal.f} /></td>
                        <td className="right"><RpCell n={h.total} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {(['A', 'B', 'C'] as const).map((g) => (
                  <div key={g}>
                    <div className="r-group-head">
                      3.{g} BIAYA {GROUP_LABEL[g]}
                    </div>
                    <table className="r-tbl g3">
                      <thead>
                        <tr>
                          <th>Kode</th>
                          <th>Uraian</th>
                          <th className="mid">Jumlah</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sorted.map((h) => (
                          <tr key={h.item.id}>
                            <td className="mono">{h.item.kode}</td>
                            <td>{h.item.uraian}</td>
                            <td className="right">
                              <RpCell
                                n={g === 'A' ? h.subtotal.a : g === 'B' ? h.subtotal.b : h.subtotal.c}
                              />
                            </td>
                          </tr>
                        ))}
                        <tr className="r-total">
                          <td colSpan={2}>Subtotal Biaya {GROUP_LABEL[g]}</td>
                          <td className="right">
                            <RpCell
                              n={sorted.reduce(
                                (n, h) => n + (g === 'A' ? h.subtotal.a : g === 'B' ? h.subtotal.b : h.subtotal.c),
                                0
                              )}
                            />
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                ))}
              </section>

              {/* 4. REKAP ITEM ANALISA */}
              <section className="r-section">
                <div className="r-sec-title">
                  <span className="r-sec-num">4</span> REKAP ITEM ANALISA YANG DIPAKAI
                </div>
                {analisaRekap.map((a) => (
                  <div key={a.kode} className="r-group">
                    <div className="r-group-head">
                      <span className="mono">{a.kode}</span> — {a.uraian} ({a.satuan ?? '—'})
                      {a.n > 1 ? ` · digunakan pada ${a.n} item` : ''}
                    </div>
                    <table className="r-tbl g5c">
                      <thead>
                        <tr>
                          <th>Komponen</th>
                          <th className="mid">SAT</th>
                          <th className="mid">KOEF</th>
                          <th className="mid">Harga Satuan</th>
                          <th className="mid">Jumlah</th>
                        </tr>
                      </thead>
                      <tbody>
                        <KompRows
                          komps={aggKomponen(a.komponen)}
                          volume={1}
                          cols={5}
                          showQty={false}
                        />
                        <tr className="r-sub">
                          <td colSpan={4}>Jumlah Komponen (Tenaga Kerja + Bahan + Alat)</td>
                          <td className="right"><RpCell n={a.sub.d} /></td>
                        </tr>
                        <tr className="r-sub">
                          <td colSpan={4}>Overhead {fmtNum(a.ov * 100)}%</td>
                          <td className="right"><RpCell n={a.sub.e} /></td>
                        </tr>
                        <tr className="r-total">
                          <td colSpan={4}>Jumlah (Komponen + Overhead)</td>
                          <td className="right"><RpCell n={a.sub.f} /></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                ))}
              </section>

              {/* 5. BACKUP VOLUME */}
              <section className="r-section">
                <div className="r-sec-title">
                  <span className="r-sec-num">5</span> BACKUP VOLUME TIAP ITEM
                </div>
                {sorted.map((h) => {
                  const vs = volByItem.get(h.item.id) ?? []
                  return (
                    <div key={h.item.id} className="r-group">
                      <div className="r-group-head">
                        <span className="mono">{h.item.kode}</span> — {h.item.uraian} (
                        {h.item.satuan ?? '—'})
                      </div>
                      <table className="r-tbl g7">
                        <colgroup>
                          <col style={{ width: '34%' }} />
                          <col style={{ width: '24%' }} />
                          <col style={{ width: '6%' }} />
                          <col style={{ width: '8%' }} />
                          <col style={{ width: '9%' }} />
                          <col style={{ width: '9%' }} />
                          <col style={{ width: '10%' }} />
                        </colgroup>
                        <tbody>
                          {vs.length === 0 && (
                            <tr>
                              <td colSpan={7} className="muted">
                                Tidak tersedia rincian volume take-off.
                              </td>
                            </tr>
                          )}
                          {vs.map((v) => (
                            <tr key={v.id}>
                              <td>{v.uraian || '—'}</td>
                              <td>{BENTUK_LABEL[v.bentuk] ?? v.bentuk}</td>
                              <td className="right">{fmtNum(v.panjang)}</td>
                              <td className="right">{fmtNum(v.lebar)}</td>
                              <td className="right">{fmtNum(v.lebar2)}</td>
                              <td className="right">{fmtNum(v.tinggi)}</td>
                              <td className="right">{fmtNum(v.jumlah)}</td>
                            </tr>
                          ))}
                          <tr className="r-sub">
                            <td colSpan={6}>Volume Item (Hasil Perhitungan)</td>
                            <td className="right">{fmtNum(h.item.volume)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )
                })}
              </section>

              {/* 6. TIME SCHEDULE */}
              <section className="r-section">
                <div className="r-sec-title">
                  <span className="r-sec-num">6</span> TIME SCHEDULE
                </div>
                <div className="toolbar no-print">
                  <label className="field compact">
                    <span>Tanggal Mulai Proyek</span>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setBaseDate(e.target.value)}
                    />
                  </label>
                  <button className="btn tiny" onClick={autoSchedule} disabled={busy}>
                    Isi Tanggal Secara Berurutan
                  </button>
                  <span className="grow" />
                  <span className="muted mono">
                    Total Durasi: {fmtNum(schedule.totalDur)} hari · Periode: {schedule.min || '—'} s.d.{' '}
                    {schedule.max || '—'}
                  </span>
                </div>
                <table className="r-tbl g6c">
                  <thead>
                    <tr>
                      <th>Kode</th>
                      <th>Uraian</th>
                      <th className="right">Durasi (hari)</th>
                      <th>Mulai</th>
                      <th>Selesai</th>
                      <th>Jadwal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedule.rows.map((r) => {
                      const bar = barPos(r.mulai, r.selesai)
                      return (
                        <tr key={r.h.item.id}>
                          <td className="mono">{r.h.item.kode}</td>
                          <td>{r.h.item.uraian}</td>
                          <td className="right">
                            <input
                              className="r-cell no-print"
                              defaultValue={r.dur || ''}
                              placeholder="0"
                              onBlur={(e) => commitSchedule(r.h, { durasi: e.target.value })}
                            />
                            <span className="print-only">{fmtNum(r.dur || null)}</span>
                          </td>
                          <td>
                            <input
                              className="r-cell left no-print"
                              type="date"
                              defaultValue={r.mulai}
                              onBlur={(e) => commitSchedule(r.h, { mulai: e.target.value })}
                            />
                            <span className="print-only">{r.mulai || '—'}</span>
                          </td>
                          <td className="mono">{r.selesai || '—'}</td>
                          <td>
                            {bar ? (
                              <span className="r-bar">
                                <span style={{ left: `${bar.left}%`, width: `${bar.width}%` }} />
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                        </tr>
                      )
                    })}
                    <tr className="r-total">
                      <td colSpan={2}>TOTAL</td>
                      <td className="right">{fmtNum(schedule.totalDur)}</td>
                      <td className="mono">{schedule.min || '—'}</td>
                      <td className="mono">{schedule.max || '—'}</td>
                      <td>{schedule.spanDays ? `${schedule.spanDays} hari` : '—'}</td>
                    </tr>
                  </tbody>
                </table>
              </section>

              {/* 7. KEBUTUHAN SUMBER DAYA */}
              <section className="r-section">
                <div className="r-sec-title">
                  <span className="r-sec-num">7</span> KEBUTUHAN TENAGA KERJA, BAHAN &amp; ALAT
                </div>
                {sorted.map((h) => (
                  <div key={h.item.id} className="r-group">
                    <div className="r-group-head">
                      <span className="mono">{h.item.kode}</span> — {h.item.uraian} · Volume{' '}
                      {fmtNum(h.item.volume)} {h.item.satuan ?? ''}
                    </div>
                    <table className="r-tbl g7">
                      <thead>
                        <tr>
                          <th>Komponen</th>
                          <th className="mid">SAT</th>
                          <th className="mid">KOEF</th>
                          <th className="right">Kebutuhan</th>
                          <th className="mid">Harga Satuan</th>
                          <th className="mid">Jumlah</th>
                        </tr>
                      </thead>
                      <tbody>
                        <KompRows
                          komps={aggKomponen(h.komponen)}
                          volume={h.item.volume}
                          cols={6}
                        />
                      </tbody>
                    </table>
                  </div>
                ))}

                <div className="r-group-head">REKAP KEBUTUHAN SUMBER DAYA</div>
                <table className="r-tbl g5">
                  <thead>
                    <tr>
                      <th>Komponen</th>
                      <th className="mid">SAT</th>
                      <th className="right">Total Kebutuhan</th>
                      <th className="mid">Total Biaya</th>
                    </tr>
                  </thead>
                  <tbody>
                    <ResRows rows={resourceAgg} />
                  </tbody>
                </table>
              </section>
            </>
          ) : (
            <>
              <section className="r-section">
                <div className="r-sec-title">
                  <span className="r-sec-num">1</span> RINGKASAN PROGRESS
                </div>
                <div className="r-stats">
                  <div>
                    <span>Nilai RAB</span>
                    <b>{fmtRp(summary?.total_nilai)}</b>
                  </div>
                  <div>
                    <span>Terpasang</span>
                    <b>{fmtRp(summary?.nilai_actual)}</b>
                  </div>
                  <div>
                    <span>Progress</span>
                    <b>{fmtPct(summary?.progress_pct)}</b>
                  </div>
                </div>
                {(summary?.curve.length ?? 0) >= 2 && <RCurve points={summary!.curve} />}
              </section>

              <section className="r-section">
                <div className="r-sec-title">
                  <span className="r-sec-num">2</span> PROGRESS PER DIVISI
                </div>
                <table className="r-tbl">
                  <thead>
                    <tr>
                      <th>No</th>
                      <th>Divisi</th>
                      <th className="mid">Nilai</th>
                      <th className="mid">Terpasang</th>
                      <th className="right">Progress</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary?.divisi.map((d) => (
                      <tr key={d.divisi_no}>
                        <td className="mono">{d.divisi_no}</td>
                        <td>{d.nama}</td>
                        <td className="right"><RpCell n={d.nilai} /></td>
                        <td className="right"><RpCell n={d.nilai_actual} /></td>
                        <td className="right">{fmtPct(d.progress_pct)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>

              <section className="r-section">
                <div className="r-sec-title">
                  <span className="r-sec-num">3</span> DETAIL PER ITEM
                </div>
                <table className="r-tbl">
                  <thead>
                    <tr>
                      <th>Kode</th>
                      <th>Uraian</th>
                      <th className="mid">SAT</th>
                      <th className="mid">VOL</th>
                      <th className="right">Bobot</th>
                      <th className="right">Progress</th>
                      <th className="mid">VOL AKTUAL</th>
                      <th className="mid">Nilai Aktual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary?.items.map((it) => (
                      <tr key={it.item_id}>
                        <td className="mono">{it.kode}</td>
                        <td>{it.uraian}</td>
                        <td>{it.satuan}</td>
                        <td className="right">{fmtNum(it.volume)}</td>
                        <td className="right">{fmtPct(it.bobot_pct)}</td>
                        <td className="right">{fmtPct(it.pct)}</td>
                        <td className="right">{fmtNum(it.volume_actual)}</td>
                        <td className="right"><RpCell n={it.nilai_actual} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </>
          )}

          <div className="r-sign">
            <div>
              <span>Dibuat oleh,</span>
              <div className="r-sign-line" />
            </div>
            <div>
              <span>Diperiksa oleh,</span>
              <div className="r-sign-line" />
            </div>
            <div>
              <span>Disetujui oleh,</span>
              <div className="r-sign-line" />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function RCurve({ points }: { points: ProgressPoint[] }) {
  const W = 680
  const H = 220
  const P = 34
  const n = points.length
  const x = (i: number) => P + (n <= 1 ? 0 : (i * (W - 2 * P)) / (n - 1))
  const y = (v: number) => H - P - (Math.max(0, Math.min(100, v)) / 100) * (H - 2 * P)
  const line = points.map((p, i) => `${x(i)},${y(p.progress_pct)}`).join(' ')
  return (
    <svg className="r-curve" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
      {[0, 25, 50, 75, 100].map((g) => (
        <g key={g}>
          <line x1={P} y1={y(g)} x2={W - P} y2={y(g)} className="r-grid" />
          <text x={P - 6} y={y(g) + 4} className="r-axis" textAnchor="end">
            {g}
          </text>
        </g>
      ))}
      <line x1={P} y1={P} x2={P} y2={H - P} className="r-axis-line" />
      <line x1={P} y1={H - P} x2={W - P} y2={H - P} className="r-axis-line" />
      <polyline points={line} className="r-curve-line" />
      {points.map((p, i) => (
        <circle key={i} cx={x(i)} cy={y(p.progress_pct)} r={3} className="r-curve-dot" />
      ))}
      <text x={P} y={H - 8} className="r-axis">
        {points[0]?.tanggal}
      </text>
      <text x={W - P} y={H - 8} className="r-axis" textAnchor="end">
        {points[n - 1]?.tanggal}
      </text>
    </svg>
  )
}
