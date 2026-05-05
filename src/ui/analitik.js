// ════════════════════════════════════════════════════════════════
// ui-analitik.js — Dashboard Analitik Lanjutan (chart, KPI, heatmap)
// ════════════════════════════════════════════════════════════════

import { employees, cfg, DAYS, HOL_IDX } from '../core/state.js';
import { calcEmployee } from '../core/calc.js';
import { parseDay } from '../core/calc.js';
import { fmtRpAnalitik, divClass } from '../core/utils.js';
import { hitungTenure } from '../core/utils.js';

export function renderAnalitik() {
  if (!employees.length) {
    ['chart-divisi','chart-coa','chart-retensi','chart-heatmap'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = '<div style="color:var(--text3);text-align:center;padding:32px;font-size:12.5px;">Belum ada data karyawan. Silakan tambah atau import data terlebih dahulu.</div>';
    });
    ['an-rate','an-coa-kpi','an-turnover','an-tenure-avg','an-total-alfa'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = '—';
    });
    return;
  }

  const elPeriod = document.getElementById('an-period-label');
  if (elPeriod) elPeriod.textContent = cfg.period;

  let totalHadir = 0, totalAlfa = 0, totalIzin = 0, totalSakit = 0;
  const calcs = employees.map(emp => {
    const c = calcEmployee(emp);
    totalHadir  += c.totalHadir;
    totalAlfa   += c.alfa;
    totalIzin   += c.izin;
    totalSakit  += c.sakit;
    return { emp, c };
  });

  const maxPossible = cfg.workdays * employees.length;
  const pctHadir    = maxPossible > 0 ? (totalHadir / maxPossible * 100) : 0;

  const elRate = document.getElementById('an-rate');
  if (elRate) elRate.textContent = pctHadir.toFixed(1) + '%';
  const elAlfa = document.getElementById('an-total-alfa');
  if (elAlfa) elAlfa.textContent = totalAlfa + ' hari';

  renderDivisiChart(calcs);
  renderCostOfAbsenteeism(calcs, totalAlfa);
  renderRetensi(calcs);
  renderResignHistory();
  // Heatmap Absensi Harian dihapus sesuai permintaan
}

function renderDivisiChart(calcs) {
  const el = document.getElementById('chart-divisi');
  if (!el) return;

  const DIVISI = ['WS','S. TEMPEL','S. JARUM 2','S. JARUM 1,2'];
  const divData = {};
  DIVISI.forEach(d => { divData[d] = { hadir:0, alfa:0, izin:0, sakit:0, n:0, maxHadir:0 }; });

  calcs.forEach(({ emp, c }) => {
    const dv = emp.div in divData ? emp.div : null;
    if (!dv) return;
    divData[dv].hadir += c.totalHadir;
    divData[dv].alfa  += c.alfa;
    divData[dv].izin  += c.izin;
    divData[dv].sakit += c.sakit;
    divData[dv].n++;
    divData[dv].maxHadir += cfg.workdays;
  });

  const warnaDivisi = { 'WS':'#1b4fa8','S. TEMPEL':'#1a7a42','S. JARUM 2':'#a05c00','S. JARUM 1,2':'#6d28d9' };

  const html = DIVISI.map(dv => {
    const d = divData[dv];
    if (d.n === 0) return `<div class="div-row" style="opacity:.4;"><div class="div-label-row"><div class="div-name">${dv}</div><div style="font-size:10px;color:var(--text3);">Tidak ada karyawan</div></div></div>`;

    const pctHadir = d.maxHadir > 0 ? (d.hadir / d.maxHadir * 100) : 0;
    const pctAlfa  = d.maxHadir > 0 ? (d.alfa  / d.maxHadir * 100) : 0;
    const pctIzin  = d.maxHadir > 0 ? (d.izin  / d.maxHadir * 100) : 0;
    const pctSakit = d.maxHadir > 0 ? (d.sakit / d.maxHadir * 100) : 0;

    return `<div class="div-row">
      <div class="div-label-row">
        <div class="div-name" style="color:${warnaDivisi[dv] || 'var(--accent)'};">${dv}</div>
        <div class="div-stats">
          <span class="div-stat">${d.n} karyawan</span>
          <span class="div-stat" style="color:var(--green)"><strong>${pctHadir.toFixed(1)}%</strong> hadir</span>
        </div>
      </div>
      <div class="div-bars">
        <div class="div-bar-row"><div class="div-bar-key">Hadir</div><div class="div-bar-track"><div class="div-bar-fill hadir" style="width:${pctHadir}%"></div></div><div class="div-bar-val" style="color:var(--green);">${d.hadir}</div></div>
        <div class="div-bar-row"><div class="div-bar-key">Alfa</div><div class="div-bar-track"><div class="div-bar-fill alfa" style="width:${Math.min(pctAlfa*3,100)}%"></div></div><div class="div-bar-val" style="color:var(--red);">${d.alfa}</div></div>
        <div class="div-bar-row"><div class="div-bar-key">Izin</div><div class="div-bar-track"><div class="div-bar-fill izin" style="width:${Math.min(pctIzin*3,100)}%"></div></div><div class="div-bar-val" style="color:var(--amber);">${d.izin}</div></div>
        <div class="div-bar-row"><div class="div-bar-key">Sakit</div><div class="div-bar-track"><div class="div-bar-fill sakit" style="width:${Math.min(pctSakit*3,100)}%"></div></div><div class="div-bar-val" style="color:var(--accent);">${d.sakit}</div></div>
      </div>
    </div>`;
  }).join('<hr style="border:none;border-top:1px solid var(--border);margin:10px 0;">');

  el.innerHTML = `<div class="div-chart-wrap">${html}</div>`;
}

