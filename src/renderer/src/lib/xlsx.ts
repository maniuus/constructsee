/**
 * Penulis berkas .xlsx minimal tanpa dependency apa pun.
 *
 * Isi paket: ZIP (metode "stored" + CRC32) berisi bagian OOXML
 * ([Content_Types].xml, _rels/.rels, xl/workbook.xml, xl/_rels/workbook.xml.rels,
 * xl/styles.xml, xl/worksheets/sheetN.xml).
 *
 * `buildWorkbook()` mengembalikan string base64 yang siap dikirim ke Rust
 * (`report_save_bytes`) untuk ditulis sebagai berkas .xlsx.
 */

export type Align = 'left' | 'center' | 'right'
export type VAlign = 'top' | 'middle' | 'bottom'

export type Cell = {
  /** Nilai sel (teks atau angka). Bila `f` diisi, `v` = hasil hitung tersimpan. */
  v?: string | number | null
  /** Rumus Excel tanpa tanda '=' (mis. `E5*D5`). */
  f?: string
  b?: boolean
  i?: boolean
  /** Ukuran huruf (pt). */
  sz?: number
  /** Warna huruf, mis. '#111111'. */
  color?: string
  /** Warna latar, mis. '#EEEEEE'. */
  fill?: string
  align?: Align
  valign?: VAlign
  wrap?: boolean
  /** Kotak garis tipis di keempat sisi. */
  border?: boolean
  /** Format angka, mis. `"Rp"* #,##0`. */
  numFmt?: string
  /** Jumlah kolom yang digabung (merge) mulai dari sel ini. */
  colspan?: number
}

export type Sheet = {
  name: string
  /** Lebar kolom dalam satuan Excel (1 satuan ≈ lebar satu aksara). */
  cols?: number[]
  rows: Cell[][]
  /** Bekukan baris sebanyak ini saat dibuka. */
  freeze?: number
  landscape?: boolean
  /** Tinggi baris khusus: 1-based row index → tinggi (pt). */
  heights?: Record<number, number>
}

const BASE_FONT = 'Times New Roman'
const BASE_SIZE = 10

const XML_HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n'

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function colName(index: number): string {
  let n = index + 1
  let out = ''
  while (n > 0) {
    const r = (n - 1) % 26
    out = String.fromCharCode(65 + r) + out
    n = Math.floor((n - 1) / 26)
  }
  return out
}

function num(v: number): string {
  if (!Number.isFinite(v)) return '0'
  return String(v)
}

