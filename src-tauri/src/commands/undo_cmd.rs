//! Snapshot & restore untuk Undo penghapusan.
//!
//! Hapus proyek/RAB tetap hard delete (semua anak tabel CASCADE), tapi sebelum
//! menghapus frontend menyimpan snapshot JSON. Bila user menekan Undo, snapshot
//! dipulihkan sebagai baris baru (id baru, isi sama).

use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::db::{now, AppState};

const ITEM_COLS: &str = "ref_item_id, kode, uraian, satuan, volume, level, is_user, \
    divisi_no, overhead_pct, pos, durasi_hari, tgl_mulai";

const KOMP_COLS: &str = "jenis, uraian, kode, satuan, koefisien, harga_satuan, pos";

const VOL_COLS: &str = "uraian, bentuk, panjang, lebar, lebar2, tinggi, jumlah, pos";

// ---------------------------------------------------------------------------
// Bentuk snapshot
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, Deserialize)]
struct KompSnap {
    jenis: Option<String>,
    uraian: Option<String>,
    kode: Option<String>,
    satuan: Option<String>,
    koefisien: Option<f64>,
    harga_satuan: Option<f64>,
    pos: i64,
}

#[derive(Debug, Serialize, Deserialize)]
struct VolSnap {
    uraian: Option<String>,
    #[serde(default = "bentuk_default")]
    bentuk: String,
    panjang: Option<f64>,
    lebar: Option<f64>,
    lebar2: Option<f64>,
    tinggi: Option<f64>,
    jumlah: Option<f64>,
    pos: i64,
}

fn bentuk_default() -> String {
    "kotak".to_string()
}

