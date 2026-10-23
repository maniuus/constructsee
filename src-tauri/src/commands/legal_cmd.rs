use rusqlite::params;
use tauri::State;

use crate::db::{now, AppState};
use crate::types::*;

const DOC_COLS: &str = "id, project_id, kategori, arah, nomor, judul, tanggal, dari_pihak, \
    kepada_pihak, instansi, status, masa_berlaku_dari, masa_berlaku_sampai, reminder_days, \
    keterangan, created_at, updated_at";

fn row_document(row: &rusqlite::Row) -> rusqlite::Result<Document> {
    Ok(Document {
        id: row.get(0)?,
        project_id: row.get(1)?,
        kategori: row.get(2)?,
        arah: row.get(3)?,
        nomor: row.get(4)?,
        judul: row.get(5)?,
        tanggal: row.get(6)?,
        dari_pihak: row.get(7)?,
        kepada_pihak: row.get(8)?,
        instansi: row.get(9)?,
        status: row.get(10)?,
        masa_berlaku_dari: row.get(11)?,
        masa_berlaku_sampai: row.get(12)?,
        reminder_days: row.get(13)?,
        keterangan: row.get(14)?,
        created_at: row.get(15)?,
        updated_at: row.get(16)?,
    })
}

#[tauri::command]
pub fn document_list(
    state: State<AppState>,
    project_id: Option<i64>,
    kategori: Option<String>,
    q: Option<String>,
) -> Result<Vec<Document>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let kat = kategori.filter(|s| !s.trim().is_empty());
    let like = q
        .filter(|s| !s.trim().is_empty())
        .map(|s| format!("%{}%", s.trim()));
    let mut stmt = db
        .prepare(&format!(
            "SELECT {} FROM documents \
             WHERE (?1 IS NULL OR project_id = ?1) \
               AND (?2 IS NULL OR kategori = ?2) \
               AND (?3 IS NULL OR nomor LIKE ?3 OR judul LIKE ?3 OR dari_pihak LIKE ?3 \
                    OR kepada_pihak LIKE ?3 OR instansi LIKE ?3) \
             ORDER BY COALESCE(tanggal, created_at) DESC, id DESC LIMIT 2000",
            DOC_COLS
        ))
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![project_id, kat, like], row_document)
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(rows)
}

#[tauri::command]
pub fn document_get(state: State<AppState>, id: i64) -> Result<Option<Document>, String> {
    use rusqlite::OptionalExtension;
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.query_row(
        &format!("SELECT {} FROM documents WHERE id = ?1", DOC_COLS),
        params![id],
        row_document,
    )
    .optional()
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn document_save(state: State<AppState>, input: DocumentInput) -> Result<Document, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let kategori = input.kategori.filter(|s| !s.trim().is_empty()).unwrap_or_else(|| "surat".to_string());
    let status = input.status.filter(|s| !s.trim().is_empty()).unwrap_or_else(|| "draft".to_string());
    if let Some(id) = input.id {
        db.execute(
            "UPDATE documents SET project_id = ?2, kategori = ?3, arah = ?4, nomor = ?5, \
             judul = ?6, tanggal = ?7, dari_pihak = ?8, kepada_pihak = ?9, instansi = ?10, \
             status = ?11, masa_berlaku_dari = ?12, masa_berlaku_sampai = ?13, reminder_days = ?14, \
             keterangan = ?15, updated_at = ?16 WHERE id = ?1",
            params![
                id, input.project_id, kategori, input.arah, input.nomor, input.judul, input.tanggal,
                input.dari_pihak, input.kepada_pihak, input.instansi, status, input.masa_berlaku_dari,
                input.masa_berlaku_sampai, input.reminder_days, input.keterangan, now()
            ],
        )
        .map_err(|e| e.to_string())?;
        return db
            .query_row(&format!("SELECT {} FROM documents WHERE id = ?1", DOC_COLS), params![id], row_document)
            .map_err(|e| e.to_string());
    }
    let ts = now();
    db.execute(
        "INSERT INTO documents (project_id, kategori, arah, nomor, judul, tanggal, dari_pihak, \
         kepada_pihak, instansi, status, masa_berlaku_dari, masa_berlaku_sampai, reminder_days, \
         keterangan, created_at, updated_at) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?15)",
        params![
            input.project_id, kategori, input.arah, input.nomor, input.judul, input.tanggal,
            input.dari_pihak, input.kepada_pihak, input.instansi, status, input.masa_berlaku_dari,
            input.masa_berlaku_sampai, input.reminder_days, input.keterangan, ts
        ],
    )
    .map_err(|e| e.to_string())?;
    let id = db.last_insert_rowid();
    db.query_row(&format!("SELECT {} FROM documents WHERE id = ?1", DOC_COLS), params![id], row_document)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn document_remove(state: State<AppState>, id: i64) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute("DELETE FROM documents WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Dokumen dengan masa berlaku yang akan/sudah berakhir dalam `days` hari ke depan.
#[tauri::command]
pub fn documents_expiring(state: State<AppState>, days: i64) -> Result<Vec<Document>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let modifier = format!("+{} days", days.max(0));
    let mut stmt = db
        .prepare(&format!(
            "SELECT {} FROM documents \
             WHERE masa_berlaku_sampai IS NOT NULL AND masa_berlaku_sampai <> '' \
               AND status <> 'dibatalkan' \
               AND date(masa_berlaku_sampai) <= date('now', ?1) \
             ORDER BY date(masa_berlaku_sampai) ASC LIMIT 500",
            DOC_COLS
        ))
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(params![modifier], row_document)
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(rows)
}