/** Rumus diketik lewat `f` (tanpa '='); hasil hitung `v` dipakai sebagai nilai tersimpan. */
function cellXml(ref: string, cell: Cell | undefined, styleId: number): string {
  if (!cell) return `<c r="${ref}"/>`
  // styleId 0 tetap harus ditulis: xfs[0] bisa jadi style nyata (bold+fill), bukan default.
  const s = ` s="${styleId}"`
  if (cell.f != null) {
    const cached = cell.v == null ? '' : `<v>${typeof cell.v === 'number' ? num(cell.v) : esc(String(cell.v))}</v>`
    return `<c r="${ref}"${s}><f>${esc(cell.f)}</f>${cached}</c>`
  }
  if (cell.v == null || cell.v === '') return `<c r="${ref}"${s}/>`
  if (typeof cell.v === 'number') return `<c r="${ref}"${s}><v>${num(cell.v)}</v></c>`
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${esc(cell.v)}</t></is></c>`
}

// ---------------------------------------------------------------- styles ----

type StyleTable = {
  numFmts: string[]
  fonts: string[]
  fills: string[]
  borders: string[]
  xfs: string[]
  numFmtId: Map<string, number>
  fontId: Map<string, number>
  fillId: Map<string, number>
  borderId: Map<string, number>
  xfId: Map<string, number>
}

function newStyleTable(): StyleTable {
  return {
    numFmts: [],
    fonts: [`<font><sz val="${BASE_SIZE}"/><name val="${BASE_FONT}"/><family val="1"/></font>`],
    fills: ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>'],
    borders: ['<border><left/><right/><top/><bottom/><diagonal/></border>'],
    xfs: [],
    numFmtId: new Map(),
    fontId: new Map([['default', 0]]),
    fillId: new Map([['none', 0]]),
    borderId: new Map([['none', 0]]),
    xfId: new Map()
  }
}

function thinBorder(): string {
  const side = (tag: string): string => `<${tag} style="thin"><color rgb="FF000000"/></${tag}>`
  return `<border>${side('left')}${side('right')}${side('top')}${side('bottom')}<diagonal/></border>`
}

function styleIdFor(t: StyleTable, cell: Cell | undefined): number {
  const key = JSON.stringify([
    cell?.b ?? false,
    cell?.i ?? false,
    cell?.sz ?? 0,
    cell?.color ?? '',
    cell?.fill ?? '',
    cell?.border ?? false,
    cell?.numFmt ?? '',
    cell?.align ?? '',
    cell?.valign ?? '',
    cell?.wrap ?? false
  ])
  const cached = t.xfId.get(key)
  if (cached != null) return cached

  const fontKey = JSON.stringify([cell?.b ?? false, cell?.i ?? false, cell?.sz ?? 0, cell?.color ?? ''])
  let fi = t.fontId.get(fontKey)
  if (fi == null) {
    const parts = [`<sz val="${cell?.sz ?? BASE_SIZE}"/>`]
    if (cell?.color) parts.push(`<color rgb="FF${cell.color.replace('#', '').toUpperCase()}"/>`)
    if (cell?.b) parts.push('<b/>')
    if (cell?.i) parts.push('<i/>')
    parts.push(`<name val="${BASE_FONT}"/><family val="1"/>`)
    fi = t.fonts.length
    t.fonts.push(`<font>${parts.join('')}</font>`)
    t.fontId.set(fontKey, fi)
  }

  // Tanpa fill → fills[0] ("none"). Kunci 'none' sudah ada di map, JANGAN pakai '' (bikin fill rusak rgb="FF").
  const fillKey = cell?.fill ? cell.fill.replace('#', '').toUpperCase() : 'none'
  let fli = t.fillId.get(fillKey)
  if (fli == null) {
    fli = t.fills.length
    t.fills.push(
      `<fill><patternFill patternType="solid"><fgColor rgb="FF${fillKey}"/><bgColor indexed="64"/></patternFill></fill>`
    )
    t.fillId.set(fillKey, fli)
  }

  const borderKey = cell?.border ? 'thin' : 'none'
  let bi = t.borderId.get(borderKey)
  if (bi == null) {
    bi = t.borders.length
    t.borders.push(cell?.border ? thinBorder() : '<border><left/><right/><top/><bottom/><diagonal/></border>')
    t.borderId.set(borderKey, bi)
  }

  let nfi = 0
  if (cell?.numFmt) {
    const fmt = cell.numFmt
    const known = t.numFmtId.get(fmt)
    if (known != null) {
      nfi = known
    } else {
      nfi = 164 + t.numFmts.length
      t.numFmts.push(`<numFmt numFmtId="${nfi}" formatCode="${esc(fmt)}"/>`)
      t.numFmtId.set(fmt, nfi)
    }
  }

  const align: string[] = []
  if (cell?.align) align.push(`horizontal="${cell.align}"`)
  if (cell?.valign) align.push(`vertical="${cell.valign}"`)
  if (cell?.wrap) align.push('wrapText="1"')
  const alignAttr = align.length ? `<alignment ${align.join(' ')}/>` : ''

  const id = t.xfs.length
  t.xfs.push(
    `<xf numFmtId="${nfi}" fontId="${fi}" fillId="${fli}" borderId="${bi}" xfId="0"` +
      ` applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"` +
      (nfi ? ' applyNumberFormat="1"' : '') +
      `>${alignAttr}</xf>`
  )
  t.xfId.set(key, id)
  return id
}

