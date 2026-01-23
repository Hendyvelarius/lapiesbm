# Panduan Lengkap Prosedur Perhitungan HPP Actual

## Pendahuluan

Prosedur `sp_COGS_Calculate_HPP_Actual` menghitung **biaya produksi sesungguhnya** dari setiap batch produk dengan menelusuri seluruh bahan yang digunakan sampai ke harga beli aktualnya.

### Gambaran Umum

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         BATCH PRODUK (DNc)                                   │
│                  "Kita produksi 24.626 tablet Produk 77"                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      BON KELUAR BAHAN (MR)                                   │
│                 "Ini bahan-bahan yang kita minta untuk produksi"            │
│                                                                              │
│   • 15.000g AC 023A                                                          │
│   • 9.000g AC 074A                                                           │
│   • 75.822 pcs B 002                                                         │
│   • ... (bahan lainnya)                                                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    BATCH BAHAN (DNc Manufacturing)                           │
│                 "Ini batch bahan spesifik yang dipakai"                      │
│                                                                              │
│   AC 023A dari batch: 1158/15/AC023A/13                                     │
│   AC 074A dari batch: 2045/16/AC074A/05                                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PENERIMAAN BARANG (TTBA)                                  │
│            "Batch bahan tersebut masuk dari penerimaan ini"                  │
│                                                                              │
│   Penerimaan: 01831/X/15/PC/TTBA/BK/PP                                      │
│   Dokumen Asal: 00021/VI/15/PG/PO/BK/LAPI (ini adalah PO!)                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PURCHASE ORDER (PO)                                       │
│                  "Ini harga beli yang sebenarnya!"                           │
│                                                                              │
│   AC 023A: $108/kg (USD)                                                    │
│   AC 074A: $64/kg (USD)                                                     │
│   B 002: Rp 1.230/pcs (IDR)                                                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Penjelasan Tabel-Tabel

### 1. `t_dnc_product` - Tabel Batch Produk Jadi
**Fungsi:** Mencatat data batch produk jadi yang sudah selesai diproduksi.

| Kolom | Keterangan | Contoh |
|-------|------------|--------|
| `DNc_No` | Nomor batch unik | `00138/I/26/QA/DPJ` |
| `DNc_ProductID` | Kode produk | `77` |
| `DNc_BatchNo` | Nomor batch | `77016` |
| `DNC_TempelLabel` | Tanggal tempel label (batch selesai) | `2026-01-19` |
| `DNC_Diluluskan` | Jumlah output (unit diproduksi) | `24.626` |

**Artinya:** "Kita sudah produksi batch 77016 dari produk 77, totalnya 24.626 unit, selesai tanggal 19 Januari 2026"

---

### 2. `t_Bon_Keluar_Bahan_Awal_Header` - Header Bon Keluar Bahan (MR)
**Fungsi:** Mencatat permintaan pengeluaran bahan dari gudang untuk produksi.

| Kolom | Keterangan | Contoh |
|-------|------------|--------|
| `MR_No` | Nomor Bon Keluar | `00117/I/16/PN/MR` |
| `MR_ProductID` | Untuk produk mana | `77` |
| `MR_BatchNo` | Untuk batch mana | `77016` |

**Artinya:** "Bon keluar #00117 dibuat untuk mengambil bahan-bahan produk 77, batch 77016"

---

### 3. `t_Bon_Keluar_Bahan_Awal_DNc` - Detail Bon Keluar Bahan (MR Detail)
**Fungsi:** Mencatat bahan apa saja yang diminta dan batch bahan mana yang digunakan.

| Kolom | Keterangan | Contoh |
|-------|------------|--------|
| `MR_No` | Nomor Bon Keluar | `00117/I/16/PN/MR` |
| `MR_SeqID` | Nomor baris | `1` |
| `MR_ItemID` | Kode bahan | `AC 023A` |
| `MR_DNcQTY` | Jumlah yang dipakai | `15.000` (gram) |
| `MR_DNcNo` | **Batch bahan mana yang dipakai** | `1158/15/AC023A/13` |

**Artinya:** "Baris 1 dari MR #00117: Kita pakai 15.000g AC 023A, spesifiknya dari batch bahan 1158/15/AC023A/13"

