-- =============================================
-- Migration: 004_create_hpp_actual_procedure.sql
-- Description: Stored procedure to calculate HPP Actual (True Cost)
-- Created: 2026-01-19
-- =============================================

-- =============================================
-- HELPER FUNCTION: Get currency rate for closest date
-- =============================================
IF EXISTS (SELECT * FROM sys.objects WHERE type = 'FN' AND name = 'fn_COGS_GetCurrencyRate')
    DROP FUNCTION fn_COGS_GetCurrencyRate;
GO

CREATE FUNCTION fn_COGS_GetCurrencyRate (
    @Currency NVARCHAR(10),
    @TargetDate DATE
)
RETURNS DECIMAL(18,6)
AS
BEGIN
    DECLARE @Rate DECIMAL(18,6) = 1; -- Default for IDR
    
    IF @Currency IS NULL OR @Currency = '' OR @Currency = 'IDR'
        RETURN 1;
    
    -- Get closest date rate (prefer same or earlier date, fallback to later)
    SELECT TOP 1 @Rate = 
        CASE @Currency
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
    WHERE [date] <= @TargetDate
    ORDER BY [date] DESC;
    
    -- If no earlier date found, get the earliest available
    IF @Rate IS NULL OR @Rate = 0
    BEGIN
        SELECT TOP 1 @Rate = 
            CASE @Currency
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
        ORDER BY [date] ASC;
    END
    
    RETURN ISNULL(@Rate, 1);
END
GO

PRINT 'Function fn_COGS_GetCurrencyRate created';
GO

-- =============================================
-- MAIN STORED PROCEDURE: Calculate HPP Actual
-- =============================================
IF EXISTS (SELECT * FROM sys.procedures WHERE name = 'sp_COGS_Calculate_HPP_Actual')
    DROP PROCEDURE sp_COGS_Calculate_HPP_Actual;
GO

CREATE PROCEDURE sp_COGS_Calculate_HPP_Actual
    @DNcProductID NVARCHAR(50) = NULL,      -- NULL = process all pending, or specific batch
    @Periode NVARCHAR(6) = NULL,            -- NULL = all, or specific period (YYYYMM)
    @ForceRecalculate BIT = 0,              -- 1 = recalculate even if completed
    @Debug BIT = 0                           -- 1 = print debug messages
