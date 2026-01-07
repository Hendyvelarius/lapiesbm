-- Migration: Add soft delete and user tracking columns to t_COGS_HPP_Product_Header_Simulasi
-- Date: 2026-01-07
-- Description: 
--   1. Add user_id column to track who created the simulation
--   2. Add delegated_to column for delegation tracking
--   3. Add process_date column to track last modification date
--   4. Add flag_delete column for soft delete (recycle bin) functionality
-- Note: This script is compatible with DBeaver (no GO statements, uses dynamic SQL)

-- Check if columns already exist before adding them
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('t_COGS_HPP_Product_Header_Simulasi') AND name = 'user_id')
BEGIN
    ALTER TABLE t_COGS_HPP_Product_Header_Simulasi
    ADD user_id VARCHAR(50) NULL;
    
    PRINT 'Added column: user_id';
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('t_COGS_HPP_Product_Header_Simulasi') AND name = 'delegated_to')
BEGIN
    ALTER TABLE t_COGS_HPP_Product_Header_Simulasi
    ADD delegated_to VARCHAR(50) NULL;
    
    PRINT 'Added column: delegated_to';
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('t_COGS_HPP_Product_Header_Simulasi') AND name = 'process_date')
BEGIN
    ALTER TABLE t_COGS_HPP_Product_Header_Simulasi
    ADD process_date DATETIME NULL DEFAULT GETDATE();
    
    PRINT 'Added column: process_date';
END;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('t_COGS_HPP_Product_Header_Simulasi') AND name = 'flag_delete')
BEGIN
    ALTER TABLE t_COGS_HPP_Product_Header_Simulasi
    ADD flag_delete BIT NULL DEFAULT 0;
    
    PRINT 'Added column: flag_delete';
END;

-- Update existing records using dynamic SQL (so column is recognized after ALTER TABLE)
EXEC sp_executesql N'
    UPDATE t_COGS_HPP_Product_Header_Simulasi
    SET process_date = Simulasi_Date,
        flag_delete = 0
    WHERE process_date IS NULL OR flag_delete IS NULL;
';
PRINT 'Updated existing records with default values';

-- Create index for better query performance on flag_delete
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Simulasi_flag_delete' AND object_id = OBJECT_ID('t_COGS_HPP_Product_Header_Simulasi'))
BEGIN
    CREATE INDEX IX_Simulasi_flag_delete 
    ON t_COGS_HPP_Product_Header_Simulasi (flag_delete);
    
    PRINT 'Created index: IX_Simulasi_flag_delete';
END;

-- Create index for user_id for filtering simulations by user
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Simulasi_user_id' AND object_id = OBJECT_ID('t_COGS_HPP_Product_Header_Simulasi'))
BEGIN
    CREATE INDEX IX_Simulasi_user_id 
    ON t_COGS_HPP_Product_Header_Simulasi (user_id);
    
    PRINT 'Created index: IX_Simulasi_user_id';
END;

PRINT 'Migration completed: Soft delete and user tracking columns added to t_COGS_HPP_Product_Header_Simulasi';
