// ════════════════════════════════════════════════════════════════
// ui-tabel.js — Render Tabel Absensi Utama
// ════════════════════════════════════════════════════════════════

import { employees, DAYS, HOL_IDX, cfg, sorotAktif, setSorotAktif, selectedIdx, setSelectedIdx, modeEditAktif } from '../core/state.js';
import { calcEmployee } from '../core/calc.js';
import { parseDay } from '../core/calc.js';
import { divClass, tampilkanToast, hitungUsia, fmtTgl } from '../core/utils.js';
import { saveToLS } from '../core/storage.js';
import { getSaldoCuti } from '../features/cuti.js';

export function renderTableHeader() {
  const table = document.getElementById('main-table');
  if (!table) return;
  const thead = table.querySelector('thead');
  if (!thead) return;

  const trGroup = thead.rows[0];
  const showDaily = cfg.columnVisibility.dailyAttendance !== false;

  if (trGroup) {
    // Update Absensi Periode header
    const thAbsensi = trGroup.cells[1];
    if (thAbsensi) {
      thAbsensi.colSpan = showDaily ? DAYS.length : 0;
      thAbsensi.style.display = showDaily ? '' : 'none';
      thAbsensi.textContent = `Absensi Periode ${cfg.period}`;
    }

    // Update other group headers colspans (approximate, adjust if needed)
    // Identitas Karyawan (cell 0) stays the same
    // Rekapitulasi Kehadiran (cell 2)
    if (trGroup.cells[2]) trGroup.cells[2].colSpan = 7;
    // Kalkulasi Tunjangan (cell 3)
    if (trGroup.cells[3]) trGroup.cells[3].colSpan = 6;
    // Absensi untuk Hitung Premi (cell 4)
    if (trGroup.cells[4]) trGroup.cells[4].colSpan = 7;
  }

  const trCol = thead.rows[1];
  if (!trCol) return;
  trCol.querySelectorAll('th.th-day').forEach(th => th.remove());

  const thSumPertama = trCol.querySelector('th.th-sum');
  // showDaily already declared above

  if (showDaily) {
    DAYS.forEach((tgl, i) => {
      const isHol = HOL_IDX.includes(i);
      const th    = document.createElement('th');
      th.className = 'th-day' + (isHol ? ' th-day-sun' : '');
      th.style.cssText = 'min-width:38px;max-width:44px;';
      th.innerHTML = `<span class="day-hdr-wrap" data-day="${tgl}">${tgl}<span class="day-note-btn" onclick="openCatatanHari(${tgl},event)" title="Catatan Hari Ini">📝</span></span>`;
      if (thSumPertama) trCol.insertBefore(th, thSumPertama);
      else trCol.appendChild(th);
    });
  }

  const elHdrPeriod = document.getElementById('hdr-period');
  if (elHdrPeriod) elHdrPeriod.textContent = 'Periode: ' + cfg.period;
}

