// ════════════════════════════════════════════════════════════════
// periode.js — Generasi periode dinamis (DAYS, HOL_IDX)
// ════════════════════════════════════════════════════════════════

import { cfg, setDAYS, setHOL_IDX, DAYS, HOL_IDX } from './state.js';

const NAMA_BULAN = ['Januari','Februari','Maret','April','Mei','Juni',
                    'Juli','Agustus','September','Oktober','November','Desember'];

export function generatePeriodDays(startDate = null, endDate = null) {
  if (startDate && endDate) {
    cfg.tglMulai   = startDate;
    cfg.tglSelesai = endDate;
  }

  const mulai   = new Date(cfg.tglMulai);
  const selesai = new Date(cfg.tglSelesai);

  if (isNaN(mulai) || isNaN(selesai) || selesai < mulai) {
    console.warn('[Periode] Rentang tanggal tidak valid — menggunakan default 1–30 April 2026.');
    setDAYS([11,12,13,14,15,16,17,18,19,20,21,22,23,24,25]);
    setHOL_IDX([1,8]);
    cfg.workdays = 13;
    return;
  }

  const newDays   = [];
  const newHolIdx = [];
  const cur = new Date(mulai);
  let workdays = 0;

  while (cur <= selesai) {
    const tgl  = cur.getDate();
    const hari = cur.getDay();
    const idx  = newDays.length;
    newDays.push(tgl);
    const isSunday = hari === 0;
    if (isSunday && !cfg.allowSundayWork) {
      newHolIdx.push(idx);
    } else {
      workdays++;
    }
    cur.setDate(cur.getDate() + 1);
  }

  setDAYS(newDays);
  setHOL_IDX(newHolIdx);
  cfg.workdays = workdays;

  const tglM  = mulai.getDate();
  const blnM  = NAMA_BULAN[mulai.getMonth()];
  const thnM  = mulai.getFullYear();
  const tglS  = selesai.getDate();
  const blnS  = NAMA_BULAN[selesai.getMonth()];
  const thnS  = selesai.getFullYear();

  if (blnM === blnS && thnM === thnS) {
    cfg.period = `${tglM} – ${tglS} ${blnS} ${thnS}`;
  } else if (thnM === thnS) {
    cfg.period = `${tglM} ${blnM} – ${tglS} ${blnS} ${thnS}`;
  } else {
    cfg.period = `${tglM} ${blnM} ${thnM} – ${tglS} ${blnS} ${thnS}`;
  }

  console.log(`[Periode] DAYS=${newDays.length} hari, workdays=${workdays}, label="${cfg.period}"`);
}
