use std::path::PathBuf;
use std::sync::Mutex;

use rusqlite::Connection;
use tauri::AppHandle;
use tauri::Manager;

/// Dua koneksi: `db` = DB aplikasi (single DB, semua proyek, writable);
/// `ref_db` = DB referensi AHSP (read-only, di-seed dari .db hasil publish ahsp-library).
pub struct AppState {
    pub db: Mutex<Connection>,
    /// Koneksi DB referensi AHSP (read-only). Dipakai modul RAB pada fase berikutnya.
    #[allow(dead_code)]
    pub ref_db: Mutex<Connection>,
}

#[allow(dead_code)]
pub fn now() -> String {
    chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Secs, true)
}

/// Normalisasi jenis komponen AHSP ke bentuk master: 'tenaga_kerja' | 'bahan' | 'alat'.
#[allow(dead_code)]
pub fn norm_jenis(j: &str) -> Option<String> {
    let s = j.to_lowercase();
    if s.contains("tenaga kerja") || s.contains("tenaga_kerja") || s == "tk" {
        Some("tenaga_kerja".to_string())
    } else if s.contains("bahan") {
        Some("bahan".to_string())
    } else if s.contains("peralatan") || s.contains("alat") {
        Some("alat".to_string())
    } else {
        None
    }
}

