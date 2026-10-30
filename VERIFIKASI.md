# Laporan Verifikasi & Pengujian Sistem — RetailScope Indonesia

Tanggal Pembaruan: **30 Oktober 2026**  
Repositori: [https://github.com/bryanalberta/Retail-Scope](https://github.com/bryanalberta/Retail-Scope)

---

## 1. Pengujian Unit Otomatis (`npm test`)

Perintah `node --test tests/engine.test.cjs` menjalankan **14 rangkaian pengujian komprehensif** dan seluruhnya berstatus **PASS (14 lulus, 0 gagal)**:

1. **Parser CSV**: Mendukung koma dalam tanda kutip, kutip ganda (`""`), *multiline*, BOM UTF-8, dan pemisah titik koma (`;`).
2. **Validasi Tanggal & Format Angka**: Menolak tanggal tidak valid (seperti 31 Februari), mendukung `DD/MM/YYYY`, `MM/DD/YYYY`, ISO `YYYY-MM-DD`, serial tanggal Excel, serta format angka Indonesia (`12.345,67`).
3. **Rekonsiliasi Tahap Data Cleaning**: Memastikan rumus $\text{Mentah} = \text{Duplikat} + \text{Batal/Retur} + \text{Belum Final} + \text{Invalid} + \text{Valid}$ selalu konsisten dan ID pelanggan kosong tidak pernah diimputasi palsu ke dalam RFM.
4. **Penanganan Prefix Pembatalan**: Memastikan ID pesanan atau pelanggan Indonesia yang diawali huruf `C` tidak dianggap sebagai transaksi batal kecuali opsi khusus skema *Online Retail II* diaktifkan.
5. **Perhitungan RFM Presisi**: Memastikan *Recency* dihitung terhadap $\max(\text{tanggal}) + 1\text{ hari}$, *Frequency* menghitung faktur unik per pelanggan, dan *Monetary* menjumlahkan pembelian positif.
6. **Filter Cakupan Analisis**: Memastikan filter tanggal, provinsi/wilayah, dan kota menyaring data dengan akurat serta menyertakan bulan bernilai nol dalam rentang aktif.
7. **Pelestarian Baris Item Berbeda**: Memastikan baris pesanan dengan ID baris/item berbeda tidak terhapus secara keliru saat deduplikasi.
8. **Algoritma K-Means++ & Silhouette**: Memastikan label cluster deterministik (diurutkan dari rerata *Monetary* tertinggi), pemisahan kelompok akurat, dan perhitungan *Silhouette Score* sesuai rumus jarak Euclidean.
9. **Guard Kasus Tepi Segmentasi**: Menangani populasi pelanggan $< 3$ atau profil RFM identik tanpa menghasilkan *NaN* atau cluster semu.
10. **Kesetaraan Generator Demo & File `demo.csv`**: Memastikan generator deterministik `E.demo()` dan file `dist/demo.csv` menghasilkan ringkasan statistik yang 100% identik.
11. **Keamanan Skema Sumber *Repeat Buyer***: Memastikan sistem tidak mengarang harga atau ID faktur apabila kolom wajib tidak tersedia.
12. **Mode Nilai Pesanan (*Order-Level Value Mode*)**: Memastikan dataset ringkasan pesanan dijumlahkan satu kali per pesanan tanpa memalsukan harga satuan atau ID produk.
13. **Ekstraksi Kategori, Pembayaran, Jam Sibuk & Persona Bisnis**: Memastikan agregasi kategori, metode pembayaran, jam sibuk (24 jam), dan penamaan otomatis persona bisnis berjalan akurat.
14. **Market Basket Analysis (Apriori), Churn, CLV, Pareto 80/20 & Pola Hari Belanja**: Memastikan perhitungan aturan asosiasi (*Support*, *Confidence*, *Lift*), probabilitas *Churn*, estimasi *CLV*, metrik *Repeat Buyer / Pareto 80/20*, serta agregasi hari belanja (*Senin–Minggu*) akurat.

---

## 2. Pemeriksaan Sintaks (`npm run check`)

Seluruh file inti aplikasi lulus uji sintaks Node.js:
- `node --check dist/app.js` — **LULUS**
- `node --check dist/engine.js` — **LULUS**
- `node --check dist/worker.js` — **LULUS**

---

## 3. Verifikasi Fungsional & Antarmuka (UI/UX)

| Komponen / Halaman | Status | Catatan Verifikasi |
| :--- | :--- | :--- |
| **Tema Terang & Gelap (Light / Dark Mode)** | ✅ Lulus | Sidebar, Topbar, dan konten utama sinkron; preferensi tersimpan di `localStorage`. |
| **Penyimpanan Sesi (`IndexedDB`)** | ✅ Lulus | Dataset pengguna & pemetaan kolom otomatis dipulihkan saat halaman di-refresh (`F5`). |
| **Ringkasan (`#overview`)** | ✅ Lulus | Menampilkan 4 KPI utama, grafik tren bulanan, donut cluster, produk/kategori, dan wilayah. |
| **Tren Penjualan (`#trends`)** | ✅ Lulus | Menampilkan grafik bulanan, **Pareto 80/20 & Repeat Buyer**, produk/kategori, provinsi, **Top Kota**, **Distribusi Kurir**, **Pola Hari (Senin–Minggu)**, **Jam Sibuk (24 Jam)**, **Metode Pembayaran**, dan **Market Basket Analysis**. |
| **Segmentasi Pelanggan (`#segments`)** | ✅ Lulus | Menampilkan kartu cluster + persona, *scatter plot*, *Elbow*, tabel model, serta tabel pelanggan dengan filter Cluster, Risiko Churn, dan pengurutan kolom. |
| **Ringkasan Eksekutif (`#executive`)** | ✅ Lulus | Menampilkan laporan eksekutif lengkap dengan Pareto, operasional, peluang *bundling*, dan rencana aksi 30-60-90 hari (siap cetak PDF). |
| **Dataset & Pemetaan (`#dataset`)** | ✅ Lulus | Mendukung CSV/XLSX/XLS, Mode Baris Produk & Mode Total Pesanan, serta Simulasi ID Pelanggan (*Proxy RFM*). |
| **Data Cleaning (`#cleaning`)** | ✅ Lulus | Menampilkan 8 tahap audit pembersihan, persentase kelolosan, dan ekspor CSV bersih. |
| **Arsitektur Big Data (`#architecture`)** | ✅ Lulus | Menampilkan arsitektur Apache Spark & unduhan skrip `pyspark_pipeline.py`. |
| **Backlog Proyek (`#backlog`)** | ✅ Lulus | Mendukung centang langsung 25 item backlog, tombol **Tandai Otomatis Progres**, dan ekspor CSV. |
