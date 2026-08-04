-- Definitions of the three t_COGS_HPP_Product_Header_Simulasi audit triggers
-- as they existed on LIVE (192.168.1.21 / Lapifactory) immediately before
-- migration 025 replaced them, captured 2026-08-04 via OBJECT_DEFINITION().
--
-- These use positional `select *`, which is what broke when migration 024
-- added Kemasan / Komposisi / Forecast to the base table: `inserted` grew to
-- 42 columns, so `select *, 'INSERT', getdate()` supplied 44 values to a
-- 41-column _Hist table -> SQL Server error 213 on every INSERT/UPDATE/DELETE.
--
-- Kept verbatim for rollback. To restore, drop the 025 versions and re-run
-- these as CREATE TRIGGER.
-- =====================================================================

create TRIGGER [dbo].[trigger_t_COGS_HPP_Product_Header_Simulasi_INSERT] ON dbo.t_COGS_HPP_Product_Header_Simulasi AFTER INSERT AS BEGIN SET NOCOUNT ON; Insert into t_COGS_HPP_Product_Header_Simulasi_hist select *, 'INSERT', getdate() from inserted END
GO

-- =============================================
-- Author:		<Author,,IMELDA>
-- Create date: <Create Date,,2015-04-10>
-- Description:	<Description,,TRIGGER t_COGS_HPP_Product_Header_Simulasi_HIST>
-- =============================================
CREATE TRIGGER [dbo].[trigger_t_COGS_HPP_Product_Header_Simulasi_UPDATE]
   ON  dbo.t_COGS_HPP_Product_Header_Simulasi
   AFTER UPDATE
AS
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;

    Insert into t_COGS_HPP_Product_Header_Simulasi_Hist
		select *, 'UPDATE', getdate() from inserted
END
GO

-- =============================================
-- Author:		<Author,,IMELDA>
-- Create date: <Create Date,,2015-04-10>
-- Description:	<Description,,TRIGGER t_COGS_HPP_Product_Header_Simulasi_HIST>
-- =============================================
CREATE TRIGGER [dbo].[trigger_t_COGS_HPP_Product_Header_Simulasi_DELETE]
   ON  dbo.t_COGS_HPP_Product_Header_Simulasi
   AFTER DELETE
AS
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;

    Insert into t_COGS_HPP_Product_Header_Simulasi_Hist
		select *, 'DELETE', getdate() from deleted
END
GO
