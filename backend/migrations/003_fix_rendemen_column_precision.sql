-- Migration: Fix Rendemen columns precision to prevent arithmetic overflow
-- Issue: When Batch_Size_Std = 1 and Output_Actual is large (e.g., 22790),
--        the calculation (Output_Actual * 100.0) / Batch_Size_Std overflows decimal(10,4)
-- Example: 22790 * 100 / 1 = 2,279,000 which exceeds decimal(10,4) max of 999999.9999
-- Fix: Increase precision from decimal(10,4) to decimal(18,4)

-- Alter Rendemen_Std column
ALTER TABLE t_COGS_HPP_Actual_Header
ALTER COLUMN Rendemen_Std DECIMAL(18,4);

-- Alter Rendemen_Actual column  
ALTER TABLE t_COGS_HPP_Actual_Header
ALTER COLUMN Rendemen_Actual DECIMAL(18,4);

-- Verify the changes
SELECT 
    COLUMN_NAME, 
    DATA_TYPE, 
    NUMERIC_PRECISION, 
    NUMERIC_SCALE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 't_COGS_HPP_Actual_Header'
  AND COLUMN_NAME IN ('Rendemen_Std', 'Rendemen_Actual');