function renderCostOfAbsenteeism(calcs, totalAlfa) {
  const el = document.getElementById('chart-coa');
  if (!el) return;

  const biayaAlfa  = totalAlfa * cfg.gajiHarian;
  let totalIzin = 0, totalSakit = 0;
  calcs.forEach(({ c }) => { totalIzin += c.izin; totalSakit += c.sakit; });
  const biayaIzin  = totalIzin  * cfg.gajiHarian;
  const biayaSakit = totalSakit * cfg.gajiHarian;
  const totalBiaya = biayaAlfa + biayaIzin + biayaSakit;

  const elKpi = document.getElementById('an-coa-kpi');
  if (elKpi) elKpi.textContent = fmtRpAnalitik(biayaAlfa);

  const fmtRpFull = v => 'Rp ' + Math.round(v).toLocaleString('id-ID');

  const topAlfa = [...calcs].filter(({ c }) => c.alfa > 0).sort((a, b) => b.c.alfa - a.c.alfa).slice(0, 5);

  const topHtml = topAlfa.length
    ? `<div style="margin-top:14px;">
        <div style="font-size:10.5px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.4px;margin-bottom:8px;">Top 5 Karyawan — Alfa Terbanyak</div>
        ${topAlfa.map(({ emp, c }) => {
          const biaya = c.alfa * cfg.gajiHarian;
          const pct   = totalAlfa > 0 ? (c.alfa / totalAlfa * 100) : 0;
          return `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border);">
            <div style="flex:1;min-width:0;"><div style="font-size:11.5px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${emp.nama}</div><div style="font-size:10px;color:var(--text3);">${emp.div}</div></div>
            <div style="text-align:right;"><div style="font-size:11.5px;font-weight:700;color:var(--red);">${c.alfa} hari</div><div style="font-size:10px;color:var(--text3);">${fmtRpFull(biaya)}</div></div>
          </div>`;
        }).join('')}
      </div>` : '';

  el.innerHTML = `
    <div class="coa-highlight">
      <div class="coa-icon">⚠️</div>
      <div>
        <div class="coa-label">Total Estimasi Kerugian (Alfa)</div>
        <div class="coa-value">${fmtRpFull(biayaAlfa)}</div>
        <div class="coa-sub">${totalAlfa} hari alfa × Rp ${cfg.gajiHarian.toLocaleString('id-ID')}/hari</div>
      </div>
    </div>
    <div class="coa-breakdown">
      <div class="coa-item"><div class="ci-val" style="color:var(--red);">${fmtRpAnalitik(biayaAlfa)}</div><div class="ci-lbl">Kerugian Alfa</div></div>
      <div class="coa-item"><div class="ci-val" style="color:var(--amber);">${fmtRpAnalitik(biayaIzin)}</div><div class="ci-lbl">Nilai Izin</div></div>
      <div class="coa-item"><div class="ci-val" style="color:var(--accent);">${fmtRpAnalitik(biayaSakit)}</div><div class="ci-lbl">Nilai Sakit</div></div>
    </div>
    <div style="margin-top:10px;padding:8px 12px;background:var(--surface2);border-radius:var(--r);font-size:11px;color:var(--text2);">
      <strong>Total semua ketidakhadiran:</strong> ${fmtRpFull(totalBiaya)}
      <span style="font-size:10px;color:var(--text3);display:block;margin-top:2px;">* Estimasi berdasarkan Gaji Pokok Harian = Rp ${cfg.gajiHarian.toLocaleString('id-ID')}.</span>
    </div>
    ${topHtml}`;
}

