-- ============================================================
-- Script 99: VERIFY row counts for all 12 tables (DEV vs LIVE)
-- Run this after completing all copy scripts
-- ============================================================

SELECT 'Table' AS [Table], 'DEV' AS [DEV_Count], 'LIVE' AS [LIVE_Count], 'Match?' AS [Status]

UNION ALL

SELECT 't_Bon_Keluar_Bahan_Awal_Detail',
    CAST((SELECT COUNT(*) FROM [dbo].[t_Bon_Keluar_Bahan_Awal_Detail]) AS VARCHAR),
    CAST((SELECT COUNT(*) FROM [LIVE_SERVER].[lapifactory].[dbo].[t_Bon_Keluar_Bahan_Awal_Detail]) AS VARCHAR),
    CASE WHEN (SELECT COUNT(*) FROM [dbo].[t_Bon_Keluar_Bahan_Awal_Detail]) = (SELECT COUNT(*) FROM [LIVE_SERVER].[lapifactory].[dbo].[t_Bon_Keluar_Bahan_Awal_Detail]) THEN 'OK' ELSE 'MISMATCH' END

UNION ALL

SELECT 't_Bon_Keluar_Bahan_Awal_DNc',
    CAST((SELECT COUNT(*) FROM [dbo].[t_Bon_Keluar_Bahan_Awal_DNc]) AS VARCHAR),
    CAST((SELECT COUNT(*) FROM [LIVE_SERVER].[lapifactory].[dbo].[t_Bon_Keluar_Bahan_Awal_DNc]) AS VARCHAR),
    CASE WHEN (SELECT COUNT(*) FROM [dbo].[t_Bon_Keluar_Bahan_Awal_DNc]) = (SELECT COUNT(*) FROM [LIVE_SERVER].[lapifactory].[dbo].[t_Bon_Keluar_Bahan_Awal_DNc]) THEN 'OK' ELSE 'MISMATCH' END

UNION ALL

SELECT 't_Bon_Keluar_Bahan_Awal_Header',
    CAST((SELECT COUNT(*) FROM [dbo].[t_Bon_Keluar_Bahan_Awal_Header]) AS VARCHAR),
    CAST((SELECT COUNT(*) FROM [LIVE_SERVER].[lapifactory].[dbo].[t_Bon_Keluar_Bahan_Awal_Header]) AS VARCHAR),
    CASE WHEN (SELECT COUNT(*) FROM [dbo].[t_Bon_Keluar_Bahan_Awal_Header]) = (SELECT COUNT(*) FROM [LIVE_SERVER].[lapifactory].[dbo].[t_Bon_Keluar_Bahan_Awal_Header]) THEN 'OK' ELSE 'MISMATCH' END

UNION ALL

SELECT 't_Bon_Pengembalian_Bahan_Awal_Detail',
    CAST((SELECT COUNT(*) FROM [dbo].[t_Bon_Pengembalian_Bahan_Awal_Detail]) AS VARCHAR),
    CAST((SELECT COUNT(*) FROM [LIVE_SERVER].[lapifactory].[dbo].[t_Bon_Pengembalian_Bahan_Awal_Detail]) AS VARCHAR),
    CASE WHEN (SELECT COUNT(*) FROM [dbo].[t_Bon_Pengembalian_Bahan_Awal_Detail]) = (SELECT COUNT(*) FROM [LIVE_SERVER].[lapifactory].[dbo].[t_Bon_Pengembalian_Bahan_Awal_Detail]) THEN 'OK' ELSE 'MISMATCH' END

UNION ALL

SELECT 't_Bon_Pengembalian_Bahan_Awal_header',
    CAST((SELECT COUNT(*) FROM [dbo].[t_Bon_Pengembalian_Bahan_Awal_header]) AS VARCHAR),
    CAST((SELECT COUNT(*) FROM [LIVE_SERVER].[lapifactory].[dbo].[t_Bon_Pengembalian_Bahan_Awal_header]) AS VARCHAR),
    CASE WHEN (SELECT COUNT(*) FROM [dbo].[t_Bon_Pengembalian_Bahan_Awal_header]) = (SELECT COUNT(*) FROM [LIVE_SERVER].[lapifactory].[dbo].[t_Bon_Pengembalian_Bahan_Awal_header]) THEN 'OK' ELSE 'MISMATCH' END

UNION ALL

