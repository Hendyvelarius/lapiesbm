# HPP Actual Calculation Procedure - Complete Guide

## Overview

The `sp_COGS_Calculate_HPP_Actual` procedure calculates the **true manufacturing cost** of a product batch by tracing every material used back to its actual purchase price.

### The Big Picture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PRODUCT BATCH (DNc)                                  │
│                    "We made 24,626 tablets of Product 77"                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      MATERIAL REQUEST (MR)                                   │
│               "We requested these materials to make it"                      │
│                                                                              │
│   • 15,000g of AC 023A                                                       │
│   • 9,000g of AC 074A                                                        │
│   • 75,822 pcs of B 002                                                      │
│   • ... (more materials)                                                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    MATERIAL BATCHES (DNc Manufacturing)                      │
│              "These specific material batches were used"                     │
│                                                                              │
│   AC 023A came from batch: 1158/15/AC023A/13                                │
│   AC 074A came from batch: 2045/16/AC074A/05                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    GOODS RECEIPT (TTBA)                                      │
│         "Those material batches came from these receipts"                    │
│                                                                              │
│   Receipt: 01831/X/15/PC/TTBA/BK/PP                                         │
│   Source Document: 00021/VI/15/PG/PO/BK/LAPI (this is a PO!)               │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PURCHASE ORDER (PO)                                       │
│              "Here's the actual price we paid!"                              │
│                                                                              │
│   AC 023A: $108/kg (USD)                                                    │
│   AC 074A: $64/kg (USD)                                                     │
│   B 002: Rp 1,230/pcs (IDR)                                                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## The Tables Explained

### 1. `t_dnc_product` - Product Batch Table
**What it is:** The main record of a finished product batch.

| Column | Meaning | Example |
|--------|---------|---------|
| `DNc_No` | Unique batch ID | `00138/I/26/QA/DPJ` |
| `DNc_ProductID` | Product code | `77` |
| `DNc_BatchNo` | Batch number | `77016` |
| `DNC_TempelLabel` | Label date (when batch was completed) | `2026-01-19` |
| `DNC_Diluluskan` | Output quantity (units produced) | `24,626` |

**Think of it as:** "We made batch 77016 of product 77, totaling 24,626 units, finished on Jan 19, 2026"

---

### 2. `t_Bon_Keluar_Bahan_Awal_Header` - Material Request Header (MR Header)
**What it is:** A request to withdraw materials from warehouse for production.

| Column | Meaning | Example |
|--------|---------|---------|
| `MR_No` | Material Request number | `00117/I/16/PN/MR` |
| `MR_ProductID` | For which product | `77` |
| `MR_BatchNo` | For which batch | `77016` |

**Think of it as:** "Material request #00117 was made to get materials for product 77, batch 77016"

---

### 3. `t_Bon_Keluar_Bahan_Awal_DNc` - Material Request Detail (MR Detail)
**What it is:** The individual line items of what materials were requested and which specific material batches were used.

| Column | Meaning | Example |
|--------|---------|---------|
| `MR_No` | Links to MR Header | `00117/I/16/PN/MR` |
| `MR_SeqID` | Line number | `1` |
| `MR_ItemID` | Material code | `AC 023A` |
| `MR_DNcQTY` | Quantity used | `15,000` (in grams) |
| `MR_DNcNo` | **Which material batch was used** | `1158/15/AC023A/13` |

**Think of it as:** "Line 1 of MR #00117: We used 15,000g of AC 023A, specifically from material batch 1158/15/AC023A/13"

**Key Insight:** The `MR_DNcNo` is crucial - it tells us WHICH specific material batch was consumed. This is our link to trace back to the actual purchase price.

---

### 4. `t_DNc_Manufacturing` - Material Batch Table
**What it is:** Records of raw material batches in the warehouse.

| Column | Meaning | Example |
|--------|---------|---------|
| `DNc_No` | Material batch ID | `1158/15/AC023A/13` |
| `DNc_UnitID` | Unit of this material | `g` (gram) |
| `DNc_TTBANo` | Receipt document number | `01831/X/15/PC/TTBA/BK/PP` |
| `DNc_TTBASeqID` | Receipt line number | `1` |
| `DNc_BeforeNo` | Previous batch (for reprocessed materials) | `NULL` or another batch |

**Think of it as:** "Material batch 1158/15/AC023A/13 was received via goods receipt 01831/X/15/PC/TTBA/BK/PP, line 1"

---

