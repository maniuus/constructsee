import type { HitungResult, ProgressSummary, RabRekap, RabVolume } from '../../../shared/types'
import {
  aggKomponen,
  BENTUK_LABEL,
  GROUP_LABEL,
  groupOf,
  normKompKey,
  roundUp,
  type AggRes,
  type AnalisaAgg,
  type ScheduleAgg
} from './report-model'
import { buildWorkbook, type Cell, type Sheet } from './xlsx'

/** Format angka Excel. `"Rp"* #,##0` menaruh "Rp" mepet kiri & nominal mepet kanan dalam satu sel. */
const MONEY = '"Rp"* #,##0'
const NUM4 = '#,##0.####'
const PCT = '0.0"%"'

const F_HEAD = 'EEEEEE'
const F_SUB = 'F1EFE9'
const F_DIV = 'E4E2DB'
const F_TOTAL = 'F2F2F2'

const ERR = 'Tidak tersedia rincian volume take-off.'

export type ReportXlsxInput = {
  tab: 'rab' | 'progress'
  title: string
  projectName: string
  projectCode: string
  rabName: string
  printed: string
  rekap: RabRekap | null | undefined
  groups: [string, HitungResult[]][]
  sorted: HitungResult[]
  analisaRekap: AnalisaAgg[]
  volByItem: Map<number, RabVolume[]>
  schedule: ScheduleAgg
  resourceAgg: AggRes[]
  divName: Map<string, string>
  roundDigits: number
  roundLabel: string
  summary: ProgressSummary | null | undefined
}

/** Nama kolom Excel dari indeks 0 (A, B, ... AA, AB, ...). */
function CL(i: number): string {
  let n = i
  let out = ''
  while (n >= 0) {
    out = String.fromCharCode(65 + (n % 26)) + out
    n = Math.floor(n / 26) - 1
  }
  return out
}

/** Simbol rumus: kolom i (0-based) pada baris r (1-based). */
const R = (i: number, r: number): string => `${CL(i)}${r}`

/** Lebar kolom Excel dari persentase grid laporan (lebar area cetak ≈ 96 aksara). */
const W = (pcts: number[]): number[] => pcts.map((p) => Math.max(5, Math.round((p / 100) * 96)))

const head = (v: string): Cell => ({
  v,
  b: true,
  sz: 9,
  fill: F_HEAD,
  border: true,
  align: 'center',
  wrap: true
})

const txt = (v: string | number | null | undefined, extra: Partial<Cell> = {}): Cell => ({
  v: v == null || v === '' ? '—' : v,
  border: true,
  ...extra
})

/** Sel angka: kosong (tanpa nilai) bila null supaya tidak tampil 0 palsu. */
const n4 = (v: number | null | undefined, extra: Partial<Cell> = {}): Cell =>
  v == null ? { border: true, align: 'right', ...extra } : { v, numFmt: NUM4, border: true, align: 'right', ...extra }

const rp = (v: number | null | undefined, extra: Partial<Cell> = {}): Cell =>
  v == null
    ? { border: true, align: 'left', ...extra }
    : { v, numFmt: MONEY, border: true, align: 'left', ...extra }

const pctC = (v: number | null | undefined, extra: Partial<Cell> = {}): Cell =>
  v == null
    ? { border: true, align: 'right', ...extra }
    : { v, numFmt: PCT, border: true, align: 'right', ...extra }

/** Sel rumus: `f` tanpa '=' + nilai cached supaya angka langsung benar walau belum dihitung ulang. */
const fx = (f: string, v: number, extra: Partial<Cell> = {}): Cell => ({ f, v, border: true, ...extra })

/** Baris pita (group/divisi/sub-jenis) selebar `span` kolom; sel isian setelahnya ditambah pemanggil. */
const band = (v: string, span: number, fill: string): Cell[] => {
  const out: Cell[] = [{ v, b: true, fill, border: true, wrap: true, colspan: span }]
  for (let i = 1; i < span; i++) out.push({})
  return out
}

