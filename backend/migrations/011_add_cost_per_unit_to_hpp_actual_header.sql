-- =====================================================================
-- Migration: Add Cost_Per_Unit column to t_COGS_HPP_Actual_Header
-- Purpose: Support v9 granulate-as-product architecture
-- For granulates, this stores the calculated cost per gram
-- For products, this can store cost per unit (e.g., per tablet, per mL)
-- =====================================================================

IF NOT EXISTS (
    SELECT 1 FROM sys.columns 
    WHERE object_id = OBJECT_ID('t_COGS_HPP_Actual_Header') 
    AND name = 'Cost_Per_Unit'
)
BEGIN
    ALTER TABLE t_COGS_HPP_Actual_Header
    ADD Cost_Per_Unit DECIMAL(18,6) NULL;
    
    PRINT 'Added Cost_Per_Unit column to t_COGS_HPP_Actual_Header';
END
ELSE
BEGIN
    PRINT 'Cost_Per_Unit column already exists';
END
GO
