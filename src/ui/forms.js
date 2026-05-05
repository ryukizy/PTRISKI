// ════════════════════════════════════════════════════════════════
// ui-forms.js — Modal Tambah/Edit Karyawan & Bulk Edit
// ════════════════════════════════════════════════════════════════

import { employees, setEmployees, DAYS, HOL_IDX, cfg, selectedIdx, modeEditAktif, rbac } from '../core/state.js';
import { hitungUsia, readRp, tampilkanToast } from '../core/utils.js';
import { saveToLS } from '../core/storage.js';
import { renderTable } from './tabel.js';
import { closeDetail } from './tabel.js';

export function buildAttInputs(vals) {
  const el = document.getElementById('att-inputs');
  el.innerHTML = '';
  DAYS.forEach((d, i) => {
    const isH = HOL_IDX.includes(i);
    const cur = vals ? vals[i] : 0;
    const div = document.createElement('div');
    div.className = 'att-day' + (isH ? ' hol' : '');
    div.innerHTML = `<div class="day-num">${d}${isH ? '☀' : ''}</div>
      <select id="att-${i}" ${isH ? 'disabled' : ''}>
        <option value="0"  ${cur === 0   ? 'selected' : ''}>—</option>
        <option value="√"  ${cur === '√' ? 'selected' : ''}>√ (Hadir)</option>
        <option value="1"  ${cur === 1   ? 'selected' : ''}>1 (Hadir + 1 jam OT)</option>
        <option value="2"  ${cur === 2   ? 'selected' : ''}>2 (Hadir + 2 jam OT)</option>
        <option value="3"  ${cur === 3   ? 'selected' : ''}>3 (Hadir + 3 jam OT)</option>
        <option value="4"  ${cur === 4   ? 'selected' : ''}>4 (Hadir + 4 jam OT)</option>
        <option value="A"  ${cur === 'A' ? 'selected' : ''}>A (Alfa)</option>
        <option value="I"  ${cur === 'I' ? 'selected' : ''}>I (Izin)</option>
        <option value="S"  ${cur === 'S' ? 'selected' : ''}>S (Sakit)</option>
        <option value="L"  ${cur === 'L' ? 'selected' : ''}>L (Libur)</option>
        <option value="C"  ${cur === 'C' ? 'selected' : ''}>C (Cuti Tahunan)</option>
      </select>`;
    el.appendChild(div);
  });
}

