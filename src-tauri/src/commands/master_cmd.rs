use std::collections::HashMap;

use rusqlite::params;
use tauri::State;

use crate::db::{now, norm_jenis, AppState};
use crate::types::*;

const KATALOG_COLS: &str = "id, jenis, kode, nama, satuan, suplier, brand, \
    harga_acuan, catatan, created_at, updated_at";
const SUBKON_COLS: &str = "id, nama, npwp, kualifikasi, spesialisasi, kontak, telepon, \
    email, rating, catatan, created_at, updated_at";
const PEKERJAAN_COLS: &str =
    "id, nama, satuan, kode_ahsp, divisi_no, harga_acuan, catatan, created_at, updated_at";

fn row_katalog(row: &rusqlite::Row) -> rusqlite::Result<MasterKatalog> {
    Ok(MasterKatalog {
        id: row.get(0)?,
        jenis: row.get(1)?,
        kode: row.get(2)?,
        nama: row.get(3)?,
        satuan: row.get(4)?,
        suplier: row.get(5)?,
        brand: row.get(6)?,
        harga_acuan: row.get(7)?,
        catatan: row.get(8)?,
        created_at: row.get(9)?,
        updated_at: row.get(10)?,
    })
}

fn row_subkon(row: &rusqlite::Row) -> rusqlite::Result<Subkontraktor> {
    Ok(Subkontraktor {
        id: row.get(0)?,
        nama: row.get(1)?,
        npwp: row.get(2)?,
        kualifikasi: row.get(3)?,
        spesialisasi: row.get(4)?,
        kontak: row.get(5)?,
        telepon: row.get(6)?,
        email: row.get(7)?,
        rating: row.get(8)?,
        catatan: row.get(9)?,
        created_at: row.get(10)?,
        updated_at: row.get(11)?,
    })
}

fn row_pekerjaan(row: &rusqlite::Row) -> rusqlite::Result<Pekerjaan> {
    Ok(Pekerjaan {
        id: row.get(0)?,
        nama: row.get(1)?,
        satuan: row.get(2)?,
        kode_ahsp: row.get(3)?,
        divisi_no: row.get(4)?,
        harga_acuan: row.get(5)?,
        catatan: row.get(6)?,
        created_at: row.get(7)?,
        updated_at: row.get(8)?,
    })
}

/// Urutkan kode bertitik secara natural (1.1.2 sebelum 1.1.10).
fn kode_cmp(a: &str, b: &str) -> std::cmp::Ordering {
    let mut ai = a.split('.');
    let mut bi = b.split('.');
    loop {
        match (ai.next(), bi.next()) {
            (None, None) => return std::cmp::Ordering::Equal,
            (None, Some(_)) => return std::cmp::Ordering::Less,
            (Some(_), None) => return std::cmp::Ordering::Greater,
            (Some(x), Some(y)) => {
                let ord = match (x.parse::<i64>(), y.parse::<i64>()) {
                    (Ok(nx), Ok(ny)) => nx.cmp(&ny),
                    _ => x.cmp(y),
                };
                if ord != std::cmp::Ordering::Equal {
                    return ord;
                }
            }
        }
    }
}

// ---------- Katalog Resource (bahan + alat + tenaga kerja) ----------

#[tauri::command]
pub fn master_katalog_list(
    state: State<AppState>,
    jenis: Option<String>,
    q: Option<String>,
) -> Result<Vec<MasterKatalog>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let j = jenis.filter(|s| !s.trim().is_empty());
    let like = q
        .filter(|s| !s.trim().is_empty())
        .map(|s| format!("%{}%", s.trim()));
    let mut stmt = db
        .prepare(&format!(
            "SELECT {} FROM master_katalog \
             WHERE (?1 IS NULL OR jenis = ?1) \
             AND (?2 IS NULL OR nama LIKE ?2 OR kode LIKE ?2 OR suplier LIKE ?2 OR brand LIKE ?2) \
             ORDER BY jenis, nama LIMIT 5000",
            KATALOG_COLS
        ))
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![j, like], row_katalog)
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(rows)
}

