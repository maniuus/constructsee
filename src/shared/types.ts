// Tipe bersama Constructsee — dipakai renderer (TS) dan disalin ke Rust types.rs.
// Semua nama field snake_case agar cocok langsung dengan serde tanpa rename.

export type ProjectStatus = 'perencanaan' | 'berlangsung' | 'selesai' | 'bermasalah'

export interface Project {
  id: number
  kode: string
  nama: string
  klien: string | null
  konsultan: string | null
  nilai_kontrak: number | null
  jenis: string | null
  lokasi_prov: string | null
  lokasi_kab: string | null
  lokasi_alamat: string | null
  status: string
  tanggal_mulai: string | null
  tanggal_selesai: string | null
  masa_pemeliharaan: number | null
  keterangan: string | null
  created_at: string
  updated_at: string
}

export interface ProjectInput {
  kode: string
  nama: string
  klien?: string | null
  konsultan?: string | null
  nilai_kontrak?: number | null
  jenis?: string | null
  lokasi_prov?: string | null
  lokasi_kab?: string | null
  lokasi_alamat?: string | null
  status?: string | null
  tanggal_mulai?: string | null
  tanggal_selesai?: string | null
  masa_pemeliharaan?: number | null
  keterangan?: string | null
}

export interface ContractTimeline {
  project_id: number
  tgl_kontrak: string | null
  tgl_spmk: string | null
  tgl_mulai_kerja: string | null
  tgl_selesai_rencana: string | null
  tgl_pho: string | null
  tgl_fho: string | null
  perpanjangan_hari: number | null
  masa_pemeliharaan_selesai: string | null
  catatan: string | null
}

export interface TimelineInput {
  tgl_kontrak?: string | null
  tgl_spmk?: string | null
  tgl_mulai_kerja?: string | null
  tgl_selesai_rencana?: string | null
  tgl_pho?: string | null
  tgl_fho?: string | null
  perpanjangan_hari?: number | null
  masa_pemeliharaan_selesai?: string | null
  catatan?: string | null
}

export interface ProjectOrg {
  id: number
  project_id: number
  nama: string
  jabatan: string | null
  institusi: string | null
  telepon: string | null
  email: string | null
  pos: number
}

export interface OrgInput {
  nama: string
  jabatan?: string | null
  institusi?: string | null
  telepon?: string | null
  email?: string | null
}

export interface ProjectDetail {
  project: Project
  timeline: ContractTimeline | null
  orgs: ProjectOrg[]
}

export interface AppInfo {
  project_count: number
}

// ---------- RAB ----------

export interface Rab {
  id: number
  project_id: number
  nama: string
  ppn_pct: number
  status: string
  catatan: string | null
  created_at: string
  updated_at: string
}

export interface RabItem {
  id: number
  rab_id: number
  ref_item_id: number | null
  kode: string | null
  uraian: string
  satuan: string | null
  volume: number
  level: number
  is_user: number
  divisi_no: string | null
  overhead_pct: number
  pos: number
  durasi_hari: number | null
  tgl_mulai: string | null
}

export interface RabKomponen {
  id: number
  rab_item_id: number
  jenis: string | null
  uraian: string | null
  kode: string | null
  satuan: string | null
  koefisien: number | null
  harga_satuan: number | null
  pos: number
}

export interface RabDetail {
  rab: Rab
  items: RabItem[]
}

export interface HitungKomponen {
  id: number
  rab_item_id: number
  jenis: string | null
  uraian: string | null
  kode: string | null
  satuan: string | null
  koefisien: number | null
  harga_satuan: number | null
  harga_jumlah: number | null
  pos: number
}

export interface HitungSubtotal {
  a: number
  b: number
  c: number
  d: number
  e: number
  f: number
}

export interface HitungResult {
  item: RabItem
  komponen: HitungKomponen[]
  subtotal: HitungSubtotal
  overhead_pct: number
  total: number
}

export interface RekapRow {
  divisi_no: string | null
  nama: string
  total: number
}

export interface RabRekap {
  rows: RekapRow[]
  subtotal: number
  ppn_pct: number
  ppn: number
  total: number
}

// ---------- Referensi AHSP (read-only) ----------

export interface RefSource {
  id: number
  kode: string
  nama: string
  jenis: string | null
  bidang: string | null
  status: string | null
  as_of: string | null
}

export interface RefDivisi {
  id: number
  no: string
  nama: string
  item_count: number
}

export interface RefItem {
  id: number
  kode: string
  uraian: string
  satuan: string | null
  level: number
  divisi_no: string | null
  divisi_nama: string | null
}

export interface RefKomponen {
  id: number
  jenis: string | null
  uraian: string | null
  kode: string | null
  satuan: string | null
  koefisien: number | null
  harga_satuan: number | null
  pos: number
}

export interface RefItemDetail {
  item: RefItem
  komponen: RefKomponen[]
}

export interface RefMaster {
  id: number
  jenis: string | null
  uraian: string | null
  kode: string | null
  satuan: string | null
  harga_satuan: number | null
}

// ---------- Master Data ----------

