// ════════════════════════════════════════════════════════════════
// ui-settings.js — Modal Pengaturan Sistem
// ════════════════════════════════════════════════════════════════

import { cfg, employees, DAYS } from '../core/state.js';
import { readRp, initRpInputs } from '../core/utils.js';
import { generatePeriodDays } from '../core/periode.js';
import { saveToLS } from '../core/storage.js';
import { renderTableHeader, renderTable } from './tabel.js';

export function openSettings() {
  function setRp(id, val) {
    const el = document.getElementById(id);
    if (!el) return;
    el.dataset.raw = String(Math.round(val));
    el.value = Math.round(val).toLocaleString('id-ID');
  }
  setRp('cfg-gaji-harian',   cfg.gajiHarian);
  setRp('cfg-transport',     cfg.transport);
  setRp('cfg-makan',         cfg.makan);
  setRp('cfg-rate-lembur',   cfg.rateLembur);
  setRp('cfg-rate-potongan', cfg.ratePotongan);
  setRp('cfg-premi-val',     cfg.premiVal);

  document.getElementById('cfg-bpjs-kesehatan').value       = +(cfg.rateBPJSKesehatan * 100).toFixed(2);
  document.getElementById('cfg-bpjs-ketenagakerjaan').value = +(cfg.rateBPJSKetenagakerjaan * 100).toFixed(2);

  const elMulai   = document.getElementById('cfg-tgl-mulai');
  const elSelesai = document.getElementById('cfg-tgl-selesai');
  const elPeriod  = document.getElementById('cfg-period');
  const elWd      = document.getElementById('cfg-workdays');
  if (elMulai)   elMulai.value   = cfg.tglMulai   || '';
  if (elSelesai) elSelesai.value = cfg.tglSelesai || '';
  if (elPeriod)  elPeriod.value  = cfg.period;
  if (elWd)      elWd.value      = cfg.workdays;

  if (elMulai)   elMulai.oninput   = pratinjauPeriode;
  if (elSelesai) elSelesai.oninput = pratinjauPeriode;

  document.getElementById('modal-settings').classList.add('open');
}

export function closeSettings() {
  document.getElementById('modal-settings').classList.remove('open');
}

export function pratinjauPeriode() {
  const m = document.getElementById('cfg-tgl-mulai')?.value;
  const s = document.getElementById('cfg-tgl-selesai')?.value;
  if (!m || !s) return;

  const mulai   = new Date(m);
  const selesai = new Date(s);
  if (isNaN(mulai) || isNaN(selesai) || selesai < mulai) return;

  let wd = 0;
  const cur = new Date(mulai);
  while (cur <= selesai) {
    if (cur.getDay() !== 0) wd++;
    cur.setDate(cur.getDate() + 1);
  }

  const elWd = document.getElementById('cfg-workdays');
  if (elWd) elWd.value = wd;

  const namaBulan = ['Januari','Februari','Maret','April','Mei','Juni',
                     'Juli','Agustus','September','Oktober','November','Desember'];
  const periodeLabel = (mulai.getMonth() === selesai.getMonth() && mulai.getFullYear() === selesai.getFullYear())
    ? `${mulai.getDate()} – ${selesai.getDate()} ${namaBulan[selesai.getMonth()]} ${selesai.getFullYear()}`
    : `${mulai.getDate()} ${namaBulan[mulai.getMonth()]} – ${selesai.getDate()} ${namaBulan[selesai.getMonth()]} ${selesai.getFullYear()}`;

  const elPeriod = document.getElementById('cfg-period');
  if (elPeriod) elPeriod.value = periodeLabel;
}

