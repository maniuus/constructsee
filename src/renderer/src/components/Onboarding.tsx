import { useEffect, useRef, useState } from 'react'
import { Icon, type IconName } from './Icons'

export const ONBOARD_KEY = 'constructsee:onboarded:v1'

type Point = { icon: IconName; text: string }

type Step = {
  eyebrow: string
  title: string
  lead: string
  points?: Point[]
  flow?: string[]
  note?: string
}

const STEPS: Step[] = [
  {
    eyebrow: 'Selamat datang',
    title: 'Satu tempat untuk proyek, RAB, dan progress.',
    lead:
      'Constructsee menggantikan spreadsheet RAB: data proyek, analisa harga AHSP, take-off volume, progress lapangan, dokumen, dan laporan — semuanya di satu aplikasi desktop.',
    points: [
      { icon: 'project', text: 'Project — data kontrak, timeline, dan organisasi.' },
      { icon: 'rab', text: 'RAB — item dari katalog AHSP, take-off volume, overhead.' },
      { icon: 'progress', text: 'Progress — realisasi harian per item.' },
      { icon: 'report', text: 'Report & Dashboard — cetak PDF, ekspor Excel, ringkasan portofolio.' }
    ]
  },
  {
    eyebrow: 'Alur kerja',
    title: 'Dari proyek ke laporan, berurutan.',
    lead: 'Ikuti empat langkah ini. Setiap modul saling terhubung — tidak perlu input ulang.',
    flow: ['Proyek', 'RAB + AHSP', 'Progress', 'Report'],
    points: [
      { icon: 'plus', text: 'Buat proyek dulu; RAB dan progress selalu terikat ke proyek.' },
      { icon: 'layers', text: 'Susun RAB dari item AHSP atau item manual, lalu isi volume.' },
      { icon: 'box', text: 'Take-off menghitung volume dari dimensi (kotak, trapesium, silinder).' },
      { icon: 'check', text: 'Catat progress lewat % kumulatif atau volume terpasang.' }
    ]
  },
  {
    eyebrow: 'Data & keamanan',
    title: 'Data milikmu, di komputermu.',
    lead:
      'Tidak ada akun, tidak ada cloud, tidak ada telemetry. Semua data tersimpan lokal di %APPDATA%\\com.abimanyu.constructsee.',
    points: [
      { icon: 'download', text: 'Backup: salin folder data saat aplikasi tertutup.' },
      { icon: 'refresh', text: 'Hapus proyek/RAB bisa dibatalkan lewat tombol Undo (20 detik).' },
      { icon: 'print', text: 'Laporan bisa dicetak ke PDF atau diekspor ke Excel (.xlsx).' }
    ]
  },
  {
    eyebrow: 'Tips',
    title: 'Kerja lebih cepat dengan keyboard.',
    lead: 'Beberapa kebiasaan kecil yang menghemat banyak klik.',
    points: [
      { icon: 'command', text: 'Ctrl + K — buka pencarian perintah (pindah modul, proyek baru).' },
      { icon: 'check', text: 'Enter menyimpan isian, Esc membatalkan atau menutup form.' },
      { icon: 'search', text: 'Tab lalu Enter/Space untuk membuka baris daftar tanpa mouse.' },
      { icon: 'info', text: 'Angka boleh memakai koma desimal: 1.234,56.' }
    ]
  },
  {
    eyebrow: 'Mulai',
    title: 'Siap membuat proyek pertama?',
    lead:
      'Kamu bisa mulai dari proyek kosong sekarang, atau menjelajahi aplikasi dulu. Panduan ini dapat dibuka lagi kapan saja lewat Ctrl + K → Panduan Awal.',
    note: 'Langkah pertama: isi kode dan nama proyek — sisanya bisa dilengkapi nanti.'
  }
]

export function Onboarding({
  open,
  onClose,
  onStartProject
}: {
  open: boolean
  onClose: () => void
  onStartProject: () => void
}) {
  const [step, setStep] = useState(0)
  const primaryRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (open) {
      setStep(0)
      window.setTimeout(() => primaryRef.current?.focus(), 30)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') setStep((s) => Math.min(s + 1, STEPS.length - 1))
      if (e.key === 'ArrowLeft') setStep((s) => Math.max(s - 1, 0))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const s = STEPS[step]
  const last = step === STEPS.length - 1

  return (
    <div className="onboard" role="dialog" aria-modal="true" aria-labelledby="onboard-title">
      <div className="onboard-card">
        <aside className="onboard-rail">
          <span className="onboard-brand">
            <span className="mark" />
            CONSTRUCTSEE
          </span>
          <span className="onboard-kicker">Panduan Awal</span>
          <span className="onboard-count">
            {String(step + 1).padStart(2, '0')}
            <span>/{String(STEPS.length).padStart(2, '0')}</span>
          </span>
          <ol className="onboard-steps">
            {STEPS.map((x, i) => (
              <li key={x.eyebrow} className={i === step ? 'cur' : i < step ? 'done' : ''}>
                <button onClick={() => setStep(i)} title={x.eyebrow}>
                  <span className="bar" />
                  <span className="lbl">{x.eyebrow}</span>
                </button>
              </li>
            ))}
          </ol>
          <span className="onboard-rail-note">Tekan Esc untuk menutup</span>
        </aside>

        <div className="onboard-main">
          <span className="onboard-eyebrow">
            {String(step + 1).padStart(2, '0')} — {s.eyebrow}
          </span>
          <h2 id="onboard-title">{s.title}</h2>
          <p className="onboard-lead">{s.lead}</p>

          {s.flow && (
            <div className="onboard-flow" aria-hidden="true">
              {s.flow.map((f, i) => (
                <span key={f} className="onboard-flow-item">
                  <b>{i + 1}</b>
                  {f}
                  {i < s.flow!.length - 1 && <Icon name="chevron-right" size={14} />}
                </span>
              ))}
            </div>
          )}

          {s.points && (
            <ul className="onboard-points">
              {s.points.map((p) => (
                <li key={p.text}>
                  <span className="ico">
                    <Icon name={p.icon} size={14} />
                  </span>
                  <span>{p.text}</span>
                </li>
              ))}
            </ul>
          )}

          {s.note && <p className="onboard-note">{s.note}</p>}

          <div className="onboard-actions">
            <button className="btn ghost" onClick={onClose}>
              Lewati
            </button>
            <span className="grow" />
            {step > 0 && (
              <button className="btn" onClick={() => setStep((v) => v - 1)}>
                Kembali
              </button>
            )}
            {last ? (
              <>
                <button className="btn" onClick={onClose}>
                  Jelajahi Dulu
                </button>
                <button ref={primaryRef} className="btn primary" onClick={onStartProject}>
                  <Icon name="plus" size={15} /> Buat Proyek Pertama
                </button>
              </>
            ) : (
              <button
                ref={primaryRef}
                className="btn primary"
                onClick={() => setStep((v) => Math.min(v + 1, STEPS.length - 1))}
              >
                Lanjut <Icon name="chevron-right" size={15} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
