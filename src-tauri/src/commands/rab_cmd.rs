use rusqlite::{params, Connection, OptionalExtension};
use tauri::State;

use crate::db::{norm_jenis, now, AppState};
use crate::types::*;

const RAB_COLS: &str = "id, project_id, nama, ppn_pct, status, catatan, created_at, updated_at";

const ITEM_COLS: &str = "id, rab_id, ref_item_id, kode, uraian, satuan, volume, level, is_user, \
    divisi_no, overhead_pct, pos, durasi_hari, tgl_mulai";

const KOMP_COLS: &str = "id, rab_item_id, jenis, uraian, kode, satuan, koefisien, harga_satuan, pos";

fn row_rab(row: &rusqlite::Row) -> rusqlite::Result<Rab> {
    Ok(Rab {
        id: row.get(0)?,
        project_id: row.get(1)?,
        nama: row.get(2)?,
        ppn_pct: row.get(3)?,
        status: row.get(4)?,
        catatan: row.get(5)?,
        created_at: row.get(6)?,
        updated_at: row.get(7)?,
    })
}

fn row_item(row: &rusqlite::Row) -> rusqlite::Result<RabItem> {
    Ok(RabItem {
        id: row.get(0)?,
        rab_id: row.get(1)?,
        ref_item_id: row.get(2)?,
        kode: row.get(3)?,
        uraian: row.get(4)?,
        satuan: row.get(5)?,
        volume: row.get(6)?,
        level: row.get(7)?,
        is_user: row.get(8)?,
        divisi_no: row.get(9)?,
        overhead_pct: row.get(10)?,
        pos: row.get(11)?,
        durasi_hari: row.get(12)?,
        tgl_mulai: row.get(13)?,
    })
}

fn row_komp(row: &rusqlite::Row) -> rusqlite::Result<RabKomponen> {
    Ok(RabKomponen {
        id: row.get(0)?,
        rab_item_id: row.get(1)?,
        jenis: row.get(2)?,
        uraian: row.get(3)?,
        kode: row.get(4)?,
        satuan: row.get(5)?,
        koefisien: row.get(6)?,
        harga_satuan: row.get(7)?,
        pos: row.get(8)?,
    })
}

fn group_letter(j: Option<&str>) -> Option<&'static str> {
    let s = j.unwrap_or("").to_lowercase();
    if s.contains("tenaga kerja") {
        Some("A")
    } else if s.contains("bahan") {
        Some("B")
    } else if s.contains("peralatan") || s.contains("alat") {
        Some("C")
    } else {
        None
    }
}

fn item_by_id(db: &Connection, item_id: i64) -> Result<RabItem, String> {
    db.query_row(
        &format!("SELECT {} FROM rab_items WHERE id = ?1", ITEM_COLS),
        params![item_id],
        row_item,
    )
    .map_err(|e| e.to_string())
}

// ---------------- RAB header ----------------

#[tauri::command]
pub fn rab_list(state: State<AppState>, project_id: i64) -> Result<Vec<Rab>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = db
        .prepare(&format!(
            "SELECT {} FROM rabs WHERE project_id = ?1 ORDER BY id DESC",
            RAB_COLS
        ))
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![project_id], row_rab)
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(rows)
}

#[tauri::command]
pub fn rab_get(state: State<AppState>, rab_id: i64) -> Result<RabDetail, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let rab = db
        .query_row(
            &format!("SELECT {} FROM rabs WHERE id = ?1", RAB_COLS),
            params![rab_id],
            row_rab,
        )
        .map_err(|e| e.to_string())?;
    let mut stmt = db
        .prepare(&format!(
            "SELECT {} FROM rab_items WHERE rab_id = ?1 ORDER BY pos, id",
            ITEM_COLS
        ))
        .map_err(|e| e.to_string())?;
    let mut items: Vec<RabItem> = stmt
        .query_map(params![rab_id], row_item)
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    sort_items_by_kode(&mut items);
    Ok(RabDetail { rab, items })
}