**Poin Penting:** Kolom `MR_DNcNo` sangat krusial - ini menunjukkan BATCH BAHAN MANA yang terpakai. Ini kunci untuk menelusuri balik ke harga beli aktual.

---

### 4. `t_DNc_Manufacturing` - Tabel Batch Bahan Baku
**Fungsi:** Mencatat batch-batch bahan baku yang ada di gudang.

| Kolom | Keterangan | Contoh |
|-------|------------|--------|
| `DNc_No` | Nomor batch bahan | `1158/15/AC023A/13` |
| `DNc_UnitID` | Satuan bahan ini | `g` (gram) |
| `DNc_TTBANo` | Nomor dokumen penerimaan | `01831/X/15/PC/TTBA/BK/PP` |
| `DNc_TTBASeqID` | Nomor baris penerimaan | `1` |
| `DNc_BeforeNo` | Batch sebelumnya (untuk bahan reproses) | `NULL` atau batch lain |

**Artinya:** "Batch bahan 1158/15/AC023A/13 diterima melalui TTBA 01831/X/15/PC/TTBA/BK/PP, baris 1"

---

### 5. `t_ttba_manufacturing_detail` - Detail Penerimaan Barang (TTBA)
**Fungsi:** Mencatat bahan-bahan yang diterima masuk ke gudang.

| Kolom | Keterangan | Contoh |
|-------|------------|--------|
| `TTBA_No` | Nomor dokumen penerimaan | `01831/X/15/PC/TTBA/BK/PP` |
| `TTBA_SeqID` | Nomor baris | `1` |
| `TTBA_SourceDocNo` | **Dokumen asal** | `00021/VI/15/PG/PO/BK/LAPI` |
| `TTBA_SourceDocSeqID` | Nomor baris dokumen asal | `1` |
| `TTBA_BatchNo` | Info batch | (bervariasi) |

**Artinya:** "Baris 1 dari TTBA #01831 berasal dari PO #00021, baris 1"

**Poin Penting:** Kolom `TTBA_SourceDocNo` menunjukkan asal bahan:
- Jika berakhiran `/PO/...` → Bahan dari Purchase Order (bisa dapat harga!)
- Jika berakhiran `/MR` → Bahan dari MR lain (perlu telusur lebih lanjut)
- Jika berakhiran `/BPHP` → Bahan granul dari batch produksi lain

---

### 6. `t_PO_Manufacturing_Detail` - Detail Purchase Order
**Fungsi:** Menyimpan data purchase order lengkap dengan harganya.

| Kolom | Keterangan | Contoh |
|-------|------------|--------|
| `PO_No` | Nomor PO | `00021/VI/15/PG/PO/BK/LAPI` |
| `PO_SeqID` | Nomor baris | `1` |
| `PO_UnitPrice` | **Harga beli aktual** | `108` |
| `PO_Currency` | Mata uang | `USD` |
| `PO_ItemUnit` | Satuan harga | `kg` |

**Artinya:** "Kita beli bahan ini seharga $108 per kg"

---

### 7. `M_COGS_STD_HRG_BAHAN` - Harga Standar Bahan
**Fungsi:** Harga standar sebagai cadangan jika tidak bisa telusur ke PO aktual.

| Kolom | Keterangan | Contoh |
|-------|------------|--------|
| `ITEM_ID` | Kode bahan | `AC 023A` |
| `ITEM_TYPE` | BB (bahan baku) atau BK (bahan kemas) | `BB` |
| `ITEM_PURCHASE_STD_PRICE` | Harga standar | `1.800.000` |
| `ITEM_CURRENCY` | Mata uang | `IDR` |
| `ITEM_PURCHASE_UNIT` | Satuan | `kg` |

**Artinya:** "Kalau tidak ketemu harga aktual, pakai Rp 1.800.000 per kg sebagai standar"

---

### 8. `m_Item_manufacturing` - Master Bahan
**Fungsi:** Data master bahan termasuk BJ (Berat Jenis / Specific Gravity).

