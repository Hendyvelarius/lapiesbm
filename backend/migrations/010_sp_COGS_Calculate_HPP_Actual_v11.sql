-- =====================================================================
-- Stored Procedure: sp_COGS_Calculate_HPP_Actual (v11)
-- Purpose: Calculate true batch cost based on actual material prices
-- Changes in v11:
--   - NEW: Populate actual manhours from tmp_spLapProduksi_GWN_ReleaseQA
--     - MH_Proses_Actual = MH_NyataProses
--     - MH_Kemas_Actual = MH_NyataKemas
--   - NEW: Populate rates from t_COGS_HPP_Product_Header (standard HPP)
--     - Rate_MH_Proses, Rate_MH_Kemas, Rate_MH_Timbang
--     - Direct_Labor, Factory_Overhead, Depresiasi
--     - Biaya_Analisa, Biaya_Reagen, Rate_PLN
--     - MH_Timbang_BB, MH_Timbang_BK, MH_Analisa_Std, MH_Mesin_Std
--   - NEW: Calculate Cost_Utility from MH_Mesin_Std * Rate_PLN
-- Changes in v10:
--   - CRITICAL FIX: Exchange rate based on PO date, not batch date
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
                
                -- Get granulate product name
                SELECT @GranProductName = Item_Name
                FROM m_Item_manufacturing
                WHERE Item_ID = @GranProductID;
                
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
                
                -- Insert Header for granulate
                INSERT INTO t_COGS_HPP_Actual_Header (
                    DNc_No, DNc_ProductID, Product_Name, BatchNo, BatchDate, TempelLabel_Date,
                    Periode, LOB,
                    Output_Actual,
                    Calculation_Status, Created_By, Created_Date,
                    -- v9: Store cost per gram in header for easy lookup
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
                    @GranOutputQty,
                    'PROCESSING',
                    'SYSTEM',
                    GETDATE(),
                    @GranCostPerGram
                );
                
                SET @GranHPPActualID = SCOPE_IDENTITY();
                
                -- Insert Details for each raw material used in the granulate
                INSERT INTO t_COGS_HPP_Actual_Detail (
                    HPP_Actual_ID, DNc_No, Item_ID, Item_Name, Item_Type, Item_Unit,
                    Qty_Used, Usage_Unit, PO_Unit,
                    Unit_Conversion_Factor, Qty_In_PO_Unit,
                    Unit_Price, Currency_Original, Exchange_Rate, Unit_Price_IDR,
                    Price_Source, Price_Source_Level,
                    MR_No, MR_SeqID, DNc_Material,
                    TTBA_No, TTBA_SeqID, PO_No, PO_SeqID,
                    Created_Date
                )
                SELECT 
                    @GranHPPActualID,
                    @GranMRNo,
                    d.MR_ItemID,
                    itm.Item_Name,
                    COALESCE(itm.Item_Type, mst.ITEM_TYPE, 'BB'),
                    itm.Item_Unit,
                    d.MR_DNcQTY,
                    dm.DNc_UnitID,
                    p.PO_ItemUnit,
                    -- Conversion (g -> kg = /1000)
                    CASE WHEN dm.DNc_UnitID = 'g' AND p.PO_ItemUnit = 'kg' THEN 0.001 ELSE 1 END,
                    d.MR_DNcQTY * CASE WHEN dm.DNc_UnitID = 'g' AND p.PO_ItemUnit = 'kg' THEN 0.001 ELSE 1 END,
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
                    GETDATE()
                FROM t_Bon_Keluar_Bahan_Awal_DNc d
                LEFT JOIN t_DNc_Manufacturing dm ON d.MR_DNcNo = dm.DNc_No
                LEFT JOIN t_ttba_manufacturing_detail t ON dm.DNc_TTBANo = t.TTBA_No AND dm.DNc_TTBASeqID = t.TTBA_SeqID
                LEFT JOIN t_PO_Manufacturing_Detail p ON t.TTBA_SourceDocNo = p.PO_No AND t.TTBA_SourceDocSeqID = p.PO_SeqID
                LEFT JOIN m_Item_manufacturing itm ON itm.Item_ID = d.MR_ItemID
                LEFT JOIN (
                    SELECT ITEM_ID, ITEM_TYPE FROM M_COGS_STD_HRG_BAHAN WHERE Periode = @GroupPeriode
                ) mst ON mst.ITEM_ID = d.MR_ItemID
                WHERE d.MR_No = @GranMRNo;
                
                -- Update header with totals
                UPDATE h
                SET 
                    Total_Cost_BB = ISNULL(bb.Total, 0),
                    Calculation_Status = 'COMPLETED',
                    Calculation_Date = GETDATE()
                FROM t_COGS_HPP_Actual_Header h
                LEFT JOIN (
                    SELECT HPP_Actual_ID, SUM(Qty_In_PO_Unit * Unit_Price_IDR) as Total
                    FROM t_COGS_HPP_Actual_Detail
                    WHERE HPP_Actual_ID = @GranHPPActualID
                    GROUP BY HPP_Actual_ID
                ) bb ON h.HPP_Actual_ID = bb.HPP_Actual_ID
                WHERE h.HPP_Actual_ID = @GranHPPActualID;
                
                -- Update temp table
                UPDATE #GranulatesToProcess
                SET OutputQty = @GranOutputQty,
                    RawMaterialCost = @GranRawCost,
                    CostPerGram = @GranCostPerGram,
                    Processed = 1
                WHERE GranulateID = @GranID;
                
                SET @GranulatePassProcessed = @GranulatePassProcessed + 1;
                
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
    
    IF @Debug = 1
    BEGIN
        SET @Msg = 'PASS 1 Complete: ' + CAST(@GranulatePassProcessed AS VARCHAR) + ' granulates processed';
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
                TTBA_Date DATE
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
                -- AGGREGATE: Sum all quantities from same material batch
                SUM(ISNULL(d.MR_DNcQTY, 0)),     -- Total qty in usage unit
                MAX(dm.DNc_UnitID),              -- Usage unit (g, mL, pcs, etc.)
                MAX(p.PO_ItemUnit),              -- PO unit (kg, L, ribu pcs, etc.)
                -- Get specific gravity (BJ) for density-based conversion
                MAX(ISNULL(itm.Item_BJ, 0)),
                -- Get conversion factor (usage unit → PO unit)
                CASE 
                    WHEN MAX(uc.Conversion_Factor) IS NOT NULL THEN MAX(uc.Conversion_Factor)
                    WHEN MAX(dm.DNc_UnitID) = 'g' AND MAX(p.PO_ItemUnit) = 'L' AND MAX(ISNULL(itm.Item_BJ, 0)) > 0 
                        THEN 0.001 / MAX(itm.Item_BJ)
                    WHEN MAX(dm.DNc_UnitID) = 'mL' AND MAX(p.PO_ItemUnit) = 'L' 
                        THEN 0.001
                    ELSE 1
                END,
                -- Convert total qty to PO unit
                SUM(ISNULL(d.MR_DNcQTY, 0)) * CASE 
                    WHEN MAX(uc.Conversion_Factor) IS NOT NULL THEN MAX(uc.Conversion_Factor)
                    WHEN MAX(dm.DNc_UnitID) = 'g' AND MAX(p.PO_ItemUnit) = 'L' AND MAX(ISNULL(itm.Item_BJ, 0)) > 0 
                        THEN 0.001 / MAX(itm.Item_BJ)
                    WHEN MAX(dm.DNc_UnitID) = 'mL' AND MAX(p.PO_ItemUnit) = 'L' 
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
                CASE WHEN d.MR_ItemID LIKE N'ä%' THEN 1 ELSE 0 END,
                -- Granulate batch = material batch number (e.g. ä8105)
                CASE WHEN d.MR_ItemID LIKE N'ä%' THEN d.MR_DNcNo ELSE NULL END,
                -- v10: PO Date and TTBA Date for exchange rate calculation
                MAX(ph.PO_Date),
                MAX(t.Process_Date)
            FROM t_Bon_Keluar_Bahan_Awal_Header h
            JOIN t_Bon_Keluar_Bahan_Awal_DNc d ON h.MR_No = d.MR_No
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
            LEFT JOIN M_COGS_Unit_Conversion uc ON dm.DNc_UnitID = uc.From_Unit AND p.PO_ItemUnit = uc.To_Unit
            -- v6: m_Item_manufacturing is PRIMARY source for Item_Type (99.8% coverage)
            LEFT JOIN m_Item_manufacturing itm ON itm.Item_ID = d.MR_ItemID
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
            GROUP BY d.MR_DNcNo, d.MR_ItemID;
            
            -- =========================================
            -- v9: Process GRANULATE materials
            -- LOOKUP cost from pre-calculated granulate headers (Pass 1)
            -- Much simpler than v7/v8 inline calculation
            -- =========================================
            DECLARE @GranulateRowNum INT;
            DECLARE @GranulateMRDNcNo VARCHAR(100);
            DECLARE @GranulateDNCBatchNo VARCHAR(50);
            DECLARE @GranulateItemID VARCHAR(50);
            DECLARE @GranulateCostPerGram DECIMAL(18,6);
            DECLARE @GranulateHPPActualID INT;
            
            -- Cursor for granulate materials
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
                
                IF @Debug = 1
                BEGIN
                    SET @Msg = '  Looking up granulate: ' + @GranulateItemID + ' MR_DNcNo ' + ISNULL(@GranulateMRDNcNo, 'NULL');
                    PRINT @Msg;
                END
                
                -- Get the actual batch number from t_dnc_manufacturing
                SELECT TOP 1 @GranulateDNCBatchNo = DNC_BatchNo
                FROM t_dnc_manufacturing
                WHERE DNc_No = @GranulateMRDNcNo;
                
                -- v9: Lookup cost from granulate's HPP Actual header (calculated in Pass 1)
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
                    
                    IF @Debug = 1
                    BEGIN
                        SET @Msg = '    Found granulate batch: ' + @GranulateDNCBatchNo 
                                 + ', HPP_ID: ' + CAST(ISNULL(@GranulateHPPActualID, 0) AS VARCHAR)
                                 + ', Cost/g: ' + CAST(ISNULL(@GranulateCostPerGram, 0) AS VARCHAR);
                        PRINT @Msg;
                    END
                END
                
                -- Update material record with granulate info
                UPDATE #Materials
                SET Granulate_Batch = @GranulateDNCBatchNo,
                    Granulate_Cost_Per_Gram = @GranulateCostPerGram,
                    -- v9: Store the granulate's HPP_Actual_ID for reference
                    Granulate_MR_No = CAST(@GranulateHPPActualID AS VARCHAR),
                    -- Set the unit price as cost per gram
                    Unit_Price = ISNULL(@GranulateCostPerGram, 0),
                    Currency_Original = 'IDR',
                    Price_Source = 'GRANULATE_HPP',  -- v9: Changed from GRANULATE_CALC
                    Price_Source_Level = 0,
                    Unit_Conversion_Factor = 1,
                    Qty_In_PO_Unit = Qty_Used,
                    PO_Unit = 'g'
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
            -- =========================================
            DECLARE @MaxIterations INT = 5;
            DECLARE @Iteration INT = 1;
            DECLARE @RowsUpdated INT = 1;
            
            WHILE @Iteration <= @MaxIterations AND @RowsUpdated > 0
            BEGIN
                UPDATE m
                SET 
                    m.Unit_Price = CASE 
                        WHEN p2.PO_UnitPrice IS NOT NULL THEN p2.PO_UnitPrice 
                        ELSE m.Unit_Price 
                    END,
                    m.Currency_Original = CASE 
                        WHEN p2.PO_Currency IS NOT NULL THEN p2.PO_Currency 
                        ELSE m.Currency_Original 
                    END,
                    m.Price_Source = CASE 
                        WHEN p2.PO_UnitPrice IS NOT NULL THEN 'MR' 
                        ELSE m.Price_Source 
                    END,
                    m.Price_Source_Level = @Iteration,
                    m.PO_No = CASE 
                        WHEN p2.PO_UnitPrice IS NOT NULL THEN t2.TTBA_SourceDocNo 
                        ELSE m.PO_No 
                    END,
                    m.PO_SeqID = CASE 
                        WHEN p2.PO_UnitPrice IS NOT NULL THEN t2.TTBA_SourceDocSeqID 
                        ELSE m.PO_SeqID 
                    END,
                    m.PO_Unit = CASE 
                        WHEN p2.PO_ItemUnit IS NOT NULL THEN p2.PO_ItemUnit 
                        ELSE m.PO_Unit 
                    END,
                    m.Unit_Conversion_Factor = CASE 
                        WHEN p2.PO_ItemUnit IS NOT NULL THEN ISNULL(uc2.Conversion_Factor, 1)
                        ELSE m.Unit_Conversion_Factor 
                    END,
                    m.Qty_In_PO_Unit = CASE 
                        WHEN p2.PO_ItemUnit IS NOT NULL THEN m.Qty_Used * ISNULL(uc2.Conversion_Factor, 1)
                        ELSE m.Qty_In_PO_Unit 
                    END
                FROM #Materials m
                JOIN t_Bon_Keluar_Bahan_Awal_Header h2 ON m.MR_Source_No = h2.MR_No
                JOIN t_Bon_Keluar_Bahan_Awal_DNc d2 ON h2.MR_No = d2.MR_No AND d2.MR_ItemID = m.Item_ID
                LEFT JOIN t_DNc_Manufacturing dm2 ON d2.MR_DNcNo = dm2.DNc_No
                LEFT JOIN t_ttba_manufacturing_detail t2 ON dm2.DNc_TTBANo = t2.TTBA_No AND dm2.DNc_TTBASeqID = t2.TTBA_SeqID
                LEFT JOIN t_PO_Manufacturing_Detail p2 ON t2.TTBA_SourceDocNo = p2.PO_No AND t2.TTBA_SourceDocSeqID = p2.PO_SeqID
                LEFT JOIN M_COGS_Unit_Conversion uc2 ON m.Usage_Unit = uc2.From_Unit AND p2.PO_ItemUnit = uc2.To_Unit
                WHERE m.Price_Source = 'MR' AND m.Unit_Price = 0
                  AND m.Is_Granulate = 0  -- v7: Skip granulates (already processed)
                  AND p2.PO_UnitPrice IS NOT NULL;
                
                SET @RowsUpdated = @@ROWCOUNT;
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
                -- v11: Rates from standard HPP (t_COGS_HPP_Product_Header)
                Rate_MH_Proses = ISNULL(std.Direct_Labor, h.Rate_MH_Proses),
                Rate_MH_Kemas = ISNULL(std.Direct_Labor, h.Rate_MH_Kemas),
                Rate_MH_Timbang = ISNULL(std.Direct_Labor, h.Rate_MH_Timbang),
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
    
    -- =========================================
    -- Summary
    -- =========================================
    DECLARE @Duration INT = DATEDIFF(SECOND, @StartTime, GETDATE());
    
    PRINT '';
    PRINT '========================================';
    PRINT 'HPP Actual Calculation Summary (v11)';
    PRINT '========================================';
    SET @Msg = 'Granulates processed: ' + CAST(@GranulatePassProcessed AS VARCHAR);
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
        @BatchCount as TotalProductBatches,
        @ProcessedCount as ProductsProcessed,
        @ErrorCount as Errors,
        @Duration as DurationSeconds;
END
GO

PRINT 'Stored procedure sp_COGS_Calculate_HPP_Actual v11 created successfully';
GO
