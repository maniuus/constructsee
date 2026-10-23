use tauri::{AppHandle, Manager};

// Bersihkan nama file: buang karakter yang tidak aman, sisakan alfanumerik dan . - _ spasi.
fn safe_name(name: &str) -> String {
    let cleaned: String = name
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.' | ' ') {
                c
            } else {
                '_'
            }
        })
        .collect();
    let t = cleaned.trim().trim_matches('.').to_string();
    if t.is_empty() {
        "export.txt".to_string()
    } else {
        t
    }
}

// Folder tujuan ekspor: Documents -> Downloads -> app data.
fn out_dir(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app
        .path()
        .document_dir()
        .or_else(|_| app.path().download_dir())
        .or_else(|_| app.path().app_data_dir())
        .map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

// Simpan berkas teks (CSV) ke folder pengguna.
#[tauri::command]
pub fn report_save_file(app: AppHandle, name: String, content: String) -> Result<String, String> {
    let dir = out_dir(&app)?;
    let path = dir.join(safe_name(&name));
    std::fs::write(&path, content.as_bytes()).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

// Decode base64 (standar, tanpa crate tambahan): spasi/baris baru diabaikan, padding '=' opsional.
fn b64_decode(s: &str) -> Result<Vec<u8>, String> {
    fn val(c: u8) -> Option<u8> {
        match c {
            b'A'..=b'Z' => Some(c - b'A'),
            b'a'..=b'z' => Some(c - b'a' + 26),
            b'0'..=b'9' => Some(c - b'0' + 52),
            b'+' => Some(62),
            b'/' => Some(63),
            _ => None,
        }
    }
    let mut out: Vec<u8> = Vec::with_capacity(s.len() / 4 * 3);
    let mut buf: u32 = 0;
    let mut bits: u32 = 0;
    for &c in s.as_bytes() {
        if c == b'=' {
            break;
        }
        let v = match val(c) {
            Some(v) => v,
            None if c.is_ascii_whitespace() => continue,
            None => return Err(format!("karakter base64 tidak valid: {}", c as char)),
        };
        buf = (buf << 6) | v as u32;
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            out.push(((buf >> bits) & 0xFF) as u8);
        }
    }
    Ok(out)
}

// Simpan berkas biner (mis. .xlsx) dari data base64 ke folder pengguna.
#[tauri::command]
pub fn report_save_bytes(app: AppHandle, name: String, data: String) -> Result<String, String> {
    let dir = out_dir(&app)?;
    let bytes = b64_decode(&data)?;
    let path = dir.join(safe_name(&name));
    std::fs::write(&path, &bytes).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}