export function renderTable() {
  const search = document.getElementById('search-emp').value.toLowerCase();
  const divF   = document.getElementById('filter-div').value;
  const statF  = document.getElementById('filter-status').value;

  const filtered = employees.filter(e => {
    if (e.statusKaryawan === 'resign') return false;
    const c = calcEmployee(e);
    if (search && !e.nama.toLowerCase().includes(search) && !e.nik.includes(search)) return false;
    if (divF && e.div !== divF) return false;
    if (statF==='alfa' && c.alfa===0) return false;
    if (statF==='premi' && !c.premiOk) return false;
    if (statF==='no-premi' && c.premiOk) return false;
    if (sorotAktif) {
      const lastValid = e.days.filter((_,i)=>!HOL_IDX.includes(i));
      const hasIssue = lastValid.some(v=>v==='A'||v==='I'||v==='S');
      if (!hasIssue) return false;
    }
    return true;
  });

  let tHadir=0, tAlfa=0, tPremi=0;
  const tbody = document.getElementById('tbl-body');
  tbody.innerHTML = '';

  filtered.forEach(emp => {
    const c = calcEmployee(emp);
    tHadir += c.totalHadir;
    if (c.alfa>0) tAlfa++;
    if (c.premiOk) tPremi++;

    const hasMasalah = c.alfa>0 || c.izin>0 || c.sakit>0;
    const tr = document.createElement('tr');
    if (hasMasalah) tr.className='row-masalah';

    const empIdx = employees.indexOf(emp);
    const cv = cfg.columnVisibility;
    tr.innerHTML = `
      <td class="muted">${emp.no}</td>
      <td class="left bold" style="cursor:pointer;color:var(--accent);" onclick="showDetail(${empIdx})">${emp.nama}</td>
      <td class="mono">${emp.nik}</td>
      <td class="mono${cv.rek ? '' : ' hide-col'}">${emp.rek||'<span class="dash">—</span>'}</td>
      <td class="muted${cv.tgl ? '' : ' hide-col'}">${emp.tgl}</td>
      <td class="${cv.div ? '' : 'hide-col'}"><span class="badge b-div ${divClass(emp.div)}">${emp.div}</span></td>
      ${emp.days.map((v,i)=>cellHTML(v,i,empIdx)).join('')}
      <td class="bold">${c.totalHari}</td>
      <td>${c.alfa?`<span class="badge b-alfa">${c.alfa}</span>`:'<span class="dash">—</span>'}</td>
      <td>${c.izin?`<span class="badge b-izin">${c.izin}</span>`:'<span class="dash">—</span>'}</td>
      <td>${c.sakit?`<span class="badge b-sakit">${c.sakit}</span>`:'<span class="dash">—</span>'}</td>
      <td>${c.cuti?`<span class="badge b-cuti">${c.cuti}</span>`:'<span class="dash">—</span>'}</td>
      <td>${c.libur?`<span class="muted">${c.libur}</span>`:'<span class="dash">—</span>'}</td>
      <td class="${cv.kalkulasi ? '' : 'hide-col'} ${c.totalTM>0?'danger bold':''}">${c.totalTM||'<span class="dash">—</span>'}</td>
      <td class="${cv.kalkulasi ? '' : 'hide-col'} success">${c.totalHadir}</td>
      <td class="${cv.kalkulasi ? '' : 'hide-col'}">${c.uTransport?'Rp '+c.uTransport.toLocaleString():'<span class="dash">—</span>'}</td>
      <td class="${cv.kalkulasi ? '' : 'hide-col'}">${c.uMakan?'Rp '+c.uMakan.toLocaleString():'<span class="dash">—</span>'}</td>
      <td class="${cv.kalkulasi ? '' : 'hide-col'}">${c.ot||'<span class="dash">—</span>'}</td>
      <td class="${cv.kalkulasi ? '' : 'hide-col'}">${c.pot?`<span class="muted">${c.pot}</span>`:'<span class="dash">—</span>'}</td>
      <td class="${cv.kalkulasi ? '' : 'hide-col'}">${c.bpjs?`Rp ${c.bpjs.toLocaleString()}`:'<span class="dash">—</span>'}</td>
      <td>${c.alfa?`<span class="badge b-alfa">${c.alfa}</span>`:'<span class="dash">—</span>'}</td>
      <td>${c.izin?`<span class="badge b-izin">${c.izin}</span>`:'<span class="dash">—</span>'}</td>
      <td>${c.sakit?`<span class="badge b-sakit">${c.sakit}</span>`:'<span class="dash">—</span>'}</td>
      <td>${c.cuti?`<span class="badge b-cuti">${c.cuti}</span>`:'<span class="dash">—</span>'}</td>
      <td>${c.libur?`<span class="muted">${c.libur}</span>`:'<span class="dash">—</span>'}</td>
      <td class="${c.totalTM>0?'danger':''}">${c.totalTM||'<span class="dash">—</span>'}</td>
      <td class="${c.premiOk?'success bold':''}">${c.totalHadir}</td>
    `;
    tbody.appendChild(tr);
  });

  document.getElementById('sc-total').textContent  = filtered.length;
  document.getElementById('sc-hadir').textContent  = filtered.length ? (tHadir/filtered.length).toFixed(1) : '—';
  document.getElementById('sc-alfa').textContent   = tAlfa;
  document.getElementById('sc-premi').textContent  = tPremi;
  const absent = filtered.filter(e => {
    const d = parseDay(e.days[14]);
    return d.type==='alfa'||d.type==='izin'||d.type==='sakit';
  }).length;
  document.getElementById('sc-absent').textContent = absent;

  // Update toggle button text
  const btnDaily = document.getElementById('btn-toggle-daily');
  if (btnDaily) {
    btnDaily.textContent = cfg.columnVisibility.dailyAttendance !== false 
      ? '📅 Sembunyikan 30 Hari' 
      : '📅 Tampilkan 30 Hari';
  }
}

