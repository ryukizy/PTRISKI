// ════════════════════════════════════════════════════════════════
// main.js — Entry Point Aplikasi Absensi RH
//
// Tugas file ini:
//  1. Import semua modul
//  2. Ekspor fungsi yang dipanggil via onclick="..." di HTML ke window
//  3. Inisialisasi aplikasi saat DOM siap (kini async karena Firestore)
// ════════════════════════════════════════════════════════════════

// ─── Core ───
// PERUBAHAN: loadFromLS diganti loadFromFS (async). Alias loadFromLS
// tetap diekspor di storage.js untuk kompatibilitas modul lain.
import { loadFromFS, subscribeRealtime } from './core/storage.js';
import { generatePeriodDays } from './core/periode.js';
import { DAYS, rbac } from './core/state.js';

// ─── UI Utama ───
import {
  renderTableHeader,
  renderTable,
  inlineEditSave,
  inlineEditKeydown,
  inlineEditChange,
  toggleSorot,
  showDetail,
  closeDetail,
  perbaruiSummaryCards,
} from './ui/tabel.js';

// ─── UI Payroll ───
import {
  renderPayroll,
  filterPayroll,
  togglePayrollCard,
  openSlipSingle,
  closeSlip,
  printSlip,
  updatePeriodDropdown,
  switchPayrollPeriod,
  konfirmasiSimpanPeriode,
} from './ui/payroll.js';

// ─── UI Analitik ───
import { renderAnalitik } from './ui/analitik.js';

// ─── UI Forms (modal tambah/edit/bulk) ───
import {
  openModal,
  closeModal,
  saveEmployee,
  editSelectedEmployee,
  toggleTglKeluar,
  updateUsia,
  buildAttInputs,
  openBulkEditModal,
  closeBulkEditModal,
  terapkanBulkEdit,
  openCatatanHari,
  closeCatatanHari,
  simpanCatatanHari,
  hapusCatatanHari,
  switchTab,
} from './ui/forms.js';

// ─── UI Settings ───
import {
  openSettings,
  closeSettings,
  pratinjauPeriode,
  applySettings,
} from './ui/settings.js';

// ─── Cuti ───
import {
  renderCuti,
  simpanPengajuanCuti,
  ubahStatusCuti,
  hapusCuti,
  resetFormCuti,
  exportCutiExcel,
  updateSaldoPreview,
  updateKuotaInfo,
  renderSaldoTable,
} from './features/cuti.js';

// ─── Notifikasi ───
import {
  jalankanDeteksiNotifikasi,
  toggleNotifPanel,
  tutupNotifPanel,
  tandaiSemuaSudahBaca,
  toggleBacaNotif,
  filterNotif,
  tutupPremiBanner,
  sesuaikanNotifUntukRBAC,
} from './features/notifikasi.js';

// ─── RBAC ───
import {
  onLoginRoleChange,
  cekFormLogin,
  prosesLogin,
  prosesLogout,
  terapkanRBAC,
  cekSesiRBAC,
  cetakSlipKaryawanSendiri,
} from './features/rbac.js';

// ─── IO (Import/Export) ───
import {
  exportExcel,
  openImportModal,
  closeImportModal,
  handleImportFile,
  applyImport,
  downloadImportTemplate,
  openImportFingerprint,
  closeImportFingerprint,
  handleFPDrop,
  handleFPFile,
  terapkanImportFingerprint,
} from './features/io.js';

// ─── UI Payroll Extra (Slip Semua, THR) ───
import {
  openSlipAll,
  openTHRModal,
  closeTHRModal,
  hitungTHR,
  exportTHRExcel,
} from './ui/payroll-extra.js';

// ─── Resign & Settlement ───
import {
  openResignModal,
  closeResignModal,
  hitungSettlement,
  konfirmasiResign,
  deleteAllData,
} from './features/resign.js';

// ─── Utils (beberapa dipanggil dari HTML) ───
import { tampilkanToast, formatRpInput, rpFocus, rpBlur, initRpInputs } from './core/utils.js';

