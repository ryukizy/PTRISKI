// ════════════════════════════════════════════════════════════════
// ui-payroll.js — Tab Payroll, Slip Gaji, Histori Periode
// ════════════════════════════════════════════════════════════════

import { employees, cfg, selectedIdx, setSelectedIdx, payrollHistory, setPayrollHistory, activePeriodKey, setActivePeriodKey } from '../core/state.js';
import { calcEmployee, calcEmployeeWithCfg } from '../core/calc.js';
import { saveToLS } from '../core/storage.js';
import { getSaldoCuti } from '../features/cuti.js';

// ─── YTD (Year-to-date) dari histori ───
export function getYTD(nik, tahun) {
  let totalGaji = 0, totalHadir = 0;
  Object.values(payrollHistory).forEach(period => {
    if (!period.cfg || !period.employees) return;
    const thn = new Date(period.cfg.tglMulai || '').getFullYear();
    if (thn !== tahun) return;
    const emp = period.employees.find(e => e.nik === nik);
    if (!emp) return;
    const c = calcEmployeeWithCfg(emp, period.cfg);
    totalGaji   += c.totalGaji;
    totalHadir  += c.totalHadir;
  });
  return { totalGaji, totalHadir };
}

function getEmployeesForPeriod(key) {
  if (key === '__live__') return employees;
  return payrollHistory[key]?.employees || employees;
}

function getCfgForPeriod(key) {
  if (key === '__live__') return cfg;
  return payrollHistory[key]?.cfg || cfg;
}

export function renderPayroll() {
  updatePeriodDropdown();
  const activeIndices = employees
    .map((emp, idx) => emp.statusKaryawan === 'resign' ? -1 : idx)
    .filter(idx => idx !== -1);
  buildPayrollCards(activeIndices);
}

export function filterPayroll() {
  const empForPeriod = getEmployeesForPeriod(activePeriodKey);
  const cfgForPeriod = getCfgForPeriod(activePeriodKey);

  const q  = (document.getElementById('search-payroll').value || '').toLowerCase().trim();
  const st = document.getElementById('filter-payroll-status').value;

  const indices = empForPeriod.reduce((acc, emp, idx) => {
    if (activePeriodKey === '__live__' && emp.statusKaryawan === 'resign') return acc;
    const c = activePeriodKey !== '__live__'
      ? calcEmployeeWithCfg(emp, cfgForPeriod)
      : calcEmployee(emp);
    const matchQ  = !q || emp.nama.toLowerCase().includes(q) || emp.nik.toLowerCase().includes(q);
    const matchSt = !st || (st === 'premi' && c.premiOk) || (st === 'no-premi' && !c.premiOk);
    if (matchQ && matchSt) acc.push(idx);
    return acc;
  }, []);

  const _savedEmp = employees;
  if (activePeriodKey !== '__live__') Object.assign(employees, empForPeriod);
  buildPayrollCards(indices);
}