function renderRetensi(calcs) {
  const el = document.getElementById('chart-retensi');
  if (!el) return;

  const aktif  = employees.filter(e => !e.statusKaryawan || e.statusKaryawan === 'aktif');
  const resign = employees.filter(e => e.statusKaryawan === 'resign');
  const total  = employees.length;
  const turnoverRate = (resign.length / Math.max(total, 1) * 100);

  const elTO = document.getElementById('an-turnover');
  if (elTO) elTO.textContent = turnoverRate.toFixed(1) + '%';

  const masaKerjaList = aktif.map(emp => hitungTenure(emp.tgl, null)).filter(mk => mk && mk.totalBulan >= 0);
  let rataRataBulan = masaKerjaList.length > 0
    ? masaKerjaList.reduce((s, mk) => s + mk.totalBulan, 0) / masaKerjaList.length : 0;
  const avgTahun = Math.floor(rataRataBulan / 12);
  const avgBulan = Math.round(rataRataBulan % 12);
  const avgLabel = avgTahun > 0 ? `${avgTahun} thn ${avgBulan} bln` : `${avgBulan} bln`;

  const elTenure = document.getElementById('an-tenure-avg');
  if (elTenure) elTenure.textContent = avgLabel || '—';

  const sortedTenure = [...aktif]
    .map(emp => ({ emp, mk: hitungTenure(emp.tgl, null) }))
    .filter(x => x.mk)
    .sort((a, b) => b.mk.totalBulan - a.mk.totalBulan)
    .slice(0, 8);

  const rankColors = ['#f59e0b','#94a3b8','#cd7c59'];
  const topTenureHtml = sortedTenure.map(({ emp, mk }, i) =>
    `<div class="tenure-item">
      <div class="tenure-rank ${i < 3 ? 'rank-'+(i+1) : ''}" style="${i>=3?'background:var(--accent-light);color:var(--accent);':''}">${i+1}</div>
      <div style="flex:1;min-width:0;">
        <div class="tenure-name">${emp.nama}</div>
        <div class="tenure-div">${emp.div} · Masuk: ${emp.tgl || '—'}</div>
      </div>
      <div class="tenure-dur" style="color:${i < 3 ? rankColors[i] : 'var(--accent)'};">${mk.label}</div>
    </div>`
  ).join('');

  el.innerHTML = `
    <div class="retensi-grid">
      <div class="retensi-card">
        <div class="rc-val" style="color:${turnoverRate > 20 ? 'var(--red)' : turnoverRate > 10 ? 'var(--amber)' : 'var(--green)'};">${turnoverRate.toFixed(1)}%</div>
        <div class="rc-lbl">Tingkat Pergantian Karyawan</div>
        <div class="rc-sub">${resign.length} resign dari ${total} total karyawan</div>
      </div>
      <div class="retensi-card">
        <div class="rc-val">${avgLabel || '—'}</div>
        <div class="rc-lbl">Rata-rata Masa Kerja</div>
        <div class="rc-sub">${aktif.length} karyawan aktif</div>
      </div>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;">
      <div style="flex:1;background:var(--green-light);border:1px solid #b7e0c7;border-radius:var(--r);padding:8px 12px;text-align:center;"><div style="font-size:20px;font-weight:800;color:var(--green);">${aktif.length}</div><div style="font-size:10px;color:var(--green);font-weight:600;text-transform:uppercase;letter-spacing:.4px;">Karyawan Aktif</div></div>
      <div style="flex:1;background:var(--red-light);border:1px solid #f5b4b0;border-radius:var(--r);padding:8px 12px;text-align:center;"><div style="font-size:20px;font-weight:800;color:var(--red);">${resign.length}</div><div style="font-size:10px;color:var(--red);font-weight:600;text-transform:uppercase;letter-spacing:.4px;">Sudah Resign</div></div>
    </div>
    ${sortedTenure.length
      ? `<div style="font-size:10.5px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:.4px;margin-bottom:8px;">Masa Kerja Terlama</div><div class="tenure-list">${topTenureHtml}</div>`
      : `<div style="color:var(--text3);text-align:center;padding:16px;font-size:12px;">Belum ada data tanggal masuk untuk menghitung masa kerja.</div>`
    }`;
}