#[tauri::command]
pub fn master_katalog_save(
    state: State<AppState>,
    input: MasterKatalogInput,
) -> Result<MasterKatalog, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let jenis = input
        .jenis
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| "bahan".to_string());
    if let Some(id) = input.id {
        db.execute(
            "UPDATE master_katalog SET jenis = ?2, kode = ?3, nama = ?4, satuan = ?5, \
             suplier = ?6, brand = ?7, harga_acuan = ?8, catatan = ?9, updated_at = ?10 WHERE id = ?1",
            params![id, jenis, input.kode, input.nama, input.satuan, input.suplier, input.brand, input.harga_acuan, input.catatan, now()],
        )
        .map_err(|e| e.to_string())?;
        return db
            .query_row(
                &format!("SELECT {} FROM master_katalog WHERE id = ?1", KATALOG_COLS),
                params![id],
                row_katalog,
            )
            .map_err(|e| e.to_string());
    }
    let ts = now();
    db.execute(
        "INSERT INTO master_katalog (jenis, kode, nama, satuan, suplier, brand, harga_acuan, catatan, created_at, updated_at) \
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?9)",
        params![jenis, input.kode, input.nama, input.satuan, input.suplier, input.brand, input.harga_acuan, input.catatan, ts],
    )
    .map_err(|e| e.to_string())?;
    let id = db.last_insert_rowid();
    db.query_row(
        &format!("SELECT {} FROM master_katalog WHERE id = ?1", KATALOG_COLS),
        params![id],
        row_katalog,
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn master_katalog_remove(state: State<AppState>, id: i64) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute("DELETE FROM master_katalog WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// Seed katalog dari AHSP ref_db (komponen_master): bahan + alat + tenaga kerja
#[tauri::command]
pub fn master_katalog_import_ahsp(state: State<AppState>) -> Result<MkatalogImportResult, String> {
    let items: Vec<(String, Option<String>, String, Option<String>, Option<f64>)> = {
        let ref_db = state.ref_db.lock().map_err(|e| e.to_string())?;
        let mut stmt = ref_db
            .prepare("SELECT jenis, kode, uraian, satuan, harga_satuan FROM komponen_master")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, Option<String>>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, Option<String>>(3)?,
                    row.get::<_, Option<f64>>(4)?,
                ))
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();
        rows
    };
    let total = items.len() as i64;
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let ts = now();
    let mut inserted = 0i64;
    db.execute_batch("BEGIN").map_err(|e| e.to_string())?;
    {
        let mut stmt = db
            .prepare(
                "INSERT OR IGNORE INTO master_katalog (jenis, kode, nama, satuan, harga_acuan, created_at, updated_at) \
                 VALUES (?1,?2,?3,?4,?5,?6,?6)",
            )
            .map_err(|e| e.to_string())?;
        for (jenis, kode, uraian, satuan, harga) in &items {
            inserted += stmt
                .execute(params![jenis, kode, uraian, satuan, harga, ts])
                .map_err(|e| e.to_string())? as i64;
        }
    }
    db.execute_batch("COMMIT").map_err(|e| e.to_string())?;
    Ok(MkatalogImportResult {
        total,
        inserted,
        skipped: total - inserted,
    })
}

// ---------- Subkontraktor ----------

#[tauri::command]
pub fn subkon_list(state: State<AppState>) -> Result<Vec<Subkontraktor>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = db
        .prepare(&format!("SELECT {} FROM master_subkontraktor ORDER BY nama, id", SUBKON_COLS))
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], row_subkon)
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(rows)
}