export function buildPayrollCards(indices) {
  const el      = document.getElementById('payroll-list');
  const emptyEl = document.getElementById('payroll-empty');
  if (!indices.length) { el.innerHTML = ''; emptyEl.style.display = 'block'; return; }
  emptyEl.style.display = 'none';

  el.innerHTML = indices.map(idx => {
    const emp = employees[idx];
    const c   = calcEmployee(emp);
    const ini = emp.nama.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
    return `<div class="payroll-card">
      <div class="payroll-hdr" id="pc-hdr-${idx}" onclick="togglePayrollCard(${idx})" title="Klik untuk lihat rincian">
        <div class="p-avatar" style="pointer-events:none;">${ini}</div>
        <div style="flex:1;min-width:0;pointer-events:none;">
          <div class="p-name" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${emp.nama}</div>
          <div class="p-sub">${emp.div} · NIK: ${emp.nik}</div>
        </div>
        <div class="p-hdr-right" style="pointer-events:none;">
          ${c.premiOk ? '<span class="badge b-premi">✓ Premi</span>' : '<span class="badge b-no-premi">✗ No Premi</span>'}
          <div class="p-total-preview">Rp ${c.totalGaji.toLocaleString('id-ID')}</div>
          <div class="p-chevron">▾</div>
        </div>
      </div>
      <div class="payroll-body" id="pc-body-${idx}">
        <div class="p-row"><span>Total Kehadiran</span><span>${c.totalHadir} hari</span></div>
        ${(()=>{
          const s = getSaldoCuti(emp.nik);
          const warna = s.sisa === 0 ? 'var(--red)' : s.sisa <= 3 ? 'var(--amber)' : 'var(--green)';
          return `<div class="p-row" title="Kuota: ${s.total} hari · Terpakai: ${s.terpakai} hari · Pending: ${s.pending} hari">
            <span>🏖 Saldo Cuti ${s.tahun}</span>
            <span style="font-weight:600;color:${warna};">${s.sisa} / ${s.total} hari</span>
          </div>`;
        })()}
        <div class="p-row"><span>Gaji Pokok Harian</span><span class="p-plus">Rp ${c.gajiPokok.toLocaleString('id-ID')}</span></div>
        <div class="p-row"><span>Uang Transport</span><span class="p-plus">Rp ${c.uTransport.toLocaleString('id-ID')}</span></div>
        <div class="p-row"><span>Uang Makan</span><span class="p-plus">Rp ${c.uMakan.toLocaleString('id-ID')}</span></div>
        <div class="p-row"><span>Total Lembur (${c.ot} jam)</span><span class="p-plus">Rp ${c.uLembur.toLocaleString('id-ID')}</span></div>
        <div class="p-row"><span>Potongan Jam (${c.pot} jam)</span><span class="p-minus">- Rp ${c.uPotongan.toLocaleString('id-ID')}</span></div>
        <div class="p-row p-total"><span>Premi Hadir</span><span class="${c.premiOk ? 'p-plus' : 'muted'}">${c.premiOk ? 'Rp ' + c.premi.toLocaleString('id-ID') : 'Rp 0'}</span></div>
        <div class="p-row p-total" style="border-top:2px solid var(--accent);margin-top:2px;padding-top:7px;">
          <span>💰 Total Gaji</span>
          <span style="color:var(--accent);font-size:13.5px;">Rp ${c.totalGaji.toLocaleString('id-ID')}</span>
        </div>
        <div style="margin-top:10px;">
          <button class="btn primary" style="width:100%;font-size:12px;" onclick="window._openSlipAt(${idx})">🖨 Cetak Slip Gaji</button>
        </div>
      </div>
    </div>`;
  }).join('');
  el.onclick = null;
}

export function togglePayrollCard(idx) {
  const body = document.getElementById('pc-body-' + idx);
  const hdr  = document.getElementById('pc-hdr-' + idx);
  if (!body || !hdr) return;
  const isOpen = body.classList.contains('open');
  body.classList.toggle('open', !isOpen);
  hdr.classList.toggle('open', !isOpen);
}