| Kolom | Keterangan | Contoh |
|-------|------------|--------|
| `Item_ID` | Kode bahan | `AC 183` |
| `Item_BJ` | Berat Jenis (densitas) | `1.05` |
| `Item_Unit` | Satuan pemakaian | `g` |
| `Item_PurchaseUnit` | Satuan pembelian | `L` |

**Artinya:** "Bahan AC 183 punya densitas 1,05 kg/L, jadi 1 liter beratnya 1,05 kg"

**Poin Penting:** `Item_BJ` digunakan untuk konversi antara gram dan liter:
- Kalau kita pakai 1000g dan beli dalam L, dengan BJ=1,05
- 1000g = 1kg = 1/1,05 L = 0,952 L

---

### 9. `M_COGS_Unit_Conversion` - Tabel Konversi Satuan
**Fungsi:** Menyimpan faktor konversi satuan standar.

| Dari_Satuan | Ke_Satuan | Faktor_Konversi |
|-------------|-----------|-----------------|
| g | kg | 0,001 |
| mL | L | 0,001 |
| mg | kg | 0,000001 |
| pcs | ribu pcs | 0,001 |

**Artinya:** "Untuk mengubah gram ke kilogram, kalikan dengan 0,001"

---

### 10. `m_COGS_Daily_Currency` - Kurs Harian
**Fungsi:** Menyimpan nilai tukar mata uang asing harian.

| Kolom | Keterangan | Contoh |
|-------|------------|--------|
| `date` | Tanggal | `2026-01-19` |
| `USD` | Kurs USD ke IDR | `16.853` |
| `EUR` | Kurs EUR ke IDR | `17.500` |
| ... | Mata uang lainnya | ... |

**Artinya:** "Tanggal 19 Januari 2026, $1 USD = Rp 16.853"

---

## Alur Relasi Antar Tabel

Beginilah cara kita menghubungkan semua tabel:

```sql
t_Bon_Keluar_Bahan_Awal_Header (MR Header)
    │
    │ JOIN ON: MR_No
    ▼
t_Bon_Keluar_Bahan_Awal_DNc (MR Detail)
    │
    │ JOIN ON: MR_DNcNo = DNc_No
    ▼
t_DNc_Manufacturing (Batch Bahan)
    │
    │ JOIN ON: DNc_TTBANo = TTBA_No AND DNc_TTBASeqID = TTBA_SeqID
    ▼
t_ttba_manufacturing_detail (Penerimaan Barang)
    │
    │ JOIN ON: TTBA_SourceDocNo = PO_No AND TTBA_SourceDocSeqID = PO_SeqID
    ▼
t_PO_Manufacturing_Detail (Purchase Order) → 💰 HARGA AKTUAL!
```

**Dalam bahasa sehari-hari:**
1. Mulai dari MR Header (produk mana yang dibuat)
2. Ambil MR Detail (bahan apa dan berapa banyak)
3. Cari batch bahan mana yang dipakai
4. Cari bagaimana batch tersebut diterima
5. Cari purchase order yang memasukkannya
6. Dapat harga beli aktualnya!

---

## Jenis Sumber Harga

Tidak semua bahan bisa ditelusuri langsung ke PO. Berikut skenario yang berbeda:

### 1. **PO** - Langsung dari Purchase Order (97% kasus)
```
Bahan → Batch Bahan → Penerimaan → PO ✓
```
Harga beli aktual ditemukan langsung.

### 2. **MR** - Dari Bon Keluar Lain (Bahan Reproses/Daur Ulang)
```
Bahan → Batch Bahan → Penerimaan → MR Lain → ... → Akhirnya PO
```
Bahan berasal dari proses ulang. Kita telusur rekursif sampai 5 level.

### 3. **BPHP** - Granul dari Batch Produksi Lain
```
Bahan → Batch Bahan → Penerimaan → Batch BPHP
```
Bahan adalah granul/produk antara. Kita gunakan total biaya batch tersebut ÷ output.

### 4. **STD** - Harga Standar (Cadangan)
```
Bahan → ??? (rantai putus) → Pakai harga standar dari M_COGS_STD_HRG_BAHAN
```
Tidak bisa telusur ke harga aktual, gunakan harga standar/budget.

