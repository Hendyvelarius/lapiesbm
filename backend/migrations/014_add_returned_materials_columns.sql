-- =====================================================================
-- Migration 014: Add returned materials tracking columns
-- Purpose: Support for subtracting returned materials (Bon Pengembalian)
--          from HPP Actual calculation
-- 
-- Returned materials (RTR_GoodAmount from t_Bon_Pengembalian_Bahan_Awal)
-- represent materials that were issued to production but returned unused.
-- These should be subtracted from material usage to get accurate costs.
-- =====================================================================

-- Add Qty_Returned to detail table (tracks how much was returned per material line)
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 't_COGS_HPP_Actual_Detail' AND COLUMN_NAME = 'Qty_Returned'
)
BEGIN
    ALTER TABLE t_COGS_HPP_Actual_Detail 
    ADD Qty_Returned DECIMAL(18,6) NULL DEFAULT 0;
    PRINT 'Added Qty_Returned to t_COGS_HPP_Actual_Detail';
END
GO

-- Add Total_Cost_Returned to header table (total cost of returned materials for summary)
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 't_COGS_HPP_Actual_Header' AND COLUMN_NAME = 'Total_Cost_Returned'
)
BEGIN
    ALTER TABLE t_COGS_HPP_Actual_Header 
    ADD Total_Cost_Returned DECIMAL(18,4) NULL DEFAULT 0;
    PRINT 'Added Total_Cost_Returned to t_COGS_HPP_Actual_Header';
END
GO

PRINT 'Migration 014 completed: Returned materials columns added';
GO