export function buildSlipHTML(emp) {
  const c = calcEmployee(emp);
  const tglCetak = new Date().toLocaleDateString('id-ID', { day:'2-digit', month:'long', year:'numeric' });
  const slipNo   = 'RH/' + cfg.period.replace(/\s/g,'').replace(/[–-]/g,'/').toUpperCase() + '/' + String(emp.no).padStart(3,'0');

  const fmt = val => 'Rp\u00a0' + Math.abs(Math.round(val)).toLocaleString('id-ID');
  const totalIncome = c.gajiPokok + c.uTransport + c.uMakan + c.uLembur + (c.premiOk ? c.premi : 0);
  const totalDeduct = c.uPotongan + c.bpjs;

  const incomeRow = (lbl, sub, val, isDim) =>
    `<div class="sv9-row"><div class="sv9-row-label">${lbl}${sub ? `<span class="sv9-row-sub">${sub}</span>` : ''}</div><div class="sv9-row-amount ${isDim ? 'dim' : 'plus'}">${fmt(val)}</div></div>`;

  const deductRow = (lbl, sub, val) =>
    `<div class="sv9-row"><div class="sv9-row-label">${lbl}${sub ? `<span class="sv9-row-sub">${sub}</span>` : ''}</div><div class="sv9-row-amount ${val > 0 ? 'minus' : 'dim'}">${val > 0 ? '− ' + fmt(val) : '—'}</div></div>`;

  return `<div class="slip-v9">
  <div class="sv9-header">
    <div class="sv9-brand-row">
      <div class="sv9-logo">RH</div>
      <div class="sv9-company">
        <div class="sv9-company-name">PT. RISKI HARIYANTO</div>
        <div class="sv9-company-sub">Divisi Jahit · Departemen SDM &amp; Penggajian</div>
      </div>
      <div class="sv9-slip-badge">${slipNo}</div>
    </div>
    <div class="sv9-title-row"><div><div class="sv9-title">Slip Gaji</div><div class="sv9-period">📅 Periode: ${cfg.period}</div></div></div>
  </div>
  <div class="sv9-emp">
    <div class="sv9-field" style="grid-column:1/-1;"><div class="sv9-field-lbl">Nama Karyawan</div><div class="sv9-field-val name">${emp.nama}</div></div>
    <div class="sv9-field"><div class="sv9-field-lbl">NIK</div><div class="sv9-field-val">${emp.nik || '—'}</div></div>
    <div class="sv9-field"><div class="sv9-field-lbl">Divisi</div><div class="sv9-field-val">${emp.div}</div></div>
    <div class="sv9-field"><div class="sv9-field-lbl">No. Rekening</div><div class="sv9-field-val">${emp.rek || '—'}</div></div>
    <div class="sv9-field"><div class="sv9-field-lbl">Status Premi</div><div class="sv9-field-val"><span class="sv9-premi-badge ${c.premiOk ? 'sv9-premi-ok' : 'sv9-premi-no'}">${c.premiOk ? '✓ Memenuhi Syarat' : '✗ Tidak Memenuhi'}</span></div></div>
    <div class="sv9-field"><div class="sv9-field-lbl">Total Kehadiran</div><div class="sv9-field-val">${c.totalHadir} hari kerja</div></div>
    <div class="sv9-field"><div class="sv9-field-lbl">Tgl Diterbitkan</div><div class="sv9-field-val">${tglCetak}</div></div>
    ${(()=>{
      const s = getSaldoCuti(emp.nik);
      const warna = s.sisa === 0 ? '#c0392b' : s.sisa <= 3 ? '#d97706' : '#1a7a42';
      return `<div class="sv9-field"><div class="sv9-field-lbl">Saldo Cuti ${s.tahun}</div><div class="sv9-field-val" style="color:${warna};font-weight:700;">${s.sisa} hari (dari ${s.total} hari · Terpakai: ${s.terpakai})</div></div>`;
    })()}
  </div>
  <div class="sv9-body">
    <div class="sv9-body-grid">
      <div class="sv9-col-income">
        <div class="sv9-section-hdr"><div class="sv9-section-dot sv9-dot-green"></div>Pendapatan / Income</div>
        ${incomeRow('Gaji Pokok Harian', `${c.totalHadir} hari × Rp ${cfg.gajiHarian.toLocaleString('id-ID')}`, c.gajiPokok)}
        ${incomeRow('Uang Transport', `${c.totalHadir} hari × Rp ${cfg.transport.toLocaleString('id-ID')}`, c.uTransport)}
        ${incomeRow('Uang Makan', `${c.totalHadir} hari × Rp ${cfg.makan.toLocaleString('id-ID')}`, c.uMakan)}
        ${incomeRow('Uang Lembur', `${c.ot} jam × Rp ${cfg.rateLembur.toLocaleString('id-ID')}`, c.uLembur, c.uLembur === 0)}
        ${incomeRow('Premi Kehadiran', c.premiOk ? 'Memenuhi syarat' : 'Tidak memenuhi syarat', c.premiOk ? c.premi : 0, !c.premiOk)}
      </div>
      <div class="sv9-col-deduct">
        <div class="sv9-section-hdr"><div class="sv9-section-dot sv9-dot-red"></div>Potongan / Deduction</div>
        ${deductRow('Potongan Jam Kerja', `${c.pot} jam × Rp ${cfg.ratePotongan.toLocaleString('id-ID')}`, c.uPotongan)}
        ${deductRow('Potongan BPJS', `Kesehatan ${(cfg.rateBPJSKesehatan*100).toFixed(0)}% + Ketenagakerjaan ${(cfg.rateBPJSKetenagakerjaan*100).toFixed(0)}%`, c.bpjs)}
      </div>
    </div>
    <div class="sv9-totals">
      <div class="sv9-total-box"><div class="sv9-total-lbl">Total Pendapatan</div><div class="sv9-total-val">${fmt(totalIncome)}</div></div>
      <div class="sv9-total-box"><div class="sv9-total-lbl">Total Potongan</div><div class="sv9-total-val" style="color:#c0392b;">${totalDeduct > 0 ? '− ' + fmt(totalDeduct) : '—'}</div></div>
    </div>
    ${emp.bonus && emp.bonus > 0 ? incomeRow('Bonus / Insentif Produksi', emp.bonusKet || '', emp.bonus) : ''}
    <div class="sv9-takehome">
      <div class="sv9-th-left"><div class="sv9-th-label">💵 Take Home Pay</div><div class="sv9-th-hint">Ditransfer ke rekening karyawan</div></div>
      <div class="sv9-th-amount">${fmt(c.totalGaji)}</div>
    </div>
  </div>
  <div class="sv9-footer">
    <div class="sv9-footer-note">Dokumen diterbitkan otomatis oleh sistem penggajian.<br>Lembur: ${c.ot > 0 ? c.ot + ' jam' : '—'} | Hadir: ${c.totalHadir} | Alfa: ${c.alfa} | Izin: ${c.izin} | Sakit: ${c.sakit} | Cuti: ${c.cuti}</div>
  </div>
</div>`;
}

