use std::collections::HashMap;

use rusqlite::params;
use tauri::State;

use crate::commands::rab_cmd::compute_hitung;
use crate::db::AppState;
use crate::types::*;

const EXPIRING_DAYS: i64 = 30;

#[tauri::command]
pub fn dashboard_summary(state: State<AppState>) -> Result<DashboardSummary, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    let project_count: i64 = db
        .query_row("SELECT COUNT(*) FROM projects", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;

    let total_nilai_kontrak: f64 = db
        .query_row("SELECT COALESCE(SUM(nilai_kontrak), 0) FROM projects", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;

    let total_dokumen: i64 = db
        .query_row("SELECT COUNT(*) FROM documents", [], |r| r.get(0))
        .map_err(|e| e.to_string())?;

    let by_status: Vec<StatusCount> = {
        let mut stmt = db
            .prepare("SELECT status, COUNT(*) FROM projects GROUP BY status ORDER BY COUNT(*) DESC")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| Ok(StatusCount { status: row.get(0)?, count: row.get(1)? }))
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();
        rows
    };

    let mut rabs_by_project: HashMap<i64, Vec<i64>> = HashMap::new();
    {
        let mut stmt = db.prepare("SELECT id, project_id FROM rabs").map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| Ok((row.get::<_, i64>(0)?, row.get::<_, i64>(1)?)))
            .map_err(|e| e.to_string())?;
        for r in rows.filter_map(|r| r.ok()) {
            rabs_by_project.entry(r.1).or_default().push(r.0);
        }
    }

    let mut latest: HashMap<i64, f64> = HashMap::new();
    let mut last_progress_by_item: HashMap<i64, String> = HashMap::new();
    {
        let mut stmt = db
            .prepare("SELECT item_id, pct, tanggal FROM progress_entries ORDER BY tanggal, id")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| {
                Ok((row.get::<_, i64>(0)?, row.get::<_, f64>(1)?, row.get::<_, String>(2)?))
            })
            .map_err(|e| e.to_string())?;
        for r in rows.filter_map(|r| r.ok()) {
            latest.insert(r.0, r.1);
            last_progress_by_item.insert(r.0, r.2);
        }
    }

    let mut doc_count: HashMap<i64, i64> = HashMap::new();
    {
        let mut stmt = db
            .prepare("SELECT project_id, COUNT(*) FROM documents GROUP BY project_id")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| Ok((row.get::<_, i64>(0)?, row.get::<_, i64>(1)?)))
            .map_err(|e| e.to_string())?;
        for r in rows.filter_map(|r| r.ok()) {
            doc_count.insert(r.0, r.1);
        }
    }

    let mut doc_expiring: HashMap<i64, i64> = HashMap::new();
    {
        let mut stmt = db
            .prepare(
                "SELECT project_id, COUNT(*) FROM documents \
                 WHERE masa_berlaku_sampai IS NOT NULL AND masa_berlaku_sampai <> '' \
                 AND status <> 'dibatalkan' \
                 AND date(masa_berlaku_sampai) <= date('now', ?1) \
                 GROUP BY project_id",
            )
            .map_err(|e| e.to_string())?;
        let modi = format!("+{} days", EXPIRING_DAYS);
        let rows = stmt
            .query_map(params![modi], |row| Ok((row.get::<_, i64>(0)?, row.get::<_, i64>(1)?)))
            .map_err(|e| e.to_string())?;
        for r in rows.filter_map(|r| r.ok()) {
            doc_expiring.insert(r.0, r.1);
        }
    }

    let projects: Vec<Project> = {
        let mut stmt = db
            .prepare(
                "SELECT id, kode, nama, klien, konsultan, nilai_kontrak, jenis, lokasi_prov, \
                 lokasi_kab, lokasi_alamat, status, tanggal_mulai, tanggal_selesai, \
                 masa_pemeliharaan, keterangan, created_at, updated_at FROM projects ORDER BY id DESC",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| {
                Ok(Project {
                    id: row.get(0)?,
                    kode: row.get(1)?,
                    nama: row.get(2)?,
                    klien: row.get(3)?,
                    konsultan: row.get(4)?,
                    nilai_kontrak: row.get(5)?,
                    jenis: row.get(6)?,
                    lokasi_prov: row.get(7)?,
                    lokasi_kab: row.get(8)?,
                    lokasi_alamat: row.get(9)?,
                    status: row.get(10)?,
                    tanggal_mulai: row.get(11)?,
                    tanggal_selesai: row.get(12)?,
                    masa_pemeliharaan: row.get(13)?,
                    keterangan: row.get(14)?,
                    created_at: row.get(15)?,
                    updated_at: row.get(16)?,
                })
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();
        rows
    };

    let mut out: Vec<DashboardProjectRow> = Vec::new();
    let mut total_rab = 0.0;
    let mut grand_actual = 0.0;
    for p in &projects {
        let mut rab_count = 0i64;
        let mut rab_total = 0.0;
        let mut nilai_actual = 0.0;
        let mut last_progress: Option<String> = None;
        if let Some(ids) = rabs_by_project.get(&p.id) {
            rab_count = ids.len() as i64;
            for rid in ids {
                if let Ok(h) = compute_hitung(&db, *rid) {
                    for r in h {
                        rab_total += r.total;
                        let pct = latest.get(&r.item.id).copied().unwrap_or(0.0);
                        nilai_actual += r.total * pct / 100.0;
                        if let Some(t) = last_progress_by_item.get(&r.item.id) {
                            if last_progress.as_deref().map_or(true, |cur| t.as_str() > cur) {
                                last_progress = Some(t.clone());
                            }
                        }
                    }
                }
            }
        }
        let progress_pct = if rab_total > 0.0 { nilai_actual / rab_total * 100.0 } else { 0.0 };
        let margin_pct =
            p.nilai_kontrak.filter(|v| *v > 0.0).map(|nc| (nc - rab_total) / nc * 100.0);
        total_rab += rab_total;
        grand_actual += nilai_actual;
        out.push(DashboardProjectRow {
            id: p.id,
            kode: p.kode.clone(),
            nama: p.nama.clone(),
            status: p.status.clone(),
            klien: p.klien.clone(),
            nilai_kontrak: p.nilai_kontrak,
            rab_count,
            rab_total,
            progress_pct,
            margin_pct,
            dokumen_count: doc_count.get(&p.id).copied().unwrap_or(0),
            dokumen_expiring: doc_expiring.get(&p.id).copied().unwrap_or(0),
            last_progress,
        });
    }

    let expiring_count: i64 = doc_expiring.values().sum();
    let progress_pct = if total_rab > 0.0 { grand_actual / total_rab * 100.0 } else { 0.0 };

    Ok(DashboardSummary {
        project_count,
        total_nilai_kontrak,
        total_rab,
        total_dokumen,
        expiring_count,
        progress_pct,
        by_status,
        projects: out,
    })
}