### 5. **UNLINKED** - Tidak Ada Harga
```
Bahan → ??? (rantai putus) → Tidak ada harga standar juga → Biaya = 0
```
**Ini masalah kualitas data!** Perlu investigasi lebih lanjut.

---

## Logika Konversi Satuan

### Masalah
- Produksi menggunakan bahan dalam **gram (g)** atau **mililiter (mL)**
- Pembelian dilakukan dalam **kilogram (kg)** atau **liter (L)**
- Kita perlu konversi untuk menghitung biaya yang benar

### Solusi

#### Konversi Standar (dari tabel `M_COGS_Unit_Conversion`):
| Pemakaian | Pembelian | Faktor | Contoh |
|-----------|-----------|--------|--------|
| g | kg | 0,001 | 15.000g × 0,001 = 15 kg |
| mL | L | 0,001 | 500mL × 0,001 = 0,5 L |
| pcs | ribu pcs | 0,001 | 5.000 pcs × 0,001 = 5 ribu pcs |

#### Konversi Berbasis Densitas (g → L menggunakan Item_BJ):
Ketika bahan **dipakai dalam gram** tapi **dibeli dalam liter**, kita butuh berat jenis (densitas):

```
Rumus: gram × 0,001 / Item_BJ = liter

Contoh: AC 183 dengan BJ = 1,05
- Pemakaian: 47.250g
- Langkah 1: Konversi ke kg = 47.250 × 0,001 = 47,25 kg
- Langkah 2: Konversi kg ke L = 47,25 / 1,05 = 45 L
- Faktor gabungan = 0,001 / 1,05 = 0,000952
```

---

## Perhitungan Biaya

### Untuk Setiap Baris Bahan:
```
Total Biaya = Qty_Dalam_Satuan_PO × Harga_Satuan × Kurs

Dimana:
- Qty_Dalam_Satuan_PO = Qty_Pemakaian × Faktor_Konversi
- Kurs = 1 untuk IDR, atau nilai dari m_COGS_Daily_Currency
```

### Contoh:
```
Bahan: AC 023A
- Qty_Pemakaian: 15.000g
- Satuan_Pemakaian: g
- Satuan_PO: kg
- Faktor_Konversi: 0,001
- Qty_Dalam_Satuan_PO: 15.000 × 0,001 = 15 kg
- Harga_Satuan: $108 (USD)
- Kurs: 16.853 (USD ke IDR)
- Harga_Satuan_IDR: 108 × 16.853 = Rp 1.820.124/kg

Total Biaya = 15 kg × Rp 1.820.124/kg = Rp 27.301.860
```

---

## Tabel Hasil

### `t_COGS_HPP_Actual_Header` - Ringkasan per Batch
Satu baris per batch produk dengan total:

| Kolom | Keterangan | Sumber Data |
|-------|------------|-------------|
| `DNc_No` | Nomor batch produk | t_dnc_product |
| `DNc_ProductID` | Kode produk | t_dnc_product |
| `Product_Name` | Nama produk | m_Product |
| `BatchNo` | Nomor batch | t_dnc_product |
| `Periode` | Periode (YYYYMM) | Dihitung dari tanggal batch |
| `LOB` | Line of Business | vw_COGS_Product_Group |
| `Group_PNCategory` | Kode kategori | M_COGS_PRODUCT_GROUP_MANUAL |
| `Group_PNCategory_Name` | Nama kategori | M_COGS_PRODUCT_GROUP_MANUAL |
| `Group_PNCategory_Dept` | Departemen | M_COGS_PRODUCT_GROUP_MANUAL |
| `Output_Actual` | Unit yang diproduksi | t_dnc_product.DNC_Diluluskan |
| `Batch_Size_Std` | Ukuran batch standar | M_COGS_PRODUCT_FORMULA_FIX.Std_Output |
| `Rendemen_Std` | Rendemen standar % | M_COGS_PRODUCT_GROUP_MANUAL.Group_Rendemen |
| `Rendemen_Actual` | Rendemen aktual % | Dihitung: (Output_Actual × 100) / Batch_Size_Std |
| `MH_Proses_Std` | Man-hours proses standar | M_COGS_PRODUCT_GROUP_MANUAL |
| `MH_Kemas_Std` | Man-hours kemas standar | M_COGS_PRODUCT_GROUP_MANUAL |
| `MH_Timbang_BB` | Man-hours timbang BB standar | M_COGS_PRODUCT_GROUP_MANUAL |
| `MH_Timbang_BK` | Man-hours timbang BK standar | M_COGS_PRODUCT_GROUP_MANUAL |
| `MH_Analisa_Std` | Man-hours analisa standar | M_COGS_PRODUCT_GROUP_MANUAL |
| `MH_Mesin_Std` | Jam mesin standar | M_COGS_PRODUCT_GROUP_MANUAL |
| `Total_Cost_BB` | Total biaya bahan baku | Dihitung |
| `Total_Cost_BK` | Total biaya bahan kemas | Dihitung |
| `Count_Materials_PO` | Bahan yang telusur ke PO | Dihitung |
| `Count_Materials_MR` | Bahan yang telusur via rantai MR | Dihitung |
| `Count_Materials_BPHP` | Bahan dari batch granul | Dihitung |
| `Count_Materials_STD` | Bahan pakai harga standar | Dihitung |
| `Count_Materials_UNLINKED` | Bahan tanpa harga (masalah data!) | Dihitung |