export function openSlipSingle() {
  if (selectedIdx === null) return;
  const emp = employees[selectedIdx];
  document.getElementById('slip-content').innerHTML = buildSlipHTML(emp);
  document.getElementById('modal-slip').classList.add('open');
}

export function closeSlip() {
  document.getElementById('modal-slip').classList.remove('open');
}

export function printSlip() {
  const slipHTML = document.getElementById('slip-content').innerHTML;
  const pw = window.open('', '_blank', 'width=750,height=900');
  if (!pw) { alert('Pop-up diblokir. Izinkan pop-up untuk halaman ini lalu coba lagi.'); return; }
  pw.document.write(`<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8"><title>Slip Gaji – PT. Riski Hariyanto</title>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}html{font-family:'Plus Jakarta Sans',sans-serif;background:#f0f2f8;font-size:13px}body{max-width:660px;margin:0 auto;padding:20px 14px 32px}.slip-v9{font-family:'Plus Jakarta Sans',sans-serif;width:100%;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 32px rgba(0,0,0,.12);border:1px solid #e0e4ed}.sv9-header{background:linear-gradient(135deg,#0f2140,#1b4fa8);padding:14px 20px 12px;-webkit-print-color-adjust:exact;print-color-adjust:exact}.sv9-brand-row{display:flex;align-items:center;gap:10px;margin-bottom:10px}.sv9-logo{width:36px;height:36px;background:#c0392b;border-radius:7px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:10px;color:#fff;flex-shrink:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}.sv9-company{flex:1}.sv9-company-name{font-size:12px;font-weight:700;color:#fff}.sv9-company-sub{font-size:9.5px;color:rgba(255,255,255,.55);margin-top:1px}.sv9-slip-badge{background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2);border-radius:20px;padding:2px 9px;font-size:9.5px;color:rgba(255,255,255,.8);white-space:nowrap;font-family:'JetBrains Mono',monospace;-webkit-print-color-adjust:exact;print-color-adjust:exact}.sv9-title{font-size:19px;font-weight:800;color:#fff;letter-spacing:-.5px}.sv9-period{font-size:10px;color:rgba(255,255,255,.65);margin-top:2px}.sv9-emp{background:#f7f8fb;border-bottom:1px solid #e4e8f0;padding:10px 20px;display:grid;grid-template-columns:1fr 1fr;gap:5px 14px}.sv9-field-lbl{color:#8a93a8;font-weight:600;text-transform:uppercase;letter-spacing:.4px;font-size:8.5px;margin-bottom:1px}.sv9-field-val{color:#111827;font-weight:600;font-size:11px}.sv9-field-val.name{font-size:14px;font-weight:800;color:#0f2140}.sv9-premi-badge{display:inline-flex;align-items:center;gap:4px;padding:1px 8px;border-radius:20px;font-size:9.5px;font-weight:700;-webkit-print-color-adjust:exact;print-color-adjust:exact}.sv9-premi-ok{background:#e7f5ed;color:#1a7a42}.sv9-premi-no{background:#fdecea;color:#c0392b}.sv9-body{padding:0 20px 12px}.sv9-body-grid{display:grid;grid-template-columns:1fr 1fr;gap:0 14px;align-items:start}.sv9-col-income{border-right:1px solid #e8eaf2;padding-right:10px}.sv9-col-deduct{padding-left:4px}.sv9-section-hdr{display:flex;align-items:center;gap:7px;padding:10px 0 6px;font-size:8.5px;font-weight:700;color:#8a93a8;text-transform:uppercase;letter-spacing:.6px;border-bottom:1px solid #e8eaf2;margin-bottom:2px}.sv9-section-dot{width:5px;height:5px;border-radius:50%;flex-shrink:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}.sv9-dot-green{background:#1a7a42}.sv9-dot-red{background:#c0392b}.sv9-row{display:flex;align-items:baseline;padding:5px 0;border-bottom:1px solid #f0f2f8;gap:6px}.sv9-row-label{flex:1;font-size:11px;color:#374151}.sv9-row-sub{display:block;font-size:9px;color:#9ca3af;margin-top:1px;font-family:'JetBrains Mono',monospace}.sv9-row-amount{font-size:11px;font-weight:600;font-family:'JetBrains Mono',monospace;white-space:nowrap;text-align:right}.sv9-row-amount.plus{color:#1a7a42}.sv9-row-amount.minus{color:#c0392b}.sv9-row-amount.dim{color:#9ca3af}.sv9-totals{margin:8px 0 0;border-top:1.5px solid #e4e8f0;padding-top:8px;display:grid;grid-template-columns:1fr 1fr;gap:6px}.sv9-total-box{background:#f7f8fb;border:1px solid #e4e8f0;border-radius:7px;padding:8px 10px;-webkit-print-color-adjust:exact;print-color-adjust:exact}.sv9-total-lbl{font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:#8a93a8;margin-bottom:3px}.sv9-total-val{font-size:12px;font-weight:800;color:#111827;font-family:'JetBrains Mono',monospace}.sv9-takehome{margin:8px 0 0;background:#e7f5ed;border:1.5px solid #b7e0c7;border-radius:8px;padding:10px 14px;display:flex;align-items:center;justify-content:space-between;-webkit-print-color-adjust:exact;print-color-adjust:exact}.sv9-th-label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#1a7a42}.sv9-th-hint{font-size:8.5px;color:#5a9e72;margin-top:1px}.sv9-th-amount{font-size:19px;font-weight:800;color:#1a7a42;font-family:'JetBrains Mono',monospace;letter-spacing:-.5px}.sv9-footer{background:#f7f8fb;border-top:1px solid #e4e8f0;padding:8px 20px;-webkit-print-color-adjust:exact;print-color-adjust:exact}.sv9-footer-note{font-size:8px;color:#9ca3af;line-height:1.6}*{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}</style>
</head><body>${slipHTML}<script>window.onload=function(){setTimeout(function(){window.print();},400);};window.onafterprint=function(){window.close();};<\/script></body></html>`);
  pw.document.close();
}

