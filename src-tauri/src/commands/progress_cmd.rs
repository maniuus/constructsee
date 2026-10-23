use std::collections::{BTreeSet, HashMap};

use rusqlite::params;
use tauri::State;

use crate::commands::rab_cmd::compute_hitung;
use crate::db::{now, AppState};
use crate::types::*;

const ENTRY_COLS: &str = "id, item_id, tanggal, pct, volume, keterangan, created_at";

fn row_entry(row: &rusqlite::Row) -> rusqlite::Result<ProgressEntry> {
    Ok(ProgressEntry {
        id: row.get(0)?,
        item_id: row.get(1)?,
        tanggal: row.get(2)?,
        pct: row.get(3)?,
        volume: row.get(4)?,
        keterangan: row.get(5)?,
        created_at: row.get(6)?,
    })
}

/// Semua entri progress (histori) untuk satu item RAB, urut tanggal.
#[tauri::command]
pub fn progress_entries(state: State<AppState>, item_id: i64) -> Result<Vec<ProgressEntry>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = db
        .prepare(&format!(
            "SELECT {} FROM progress_entries WHERE item_id = ?1 ORDER BY tanggal, id",
            ENTRY_COLS
        ))
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![item_id], row_entry)
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(rows)
}

/// Catat satu pengukuran progress (persen kumulatif) untuk sebuah item.
#[tauri::command]
pub fn progress_add(state: State<AppState>, input: ProgressInput) -> Result<i64, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute(
        "INSERT INTO progress_entries (item_id, tanggal, pct, volume, keterangan, created_at) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            input.item_id,
            input.tanggal,
            input.pct,
            input.volume,
            input.keterangan,
            now()
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(db.last_insert_rowid())
}

#[tauri::command]
pub fn progress_remove(state: State<AppState>, id: i64) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute("DELETE FROM progress_entries WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Ringkasan progress satu RAB: bobot & % per item (kumulatif terakhir),
/// rollup per divisi, dan titik kurva-S per tanggal pengukuran.
#[tauri::command]
pub fn progress_summary(state: State<AppState>, rab_id: i64) -> Result<ProgressSummary, String> {
    // Nama divisi dari DB referensi (lock ref_db dulu, lepas, baru lock db — hindari deadlock).
    let div_names: HashMap<String, String> = {
        let ref_db = state.ref_db.lock().map_err(|e| e.to_string())?;
        let mut stmt = ref_db
            .prepare("SELECT no, nama FROM divisi")
            .map_err(|e| e.to_string())?;
        let mut map = HashMap::new();
        let rows = stmt
            .query_map([], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })
            .map_err(|e| e.to_string())?;
        for r in rows.flatten() {
            map.insert(r.0, r.1);
        }
        map
    };

    let db = state.db.lock().map_err(|e| e.to_string())?;
    let results = compute_hitung(&db, rab_id)?;

    // Entri progress per item, urut tanggal asc.
    let mut by_item: HashMap<i64, Vec<(String, f64)>> = HashMap::new();
    {
        let mut stmt = db
            .prepare(
                "SELECT e.item_id, e.tanggal, e.pct FROM progress_entries e \
                 JOIN rab_items i ON i.id = e.item_id WHERE i.rab_id = ?1 \
                 ORDER BY e.tanggal, e.id",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![rab_id], |row| {
                Ok((
                    row.get::<_, i64>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, f64>(2)?,
                ))
            })
            .map_err(|e| e.to_string())?;
        for r in rows.flatten() {
            by_item.entry(r.0).or_default().push((r.1, r.2));
        }
    }

    let total_nilai: f64 = results.iter().map(|r| r.total).sum();

    let mut items: Vec<ProgressItemRow> = Vec::with_capacity(results.len());
    let mut nilai_actual_total = 0.0;
    let mut div_acc: HashMap<String, (f64, f64)> = HashMap::new();
    let mut div_order: Vec<String> = Vec::new();

    for r in &results {
        let (pct, last_tanggal) = match by_item.get(&r.item.id).and_then(|v| v.last()) {
            Some((t, p)) => (*p, Some(t.clone())),
            None => (0.0, None),
        };
        let nilai = r.total;
        let nilai_actual = nilai * pct / 100.0;
        let bobot_pct = if total_nilai > 0.0 {
            nilai / total_nilai * 100.0
        } else {
            0.0
        };
        let volume_actual = if r.item.volume > 0.0 && pct > 0.0 {
            Some(r.item.volume * pct / 100.0)
        } else {
            None
        };
        nilai_actual_total += nilai_actual;

        let key = r.item.divisi_no.clone().unwrap_or_else(|| "0".to_string());
        if !div_acc.contains_key(&key) {
            div_order.push(key.clone());
        }
        let acc = div_acc.entry(key).or_insert((0.0, 0.0));
        acc.0 += nilai;
        acc.1 += nilai_actual;

        items.push(ProgressItemRow {
            item_id: r.item.id,
            kode: r.item.kode.clone(),
            uraian: r.item.uraian.clone(),
            satuan: r.item.satuan.clone(),
            volume: r.item.volume,
            nilai,
            bobot_pct,
            pct,
            volume_actual,
            nilai_actual,
            divisi_no: r.item.divisi_no.clone(),
            last_tanggal,
        });
    }

    let progress_pct = if total_nilai > 0.0 {
        nilai_actual_total / total_nilai * 100.0
    } else {
        0.0
    };

    div_order.sort_by(|a, b| match (a.parse::<i64>(), b.parse::<i64>()) {
        (Ok(x), Ok(y)) => x.cmp(&y),
        _ => a.cmp(b),
    });
    let divisi = div_order
        .into_iter()
        .map(|key| {
            let (nilai, actual) = div_acc.get(&key).copied().unwrap_or((0.0, 0.0));
            let progress_pct = if nilai > 0.0 {
                actual / nilai * 100.0
            } else {
                0.0
            };
            ProgressDivisiRow {
                nama: div_names
                    .get(&key)
                    .cloned()
                    .unwrap_or_else(|| format!("Divisi {}", key)),
                divisi_no: key,
                nilai,
                nilai_actual: actual,
                progress_pct,
            }
        })
        .collect();

    // Kurva-S: satu titik per tanggal pengukuran (progress kumulatif tertimbang).
    let mut dates: BTreeSet<String> = BTreeSet::new();
    for v in by_item.values() {
        for (t, _) in v {
            dates.insert(t.clone());
        }
    }
    let mut curve = Vec::with_capacity(dates.len());
    for d in &dates {
        let mut act = 0.0;
        for r in &results {
            let pct = by_item
                .get(&r.item.id)
                .map(|v| {
                    let mut cur = 0.0;
                    for (t, p) in v {
                        if t.as_str() <= d.as_str() {
                            cur = *p;
                        } else {
                            break;
                        }
                    }
                    cur
                })
                .unwrap_or(0.0);
            act += r.total * pct / 100.0;
        }
        let progress_pct = if total_nilai > 0.0 {
            act / total_nilai * 100.0
        } else {
            0.0
        };
        curve.push(ProgressPoint {
            tanggal: d.clone(),
            progress_pct,
            nilai_actual: act,
        });
    }

    Ok(ProgressSummary {
        rab_id,
        total_nilai,
        nilai_actual: nilai_actual_total,
        progress_pct,
        items,
        divisi,
        curve,
    })
}
