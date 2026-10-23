# Constructsee

ERP desktop untuk kontraktor (Project, RAB, Progress, Legal/Admin, Master Data) — dibangun
from scratch dengan **Tauri v2 + Rust + React 19 + TypeScript + Vite**.

## Unduh & Instalasi

Installer Windows 64-bit tersedia di tab **[Releases](../../releases)**:

- `Constructsee_0.1.0_x64-setup.exe` — installer NSIS (disarankan)
- `Constructsee_0.1.0_x64_en-US.msi` — installer MSI

Kebutuhan: **Windows 10/11 64-bit**. WebView2 Runtime dibutuhkan — bila belum ada, installer
mengunduhnya otomatis. Installer belum ditandatangani secara digital, jadi Windows SmartScreen
dapat menampilkan "Windows protected your PC" → **More info → Run anyway**.

## Cara Pakai Singkat

1. **Project** — buat proyek (kode + nama), isi nilai kontrak, lalu lengkapi tab Timeline Kontrak
   dan Organisasi.
2. **RAB** — buat RAB, tambahkan item dari katalog AHSP atau item manual, lalu isi volume.
   Gunakan **Take-off Volume** untuk menghitung volume dari dimensi (kotak/trapesium/silinder),
   dan panel analisa untuk melihat/mengubah harga satuan serta overhead.
3. **Progress** — pilih proyek + RAB, catat progress harian per item (bisa lewat % kumulatif
   atau volume terpasang).
4. **Legal / Admin** — daftarkan dokumen, surat, dan izin beserta masa berlaku + pengingat.
5. **Report** — cetak RAB/Progress ke PDF (print) atau ekspor ke Excel (.xlsx, satu seksi = satu sheet).
6. **Dashboard** — ringkasan lintas proyek (nilai kontrak, progress, dokumen jatuh tempo).

## Data & Privasi

- Seluruh data disimpan **lokal** di `%APPDATA%\com.abimanyu.constructsee\`:
  `constructsee.db` (data aplikasi) dan `ahsp-lib.db` (referensi AHSP).
- Tidak ada telemetry, tidak ada koneksi jaringan, tidak ada akun.
- Backup = salin folder tersebut saat aplikasi tertutup.

## Status

**Phase 21 — Skin aplikasi modern: seluruh permukaan UI (appbar, sidebar, tombol, form, tabel, badge, tab, panel, toast, dialog, command palette, onboarding) direstyling lewat lapisan `styles/modern.css` yang di-import setelah `globals.css` — latar putih/abu netral, accent biru `#2563eb`, sudut 6–8px, font Segoe UI, kontrol 34px, focus ring biru; panel `.term` yang sebelumnya CRT gelap ikut menjadi terang, dan blok laporan cetak tidak berubah.** Sebelumnya, **Phase 20 — Panduan awal (onboarding) untuk instalasi pertama: overlay 5 langkah (Selamat datang · Alur kerja · Data & keamanan · Tips keyboard · Mulai) dengan rail langkah yang bisa diklik, navigasi tombol/panah keyboard, dan Esc/Lewati. Ditampilkan sekali per instalasi (penanda `localStorage` `constructsee:onboarded:v1`), bisa dibuka ulang lewat tombol info di appbar atau Ctrl+K → "Panduan Awal". Langkah terakhir menawarkan "Buat Proyek Pertama" (langsung membuka form proyek) atau "Jelajahi Dulu".** Sebelumnya, **Phase 19 — UI usability pass: sidebar tiap modul diberi satu baris keterangan (mis. RAB → "Rincian anggaran"), baris yang sedang dibuka ditandai di daftar Project dan RAB, aksi hapus/salin pada baris hanya muncul saat hover/fokus (selalu tampil di perangkat sentuh; `aria-label` + tooltip menyebut nama data), dan baris daftar bisa dibuka lewat keyboard (Tab + Enter/Space, dengan focus ring). Form proyek dikelompokkan menjadi Identitas · Kontrak & Status · Lokasi & Jadwal · Catatan, kode proyek otomatis fokus saat "Proyek Baru", Esc menutup form, dan memilih proyek lain saat form masih berisi akan menampilkan konfirmasi "Buang Perubahan?" (anti lost-work). Timeline Kontrak kini punya indikator "Belum disimpan/Tersimpan" dan tombol simpan nonaktif bila tidak ada perubahan; daftar proyek memakai skeleton saat memuat; empty-state membedakan "belum ada proyek" vs "pencarian tidak cocok" dan menyertakan tombol aksi (Proyek Baru / Bersihkan pencarian).** Sebelumnya, **Phase 18 — Undo hapus proyek/RAB + scope harga komponen: sebelum hard delete frontend menyimpan snapshot JSON (`rab_snapshot`/`rab_restore`, `project_snapshot`/`project_restore`), toast "Undo" (20 dtk) memulihkan seluruh isi (item, komponen, take-off, progress, timeline, org, dokumen; kode proyek bentrok otomatis diberi sufiks `-2`), dan edit harga komponen kini default hanya untuk RAB ini dengan centang "Terapkan juga ke katalog AHSP".** Sebelumnya, **Phase 17 — UX hardening (audit persona QS): parser angka koma-desimal di semua modul, kosong-dihitung-0 pada take-off (JS + SQL), bentuk volume m3 jadi pilihan eksplisit, undo hapus baris/item/progress, Salin RAB, pencarian item + peringatan kode duplikat, input overhead %, status simpan di statusbar, dan pesan error ramah (`ErrorBox`).** Sebelumnya, **Phase 16 — Report multi-seksi dengan page break: laporan RAB kini terdiri dari 7 seksi (Rekapitulasi · RAB per divisi dalam satu tabel · BOQ + biaya A/B/C terpisah · Rekap item analisa · Backup volume tiap item · Time schedule dengan input durasi & tanggal mulai per item serta bar Gantt · Kebutuhan tenaga kerja/bahan/alat per item + rekap agregat); tiap seksi otomatis mulai di halaman baru saat dicetak.** Sebelumnya, **Phase 15 — Take-off Volume: input volume pekerjaan per item RAB lewat baris dimensi (uraian × panjang × lebar × tinggi × jumlah), lalu di-sync ke volume perhitungan RAB.** Sebelumnya, **Phase 14 — polish UI: strip KPI Dashboard kini panel telemetry CRT (`.term`), toolbar + empty-state konsisten di semua modul (Dashboard, Report), densitas baris tabel lebih rapat.** Sebelumnya, **Phase 13 — kerangka aplikasi desktop (status bar + toolbar + split-pane, hilangkan "dead space"): status bar bawah (● SIAP · modul · jam live), toolbar per modul (search + counter), Project jadi split-pane list + detail ter-dock, RAB/Master/Legal daftar scroll-internal. Tema tetap Hybrid Industrial (Phase 12): substrate terang ala _Swiss Industrial Print_ (kertas, tipografi mono tegas, apartemen grid, hazard red `#e61919` sebagai satu-satunya accent, semua sudut 90°) untuk shell/workspace, dan panel CRT gelap _Tactical Telemetry_ (scope `.term`) untuk permukaan analisa (Analisa Harga Satuan RAB, Pengukuran Progress). Tanpa radius, tanpa gradient, tanpa shadow blur — hanya hard rule 1–2px + offset shadow keras. Shell: appbar + search, sidebar berkelompok, breadcrumb, master/detail drawer, dialog kustom, toast, command palette (Ctrl+K).** Seluruh modul roadmap MVP (Project, RAB, Master Data, Progress, Legal/Admin, Report, Dashboard) tetap aktif.

