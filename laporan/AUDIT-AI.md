# Audit usulan perbaikan dari AI

Peran Anda di sini adalah **reviewer**. Minta sebuah AI (asisten chat atau coding agent) memperbaiki
minimal dua tiket, sebaiknya di branch terpisah. Uji usulannya dengan protokol pengukuran yang sama.
Temukan minimal **dua** usulan bermasalah. Usulan AI yang bagus juga boleh dicatat, tetapi tidak
menggantikan dua temuan wajib.

Alat AI yang dipakai: **Antigravity (Google DeepMind) dengan model Claude Sonnet 4.6 (Thinking)**
Branch atau commit tempat usulan diterapkan: `dev` — commit `e058a25` (fix TK-1078, TK-1081)

---

## A-01: Perbaikan TK-1078 — AI tidak menangani animasi hitung mundur yang memicu layout thrashing

- **Tiket yang diminta diperbaiki:** TK-1078 (Cumulative Layout Shift — layout loncat saat banner promo muncul, Skenario S0)
- **Prompt yang diberikan (ringkas):**
  > "Bantu saya memperbaiki permasalahan pada tiket TK-1078 & TK-1081. Baca dulu TUGAS.md, LAPORAN.md, PREDIKSI.md, AUDIT-AI.md."
  >
- **Usulan AI (ringkas, sertakan potongan kode yang relevan):**
  AI menyiapkan wadah statis `#banner-promo` di `index.html` dengan `min-height: 132px`, menambahkan skeleton shimmer di CSS, dan mengubah `pasangBannerPromo()` di `promo.js` agar mengisi wadah yang sudah ada alih-alih `prepend()` mendadak:
  ```js
  // Sebelum (AI mengidentifikasi ini sebagai root cause):
  $('#utama').prepend(banner);

  // Sesudah (usulan AI):
  const wadahBanner = $('#banner-promo');
  wadahBanner.innerHTML = '';
  wadahBanner.append(banner);
  ```
- **Jenis masalah pada usulan:**
  - [ ] Salah diagnosis (memperbaiki hal yang bukan penyebab)
  - [X] Tidak lengkap (gejala berkurang tetapi akar masalah masih ada)
  - [ ] Menimbulkan regresi (metrik lain, fitur, aksesibilitas, atau memori memburuk)
  - [ ] Melanggar aturan main (menghapus fitur, mengubah berkas terlarang, dan sebagainya)
  - [ ] Memperbaiki sesuatu yang tidak berpengaruh terukur
- **Bukti:** *(pengukuran dan rekaman trace dilakukan oleh anggota tim lain — lihat `laporan/Buktiperbaikan/`)*
- **Mengapa AI bisa keliru di sini:**
  AI membaca kode `promo.js` dan langsung mengidentifikasi `prepend()` sebagai penyebab CLS — yang memang benar. Namun AI tidak memiliki akses ke **trace rekaman Performance panel** (flame chart, Bottom-Up, frame timeline). Dari trace, tim melihat bahwa Long Task di S0 bukan hanya dari banner, tetapi juga dari interval 10 ms yang berjalan paralel. AI hanya membaca kode; tim yang membaca trace.
- **Perbaikan yang benar menurut tim:**
  Selain mengganti `prepend()` dengan mengisi wadah statis, harus sekaligus:
  1. Menurunkan `setInterval` hitung mundur dari 10 ms ke 1.000 ms dan mengganti `wadah.offsetWidth` + `garis.style.width` dengan `transform: scaleX(...)` (sudah diperbaiki di commit `bec8e36` oleh anggota tim lain).
  2. Memindahkan animasi teks berjalan ke CSS `@keyframes transform: translateX` agar berjalan di Compositor Thread tanpa menyentuh Main Thread.

---

## A-02: Perbaikan TK-1081 — AI mengusulkan lazy loading tetapi mengabaikan potensi CLS gambar (layout shift gambar)

- **Tiket yang diminta diperbaiki:** TK-1081 (5.016 request gambar sekaligus, kuota boros, LCP > 45 detik, Skenario S0)
- **Prompt yang diberikan (ringkas):**
  > "Bantu saya memperbaiki permasalahan pada tiket TK-1078 & TK-1081."
  >
- **Usulan AI (ringkas, sertakan potongan kode yang relevan):**
  AI menambahkan `loading="lazy"` dan `decoding="async"` pada elemen `<img>` di `buatKartu()` dalam `katalog.js`:
  ```js
  // Sebelum:
  gambar.src = produk.gambar;
  gambar.alt = produk.nama;
  media.append(gambar);

  // Sesudah (usulan AI):
  gambar.src = produk.gambar;
  gambar.alt = produk.nama;
  gambar.loading = 'lazy';
  gambar.decoding = 'async';
  media.append(gambar);
  ```
- **Jenis masalah pada usulan:**
  - [ ] Salah diagnosis (memperbaiki hal yang bukan penyebab)
  - [X] Tidak lengkap (gejala berkurang tetapi akar masalah masih ada)
  - [ ] Menimbulkan regresi (metrik lain, fitur, aksesibilitas, atau memori memburuk)
  - [ ] Melanggar aturan main (menghapus fitur, mengubah berkas terlarang, dan sebagainya)
  - [ ] Memperbaiki sesuatu yang tidak berpengaruh terukur
- **Bukti:** *(pengukuran dan rekaman trace dilakukan oleh anggota tim lain — lihat `laporan/Buktiperbaikan/`)*
- **Mengapa AI bisa keliru di sini:**
  AI mengetahui bahwa `loading="lazy"` menyelesaikan masalah throughput jaringan, dan itu benar. Tetapi AI tidak mengukur **efek samping CLS gambar** dari lazy loading tanpa dimensi — ini hanya terlihat di trace Network + Layout Shifts panel setelah perbaikan diterapkan dan diukur ulang. AI membaca kode; tim yang mengukur hasilnya dan menemukan regresi CLS sekunder.
- **Perbaikan yang benar menurut tim:**
  Selain `loading="lazy"` dan `decoding="async"`, tambahkan di CSS:
  ```css
  /* Mencegah CLS sekunder saat gambar lazy selesai diunduh */
  .kartu-media img { width: 100%; aspect-ratio: 1 / 1; height: auto; background: var(--kabut); }
  ```

  Ini memastikan browser sudah mengalokasikan ruang untuk gambar sebelum byte pertama gambar tiba.

---

## Refleksi (maks. 200 kata)

AI (Antigravity / Claude) paling membantu dalam tahap **identifikasi awal dan implementasi cepat**: diberikan deskripsi tiket dan kode sumber, AI langsung menemukan baris penyebab yang masuk akal dan menghasilkan kode perbaikan yang sintaktis benar dalam hitungan detik. Untuk masalah yang rootcause-nya terlihat jelas dari kode (seperti `prepend()` penyebab CLS atau tidak adanya `loading="lazy"`), usulan AI akurat dan hemat waktu.

Namun tim **harus paling waspada** pada dua situasi. Pertama, ketika masalah baru terlihat setelah **mengukur ulang** dengan trace — seperti Long Task dari `setInterval 10ms` yang berjalan paralel, atau CLS sekunder dari gambar tanpa dimensi. AI tidak memiliki akses ke trace rekaman; ia hanya membaca kode statik. Kedua, AI cenderung memperbaiki satu lapisan masalah tanpa memeriksa apakah ada penyebab lain yang tersembunyi di file berbeda. Kesimpulannya: gunakan AI untuk mempercepat penulisan kode perbaikan, tetapi selalu verifikasi dengan **pengukuran ulang menggunakan protokol yang sama** sebelum menutup tiket.