#[tauri::command]
pub fn rab_create(
    state: State<AppState>,
    project_id: i64,
    nama: String,
    ppn_pct: Option<f64>,
) -> Result<Rab, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let ts = now();
    db.execute(
        "INSERT INTO rabs (project_id, nama, ppn_pct, status, created_at, updated_at) \
         VALUES (?1, ?2, ?3, 'draft', ?4, ?4)",
        params![project_id, nama, ppn_pct.unwrap_or(11.0), ts],
    )
    .map_err(|e| e.to_string())?;
    let id = db.last_insert_rowid();
    db.query_row(
        &format!("SELECT {} FROM rabs WHERE id = ?1", RAB_COLS),
        params![id],
        row_rab,
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn rab_update(
    state: State<AppState>,
    rab_id: i64,
    nama: Option<String>,
    ppn_pct: Option<f64>,
    status: Option<String>,
    catatan: Option<String>,
) -> Result<Rab, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute(
        "UPDATE rabs SET nama = COALESCE(?2, nama), ppn_pct = COALESCE(?3, ppn_pct), \
         status = COALESCE(?4, status), catatan = ?5, updated_at = ?6 WHERE id = ?1",
        params![rab_id, nama, ppn_pct, status, catatan, now()],
    )
    .map_err(|e| e.to_string())?;
    db.query_row(
        &format!("SELECT {} FROM rabs WHERE id = ?1", RAB_COLS),
        params![rab_id],
        row_rab,
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn rab_remove(state: State<AppState>, rab_id: i64) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute("DELETE FROM rabs WHERE id = ?1", params![rab_id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Duplikat RAB beserta seluruh item, komponen analisa, dan baris take-off volume.
#[tauri::command]
pub fn rab_duplicate(state: State<AppState>, rab_id: i64, nama: String) -> Result<Rab, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let ts = now();
    let tx = db.unchecked_transaction().map_err(|e| e.to_string())?;

    let src = tx
        .query_row(
            &format!("SELECT {} FROM rabs WHERE id = ?1", RAB_COLS),
            params![rab_id],
            row_rab,
        )
        .optional()
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "RAB tidak ditemukan.".to_string())?;

    tx.execute(
        "INSERT INTO rabs (project_id, nama, ppn_pct, status, catatan, created_at, updated_at) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)",
        params![src.project_id, nama, src.ppn_pct, src.status, src.catatan, ts],
    )
    .map_err(|e| e.to_string())?;
    let new_rab = tx.last_insert_rowid();

    let items: Vec<RabItem> = {
        let mut stmt = tx
            .prepare(&format!(
                "SELECT {} FROM rab_items WHERE rab_id = ?1 ORDER BY pos, id",
                ITEM_COLS
            ))
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![rab_id], row_item)
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();
        rows
    };

    for it in items {
        tx.execute(
            "INSERT INTO rab_items (rab_id, ref_item_id, kode, uraian, satuan, volume, level, is_user, \
             divisi_no, overhead_pct, pos, durasi_hari, tgl_mulai) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
            params![
                new_rab,
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
        let new_item = tx.last_insert_rowid();

        tx.execute(
            "INSERT INTO rab_item_komponen (rab_item_id, jenis, uraian, kode, satuan, koefisien, harga_satuan, pos) \
             SELECT ?1, jenis, uraian, kode, satuan, koefisien, harga_satuan, pos \
             FROM rab_item_komponen WHERE rab_item_id = ?2 ORDER BY pos, id",
            params![new_item, it.id],
        )
        .map_err(|e| e.to_string())?;

        tx.execute(
            "INSERT INTO rab_volume (item_id, uraian, bentuk, panjang, lebar, lebar2, tinggi, jumlah, pos, created_at, updated_at) \
             SELECT ?1, uraian, bentuk, panjang, lebar, lebar2, tinggi, jumlah, pos, ?3, ?3 \
             FROM rab_volume WHERE item_id = ?2 ORDER BY pos, id",
            params![new_item, it.id, ts],
        )
        .map_err(|e| e.to_string())?;
    }

    tx.commit().map_err(|e| e.to_string())?;
    db.query_row(
        &format!("SELECT {} FROM rabs WHERE id = ?1", RAB_COLS),
        params![new_rab],
        row_rab,
    )
    .map_err(|e| e.to_string())
}

// ---------------- RAB items ----------------

#[tauri::command]
pub fn rab_komponen(state: State<AppState>, item_id: i64) -> Result<Vec<RabKomponen>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = db
        .prepare(&format!(
            "SELECT {} FROM rab_item_komponen WHERE rab_item_id = ?1 ORDER BY pos, id",
            KOMP_COLS
        ))
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![item_id], row_komp)
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(rows)
}

/// Tambah item RAB dari kode AHSP: snapshot komponen + harga dari katalog.
#[tauri::command]
pub fn rab_add_item(
    state: State<AppState>,
    rab_id: i64,
    kode: String,
    volume: Option<f64>,
) -> Result<RabItem, String> {
    let vol = volume.unwrap_or(0.0);

    // Fase 1: baca referensi AHSP (lock ref_db).
    let (ref_item_id, ckode, curaian, csatuan, clevel, cdivisi, overhead, komp) = {
        let ref_db = state.ref_db.lock().map_err(|e| e.to_string())?;
        let card: Option<(i64, String, String, Option<String>, i64, Option<String>, Option<f64>)> =
            ref_db
                .query_row(
                    "SELECT i.id, i.kode, i.uraian, i.satuan, i.level, d.no, i.overhead_pct
                     FROM ahsp_items i LEFT JOIN divisi d ON d.id = i.divisi_id
                     WHERE i.kode = ?1",
                    params![kode],
                    |row| {
                        Ok((
                            row.get(0)?,
                            row.get(1)?,
                            row.get(2)?,
                            row.get(3)?,
                            row.get(4)?,
                            row.get(5)?,
                            row.get(6)?,
                        ))
                    },
                )
                .optional()
                .map_err(|e| e.to_string())?;
        let Some(card) = card else {
            return Err(format!("Kode AHSP tidak ditemukan: {}", kode));
        };
        let mut stmt = ref_db
            .prepare(
                "SELECT jenis, uraian, kode, satuan, koefisien, pos
                 FROM ahsp_komponen WHERE item_id = ?1 ORDER BY pos",
            )
            .map_err(|e| e.to_string())?;
        let komp: Vec<(Option<String>, Option<String>, Option<String>, Option<String>, Option<f64>, i64)> =
            stmt.query_map(params![card.0], |row| {
                Ok((
                    row.get(0)?,
                    row.get(1)?,
                    row.get(2)?,
                    row.get(3)?,
                    row.get(4)?,
                    row.get(5)?,
                ))
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();
        (
            card.0,
            card.1,
            card.2,
            card.3,
            card.4,
            card.5,
            card.6.unwrap_or(0.1),
            komp,
        )
    };

    // Fase 2: tulis ke DB aplikasi (lock db).
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let last_pos: i64 = db
        .query_row(
            "SELECT COALESCE(MAX(pos), -1) + 1 FROM rab_items WHERE rab_id = ?1",
            params![rab_id],
            |row| row.get(0),
        )
        .unwrap_or(0);
    db.execute_batch("BEGIN").map_err(|e| e.to_string())?;
    db.execute(
        "INSERT INTO rab_items (rab_id, ref_item_id, kode, uraian, satuan, volume, level, \
         is_user, divisi_no, overhead_pct, pos) VALUES (?1,?2,?3,?4,?5,?6,?7,0,?8,?9,?10)",
        params![rab_id, ref_item_id, ckode, curaian, csatuan, vol, clevel, cdivisi, overhead, last_pos],
    )
    .map_err(|e| e.to_string())?;
    let item_id = db.last_insert_rowid();
    for (jk, uk, kkode, ks, koef, pos) in &komp {
        let harga: Option<f64> = match jk.as_deref().and_then(norm_jenis) {
            Some(nj) => db
                .query_row(
                    "SELECT harga FROM harga_katalog WHERE jenis = ?1 AND uraian = ?2",
                    params![nj, uk],
                    |row| row.get::<_, Option<f64>>(0),
                )
                .optional()
                .map_err(|e| e.to_string())?
                .flatten(),
            None => None,
        };
        db.execute(
            "INSERT INTO rab_item_komponen (rab_item_id, jenis, uraian, kode, satuan, koefisien, \
             harga_satuan, pos) VALUES (?1,?2,?3,?4,?5,?6,?7,?8)",
            params![item_id, jk, uk, kkode, ks, koef, harga, pos],
        )
        .map_err(|e| e.to_string())?;
    }
    db.execute("UPDATE rabs SET updated_at = ?2 WHERE id = ?1", params![rab_id, now()])
        .map_err(|e| e.to_string())?;
    db.execute_batch("COMMIT").map_err(|e| e.to_string())?;

    item_by_id(&db, item_id)
}

/// Tambah item manual (tanpa AHSP) — satu baris komponen "Bahan" agar bisa diberi harga.
#[tauri::command]
pub fn rab_add_user_item(
    state: State<AppState>,
    rab_id: i64,
    uraian: String,
    satuan: Option<String>,
    volume: Option<f64>,
    divisi_no: Option<String>,
) -> Result<RabItem, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let last_pos: i64 = db
        .query_row(
            "SELECT COALESCE(MAX(pos), -1) + 1 FROM rab_items WHERE rab_id = ?1",
            params![rab_id],
            |row| row.get(0),
        )
        .unwrap_or(0);
    db.execute_batch("BEGIN").map_err(|e| e.to_string())?;
    db.execute(
        "INSERT INTO rab_items (rab_id, uraian, satuan, volume, level, is_user, divisi_no, \
         overhead_pct, pos) VALUES (?1,?2,?3,?4,0,1,?5,0.1,?6)",
        params![rab_id, uraian, satuan, volume.unwrap_or(0.0), divisi_no, last_pos],
    )
    .map_err(|e| e.to_string())?;
    let item_id = db.last_insert_rowid();
    db.execute(
        "INSERT INTO rab_item_komponen (rab_item_id, jenis, uraian, kode, satuan, koefisien, \
         harga_satuan, pos) VALUES (?1, 'Bahan', ?2, NULL, ?3, 1, NULL, 0)",
        params![item_id, uraian, satuan],
    )
    .map_err(|e| e.to_string())?;
    db.execute("UPDATE rabs SET updated_at = ?2 WHERE id = ?1", params![rab_id, now()])
        .map_err(|e| e.to_string())?;
    db.execute_batch("COMMIT").map_err(|e| e.to_string())?;
    item_by_id(&db, item_id)
}

#[tauri::command]
pub fn rab_update_item(
    state: State<AppState>,
    item_id: i64,
    uraian: Option<String>,
    satuan: Option<String>,
    volume: Option<f64>,
    overhead_pct: Option<f64>,
) -> Result<RabItem, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute(
        "UPDATE rab_items SET uraian = COALESCE(?2, uraian), satuan = COALESCE(?3, satuan), \
         volume = COALESCE(?4, volume), overhead_pct = COALESCE(?5, overhead_pct) WHERE id = ?1",
        params![item_id, uraian, satuan, volume, overhead_pct],
    )
    .map_err(|e| e.to_string())?;
    item_by_id(&db, item_id)
}

#[tauri::command]
pub fn rab_remove_item(state: State<AppState>, item_id: i64) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute("DELETE FROM rab_items WHERE id = ?1", params![item_id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Set harga satuan komponen pada RAB ini; opsional ikut menulis ke katalog AHSP.
#[tauri::command]
pub fn rab_set_harga_komponen(
    state: State<AppState>,
    rab_id: i64,
    jenis: Option<String>,
    uraian: Option<String>,
    harga: Option<f64>,
    update_catalog: Option<bool>,
) -> Result<(), String> {
    let nj = jenis.as_deref().and_then(norm_jenis);
    let v = harga.filter(|h| h.is_finite());
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let tx = db.unchecked_transaction().map_err(|e| e.to_string())?;
    if update_catalog.unwrap_or(false) {
        if let (Some(ref nj_val), Some(ref ur)) = (nj, &uraian) {
            tx.execute(
                "INSERT INTO harga_katalog (jenis, uraian, harga, updated_at) VALUES (?1, ?2, ?3, ?4) \
                 ON CONFLICT(jenis, uraian) DO UPDATE SET harga = excluded.harga, updated_at = excluded.updated_at",
                params![nj_val, ur, v, now()],
            )
            .map_err(|e| e.to_string())?;
        }
    }
    if let (Some(ref j), Some(ref u)) = (jenis, &uraian) {
        tx.execute(
            "UPDATE rab_item_komponen SET harga_satuan = ?1 WHERE rab_item_id IN \
             (SELECT id FROM rab_items WHERE rab_id = ?2) AND jenis = ?3 AND uraian = ?4",
            params![v, rab_id, j, u],
        )
        .map_err(|e| e.to_string())?;
    }
    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}

// ---------------- Perhitungan ----------------

/// Bandingkan kode bertitik secara natural (1.1.2 < 1.1.10).
pub(crate) fn kode_cmp(a: &str, b: &str) -> std::cmp::Ordering {
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

fn sort_items_by_kode(items: &mut [RabItem]) {
    items.sort_by(|a, b| {
        kode_cmp(
            a.kode.as_deref().unwrap_or(""),
            b.kode.as_deref().unwrap_or(""),
        )
    });
}

pub(crate) fn compute_hitung(db: &Connection, rab_id: i64) -> Result<Vec<HitungResult>, String> {
    let mut stmt = db
        .prepare(&format!(
            "SELECT {} FROM rab_items WHERE rab_id = ?1 ORDER BY pos, id",
            ITEM_COLS
        ))
        .map_err(|e| e.to_string())?;
    let items: Vec<RabItem> = stmt
        .query_map(params![rab_id], row_item)
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    let mut stmt = db
        .prepare(
            "SELECT k.rab_item_id, k.id, k.jenis, k.uraian, k.kode, k.satuan, k.koefisien, \
             k.harga_satuan, k.pos
             FROM rab_item_komponen k JOIN rab_items i ON i.id = k.rab_item_id
             WHERE i.rab_id = ?1 ORDER BY k.rab_item_id, k.pos, k.id",
        )
        .map_err(|e| e.to_string())?;
    let all_komp: Vec<(i64, i64, Option<String>, Option<String>, Option<String>, Option<String>, Option<f64>, Option<f64>, i64)> =
        stmt.query_map(params![rab_id], |row| {
            Ok((
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                row.get(3)?,
                row.get(4)?,
                row.get(5)?,
                row.get(6)?,
                row.get(7)?,
                row.get(8)?,
            ))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    let mut by_item: std::collections::HashMap<i64, Vec<HitungKomponen>> =
        std::collections::HashMap::new();
    for (item_id, kid, jk, uk, kkode, ks, koef, hs, pos) in all_komp {
        let h_j = hs.zip(koef).map(|(h, k)| h * k);
        by_item.entry(item_id).or_default().push(HitungKomponen {
            id: kid,
            rab_item_id: item_id,
            jenis: jk,
            uraian: uk,
            kode: kkode,
            satuan: ks,
            koefisien: koef,
            harga_satuan: hs,
            harga_jumlah: h_j,
            pos,
        });
    }

    let mut results = Vec::new();
    for item in items {
        let komps = by_item.remove(&item.id).unwrap_or_default();
        let mut sums = [0.0f64; 3];
        for k in &komps {
            if let (Some(huruf), Some(hj)) = (group_letter(k.jenis.as_deref()), k.harga_jumlah) {
                match huruf {
                    "A" => sums[0] += hj,
                    "B" => sums[1] += hj,
                    "C" => sums[2] += hj,
                    _ => {}
                }
            }
        }
        let d = sums[0] + sums[1] + sums[2];
        let overhead_pct = item.overhead_pct;
        let e = d * overhead_pct;
        let f = d + e;
        let total = f * item.volume;
        results.push(HitungResult {
            item,
            komponen: komps,
            subtotal: HitungSubtotal { a: sums[0], b: sums[1], c: sums[2], d, e, f },
            overhead_pct,
            total,
        });
    }
    results.sort_by(|a, b| {
        kode_cmp(
            a.item.kode.as_deref().unwrap_or(""),
            b.item.kode.as_deref().unwrap_or(""),
        )
    });
    Ok(results)
}

#[tauri::command]
pub fn rab_hitung(state: State<AppState>, rab_id: i64) -> Result<Vec<HitungResult>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    compute_hitung(&db, rab_id)
}

#[tauri::command]
pub fn rab_rekap(state: State<AppState>, rab_id: i64) -> Result<RabRekap, String> {
    // Nama divisi dari DB referensi.
    let div_names: std::collections::HashMap<String, String> = {
        let ref_db = state.ref_db.lock().map_err(|e| e.to_string())?;
        let mut stmt = ref_db
            .prepare("SELECT no, nama FROM divisi")
            .map_err(|e| e.to_string())?;
        let mut map = std::collections::HashMap::new();
        let rows = stmt
            .query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)))
            .map_err(|e| e.to_string())?;
        for r in rows.flatten() {
            map.insert(r.0, r.1);
        }
        map
    };

    let db = state.db.lock().map_err(|e| e.to_string())?;
    let ppn_pct: f64 = db
        .query_row("SELECT ppn_pct FROM rabs WHERE id = ?1", params![rab_id], |row| row.get(0))
        .map_err(|e| e.to_string())?;
    let results = compute_hitung(&db, rab_id)?;

    let mut order: Vec<String> = Vec::new();
    let mut sums: std::collections::HashMap<String, f64> = std::collections::HashMap::new();
    for r in &results {
        let key = r.item.divisi_no.clone().unwrap_or_else(|| "0".to_string());
        if !sums.contains_key(&key) {
            order.push(key.clone());
        }
        *sums.entry(key).or_insert(0.0) += r.total;
    }
    order.sort_by(|a, b| {
        match (a.parse::<i64>(), b.parse::<i64>()) {
            (Ok(x), Ok(y)) => x.cmp(&y),
            _ => a.cmp(b),
        }
    });

    let mut rows = Vec::new();
    let mut subtotal = 0.0;
    for key in order {
        let total = sums.get(&key).copied().unwrap_or(0.0);
        subtotal += total;
        rows.push(RekapRow {
            divisi_no: Some(key.clone()),
            nama: div_names
                .get(&key)
                .cloned()
                .unwrap_or_else(|| format!("Divisi {}", key)),
            total,
        });
    }
    let ppn = subtotal * ppn_pct / 100.0;
    Ok(RabRekap {
        rows,
        subtotal,
        ppn_pct,
        ppn,
        total: subtotal + ppn,
    })
}

// ---- Take-off volume ----

const VOL_COLS: &str = "id, item_id, uraian, bentuk, panjang, lebar, lebar2, tinggi, jumlah, pos, created_at, updated_at";

fn row_volume(row: &rusqlite::Row) -> rusqlite::Result<RabVolume> {
    Ok(RabVolume {
        id: row.get(0)?,
        item_id: row.get(1)?,
        uraian: row.get(2)?,
        bentuk: row.get::<_, Option<String>>(3)?.unwrap_or_else(|| "kotak".to_string()),
        panjang: row.get(4)?,
        lebar: row.get(5)?,
        lebar2: row.get(6)?,
        tinggi: row.get(7)?,
        jumlah: row.get(8)?,
        pos: row.get(9)?,
        created_at: row.get(10)?,
        updated_at: row.get(11)?,
    })
}

#[tauri::command]
pub fn rab_volumes(state: State<AppState>, item_id: i64) -> Result<Vec<RabVolume>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = db
        .prepare(&format!(
            "SELECT {} FROM rab_volume WHERE item_id = ?1 ORDER BY pos, id",
            VOL_COLS
        ))
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![item_id], row_volume)
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect::<Vec<_>>();
    Ok(rows)
}

