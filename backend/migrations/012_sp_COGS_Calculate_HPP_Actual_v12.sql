-- =====================================================================
-- Stored Procedure: sp_COGS_Calculate_HPP_Actual (v16)
-- Purpose: Calculate true batch cost based on actual material prices
-- Changes in v16:
--   - NEW: Finished Goods (FG) support as intermediate products
--     FG items are produced like regular products but used as materials
--     in other products, similar to granulates.
--     
--     IDENTIFICATION: MR_ItemType = 'FG' in t_Bon_Keluar_Bahan_Awal_Header
--     
--     PASS 1A (after granulates): Discover FG batches used by products
--     - Find MRs with MR_ItemType = 'FG' linked to products we're processing
--     - Each FG item in the MR detail is a finished good product
--     - Trace FG product's own MRs to calculate raw material cost
--     - Insert header with LOB = 'FG' and compute Cost_Per_Unit
--     
--     PASS 2: FG materials flagged and costed from pre-calculated headers
--     - Materials where the consuming MR has MR_ItemType = 'FG' are flagged
--     - Is_Granulate = 1 reused for FG (both are intermediates)
--     - Cost lookup from t_COGS_HPP_Actual_Header WHERE LOB = 'FG'
-- Changes in v15:
--   - FIX: Granulate material quantities had no unit conversion.
--     MR_DNcQTY was used as-is without checking MR_ItemUnit, so
--     40.84 kg was stored as 40.84 g instead of 40,840 g.
--     
--     SOLUTION: Same v13 fix applied to PASS 2 products now applied
--     to PASS 1 granulate detail INSERT:
--     - Join t_Bon_Keluar_Bahan_Awal_Detail to get MR_ItemUnit
--     - Convert from MR_ItemUnit to Item_Unit (item master) before storing
--     - Use Item_Unit as Usage_Unit instead of DNc_UnitID
--     - Join M_COGS_Unit_Conversion for non-standard conversions
-- Changes in v14:
--   - FIX: Granulate Cost_Per_Unit was only based on raw material cost,
--     missing processing manhour cost (MH × Biaya_Proses).
--     For example, ä0 batch cost was 5.69 IDR/g (material only) but
--     should be ~54 IDR/g including 30h × 250,000/h processing.
--     
--     SOLUTION: Granulate PASS 1 header UPDATE now joins to:
--     - tmp_spLapProduksi_GWN_ReleaseQA for actual manhours (MH_NyataProses)
--     - t_COGS_HPP_Product_Header for processing rates (Biaya_Proses) and all overhead
--     
--     Cost_Per_Unit = (Material + MH_Proses×Rate + Utility + Analisa + Reagen) / Output
--     Falls back to MH_Proses_Std when actual manhours not available.
--     
--     Granulate header INSERT now also populates group info, batch size,
--     rendemen, and manhour standards from t_COGS_HPP_Product_Header.
-- Changes in v13:
--   - CRITICAL FIX: Unit conversion for material quantities
--     MR_DNcQTY was being summed without checking units. For example,
--     16.23 kg + 1020 g became 1036.23 instead of 17,250 g.
--     
--     SOLUTION: Use t_Bon_Keluar_Bahan_Awal_Detail.MR_ItemUnit as the source
--     unit for each MR line. This table contains the actual unit each MR_Amount
--     is expressed in. Convert from MR_ItemUnit → Item_Unit (item master) before
--     summing.
--   - FIX: Usage_Unit now uses item master's Item_Unit instead of DNC's DNc_UnitID
--   - FIX: Unit_Conversion_Factor now converts from item base unit to PO unit
--   - NEW: Returned materials (Bon Pengembalian) subtraction
--     Materials returned to warehouse via t_Bon_Pengembalian_Bahan_Awal
--     are subtracted from Qty_Used. Only RTR_GoodAmount (usable items) is subtracted.
--     New columns: Qty_Returned in detail, Total_Cost_Returned in header.
-- Changes in v12:
--   - CRITICAL FIX: MR chain recursive tracing now actually follows the chain
--     Previous versions only tried to find PO from the initial MR_Source_No,
--     never updating it to follow to the next MR in the chain.
--     
--     NEW APPROACH (two-step per iteration):
--     1. Try to find PO from current MR_Source_No
--     2. If no PO found and source is another MR, update MR_Source_No to follow chain
--     
--     This allows tracing MR → MR → MR → ... → PO chains up to 20 levels deep.
--   - Increased max iterations from 5 to 20
--   - FIX: Restored overhead/rates population from standard HPP (was missing in v11 copy)
--     - Direct_Labor, Factory_Overhead, Depresiasi from t_COGS_HPP_Product_Header
--     - Actual manhours from tmp_spLapProduksi_GWN_ReleaseQA
--   - FIX: Rate_MH_Proses and Rate_MH_Kemas now use correct columns
--     - Rate_MH_Proses = std.Biaya_Proses (e.g., 800000/hr) NOT Direct_Labor
--     - Rate_MH_Kemas = std.Biaya_Kemas (e.g., 250000/hr) NOT Direct_Labor
--     - Direct_Labor (34000) is separate rate for Generic products
-- Changes in v11:
--   - FIX: Granulate Product_Name lookup
--     The MR_ProductID in t_Bon_Keluar_Bahan_Awal_Header uses format 'ä0'
--     while m_Item_manufacturing.Item_ID uses format 'ä 0' (with space).
--     Fixed by using REPLACE(Item_ID, ' ', '') for matching.
-- Changes in v10:
--   - CRITICAL FIX: Exchange rate based on PO date, not batch date
--     Previously, exchange rates were fetched based on the product's
--     TempelLabel date (production/batch date). This is incorrect because
--     the material cost in foreign currency was locked in at purchase time.
--     
--     CORRECT APPROACH:
--     - Fetch exchange rate based on PO_Date from t_PO_Manufacturing_Header
--     - Each material row gets its exchange rate from its own PO date
--     - Fall back to TTBA Process_Date if PO_Date not available
--     - Fall back to batch date only as last resort
--     
--     IMPACT:
--     - More accurate costing for imported materials
--     - Costs reflect actual purchase time exchange rates
--     - Added PO_Date column to detail table for audit/validation
-- Changes in v9:
--   - ARCHITECTURAL CHANGE: Granulates as first-class products
-- Changes in v8:
--   - CRITICAL FIX: Granulate output date filtering
-- Changes in v7:
--   - NEW: Granulate material costing - trace back to raw materials
-- Changes in v6:
--   - FIX: Use m_Item_manufacturing as PRIMARY source for Item_Type
-- Changes in v5:
--   - FIX: Aggregate formula PPI_QTY by Product_ID + PPI_ItemID
-- Changes in v4:
--   - CRITICAL FIX: Match MR_BatchDate with DNC_BatchDate
-- Database: SQL Server 2008 R2 compatible
-- =====================================================================

IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[sp_COGS_Calculate_HPP_Actual]') AND type in (N'P', N'PC'))
    DROP PROCEDURE [dbo].[sp_COGS_Calculate_HPP_Actual]
GO

