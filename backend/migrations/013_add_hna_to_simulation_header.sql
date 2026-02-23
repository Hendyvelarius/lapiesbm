-- Migration: Add HNA column to simulation header table
-- This allows custom formula simulations to store user-input HNA values
-- For product-existing simulations, HNA is pulled from m_Product.Product_SalesHNA

IF NOT EXISTS (
    SELECT 1 FROM sys.columns 
    WHERE object_id = OBJECT_ID('t_COGS_HPP_Product_Header_Simulasi') 
    AND name = 'HNA'
)
BEGIN
    ALTER TABLE t_COGS_HPP_Product_Header_Simulasi
    ADD HNA DECIMAL(18, 4) NULL;
    
    PRINT 'Added HNA column to t_COGS_HPP_Product_Header_Simulasi';
END
ELSE
BEGIN
    PRINT 'HNA column already exists on t_COGS_HPP_Product_Header_Simulasi';
END
GO
