-- =====================================================================
-- Migration: 012_remove_bphp_columns_from_detail.sql
-- Purpose: Remove redundant BPHP columns from t_COGS_HPP_Actual_Detail
-- Reason: These columns duplicate the Granulate_* columns:
--   - BPHP_BatchNo       -> Granulate_Batch
--   - BPHP_Total_Cost    -> Granulate_Raw_Material_Cost
--   - BPHP_Output        -> Granulate_Output_Qty
--   - BPHP_Unit_Cost     -> Granulate_Cost_Per_Gram
--   - Calculation_Notes  -> Not used
-- Date: 2026-01-27
-- =====================================================================

-- Drop BPHP_BatchNo column
IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
           WHERE TABLE_NAME = 't_COGS_HPP_Actual_Detail' 
           AND COLUMN_NAME = 'BPHP_BatchNo')
BEGIN
    ALTER TABLE t_COGS_HPP_Actual_Detail DROP COLUMN BPHP_BatchNo;
    PRINT 'Dropped column: BPHP_BatchNo';
END
GO

-- Drop BPHP_Total_Cost column
IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
           WHERE TABLE_NAME = 't_COGS_HPP_Actual_Detail' 
           AND COLUMN_NAME = 'BPHP_Total_Cost')
BEGIN
    ALTER TABLE t_COGS_HPP_Actual_Detail DROP COLUMN BPHP_Total_Cost;
    PRINT 'Dropped column: BPHP_Total_Cost';
END
GO

-- Drop BPHP_Output column
IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
           WHERE TABLE_NAME = 't_COGS_HPP_Actual_Detail' 
           AND COLUMN_NAME = 'BPHP_Output')
BEGIN
    ALTER TABLE t_COGS_HPP_Actual_Detail DROP COLUMN BPHP_Output;
    PRINT 'Dropped column: BPHP_Output';
END
GO

-- Drop BPHP_Unit_Cost column
IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
           WHERE TABLE_NAME = 't_COGS_HPP_Actual_Detail' 
           AND COLUMN_NAME = 'BPHP_Unit_Cost')
BEGIN
    ALTER TABLE t_COGS_HPP_Actual_Detail DROP COLUMN BPHP_Unit_Cost;
    PRINT 'Dropped column: BPHP_Unit_Cost';
END
GO

-- Drop Calculation_Notes column
IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
           WHERE TABLE_NAME = 't_COGS_HPP_Actual_Detail' 
           AND COLUMN_NAME = 'Calculation_Notes')
BEGIN
    ALTER TABLE t_COGS_HPP_Actual_Detail DROP COLUMN Calculation_Notes;
    PRINT 'Dropped column: Calculation_Notes';
END
GO

PRINT 'Migration 012 completed: Removed redundant BPHP columns from t_COGS_HPP_Actual_Detail';