// ----------------------------------------------------- rujukan antar-sheet ----
/** Nama sheet tetap — dirujuk oleh rumus antar-sheet, jangan diubah sembarangan. */
const SN_REKAP = 'Rekapitulasi'
const SN_RAB = 'Rencana Anggaran Biaya'
const SN_BOQ = 'BOQ'
const SN_ANALISA = 'Analisa'
const SN_VOLUME = 'Backup Volume'
const SN_SCHEDULE = 'Time Schedule'
const SN_KEBUTUHAN = 'Kebutuhan'
const SN_PROG_RINGKASAN = 'Ringkasan Progress'
const SN_PROG_DIVISI = 'Progress Divisi'
const SN_PROG_ITEM = 'Detail per Item'

/** Alamat sel antar-sheet: `'Nama Sheet'!E12`. */
const sn = (sheet: string, ref: string): string => `'${sheet.replace(/'/g, "''")}'!${ref}`

/** Sel-sel analisa yang bisa dirujuk sheet lain. */
type AnalisaRef = {
  /** Harga satuan analisa = sel "Jumlah (Komponen + Overhead)". */
  harga: string
  /** Sel subtotal biaya per jenis — dasar tabel 3.A/3.B/3.C. */
  jenis: Partial<Record<'A' | 'B' | 'C', string>>
  /** Sel KOEF tiap komponen (kunci agregat) — untuk kolom KOEF seksi 7. */
  koef: Map<string, string>
}

type Refs = {
  /** divisi_no → sel subtotal divisi di sheet RAB. */
  rekapDiv: Map<string, string>
  /** id item → sel VOL/Harga Satuan/Jumlah di sheet RAB. */
  rab: Map<number, { d: string; e: string; f: string }>
  /** id item analisa (entri pertama) → rujukan analisa. */
  analisa: Map<number, AnalisaRef>
  /** kode analisa → rujukan analisa (item yang memakai kode sama). */
  analisaKode: Map<string, AnalisaRef>
  /** id item → sel "Volume Item" di sheet Backup Volume. */
  vol: Map<number, string>
}

const newRefs = (): Refs => ({
  rekapDiv: new Map(),
  rab: new Map(),
  analisa: new Map(),
  analisaKode: new Map(),
  vol: new Map()
})

/** Rujukan analisa untuk sebuah item: cocokkan id item dulu, lalu kode analisanya. */
function analisaFor(refs: Refs, h: HitungResult): AnalisaRef | undefined {
  const byId = refs.analisa.get(h.item.id)
  if (byId) return byId
  return h.item.kode ? refs.analisaKode.get(h.item.kode) : undefined
}

/** Dua baris pertama tiap sheet: judul seksi + baris informasi. */
function top(title: string, info: string, cols: number): Cell[][] {
  return [
    [{ v: title, b: true, sz: 13, colspan: cols }, ...Array(Math.max(0, cols - 1)).fill({})],
    [{ v: info, sz: 8, color: '444444', colspan: cols }, ...Array(Math.max(0, cols - 1)).fill({})]
  ]
}

// ---------------------------------------------------------------- tab RAB ----

function sheetRekap(inp: ReportXlsxInput, refs: Refs): Sheet {
  const cols = 3
  const rows: Cell[][] = top('1. REKAPITULASI', info(inp), cols)
  rows.push([head('No'), head('Divisi'), head('Jumlah')])
  const first = rows.length + 1
  inp.rekap?.rows.forEach((r) => {
    // Jumlah divisi = rujukan ke sel subtotal divisi di sheet RAB (rumus antar-sheet).
    const ref = r.divisi_no == null ? undefined : refs.rekapDiv.get(String(r.divisi_no))
    rows.push([
      txt(r.divisi_no, { align: 'center' }),
      txt(r.nama),
      ref ? fx(ref, r.total, { numFmt: MONEY, align: 'left' }) : rp(r.total)
    ])
  })
  const last = rows.length
  const subRow = rows.length + 1
  rows.push([...band('Subtotal', 2, F_TOTAL), fx(`SUM(C${first}:C${last})`, inp.rekap?.subtotal ?? 0)])
  const ppnRow = rows.length + 1
  const ppnPct = inp.rekap?.ppn_pct ?? 0
  rows.push([
    ...band(`PPN ${ppnPct}%`, 2, F_TOTAL),
    fx(`C${subRow}*${ppnPct}/100`, inp.rekap?.ppn ?? 0)
  ])
  const totRow = rows.length + 1
  rows.push([...band('Total', 2, F_TOTAL), fx(`C${subRow}+C${ppnRow}`, inp.rekap?.total ?? 0, { b: true })])
  if (inp.roundDigits) {
    const f = 10 ** inp.roundDigits
    rows.push([
      ...band(`Dibulatkan ke atas (${inp.roundLabel.toLowerCase()})`, 2, F_TOTAL),
      fx(`CEILING(C${totRow},${f})`, roundUp(inp.rekap?.total ?? 0, inp.roundDigits), { b: true })
    ])
  }
  return { name: SN_REKAP, cols: W([8, 78, 14]), rows, freeze: 3 }
}