export function applySettings() {
  cfg.gajiHarian   = readRp('cfg-gaji-harian');
  cfg.transport    = readRp('cfg-transport');
  cfg.makan        = readRp('cfg-makan');
  cfg.rateLembur   = readRp('cfg-rate-lembur');
  cfg.ratePotongan = readRp('cfg-rate-potongan');
  cfg.premiVal     = readRp('cfg-premi-val');
  cfg.rateBPJSKesehatan       = (parseFloat(document.getElementById('cfg-bpjs-kesehatan').value) || 1) / 100;
  cfg.rateBPJSKetenagakerjaan = (parseFloat(document.getElementById('cfg-bpjs-ketenagakerjaan').value) || 3) / 100;
  cfg.maxAlfa  = parseInt(document.getElementById('cfg-max-alfa').value)  || 0;
  cfg.maxIzin  = parseInt(document.getElementById('cfg-max-izin').value)  || 0;
  cfg.maxSakit = parseInt(document.getElementById('cfg-max-sakit').value) || 1;

  const tglMulaiBaru   = document.getElementById('cfg-tgl-mulai')?.value  || cfg.tglMulai;
  const tglSelesaiBaru = document.getElementById('cfg-tgl-selesai')?.value || cfg.tglSelesai;
  const periodeBerubah = (tglMulaiBaru !== cfg.tglMulai || tglSelesaiBaru !== cfg.tglSelesai);
  cfg.tglMulai   = tglMulaiBaru;
  cfg.tglSelesai = tglSelesaiBaru;

  generatePeriodDays();

  const periodeManual = document.getElementById('cfg-period')?.value?.trim();
  if (periodeManual) cfg.period = periodeManual;

  if (periodeBerubah) {
    // Tampilkan modal konfirmasi pergantian periode dengan opsi backup
    showPeriodChangeModal();
    return; // hentikan proses, lanjut di dalam modal
  }

  document.getElementById('hdr-period').textContent = 'Periode: ' + cfg.period;
  saveToLS();
  closeSettings();
  renderTable();

  // Lazy import untuk menghindari circular deps
  import('./payroll.js').then(m => m.renderPayroll?.());
}

// ════════════════════════════════════════════════════════════════
// FUNGSI MODAL PERGANTIAN PERIODE
// ════════════════════════════════════════════════════════════════

export function showPeriodChangeModal() {
  const modal = document.getElementById('modal-period-change');
  if (modal) modal.classList.add('open');
}

export function closePeriodChangeModal() {
  const modal = document.getElementById('modal-period-change');
  if (modal) modal.classList.remove('open');
}

// Expose ke global scope agar bisa dipanggil dari onclick di HTML
window.showPeriodChangeModal = showPeriodChangeModal;
window.closePeriodChangeModal = closePeriodChangeModal;
window.downloadBackupAndReset = downloadBackupAndReset;

export function downloadBackupAndReset() {
  // 1. Download Backup
  if (typeof XLSX !== 'undefined') {
    try {
      const wb = XLSX.utils.book_new();
      const dataForExport = employees.map(emp => {
        const row = { ...emp };
        // Hilangkan data yang tidak perlu di backup
        delete row.days;
        return row;
      });

      const ws = XLSX.utils.json_to_sheet(dataForExport);
      XLSX.utils.book_append_sheet(wb, ws, "Backup Karyawan");

      // Tambahkan sheet absensi saat ini
      const attendanceData = employees.map((emp, idx) => {
        const obj = {
          No: idx + 1,
          Nama: emp.nama,
          NIK: emp.nik,
          Divisi: emp.div
        };
        (emp.days || []).forEach((val, i) => {
          obj[`Hari ${i + 1}`] = val;
        });
        return obj;
      });

      const ws2 = XLSX.utils.json_to_sheet(attendanceData);
      XLSX.utils.book_append_sheet(wb, ws2, "Data Absensi Saat Ini");

      const dateStr = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `Backup_Absensi_${cfg.period.replace(/ /g, '_')}_${dateStr}.xlsx`);
    } catch (e) {
      alert('Gagal membuat file backup: ' + e.message);
    }
  } else {
    alert('Library XLSX tidak tersedia. Tidak bisa download backup.');
  }

  // 2. Tutup modal
  closePeriodChangeModal();

  // 3. Lanjutkan proses reset data
  performPeriodReset();
}

function performPeriodReset() {
  renderTableHeader();
  const newLen = DAYS.length;

  employees.forEach(emp => {
    emp.days = new Array(newLen).fill(0);
  });

  document.getElementById('hdr-period').textContent = 'Periode: ' + cfg.period;
  saveToLS();
  renderTable();

  import('./payroll.js').then(m => m.renderPayroll?.());
  import('./analitik.js').then(m => m.renderAnalitik?.());
}
