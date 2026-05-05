// ════════════════════════════════════════════════════════════════
// firebase.js — Inisialisasi koneksi Firebase
// Lokasi file: src/core/firebase.js
//
// CATATAN: Menggunakan import CDN (esm.sh) agar kompatibel dengan
// GitHub Pages dan browser tanpa bundler (Vite/Webpack).
// ════════════════════════════════════════════════════════════════

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getFirestore, enableIndexedDbPersistence } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const firebaseConfig = {
  apiKey:            "AIzaSyBXJgWCDE2mfvRbKlHUzI5BtRw8lQlphMg",
  authDomain:        "aptrh-9a780.firebaseapp.com",
  projectId:         "aptrh-9a780",
  storageBucket:     "aptrh-9a780.firebasestorage.app",
  messagingSenderId: "1062245382933",
  appId:             "1:1062245382933:web:658b466668fbc1b6b6471c",
};

// Inisialisasi Firebase App & Firestore
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// Aktifkan cache offline (IndexedDB) — app tetap bisa dibaca saat internet putus
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    console.warn('[firebase] Persistence nonaktif: lebih dari 1 tab browser terbuka.');
  } else if (err.code === 'unimplemented') {
    console.warn('[firebase] Browser tidak mendukung offline persistence.');
  }
});
