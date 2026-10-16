# Audit usulan perbaikan dari AI

Peran Anda di sini adalah **reviewer**. Minta sebuah AI (asisten chat atau coding agent) memperbaiki
minimal dua tiket, sebaiknya di branch terpisah. Uji usulannya dengan protokol pengukuran yang sama.
Temukan minimal **dua** usulan bermasalah. Usulan AI yang bagus juga boleh dicatat, tetapi tidak
menggantikan dua temuan wajib.

Alat AI yang dipakai: **Antigravity (Google DeepMind) dengan model Claude Sonnet 4.6 (Thinking)**
Branch atau commit tempat usulan diterapkan: `dev` — commit `e058a25` (fix TK-1078, TK-1081), `bec8e36` (fix TK-1063, TK-1070)

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

## A-03: Perbaikan Tiket TK-1044: Tombol Keranjang Lambat (Skenario S2)

- **Prompt yang diberikan ke AI:**
  "Tolong perbaiki fungsi `tambahKeKeranjang` agar tidak nge-hang dan metrik INP turun di bawah 200ms."
- **Usulan AI:**
  AI menyarankan untuk membungkus seluruh isi fungsi `tambahKeKeranjang` ke dalam `setTimeout(..., 0)` dan secara sepihak menghapus baris pemanggilan `window.Lacak.kirim(...)` agar antrean tugas (*task queue*) tidak terblokir.
- **Kelemahan/Kesalahan Usulan AI:**

1. **Menimbulkan Regresi Fitur (Fatal):** AI menghapus pemanggilan SDK analitik pihak ketiga. Hal ini melanggar aturan bisnis karena analitik wajib ada dan tidak boleh disentuh fungsionalitasnya.
2. **Solusi Tidak Lengkap (Kurang Optimistic UI):** Membungkus seluruh fungsi ke dalam `setTimeout` tanpa memperbarui DOM di awal fungsi tidak menyelesaikan keluhan pengguna. Tombol tetap tidak memberikan umpan balik visual (*optimistic feedback*) secara instan saat diklik.

- **Bukti / Trace:**
  * *Trace visual:* Meskipun INP secara teknis turun, pengguna tetap melihat jeda lambat sebelum teks tombol berubah menjadi "Ditambahkan ✓" karena UI baru diperbarui setelah *makrotask* berjalan.
  * *Trace jaringan:* Panel *Network* pada DevTools menunjukkan tidak ada *event* `add_to_cart` yang dikirim ke vendor analitik, membuktikan hilangnya fitur bisnis wajib.

---

## A-04: Perbaikan Tiket TK-1052: Pesanan/Tagihan Ganda (Skenario S3)

- **Prompt yang diberikan ke AI:**
  "Tolong cegah pengguna membuat pesanan ganda di fungsi `beliSekarang` saat mengklik tombol 'Beli sekarang' berkali-kali."
- **Usulan AI:**
  AI menyarankan untuk menambahkan fungsi pembatas *debounce* dengan jeda waktu 500ms pada *event listener* tombol checkout tersebut.
- **Kelemahan/Kesalahan Usulan AI:**

1. **Solusi Tidak Tepat Sasaran:** *Debounce* hanya menunda eksekusi saat klik berdekatan. Pada server pengembangan kita, *endpoint POST* `/api/pesanan` memiliki waktu tunda (*latency*) buatan sebesar 350ms. Jika pengguna mengklik di detik ke-0, lalu mengklik lagi di detik ke-0.6 (setelah jeda *debounce* 500ms berlalu), *request* kedua akan tetap terkirim dan pesanan ganda tetap terjadi karena *request* HTTP belum dilindungi oleh *idempotency lock*.
2. **Kurangnya *User Error Protection*:** AI tidak menyertakan instruksi untuk menonaktifkan tombol (`disabled = true`) dan mengubah teksnya menjadi "Memproses..." seketika setelah klik pertama. Tanpa indikator visual ini, pengguna tidak akan tahu sistem sedang bekerja dan akan terus menekan tombol tersebut.

- **Bukti / Trace:**
  *   *Log Terminal:* Saat skenario klik tombol "Beli sekarang" diuji berkali-kali dengan jeda sedikit di atas 500ms, terminal server tetap mencetak log pesanan ganda seperti `[pesanan] TK-0000X produk #1 (X total)` lebih dari satu kali. Ini membuktikan *debounce* gagal memproteksi *request in-flight*.

---

## A-05: Perbaikan Tiket TK-1063: Scroll Daftar Produk Jank / Patah-patah (Skenario S5)

