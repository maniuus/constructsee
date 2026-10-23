use std::cmp::Ordering;

use rusqlite::params;
use tauri::State;

use crate::db::AppState;
use crate::types::*;

/// Perbandingan kode AHSP secara natural: "1.1.2" < "1.1.10".
fn kode_cmp(a: &str, b: &str) -> Ordering {
    let mut ai = a.split('.');
    let mut bi = b.split('.');
    loop {
        match (ai.next(), bi.next()) {
            (None, None) => return Ordering::Equal,
            (None, Some(_)) => return Ordering::Less,
            (Some(_), None) => return Ordering::Greater,
            (Some(x), Some(y)) => {
                let ord = match (x.parse::<i64>(), y.parse::<i64>()) {
                    (Ok(nx), Ok(ny)) => nx.cmp(&ny),
                    _ => x.cmp(y),
                };
                if ord != Ordering::Equal {
                    return ord;
                }
            }
        }
    }
}

#[tauri::command]
pub fn ref_meta(state: State<AppState>) -> Result<Option<RefSource>, String> {
    let db = state.ref_db.lock().map_err(|e| e.to_string())?;
    db.query_row(
        "SELECT id, kode, nama, jenis, bidang, status, as_of FROM sources ORDER BY id DESC LIMIT 1",
        [],
        |row| {
            Ok(RefSource {
                id: row.get(0)?,
                kode: row.get(1)?,
                nama: row.get(2)?,
                jenis: row.get(3)?,
                bidang: row.get(4)?,
                status: row.get(5)?,
                as_of: row.get(6)?,
            })
        },
    )
    .map(Some)
    .or_else(|e| match e {
        rusqlite::Error::QueryReturnedNoRows => Ok(None),
        other => Err(other.to_string()),
    })
}

#[tauri::command]
pub fn ref_divisi(state: State<AppState>) -> Result<Vec<RefDivisi>, String> {
    let db = state.ref_db.lock().map_err(|e| e.to_string())?;
    let mut stmt = db
        .prepare(
            "SELECT d.id, d.no, d.nama,
                    (SELECT COUNT(*) FROM ahsp_items i
                     WHERE i.divisi_id = d.id
                       AND EXISTS (SELECT 1 FROM ahsp_komponen k WHERE k.item_id = i.id))
             FROM divisi d
             ORDER BY CAST(d.no AS INTEGER), d.no",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(RefDivisi {
                id: row.get(0)?,
                no: row.get(1)?,
                nama: row.get(2)?,
                item_count: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(rows)
}

#[tauri::command]
pub fn ref_items(
    state: State<AppState>,
    q: Option<String>,
    divisi_id: Option<i64>,
) -> Result<Vec<RefItem>, String> {
    let db = state.ref_db.lock().map_err(|e| e.to_string())?;
    let like = q
        .filter(|s| !s.trim().is_empty())
        .map(|s| format!("%{}%", s.trim()));
    let mut stmt = db
        .prepare(
            "SELECT i.id, i.kode, i.uraian, i.satuan, i.level, d.no, d.nama
             FROM ahsp_items i
             LEFT JOIN divisi d ON d.id = i.divisi_id
             WHERE (?1 IS NULL OR i.divisi_id = ?1)
               AND (?2 IS NULL OR i.kode LIKE ?2 OR i.uraian LIKE ?2)
               AND EXISTS (SELECT 1 FROM ahsp_komponen k WHERE k.item_id = i.id)",
        )
        .map_err(|e| e.to_string())?;
    let mut rows: Vec<RefItem> = stmt
        .query_map(params![divisi_id, like], |row| {
            Ok(RefItem {
                id: row.get(0)?,
                kode: row.get(1)?,
                uraian: row.get(2)?,
                satuan: row.get(3)?,
                level: row.get(4)?,
                divisi_no: row.get(5)?,
                divisi_nama: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    rows.sort_by(|a, b| kode_cmp(&a.kode, &b.kode));
    rows.truncate(2000);
    Ok(rows)
}

#[tauri::command]
pub fn ref_item(state: State<AppState>, kode: String) -> Result<Option<RefItemDetail>, String> {
    let db = state.ref_db.lock().map_err(|e| e.to_string())?;
    let item = db
        .query_row(
            "SELECT i.id, i.kode, i.uraian, i.satuan, i.level, d.no, d.nama
             FROM ahsp_items i
             LEFT JOIN divisi d ON d.id = i.divisi_id
             WHERE i.kode = ?1",
            params![kode],
            |row| {
                Ok(RefItem {
                    id: row.get(0)?,
                    kode: row.get(1)?,
                    uraian: row.get(2)?,
                    satuan: row.get(3)?,
                    level: row.get(4)?,
                    divisi_no: row.get(5)?,
                    divisi_nama: row.get(6)?,
                })
            },
        )
        .ok();
    let Some(item) = item else {
        return Ok(None);
    };
    let mut stmt = db
        .prepare(
            "SELECT id, jenis, uraian, kode, satuan, koefisien, harga_satuan, pos
             FROM ahsp_komponen WHERE item_id = ?1 ORDER BY pos",
        )
        .map_err(|e| e.to_string())?;
    let komponen = stmt
        .query_map(params![item.id], |row| {
            Ok(RefKomponen {
                id: row.get(0)?,
                jenis: row.get(1)?,
                uraian: row.get(2)?,
                kode: row.get(3)?,
                satuan: row.get(4)?,
                koefisien: row.get(5)?,
                harga_satuan: row.get(6)?,
                pos: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(Some(RefItemDetail { item, komponen }))
}

#[tauri::command]
pub fn ref_master(
    state: State<AppState>,
    q: Option<String>,
    jenis: Option<String>,
) -> Result<Vec<RefMaster>, String> {
    let db = state.ref_db.lock().map_err(|e| e.to_string())?;
    let like = q
        .filter(|s| !s.trim().is_empty())
        .map(|s| format!("%{}%", s.trim()));
    let jenis = jenis.filter(|s| !s.trim().is_empty());
    let mut stmt = db
        .prepare(
            "SELECT id, jenis, uraian, kode, satuan, harga_satuan
             FROM komponen_master
             WHERE (?1 IS NULL OR jenis = ?1)
               AND (?2 IS NULL OR uraian LIKE ?2 OR kode LIKE ?2)
             ORDER BY uraian LIMIT 500",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![jenis, like], |row| {
            Ok(RefMaster {
                id: row.get(0)?,
                jenis: row.get(1)?,
                uraian: row.get(2)?,
                kode: row.get(3)?,
                satuan: row.get(4)?,
                harga_satuan: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(rows)
}