export function perbaruiSummaryCards() {
  const search = document.getElementById('search-emp')?.value?.toLowerCase() || '';
  const divF   = document.getElementById('filter-div')?.value || '';
  const statF  = document.getElementById('filter-status')?.value || '';
  const filtered = employees.filter(e => {
    if (e.statusKaryawan === 'resign') return false;
    const c = calcEmployee(e);
    if (search && !e.nama.toLowerCase().includes(search) && !e.nik.includes(search)) return false;
    if (divF && e.div !== divF) return false;
    if (statF==='alfa' && c.alfa===0) return false;
    if (statF==='premi' && !c.premiOk) return false;
    if (statF==='no-premi' && c.premiOk) return false;
    return true;
  });
  let tHadir=0, tAlfa=0, tPremi=0;
  filtered.forEach(emp => {
    const c = calcEmployee(emp);
    tHadir += c.totalHadir;
    if (c.alfa>0) tAlfa++;
    if (c.premiOk) tPremi++;
  });
  document.getElementById('sc-total').textContent  = filtered.length;
  document.getElementById('sc-hadir').textContent  = filtered.length ? (tHadir/filtered.length).toFixed(1) : '—';
  document.getElementById('sc-alfa').textContent   = tAlfa;
  document.getElementById('sc-premi').textContent  = tPremi;
}

function cellHTML(v, dayIdx, empIdx) {
  const showDaily = cfg.columnVisibility.dailyAttendance !== false;
  if (!showDaily) return ''; // jangan render sel hari jika disembunyikan

  const isSundayCol = HOL_IDX.includes(dayIdx);
  const allowSundayEdit = cfg.allowSundayWork === true;

  // === Kasus 1: Kolom Minggu dan tidak boleh diedit ===
  if (isSundayCol && !allowSundayEdit) {
    return `<td class="cell-sun" style="text-align:center;">${v===0?'—':v}</td>`;
  }

  // === Kasus 2: Kolom Minggu dan boleh diedit ===
  if (isSundayCol && allowSundayEdit) {
    const d = parseDay(v);
    let display = v === 0 || v === '' || v === null || v === undefined ? '' : v;
    let cls = 'cell-sun'; // tetap beri tanda visual Minggu
    if (d.type === 'hadir') {
      if (d.ot > 0) { cls = 'cell-ot cell-sun'; display = v; }
      else { cls = 'cell-hadir cell-sun'; display = ''; }
    } else if (d.type === 'alfa')  cls = 'cell-alfa cell-sun';
    else if (d.type === 'izin')  cls = 'cell-izin cell-sun';
    else if (d.type === 'sakit') cls = 'cell-sakit cell-sun';
    else if (d.type === 'cuti')  cls = 'cell-cuti cell-sun';
    else if (d.type === 'libur') cls = 'cell-libur cell-sun';

    return `<td class="${cls}" onclick="inlineEditStart(this, ${empIdx}, ${dayIdx})" style="cursor:pointer;">${display}</td>`;
  }

  // === Kasus normal (bukan Minggu) ===
  const d = parseDay(v);
  let display = v === 0 || v === '' || v === null || v === undefined ? '' : v;
  let cls = '';

  if (d.type === 'hadir') {
    if (d.ot > 0) {
      cls = 'cell-ot';
      display = v;
    } else {
      cls = 'cell-hadir';
      display = '';
    }
  } else if (d.type === 'alfa')  cls = 'cell-alfa';
  else if (d.type === 'izin')  cls = 'cell-izin';
  else if (d.type === 'sakit') cls = 'cell-sakit';
  else if (d.type === 'libur') cls = 'cell-libur';
  else if (d.type === 'cuti')  cls = 'cell-cuti';

  return `
    <td class="cell-inline ${cls}">
      <input
        type="text"
        class="inline-input"
        value="${display}"
        data-emp="${empIdx}"
        data-day="${dayIdx}"
        onchange="inlineEditSave(this)"
        onkeydown="inlineEditKeydown(event, this)"
        onfocus="this.select()"
        autocomplete="off"
        spellcheck="false"
      />
    </td>
  `;
}