## Stack

| Layer | Teknologi |
|-------|-----------|
| Shell | Tauri v2 (Rust) |
| Backend | Rust — `rusqlite` (SQLite, WAL), `chrono` |
| Frontend | React 19, TypeScript 7, Vite 8 |
| Styling | Vanilla CSS dua lapis: **`styles/modern.css`** = skin aktif (permukaan putih/abu netral, accent biru `#2563eb`, radius 6–8px, font Segoe UI, kontrol 34px, focus ring biru) di atas **`styles/globals.css`** = kerangka Hybrid Industrial (grid, panel, tabel, `.term`, laporan cetak). Blok `.report-sheet` + `@media print` tetap Times New Roman + layout A4. Ikon: komponen inline SVG sendiri (tanpa dependency). |
| DB | rilis: 2 koneksi — `constructsee.db` (app, single DB untuk semua proyek) + `ahsp-lib.db` (referensi AHSP, read-only) |

## Arsitektur

- **Single DB** di `%APPDATA%\com.abimanyu.constructsee\constructsee.db`.
- **ref_db AHSP** (`ahsp-lib.db`) di-seed dari `src-tauri/resources/ahsp-lib.db` saat pertama jalan;
  dipakai modul RAB fase berikutnya. File ini adalah hasil publish dari app **ahsp-library**
  (`../ahsp-library/`) yang tetap terpisah sebagai tool kelola+publish data AHSP.
- Modul = modular monolith: UI React → IPC Tauri → command Rust per modul → SQLite.

## Skema DB (Phase 1–15)

- `projects` — data proyek (kode, nama, klien, lokasi, nilai kontrak, tanggal, status).
- `contract_timelines` — timeline kontrak 1:1 per proyek (FK `ON DELETE CASCADE`).
- `project_orgs` — struktur organisasi proyek (FK `ON DELETE CASCADE`, urut `pos`).
- `rabs` — header RAB per proyek (nama, `ppn_pct`, status, catatan).
- `rab_items` — item RAB (snapshot dari AHSP atau manual `is_user=1`; `volume`, `divisi_no`, `overhead_pct`).
- `rab_item_komponen` — komponen per item (jenis, koefisien, `harga_satuan`).
- `rab_volume` — baris take-off volume per item RAB (uraian, panjang, lebar, tinggi, jumlah, pos);
  `rab_volume_apply` menulis `rab_items.volume = Σ(panjang × lebar × tinggi × jumlah)` sehingga ikut terhitung di `rab_hitung`.
- `harga_katalog` — harga satuan per `(jenis, uraian)` (normalized jenis) — dipakai auto-fill saat item ditambah.
- `master_katalog` — katalog resource terpadu (**bahan + alat + tenaga kerja**) dengan `kode`, `nama`,
  `satuan`, `suplier`, `brand`, `harga_acuan`, `catatan` (UNIQUE `jenis,nama`). Di-seed dari `komponen_master`
  AHSP via command `master_katalog_import_ahsp` (2.690 baris: 2.543 bahan, 124 alat, 23 tenaga kerja).