CREATE PROCEDURE [dbo].[sp_COGS_Calculate_HPP_Actual]
    @Periode VARCHAR(6) = NULL,          -- YYYYMM format (e.g., '202501')
    @DNcNo VARCHAR(100) = NULL,          -- Specific batch DNc_No
    @RecalculateExisting BIT = 0,        -- Recalculate even if exists
    @Debug BIT = 0                       -- Show debug info
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @StartTime DATETIME = GETDATE();
    DECLARE @BatchCount INT = 0;
    DECLARE @ProcessedCount INT = 0;
    DECLARE @ErrorCount INT = 0;
    DECLARE @Msg VARCHAR(500);
    
    -- Batch variables
    DECLARE @CurrentDNcNo VARCHAR(100);
    DECLARE @CurrentProductID VARCHAR(50);
    DECLARE @CurrentBatchNo VARCHAR(50);
    DECLARE @CurrentBatchDate DATE;
    DECLARE @CurrentTempelLabel DATE;
    DECLARE @CurrentOutputActual DECIMAL(18,2);
    DECLARE @HPP_Actual_ID INT;
    
    -- Product info variables (from v6)
    DECLARE @ProductName VARCHAR(200);
    DECLARE @LOB VARCHAR(50);
    DECLARE @GroupPNCategory INT;
    DECLARE @GroupPNCategoryName VARCHAR(100);
    DECLARE @GroupDept VARCHAR(20);
    DECLARE @BatchSizeStd DECIMAL(18,2);
    DECLARE @RendemenStd DECIMAL(18,4);
    DECLARE @MHProsesStd DECIMAL(18,4);
    DECLARE @MHKemasStd DECIMAL(18,4);
    DECLARE @MHTimbangBB DECIMAL(18,4);
    DECLARE @MHTimbangBK DECIMAL(18,4);
    DECLARE @MHAnalisaStd DECIMAL(18,4);
    DECLARE @MHMesinStd DECIMAL(18,4);
    DECLARE @GroupPeriode VARCHAR(6);
    
    -- v7: Granulate calculation variables
    DECLARE @GranulateCount INT;
    DECLARE @TotalCostGranulate DECIMAL(18,4);
    
    -- v9: Granulate pass variables
    DECLARE @GranulatePassCount INT = 0;
    DECLARE @GranulatePassProcessed INT = 0;
    
    -- v16: FG pass variables
    DECLARE @FGPassCount INT = 0;
    DECLARE @FGPassProcessed INT = 0;
    
    -- =========================================
    -- STEP 1: Identify PRODUCT batches to process
    -- =========================================
    CREATE TABLE #BatchesToProcess (
        DNc_No VARCHAR(100) PRIMARY KEY,
        DNc_ProductID VARCHAR(50),
        DNc_BatchNo VARCHAR(50),
        DNC_BatchDate VARCHAR(20),      -- v4: BatchDate string for MR matching
        BatchDate DATE,
        TempelLabel_Date DATE,
        Output_Actual DECIMAL(18,2)
    );
    
    IF @DNcNo IS NOT NULL
    BEGIN
        -- Single batch mode
        INSERT INTO #BatchesToProcess
        SELECT 
            DNc_No,
            DNc_ProductID,
            DNc_BatchNo,
            DNC_BatchDate,              -- v4: Store BatchDate for MR matching
            CAST(DNC_date AS DATE),
            CAST(DNC_TempelLabel AS DATE),
            DNC_Diluluskan
        FROM t_dnc_product
        WHERE DNc_No = @DNcNo;
    END
    ELSE IF @Periode IS NOT NULL
    BEGIN
        -- Period mode - all batches in that month
        INSERT INTO #BatchesToProcess
        SELECT 
            DNc_No,
            DNc_ProductID,
            DNc_BatchNo,
            DNC_BatchDate,              -- v4: Store BatchDate for MR matching
            CAST(DNC_date AS DATE),
            CAST(DNC_TempelLabel AS DATE),
            DNC_Diluluskan
        FROM t_dnc_product
        WHERE CONVERT(VARCHAR(6), DNC_TempelLabel, 112) = @Periode
          AND DNC_Diluluskan > 0
          AND (@RecalculateExisting = 1 OR DNc_No NOT IN (
              SELECT DNc_No FROM t_COGS_HPP_Actual_Header WHERE Calculation_Status = 'COMPLETED'
          ));
    END
    ELSE
    BEGIN
        RAISERROR('Either @Periode or @DNcNo must be provided', 16, 1);
        RETURN;
    END
    
    SELECT @BatchCount = COUNT(*) FROM #BatchesToProcess;
    
    IF @Debug = 1
    BEGIN
        SET @Msg = 'Found ' + CAST(@BatchCount AS VARCHAR) + ' batches to process';
        PRINT @Msg;
    END
    
    IF @BatchCount = 0
    BEGIN
        PRINT 'No batches to process';
        DROP TABLE #BatchesToProcess;
        RETURN;
    END
    
    -- =========================================
    -- Determine which Periode to use for Group data
    -- Use year from @Periode or current year
    -- =========================================
    SET @GroupPeriode = ISNULL(LEFT(@Periode, 4), CAST(YEAR(GETDATE()) AS VARCHAR));
    
    -- =========================================
    -- v9 PASS 1: Process GRANULATE batches first
    -- Granulates need to be calculated before products so products can lookup their costs
    -- =========================================
    IF @Debug = 1
    BEGIN
        PRINT '';
        PRINT '========================================';
        PRINT 'PASS 1: Processing Granulate Batches';
        PRINT '========================================';
    END
    
    -- Create temp table for granulate batches that need processing
    CREATE TABLE #GranulatesToProcess (
        GranulateID INT IDENTITY(1,1) PRIMARY KEY,
        GranulateBatchNo VARCHAR(50),        -- e.g., 'ä0155'
        GranulateProductID VARCHAR(50),      -- e.g., 'ä 015'
        MR_No VARCHAR(100),                  -- MR that produced this granulate
        MR_Date DATETIME,
        MR_Year INT,
        OutputQty DECIMAL(18,2),
        RawMaterialCost DECIMAL(18,4),
        CostPerGram DECIMAL(18,6),
        Processed BIT DEFAULT 0
    );
    
    -- Find all granulate batches used by the products we're processing
    -- These come from MR materials where Item_ID LIKE 'ä%'
    INSERT INTO #GranulatesToProcess (GranulateBatchNo, GranulateProductID, MR_No, MR_Date, MR_Year)
    SELECT DISTINCT
        dm_gran.DNC_BatchNo,                 -- The granulate batch (e.g., 'ä0155')
        mr_gran.MR_ProductID,                -- The granulate product ID
        mr_gran.MR_No,                       -- The MR that produced the granulate
        mr_gran.MR_Date,
        YEAR(mr_gran.MR_Date)
    FROM #BatchesToProcess bp
    -- Get MRs for the products we're processing
    JOIN t_Bon_Keluar_Bahan_Awal_Header h ON h.MR_ProductID = bp.DNc_ProductID 
                                          AND h.MR_BatchNo = bp.DNc_BatchNo
                                          AND h.MR_BatchDate = bp.DNC_BatchDate
    -- Get materials from those MRs
    JOIN t_Bon_Keluar_Bahan_Awal_DNc d ON h.MR_No = d.MR_No
    -- Only granulate materials
    JOIN t_DNc_Manufacturing dm ON d.MR_DNcNo = dm.DNc_No AND d.MR_ItemID LIKE N'ä%'
    -- Get the granulate batch number from the manufacturing record
    JOIN t_DNc_Manufacturing dm_gran ON dm_gran.DNC_BatchNo = (
        SELECT TOP 1 DNC_BatchNo FROM t_dnc_manufacturing WHERE DNc_No = d.MR_DNcNo
    )
    -- Get the MR that produced this granulate
    JOIN t_Bon_Keluar_Bahan_Awal_Header mr_gran ON mr_gran.MR_BatchNo = dm_gran.DNC_BatchNo
                                                 AND mr_gran.MR_ProductID LIKE N'ä%'
    -- Skip if already calculated (unless recalculating)
    WHERE (@RecalculateExisting = 1 OR NOT EXISTS (
        SELECT 1 FROM t_COGS_HPP_Actual_Header 
        WHERE DNc_ProductID = mr_gran.MR_ProductID 
          AND BatchNo = dm_gran.DNC_BatchNo
          AND Calculation_Status = 'COMPLETED'
    ));
    
    SELECT @GranulatePassCount = COUNT(*) FROM #GranulatesToProcess;
    
    IF @Debug = 1
    BEGIN
        SET @Msg = 'Found ' + CAST(@GranulatePassCount AS VARCHAR) + ' granulate batches to process';
        PRINT @Msg;
    END
    
    -- Process each granulate batch
    IF @GranulatePassCount > 0
    BEGIN
        DECLARE @GranID INT;
        DECLARE @GranBatchNo VARCHAR(50);
        DECLARE @GranProductID VARCHAR(50);
        DECLARE @GranMRNo VARCHAR(100);
        DECLARE @GranMRDate DATETIME;
        DECLARE @GranMRYear INT;
        DECLARE @GranOutputQty DECIMAL(18,2);
        DECLARE @GranRawCost DECIMAL(18,4);
        DECLARE @GranCostPerGram DECIMAL(18,6);
        DECLARE @GranHPPActualID INT;
        DECLARE @GranProductName VARCHAR(200);
        DECLARE @GranTempelLabel DATE;
        
        -- Currency rates for granulate calculation
        DECLARE @GranRateUSD DECIMAL(18,4), @GranRateEUR DECIMAL(18,4);
        
        -- v14: Granulate group/standard HPP variables
        DECLARE @GranGroupPNCategory INT;
        DECLARE @GranGroupPNCategoryName VARCHAR(100);
        DECLARE @GranGroupDept VARCHAR(20);
        DECLARE @GranBatchSizeStd DECIMAL(18,2);
        DECLARE @GranRendemenStd DECIMAL(18,4);
        DECLARE @GranMHProsesStd DECIMAL(18,4);
        DECLARE @GranMHKemasStd DECIMAL(18,4);
        
        DECLARE granulate_batch_cursor CURSOR LOCAL FAST_FORWARD FOR
            SELECT GranulateID, GranulateBatchNo, GranulateProductID, MR_No, MR_Date, MR_Year
            FROM #GranulatesToProcess;
        
        OPEN granulate_batch_cursor;
        FETCH NEXT FROM granulate_batch_cursor INTO @GranID, @GranBatchNo, @GranProductID, @GranMRNo, @GranMRDate, @GranMRYear;
        
        WHILE @@FETCH_STATUS = 0
        BEGIN
            BEGIN TRY
                IF @Debug = 1
                BEGIN
                    SET @Msg = 'Processing granulate batch: ' + @GranBatchNo + ' (Product: ' + @GranProductID + ')';
                    PRINT @Msg;
                END
                
                -- Delete existing records if recalculating
                IF @RecalculateExisting = 1
                BEGIN
                    DELETE d FROM t_COGS_HPP_Actual_Detail d
                    JOIN t_COGS_HPP_Actual_Header h ON d.HPP_Actual_ID = h.HPP_Actual_ID
                    WHERE h.DNc_ProductID = @GranProductID AND h.BatchNo = @GranBatchNo;
                    
                    DELETE FROM t_COGS_HPP_Actual_Header 
                    WHERE DNc_ProductID = @GranProductID AND BatchNo = @GranBatchNo;
                END
                
                -- Get granulate product name (v11 fix: handle space difference in Item_ID)
                -- MR_ProductID format: 'ä0' vs m_Item_manufacturing.Item_ID format: 'ä 0'
                SELECT @GranProductName = Item_Name
                FROM m_Item_manufacturing
                WHERE REPLACE(Item_ID, ' ', '') = @GranProductID;
                
                -- Get TempelLabel from t_dnc_manufacturing (latest for this batch in the year)
                SELECT TOP 1 @GranTempelLabel = CAST(DNc_Date AS DATE)
                FROM t_dnc_manufacturing
                WHERE DNC_BatchNo = @GranBatchNo
                  AND YEAR(DNc_Date) = @GranMRYear
                ORDER BY DNc_Date DESC;
                
                -- Get currency rates for this date
                SELECT TOP 1 @GranRateUSD = USD, @GranRateEUR = EUR
                FROM m_COGS_Daily_Currency
                WHERE date <= ISNULL(@GranTempelLabel, @GranMRDate)
                ORDER BY date DESC;
                
                IF @GranRateUSD IS NULL
                BEGIN
                    SELECT TOP 1 @GranRateUSD = USD, @GranRateEUR = EUR
                    FROM m_COGS_Daily_Currency ORDER BY date ASC;
                END
                
                -- v14: Get group info and standard HPP data for granulates
                -- Granulates exist in t_COGS_HPP_Product_Header but NOT in M_COGS_PRODUCT_GROUP_MANUAL
                SELECT TOP 1
                    @GranGroupPNCategory = Group_PNCategory,
                    @GranGroupPNCategoryName = Group_PNCategory_Name,
                    @GranGroupDept = Group_PNCategory_Dept,
                    @GranBatchSizeStd = Batch_Size,
                    @GranRendemenStd = Group_Rendemen,
                    @GranMHProsesStd = MH_Proses_Std,
                    @GranMHKemasStd = MH_Kemas_Std
                FROM t_COGS_HPP_Product_Header
                WHERE Product_ID = @GranProductID
                  AND Periode IN (@GroupPeriode, CAST(CAST(@GroupPeriode AS INT) - 1 AS VARCHAR))
                ORDER BY Periode DESC;
                
                -- Calculate output quantity (filtered by year like v8)
                SELECT @GranOutputQty = SUM(ISNULL(DNc_ReleaseQTY, 0))
                FROM t_dnc_manufacturing
                WHERE DNC_BatchNo = @GranBatchNo
                  AND YEAR(DNc_Date) = @GranMRYear;
                
                -- Calculate raw material cost from the MR
                SELECT @GranRawCost = SUM(
                    (ISNULL(d.MR_DNcQTY, 0) / 1000.0) * ISNULL(p.PO_UnitPrice, 0) *
                    CASE p.PO_Currency
                        WHEN 'USD' THEN ISNULL(@GranRateUSD, 1)
                        WHEN 'EUR' THEN ISNULL(@GranRateEUR, 1)
                        ELSE 1
                    END
                )
                FROM t_Bon_Keluar_Bahan_Awal_Header h
                JOIN t_Bon_Keluar_Bahan_Awal_DNc d ON h.MR_No = d.MR_No
                LEFT JOIN t_DNc_Manufacturing dm ON d.MR_DNcNo = dm.DNc_No
                LEFT JOIN t_ttba_manufacturing_detail t ON dm.DNc_TTBANo = t.TTBA_No AND dm.DNc_TTBASeqID = t.TTBA_SeqID
                LEFT JOIN t_PO_Manufacturing_Detail p ON t.TTBA_SourceDocNo = p.PO_No AND t.TTBA_SourceDocSeqID = p.PO_SeqID
                WHERE h.MR_No = @GranMRNo;
                
                -- Calculate cost per gram
                IF ISNULL(@GranOutputQty, 0) > 0
                BEGIN
                    SET @GranCostPerGram = @GranRawCost / @GranOutputQty;
                END
                ELSE
                BEGIN
                    SET @GranCostPerGram = 0;
                END
                
                IF @Debug = 1
                BEGIN
                    SET @Msg = '  MR: ' + @GranMRNo + ', RawCost: ' + CAST(ISNULL(@GranRawCost,0) AS VARCHAR) 
                             + ', Output: ' + CAST(ISNULL(@GranOutputQty,0) AS VARCHAR)
                             + ', Cost/g: ' + CAST(ISNULL(@GranCostPerGram,0) AS VARCHAR);
                    PRINT @Msg;
                END
                
                -- Insert Header for granulate (v14: includes group info and manhour standards)
                INSERT INTO t_COGS_HPP_Actual_Header (
                    DNc_No, DNc_ProductID, Product_Name, BatchNo, BatchDate, TempelLabel_Date,
                    Periode, LOB,
                    Group_PNCategory, Group_PNCategory_Name, Group_PNCategory_Dept,
                    Batch_Size_Std, Output_Actual, Rendemen_Std,
                    MH_Proses_Std, MH_Kemas_Std,
                    Calculation_Status, Created_By, Created_Date,
                    Cost_Per_Unit
                )
                VALUES (
                    @GranMRNo,                    -- Use MR_No as DNc_No for granulates
                    @GranProductID,
                    @GranProductName,
                    @GranBatchNo,
                    @GranMRDate,
                    @GranTempelLabel,
                    ISNULL(@Periode, CONVERT(VARCHAR(6), @GranTempelLabel, 112)),
                    'GRANULATE',                  -- LOB = GRANULATE to identify these
                    @GranGroupPNCategory,
                    @GranGroupPNCategoryName,
                    @GranGroupDept,
                    @GranBatchSizeStd,
                    @GranOutputQty,
                    @GranRendemenStd,
                    @GranMHProsesStd,
                    @GranMHKemasStd,
                    'PROCESSING',
                    'SYSTEM',
                    GETDATE(),
                    @GranCostPerGram              -- Preliminary; recalculated in UPDATE below
                );
                
                SET @GranHPPActualID = SCOPE_IDENTITY();
                
                -- v15 FIX: Insert Details with proper unit conversion (same as PASS 2 v13 fix)
                -- MR_DNcQTY may be in different units (g vs kg) per line.
                -- Must convert from MR_ItemUnit (from Detail table) to Item_Unit (item master)
                -- before computing Qty_In_PO_Unit and costs.
                INSERT INTO t_COGS_HPP_Actual_Detail (
                    HPP_Actual_ID, DNc_No, Item_ID, Item_Name, Item_Type, Item_Unit,
                    Qty_Used, Usage_Unit, PO_Unit,
                    Unit_Conversion_Factor, Qty_In_PO_Unit,
                    Unit_Price, Currency_Original, Exchange_Rate, Unit_Price_IDR,
                    Price_Source, Price_Source_Level,
                    MR_No, MR_SeqID, DNc_Material,
                    TTBA_No, TTBA_SeqID, PO_No, PO_SeqID,
                    Qty_Returned,
                    Created_Date
                )
                SELECT 
                    @GranHPPActualID,
                    @GranMRNo,
                    d.MR_ItemID,
                    itm.Item_Name,
                    COALESCE(itm.Item_Type, mst.ITEM_TYPE, 'BB'),
                    itm.Item_Unit,
                    -- v15: Qty_Used normalized to item master unit (e.g. 40.84 kg -> 40840 g)
                    ISNULL(d.MR_DNcQTY, 0) *
                    CASE 
                        WHEN COALESCE(det.MR_ItemUnit, itm.Item_Unit) = itm.Item_Unit THEN 1
                        WHEN det.MR_ItemUnit = 'kg' AND itm.Item_Unit = 'g' THEN 1000
                        WHEN det.MR_ItemUnit = 'g' AND itm.Item_Unit = 'kg' THEN 0.001
                        WHEN det.MR_ItemUnit = 'mg' AND itm.Item_Unit = 'g' THEN 0.001
                        WHEN det.MR_ItemUnit = 'mg' AND itm.Item_Unit = 'kg' THEN 0.000001
                        WHEN det.MR_ItemUnit = 'kg' AND itm.Item_Unit = 'mg' THEN 1000000
                        WHEN det.MR_ItemUnit = 'g' AND itm.Item_Unit = 'mg' THEN 1000
                        WHEN det.MR_ItemUnit = 'L' AND itm.Item_Unit = 'mL' THEN 1000
                        WHEN det.MR_ItemUnit = 'mL' AND itm.Item_Unit = 'L' THEN 0.001
                        ELSE 1
                    END,
                    -- v15: Usage_Unit from item master, not DNC
                    COALESCE(itm.Item_Unit, dm.DNc_UnitID),
                    p.PO_ItemUnit,
                    -- v15: Conversion factor from item base unit to PO unit
                    CASE 
                        WHEN uc.Conversion_Factor IS NOT NULL THEN uc.Conversion_Factor
                        WHEN COALESCE(itm.Item_Unit, dm.DNc_UnitID) = 'g' AND p.PO_ItemUnit = 'L' AND ISNULL(itm.Item_BJ, 0) > 0 
                            THEN 0.001 / itm.Item_BJ
                        WHEN COALESCE(itm.Item_Unit, dm.DNc_UnitID) = 'mL' AND p.PO_ItemUnit = 'L' 
                            THEN 0.001
                        ELSE 1
                    END,
                    -- v15: Qty_In_PO_Unit = normalized qty * conversion to PO unit
                    ISNULL(d.MR_DNcQTY, 0) *
                    CASE 
                        WHEN COALESCE(det.MR_ItemUnit, itm.Item_Unit) = itm.Item_Unit THEN 1
                        WHEN det.MR_ItemUnit = 'kg' AND itm.Item_Unit = 'g' THEN 1000
                        WHEN det.MR_ItemUnit = 'g' AND itm.Item_Unit = 'kg' THEN 0.001
                        WHEN det.MR_ItemUnit = 'mg' AND itm.Item_Unit = 'g' THEN 0.001
                        WHEN det.MR_ItemUnit = 'mg' AND itm.Item_Unit = 'kg' THEN 0.000001
                        WHEN det.MR_ItemUnit = 'kg' AND itm.Item_Unit = 'mg' THEN 1000000
                        WHEN det.MR_ItemUnit = 'g' AND itm.Item_Unit = 'mg' THEN 1000
                        WHEN det.MR_ItemUnit = 'L' AND itm.Item_Unit = 'mL' THEN 1000
                        WHEN det.MR_ItemUnit = 'mL' AND itm.Item_Unit = 'L' THEN 0.001
                        ELSE 1
                    END *
                    CASE 
                        WHEN uc.Conversion_Factor IS NOT NULL THEN uc.Conversion_Factor
                        WHEN COALESCE(itm.Item_Unit, dm.DNc_UnitID) = 'g' AND p.PO_ItemUnit = 'L' AND ISNULL(itm.Item_BJ, 0) > 0 
                            THEN 0.001 / itm.Item_BJ
                        WHEN COALESCE(itm.Item_Unit, dm.DNc_UnitID) = 'mL' AND p.PO_ItemUnit = 'L' 
                            THEN 0.001
                        ELSE 1
                    END,
                    p.PO_UnitPrice,
                    p.PO_Currency,
                    CASE p.PO_Currency
                        WHEN 'USD' THEN ISNULL(@GranRateUSD, 1)
                        WHEN 'EUR' THEN ISNULL(@GranRateEUR, 1)
                        ELSE 1
                    END,
                    p.PO_UnitPrice * CASE p.PO_Currency
                        WHEN 'USD' THEN ISNULL(@GranRateUSD, 1)
                        WHEN 'EUR' THEN ISNULL(@GranRateEUR, 1)
                        ELSE 1
                    END,
                    CASE WHEN p.PO_UnitPrice IS NOT NULL THEN 'PO' ELSE 'UNLINKED' END,
                    0,
                    d.MR_No,
                    d.MR_SeqID,
                    d.MR_DNcNo,
                    dm.DNc_TTBANo,
                    dm.DNc_TTBASeqID,
                    t.TTBA_SourceDocNo,
                    t.TTBA_SourceDocSeqID,
                    0,  -- Qty_Returned (granulates don't have returns)
                    GETDATE()
                FROM t_Bon_Keluar_Bahan_Awal_DNc d
                -- v15: Join Detail table to get MR_ItemUnit (actual unit of each MR line)
                LEFT JOIN t_Bon_Keluar_Bahan_Awal_Detail det ON d.MR_No = det.MR_No AND d.MR_SeqID = det.MR_SeqID
                LEFT JOIN t_DNc_Manufacturing dm ON d.MR_DNcNo = dm.DNc_No
                LEFT JOIN t_ttba_manufacturing_detail t ON dm.DNc_TTBANo = t.TTBA_No AND dm.DNc_TTBASeqID = t.TTBA_SeqID
                LEFT JOIN t_PO_Manufacturing_Detail p ON t.TTBA_SourceDocNo = p.PO_No AND t.TTBA_SourceDocSeqID = p.PO_SeqID
                LEFT JOIN m_Item_manufacturing itm ON itm.Item_ID = d.MR_ItemID
                -- v15: Unit conversion table for non-standard conversions
                LEFT JOIN M_COGS_Unit_Conversion uc ON COALESCE(itm.Item_Unit, dm.DNc_UnitID) = uc.From_Unit AND p.PO_ItemUnit = uc.To_Unit
                LEFT JOIN (
                    SELECT ITEM_ID, ITEM_TYPE FROM M_COGS_STD_HRG_BAHAN WHERE Periode = @GroupPeriode
                ) mst ON mst.ITEM_ID = d.MR_ItemID
                WHERE d.MR_No = @GranMRNo;
                
                -- v14: Update header with totals, manhours, rates, and full Cost_Per_Unit
                -- Same pattern as PASS 2 product UPDATE for consistency
                UPDATE h
                SET 
                    Total_Cost_BB = ISNULL(bb.Total, 0),
                    -- Rendemen
                    Rendemen_Actual = CASE 
                        WHEN h.Batch_Size_Std > 0 THEN (h.Output_Actual * 100.0) / h.Batch_Size_Std 
                        ELSE NULL 
                    END,
                    -- Actual manhours from production report (fall back to standard)
                    MH_Proses_Actual = ISNULL(mh.MH_NyataProses, h.MH_Proses_Std),
                    MH_Kemas_Actual = ISNULL(mh.MH_NyataKemas, 0),
                    -- Rates from standard HPP
                    Rate_MH_Proses = ISNULL(std.Biaya_Proses, h.Rate_MH_Proses),
                    Rate_MH_Kemas = ISNULL(std.Biaya_Kemas, h.Rate_MH_Kemas),
                    Rate_MH_Timbang = ISNULL(std.Biaya_Proses, h.Rate_MH_Timbang),
                    Direct_Labor = ISNULL(std.Direct_Labor, h.Direct_Labor),
                    Factory_Overhead = ISNULL(std.Factory_Over_Head, h.Factory_Overhead),
                    Depresiasi = ISNULL(std.Depresiasi, h.Depresiasi),
                    Biaya_Analisa = ISNULL(std.Biaya_Analisa, h.Biaya_Analisa),
                    Biaya_Reagen = ISNULL(std.Biaya_Reagen, h.Biaya_Reagen),
                    Rate_PLN = ISNULL(std.Rate_PLN, h.Rate_PLN),
                    MH_Timbang_BB = ISNULL(std.MH_Timbang_BB, h.MH_Timbang_BB),
                    MH_Timbang_BK = ISNULL(std.MH_Timbang_BK, h.MH_Timbang_BK),
                    MH_Analisa_Std = ISNULL(std.MH_Analisa_Std, h.MH_Analisa_Std),
                    MH_Mesin_Std = ISNULL(std.MH_Mesin_Std, h.MH_Mesin_Std),
                    Cost_Utility = ISNULL(std.MH_Mesin_Std, 0) * ISNULL(std.Rate_PLN, 0),
                    -- v14: Cost_Per_Unit = Total production cost / Output
                    -- Includes: material + processing MH + packaging MH + utility + analisa + reagen
                    Cost_Per_Unit = CASE WHEN h.Output_Actual > 0 THEN
                        (
                            ISNULL(bb.Total, 0)
                            + ISNULL(mh.MH_NyataProses, ISNULL(std.MH_Proses_Std, 0)) * ISNULL(std.Biaya_Proses, 0)
                            + ISNULL(mh.MH_NyataKemas, ISNULL(std.MH_Kemas_Std, 0)) * ISNULL(std.Biaya_Kemas, 0)
                            + ISNULL(std.MH_Mesin_Std, 0) * ISNULL(std.Rate_PLN, 0)
                            + ISNULL(std.Biaya_Analisa, 0)
                            + ISNULL(std.Biaya_Reagen, 0)
                        ) / h.Output_Actual
                    ELSE 0 END,
                    -- Material counts
                    Count_Materials_PO = ISNULL(cnt.PO_Count, 0),
                    Count_Materials_UNLINKED = ISNULL(cnt.UNLINKED_Count, 0),
                    Calculation_Status = 'COMPLETED',
                    Calculation_Date = GETDATE()
                FROM t_COGS_HPP_Actual_Header h
                -- Actual manhours from production report
                LEFT JOIN tmp_spLapProduksi_GWN_ReleaseQA mh 
                    ON h.BatchNo = mh.Reg_BatchNo 
                    AND REPLACE(mh.Periode, ' ', '') = h.Periode
                -- Standard HPP for rates and overhead
                LEFT JOIN t_COGS_HPP_Product_Header std 
                    ON h.DNc_ProductID = std.Product_ID 
                    AND LEFT(h.Periode, 4) = std.Periode
                LEFT JOIN (
                    SELECT HPP_Actual_ID, SUM(Qty_In_PO_Unit * Unit_Price_IDR) as Total
                    FROM t_COGS_HPP_Actual_Detail
                    WHERE HPP_Actual_ID = @GranHPPActualID
                    GROUP BY HPP_Actual_ID
                ) bb ON h.HPP_Actual_ID = bb.HPP_Actual_ID
                LEFT JOIN (
                    SELECT HPP_Actual_ID,
                        SUM(CASE WHEN Price_Source = 'PO' THEN 1 ELSE 0 END) as PO_Count,
                        SUM(CASE WHEN Price_Source = 'UNLINKED' THEN 1 ELSE 0 END) as UNLINKED_Count
                    FROM t_COGS_HPP_Actual_Detail
                    WHERE HPP_Actual_ID = @GranHPPActualID
                    GROUP BY HPP_Actual_ID
                ) cnt ON h.HPP_Actual_ID = cnt.HPP_Actual_ID
                WHERE h.HPP_Actual_ID = @GranHPPActualID;
                
                -- Update temp table
                UPDATE #GranulatesToProcess
                SET OutputQty = @GranOutputQty,
                    RawMaterialCost = @GranRawCost,
                    CostPerGram = @GranCostPerGram,
                    Processed = 1
                WHERE GranulateID = @GranID;
                
                SET @GranulatePassProcessed = @GranulatePassProcessed + 1;
                
                -- v14: Reset granulate variables for next iteration
                SET @GranGroupPNCategory = NULL;
                SET @GranGroupPNCategoryName = NULL;
                SET @GranGroupDept = NULL;
                SET @GranBatchSizeStd = NULL;
                SET @GranRendemenStd = NULL;
                SET @GranMHProsesStd = NULL;
                SET @GranMHKemasStd = NULL;
                
            END TRY
            BEGIN CATCH
                SET @Msg = 'Error processing granulate ' + @GranBatchNo + ': ' + ERROR_MESSAGE();
                PRINT @Msg;
            END CATCH
            
            FETCH NEXT FROM granulate_batch_cursor INTO @GranID, @GranBatchNo, @GranProductID, @GranMRNo, @GranMRDate, @GranMRYear;
        END
        
        CLOSE granulate_batch_cursor;
        DEALLOCATE granulate_batch_cursor;
    END
    
    -- =========================================
    -- v16 PASS 1A: Process FINISHED GOODS (FG) batches
    -- FG items are identified by MR_ItemType = 'FG' in t_Bon_Keluar_Bahan_Awal_Header
    -- They are produced like regular products but function as intermediate materials
    -- =========================================
    IF @Debug = 1
    BEGIN
        PRINT '';
        PRINT '========================================';
        PRINT 'PASS 1A: Processing Finished Goods (FG) Batches';
        PRINT '========================================';
    END
    
    -- Create temp table for FG batches that need processing
    CREATE TABLE #FGToProcess (
        FGID INT IDENTITY(1,1) PRIMARY KEY,
        FGProductID VARCHAR(50),            -- FG product ID (from MR detail item)
        FGBatchNo VARCHAR(50),              -- FG batch number
        FGDNcNo VARCHAR(100),               -- FG product's DNc_No from t_dnc_product
        MR_No VARCHAR(100),                 -- MR that produced this FG (FG's own MR)
        MR_Date DATETIME,
        MR_Year INT,
        OutputQty DECIMAL(18,2),
        RawMaterialCost DECIMAL(18,4),
        CostPerUnit DECIMAL(18,6),
        Processed BIT DEFAULT 0
    );
    
    -- Find all FG batches used by the products we're processing
    -- FG items are in MRs where MR_ItemType = 'FG'
    INSERT INTO #FGToProcess (FGProductID, FGBatchNo, FGDNcNo, MR_No, MR_Date, MR_Year)
    SELECT DISTINCT
        d.MR_ItemID,                         -- The FG product ID
        fg_dnc.DNc_BatchNo,                  -- The FG batch number from t_dnc_product
        fg_dnc.DNc_No,                       -- The FG product's DNc_No
        NULL,                                -- MR_No resolved inside cursor
        CASE WHEN ISDATE(fg_dnc.DNC_BatchDate) = 1 THEN CONVERT(DATETIME, fg_dnc.DNC_BatchDate, 111) ELSE NULL END,  -- FG batch date
        CASE WHEN ISDATE(fg_dnc.DNC_BatchDate) = 1 THEN YEAR(CONVERT(DATETIME, fg_dnc.DNC_BatchDate, 111)) ELSE NULL END
    FROM #BatchesToProcess bp
    -- Get MRs for the products we're processing that have FG items
    JOIN t_Bon_Keluar_Bahan_Awal_Header h ON h.MR_ProductID = bp.DNc_ProductID 
                                          AND h.MR_BatchNo = bp.DNc_BatchNo
                                          AND h.MR_BatchDate = bp.DNC_BatchDate
                                          AND h.MR_ItemType = 'FG'
    -- Get FG item details from those MRs
    JOIN t_Bon_Keluar_Bahan_Awal_DNc d ON h.MR_No = d.MR_No
    -- Get the FG product's DNc_No from t_dnc_product (FG items are regular products)
    -- MR_DNcNo for FG items stores the batch number, not the document number
    JOIN t_dnc_product fg_dnc ON fg_dnc.DNc_BatchNo = d.MR_DNcNo AND fg_dnc.DNc_ProductID = d.MR_ItemID
    -- Skip if already calculated (unless recalculating)
    WHERE (@RecalculateExisting = 1 OR NOT EXISTS (
        SELECT 1 FROM t_COGS_HPP_Actual_Header 
        WHERE DNc_ProductID = d.MR_ItemID 
          AND BatchNo = fg_dnc.DNc_BatchNo
          AND Calculation_Status = 'COMPLETED'
    ));
    
    SELECT @FGPassCount = COUNT(*) FROM #FGToProcess;
    
    IF @Debug = 1
    BEGIN
        SET @Msg = 'Found ' + CAST(@FGPassCount AS VARCHAR) + ' FG batches to process';
        PRINT @Msg;
    END
    
    -- Process each FG batch
    IF @FGPassCount > 0
    BEGIN
        DECLARE @FGID INT;
        DECLARE @FGProductID VARCHAR(50);
        DECLARE @FGBatchNo VARCHAR(50);
        DECLARE @FGDNcNo VARCHAR(100);
        DECLARE @FGMRNo VARCHAR(100);
        DECLARE @FGMRDate DATETIME;
        DECLARE @FGMRYear INT;
        DECLARE @FGOutputQty DECIMAL(18,2);
        DECLARE @FGRawCost DECIMAL(18,4);
        DECLARE @FGCostPerUnit DECIMAL(18,6);
        DECLARE @FGHPPActualID INT;
        DECLARE @FGProductName VARCHAR(200);
        DECLARE @FGTempelLabel DATE;
        
        -- Currency rates for FG calculation
        DECLARE @FGRateUSD DECIMAL(18,4), @FGRateEUR DECIMAL(18,4);
        
        -- FG group/standard HPP variables
        DECLARE @FGGroupPNCategory INT;
        DECLARE @FGGroupPNCategoryName VARCHAR(100);
        DECLARE @FGGroupDept VARCHAR(20);
        DECLARE @FGBatchSizeStd DECIMAL(18,2);
        DECLARE @FGRendemenStd DECIMAL(18,4);
        DECLARE @FGMHProsesStd DECIMAL(18,4);
        DECLARE @FGMHKemasStd DECIMAL(18,4);
        
        DECLARE fg_batch_cursor CURSOR LOCAL FAST_FORWARD FOR
            SELECT FGID, FGProductID, FGBatchNo, FGDNcNo, MR_No, MR_Date, MR_Year
            FROM #FGToProcess;
        
        OPEN fg_batch_cursor;
        FETCH NEXT FROM fg_batch_cursor INTO @FGID, @FGProductID, @FGBatchNo, @FGDNcNo, @FGMRNo, @FGMRDate, @FGMRYear;
        
        WHILE @@FETCH_STATUS = 0
        BEGIN
            BEGIN TRY
                IF @Debug = 1
                BEGIN
                    SET @Msg = 'Processing FG batch: ' + @FGBatchNo + ' (Product: ' + @FGProductID + ', DNcNo: ' + @FGDNcNo + ')';
                    PRINT @Msg;
                END
                
                -- Delete existing records if recalculating
                IF @RecalculateExisting = 1
                BEGIN
                    DELETE d FROM t_COGS_HPP_Actual_Detail d
                    JOIN t_COGS_HPP_Actual_Header h ON d.HPP_Actual_ID = h.HPP_Actual_ID
                    WHERE h.DNc_ProductID = @FGProductID AND h.BatchNo = @FGBatchNo;
                    
                    DELETE FROM t_COGS_HPP_Actual_Header 
                    WHERE DNc_ProductID = @FGProductID AND BatchNo = @FGBatchNo;
                END
                
                -- Get FG product name from m_Product (FG are regular products)
                SELECT @FGProductName = Product_Name
                FROM m_Product
                WHERE Product_ID = @FGProductID;
                
                -- If not found in m_Product, try m_Item_manufacturing
                IF @FGProductName IS NULL
                BEGIN
                    SELECT @FGProductName = Item_Name
                    FROM m_Item_manufacturing
                    WHERE Item_ID = @FGProductID;
                END
                
                -- Get TempelLabel from t_dnc_product
                SELECT TOP 1 @FGTempelLabel = CAST(DNC_TempelLabel AS DATE)
                FROM t_dnc_product
                WHERE DNc_No = @FGDNcNo;
                
                -- Get currency rates for this date
                SELECT TOP 1 @FGRateUSD = USD, @FGRateEUR = EUR
                FROM m_COGS_Daily_Currency
                WHERE date <= ISNULL(@FGTempelLabel, @FGMRDate)
                ORDER BY date DESC;
                
                IF @FGRateUSD IS NULL
                BEGIN
                    SELECT TOP 1 @FGRateUSD = USD, @FGRateEUR = EUR
                    FROM m_COGS_Daily_Currency ORDER BY date ASC;
                END
                
                -- Get group info and standard HPP data for FG
                SELECT TOP 1
                    @FGGroupPNCategory = Group_PNCategory,
                    @FGGroupPNCategoryName = Group_PNCategory_Name,
                    @FGGroupDept = Group_PNCategory_Dept,
                    @FGBatchSizeStd = Batch_Size,
                    @FGRendemenStd = Group_Rendemen,
                    @FGMHProsesStd = MH_Proses_Std,
                    @FGMHKemasStd = MH_Kemas_Std
                FROM t_COGS_HPP_Product_Header
                WHERE Product_ID = @FGProductID
                  AND Periode IN (@GroupPeriode, CAST(CAST(@GroupPeriode AS INT) - 1 AS VARCHAR))
                ORDER BY Periode DESC;
                
                -- Calculate output quantity from t_dnc_product
                SELECT @FGOutputQty = DNC_Diluluskan
                FROM t_dnc_product
                WHERE DNc_No = @FGDNcNo;
                
                -- Calculate raw material cost from ALL MRs for this FG product batch
                -- (FG may have multiple MRs of different types - BB, BK, etc.)
                SELECT @FGRawCost = SUM(
                    (ISNULL(d.MR_DNcQTY, 0) / 1000.0) * ISNULL(p.PO_UnitPrice, 0) *
                    CASE p.PO_Currency
                        WHEN 'USD' THEN ISNULL(@FGRateUSD, 1)
                        WHEN 'EUR' THEN ISNULL(@FGRateEUR, 1)
                        ELSE 1
                    END
                )
                FROM t_Bon_Keluar_Bahan_Awal_Header h
                JOIN t_Bon_Keluar_Bahan_Awal_DNc d ON h.MR_No = d.MR_No
                LEFT JOIN t_DNc_Manufacturing dm ON d.MR_DNcNo = dm.DNc_No
                LEFT JOIN t_ttba_manufacturing_detail t ON dm.DNc_TTBANo = t.TTBA_No AND dm.DNc_TTBASeqID = t.TTBA_SeqID
                LEFT JOIN t_PO_Manufacturing_Detail p ON t.TTBA_SourceDocNo = p.PO_No AND t.TTBA_SourceDocSeqID = p.PO_SeqID
                WHERE h.MR_ProductID = @FGProductID
                  AND h.MR_BatchNo = @FGBatchNo;
                
                -- Calculate cost per unit
                IF ISNULL(@FGOutputQty, 0) > 0
                BEGIN
                    SET @FGCostPerUnit = ISNULL(@FGRawCost, 0) / @FGOutputQty;
                END
                ELSE
                BEGIN
                    SET @FGCostPerUnit = 0;
                END
                
                IF @Debug = 1
                BEGIN
                    SET @Msg = '  MR: ' + ISNULL(@FGMRNo, 'N/A') + ', RawCost: ' + CAST(ISNULL(@FGRawCost,0) AS VARCHAR) 
                             + ', Output: ' + CAST(ISNULL(@FGOutputQty,0) AS VARCHAR)
                             + ', Cost/unit: ' + CAST(ISNULL(@FGCostPerUnit,0) AS VARCHAR);
                    PRINT @Msg;
                END
                
                -- Insert Header for FG
                INSERT INTO t_COGS_HPP_Actual_Header (
                    DNc_No, DNc_ProductID, Product_Name, BatchNo, BatchDate, TempelLabel_Date,
                    Periode, LOB,
                    Group_PNCategory, Group_PNCategory_Name, Group_PNCategory_Dept,
                    Batch_Size_Std, Output_Actual, Rendemen_Std,
                    MH_Proses_Std, MH_Kemas_Std,
                    Calculation_Status, Created_By, Created_Date,
                    Cost_Per_Unit
                )
                VALUES (
                    @FGDNcNo,                         -- Use FG's DNc_No
                    @FGProductID,
                    @FGProductName,
                    @FGBatchNo,
                    @FGMRDate,
                    @FGTempelLabel,
                    ISNULL(@Periode, CONVERT(VARCHAR(6), @FGTempelLabel, 112)),
                    'FG',                             -- LOB = FG to identify finished goods
                    @FGGroupPNCategory,
                    @FGGroupPNCategoryName,
                    @FGGroupDept,
                    @FGBatchSizeStd,
                    @FGOutputQty,
                    @FGRendemenStd,
                    @FGMHProsesStd,
                    @FGMHKemasStd,
                    'PROCESSING',
                    'SYSTEM',
                    GETDATE(),
                    @FGCostPerUnit                    -- Preliminary; recalculated below
                );
                
                SET @FGHPPActualID = SCOPE_IDENTITY();
                
                -- Insert Details with proper unit conversion (same approach as granulates)
                INSERT INTO t_COGS_HPP_Actual_Detail (
                    HPP_Actual_ID, DNc_No, Item_ID, Item_Name, Item_Type, Item_Unit,
                    Qty_Used, Usage_Unit, PO_Unit,
                    Unit_Conversion_Factor, Qty_In_PO_Unit,
                    Unit_Price, Currency_Original, Exchange_Rate, Unit_Price_IDR,
                    Price_Source, Price_Source_Level,
                    MR_No, MR_SeqID, DNc_Material,
                    TTBA_No, TTBA_SeqID, PO_No, PO_SeqID,
                    Qty_Returned,
                    Created_Date
                )
                SELECT 
                    @FGHPPActualID,
                    @FGDNcNo,
                    d.MR_ItemID,
                    itm.Item_Name,
                    COALESCE(itm.Item_Type, mst.ITEM_TYPE, 'BB'),
                    itm.Item_Unit,
                    -- Qty_Used normalized to item master unit
                    ISNULL(d.MR_DNcQTY, 0) *
                    CASE 
                        WHEN COALESCE(det.MR_ItemUnit, itm.Item_Unit) = itm.Item_Unit THEN 1
                        WHEN det.MR_ItemUnit = 'kg' AND itm.Item_Unit = 'g' THEN 1000
                        WHEN det.MR_ItemUnit = 'g' AND itm.Item_Unit = 'kg' THEN 0.001
                        WHEN det.MR_ItemUnit = 'mg' AND itm.Item_Unit = 'g' THEN 0.001
                        WHEN det.MR_ItemUnit = 'mg' AND itm.Item_Unit = 'kg' THEN 0.000001
                        WHEN det.MR_ItemUnit = 'kg' AND itm.Item_Unit = 'mg' THEN 1000000
                        WHEN det.MR_ItemUnit = 'g' AND itm.Item_Unit = 'mg' THEN 1000
                        WHEN det.MR_ItemUnit = 'L' AND itm.Item_Unit = 'mL' THEN 1000
                        WHEN det.MR_ItemUnit = 'mL' AND itm.Item_Unit = 'L' THEN 0.001
                        ELSE 1
                    END,
                    COALESCE(itm.Item_Unit, dm.DNc_UnitID),
                    p.PO_ItemUnit,
                    CASE 
                        WHEN uc.Conversion_Factor IS NOT NULL THEN uc.Conversion_Factor
                        WHEN COALESCE(itm.Item_Unit, dm.DNc_UnitID) = 'g' AND p.PO_ItemUnit = 'L' AND ISNULL(itm.Item_BJ, 0) > 0 
                            THEN 0.001 / itm.Item_BJ
                        WHEN COALESCE(itm.Item_Unit, dm.DNc_UnitID) = 'mL' AND p.PO_ItemUnit = 'L' 
                            THEN 0.001
                        ELSE 1
                    END,
                    -- Qty_In_PO_Unit = normalized qty * conversion to PO unit
                    ISNULL(d.MR_DNcQTY, 0) *
                    CASE 
                        WHEN COALESCE(det.MR_ItemUnit, itm.Item_Unit) = itm.Item_Unit THEN 1
                        WHEN det.MR_ItemUnit = 'kg' AND itm.Item_Unit = 'g' THEN 1000
                        WHEN det.MR_ItemUnit = 'g' AND itm.Item_Unit = 'kg' THEN 0.001
                        WHEN det.MR_ItemUnit = 'mg' AND itm.Item_Unit = 'g' THEN 0.001
                        WHEN det.MR_ItemUnit = 'mg' AND itm.Item_Unit = 'kg' THEN 0.000001
                        WHEN det.MR_ItemUnit = 'kg' AND itm.Item_Unit = 'mg' THEN 1000000
                        WHEN det.MR_ItemUnit = 'g' AND itm.Item_Unit = 'mg' THEN 1000
                        WHEN det.MR_ItemUnit = 'L' AND itm.Item_Unit = 'mL' THEN 1000
                        WHEN det.MR_ItemUnit = 'mL' AND itm.Item_Unit = 'L' THEN 0.001
                        ELSE 1
                    END *
                    CASE 
                        WHEN uc.Conversion_Factor IS NOT NULL THEN uc.Conversion_Factor
                        WHEN COALESCE(itm.Item_Unit, dm.DNc_UnitID) = 'g' AND p.PO_ItemUnit = 'L' AND ISNULL(itm.Item_BJ, 0) > 0 
                            THEN 0.001 / itm.Item_BJ
                        WHEN COALESCE(itm.Item_Unit, dm.DNc_UnitID) = 'mL' AND p.PO_ItemUnit = 'L' 
                            THEN 0.001
                        ELSE 1
                    END,
                    p.PO_UnitPrice,
                    p.PO_Currency,
                    CASE p.PO_Currency
                        WHEN 'USD' THEN ISNULL(@FGRateUSD, 1)
                        WHEN 'EUR' THEN ISNULL(@FGRateEUR, 1)
                        ELSE 1
                    END,
                    p.PO_UnitPrice * CASE p.PO_Currency
                        WHEN 'USD' THEN ISNULL(@FGRateUSD, 1)
                        WHEN 'EUR' THEN ISNULL(@FGRateEUR, 1)
                        ELSE 1
                    END,
                    CASE WHEN p.PO_UnitPrice IS NOT NULL THEN 'PO' ELSE 'UNLINKED' END,
                    0,
                    d.MR_No,
                    d.MR_SeqID,
                    d.MR_DNcNo,
                    dm.DNc_TTBANo,
                    dm.DNc_TTBASeqID,
                    t.TTBA_SourceDocNo,
                    t.TTBA_SourceDocSeqID,
                    0,  -- Qty_Returned
                    GETDATE()
                FROM t_Bon_Keluar_Bahan_Awal_Header fgh
                JOIN t_Bon_Keluar_Bahan_Awal_DNc d ON fgh.MR_No = d.MR_No
                LEFT JOIN t_Bon_Keluar_Bahan_Awal_Detail det ON d.MR_No = det.MR_No AND d.MR_SeqID = det.MR_SeqID
                LEFT JOIN t_DNc_Manufacturing dm ON d.MR_DNcNo = dm.DNc_No
                LEFT JOIN t_ttba_manufacturing_detail t ON dm.DNc_TTBANo = t.TTBA_No AND dm.DNc_TTBASeqID = t.TTBA_SeqID
                LEFT JOIN t_PO_Manufacturing_Detail p ON t.TTBA_SourceDocNo = p.PO_No AND t.TTBA_SourceDocSeqID = p.PO_SeqID
                LEFT JOIN m_Item_manufacturing itm ON itm.Item_ID = d.MR_ItemID
                LEFT JOIN M_COGS_Unit_Conversion uc ON COALESCE(itm.Item_Unit, dm.DNc_UnitID) = uc.From_Unit AND p.PO_ItemUnit = uc.To_Unit
                LEFT JOIN (
                    SELECT ITEM_ID, ITEM_TYPE FROM M_COGS_STD_HRG_BAHAN WHERE Periode = @GroupPeriode
                ) mst ON mst.ITEM_ID = d.MR_ItemID
                WHERE fgh.MR_ProductID = @FGProductID
                  AND fgh.MR_BatchNo = @FGBatchNo;
                
                -- Update header with totals, manhours, rates, and full Cost_Per_Unit
                UPDATE h
                SET 
                    Total_Cost_BB = ISNULL(bb.Total, 0),
                    Rendemen_Actual = CASE 
                        WHEN h.Batch_Size_Std > 0 THEN (h.Output_Actual * 100.0) / h.Batch_Size_Std 
                        ELSE NULL 
                    END,
                    MH_Proses_Actual = ISNULL(mh.MH_NyataProses, h.MH_Proses_Std),
                    MH_Kemas_Actual = ISNULL(mh.MH_NyataKemas, 0),
                    Rate_MH_Proses = ISNULL(std.Biaya_Proses, h.Rate_MH_Proses),
                    Rate_MH_Kemas = ISNULL(std.Biaya_Kemas, h.Rate_MH_Kemas),
                    Rate_MH_Timbang = ISNULL(std.Biaya_Proses, h.Rate_MH_Timbang),
                    Direct_Labor = ISNULL(std.Direct_Labor, h.Direct_Labor),
                    Factory_Overhead = ISNULL(std.Factory_Over_Head, h.Factory_Overhead),
                    Depresiasi = ISNULL(std.Depresiasi, h.Depresiasi),
                    Biaya_Analisa = ISNULL(std.Biaya_Analisa, h.Biaya_Analisa),
                    Biaya_Reagen = ISNULL(std.Biaya_Reagen, h.Biaya_Reagen),
                    Rate_PLN = ISNULL(std.Rate_PLN, h.Rate_PLN),
                    MH_Timbang_BB = ISNULL(std.MH_Timbang_BB, h.MH_Timbang_BB),
                    MH_Timbang_BK = ISNULL(std.MH_Timbang_BK, h.MH_Timbang_BK),
                    MH_Analisa_Std = ISNULL(std.MH_Analisa_Std, h.MH_Analisa_Std),
                    MH_Mesin_Std = ISNULL(std.MH_Mesin_Std, h.MH_Mesin_Std),
                    Cost_Utility = ISNULL(std.MH_Mesin_Std, 0) * ISNULL(std.Rate_PLN, 0),
                    Cost_Per_Unit = CASE WHEN h.Output_Actual > 0 THEN
                        (
                            ISNULL(bb.Total, 0)
                            + ISNULL(mh.MH_NyataProses, ISNULL(std.MH_Proses_Std, 0)) * ISNULL(std.Biaya_Proses, 0)
                            + ISNULL(mh.MH_NyataKemas, ISNULL(std.MH_Kemas_Std, 0)) * ISNULL(std.Biaya_Kemas, 0)
                            + ISNULL(std.MH_Mesin_Std, 0) * ISNULL(std.Rate_PLN, 0)
                            + ISNULL(std.Biaya_Analisa, 0)
                            + ISNULL(std.Biaya_Reagen, 0)
                        ) / h.Output_Actual
                    ELSE 0 END,
                    Count_Materials_PO = ISNULL(cnt.PO_Count, 0),
                    Count_Materials_UNLINKED = ISNULL(cnt.UNLINKED_Count, 0),
                    Calculation_Status = 'COMPLETED',
                    Calculation_Date = GETDATE()
                FROM t_COGS_HPP_Actual_Header h
                LEFT JOIN tmp_spLapProduksi_GWN_ReleaseQA mh 
                    ON h.BatchNo = mh.Reg_BatchNo 
                    AND REPLACE(mh.Periode, ' ', '') = h.Periode
                LEFT JOIN t_COGS_HPP_Product_Header std 
                    ON h.DNc_ProductID = std.Product_ID 
                    AND LEFT(h.Periode, 4) = std.Periode
                LEFT JOIN (
                    SELECT HPP_Actual_ID, SUM(Qty_In_PO_Unit * Unit_Price_IDR) as Total
                    FROM t_COGS_HPP_Actual_Detail
                    WHERE HPP_Actual_ID = @FGHPPActualID
                    GROUP BY HPP_Actual_ID
                ) bb ON h.HPP_Actual_ID = bb.HPP_Actual_ID
                LEFT JOIN (
                    SELECT HPP_Actual_ID,
                        SUM(CASE WHEN Price_Source = 'PO' THEN 1 ELSE 0 END) as PO_Count,
                        SUM(CASE WHEN Price_Source = 'UNLINKED' THEN 1 ELSE 0 END) as UNLINKED_Count
                    FROM t_COGS_HPP_Actual_Detail
                    WHERE HPP_Actual_ID = @FGHPPActualID
                    GROUP BY HPP_Actual_ID
                ) cnt ON h.HPP_Actual_ID = cnt.HPP_Actual_ID
                WHERE h.HPP_Actual_ID = @FGHPPActualID;
                
                -- Update temp table
                UPDATE #FGToProcess
                SET OutputQty = @FGOutputQty,
                    RawMaterialCost = @FGRawCost,
                    CostPerUnit = @FGCostPerUnit,
                    Processed = 1
                WHERE FGID = @FGID;
                
                SET @FGPassProcessed = @FGPassProcessed + 1;
                
                -- Reset FG variables for next iteration
                SET @FGGroupPNCategory = NULL;
                SET @FGGroupPNCategoryName = NULL;
                SET @FGGroupDept = NULL;
                SET @FGBatchSizeStd = NULL;
                SET @FGRendemenStd = NULL;
                SET @FGMHProsesStd = NULL;
                SET @FGMHKemasStd = NULL;
                
            END TRY
            BEGIN CATCH
                SET @Msg = 'Error processing FG ' + @FGBatchNo + ': ' + ERROR_MESSAGE();
                PRINT @Msg;
            END CATCH
            
            FETCH NEXT FROM fg_batch_cursor INTO @FGID, @FGProductID, @FGBatchNo, @FGDNcNo, @FGMRNo, @FGMRDate, @FGMRYear;
        END
        
        CLOSE fg_batch_cursor;
        DEALLOCATE fg_batch_cursor;
    END
    
    IF @Debug = 1
    BEGIN
        SET @Msg = 'PASS 1 Complete: ' + CAST(@GranulatePassProcessed AS VARCHAR) + ' granulates, ' + CAST(@FGPassProcessed AS VARCHAR) + ' FG processed';
        PRINT @Msg;
        PRINT '';
        PRINT '========================================';
        PRINT 'PASS 2: Processing Product Batches';
        PRINT '========================================';
    END
    
    -- =========================================
    -- STEP 2: Process each PRODUCT batch
    -- =========================================
    -- v4: Add variable for DNC_BatchDate
    DECLARE @CurrentDNCBatchDate VARCHAR(20);
    
    DECLARE batch_cursor CURSOR LOCAL FAST_FORWARD FOR
        SELECT DNc_No, DNc_ProductID, DNc_BatchNo, DNC_BatchDate, BatchDate, TempelLabel_Date, Output_Actual
        FROM #BatchesToProcess;
    
    OPEN batch_cursor;
    FETCH NEXT FROM batch_cursor INTO @CurrentDNcNo, @CurrentProductID, @CurrentBatchNo,
                                      @CurrentDNCBatchDate, @CurrentBatchDate, @CurrentTempelLabel, @CurrentOutputActual;
    
    WHILE @@FETCH_STATUS = 0
    BEGIN
        BEGIN TRY
            IF @Debug = 1
            BEGIN
                SET @Msg = 'Processing batch: ' + @CurrentDNcNo + ' (Product: ' + @CurrentProductID + ')';
                PRINT @Msg;
            END
            
            -- v16: Skip batches already processed as FG intermediate in PASS 1A
            IF EXISTS (SELECT 1 FROM #FGToProcess WHERE FGProductID = @CurrentProductID AND FGBatchNo = @CurrentBatchNo)
            BEGIN
                IF @Debug = 1
                    PRINT '  -> Skipping (already processed as FG intermediate in PASS 1A)';
                FETCH NEXT FROM batch_cursor INTO @CurrentDNcNo, @CurrentProductID, @CurrentBatchNo,
                                                  @CurrentDNCBatchDate, @CurrentBatchDate, @CurrentTempelLabel, @CurrentOutputActual;
                CONTINUE;
            END
            
            -- Delete existing records if recalculating
            IF @RecalculateExisting = 1
            BEGIN
                DELETE FROM t_COGS_HPP_Actual_Detail WHERE DNc_No = @CurrentDNcNo;
                DELETE FROM t_COGS_HPP_Actual_Header WHERE DNc_No = @CurrentDNcNo;
            END
            
            -- =========================================
            -- Get Product Info from m_Product
            -- =========================================
            SELECT @ProductName = Product_Name
            FROM m_Product
            WHERE Product_ID = @CurrentProductID;
            
            -- =========================================
            -- Get Group Info from M_COGS_PRODUCT_GROUP_MANUAL
            -- Try current year first, then previous year
            -- =========================================
            SELECT TOP 1
                @GroupPNCategory = Group_PNCategory,
                @GroupPNCategoryName = Group_PNCategoryName,
                @GroupDept = Group_Dept,
                @RendemenStd = Group_Rendemen,
                @MHProsesStd = Group_ManHourPros,
                @MHKemasStd = Group_ManHourPack,
                @MHTimbangBB = Group_MHT_BB,
                @MHTimbangBK = Group_MHT_BK,
                @MHAnalisaStd = Group_MH_Analisa,
                @MHMesinStd = Group_KWH_Mesin
            FROM M_COGS_PRODUCT_GROUP_MANUAL
            WHERE Group_ProductID = @CurrentProductID
              AND Periode IN (@GroupPeriode, CAST(CAST(@GroupPeriode AS INT) - 1 AS VARCHAR))
            ORDER BY Periode DESC;
            
            -- =========================================
            -- Get LOB from vw_COGS_Product_Group
            -- =========================================
            SELECT TOP 1 @LOB = LOB
            FROM vw_COGS_Product_Group
            WHERE Group_ProductID = @CurrentProductID
              AND Periode IN (@GroupPeriode, CAST(CAST(@GroupPeriode AS INT) - 1 AS VARCHAR))
            ORDER BY Periode DESC;
            
            -- =========================================
            -- Get Batch Size (Std_Output) from M_COGS_PRODUCT_FORMULA_FIX
            -- =========================================
            SELECT TOP 1 @BatchSizeStd = Std_Output
            FROM M_COGS_PRODUCT_FORMULA_FIX
            WHERE Product_ID = @CurrentProductID
              AND Periode IN (@GroupPeriode, CAST(CAST(@GroupPeriode AS INT) - 1 AS VARCHAR))
            ORDER BY Periode DESC;
            
            IF @Debug = 1
            BEGIN
                SET @Msg = '  Product: ' + ISNULL(@ProductName, 'N/A') + ', LOB: ' + ISNULL(@LOB, 'N/A') + ', Dept: ' + ISNULL(@GroupDept, 'N/A');
                PRINT @Msg;
            END
            
            -- =========================================
            -- Insert Header with Product/Group info
            -- =========================================
            INSERT INTO t_COGS_HPP_Actual_Header (
                DNc_No, DNc_ProductID, Product_Name, BatchNo, BatchDate, TempelLabel_Date, 
                Periode, LOB, 
                Group_PNCategory, Group_PNCategory_Name, Group_PNCategory_Dept,
                Batch_Size_Std, Output_Actual, Rendemen_Std,
                MH_Proses_Std, MH_Kemas_Std, MH_Timbang_BB, MH_Timbang_BK,
                MH_Analisa_Std, MH_Mesin_Std,
                Calculation_Status, Created_By, Created_Date
            )
            VALUES (
                @CurrentDNcNo, @CurrentProductID, @ProductName, @CurrentBatchNo, @CurrentBatchDate, 
                @CurrentTempelLabel, ISNULL(@Periode, CONVERT(VARCHAR(6), @CurrentTempelLabel, 112)),
                @LOB,
                @GroupPNCategory, @GroupPNCategoryName, @GroupDept,
                @BatchSizeStd, @CurrentOutputActual, @RendemenStd,
                @MHProsesStd, @MHKemasStd, @MHTimbangBB, @MHTimbangBK,
                @MHAnalisaStd, @MHMesinStd,
                'PROCESSING', 'SYSTEM', GETDATE()
            );
            
            SET @HPP_Actual_ID = SCOPE_IDENTITY();
            
            -- Reset product variables for next batch
            SET @ProductName = NULL;
            SET @LOB = NULL;
            SET @GroupPNCategory = NULL;
            SET @GroupPNCategoryName = NULL;
            SET @GroupDept = NULL;
            SET @BatchSizeStd = NULL;
            SET @RendemenStd = NULL;
            SET @MHProsesStd = NULL;
            SET @MHKemasStd = NULL;
            SET @MHTimbangBB = NULL;
            SET @MHTimbangBK = NULL;
            SET @MHAnalisaStd = NULL;
            SET @MHMesinStd = NULL;
            
            -- Reset granulate counters
            SET @GranulateCount = 0;
            SET @TotalCostGranulate = 0;
            
            -- =========================================
            -- Collect Materials with Price Tracing
            -- AGGREGATED by Item_ID + MR_DNcNo to avoid duplicates
            -- Now also capturing Item_Name, MR info, TTBA info
            -- v7: Also flag granulate materials
            -- =========================================
            CREATE TABLE #Materials (
                RowNum INT IDENTITY(1,1) PRIMARY KEY,
                MR_DNcNo VARCHAR(100),           -- Material batch number (key for aggregation)
                Item_ID VARCHAR(50),
                Item_Name VARCHAR(200),          -- Item name from master
                Item_Type VARCHAR(20),
                Item_Unit VARCHAR(20),           -- Item unit from master
                Qty_Required DECIMAL(18,6),      -- Required qty from formula
                Qty_Used DECIMAL(18,6),          -- Total quantity in usage unit (aggregated)
                Usage_Unit VARCHAR(20),          -- Unit used in production (g, mL, pcs)
                PO_Unit VARCHAR(20),             -- Unit in PO (kg, L, ribu pcs)
                Item_BJ DECIMAL(18,6),           -- Specific gravity for g↔L conversion
                Unit_Conversion_Factor DECIMAL(18,6) DEFAULT 1,
                Qty_In_PO_Unit DECIMAL(18,6),    -- Qty converted to PO unit
                Unit_Price DECIMAL(18,6),        -- Price per PO unit
                Currency_Original VARCHAR(10),
                Price_Source VARCHAR(20),
                Price_Source_Level INT,
                MR_No VARCHAR(100),              -- MR document number
                MR_SeqID INT,                    -- MR line number
                DNc_Original VARCHAR(100),       -- Original batch (for reproc)
                TTBA_No VARCHAR(100),            -- TTBA document number
                TTBA_SeqID INT,                  -- TTBA line number
                PO_No VARCHAR(100),
                PO_SeqID INT,
                MR_Source_No VARCHAR(100),
                MR_Source_BatchNo VARCHAR(50),
                BPHP_No VARCHAR(100),
                -- v7: Granulate tracking columns
                Is_Granulate BIT DEFAULT 0,
                Granulate_Batch VARCHAR(50),
                Granulate_MR_No VARCHAR(100),
                Granulate_Raw_Material_Cost DECIMAL(18,4),
                Granulate_Output_Qty DECIMAL(18,4),
                Granulate_Cost_Per_Gram DECIMAL(18,6),
                -- v10: PO Date for exchange rate calculation
                PO_Date DATE,
                TTBA_Date DATE,
                -- v13: Returned materials tracking
                Qty_Returned DECIMAL(18,6) DEFAULT 0
            );
            
            -- Insert materials AGGREGATED by Item_ID + MR_DNcNo
            -- Now with Item_Name, MR/TTBA info
            -- v10: Also capture PO_Date for exchange rate
            INSERT INTO #Materials (
                MR_DNcNo, Item_ID, Item_Name, Item_Type, Item_Unit, Qty_Required,
                Qty_Used, Usage_Unit, PO_Unit, Item_BJ, Unit_Conversion_Factor, Qty_In_PO_Unit,
                Unit_Price, Currency_Original, Price_Source, Price_Source_Level,
                MR_No, MR_SeqID, DNc_Original, TTBA_No, TTBA_SeqID,
                PO_No, PO_SeqID, MR_Source_No, MR_Source_BatchNo, BPHP_No,
                Is_Granulate, Granulate_Batch,
                PO_Date, TTBA_Date
            )
            SELECT 
                d.MR_DNcNo,                      -- Material batch number
                d.MR_ItemID,
                -- Item Name from master
                MAX(itm.Item_Name),
                -- v6 FIX: Get Item Type - prioritize m_Item_manufacturing (99.8% coverage)
                -- Then fallback to M_COGS_STD_HRG_BAHAN, then pattern matching
                MAX(COALESCE(
                    itm.Item_Type,               -- 1st: m_Item_manufacturing (has .000 items)
                    mst.ITEM_TYPE,               -- 2nd: M_COGS_STD_HRG_BAHAN
                    CASE                         -- 3rd: Pattern matching fallback
                        WHEN d.MR_ItemID LIKE 'BB %' THEN 'BB'
                        WHEN d.MR_ItemID LIKE 'BK %' THEN 'BK'
                        WHEN d.MR_ItemID LIKE 'PM %' THEN 'PM'
                        ELSE 'OTHER'
                    END
                )),
                -- Item Unit from master
                MAX(itm.Item_Unit),
                -- Qty Required from formula (scaled to batch size if needed)
                MAX(f.PPI_QTY),
                -- v13 FIX: Normalize each MR line from its actual unit (MR_ItemUnit from Detail table)
                -- to item base unit (Item_Unit from item master) before summing.
                -- MR_ItemUnit tells us what unit MR_DNcQTY is expressed in.
                SUM(
                    ISNULL(d.MR_DNcQTY, 0) *
                    CASE 
                        -- Same unit or no detail match -> no conversion
                        WHEN COALESCE(det.MR_ItemUnit, itm.Item_Unit) = itm.Item_Unit THEN 1
                        -- Weight conversions (MR_ItemUnit -> Item_Unit)
                        WHEN det.MR_ItemUnit = 'kg' AND itm.Item_Unit = 'g' THEN 1000
                        WHEN det.MR_ItemUnit = 'g' AND itm.Item_Unit = 'kg' THEN 0.001
                        WHEN det.MR_ItemUnit = 'mg' AND itm.Item_Unit = 'g' THEN 0.001
                        WHEN det.MR_ItemUnit = 'mg' AND itm.Item_Unit = 'kg' THEN 0.000001
                        WHEN det.MR_ItemUnit = 'kg' AND itm.Item_Unit = 'mg' THEN 1000000
                        WHEN det.MR_ItemUnit = 'g' AND itm.Item_Unit = 'mg' THEN 1000
                        -- Volume conversions
                        WHEN det.MR_ItemUnit = 'L' AND itm.Item_Unit = 'mL' THEN 1000
                        WHEN det.MR_ItemUnit = 'mL' AND itm.Item_Unit = 'L' THEN 0.001
                        -- Fallback: no conversion
                        ELSE 1
                    END
                ),
                -- v13 FIX: Usage unit from item master, not DNC
                MAX(COALESCE(itm.Item_Unit, dm.DNc_UnitID)),
                MAX(p.PO_ItemUnit),              -- PO unit (kg, L, ribu pcs, etc.)
                -- Get specific gravity (BJ) for density-based conversion
                MAX(ISNULL(itm.Item_BJ, 0)),
                -- v13 FIX: Conversion factor from item base unit to PO unit
                CASE 
                    WHEN MAX(uc.Conversion_Factor) IS NOT NULL THEN MAX(uc.Conversion_Factor)
                    WHEN MAX(COALESCE(itm.Item_Unit, dm.DNc_UnitID)) = 'g' AND MAX(p.PO_ItemUnit) = 'L' AND MAX(ISNULL(itm.Item_BJ, 0)) > 0 
                        THEN 0.001 / MAX(itm.Item_BJ)
                    WHEN MAX(COALESCE(itm.Item_Unit, dm.DNc_UnitID)) = 'mL' AND MAX(p.PO_ItemUnit) = 'L' 
                        THEN 0.001
                    ELSE 1
                END,
                -- v13 FIX: Convert normalized qty to PO unit (using actual MR_ItemUnit from Detail table)
                SUM(
                    ISNULL(d.MR_DNcQTY, 0) *
                    CASE 
                        WHEN COALESCE(det.MR_ItemUnit, itm.Item_Unit) = itm.Item_Unit THEN 1
                        WHEN det.MR_ItemUnit = 'kg' AND itm.Item_Unit = 'g' THEN 1000
                        WHEN det.MR_ItemUnit = 'g' AND itm.Item_Unit = 'kg' THEN 0.001
                        WHEN det.MR_ItemUnit = 'mg' AND itm.Item_Unit = 'g' THEN 0.001
                        WHEN det.MR_ItemUnit = 'mg' AND itm.Item_Unit = 'kg' THEN 0.000001
                        WHEN det.MR_ItemUnit = 'kg' AND itm.Item_Unit = 'mg' THEN 1000000
                        WHEN det.MR_ItemUnit = 'g' AND itm.Item_Unit = 'mg' THEN 1000
                        WHEN det.MR_ItemUnit = 'L' AND itm.Item_Unit = 'mL' THEN 1000
                        WHEN det.MR_ItemUnit = 'mL' AND itm.Item_Unit = 'L' THEN 0.001
                        ELSE 1
                    END
                ) * CASE 
                    WHEN MAX(uc.Conversion_Factor) IS NOT NULL THEN MAX(uc.Conversion_Factor)
                    WHEN MAX(COALESCE(itm.Item_Unit, dm.DNc_UnitID)) = 'g' AND MAX(p.PO_ItemUnit) = 'L' AND MAX(ISNULL(itm.Item_BJ, 0)) > 0 
                        THEN 0.001 / MAX(itm.Item_BJ)
                    WHEN MAX(COALESCE(itm.Item_Unit, dm.DNc_UnitID)) = 'mL' AND MAX(p.PO_ItemUnit) = 'L' 
                        THEN 0.001
                    ELSE 1
                END,
                -- Price from PO (per PO unit)
                MAX(CASE WHEN p.PO_UnitPrice IS NOT NULL THEN p.PO_UnitPrice ELSE 0 END),
                MAX(CASE WHEN p.PO_Currency IS NOT NULL THEN p.PO_Currency ELSE 'IDR' END),
                -- Price source
                MAX(CASE 
                    WHEN p.PO_UnitPrice IS NOT NULL THEN 'PO'
                    WHEN t.TTBA_SourceDocNo LIKE '%/MR' THEN 'MR'
                    WHEN t.TTBA_SourceDocNo LIKE '%/BPHP%' THEN 'BPHP'
                    WHEN d.MR_ItemID LIKE 'PM %' THEN 'PM'
                    ELSE 'UNLINKED'
                END),
                -- Level (0 = direct PO)
                MAX(CASE WHEN p.PO_UnitPrice IS NOT NULL THEN 0 ELSE 1 END),
                -- MR info (take first MR for this item)
                MAX(d.MR_No),
                MAX(d.MR_SeqID),
                -- Original batch (for reprocessed materials)
                MAX(dm.DNc_BeforeNo),
                -- TTBA info
                MAX(dm.DNc_TTBANo),
                MAX(dm.DNc_TTBASeqID),
                -- PO linkback
                MAX(CASE WHEN p.PO_UnitPrice IS NOT NULL THEN t.TTBA_SourceDocNo ELSE NULL END),
                MAX(CASE WHEN p.PO_UnitPrice IS NOT NULL THEN t.TTBA_SourceDocSeqID ELSE NULL END),
                -- MR source for recursive
                MAX(CASE WHEN t.TTBA_SourceDocNo LIKE '%/MR' THEN t.TTBA_SourceDocNo ELSE NULL END),
                MAX(CASE WHEN t.TTBA_SourceDocNo LIKE '%/MR' THEN t.TTBA_BatchNo ELSE NULL END),
                -- BPHP linkback
                MAX(CASE WHEN t.TTBA_SourceDocNo LIKE '%/BPHP%' THEN t.TTBA_SourceDocNo ELSE NULL END),
                -- v7: Flag granulate materials (Item_ID starts with ä)
                -- v16: Also flag FG materials (MR header has MR_ItemType = 'FG')
                CASE WHEN d.MR_ItemID LIKE N'ä%' OR h.MR_ItemType = 'FG' THEN 1 ELSE 0 END,
                -- Granulate/FG batch = material batch number
                CASE WHEN d.MR_ItemID LIKE N'ä%' OR h.MR_ItemType = 'FG' THEN d.MR_DNcNo ELSE NULL END,
                -- v10: PO Date and TTBA Date for exchange rate calculation
                MAX(ph.PO_Date),
                MAX(t.Process_Date)
            FROM t_Bon_Keluar_Bahan_Awal_Header h
            JOIN t_Bon_Keluar_Bahan_Awal_DNc d ON h.MR_No = d.MR_No
            -- v13 FIX: Join Detail table to get MR_ItemUnit (the actual unit of MR_Amount/MR_DNcQTY)
            LEFT JOIN t_Bon_Keluar_Bahan_Awal_Detail det ON h.MR_No = det.MR_No AND d.MR_SeqID = det.MR_SeqID
            LEFT JOIN t_DNc_Manufacturing dm ON d.MR_DNcNo = dm.DNc_No
            LEFT JOIN t_ttba_manufacturing_detail t ON dm.DNc_TTBANo = t.TTBA_No AND dm.DNc_TTBASeqID = t.TTBA_SeqID
            LEFT JOIN t_PO_Manufacturing_Detail p ON t.TTBA_SourceDocNo = p.PO_No AND t.TTBA_SourceDocSeqID = p.PO_SeqID
            -- v10: Join PO Header for PO_Date
            LEFT JOIN t_PO_Manufacturing_Header ph ON p.PO_No = ph.PO_No
            -- M_COGS_STD_HRG_BAHAN - used as fallback for Item_Type (lower priority than m_Item_manufacturing)
            LEFT JOIN (
                SELECT ITEM_ID, ITEM_TYPE
                FROM M_COGS_STD_HRG_BAHAN
                WHERE Periode = @GroupPeriode
            ) mst ON mst.ITEM_ID = d.MR_ItemID
            -- v6: m_Item_manufacturing is PRIMARY source for Item_Type (99.8% coverage)
            -- v13: MOVED BEFORE uc so Item_Unit is available for conversion lookup
            LEFT JOIN m_Item_manufacturing itm ON itm.Item_ID = d.MR_ItemID
            -- v13 FIX: Use item base unit (not DNC unit) for conversion factor lookup
            LEFT JOIN M_COGS_Unit_Conversion uc ON COALESCE(itm.Item_Unit, dm.DNc_UnitID) = uc.From_Unit AND p.PO_ItemUnit = uc.To_Unit
            -- v5 FIX: Aggregate formula by Product_ID + PPI_ItemID to get total requirement
            LEFT JOIN (
                SELECT Product_ID, PPI_ItemID, SUM(PPI_QTY) AS PPI_QTY
                FROM t_COGS_HPP_Product_Detail_Formula
                WHERE Product_ID = @CurrentProductID
                  AND Periode = @GroupPeriode
                GROUP BY Product_ID, PPI_ItemID
            ) f ON f.Product_ID = @CurrentProductID AND f.PPI_ItemID = d.MR_ItemID
            WHERE h.MR_ProductID = @CurrentProductID 
              AND h.MR_BatchNo = @CurrentBatchNo
              -- v4 CRITICAL FIX: Match BatchDate to prevent double-counting
              AND h.MR_BatchDate = @CurrentDNCBatchDate
            GROUP BY d.MR_DNcNo, d.MR_ItemID, h.MR_ItemType;
            
            -- =========================================
            -- v13: Subtract returned materials (Bon Pengembalian)
            -- RTR_GoodAmount = usable items returned to warehouse
            -- Match by ProductID + BatchNo + BatchDate + ItemID + DNcNo
            -- NOTE: Qty_Used stays as ORIGINAL (what was issued from warehouse)
            --       Qty_Returned is stored separately
            --       Qty_In_PO_Unit = (Qty_Used - Qty_Returned) * Conversion = NET in PO units
            -- =========================================
            UPDATE m
            SET 
                m.Qty_Returned = ISNULL(rtr.TotalGoodReturned, 0),
                -- DON'T reduce Qty_Used - keep it as original issued quantity
                -- Only Qty_In_PO_Unit reflects the net (after subtracting returns)
                m.Qty_In_PO_Unit = (m.Qty_Used - ISNULL(rtr.TotalGoodReturned, 0)) * m.Unit_Conversion_Factor
            FROM #Materials m
            JOIN (
                SELECT rd.RTR_ItemID, rd.RTR_DNcNo, SUM(rd.RTR_GoodAmount) AS TotalGoodReturned
                FROM t_Bon_Pengembalian_Bahan_Awal_header rh
                JOIN t_Bon_Pengembalian_Bahan_Awal_Detail rd ON rh.RTR_No = rd.RTR_No
                WHERE rh.RTR_ProductID = @CurrentProductID
                  AND rh.RTR_BatchNo = @CurrentBatchNo
                  AND rh.RTR_BatchDate = @CurrentDNCBatchDate
                  AND rd.RTR_GoodAmount > 0
                GROUP BY rd.RTR_ItemID, rd.RTR_DNcNo
            ) rtr ON m.Item_ID = rtr.RTR_ItemID AND m.MR_DNcNo = rtr.RTR_DNcNo;
            
            IF @Debug = 1
            BEGIN
                DECLARE @ReturnedCount INT;
                SELECT @ReturnedCount = COUNT(*) FROM #Materials WHERE Qty_Returned > 0;
                IF @ReturnedCount > 0
                BEGIN
                    SET @Msg = '  Returned materials subtracted: ' + CAST(@ReturnedCount AS VARCHAR) + ' items';
                    PRINT @Msg;
                END
            END
            
            -- =========================================
            -- v9: Process GRANULATE and FG materials
            -- LOOKUP cost from pre-calculated headers (Pass 1/1A)
            -- v16: Extended to handle both granulates (LOB='GRANULATE') and FG (LOB='FG')
            -- =========================================
            DECLARE @GranulateRowNum INT;
            DECLARE @GranulateMRDNcNo VARCHAR(100);
            DECLARE @GranulateDNCBatchNo VARCHAR(50);
            DECLARE @GranulateItemID VARCHAR(50);
            DECLARE @GranulateCostPerGram DECIMAL(18,6);
            DECLARE @GranulateHPPActualID INT;
            DECLARE @IsGranulateItem BIT;  -- v16: distinguish granulate vs FG
            
            -- Cursor for granulate AND FG materials
            DECLARE granulate_cursor CURSOR LOCAL FAST_FORWARD FOR
                SELECT RowNum, MR_DNcNo, Item_ID
                FROM #Materials
                WHERE Is_Granulate = 1;
            
            OPEN granulate_cursor;
            FETCH NEXT FROM granulate_cursor INTO @GranulateRowNum, @GranulateMRDNcNo, @GranulateItemID;
            
            WHILE @@FETCH_STATUS = 0
            BEGIN
                SET @GranulateDNCBatchNo = NULL;
                SET @GranulateCostPerGram = 0;
                SET @GranulateHPPActualID = NULL;
                
                -- v16: Determine if this is a granulate (ä prefix) or FG item
                SET @IsGranulateItem = CASE WHEN @GranulateItemID LIKE N'ä%' THEN 1 ELSE 0 END;
                
                IF @Debug = 1
                BEGIN
                    SET @Msg = '  Looking up ' + CASE WHEN @IsGranulateItem = 1 THEN 'granulate' ELSE 'FG' END 
                             + ': ' + @GranulateItemID + ' MR_DNcNo ' + ISNULL(@GranulateMRDNcNo, 'NULL');
                    PRINT @Msg;
                END
                
                IF @IsGranulateItem = 1
                BEGIN
                    -- GRANULATE: Get batch number from t_dnc_manufacturing
                    SELECT TOP 1 @GranulateDNCBatchNo = DNC_BatchNo
                    FROM t_dnc_manufacturing
                    WHERE DNc_No = @GranulateMRDNcNo;
                    
                    -- Lookup cost from granulate's HPP Actual header
                    IF @GranulateDNCBatchNo IS NOT NULL
                    BEGIN
                        SELECT TOP 1 
                            @GranulateHPPActualID = HPP_Actual_ID,
                            @GranulateCostPerGram = Cost_Per_Unit
                        FROM t_COGS_HPP_Actual_Header
                        WHERE BatchNo = @GranulateDNCBatchNo
                          AND DNc_ProductID LIKE N'ä%'
                          AND LOB = 'GRANULATE'
                          AND Calculation_Status = 'COMPLETED'
                        ORDER BY Created_Date DESC;
                    END
                END
                ELSE
                BEGIN
                    -- FG: Get batch number from t_dnc_product
                    SELECT TOP 1 @GranulateDNCBatchNo = DNc_BatchNo
                    FROM t_dnc_product
                    WHERE DNc_BatchNo = @GranulateMRDNcNo AND DNc_ProductID = @GranulateItemID;
                    
                    -- Lookup cost from FG's HPP Actual header (calculated in Pass 1A)
                    IF @GranulateDNCBatchNo IS NOT NULL
                    BEGIN
                        SELECT TOP 1 
                            @GranulateHPPActualID = HPP_Actual_ID,
                            @GranulateCostPerGram = Cost_Per_Unit
                        FROM t_COGS_HPP_Actual_Header
                        WHERE BatchNo = @GranulateDNCBatchNo
                          AND DNc_ProductID = @GranulateItemID
                          AND LOB = 'FG'
                          AND Calculation_Status = 'COMPLETED'
                        ORDER BY Created_Date DESC;
                    END
                END
                
                IF @Debug = 1
                BEGIN
                    SET @Msg = '    Found ' + CASE WHEN @IsGranulateItem = 1 THEN 'granulate' ELSE 'FG' END 
                             + ' batch: ' + ISNULL(@GranulateDNCBatchNo, 'NULL')
                             + ', HPP_ID: ' + CAST(ISNULL(@GranulateHPPActualID, 0) AS VARCHAR)
                             + ', Cost/unit: ' + CAST(ISNULL(@GranulateCostPerGram, 0) AS VARCHAR);
                    PRINT @Msg;
                END
                
                -- Update material record with granulate/FG info
                UPDATE #Materials
                SET Granulate_Batch = @GranulateDNCBatchNo,
                    Granulate_Cost_Per_Gram = @GranulateCostPerGram,
                    -- Store the intermediate's HPP_Actual_ID for reference
                    Granulate_MR_No = CAST(@GranulateHPPActualID AS VARCHAR),
                    -- Set the unit price as cost per unit
                    Unit_Price = ISNULL(@GranulateCostPerGram, 0),
                    Currency_Original = 'IDR',
                    -- v16: Use appropriate price source label
                    Price_Source = CASE WHEN @IsGranulateItem = 1 THEN 'GRANULATE_HPP' ELSE 'FG_HPP' END,
                    Price_Source_Level = 0,
                    Unit_Conversion_Factor = 1,
                    Qty_In_PO_Unit = Qty_Used,
                    PO_Unit = CASE WHEN @IsGranulateItem = 1 THEN 'g' ELSE Item_Unit END
                WHERE RowNum = @GranulateRowNum;
                
                SET @GranulateCount = @GranulateCount + 1;
                SET @TotalCostGranulate = @TotalCostGranulate + (
                    SELECT Qty_Used * ISNULL(@GranulateCostPerGram, 0) FROM #Materials WHERE RowNum = @GranulateRowNum
                );
                
                FETCH NEXT FROM granulate_cursor INTO @GranulateRowNum, @GranulateMRDNcNo, @GranulateItemID;
            END
            
            CLOSE granulate_cursor;
            DEALLOCATE granulate_cursor;
            
            -- =========================================
            -- Process MR-sourced materials (recursive)
            -- v12: Increased from 5 to 20 to trace deeper MR chains
            -- v12: FIX - Update MR_Source_No to follow the chain
            -- =========================================
            DECLARE @MaxIterations INT = 20;
            DECLARE @Iteration INT = 1;
            DECLARE @RowsUpdated INT = 1;
            DECLARE @RowsChained INT = 1;
            
            WHILE @Iteration <= @MaxIterations AND (@RowsUpdated > 0 OR @RowsChained > 0)
            BEGIN
                -- Step 1: Try to find PO from current MR_Source_No
                UPDATE m
                SET 
                    m.Unit_Price = p2.PO_UnitPrice,
                    m.Currency_Original = p2.PO_Currency,
                    m.Price_Source = 'MR',
                    m.Price_Source_Level = @Iteration,
                    m.PO_No = t2.TTBA_SourceDocNo,
                    m.PO_SeqID = t2.TTBA_SourceDocSeqID,
                    m.PO_Unit = p2.PO_ItemUnit,
                    m.Unit_Conversion_Factor = ISNULL(uc2.Conversion_Factor, 1),
                    m.Qty_In_PO_Unit = m.Qty_Used * ISNULL(uc2.Conversion_Factor, 1)
                FROM #Materials m
                JOIN t_Bon_Keluar_Bahan_Awal_Header h2 ON m.MR_Source_No = h2.MR_No
                JOIN t_Bon_Keluar_Bahan_Awal_DNc d2 ON h2.MR_No = d2.MR_No AND d2.MR_ItemID = m.Item_ID
                JOIN t_DNc_Manufacturing dm2 ON d2.MR_DNcNo = dm2.DNc_No
                JOIN t_ttba_manufacturing_detail t2 ON dm2.DNc_TTBANo = t2.TTBA_No AND dm2.DNc_TTBASeqID = t2.TTBA_SeqID
                JOIN t_PO_Manufacturing_Detail p2 ON t2.TTBA_SourceDocNo = p2.PO_No AND t2.TTBA_SourceDocSeqID = p2.PO_SeqID
                LEFT JOIN M_COGS_Unit_Conversion uc2 ON m.Usage_Unit = uc2.From_Unit AND p2.PO_ItemUnit = uc2.To_Unit
                WHERE m.Price_Source = 'MR' AND m.Unit_Price = 0
                  AND m.Is_Granulate = 0;
                
                SET @RowsUpdated = @@ROWCOUNT;
                
                -- Step 2: For materials still without PO, follow the MR chain
                -- Update MR_Source_No to point to the NEXT MR in the chain
                UPDATE m
                SET 
                    m.MR_Source_No = t2.TTBA_SourceDocNo,
                    m.Price_Source_Level = @Iteration
                FROM #Materials m
                JOIN t_Bon_Keluar_Bahan_Awal_Header h2 ON m.MR_Source_No = h2.MR_No
                JOIN t_Bon_Keluar_Bahan_Awal_DNc d2 ON h2.MR_No = d2.MR_No AND d2.MR_ItemID = m.Item_ID
                JOIN t_DNc_Manufacturing dm2 ON d2.MR_DNcNo = dm2.DNc_No
                JOIN t_ttba_manufacturing_detail t2 ON dm2.DNc_TTBANo = t2.TTBA_No AND dm2.DNc_TTBASeqID = t2.TTBA_SeqID
                WHERE m.Price_Source = 'MR' AND m.Unit_Price = 0
                  AND m.Is_Granulate = 0
                  AND t2.TTBA_SourceDocNo LIKE '%/MR'  -- Source is another MR
                  AND t2.TTBA_SourceDocNo <> m.MR_Source_No;  -- Avoid infinite loop
                
                SET @RowsChained = @@ROWCOUNT;
                SET @Iteration = @Iteration + 1;
            END
            
            -- =========================================
            -- Process BPHP materials (granule pricing)
            -- =========================================
            UPDATE m
            SET 
                m.Unit_Price = ISNULL(hpp.Total_Cost_BB + hpp.Total_Cost_BK, 0) / NULLIF(hpp.Output_Actual, 0),
                m.Currency_Original = 'IDR',
                m.Price_Source = 'BPHP',
                m.Unit_Conversion_Factor = 1,
                m.Qty_In_PO_Unit = m.Qty_Used
            FROM #Materials m
            JOIN t_COGS_HPP_Actual_Header hpp ON m.BPHP_No = hpp.DNc_No
            WHERE m.Price_Source = 'BPHP' AND m.Unit_Price = 0
              AND m.Is_Granulate = 0;  -- v7: Skip granulates
            
            -- =========================================
            -- Fallback to STD price for UNLINKED
            -- =========================================
            UPDATE m
            SET 
                m.Unit_Price = ISNULL(s.ITEM_PURCHASE_STD_PRICE, 0),
                m.Currency_Original = ISNULL(s.ITEM_CURRENCY, 'IDR'),
                m.Price_Source = CASE WHEN s.ITEM_PURCHASE_STD_PRICE IS NOT NULL THEN 'STD' ELSE 'UNLINKED' END,
                m.PO_Unit = s.ITEM_PURCHASE_UNIT,
                m.Unit_Conversion_Factor = ISNULL(uc3.Conversion_Factor, 1),
                m.Qty_In_PO_Unit = m.Qty_Used * ISNULL(uc3.Conversion_Factor, 1),
                -- Also fill Item_Unit if missing
                m.Item_Unit = COALESCE(m.Item_Unit, s.ITEM_PURCHASE_UNIT)
            FROM #Materials m
            LEFT JOIN M_COGS_STD_HRG_BAHAN s ON m.Item_ID = s.ITEM_ID
            LEFT JOIN M_COGS_Unit_Conversion uc3 ON m.Usage_Unit = uc3.From_Unit AND s.ITEM_PURCHASE_UNIT = uc3.To_Unit
            WHERE (m.Price_Source = 'UNLINKED' OR (m.Price_Source IN ('MR', 'BPHP') AND m.Unit_Price = 0))
              AND m.Is_Granulate = 0;  -- v7: Skip granulates
            
            -- =========================================
            -- v10: Calculate exchange rate per material row based on PO_Date
            -- Priority: 1) PO_Date, 2) TTBA_Date, 3) Batch TempelLabel date
            -- =========================================
            -- Add columns for exchange rate calculation
            ALTER TABLE #Materials ADD 
                Rate_Date DATE,
                Exchange_Rate DECIMAL(18,4);
            
            -- Set the rate date: PO_Date first, then TTBA_Date, then batch date
            UPDATE #Materials
            SET Rate_Date = COALESCE(PO_Date, TTBA_Date, @CurrentTempelLabel);
            
            -- Calculate exchange rate per row using cursor (SQL Server 2008 R2 compatible)
            DECLARE @MatRowNum INT;
            DECLARE @MatRateDate DATE;
            DECLARE @MatCurrency VARCHAR(10);
            DECLARE @MatExchangeRate DECIMAL(18,4);
            
            DECLARE rate_cursor CURSOR LOCAL FAST_FORWARD FOR
                SELECT RowNum, Rate_Date, Currency_Original
                FROM #Materials
                WHERE Currency_Original IS NOT NULL 
                  AND Currency_Original != 'IDR'
                  AND Is_Granulate = 0;
            
            OPEN rate_cursor;
            FETCH NEXT FROM rate_cursor INTO @MatRowNum, @MatRateDate, @MatCurrency;
            
            WHILE @@FETCH_STATUS = 0
            BEGIN
                SET @MatExchangeRate = NULL;
                
                -- Get exchange rate for this specific date
                SELECT TOP 1 @MatExchangeRate = 
                    CASE @MatCurrency
                        WHEN 'USD' THEN USD
                        WHEN 'EUR' THEN EUR
                        WHEN 'CHF' THEN CHF
                        WHEN 'SGD' THEN SGD
                        WHEN 'JPY' THEN JPY
                        WHEN 'MYR' THEN MYR
                        WHEN 'GBP' THEN GBP
                        WHEN 'RMB' THEN RMB
                        WHEN 'AUD' THEN AUD
                        ELSE 1
                    END
                FROM m_COGS_Daily_Currency
                WHERE date <= @MatRateDate
                ORDER BY date DESC;
                
                -- Fallback to earliest rate if none found
                IF @MatExchangeRate IS NULL
                BEGIN
                    SELECT TOP 1 @MatExchangeRate = 
                        CASE @MatCurrency
                            WHEN 'USD' THEN USD
                            WHEN 'EUR' THEN EUR
                            WHEN 'CHF' THEN CHF
                            WHEN 'SGD' THEN SGD
                            WHEN 'JPY' THEN JPY
                            WHEN 'MYR' THEN MYR
                            WHEN 'GBP' THEN GBP
                            WHEN 'RMB' THEN RMB
                            WHEN 'AUD' THEN AUD
                            ELSE 1
                        END
                    FROM m_COGS_Daily_Currency
                    ORDER BY date ASC;
                END
                
                UPDATE #Materials
                SET Exchange_Rate = ISNULL(@MatExchangeRate, 1)
                WHERE RowNum = @MatRowNum;
                
                FETCH NEXT FROM rate_cursor INTO @MatRowNum, @MatRateDate, @MatCurrency;
            END
            
            CLOSE rate_cursor;
            DEALLOCATE rate_cursor;
            
            -- Set exchange rate = 1 for IDR and granulates
            UPDATE #Materials
            SET Exchange_Rate = 1
            WHERE Exchange_Rate IS NULL;
            
            IF @Debug = 1
            BEGIN
                -- Show sample of materials with their rate dates
                SELECT TOP 3 Item_ID, Currency_Original, PO_Date, TTBA_Date, Rate_Date, Exchange_Rate
                FROM #Materials WHERE Currency_Original != 'IDR' AND Currency_Original IS NOT NULL;
            END
            
            -- =========================================
            -- Insert Details with all new fields
            -- v10: Use per-row exchange rate from #Materials
            -- =========================================
            INSERT INTO t_COGS_HPP_Actual_Detail (
                HPP_Actual_ID, DNc_No, Item_ID, Item_Name, Item_Type, Item_Unit,
                Qty_Required, Qty_Used, Usage_Unit, PO_Unit, Item_BJ, 
                Unit_Conversion_Factor, Qty_In_PO_Unit,
                Unit_Price, Currency_Original, Exchange_Rate, Unit_Price_IDR,
                Price_Source, Price_Source_Level,
                MR_No, MR_SeqID, DNc_Material, DNc_Original, 
                TTBA_No, TTBA_SeqID, PO_No, PO_SeqID, MR_DNcNo,
                Is_Granulate, Granulate_Batch, Granulate_MR_No,
                Granulate_Raw_Material_Cost, Granulate_Output_Qty, Granulate_Cost_Per_Gram,
                Qty_Returned,
                Created_Date
            )
            SELECT 
                @HPP_Actual_ID,
                @CurrentDNcNo,
                Item_ID,
                Item_Name,
                Item_Type,
                Item_Unit,
                Qty_Required,
                Qty_Used,
                Usage_Unit,
                PO_Unit,
                Item_BJ,
                Unit_Conversion_Factor,
                Qty_In_PO_Unit,
                Unit_Price,
                Currency_Original,
                -- v10: Use pre-calculated per-row exchange rate
                Exchange_Rate,
                -- Unit price in IDR (per PO unit) - for granulates, already in IDR
                CASE 
                    WHEN Is_Granulate = 1 THEN Unit_Price
                    ELSE Unit_Price * Exchange_Rate
                END,
                Price_Source,
                Price_Source_Level,
                MR_No,
                MR_SeqID,
                MR_DNcNo,           -- DNc_Material = the material batch used
                DNc_Original,       -- Original batch for reproc
                TTBA_No,
                TTBA_SeqID,
                PO_No,
                PO_SeqID,
                MR_DNcNo,
                -- v7: Granulate tracking
                Is_Granulate,
                Granulate_Batch,
                Granulate_MR_No,
                Granulate_Raw_Material_Cost,
                Granulate_Output_Qty,
                Granulate_Cost_Per_Gram,
                Qty_Returned,
                GETDATE()
            FROM #Materials;
            
            -- =========================================
            -- Update Header with totals
            -- v7: Include granulate counts and totals
            -- v11: Include actual manhours and rates from standard HPP
            -- =========================================
            UPDATE h
            SET 
                Total_Cost_BB = ISNULL(bb.Total, 0),
                Total_Cost_BK = ISNULL(bk.Total, 0),
                -- v7: Granulate totals
                Total_Cost_Granulate = ISNULL(gran.Total, 0),
                Granulate_Count = ISNULL(gran.GranCount, 0),
                -- Calculate actual rendemen if we have batch size
                Rendemen_Actual = CASE 
                    WHEN h.Batch_Size_Std > 0 THEN (h.Output_Actual * 100.0) / h.Batch_Size_Std 
                    ELSE NULL 
                END,
                -- v11: Actual manhours from tmp_spLapProduksi_GWN_ReleaseQA
                MH_Proses_Actual = ISNULL(mh.MH_NyataProses, h.MH_Proses_Actual),
                MH_Kemas_Actual = ISNULL(mh.MH_NyataKemas, h.MH_Kemas_Actual),
                -- v12 FIX: Use Biaya_Proses/Biaya_Kemas as rates (not Direct_Labor!)
                -- Biaya_Proses/Biaya_Kemas in standard HPP are rates per hour (e.g., 800000, 250000)
                -- Direct_Labor is a different rate (e.g., 34000) used for Generic products
                Rate_MH_Proses = ISNULL(std.Biaya_Proses, h.Rate_MH_Proses),
                Rate_MH_Kemas = ISNULL(std.Biaya_Kemas, h.Rate_MH_Kemas),
                -- v12.1 FIX: Rate_MH_Timbang should use Biaya_Proses (same as HPP Results Generic1)
                -- HPP Results uses Biaya_Proses for Timbang BB/BK calculations
                Rate_MH_Timbang = ISNULL(std.Biaya_Proses, h.Rate_MH_Timbang),
                Direct_Labor = ISNULL(std.Direct_Labor, h.Direct_Labor),
                Factory_Overhead = ISNULL(std.Factory_Over_Head, h.Factory_Overhead),
                Depresiasi = ISNULL(std.Depresiasi, h.Depresiasi),
                Biaya_Analisa = ISNULL(std.Biaya_Analisa, h.Biaya_Analisa),
                Biaya_Reagen = ISNULL(std.Biaya_Reagen, h.Biaya_Reagen),
                Rate_PLN = ISNULL(std.Rate_PLN, h.Rate_PLN),
                MH_Timbang_BB = ISNULL(std.MH_Timbang_BB, h.MH_Timbang_BB),
                MH_Timbang_BK = ISNULL(std.MH_Timbang_BK, h.MH_Timbang_BK),
                MH_Analisa_Std = ISNULL(std.MH_Analisa_Std, h.MH_Analisa_Std),
                MH_Mesin_Std = ISNULL(std.MH_Mesin_Std, h.MH_Mesin_Std),
                -- v11: Calculate Cost_Utility from MH_Mesin_Std * Rate_PLN
                Cost_Utility = ISNULL(std.MH_Mesin_Std, 0) * ISNULL(std.Rate_PLN, 0),
                -- Material counts
                Count_Materials_PO = ISNULL(cnt.PO_Count, 0),
                Count_Materials_MR = ISNULL(cnt.MR_Count, 0),
                Count_Materials_BPHP = ISNULL(cnt.BPHP_Count, 0),
                Count_Materials_STD = ISNULL(cnt.STD_Count, 0),
                Count_Materials_PM = ISNULL(cnt.PM_Count, 0),
                Count_Materials_UNLINKED = ISNULL(cnt.UNLINKED_Count, 0),
                -- v13: Total cost of returned materials
                Total_Cost_Returned = ISNULL(rtn.Total, 0),
                Calculation_Status = 'COMPLETED',
                Calculation_Date = GETDATE()
            FROM t_COGS_HPP_Actual_Header h
            -- v11: Join to actual manhours report
            LEFT JOIN tmp_spLapProduksi_GWN_ReleaseQA mh 
                ON h.BatchNo = mh.Reg_BatchNo 
                AND REPLACE(mh.Periode, ' ', '') = h.Periode
            -- v11: Join to standard HPP for rates (match year only since std HPP uses YYYY)
            LEFT JOIN t_COGS_HPP_Product_Header std 
                ON h.DNc_ProductID = std.Product_ID 
                AND LEFT(h.Periode, 4) = std.Periode
            LEFT JOIN (
                -- BB total now includes granulates (which are type BB)
                SELECT HPP_Actual_ID, SUM(Qty_In_PO_Unit * Unit_Price_IDR) as Total
                FROM t_COGS_HPP_Actual_Detail
                WHERE Item_Type = 'BB'
                GROUP BY HPP_Actual_ID
            ) bb ON h.HPP_Actual_ID = bb.HPP_Actual_ID
            LEFT JOIN (
                SELECT HPP_Actual_ID, SUM(Qty_In_PO_Unit * Unit_Price_IDR) as Total
                FROM t_COGS_HPP_Actual_Detail
                WHERE Item_Type = 'BK'
                GROUP BY HPP_Actual_ID
            ) bk ON h.HPP_Actual_ID = bk.HPP_Actual_ID
            -- v7: Granulate totals
            LEFT JOIN (
                SELECT HPP_Actual_ID, 
                       SUM(Qty_In_PO_Unit * Unit_Price_IDR) as Total,
                       COUNT(*) as GranCount
                FROM t_COGS_HPP_Actual_Detail
                WHERE Is_Granulate = 1
                GROUP BY HPP_Actual_ID
            ) gran ON h.HPP_Actual_ID = gran.HPP_Actual_ID
            LEFT JOIN (
                SELECT HPP_Actual_ID,
                    SUM(CASE WHEN Price_Source = 'PO' THEN 1 ELSE 0 END) as PO_Count,
                    SUM(CASE WHEN Price_Source = 'MR' THEN 1 ELSE 0 END) as MR_Count,
                    SUM(CASE WHEN Price_Source = 'BPHP' THEN 1 ELSE 0 END) as BPHP_Count,
                    SUM(CASE WHEN Price_Source = 'STD' THEN 1 ELSE 0 END) as STD_Count,
                    SUM(CASE WHEN Price_Source = 'PM' THEN 1 ELSE 0 END) as PM_Count,
                    SUM(CASE WHEN Price_Source = 'UNLINKED' THEN 1 ELSE 0 END) as UNLINKED_Count
                FROM t_COGS_HPP_Actual_Detail
                GROUP BY HPP_Actual_ID
            ) cnt ON h.HPP_Actual_ID = cnt.HPP_Actual_ID
            -- v13: Total cost of returned materials (Qty_Returned * Unit_Price_IDR * conversion)
            LEFT JOIN (
                SELECT HPP_Actual_ID, 
                       SUM(ISNULL(Qty_Returned, 0) * Unit_Conversion_Factor * ISNULL(Unit_Price_IDR, 0)) as Total
                FROM t_COGS_HPP_Actual_Detail
                WHERE ISNULL(Qty_Returned, 0) > 0
                GROUP BY HPP_Actual_ID
            ) rtn ON h.HPP_Actual_ID = rtn.HPP_Actual_ID
            WHERE h.HPP_Actual_ID = @HPP_Actual_ID;
            
            DROP TABLE #Materials;
            
            SET @ProcessedCount = @ProcessedCount + 1;
            
        END TRY
        BEGIN CATCH
            SET @ErrorCount = @ErrorCount + 1;
            SET @Msg = 'Error processing batch ' + @CurrentDNcNo + ': ' + ERROR_MESSAGE();
            PRINT @Msg;
            
            UPDATE t_COGS_HPP_Actual_Header 
            SET Calculation_Status = 'ERROR',
                Error_Message = ERROR_MESSAGE()
            WHERE DNc_No = @CurrentDNcNo;
            
            IF OBJECT_ID('tempdb..#Materials') IS NOT NULL
                DROP TABLE #Materials;
        END CATCH
        
        FETCH NEXT FROM batch_cursor INTO @CurrentDNcNo, @CurrentProductID, @CurrentBatchNo,
                                          @CurrentDNCBatchDate, @CurrentBatchDate, @CurrentTempelLabel, @CurrentOutputActual;
    END
    
    CLOSE batch_cursor;
    DEALLOCATE batch_cursor;
    
    DROP TABLE #BatchesToProcess;
    DROP TABLE #GranulatesToProcess;
    DROP TABLE #FGToProcess;
    
    -- =========================================
    -- Summary
    -- =========================================
    DECLARE @Duration INT = DATEDIFF(SECOND, @StartTime, GETDATE());
    
    PRINT '';
    PRINT '========================================';
    PRINT 'HPP Actual Calculation Summary (v16)';
    PRINT '========================================';
    SET @Msg = 'Granulates processed: ' + CAST(@GranulatePassProcessed AS VARCHAR);
    PRINT @Msg;
    SET @Msg = 'FG processed: ' + CAST(@FGPassProcessed AS VARCHAR);
    PRINT @Msg;
    SET @Msg = 'Product batches: ' + CAST(@BatchCount AS VARCHAR);
    PRINT @Msg;
    SET @Msg = 'Products processed: ' + CAST(@ProcessedCount AS VARCHAR);
    PRINT @Msg;
    SET @Msg = 'Errors: ' + CAST(@ErrorCount AS VARCHAR);
    PRINT @Msg;
    SET @Msg = 'Duration: ' + CAST(@Duration AS VARCHAR) + ' seconds';
    PRINT @Msg;
    PRINT '========================================';
    
    SELECT 
        @GranulatePassProcessed as GranulatesProcessed,
        @FGPassProcessed as FGProcessed,
        @BatchCount as TotalProductBatches,
        @ProcessedCount as ProductsProcessed,
        @ErrorCount as Errors,
        @Duration as DurationSeconds;
END
GO

PRINT 'Stored procedure sp_COGS_Calculate_HPP_Actual v16 created successfully';
GO