AS
BEGIN
    SET NOCOUNT ON;
    
    DECLARE @StartTime DATETIME = GETDATE();
    DECLARE @ProcessedCount INT = 0;
    DECLARE @ErrorCount INT = 0;
    
    -- =============================================
    -- STEP 1: Create temp table for batches to process
    -- =============================================
    IF @Debug = 1 PRINT 'Step 1: Identifying batches to process...';
    
    CREATE TABLE #BatchesToProcess (
        DNc_ProductID NVARCHAR(50) PRIMARY KEY,
        Product_ID NVARCHAR(50),
        BatchNo NVARCHAR(50),
        BatchDate DATE,
        TempelLabel_Date DATE,
        Output_Actual DECIMAL(18,4)
    );
    
    -- Get batches from t_dnc_product that need processing
    INSERT INTO #BatchesToProcess
    SELECT 
        dp.DNc_ProductID,
        dp.DNc_ProductID AS Product_ID, -- Will be updated from product master
        dp.DNc_BatchNo,
        dp.DNc_BatchDate,
        dp.DNC_TempelLabel,
        ISNULL(dp.DNC_Diluluskan, 0)
    FROM t_dnc_product dp
    LEFT JOIN t_COGS_HPP_Actual_Header h ON dp.DNc_ProductID = h.DNc_ProductID
    WHERE dp.DNC_TempelLabel >= '2025-01-01'
      AND dp.DNC_Diluluskan > 0
      AND (@DNcProductID IS NULL OR dp.DNc_ProductID = @DNcProductID)
      AND (@Periode IS NULL OR CONVERT(VARCHAR(6), dp.DNC_TempelLabel, 112) = @Periode)
      AND (@ForceRecalculate = 1 OR h.HPP_Actual_ID IS NULL OR h.Calculation_Status = 'PENDING');
    
    IF @Debug = 1 
    BEGIN
        DECLARE @BatchCount INT = (SELECT COUNT(*) FROM #BatchesToProcess);
        PRINT 'Found ' + CAST(@BatchCount AS VARCHAR) + ' batches to process';
    END
    
    -- =============================================
    -- STEP 2: Process each batch
    -- =============================================
    DECLARE @CurrentDNcProductID NVARCHAR(50);
    DECLARE @CurrentProductID NVARCHAR(50);
    DECLARE @CurrentBatchNo NVARCHAR(50);
    DECLARE @CurrentBatchDate DATE;
    DECLARE @CurrentTempelLabel DATE;
    DECLARE @CurrentOutput DECIMAL(18,4);
    DECLARE @HPP_Actual_ID INT;
    
    DECLARE batch_cursor CURSOR LOCAL FAST_FORWARD FOR
        SELECT DNc_ProductID, Product_ID, BatchNo, BatchDate, TempelLabel_Date, Output_Actual
        FROM #BatchesToProcess;
    
    OPEN batch_cursor;
    FETCH NEXT FROM batch_cursor INTO 
        @CurrentDNcProductID, @CurrentProductID, @CurrentBatchNo, 
        @CurrentBatchDate, @CurrentTempelLabel, @CurrentOutput;
    
    WHILE @@FETCH_STATUS = 0
    BEGIN
        BEGIN TRY
            IF @Debug = 1 PRINT 'Processing batch: ' + @CurrentDNcProductID;
            
            BEGIN TRANSACTION;
            
            -- =============================================
            -- STEP 2a: Delete existing records if recalculating
            -- =============================================
            DELETE FROM t_COGS_HPP_Actual_Detail WHERE DNc_ProductID = @CurrentDNcProductID;
            DELETE FROM t_COGS_HPP_Actual_Header WHERE DNc_ProductID = @CurrentDNcProductID;
            
            -- =============================================
            -- STEP 2b: Insert header record
            -- =============================================
            INSERT INTO t_COGS_HPP_Actual_Header (
                DNc_ProductID, Product_ID, BatchNo, BatchDate, TempelLabel_Date,
                Periode, Output_Actual, Calculation_Status
            )
            VALUES (
                @CurrentDNcProductID,
                @CurrentProductID,
                @CurrentBatchNo,
                @CurrentBatchDate,
                @CurrentTempelLabel,
                CONVERT(VARCHAR(6), @CurrentTempelLabel, 112),
                @CurrentOutput,
                'PROCESSING'
            );
            
            SET @HPP_Actual_ID = SCOPE_IDENTITY();
            
            -- =============================================
            -- STEP 2c: Get all materials used (from Bon Keluar)
            -- =============================================
            CREATE TABLE #MaterialsUsed (
                MR_No NVARCHAR(50),
                MR_SeqID INT,
                Item_ID NVARCHAR(20),
                Item_Type NVARCHAR(10),
                Qty_Used DECIMAL(18,6),
                DNc_No NVARCHAR(50),
                DNc_TTBANo NVARCHAR(50),
                DNc_TTBASeqID INT,
                DNc_BeforeNo NVARCHAR(50),
                TTBA_SourceDocNo NVARCHAR(50),
                TTBA_SourceDocSeqID INT,
                TTBA_BatchNo NVARCHAR(50),
                Price_Source NVARCHAR(20),
                Unit_Price DECIMAL(18,4),
                Currency_Original NVARCHAR(10),
                PO_No NVARCHAR(50),
                PO_SeqID INT,
                DNc_Original NVARCHAR(50),
                Price_Source_Level INT DEFAULT 1
            );
            
            -- Get materials from Bon Keluar for this batch
            INSERT INTO #MaterialsUsed (
                MR_No, MR_SeqID, Item_ID, Qty_Used, DNc_No,
                DNc_TTBANo, DNc_TTBASeqID, DNc_BeforeNo,
                TTBA_SourceDocNo, TTBA_SourceDocSeqID, TTBA_BatchNo
            )
            SELECT 
                h.MR_No,
                d.MR_SeqID,
                d.MR_ItemID,
                d.MR_DNcQTY,
                d.MR_DNcNo,
                dm.DNc_TTBANo,
                dm.DNc_TTBASeqID,
                dm.DNc_BeforeNo,
                t.TTBA_SourceDocNo,
                t.TTBA_SourceDocSeqID,
                t.TTBA_BatchNo
            FROM t_Bon_Keluar_Bahan_Awal_Header h
            JOIN t_Bon_Keluar_Bahan_Awal_DNc d ON h.MR_No = d.MR_No
            LEFT JOIN t_DNc_Manufacturing dm ON d.MR_DNcNo = dm.DNc_No
            LEFT JOIN t_ttba_manufacturing_detail t ON dm.DNc_TTBANo = t.TTBA_No 
                AND dm.DNc_TTBASeqID = t.TTBA_SeqID
            WHERE h.MR_ProductID = @CurrentDNcProductID;
            
            -- Set Item_Type based on prefix
            UPDATE #MaterialsUsed
            SET Item_Type = CASE 
                WHEN Item_ID LIKE 'BB %' OR Item_ID LIKE 'IN %' THEN 'BB'
                WHEN Item_ID LIKE 'BK %' THEN 'BK'
                WHEN Item_ID LIKE 'PM %' THEN 'PM'
                WHEN Item_ID LIKE 'FL %' OR Item_ID LIKE 'PD %' THEN 'BB' -- Flavors, Processed materials
                ELSE 'BB' -- Default to raw material
            END;
            
            -- =============================================
            -- STEP 2d: Classify and get prices
            -- =============================================
            
            -- CASE 1: PM (Toll Manufacturing) - Cost = 0
            UPDATE #MaterialsUsed
            SET Price_Source = 'PM',
                Unit_Price = 0,
                Currency_Original = 'IDR'
            WHERE Item_ID LIKE 'PM %';
            
            -- CASE 2: Direct PO link
            UPDATE m
            SET Price_Source = 'PO',
                Unit_Price = p.PO_UnitPrice,
                Currency_Original = p.PO_Currency,
                PO_No = p.PO_No,
                PO_SeqID = p.PO_SeqID
            FROM #MaterialsUsed m
            JOIN t_PO_Manufacturing_Detail p ON m.TTBA_SourceDocNo = p.PO_No 
                AND m.TTBA_SourceDocSeqID = p.PO_SeqID
            WHERE m.TTBA_SourceDocNo LIKE '%/PO/%'
              AND m.Price_Source IS NULL;
            
            -- =============================================
            -- CASE 3: MR/RTR - Recursive trace via DNc_BeforeNo
            -- =============================================
            DECLARE @MaxIterations INT = 50;
            DECLARE @Iteration INT = 1;
            DECLARE @RowsUpdated INT = 1;
            
            WHILE @RowsUpdated > 0 AND @Iteration <= @MaxIterations
            BEGIN
                -- Find DNc_BeforeNo for unresolved MR/RTR items
                ;WITH RecursiveTrace AS (
                    SELECT 
                        m.MR_No,
                        m.MR_SeqID,
                        dm.DNc_No AS OriginalDNc,
                        dm.DNc_BeforeNo,
                        dm2.DNc_TTBANo,
                        dm2.DNc_TTBASeqID,
                        t.TTBA_SourceDocNo,
                        t.TTBA_SourceDocSeqID,
                        @Iteration + 1 AS TraceLevel
                    FROM #MaterialsUsed m
                    JOIN t_DNc_Manufacturing dm ON m.DNc_No = dm.DNc_No
                    JOIN t_DNc_Manufacturing dm2 ON dm.DNc_BeforeNo = dm2.DNc_No
                    LEFT JOIN t_ttba_manufacturing_detail t ON dm2.DNc_TTBANo = t.TTBA_No 
                        AND dm2.DNc_TTBASeqID = t.TTBA_SeqID
                    WHERE (m.TTBA_SourceDocNo LIKE '%/MR' OR m.TTBA_SourceDocNo LIKE '%/RTR')
                      AND m.Price_Source IS NULL
                      AND dm.DNc_BeforeNo IS NOT NULL 
                      AND dm.DNc_BeforeNo != ''
                )
                UPDATE m
                SET m.DNc_No = rt.DNc_BeforeNo,
                    m.DNc_Original = ISNULL(m.DNc_Original, rt.OriginalDNc),
                    m.DNc_TTBANo = rt.DNc_TTBANo,
                    m.DNc_TTBASeqID = rt.DNc_TTBASeqID,
                    m.TTBA_SourceDocNo = rt.TTBA_SourceDocNo,
                    m.TTBA_SourceDocSeqID = rt.TTBA_SourceDocSeqID,
                    m.Price_Source_Level = rt.TraceLevel
                FROM #MaterialsUsed m
                JOIN RecursiveTrace rt ON m.MR_No = rt.MR_No AND m.MR_SeqID = rt.MR_SeqID;
                
                SET @RowsUpdated = @@ROWCOUNT;
                
                -- Try to resolve with PO
                UPDATE m
                SET Price_Source = 'MR',
                    Unit_Price = p.PO_UnitPrice,
                    Currency_Original = p.PO_Currency,
                    PO_No = p.PO_No,
                    PO_SeqID = p.PO_SeqID
                FROM #MaterialsUsed m
                JOIN t_PO_Manufacturing_Detail p ON m.TTBA_SourceDocNo = p.PO_No 
                    AND m.TTBA_SourceDocSeqID = p.PO_SeqID
                WHERE m.TTBA_SourceDocNo LIKE '%/PO/%'
                  AND m.Price_Source IS NULL;
                
                SET @Iteration = @Iteration + 1;
            END
            
            -- Mark remaining MR/RTR as RTR (if traced) or keep tracking
            UPDATE #MaterialsUsed
            SET Price_Source = 'RTR'
            WHERE (TTBA_SourceDocNo LIKE '%/MR' OR TTBA_SourceDocNo LIKE '%/RTR')
              AND Price_Source IS NULL
              AND Price_Source_Level > 1;
            
            -- =============================================
            -- CASE 4: BPHP (Granule) - Second layer calculation
            -- =============================================
            -- For now, mark as BPHP and use average cost from granule batch
            UPDATE m
            SET Price_Source = 'BPHP',
                m.TTBA_BatchNo = t.TTBA_BatchNo
            FROM #MaterialsUsed m
            JOIN t_ttba_manufacturing_detail t ON m.DNc_TTBANo = t.TTBA_No 
                AND m.DNc_TTBASeqID = t.TTBA_SeqID
            WHERE m.TTBA_SourceDocNo LIKE '%/BPHP'
              AND m.Price_Source IS NULL;
            
            -- TODO: Calculate actual BPHP cost from granule batch materials
            -- For now, try to get standard price
            UPDATE m
            SET Unit_Price = ISNULL(hb.Harga_Beli, 0),
                Currency_Original = 'IDR'
            FROM #MaterialsUsed m
            LEFT JOIN M_COGS_STD_HRG_BAHAN hb ON m.Item_ID = hb.Item_ID
            WHERE m.Price_Source = 'BPHP'
              AND m.Unit_Price IS NULL;
            
            -- =============================================
            -- CASE 5: UNLINKED - Materials with broken chain
            -- =============================================
            UPDATE #MaterialsUsed
            SET Price_Source = 'UNLINKED'
            WHERE Price_Source IS NULL
              AND Item_Type != 'PM';
            
            -- Try to get standard price for unlinked items
            UPDATE m
            SET Unit_Price = ISNULL(hb.Harga_Beli, 0),
                Currency_Original = ISNULL(hb.Curr, 'IDR')
            FROM #MaterialsUsed m
            LEFT JOIN M_COGS_STD_HRG_BAHAN hb ON m.Item_ID = hb.Item_ID
            WHERE m.Price_Source = 'UNLINKED'
              AND (m.Unit_Price IS NULL OR m.Unit_Price = 0);
            
            -- =============================================
            -- CASE 6: STD - Fallback to standard price
            -- =============================================
            UPDATE m
            SET Price_Source = 'STD',
                Unit_Price = ISNULL(hb.Harga_Beli, 0),
                Currency_Original = ISNULL(hb.Curr, 'IDR')
            FROM #MaterialsUsed m
            LEFT JOIN M_COGS_STD_HRG_BAHAN hb ON m.Item_ID = hb.Item_ID
            WHERE m.Price_Source IS NULL;
            
            -- =============================================
            -- STEP 2e: Insert detail records with currency conversion
            -- =============================================
            INSERT INTO t_COGS_HPP_Actual_Detail (
                HPP_Actual_ID, DNc_ProductID, Item_ID, Item_Type, Item_Unit,
                Qty_Used, Unit_Price, Currency_Original, Exchange_Rate, Unit_Price_IDR,
                Price_Source, Price_Source_Level,
                MR_No, MR_SeqID, DNc_No, DNc_Original, TTBA_No, TTBA_SeqID, PO_No, PO_SeqID,
                BPHP_BatchNo, Calculation_Notes
            )
            SELECT 
                @HPP_Actual_ID,
                @CurrentDNcProductID,
                m.Item_ID,
                m.Item_Type,
                i.Item_StkUnitID,
                m.Qty_Used,
                ISNULL(m.Unit_Price, 0),
                ISNULL(m.Currency_Original, 'IDR'),
                dbo.fn_COGS_GetCurrencyRate(m.Currency_Original, @CurrentTempelLabel),
                CASE 
                    WHEN m.Currency_Original = 'IDR' OR m.Currency_Original IS NULL 
                    THEN ISNULL(m.Unit_Price, 0)
                    ELSE ISNULL(m.Unit_Price, 0) * dbo.fn_COGS_GetCurrencyRate(m.Currency_Original, @CurrentTempelLabel)
                END,
                ISNULL(m.Price_Source, 'UNLINKED'),
                m.Price_Source_Level,
                m.MR_No,
                m.MR_SeqID,
                m.DNc_No,
                m.DNc_Original,
                m.DNc_TTBANo,
                m.DNc_TTBASeqID,
                m.PO_No,
                m.PO_SeqID,
                m.TTBA_BatchNo,
                CASE 
                    WHEN m.Price_Source = 'UNLINKED' THEN 'WARNING: Broken chain - using standard price'
                    WHEN m.Price_Source = 'STD' THEN 'No PO found - using standard price'
                    WHEN m.Price_Source = 'BPHP' THEN 'Granule material - batch: ' + ISNULL(m.TTBA_BatchNo, 'N/A')
                    WHEN m.Price_Source = 'MR' THEN 'Traced ' + CAST(m.Price_Source_Level AS VARCHAR) + ' levels via MR'
                    WHEN m.Price_Source = 'PM' THEN 'Toll manufacturing - no cost'
                    ELSE NULL
                END
            FROM #MaterialsUsed m
            LEFT JOIN m_Item i ON m.Item_ID = i.Item_ID;
            
            -- =============================================
            -- STEP 2f: Update header with totals
            -- =============================================
            UPDATE h
            SET 
                -- Material cost totals
                Total_Cost_BB = ISNULL((
                    SELECT SUM(Total_Cost) FROM t_COGS_HPP_Actual_Detail 
                    WHERE HPP_Actual_ID = @HPP_Actual_ID AND Item_Type = 'BB'
                ), 0),
                Total_Cost_BK = ISNULL((
                    SELECT SUM(Total_Cost) FROM t_COGS_HPP_Actual_Detail 
                    WHERE HPP_Actual_ID = @HPP_Actual_ID AND Item_Type = 'BK'
                ), 0),
                
                -- Price source counts
                Count_Materials_PO = (SELECT COUNT(*) FROM t_COGS_HPP_Actual_Detail WHERE HPP_Actual_ID = @HPP_Actual_ID AND Price_Source = 'PO'),
                Count_Materials_MR = (SELECT COUNT(*) FROM t_COGS_HPP_Actual_Detail WHERE HPP_Actual_ID = @HPP_Actual_ID AND Price_Source IN ('MR', 'RTR')),
                Count_Materials_BPHP = (SELECT COUNT(*) FROM t_COGS_HPP_Actual_Detail WHERE HPP_Actual_ID = @HPP_Actual_ID AND Price_Source = 'BPHP'),
                Count_Materials_STD = (SELECT COUNT(*) FROM t_COGS_HPP_Actual_Detail WHERE HPP_Actual_ID = @HPP_Actual_ID AND Price_Source = 'STD'),
                Count_Materials_PM = (SELECT COUNT(*) FROM t_COGS_HPP_Actual_Detail WHERE HPP_Actual_ID = @HPP_Actual_ID AND Price_Source = 'PM'),
                Count_Materials_UNLINKED = (SELECT COUNT(*) FROM t_COGS_HPP_Actual_Detail WHERE HPP_Actual_ID = @HPP_Actual_ID AND Price_Source = 'UNLINKED'),
                
                -- Get manhours from tmp_spLapProduksi_GWN if available
                MH_Proses_Actual = ISNULL((
                    SELECT TOP 1 MH_NyataProses FROM tmp_spLapProduksi_GWN 
                    WHERE Group_productid = @CurrentProductID AND Reg_BatchNo = @CurrentBatchNo
                ), 0),
                MH_Kemas_Actual = ISNULL((
                    SELECT TOP 1 MH_NyataKemas FROM tmp_spLapProduksi_GWN 
                    WHERE Group_productid = @CurrentProductID AND Reg_BatchNo = @CurrentBatchNo
                ), 0),
                Rendemen_Actual = ISNULL((
                    SELECT TOP 1 RendemenNyata FROM tmp_spLapProduksi_GWN 
                    WHERE Group_productid = @CurrentProductID AND Reg_BatchNo = @CurrentBatchNo
                ), 0),
                
                -- Get standard rates from M_COGS_STD_PARAMETER
                Rate_MH_Proses = ISNULL((SELECT TOP 1 Direct_Labor_PN1 FROM M_COGS_STD_PARAMETER WHERE Periode = CAST(YEAR(@CurrentTempelLabel) AS VARCHAR)), 0),
                Rate_MH_Kemas = ISNULL((SELECT TOP 1 Direct_Labor_PN1 FROM M_COGS_STD_PARAMETER WHERE Periode = CAST(YEAR(@CurrentTempelLabel) AS VARCHAR)), 0),
                Direct_Labor = ISNULL((SELECT TOP 1 Direct_Labor_PN1 FROM M_COGS_STD_PARAMETER WHERE Periode = CAST(YEAR(@CurrentTempelLabel) AS VARCHAR)), 0),
                Factory_Overhead = ISNULL((SELECT TOP 1 Factory_Over_Head_PN1 FROM M_COGS_STD_PARAMETER WHERE Periode = CAST(YEAR(@CurrentTempelLabel) AS VARCHAR)), 0),
                Depresiasi = ISNULL((SELECT TOP 1 Depresiasi_PN1 FROM M_COGS_STD_PARAMETER WHERE Periode = CAST(YEAR(@CurrentTempelLabel) AS VARCHAR)), 0),
                
                -- Status
                Calculation_Status = 'COMPLETED',
                Calculation_Date = GETDATE()
            FROM t_COGS_HPP_Actual_Header h
            WHERE h.HPP_Actual_ID = @HPP_Actual_ID;
            
            -- Cleanup temp table
            DROP TABLE #MaterialsUsed;
            
            COMMIT TRANSACTION;
            SET @ProcessedCount = @ProcessedCount + 1;
            
        END TRY
        BEGIN CATCH
            IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
            
            -- Log error in header
            IF @HPP_Actual_ID IS NOT NULL
            BEGIN
                UPDATE t_COGS_HPP_Actual_Header
                SET Calculation_Status = 'ERROR',
                    Error_Message = ERROR_MESSAGE(),
                    Calculation_Date = GETDATE()
                WHERE HPP_Actual_ID = @HPP_Actual_ID;
            END
            
            IF @Debug = 1 
                PRINT 'Error processing ' + @CurrentDNcProductID + ': ' + ERROR_MESSAGE();
            
            SET @ErrorCount = @ErrorCount + 1;
            
            -- Cleanup temp table if exists
            IF OBJECT_ID('tempdb..#MaterialsUsed') IS NOT NULL
                DROP TABLE #MaterialsUsed;
        END CATCH
        
        FETCH NEXT FROM batch_cursor INTO 
            @CurrentDNcProductID, @CurrentProductID, @CurrentBatchNo,
            @CurrentBatchDate, @CurrentTempelLabel, @CurrentOutput;
    END
    
    CLOSE batch_cursor;
    DEALLOCATE batch_cursor;
    
    -- Cleanup
    DROP TABLE #BatchesToProcess;
    
    -- Return summary
    SELECT 
        @ProcessedCount AS BatchesProcessed,
        @ErrorCount AS BatchesWithErrors,
        DATEDIFF(SECOND, @StartTime, GETDATE()) AS ProcessingTimeSeconds;