- `master_subkontraktor` — master subkontraktor / vendor (NPWP, kualifikasi, spesialisasi, kontak, rating).
- `master_pekerjaan` — master pekerjaan (nama, satuan, kode AHSP, divisi; `harga_acuan` **dihitung**, bukan input).
  Di-seed dari `ahsp_items` (yang punya komponen) via `pekerjaan_import_ahsp`; dikelompokkan per divisi di UI.
  Harga per pekerjaan = **Σ (koefisien × harga komponen)** — komponen dipetakan ke `master_katalog` (normalized
  `jenis` + `nama`), jadi terisi setelah harga di tab Katalog Resource diisi.
- `progress_entries` — catatan progress (pengukuran % kumulatif) per item RAB (tanggal, pct, volume, keterangan).
- `documents` — register dokumen legal/admin per proyek (FK `ON DELETE CASCADE`): `kategori`
  (kontrak/surat/berita_acara/izin/gambar/laporan/tagihan/jaminan/lainnya), `arah` (surat masuk/keluar),
  nomor, judul, tanggal, dari/kepada, instansi, status, masa berlaku + `reminder_days`.

## Commands (Rust)

| Command | Keterangan |
|---------|------------|
| `app_info` | jumlah proyek |
| `project_list` | daftar proyek (urut id DESC) |
| `project_get` | detail proyek + timeline + orgs |
| `project_create` | buat proyek (+ timeline kosong) |
| `project_update` | ubah proyek |
| `project_remove` | hapus proyek |
| `project_save_timeline` | UPSERT timeline kontrak |
| `org_add` / `org_update` / `org_remove` | CRUD struktur organisasi |
| `ref_meta` / `ref_divisi` / `ref_items` / `ref_item` / `ref_master` | baca referensi AHSP (read-only dari `ahsp-lib.db`) |
| `rab_list` / `rab_get` / `rab_create` / `rab_update` / `rab_remove` | CRUD header RAB |
| `rab_komponen` | komponen satu item |
| `rab_add_item` | tambah item dari kode AHSP (snapshot komponen + auto-fill harga katalog) |
| `rab_add_user_item` | tambah item manual |
| `rab_update_item` / `rab_remove_item` | ubah / hapus item |
| `rab_set_harga_komponen` | set harga satuan → tulis katalog + snapshot item RAB |
| `rab_hitung` | hitung per item (A tenaga kerja, B bahan, C peralatan, D=A+B+C, E overhead, F=D+E) |
| `rab_rekap` | rekapitulasi per divisi + PPN + total |
| `rab_volumes` / `rab_volume_add` / `rab_volume_update` / `rab_volume_remove` | CRUD baris take-off volume per item RAB |
| `rab_volume_apply` | sync Σ(panjang × lebar × tinggi × jumlah) → `rab_items.volume` (dipakai `rab_hitung`) |
| `master_katalog_list` / `master_katalog_save` / `master_katalog_remove` | CRUD katalog resource (bahan/alat/tenaga kerja + suplier/brand) |
| `master_katalog_import_ahsp` | seed katalog dari `komponen_master` AHSP (idempotent, `INSERT OR IGNORE`) |
| `subkon_list` / `subkon_save` / `subkon_remove` | CRUD master subkontraktor |
| `pekerjaan_list(divisi_no?, q?)` / `pekerjaan_save` / `pekerjaan_remove` | CRUD master pekerjaan (list difilter divisi + search, urut kode AHSP natural; `harga_acuan` dihitung Σ koefisien × harga komponen dari katalog resource) |
| `pekerjaan_import_ahsp` | seed pekerjaan dari `ahsp_items` (yang punya komponen) AHSP (idempotent) |
| `katalog_list` / `katalog_save` / `katalog_remove` | lihat / ubah / hapus harga katalog |
| `progress_summary` | ringkasan progress RAB: bobot & % per item, rollup per divisi, kurva-S |
| `progress_entries` / `progress_add` / `progress_remove` | histori / catat / hapus pengukuran progress per item |
| `document_list` / `document_get` / `document_save` / `document_remove` | CRUD register dokumen legal/admin |
| `documents_expiring` | dokumen dengan masa berlaku berakhir ≤ N hari (peringatan) |
| `report_save_file` / `report_save_bytes` | tulis berkas teks / biner (base64, mis. .xlsx) ke Documents/Downloads → kembalikan path |
| `dashboard_summary` | ringkasan lintas proyek: KPI, status proyek, nilai kontrak/RAB, margin, progress fisik, dokumen + yang segera berakhir |

## UI (Phase 12 — Hybrid Industrial)

Tema diambil dari skill **industrial-brutalist-ui**: substrate terang **Swiss Industrial Print** untuk shell + workspace, dan panel CRT gelap **Tactical Telemetry** untuk permukaan analisa. Aturan keras:

- **Satu archetype per permukaan** — shell/tabel/form = kertas terang; panel analisa = gelap (scope `.term`).
- **0 radius** di seluruh UI (`border-radius: 0`), tanpa gradient, tanpa translucent blur, tanpa soft drop-shadow.
  Hanya hard rule (1–2px solid) + offset shadow keras untuk overlay (`6px 6px 0`, `3px 3px 0`).