// ─── Visibilitas Kolom ───
import {
  toggleColVisPanel,
  setColVis,
  sinkronisasiCheckboxColVis,
  sinkronisasiHeaderKolom,
  initColVisPanelDismiss,
} from './ui/col-vis.js';

// ════════════════════════════════════════════════════════════════
// EKSPOS KE WINDOW — Semua fungsi yang dipanggil dari onclick HTML
// ════════════════════════════════════════════════════════════════
Object.assign(window, {
  renderTable, renderTableHeader,
  inlineEditSave, inlineEditKeydown, inlineEditChange,
  toggleSorot, showDetail, closeDetail, perbaruiSummaryCards,

  renderPayroll, filterPayroll, togglePayrollCard,
  openSlipSingle, openSlipAll, closeSlip, printSlip,
  updatePeriodDropdown, switchPayrollPeriod, konfirmasiSimpanPeriode,
  openTHRModal, closeTHRModal, hitungTHR, exportTHRExcel,

  renderAnalitik,

  openModal, closeModal, saveEmployee, editSelectedEmployee,
  toggleTglKeluar, updateUsia, buildAttInputs,
  openBulkEditModal, closeBulkEditModal, terapkanBulkEdit,
  openCatatanHari, closeCatatanHari, simpanCatatanHari, hapusCatatanHari,
  switchTab,

  openSettings, closeSettings, pratinjauPeriode, applySettings,

  renderCuti, simpanPengajuanCuti, ubahStatusCuti, hapusCuti,
  resetFormCuti, exportCutiExcel, updateSaldoPreview, updateKuotaInfo, renderSaldoTable,

  jalankanDeteksiNotifikasi, toggleNotifPanel, tutupNotifPanel,
  tandaiSemuaSudahBaca, toggleBacaNotif, filterNotif, tutupPremiBanner,

  onLoginRoleChange, cekFormLogin, prosesLogin, prosesLogout,
  terapkanRBAC, cetakSlipKaryawanSendiri,

  exportExcel, openImportModal, closeImportModal,
  handleImportFile, applyImport, downloadImportTemplate,
  openImportFingerprint, closeImportFingerprint,
  handleFPDrop, handleFPFile, terapkanImportFingerprint,

  openResignModal, closeResignModal, hitungSettlement,
  konfirmasiResign, deleteAllData,

  tampilkanToast, formatRpInput, rpFocus, rpBlur, initRpInputs,

  toggleColVisPanel, setColVis,
});

// ════════════════════════════════════════════════════════════════
// EDIT LOCK — Mode proteksi data
// ════════════════════════════════════════════════════════════════
import { modeEditAktif, setModeEditAktif } from './core/state.js';

function perbaruiStatusEditLock() {
  const btn = document.getElementById('btn-edit-lock');
  if (!btn) return;
  if (modeEditAktif) {
    btn.textContent = '🔓 Mode Edit: AKTIF';
    btn.className   = 'btn toggle-on';
  } else {
    btn.textContent = '🔒 Mode Edit: OFF';
    btn.className   = 'btn toggle-off';
  }
}

function toggleEditLock() {
  setModeEditAktif(!modeEditAktif);
  perbaruiStatusEditLock();
  if (modeEditAktif) {
    tampilkanToast('🔓 Mode Edit diaktifkan — perubahan absensi akan langsung tersimpan', 2500);
  } else {
    tampilkanToast('🔒 Mode Edit dinonaktifkan — data terlindungi dari perubahan tidak sengaja', 2500);
  }
}
window.toggleEditLock = toggleEditLock;
window.perbaruiStatusEditLock = perbaruiStatusEditLock;

// ════════════════════════════════════════════════════════════════
// DRAG & DROP IMPORT (modal import utama)
// ════════════════════════════════════════════════════════════════
function handleImportDrop(e) {
  e.preventDefault();
  const dz = document.getElementById('import-dropzone');
  if (dz) { dz.style.borderColor = ''; dz.style.background = 'var(--surface2)'; }
  const file = e.dataTransfer.files[0];
  if (file) handleImportFile(file);
}
window.handleImportDrop = handleImportDrop;

