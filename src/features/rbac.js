// ════════════════════════════════════════════════════════════════
// rbac.js — Login, Logout & RBAC (Role-Based Access Control)
// ════════════════════════════════════════════════════════════════

import { employees, rbac, assignRbac, cutiData } from '../core/state.js';
import { LS_KEY_RBAC, ROLE_DESC } from '../core/config.js';
import { tampilkanToast } from '../core/utils.js';
import { calcEmployee } from '../core/calc.js';
import { getSaldoCuti } from './cuti.js';
import { buildSlipHTML } from '../ui/payroll.js';
import { getYTD } from '../ui/payroll.js';
import { sesuaikanNotifUntukRBAC, jalankanDeteksiNotifikasi } from './notifikasi.js';

export function onLoginRoleChange() {
  const role        = document.getElementById('login-role').value;
  const extraField  = document.getElementById('login-extra-field');
  const roleDesc    = document.getElementById('login-role-desc');
  const btnMasuk    = document.getElementById('btn-masuk');

  extraField.innerHTML  = '';
  extraField.style.display = 'none';
  roleDesc.style.display   = 'none';
  btnMasuk.disabled = true;
  if (!role) return;

  roleDesc.innerHTML     = ROLE_DESC[role] || '';
  roleDesc.style.display = 'block';

  if (role === 'admin') {
    extraField.innerHTML = `<div class="login-field"><label>Nama (opsional)</label><input type="text" id="login-nama" placeholder="cth: Budi Santoso" oninput="window.cekFormLogin()" value="HR Admin"></div>`;
    extraField.style.display = 'block';
    btnMasuk.disabled = false;
  } else if (role === 'supervisor') {
    extraField.innerHTML = `
      <div class="login-field"><label>Nama Supervisor <span style="color:var(--red)">*</span></label><input type="text" id="login-nama" placeholder="cth: Rina Kusumawati" oninput="window.cekFormLogin()"></div>
      <div class="login-field"><label>Divisi yang Dikelola <span style="color:var(--red)">*</span></label>
        <select id="login-divisi" onchange="window.cekFormLogin()">
          <option value="">— Pilih Divisi —</option>
          <option value="WS">WS</option>
          <option value="S. TEMPEL">S. Tempel</option>
          <option value="S. JARUM 2">S. Jarum 2</option>
          <option value="S. JARUM 1,2">S. Jarum 1,2</option>
          <option value="__semua__">Semua Divisi (Line Leader)</option>
        </select>
      </div>`;
    extraField.style.display = 'block';
  } else if (role === 'karyawan') {
    extraField.innerHTML = `<div class="login-field"><label>NIK <span style="color:var(--red)">*</span></label><input type="text" id="login-nik" placeholder="Masukkan NIK karyawan" oninput="window.cekFormLogin()"></div>`;
    extraField.style.display = 'block';
  }
}

export function cekFormLogin() {
  const role     = document.getElementById('login-role').value;
  const btnMasuk = document.getElementById('btn-masuk');
  if (role === 'admin') {
    btnMasuk.disabled = false;
  } else if (role === 'supervisor') {
    const nama   = (document.getElementById('login-nama')?.value || '').trim();
    const divisi = document.getElementById('login-divisi')?.value || '';
    btnMasuk.disabled = !(nama && divisi);
  } else if (role === 'karyawan') {
    const nik = (document.getElementById('login-nik')?.value || '').trim();
    btnMasuk.disabled = !nik;
  } else {
    btnMasuk.disabled = true;
  }
}