function sheetRab(inp: ReportXlsxInput, refs: Refs): Sheet {
  const rows: Cell[][] = top('2. RENCANA ANGGARAN BIAYA', info(inp), 6)
  rows.push([head('Kode'), head('Uraian'), head('SAT'), head('VOL'), head('Harga Satuan'), head('Jumlah')])
  const subCells: number[] = []
  inp.groups.forEach(([no, list]) => {
    const bandRow = rows.length + 1
    const first = bandRow + 1
    rows.push([...band(inp.divName.get(no) ?? `DIVISI ${no}`, 5, F_DIV), {}])
    list.forEach((h) => {
      const r = rows.length + 1
      const aRef = analisaFor(refs, h)
      const vRef = refs.vol.get(h.item.id)
      rows.push([
        txt(h.item.kode),
        txt(h.item.uraian),
        txt(h.item.satuan),
        // VOL = rujukan sel "Volume Item (Hasil Perhitungan)" di sheet Backup Volume.
        vRef ? fx(vRef, h.item.volume, { numFmt: NUM4, align: 'right' }) : n4(h.item.volume),
        // Harga satuan = rujukan sel analisa (Jumlah Komponen + Overhead) di sheet Analisa.
        aRef ? fx(aRef.harga, h.subtotal.f, { numFmt: MONEY, align: 'left' }) : rp(h.subtotal.f),
        fx(`D${r}*E${r}`, h.total, { numFmt: MONEY, align: 'left' })
      ])
      refs.rab.set(h.item.id, { d: sn(SN_RAB, `D${r}`), e: sn(SN_RAB, `E${r}`), f: sn(SN_RAB, `F${r}`) })
    })
    const last = rows.length
    rows[bandRow - 1][5] = fx(`SUM(F${first}:F${last})`, list.reduce((n, h) => n + h.total, 0), {
      b: true,
      numFmt: MONEY,
      align: 'left'
    })
    subCells.push(bandRow)
    refs.rekapDiv.set(no, sn(SN_RAB, `F${bandRow}`))
  })
  rows.push([
    ...band('TOTAL', 5, F_TOTAL),
    fx(subCells.length ? `SUM(${subCells.map((r) => `F${r}`).join(',')})` : '0', inp.rekap?.subtotal ?? 0, {
      b: true,
      numFmt: MONEY,
      align: 'left'
    })
  ])
  return { name: SN_RAB, cols: W([8, 50, 7, 9, 12, 14]), rows, freeze: 3 }
}

function sheetBoq(inp: ReportXlsxInput, refs: Refs): Sheet {
  const rows: Cell[][] = top('3. BILL OF QUANTITIES (BOQ)', info(inp), 6)
  rows.push([head('Kode'), head('Uraian'), head('SAT'), head('VOL'), head('Harga Satuan'), head('Jumlah')])
  inp.sorted.forEach((h) => {
    const r = rows.length + 1
    const rab = refs.rab.get(h.item.id)
    rows.push([
      txt(h.item.kode),
      txt(h.item.uraian),
      txt(h.item.satuan),
      // VOL & Harga Satuan mengikuti sheet RAB (satu sumber data).
      rab ? fx(rab.d, h.item.volume, { numFmt: NUM4, align: 'right' }) : n4(h.item.volume),
      rab ? fx(rab.e, h.subtotal.f, { numFmt: MONEY, align: 'left' }) : rp(h.subtotal.f),
      fx(`D${r}*E${r}`, h.total, { numFmt: MONEY, align: 'left' })
    ])
  })
  ;(['A', 'B', 'C'] as const).forEach((g) => {
    rows.push([])
    rows.push([{ v: `3.${g} BIAYA ${GROUP_LABEL[g]}`, b: true, fill: F_DIV, border: true, colspan: 6 }, {}, {}, {}, {}, {}])
    rows.push([head('Kode'), head('Uraian'), head('Jumlah'), {}, {}, {}])
    const first = rows.length + 1
    inp.sorted.forEach((h) => {
      const v = g === 'A' ? h.subtotal.a : g === 'B' ? h.subtotal.b : h.subtotal.c
      // Biaya per item = subtotal jenis di sheet Analisa × VOL item di sheet RAB.
      const jenis = analisaFor(refs, h)?.jenis[g]
      const vol = refs.rab.get(h.item.id)?.d
      rows.push([
        txt(h.item.kode),
        txt(h.item.uraian),
        jenis && vol ? fx(`${jenis}*${vol}`, v, { numFmt: MONEY, align: 'left' }) : rp(v),
        {},
        {},
        {}
      ])
    })
    const last = rows.length
    rows.push([
      ...band(`Subtotal ${GROUP_LABEL[g]}`, 2, F_TOTAL),
      fx(`SUM(C${first}:C${last})`, inp.sorted.reduce((n, h) => n + (g === 'A' ? h.subtotal.a : g === 'B' ? h.subtotal.b : h.subtotal.c), 0), { b: true, numFmt: MONEY, align: 'left' }),
      {},
      {},
      {}
    ])
  })
  return { name: SN_BOQ, cols: W([8, 50, 7, 9, 12, 14]), rows, freeze: 3 }
}

