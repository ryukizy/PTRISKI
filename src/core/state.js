// ════════════════════════════════════════════════════════════════
// state.js — Semua variabel global (FULL + DEBUG + AUTO REFRESH)
// ════════════════════════════════════════════════════════════════

export let employees = [];
export let cutiData  = [];
export let cutiIdCounter = 1;
export let payrollHistory = {};
export let activePeriodKey = '__live__';

export let DAYS    = [];
export let HOL_IDX = [];

export let selectedIdx    = null;
export let sorotAktif     = false;
export let modeEditAktif  = false;

export const cfg = {
  gajiHarian: 75000,
  transport:  15000,
  makan:      20000,
  rateLembur: 12500,
  ratePotongan: 10000,
  rateBPJSKesehatan: 0.01,
  rateBPJSKetenagakerjaan: 0.03,
  maxAlfa: 0, maxIzin: 0, maxSakit: 1,
  premiVal: 100000,
  workdays: 26,
  period: '1 April – 30 April 2026',
  tglMulai:   '2026-04-01',
  tglSelesai: '2026-04-30',
  allowSundayWork: true,   // default: Minggu bisa diedit (karena ada karyawan yang masuk kerja hari Minggu)

  columnVisibility: {
    rek: true, tgl: true, div: true, kalkulasi: true,
    p_transport: true, p_makan: true, p_lembur: true,
    p_potongan: true, p_bpjs: true,
    dailyAttendance: true,   // NEW: show/hide 30 hari absensi harian
  },
};

export const rbac = {
  role: null, nama: '', divisi: '', nik: '', empData: null,
};

// ─── SETTERS DENGAN AUTO-REFRESH CUTI ────────────────────────────
export function setEmployees(val) {
  employees = val || [];
  if (typeof window !== 'undefined' && typeof window.forceRefreshSaldo === 'function') {
    setTimeout(() => window.forceRefreshSaldo(), 150);
  }
}

export function setCutiData(val)          { cutiData = val || []; }
export function setCutiIdCounter(val)     { cutiIdCounter = val; }
export function setPayrollHistory(val)    { payrollHistory = val; }
export function setActivePeriodKey(val)   { activePeriodKey = val; }
export function setDAYS(val)              { DAYS = val; }
export function setHOL_IDX(val)           { HOL_IDX = val; }
export function setSelectedIdx(val)       { selectedIdx = val; }
export function setSorotAktif(val)        { sorotAktif = val; }
export function setModeEditAktif(val)     { modeEditAktif = val; }
export function assignCfg(obj)            { Object.assign(cfg, obj); }
export function assignRbac(obj)           { Object.assign(rbac, obj); }

// ─── DEBUG HELPERS ────────────────────────────────────────────────
if (typeof window !== 'undefined') {
  window.__STATE__ = { employees, cutiData, setEmployees, setCutiData };
  window.forceRefreshCuti = () => {
    if (typeof window.renderCuti === 'function') window.renderCuti();
    else if (typeof window.renderSaldoTable === 'function') window.renderSaldoTable();
  };
  console.log('%c[State.js] Debug siap. Gunakan: window.forceRefreshCuti()', 'color:#22c55e');
}
