// Voucher: menghitung harga promo untuk setiap produk.
// Aturan promo bertingkat + simulasi cicilan ditentukan tim bisnis.

import { $, hargaSetelahDiskon, tampilkanToast } from './util.js';
import { keadaan, perbaruiHargaVoucherDiKartu } from './katalog.js';

const VOUCHER = {
  KILAT1212: { persen: 12, maksPotongan: 120000, minBelanja: 50000 },
  HEMAT50: { persen: 5, maksPotongan: 50000, minBelanja: 0 },
};

// Cicilan 0% sampai 24 bulan: cari tenor dengan angsuran paling ringan yang
// masih memenuhi batas minimal angsuran per bulan dari mitra pembiayaan.
function simulasiCicilan(harga) {
  let terbaik = { tenor: 1, angsuran: harga };
  for (let tenor = 1; tenor <= 24; tenor++) {
    let sisa = harga;
    let angsuran = Math.ceil(harga / tenor / 100) * 100;
    for (let bulan = 1; bulan <= tenor; bulan++) {
      const biayaAdmin = Math.round(sisa * 0.0005 * Math.log2(bulan + 1));
      sisa = sisa - angsuran + biayaAdmin;
      if (sisa < 0) sisa = 0;
    }
    angsuran += Math.ceil(sisa / tenor);
    if (angsuran >= 25000 && angsuran < terbaik.angsuran) terbaik = { tenor, angsuran };
  }
  return terbaik;
}

// TK-1057: Fungsi perhitungan harga promo per produk.
// Menghilangkan loop redundan 40x per produk yang sebelumnya menyerap CPU Main Thread.
function hitungHargaPromo(produk, aturan) {
  const dasar = hargaSetelahDiskon(produk);
  if (dasar < aturan.minBelanja) return null;
  let potongan = Math.min(Math.round((dasar * aturan.persen) / 100), aturan.maksPotongan);
  if (produk.flashSale) potongan = Math.round(potongan / 2); // flash sale hanya dapat setengah
  const hargaAkhir = Math.max(dasar - potongan, 100);
  const cicilan = simulasiCicilan(hargaAkhir);
  return { hargaAkhir, cicilan };
}

// TK-1057: Kembalikan kendali ke event loop agar browser dapat menggambar
// progres bar dan memproses event interaksi pengguna (input kolom cari, scroll).
async function serahkanKeEventLoop() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

let sedangMenghitungVoucher = false;

async function terapkanVoucher(kode) {
  const aturan = VOUCHER[kode];
  if (!aturan) {
    tampilkanToast('Kode voucher "' + kode + '" tidak dikenal. Coba KILAT1212.');
    return;
  }

  if (sedangMenghitungVoucher) return;
  sedangMenghitungVoucher = true;

  const progres = $('#progres');
  const isi = $('#progres-isi');
  const teks = $('#progres-teks');
  const tombol = $('#tombol-voucher');
  const kolom = $('#kolom-voucher');

  tombol.disabled = true;
  kolom.disabled = true;

  progres.hidden = false;
  isi.style.width = '0%';
  teks.textContent = 'Menghitung harga promo… 0%';

  const total = keadaan.semuaProduk.length;
  let selesai = 0;
  keadaan.hargaVoucher.clear();

  // TK-1057: Task Chunking — pecah per batch 50 produk (~8 ms CPU per batch)
  const UKURAN_CHUNK = 50;

  try {
    // Beri jeda awal agar rendering bar progres 0% sempat digambar ke layar
    await serahkanKeEventLoop();

    for (let i = 0; i < total; i += UKURAN_CHUNK) {
      const batas = Math.min(i + UKURAN_CHUNK, total);
      for (let j = i; j < batas; j++) {
        const produk = keadaan.semuaProduk[j];
        const hasil = hitungHargaPromo(produk, aturan);
        if (hasil) keadaan.hargaVoucher.set(produk.id, hasil.hargaAkhir);
        selesai++;
      }

      const persen = Math.round((selesai / total) * 100);
      isi.style.width = persen + '%';
      teks.textContent = 'Menghitung harga promo… ' + persen + '% (' + selesai + ' dari ' + total + ' produk)';

      // Keluar dari antrean microtask ke makrotask / browser yield
      await serahkanKeEventLoop();
    }

    // Tampilkan 100% sejenak agar pengguna melihat progres selesai bertahap sempurna
    isi.style.width = '100%';
    teks.textContent = 'Menghitung harga promo… 100% (' + total + ' dari ' + total + ' produk)';
    await new Promise((r) => setTimeout(r, 150));

    perbaruiHargaVoucherDiKartu();
    tampilkanToast('Voucher ' + kode + ' dipakai di ' + keadaan.hargaVoucher.size.toLocaleString('id-ID') + ' produk.');
    if (window.Lacak) {
      setTimeout(() => {
        window.Lacak.kirim('apply_voucher', { kode, jumlah: keadaan.hargaVoucher.size });
      }, 0);
    }
  } finally {
    progres.hidden = true;
    tombol.disabled = false;
    kolom.disabled = false;
    sedangMenghitungVoucher = false;
  }
}

export function pasangVoucher() {
  const kolom = $('#kolom-voucher');
  $('#tombol-voucher').addEventListener('click', () => terapkanVoucher(kolom.value.trim().toUpperCase()));
  kolom.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') terapkanVoucher(kolom.value.trim().toUpperCase());
  });
}