- **Tiket yang diminta diperbaiki:** TK-1063 (Scroll daftar barang patah-patah / jank di HP Android, Skenario S5)
- **Prompt yang diberikan ke AI:**
  "Scroll di halaman katalog terasa sangat patah-patah dan berat saat digulir. Tolong perbaiki fungsi `periksaGulir` di `gulir.js`."
- **Usulan AI:**
  AI menyarankan untuk menerapkan pembatas *throttle* atau *debounce* waktu (misal 100 ms) pada *event listener* scroll, serta menambahkan opsi `{ passive: true }`:
  ```js
  // Usulan AI (Throttle pada event scroll):
  let lastScroll = 0;
  window.addEventListener('scroll', () => {
    const now = Date.now();
    if (now - lastScroll > 100) {
      periksaGulir();
      lastScroll = now;
    }
  }, { passive: true });
  ```
- **Jenis masalah pada usulan:**
  - [X] Salah diagnosis (memperbaiki hal yang bukan penyebab utama)
  - [X] Tidak lengkap (gejala berkurang sedikit namun akar masalah layout thrashing tetap ada)
  - [X] Menimbulkan regresi (efek visual bar progres dan animasi kartu menjadi tersendat/stuttering)
- **Bukti / Trace:**
  * *Trace DevTools:* Panel Performance tetap merekam *Forced Synchronous Layout* (Layout Thrashing) dengan durasi task > 200–500 ms saat throttle terpicu, karena fungsi `periksaGulir` di dalam usulan AI masih mengeksekusi `kartu.getBoundingClientRect()` di dalam perulangan ratusan elemen `.kartu` lalu seketika menulis `kartu.style.minHeight`.
  * *Trace Rendering:* AI tidak menyadari bahwa transisi CSS `.kartu` pada `margin-top: 16px` $\to$ `0` memicu siklus *Layout Reflow* pada setiap frame di CSS Grid. Jumlah frame lambat tetap tinggi (> 150 frame drop).
  * *Trace SDK:* AI tidak mengetahui bahwa `window.Lacak.kirim('impression')` menjalankan fungsi enkripsi 2 juta iterasi secara sinkron di Main Thread saat batch kartu terdeteksi.
- **Mengapa AI bisa keliru di sini:**
  AI hanya melihat event listener `scroll` yang sering dipanggil dan menyimpulkan solusinya adalah "mengurangi frekuensi eksekusi dengan throttle". AI tidak memiliki kemampuan membaca *flame chart DevTools* untuk melihat bahwa biaya komputasi terbesar berada di tahap **Rendering Pipeline (Layout Thrashing)** dan **animasi CSS non-composited**, bukan pada event scroll itu sendiri.
- **Perbaikan yang benar menurut tim:**
  1. Mengganti perulangan geometri manual dengan **`IntersectionObserver`** (`rootMargin: '80px 0px 80px 0px'`) agar kalkulasi irisan ditangani asinkron oleh browser di luar Main Thread.
  2. Menerapkan CSS `content-visibility: auto; contain-intrinsic-size: auto 340px;` pada `.kartu` untuk melewati rendering kartu off-screen.
  3. Mengganti transisi `margin-top` menjadi GPU-composited **`transform: translateY(16px)` $\to$ `translateY(0)`**, serta lencana kilat menjadi `transform: translateY(-4px)`.
  4. Membungkus pengiriman impresi analitik dengan **`requestIdleCallback`** agar tidak menginterupsi siklus frame saat scrolling.
  * *Hasil Pengukuran:* Long task terlama turun dari 724 ms menjadi **98 ms** (memenuhi target $\le 100\text{ ms}$), total waktu blokir turun 91% (dari 9.603 ms ke 823 ms), dan waktu rendering terpangkas hingga 90% (lihat `laporan/Buktiperbaikan/S5.png`).

---

## A-06: Perbaikan Tiket TK-1070: HP Panas dan Baterai Cepat Habis Saat Diam (Skenario S6)

- **Tiket yang diminta diperbaiki:** TK-1070 (HP panas dan baterai cepat turun padahal hanya diam melihat-lihat, Skenario S6)
- **Prompt yang diberikan ke AI:**
  "Halaman diam 5 menit HP panas dan baterai boros. Tolong optimasi fungsi `pasangTeksBerjalan` dan `pasangHitungMundur` di `promo.js`."