END
GO

PRINT 'Stored procedure sp_COGS_Calculate_HPP_Actual created';
GO

-- =============================================
-- UPDATE VIEWS to show UNLINKED materials clearly
-- =============================================
IF EXISTS (SELECT * FROM sys.views WHERE name = 'vw_COGS_HPP_Actual_Summary')
    DROP VIEW vw_COGS_HPP_Actual_Summary;
GO

CREATE VIEW vw_COGS_HPP_Actual_Summary AS
SELECT 
    h.HPP_Actual_ID,
    h.DNc_ProductID,
    h.Product_ID,
    h.Product_Name,
    h.BatchNo,
    h.TempelLabel_Date,
    h.Periode,
    h.LOB,
    h.Group_PNCategory_Dept,
    
    -- Output
    h.Output_Actual,
    h.Rendemen_Actual,
    
    -- Material Costs
    h.Total_Cost_BB,
    h.Total_Cost_BK,
    h.Total_Cost_Material,
    
    -- Per Unit Material Costs
    CASE WHEN h.Output_Actual > 0 THEN h.Total_Cost_BB / h.Output_Actual ELSE 0 END AS Cost_BB_PerUnit,
    CASE WHEN h.Output_Actual > 0 THEN h.Total_Cost_BK / h.Output_Actual ELSE 0 END AS Cost_BK_PerUnit,
    
    -- Manhour Costs
    h.MH_Proses_Actual,
    h.MH_Kemas_Actual,
    h.Cost_MH_Proses,
    h.Cost_MH_Kemas,
    
    -- Overhead
    h.Total_Overhead,
    h.Toll_Fee,
    
    -- Total Batch Cost
    h.Total_Cost_Batch,
    
    -- HPP Per Unit (Total / Output)
    CASE WHEN h.Output_Actual > 0 THEN h.Total_Cost_Batch / h.Output_Actual ELSE 0 END AS HPP_Per_Unit,
    
    -- Price Source Statistics
    h.Count_Materials_PO,
    h.Count_Materials_MR,
    h.Count_Materials_BPHP,
    h.Count_Materials_STD,
    h.Count_Materials_PM,
    h.Count_Materials_UNLINKED,
    (h.Count_Materials_PO + h.Count_Materials_MR + h.Count_Materials_BPHP + 
     h.Count_Materials_STD + h.Count_Materials_PM + ISNULL(h.Count_Materials_UNLINKED, 0)) AS Total_Materials,
    
    -- Data Quality Flag
    CASE 
        WHEN ISNULL(h.Count_Materials_UNLINKED, 0) > 0 THEN 'WARNING: Has unlinked materials'
        WHEN h.Count_Materials_STD > 0 THEN 'NOTICE: Using some standard prices'
        ELSE 'OK: All materials traced to PO'
    END AS Data_Quality_Status,
    
    -- Status
    h.Calculation_Status,
    h.Calculation_Date,
    h.Error_Message
