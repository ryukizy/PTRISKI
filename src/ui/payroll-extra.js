// ════════════════════════════════════════════════════════════════
// ui-payroll-extra.js — Fungsi Slip Semua, THR
// (diekstrak dari script.js monolitik)
// ════════════════════════════════════════════════════════════════

import { employees, cfg, payrollHistory, activePeriodKey } from '../core/state.js';
import { calcEmployee, hitungMasaKerja } from '../core/calc.js';
import { buildSlipHTML } from './payroll.js';

export function openSlipAll() {
  if (!employees.length) return;
  document.getElementById('slip-content').innerHTML = buildSlipHTML(employees[0]) +
    `<div class="alert info" style="margin:12px 0 0;"><span class="ico">ℹ</span><span>Cetak per karyawan melalui tombol "Cetak Slip" di panel detail masing-masing karyawan. Untuk pengiriman email massal, gunakan Google Apps Script (.gs) yang disediakan.</span></div>`;
  document.getElementById('modal-slip').classList.add('open');
}

export function openTHRModal() {
  document.getElementById('thr-ref-date').value = new Date().toISOString().split('T')[0];
  hitungTHR();
  document.getElementById('modal-thr').classList.add('open');
}

export function closeTHRModal() { document.getElementById('modal-thr').classList.remove('open'); }

export function hitungTHR() {
  const refDate = document.getElementById('thr-ref-date').value || new Date().toISOString().split('T')[0];
  const tbody = document.getElementById('thr-tbody');
  const tfoot = document.getElementById('thr-tfoot');
  if (!employees.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text3);">Belum ada data karyawan.</td></tr>`;
    return;
  }
  const fmtRp = v => 'Rp '+Math.round(v).toLocaleString('id-ID');
  const gajiBulanan = cfg.gajiHarian * 25; // standar 25 hari kerja / bulan
  let totalTHR = 0;
  tbody.innerHTML = employees.map(e => {
    const mk = hitungMasaKerja(e.tgl, refDate);
    let nilaiTHR = 0;
    let status = '';
    if (mk.bulan <= 0) {
      status = 'Belum memenuhi syarat';
      nilaiTHR = 0;
    } else if (mk.bulan >= 12) {
      nilaiTHR = gajiBulanan;
      status = '✓ Penuh (≥ 12 bulan)';
    } else {
      nilaiTHR = (mk.bulan / 12) * gajiBulanan;
      status = `Pro-rata (${mk.bulan}/12)`;
    }
    totalTHR += nilaiTHR;
    return `<tr>
      <td style="font-weight:600;">${e.nama}</td>
      <td style="font-family:monospace;font-size:10.5px;">${e.nik}</td>
      <td>${e.tgl || '—'}</td>
      <td style="text-align:center;">${mk.label}</td>
      <td style="text-align:center;font-size:11px;color:${mk.bulan>=12?'var(--green)':mk.bulan>0?'var(--amber)':'var(--text3)'};">${status}</td>
      <td style="text-align:right;font-family:monospace;">${fmtRp(gajiBulanan)}</td>
      <td style="text-align:right;font-weight:700;color:${nilaiTHR>0?'var(--green)':'var(--text3)'};">${nilaiTHR > 0 ? fmtRp(nilaiTHR) : '—'}</td>
    </tr>`;
  }).join('');
  tfoot.innerHTML = `<tr style="background:#f8faff;font-weight:700;">
    <td colspan="6" style="padding:8px 10px;text-align:right;color:var(--text2);">TOTAL THR YANG HARUS DIBAYARKAN:</td>
    <td style="text-align:right;padding:8px 10px;color:var(--accent);font-size:13px;">${fmtRp(totalTHR)}</td>
  </tr>`;
}

export function exportTHRExcel() {
  if (typeof XLSX === 'undefined') { alert('Library SheetJS belum dimuat.'); return; }
  const refDate = document.getElementById('thr-ref-date').value || new Date().toISOString().split('T')[0];
  const gajiBulanan = cfg.gajiHarian * 25;
  const hdr = ['Nama','NIK','Tgl Masuk','Masa Kerja (Bulan)','Masa Kerja (Label)','Status','Gaji Sebulan','Nilai THR'];
  const rows = employees.map(e => {
    const mk = hitungMasaKerja(e.tgl, refDate);
    const nilaiTHR = mk.bulan <= 0 ? 0 : mk.bulan >= 12 ? gajiBulanan : (mk.bulan/12)*gajiBulanan;
    const status = mk.bulan <= 0 ? 'Belum memenuhi syarat' : mk.bulan >= 12 ? 'Penuh' : `Pro-rata ${mk.bulan}/12`;
    return [e.nama, e.nik, e.tgl||'', mk.bulan, mk.label, status, gajiBulanan, Math.round(nilaiTHR)];
  });
  const ws = XLSX.utils.aoa_to_sheet([hdr,...rows]);
  ws['!cols'] = [{wch:22},{wch:12},{wch:12},{wch:14},{wch:14},{wch:20},{wch:14},{wch:14}];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'THR');
  XLSX.writeFile(wb, `laporan_thr_${refDate}.xlsx`);
}

