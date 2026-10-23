use rusqlite::{params, OptionalExtension};
use tauri::State;

use crate::db::{now, AppState};
use crate::types::*;

const PROJECT_COLS: &str = "id, kode, nama, klien, konsultan, nilai_kontrak, jenis, \
    lokasi_prov, lokasi_kab, lokasi_alamat, status, tanggal_mulai, tanggal_selesai, \
    masa_pemeliharaan, keterangan, created_at, updated_at";

const TIMELINE_COLS: &str = "project_id, tgl_kontrak, tgl_spmk, tgl_mulai_kerja, \
    tgl_selesai_rencana, tgl_pho, tgl_fho, perpanjangan_hari, masa_pemeliharaan_selesai, catatan";

const ORG_COLS: &str = "id, project_id, nama, jabatan, institusi, telepon, email, pos";

fn row_project(row: &rusqlite::Row) -> rusqlite::Result<Project> {
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
}

fn row_timeline(row: &rusqlite::Row) -> rusqlite::Result<ContractTimeline> {
    Ok(ContractTimeline {
        project_id: row.get(0)?,
        tgl_kontrak: row.get(1)?,
        tgl_spmk: row.get(2)?,
        tgl_mulai_kerja: row.get(3)?,
        tgl_selesai_rencana: row.get(4)?,
        tgl_pho: row.get(5)?,
        tgl_fho: row.get(6)?,
        perpanjangan_hari: row.get(7)?,
        masa_pemeliharaan_selesai: row.get(8)?,
        catatan: row.get(9)?,
    })
}

fn row_org(row: &rusqlite::Row) -> rusqlite::Result<ProjectOrg> {
    Ok(ProjectOrg {
        id: row.get(0)?,
        project_id: row.get(1)?,
        nama: row.get(2)?,
        jabatan: row.get(3)?,
        institusi: row.get(4)?,
        telepon: row.get(5)?,
        email: row.get(6)?,
        pos: row.get(7)?,
    })
}

#[tauri::command]
pub fn app_info(state: State<AppState>) -> Result<AppInfo, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let project_count: i64 = db
        .query_row("SELECT COUNT(*) FROM projects", [], |row| row.get(0))
        .map_err(|e| e.to_string())?;
    Ok(AppInfo { project_count })
}

#[tauri::command]
pub fn project_list(state: State<AppState>) -> Result<Vec<Project>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = db
        .prepare(&format!("SELECT {} FROM projects ORDER BY id DESC", PROJECT_COLS))
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], row_project)
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(rows)
}

#[tauri::command]
pub fn project_get(state: State<AppState>, id: i64) -> Result<ProjectDetail, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let project = db
        .query_row(
            &format!("SELECT {} FROM projects WHERE id = ?1", PROJECT_COLS),
            params![id],
            row_project,
        )
        .map_err(|e| e.to_string())?;
    let timeline = db
        .query_row(
            &format!("SELECT {} FROM contract_timelines WHERE project_id = ?1", TIMELINE_COLS),
            params![id],
            row_timeline,
        )
        .optional()
        .map_err(|e| e.to_string())?;
    let mut stmt = db
        .prepare(&format!(
            "SELECT {} FROM project_orgs WHERE project_id = ?1 ORDER BY pos, id",
            ORG_COLS
        ))
        .map_err(|e| e.to_string())?;
    let orgs = stmt
        .query_map(params![id], row_org)
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(ProjectDetail { project, timeline, orgs })
}