export function prosesLogin() {
  const role = document.getElementById('login-role').value;
  if (!role) return;

  assignRbac({ role });

  if (role === 'admin') {
    assignRbac({ nama: (document.getElementById('login-nama')?.value || '').trim() || 'HR Admin', divisi: '', nik: '' });
  } else if (role === 'supervisor') {
    assignRbac({
      nama:   (document.getElementById('login-nama')?.value || '').trim(),
      divisi: document.getElementById('login-divisi')?.value || '',
      nik:    '',
    });
  } else if (role === 'karyawan') {
    const nik = (document.getElementById('login-nik')?.value || '').trim();
    const emp = employees.find(e => e.nik === nik);
    if (!emp) {
      _tampilkanPesanLoginError(`NIK "${nik}" tidak ditemukan dalam data karyawan.`);
      return;
    }
    assignRbac({ nik, empData: emp, nama: emp.nama, divisi: emp.div });
  }

  try {
    localStorage.setItem(LS_KEY_RBAC, JSON.stringify({
      role: rbac.role, nama: rbac.nama, divisi: rbac.divisi, nik: rbac.nik,
    }));
  } catch(e) {}

  document.getElementById('rbac-login-screen').style.display = 'none';
  terapkanRBAC();
  sesuaikanNotifUntukRBAC(rbac.role);
  jalankanDeteksiNotifikasi();
}

function _tampilkanPesanLoginError(pesan) {
  const lama = document.getElementById('login-error-msg');
  if (lama) lama.remove();
  const el = document.createElement('div');
  el.id = 'login-error-msg';
  el.style.cssText = 'background:#fdecea;border:1px solid #f5b4b0;border-radius:8px;padding:10px 14px;font-size:12px;color:#c0392b;margin-bottom:14px;';
  el.innerHTML = '⚠ ' + pesan;
  const btn = document.getElementById('btn-masuk');
  btn.parentNode.insertBefore(el, btn);
}

export function prosesLogout() {
  if (!confirm('Keluar dari sistem dan kembali ke layar login?')) return;
  // Hentikan listener real-time Firestore agar tidak ada koneksi menggantung
  window.stopRealtimeListener?.();
  try { localStorage.removeItem(LS_KEY_RBAC); } catch(e) {}

  assignRbac({ role: null, nama: '', divisi: '', nik: '', empData: null });

  if (window._renderTableOriginal) {
    window.renderTable = window._renderTableOriginal;
    window._renderTableOriginal = null;
  }

  document.getElementById('rbac-user-badge').style.display = 'none';
  document.getElementById('btn-logout').style.display = 'none';
  document.getElementById('login-role').value = '';
  document.getElementById('login-extra-field').innerHTML = '';
  document.getElementById('login-extra-field').style.display = 'none';
  document.getElementById('login-role-desc').style.display = 'none';
  document.getElementById('btn-masuk').disabled = true;
  const errMsg = document.getElementById('login-error-msg');
  if (errMsg) errMsg.remove();
  document.getElementById('rbac-login-screen').style.display = 'flex';
}

export function terapkanRBAC() {
  const role = rbac.role;
  document.body.classList.remove('role-admin','role-supervisor','role-karyawan');
  document.body.classList.add('role-' + role);

  const badge     = document.getElementById('rbac-user-badge');
  const avatarEl  = document.getElementById('rbac-avatar-icon');
  const namaEl    = document.getElementById('rbac-display-name');
  const roleLblEl = document.getElementById('rbac-role-label');
  const btnLogout = document.getElementById('btn-logout');

  const roleLabel = { admin:'HR Admin', supervisor:'Supervisor', karyawan:'Karyawan' };
  const avatarCls = { admin:'rbac-av-admin', supervisor:'rbac-av-spv', karyawan:'rbac-av-emp' };
  const inisial   = rbac.nama.split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase() || '?';

  avatarEl.textContent  = inisial;
  avatarEl.className    = 'rbac-avatar ' + (avatarCls[role] || '');
  namaEl.textContent    = rbac.nama;
  roleLblEl.textContent = roleLabel[role] || role;
  badge.style.display   = 'flex';
  btnLogout.style.display = '';

  if (role === 'admin')           terapkanAdmin();
  else if (role === 'supervisor') terapkanSupervisor();
  else if (role === 'karyawan')   terapkanKaryawan();
}