export function inlineEditSave(inputEl) {
  const empIdx = parseInt(inputEl.dataset.emp);
  const dayIdx = parseInt(inputEl.dataset.day);
  const rawVal = inputEl.value.trim().toUpperCase();

  if (!modeEditAktif) {
    tampilkanToast('🔒 Aktifkan Mode Edit (🔓) terlebih dahulu', 3000);
    const oldVal = employees[empIdx].days[dayIdx];
    inputEl.value = oldVal === 0 || oldVal === '' || oldVal === null ? '' : oldVal;
    return;
  }

  const emp = employees[empIdx];
  if (!emp) return;

  let newVal;
  
  // Kosong → 0 (hadir penuh tanpa lembur)
  if (rawVal === '' || rawVal === '0') {
    newVal = 0;
  }
  // Huruf status
  else if (['A', 'I', 'S', 'L', 'C'].includes(rawVal)) {
    newVal = rawVal;
  }
  // Angka → jam lembur (hadir + lembur)
  else if (!isNaN(rawVal) && parseFloat(rawVal) > 0) {
    newVal = parseFloat(rawVal);
  }
  // Default: hadir penuh
  else {
    newVal = 0;
  }

  emp.days[dayIdx] = newVal;

  // Simpan data terlebih dahulu, lalu render ulang seluruh tabel agar
  // semua kolom kalkulasi (Total Hadir, Total Gaji, Potongan, dll.)
  // langsung diperbarui secara real-time tanpa perlu reload halaman.
  saveToLS();
  renderTable();
}

/**
 * Pendeteksi tombol keyboard untuk elemen input inline edit.
 * Shortcut untuk akselerasi input absensi:
 *   - Huruf (A, I, S, L, C) → Status absen langsung tersimpan
 *   - Angka (1-9) → Jam lembur langsung tersimpan
 *   - Spasi → Hadir Normal (sel kosong) langsung tersimpan
 *
 * Alur eksekusi:
 *   1. event.preventDefault() — blokir sifat bawaan
 *   2. inputEl.value = [nilai] — set nilai baru
 *   3. inlineEditSave(inputEl) — simpan ke state, panggil saveToLS() + renderTable()
 *   4. inputEl.blur() — lepaskan fokus
 *
 * @param {KeyboardEvent} event   — Event keyboard dari onkeydown
 * @param {HTMLInputElement} inputEl — Elemen input yang sedang aktif
 */
export function inlineEditKeydown(event, inputEl) {
  const key = event.key.toUpperCase();
  
  // Cek apakah mode edit aktif
  if (!modeEditAktif) {
    if ([' ', 'A', 'I', 'S', 'L', 'C', '1', '2', '3', '4', '5', '6', '7', '8', '9'].includes(key) ||
        event.code === 'Space') {
      event.preventDefault();
      tampilkanToast('🔒 Aktifkan Mode Edit (🔓) terlebih dahulu', 3000);
    }
    return;
  }
  
  // Shortcut Spasi → Hadir Normal (kosong)
  if (event.key === ' ' || event.code === 'Space') {
    event.preventDefault();
    inputEl.value = '';
    inlineEditSave(inputEl);
    inputEl.blur();
    return;
  }
  
  // Shortcut Huruf → Status Absen (A, I, S, L, C)
  if (['A', 'I', 'S', 'L', 'C'].includes(key)) {
    event.preventDefault();
    inputEl.value = key;
    inlineEditSave(inputEl);
    inputEl.blur();
    return;
  }
  
  // Shortcut Angka → Jam Lembur (1-9)
  if (['1', '2', '3', '4', '5', '6', '7', '8', '9'].includes(key)) {
    event.preventDefault();
    inputEl.value = key;
    inlineEditSave(inputEl);
    inputEl.blur();
    return;
  }
}

export function toggleSorot() {
  setSorotAktif(!sorotAktif);
  const btn = document.getElementById('btn-sorot');
  btn.className = 'btn ' + (sorotAktif ? 'toggle-on' : 'toggle-off');
  btn.textContent = sorotAktif ? '🟡 Sorot Masalah: AKTIF' : '🔴 Sorot Masalah Hari Ini';
  renderTable();
}

