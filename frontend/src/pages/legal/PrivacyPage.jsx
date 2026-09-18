import LegalLayout from "./LegalLayout";

export default function PrivacyPage() {
  return (
    <LegalLayout title="Kebijakan Privasi" updatedAt="18 September 2026" testid="privacy-page">
      <h2>1. Data yang Kami Kumpulkan</h2>
      <ul>
        <li><strong>Data pendaftaran:</strong> nama bisnis, nama pemilik, alamat email, dan
          kata sandi (disimpan dalam bentuk hash, tidak pernah teks polos).</li>
        <li><strong>Data operasional:</strong> menu, harga, transaksi kasir, shift, inventori,
          data staf yang kamu tambahkan.</li>
        <li><strong>Data teknis:</strong> alamat IP (untuk anti-abuse rate limiting), tipe
          browser, timestamp aktivitas, log audit perubahan penting.</li>
      </ul>

      <h2>2. Tujuan Penggunaan Data</h2>
      <ul>
        <li>Menjalankan fitur inti aplikasi (POS, laporan, langganan).</li>
        <li>Menyampaikan notifikasi transaksional (verifikasi email, pengingat tagihan).</li>
        <li>Mencegah penyalahgunaan (rate limiting, deteksi bot, audit log).</li>
        <li>Perbaikan produk berdasarkan data agregat &amp; anonim.</li>
      </ul>
      <p>
        Kami <strong>tidak</strong> menjual data pribadi kamu ke pihak ketiga untuk iklan.
      </p>

      <h2>3. Berbagi Data dengan Pihak Ketiga</h2>
      <p>Data mungkin dibagikan ke pihak ketiga yang menjalankan bagian infrastruktur, terbatas pada:</p>
      <ul>
        <li>Penyedia hosting cloud (untuk menyimpan database &amp; aset).</li>
        <li>Gerbang pembayaran (Midtrans / Winpay) — hanya data langganan yang perlu, tidak
          termasuk data transaksi kasir pelanggan kamu.</li>
        <li>Penyedia email transaksional (Mailgun / SendGrid) — hanya alamat email penerima
          dan konten email sistem.</li>
      </ul>

      <h2>4. Kepemilikan &amp; Hak Kamu</h2>
      <ul>
        <li>Data bisnis kamu tetap milik kamu sepenuhnya.</li>
        <li>Kamu berhak meminta ekspor data (CSV / JSON) kapan saja.</li>
        <li>Kamu berhak meminta koreksi atau penghapusan data pribadi.</li>
        <li>Permintaan hak-hak di atas dilayani maksimal 14 hari kerja setelah verifikasi identitas.</li>
      </ul>

      <h2>5. Keamanan</h2>
      <ul>
        <li>Kata sandi disimpan menggunakan bcrypt (adaptive salted hash).</li>
        <li>Sesi login menggunakan cookie HttpOnly, Secure, dan SameSite=None (khusus HTTPS).</li>
        <li>Data ditransmisikan melalui TLS.</li>
        <li>Rate limiting untuk pendaftaran &amp; login untuk membatasi serangan otomatis.</li>
      </ul>

      <h2>6. Retensi Data</h2>
      <p>
        Data operasional (transaksi, log) disimpan selama akun aktif dan hingga 30 hari
        setelah akun ditutup. Setelah itu data dihapus permanen atau di-anonim, kecuali
        catatan yang wajib disimpan berdasarkan peraturan pajak/hukum.
      </p>

      <h2>7. Cookie</h2>
      <p>
        Kami menggunakan cookie sesi (access_token, refresh_token) untuk menjaga login kamu.
        Kami tidak memasang cookie iklan pihak ketiga di aplikasi kasir.
      </p>

      <h2>8. Anak di Bawah Umur</h2>
      <p>
        Layanan ini ditujukan untuk pelaku usaha; kami tidak menargetkan pengguna di bawah
        usia 17 tahun. Bila ternyata data anak di bawah umur terkumpul, kami akan menghapusnya
        setelah pemberitahuan.
      </p>

      <h2>9. Perubahan Kebijakan</h2>
      <p>
        Kebijakan ini dapat diperbarui. Perubahan material akan diumumkan lewat email dan
        banner di dalam aplikasi minimal 14 hari sebelum berlaku.
      </p>

      <h2>10. Kontak Perlindungan Data</h2>
      <p>
        Untuk pertanyaan atau permintaan hak privasi, hubungi kami di
        <a href="mailto:hello@gloopos.id"> hello@gloopos.id</a>.
      </p>
    </LegalLayout>
  );
}
