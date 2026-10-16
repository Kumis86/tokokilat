// Katalog: menyimpan data produk dan menggambar kisi kartu produk.

import { $, el, formatRupiah, formatRibuan, hargaSetelahDiskon } from './util.js';
import { tambahKeKeranjang, beliSekarang } from './keranjang.js';
import { periksaGulir } from './gulir.js';

export const keadaan = {
  semuaProduk: [],
  ditampilkan: [],
  hargaVoucher: new Map(), // id produk -> harga setelah voucher
};

export async function muatProduk() {
  const respons = await fetch('/api/produk');
  keadaan.semuaProduk = await respons.json();
  for (const p of keadaan.semuaProduk) {
    p._teksCari = String(p.nama + ' ' + p.merek + ' ' + p.kategori + ' ' + p.kota)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }
  return keadaan.semuaProduk;
}

function buatKartu(produk) {
  const kartu = el('article', 'kartu');
  kartu.dataset.id = produk.id;

  if (produk.flashSale) kartu.append(el('span', 'lencana-kilat', '⚡ Kilat'));

  const media = el('a', 'kartu-media');
  media.href = '#produk-' + produk.id;
  const gambar = document.createElement('img');
  gambar.src = produk.gambar;
  gambar.alt = produk.nama;
  // TK-1081: lazy loading natif — browser hanya mengunduh gambar yang mendekati viewport.
  // Tanpa ini, semua 3.000–5.000 gambar di-request sekaligus (5.016 req, 4.6 MB, LCP > 45 dtk).
  gambar.loading = 'lazy';
  gambar.decoding = 'async';
  media.append(gambar);

  const badan = el('div', 'kartu-badan');
  badan.append(el('h3', 'kartu-judul', produk.nama));

  const harga = el('div', 'harga');
  harga.append(el('span', 'harga-kini', formatRupiah(hargaSetelahDiskon(produk))));
  if (produk.diskon > 0) {
    harga.append(el('span', 'harga-asli', formatRupiah(produk.harga)));
    harga.append(el('span', 'harga-diskon', '-' + produk.diskon + '%'));
  }
  const hargaVoucher = keadaan.hargaVoucher.get(produk.id);
  if (hargaVoucher) harga.append(el('span', 'harga-voucher', 'Pakai voucher: ' + formatRupiah(hargaVoucher)));
  badan.append(harga);

  badan.append(el('div', 'keterangan', '★ ' + String(produk.rating).replace('.', ',') + ' | ' + formatRibuan(produk.terjual) + ' terjual'));
  badan.append(el('div', 'keterangan', produk.kota));

  const aksi = el('div', 'aksi');
  const tombolTambah = el('button', 'tombol-tambah', '+ Keranjang');
  tombolTambah.type = 'button';
  tombolTambah.addEventListener('click', () => tambahKeKeranjang(produk, tombolTambah));
  const tombolBeli = el('button', 'tombol-beli', 'Beli sekarang');
  tombolBeli.type = 'button';
  tombolBeli.addEventListener('click', () => beliSekarang(produk, tombolBeli));
  aksi.append(tombolTambah, tombolBeli);
  badan.append(aksi);

  kartu.append(media, badan);
  return kartu;
}

// Judul produk panjangnya beda-beda (1-3 baris). Supaya harga & tombol dalam
// satu deret sejajar rapi, tinggi judul disamakan mengikuti judul tertinggi.
// Mengukur semua judul terlalu lambat, jadi cukup ukur sebagian sebagai contoh.
const JUMLAH_CONTOH = 24;

function samakanTinggiJudul() {
  // TK-1041: Ditiadakan. Tinggi kartu dan penyejajaran judul sudah ditangani oleh CSS
  // (min-height pada .kartu-judul dan flex layout pada .kartu-badan).
  // Membaca offsetHeight berulang kali di sini memicu Forced Synchronous Layout (Layout Thrashing)
  // yang memblokir Main Thread hingga ratusan milidetik.
}

let renderToken = 0;
let observerSentinel = null;
export let selesaikanRenderBatch = null;