function sheetAnalisa(inp: ReportXlsxInput, refs: Refs): Sheet {
  const rows: Cell[][] = top('4. REKAP ITEM ANALISA YANG DIPAKAI', info(inp), 5)
  inp.analisaRekap.forEach((a) => {
    rows.push([
      ...band(
        `${a.kode} — ${a.uraian} (${a.satuan ?? '—'})${a.n > 1 ? ` · digunakan pada ${a.n} item` : ''}`,
        5,
        F_DIV
      )
    ])
    rows.push([head('Komponen'), head('SAT'), head('KOEF'), head('Harga Satuan'), head('Jumlah')])
    const subByGroup: Partial<Record<string, number>> = {}
    const komps = aggKomponen(a.komponen)
    /** Kunci agregat komponen → sel KOEF, supaya seksi 7 bisa merujuk koefisiennya. */
    const koef = new Map<string, string>()
    for (let i = 0; i < komps.length; ) {
      const js = komps[i].js
      const bandRow = rows.length + 1
      const first = bandRow + 1
      rows.push([...band(komps[i].label, 4, F_SUB), {}])
      let j = i
      while (j < komps.length && komps[j].js === js) {
        const k = komps[j]
        const r = rows.length + 1
        rows.push([
          txt(k.uraian),
          txt(k.satuan),
          n4(k.koefisien),
          rp(k.harga_satuan),
          fx(`C${r}*D${r}`, k.koefisien * (k.harga_satuan ?? 0), { numFmt: MONEY, align: 'left' })
        ])
        koef.set(k.key, sn(SN_ANALISA, `C${r}`))
        j++
      }
      const last = rows.length
      rows[bandRow - 1][4] = fx(`SUM(E${first}:E${last})`, sumAnalisa(komps, i, j), {
        b: true,
        numFmt: MONEY,
        align: 'left'
      })
      subByGroup[js] = bandRow
      i = j
    }
    const pick = (g: string): string[] => (subByGroup[g] ? [`E${subByGroup[g]}`] : [])
    const arg = (v: number, list: string[]): Cell =>
      list.length ? fx(`SUM(${list.join(',')})`, v, { b: true, numFmt: MONEY, align: 'left' }) : rp(v, { b: true })
    const jcRow = rows.length + 1
    rows.push([...band('Jumlah Komponen (Tenaga Kerja + Bahan + Alat)', 4, F_SUB), arg(a.sub.d, [...pick('A'), ...pick('B'), ...pick('C')])])
    const ovRow = rows.length + 1
    rows.push([...band(`Overhead ${fmtPctNum(a.ov * 100)}%`, 4, F_SUB), fx(`E${jcRow}*${a.ov}`, a.sub.e, { numFmt: MONEY, align: 'left' })])
    rows.push([
      ...band('Jumlah (Komponen + Overhead)', 4, F_TOTAL),
      fx(`E${jcRow}+E${ovRow}`, a.sub.f, { b: true, numFmt: MONEY, align: 'left' })
    ])
    // Daftarkan sel-sel analisa supaya dirujuk sheet RAB/BOQ/Kebutuhan.
    const jenis: AnalisaRef['jenis'] = {}
    ;(['A', 'B', 'C'] as const).forEach((g) => {
      const local = pick(g)[0]
      if (local) jenis[g] = sn(SN_ANALISA, local)
    })
    const ref: AnalisaRef = { harga: sn(SN_ANALISA, `E${rows.length}`), jenis, koef }
    refs.analisa.set(a.id, ref)
    if (a.kode && a.kode !== '—') refs.analisaKode.set(a.kode, ref)
    rows.push([])
  })
  return { name: SN_ANALISA, cols: W([46, 12, 8, 17, 17]), rows, freeze: 3 }
}

