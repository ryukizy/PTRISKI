// ════════════════════════════════════════════════════════════════
// storage.js — Simpan & muat data dari Firebase Firestore
//
// MIGRASI: localStorage → Firestore (async/await)
//
// STRUKTUR KOLEKSI FIRESTORE:
//   /absensi/{tenantId}/employees    → Array karyawan (1 dokumen)
//   /absensi/{tenantId}/cfg          → Konfigurasi periode & gaji
//   /absensi/{tenantId}/cutiData     → Array data cuti
//   /absensi/{tenantId}/payrollHistory → Objek histori payroll per periode
//
// CATATAN: Semua collection dikelompokkan di bawah satu "tenant" agar
// arsitektur ini mudah dikembangkan menjadi multi-cabang di masa depan.
// Untuk satu kantor, nilai TENANT_ID bisa di-hardcode (misal: 'sp3-pusat').
// ════════════════════════════════════════════════════════════════

import {
  employees, setEmployees,
  cutiData, setCutiData, setCutiIdCounter,
  payrollHistory, setPayrollHistory,
  cfg, assignCfg,
} from './state.js';
import {
  LS_KEY_EMPLOYEES, LS_KEY_CUTI, LS_KEY_CFG, LS_KEY_HISTORY,
} from './config.js';
import { generatePeriodDays } from './periode.js';

// ─── Import Firebase SDK (modular v9+) ───────────────────────────
// Pastikan Anda sudah menjalankan: npm install firebase
// atau sudah menyertakan Firebase via CDN di index.html
import { db } from './firebase.js'; // <── file inisialisasi Firebase (lihat main.js)
import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// ════════════════════════════════════════════════════════════════
// KONSTANTA
// ════════════════════════════════════════════════════════════════

/**
 * TENANT_ID — Identitas unik untuk instansi kantor ini.
 * Ubah nilai ini menjadi ID unik kantor Anda (misal: 'rh-pusat', 'rh-cabang-1').
 * Untuk setup awal dengan satu kantor, biarkan 'rh-pusat'.
 */
const TENANT_ID = 'rh-pusat';

// Helper: referensi dokumen Firestore per koleksi
const docRef = (koleksi) => doc(db, 'absensi', TENANT_ID, koleksi, 'data');

// ════════════════════════════════════════════════════════════════
// FALLBACK — localStorage tetap digunakan sebagai cache offline
//
// Strategi: "Firestore-first, localStorage-as-cache"
//   • Saat save → tulis ke Firestore SEKALIGUS tulis ke localStorage
//   • Saat load → coba ambil dari Firestore; jika gagal (offline),
//     fallback ke localStorage agar aplikasi tetap bisa berjalan
// ════════════════════════════════════════════════════════════════

function _saveCacheLS(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
}

function _loadCacheLS(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (_) { return null; }
}

// ════════════════════════════════════════════════════════════════
// saveToFS — Simpan semua state ke Firestore (async)
//
// Panggil ini menggantikan saveToLS() di seluruh codebase.
// Contoh pemanggilan:
//   await saveToFS();
//   saveToFS(); // juga valid jika tidak perlu menunggu selesai
// ════════════════════════════════════════════════════════════════
export async function saveToFS() {
  const cfgPayload = {
    gajiHarian: cfg.gajiHarian, transport: cfg.transport, makan: cfg.makan,
    rateLembur: cfg.rateLembur, ratePotongan: cfg.ratePotongan,
    rateBPJSKesehatan: cfg.rateBPJSKesehatan, rateBPJSKetenagakerjaan: cfg.rateBPJSKetenagakerjaan,
    maxAlfa: cfg.maxAlfa, maxIzin: cfg.maxIzin, maxSakit: cfg.maxSakit,
    premiVal: cfg.premiVal, workdays: cfg.workdays, period: cfg.period,
    tglMulai: cfg.tglMulai, tglSelesai: cfg.tglSelesai,
    columnVisibility: cfg.columnVisibility,
  };

  try {
    // Tulis semua koleksi secara paralel agar lebih cepat
    await Promise.all([
      setDoc(docRef('employees'),     { data: employees },     { merge: true }),
      setDoc(docRef('cutiData'),      { data: cutiData },      { merge: true }),
      setDoc(docRef('payrollHistory'),{ data: payrollHistory }, { merge: true }),
      setDoc(docRef('cfg'),           { data: cfgPayload },    { merge: true }),
    ]);

    // Update cache lokal agar offline tetap berfungsi
    _saveCacheLS(LS_KEY_EMPLOYEES, employees);
    _saveCacheLS(LS_KEY_CUTI, cutiData);
    _saveCacheLS(LS_KEY_HISTORY, payrollHistory);
    _saveCacheLS(LS_KEY_CFG, cfgPayload);

  } catch (e) {
    console.warn('[storage] Gagal simpan ke Firestore, data tersimpan lokal saja:', e);
    // Tetap simpan ke localStorage agar tidak ada data hilang
    _saveCacheLS(LS_KEY_EMPLOYEES, employees);
    _saveCacheLS(LS_KEY_CUTI, cutiData);
    _saveCacheLS(LS_KEY_HISTORY, payrollHistory);
    _saveCacheLS(LS_KEY_CFG, cfgPayload);
  }
}

