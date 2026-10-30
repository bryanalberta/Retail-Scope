# RetailScope — Platform Analitik Retail Indonesia (RFM, K-Means, Market Basket & Big Data Pipeline)

**RetailScope** adalah platform laboratorium analitik transaksi retail Indonesia berbasis web (In-Memory Web Worker Engine) serta pendamping pipeline komputasi terdistribusi **Apache Spark (`pyspark_pipeline.py`)**. Proyek ini dirancang untuk memenuhi seluruh kebutuhan penelitian dan praktikum mata kuliah **Big Data**: mulai dari *data ingestion*, *audit data cleaning*, *analisis tren penjualan multi-dimensi*, *konsentrasi Pareto 80/20*, *Market Basket Analysis (Apriori)*, hingga *segmentasi pelanggan RFM + K-Means++*, *prediksi risiko Churn*, dan *estimasi Customer Lifetime Value (CLV)*.

🔗 **Repositori GitHub**: [https://github.com/bryanalberta/Retail-Scope](https://github.com/bryanalberta/Retail-Scope)

---

## ✨ Fitur Utama

### 1. Analitik Bisnis & Tren Penjualan Multi-Dimensi
- **Ringkasan Eksekutif & KPI Utama**: Total Nilai Penjualan Bersih, Volume Pesanan Unik, Populasi Pelanggan Teridentifikasi, dan Rata-rata Nilai Pesanan (*Average Order Value* / AOV).
- **Tren Bulanan Interaktif**: Visualisasi grafik garis/area nilai penjualan dan volume pesanan unik per bulan beserta deteksi bulan puncak.
- **Analisis Konsentrasi Pareto 80/20 & Repeat Buyer Retention**:
  - Menghitung tingkat retensi pembeli berulang (*Repeat Buyer Rate* $>1\times$ transaksi vs *One-Time Buyer*) dan porsi kontribusi omzetnya.
  - Mengukur konsentrasi Hukum Pareto pada **20% Pelanggan Teratas** dan **20% Produk/SKU Teratas**.
- **Analisis Geografi & Logistik Indonesia**:
  - Peringkat pesanan unik & omzet berdasarkan **Provinsi / Wilayah** serta **Top Kota / Kabupaten**.
  - Distribusi **Metode Pembayaran** (*QRIS, Virtual Account, E-Wallet, COD, PayLater, Kartu Kredit*) dan **Kurir / Ekspedisi Pengiriman** (*J&T, JNE, SiCepat, AnterAja, GoSend, SPX*).
- **Pola Waktu Belanja (Temporal Analytics)**:
  - **Pola Hari Belanja (Senin — Minggu)** untuk mengidentifikasi hari operasional tersibuk.
  - **Pola Jam Sibuk Transaksi (24 Jam)** untuk optimasi jadwal *flash sale* dan kesiapan gudang.
- **Market Basket Analysis (Asosiasi Keranjang Belanja / Apriori)**:
  - Mengekstrak aturan asosiasi antar kategori/produk yang sering dibeli bersamaan (*Antecedent $\rightarrow$ Consequent*) lengkap dengan metrik **Support (%)**, **Confidence (%)**, **Lift ($\times$)**, dan rekomendasi paket *bundling / cross-selling*.

### 2. Segmentasi Pelanggan RFM, K-Means++, Churn & CLV
- **Rekayasa Fitur RFM Akurat**:
  - **Recency ($R$)**: Selisih hari dari transaksi terakhir pelanggan ke tanggal referensi ($\max(\text{tanggal}) + 1\text{ hari}$).
  - **Frequency ($F$)**: Jumlah ID pesanan/invoice unik per pelanggan.
  - **Monetary ($M$)**: Total nilai pembelian positif yang lolos audit *cleaning*.
- **Algoritma Clustering K-Means++ Deterministik**:
  - Pra-pemrosesan `log1p(RFM)` + standardisasi *z-score* populasi.
  - Evaluasi otomatis $k = 2\text{ s/d }8$ menggunakan **Inertia (Metode Elbow)** dan **Silhouette Score** (sampel deterministik hingga 500 pelanggan).
- **Penamaan Persona Bisnis & Strategi Retensi Otomatis**:
  - Mengklasifikasikan cluster menjadi persona bisnis seperti **Champions (Pelanggan VIP)**, **Loyal Customers (Pelanggan Setia)**, **Potential Loyalists (Potensial Berkembang)**, **At-Risk / Need Attention (Rentan Beralih)**, atau **Hibernating / Lost (Tidak Aktif)** beserta rekomendasi aksi pemasaran.
- **Estimasi Risiko Churn (%) & Customer Lifetime Value (CLV)**:
  - Menghitung skor probabilitas *churn* (`Rendah`, `Sedang`, `Tinggi`) dan proyeksi nilai umur pelanggan (*Estimated CLV*).
- **Tabel Pelanggan Interaktif**:
  - Dilengkapi **Filter Cluster**, **Filter Risiko Churn**, **Pengurutan Multi-Kolom** (*Monetary, CLV, Frequency, Risiko Churn, Recency*), serta pencarian ID pelanggan secara *real-time*.
- **Simulasi ID Pelanggan (Proxy RFM)**:
  - Mendukung pembentukan identitas pelanggan simulasi secara deterministik apabila dataset e-commerce publik yang diunggah hanya mencatat transaksi tingkat pesanan (*order-level*) tanpa kolom `customer_id`.

### 3. Pipeline Data, Penyimpanan Sesi & Arsitektur Big Data
- **Dukungan Multi-Format (CSV, XLSX, XLS)**: Mendukung *drag-and-drop* hingga 120 MB, deteksi kolom otomatis bahasa Indonesia & Inggris, dukungan Mode Baris Produk (`quantity × unit_price`) maupun Mode Ringkasan Pesanan (`total_amount`).
- **Audit Data Cleaning Transparan**: Mencatat dan memvisualisasikan rekonsiliasi jumlah baris mentah, duplikat identik, pembatalan/retur, transaksi belum final, baris tidak valid, hingga baris bersih.
- **Penyimpanan Sesi Otomatis (`IndexedDB` + `localStorage`)**: Dataset pengguna yang diunggah beserta konfigurasi pemetaan kolom dan filter tersimpan aman di memori lokal browser dan **tidak hilang saat halaman di-refresh (`F5`)**.
- **Sinkronisasi Tema Terang & Gelap (Light / Dark Mode)**: Antarmuka modern, responsif, dan konsisten di seluruh komponen.
- **Pendamping Pipeline Apache Spark (`pyspark_pipeline.py`)**: Skrip PySpark lengkap untuk eksekusi ETL terdistribusi, Window RFM, dan Spark MLlib K-Means pada skala jutaan baris transaksi.

---

## 🚀 Cara Menjalankan Aplikasi

### Persyaratan
- **Node.js 18** atau versi lebih baru (tanpa ketergantungan paket eksternal `node_modules`).

### Langkah Menjalankan (Windows / macOS / Linux)
1. Clone repositori ini:
   ```bash
   git clone https://github.com/bryanalberta/Retail-Scope.git
   cd Retail-Scope
   ```
2. Jalankan server lokal:
   - **Windows (Klik Ganda)**: Klik dua kali file **`Mulai-RetailScope.cmd`**, atau
   - **Terminal / PowerShell**:
     ```powershell
     npm start
     # atau: node server.mjs
     ```
3. Buka browser dan akses:
   ```text
   http://127.0.0.1:4173
   ```
   *(Jika port `4173` sedang digunakan, Anda dapat mengubahnya dengan `$env:RETAILSCOPE_PORT='4174'; node server.mjs`).*

---

## 🧭 Struktur Navigasi Dashboard

| Grup | Halaman | Deskripsi & Fitur |
| :--- | :--- | :--- |
| **Analitik Bisnis** | **Ringkasan (`#overview`)** | KPI utama, grafik tren bulanan, distribusi donut segmen pelanggan, produk/kategori terlaris, dan wilayah teratas. |
| **Analitik Bisnis** | **Tren Penjualan (`#trends`)** | Filter cakupan tanggal/wilayah/kota, grafik bulanan, **Pareto 80/20 & Repeat Buyer**, produk & provinsi teratas, **Top Kota/Kabupaten**, **Distribusi Kurir**, **Pola Hari Belanja (Senin–Minggu)**, **Jam Sibuk (24 Jam)**, **Metode Pembayaran**, dan **Market Basket Analysis**. |
| **Analitik Bisnis** | **Segmentasi Pelanggan (`#segments`)** | Pengaturan $k$ K-Means, kartu profil cluster & persona bisnis, peta *scatter* `Recency × Monetary (log1p)`, grafik *Elbow Inertia*, tabel perbandingan *Silhouette*, serta tabel pelanggan dengan filter Cluster, Churn, dan pengurutan kolom. |
| **Analitik Bisnis** | **Ringkasan Eksekutif (`#executive`)** | Laporan eksekutif siap cetak PDF/Slide berisi temuan operasional, profil retensi & Pareto, peluang *bundling* produk, dan rencana aksi strategis 30–60–90 hari. |
| **Data & Pipeline** | **Dataset Transaksi (`#dataset`)** | Unggah CSV/XLSX/XLS, pratinjau data mentah, pemetaan kolom otomatis/manual, pengaturan mata uang & aturan *cleaning*, serta katalog referensi dataset Indonesia. |
| **Data & Pipeline** | **Data Cleaning (`#cleaning`)** | Jejak audit pembersihan 8 tahap, persentase kelolosan data, rumus rekonsiliasi baris, dan tombol ekspor CSV data bersih. |
| **Data & Pipeline** | **Arsitektur Big Data (`#architecture`)** | Desain *end-to-end* pipeline Apache Spark (HDFS/S3 $\rightarrow$ PySpark DataFrame $\rightarrow$ Spark MLlib K-Means), perbandingan skalabilitas, dan unduhan skrip `pyspark_pipeline.py`. |
| **Akademis & Riset** | **Backlog Proyek (`#backlog`)** | Pelacak 25 tahapan proyek riset Big Data dengan fitur centang langsung, **Tandai Otomatis Progres**, dan ekspor CSV backlog. |
| **Akademis & Riset** | **Metodologi & Riset (`#method`)** | Dokumentasi tahapan metodologi ilmiah, kesimpulan otomatis dari dataset aktif, batasan sistem, dan referensi ilmiah. |

---

## 📂 Struktur Direktori Proyek

```text
Retail-Scope/
├── dist/
│   ├── index.html            # Shell HTML utama aplikasi
│   ├── styles.css            # Sistem desain CSS modern (Light & Dark Mode responsif)
│   ├── app.js                # State management, komponen UI, grafik SVG, dan event handler
│   ├── worker.js             # Web Worker untuk pemrosesan data asinkron & penyimpanan IndexedDB
│   ├── engine.js             # Mesin analitik: parser CSV, cleaning, agregasi, Pareto, Apriori, RFM, K-Means++
│   ├── demo.csv              # Dataset transaksi sintetis retail Indonesia (10.908 baris)
│   ├── pyspark_pipeline.py   # Salinan skrip PySpark untuk diunduh langsung dari UI web
│   └── vendor/               # Pustaka SheetJS Community Edition 0.20.3 untuk pembacaan Excel
├── tests/
│   └── engine.test.cjs       # 14 rangkaian unit test otomatis untuk seluruh algoritma & kasus tepi
├── pyspark_pipeline.py       # Skrip utama pipeline Big Data terdistribusi dengan Apache Spark
├── server.mjs                # Server HTTP statis lokal berbasis Node.js (zero dependencies)
├── Mulai-RetailScope.cmd     # Pintasan eksekusi cepat untuk Windows
├── package.json              # Konfigurasi skrip npm (start, test, check)
├── VERIFIKASI.md             # Dokumentasi hasil pengujian otomatis dan verifikasi fitur
└── README.md                 # Dokumentasi utama repositori
```

---

## 🧪 Pengujian & Verifikasi Kualitas Kode

Proyek ini dilengkapi dengan pemeriksaan sintaks dan **14 pengujian unit otomatis** menggunakan *test runner* bawaan Node.js:

```powershell
# Menjalankan pemeriksaan sintaks seluruh modul JS
npm run check

# Menjalankan seluruh unit test mesin analitik, RFM, K-Means, Market Basket & Pareto
npm test
```

Untuk menjalankan pipeline Big Data dengan **Apache Spark** (memerlukan Python 3 & `pyspark`):
```bash
pip install pyspark
python pyspark_pipeline.py --input dist/demo.csv --output spark_output
```

---

## 📚 Referensi Ilmiah & Teknologi
- **K-Means & K-Means++**: [Dokumentasi scikit-learn KMeans](https://scikit-learn.org/stable/modules/generated/sklearn.cluster.KMeans.html) & [Apache Spark MLlib Clustering](https://spark.apache.org/docs/latest/ml-clustering.html)
- **Silhouette Coefficient**: [Dokumentasi scikit-learn Silhouette Score](https://scikit-learn.org/stable/modules/generated/sklearn.metrics.silhouette_score.html)
- **Pembacaan Workbook Excel**: [SheetJS Community Edition 0.20.3](https://cdn.sheetjs.com/xlsx-0.20.3/package/)