- **Usulan AI:**
  AI menyarankan untuk mengganti `setInterval(..., 10)` dengan `requestAnimationFrame` untuk menggerakkan teks berjalan:
  ```js
  // Usulan AI:
  function pasangTeksBerjalan() {
    const teks = $('#berjalan-teks');
    let x = teks.parentElement.offsetWidth;
    function putar() {
      x -= 1;
      if (x < -teks.offsetWidth) x = teks.parentElement.offsetWidth;
      teks.style.left = x + 'px';
      requestAnimationFrame(putar);
    }
    requestAnimationFrame(putar);
  }
  ```
- **Jenis masalah pada usulan:**
  - [X] Salah diagnosis (memperbaiki hal yang bukan solusi arsitektur yang tepat)
  - [X] Tidak lengkap (tetap membebani CPU Main Thread 60 FPS saat halaman diam)
- **Bukti / Trace:**
  * *Trace DevTools:* Panel Performance merekam bahwa Main Thread tetap sibuk bekerja 60 kali per detik (setiap 16,6 ms) mengeksekusi JavaScript callback rAF.
  * *Pipeline Breakdown:* Karena properti yang dimanipulasi adalah `teks.style.left` dan membaca `offsetWidth`, browser tetap dipaksa menjalankan seluruh pipeline: **Recalculate Style $\to$ Layout (Reflow) $\to$ Paint** di Main Thread 60 Hz meskipun pengguna tidak menyentuh layar. CPU tetap bekerja tanpa jeda dan konsumsi baterai tetap tinggi.
  * *Lifecycle Gap:* AI tidak menangani siklus hidup tab (`document.visibilityState`). Saat tab diminimize atau pengguna membuka tab lain, loop rAF/timer tetap mengonsumsi sumber daya di latar belakang.
- **Mengapa AI bisa keliru di sini:**
  AI mengira `requestAnimationFrame` adalah "best practice" otomatis untuk semua animasi di web. Namun AI gagal memahami batas arsitektur antara **Main Thread** dan **Compositor Thread (GPU)**. Animasi berbasis JavaScript rAF tetap membebani Main Thread dan properti geometri `left` tidak bisa di-composite secara terpisah.
- **Perbaikan yang benar menurut tim:**
  1. Menghapus JavaScript loop sepenuhnya untuk teks berjalan dan memindahkannya ke murni **CSS `@keyframes`** menggunakan **`transform: translateX(...)`** dan `will-change: transform`. Properti `transform` diakselerasi langsung di **GPU / Compositor Thread** tanpa memicu reflow atau repaint di Main Thread sama sekali.
  2. Menurunkan frekuensi hitung mundur dari 10 ms (100 Hz) ke **1.000 ms (1 Hz / 1 detik sekali)** dan menganimasikan garis progres menggunakan `transform: scaleX(...)` + `transition: transform 1s linear`.
  3. Menambahkan penanganan event **`visibilitychange`** (`document.hidden`) yang mematikan timer saat tab tidak aktif (`clearInterval`).
  * *Hasil Pengukuran:* Konsumsi CPU Scripting saat diam turun menjadi hanya **90 ms** dari total 11,6 detik rekaman (**$\approx 1\%$ aktivitas CPU**), total blokir turun ke 128 ms (dan 16 ms), dan long task $\le 77\text{ ms}$ (lihat `laporan/Buktiperbaikan/S6.png`).

---

## Refleksi (maks. 200 kata)

AI (Antigravity / Claude) paling membantu dalam tahap **identifikasi awal dan implementasi cepat**: diberikan deskripsi tiket dan kode sumber, AI langsung menemukan baris penyebab yang masuk akal dan menghasilkan kode perbaikan yang sintaktis benar dalam hitungan detik. Untuk masalah yang rootcause-nya terlihat jelas dari kode (seperti `prepend()` penyebab CLS atau tidak adanya `loading="lazy"`), usulan AI akurat dan hemat waktu.

Namun tim **harus paling waspada** pada dua situasi. Pertama, ketika masalah baru terlihat setelah **mengukur ulang** dengan trace — seperti Long Task dari `setInterval 10ms` yang berjalan paralel, atau CLS sekunder dari gambar tanpa dimensi. AI tidak memiliki akses ke trace rekaman; ia hanya membaca kode statik. Kedua, AI cenderung memperbaiki satu lapisan masalah tanpa memeriksa apakah ada penyebab lain yang tersembunyi di file berbeda. Kesimpulannya: gunakan AI untuk mempercepat penulisan kode perbaikan, tetapi selalu verifikasi dengan **pengukuran ulang menggunakan protokol yang sama** sebelum menutup tiket.