SELECT 't_DNc_Manufacturing',
    CAST((SELECT COUNT(*) FROM [dbo].[t_DNc_Manufacturing]) AS VARCHAR),
    CAST((SELECT COUNT(*) FROM [LIVE_SERVER].[lapifactory].[dbo].[t_DNc_Manufacturing]) AS VARCHAR),
    CASE WHEN (SELECT COUNT(*) FROM [dbo].[t_DNc_Manufacturing]) = (SELECT COUNT(*) FROM [LIVE_SERVER].[lapifactory].[dbo].[t_DNc_Manufacturing]) THEN 'OK' ELSE 'MISMATCH' END

UNION ALL

SELECT 't_dnc_product',
    CAST((SELECT COUNT(*) FROM [dbo].[t_dnc_product]) AS VARCHAR),
    CAST((SELECT COUNT(*) FROM [LIVE_SERVER].[lapifactory].[dbo].[t_dnc_product]) AS VARCHAR),
    CASE WHEN (SELECT COUNT(*) FROM [dbo].[t_dnc_product]) = (SELECT COUNT(*) FROM [LIVE_SERVER].[lapifactory].[dbo].[t_dnc_product]) THEN 'OK' ELSE 'MISMATCH' END

UNION ALL

SELECT 't_PO_Manufacturing_Detail',
    CAST((SELECT COUNT(*) FROM [dbo].[t_PO_Manufacturing_Detail]) AS VARCHAR),
    CAST((SELECT COUNT(*) FROM [LIVE_SERVER].[lapifactory].[dbo].[t_PO_Manufacturing_Detail]) AS VARCHAR),
    CASE WHEN (SELECT COUNT(*) FROM [dbo].[t_PO_Manufacturing_Detail]) = (SELECT COUNT(*) FROM [LIVE_SERVER].[lapifactory].[dbo].[t_PO_Manufacturing_Detail]) THEN 'OK' ELSE 'MISMATCH' END

UNION ALL

SELECT 't_PO_Manufacturing_Header',
    CAST((SELECT COUNT(*) FROM [dbo].[t_PO_Manufacturing_Header]) AS VARCHAR),
    CAST((SELECT COUNT(*) FROM [LIVE_SERVER].[lapifactory].[dbo].[t_PO_Manufacturing_Header]) AS VARCHAR),
    CASE WHEN (SELECT COUNT(*) FROM [dbo].[t_PO_Manufacturing_Header]) = (SELECT COUNT(*) FROM [LIVE_SERVER].[lapifactory].[dbo].[t_PO_Manufacturing_Header]) THEN 'OK' ELSE 'MISMATCH' END

UNION ALL

SELECT 't_rencanaproduksitahunan',
    CAST((SELECT COUNT(*) FROM [dbo].[t_rencanaproduksitahunan]) AS VARCHAR),
    CAST((SELECT COUNT(*) FROM [LIVE_SERVER].[lapifactory].[dbo].[t_rencanaproduksitahunan]) AS VARCHAR),
    CASE WHEN (SELECT COUNT(*) FROM [dbo].[t_rencanaproduksitahunan]) = (SELECT COUNT(*) FROM [LIVE_SERVER].[lapifactory].[dbo].[t_rencanaproduksitahunan]) THEN 'OK' ELSE 'MISMATCH' END

UNION ALL

SELECT 't_ttba_manufacturing_detail',
    CAST((SELECT COUNT(*) FROM [dbo].[t_ttba_manufacturing_detail]) AS VARCHAR),
    CAST((SELECT COUNT(*) FROM [LIVE_SERVER].[lapifactory].[dbo].[t_ttba_manufacturing_detail]) AS VARCHAR),
    CASE WHEN (SELECT COUNT(*) FROM [dbo].[t_ttba_manufacturing_detail]) = (SELECT COUNT(*) FROM [LIVE_SERVER].[lapifactory].[dbo].[t_ttba_manufacturing_detail]) THEN 'OK' ELSE 'MISMATCH' END

UNION ALL

SELECT 'tmp_spLapProduksi_GWN_ReleaseQA',
    CAST((SELECT COUNT(*) FROM [dbo].[tmp_spLapProduksi_GWN_ReleaseQA]) AS VARCHAR),
    CAST((SELECT COUNT(*) FROM [LIVE_SERVER].[lapifactory].[dbo].[tmp_spLapProduksi_GWN_ReleaseQA]) AS VARCHAR),
    CASE WHEN (SELECT COUNT(*) FROM [dbo].[tmp_spLapProduksi_GWN_ReleaseQA]) = (SELECT COUNT(*) FROM [LIVE_SERVER].[lapifactory].[dbo].[tmp_spLapProduksi_GWN_ReleaseQA]) THEN 'OK' ELSE 'MISMATCH' END;
