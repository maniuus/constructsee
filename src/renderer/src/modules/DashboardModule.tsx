import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api'
import { Icon } from '../components/Icons'
import { ErrorBox } from '../components/ui'
import type { DashboardSummary, Document } from '../../../shared/types'

const fmtRp = (n: number | null | undefined): string =>
  n == null
    ? '—'
    : new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)

const fmtNum = (n: number | null | undefined, dp = 0): string =>
  n == null ? '—' : new Intl.NumberFormat('id-ID', { maximumFractionDigits: dp }).format(n)

const fmtPct = (n: number | null | undefined, dp = 2): string =>
  n == null ? '—' : `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: dp }).format(n)}%`

const STATUS_LABEL: Record<string, string> = {
  perencanaan: 'Perencanaan',
  berlangsung: 'Berlangsung',
  selesai: 'Selesai',
  bermasalah: 'Bermasalah'
}

const KATEGORI_LABEL: Record<string, string> = {
  kontrak: 'Kontrak',
  surat: 'Surat',
  berita_acara: 'Berita Acara',
  izin: 'Izin',
  gambar: 'Gambar',
  laporan: 'Laporan',
  tagihan: 'Tagihan',
  jaminan: 'Jaminan',
  lainnya: 'Lainnya'
}

const daysUntil = (date: string | null | undefined): number | null => {
  if (!date) return null
  const [y, m, d] = date.slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return null
  const target = new Date(y, m - 1, d).getTime()
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  return Math.round((target - today) / 86400000)
}