export function showDetail(idx) {
  if (!modeEditAktif) {
    tampilkanToast('🔒 Aktifkan Mode Edit (🔓) terlebih dahulu untuk mengelola data', 3000);
    return;
  }
  setSelectedIdx(idx);
  const emp = employees[idx];
  const c   = calcEmployee(emp);
  const ini = emp.nama.split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase();

  document.getElementById('dp-avatar').textContent = ini;
  document.getElementById('dp-name').textContent   = emp.nama;
  const jabatanInfo = emp.jabatan ? ` · ${emp.jabatan}` : '';
  document.getElementById('dp-info').textContent   = `NIK: ${emp.nik}${jabatanInfo} · ${emp.div} · Masuk: ${emp.tgl}`;

  document.getElementById('dp-metrics').innerHTML = `
    <div class="dmet"><div class="dv">${c.totalHadir}</div><div class="dl">Total Hadir</div></div>
    <div class="dmet"><div class="dv" style="color:var(--red)">${c.alfa}</div><div class="dl">Alfa</div></div>
    <div class="dmet"><div class="dv" style="color:var(--amber)">${c.izin}</div><div class="dl">Izin</div></div>
    <div class="dmet"><div class="dv" style="color:var(--accent)">${c.sakit}</div><div class="dl">Sakit</div></div>
    ${c.cuti?`<div class="dmet"><div class="dv" style="color:#6d28d9">${c.cuti}</div><div class="dl">Cuti</div></div>`:''}
    ${(()=>{
      const s = getSaldoCuti(emp.nik);
      const warna = s.sisa === 0 ? 'var(--red)' : s.sisa <= 3 ? 'var(--amber)' : 'var(--green)';
      return `<div class="dmet" title="Kuota ${s.total} hari · Terpakai ${s.terpakai} hari · Pending ${s.pending} hari">
        <div class="dv" style="color:${warna}">${s.sisa}</div>
        <div class="dl">Saldo Cuti</div>
      </div>`;
    })()}
  `;

  let calHtml = DAYS.map(d=>`<div class="cal-cell hdr">${d}</div>`).join('');
  c.types.forEach((t,i) => {
    const v = emp.days[i];
    const display = v===0?'—':v;
    let cls='';
    if(t==='minggu') cls='libur';
    else if(t==='hadir'||t==='setengah') cls='hadir';
    else if(t==='alfa') cls='alfa';
    else if(t==='izin') cls='izin';
    else if(t==='sakit') cls='sakit';
    else if(t==='libur') cls='libur';
    else if(t==='cuti') cls='cuti';
    calHtml += `<div class="cal-cell ${cls}">${display}</div>`;
  });
  document.getElementById('dp-cal').innerHTML = calHtml;

  function fieldInfo(lbl, val, mono=false, full=false) {
    if (!val && val !== 0) return '';
    return `<div class="info-item${full?' full':''}"><span class="info-lbl">${lbl}</span><span class="info-val${mono?' mono':''}">${val}</span></div>`;
  }
  const statusKontrakBadge = emp.kontrak
    ? `<span class="badge-status ${emp.kontrak==='PKWTT'?'bs-pkwtt':'bs-pkwt'}">${emp.kontrak}</span>` : '—';
  const usiaDisplay = emp.tglLahir ? (hitungUsia(emp.tglLahir) || emp.usia || '—') : (emp.usia || '—');

  document.getElementById('dp-master-data').innerHTML = `
    <div class="info-section-title">👤 Identitas</div>
    <div class="info-grid">
      ${fieldInfo('No. KTP', emp.ktp, true)}${fieldInfo('NPWP', emp.npwp, true)}
      ${fieldInfo('Tanggal Lahir', emp.tglLahir ? new Date(emp.tglLahir).toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'}) : '')}
      ${fieldInfo('Usia', usiaDisplay)}${fieldInfo('Status Pernikahan', emp.statusNikah)}
      ${fieldInfo('Jumlah Anak', emp.jmlAnak > 0 ? emp.jmlAnak + ' orang' : (emp.jmlAnak === 0 ? 'Belum ada' : ''))}
      ${fieldInfo('Alamat', emp.alamat, false, true)}
    </div>
    <div class="info-section-title">📱 Kontak</div>
    <div class="info-grid">${fieldInfo('No. HP', emp.hp, true)}${fieldInfo('Email', emp.email)}</div>
    <div class="info-section-title">💼 Pekerjaan</div>
    <div class="info-grid">
      ${fieldInfo('Jabatan', emp.jabatan)}
      <div class="info-item"><span class="info-lbl">Status Kontrak</span><span class="info-val badge-val">${statusKontrakBadge}</span></div>
      ${emp.kontrak === 'PKWT' && emp.tglKontrak ? fieldInfo('Tgl. Berakhir Kontrak', new Date(emp.tglKontrak).toLocaleDateString('id-ID',{day:'2-digit',month:'long',year:'numeric'})) : ''}
      ${fieldInfo('No. Rekening', emp.rek, true)}
    </div>
    <div class="info-section-title">🏥 BPJS</div>
    <div class="info-grid">${fieldInfo('No. BPJS Kesehatan', emp.noBPJSKes, true)}${fieldInfo('No. BPJS Ketenagakerjaan', emp.noBPJSKtk, true)}</div>
  `;

  document.getElementById('dp-payroll').innerHTML = `
    <div class="p-row"><span>Gaji Pokok (${c.totalHadir} hr)</span><span class="p-plus">Rp ${c.gajiPokok.toLocaleString()}</span></div>
    <div class="p-row"><span>Uang Transport</span><span class="p-plus">Rp ${c.uTransport.toLocaleString()}</span></div>
    <div class="p-row"><span>Uang Makan</span><span class="p-plus">Rp ${c.uMakan.toLocaleString()}</span></div>
    <div class="p-row"><span>Lembur (${c.ot} jam)</span><span class="p-plus">Rp ${c.uLembur.toLocaleString()}</span></div>
    <div class="p-row"><span>Potongan (${c.pot} jam)</span><span class="p-minus">- Rp ${c.uPotongan.toLocaleString()}</span></div>
    <div class="p-row"><span>Potongan BPJS</span><span class="p-minus">- Rp ${c.bpjs.toLocaleString()}</span></div>
    <div class="p-row p-total"><span>Premi Hadir</span><span class="${c.premiOk?'p-plus':'muted'}">${c.premiOk?'✓ Rp '+c.premi.toLocaleString():'✗ Tidak'}</span></div>
    <div class="p-row p-total" style="border-top:2px solid var(--accent);margin-top:4px;"><span>Total Gaji</span><span style="color:var(--accent)">Rp ${c.totalGaji.toLocaleString()}</span></div>
  `;

  // Dynamic import to avoid circular deps
  import('../features/cuti.js').then(m => m.renderDetailCuti ? m.renderDetailCuti(emp.nik) : null);

  document.getElementById('detail-panel').classList.add('open');
  document.getElementById('detail-overlay').classList.add('open');
}