/// Skema DB aplikasi Constructsee — single DB untuk SEMUA proyek.
pub const APP_SCHEMA: &str = r#"
CREATE TABLE IF NOT EXISTS projects (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  kode              TEXT NOT NULL UNIQUE,
  nama              TEXT NOT NULL,
  klien             TEXT,
  konsultan         TEXT,
  nilai_kontrak     REAL,
  jenis             TEXT,
  lokasi_prov       TEXT,
  lokasi_kab        TEXT,
  lokasi_alamat     TEXT,
  status            TEXT NOT NULL DEFAULT 'perencanaan',
  tanggal_mulai     TEXT,
  tanggal_selesai   TEXT,
  masa_pemeliharaan INTEGER,
  keterangan        TEXT,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS contract_timelines (
  project_id                INTEGER NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  tgl_kontrak               TEXT,
  tgl_spmk                  TEXT,
  tgl_mulai_kerja           TEXT,
  tgl_selesai_rencana       TEXT,
  tgl_pho                   TEXT,
  tgl_fho                   TEXT,
  perpanjangan_hari         INTEGER,
  masa_pemeliharaan_selesai TEXT,
  catatan                   TEXT
);

CREATE TABLE IF NOT EXISTS project_orgs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  nama       TEXT NOT NULL,
  jabatan    TEXT,
  institusi  TEXT,
  telepon    TEXT,
  email      TEXT,
  pos        INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_orgs_project ON project_orgs(project_id);

CREATE TABLE IF NOT EXISTS rabs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  nama       TEXT NOT NULL,
  ppn_pct    REAL NOT NULL DEFAULT 11,
  status     TEXT NOT NULL DEFAULT 'draft',
  catatan    TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rabs_project ON rabs(project_id);

CREATE TABLE IF NOT EXISTS rab_items (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  rab_id       INTEGER NOT NULL REFERENCES rabs(id) ON DELETE CASCADE,
  ref_item_id  INTEGER,
  kode         TEXT,
  uraian       TEXT NOT NULL,
  satuan       TEXT,
  volume       REAL NOT NULL DEFAULT 0,
  level        INTEGER NOT NULL DEFAULT 0,
  is_user      INTEGER NOT NULL DEFAULT 0,
  divisi_no    TEXT,
  overhead_pct REAL NOT NULL DEFAULT 0.1,
  pos          INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_rab_items_rab ON rab_items(rab_id);

CREATE TABLE IF NOT EXISTS rab_item_komponen (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  rab_item_id  INTEGER NOT NULL REFERENCES rab_items(id) ON DELETE CASCADE,
  jenis        TEXT,
  uraian       TEXT,
  kode         TEXT,
  satuan       TEXT,
  koefisien    REAL,
  harga_satuan REAL,
  pos          INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_rab_komp_item ON rab_item_komponen(rab_item_id);

CREATE TABLE IF NOT EXISTS rab_volume (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id    INTEGER NOT NULL REFERENCES rab_items(id) ON DELETE CASCADE,
  uraian     TEXT,
  bentuk     TEXT NOT NULL DEFAULT 'kotak',
  panjang    REAL,
  lebar      REAL,
  lebar2     REAL,
  tinggi     REAL,
  jumlah     REAL,
  pos        INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rab_volume_item ON rab_volume(item_id);

CREATE TABLE IF NOT EXISTS harga_katalog (
  jenis      TEXT NOT NULL,
  uraian     TEXT NOT NULL,
  harga      REAL,
  updated_at TEXT,
  PRIMARY KEY (jenis, uraian)
);

CREATE TABLE IF NOT EXISTS master_katalog (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  jenis        TEXT NOT NULL DEFAULT 'bahan',
  kode         TEXT,
  nama         TEXT NOT NULL,
  satuan       TEXT,
  suplier      TEXT,
  brand        TEXT,
  harga_acuan  REAL,
  catatan      TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  UNIQUE (jenis, nama)
);
CREATE INDEX IF NOT EXISTS idx_master_katalog_jenis ON master_katalog(jenis);

CREATE TABLE IF NOT EXISTS master_subkontraktor (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  nama         TEXT NOT NULL,
  npwp         TEXT,
  kualifikasi  TEXT,
  spesialisasi TEXT,
  kontak       TEXT,
  telepon      TEXT,
  email        TEXT,
  rating       REAL,
  catatan      TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS master_pekerjaan (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  nama        TEXT NOT NULL,
  satuan      TEXT,
  kode_ahsp   TEXT,
  divisi_no   TEXT,
  harga_acuan REAL,
  catatan     TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_master_pekerjaan_divisi ON master_pekerjaan(divisi_no);

CREATE TABLE IF NOT EXISTS progress_entries (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id    INTEGER NOT NULL REFERENCES rab_items(id) ON DELETE CASCADE,
  tanggal    TEXT NOT NULL,
  pct        REAL NOT NULL DEFAULT 0,
  volume     REAL,
  keterangan TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_progress_item ON progress_entries(item_id);

CREATE TABLE IF NOT EXISTS documents (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id         INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  kategori           TEXT NOT NULL DEFAULT 'surat',
  arah               TEXT,
  nomor              TEXT,
  judul              TEXT NOT NULL,
  tanggal            TEXT,
  dari_pihak         TEXT,
  kepada_pihak       TEXT,
  instansi           TEXT,
  status             TEXT NOT NULL DEFAULT 'draft',
  masa_berlaku_dari  TEXT,
  masa_berlaku_sampai TEXT,
  reminder_days      INTEGER DEFAULT 30,
  keterangan         TEXT,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_documents_project ON documents(project_id);
CREATE INDEX IF NOT EXISTS idx_documents_kategori ON documents(kategori);
"#;

pub fn init_app_db(db: &Connection) {
    db.execute_batch(APP_SCHEMA).expect("Failed to create app schema");
    // Kolom yang ditambahkan setelah rilis pertama (idempotent, aman diulang).
    ensure_column(db, "master_pekerjaan", "harga_acuan", "REAL");
    ensure_column(db, "rab_volume", "bentuk", "TEXT");
    ensure_column(db, "rab_volume", "lebar2", "REAL");
    ensure_column(db, "rab_items", "durasi_hari", "REAL");
    ensure_column(db, "rab_items", "tgl_mulai", "TEXT");
}

/// Cek apakah kolom sudah ada di tabel.
fn column_exists(db: &Connection, table: &str, column: &str) -> bool {
    let mut stmt = match db.prepare(&format!("PRAGMA table_info({})", table)) {
        Ok(s) => s,
        Err(_) => return false,
    };
    let mut rows = match stmt.query([]) {
        Ok(r) => r,
        Err(_) => return false,
    };
    while let Ok(Some(row)) = rows.next() {
        if let Ok(name) = row.get::<_, String>(1) {
            if name == column {
                return true;
            }
        }
    }
    false
}

/// Tambahkan kolom bila belum ada (ALTER TABLE ADD COLUMN).
fn ensure_column(db: &Connection, table: &str, column: &str, decl: &str) {
    if !column_exists(db, table, column) {
        let _ = db.execute_batch(&format!("ALTER TABLE {} ADD COLUMN {} {};", table, column, decl));
    }
}

pub fn open_database(path: &PathBuf) -> Connection {
    let db = Connection::open(path).expect("Failed to open database");
    db.execute_batch("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;")
        .expect("Failed to set pragmas");
    db
}

pub fn state_from(app: &AppHandle) -> AppState {
    let user_data = app.path().app_data_dir().expect("Failed to get app data dir");
    std::fs::create_dir_all(&user_data).ok();

    let app_path = user_data.join("constructsee.db");
    let ref_path = user_data.join("ahsp-lib.db");

    seed_ref_file(&ref_path, app);

    let app_conn = open_database(&app_path);
    init_app_db(&app_conn);
    let ref_conn = open_database(&ref_path);

    AppState { db: Mutex::new(app_conn), ref_db: Mutex::new(ref_conn) }
}

/// Seed DB referensi AHSP dari file `.db` hasil publish ahsp-library (bundled resource).
fn seed_ref_file(ref_path: &PathBuf, app: &AppHandle) {
    if ref_path.exists() {
        if let Ok(conn) = Connection::open(ref_path) {
            let has_src: bool = conn
                .query_row("SELECT COUNT(*) > 0 FROM sources", [], |row| row.get(0))
                .unwrap_or(false);
            if has_src {
                log::info!("AHSP ref DB already seeded");
                return;
            }
        }
    }
    let resources = match app.path().resource_dir() {
        Ok(r) => r,
        Err(e) => {
            log::error!("Failed to get resource dir: {}", e);
            return;
        }
    };

    let candidates = [
        resources.join("ahsp-lib.db"),
        resources.join("resources").join("ahsp-lib.db"),
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("resources").join("ahsp-lib.db"),
    ];
    match candidates.iter().find(|p| p.exists()) {
        Some(path) => {
            log::info!("Seeding AHSP ref DB from {}", path.display());
            match std::fs::copy(path, ref_path) {
                Ok(bytes) => log::info!("Copied {} bytes to AHSP ref DB", bytes),
                Err(e) => log::error!("Failed to seed AHSP ref DB: {}", e),
            }
        }
        None => log::error!(
            "No bundled AHSP ref DB found in any of: {:?}",
            candidates.iter().map(|p| p.display().to_string()).collect::<Vec<_>>()
        ),
    }
}