### 5. `t_ttba_manufacturing_detail` - Goods Receipt Detail (TTBA)
**What it is:** Records of materials received into the warehouse.

| Column | Meaning | Example |
|--------|---------|---------|
| `TTBA_No` | Receipt document number | `01831/X/15/PC/TTBA/BK/PP` |
| `TTBA_SeqID` | Line number | `1` |
| `TTBA_SourceDocNo` | **Where it came from** | `00021/VI/15/PG/PO/BK/LAPI` |
| `TTBA_SourceDocSeqID` | Source line number | `1` |
| `TTBA_BatchNo` | Batch info | (varies) |

**Think of it as:** "Receipt line 1 of TTBA #01831 came from PO #00021, line 1"

**Key Insight:** `TTBA_SourceDocNo` tells us the source:
- If it ends with `/PO/...` → Material came from a Purchase Order (we can get the price!)
- If it ends with `/MR` → Material came from another MR (need to trace further)
- If it ends with `/BPHP` → Material is a granule from another production batch

---

### 6. `t_PO_Manufacturing_Detail` - Purchase Order Detail
**What it is:** The actual purchase orders with prices.

| Column | Meaning | Example |
|--------|---------|---------|
| `PO_No` | PO document number | `00021/VI/15/PG/PO/BK/LAPI` |
| `PO_SeqID` | Line number | `1` |
| `PO_UnitPrice` | **The actual price paid** | `108` |
| `PO_Currency` | Currency | `USD` |
| `PO_ItemUnit` | Unit of price | `kg` |

**Think of it as:** "We bought this material at $108 per kg"

---

### 7. `M_COGS_STD_HRG_BAHAN` - Standard Material Prices
**What it is:** Fallback standard prices when we can't trace to actual PO.

| Column | Meaning | Example |
|--------|---------|---------|
| `ITEM_ID` | Material code | `AC 023A` |
| `ITEM_TYPE` | BB (raw) or BK (packaging) | `BB` |
| `ITEM_PURCHASE_STD_PRICE` | Standard price | `1,800,000` |
| `ITEM_CURRENCY` | Currency | `IDR` |
| `ITEM_PURCHASE_UNIT` | Unit | `kg` |

**Think of it as:** "If we can't find the actual price, use Rp 1,800,000 per kg as the standard"

---

### 8. `m_Item_manufacturing` - Item Master
**What it is:** Master data for materials including specific gravity (BJ).

| Column | Meaning | Example |
|--------|---------|---------|
| `Item_ID` | Material code | `AC 183` |
| `Item_BJ` | Specific gravity (density) | `1.05` |
| `Item_Unit` | Usage unit | `g` |
| `Item_PurchaseUnit` | Purchase unit | `L` |

**Think of it as:** "Material AC 183 has density 1.05 kg/L, so 1 liter weighs 1.05 kg"

**Key Insight:** `Item_BJ` is used for converting between grams and liters:
- If we use 1000g and buy in L, with BJ=1.05
- 1000g = 1kg = 1/1.05 L = 0.952 L

---

### 9. `M_COGS_Unit_Conversion` - Unit Conversion Table
**What it is:** Standard unit conversions.

| From_Unit | To_Unit | Conversion_Factor |
|-----------|---------|-------------------|
| g | kg | 0.001 |
| mL | L | 0.001 |
| mg | kg | 0.000001 |
| pcs | ribu pcs | 0.001 |

**Think of it as:** "To convert grams to kilograms, multiply by 0.001"

---

### 10. `m_COGS_Daily_Currency` - Currency Exchange Rates
**What it is:** Daily exchange rates for foreign currencies.

| Column | Meaning | Example |
|--------|---------|---------|
| `date` | Date | `2026-01-19` |
| `USD` | USD to IDR rate | `16,853` |
| `EUR` | EUR to IDR rate | `17,500` |
| ... | Other currencies | ... |

**Think of it as:** "On Jan 19, 2026, $1 USD = Rp 16,853"

---

## The Complete Join Chain

Here's how we connect everything:

```sql
t_Bon_Keluar_Bahan_Awal_Header (MR Header)
    │
    │ JOIN ON: MR_No
    ▼
t_Bon_Keluar_Bahan_Awal_DNc (MR Detail)
    │
    │ JOIN ON: MR_DNcNo = DNc_No
    ▼
t_DNc_Manufacturing (Material Batch)
    │
    │ JOIN ON: DNc_TTBANo = TTBA_No AND DNc_TTBASeqID = TTBA_SeqID
    ▼
t_ttba_manufacturing_detail (Goods Receipt)
    │
    │ JOIN ON: TTBA_SourceDocNo = PO_No AND TTBA_SourceDocSeqID = PO_SeqID
    ▼
t_PO_Manufacturing_Detail (Purchase Order) → 💰 ACTUAL PRICE!
```