function sheetVolume(inp: ReportXlsxInput, refs: Refs): Sheet {
  const rows: Cell[][] = top('5. BACKUP VOLUME TIAP ITEM', info(inp), 8)
  rows.push([head('Uraian'), head('Bentuk'), head('Panjang'), head('Lebar'), head('Lebar 2'), head('Tinggi'), head('Jumlah'), head('VOL')])
  inp.sorted.forEach((h) => {
    rows.push([{ v: `${h.item.kode} — ${h.item.uraian} (${h.item.satuan ?? '—'})`, b: true, fill: F_DIV, border: true, colspan: 8 }, {}, {}, {}, {}, {}, {}, {}])
    const vs = inp.volByItem.get(h.item.id) ?? []
    if (!vs.length) {
      rows.push([{ v: ERR, border: true, align: 'left', color: '666666' }, {}, {}, {}, {}, {}, {}, {}])
    }
    const first = rows.length + 1
    vs.forEach((v) => {
      const r = rows.length + 1
      rows.push([
        txt(v.uraian),
        txt(BENTUK_LABEL[v.bentuk] ?? v.bentuk),
        n4(v.panjang),
        n4(v.lebar),
        n4(v.lebar2),
        n4(v.tinggi),
        n4(v.jumlah),
        fx(volFormula(v.bentuk, r), volValue(v), { numFmt: NUM4, align: 'right' })
      ])
    })
    const last = rows.length
    const totalRow = rows.length + 1
    rows.push([
      ...band('Volume Item (Hasil Perhitungan)', 7, F_TOTAL),
      last >= first ? fx(`SUM(H${first}:H${last})`, h.item.volume, { b: true, numFmt: NUM4, align: 'right' }) : n4(h.item.volume, { b: true })
    ])
    // Hanya baris hasil SUM yang dirujuk sheet RAB (bila tak ada rincian, volume dari data item).
    if (last >= first) refs.vol.set(h.item.id, sn(SN_VOLUME, `H${totalRow}`))
    rows.push([])
  })
  return { name: SN_VOLUME, cols: W([34, 24, 6, 8, 9, 9, 9, 12]), rows, freeze: 3, landscape: true }
}

function volFormula(bentuk: string, r: number): string {
  if (bentuk === 'silinder') return `0.7853981633974483*D${r}^2*C${r}*G${r}`
  if (bentuk === 'trapesium') return `((D${r}+E${r})/2)*F${r}*C${r}*G${r}`
  return `D${r}*F${r}*C${r}*G${r}`
}

function volValue(v: RabVolume): number {
  const p = v.panjang ?? 0
  const l = v.lebar ?? 0
  const l2 = v.lebar2 ?? 0
  const t = v.tinggi ?? 0
  const n = v.jumlah ?? 0
  const area = v.bentuk === 'silinder' ? 0.7853981633974483 * l * l : v.bentuk === 'trapesium' ? ((l + l2) / 2) * t : l * t
  return area * p * n
}

function sheetSchedule(inp: ReportXlsxInput): Sheet {
  const rows: Cell[][] = top('6. TIME SCHEDULE', info(inp), 5)
  rows.push([head('Kode'), head('Uraian'), head('Durasi (hari)'), head('Mulai'), head('Selesai')])
  inp.schedule.rows.forEach((s) =>
    rows.push([txt(s.h.item.kode), txt(s.h.item.uraian), n4(s.dur), txt(s.mulai), txt(s.selesai)])
  )
  rows.push([...band('TOTAL', 2, F_TOTAL), n4(inp.schedule.totalDur, { b: true }), txt(inp.schedule.min, { b: true, align: 'center' }), txt(inp.schedule.max, { b: true, align: 'center' })])
  return { name: SN_SCHEDULE, cols: W([8, 30, 9, 16, 12, 25]), rows, freeze: 3 }
}

