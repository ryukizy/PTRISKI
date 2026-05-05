// ════════════════════════════════════════════════════════════════
// config.js — Konstanta & Konfigurasi Tetap (tidak berubah saat runtime)
// ════════════════════════════════════════════════════════════════

export const LS_KEY_EMPLOYEES = 'employees_v13';
export const LS_KEY_CUTI      = 'cutiData_v13';
export const LS_KEY_CFG       = 'cfg_v13';
export const LS_KEY_HISTORY   = 'payrollHistory_v13';
export const LS_KEY_NOTIF     = 'notifState_v15';
export const LS_KEY_RBAC      = 'rbacSession_v14';

export const SALDO_CUTI_TAHUNAN_DEFAULT = 12;

export const KUOTA_CUTI = {
  tahunan:       { label:'Cuti Tahunan',       hari:12,  per:'tahun',        warna:'var(--purple)',  kelas:'tc-tahunan',      terpisah:false },
  menikah:       { label:'Cuti Menikah',       hari:3,   per:'seumur hidup', warna:'#9c27b0',        kelas:'tc-menikah',      terpisah:true  },
  melahirkan:    { label:'Cuti Melahirkan',    hari:90,  per:'persalinan',   warna:'var(--red)',     kelas:'tc-melahirkan',   terpisah:true  },
  haji:          { label:'Cuti Ibadah Haji',   hari:40,  per:'seumur hidup', warna:'var(--amber)',   kelas:'tc-haji',         terpisah:true  },
  umroh:         { label:'Cuti Ibadah Umroh',  hari:15,  per:'sesuai paket', warna:'#b45309',        kelas:'tc-umroh',        terpisah:true  },
  'sakit-panjang':{ label:'Sakit Panjang',     hari:999, per:'per dokter',   warna:'var(--accent)',  kelas:'tc-sakit-panjang',terpisah:true  },
  khusus:        { label:'Cuti Khusus/Darurat',hari:999, per:'kebijaksanaan',warna:'#3b5fc0',        kelas:'tc-khusus',       terpisah:true  },
};

export const PTKP = {
  'TK/0': { label:'Tidak Kawin, 0 Tanggungan', nilai: 54000000 },
  'TK/1': { label:'Tidak Kawin, 1 Tanggungan', nilai: 58500000 },
  'TK/2': { label:'Tidak Kawin, 2 Tanggungan', nilai: 63000000 },
  'TK/3': { label:'Tidak Kawin, 3 Tanggungan', nilai: 67500000 },
  'K/0':  { label:'Kawin, 0 Tanggungan',       nilai: 58500000 },
  'K/1':  { label:'Kawin, 1 Tanggungan',        nilai: 63000000 },
  'K/2':  { label:'Kawin, 2 Tanggungan',        nilai: 67500000 },
  'K/3':  { label:'Kawin, 3 Tanggungan',        nilai: 72000000 },
};

export const ROLE_DESC = {
  admin: '👑 <b>HR Admin</b> — Akses penuh ke seluruh fitur: Rekapitulasi Absensi, Payroll, Analitik, Manajemen Cuti, Import/Export, dan Pengaturan sistem.',
  supervisor: '🔶 <b>Supervisor / Line Leader</b> — Hanya dapat melihat dan mengedit data absensi karyawan di divisinya. Tab Payroll, Analitik, dan fitur keuangan disembunyikan.',
  karyawan: '👤 <b>Karyawan</b> — Hanya dapat melihat data absensi, riwayat cuti, dan mencetak slip gaji pribadi. Semua fungsi edit dinonaktifkan.',
};