function terapkanAdmin() {
  ['hdr-btn-import','hdr-btn-export','hdr-btn-hapus','hdr-btn-tambah','hdr-btn-settings'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = '';
  });
  document.querySelectorAll('.tab').forEach(t => t.style.display = '');
}

function terapkanSupervisor() {
  ['hdr-btn-import','hdr-btn-export','hdr-btn-hapus','hdr-btn-settings'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('rbac-hidden');
  });
  document.querySelectorAll('.tab').forEach(tab => {
    const txt = tab.textContent.trim();
    if (txt.includes('Payroll') || txt.includes('Analitik')) tab.classList.add('rbac-hidden');
  });
  window.switchTab('absensi', document.querySelector('.tab:not(.rbac-hidden)'));

  if (rbac.divisi && rbac.divisi !== '__semua__') {
    const filterDiv = document.getElementById('filter-div');
    if (filterDiv) { filterDiv.value = rbac.divisi; filterDiv.disabled = true; }
    window.renderTable();
  }

  if (!window._renderTableOriginal) window._renderTableOriginal = window.renderTable;
  window.renderTable = function() {
    window._renderTableOriginal();
    if (rbac.role === 'supervisor' && rbac.divisi && rbac.divisi !== '__semua__') {
      const filterDiv = document.getElementById('filter-div');
      if (filterDiv && filterDiv.value !== rbac.divisi) filterDiv.value = rbac.divisi;
      document.querySelectorAll('#tbl-body tr').forEach(row => {
        const divCell = row.cells[5];
        if (divCell) row.style.display = divCell.textContent.trim() === rbac.divisi ? '' : 'none';
      });
    }
  };
  window.renderTable();

  document.querySelectorAll('.th-pay, .th-premi').forEach(th => th.classList.add('rbac-hidden'));
  const observer = new MutationObserver(() => {
    if (rbac.role !== 'supervisor') { observer.disconnect(); return; }
    document.querySelectorAll('#tbl-body tr').forEach(row => {
      Array.from(row.cells).forEach((cell, idx) => {
        if (idx >= 22 && idx <= 35) cell.classList.add('rbac-hidden');
      });
    });
  });
  observer.observe(document.getElementById('tbl-body'), { childList: true, subtree: true });
}

function terapkanKaryawan() {
  ['hdr-btn-import','hdr-btn-export','hdr-btn-hapus','hdr-btn-tambah','hdr-btn-settings'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('rbac-hidden');
  });
  document.querySelectorAll('.tab').forEach(tab => tab.classList.add('rbac-hidden'));
  document.querySelectorAll('.panel').forEach(p => p.classList.add('rbac-hidden'));
  _tampilkanViewKaryawan();
}