### `t_COGS_HPP_Actual_Detail` - Detail per Bahan
Satu baris per batch bahan unik yang digunakan:

| Kolom | Keterangan | Sumber Data |
|-------|------------|-------------|
| `Item_ID` | Kode bahan | MR Detail |
| `Item_Name` | Nama bahan | m_Item_manufacturing |
| `Item_Type` | BB atau BK | MR Detail |
| `Item_Unit` | Satuan master bahan | m_Item_manufacturing |
| `Qty_Used` | Jumlah dalam satuan pemakaian (g, mL, pcs) | MR Detail (diagregasi) |
| `Qty_Required` | Jumlah standar dari formula | t_COGS_HPP_Product_Detail_Formula.PPI_QTY |
| `Usage_Unit` | Satuan yang dipakai di produksi | t_DNc_Manufacturing |
| `PO_Unit` | Satuan di purchase order | Detail PO |
| `Item_BJ` | Berat jenis (untuk g↔L) | m_Item_manufacturing |
| `Unit_Conversion_Factor` | Faktor konversi satuan pemakaian ke PO | M_COGS_Unit_Conversion atau dihitung |
| `Qty_In_PO_Unit` | Jumlah dalam satuan PO | Dihitung |
| `Unit_Price` | Harga per satuan PO (mata uang asli) | Detail PO |
| `Currency_Original` | Mata uang asli (USD, EUR, IDR, dll) | Detail PO |
| `Exchange_Rate` | Kurs yang digunakan | m_COGS_Daily_Currency |
| `Unit_Price_IDR` | Harga dalam IDR | Dihitung |
| `Price_Source` | PO, MR, BPHP, STD, atau UNLINKED | Hasil penelusuran |
| `MR_No` | Nomor bon keluar bahan | MR Header |
| `MR_SeqID` | Nomor baris bon keluar | MR Detail |
| `MR_DNcNo` | Batch bahan mana yang dipakai | MR Detail |
| `DNc_Material` | Nomor batch bahan | t_DNc_Manufacturing |
| `DNc_Original` | Batch asal (jika reproses) | t_DNc_Manufacturing.DNc_BeforeNo |
| `TTBA_No` | Nomor penerimaan barang | t_DNc_Manufacturing |
| `TTBA_SeqID` | Nomor baris penerimaan | t_DNc_Manufacturing |
| `PO_No` | PO mana (jika bisa ditelusur) | Hasil penelusuran |

---

## Parameter Prosedur

```sql
EXEC sp_COGS_Calculate_HPP_Actual
    @Periode = '202601',           -- Hitung semua batch di Januari 2026
    @DNcNo = NULL,                 -- Atau tentukan satu batch spesifik
    @RecalculateExisting = 0,      -- 0 = lewati yang sudah ada, 1 = hitung ulang
    @Debug = 0                     -- 1 = tampilkan pesan progress
```

### Contoh Penggunaan:

