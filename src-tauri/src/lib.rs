mod commands;
mod db;
mod types;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let state = db::state_from(app.handle());
            app.manage(state);
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::project_cmd::app_info,
            commands::project_cmd::project_list,
            commands::project_cmd::project_get,
            commands::project_cmd::project_create,
            commands::project_cmd::project_update,
            commands::project_cmd::project_remove,
            commands::project_cmd::project_save_timeline,
            commands::project_cmd::org_add,
            commands::project_cmd::org_update,
            commands::project_cmd::org_remove,
            commands::ref_cmd::ref_meta,
            commands::ref_cmd::ref_divisi,
            commands::ref_cmd::ref_items,
            commands::ref_cmd::ref_item,
            commands::ref_cmd::ref_master,
            commands::rab_cmd::rab_list,
            commands::rab_cmd::rab_get,
            commands::rab_cmd::rab_create,
            commands::rab_cmd::rab_update,
            commands::rab_cmd::rab_remove,
            commands::rab_cmd::rab_duplicate,
            commands::undo_cmd::rab_snapshot,
            commands::undo_cmd::rab_restore,
            commands::undo_cmd::project_snapshot,
            commands::undo_cmd::project_restore,
            commands::rab_cmd::rab_komponen,
            commands::rab_cmd::rab_add_item,
            commands::rab_cmd::rab_add_user_item,
            commands::rab_cmd::rab_update_item,
            commands::rab_cmd::rab_remove_item,
            commands::rab_cmd::rab_set_harga_komponen,
            commands::rab_cmd::rab_hitung,
            commands::rab_cmd::rab_rekap,
            commands::rab_cmd::rab_volumes,
            commands::rab_cmd::rab_volume_add,
            commands::rab_cmd::rab_volume_update,
            commands::rab_cmd::rab_volume_remove,
            commands::rab_cmd::rab_volume_apply,
            commands::rab_cmd::rab_volumes_rab,
            commands::rab_cmd::rab_set_schedule,
            commands::master_cmd::master_katalog_list,
            commands::master_cmd::master_katalog_save,
            commands::master_cmd::master_katalog_remove,
            commands::master_cmd::master_katalog_import_ahsp,
            commands::master_cmd::subkon_list,
            commands::master_cmd::subkon_save,
            commands::master_cmd::subkon_remove,
            commands::master_cmd::pekerjaan_list,
            commands::master_cmd::pekerjaan_save,
            commands::master_cmd::pekerjaan_remove,
            commands::master_cmd::pekerjaan_import_ahsp,
            commands::master_cmd::katalog_list,
            commands::master_cmd::katalog_save,
            commands::master_cmd::katalog_remove,
            commands::progress_cmd::progress_entries,
            commands::progress_cmd::progress_add,
            commands::progress_cmd::progress_remove,
            commands::progress_cmd::progress_summary,
            commands::legal_cmd::document_list,
            commands::legal_cmd::document_get,
            commands::legal_cmd::document_save,
            commands::legal_cmd::document_remove,
            commands::legal_cmd::documents_expiring,
            commands::report_cmd::report_save_file,
            commands::report_cmd::report_save_bytes,
            commands::dashboard_cmd::dashboard_summary,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
