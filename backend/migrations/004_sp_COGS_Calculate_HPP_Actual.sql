-- =====================================================================
-- Stored Procedure: sp_COGS_Calculate_HPP_Actual
-- Purpose: Calculate true batch cost based on actual material prices
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
    
    -- =========================================
    -- STEP 1: Identify batches to process
    -- =========================================
    CREATE TABLE #BatchesToProcess (
        DNc_No VARCHAR(100) PRIMARY KEY,
        DNc_ProductID VARCHAR(50),
        DNc_BatchNo VARCHAR(50),
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
        RETURN;
    END
    
    -- =========================================
    -- STEP 2: Process each batch
    -- =========================================
    DECLARE batch_cursor CURSOR LOCAL FAST_FORWARD FOR
        SELECT DNc_No, DNc_ProductID, DNc_BatchNo, BatchDate, TempelLabel_Date, Output_Actual
        FROM #BatchesToProcess;
    
    OPEN batch_cursor;
    FETCH NEXT FROM batch_cursor INTO @CurrentDNcNo, @CurrentProductID, @CurrentBatchNo, 
                                      @CurrentBatchDate, @CurrentTempelLabel, @CurrentOutputActual;
    
    WHILE @@FETCH_STATUS = 0
    BEGIN
        BEGIN TRY
            IF @Debug = 1
            BEGIN
                SET @Msg = 'Processing batch: ' + @CurrentDNcNo;
                PRINT @Msg;
            END
            
            -- Delete existing records if recalculating
            IF @RecalculateExisting = 1
            BEGIN
                DELETE FROM t_COGS_HPP_Actual_Detail WHERE DNc_No = @CurrentDNcNo;
                DELETE FROM t_COGS_HPP_Actual_Header WHERE DNc_No = @CurrentDNcNo;
            END
            
            -- =========================================
            -- Insert Header
            -- =========================================
            INSERT INTO t_COGS_HPP_Actual_Header (
                DNc_No, DNc_ProductID, BatchNo, BatchDate, TempelLabel_Date, 
                Periode, Output_Actual, Calculation_Status
            )
            VALUES (
                @CurrentDNcNo, @CurrentProductID, @CurrentBatchNo, @CurrentBatchDate, 
                @CurrentTempelLabel, ISNULL(@Periode, CONVERT(VARCHAR(6), @CurrentTempelLabel, 112)),
                @CurrentOutputActual, 'PROCESSING'
            );
            
            SET @HPP_Actual_ID = SCOPE_IDENTITY();
            
            -- =========================================
            -- Collect Materials with Price Tracing
            -- =========================================
            CREATE TABLE #Materials (
                RowNum INT IDENTITY(1,1) PRIMARY KEY,
                MR_No VARCHAR(100),
                MR_SeqID INT,
                Item_ID VARCHAR(50),
                Item_Type VARCHAR(20),
                Qty_Used DECIMAL(18,4),
                Unit_Price DECIMAL(18,4),
                Currency_Original VARCHAR(10),
                Price_Source VARCHAR(20),
                Price_Source_Level INT,
                PO_No VARCHAR(100),
                PO_SeqID INT,
                MR_Source_No VARCHAR(100),
                MR_Source_BatchNo VARCHAR(50),
                BPHP_No VARCHAR(100)
            );
            
            -- Insert all materials from MR records for this batch
            INSERT INTO #Materials (
                MR_No, MR_SeqID, Item_ID, Item_Type, Qty_Used,
                Unit_Price, Currency_Original, Price_Source, Price_Source_Level,
                PO_No, PO_SeqID, MR_Source_No, MR_Source_BatchNo, BPHP_No
            )
            SELECT 
                h.MR_No,
                d.MR_SeqID,
                d.MR_ItemID,
                -- Get Item Type from master table
                ISNULL(mst.ITEM_TYPE, 
                    CASE 
                        WHEN d.MR_ItemID LIKE 'BB %' THEN 'BB'
                        WHEN d.MR_ItemID LIKE 'BK %' THEN 'BK'
                        WHEN d.MR_ItemID LIKE 'PM %' THEN 'PM'
                        ELSE 'OTHER'
                    END
                ),
                ISNULL(d.MR_DNcQTY, 0),
                -- Price from PO
                CASE WHEN p.PO_UnitPrice IS NOT NULL THEN p.PO_UnitPrice ELSE 0 END,
                CASE WHEN p.PO_Currency IS NOT NULL THEN p.PO_Currency ELSE 'IDR' END,
                -- Price source
                CASE 
                    WHEN p.PO_UnitPrice IS NOT NULL THEN 'PO'
                    WHEN t.TTBA_SourceDocNo LIKE '%/MR' THEN 'MR'
                    WHEN t.TTBA_SourceDocNo LIKE '%/BPHP%' THEN 'BPHP'
                    WHEN d.MR_ItemID LIKE 'PM %' THEN 'PM'
                    ELSE 'UNLINKED'
                END,
                -- Level (0 = direct PO)
                CASE WHEN p.PO_UnitPrice IS NOT NULL THEN 0 ELSE 1 END,
                -- PO linkback
                CASE WHEN p.PO_UnitPrice IS NOT NULL THEN t.TTBA_SourceDocNo ELSE NULL END,
                CASE WHEN p.PO_UnitPrice IS NOT NULL THEN t.TTBA_SourceDocSeqID ELSE NULL END,
                -- MR source for recursive
                CASE WHEN t.TTBA_SourceDocNo LIKE '%/MR' THEN t.TTBA_SourceDocNo ELSE NULL END,
                CASE WHEN t.TTBA_SourceDocNo LIKE '%/MR' THEN t.TTBA_BatchNo ELSE NULL END,
                -- BPHP linkback
                CASE WHEN t.TTBA_SourceDocNo LIKE '%/BPHP%' THEN t.TTBA_SourceDocNo ELSE NULL END
            FROM t_Bon_Keluar_Bahan_Awal_Header h
            JOIN t_Bon_Keluar_Bahan_Awal_DNc d ON h.MR_No = d.MR_No
            LEFT JOIN t_DNc_Manufacturing dm ON d.MR_DNcNo = dm.DNc_No
            LEFT JOIN t_ttba_manufacturing_detail t ON dm.DNc_TTBANo = t.TTBA_No AND dm.DNc_TTBASeqID = t.TTBA_SeqID
            LEFT JOIN t_PO_Manufacturing_Detail p ON t.TTBA_SourceDocNo = p.PO_No AND t.TTBA_SourceDocSeqID = p.PO_SeqID
            LEFT JOIN M_COGS_STD_HRG_BAHAN mst ON d.MR_ItemID = mst.ITEM_ID
            WHERE h.MR_ProductID = @CurrentProductID 
              AND h.MR_BatchNo = @CurrentBatchNo;
            
            -- =========================================
            -- Process MR-sourced materials (recursive)
            -- =========================================
            DECLARE @MaxIterations INT = 5;
            DECLARE @Iteration INT = 1;
            DECLARE @RowsUpdated INT = 1;
            
            WHILE @Iteration <= @MaxIterations AND @RowsUpdated > 0
            BEGIN
                -- Update MR-sourced materials by tracing back
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
                    END
                FROM #Materials m
                JOIN t_Bon_Keluar_Bahan_Awal_Header h2 ON m.MR_Source_No = h2.MR_No
                JOIN t_Bon_Keluar_Bahan_Awal_DNc d2 ON h2.MR_No = d2.MR_No AND d2.MR_ItemID = m.Item_ID
                LEFT JOIN t_DNc_Manufacturing dm2 ON d2.MR_DNcNo = dm2.DNc_No
                LEFT JOIN t_ttba_manufacturing_detail t2 ON dm2.DNc_TTBANo = t2.TTBA_No AND dm2.DNc_TTBASeqID = t2.TTBA_SeqID
                LEFT JOIN t_PO_Manufacturing_Detail p2 ON t2.TTBA_SourceDocNo = p2.PO_No AND t2.TTBA_SourceDocSeqID = p2.PO_SeqID
                WHERE m.Price_Source = 'MR' AND m.Unit_Price = 0
                  AND p2.PO_UnitPrice IS NOT NULL;
                
                SET @RowsUpdated = @@ROWCOUNT;
                SET @Iteration = @Iteration + 1;
            END
            
            -- =========================================
            -- Process BPHP materials (granule pricing)
            -- =========================================
            -- For BPHP, get the granule cost from the BPHP batch
            UPDATE m
            SET 
                m.Unit_Price = ISNULL(hpp.Total_Cost_BB + hpp.Total_Cost_BK, 0) / NULLIF(hpp.Output_Actual, 0),
                m.Currency_Original = 'IDR',
                m.Price_Source = 'BPHP'
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
                m.Price_Source = CASE WHEN s.ITEM_PURCHASE_STD_PRICE IS NOT NULL THEN 'STD' ELSE 'UNLINKED' END
            FROM #Materials m
            LEFT JOIN M_COGS_STD_HRG_BAHAN s ON m.Item_ID = s.ITEM_ID
            WHERE m.Price_Source = 'UNLINKED' OR (m.Price_Source IN ('MR', 'BPHP') AND m.Unit_Price = 0);
            
            -- =========================================
            -- Convert to IDR using currency rates
            -- =========================================
            DECLARE @RateDate DATE = @CurrentTempelLabel;
            DECLARE @RateUSD DECIMAL(18,4), @RateEUR DECIMAL(18,4), @RateCHF DECIMAL(18,4);
            DECLARE @RateSGD DECIMAL(18,4), @RateJPY DECIMAL(18,4), @RateMYR DECIMAL(18,4);
            DECLARE @RateGBP DECIMAL(18,4), @RateRMB DECIMAL(18,4), @RateAUD DECIMAL(18,4);
            
            -- Get rates from the closest date on or before batch date
            SELECT TOP 1
                @RateUSD = USD, @RateEUR = EUR, @RateCHF = CHF,
                @RateSGD = SGD, @RateJPY = JPY, @RateMYR = MYR,
                @RateGBP = GBP, @RateRMB = RMB, @RateAUD = AUD
            FROM m_COGS_Daily_Currency
            WHERE date <= @RateDate
            ORDER BY date DESC;
            
            -- If no rate found, try earliest available
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
            -- Insert Details with IDR conversion
            -- =========================================
            INSERT INTO t_COGS_HPP_Actual_Detail (
                HPP_Actual_ID, DNc_No, Item_ID, Item_Type, Qty_Used,
                Unit_Price, Currency_Original, Exchange_Rate, Unit_Price_IDR,
                Price_Source, Price_Source_Level,
                PO_No, PO_SeqID
            )
            SELECT 
                @HPP_Actual_ID,
                @CurrentDNcNo,
                Item_ID,
                Item_Type,
                Qty_Used,
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
                -- Unit price in IDR
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
                PO_No,
                PO_SeqID
            FROM #Materials;
            
            -- =========================================
            -- Update Header with totals
            -- =========================================
            UPDATE h
            SET 
                Total_Cost_BB = ISNULL(bb.Total, 0),
                Total_Cost_BK = ISNULL(bk.Total, 0),
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
                SELECT HPP_Actual_ID, SUM(Qty_Used * Unit_Price_IDR) as Total
                FROM t_COGS_HPP_Actual_Detail
                WHERE Item_Type = 'BB'
                GROUP BY HPP_Actual_ID
            ) bb ON h.HPP_Actual_ID = bb.HPP_Actual_ID
            LEFT JOIN (
                SELECT HPP_Actual_ID, SUM(Qty_Used * Unit_Price_IDR) as Total
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
            
            -- Mark as error
            UPDATE t_COGS_HPP_Actual_Header 
            SET Calculation_Status = 'ERROR'
            WHERE DNc_No = @CurrentDNcNo;
            
            IF OBJECT_ID('tempdb..#Materials') IS NOT NULL
                DROP TABLE #Materials;
        END CATCH
        
        FETCH NEXT FROM batch_cursor INTO @CurrentDNcNo, @CurrentProductID, @CurrentBatchNo, 
                                          @CurrentBatchDate, @CurrentTempelLabel, @CurrentOutputActual;
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
    PRINT 'HPP Actual Calculation Summary';
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
    
    -- Return summary
    SELECT 
        @BatchCount as TotalBatches,
        @ProcessedCount as Processed,
        @ErrorCount as Errors,
        @Duration as DurationSeconds;
END
GO

PRINT 'Stored procedure sp_COGS_Calculate_HPP_Actual created successfully';
GO