function stylesXml(t: StyleTable): string {
  return (
    XML_HEADER +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    (t.numFmts.length ? `<numFmts count="${t.numFmts.length}">${t.numFmts.join('')}</numFmts>` : '') +
    `<fonts count="${t.fonts.length}">${t.fonts.join('')}</fonts>` +
    `<fills count="${t.fills.length}">${t.fills.join('')}</fills>` +
    `<borders count="${t.borders.length}">${t.borders.join('')}</borders>` +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    `<cellXfs count="${t.xfs.length}">${t.xfs.join('')}</cellXfs>` +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
    '<dxfs count="0"/>' +
    '<tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/>' +
    '</styleSheet>'
  )
}

// ------------------------------------------------------------- worksheet ----

function sheetXml(sheet: Sheet, t: StyleTable): string {
  const rows: string[] = []
  sheet.rows.forEach((cells, ri) => {
    const rowNo = ri + 1
    const ht = sheet.heights?.[rowNo]
    const rowCells = cells
      .map((c, ci) => (c === undefined ? '' : cellXml(`${colName(ci)}${rowNo}`, c, styleIdFor(t, c))))
      .join('')
    rows.push(`<row r="${rowNo}"${ht ? ` ht="${ht}" customHeight="1"` : ''}>${rowCells}</row>`)
  })

  const merges: string[] = []
  sheet.rows.forEach((cells, ri) => {
    cells.forEach((c, ci) => {
      if (c?.colspan && c.colspan > 1) {
        merges.push(`${colName(ci)}${ri + 1}:${colName(ci + c.colspan - 1)}${ri + 1}`)
      }
    })
  })

  const cols = sheet.cols
    ? `<cols>${sheet.cols
        .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`)
        .join('')}</cols>`
    : ''

  const freeze = sheet.freeze
    ? `<sheetView workbookViewId="0"><pane ySplit="${sheet.freeze}" topLeftCell="A${sheet.freeze + 1}" activePane="bottomLeft" state="frozen"/></sheetView>`
    : '<sheetView workbookViewId="0"/>'

  return (
    XML_HEADER +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>' +
    freeze +
    '<sheetFormatPr defaultRowHeight="14"/>' +
    cols +
    `<sheetData>${rows.join('')}</sheetData>` +
    (merges.length ? `<mergeCells count="${merges.length}">${merges.map((m) => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>` : '') +
    '<pageMargins left="0.5" right="0.5" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>' +
    `<pageSetup paperSize="9" orientation="${sheet.landscape ? 'landscape' : 'portrait'}" fitToWidth="1" fitToHeight="0"/>` +
    '</worksheet>'
  )
}

// ------------------------------------------------------------------ zip ----

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[i] = c >>> 0
  }
  return table
})()

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function dosStamp(d: Date): { time: number; date: number } {
  const time = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2)
  const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()
  return { time, date }
}

function zip(entries: { name: string; data: Uint8Array }[]): Uint8Array {
  const enc = new TextEncoder()
  const stamp = dosStamp(new Date())
  const parts: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0

  for (const entry of entries) {
    const name = enc.encode(entry.name)
    const data = entry.data
    const crc = crc32(data)

    const local = new Uint8Array(30 + name.length)
    const lv = new DataView(local.buffer)
    lv.setUint32(0, 0x04034b50, true)
    lv.setUint16(4, 20, true)
    lv.setUint16(6, 0x0800, true)
    lv.setUint16(8, 0, true)
    lv.setUint16(10, stamp.time, true)
    lv.setUint16(12, stamp.date, true)
    lv.setUint32(14, crc, true)
    lv.setUint32(18, data.length, true)
    lv.setUint32(22, data.length, true)
    lv.setUint16(26, name.length, true)
    lv.setUint16(28, 0, true)
    local.set(name, 30)
    parts.push(local, data)

    const cd = new Uint8Array(46 + name.length)
    const cv = new DataView(cd.buffer)
    cv.setUint32(0, 0x02014b50, true)
    cv.setUint16(4, 20, true)
    cv.setUint16(6, 20, true)
    cv.setUint16(8, 0x0800, true)
    cv.setUint16(10, 0, true)
    cv.setUint16(12, stamp.time, true)
    cv.setUint16(14, stamp.date, true)
    cv.setUint32(16, crc, true)
    cv.setUint32(20, data.length, true)
    cv.setUint32(24, data.length, true)
    cv.setUint16(28, name.length, true)
    cv.setUint32(42, offset, true)
    cd.set(name, 46)
    central.push(cd)

    offset += local.length + data.length
  }

  const cdSize = central.reduce((n, c) => n + c.length, 0)
  const eocd = new Uint8Array(22)
  const ev = new DataView(eocd.buffer)
  ev.setUint32(0, 0x06054b50, true)
  ev.setUint16(8, entries.length, true)
  ev.setUint16(10, entries.length, true)
  ev.setUint32(12, cdSize, true)
  ev.setUint32(16, offset, true)

  const total = parts.reduce((n, p) => n + p.length, 0) + cdSize + eocd.length
  const out = new Uint8Array(total)
  let at = 0
  for (const part of parts) {
    out.set(part, at)
    at += part.length
  }
  for (const part of central) {
    out.set(part, at)
    at += part.length
  }
  out.set(eocd, at)
  return out
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

function toBase64(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i]
    const b1 = bytes[i + 1]
    const b2 = bytes[i + 2]
    out += B64[b0 >> 2]
    out += B64[((b0 & 3) << 4) | ((b1 ?? 0) >> 4)]
    out += b1 === undefined ? '=' : B64[((b1 & 15) << 2) | ((b2 ?? 0) >> 6)]
    out += b2 === undefined ? '=' : B64[b2 & 63]
  }
  return out
}

// -------------------------------------------------------------- workbook ----

function safeSheetName(name: string, used: Set<string>): string {
  let base = name.replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 31)
  if (!base) base = 'Sheet'
  let out = base
  let i = 2
  while (used.has(out)) {
    const suffix = ` (${i++})`
    out = base.slice(0, 31 - suffix.length) + suffix
  }
  used.add(out)
  return out
}

/** Bangun berkas .xlsx (satu Sheet = satu lembar) dan kembalikan isinya sebagai base64. */
export function buildWorkbook(sheets: Sheet[]): string {
  const enc = new TextEncoder()
  const table = newStyleTable()
  const used = new Set<string>()
  const names = sheets.map((s) => safeSheetName(s.name, used))

  const files: { name: string; data: Uint8Array }[] = []
  const add = (name: string, xml: string): void => {
    files.push({ name, data: enc.encode(xml) })
  }

  sheets.forEach((sheet, i) => add(`xl/worksheets/sheet${i + 1}.xml`, sheetXml(sheet, table)))
  add('xl/styles.xml', stylesXml(table))

  const sheetTags = names
    .map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
    .join('')
  add(
    'xl/workbook.xml',
    XML_HEADER +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      `<sheets>${sheetTags}</sheets>` +
      '<calcPr calcId="181029" fullCalcOnLoad="1"/>' +
      '</workbook>'
  )

  const styleRid = sheets.length + 1
  add(
    'xl/_rels/workbook.xml.rels',
    XML_HEADER +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      names
        .map(
          (_, i) =>
            `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`
        )
        .join('') +
      `<Relationship Id="rId${styleRid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
      '</Relationships>'
  )

  add(
    '_rels/.rels',
    XML_HEADER +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
      '</Relationships>'
  )

  add(
    '[Content_Types].xml',
    XML_HEADER +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      names
        .map(
          (_, i) =>
            `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
        )
        .join('') +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      '</Types>'
  )

  // [Content_Types].xml harus jadi entri pertama agar dikenali pembaca lain.
  files.sort((a, b) => (a.name.startsWith('[') ? -1 : b.name.startsWith('[') ? 1 : 0))
  return toBase64(zip(files))
}
