// Perilaku saat halaman digulir: bayangan header, bar progres baca,
// tombol "Ke atas", efek kartu muncul, dan pencatatan impresi produk.
// TK-1063: Eliminasi layout thrashing & scroll jank dengan IntersectionObserver & rAF.

import { $ } from './util.js';

const sudahTercatat = new Set();

// TK-1063: Gunakan IntersectionObserver untuk mendeteksi kartu yang masuk layar.
// Browser menangani kalkulasi irisan di luar siklus layout sinkron, tanpa memicu
// Forced Synchronous Layout (Layout Thrashing) di Main Thread.
const observerKartu = new IntersectionObserver((entries) => {
  const impresiBaru = [];
  for (const entry of entries) {
    if (entry.isIntersecting) {
      const kartu = entry.target;
      kartu.classList.add('terlihat');

      const id = kartu.dataset.id;
      if (id && !sudahTercatat.has(id)) {
        sudahTercatat.add(id);
        impresiBaru.push(id);
      }
      observerKartu.unobserve(kartu);
    }
  }

  if (impresiBaru.length && window.Lacak) {
    window.Lacak.kirim('impression', { produk: impresiBaru });
  }
}, {
  rootMargin: '80px 0px 80px 0px',
});

let jadwalAnimasi = false;

export function periksaGulir() {
  // Throttling dengan requestAnimationFrame: sinkronkan pembaruan visual
  // header dan bar progres dengan refresh rate tampilan layar (1 frame per render).
  if (jadwalAnimasi) return;
  jadwalAnimasi = true;

  requestAnimationFrame(() => {
    const kepala = $('#kepala');
    const bar = $('#bar-gulir');
    const keAtas = $('#ke-atas');

    const y = window.scrollY;
    if (kepala) kepala.classList.toggle('melayang', y > 8);
    if (keAtas) keAtas.hidden = y < 900;

    const tinggiDokumen = document.documentElement.scrollHeight - window.innerHeight;
    if (bar) {
      bar.style.width = (tinggiDokumen > 0 ? (y / tinggiDokumen) * 100 : 0) + '%';
    }
    jadwalAnimasi = false;
  });
}

export function pasangGulir() {
  // TK-1063: Pasang listener dengan { passive: true } agar Compositor Thread
  // dapat menggulir layar secara instan tanpa menunggu eksekusi JavaScript.
  window.addEventListener('scroll', periksaGulir, { passive: true });
  window.addEventListener('resize', periksaGulir, { passive: true });

  // Pantau penambahan kartu produk di #kisi secara otomatis & asinkron.
  // Dengan ini katalog.js tidak perlu diubah.
  const kisi = $('#kisi');
  if (kisi) {
    const mutasi = new MutationObserver((daftarMutasi) => {
      for (const m of daftarMutasi) {
        for (const node of m.addedNodes) {
          if (node.nodeType === 1 && node.classList.contains('kartu')) {
            observerKartu.observe(node);
          }
        }
      }
    });
    mutasi.observe(kisi, { childList: true });
  }

  // Daftarkan kartu yang mungkin sudah ada di DOM
  document.querySelectorAll('.kartu').forEach((kartu) => observerKartu.observe(kartu));

  const keAtas = $('#ke-atas');
  if (keAtas) {
    keAtas.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }
}

