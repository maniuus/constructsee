/**
 * Parsing angka yang ramah masukan Indonesia.
 *
 * Aturan:
 * - Koma dianggap desimal: `1,5` → 1.5
 * - Titik + koma: pemisah terakhir yang menang (`1.234,56` → 1234.56, `1,234.56` → 1234.56)
 * - Titik saja: kelompok ribuan bila pola `1.234` / `1.234.567`, selain itu desimal (`1.5` → 1.5)
 * - Spasi dan awalan "Rp" diabaikan
 *
 * Hasil `ok: true` dengan `value: null` berarti kolom kosong (bukan error).
 */
export type NumParse = { ok: true; value: number | null } | { ok: false; message: string }

export function isBlank(raw: string): boolean {
  return raw.replace(/rp/gi, '').replace(/\s/g, '') === ''
}

export function parseNum(raw: string): NumParse {
  const s = raw.replace(/rp/gi, '').replace(/\s/g, '')
  if (s === '') return { ok: true, value: null }
  if (!/^[+-]?[\d.,]+$/.test(s)) {
    return { ok: false, message: `"${raw.trim()}" bukan angka yang valid.` }
  }

  let body = s
  const comma = body.lastIndexOf(',')
  const dot = body.lastIndexOf('.')
  if (comma >= 0 && dot >= 0) {
    // Pemisah yang muncul terakhir adalah desimal.
    if (comma > dot) body = body.replace(/\./g, '').replace(',', '.')
    else body = body.replace(/,/g, '')
  } else if (comma >= 0) {
    body = body.replace(/,/g, '.')
  } else if (dot >= 0) {
    // Titik ribuan hanya bila semua kelompok setelah titik tepat 3 digit.
    body = /^[+-]?\d{1,3}(\.\d{3})+$/.test(body) ? body.replace(/\./g, '') : body
  }

  const n = Number(body)
  if (!Number.isFinite(n)) {
    return { ok: false, message: `"${raw.trim()}" bukan angka yang valid.` }
  }
  return { ok: true, value: n }
}

/** Tampilkan angka untuk `<input>`: koma desimal, tanpa pemisah ribuan. */
export function toInputNum(n: number | null | undefined): string {
  if (n == null) return ''
  return String(n).replace('.', ',')
}