#[tauri::command]
pub fn rab_volume_add(state: State<AppState>, input: VolumeInput) -> Result<i64, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let ts = now();
    db.execute(
        "INSERT INTO rab_volume (item_id, uraian, bentuk, panjang, lebar, lebar2, tinggi, jumlah, pos, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        params![
            input.item_id,
            input.uraian,
            input.bentuk.unwrap_or_else(|| "kotak".to_string()),
            input.panjang,
            input.lebar,
            input.lebar2,
            input.tinggi,
            input.jumlah,
            input.pos.unwrap_or(0),
            ts,
            ts
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(db.last_insert_rowid())
}

#[tauri::command]
pub fn rab_volume_update(state: State<AppState>, input: VolumeInput) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    if let Some(id) = input.id {
        db.execute(
            "UPDATE rab_volume SET uraian = COALESCE(?2, uraian), bentuk = COALESCE(?3, bentuk), panjang = COALESCE(?4, panjang), lebar = COALESCE(?5, lebar), lebar2 = COALESCE(?6, lebar2), tinggi = COALESCE(?7, tinggi), jumlah = COALESCE(?8, jumlah), updated_at = ?9 WHERE id = ?1",
            params![
                id,
                input.uraian,
                input.bentuk,
                input.panjang,
                input.lebar,
                input.lebar2,
                input.tinggi,
                input.jumlah,
                now()
            ],
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn rab_volume_remove(state: State<AppState>, id: i64) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute("DELETE FROM rab_volume WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn rab_volume_apply(state: State<AppState>, item_id: i64) -> Result<f64, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let changed = db.execute(
        "UPDATE rab_items SET volume = COALESCE((SELECT SUM(CASE bentuk WHEN 'silinder' THEN 0.7853981633974483 * COALESCE(lebar, 0) * COALESCE(lebar, 0) WHEN 'trapesium' THEN ((COALESCE(lebar, 0) + COALESCE(lebar2, 0)) / 2.0) * COALESCE(tinggi, 0) ELSE COALESCE(lebar, 0) * COALESCE(tinggi, 0) END * COALESCE(panjang, 0) * COALESCE(jumlah, 0)) FROM rab_volume WHERE item_id = ?1), 0) WHERE id = ?1",
        params![item_id],
    )
    .map_err(|e| e.to_string())?;
    let vol: f64 = db
        .query_row("SELECT volume FROM rab_items WHERE id = ?1", params![item_id], |r| r.get(0))
        .map_err(|e| e.to_string())?;
    log::info!("rab_volume_apply item_id={} rows_changed={} volume={}", item_id, changed, vol);
    Ok(vol)
}

/// Semua baris take-off volume untuk satu RAB (laporan "Backup Volume").
#[tauri::command]
pub fn rab_volumes_rab(state: State<AppState>, rab_id: i64) -> Result<Vec<RabVolume>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = db
        .prepare(&format!(
            "SELECT {} FROM rab_volume WHERE item_id IN (SELECT id FROM rab_items WHERE rab_id = ?1) ORDER BY item_id, pos, id",
            VOL_COLS
        ))
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![rab_id], row_volume)
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect::<Vec<_>>();
    Ok(rows)
}

/// Simpan durasi + tanggal mulai item (untuk time schedule di laporan).
#[tauri::command]
pub fn rab_set_schedule(
    state: State<AppState>,
    item_id: i64,
    durasi_hari: Option<f64>,
    tgl_mulai: Option<String>,
) -> Result<RabItem, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute(
        "UPDATE rab_items SET durasi_hari = ?2, tgl_mulai = ?3 WHERE id = ?1",
        params![item_id, durasi_hari, tgl_mulai],
    )
    .map_err(|e| e.to_string())?;
    item_by_id(&db, item_id)
}