export default function DashboardModule() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [expiring, setExpiring] = useState<Document[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setBusy(true)
    try {
      const [s, ex] = await Promise.all([api.dashboardSummary(), api.documentsExpiring(30)])
      setSummary(s)
      setExpiring(ex)
      setError(null)
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const projName = (id: number): string =>
    summary?.projects.find((p) => p.id === id)?.nama ?? `#${id}`

  const bermasalah = summary?.projects.filter((p) => p.status === 'bermasalah') ?? []

  return (
    <div className="module">
      <div className="module-head">
        <h1>Dashboard</h1>
        <div className="actions">
          <button className="btn ghost" onClick={load} disabled={busy}>
            <Icon name="refresh" size={15} />
            {busy ? 'Memuat…' : 'Muat Ulang'}
          </button>
        </div>
      </div>

      <div className="toolbar">
        <span className="mono muted">Ringkasan lintas proyek</span>
        <span className="grow" />
        <span className="mono">{summary ? `${fmtNum(summary.project_count)} proyek` : '—'}</span>
      </div>

      <ErrorBox error={error} />

      {summary && (
        <>
          <div className="dash-kpi term">
            <div className="kpi">
              <span className="kpi-label">Jumlah Proyek</span>
              <span className="kpi-value">{fmtNum(summary.project_count)}</span>
              <span className="kpi-sub">
                {summary.by_status.map((s) => `${STATUS_LABEL[s.status] ?? s.status} ${s.count}`).join(' · ') || '—'}
              </span>
            </div>
            <div className="kpi">
              <span className="kpi-label">Nilai Kontrak</span>
              <span className="kpi-value">{fmtRp(summary.total_nilai_kontrak)}</span>
              <span className="kpi-sub">Total seluruh proyek</span>
            </div>
            <div className="kpi">
              <span className="kpi-label">Nilai RAB</span>
              <span className="kpi-value">{fmtRp(summary.total_rab)}</span>
              <span className="kpi-sub">Akumulasi seluruh RAB</span>
            </div>
            <div className="kpi">
              <span className="kpi-label">Progress Fisik</span>
              <span className="kpi-value">{fmtPct(summary.progress_pct)}</span>
              <span className="mini-bar">
                <span style={{ width: `${Math.max(0, Math.min(100, summary.progress_pct))}%` }} />
              </span>
            </div>
            <div className={`kpi${summary.expiring_count > 0 ? ' warn' : ''}`}>
              <span className="kpi-label">Dokumen</span>
              <span className="kpi-value">{fmtNum(summary.total_dokumen)}</span>
              <span className="kpi-sub">
                {summary.expiring_count > 0
                  ? `${summary.expiring_count} segera berakhir (≤30 hr)`
                  : 'Tidak ada yang segera berakhir'}
              </span>
            </div>
          </div>

          <section className="panel">
            <div className="panel-head">
              <h2>Ringkasan Proyek</h2>
            </div>
            {summary.projects.length === 0 ? (
              <div className="empty">
              <div className="empty-title">Belum ada proyek</div>
              <p className="muted">Tambahkan proyek pada modul Project untuk melihat ringkasan di sini.</p>
            </div>
            ) : (
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Kode</th>
                    <th>Nama</th>
                    <th>Status</th>
                    <th className="right">Nilai Kontrak</th>
                    <th className="right">Nilai RAB</th>
                    <th className="right">Margin</th>
                    <th>Progress</th>
                    <th className="center">Dok</th>
                    <th>Update Progress</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.projects.map((p) => (
                    <tr key={p.id}>
                      <td className="mono">{p.kode}</td>
                      <td>{p.nama}</td>
                      <td>
                        <span className={`badge st-${p.status}`}>{STATUS_LABEL[p.status] ?? p.status}</span>
                      </td>
                      <td className="right mono">{fmtRp(p.nilai_kontrak)}</td>
                      <td className="right mono">{fmtRp(p.rab_total)}</td>
                      <td className="right mono">
                        {p.margin_pct == null ? (
                          '—'
                        ) : (
                          <span className={p.margin_pct < 0 ? 'neg' : 'pos'}>{fmtPct(p.margin_pct)}</span>
                        )}
                      </td>
                      <td>
                        <div className="prog-cell">
                          <span className="mini-bar">
                            <span style={{ width: `${Math.max(0, Math.min(100, p.progress_pct))}%` }} />
                          </span>
                          <span className="mono prog-pct">{fmtPct(p.progress_pct, 1)}</span>
                        </div>
                      </td>
                      <td className="center mono">
                        {p.dokumen_count}
                        {p.dokumen_expiring > 0 && <span className="badge warn doc-warn">{p.dokumen_expiring}</span>}
                      </td>
                      <td className="mono">{p.last_progress ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>Peringatan</h2>
            </div>

            <h3 className="dash-sub">Dokumen Segera Berakhir (≤30 hari)</h3>
            {expiring.length === 0 ? (
              <div className="empty">
                <div className="empty-title">Tidak ada dokumen mendekati jatuh tempo</div>
                <p className="muted">Semua dokumen masih jauh dari masa berlaku.</p>
              </div>
            ) : (
              <table className="tbl compact">
                <thead>
                  <tr>
                    <th>Proyek</th>
                    <th>Kategori</th>
                    <th>Nomor</th>
                    <th>Judul</th>
                    <th>Berlaku s/d</th>
                    <th className="right">Sisa</th>
                  </tr>
                </thead>
                <tbody>
                  {expiring.map((d) => {
                    const left = daysUntil(d.masa_berlaku_sampai)
                    const cls = left != null && left < 0 ? 'badge danger' : 'badge warn'
                    return (
                      <tr key={d.id}>
                        <td>{projName(d.project_id)}</td>
                        <td>{KATEGORI_LABEL[d.kategori] ?? d.kategori}</td>
                        <td className="mono">{d.nomor ?? '—'}</td>
                        <td>{d.judul}</td>
                        <td className="mono">{d.masa_berlaku_sampai ?? '—'}</td>
                        <td className="right">
                          <span className={cls}>
                            {left == null ? '—' : left < 0 ? `lewat ${Math.abs(left)} hr` : `${left} hr`}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}

            <h3 className="dash-sub">Proyek Bermasalah</h3>
            {bermasalah.length === 0 ? (
                <div className="empty">
                  <div className="empty-title">Tidak ada proyek bermasalah</div>
                  <p className="muted">Semua proyek berjalan normal.</p>
                </div>
            ) : (
              <ul className="dash-list">
                {bermasalah.map((p) => (
                  <li key={p.id}>
                    <span className="mono">{p.kode}</span> — {p.nama}
                    {p.klien ? <span className="muted"> · {p.klien}</span> : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {!summary && !error && <p className="muted">Memuat dashboard…</p>}
    </div>
  )
}