// Heatmap Absensi Harian telah dihapus sesuai permintaan user

// ─── RIWAYAT KARYAWAN RESIGN / PENSIUN ─────────────────────────────
function renderResignHistory() {
  const container = document.getElementById('chart-resign');
  const subEl = document.getElementById('resign-sub');
  if (!container) return;

  const resignList = employees
    .filter(e => e.statusKaryawan === 'resign' || e.statusKaryawan === 'nonaktif')
    .sort((a, b) => (b.tglKeluar || '').localeCompare(a.tglKeluar || ''));

  if (resignList.length === 0) {
    container.innerHTML = `<div style="padding:24px;text-align:center;color:var(--text3);font-size:12px;">Belum ada karyawan yang resign.</div>`;
    if (subEl) subEl.textContent = '0 orang';
    return;
  }

  // Simple problematic reason detector (Indonesian keywords)
  function isBermasalah(alasan = '') {
    const lower = alasan.toLowerCase();
    const keywords = ['gaji', 'bos', 'manajemen', 'toxic', 'tidak adil', 'diskriminasi', 'kekerasan', 'pelecehan', 'tidak dihargai', 'karir', 'jenjang', 'pindah', 'keluarga', 'sakit', 'pensiun'];
    return keywords.some(k => lower.includes(k));
  }

  const tableHtml = `
    <div style="margin-top:4px;">
      <div style="max-height:260px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--r);">
        <table class="resign-table" style="width:100% !important; min-width:0 !important; font-size:9px !important; border-collapse:collapse !important; table-layout:fixed !important; box-sizing:border-box !important;">
          <thead>
            <tr style="background:#f8fafc;">
              <th style="padding:4px 5px;text-align:left;border-bottom:1px solid var(--border);width:25%;">Nama</th>
              <th style="padding:4px 5px;text-align:center;border-bottom:1px solid var(--border);width:10%;">Divisi</th>
              <th style="padding:4px 5px;text-align:center;border-bottom:1px solid var(--border);width:15%;">Masa Kerja</th>
              <th style="padding:4px 5px;text-align:center;border-bottom:1px solid var(--border);width:15%;">Tgl Resign</th>
              <th style="padding:4px 5px;text-align:left;border-bottom:1px solid var(--border);width:25%;">Alasan</th>
              <th style="padding:4px 5px;text-align:center;border-bottom:1px solid var(--border);width:10%;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${resignList.map(emp => {
              const mk = hitungTenure(emp.tgl, emp.tglKeluar);
              const bermasalah = isBermasalah(emp.alasanResign);
              const statusColor = bermasalah ? 'var(--red)' : 'var(--amber)';
              const statusText = bermasalah ? '⚠️ Bermasalah' : 'Normal';
              return `
                <tr style="border-bottom:1px solid #f1f5f9;cursor:pointer;" onclick="showDetail(${employees.indexOf(emp)})">
                  <td style="padding:4px 5px;font-weight:600;white-space:normal;word-break:break-all;">${emp.nama}</td>
                  <td style="padding:4px 5px;text-align:center;"><span class="badge b-div ${divClass(emp.div)}" style="font-size:8px;padding:0 3px;">${emp.div}</span></td>
                  <td style="padding:4px 5px;text-align:center;color:var(--text2);font-size:8.5px;">${mk ? mk.label : '—'}</td>
                  <td style="padding:4px 5px;text-align:center;color:#64748b;font-size:8.5px;">${emp.tglKeluar ? new Date(emp.tglKeluar).toLocaleDateString('id-ID',{day:'2-digit',month:'short'}) : '—'}</td>
                  <td style="padding:4px 5px;white-space:normal;word-break:break-word;font-size:8.5px;color:${bermasalah ? 'var(--red)' : 'var(--text2)'};line-height:1.3;">${emp.alasanResign || '<i>—</i>'}</td>
                  <td style="padding:4px 5px;text-align:center;"><span style="font-size:8px;font-weight:700;color:${statusColor};">${statusText}</span></td>
                </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
      <div style="font-size:8.5px;color:var(--text3);margin-top:6px;text-align:right;opacity:0.85;">
        * Kata kunci sensitif ditandai <span style="color:var(--red);font-weight:700;">Bermasalah</span>
      </div>
    </div>`;

  container.innerHTML = tableHtml;
  if (subEl) subEl.textContent = `${resignList.length} orang • Klik nama untuk detail`;
}
