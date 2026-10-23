import type { HitungKomponen, HitungResult, HitungSubtotal } from '../../../shared/types'

/** Kelompok komponen: A tenaga kerja, B bahan, C peralatan, L lainnya. */
export type KompGroup = 'A' | 'B' | 'C' | 'L'

export const groupOf = (jenis: string | null): KompGroup => {
  const s = (jenis ?? '').toLowerCase()
  if (s.includes('tenaga')) return 'A'
  if (s.includes('bahan')) return 'B'
  if (s.includes('alat') || s.includes('peralatan')) return 'C'
  return 'L'
}

export const GROUP_LABEL: Record<KompGroup, string> = {
  A: 'TENAGA KERJA',
  B: 'BAHAN',
  C: 'PERALATAN',
  L: 'LAINNYA'
}

export const BENTUK_LABEL: Record<string, string> = {
  kotak: 'Kotak (L × T)',
  trapesium: 'Trapesium',
  silinder: 'Silinder (¼πd²)'
}

export const BENTUK_KEY: Record<string, 'kotak' | 'trapesium' | 'silinder'> = {
  kotak: 'kotak',
  trapesium: 'trapesium',
  silinder: 'silinder'
}

/** Pilihan pembulatan Total pada rekapitulasi (jumlah digit yang dinolkan). */
export const ROUND_STEPS: { digits: number; label: string }[] = [
  { digits: 0, label: 'Tanpa pembulatan' },
  { digits: 2, label: 'Ratusan' },
  { digits: 3, label: 'Ribuan' },
  { digits: 4, label: 'Puluh ribuan' },
  { digits: 5, label: 'Ratus ribuan' },
  { digits: 6, label: 'Jutaan' }
]

/** Pembulatan SELALU ke atas ke n digit (mis. digits 3 → kelipatan 1.000 terdekat di atasnya). */
export const roundUp = (n: number, digits: number): number => {
  if (!digits) return n
  const f = 10 ** digits
  return Math.ceil(n / f) * f
}

/** Urut kode AHSP secara natural per segmen (1.1.2 sebelum 1.1.10). */
export function kodeCmp(a: string, b: string): number {
  const as = a.split('.')
  const bs = b.split('.')
  for (let i = 0; i < Math.max(as.length, bs.length); i++) {
    const x = as[i]
    const y = bs[i]
    if (x === undefined) return -1
    if (y === undefined) return 1
    const nx = Number(x)
    const ny = Number(y)
    if (!Number.isNaN(nx) && !Number.isNaN(ny)) {
      if (nx !== ny) return nx - ny
    } else if (x !== y) {
      return x < y ? -1 : 1
    }
  }
  return 0
}

export type AggKomp = {
  key: string
  js: KompGroup
  label: string
  uraian: string
  kode: string | null
  satuan: string | null
  koefisien: number
  harga_satuan: number | null
}

export type AggRes = { jenis: string; uraian: string; satuan: string | null; qty: number; biaya: number }

export type AnalisaAgg = {
  /** id item pertama yang memakai analisa ini (kunci rujukan antar-sheet Excel). */
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

export type ScheduleRow = { h: HitungResult; dur: number; mulai: string; selesai: string }
export type ScheduleAgg = {
  rows: ScheduleRow[]
  min: string
  max: string
  spanDays: number
  totalDur: number
}

/** Kunci normalisasi komponen: jenis (A/B/C/L) + uraian + satuan, tanpa pengaruh huruf besar/kecil. */
export const normKompKey = (jenis: string | null, uraian: string | null, satuan: string | null): string =>
  `${groupOf(jenis)}|${(uraian ?? '').trim().toLowerCase()}|${(satuan ?? '').trim().toLowerCase()}`

/** Gabungkan komponen yang sama (mis. "Kepala Tukang" dengan jenis "Tenaga Kerja" vs "TENAGA KERJA"). */
export function aggKomponen(komponen: HitungKomponen[]): AggKomp[] {
  const m = new Map<string, AggKomp>()
  komponen.forEach((k) => {
    const key = normKompKey(k.jenis, k.uraian, k.satuan)
    const cur = m.get(key)
    if (cur) {
      cur.koefisien += k.koefisien ?? 0
    } else {
      const js = groupOf(k.jenis)
      m.set(key, {
        key,
        js,
        label: GROUP_LABEL[js],
        uraian: k.uraian ?? '—',
        kode: k.kode ?? null,
        satuan: k.satuan ?? null,
        koefisien: k.koefisien ?? 0,
        harga_satuan: k.harga_satuan ?? null
      })
    }
  })
  return Array.from(m.values()).sort((a, b) =>
    a.js === b.js ? a.uraian.localeCompare(b.uraian) : a.js.localeCompare(b.js)
  )
}