FROM t_COGS_HPP_Actual_Header h;
GO

PRINT 'View vw_COGS_HPP_Actual_Summary updated';
GO

-- =============================================
-- VIEW: Unlinked materials report
-- =============================================
IF EXISTS (SELECT * FROM sys.views WHERE name = 'vw_COGS_HPP_Actual_Unlinked')
    DROP VIEW vw_COGS_HPP_Actual_Unlinked;
GO

CREATE VIEW vw_COGS_HPP_Actual_Unlinked AS
SELECT 
    d.HPP_Detail_ID,
    d.DNc_ProductID,
    h.Product_ID,
    h.BatchNo,
    h.TempelLabel_Date,
    d.Item_ID,
    d.Item_Name,
    d.Item_Type,
    d.Qty_Used,
    d.Unit_Price,
    d.Unit_Price_IDR,
    d.Total_Cost,
    d.Price_Source,
    d.MR_No,
    d.DNc_No,
    d.TTBA_No,
    d.Calculation_Notes
FROM t_COGS_HPP_Actual_Detail d
JOIN t_COGS_HPP_Actual_Header h ON d.HPP_Actual_ID = h.HPP_Actual_ID
WHERE d.Price_Source IN ('UNLINKED', 'STD', 'BPHP')
   OR d.Unit_Price = 0 
   OR d.Unit_Price IS NULL;
