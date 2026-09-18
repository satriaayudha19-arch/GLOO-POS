import LegalLayout from "./LegalLayout";

export default function TermsPage() {
  return (
    <LegalLayout title="Syarat & Ketentuan" updatedAt="18 September 2026" testid="terms-page">
      <h2>1. Definisi</h2>
      <p>
        <strong>&quot;GLOO POS&quot;</strong>, <strong>&quot;kami&quot;</strong>, atau <strong>&quot;layanan&quot;</strong>
        merujuk pada aplikasi point of sale multi-tenant yang dioperasikan oleh tim GLOO POS.
        <strong>&quot;Pengguna&quot;</strong> atau <strong>&quot;kamu&quot;</strong> adalah pemilik bisnis dan
        seluruh staf yang diberi akses ke workspace bisnis kamu.
      </p>

      <h2>2. Ruang Lingkup Layanan</h2>
      <p>
        GLOO POS menyediakan sistem kasir digital untuk usaha kuliner (makanan &amp; minuman),
        termasuk pengelolaan menu, transaksi, inventori, dan laporan. Layanan disediakan
        &quot;as is&quot; dengan target uptime terbaik namun tanpa garansi 100% ketersediaan.
      </p>

      <h2>3. Akun dan Keamanan</h2>
      <ul>
        <li>Kamu bertanggung jawab menjaga kerahasiaan kata sandi akun pemilik dan seluruh
          akun staf yang kamu buat.</li>
        <li>Kamu wajib segera memberi tahu kami bila mencurigai adanya penyalahgunaan akun.</li>
        <li>Kami berhak menangguhkan akun yang terbukti disalahgunakan atau melanggar syarat ini.</li>
      </ul>

      <h2>4. Paket Berlangganan &amp; Pembayaran</h2>
      <ul>
        <li>Paket Free tersedia dengan periode uji coba (trial) selama 14 hari tanpa memerlukan kartu.</li>
        <li>Peningkatan ke paket berbayar akan tersedia setelah gerbang pembayaran online aktif.
          Sementara itu, aktivasi paket berbayar dilakukan secara manual oleh tim kami.</li>
        <li>Harga langganan dapat berubah dengan pemberitahuan minimal 30 hari sebelumnya.</li>
      </ul>

      <h2>5. Kepemilikan Data</h2>
      <p>
        Semua data bisnis (menu, transaksi, pelanggan, staf) tetap milik kamu. Kami hanya
        menyimpan dan memproses data ini untuk menjalankan layanan sesuai permintaan kamu.
        Kamu dapat meminta ekspor atau penghapusan data kapan saja lewat kontak resmi.
      </p>

      <h2>6. Batasan Penggunaan</h2>
      <ul>
        <li>Dilarang menggunakan GLOO POS untuk menjual barang/jasa ilegal.</li>
        <li>Dilarang melakukan reverse engineering, scraping massal, atau serangan otomatis
          terhadap sistem kami.</li>
        <li>Dilarang mengakses data tenant lain tanpa izin.</li>
      </ul>

      <h2>7. Penangguhan &amp; Penghapusan Akun</h2>
      <p>
        Kami dapat menangguhkan atau menghapus akun yang melanggar syarat ini, tidak aktif
        lebih dari 12 bulan, atau memiliki tagihan tertunggak lebih dari 30 hari setelah masa
        tenggang. Data akan dipertahankan selama 30 hari sebelum dihapus permanen.
      </p>

      <h2>8. Batas Tanggung Jawab</h2>
      <p>
        GLOO POS tidak bertanggung jawab atas kerugian tidak langsung (kehilangan pendapatan,
        reputasi, atau data yang tidak di-backup pihak pengguna) yang timbul akibat pemakaian
        layanan, sepanjang diizinkan oleh hukum yang berlaku.
      </p>

      <h2>9. Perubahan Syarat</h2>
      <p>
        Kami dapat memperbarui syarat ini sewaktu-waktu. Versi terbaru akan ditampilkan di
        halaman ini dengan tanggal &quot;terakhir diperbarui&quot;. Pemakaian berkelanjutan
        setelah perubahan berarti kamu setuju dengan syarat yang baru.
      </p>

      <h2>10. Hukum yang Berlaku</h2>
      <p>
        Syarat ini tunduk pada hukum Republik Indonesia. Segala perselisihan diselesaikan
        secara musyawarah, dan bila tidak tercapai kesepakatan, dibawa ke Pengadilan Negeri
        di wilayah kedudukan operator layanan.
      </p>

      <h2>11. Kontak</h2>
      <p>
        Email: <a href="mailto:hello@gloopos.id">hello@gloopos.id</a>
      </p>
    </LegalLayout>
  );
}