function sheetKebutuhan(inp: ReportXlsxInput, refs: Refs): Sheet {
  const rows: Cell[][] = top('7. KEBUTUHAN TENAGA KERJA, BAHAN & ALAT', info(inp), 6)
  /** Kunci komponen → nomor baris kebutuhan di sheet ini (dasar SUM tabel REKAP). */
  const byKomp = new Map<string, number[]>()
  inp.sorted.forEach((h) => {
    /** Analisa item ini (cocokkan id) — sumber KOEF. */
    const aRef = refs.analisa.get(h.item.id)
    /** Volume item: rujuk sheet RAB (atau Backup Volume), kalau tidak ada pakai angkanya. */
    const volExpr = refs.rab.get(h.item.id)?.d ?? refs.vol.get(h.item.id) ?? String(h.item.volume)
    rows.push([
      { v: `${h.item.kode} — ${h.item.uraian} · Volume ${h.item.volume ?? 0} ${h.item.satuan ?? ''}`.trim(), b: true, fill: F_DIV, border: true, colspan: 6 },
      {},
      {},
      {},
      {},
      {}
    ])
    rows.push([head('Komponen'), head('SAT'), head('KOEF'), head('Kebutuhan'), head('Harga Satuan'), head('Jumlah')])
    const komps = aggKomponen(h.komponen)
    for (let i = 0; i < komps.length; ) {
      const js = komps[i].js
      const bandRow = rows.length + 1
      const first = bandRow + 1
      rows.push([...band(komps[i].label, 5, F_SUB), {}])
      let j = i
      while (j < komps.length && komps[j].js === js) {
        const k = komps[j]
        const r = rows.length + 1
        const qty = k.koefisien * h.item.volume
        const koefRef = aRef?.koef.get(k.key)
        rows.push([
          txt(k.uraian),
          txt(k.satuan),
          // KOEF dirujuk dari sel koefisien di sheet Analisa (bila analisanya item ini sendiri).
          koefRef ? fx(koefRef, k.koefisien, { numFmt: NUM4, align: 'right' }) : n4(k.koefisien),
          // Kebutuhan = KOEF × VOL item (VOL dari sheet RAB/Backup Volume).
          fx(`C${r}*${volExpr}`, qty, { numFmt: NUM4, align: 'right' }),
          rp(k.harga_satuan),
          fx(`D${r}*E${r}`, qty * (k.harga_satuan ?? 0), { numFmt: MONEY, align: 'left' })
        ])
        const list = byKomp.get(k.key)
        if (list) list.push(r)
        else byKomp.set(k.key, [r])
        j++
      }
      const last = rows.length
      rows[bandRow - 1][5] = fx(`SUM(F${first}:F${last})`, sumKompKebutuhan(komps, i, j, h.item.volume), {
        b: true,
        numFmt: MONEY,
        align: 'left'
      })
      i = j
    }
    rows.push([])
  })

  rows.push([{ v: 'REKAP KEBUTUHAN SUMBER DAYA', b: true, sz: 11, fill: F_DIV, border: true, colspan: 4 }, {}, {}, {}])
  rows.push([head('Komponen'), head('SAT'), head('Total Kebutuhan'), head('Total Biaya')])
  const agg = inp.resourceAgg
  for (let i = 0; i < agg.length; ) {
    const js = groupOf(agg[i].jenis)
    const bandRow = rows.length + 1
    const first = bandRow + 1
    rows.push([...band(GROUP_LABEL[js], 3, F_SUB), {}, {}, {}])
    let j = i
    while (j < agg.length && groupOf(agg[j].jenis) === js) {
      const r = agg[j]
      // Total kebutuhan & biaya = SUM baris kebutuhan komponen yang sama di atas.
      const list = byKomp.get(normKompKey(r.jenis, r.uraian, r.satuan))
      rows.push([
        txt(r.uraian),
        txt(r.satuan),
        list?.length
          ? fx(`SUM(${list.map((x) => `D${x}`).join(',')})`, r.qty, { numFmt: NUM4, align: 'right' })
          : n4(r.qty),
        list?.length
          ? fx(`SUM(${list.map((x) => `F${x}`).join(',')})`, r.biaya, { numFmt: MONEY, align: 'left' })
          : rp(r.biaya),
        {},
        {}
      ])
      j++
    }
    const last = rows.length
    rows[bandRow - 1][3] = fx(`SUM(D${first}:D${last})`, agg.slice(i, j).reduce((n, r) => n + r.biaya, 0), {
      b: true,
      numFmt: MONEY,
      align: 'left'
    })
    i = j
  }
  return { name: SN_KEBUTUHAN, cols: W([44, 12, 7, 13, 12, 12]), rows, freeze: 3 }
}