```sql
-- Hitung semua batch Januari 2026 (lewati yang sudah dihitung)
EXEC sp_COGS_Calculate_HPP_Actual @Periode = '202601'

-- Hitung ulang satu batch spesifik
EXEC sp_COGS_Calculate_HPP_Actual @DNcNo = '00138/I/26/QA/DPJ', @RecalculateExisting = 1

-- Hitung ulang seluruh bulan dengan output debug
EXEC sp_COGS_Calculate_HPP_Actual @Periode = '202601', @RecalculateExisting = 1, @Debug = 1
```

---

## Diagram Alur Visual

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           sp_COGS_Calculate_HPP_Actual                       │
└──────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ LANGKAH 1: Cari batch yang akan diproses                                     │
│ ────────────────────────────────────────                                     │
│ FROM t_dnc_product                                                           │
│ WHERE periode = @Periode OR DNc_No = @DNcNo                                  │
└──────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ LANGKAH 2: Untuk setiap batch, kumpulkan data bahan                          │
│ ───────────────────────────────────────────────────                          │
│                                                                              │
│   MR Header (produk apa)                                                     │
│       ↓                                                                      │
│   MR Detail (bahan apa + berapa banyak)                                      │
│       ↓                                                                      │
│   Batch Bahan (batch spesifik mana)                                          │
│       ↓                                                                      │
│   Penerimaan Barang (bagaimana masuknya)                                     │
│       ↓                                                                      │
│   Detail PO (harga beli aktual!)                                             │
│                                                                              │
│   AGREGASI berdasarkan Item_ID + MR_DNcNo untuk hindari duplikat             │
└──────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ LANGKAH 3: Tangani sumber harga khusus                                       │
│ ──────────────────────────────────────                                       │
│                                                                              │
│   JIKA sumber adalah MR → Telusur rekursif (maksimal 5 level)                │
│   JIKA sumber adalah BPHP → Ambil biaya dari perhitungan batch tersebut      │
│   JIKA masih tidak ada harga → Pakai harga standar dari M_COGS_STD_HRG_BAHAN │
│   JIKA masih tidak ada harga → Tandai sebagai UNLINKED (masalah data)        │
└──────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ LANGKAH 4: Terapkan konversi satuan                                          │
│ ───────────────────────────────────                                          │
│                                                                              │
│   Cek M_COGS_Unit_Conversion untuk konversi standar (g→kg, mL→L)             │
│   Cek m_Item_manufacturing.Item_BJ untuk berbasis densitas (g→L)             │
│   Hitung: Qty_Dalam_Satuan_PO = Qty_Pemakaian × Faktor_Konversi              │
└──────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ LANGKAH 5: Terapkan konversi mata uang                                       │
│ ──────────────────────────────────────                                       │
│                                                                              │
│   Ambil kurs dari m_COGS_Daily_Currency                                      │
│   Gunakan kurs dari tanggal batch (atau tanggal terdekat sebelumnya)         │
│   Hitung: Harga_Satuan_IDR = Harga_Satuan × Kurs                             │
└──────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ LANGKAH 6: Hitung total dan simpan                                           │
│ ─────────────────────────────────                                            │
│                                                                              │
│   Total_Biaya = Qty_Dalam_Satuan_PO × Harga_Satuan_IDR                       │
│   Jumlahkan berdasarkan Item_Type (BB vs BK)                                 │
│   Simpan ke t_COGS_HPP_Actual_Header dan t_COGS_HPP_Actual_Detail            │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Masalah Umum & Penanganannya

### Masalah: Banyak bahan UNLINKED
**Penyebab:** Rantai penelusuran putus - tidak bisa menemukan PO asal
**Solusi:** Investigasi bahan-bahan tersebut - mungkin data lama atau kesalahan input

### Masalah: Item_BJ kosong untuk konversi g→L
**Penyebab:** Densitas belum diisi di m_Item_manufacturing
**Solusi:** Tambahkan nilai Item_BJ ke master bahan
**Workaround saat ini:** Fallback ke faktor=1 (asumsi 1g = 1mL, yang sebenarnya salah!)

### Masalah: Harga berbeda untuk bahan yang sama
**Penjelasan:** Setiap batch bahan mungkin punya harga berbeda tergantung kapan dibelinya
**Ini sudah benar!** Itulah inti dari perhitungan biaya "aktual".