**In plain English:**
1. Start with MR Header (what product batch we're making)
2. Get MR Details (what materials and quantities)
3. Find which material batches were used
4. Find how those batches were received
5. Find the purchase order that brought them in
6. Get the actual price paid!

---

## Price Source Types

Not all materials can be traced directly to a PO. Here are the different scenarios:

### 1. **PO** - Direct Purchase Order (97% of cases)
```
Material → Material Batch → Goods Receipt → PO ✓
```
We found the actual purchase price directly.

### 2. **MR** - From Another Material Request (Reprocessed/Recycled)
```
Material → Material Batch → Goods Receipt → Another MR → ... → Eventually PO
```
The material came from reprocessing. We trace recursively up to 5 levels.

### 3. **BPHP** - Granule from Another Production Batch
```
Material → Material Batch → Goods Receipt → BPHP batch
```
The material is a granule/intermediate product. We use that batch's total cost ÷ output.

### 4. **STD** - Standard Price (Fallback)
```
Material → ??? (broken chain) → Use standard price from M_COGS_STD_HRG_BAHAN
```
Can't trace to actual price, use the standard/budgeted price.

### 5. **UNLINKED** - No Price Found
```
Material → ??? (broken chain) → No standard price either → Cost = 0
```
**This is a data quality issue!** These need investigation.

---

## Unit Conversion Logic

### Problem
- Production uses materials in **grams (g)** or **milliliters (mL)**
- Purchases are made in **kilograms (kg)** or **liters (L)**
- We need to convert to calculate the correct cost

### Solution

#### Standard Conversions (from `M_COGS_Unit_Conversion` table):
| Usage | Purchase | Factor | Example |
|-------|----------|--------|---------|
| g | kg | 0.001 | 15,000g × 0.001 = 15 kg |
| mL | L | 0.001 | 500mL × 0.001 = 0.5 L |
| pcs | ribu pcs | 0.001 | 5,000 pcs × 0.001 = 5 ribu pcs |

#### Density-Based Conversion (g → L using Item_BJ):
When material is **used in grams** but **purchased in liters**, we need the specific gravity (density):

```
Formula: grams × 0.001 / Item_BJ = liters

Example: AC 183 with BJ = 1.05
- Used: 47,250g
- Step 1: Convert to kg = 47,250 × 0.001 = 47.25 kg
- Step 2: Convert kg to L = 47.25 / 1.05 = 45 L
- Combined factor = 0.001 / 1.05 = 0.000952
```

---

## Cost Calculation

### For Each Material Line:
```
Total Cost = Qty_In_PO_Unit × Unit_Price × Exchange_Rate

Where:
- Qty_In_PO_Unit = Qty_Used × Unit_Conversion_Factor
- Exchange_Rate = 1 for IDR, or rate from m_COGS_Daily_Currency
```

### Example:
```
Material: AC 023A
- Qty_Used: 15,000g
- Usage_Unit: g
- PO_Unit: kg
- Conversion_Factor: 0.001
- Qty_In_PO_Unit: 15,000 × 0.001 = 15 kg
- Unit_Price: $108 (USD)
- Exchange_Rate: 16,853 (USD to IDR)
- Unit_Price_IDR: 108 × 16,853 = Rp 1,820,124/kg

Total Cost = 15 kg × Rp 1,820,124/kg = Rp 27,301,860
```

---

## The Result Tables

### `t_COGS_HPP_Actual_Header` - Batch Summary
One row per product batch with totals:

| Column | Meaning | Source |
|--------|---------|--------|
| `DNc_No` | Product batch ID | t_dnc_product |
| `DNc_ProductID` | Product code | t_dnc_product |
| `Product_Name` | Product name | m_Product |
| `BatchNo` | Batch number | t_dnc_product |
| `Periode` | Period (YYYYMM) | Derived from batch date |
| `LOB` | Line of Business | vw_COGS_Product_Group |
| `Group_PNCategory` | Category code | M_COGS_PRODUCT_GROUP_MANUAL |
| `Group_PNCategory_Name` | Category name | M_COGS_PRODUCT_GROUP_MANUAL |
| `Group_PNCategory_Dept` | Department | M_COGS_PRODUCT_GROUP_MANUAL |
| `Output_Actual` | Units produced | t_dnc_product.DNC_Diluluskan |
| `Batch_Size_Std` | Standard batch size | M_COGS_PRODUCT_FORMULA_FIX.Std_Output |
| `Rendemen_Std` | Standard yield % | M_COGS_PRODUCT_GROUP_MANUAL.Group_Rendemen |
| `Rendemen_Actual` | Actual yield % | Calculated: (Output_Actual × 100) / Batch_Size_Std |
| `MH_Proses_Std` | Std process man-hours | M_COGS_PRODUCT_GROUP_MANUAL |
| `MH_Kemas_Std` | Std packaging man-hours | M_COGS_PRODUCT_GROUP_MANUAL |
| `MH_Timbang_BB` | Std weighing man-hours (BB) | M_COGS_PRODUCT_GROUP_MANUAL |
| `MH_Timbang_BK` | Std weighing man-hours (BK) | M_COGS_PRODUCT_GROUP_MANUAL |
| `MH_Analisa_Std` | Std analysis man-hours | M_COGS_PRODUCT_GROUP_MANUAL |
| `MH_Mesin_Std` | Std machine hours | M_COGS_PRODUCT_GROUP_MANUAL |
| `Total_Cost_BB` | Total raw material cost (Bahan Baku) | Calculated |
| `Total_Cost_BK` | Total packaging cost (Bahan Kemas) | Calculated |
| `Count_Materials_PO` | Materials traced to PO | Calculated |
| `Count_Materials_MR` | Materials traced via MR chain | Calculated |
| `Count_Materials_BPHP` | Materials from granule batches | Calculated |
| `Count_Materials_STD` | Materials using standard price | Calculated |
| `Count_Materials_UNLINKED` | Materials with no price (data issue!) | Calculated |

### `t_COGS_HPP_Actual_Detail` - Material Detail
One row per unique material batch used:

| Column | Meaning | Source |
|--------|---------|--------|
| `Item_ID` | Material code | MR Detail |
| `Item_Name` | Material name | m_Item_manufacturing |
| `Item_Type` | BB or BK | MR Detail |
| `Item_Unit` | Item master unit | m_Item_manufacturing |
| `Qty_Used` | Quantity in usage unit (g, mL, pcs) | MR Detail (aggregated) |
| `Qty_Required` | Standard quantity from formula | t_COGS_HPP_Product_Detail_Formula.PPI_QTY |
| `Usage_Unit` | Unit used in production | t_DNc_Manufacturing |
| `PO_Unit` | Unit in purchase order | PO Detail |
| `Item_BJ` | Specific gravity (for g↔L) | m_Item_manufacturing |
| `Unit_Conversion_Factor` | Factor to convert usage to PO unit | M_COGS_Unit_Conversion or calculated |
| `Qty_In_PO_Unit` | Quantity in PO unit | Calculated |
| `Unit_Price` | Price per PO unit (original currency) | PO Detail |
| `Currency_Original` | Original currency (USD, EUR, IDR, etc.) | PO Detail |
| `Exchange_Rate` | Currency rate used | m_COGS_Daily_Currency |
| `Unit_Price_IDR` | Price in IDR | Calculated |
| `Price_Source` | PO, MR, BPHP, STD, or UNLINKED | Derived from trace |
| `MR_No` | Material request number | MR Header |
| `MR_SeqID` | Material request line | MR Detail |
| `MR_DNcNo` | Which material batch was used | MR Detail |
| `DNc_Material` | Material batch number | t_DNc_Manufacturing |
| `DNc_Original` | Original batch (if reprocessed) | t_DNc_Manufacturing.DNc_BeforeNo |
| `TTBA_No` | Goods receipt number | t_DNc_Manufacturing |
| `TTBA_SeqID` | Goods receipt line | t_DNc_Manufacturing |
| `PO_No` | Which PO (if traceable) | Trace result |

---

## Procedure Parameters

```sql
EXEC sp_COGS_Calculate_HPP_Actual
    @Periode = '202601',           -- Calculate all batches in January 2026
    @DNcNo = NULL,                 -- Or specify a single batch
    @RecalculateExisting = 0,      -- 0 = skip existing, 1 = recalculate
    @Debug = 0                     -- 1 = show progress messages
```

### Examples:

```sql
-- Calculate all January 2026 batches (skip already calculated)
EXEC sp_COGS_Calculate_HPP_Actual @Periode = '202601'

-- Recalculate a specific batch
EXEC sp_COGS_Calculate_HPP_Actual @DNcNo = '00138/I/26/QA/DPJ', @RecalculateExisting = 1

-- Recalculate entire month with debug output
EXEC sp_COGS_Calculate_HPP_Actual @Periode = '202601', @RecalculateExisting = 1, @Debug = 1
```

---

## Visual Flow Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           sp_COGS_Calculate_HPP_Actual                       │
└──────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ STEP 1: Find batches to process                                              │
│ ─────────────────────────────────                                            │
│ FROM t_dnc_product                                                           │
│ WHERE period = @Periode OR DNc_No = @DNcNo                                   │
└──────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ STEP 2: For each batch, collect materials                                    │
│ ──────────────────────────────────────────                                   │
│                                                                              │
│   MR Header (what product)                                                   │
│       ↓                                                                      │
│   MR Detail (what materials + quantities)                                    │
│       ↓                                                                      │
│   Material Batch (which specific batches)                                    │
│       ↓                                                                      │
│   Goods Receipt (how they came in)                                           │
│       ↓                                                                      │
│   PO Detail (actual purchase price!)                                         │
│                                                                              │
│   AGGREGATE by Item_ID + MR_DNcNo to avoid duplicates                        │
└──────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ STEP 3: Handle special price sources                                         │
│ ─────────────────────────────────────                                        │
│                                                                              │
│   IF source is MR → Trace recursively (up to 5 levels)                       │
│   IF source is BPHP → Get cost from that batch's calculation                 │
│   IF still no price → Use standard price from M_COGS_STD_HRG_BAHAN           │
│   IF still no price → Mark as UNLINKED (data quality issue)                  │
└──────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ STEP 4: Apply unit conversions                                               │
│ ──────────────────────────────────                                           │
│                                                                              │
│   Check M_COGS_Unit_Conversion for standard conversions (g→kg, mL→L)         │
│   Check m_Item_manufacturing.Item_BJ for density-based (g→L)                 │
│   Calculate: Qty_In_PO_Unit = Qty_Used × Conversion_Factor                   │
└──────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ STEP 5: Apply currency conversion                                            │
│ ─────────────────────────────────                                            │
│                                                                              │
│   Get exchange rate from m_COGS_Daily_Currency                               │
│   Use rate from batch date (or closest earlier date)                         │
│   Calculate: Unit_Price_IDR = Unit_Price × Exchange_Rate                     │
└──────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ STEP 6: Calculate totals and save                                            │
│ ────────────────────────────────────                                         │
│                                                                              │
│   Total_Cost = Qty_In_PO_Unit × Unit_Price_IDR                               │
│   Sum by Item_Type (BB vs BK)                                                │
│   Save to t_COGS_HPP_Actual_Header and t_COGS_HPP_Actual_Detail              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Common Issues & Troubleshooting

### Issue: High UNLINKED count
**Cause:** Broken traceability chain - can't find the source PO
**Solution:** Investigate those materials - might be old data or data entry issues

### Issue: Missing Item_BJ for g→L conversion
**Cause:** Density not set in m_Item_manufacturing
**Solution:** Add Item_BJ value to the item master
**Current workaround:** Falls back to factor=1 (assumes 1g = 1mL, which is wrong!)

### Issue: Different prices for same material
**Expected:** Each material batch may have different prices based on when it was purchased
**This is correct!** That's the whole point of "actual" costing.

---

## Summary

The procedure traces the complete journey of every material:

```
Finished Product → Materials Used → Material Batches → Receipts → Purchase Orders → PRICE!
```

With proper handling of:
- ✅ Multiple currencies (USD, EUR, etc.) with daily exchange rates
- ✅ Unit conversions (g→kg, mL→L, g→L with density)
- ✅ Recursive tracing for reprocessed materials
- ✅ Fallback to standard prices when needed
- ✅ Clear flagging of unlinked materials (data quality indicators)
- ✅ Complete traceability data (MR, TTBA, DNc references)
- ✅ Standard formula comparison (Qty_Required vs Qty_Used)
- ✅ Rendemen (yield) calculation

---

## Known Limitations & Data Quality Notes

### 1. Multi-Batch Production
Some batches produce more than the standard batch size. For example:
- Batch DS625: `Output_Actual = 5,375` vs `Batch_Size_Std = 1,500` (3.58×)
- This results in ~3.5× material usage, which is **correct behavior**
- `Qty_Required` shows single-batch formula; actual usage reflects multiple batches

**Future Enhancement:** Add `Qty_Required_Scaled` = `Qty_Required × (Output_Actual / Batch_Size_Std)`

### 2. Unit Mismatches in Formula
Some items show extreme over-usage (e.g., 100,000%) due to unit differences:
- Formula may be in "ribu pcs" while actual usage is in "pcs"
- Requires data cleanup in source formula tables

### 3. Rounding Differences
Small quantities like `L 060` show 400% usage:
- Formula: 0.25 units
- Actual: 1 unit (minimum practical usage)
- This is expected manufacturing behavior

---

## Version History

### v5 (January 2026) - Formula Aggregation Fix
**Critical Fix:** Formula table has duplicate rows per item (different `PPI_SeqID` for each manufacturing step), causing quantity multiplication.

**Problem:** Product I1 + AC 019B had 5 formula rows × 18,000g each, but only taking first row (18,000g) as Qty_Required while actual usage was 90,000g total.

**Solution:** Changed formula subquery from simple SELECT to aggregation:
```sql
-- Before (v4): Returns 5 rows, causes JOIN multiplication
SELECT Product_ID, PPI_ItemID, PPI_QTY FROM formula WHERE ...

-- After (v5): Returns 1 row with total
SELECT Product_ID, PPI_ItemID, SUM(PPI_QTY) AS PPI_QTY 
FROM formula WHERE ... GROUP BY Product_ID, PPI_ItemID
```

**Results After v5:**
- Normal usage (90-110%): 68% → **76%** (+968 material lines)
- Over-usage (>150%): 532 → **101** lines (81% reduction)
- Total BB Cost: 18.2B → **11.9B IDR** (more accurate, less inflated)

### v4 (January 2026) - BatchDate Matching Fix  
**Critical Fix:** Batch numbers can be reused across different years, causing materials from old batches to be included.

**Problem:** Batch 77016 existed in both 2016 and 2026. Without date filtering, MRs from 2016 were being summed with 2026 MRs.

**Solution:** Added BatchDate matching in WHERE clause:
```sql
WHERE h.MR_ProductID = @CurrentProductID 
  AND h.MR_BatchNo = @CurrentBatchNo
  AND h.MR_BatchDate = @CurrentDNCBatchDate  -- v4 FIX
```

### v3 (January 2026) - Enhanced Data Population
**Major Enhancement:** Populate all previously empty fields in Header and Detail tables.

**Header Table Additions:**
- `Product_Name` - From m_Product master
- `LOB` - Line of Business from vw_COGS_Product_Group
- `Group_PNCategory`, `Group_PNCategory_Name`, `Group_PNCategory_Dept` - Category info from M_COGS_PRODUCT_GROUP_MANUAL
- `Batch_Size_Std` - Standard batch size from M_COGS_PRODUCT_FORMULA_FIX
- `Rendemen_Std`, `Rendemen_Actual` - Yield percentages (actual calculated from output vs std batch size)
- `MH_Proses_Std`, `MH_Kemas_Std`, `MH_Timbang_BB`, `MH_Timbang_BK`, `MH_Analisa_Std`, `MH_Mesin_Std` - Man-hours standards

**Detail Table Additions:**
- `Item_Name`, `Item_Unit` - From m_Item_manufacturing master
- `Qty_Required` - Standard quantity from formula (t_COGS_HPP_Product_Detail_Formula)
- `MR_No`, `MR_SeqID` - Full MR reference
- `DNc_Material`, `DNc_Original` - Material batch traceability
- `TTBA_No`, `TTBA_SeqID` - Goods receipt traceability

**Fill Rates Achieved (Period 202601):**
- Header: Product_Name 100%, LOB 99%, Batch_Size_Std 100%, Rendemen_Actual 100%
- Detail: Item_Name 99.95%, Item_Unit 100%, Qty_Required 77%, MR_No 100%, TTBA_No 98%

### v2 (January 2026) - Unit Conversion & Duplicate Fix
- Fixed g→L conversion using Item_BJ (specific gravity)
- Fixed duplicate material aggregation logic
- Added proper aggregation by Item_ID + MR_DNcNo

### v1 (January 2026) - Initial Release
- Basic PO price tracing
- MR chain recursive tracing
- BPHP batch cost handling
- Standard price fallback
- Currency conversion
