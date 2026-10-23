import { invoke } from '@tauri-apps/api/core'
import type {
  AppInfo,
  DashboardSummary,
  Document,
  DocumentInput,
  HitungResult,
  KatalogInput,
  KatalogRow,
  MasterKatalog,
  MasterKatalogInput,
  MkatalogImportResult,
  OrgInput,
  Pekerjaan,
  PekerjaanImportResult,
  PekerjaanInput,
  Project,
  ProjectDetail,
  ProjectInput,
  ProjectOrg,
  ProgressEntry,
  ProgressInput,
  ProgressSummary,
  Rab,
  RabDetail,
  RabItem,
  RabKomponen,
  RabRekap,
  RabVolume,
  RefDivisi,
  RefItem,
  RefItemDetail,
  RefMaster,
  RefSource,
  Subkontraktor,
  SubkontraktorInput,
  TimelineInput,
  VolumeInput
} from '../../../shared/types'

export const api = {
  info: () => invoke<AppInfo>('app_info'),

  projectList: () => invoke<Project[]>('project_list'),
  projectGet: (id: number) => invoke<ProjectDetail>('project_get', { id }),
  projectCreate: (input: ProjectInput) => invoke<Project>('project_create', { input }),
  projectUpdate: (id: number, input: ProjectInput) => invoke<Project>('project_update', { id, input }),
  projectRemove: (id: number) => invoke<void>('project_remove', { id }),
  projectSnapshot: (id: number) => invoke<string>('project_snapshot', { id }),
  projectRestore: (snapshot: string) => invoke<number>('project_restore', { snapshot }),

  timelineSave: (projectId: number, input: TimelineInput) =>
    invoke<void>('project_save_timeline', { projectId, input }),

  orgAdd: (projectId: number, input: OrgInput) => invoke<ProjectOrg>('org_add', { projectId, input }),
  orgUpdate: (id: number, input: OrgInput) => invoke<void>('org_update', { id, input }),
  orgRemove: (id: number) => invoke<void>('org_remove', { id }),

  // ---- Referensi AHSP (read-only) ----
  refMeta: () => invoke<RefSource | null>('ref_meta'),
  refDivisi: () => invoke<RefDivisi[]>('ref_divisi'),
  refItems: (q?: string | null, divisiId?: number | null) =>
    invoke<RefItem[]>('ref_items', { q: q?.trim() || null, divisiId: divisiId ?? null }),
  refItem: (kode: string) => invoke<RefItemDetail | null>('ref_item', { kode }),
  refMaster: (q?: string | null, jenis?: string | null) =>
    invoke<RefMaster[]>('ref_master', { q: q?.trim() || null, jenis: jenis || null }),

  // ---- RAB ----
  rabList: (projectId: number) => invoke<Rab[]>('rab_list', { projectId }),
  rabGet: (rabId: number) => invoke<RabDetail>('rab_get', { rabId }),
  rabCreate: (projectId: number, nama: string, ppnPct?: number | null) =>
    invoke<Rab>('rab_create', { projectId, nama, ppnPct: ppnPct ?? null }),
  rabUpdate: (
    rabId: number,
    nama?: string | null,
    ppnPct?: number | null,
    status?: string | null,
    catatan?: string | null
  ) => invoke<Rab>('rab_update', { rabId, nama, ppnPct, status, catatan }),
  rabRemove: (rabId: number) => invoke<void>('rab_remove', { rabId }),
  rabDuplicate: (rabId: number, nama: string) => invoke<Rab>('rab_duplicate', { rabId, nama }),

  rabKomponen: (itemId: number) => invoke<RabKomponen[]>('rab_komponen', { itemId }),
  rabAddItem: (rabId: number, kode: string, volume?: number | null) =>
    invoke<RabItem>('rab_add_item', { rabId, kode, volume: volume ?? null }),
  rabAddUserItem: (
    rabId: number,
    uraian: string,
    satuan?: string | null,
    volume?: number | null,
    divisiNo?: string | null
  ) => invoke<RabItem>('rab_add_user_item', { rabId, uraian, satuan, volume, divisiNo }),
  rabUpdateItem: (
    itemId: number,
    uraian?: string | null,
    satuan?: string | null,
    volume?: number | null,
    overheadPct?: number | null
  ) => invoke<RabItem>('rab_update_item', { itemId, uraian, satuan, volume, overheadPct }),
  rabRemoveItem: (itemId: number) => invoke<void>('rab_remove_item', { itemId }),
  rabSetHargaKomponen: (
    rabId: number,
    jenis: string | null,
    uraian: string | null,
    harga: number | null,
    updateCatalog = false
  ) => invoke<void>('rab_set_harga_komponen', { rabId, jenis, uraian, harga, updateCatalog }),
  rabSnapshot: (rabId: number) => invoke<string>('rab_snapshot', { rabId }),
  rabRestore: (projectId: number, snapshot: string) =>
    invoke<number>('rab_restore', { projectId, snapshot }),
  rabHitung: (rabId: number) => invoke<HitungResult[]>('rab_hitung', { rabId }),
  rabRekap: (rabId: number) => invoke<RabRekap>('rab_rekap', { rabId }),

  // ---- Master Data ----
  masterKatalogList: (jenis?: string | null, q?: string | null) =>
    invoke<MasterKatalog[]>('master_katalog_list', { jenis: jenis ?? null, q: q?.trim() || null }),
  masterKatalogSave: (input: MasterKatalogInput) =>
    invoke<MasterKatalog>('master_katalog_save', { input }),
  masterKatalogRemove: (id: number) => invoke<void>('master_katalog_remove', { id }),
  masterKatalogImportAhsp: () => invoke<MkatalogImportResult>('master_katalog_import_ahsp'),

  subkonList: () => invoke<Subkontraktor[]>('subkon_list'),
  subkonSave: (input: SubkontraktorInput) => invoke<Subkontraktor>('subkon_save', { input }),
  subkonRemove: (id: number) => invoke<void>('subkon_remove', { id }),

  pekerjaanList: (divisiNo?: string | null, q?: string | null) =>
    invoke<Pekerjaan[]>('pekerjaan_list', { divisiNo: divisiNo ?? null, q: q?.trim() || null }),
  pekerjaanSave: (input: PekerjaanInput) => invoke<Pekerjaan>('pekerjaan_save', { input }),
  pekerjaanRemove: (id: number) => invoke<void>('pekerjaan_remove', { id }),
  pekerjaanImportAhsp: () => invoke<PekerjaanImportResult>('pekerjaan_import_ahsp'),

  katalogList: (q?: string | null, jenis?: string | null) =>
    invoke<KatalogRow[]>('katalog_list', { q: q?.trim() || null, jenis: jenis || null }),
  katalogSave: (input: KatalogInput) => invoke<void>('katalog_save', { input }),
  katalogRemove: (jenis: string, uraian: string) =>
    invoke<void>('katalog_remove', { jenis, uraian }),

  // ---- Progress ----
  progressEntries: (itemId: number) => invoke<ProgressEntry[]>('progress_entries', { itemId }),
  progressAdd: (input: ProgressInput) => invoke<number>('progress_add', { input }),
  progressRemove: (id: number) => invoke<void>('progress_remove', { id }),
  progressSummary: (rabId: number) => invoke<ProgressSummary>('progress_summary', { rabId }),

  // ---- Legal / Admin ----
  documentList: (projectId?: number | null, kategori?: string | null, q?: string | null) =>
    invoke<Document[]>('document_list', {
      projectId: projectId ?? null,
      kategori: kategori || null,
      q: q?.trim() || null
    }),
  documentGet: (id: number) => invoke<Document | null>('document_get', { id }),
  documentSave: (input: DocumentInput) => invoke<Document>('document_save', { input }),
  documentRemove: (id: number) => invoke<void>('document_remove', { id }),
  documentsExpiring: (days: number) => invoke<Document[]>('documents_expiring', { days }),

  // ---- Report ----
  reportSaveFile: (name: string, content: string) =>
    invoke<string>('report_save_file', { name, content }),
  reportSaveBytes: (name: string, data: string) =>
    invoke<string>('report_save_bytes', { name, data }),

  // ---- Dashboard ----
  dashboardSummary: () => invoke<DashboardSummary>('dashboard_summary'),

  // ---- Volume (take-off) ----
  rabVolumes: (itemId: number) => invoke<RabVolume[]>('rab_volumes', { itemId }),
  rabVolumeAdd: (input: VolumeInput) => invoke<number>('rab_volume_add', { input }),
  rabVolumeUpdate: (input: VolumeInput) => invoke<void>('rab_volume_update', { input }),
  rabVolumeRemove: (id: number) => invoke<void>('rab_volume_remove', { id }),
  rabVolumeApply: (itemId: number) => invoke<number>('rab_volume_apply', { itemId }),
  rabVolumesRab: (rabId: number) => invoke<RabVolume[]>('rab_volumes_rab', { rabId }),
  rabSetSchedule: (itemId: number, durasiHari: number | null, tglMulai: string | null) =>
    invoke<RabItem>('rab_set_schedule', { itemId, durasiHari, tglMulai })
}
