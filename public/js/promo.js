// Elemen kampanye: hitung mundur, teks berjalan, dan banner promo.

import { $, el, tampilkanToast } from './util.js';

// Flash sale berakhir tengah malam nanti (waktu perangkat).
function akhirFlashSale() {
  const t = new Date();
  t.setHours(24, 0, 0, 0);
  return t.getTime();
}

const duaDigit = (n) => String(n).padStart(2, '0');

function pasangHitungMundur() {
  const akhir = akhirFlashSale();
  const awal = Date.now();
  const garis = $('#hm-garis');
  const jam = $('#hm-jam'), menit = $('#hm-menit'), detik = $('#hm-detik'), senti = $('#hm-senti');

  // TK-1070: Turunkan interval dari 10ms (100Hz) ke 1000ms (1Hz) dan gunakan transform scaleX
  // alih-alih membaca offsetWidth yang memicu layout thrashing terus-menerus.
  function perbarui() {
    const sekarang = Date.now();
    const sisa = Math.max(akhir - sekarang, 0);
    if (jam) jam.textContent = duaDigit(Math.floor(sisa / 3600000));
    if (menit) menit.textContent = duaDigit(Math.floor((sisa % 3600000) / 60000));
    if (detik) detik.textContent = duaDigit(Math.floor((sisa % 60000) / 1000));
    if (senti) senti.textContent = '00';

    if (garis) {
      const rasio = Math.max(0, Math.min(1, sisa / (akhir - awal + 1)));
      garis.style.transform = `scaleX(${rasio})`;
    }
  }

  // Kelola lifecycle: matikan interval saat tab di latar belakang untuk menghemat daya
  let intervalId = null;
  function mulai() {
    if (intervalId) return;
    perbarui();
    intervalId = setInterval(perbarui, 1000);
  }
  function henti() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      henti();
    } else {
      mulai();
    }
  });

  mulai();
}

function pasangTeksBerjalan() {
  // TK-1070: Animasi teks berjalan dimigrasikan ke Compositor Thread via CSS @keyframes
  // di css/toko.css (transform: translateX). Ini mengeliminasi setInterval 10ms dan
  // manipulasi style.left yang sebelumnya memicu Forced Layout & Repaint 100x/detik di Main Thread.
}

async function pasangBannerPromo() {
  // TK-1078: wadah #banner-promo sudah ada di HTML sejak awal (min-height disiapkan di CSS)
  // sehingga tidak ada elemen baru yang disisipkan dan menggeser layout (CLS = 0).
  const wadahBanner = $('#banner-promo');

  const respons = await fetch('/api/promo');
  const promo = await respons.json();

  const banner = el('section', 'promo-banner');
  const teks = el('div');
  teks.append(el('h2', '', promo.judul), el('p', '', promo.isi));
  const tombol = el('button', '', promo.tombol);
  tombol.type = 'button';
  tombol.addEventListener('click', () => {
    tampilkanToast('Syarat promo: berlaku 12 Desember, satu voucher per akun, tidak bisa digabung.');
    if (window.Lacak) window.Lacak.kirim('promo_click', { judul: promo.judul });
  });
  banner.append(teks, tombol);

  // Ganti isi wadah (termasuk skeleton) dengan konten asli — tanpa menggeser elemen lain.
  wadahBanner.innerHTML = '';
  wadahBanner.append(banner);
}

export function pasangPromo() {
  pasangHitungMundur();
  pasangTeksBerjalan();
  pasangBannerPromo();
}