- **Hazard red `#e61919`** adalah satu-satunya accent (garis struktur, highlight data vital, tombol primary,
  marker status). Status lain pakai token semantik (`--ok/--warn/--danger/--info`).
- **Mono telemetry** — semua angka/metadata/ID memakai `--mono` uppercase dengan tracking lebar;
  high-level headers pakai sans tebal uppercase.
- **Token** (`src/renderer/src/styles/globals.css` `:root`): substrate `--paper/--paper-2/--paper-3`,
  tinta `--ink/--ink-2/--ink-3/--ink-dim`, rule `--rule/--rule-2`; CRT `--crt/--crt-2/--crt-3` + `--phos*`;
  accent `--red` (+ `--green` single-use); status `--ok/--warn/--danger/--info`; motion (`--ease`, `--t-fast/med`).
  Mendukung `:focus-visible` (ring merah), scrollbar kustom, `prefers-reduced-motion`.
- **Scope `.term`** — me-remap token substrate ke CRT gelap, sehingga komponen yang sudah ada otomatis
  berpindah ke mode telemetry. Diterapkan pada: **Analisa Harga Satuan** (RAB) dan **Pengukuran Progress**.
- **Ikon** — `src/renderer/src/components/Icons.tsx` (30 glyph inline SVG, `strokeWidth 1.8`, tanpa dependency baru).
- **Primitives** — `src/renderer/src/components/ui.tsx`: `ToastProvider`/`useToast`, `ConfirmProvider`/`useConfirm`
  (menggantikan `window.confirm`), `Drawer` (master/detail), `CommandPalette` (Ctrl+K). Toast & palette
  dirender di atas substrate CRT gelap.
- **Shell** — appbar 48px (brand mark merah + search), sidebar 220px berkelompok (**Operasional / Data / Insight**) + ikon,
  breadcrumb di `.content`; rail ikon ≤620px.
- **Pola** — list = tabel `thead` sticky dalam `.table-wrap` (scroll internal via `.module.fill`), klik-baris buka drawer,
  hapus via dialog konfirmasi + toast, empty-state `.empty`, segmented control `.tabs`, badge = tag persegi
  dengan marker kotak (bukan pill).
- **Ikon tombol** — semua tombol aksi utama memakai `Icon` (`plus`, `refresh`, `print`, `download`, `arrow-left`, `close`, …);
  `.btn` = inline-flex gap 6px sehingga ikon + label otomatis sejajar.
- **Scroll internal** — `.module.fill` + `.panel.fill` (panel daftar flex + `overflow:auto`, `thead` sticky) diterapkan ke
  **Master Data** (4 tab) dan panel register **Legal/Admin**; modul lain tetap scroll halaman.
  `.module.fill` butuh child eksplisit `.panel.fill` agar panel alert/form di atas daftar tetap tinggi normal.

## Pengembangan