GO

PRINT 'View vw_COGS_HPP_Actual_Unlinked created';
GO

-- =============================================
-- Summary
-- =============================================
PRINT '';
PRINT '=== HPP Actual Procedure Created Successfully ===';
PRINT '';
PRINT 'Objects created:';
PRINT '  - fn_COGS_GetCurrencyRate: Currency conversion with closest-date lookup';
PRINT '  - sp_COGS_Calculate_HPP_Actual: Main calculation procedure';
PRINT '  - vw_COGS_HPP_Actual_Summary: Updated with UNLINKED count and Data_Quality_Status';
PRINT '  - vw_COGS_HPP_Actual_Unlinked: Report of materials with broken chains';
PRINT '';
PRINT 'Usage:';
PRINT '  -- Process all pending batches:';
PRINT '  EXEC sp_COGS_Calculate_HPP_Actual';
PRINT '';
PRINT '  -- Process specific batch:';
PRINT '  EXEC sp_COGS_Calculate_HPP_Actual @DNcProductID = ''01/2501''';
PRINT '';
PRINT '  -- Process specific period:';
PRINT '  EXEC sp_COGS_Calculate_HPP_Actual @Periode = ''202501''';
PRINT '';
PRINT '  -- Force recalculate:';
PRINT '  EXEC sp_COGS_Calculate_HPP_Actual @ForceRecalculate = 1';
PRINT '';
PRINT '  -- Debug mode:';
PRINT '  EXEC sp_COGS_Calculate_HPP_Actual @Debug = 1';
GO