export function updatePeriodDropdown() {
  const sel = document.getElementById('payroll-period-select');
  if (!sel) return;
  const keys = Object.keys(payrollHistory).sort().reverse();
  sel.innerHTML = `<option value="__live__">📋 Periode Aktif (Live)</option>` +
    keys.map(k => {
      const p = payrollHistory[k];
      return `<option value="${k}">${p.cfg?.period || k} (${p.employees?.length || 0} karyawan)</option>`;
    }).join('');
  sel.value = activePeriodKey;
}

export function switchPayrollPeriod(key) {
  setActivePeriodKey(key);
  filterPayroll();
}

export function konfirmasiSimpanPeriode() {
  if (!confirm(`Simpan periode "${cfg.period}" ke arsip payroll?\n\nData absensi dan konfigurasi saat ini akan disimpan permanen dan dapat diakses kembali kapan saja.`)) return;

  const key = cfg.tglMulai + '_' + cfg.tglSelesai;
  payrollHistory[key] = {
    cfg:       JSON.parse(JSON.stringify(cfg)),
    employees: JSON.parse(JSON.stringify(employees)),
    savedAt:   new Date().toISOString(),
  };

  saveToLS();
  updatePeriodDropdown();
  alert(`✓ Periode "${cfg.period}" berhasil disimpan ke arsip payroll.`);
}

// Helper untuk dipanggil dari onclick inline di payroll card
window._openSlipAt = function(idx) {
  setSelectedIdx(idx);
  openSlipSingle();
};