// ════════════════════════════════════════════════════════════════
// saveToLS — ALIAS untuk kompatibilitas mundur (backward compat)
//
// Modul lain (tabel.js, forms.js, cuti.js, dst) masih memanggil
// saveToLS(). Daripada mengubah semua file sekaligus, alias ini
// membuat saveToLS() otomatis memanggil saveToFS().
//
// ⚠️  saveToLS() kini bersifat async. Jika modul pemanggil perlu
//     menunggu simpan selesai sebelum melanjutkan, ubah menjadi:
//       await saveToLS();
//     Untuk pemanggilan fire-and-forget (mayoritas kasus absensi),
//     cukup panggil tanpa await — hasilnya sama saja.
// ════════════════════════════════════════════════════════════════
export async function saveToLS() {
  return saveToFS();
}

// ════════════════════════════════════════════════════════════════
// loadFromFS — Muat semua data dari Firestore (async)
//
// Urutan prioritas:
//   1. Coba ambil dari Firestore (sumber kebenaran / source of truth)
//   2. Jika gagal/offline → gunakan cache localStorage
// ════════════════════════════════════════════════════════════════
export async function loadFromFS() {
  try {
    // Ambil semua dokumen secara paralel
    const [snapEmp, snapCuti, snapHistory, snapCfg] = await Promise.all([
      getDoc(docRef('employees')),
      getDoc(docRef('cutiData')),
      getDoc(docRef('payrollHistory')),
      getDoc(docRef('cfg')),
    ]);

    // ── employees ──────────────────────────────────────────────
    if (snapEmp.exists()) {
      const data = snapEmp.data().data ?? [];
      setEmployees(data);
      _saveCacheLS(LS_KEY_EMPLOYEES, data);
    } else {
      // Dokumen belum ada di Firestore → cek cache lokal
      const cached = _loadCacheLS(LS_KEY_EMPLOYEES);
      if (cached) setEmployees(cached);
    }

    // ── cutiData ───────────────────────────────────────────────
    if (snapCuti.exists()) {
      const data = snapCuti.data().data ?? [];
      setCutiData(data);
      setCutiIdCounter(data.length ? Math.max(...data.map(x => x.id)) + 1 : 1);
      _saveCacheLS(LS_KEY_CUTI, data);
    } else {
      const cached = _loadCacheLS(LS_KEY_CUTI);
      if (cached) {
        setCutiData(cached);
        setCutiIdCounter(cached.length ? Math.max(...cached.map(x => x.id)) + 1 : 1);
      }
    }

    // ── payrollHistory ─────────────────────────────────────────
    if (snapHistory.exists()) {
      const data = snapHistory.data().data ?? {};
      setPayrollHistory(data);
      _saveCacheLS(LS_KEY_HISTORY, data);
    } else {
      const cached = _loadCacheLS(LS_KEY_HISTORY);
      if (cached) setPayrollHistory(cached);
    }

    // ── cfg ────────────────────────────────────────────────────
    if (snapCfg.exists()) {
      const kp = snapCfg.data().data ?? {};
      _applyCfg(kp);
      _saveCacheLS(LS_KEY_CFG, kp);
    } else {
      const cached = _loadCacheLS(LS_KEY_CFG);
      if (cached) _applyCfg(cached);
    }

  } catch (e) {
    // Firestore tidak terjangkau (offline / belum dikonfigurasi)
    console.warn('[storage] Tidak bisa terhubung ke Firestore, menggunakan cache lokal:', e);
    _loadFallbackFromLS();
  }

  // Selalu sinkronkan DAYS & HOL_IDX setelah memuat
  generatePeriodDays();
}

