// ════════════════════════════════════════════════════════════════
// resign.js — Proses Resign, Final Settlement, & Hapus Semua Data
// ════════════════════════════════════════════════════════════════

import { employees, setEmployees, cutiData, setCutiData, setPayrollHistory, cfg, selectedIdx, setSelectedIdx, DAYS } from '../core/state.js';
import { calcEmployee } from '../core/calc.js';
import { hitungTenure } from '../core/utils.js';
import { SALDO_CUTI_TAHUNAN_DEFAULT } from '../core/config.js';
import { saveToLS } from '../core/storage.js';
import { generatePeriodDays } from '../core/periode.js';
import { renderTableHeader, renderTable, closeDetail } from '../ui/tabel.js';

let currentResignNIK = null;

export function openResignModal() {
  if (selectedIdx === null || selectedIdx === undefined) {
    alert('Tidak ada karyawan yang dipilih.');
    return;
  }
  const emp = employees[selectedIdx];
  currentResignNIK = emp.nik;

  const identitasEl = document.getElementById('resign-identitas');
  if (identitasEl) {
    identitasEl.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;font-size:11.5px;">
        <div><span style="color:var(--text3);font-size:10px;">NAMA</span><br><strong>${emp.nama}</strong></div>
        <div><span style="color:var(--text3);font-size:10px;">NIK</span><br><strong>${emp.nik}</strong></div>
        <div><span style="color:var(--text3);font-size:10px;">DIVISI</span><br><strong>${emp.div}</strong></div>
        <div><span style="color:var(--text3);font-size:10px;">TANGGAL MASUK</span><br><strong>${emp.tgl || '—'}</strong></div>
      </div>`;
  }

  const tglEfektifEl = document.getElementById('resign-tgl-efektif');
  if (tglEfektifEl) {
    const today = new Date();
    tglEfektifEl.value = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  }

  const alasanEl = document.getElementById('resign-alasan');
  if (alasanEl) alasanEl.value = '';

  hitungSettlement();
  document.getElementById('modal-resign')?.classList.add('open');
}

export function closeResignModal() {
  document.getElementById('modal-resign')?.classList.remove('open');
  currentResignNIK = null;
}

export function hitungSettlement() {
  if (selectedIdx === null || selectedIdx === undefined) return;
  const emp = employees[selectedIdx];
  const c   = calcEmployee(emp);
  const tglEfektif = document.getElementById('resign-tgl-efektif')?.value;
  const gridEl = document.getElementById('resign-settlement-grid');

  if (!tglEfektif) {
    if (gridEl) gridEl.innerHTML = '<div style="padding:12px;color:var(--text3);text-align:center;font-size:11.5px;">Silakan pilih tanggal efektif resign terlebih dahulu.</div>';
    return;
  }

  const gajiProRata    = Math.round(c.totalHadir * cfg.gajiHarian);

  // Saldo cuti
  const saldoCuti      = emp.saldoCutiTahunan || SALDO_CUTI_TAHUNAN_DEFAULT;
  const cutiTerpakai   = cutiData.filter(ct =>
    ct.nik === emp.nik && ct.status === 'disetujui' && ct.tipe === 'tahunan'
  ).reduce((sum, ct) => sum + (ct.durasi || 0), 0);
  const sisaCuti       = Math.max(0, saldoCuti - cutiTerpakai);
  const pencairanCuti  = Math.round(sisaCuti * cfg.gajiHarian);

  // Pesangon berdasarkan UU Ketenagakerjaan Pasal 156
  const tenure = hitungTenure(emp.tgl, tglEfektif);
  let pesangon = 0, pesangonRumus = 'Belum memenuhi syarat';

  if (tenure && tenure.totalBulan >= 12) {
    const tahun = tenure.tahun;
    const bulanPesangon =
      tahun < 1 ? 0 : tahun < 2 ? 1 : tahun < 3 ? 2 :
      tahun < 4 ? 3 : tahun < 5 ? 4 : tahun < 6 ? 5 :
      tahun < 7 ? 6 : tahun < 8 ? 7 : 8;
    const gajiSebulan = cfg.gajiHarian * 25;
    pesangon = Math.round(bulanPesangon * gajiSebulan);
    pesangonRumus = `${bulanPesangon} bulan upah (masa kerja ${tenure.label})`;
  }

  const totalSettlement = gajiProRata + pencairanCuti + pesangon;

  if (gridEl) {
    gridEl.innerHTML = `
      <div class="resign-settlement-item">
        <div class="rsi-label">💰 Gaji Bulan Berjalan (Pro-rata)</div>
        <div class="rsi-detail">${c.totalHadir} hari × Rp ${cfg.gajiHarian.toLocaleString('id-ID')}</div>
        <div class="rsi-amount">Rp ${gajiProRata.toLocaleString('id-ID')}</div>
      </div>
      <div class="resign-settlement-item">
        <div class="rsi-label">🌿 Pencairan Sisa Cuti Tahunan</div>
        <div class="rsi-detail">${sisaCuti} hari × Rp ${cfg.gajiHarian.toLocaleString('id-ID')}</div>
        <div class="rsi-amount">${sisaCuti > 0 ? 'Rp '+pencairanCuti.toLocaleString('id-ID') : '—'}</div>
      </div>
      <div class="resign-settlement-item">
        <div class="rsi-label">📋 Estimasi Pesangon</div>
        <div class="rsi-detail">${pesangonRumus}</div>
        <div class="rsi-amount">${pesangon > 0 ? 'Rp '+pesangon.toLocaleString('id-ID') : '—'}</div>
      </div>
      <div class="resign-settlement-total">
        <div class="rst-label">💵 TOTAL FINAL SETTLEMENT</div>
        <div class="rst-amount">Rp ${totalSettlement.toLocaleString('id-ID')}</div>
      </div>`;
  }

  const pesangonDetailEl = document.getElementById('resign-pesangon-detail');
  if (pesangonDetailEl) {
    pesangonDetailEl.innerHTML = tenure && tenure.totalBulan >= 12
      ? `<div><strong>Masa Kerja:</strong> ${tenure.label}</div>
         <div><strong>Rumus:</strong> ${pesangonRumus}</div>
         <div><strong>Gaji Bulanan (est.):</strong> Rp ${(cfg.gajiHarian*25).toLocaleString('id-ID')}</div>
         <div><strong>Total Pesangon:</strong> Rp ${pesangon.toLocaleString('id-ID')}</div>`
      : `<div style="color:var(--text3);">Masa kerja kurang dari 1 tahun. Pesangon belum memenuhi syarat.</div>`;
  }
}

export function konfirmasiResign() {
  if (selectedIdx === null || selectedIdx === undefined) {
    alert('Tidak ada karyawan yang dipilih.');
    return;
  }
  const emp        = employees[selectedIdx];
  const tglEfektif = document.getElementById('resign-tgl-efektif')?.value;
  const alasan     = document.getElementById('resign-alasan')?.value || '';

  if (!tglEfektif) { alert('Silakan pilih tanggal efektif resign.'); return; }

  if (!confirm(
    `KONFIRMASI PROSES RESIGN\n\nKaryawan: ${emp.nama} (${emp.nik})\nTanggal Efektif: ${new Date(tglEfektif).toLocaleDateString('id-ID')}\n\nLanjutkan proses resign?`
  )) return;

  emp.statusKaryawan = 'resign';
  emp.tglKeluar      = tglEfektif;
  emp.alasanResign   = alasan;

  saveToLS();
  closeResignModal();
  closeDetail();
  renderTable();

  if (document.getElementById('tab-analitik')?.classList.contains('active')) {
    import('../ui/analitik.js').then(m => m.renderAnalitik?.());
  }

  alert(`PROSES RESIGN BERHASIL\n\n${emp.nama} telah diproses resign per ${new Date(tglEfektif).toLocaleDateString('id-ID')}.`);
}

export function deleteAllData() {
  if (!confirm('⚠️ PERINGATAN KRITIS ⚠️\n\nFitur ini akan menghapus SEMUA DATA KARYAWAN, CUTI, dan PAYROLL.\n\nData yang dihapus TIDAK DAPAT DIKEMBALIKAN.\n\nApakah yakin ingin melanjutkan?')) return;

  const validasi = prompt('VALIDASI KEAMANAN\n\nKetik kata berikut dengan huruf besar:\n\nHAPUS');
  if (validasi !== 'HAPUS') {
    if (validasi !== null) alert('Validasi gagal. Penghapusan dibatalkan.');
    return;
  }
  if (!confirm('KONFIRMASI FINAL\n\nIni adalah kesempatan terakhir untuk membatalkan.\nSemua data akan dihapus permanen.\n\nLanjutkan?')) return;

  setEmployees([]);
  setCutiData([]);
  setPayrollHistory({});

  // Hapus semua key localStorage yang dikenal
  ['employees_v13','cutiData_v13','payrollHistory_v13','cfg_v13','rbacSession_v14','notifState_v15'].forEach(k => {
    try { localStorage.removeItem(k); } catch(e) {}
  });

  Object.assign(cfg, {
    period: '11 April – 25 April 2026', workdays: 13,
    tglMulai: '2026-04-11', tglSelesai: '2026-04-25',
  });
  generatePeriodDays();
  renderTableHeader();
  saveToLS();
  closeDetail();
  setSelectedIdx(null);
  renderTable();
  import('../ui/payroll.js').then(m => m.renderPayroll?.());
  import('../ui/analitik.js').then(m => m.renderAnalitik?.());

  alert('✓ SEMUA DATA BERHASIL DIHAPUS\n\nSistem telah dikembalikan ke kondisi awal.');
}