export function dapatkanKartu(produk) {
  if (!produk._elemen) {
    produk._elemen = buatKartu(produk);
  }
  return produk._elemen;
}

export function renderProduk(daftar) {
  const token = ++renderToken;
  const kisi = $('#kisi');
  keadaan.ditampilkan = daftar;

  if (observerSentinel) {
    observerSentinel.disconnect();
    observerSentinel = null;
  }

  if (daftar.length === 0) {
    selesaikanRenderBatch = null;
    kisi.replaceChildren();
    const kosong = el('div', 'kosong');
    kosong.append(el('strong', '', 'Produk tidak ditemukan.'), el('p', '', 'Periksa ejaan, atau coba kata kunci yang lebih umum seperti "sepatu" atau "serum".'));
    kisi.append(kosong);
    $('#ringkasan').textContent = '0 produk ditampilkan';
    periksaGulir();
    return;
  }

  $('#ringkasan').textContent = daftar.length.toLocaleString('id-ID') + ' produk ditampilkan';

  // Render batch awal (36 kartu) agar interaksi render instan (< 10 ms) tanpa memblokir Main Thread
  const UKURAN_AWAL = 36;
  const UKURAN_BATCH = 24;
  const batasAwal = Math.min(UKURAN_AWAL, daftar.length);

  const fragmenAwal = document.createDocumentFragment();
  for (let i = 0; i < batasAwal; i++) {
    fragmenAwal.append(dapatkanKartu(daftar[i]));
  }

  if (daftar.length <= batasAwal) {
    kisi.replaceChildren(fragmenAwal);
    samakanTinggiJudul();
    periksaGulir();
    selesaikanRenderBatch = null;
    return;
  }

  let indeks = batasAwal;
  const sentinel = document.createElement('div');
  sentinel.id = 'kisi-sentinel';
  sentinel.style.cssText = 'grid-column: 1 / -1; height: 1px; visibility: hidden;';
  fragmenAwal.append(sentinel);

  kisi.replaceChildren(fragmenAwal);
  samakanTinggiJudul();
  periksaGulir();

  function renderBatchBerikutnya() {
    if (token !== renderToken || indeks >= daftar.length) return;
    const batas = Math.min(indeks + UKURAN_BATCH, daftar.length);
    const fragmen = document.createDocumentFragment();
    for (let i = indeks; i < batas; i++) {
      fragmen.append(dapatkanKartu(daftar[i]));
    }
    kisi.insertBefore(fragmen, sentinel);
    indeks = batas;

    if (indeks >= daftar.length) {
      if (observerSentinel) {
        observerSentinel.disconnect();
        observerSentinel = null;
      }
      sentinel.remove();
      selesaikanRenderBatch = null;
    }
  }

  selesaikanRenderBatch = renderBatchBerikutnya;

  // Muat batch berikutnya sesuai kebutuhan saat pengguna menggulir mendekati ujung bawah
  observerSentinel = new IntersectionObserver((entries) => {
    if (entries[0] && entries[0].isIntersecting) {
      renderBatchBerikutnya();
    }
  }, { rootMargin: '800px 0px 80px 0px' });

  observerSentinel.observe(sentinel);
}

export function perbaruiHargaVoucherDiKartu() {
  // TK-1057: Perbarui harga voucher pada elemen kartu secara langsung tanpa destroy/re-render ulang
  for (const produk of keadaan.semuaProduk) {
    if (!produk._elemen) continue;
    const hargaVoucher = keadaan.hargaVoucher.get(produk.id);
    let spanVoucher = produk._elemen.querySelector('.harga-voucher');
    if (hargaVoucher) {
      if (!spanVoucher) {
        spanVoucher = el('span', 'harga-voucher');
        produk._elemen.querySelector('.harga')?.append(spanVoucher);
      }
      spanVoucher.textContent = 'Pakai voucher: ' + formatRupiah(hargaVoucher);
    } else if (spanVoucher) {
      spanVoucher.remove();
    }
  }
}