#[tauri::command]
pub fn project_create(state: State<AppState>, input: ProjectInput) -> Result<Project, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let ts = now();
    db.execute(
        "INSERT INTO projects (kode, nama, klien, konsultan, nilai_kontrak, jenis, \
         lokasi_prov, lokasi_kab, lokasi_alamat, status, tanggal_mulai, tanggal_selesai, \
         masa_pemeliharaan, keterangan, created_at, updated_at) \
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?15)",
        params![
            input.kode,
            input.nama,
            input.klien,
            input.konsultan,
            input.nilai_kontrak,
            input.jenis,
            input.lokasi_prov,
            input.lokasi_kab,
            input.lokasi_alamat,
            input.status.unwrap_or_else(|| "perencanaan".to_string()),
            input.tanggal_mulai,
            input.tanggal_selesai,
            input.masa_pemeliharaan,
            input.keterangan,
            ts
        ],
    )
    .map_err(|e| e.to_string())?;
    let id = db.last_insert_rowid();
    db.execute(
        "INSERT OR IGNORE INTO contract_timelines (project_id) VALUES (?1)",
        params![id],
    )
    .map_err(|e| e.to_string())?;
    db.query_row(
        &format!("SELECT {} FROM projects WHERE id = ?1", PROJECT_COLS),
        params![id],
        row_project,
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn project_update(state: State<AppState>, id: i64, input: ProjectInput) -> Result<Project, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute(
        "UPDATE projects SET \
         kode = ?2, nama = ?3, klien = ?4, konsultan = ?5, nilai_kontrak = ?6, jenis = ?7, \
         lokasi_prov = ?8, lokasi_kab = ?9, lokasi_alamat = ?10, status = COALESCE(?11, status), \
         tanggal_mulai = ?12, tanggal_selesai = ?13, masa_pemeliharaan = ?14, keterangan = ?15, \
         updated_at = ?16 \
         WHERE id = ?1",
        params![
            id,
            input.kode,
            input.nama,
            input.klien,
            input.konsultan,
            input.nilai_kontrak,
            input.jenis,
            input.lokasi_prov,
            input.lokasi_kab,
            input.lokasi_alamat,
            input.status,
            input.tanggal_mulai,
            input.tanggal_selesai,
            input.masa_pemeliharaan,
            input.keterangan,
            now()
        ],
    )
    .map_err(|e| e.to_string())?;
    db.query_row(
        &format!("SELECT {} FROM projects WHERE id = ?1", PROJECT_COLS),
        params![id],
        row_project,
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn project_remove(state: State<AppState>, id: i64) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute("DELETE FROM projects WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn project_save_timeline(
    state: State<AppState>,
    project_id: i64,
    input: TimelineInput,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute(
        "INSERT INTO contract_timelines \
         (project_id, tgl_kontrak, tgl_spmk, tgl_mulai_kerja, tgl_selesai_rencana, tgl_pho, \
          tgl_fho, perpanjangan_hari, masa_pemeliharaan_selesai, catatan) \
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10) \
         ON CONFLICT(project_id) DO UPDATE SET \
          tgl_kontrak = excluded.tgl_kontrak, tgl_spmk = excluded.tgl_spmk, \
          tgl_mulai_kerja = excluded.tgl_mulai_kerja, tgl_selesai_rencana = excluded.tgl_selesai_rencana, \
          tgl_pho = excluded.tgl_pho, tgl_fho = excluded.tgl_fho, \
          perpanjangan_hari = excluded.perpanjangan_hari, \
          masa_pemeliharaan_selesai = excluded.masa_pemeliharaan_selesai, catatan = excluded.catatan",
        params![
            project_id,
            input.tgl_kontrak,
            input.tgl_spmk,
            input.tgl_mulai_kerja,
            input.tgl_selesai_rencana,
            input.tgl_pho,
            input.tgl_fho,
            input.perpanjangan_hari,
            input.masa_pemeliharaan_selesai,
            input.catatan
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn org_add(state: State<AppState>, project_id: i64, input: OrgInput) -> Result<ProjectOrg, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let pos: i64 = db
        .query_row(
            "SELECT COALESCE(MAX(pos), -1) + 1 FROM project_orgs WHERE project_id = ?1",
            params![project_id],
            |row| row.get(0),
        )
        .unwrap_or(0);
    db.execute(
        "INSERT INTO project_orgs (project_id, nama, jabatan, institusi, telepon, email, pos) \
         VALUES (?1,?2,?3,?4,?5,?6,?7)",
        params![
            project_id,
            input.nama,
            input.jabatan,
            input.institusi,
            input.telepon,
            input.email,
            pos
        ],
    )
    .map_err(|e| e.to_string())?;
    let id = db.last_insert_rowid();
    db.query_row(
        &format!("SELECT {} FROM project_orgs WHERE id = ?1", ORG_COLS),
        params![id],
        row_org,
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn org_update(state: State<AppState>, id: i64, input: OrgInput) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute(
        "UPDATE project_orgs SET nama = ?2, jabatan = ?3, institusi = ?4, telepon = ?5, email = ?6 WHERE id = ?1",
        params![id, input.nama, input.jabatan, input.institusi, input.telepon, input.email],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn org_remove(state: State<AppState>, id: i64) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute("DELETE FROM project_orgs WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}
