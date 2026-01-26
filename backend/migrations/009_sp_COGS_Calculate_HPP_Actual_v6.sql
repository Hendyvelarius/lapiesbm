-- =====================================================================
-- Stored Procedure: sp_COGS_Calculate_HPP_Actual (v6)
-- Purpose: Calculate true batch cost based on actual material prices
-- Changes in v6:
--   - FIX: Use m_Item_manufacturing as PRIMARY source for Item_Type
--     This table has 99.8% coverage (3134/3139 items) and already includes
--     items with .000, .001 suffixes with correct Item_Type
--   - Priority: 1) m_Item_manufacturing 2) M_COGS_STD_HRG_BAHAN 3) Pattern match
--   - Removed .000 suffix string manipulation - cleaner approach
-- Changes in v5:
--   - FIX: Aggregate formula PPI_QTY by Product_ID + PPI_ItemID to get
--     total requirement. Formula table has duplicate rows per item
--     (different PPI_SeqID for each manufacturing step) causing multiplication.
--   - Example: Product I1, AC 019B has 5 formula rows × 18000g = 90000g total
-- Changes in v4:
--   - CRITICAL FIX: Match MR_BatchDate with DNC_BatchDate to prevent
--     double-counting materials when batch numbers are reused across years
-- Changes in v3:
--   - Added Product_Name, LOB, Group info to Header
--   - Added Item_Name, Item_Unit, Qty_Required to Detail
--   - Added MR_No, MR_SeqID, TTBA_No, TTBA_SeqID to Detail
--   - Added Batch_Size_Std, Rendemen_Std, MH standards to Header
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
    
    -- Product info variables (NEW)
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
    
    -- =========================================
    -- STEP 1: Identify batches to process
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
    -- STEP 2: Process each batch
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
            
            -- =========================================
            -- Collect Materials with Price Tracing
            -- AGGREGATED by Item_ID + MR_DNcNo to avoid duplicates
            -- Now also capturing Item_Name, MR info, TTBA info
            -- =========================================
            CREATE TABLE #Materials (
                RowNum INT IDENTITY(1,1) PRIMARY KEY,
                MR_DNcNo VARCHAR(100),           -- Material batch number (key for aggregation)
                Item_ID VARCHAR(50),
                Item_Name VARCHAR(200),          -- NEW: Item name from master
                Item_Type VARCHAR(20),
                Item_Unit VARCHAR(20),           -- NEW: Item unit from master
                Qty_Required DECIMAL(18,6),      -- NEW: Required qty from formula
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
                MR_No VARCHAR(100),              -- NEW: MR document number
                MR_SeqID INT,                    -- NEW: MR line number
                DNc_Original VARCHAR(100),       -- NEW: Original batch (for reproc)
                TTBA_No VARCHAR(100),            -- NEW: TTBA document number
                TTBA_SeqID INT,                  -- NEW: TTBA line number
                PO_No VARCHAR(100),
                PO_SeqID INT,
                MR_Source_No VARCHAR(100),
                MR_Source_BatchNo VARCHAR(50),
                BPHP_No VARCHAR(100)
            );
            
            -- Insert materials AGGREGATED by Item_ID + MR_DNcNo
            -- Now with Item_Name, MR/TTBA info
            INSERT INTO #Materials (
                MR_DNcNo, Item_ID, Item_Name, Item_Type, Item_Unit, Qty_Required,
                Qty_Used, Usage_Unit, PO_Unit, Item_BJ, Unit_Conversion_Factor, Qty_In_PO_Unit,
                Unit_Price, Currency_Original, Price_Source, Price_Source_Level,
                MR_No, MR_SeqID, DNc_Original, TTBA_No, TTBA_SeqID,
                PO_No, PO_SeqID, MR_Source_No, MR_Source_BatchNo, BPHP_No
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
                MAX(CASE WHEN t.TTBA_SourceDocNo LIKE '%/BPHP%' THEN t.TTBA_SourceDocNo ELSE NULL END)
            FROM t_Bon_Keluar_Bahan_Awal_Header h
            JOIN t_Bon_Keluar_Bahan_Awal_DNc d ON h.MR_No = d.MR_No
            LEFT JOIN t_DNc_Manufacturing dm ON d.MR_DNcNo = dm.DNc_No
            LEFT JOIN t_ttba_manufacturing_detail t ON dm.DNc_TTBANo = t.TTBA_No AND dm.DNc_TTBASeqID = t.TTBA_SeqID
            LEFT JOIN t_PO_Manufacturing_Detail p ON t.TTBA_SourceDocNo = p.PO_No AND t.TTBA_SourceDocSeqID = p.PO_SeqID
            -- M_COGS_STD_HRG_BAHAN - used as fallback for Item_Type (lower priority than m_Item_manufacturing)
            LEFT JOIN (
                SELECT ITEM_ID, ITEM_TYPE
                FROM M_COGS_STD_HRG_BAHAN
                WHERE Periode = @GroupPeriode
            ) mst ON mst.ITEM_ID = d.MR_ItemID
            LEFT JOIN M_COGS_Unit_Conversion uc ON dm.DNc_UnitID = uc.From_Unit AND p.PO_ItemUnit = uc.To_Unit
            -- v6: m_Item_manufacturing is PRIMARY source for Item_Type (99.8% coverage)
            -- This table already has items with .000, .001 suffixes - direct match works
            LEFT JOIN m_Item_manufacturing itm ON itm.Item_ID = d.MR_ItemID
            -- v5 FIX: Aggregate formula by Product_ID + PPI_ItemID to get total requirement
            -- Formula table has multiple rows per item (different PPI_SeqID for each mfg step)
            -- Example: I1 + AC 019B has 5 rows × 18000g each = 90000g total requirement
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
              -- when batch numbers are reused across years
              AND h.MR_BatchDate = @CurrentDNCBatchDate
            GROUP BY d.MR_DNcNo, d.MR_ItemID;
            
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
            WHERE m.Price_Source = 'BPHP' AND m.Unit_Price = 0;
            
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
            WHERE m.Price_Source = 'UNLINKED' OR (m.Price_Source IN ('MR', 'BPHP') AND m.Unit_Price = 0);
            
            -- =========================================
            -- Convert to IDR using currency rates
            -- =========================================
            DECLARE @RateDate DATE = @CurrentTempelLabel;
            DECLARE @RateUSD DECIMAL(18,4), @RateEUR DECIMAL(18,4), @RateCHF DECIMAL(18,4);
            DECLARE @RateSGD DECIMAL(18,4), @RateJPY DECIMAL(18,4), @RateMYR DECIMAL(18,4);
            DECLARE @RateGBP DECIMAL(18,4), @RateRMB DECIMAL(18,4), @RateAUD DECIMAL(18,4);
            
            SELECT TOP 1
                @RateUSD = USD, @RateEUR = EUR, @RateCHF = CHF,
                @RateSGD = SGD, @RateJPY = JPY, @RateMYR = MYR,
                @RateGBP = GBP, @RateRMB = RMB, @RateAUD = AUD
            FROM m_COGS_Daily_Currency
            WHERE date <= @RateDate
            ORDER BY date DESC;
            
            IF @RateUSD IS NULL
            BEGIN
                SELECT TOP 1
                    @RateUSD = USD, @RateEUR = EUR, @RateCHF = CHF,
                    @RateSGD = SGD, @RateJPY = JPY, @RateMYR = MYR,
                    @RateGBP = GBP, @RateRMB = RMB, @RateAUD = AUD
                FROM m_COGS_Daily_Currency
                ORDER BY date ASC;
            END
            
            -- =========================================
            -- Insert Details with all new fields
            -- =========================================
            INSERT INTO t_COGS_HPP_Actual_Detail (
                HPP_Actual_ID, DNc_No, Item_ID, Item_Name, Item_Type, Item_Unit,
                Qty_Required, Qty_Used, Usage_Unit, PO_Unit, Item_BJ, 
                Unit_Conversion_Factor, Qty_In_PO_Unit,
                Unit_Price, Currency_Original, Exchange_Rate, Unit_Price_IDR,
                Price_Source, Price_Source_Level,
                MR_No, MR_SeqID, DNc_Material, DNc_Original, 
                TTBA_No, TTBA_SeqID, PO_No, PO_SeqID, MR_DNcNo,
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
                -- Exchange rate
                CASE Currency_Original
                    WHEN 'USD' THEN ISNULL(@RateUSD, 1)
                    WHEN 'EUR' THEN ISNULL(@RateEUR, 1)
                    WHEN 'CHF' THEN ISNULL(@RateCHF, 1)
                    WHEN 'SGD' THEN ISNULL(@RateSGD, 1)
                    WHEN 'JPY' THEN ISNULL(@RateJPY, 1)
                    WHEN 'MYR' THEN ISNULL(@RateMYR, 1)
                    WHEN 'GBP' THEN ISNULL(@RateGBP, 1)
                    WHEN 'RMB' THEN ISNULL(@RateRMB, 1)
                    WHEN 'AUD' THEN ISNULL(@RateAUD, 1)
                    ELSE 1
                END,
                -- Unit price in IDR (per PO unit)
                Unit_Price * CASE Currency_Original
                    WHEN 'USD' THEN ISNULL(@RateUSD, 1)
                    WHEN 'EUR' THEN ISNULL(@RateEUR, 1)
                    WHEN 'CHF' THEN ISNULL(@RateCHF, 1)
                    WHEN 'SGD' THEN ISNULL(@RateSGD, 1)
                    WHEN 'JPY' THEN ISNULL(@RateJPY, 1)
                    WHEN 'MYR' THEN ISNULL(@RateMYR, 1)
                    WHEN 'GBP' THEN ISNULL(@RateGBP, 1)
                    WHEN 'RMB' THEN ISNULL(@RateRMB, 1)
                    WHEN 'AUD' THEN ISNULL(@RateAUD, 1)
                    ELSE 1
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
                GETDATE()
            FROM #Materials;
            
            -- =========================================
            -- Update Header with totals
            -- =========================================
            UPDATE h
            SET 
                Total_Cost_BB = ISNULL(bb.Total, 0),
                Total_Cost_BK = ISNULL(bk.Total, 0),
                -- Calculate actual rendemen if we have batch size
                Rendemen_Actual = CASE 
                    WHEN h.Batch_Size_Std > 0 THEN (h.Output_Actual * 100.0) / h.Batch_Size_Std 
                    ELSE NULL 
                END,
                Count_Materials_PO = ISNULL(cnt.PO_Count, 0),
                Count_Materials_MR = ISNULL(cnt.MR_Count, 0),
                Count_Materials_BPHP = ISNULL(cnt.BPHP_Count, 0),
                Count_Materials_STD = ISNULL(cnt.STD_Count, 0),
                Count_Materials_PM = ISNULL(cnt.PM_Count, 0),
                Count_Materials_UNLINKED = ISNULL(cnt.UNLINKED_Count, 0),
                Calculation_Status = 'COMPLETED',
                Calculation_Date = GETDATE()
            FROM t_COGS_HPP_Actual_Header h
            LEFT JOIN (
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
    
    -- =========================================
    -- Summary
    -- =========================================
    DECLARE @Duration INT = DATEDIFF(SECOND, @StartTime, GETDATE());
    
    PRINT '';
    PRINT '========================================';
    PRINT 'HPP Actual Calculation Summary (v3)';
    PRINT '========================================';
    SET @Msg = 'Total batches: ' + CAST(@BatchCount AS VARCHAR);
    PRINT @Msg;
    SET @Msg = 'Processed: ' + CAST(@ProcessedCount AS VARCHAR);
    PRINT @Msg;
    SET @Msg = 'Errors: ' + CAST(@ErrorCount AS VARCHAR);
    PRINT @Msg;
    SET @Msg = 'Duration: ' + CAST(@Duration AS VARCHAR) + ' seconds';
    PRINT @Msg;
    PRINT '========================================';
    
    SELECT 
        @BatchCount as TotalBatches,
        @ProcessedCount as Processed,
        @ErrorCount as Errors,
        @Duration as DurationSeconds;
END
GO

PRINT 'Stored procedure sp_COGS_Calculate_HPP_Actual v3 created successfully';
GO