// ----------------------------------------------------------- tab Progress ----

/** Rujukan antar-sheet untuk tab Progress (Ringkasan ← Progress Divisi ← Detail per Item). */
type ProgressRefs = {
  /** divisi_no → nomor baris sel "Nilai Aktual" di sheet Detail per Item. */
  aktual: Map<string, number[]>
  /** nomor baris divisi pertama & terakhir di sheet Progress Divisi. */
  divisiFirst: number
  divisiLast: number
}

const newProgressRefs = (): ProgressRefs => ({ aktual: new Map(), divisiFirst: 0, divisiLast: 0 })

function sheetProgressRingkasan(inp: ReportXlsxInput, refs: ProgressRefs): Sheet {
  const rows: Cell[][] = top('1. RINGKASAN PROGRESS', info(inp), 4)
  const s = inp.summary
  rows.push([head('Keterangan'), head('Nilai'), {}, {}])
  const rabRow = rows.length + 1
  const hasDiv = refs.divisiLast >= refs.divisiFirst && refs.divisiLast > 0
  // Nilai RAB & Terpasang = jumlah sel di sheet Progress Divisi (rumus antar-sheet).
  const sumDiv = (col: string): string => `SUM(${sn(SN_PROG_DIVISI, `${col}${refs.divisiFirst}:${col}${refs.divisiLast}`)})`
  rows.push([
    txt('Nilai RAB'),
    hasDiv ? fx(sumDiv('C'), s?.total_nilai ?? 0, { numFmt: MONEY, align: 'left' }) : rp(s?.total_nilai),
    {},
    {}
  ])
  const tpRow = rows.length + 1
  rows.push([
    txt('Terpasang'),
    hasDiv ? fx(sumDiv('D'), s?.nilai_actual ?? 0, { numFmt: MONEY, align: 'left' }) : rp(s?.nilai_actual),
    {},
    {}
  ])
  rows.push([
    txt('Progress'),
    s?.total_nilai
      ? fx(`IF(B${rabRow}=0,0,100*B${tpRow}/B${rabRow})`, s.progress_pct, { numFmt: PCT, align: 'right' })
      : pctC(s?.progress_pct),
    {},
    {}
  ])
  rows.push([])
  rows.push([{ v: 'KURVA S', b: true, sz: 11, fill: F_DIV, border: true, colspan: 4 }, {}, {}, {}])
  rows.push([head('Tanggal'), head('Progress'), head('Nilai Aktual'), {}])
  ;(s?.curve ?? []).forEach((p) => rows.push([txt(p.tanggal, { align: 'center' }), pctC(p.progress_pct), rp(p.nilai_actual), {}]))
  return { name: SN_PROG_RINGKASAN, cols: W([14, 14, 22, 14]), rows, freeze: 0 }
}

function sheetProgressDivisi(inp: ReportXlsxInput, refs: ProgressRefs): Sheet {
  const rows: Cell[][] = top('2. PROGRESS PER DIVISI', info(inp), 5)
  rows.push([head('No'), head('Divisi'), head('Nilai'), head('Terpasang'), head('Progress')])
  refs.divisiFirst = rows.length + 1
  ;(inp.summary?.divisi ?? []).forEach((d) => {
    const r = rows.length + 1
    // Terpasang = jumlah sel "Nilai Aktual" item divisi ini di sheet Detail per Item.
    const list = refs.aktual.get(String(d.divisi_no ?? ''))
    rows.push([
      txt(d.divisi_no, { align: 'center' }),
      txt(d.nama),
      rp(d.nilai),
      list?.length
        ? fx(
            `SUM(${list.map((x) => sn(SN_PROG_ITEM, `H${x}`)).join(',')})`,
            d.nilai_actual,
            { numFmt: MONEY, align: 'left' }
          )
        : rp(d.nilai_actual),
      fx(`IF(C${r}=0,0,100*D${r}/C${r})`, d.progress_pct, { numFmt: PCT, align: 'right', b: true })
    ])
  })
  refs.divisiLast = rows.length
  return { name: SN_PROG_DIVISI, cols: W([8, 42, 16, 16, 12]), rows, freeze: 3 }
}