async function _tampilkanViewKaryawan() {
  const emp = rbac.empData;
  if (!emp) return;
  const c   = calcEmployee(emp);
  const thn = new Date().getFullYear();
  const ytd = getYTD(emp.nik, thn);
  const ini = emp.nama.split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase();
  const saldo = getSaldoCuti(emp.nik, thn);
  const appBody = document.querySelector('.app-body');
  let viewEl = document.getElementById('karyawan-self-service-view');
  if (!viewEl) {
    viewEl = document.createElement('div');
    viewEl.id = 'karyawan-self-service-view';
    viewEl.className = 'karyawan-view';
    appBody.appendChild(viewEl);
  }
  viewEl.innerHTML = `
    <div class="karyawan-header-card">
      <div class="karyawan-big-avatar">${ini}</div>
      <div>
        <div class="karyawan-info-nama">${emp.nama}</div>
        <div class="karyawan-info-sub">NIK: ${emp.nik} &nbsp;·&nbsp; ${emp.div}</div>
        <div class="karyawan-info-sub">Masuk: ${emp.tgl || '—'} &nbsp;·&nbsp; ${emp.jabatan || 'Operator'}</div>
      </div>
    </div>
    <div class="karyawan-section-card">
      <div class="karyawan-section-title">📅 Ringkasan Kehadiran Periode: ${emp.div}</div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;">
        <div style="text-align:center;background:var(--green-light);border-radius:var(--r);padding:10px;"><div style="font-size:22px;font-weight:800;color:var(--green);">${c.totalHadir}</div><div style="font-size:10px;">Hadir</div></div>
        <div style="text-align:center;background:var(--red-light);border-radius:var(--r);padding:10px;"><div style="font-size:22px;font-weight:800;color:var(--red);">${c.alfa}</div><div style="font-size:10px;">Alfa</div></div>
        <div style="text-align:center;background:var(--amber-light);border-radius:var(--r);padding:10px;"><div style="font-size:22px;font-weight:800;color:var(--amber);">${c.izin}</div><div style="font-size:10px;">Izin</div></div>
        <div style="text-align:center;background:var(--accent-light);border-radius:var(--r);padding:10px;"><div style="font-size:22px;font-weight:800;color:var(--accent);">${c.sakit}</div><div style="font-size:10px;">Sakit</div></div>
      </div>
    </div>
    <div class="karyawan-section-card">
      <div class="karyawan-section-title">🌿 Saldo Cuti Tahunan ${thn}</div>
      <div style="font-size:36px;font-weight:800;color:${saldo.tahunan?.sisa===0?'var(--red)':saldo.tahunan?.sisa<=3?'var(--amber)':'var(--green)'};">${saldo.tahunan?.sisa ?? saldo.sisa} hari sisa</div>
      <div style="font-size:11px;color:var(--text3);">dari ${saldo.tahunan?.kuota ?? saldo.total} hari · Terpakai: ${saldo.tahunan?.terpakai ?? saldo.terpakai} hari</div>
    </div>
    <div class="karyawan-section-card">
      <div class="karyawan-section-title">🖨 Slip Gaji</div>
      <button class="btn primary" style="width:100%;font-size:13px;padding:10px;" onclick="window.cetakSlipKaryawanSendiri()">🖨 Cetak Slip Gaji Periode Ini</button>
    </div>
  `;
}

export function cetakSlipKaryawanSendiri() {
  if (!rbac.empData) return;
  document.getElementById('slip-content').innerHTML = buildSlipHTML(rbac.empData);
  document.getElementById('modal-slip').classList.add('open');
}

export function cekSesiRBAC() {
  try {
    const saved = localStorage.getItem(LS_KEY_RBAC);
    if (!saved) return false;
    const sess = JSON.parse(saved);
    if (!sess || !sess.role) return false;
    assignRbac({ role: sess.role, nama: sess.nama || '', divisi: sess.divisi || '', nik: sess.nik || '' });
    if (rbac.role === 'karyawan') {
      const emp = employees.find(e => e.nik === rbac.nik) || null;
      if (!emp) { localStorage.removeItem(LS_KEY_RBAC); return false; }
      assignRbac({ empData: emp });
    }
    return true;
  } catch(e) { return false; }
}

// ════════════════════════════════════════════════════════════════
// EKSPOS KE WINDOW — Wajib ada agar atribut HTML seperti
// onchange="onLoginRoleChange()" dan onclick="prosesLogin()" dapat
// menemukan fungsi-fungsi ini di scope global.
// Tanpa pendaftaran ini, ES Module mengisolasi semua export dan
// membuatnya tidak terjangkau dari atribut event handler HTML.
// ════════════════════════════════════════════════════════════════
if (typeof window !== 'undefined') {
  window.onLoginRoleChange      = onLoginRoleChange;
  window.cekFormLogin           = cekFormLogin;
  window.prosesLogin            = prosesLogin;
  window.prosesLogout           = prosesLogout;
  window.terapkanRBAC           = terapkanRBAC;
  window.cekSesiRBAC            = cekSesiRBAC;
  window.cetakSlipKaryawanSendiri = cetakSlipKaryawanSendiri;
}