export function closeDetail() {
  document.getElementById('detail-panel').classList.remove('open');
  document.getElementById('detail-overlay').classList.remove('open');
  setSelectedIdx(null);
}

// ════════════════════════════════════════════════════════════════
// REGISTRASI GLOBAL — Fungsi yang dipanggil langsung dari atribut
// HTML (onchange, onkeydown, onclick) wajib terdaftar di window
// karena modul ES6 tidak otomatis masuk ke global scope.
// ════════════════════════════════════════════════════════════════

// Alias publik: inlineEditChange dapat digunakan sebagai pengganti
// inlineEditSave pada atribut onchange="inlineEditChange(this)" di HTML.
// Keduanya menunjuk fungsi yang sama agar tidak muncul ReferenceError
// apabila nama yang dipakai di HTML berbeda dari nama fungsi aslinya.
export function inlineEditChange(inputEl) {
  return inlineEditSave(inputEl);
}

window.inlineEditSave    = inlineEditSave;
window.inlineEditKeydown = inlineEditKeydown;
window.inlineEditChange  = inlineEditChange;
window.showDetail        = showDetail;

window.toggleDailyAttendance = function() {
  cfg.columnVisibility.dailyAttendance = !cfg.columnVisibility.dailyAttendance;
  saveToLS();
  renderTable();
  const btn = document.getElementById('btn-toggle-daily');
  if (btn) {
    btn.textContent = cfg.columnVisibility.dailyAttendance 
      ? '📅 Sembunyikan 30 Hari' 
      : '📅 Tampilkan 30 Hari';
  }
};