function sheetProgressItem(inp: ReportXlsxInput, refs: ProgressRefs): Sheet {
  const rows: Cell[][] = top('3. DETAIL PER ITEM', info(inp), 8)
  rows.push([
    head('Kode'),
    head('Uraian'),
    head('SAT'),
    head('VOL'),
    head('Bobot'),
    head('Progress'),
    head('VOL AKTUAL'),
    head('Nilai Aktual')
  ])
  ;(inp.summary?.items ?? []).forEach((it) => {
    const r = rows.length + 1
    rows.push([
      txt(it.kode),
      txt(it.uraian),
      txt(it.satuan),
      n4(it.volume),
      n4(it.bobot_pct),
      it.volume_actual == null
        ? pctC(it.pct, { b: true })
        : fx(`IF(D${r}=0,0,100*G${r}/D${r})`, it.pct, { numFmt: PCT, align: 'right', b: true }),
      n4(it.volume_actual),
      rp(it.nilai_actual)
    ])
    // Kumpulkan baris per divisi supaya sheet Progress Divisi bisa menjumlahkannya.
    const dv = String(it.divisi_no ?? '')
    const list = refs.aktual.get(dv)
    if (list) list.push(r)
    else refs.aktual.set(dv, [r])
  })
  return { name: SN_PROG_ITEM, cols: W([8, 50, 7, 9, 9, 9, 11, 14]), rows, freeze: 3 }
}

// ------------------------------------------------------------------ helpers ----

const info = (inp: ReportXlsxInput): string =>
  `Proyek: ${inp.projectName}${inp.projectCode ? ` (${inp.projectCode})` : ''} · ${inp.rabName} · Dicetak: ${inp.printed}`

const fmtPctNum = (n: number): string => String(Math.round(n * 100) / 100)

function sumAnalisa(komps: ReturnType<typeof aggKomponen>, from: number, to: number): number {
  let n = 0
  for (let i = from; i < to; i++) n += komps[i].koefisien * (komps[i].harga_satuan ?? 0)
  return n
}

function sumKompKebutuhan(komps: ReturnType<typeof aggKomponen>, from: number, to: number, volume: number): number {
  let n = 0
  for (let i = from; i < to; i++) n += komps[i].koefisien * volume * (komps[i].harga_satuan ?? 0)
  return n
}

/**
 * Satu sheet per seksi laporan.
 * Sheet dibangun menurut urutan ketergantungan rumus antar-sheet:
 * Backup Volume (VOL) → Analisa (harga satuan & KOEF) → RAB (VOL, harga satuan, subtotal divisi)
 * → Rekapitulasi, BOQ, dan Kebutuhan (semuanya merujuk RAB/Analisa).
 */
export function buildReportSheets(inp: ReportXlsxInput): Sheet[] {
  if (inp.tab === 'progress') {
    // Urutan bangun: Detail per Item (Nilai Aktual) → Progress Divisi → Ringkasan Progress.
    const pref = newProgressRefs()
    const item = sheetProgressItem(inp, pref)
    const divisi = sheetProgressDivisi(inp, pref)
    const ringkasan = sheetProgressRingkasan(inp, pref)
    // Urutan sheet tetap mengikuti urutan seksi laporan (1..3).
    return [ringkasan, divisi, item]
  }
  const refs = newRefs()
  const volume = sheetVolume(inp, refs)
  const analisa = sheetAnalisa(inp, refs)
  const rab = sheetRab(inp, refs)
  const rekap = sheetRekap(inp, refs)
  const boq = sheetBoq(inp, refs)
  const schedule = sheetSchedule(inp)
  const kebutuhan = sheetKebutuhan(inp, refs)
  // Urutan sheet tetap mengikuti urutan seksi laporan (1..7).
  return [rekap, rab, boq, analisa, volume, schedule, kebutuhan]
}

/** Berkas .xlsx (base64) berisi satu sheet per seksi laporan. */
export function buildReportWorkbook(inp: ReportXlsxInput): string {
  return buildWorkbook(buildReportSheets(inp))
}