export function openModal(editIdx) {
  const ov = document.getElementById('modal-emp');
  ov.classList.add('open');

  const kes   = (cfg.rateBPJSKesehatan * 100).toFixed(0);
  const ktk   = (cfg.rateBPJSKetenagakerjaan * 100).toFixed(0);
  const total = (+kes + +ktk);
  const elKes   = document.getElementById('info-bpjs-kes');
  const elKtk   = document.getElementById('info-bpjs-ktk');
  const elTotal = document.getElementById('info-bpjs-total');
  if (elKes)   elKes.textContent  = kes + '%';
  if (elKtk)   elKtk.textContent  = ktk + '%';
  if (elTotal) elTotal.textContent = total + '%';

  if (editIdx !== undefined) {
    const emp = employees[editIdx];
    document.getElementById('modal-title').textContent = 'Edit Karyawan: ' + emp.nama;
    document.getElementById('f-nik').value           = emp.nik || '';
    document.getElementById('f-nama').value          = emp.nama || '';
    document.getElementById('f-ktp').value           = emp.ktp || '';
    document.getElementById('f-npwp').value          = emp.npwp || '';
    document.getElementById('f-tgl-lahir').value     = emp.tglLahir || '';
    document.getElementById('f-usia').value          = emp.usia || hitungUsia(emp.tglLahir);
    document.getElementById('f-status-nikah').value  = emp.statusNikah || '';
    document.getElementById('f-jml-anak').value      = emp.jmlAnak || 0;
    document.getElementById('f-alamat').value        = emp.alamat || '';
    document.getElementById('f-hp').value            = emp.hp || '';
    document.getElementById('f-email').value         = emp.email || '';
    document.getElementById('f-div').value           = emp.div || 'S. JARUM 2';
    document.getElementById('f-jabatan').value       = emp.jabatan || '';
    document.getElementById('f-kontrak').value       = emp.kontrak || '';
    document.getElementById('f-tgl-kontrak').value   = emp.tglKontrak || '';
    document.getElementById('f-tgl').value           = emp.tgl || '';
    document.getElementById('f-rek').value           = emp.rek || '';

    const stKaryawan = document.getElementById('f-status-karyawan');
    const tglKelEl   = document.getElementById('f-tgl-keluar');
    if (stKaryawan) { stKaryawan.value = emp.statusKaryawan || 'aktif'; toggleTglKeluar(); }
    if (tglKelEl)   tglKelEl.value = emp.tglKeluar || '';

    document.getElementById('f-bpjs-kes').value = emp.noBPJSKes || '';
    document.getElementById('f-bpjs-ktk').value = emp.noBPJSKtk || '';
    document.getElementById('f-ot').value        = emp.ot || 0;
    document.getElementById('f-pot').value       = emp.pot || 0;
    buildAttInputs(emp.days);
    ov.dataset.editIdx = editIdx;
  } else {
    document.getElementById('modal-title').textContent = 'Tambah Karyawan Baru';
    ['f-nik','f-nama','f-rek','f-tgl','f-ktp','f-npwp','f-tgl-lahir','f-usia',
     'f-alamat','f-hp','f-email','f-tgl-kontrak','f-bpjs-kes','f-bpjs-ktk'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    document.getElementById('f-div').value          = 'S. JARUM 2';
    document.getElementById('f-jabatan').value      = '';
    document.getElementById('f-kontrak').value      = '';
    document.getElementById('f-status-nikah').value = '';
    document.getElementById('f-jml-anak').value     = 0;
    document.getElementById('f-ot').value           = 0;
    document.getElementById('f-pot').value          = 0;

    const stKel = document.getElementById('f-status-karyawan');
    if (stKel) { stKel.value = 'aktif'; toggleTglKeluar(); }
    const tglKelReset = document.getElementById('f-tgl-keluar');
    if (tglKelReset) tglKelReset.value = '';
    buildAttInputs(null);
    delete ov.dataset.editIdx;
  }

  setTimeout(() => {
    const bonusEl    = document.getElementById('f-bonus');
    const bonusKetEl = document.getElementById('f-bonus-ket');
    const ei2 = document.getElementById('modal-emp').dataset.editIdx;
    if (ei2 !== undefined && employees[parseInt(ei2)]) {
      const e2 = employees[parseInt(ei2)];
      if (bonusEl)    { bonusEl.dataset.raw = String(e2.bonus || 0); bonusEl.value = (e2.bonus || 0).toLocaleString('id-ID'); }
      if (bonusKetEl) bonusKetEl.value = e2.bonusKet || '';
    } else {
      if (bonusEl)    { bonusEl.dataset.raw = '0'; bonusEl.value = '0'; }
      if (bonusKetEl) bonusKetEl.value = '';
    }
    if (rbac.role === 'supervisor') {
      document.querySelectorAll('.form-section-title').forEach(sec => {
        if (sec.textContent.includes('Bonus') || sec.textContent.includes('BPJS')) {
          sec.style.display = 'none';
          let el = sec.nextElementSibling;
          while (el && !el.classList.contains('form-section-title')) {
            el.style.display = 'none';
            el = el.nextElementSibling;
          }
        }
      });
    }
  }, 50);
}

export function closeModal() {
  document.getElementById('modal-emp').classList.remove('open');
}

export function saveEmployee() {
  const days = DAYS.map((_, i) => {
    const v = document.getElementById('att-' + i)?.value;
    if (!v || v === '0') return 0;
    if (['A','I','S','L','C','√'].includes(v)) return v;
    return parseInt(v);
  });

  const tglLahir = document.getElementById('f-tgl-lahir')?.value || '';
  const newEmp = {
    no:             employees.length + 1,
    nama:           document.getElementById('f-nama').value || 'Tanpa Nama',
    nik:            document.getElementById('f-nik').value,
    ktp:            document.getElementById('f-ktp')?.value || '',
    npwp:           document.getElementById('f-npwp')?.value || '',
    tglLahir,
    usia:           hitungUsia(tglLahir),
    statusNikah:    document.getElementById('f-status-nikah')?.value || '',
    jmlAnak:        parseInt(document.getElementById('f-jml-anak')?.value) || 0,
    alamat:         document.getElementById('f-alamat')?.value || '',
    hp:             document.getElementById('f-hp')?.value || '',
    email:          document.getElementById('f-email')?.value || '',
    div:            document.getElementById('f-div').value,
    jabatan:        document.getElementById('f-jabatan')?.value || '',
    kontrak:        document.getElementById('f-kontrak')?.value || '',
    tglKontrak:     document.getElementById('f-tgl-kontrak')?.value || '',
    tgl:            document.getElementById('f-tgl').value,
    rek:            document.getElementById('f-rek').value,
    statusKaryawan: document.getElementById('f-status-karyawan')?.value || 'aktif',
    tglKeluar:      document.getElementById('f-tgl-keluar')?.value || '',
    noBPJSKes:      document.getElementById('f-bpjs-kes')?.value || '',
    noBPJSKtk:      document.getElementById('f-bpjs-ktk')?.value || '',
    days,
    ot:             parseFloat(document.getElementById('f-ot').value) || 0,
    pot:            parseFloat(document.getElementById('f-pot').value) || 0,
    bonus:          0,
    bonusKet:       '',
  };

  const ov = document.getElementById('modal-emp');
  const ei = ov.dataset.editIdx;
  if (ei !== undefined) {
    newEmp.no = employees[parseInt(ei)].no;
    employees[parseInt(ei)] = newEmp;
  } else {
    employees.push(newEmp);
  }

  const bonusEl    = document.getElementById('f-bonus');
  const bonusKetEl = document.getElementById('f-bonus-ket');
  const targetEmp  = ei !== undefined ? employees[parseInt(ei)] : employees[employees.length - 1];
  if (targetEmp) {
    targetEmp.bonus    = readRp('f-bonus') || 0;
    targetEmp.bonusKet = bonusKetEl?.value || '';
  }

  saveToLS();
  closeModal();
  renderTable();
}

export function editSelectedEmployee() {
  if (selectedIdx !== null) {
    closeDetail();
    openModal(selectedIdx);
  }
}

export function toggleTglKeluar() {
  const sel   = document.getElementById('f-status-karyawan');
  const group = document.getElementById('group-tgl-keluar');
  if (!sel || !group) return;
  group.style.display = (sel.value === 'resign' || sel.value === 'nonaktif') ? '' : 'none';
}

export function updateUsia() {
  const tgl = document.getElementById('f-tgl-lahir')?.value;
  const el  = document.getElementById('f-usia');
  if (el) el.value = hitungUsia(tgl);
}

// ─── BULK EDIT ───
export function openBulkEditModal() {
  if (!modeEditAktif) {
    tampilkanToast('🔒 Aktifkan Mode Edit (🔓) terlebih dahulu untuk menggunakan Bulk Edit', 3000);
    return;
  }
  const sel = document.getElementById('bulk-tgl-select');
  if (sel) {
    sel.innerHTML = DAYS.map((tgl, i) => {
      const isHol = HOL_IDX.includes(i);
      return `<option value="${i}">${tgl}${isHol ? ' (Minggu/Libur)' : ''}</option>`;
    }).join('');
  }
  document.getElementById('bulk-keterangan').value = '';
  document.getElementById('bulk-preview-info').style.display = 'none';
  document.getElementById('modal-bulk-edit').classList.add('open');
}

export function closeBulkEditModal() {
  document.getElementById('modal-bulk-edit').classList.remove('open');
}

export function terapkanBulkEdit() {
  const dayIdx = parseInt(document.getElementById('bulk-tgl-select').value);
  const status = document.getElementById('bulk-status-select').value;
  const ket    = document.getElementById('bulk-keterangan').value;

  let newVal;
  if (status === '0') newVal = 0;
  else if (['√','A','I','S','L','C'].includes(status)) newVal = status;
  else { const n = parseInt(status); newVal = isNaN(n) ? 0 : n; }

  const aktif = employees.filter(e => e.statusKaryawan !== 'resign');
  aktif.forEach(emp => {
    if (Array.isArray(emp.days) && dayIdx < emp.days.length) {
      emp.days[dayIdx] = newVal;
    }
  });

  const prevInfo = document.getElementById('bulk-preview-info');
  prevInfo.style.display = 'block';
  prevInfo.textContent = `✓ Status "${status === '0' ? '— (kosong)' : status}" berhasil diterapkan ke ${aktif.length} karyawan aktif pada tanggal ${DAYS[dayIdx]}.${ket ? ' Keterangan: ' + ket : ''}`;

  saveToLS();
  renderTable();
  closeBulkEditModal();
  tampilkanToast(`✓ Bulk Edit diterapkan ke ${aktif.length} karyawan`, 2500);
}

// ─── CATATAN HARI ───
let catatanHari = {};

export function openCatatanHari(tgl, event) {
  if (event) event.stopPropagation();
  document.getElementById('catatan-tgl-label').textContent = tgl;
  document.getElementById('catatan-hari-input').value = catatanHari[tgl] || '';
  document.getElementById('modal-catatan-hari').classList.add('open');
  document.getElementById('modal-catatan-hari').dataset.tgl = tgl;
}

export function closeCatatanHari() {
  document.getElementById('modal-catatan-hari').classList.remove('open');
}

export function simpanCatatanHari() {
  const tgl  = document.getElementById('modal-catatan-hari').dataset.tgl;
  const teks = document.getElementById('catatan-hari-input').value.trim();
  if (teks) catatanHari[tgl] = teks;
  else delete catatanHari[tgl];
  closeCatatanHari();
}

export function hapusCatatanHari() {
  const tgl = document.getElementById('modal-catatan-hari').dataset.tgl;
  delete catatanHari[tgl];
  closeCatatanHari();
}

// ════════════════════════════════════════════════════════════════
// switchTab — Pindah antar tab utama aplikasi
//
// PERBAIKAN BUG: Jalur import dinamis disesuaikan dengan lokasi
// file fisik yang sebenarnya:
//
//   SEBELUM (salah) → SESUDAH (benar)
//   './ui-payroll.js'          → './payroll.js'
//   './ui-analitik.js'         → './analitik.js'
//   './cuti.js' (dari src/ui/) → '../features/cuti.js'
//
// forms.js berada di src/ui/, sehingga:
//   - payroll.js  ada di src/ui/payroll.js   → import './payroll.js'
//   - analitik.js ada di src/ui/analitik.js  → import './analitik.js'
//   - cuti.js     ada di src/features/cuti.js → import '../features/cuti.js'
// ════════════════════════════════════════════════════════════════
export function switchTab(name, el) {
  if (typeof window.rbac !== 'undefined') {
    const role = window.rbac?.role;
    if (role === 'supervisor' && (name === 'payroll' || name === 'analitik')) {
      alert('Akses ke tab ini tidak diizinkan untuk peran Supervisor.');
      return;
    }
    if (role === 'karyawan') return;
  }

  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  if (el) el.classList.add('active');

  // ✅ Jalur sudah disesuaikan dengan nama & lokasi file fisik yang benar
  if (name === 'payroll')  import('./payroll.js').then(m => m.renderPayroll?.());
  if (name === 'analitik') import('./analitik.js').then(m => m.renderAnalitik?.());
  if (name === 'cuti')     import('../features/cuti.js').then(m => m.renderCuti?.());
}