function handleImportFileChange(input) {
  if (input.files && input.files[0]) handleImportFile(input.files[0]);
}
window.handleImportFileChange = handleImportFileChange;

function handleFPFileChange(input) {
  if (input.files && input.files[0]) handleFPFile(input.files[0]);
}
window.handleFPFileChange = handleFPFileChange;

// ════════════════════════════════════════════════════════════════
// APP INIT — kini async karena Firestore menggunakan Promise
// ════════════════════════════════════════════════════════════════

/**
 * Variabel untuk menyimpan fungsi unsubscribe dari listener Firestore.
 * Dipanggil saat logout agar tidak ada listener menggantung.
 */
let _unsubscribeRealtime = null;

async function initApp() {
  // ── Tampilkan indikator loading ──────────────────────────────
  const loadingEl = document.getElementById('app-loading');
  if (loadingEl) loadingEl.style.display = 'flex';

  // 1. Muat data dari Firestore (dengan fallback ke localStorage jika offline)
  //    PERUBAHAN: loadFromLS() → await loadFromFS()
  //    Ini adalah perubahan terpenting — semua data diambil dari cloud dulu
  //    sebelum UI dirender, agar tidak ada data stale tampil ke pengguna.
  await loadFromFS();

  // 2. Pastikan periode 30 hari (1-30 April 2026) — force jika data lama
  if (DAYS.length < 25) {
    generatePeriodDays('2026-04-01', '2026-04-30');
  }

  // 3. Sembunyikan loading, tampilkan app
  if (loadingEl) loadingEl.style.display = 'none';

  // 4. Render UI
  renderTableHeader();
  renderTable();
  updatePeriodDropdown();
  perbaruiStatusEditLock();

  // 5. Cek sesi RBAC
  if (cekSesiRBAC()) {
    document.getElementById('rbac-login-screen').style.display = 'none';
    terapkanRBAC();
    sesuaikanNotifUntukRBAC(rbac.role);
  }

  // 6. Notifikasi & kolom
  jalankanDeteksiNotifikasi();
  sinkronisasiCheckboxColVis();
  sinkronisasiHeaderKolom();
  initColVisPanelDismiss();

  // 7. BARU: Aktifkan listener real-time Firestore
  //    Setiap ada perubahan dari perangkat/kantor lain, UI akan otomatis
  //    diperbarui tanpa perlu refresh manual.
  //    Callback menerima argumen 'koleksi' ('employees' atau 'cfg') agar
  //    hanya komponen yang relevan yang dirender ulang.
  _unsubscribeRealtime = subscribeRealtime((koleksi) => {
    if (koleksi === 'employees') {
      renderTable();
      perbaruiSummaryCards();
      jalankanDeteksiNotifikasi();
    }
    if (koleksi === 'cfg') {
      renderTableHeader();
      renderTable();
    }
  });

  console.info('[initApp] Aplikasi siap. Terhubung ke Firestore real-time.');
}

document.addEventListener('DOMContentLoaded', initApp);

// ════════════════════════════════════════════════════════════════
// LOGOUT HANDLER — Hentikan listener Firestore saat keluar
//
// Tambahkan pemanggilan stopRealtimeListener() di dalam
// prosesLogout() yang ada di features/rbac.js, atau panggil
// langsung via window.stopRealtimeListener() dari tombol logout.
// ════════════════════════════════════════════════════════════════
function stopRealtimeListener() {
  if (_unsubscribeRealtime) {
    _unsubscribeRealtime();
    _unsubscribeRealtime = null;
    console.info('[realtime] Listener Firestore dihentikan.');
  }
}
window.stopRealtimeListener = stopRealtimeListener;

// ════════════════════════════════════════════════════════════════
// FUNGSI GLOBAL TAMBAHAN
// ════════════════════════════════════════════════════════════════
if (!window.openPPh21Modal) {
  window.openPPh21Modal = function openPPh21Modal(empIdx) {
    tampilkanToast('ℹ️ Fitur Kalkulasi PPh 21 sedang dalam pengembangan', 3000);
    console.info('[PPh 21] openPPh21Modal dipanggil dengan empIdx:', empIdx);
  };
}