---

## Ringkasan

Prosedur ini menelusuri perjalanan lengkap setiap bahan:

```
Produk Jadi → Bahan yang Dipakai → Batch Bahan → Penerimaan → Purchase Order → HARGA!
```

Dengan penanganan yang tepat untuk:
- ✅ Berbagai mata uang (USD, EUR, dll) dengan kurs harian
- ✅ Konversi satuan (g→kg, mL→L, g→L dengan densitas)
- ✅ Penelusuran rekursif untuk bahan reproses
- ✅ Fallback ke harga standar bila diperlukan
- ✅ Penandaan jelas untuk bahan yang tidak terhubung (indikator kualitas data)
- ✅ Data penelusuran lengkap (referensi MR, TTBA, DNc)
- ✅ Perbandingan formula standar (Qty_Required vs Qty_Used)
- ✅ Perhitungan Rendemen (yield)

---

## Riwayat Versi

### v3 (Januari 2026) - Pengisian Data Lengkap
**Peningkatan Utama:** Mengisi semua field yang sebelumnya kosong di tabel Header dan Detail.

**Penambahan di Tabel Header:**
- `Product_Name` - Dari master m_Product
- `LOB` - Line of Business dari vw_COGS_Product_Group
- `Group_PNCategory`, `Group_PNCategory_Name`, `Group_PNCategory_Dept` - Info kategori dari M_COGS_PRODUCT_GROUP_MANUAL
- `Batch_Size_Std` - Ukuran batch standar dari M_COGS_PRODUCT_FORMULA_FIX
- `Rendemen_Std`, `Rendemen_Actual` - Persentase rendemen (aktual dihitung dari output vs batch size standar)
- `MH_Proses_Std`, `MH_Kemas_Std`, `MH_Timbang_BB`, `MH_Timbang_BK`, `MH_Analisa_Std`, `MH_Mesin_Std` - Standar man-hours

**Penambahan di Tabel Detail:**
- `Item_Name`, `Item_Unit` - Dari master m_Item_manufacturing
- `Qty_Required` - Jumlah standar dari formula (t_COGS_HPP_Product_Detail_Formula)
- `MR_No`, `MR_SeqID` - Referensi MR lengkap
- `DNc_Material`, `DNc_Original` - Penelusuran batch bahan
- `TTBA_No`, `TTBA_SeqID` - Penelusuran penerimaan barang

**Tingkat Pengisian yang Tercapai (Periode 202601):**
- Header: Product_Name 100%, LOB 99%, Batch_Size_Std 100%, Rendemen_Actual 100%
- Detail: Item_Name 99,95%, Item_Unit 100%, Qty_Required 77%, MR_No 100%, TTBA_No 98%

### v2 (Januari 2026) - Konversi Satuan & Perbaikan Duplikat
- Perbaikan konversi g→L menggunakan Item_BJ (berat jenis)
- Perbaikan logika agregasi bahan duplikat
- Penambahan agregasi yang tepat berdasarkan Item_ID + MR_DNcNo

### v1 (Januari 2026) - Rilis Awal
- Penelusuran harga PO dasar
- Penelusuran rekursif rantai MR
- Penanganan biaya batch BPHP
- Fallback ke harga standar
- Konversi mata uang

---

## Glosarium Istilah

| Istilah | Kepanjangan | Keterangan |
|---------|-------------|------------|
| DNc | Dokumen Nomor cetak | Nomor batch, baik untuk produk jadi maupun bahan |
| MR | Material Request | Bon keluar bahan dari gudang |
| TTBA | Tanda Terima Barang Awal | Dokumen penerimaan barang masuk |
| PO | Purchase Order | Dokumen pembelian ke supplier |
| BB | Bahan Baku | Bahan aktif dan non-aktif untuk produksi |
| BK | Bahan Kemas | Bahan kemasan (botol, label, dus, dll) |
| BJ | Berat Jenis | Densitas/specific gravity suatu cairan |
| BPHP | Bon Pengeluaran Hasil Produksi | Dokumen output dari produksi (granul/WIP) |
| HPP | Harga Pokok Produksi | Total biaya untuk memproduksi satu unit |
