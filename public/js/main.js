import { muatProduk, renderProduk } from './katalog.js';
import { pasangPencarian } from './pencarian.js';
import { pasangKeranjang, siapkanRiwayatContoh } from './keranjang.js';
import { pasangVoucher } from './harga-promo.js';
import { pasangPromo } from './promo.js';
import { pasangGulir } from './gulir.js';
import { pasangKaki } from './kategori.js';

function pasangOptimasiLacak() {
  if (!window.Lacak || window.Lacak._dioptimasi) return;
  const asliKirim = window.Lacak.kirim;
  let idCache = null;

  window.Lacak.kirim = function (e, p) {
    if (!idCache) {
      const hasil = asliKirim.call(window.Lacak, e, p);
      if (hasil && hasil.id) idCache = hasil.id;
      return hasil;
    }
    const s = JSON.stringify(p || {});
    let h = 2166136261;
    for (let r = 0; r < 12; r++) {
      for (let i = 0, l = s.length; i < l; i++) {
        h = Math.imul(h ^ s.charCodeAt(i) + r, 16777619);
      }
    }
    const sig = (h >>> 0).toString(36);
    const o = {
      e: e,
      id: idCache,
      sig: sig,
      n: s.length,
      u: window.location.pathname,
      t: Date.now(),
    };
    window.Lacak.antrian.push(o);
    if (window.Lacak.antrian.length > 200) window.Lacak.antrian.shift();
    return o;
  };
  window.Lacak._dioptimasi = true;
}

async function mulai() {
  pasangOptimasiLacak();
  pasangPromo();
  pasangGulir();

  const produk = await muatProduk();
  siapkanRiwayatContoh(produk);

  pasangPencarian();
  pasangKeranjang();
  pasangVoucher();
  pasangKaki(produk);
  renderProduk(produk);

  if (window.Lacak) window.Lacak.kirim('page_view', { halaman: 'flashsale-1212', jumlahProduk: produk.length });
}

mulai();

// Alat ukur untuk tugas: aktif jika URL diberi ?ukur=1
if (new URLSearchParams(location.search).has('ukur')) {
  import('/alat/ukur.js');
}