// Katalog resource terpadu: bahan + alat + tenaga kerja
export interface MasterKatalog {
  id: number
  jenis: string
  kode: string | null
  nama: string
  satuan: string | null
  suplier: string | null
  brand: string | null
  harga_acuan: number | null
  catatan: string | null
  created_at: string
  updated_at: string
}

export interface MasterKatalogInput {
  id?: number | null
  jenis?: string | null
  kode?: string | null
  nama: string
  satuan?: string | null
  suplier?: string | null
  brand?: string | null
  harga_acuan?: number | null
  catatan?: string | null
}

export interface MkatalogImportResult {
  total: number
  inserted: number
  skipped: number
}

export interface Subkontraktor {
  id: number
  nama: string
  npwp: string | null
  kualifikasi: string | null
  spesialisasi: string | null
  kontak: string | null
  telepon: string | null
  email: string | null
  rating: number | null
  catatan: string | null
  created_at: string
  updated_at: string
}

export interface SubkontraktorInput {
  id?: number | null
  nama: string
  npwp?: string | null
  kualifikasi?: string | null
  spesialisasi?: string | null
  kontak?: string | null
  telepon?: string | null
  email?: string | null
  rating?: number | null
  catatan?: string | null
}

export interface Pekerjaan {
  id: number
  nama: string
  satuan: string | null
  kode_ahsp: string | null
  divisi_no: string | null
  harga_acuan: number | null
  catatan: string | null
  created_at: string
  updated_at: string
}

export interface PekerjaanInput {
  id?: number | null
  nama: string
  satuan?: string | null
  kode_ahsp?: string | null
  divisi_no?: string | null
  harga_acuan?: number | null
  catatan?: string | null
}

export interface PekerjaanImportResult {
  total: number
  inserted: number
  skipped: number
}

export interface KatalogRow {
  jenis: string
  uraian: string
  harga: number | null
  updated_at: string | null
}

export interface KatalogInput {
  jenis: string
  uraian: string
  harga?: number | null
}

// ---------- Progress (progress harian per item RAB) ----------

export interface ProgressEntry {
  id: number
  item_id: number
  tanggal: string
  pct: number
  volume: number | null
  keterangan: string | null
  created_at: string
}

export interface ProgressInput {
  item_id: number
  tanggal: string
  pct: number
  volume?: number | null
  keterangan?: string | null
}

export interface ProgressItemRow {
  item_id: number
  kode: string | null
  uraian: string
  satuan: string | null
  volume: number
  nilai: number
  bobot_pct: number
  pct: number
  volume_actual: number | null
  nilai_actual: number
  divisi_no: string | null
  last_tanggal: string | null
}

export interface ProgressDivisiRow {
  divisi_no: string
  nama: string
  nilai: number
  nilai_actual: number
  progress_pct: number
}

export interface ProgressPoint {
  tanggal: string
  progress_pct: number
  nilai_actual: number
}

export interface ProgressSummary {
  rab_id: number
  total_nilai: number
  nilai_actual: number
  progress_pct: number
  items: ProgressItemRow[]
  divisi: ProgressDivisiRow[]
  curve: ProgressPoint[]
}

// ---------- Legal & Document Administration ----------

export interface Document {
  id: number
  project_id: number
  kategori: string
  arah: string | null
  nomor: string | null
  judul: string
  tanggal: string | null
  dari_pihak: string | null
  kepada_pihak: string | null
  instansi: string | null
  status: string
  masa_berlaku_dari: string | null
  masa_berlaku_sampai: string | null
  reminder_days: number | null
  keterangan: string | null
  created_at: string
  updated_at: string
}

export interface DocumentInput {
  id?: number | null
  project_id: number
  kategori?: string | null
  arah?: string | null
  nomor?: string | null
  judul: string
  tanggal?: string | null
  dari_pihak?: string | null
  kepada_pihak?: string | null
  instansi?: string | null
  status?: string | null
  masa_berlaku_dari?: string | null
  masa_berlaku_sampai?: string | null
  reminder_days?: number | null
  keterangan?: string | null
}

export interface StatusCount {
  status: string
  count: number
}

export interface DashboardProjectRow {
  id: number
  kode: string
  nama: string
  status: string
  klien: string | null
  nilai_kontrak: number | null
  rab_count: number
  rab_total: number
  progress_pct: number
  margin_pct: number | null
  dokumen_count: number
  dokumen_expiring: number
  last_progress: string | null
}

export interface DashboardSummary {
  project_count: number
  total_nilai_kontrak: number
  total_rab: number
  total_dokumen: number
  expiring_count: number
  progress_pct: number
  by_status: StatusCount[]
  projects: DashboardProjectRow[]
}

export interface RabVolume {
  id: number
  item_id: number
  uraian: string | null
  bentuk: string
  panjang: number | null
  lebar: number | null
  lebar2: number | null
  tinggi: number | null
  jumlah: number | null
  pos: number
  created_at: string
  updated_at: string
}

export interface VolumeInput {
  item_id: number
  id?: number | null
  uraian?: string | null
  bentuk?: string | null
  panjang?: number | null
  lebar?: number | null
  lebar2?: number | null
  tinggi?: number | null
  jumlah?: number | null
  pos?: number | null
}