// ════════════════════════════════════════════════════════════════
// loadFromLS — ALIAS untuk kompatibilitas mundur
// ════════════════════════════════════════════════════════════════
export async function loadFromLS() {
  return loadFromFS();
}

// ════════════════════════════════════════════════════════════════
// subscribeRealtime — Langganan perubahan data secara real-time
//
// Panggil fungsi ini SEKALI setelah login berhasil (di initApp).
// Setiap ada perubahan data dari perangkat/kantor lain, callback
// onUpdate akan dieksekusi sehingga UI bisa diperbarui otomatis.
//
// Mengembalikan fungsi unsubscribe — simpan dan panggil saat logout.
//
// Contoh pemakaian di main.js:
//   const unsubscribe = subscribeRealtime(() => {
//     renderTable();
//     renderPayroll();
//   });
// ════════════════════════════════════════════════════════════════
export function subscribeRealtime(onUpdate) {
  // Hanya pantau koleksi employees dan cfg — cukup untuk trigger render ulang
  const unsubEmp = onSnapshot(docRef('employees'), (snap) => {
    if (!snap.exists()) return;
    const data = snap.data().data ?? [];
    setEmployees(data);
    _saveCacheLS(LS_KEY_EMPLOYEES, data);
    onUpdate('employees');
  }, (err) => console.warn('[realtime] Gagal subscribe employees:', err));

  const unsubCfg = onSnapshot(docRef('cfg'), (snap) => {
    if (!snap.exists()) return;
    const kp = snap.data().data ?? {};
    _applyCfg(kp);
    _saveCacheLS(LS_KEY_CFG, kp);
    onUpdate('cfg');
  }, (err) => console.warn('[realtime] Gagal subscribe cfg:', err));

  // Kembalikan fungsi gabungan untuk berhenti berlangganan
  return () => { unsubEmp(); unsubCfg(); };
}

// ════════════════════════════════════════════════════════════════
// MIGRASI SATU KALI — Pindahkan data localStorage lama ke Firestore
//
// Jalankan SEKALI dari console browser atau dari tombol "Migrasi Data"
// di halaman Settings setelah Firestore sudah dikonfigurasi.
//
// Contoh pemakaian:
//   import { migrasiLocalStorageKeFirestore } from './core/storage.js';
//   await migrasiLocalStorageKeFirestore();
// ════════════════════════════════════════════════════════════════
export async function migrasiLocalStorageKeFirestore() {
  console.info('[migrasi] Memulai migrasi localStorage → Firestore...');

  // Muat dulu dari localStorage ke state
  _loadFallbackFromLS();

  // Simpan semua state ke Firestore
  await saveToFS();

  console.info('[migrasi] Selesai! Data berhasil dipindah ke Firestore.');
  return true;
}

// ════════════════════════════════════════════════════════════════
// HELPER INTERNAL
// ════════════════════════════════════════════════════════════════

/** Terapkan objek cfg yang sudah di-parse ke state */
function _applyCfg(kp) {
  if (kp.columnVisibility && typeof kp.columnVisibility === 'object') {
    Object.assign(cfg.columnVisibility, kp.columnVisibility);
    delete kp.columnVisibility;
  }
  assignCfg(kp);
  const hdrPeriod = document.getElementById('hdr-period');
  if (hdrPeriod) hdrPeriod.textContent = 'Periode: ' + cfg.period;
}

/** Muat semua data dari localStorage (dipakai sebagai fallback offline) */
function _loadFallbackFromLS() {
  try {
    const h = _loadCacheLS(LS_KEY_HISTORY);
    if (h) setPayrollHistory(h);

    const e = _loadCacheLS(LS_KEY_EMPLOYEES);
    if (e) setEmployees(e);

    const c = _loadCacheLS(LS_KEY_CUTI);
    if (c) {
      setCutiData(c);
      setCutiIdCounter(c.length ? Math.max(...c.map(x => x.id)) + 1 : 1);
    }

    const k = _loadCacheLS(LS_KEY_CFG);
    if (k) _applyCfg(k);
  } catch (e) {
    console.warn('[storage] Gagal memuat dari cache localStorage:', e);
  }
}