#[tauri::command]
pub fn subkon_save(state: State<AppState>, input: SubkontraktorInput) -> Result<Subkontraktor, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    if let Some(id) = input.id {
        db.execute(
            "UPDATE master_subkontraktor SET nama = ?2, npwp = ?3, kualifikasi = ?4, \
             spesialisasi = ?5, kontak = ?6, telepon = ?7, email = ?8, rating = ?9, catatan = ?10, \
             updated_at = ?11 WHERE id = ?1",
            params![id, input.nama, input.npwp, input.kualifikasi, input.spesialisasi, input.kontak, input.telepon, input.email, input.rating, input.catatan, now()],
        )
        .map_err(|e| e.to_string())?;
        return db
            .query_row(&format!("SELECT {} FROM master_subkontraktor WHERE id = ?1", SUBKON_COLS), params![id], row_subkon)
            .map_err(|e| e.to_string());
    }
    let ts = now();
    db.execute(
        "INSERT INTO master_subkontraktor (nama, npwp, kualifikasi, spesialisasi, kontak, telepon, email, rating, catatan, created_at, updated_at) \
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?10)",
        params![input.nama, input.npwp, input.kualifikasi, input.spesialisasi, input.kontak, input.telepon, input.email, input.rating, input.catatan, ts],
    )
    .map_err(|e| e.to_string())?;
    let id = db.last_insert_rowid();
    db.query_row(&format!("SELECT {} FROM master_subkontraktor WHERE id = ?1", SUBKON_COLS), params![id], row_subkon)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn subkon_remove(state: State<AppState>, id: i64) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute("DELETE FROM master_subkontraktor WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ---------- Pekerjaan ----------

#[tauri::command]
pub fn pekerjaan_list(
    state: State<AppState>,
    divisi_no: Option<String>,
    q: Option<String>,
) -> Result<Vec<Pekerjaan>, String> {
    let d = divisi_no.filter(|s| !s.trim().is_empty());
    let like = q
        .filter(|s| !s.trim().is_empty())
        .map(|s| format!("%{}%", s.trim()));

    // 1) Baris pekerjaan + harga katalog resource (DB app).
    let (mut rows, prices): (Vec<Pekerjaan>, HashMap<(String, String), f64>) = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        let mut stmt = db
            .prepare(&format!(
                "SELECT {} FROM master_pekerjaan \
                 WHERE (?1 IS NULL OR divisi_no = ?1) \
                 AND (?2 IS NULL OR nama LIKE ?2 OR kode_ahsp LIKE ?2) \
                 LIMIT 5000",
                PEKERJAAN_COLS
            ))
            .map_err(|e| e.to_string())?;
        let rows: Vec<Pekerjaan> = stmt
            .query_map(params![d, like], row_pekerjaan)
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();

        let mut prices: HashMap<(String, String), f64> = HashMap::new();
        {
            let mut stmt = db
                .prepare("SELECT jenis, nama, harga_acuan FROM master_katalog WHERE harga_acuan IS NOT NULL")
                .map_err(|e| e.to_string())?;
            let it = stmt
                .query_map([], |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, Option<f64>>(2)?,
                    ))
                })
                .map_err(|e| e.to_string())?;
            for r in it.filter_map(|r| r.ok()) {
                if let Some(h) = r.2 {
                    prices.insert((r.0, r.1), h);
                }
            }
        }
        (rows, prices)
    };

    // 2) Komponen AHSP per kode pekerjaan (DB referensi, read-only).
    let komp_by_kode: HashMap<String, Vec<(Option<String>, Option<String>, f64)>> = {
        let ref_db = state.ref_db.lock().map_err(|e| e.to_string())?;
        let mut stmt = ref_db
            .prepare(
                "SELECT i.kode, k.jenis, k.uraian, k.koefisien \
                 FROM ahsp_komponen k JOIN ahsp_items i ON i.id = k.item_id",
            )
            .map_err(|e| e.to_string())?;
        let it = stmt
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, Option<String>>(1)?,
                    row.get::<_, Option<String>>(2)?,
                    row.get::<_, Option<f64>>(3)?,
                ))
            })
            .map_err(|e| e.to_string())?;
        let mut m: HashMap<String, Vec<(Option<String>, Option<String>, f64)>> = HashMap::new();
        for r in it.filter_map(|r| r.ok()) {
            m.entry(r.0).or_default().push((r.1, r.2, r.3.unwrap_or(0.0)));
        }
        m
    };

    // 3) Harga pekerjaan = Σ (koefisien × harga komponen), diambil dari katalog resource.
    //    Kosong (null) bila tidak ada satu pun komponen yang punya harga.
    for p in rows.iter_mut() {
        p.harga_acuan = p.kode_ahsp.as_deref().and_then(|kode| {
            let komps = komp_by_kode.get(kode)?;
            let mut total = 0.0f64;
            let mut priced = false;
            for (jk, uk, koef) in komps {
                let nj = jk.as_deref().and_then(norm_jenis);
                if let (Some(nj), Some(u)) = (nj, uk.as_deref()) {
                    if let Some(h) = prices.get(&(nj, u.to_string())) {
                        total += koef * h;
                        priced = true;
                    }
                }
            }
            if priced {
                Some(total)
            } else {
                None
            }
        });
    }

    let div_num = |p: &Pekerjaan| -> i64 {
        p.divisi_no.as_deref().and_then(|s| s.trim().parse::<i64>().ok()).unwrap_or(999)
    };
    rows.sort_by(|a, b| {
        div_num(a)
            .cmp(&div_num(b))
            .then_with(|| kode_cmp(a.kode_ahsp.as_deref().unwrap_or(""), b.kode_ahsp.as_deref().unwrap_or("")))
            .then_with(|| a.nama.cmp(&b.nama))
    });
    Ok(rows)
}