```bash
npm install --prefer-offline     # install deps
npm run dev                      # tauri dev (Vite :1422 + window Constructsee)
npm run typecheck                # tsc node + web
npm run build:vite               # build frontend saja
npm run build                    # tauri build (installer)
cargo check --offline            # dari src-tauri/ — cepat & hemat network

CI: `.github/workflows/ci.yml` (typecheck + `cargo test`) dan `.github/workflows/release.yml`
(tag `v*` → draft release berisi NSIS + MSI) sudah tersedia, tetapi **GitHub Actions belum aktif**
untuk akun ini (billing) sehingga keduanya belum berjalan.

Rilis manual:

```bash
npm run build
# hasil: src-tauri/target/release/bundle/nsis/*-setup.exe
#        src-tauri/target/release/bundle/msi/*.msi
gh release create v0.1.0 src-tauri/target/release/bundle/nsis/*-setup.exe   src-tauri/target/release/bundle/msi/*.msi --title "Constructsee v0.1.0" --draft
```
```

Catatan lingkungan:

- **react & react-dom wajib versi sama persis** (mis. `19.2.8`) — mismatch menyebabkan window blank.
- `Cargo.lock` disalin dari app sibling (`ahsp-library`) supaya `cargo check --offline` jalan
  (crates.io sangat lambat di mesin ini). Kalau deps Rust berubah, update lock secara eksplisit.
- Dev port: estimato `1420`, ahsp-library `1421`, **constructsee `1422`**.
- Membuka `http://localhost:1422` di browser menampilkan layar notice (invoke Tauri tidak tersedia
  di luar runtime Tauri) — gunakan jendela desktop.

## Roadmap

1. ~~**RAB** — konsumsi `ahsp-lib.db` (browse AHSP, auto-fill harga katalog, RAB builder).~~ ✅ selesai
2. ~~**Master Data** — material, subkon, satuan, harga katalog.~~ ✅ selesai
3. ~~**Progress** — progress harian per item (core).~~ ✅ selesai
4. ~~**Legal/Admin** — register dokumen, surat, berita acara, izin.~~ ✅ selesai
5. ~~**Report** — cetak RAB & Progress (PDF via print) + ekspor Excel (.xlsx, 1 seksi = 1 sheet).~~ ✅ selesai
6. ~~**Dashboard** — ringkasan lintas proyek.~~ ✅ selesai
7. ~~**Take-off Volume** — input volume per item RAB (baris dimensi) → sync ke perhitungan RAB.~~ ✅ selesai
8. Komponen volume take-off mengikuti `satuan` item — m1 → Panjang × Jumlah; m2 → Panjang × Lebar × Jumlah; m3 → Panjang × Lebar × Tinggi × Jumlah; ha → Panjang × Lebar × Jumlah; kg → Panjang × Jumlah; satuan lain (buah/unit/titik/set/…) → Jumlah saja.
9. Khusus `m3`, rumusnya **strict & item-aware**: `Volume = Luas penampang × Panjang × Jumlah`. Luas penampang mengikuti jenis item AHSP (`detectBentuk(uraian)`) — **trapesium** (pondasi/footplat/batu kali): `((Lebar Atas + Lebar Bawah) / 2) × Tinggi`; **kotak** (balok/kolom/plat): `Lebar × Tinggi`; **silinder** (tiang pancang/bor pile): `¼πd²`. Kolom input menyesuaikan bentuk (trapesium → 4 dimensi; silinder → diameter + panjang; kotak → lebar + tinggi + panjang). Dihitung ulang di SQL (`rab_volume_apply`) memakai `CASE bentuk`; kolom `rab_volume.bentuk` + `lebar2` (lebar bawah trapesium).
10. Daftar item pada builder RAB diurutkan menurut **kode AHSP secara natural** (per digit: 1.1.2 sebelum 1.1.10) via `kode_cmp` di `rab_get` + `compute_hitung`.
11. **Report multi-seksi (page break)** — 7 seksi: 1) Rekapitulasi; 2) RAB dengan divisi sebagai subheader dalam satu tabel (+ subtotal divisi & total); 3) BOQ + tiga tabel biaya terpisah (A Tenaga Kerja / B Bahan / C Peralatan); 4) Rekap item analisa yang dipakai (volume + harga satuan + jumlah item); 5) Backup volume tiap item (baris take-off + volume terhitung); 6) Time schedule — tiap item punya **Durasi (hari)** & **Tanggal Mulai** yang bisa diinput langsung di laporan (`rab_set_schedule`, kolom `rab_items.durasi_hari` + `tgl_mulai`), selesai dihitung otomatis, ada tombol "Isi tanggal berurutan" dan bar Gantt; 7) Kebutuhan tenaga kerja/bahan/alat per item + tabel rekap agregat. CSS `.r-section { break-before: page }` → tiap seksi mulai halaman baru saat cetak/PDF. Perintah baru: `rab_volumes_rab`, `rab_set_schedule`. **Revisi:** seksi 4 menampilkan seluruh komponen analisa + harga satuannya (tanpa volume) dan dikelompokkan **sub-header per jenis (Tenaga Kerja / Bahan / Peralatan / Lainnya) + subtotal biaya jenis** di kolom Jumlah (komponen `KompRows` dengan `withKode`); seksi 7 dipecah satu tabel per analisa (ditutup rekap agregat); seksi 2 tanpa baris "Subtotal divisi" — subtotal diletakkan pada kolom Jumlah di baris subheader divisi (tebal); seluruh teks memakai bahasa baku formal.
    - **Font & tata kolom:** seluruh lembar laporan memakai font formal **Times New Roman** (serif, dengan angka `tabular-nums`); lebar kolom diseragamkan via `table-layout: fixed` + kelas grid (`g3`, `g5`, `g6`, `g6c`, `g7`) sehingga kolom **Satuan / harga / Jumlah sejajar** antar tabel walaupun berbeda tabel.
    - **Agregasi komponen:** komponen yang sama digabung (jenis dinormalisasi A/B/C/L + uraian + satuan, tanpa pengaruh huruf besar/kecil) lewat helper `normKompKey` / `aggKomponen`, lalu koefisiennya dijumlahkan — dipakai di seksi 4, seksi 7 (per analisa + rekap) dan ekspor Excel. Contoh: "Kepala Tukang" tidak lagi muncul dua kali karena AHSP memakai jenis campuran `Tenaga Kerja` dan `TENAGA KERJA`.
    - **Seksi 5 (Backup Volume):** tanpa baris header tabel — tiap item langsung berupa judul `kode — uraian (satuan)`, lalu baris rincian perhitungan volume di bawahnya (tabular 34/24/6/8/9/9/10 %) + baris Volume Item.
    - **Header tabel tidak bertubrukan:** `.r-tbl th` boleh membungkus (`white-space: normal; overflow-wrap: break-word`); kolom sempit `g7` memakai font 8.5px tanpa letter-spacing.
    - **Seksi 7 tanpa kolom Jenis:** tabel kebutuhan per analisa (`g7` = 44/12/7/13/12/12 %, kolom **Kebutuhan** dilebarkan agar headernya tidak terpotong) dan tabel REKAP KEBUTUHAN SUMBER DAYA (`g5` = 50/8/20/22 %) tidak lagi memakai kolom Jenis — jenis ditampilkan sebagai **sub-header** per grup (`tr.r-subhead`, hasil `aggKomponen`/`resourceAgg` yang sudah diurut per A/B/C/L) via komponen `KompRows` / `ResRows`; **subtotal per jenis** (jumlah biaya grup) diletakkan di kolom Jumlah / Total Biaya pada baris sub-header, tebal. Seluruh sel rupiah pada tabel laporan (tab RAB maupun Progress) memakai `RpCell` (`.r-rp`, flex `space-between`) sehingga label **Rp** rata kiri dan **nominal** rata kanan dalam satu sel; `RpCell` memakai formatter `rpNum` (angka polos, 0 desimal) karena `rp`/`fmtRp` sudah menyertakan prefix "Rp".
    - **Seksi 1 — baris "Dibulatkan":** di bawah baris Total ada baris `<tr className="r-round">` berisi total yang **dibulatkan selalu ke atas** (`roundUp(n, digits) = Math.ceil(n / 10**digits) * 10**digits`). Jumlah digit dipilih user lewat `<select className="r-select no-print">` dari `ROUND_STEPS` (Tanpa pembulatan / Ratusan / Ribuan / Puluh ribuan / Ratus ribuan / Jutaan, state `roundDigits`); saat cetak select tersembunyi dan hanya label "Dibulatkan (ke atas, ribuan)" + nilainya yang tampil. Ekspor Excel menambahkan baris ini bila pembulatan aktif.
    - **Kop & heading seksi 1:** urutan header lembar laporan = kop (`.r-kop`) → **judul dokumen** (`.r-title`, rata tengah, tanpa garis bawah) → **informasi proyek** (`.r-proj`, rata kiri) → seksi 1. Baris `.r-subtitle` ("<nama RAB> · PPN x%") dihapus (info PPN tetap ada di tabel rekapitulasi); judul seksi bernomor (`.r-sec-title`) tetap seperti semula.
    - **Hierarki tipografi baca:** skala ukuran disusun berjenjang (ukuran nyata pada lembar A4 182 mm) — L0 kop (`r-kop-brand` 19px / `r-kop-sub` 10px / `r-kop-meta` 10.5px), L0b identitas proyek (`r-proj-nama` 17px/800, `r-proj-info` 11px flex-wrap gap 18px), L1 judul dokumen (`r-title` 15px/800), L2 judul seksi (`r-sec-title` 14.5px/800 + badge `r-sec-num` 22px), L3 sub-judul (`r-subtitle` 12.5px/600), L4 blok item (`r-group-head` 12px/700), L5 baris divisi (`r-div` 11.5px/700) & jenis (`r-subhead` 10.5px/700), L6 header tabel (`th` 9.5px/700) dan isi tabel (`11.5px`, padding 4/7px, line-height 1.35). Kotak `.r-stats` kini label kecil (9.5px uppercase) di atas nilai besar (14.5px/800).
    - **Kolom header dirapikan (semua seksi):** label kolom dipendekkan seragam — `<th>Satuan</th>` → **`SAT`**, `Volume` → **`VOL`** (juga `Volume Aktual` → `VOL AKTUAL`), `Koefisien` → **`KOEF`**; kolom uang (`Jumlah`, `Harga Satuan`, `Total Biaya`, `Nilai`, `Terpasang`, `Nilai Aktual`) sekaligus header `SAT`, `VOL`, `VOL AKTUAL` memakai kelas **`th.mid`** = `text-align: center` sehingga judulnya tepat di tengah (di atas pasangan "Rp" rata kiri + nominal rata kanan hasil `RpCell`). Kebutuhan/bobot/progress/koefisien tetap rata kanan.
    - **Seksi 4 — ringkasan analisa:** setiap item analisa ditutup tiga baris rekapitulasi memakai `HitungSubtotal` (dari perintah `hitung`): **Jumlah Komponen (Tenaga Kerja + Bahan + Alat)** = `sub.d`, **Overhead x%** = `sub.e` (dari `item.overhead_pct`), dan **Jumlah (Komponen + Overhead)** = `sub.f` (baris `tr.r-total`); dua baris pertama `tr.r-sub`. `analisaRekap` kini menyimpan `sub: h.subtotal` + `ov: h.overhead_pct`. Ketiga baris juga ditulis ke ekspor Excel. Struktur seksi 4 mengikuti gaya seksi 7: **satu tabel per analisa** dalam `.r-group` dengan `.r-group-head` (`kode — uraian (satuan) · digunakan pada n item`) dan header kolom diulang tiap analisa — `Komponen | SAT | KOEF | Harga Satuan | Jumlah` (grid `g5c` = 46/12/8/17/17 %, kolom SAT tetap mulai 58 %); kolom `Kode` pada tabel dihapus (kode analisa ada di group head) dan kolom `Kebutuhan` memang tidak ada karena volume = 1; sub-header jenis (tenaga kerja/bahan/alat) + subtotal tetap dari `KompRows cols={5} showQty={false}`.
    - **Ekspor Excel (.xlsx):** tombol **Ekspor Excel** menggantikan ekspor CSV (CSV dihapus). Berkas dibangun **tanpa library pihak ketiga**: `src/renderer/src/lib/xlsx.ts` (penulis xlsx mandiri — ZIP metode *stored* + CRC32 + OOXML `[Content_Types].xml`, `_rels/.rels`, `xl/workbook.xml` (`calcPr fullCalcOnLoad="1"`), `xl/_rels/workbook.xml.rels`, `xl/styles.xml`, `xl/worksheets/sheetN.xml`; inline string, rumus `<f>` + nilai cache `<v>`, `mergeCells` dari `colspan`, `<cols>` lebar kolom, freeze pane, `pageSetup` A4 `fitToWidth`) dan `src/renderer/src/lib/report-xlsx.ts` (`buildReportSheets` / `buildReportWorkbook` → base64). **Satu seksi = satu sheet:** tab RAB → *Rekapitulasi, Rencana Anggaran Biaya, BOQ, Analisa, Backup Volume, Time Schedule, Kebutuhan*; tab Progress → *Ringkasan Progress, Progress Divisi, Detail per Item*. **Rumus antar-sheet** (angka turunan dirujuk dari sheet sumbernya, bukan disalin — tiap builder mengisi/membaca map `Refs` yang dibangun berurutan): `'Backup Volume'!H` (volume take-off) → kolom VOL di RAB `=VOL*Harga` dan volume di Kebutuhan; `'Analisa'!E{b}` (baris *Jumlah (Komponen + Overhead)* = harga satuan analisa) → kolom Harga Satuan di RAB (dicocokkan per item lewat id item, fallback kode analisa); `'Rencana Anggaran Biaya'!F{subtotal divisi}` → Jumlah divisi di Rekapitulasi; `'Rencana Anggaran Biaya'!D{n}` → VOL + `='Analisa'!E{n}*'Rencana Anggaran Biaya'!D{n}` pada tabel biaya 3.A/3.B/3.C di BOQ; `'Analisa'!C{n}` (koefisien per komponen, kunci `normKompKey`) → kolom KOEF di Kebutuhan lalu Kebutuhan `=C{n}*'Rencana Anggaran Biaya'!D{n}` dan REKAP Kebutuhan memakai `=SUM(...)` antar baris komponen yang sama. Tab Progress: `'Detail per Item'!H` → Terpasang di Progress Divisi `=SUM('Detail per Item'!H…)`, lalu Ringkasan `=SUM('Progress Divisi'!C…/D…)` untuk Nilai RAB/Terpasang + Progress `=IF(B4=0,0,100*B5/B4)` (tab Progress terpisah berkasnya, jadi tidak boleh merujuk sheet tab RAB). **Rumus lokal lainnya:** subtotal & jumlah komponen `=SUM(...)`, `Jumlah (Komponen + Overhead)` `=E{komponen}+E{overhead}`, PPN `=C{sub}*pct/100`, Total `=C{sub}+C{ppn}`, Dibulatkan `=CEILING(C{total},10^digits)`, VOL take-off per bentuk (`=((D+E)/2)*F*C*G` trapesium, `=D*F*C*G` kotak, `=0.7853981633974483*D^2*C*G` silinder), progress divisi `=IF(C=0,0,100*D/C)`, progress item `=IF(D=0,0,100*G/D)`. Gaya meniru laporan: font Times New Roman, header abu `EEEEEE`, sub-header jenis `F1EFE9`, baris divisi `E4E2DB`, baris total `F2F2F2`, border tipis; format uang `"Rp"* #,##0` (trik `*` menaruh "Rp" di kiri & nominal di kanan dalam satu sel, setara `RpCell`), angka `#,##0.####`, persen `0.0"%"`. Berkas dikirim sebagai base64 ke Rust via command baru **`report_save_bytes`** (`src-tauri/src/commands/report_cmd.rs` — decoder base64 mandiri, spasi diabaikan, padding opsional) lalu disimpan ke Documents/Downloads.
    - **Pemisah antar analisa (seksi 4):** tiap analisa kini punya `.r-group` tersendiri (jarak antar grup + header tabel yang diulang tiap analisa) sehingga baris spacer `tr.r-gap` beserta CSS-nya tidak lagi dipakai; grid tabel komponen analisa = `g5c` (46/12/8/17/17 %).
    - **Seksi 2:** judul cukup "RENCANA ANGGARAN BIAYA" (tanpa "— PER DIVISI"); baris subheader divisi (`tr.r-div`) hanya menampilkan **nama divisi** (`{divName.get(no) ?? 'DIVISI ' + no}`) tanpa kata "DIVISI".
    - **WYSIWYG cetak/PDF:** `.report-sheet` berukuran **A4 (210mm) + padding 14mm** di layar (kotak isi 182mm) dan `@page { size: A4; margin: 14mm }` saat cetak dengan `padding: 0` — jadi lebar area kerja, pembungkusan baris, dan lebar kolom identik layar↔cetak. `print-color-adjust: exact` agar latar abu (header tabel, sub-header, `.r-group-head`) dan kurva/Gantt merah tetap tercetak. Paginasi dimimik di layar: `.r-section` (2..7) `min-height: 269mm` + pemisah putus-putus. Cetak: tiap seksi mulai halaman baru, `thead` diulang, `.r-sec-title`/`.r-group-head`/`thead` `break-after: avoid`, `tr`/`.r-group` `break-inside: avoid`, `orphans`/`widows: 3`, appbar/statusbar/toolbar disembunyikan. Catatan: kop hanya muncul di halaman 1 (margin box `@page` tidak didukung Chromium/WebView2).
12. **UX hardening (Phase 17)** — hasil audit persona QS: (a) parser angka tunggal `lib/num.ts` (koma = desimal, titik ribuan) dipakai di RAB/Progress/Project/Master/Legal — semua input `type=number` diganti `type=text inputMode=decimal` supaya koma bisa diketik; nilai tidak valid ditolak dengan toast (tidak diam-diam jadi 0/null); (b) **kosong ≠ 1** — dimensi/jumlah take-off kosong dihitung **0** (JS `rowVolume` + SQL `rab_volume_apply`), baris bernilai 0 ditandai `.row-warn`; (c) bentuk volume m3 kini **select eksplisit** (tidak ditebak ulang saat load), ganti bentuk = aksi yang meng-update semua baris, tombol Terapkan jadi primary saat ada perubahan + badge "belum diterapkan"; (d) **undo** untuk hapus baris take-off (`rabVolumeAdd` salinan penuh), item RAB (re-add via kode, harga mengikuti AHSP terkini), dan catatan progress; (e) **Salin RAB** (`rab_duplicate`: item + komponen + volume); (f) search item di builder RAB + badge "sudah ada" pada kode yang sudah dipakai; (g) input **overhead %** per item (disimpan sebagai fraksi) + hint bahwa edit harga komponen menulis ke katalog AHSP global & snapshot semua item serupa; (h) Enter = commit, Esc = batal di input angka; status simpan (Menyimpan/Tersimpan) di statusbar via `lib/status.ts`; `ErrorBox` (pesan ramah + detail teknis di `<details>`) menggantikan `<pre className="err">` di seluruh modul; (i) command palette "Proyek Baru" langsung membuka form; (j) konfirmasi hapus proyek/RAB menyebutkan data terkait ikut terhapus dan **tidak bisa di-undo**. Verifikasi: `npm run typecheck` PASS, `npm run build:vite` PASS (css 30.00 kB gzip 6.35, js 349.61 kB gzip 96.60), `cargo check --offline` PASS.
13. **Undo hapus + scope harga (Phase 18)** — (a) modul Rust baru `src-tauri/src/commands/undo_cmd.rs`: `rab_snapshot`/`rab_restore` dan `project_snapshot`/`project_restore` (serde JSON, `unchecked_transaction`, id lama dibuang → id baru; `project_restore` memulihkan proyek + timeline + org + semua RAB beserta item/komponen/take-off/progress + dokumen, dan memilih kode proyek unik `KODE-2`, `KODE-3`, … bila kode lama sudah dipakai); 3 unit test Rust roundtrip (proyek, RAB, kode bentrok) via `cargo test --offline`; (b) hapus proyek (App) dan hapus RAB (RabModule) menyimpan snapshot sebelum DELETE lalu menampilkan toast Undo 20 dtk (`toast.push(..., ttlMs)`); (c) `rab_set_harga_komponen` mendapat arg `update_catalog` (default false) — harga komponen hanya mengubah komponen jenis+uraian sama di RAB ini, katalog AHSP diubah hanya bila checkbox "Terapkan juga ke katalog AHSP" dicentang (toast membedakan kedua mode).
14. **UI usability pass (Phase 19)** — keterangan per modul di sidebar (`.navhint`), penanda baris terpilih di daftar Project (`tr.sel` kini juga untuk modul Project, sebelumnya hanya RAB/item/Master/Legal/Progress) dan RAB, aksi baris `.row-actions` (muncul saat hover/focus-within, `opacity:1` pada `@media (hover:none)`), navigasi keyboard baris daftar (`tabIndex=0` + Enter/Space, guard `e.target===e.currentTarget` agar input di dalam baris tidak ikut memicu), form proyek berbagian (`.form-section`), autofocus field Kode, Esc menutup form, konfirmasi anti lost-work saat pindah proyek (`selectProject`), indikator dirty timeline (`tlDirty`), skeleton loading, dan empty-state dengan CTA + tombol bersihkan pencarian. CSS baru: `.navlabel/.navtext/.navhint`, `.form-section`, `.row-actions`, `.panel-sub.ok`, `.empty .btn`; `ErrorBox` duplikat di pane detail dihapus. Verifikasi: `npm run typecheck` PASS, `npm run build:vite` PASS (css 30.98 kB gzip 6.54, js 353.21 kB gzip 97.69).


15. **Panduan awal (Phase 20)** — `components/Onboarding.tsx` (5 langkah, rail progres, keyboard ←/→/Esc, fokus otomatis) tampil otomatis pada instalasi pertama; status disimpan di `localStorage` `constructsee:onboarded:v1`; dibuka ulang via tombol info di appbar atau command palette "Panduan Awal"; CTA akhir membuka form proyek baru. Style `.onboard*` + `.appbar-help` (tema Hybrid Industrial, panel CRT di rail). Verifikasi: `npm run typecheck` PASS, `npm run build:vite` PASS (css 34.92 kB gzip 7.24, js 358.98 kB gzip 99.58).
16. **Skin modern (Phase 21)** — `styles/modern.css` di-import setelah `globals.css` dan me-*remap* token (`--paper`, `--ink`, `--rule`, `--accent` biru, `--radius`, shadow lembut), merestyling appbar/sidebar/tombol/form/tabel/badge/tab/panel/overlay/onboarding; `.term` CRT dinonaktifkan (menjadi permukaan terang) dan `.report-sheet`/`@media print` tidak disentuh. Verifikasi: `npm run typecheck` PASS, `npm run build:vite` PASS (css 50.02 kB gzip 9.31, js 358.98 kB gzip 99.58).
## Lisensi

**Proprietary — All rights reserved.** Lihat [LICENSE](LICENSE). Kode sumber dipublikasikan
untuk referensi; tidak ada hak pakai, modifikasi, atau distribusi tanpa izin tertulis.
