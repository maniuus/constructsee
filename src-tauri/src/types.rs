use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize)]
pub struct Project {
    pub id: i64,
    pub kode: String,
    pub nama: String,
    pub klien: Option<String>,
    pub konsultan: Option<String>,
    pub nilai_kontrak: Option<f64>,
    pub jenis: Option<String>,
    pub lokasi_prov: Option<String>,
    pub lokasi_kab: Option<String>,
    pub lokasi_alamat: Option<String>,
    pub status: String,
    pub tanggal_mulai: Option<String>,
    pub tanggal_selesai: Option<String>,
    pub masa_pemeliharaan: Option<i64>,
    pub keterangan: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct ProjectInput {
    pub kode: String,
    pub nama: String,
    #[serde(default)]
    pub klien: Option<String>,
    #[serde(default)]
    pub konsultan: Option<String>,
    #[serde(default)]
    pub nilai_kontrak: Option<f64>,
    #[serde(default)]
    pub jenis: Option<String>,
    #[serde(default)]
    pub lokasi_prov: Option<String>,
    #[serde(default)]
    pub lokasi_kab: Option<String>,
    #[serde(default)]
    pub lokasi_alamat: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub tanggal_mulai: Option<String>,
    #[serde(default)]
    pub tanggal_selesai: Option<String>,
    #[serde(default)]
    pub masa_pemeliharaan: Option<i64>,
    #[serde(default)]
    pub keterangan: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ContractTimeline {
    pub project_id: i64,
    pub tgl_kontrak: Option<String>,
    pub tgl_spmk: Option<String>,
    pub tgl_mulai_kerja: Option<String>,
    pub tgl_selesai_rencana: Option<String>,
    pub tgl_pho: Option<String>,
    pub tgl_fho: Option<String>,
    pub perpanjangan_hari: Option<i64>,
    pub masa_pemeliharaan_selesai: Option<String>,
    pub catatan: Option<String>,
}

#[derive(Debug, Deserialize, Default)]
pub struct TimelineInput {
    #[serde(default)]
    pub tgl_kontrak: Option<String>,
    #[serde(default)]
    pub tgl_spmk: Option<String>,
    #[serde(default)]
    pub tgl_mulai_kerja: Option<String>,
    #[serde(default)]
    pub tgl_selesai_rencana: Option<String>,
    #[serde(default)]
    pub tgl_pho: Option<String>,
    #[serde(default)]
    pub tgl_fho: Option<String>,
    #[serde(default)]
    pub perpanjangan_hari: Option<i64>,
    #[serde(default)]
    pub masa_pemeliharaan_selesai: Option<String>,
    #[serde(default)]
    pub catatan: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ProjectOrg {
    pub id: i64,
    pub project_id: i64,
    pub nama: String,
    pub jabatan: Option<String>,
    pub institusi: Option<String>,
    pub telepon: Option<String>,
    pub email: Option<String>,
    pub pos: i64,
}

#[derive(Debug, Deserialize)]
pub struct OrgInput {
    pub nama: String,
    #[serde(default)]
    pub jabatan: Option<String>,
    #[serde(default)]
    pub institusi: Option<String>,
    #[serde(default)]
    pub telepon: Option<String>,
    #[serde(default)]
    pub email: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ProjectDetail {
    pub project: Project,
    pub timeline: Option<ContractTimeline>,
    pub orgs: Vec<ProjectOrg>,
}

#[derive(Debug, Serialize)]
pub struct AppInfo {
    pub project_count: i64,
}

// ---------- RAB ----------

#[derive(Debug, Serialize)]
pub struct Rab {
    pub id: i64,
    pub project_id: i64,
    pub nama: String,
    pub ppn_pct: f64,
    pub status: String,
    pub catatan: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize)]
pub struct RabItem {
    pub id: i64,
    pub rab_id: i64,
    pub ref_item_id: Option<i64>,
    pub kode: Option<String>,
    pub uraian: String,
    pub satuan: Option<String>,
    pub volume: f64,
    pub level: i64,
    pub is_user: i64,
    pub divisi_no: Option<String>,
    pub overhead_pct: f64,
    pub pos: i64,
    pub durasi_hari: Option<f64>,
    pub tgl_mulai: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct RabKomponen {
    pub id: i64,
    pub rab_item_id: i64,
    pub jenis: Option<String>,
    pub uraian: Option<String>,
    pub kode: Option<String>,
    pub satuan: Option<String>,
    pub koefisien: Option<f64>,
    pub harga_satuan: Option<f64>,
    pub pos: i64,
}

#[derive(Debug, Serialize)]
pub struct RabDetail {
    pub rab: Rab,
    pub items: Vec<RabItem>,
}

#[derive(Debug, Serialize)]
pub struct HitungKomponen {
    pub id: i64,
    pub rab_item_id: i64,
    pub jenis: Option<String>,
    pub uraian: Option<String>,
    pub kode: Option<String>,
    pub satuan: Option<String>,
    pub koefisien: Option<f64>,
    pub harga_satuan: Option<f64>,
    pub harga_jumlah: Option<f64>,
    pub pos: i64,
}

#[derive(Debug, Serialize)]
pub struct HitungSubtotal {
    pub a: f64,
    pub b: f64,
    pub c: f64,
    pub d: f64,
    pub e: f64,
    pub f: f64,
}

#[derive(Debug, Serialize)]
pub struct HitungResult {
    pub item: RabItem,
    pub komponen: Vec<HitungKomponen>,
    pub subtotal: HitungSubtotal,
    pub overhead_pct: f64,
    pub total: f64,
}

#[derive(Debug, Serialize)]
pub struct RekapRow {
    pub divisi_no: Option<String>,
    pub nama: String,
    pub total: f64,
}

#[derive(Debug, Serialize)]
pub struct RabRekap {
    pub rows: Vec<RekapRow>,
    pub subtotal: f64,
    pub ppn_pct: f64,
    pub ppn: f64,
    pub total: f64,
}

// ---------- Referensi AHSP (read-only) ----------

#[derive(Debug, Serialize)]
pub struct RefSource {
    pub id: i64,
    pub kode: String,
    pub nama: String,
    pub jenis: Option<String>,
    pub bidang: Option<String>,
    pub status: Option<String>,
    pub as_of: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct RefDivisi {
    pub id: i64,
    pub no: String,
    pub nama: String,
    pub item_count: i64,
}

#[derive(Debug, Serialize)]
pub struct RefItem {
    pub id: i64,
    pub kode: String,
    pub uraian: String,
    pub satuan: Option<String>,
    pub level: i64,
    pub divisi_no: Option<String>,
    pub divisi_nama: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct RefKomponen {
    pub id: i64,
    pub jenis: Option<String>,
    pub uraian: Option<String>,
    pub kode: Option<String>,
    pub satuan: Option<String>,
    pub koefisien: Option<f64>,
    pub harga_satuan: Option<f64>,
    pub pos: i64,
}

#[derive(Debug, Serialize)]
pub struct RefItemDetail {
    pub item: RefItem,
    pub komponen: Vec<RefKomponen>,
}

#[derive(Debug, Serialize)]
pub struct RefMaster {
    pub id: i64,
    pub jenis: Option<String>,
    pub uraian: Option<String>,
    pub kode: Option<String>,
    pub satuan: Option<String>,
    pub harga_satuan: Option<f64>,
}

// ---------- Master Data ----------

// Katalog resource terpadu: bahan + alat + tenaga kerja
#[derive(Debug, Serialize)]
pub struct MasterKatalog {
    pub id: i64,
    pub jenis: String,
    pub kode: Option<String>,
    pub nama: String,
    pub satuan: Option<String>,
    pub suplier: Option<String>,
    pub brand: Option<String>,
    pub harga_acuan: Option<f64>,
    pub catatan: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct MasterKatalogInput {
    #[serde(default)]
    pub id: Option<i64>,
    #[serde(default)]
    pub jenis: Option<String>,
    #[serde(default)]
    pub kode: Option<String>,
    pub nama: String,
    #[serde(default)]
    pub satuan: Option<String>,
    #[serde(default)]
    pub suplier: Option<String>,
    #[serde(default)]
    pub brand: Option<String>,
    #[serde(default)]
    pub harga_acuan: Option<f64>,
    #[serde(default)]
    pub catatan: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct MkatalogImportResult {
    pub total: i64,
    pub inserted: i64,
    pub skipped: i64,
}

#[derive(Debug, Serialize)]
pub struct Subkontraktor {
    pub id: i64,
    pub nama: String,
    pub npwp: Option<String>,
    pub kualifikasi: Option<String>,
    pub spesialisasi: Option<String>,
    pub kontak: Option<String>,
    pub telepon: Option<String>,
    pub email: Option<String>,
    pub rating: Option<f64>,
    pub catatan: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct SubkontraktorInput {
    #[serde(default)]
    pub id: Option<i64>,
    pub nama: String,
    #[serde(default)]
    pub npwp: Option<String>,
    #[serde(default)]
    pub kualifikasi: Option<String>,
    #[serde(default)]
    pub spesialisasi: Option<String>,
    #[serde(default)]
    pub kontak: Option<String>,
    #[serde(default)]
    pub telepon: Option<String>,
    #[serde(default)]
    pub email: Option<String>,
    #[serde(default)]
    pub rating: Option<f64>,
    #[serde(default)]
    pub catatan: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct Pekerjaan {
    pub id: i64,
    pub nama: String,
    pub satuan: Option<String>,
    pub kode_ahsp: Option<String>,
    pub divisi_no: Option<String>,
    pub harga_acuan: Option<f64>,
    pub catatan: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct PekerjaanInput {
    #[serde(default)]
    pub id: Option<i64>,
    pub nama: String,
    #[serde(default)]
    pub satuan: Option<String>,
    #[serde(default)]
    pub kode_ahsp: Option<String>,
    #[serde(default)]
    pub divisi_no: Option<String>,
    #[serde(default)]
    pub harga_acuan: Option<f64>,
    #[serde(default)]
    pub catatan: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct PekerjaanImportResult {
    pub total: i64,
    pub inserted: i64,
    pub skipped: i64,
}

#[derive(Debug, Serialize)]
pub struct KatalogRow {
    pub jenis: String,
    pub uraian: String,
    pub harga: Option<f64>,
    pub updated_at: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct KatalogInput {
    pub jenis: String,
    pub uraian: String,
    #[serde(default)]
    pub harga: Option<f64>,
}

// ---------------------------------------------------------------------------
// Progress (progress harian per item RAB)
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
pub struct ProgressEntry {
    pub id: i64,
    pub item_id: i64,
    pub tanggal: String,
    pub pct: f64,
    pub volume: Option<f64>,
    pub keterangan: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Deserialize)]
pub struct ProgressInput {
    pub item_id: i64,
    pub tanggal: String,
    pub pct: f64,
    #[serde(default)]
    pub volume: Option<f64>,
    #[serde(default)]
    pub keterangan: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ProgressItemRow {
    pub item_id: i64,
    pub kode: Option<String>,
    pub uraian: String,
    pub satuan: Option<String>,
    pub volume: f64,
    pub nilai: f64,
    pub bobot_pct: f64,
    pub pct: f64,
    pub volume_actual: Option<f64>,
    pub nilai_actual: f64,
    pub divisi_no: Option<String>,
    pub last_tanggal: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ProgressDivisiRow {
    pub divisi_no: String,
    pub nama: String,
    pub nilai: f64,
    pub nilai_actual: f64,
    pub progress_pct: f64,
}

#[derive(Debug, Serialize)]
pub struct ProgressPoint {
    pub tanggal: String,
    pub progress_pct: f64,
    pub nilai_actual: f64,
}

#[derive(Debug, Serialize)]
pub struct ProgressSummary {
    pub rab_id: i64,
    pub total_nilai: f64,
    pub nilai_actual: f64,
    pub progress_pct: f64,
    pub items: Vec<ProgressItemRow>,
    pub divisi: Vec<ProgressDivisiRow>,
    pub curve: Vec<ProgressPoint>,
}

// ---------------------------------------------------------------------------
// Legal & Document Administration (register dokumen per proyek)
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
pub struct Document {
    pub id: i64,
    pub project_id: i64,
    pub kategori: String,
    pub arah: Option<String>,
    pub nomor: Option<String>,
    pub judul: String,
    pub tanggal: Option<String>,
    pub dari_pihak: Option<String>,
    pub kepada_pihak: Option<String>,
    pub instansi: Option<String>,
    pub status: String,
    pub masa_berlaku_dari: Option<String>,
    pub masa_berlaku_sampai: Option<String>,
    pub reminder_days: Option<i64>,
    pub keterangan: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct DocumentInput {
    #[serde(default)]
    pub id: Option<i64>,
    pub project_id: i64,
    #[serde(default)]
    pub kategori: Option<String>,
    #[serde(default)]
    pub arah: Option<String>,
    #[serde(default)]
    pub nomor: Option<String>,
    pub judul: String,
    #[serde(default)]
    pub tanggal: Option<String>,
    #[serde(default)]
    pub dari_pihak: Option<String>,
    #[serde(default)]
    pub kepada_pihak: Option<String>,
    #[serde(default)]
    pub instansi: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub masa_berlaku_dari: Option<String>,
    #[serde(default)]
    pub masa_berlaku_sampai: Option<String>,
    #[serde(default)]
    pub reminder_days: Option<i64>,
    #[serde(default)]
    pub keterangan: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct StatusCount {
    pub status: String,
    pub count: i64,
}

#[derive(Debug, Serialize)]
pub struct DashboardProjectRow {
    pub id: i64,
    pub kode: String,
    pub nama: String,
    pub status: String,
    pub klien: Option<String>,
    pub nilai_kontrak: Option<f64>,
    pub rab_count: i64,
    pub rab_total: f64,
    pub progress_pct: f64,
    pub margin_pct: Option<f64>,
    pub dokumen_count: i64,
    pub dokumen_expiring: i64,
    pub last_progress: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct DashboardSummary {
    pub project_count: i64,
    pub total_nilai_kontrak: f64,
    pub total_rab: f64,
    pub total_dokumen: i64,
    pub expiring_count: i64,
    pub progress_pct: f64,
    pub by_status: Vec<StatusCount>,
    pub projects: Vec<DashboardProjectRow>,
}

#[derive(Debug, Serialize)]
pub struct RabVolume {
    pub id: i64,
    pub item_id: i64,
    pub uraian: Option<String>,
    pub bentuk: String,
    pub panjang: Option<f64>,
    pub lebar: Option<f64>,
    pub lebar2: Option<f64>,
    pub tinggi: Option<f64>,
    pub jumlah: Option<f64>,
    pub pos: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct VolumeInput {
    pub item_id: i64,
    #[serde(default)]
    pub id: Option<i64>,
    #[serde(default)]
    pub uraian: Option<String>,
    #[serde(default)]
    pub bentuk: Option<String>,
    #[serde(default)]
    pub panjang: Option<f64>,
    #[serde(default)]
    pub lebar: Option<f64>,
    #[serde(default)]
    pub lebar2: Option<f64>,
    #[serde(default)]
    pub tinggi: Option<f64>,
    #[serde(default)]
    pub jumlah: Option<f64>,
    #[serde(default)]
    pub pos: Option<i64>,
}