#[tauri::command]
pub fn pekerjaan_save(state: State<AppState>, input: PekerjaanInput) -> Result<Pekerjaan, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    if let Some(id) = input.id {
        db.execute(
            "UPDATE master_pekerjaan SET nama = ?2, satuan = ?3, kode_ahsp = ?4, divisi_no = ?5, \
             harga_acuan = ?6, catatan = ?7, updated_at = ?8 WHERE id = ?1",
            params![id, input.nama, input.satuan, input.kode_ahsp, input.divisi_no, input.harga_acuan, input.catatan, now()],
        )
        .map_err(|e| e.to_string())?;
        return db
            .query_row(&format!("SELECT {} FROM master_pekerjaan WHERE id = ?1", PEKERJAAN_COLS), params![id], row_pekerjaan)
            .map_err(|e| e.to_string());
    }
    let ts = now();
    db.execute(
        "INSERT INTO master_pekerjaan (nama, satuan, kode_ahsp, divisi_no, harga_acuan, catatan, created_at, updated_at) \
         VALUES (?1,?2,?3,?4,?5,?6,?7,?7)",
        params![input.nama, input.satuan, input.kode_ahsp, input.divisi_no, input.harga_acuan, input.catatan, ts],
    )
    .map_err(|e| e.to_string())?;
    let id = db.last_insert_rowid();
    db.query_row(&format!("SELECT {} FROM master_pekerjaan WHERE id = ?1", PEKERJAAN_COLS), params![id], row_pekerjaan)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn pekerjaan_remove(state: State<AppState>, id: i64) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute("DELETE FROM master_pekerjaan WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// Seed pekerjaan dari AHSP ref_db (ahsp_items yang memiliki komponen).
#[tauri::command]
pub fn pekerjaan_import_ahsp(state: State<AppState>) -> Result<PekerjaanImportResult, String> {
    let items: Vec<(String, String, Option<String>, Option<String>)> = {
        let ref_db = state.ref_db.lock().map_err(|e| e.to_string())?;
        let mut stmt = ref_db
            .prepare(
                "SELECT i.kode, i.uraian, i.satuan, d.no \
                 FROM ahsp_items i LEFT JOIN divisi d ON d.id = i.divisi_id \
                 WHERE EXISTS(SELECT 1 FROM ahsp_komponen k WHERE k.item_id = i.id) \
                 ORDER BY i.kode",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, Option<String>>(2)?,
                    row.get::<_, Option<String>>(3)?,
                ))
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();
        rows
    };
    let total = items.len() as i64;
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let ts = now();
    let mut inserted = 0i64;
    db.execute_batch("BEGIN").map_err(|e| e.to_string())?;
    {
        let mut stmt = db
            .prepare(
                "INSERT INTO master_pekerjaan (nama, satuan, kode_ahsp, divisi_no, created_at, updated_at) \
                 SELECT ?1, ?2, ?3, ?4, ?5, ?5 \
                 WHERE NOT EXISTS (SELECT 1 FROM master_pekerjaan WHERE kode_ahsp = ?3)",
            )
            .map_err(|e| e.to_string())?;
        for (kode, uraian, satuan, divisi_no) in &items {
            inserted += stmt
                .execute(params![uraian, satuan, kode, divisi_no, ts])
                .map_err(|e| e.to_string())? as i64;
        }
    }
    db.execute_batch("COMMIT").map_err(|e| e.to_string())?;
    Ok(PekerjaanImportResult {
        total,
        inserted,
        skipped: total - inserted,
    })
}

// ---------- Harga Katalog ----------

#[tauri::command]
pub fn katalog_list(
    state: State<AppState>,
    q: Option<String>,
    jenis: Option<String>,
) -> Result<Vec<KatalogRow>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let j = jenis.filter(|s| !s.trim().is_empty());
    let like = q
        .filter(|s| !s.trim().is_empty())
        .map(|s| format!("%{}%", s.trim()));
    let mut stmt = db
        .prepare(
            "SELECT jenis, uraian, harga, updated_at FROM harga_katalog \
             WHERE (?1 IS NULL OR jenis = ?1) AND (?2 IS NULL OR uraian LIKE ?2) \
             ORDER BY jenis, uraian LIMIT 2000",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![j, like], |row| {
            Ok(KatalogRow {
                jenis: row.get(0)?,
                uraian: row.get(1)?,
                harga: row.get(2)?,
                updated_at: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(rows)
}

#[tauri::command]
pub fn katalog_save(state: State<AppState>, input: KatalogInput) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute(
        "INSERT INTO harga_katalog (jenis, uraian, harga, updated_at) VALUES (?1, ?2, ?3, ?4) \
         ON CONFLICT(jenis, uraian) DO UPDATE SET harga = excluded.harga, updated_at = excluded.updated_at",
        params![input.jenis, input.uraian, input.harga, now()],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn katalog_remove(state: State<AppState>, jenis: String, uraian: String) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute(
        "DELETE FROM harga_katalog WHERE jenis = ?1 AND uraian = ?2",
        params![jenis, uraian],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}