#[derive(Debug, Serialize, Deserialize)]
struct ProgSnap {
    tanggal: String,
    pct: f64,
    volume: Option<f64>,
    keterangan: Option<String>,
    created_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct ItemSnap {
    ref_item_id: Option<i64>,
    kode: Option<String>,
    uraian: String,
    satuan: Option<String>,
    volume: f64,
    level: i64,
    is_user: i64,
    divisi_no: Option<String>,
    overhead_pct: f64,
    pos: i64,
    durasi_hari: Option<f64>,
    tgl_mulai: Option<String>,
    #[serde(default)]
    komponen: Vec<KompSnap>,
    #[serde(default)]
    volumes: Vec<VolSnap>,
    #[serde(default)]
    progress: Vec<ProgSnap>,
}

#[derive(Debug, Serialize, Deserialize)]
struct RabSnap {
    nama: String,
    ppn_pct: f64,
    status: String,
    catatan: Option<String>,
    #[serde(default)]
    items: Vec<ItemSnap>,
}

#[derive(Debug, Default, Serialize, Deserialize)]
struct TimelineSnap {
    tgl_kontrak: Option<String>,
    tgl_spmk: Option<String>,
    tgl_mulai_kerja: Option<String>,
    tgl_selesai_rencana: Option<String>,
    tgl_pho: Option<String>,
    tgl_fho: Option<String>,
    perpanjangan_hari: Option<i64>,
    masa_pemeliharaan_selesai: Option<String>,
    catatan: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct OrgSnap {
    nama: String,
    jabatan: Option<String>,
    institusi: Option<String>,
    telepon: Option<String>,
    email: Option<String>,
    pos: i64,
}

#[derive(Debug, Serialize, Deserialize)]
struct DocSnap {
    kategori: String,
    arah: Option<String>,
    nomor: Option<String>,
    judul: String,
    tanggal: Option<String>,
    dari_pihak: Option<String>,
    kepada_pihak: Option<String>,
    instansi: Option<String>,
    status: String,
    masa_berlaku_dari: Option<String>,
    masa_berlaku_sampai: Option<String>,
    reminder_days: Option<i64>,
    keterangan: Option<String>,
    created_at: Option<String>,
    updated_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct ProjectSnap {
    kode: String,
    nama: String,
    klien: Option<String>,
    konsultan: Option<String>,
    nilai_kontrak: Option<f64>,
    jenis: Option<String>,
    lokasi_prov: Option<String>,
    lokasi_kab: Option<String>,
    lokasi_alamat: Option<String>,
    status: String,
    tanggal_mulai: Option<String>,
    tanggal_selesai: Option<String>,
    masa_pemeliharaan: Option<i64>,
    keterangan: Option<String>,
    #[serde(default)]
    timeline: Option<TimelineSnap>,
    #[serde(default)]
    orgs: Vec<OrgSnap>,
    #[serde(default)]
    rabs: Vec<RabSnap>,
    #[serde(default)]
    documents: Vec<DocSnap>,
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

fn export_rab(db: &Connection, rab_id: i64) -> Result<RabSnap, String> {
    let (nama, ppn_pct, status, catatan) = db
        .query_row(
            "SELECT nama, ppn_pct, status, catatan FROM rabs WHERE id = ?1",
            params![rab_id],
            |r| Ok((r.get::<_, String>(0)?, r.get::<_, f64>(1)?, r.get::<_, String>(2)?, r.get::<_, Option<String>>(3)?)),
        )
        .optional()
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "RAB tidak ditemukan.".to_string())?;

    let mut items: Vec<(i64, ItemSnap)> = {
        let mut stmt = db
            .prepare(&format!(
                "SELECT id, {} FROM rab_items WHERE rab_id = ?1 ORDER BY pos, id",
                ITEM_COLS
            ))
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![rab_id], |r| {
                Ok((
                    r.get::<_, i64>(0)?,
                    ItemSnap {
                        ref_item_id: r.get(1)?,
                        kode: r.get(2)?,
                        uraian: r.get(3)?,
                        satuan: r.get(4)?,
                        volume: r.get(5)?,
                        level: r.get(6)?,
                        is_user: r.get(7)?,
                        divisi_no: r.get(8)?,
                        overhead_pct: r.get(9)?,
                        pos: r.get(10)?,
                        durasi_hari: r.get(11)?,
                        tgl_mulai: r.get(12)?,
                        komponen: Vec::new(),
                        volumes: Vec::new(),
                        progress: Vec::new(),
                    },
                ))
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();
        rows
    };

    for (item_id, it) in items.iter_mut() {
        let item_id = *item_id;
        let mut stmt = db
            .prepare(&format!(
                "SELECT {} FROM rab_item_komponen WHERE rab_item_id = ?1 ORDER BY pos, id",
                KOMP_COLS
            ))
            .map_err(|e| e.to_string())?;
        it.komponen = stmt
            .query_map(params![item_id], |r| {
                Ok(KompSnap {
                    jenis: r.get(0)?,
                    uraian: r.get(1)?,
                    kode: r.get(2)?,
                    satuan: r.get(3)?,
                    koefisien: r.get(4)?,
                    harga_satuan: r.get(5)?,
                    pos: r.get(6)?,
                })
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();

        let mut stmt = db
            .prepare(&format!(
                "SELECT {} FROM rab_volume WHERE item_id = ?1 ORDER BY pos, id",
                VOL_COLS
            ))
            .map_err(|e| e.to_string())?;
        it.volumes = stmt
            .query_map(params![item_id], |r| {
                Ok(VolSnap {
                    uraian: r.get(0)?,
                    bentuk: r
                        .get::<_, Option<String>>(1)?
                        .unwrap_or_else(bentuk_default),
                    panjang: r.get(2)?,
                    lebar: r.get(3)?,
                    lebar2: r.get(4)?,
                    tinggi: r.get(5)?,
                    jumlah: r.get(6)?,
                    pos: r.get(7)?,
                })
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();

        let mut stmt = db
            .prepare(
                "SELECT tanggal, pct, volume, keterangan, created_at \
                 FROM progress_entries WHERE item_id = ?1 ORDER BY tanggal, id",
            )
            .map_err(|e| e.to_string())?;
        it.progress = stmt
            .query_map(params![item_id], |r| {
                Ok(ProgSnap {
                    tanggal: r.get(0)?,
                    pct: r.get(1)?,
                    volume: r.get(2)?,
                    keterangan: r.get(3)?,
                    created_at: r.get(4)?,
                })
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();
    }

    // Buang id dari item (dipakai hanya untuk query anak).
    let items = items.into_iter().map(|(_, it)| it).collect();

    Ok(RabSnap {
        nama,
        ppn_pct,
        status,
        catatan,
        items,
    })
}

fn export_project(db: &Connection, project_id: i64) -> Result<ProjectSnap, String> {
    let p = db
        .query_row(
            "SELECT kode, nama, klien, konsultan, nilai_kontrak, jenis, lokasi_prov, lokasi_kab, \
             lokasi_alamat, status, tanggal_mulai, tanggal_selesai, masa_pemeliharaan, keterangan \
             FROM projects WHERE id = ?1",
            params![project_id],
            |r| {
                Ok(ProjectSnap {
                    kode: r.get(0)?,
                    nama: r.get(1)?,
                    klien: r.get(2)?,
                    konsultan: r.get(3)?,
                    nilai_kontrak: r.get(4)?,
                    jenis: r.get(5)?,
                    lokasi_prov: r.get(6)?,
                    lokasi_kab: r.get(7)?,
                    lokasi_alamat: r.get(8)?,
                    status: r.get(9)?,
                    tanggal_mulai: r.get(10)?,
                    tanggal_selesai: r.get(11)?,
                    masa_pemeliharaan: r.get(12)?,
                    keterangan: r.get(13)?,
                    timeline: None,
                    orgs: Vec::new(),
                    rabs: Vec::new(),
                    documents: Vec::new(),
                })
            },
        )
        .optional()
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Proyek tidak ditemukan.".to_string())?;
    let mut snap = p;

    snap.timeline = db
        .query_row(
            "SELECT tgl_kontrak, tgl_spmk, tgl_mulai_kerja, tgl_selesai_rencana, tgl_pho, \
             tgl_fho, perpanjangan_hari, masa_pemeliharaan_selesai, catatan \
             FROM contract_timelines WHERE project_id = ?1",
            params![project_id],
            |r| {
                Ok(TimelineSnap {
                    tgl_kontrak: r.get(0)?,
                    tgl_spmk: r.get(1)?,
                    tgl_mulai_kerja: r.get(2)?,
                    tgl_selesai_rencana: r.get(3)?,
                    tgl_pho: r.get(4)?,
                    tgl_fho: r.get(5)?,
                    perpanjangan_hari: r.get(6)?,
                    masa_pemeliharaan_selesai: r.get(7)?,
                    catatan: r.get(8)?,
                })
            },
        )
        .optional()
        .map_err(|e| e.to_string())?;

    {
        let mut stmt = db
            .prepare("SELECT nama, jabatan, institusi, telepon, email, pos FROM project_orgs WHERE project_id = ?1 ORDER BY pos, id")
            .map_err(|e| e.to_string())?;
        snap.orgs = stmt
            .query_map(params![project_id], |r| {
                Ok(OrgSnap {
                    nama: r.get(0)?,
                    jabatan: r.get(1)?,
                    institusi: r.get(2)?,
                    telepon: r.get(3)?,
                    email: r.get(4)?,
                    pos: r.get(5)?,
                })
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();
    }

    {
        let mut stmt = db
            .prepare("SELECT id FROM rabs WHERE project_id = ?1 ORDER BY id")
            .map_err(|e| e.to_string())?;
        let ids: Vec<i64> = stmt
            .query_map(params![project_id], |r| r.get(0))
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();
        drop(stmt);
        for id in ids {
            snap.rabs.push(export_rab(db, id)?);
        }
    }

    {
        let mut stmt = db
            .prepare(
                "SELECT kategori, arah, nomor, judul, tanggal, dari_pihak, kepada_pihak, instansi, \
                 status, masa_berlaku_dari, masa_berlaku_sampai, reminder_days, keterangan, \
                 created_at, updated_at FROM documents WHERE project_id = ?1 ORDER BY id",
            )
            .map_err(|e| e.to_string())?;
        snap.documents = stmt
            .query_map(params![project_id], |r| {
                Ok(DocSnap {
                    kategori: r.get(0)?,
                    arah: r.get(1)?,
                    nomor: r.get(2)?,
                    judul: r.get(3)?,
                    tanggal: r.get(4)?,
                    dari_pihak: r.get(5)?,
                    kepada_pihak: r.get(6)?,
                    instansi: r.get(7)?,
                    status: r.get(8)?,
                    masa_berlaku_dari: r.get(9)?,
                    masa_berlaku_sampai: r.get(10)?,
                    reminder_days: r.get(11)?,
                    keterangan: r.get(12)?,
                    created_at: r.get(13)?,
                    updated_at: r.get(14)?,
                })
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();
    }

    Ok(snap)
}

// ---------------------------------------------------------------------------
// Import (restore)
// ---------------------------------------------------------------------------

fn import_rab(tx: &Connection, project_id: i64, snap: &RabSnap, ts: &str) -> Result<i64, String> {
    tx.execute(
        "INSERT INTO rabs (project_id, nama, ppn_pct, status, catatan, created_at, updated_at) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)",
        params![project_id, snap.nama, snap.ppn_pct, snap.status, snap.catatan, ts],
    )
    .map_err(|e| e.to_string())?;
    let rab_id = tx.last_insert_rowid();

    for it in &snap.items {
        tx.execute(
            &format!(
                "INSERT INTO rab_items (rab_id, {}) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
                ITEM_COLS
            ),
            params![
                rab_id,
                it.ref_item_id,
                it.kode,
                it.uraian,
                it.satuan,
                it.volume,
                it.level,
                it.is_user,
                it.divisi_no,
                it.overhead_pct,
                it.pos,
                it.durasi_hari,
                it.tgl_mulai
            ],
        )
        .map_err(|e| e.to_string())?;
        let item_id = tx.last_insert_rowid();

        for k in &it.komponen {
            tx.execute(
                &format!(
                    "INSERT INTO rab_item_komponen (rab_item_id, {}) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                    KOMP_COLS
                ),
                params![
                    item_id,
                    k.jenis,
                    k.uraian,
                    k.kode,
                    k.satuan,
                    k.koefisien,
                    k.harga_satuan,
                    k.pos
                ],
            )
            .map_err(|e| e.to_string())?;
        }

        for v in &it.volumes {
            tx.execute(
                &format!(
                    "INSERT INTO rab_volume (item_id, {}, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?10)",
                    VOL_COLS
                ),
                params![
                    item_id,
                    v.uraian,
                    v.bentuk,
                    v.panjang,
                    v.lebar,
                    v.lebar2,
                    v.tinggi,
                    v.jumlah,
                    v.pos,
                    ts
                ],
            )
            .map_err(|e| e.to_string())?;
        }

        for p in &it.progress {
            tx.execute(
                "INSERT INTO progress_entries (item_id, tanggal, pct, volume, keterangan, created_at) \
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![
                    item_id,
                    p.tanggal,
                    p.pct,
                    p.volume,
                    p.keterangan,
                    p.created_at.clone().unwrap_or_else(|| ts.to_string())
                ],
            )
            .map_err(|e| e.to_string())?;
        }
    }

    Ok(rab_id)
}

fn free_kode(tx: &Connection, base: &str) -> Result<String, String> {
    for n in 1..=200 {
        let candidate = if n == 1 {
            base.to_string()
        } else {
            format!("{}-{}", base, n)
        };
        let exists: i64 = tx
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM projects WHERE kode = ?1)",
                params![candidate],
                |r| r.get(0),
            )
            .map_err(|e| e.to_string())?;
        if exists == 0 {
            return Ok(candidate);
        }
    }
    Err("Tidak bisa membuat kode proyek unik untuk restore.".to_string())
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn rab_snapshot(state: State<AppState>, rab_id: i64) -> Result<String, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let snap = export_rab(&db, rab_id)?;
    serde_json::to_string(&snap).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn rab_restore(
    state: State<AppState>,
    project_id: i64,
    snapshot: String,
) -> Result<i64, String> {
    let snap: RabSnap = serde_json::from_str(&snapshot).map_err(|e| e.to_string())?;
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let ts = now();
    let tx = db.unchecked_transaction().map_err(|e| e.to_string())?;
    let id = import_rab(&tx, project_id, &snap, &ts)?;
    tx.commit().map_err(|e| e.to_string())?;
    Ok(id)
}

#[tauri::command]
pub fn project_snapshot(state: State<AppState>, project_id: i64) -> Result<String, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let snap = export_project(&db, project_id)?;
    serde_json::to_string(&snap).map_err(|e| e.to_string())
}

fn import_project(tx: &Connection, snap: &ProjectSnap, ts: &str) -> Result<i64, String> {
    let kode = free_kode(tx, &snap.kode)?;

    tx.execute(
        "INSERT INTO projects (kode, nama, klien, konsultan, nilai_kontrak, jenis, lokasi_prov, \
         lokasi_kab, lokasi_alamat, status, tanggal_mulai, tanggal_selesai, masa_pemeliharaan, \
         keterangan, created_at, updated_at) \
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?15)",
        params![
            kode,
            snap.nama,
            snap.klien,
            snap.konsultan,
            snap.nilai_kontrak,
            snap.jenis,
            snap.lokasi_prov,
            snap.lokasi_kab,
            snap.lokasi_alamat,
            snap.status,
            snap.tanggal_mulai,
            snap.tanggal_selesai,
            snap.masa_pemeliharaan,
            snap.keterangan,
            ts
        ],
    )
    .map_err(|e| e.to_string())?;
    let project_id = tx.last_insert_rowid();

    if let Some(t) = &snap.timeline {
        tx.execute(
            "INSERT INTO contract_timelines (project_id, tgl_kontrak, tgl_spmk, tgl_mulai_kerja, \
             tgl_selesai_rencana, tgl_pho, tgl_fho, perpanjangan_hari, masa_pemeliharaan_selesai, catatan) \
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)",
            params![
                project_id,
                t.tgl_kontrak,
                t.tgl_spmk,
                t.tgl_mulai_kerja,
                t.tgl_selesai_rencana,
                t.tgl_pho,
                t.tgl_fho,
                t.perpanjangan_hari,
                t.masa_pemeliharaan_selesai,
                t.catatan
            ],
        )
        .map_err(|e| e.to_string())?;
    }

    for o in &snap.orgs {
        tx.execute(
            "INSERT INTO project_orgs (project_id, nama, jabatan, institusi, telepon, email, pos) \
             VALUES (?1,?2,?3,?4,?5,?6,?7)",
            params![project_id, o.nama, o.jabatan, o.institusi, o.telepon, o.email, o.pos],
        )
        .map_err(|e| e.to_string())?;
    }

    for r in &snap.rabs {
        import_rab(tx, project_id, r, ts)?;
    }

    for d in &snap.documents {
        tx.execute(
            "INSERT INTO documents (project_id, kategori, arah, nomor, judul, tanggal, dari_pihak, \
             kepada_pihak, instansi, status, masa_berlaku_dari, masa_berlaku_sampai, reminder_days, \
             keterangan, created_at, updated_at) \
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16)",
            params![
                project_id,
                d.kategori,
                d.arah,
                d.nomor,
                d.judul,
                d.tanggal,
                d.dari_pihak,
                d.kepada_pihak,
                d.instansi,
                d.status,
                d.masa_berlaku_dari,
                d.masa_berlaku_sampai,
                d.reminder_days,
                d.keterangan,
                d.created_at.clone().unwrap_or_else(|| ts.to_string()),
                d.updated_at.clone().unwrap_or_else(|| ts.to_string())
            ],
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(project_id)
}

#[tauri::command]
pub fn project_restore(state: State<AppState>, snapshot: String) -> Result<i64, String> {
    let snap: ProjectSnap = serde_json::from_str(&snapshot).map_err(|e| e.to_string())?;
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let ts = now();
    let tx = db.unchecked_transaction().map_err(|e| e.to_string())?;
    let id = import_project(&tx, &snap, &ts)?;
    tx.commit().map_err(|e| e.to_string())?;
    Ok(id)
}

// ---------------------------------------------------------------------------
// Test: snapshot → hapus → restore harus mengembalikan semua isi
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::init_app_db;

    fn count(db: &Connection, sql: &str) -> i64 {
        db.query_row(sql, [], |r| r.get(0)).unwrap()
    }

    fn seed(db: &Connection) -> i64 {
        db.execute(
            "INSERT INTO projects (kode, nama, status, created_at, updated_at) \
             VALUES ('P-1', 'Proyek A', 'berlangsung', '2026-01-01', '2026-01-01')",
            [],
        )
        .unwrap();
        let pid = db.last_insert_rowid();
        db.execute(
            "INSERT INTO contract_timelines (project_id, tgl_kontrak, perpanjangan_hari) \
             VALUES (?1, '2026-01-02', 14)",
            params![pid],
        )
        .unwrap();
        db.execute(
            "INSERT INTO project_orgs (project_id, nama, jabatan, pos) VALUES (?1, 'Budi', 'PM', 0)",
            params![pid],
        )
        .unwrap();
        db.execute(
            "INSERT INTO rabs (project_id, nama, ppn_pct, status, created_at, updated_at) \
             VALUES (?1, 'RAB 1', 11, 'draft', '2026-01-01', '2026-01-01')",
            params![pid],
        )
        .unwrap();
        let rid = db.last_insert_rowid();
        db.execute(
            "INSERT INTO rab_items (rab_id, kode, uraian, satuan, volume, level, is_user, \
             divisi_no, overhead_pct, pos, durasi_hari, tgl_mulai) \
             VALUES (?1, '1.1', 'Galian tanah', 'm3', 12.5, 0, 0, '1', 0.1, 0, 3, '2026-01-03')",
            params![rid],
        )
        .unwrap();
        let iid = db.last_insert_rowid();
        db.execute(
            "INSERT INTO rab_item_komponen (rab_item_id, jenis, uraian, koefisien, harga_satuan, pos) \
             VALUES (?1, 'Bahan', 'Semen', 0.5, 65000, 0)",
            params![iid],
        )
        .unwrap();
        db.execute(
            "INSERT INTO rab_volume (item_id, uraian, bentuk, panjang, lebar, tinggi, jumlah, pos, \
             created_at, updated_at) \
             VALUES (?1, 'Galian', 'kotak', 10, 2, 0.5, 10, 0, '2026-01-01', '2026-01-01')",
            params![iid],
        )
        .unwrap();
        db.execute(
            "INSERT INTO progress_entries (item_id, tanggal, pct, volume, keterangan, created_at) \
             VALUES (?1, '2026-01-05', 40, 5, 'ok', '2026-01-05')",
            params![iid],
        )
        .unwrap();
        db.execute(
            "INSERT INTO documents (project_id, kategori, judul, status, created_at, updated_at) \
             VALUES (?1, 'surat', 'SPMK', 'final', '2026-01-01', '2026-01-01')",
            params![pid],
        )
        .unwrap();
        pid
    }

    #[test]
    fn project_snapshot_restore_roundtrip() {
        let db = Connection::open_in_memory().unwrap();
        init_app_db(&db);
        let pid = seed(&db);

        let json = serde_json::to_string(&export_project(&db, pid).unwrap()).unwrap();
        db.execute("DELETE FROM projects WHERE id = ?1", params![pid]).unwrap();
        assert_eq!(count(&db, "SELECT COUNT(*) FROM rab_items"), 0);

        let snap: ProjectSnap = serde_json::from_str(&json).unwrap();
        let ts = now();
        let tx = db.unchecked_transaction().unwrap();
        let new_pid = import_project(&tx, &snap, &ts).unwrap();
        tx.commit().unwrap();

        assert_ne!(new_pid, pid);
        assert_eq!(count(&db, "SELECT COUNT(*) FROM projects"), 1);
        assert_eq!(count(&db, "SELECT COUNT(*) FROM contract_timelines"), 1);
        assert_eq!(count(&db, "SELECT COUNT(*) FROM project_orgs"), 1);
        assert_eq!(count(&db, "SELECT COUNT(*) FROM rabs"), 1);
        assert_eq!(count(&db, "SELECT COUNT(*) FROM rab_items"), 1);
        assert_eq!(count(&db, "SELECT COUNT(*) FROM rab_item_komponen"), 1);
        assert_eq!(count(&db, "SELECT COUNT(*) FROM rab_volume"), 1);
        assert_eq!(count(&db, "SELECT COUNT(*) FROM progress_entries"), 1);
        assert_eq!(count(&db, "SELECT COUNT(*) FROM documents"), 1);

        let (kode, nama): (String, String) = db
            .query_row("SELECT kode, nama FROM projects", [], |r| Ok((r.get(0)?, r.get(1)?)))
            .unwrap();
        assert_eq!(kode, "P-1");
        assert_eq!(nama, "Proyek A");
        let (volume, durasi, tgl): (f64, f64, String) = db
            .query_row(
                "SELECT volume, durasi_hari, tgl_mulai FROM rab_items",
                [],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
            )
            .unwrap();
        assert_eq!((volume, durasi, tgl.as_str()), (12.5, 3.0, "2026-01-03"));
        let pct: f64 = db
            .query_row("SELECT pct FROM progress_entries", [], |r| r.get(0))
            .unwrap();
        assert_eq!(pct, 40.0);
    }

    #[test]
    fn rab_snapshot_restore_roundtrip() {
        let db = Connection::open_in_memory().unwrap();
        init_app_db(&db);
        let pid = seed(&db);
        let rid: i64 = db.query_row("SELECT id FROM rabs", [], |r| r.get(0)).unwrap();

        let json = serde_json::to_string(&export_rab(&db, rid).unwrap()).unwrap();
        db.execute("DELETE FROM rabs WHERE id = ?1", params![rid]).unwrap();

        let snap: RabSnap = serde_json::from_str(&json).unwrap();
        let ts = now();
        let tx = db.unchecked_transaction().unwrap();
        let new_rid = import_rab(&tx, pid, &snap, &ts).unwrap();
        tx.commit().unwrap();

        assert_ne!(new_rid, rid);
        assert_eq!(count(&db, "SELECT COUNT(*) FROM rab_items"), 1);
        assert_eq!(count(&db, "SELECT COUNT(*) FROM rab_item_komponen"), 1);
        assert_eq!(count(&db, "SELECT COUNT(*) FROM rab_volume"), 1);
        assert_eq!(count(&db, "SELECT COUNT(*) FROM progress_entries"), 1);
    }

    #[test]
    fn restore_keeps_kode_unique() {
        let db = Connection::open_in_memory().unwrap();
        init_app_db(&db);
        seed(&db);
        let json = serde_json::to_string(&export_project(&db, 1).unwrap()).unwrap();
        let snap: ProjectSnap = serde_json::from_str(&json).unwrap();
        let ts = now();
        let tx = db.unchecked_transaction().unwrap();
        let new_pid = import_project(&tx, &snap, &ts).unwrap();
        tx.commit().unwrap();
        let kode: String = db
            .query_row("SELECT kode FROM projects WHERE id = ?1", params![new_pid], |r| r.get(0))
            .unwrap();
        assert_eq!(kode, "P-1-2");
    }
}
