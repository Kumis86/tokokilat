// Pencarian, saringan kategori, dan pengurutan.

import { $, el, debounce, hargaSetelahDiskon } from './util.js';
import { keadaan, renderProduk } from './katalog.js';

const saringan = { kata: '', kategori: 'Semua', urut: 'relevan' };

// "Sepatu Lari" == "sepatu  lari" == "SEPATU-LARI"
function normalkan(teks) {
  return String(teks || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// TK-1041: Simpan cache teks pencarian yang sudah dinormalkan pada setiap objek produk
// agar tidak melakukan kalkulasi regex berulang pada ribuan produk di setiap input ketikan
function ambilTeksCari(produk) {
  if (!produk._teksCari) {
    produk._teksCari = normalkan(produk.nama + ' ' + produk.merek + ' ' + produk.kategori + ' ' + produk.kota);
  }
  return produk._teksCari;
}

function cocok(produk, tokens) {
  const teks = ambilTeksCari(produk);
  return tokens.every((token) => teks.includes(token));
}

const PEMBANDING = {
  murah: (a, b) => hargaSetelahDiskon(a) - hargaSetelahDiskon(b),
  mahal: (a, b) => hargaSetelahDiskon(b) - hargaSetelahDiskon(a),
  laris: (a, b) => b.terjual - a.terjual,
  rating: (a, b) => b.rating - a.rating || b.terjual - a.terjual,
};

const lacakPencarianDebounce = debounce((kata, jumlah) => {
  if (window.Lacak && kata) {
    window.Lacak.kirim('search', { kata, jumlah });
  }
}, 1500);

export function terapkanSaringan() {
  const kunci = normalkan(saringan.kata);
  const tokens = kunci ? kunci.split(' ').filter(Boolean) : [];
  let hasil = keadaan.semuaProduk.filter((p) => {
    if (saringan.kategori !== 'Semua' && p.kategori !== saringan.kategori) return false;
    if (tokens.length > 0 && !cocok(p, tokens)) return false;
    return true;
  });
  if (PEMBANDING[saringan.urut]) hasil = hasil.slice().sort(PEMBANDING[saringan.urut]);
  renderProduk(hasil);

  // Jadwalkan pelacakan analitik hanya setelah pengguna berhenti mengetik (1,5 detik)
  if (kunci) {
    lacakPencarianDebounce(saringan.kata, hasil.length);
  } else {
    lacakPencarianDebounce.batal();
  }
}

export function pasangPencarian() {
  const kolom = $('#kolom-cari');
  // Debounce (150 ms) agar pengetikan huruf demi huruf responsif dan tidak membebani Main Thread
  const terapkanSaringanDebounce = debounce(() => {
    terapkanSaringan();
  }, 150);

  kolom.addEventListener('input', () => {
    if (saringan.kata === kolom.value) return;
    lacakPencarianDebounce.batal();
    saringan.kata = kolom.value;
    terapkanSaringanDebounce();
  });

  kolom.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      terapkanSaringanDebounce.batal();
      lacakPencarianDebounce.batal();
      saringan.kata = kolom.value;
      terapkanSaringan();
      if (saringan.kata && window.Lacak) {
        window.Lacak.kirim('search', { kata: saringan.kata, jumlah: keadaan.ditampilkan.length });
      }
    }
  });

  $('#pilih-urut').addEventListener('change', (e) => {
    if (saringan.urut === e.target.value) return;
    terapkanSaringanDebounce.batal();
    saringan.urut = e.target.value;
    terapkanSaringan();
  });

  const wadah = $('#keping-kategori');
  const kategori = ['Semua', ...new Set(keadaan.semuaProduk.map((p) => p.kategori))];
  const fragmen = document.createDocumentFragment();
  for (const nama of kategori) {
    const keping = el('button', 'keping', nama);
    keping.type = 'button';
    keping.setAttribute('aria-pressed', String(nama === 'Semua'));
    keping.addEventListener('click', () => {
      if (saringan.kategori === nama) return;
      terapkanSaringanDebounce.batal();
      saringan.kategori = nama;
      wadah.querySelectorAll('.keping').forEach((k) => k.setAttribute('aria-pressed', String(k === keping)));
      terapkanSaringan();
    });
    fragmen.append(keping);
  }
  wadah.append(fragmen);
}
