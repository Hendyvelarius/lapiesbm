import React, { useState, useEffect } from 'react';
import { X, Download, FileText, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { masterAPI } from '../services/api';
import '../styles/ProductHPPReport.css';

// Utility functions
const formatCurrency = (value) => {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
};

const formatNumber = (value, decimals = 2) => {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value);
};

// Format LOB based on product data and detected product type
const formatLOB = (product) => {
  if (!product) return 'Unknown';
  
  // Determine the actual product type first
  const detectProductType = () => {
    if (!product) return 'Generic2';
    
    // Check if it's Generic 2 first (has Factory_Over_Head_50 field)
    if (product.Factory_Over_Head_50 !== undefined) {
      return 'Generic2';
    }
    
    // Check if it's Ethical (has specific Ethical fields)
    if (product.totalBB !== undefined && product.totalBK !== undefined && 
        product.MH_Proses_Std !== undefined && product.MH_Kemas_Std !== undefined &&
        product.Biaya_Proses !== undefined && product.Biaya_Kemas !== undefined &&
        !product.MH_Analisa_Std && !product.Biaya_Generik) {
      return 'Ethical';
    }
    
    // Check if it's Generic 1 (has Biaya_Generik and related fields)
    if (product.Biaya_Generik !== undefined && product.MH_Analisa_Std !== undefined &&
        product.MH_Timbang_BB !== undefined && product.MH_Timbang_BK !== undefined) {
      return 'Generic1';
    }
    
    return 'Generic2';
  };
  
  const productType = detectProductType();
  const lob = product.LOB ? product.LOB.toString().toUpperCase() : '';
  
  // Return the appropriate LOB based on detected product type
  if (productType === 'Ethical') {
    return 'Ethical / OTC';
  } else if (productType === 'Generic1') {
    return 'Generic Type 1';
  } else if (productType === 'Generic2') {
    return 'Generic Type 2';
  }
  
  // Fallback to original LOB field parsing if detection fails
  if (lob === 'ETHICAL' || lob === 'ETH' || lob === 'OTC') {
    return 'Ethical / OTC';
  }
  
  if (lob === 'GENERIK' || lob === 'GENERIC') {
    return 'Generic Type 1'; // Default generic to Type 1
  }
  
  // Fallback to original value
  return lob || 'Unknown';
};

// Format date as dd/mm/yyyy with zero-padding
const formatPrintDate = () => {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  return `${day}/${month}/${year}`;
};

const ProductHPPReport = ({ product, isOpen, onClose }) => {
  const [materialUsage, setMaterialUsage] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (isOpen && product) {
      fetchMaterialUsage();
    }
  }, [isOpen, product]);

  const fetchMaterialUsage = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await masterAPI.getMaterialUsage();
      
      // Filter materials for this specific product
      const productMaterials = response.filter(item => item.product_id === product.Product_ID);
      setMaterialUsage(productMaterials);
    } catch (error) {
      console.error('Error fetching material usage:', error);
      setError('Failed to load material usage data');
    } finally {
      setLoading(false);
    }
  };

  // Separate materials into Bahan Baku and Bahan Kemas
  const bahanBaku = materialUsage.filter(item => item.item_type === 'BB');
  const bahanKemas = materialUsage.filter(item => item.item_type === 'BK');

  // Determine product type based on available fields
  const productType = (() => {
    if (!product) return 'Generic2'; // Default fallback
    
    // Check if it's Generic 2 first (has Factory_Over_Head_50 field)
    if (product.Factory_Over_Head_50 !== undefined) {
      return 'Generic2';
    }
    
    // Check if it's Ethical (has specific Ethical fields)
    if (product.totalBB !== undefined && product.totalBK !== undefined && 
        product.MH_Proses_Std !== undefined && product.MH_Kemas_Std !== undefined &&
        product.Biaya_Proses !== undefined && product.Biaya_Kemas !== undefined &&
        !product.MH_Analisa_Std && !product.Biaya_Generik) {
      return 'Ethical';
    }
    
    // Check if it's Generic 1 (has Biaya_Generik and related fields)
    if (product.Biaya_Generik !== undefined && product.MH_Analisa_Std !== undefined &&
        product.MH_Timbang_BB !== undefined && product.MH_Timbang_BK !== undefined) {
      return 'Generic1';
    }
    
    // Default to Generic 2
    return 'Generic2';
  })();

  // Calculate totals and per pack costs only if product exists
  let totalBB = 0;
  let totalBK = 0;
  let totalBBPerPack = 0;
  let totalBKPerPack = 0;
  let totalOverheadCost = 0;
  let totalOverheadPerPack = 0;
  let expiryPerPack = 0;
  let totalHPPPerPack = 0;
  let batchSize = 1;
  let batchSizeActual = 1;

  if (product) {
    // Calculate totals
    totalBB = bahanBaku.reduce((sum, item) => sum + (item.total || 0), 0);
    totalBK = bahanKemas.reduce((sum, item) => sum + (item.total || 0), 0);

    // Calculate batch sizes
    batchSize = product.Batch_Size || 1;
    const rendemen = (product.Group_Rendemen || 100) / 100;
    batchSizeActual = batchSize * rendemen;

    // Calculate per pack costs using actual batch size
    totalBBPerPack = totalBB / batchSizeActual;
    totalBKPerPack = totalBK / batchSizeActual;
    expiryPerPack = (product.Beban_Sisa_Bahan_Exp || 0) / batchSizeActual;

    // Calculate overhead costs based on product type
    if (productType === 'Ethical') {
      totalOverheadCost = ((product.MH_Proses_Std || 0) * (product.Biaya_Proses || 0)) +
                          ((product.MH_Kemas_Std || 0) * (product.Biaya_Kemas || 0));
    } else if (productType === 'Generic1') {
      totalOverheadCost = ((product.MH_Timbang_BB || 0) * (product.Biaya_Generik || 0)) +
                          ((product.MH_Timbang_BK || 0) * (product.Biaya_Generik || 0)) +
                          ((product.MH_Proses_Std || 0) * (product.Biaya_Generik || 0)) +
                          ((product.MH_Kemas_Std || 0) * (product.Biaya_Generik || 0)) +
                          ((product.MH_Analisa_Std || 0) * (product.Biaya_Generik || 0)) +
                          ((product.MH_Mesin_Std || 0) * (product.Rate_PLN || 0)) +
                          (product.Biaya_Analisa || 0);
    } else { // Generic2
      totalOverheadCost = ((product.MH_Proses_Std || 0) * (product.Biaya_Proses || 0)) +
                          ((product.MH_Kemas_Std || 0) * (product.Biaya_Kemas || 0)) +
                          ((product.MH_Proses_Std || 0) * (product.Factory_Over_Head_50 || 0)) +
                          ((product.MH_Kemas_Std || 0) * (product.Factory_Over_Head_50 || 0));
                          // Note: Depreciation (Depresiasi) removed as it's no longer used for Generic Type 2
    }

    totalOverheadPerPack = totalOverheadCost / batchSizeActual;

    // Calculate total HPP per pack
    totalHPPPerPack = totalBBPerPack + totalBKPerPack + totalOverheadPerPack + expiryPerPack;
  }

  const handleExportToExcel = async () => {
    if (!product) {
      alert('No product selected for export');
      return;
    }

    try {
      setExporting(true);
      
      const workbook = XLSX.utils.book_new();
      
      // Create a worksheet with proper formatting
      const ws = XLSX.utils.aoa_to_sheet([]);
      
      // Header section
      XLSX.utils.sheet_add_aoa(ws, [
        ['Perhitungan Estimasi COGS', '', '', '', '', '', 'Site :', '', product?.Group_PNCategory_Dept || 'N/A'],
        ['', '', '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', '', ''],
        [`Kode Produk - Description`, ':', `${product.Product_ID} - ${product.Product_Name}`, '', 'LOB', ':', formatLOB(product)],
        [`Batch Size Teori`, ':', formatNumber(product.Batch_Size), 'KOTAK', 'Tanggal Print', ':', formatPrintDate()],
        [`Batch Size Actual`, ':', formatNumber(batchSizeActual), 'KOTAK', '', '', ''],
        [`Rendemen`, ':', `${formatNumber(product.Group_Rendemen)}%`, '', '', '', ''],
        ['', '', '', '', '', '', '', '', ''],
      ], { origin: 'A1' });

      // Bahan Baku section
      let currentRow = 9;
      XLSX.utils.sheet_add_aoa(ws, [
        ['', 'Kode Material', 'Nama Material', 'Qty', 'Satuan', 'Cost/unit', 'Extended Cost', 'Per pack'],
        ['Bahan Baku', '', '', '', '', '', '', '']
      ], { origin: `A${currentRow}` });
      
      currentRow += 2;
      bahanBaku.forEach((item, index) => {
        XLSX.utils.sheet_add_aoa(ws, [
          [index + 1, item.PPI_ItemID, item.Item_Name, formatNumber(item.PPI_QTY), item.PPI_UnitID, formatNumber(item.Item_unit), formatNumber(item.total), formatNumber(item.total / batchSizeActual)]
        ], { origin: `A${currentRow}` });
        currentRow++;
      });
      
      // Total BB
      XLSX.utils.sheet_add_aoa(ws, [
        ['', '', '', '', '', 'Total BB :', formatNumber(totalBB), formatNumber(totalBBPerPack)]
      ], { origin: `A${currentRow}` });
      currentRow += 2;

      // Bahan Kemas section
      XLSX.utils.sheet_add_aoa(ws, [
        ['', 'Kode Material', 'Nama Material', 'Qty', 'Satuan', 'Cost/unit', 'Extended Cost', 'Per pack'],
        ['Bahan Kemas', '', '', '', '', '', '', '']
      ], { origin: `A${currentRow}` });
      
      currentRow += 2;
      bahanKemas.forEach((item, index) => {
        XLSX.utils.sheet_add_aoa(ws, [
          [index + 1, item.PPI_ItemID, item.Item_Name, formatNumber(item.PPI_QTY), item.PPI_UnitID, formatNumber(item.Item_unit), formatNumber(item.total), formatNumber(item.total / batchSizeActual)]
        ], { origin: `A${currentRow}` });
        currentRow++;
      });
      
      // Total BK
      XLSX.utils.sheet_add_aoa(ws, [
        ['', '', '', '', '', 'Total BK :', formatNumber(totalBK), formatNumber(totalBKPerPack)]
      ], { origin: `A${currentRow}` });
      currentRow += 2;

      // Dynamic Labor/Overhead section based on product type
      if (productType === 'Ethical') {
        XLSX.utils.sheet_add_aoa(ws, [
          ['Resource Scheduling', 'Nama Material', 'Qty', 'Mhrs/machine hours', 'Cost/unit', 'Extended Cost', 'Per pack'],
          ['Overhead', '', '', '', '', '', ''],
          ['1', 'PENGOLAHAN', `OPERATOR PROSES LINE ${product?.Group_PNCategory_Dept || 'N/A'}`, formatNumber(product.MH_Proses_Std || 0), 'HRS', formatNumber(product.Biaya_Proses || 0), formatNumber((product.MH_Proses_Std || 0) * (product.Biaya_Proses || 0)), formatNumber(((product.MH_Proses_Std || 0) * (product.Biaya_Proses || 0)) / batchSizeActual)],
          ['2', 'PENGEMASAN', `OPERATOR PROSES LINE ${product?.Group_PNCategory_Dept || 'N/A'}`, formatNumber(product.MH_Kemas_Std || 0), 'HRS', formatNumber(product.Biaya_Kemas || 0), formatNumber((product.MH_Kemas_Std || 0) * (product.Biaya_Kemas || 0)), formatNumber(((product.MH_Kemas_Std || 0) * (product.Biaya_Kemas || 0)) / batchSizeActual)],
          ['', '', 'Total Hours', formatNumber((product.MH_Proses_Std || 0) + (product.MH_Kemas_Std || 0)), 'Total Cost', formatNumber(totalOverheadCost), formatNumber(totalOverheadPerPack)]
        ], { origin: `A${currentRow}` });
        currentRow += 6;
      } else if (productType === 'Generic1') {
        XLSX.utils.sheet_add_aoa(ws, [
          ['Resource Scheduling', 'Nama Material', 'Qty', 'Mhrs/machine hours', 'Cost/unit', 'Extended Cost', 'Per pack'],
          ['Overhead', '', '', '', '', '', ''],
          ['1', 'TIMBANG BB', `OPERATOR PROSES LINE ${product?.Group_PNCategory_Dept || 'N/A'}`, formatNumber(product.MH_Timbang_BB || 0), 'HRS', formatNumber(product.Biaya_Generik || 0), formatNumber((product.MH_Timbang_BB || 0) * (product.Biaya_Generik || 0)), formatNumber(((product.MH_Timbang_BB || 0) * (product.Biaya_Generik || 0)) / batchSizeActual)],
          ['2', 'TIMBANG BK', `OPERATOR PROSES LINE ${product?.Group_PNCategory_Dept || 'N/A'}`, formatNumber(product.MH_Timbang_BK || 0), 'HRS', formatNumber(product.Biaya_Generik || 0), formatNumber((product.MH_Timbang_BK || 0) * (product.Biaya_Generik || 0)), formatNumber(((product.MH_Timbang_BK || 0) * (product.Biaya_Generik || 0)) / batchSizeActual)],
          ['3', 'PENGOLAHAN', `OPERATOR PROSES LINE ${product?.Group_PNCategory_Dept || 'N/A'}`, formatNumber(product.MH_Proses_Std || 0), 'HRS', formatNumber(product.Biaya_Generik || 0), formatNumber((product.MH_Proses_Std || 0) * (product.Biaya_Generik || 0)), formatNumber(((product.MH_Proses_Std || 0) * (product.Biaya_Generik || 0)) / batchSizeActual)],
          ['4', 'PENGEMASAN', `OPERATOR PROSES LINE ${product?.Group_PNCategory_Dept || 'N/A'}`, formatNumber(product.MH_Kemas_Std || 0), 'HRS', formatNumber(product.Biaya_Generik || 0), formatNumber((product.MH_Kemas_Std || 0) * (product.Biaya_Generik || 0)), formatNumber(((product.MH_Kemas_Std || 0) * (product.Biaya_Generik || 0)) / batchSizeActual)],
          ['5', 'ANALISA', `OPERATOR PROSES LINE ${product?.Group_PNCategory_Dept || 'N/A'}`, formatNumber(product.MH_Analisa_Std || 0), 'HRS', formatNumber(product.Biaya_Generik || 0), formatNumber((product.MH_Analisa_Std || 0) * (product.Biaya_Generik || 0)), formatNumber(((product.MH_Analisa_Std || 0) * (product.Biaya_Generik || 0)) / batchSizeActual)],
          ['6', 'MESIN', 'MESIN OPERATION', formatNumber(product.MH_Mesin_Std || 0), 'HRS', formatNumber(product.Rate_PLN || 0), formatNumber((product.MH_Mesin_Std || 0) * (product.Rate_PLN || 0)), formatNumber(((product.MH_Mesin_Std || 0) * (product.Rate_PLN || 0)) / batchSizeActual)],
          ['7', 'REAGEN', 'ANALISA REAGENT', '1', 'LOT', formatNumber(product.Biaya_Analisa || 0), formatNumber(product.Biaya_Analisa || 0), formatNumber((product.Biaya_Analisa || 0) / batchSizeActual)],
          ['', '', '', '', 'Total Cost', formatNumber(totalOverheadCost), formatNumber(totalOverheadPerPack)]
        ], { origin: `A${currentRow}` });
        currentRow += 10;
      } else { // Generic2
        // Direct Labor
        XLSX.utils.sheet_add_aoa(ws, [
          ['Resource Scheduling', 'Nama Material', 'Qty', 'Mhrs/machine hours', 'Cost/unit', 'Extended Cost', 'Per pack'],
          ['Direct Labor', '', '', '', '', '', ''],
          ['Line Production', '', '', '', '', '', ''],
          ['1', 'PENGOLAHAN', `OPERATOR PROSES LINE ${product?.Group_PNCategory_Dept || 'N/A'}`, formatNumber(product.MH_Proses_Std || 0), 'HRS', formatNumber(product.Biaya_Proses || 0), formatNumber((product.MH_Proses_Std || 0) * (product.Biaya_Proses || 0)), formatNumber(((product.MH_Proses_Std || 0) * (product.Biaya_Proses || 0)) / batchSizeActual)],
          ['2', 'PENGEMASAN', `OPERATOR PROSES LINE ${product?.Group_PNCategory_Dept || 'N/A'}`, formatNumber(product.MH_Kemas_Std || 0), 'HRS', formatNumber(product.Biaya_Kemas || 0), formatNumber((product.MH_Kemas_Std || 0) * (product.Biaya_Kemas || 0)), formatNumber(((product.MH_Kemas_Std || 0) * (product.Biaya_Kemas || 0)) / batchSizeActual)],
          ['', '', 'Total Hours', formatNumber((product.MH_Proses_Std || 0) + (product.MH_Kemas_Std || 0)), 'Total Cost', formatNumber(((product.MH_Proses_Std || 0) * (product.Biaya_Proses || 0)) + ((product.MH_Kemas_Std || 0) * (product.Biaya_Kemas || 0))), formatNumber((((product.MH_Proses_Std || 0) * (product.Biaya_Proses || 0)) + ((product.MH_Kemas_Std || 0) * (product.Biaya_Kemas || 0))) / batchSizeActual)],
          ['', '', '', '', '', '', '']
        ], { origin: `A${currentRow}` });
        currentRow += 7;

        // Factory Over Head
        XLSX.utils.sheet_add_aoa(ws, [
          ['Resource Scheduling', 'Nama Material', 'Qty', 'Mhrs/machine hours', 'Cost/unit', 'Extended Cost', 'Per pack'],
          ['Factory Over Head', '', '', '', '', '', ''],
          ['Line Production', '', '', '', '', '', ''],
          ['1', 'PENGOLAHAN', `OPERATOR PROSES LINE ${product?.Group_PNCategory_Dept || 'N/A'}`, formatNumber(product.MH_Proses_Std || 0), 'HRS', formatNumber(product.Factory_Over_Head_50 || 0), formatNumber((product.MH_Proses_Std || 0) * (product.Factory_Over_Head_50 || 0)), formatNumber(((product.MH_Proses_Std || 0) * (product.Factory_Over_Head_50 || 0)) / batchSizeActual)],
          ['2', 'PENGEMASAN', `OPERATOR PROSES LINE ${product?.Group_PNCategory_Dept || 'N/A'}`, formatNumber(product.MH_Kemas_Std || 0), 'HRS', formatNumber(product.Factory_Over_Head_50 || 0), formatNumber((product.MH_Kemas_Std || 0) * (product.Factory_Over_Head_50 || 0)), formatNumber(((product.MH_Kemas_Std || 0) * (product.Factory_Over_Head_50 || 0)) / batchSizeActual)],
          ['', '', 'Total Hours', formatNumber((product.MH_Proses_Std || 0) + (product.MH_Kemas_Std || 0)), 'Total Cost', formatNumber(((product.MH_Proses_Std || 0) * (product.Factory_Over_Head_50 || 0)) + ((product.MH_Kemas_Std || 0) * (product.Factory_Over_Head_50 || 0))), formatNumber((((product.MH_Proses_Std || 0) * (product.Factory_Over_Head_50 || 0)) + ((product.MH_Kemas_Std || 0) * (product.Factory_Over_Head_50 || 0))) / batchSizeActual)],
          ['', '', '', '', '', '', '']
        ], { origin: `A${currentRow}` });
        currentRow += 7;

        // Note: Depreciation section removed for Generic Type 2 as it's no longer used
      }

      // Final total
      XLSX.utils.sheet_add_aoa(ws, [
        ['', '', '', '', '', '', ''],
        ['Total COGS Estimasi', '', '', '', 'Total HPP', formatNumber(totalBB + totalBK + totalOverheadCost + (product.Beban_Sisa_Bahan_Exp || 0)), formatNumber(totalHPPPerPack)]
      ], { origin: `A${currentRow}` });

      // Apply some basic formatting
      ws['!cols'] = [
        { width: 8 }, { width: 15 }, { width: 25 }, { width: 10 }, { width: 10 }, 
        { width: 15 }, { width: 18 }, { width: 15 }
      ];

      XLSX.utils.book_append_sheet(workbook, ws, `Product HPP Report ${productType}`);
      
      const filename = `Product_HPP_Report_${productType}_${product.Product_ID}_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(workbook, filename);
      
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      alert('Failed to export report to Excel. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const handleExportToPDF = () => {
    if (!product) {
      alert('No product selected for export');
      return;
    }

    try {
      setExporting(true);
      
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      let yPosition = 20;
      
      // Helper function to check if we need a new page
      const checkPageBreak = (neededSpace = 20) => {
        if (yPosition + neededSpace > pageHeight - 20) {
          doc.addPage();
          yPosition = 20;
          return true;
        }
        return false;
      };

      // Document Header
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('Perhitungan Estimasi COGS', 20, yPosition);
      doc.text('Site: ' + (product?.Group_PNCategory_Dept || 'N/A'), pageWidth - 50, yPosition);
      yPosition += 15;

      // Product Information Section
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Kode Produk - Description: ${product.Product_ID} - ${product.Product_Name}`, 20, yPosition);
      doc.text(`LOB: ${formatLOB(product)}`, pageWidth - 80, yPosition);
      yPosition += 7;
      
      doc.text(`Batch Size Teori: ${formatNumber(product.Batch_Size)} KOTAK`, 20, yPosition);
      doc.text(`Tanggal Print: ${formatPrintDate()}`, pageWidth - 80, yPosition);
      yPosition += 7;
      
      doc.text(`Batch Size Actual: ${formatNumber(batchSizeActual)} KOTAK`, 20, yPosition);
      yPosition += 7;
      
      doc.text(`Rendemen: ${formatNumber(product.Group_Rendemen)}%`, 20, yPosition);
      yPosition += 15;

      // Bahan Baku Section
      checkPageBreak(30);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Bahan Baku', 20, yPosition);
      yPosition += 10;

      if (bahanBaku.length > 0) {
        const bahanBakuData = bahanBaku.map((item, index) => [
          (index + 1).toString(),
          item.PPI_ItemID || '',
          item.Item_Name || '',
          formatNumber(item.PPI_QTY),
          item.PPI_UnitID || '',
          formatNumber(item.Item_unit),
          formatNumber(item.total),
          formatNumber(item.total / batchSizeActual)
        ]);

        // Add total row
        bahanBakuData.push([
          '', '', '', '', '', 'Total BB:', 
          formatNumber(totalBB), 
          formatNumber(totalBBPerPack)
        ]);

        autoTable(doc, {
          startY: yPosition,
          head: [['', 'Kode Material', 'Nama Material', 'Qty', 'Satuan', 'Cost/unit', 'Extended Cost', 'Per pack']],
          body: bahanBakuData,
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
          columnStyles: {
            0: { halign: 'center', cellWidth: 10 },
            1: { cellWidth: 25 },
            2: { cellWidth: 45 },
            3: { halign: 'right', cellWidth: 15 },
            4: { halign: 'center', cellWidth: 15 },
            5: { halign: 'right', cellWidth: 20 },
            6: { halign: 'right', cellWidth: 25 },
            7: { halign: 'right', cellWidth: 20 }
          },
          didParseCell: function(data) {
            if (data.row.index === bahanBakuData.length - 1) {
              data.cell.styles.fontStyle = 'bold';
              data.cell.styles.fillColor = [248, 248, 248];
            }
          }
        });
        yPosition = doc.lastAutoTable.finalY + 15;
      }

      // Bahan Kemas Section
      checkPageBreak(30);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Bahan Kemas', 20, yPosition);
      yPosition += 10;

      if (bahanKemas.length > 0) {
        const bahanKemasData = bahanKemas.map((item, index) => [
          (index + 1).toString(),
          item.PPI_ItemID || '',
          item.Item_Name || '',
          formatNumber(item.PPI_QTY),
          item.PPI_UnitID || '',
          formatNumber(item.Item_unit),
          formatNumber(item.total),
          formatNumber(item.total / batchSizeActual)
        ]);

        // Add total row
        bahanKemasData.push([
          '', '', '', '', '', 'Total BK:', 
          formatNumber(totalBK), 
          formatNumber(totalBKPerPack)
        ]);

        autoTable(doc, {
          startY: yPosition,
          head: [['', 'Kode Material', 'Nama Material', 'Qty', 'Satuan', 'Cost/unit', 'Extended Cost', 'Per pack']],
          body: bahanKemasData,
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
          columnStyles: {
            0: { halign: 'center', cellWidth: 10 },
            1: { cellWidth: 25 },
            2: { cellWidth: 45 },
            3: { halign: 'right', cellWidth: 15 },
            4: { halign: 'center', cellWidth: 15 },
            5: { halign: 'right', cellWidth: 20 },
            6: { halign: 'right', cellWidth: 25 },
            7: { halign: 'right', cellWidth: 20 }
          },
          didParseCell: function(data) {
            if (data.row.index === bahanKemasData.length - 1) {
              data.cell.styles.fontStyle = 'bold';
              data.cell.styles.fillColor = [248, 248, 248];
            }
          }
        });
        yPosition = doc.lastAutoTable.finalY + 15;
      }

      // Dynamic Labor/Overhead Section based on product type
      if (productType === 'Ethical') {
        checkPageBreak(30);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Overhead', 20, yPosition);
        yPosition += 10;

        const overheadData = [
          ['1 PENGOLAHAN', `OPERATOR PROSES LINE ${product?.Group_PNCategory_Dept || 'N/A'}`, formatNumber(product.MH_Proses_Std || 0), 'HRS', formatNumber(product.Biaya_Proses || 0), formatNumber((product.MH_Proses_Std || 0) * (product.Biaya_Proses || 0)), formatNumber(((product.MH_Proses_Std || 0) * (product.Biaya_Proses || 0)) / batchSizeActual)],
          ['2 PENGEMASAN', `OPERATOR PROSES LINE ${product?.Group_PNCategory_Dept || 'N/A'}`, formatNumber(product.MH_Kemas_Std || 0), 'HRS', formatNumber(product.Biaya_Kemas || 0), formatNumber((product.MH_Kemas_Std || 0) * (product.Biaya_Kemas || 0)), formatNumber(((product.MH_Kemas_Std || 0) * (product.Biaya_Kemas || 0)) / batchSizeActual)],
          ['Total Hours: ' + formatNumber((product.MH_Proses_Std || 0) + (product.MH_Kemas_Std || 0)), 'Total Cost', '', '', '', formatNumber(((product.MH_Proses_Std || 0) * (product.Biaya_Proses || 0)) + ((product.MH_Kemas_Std || 0) * (product.Biaya_Kemas || 0))), formatNumber((((product.MH_Proses_Std || 0) * (product.Biaya_Proses || 0)) + ((product.MH_Kemas_Std || 0) * (product.Biaya_Kemas || 0))) / batchSizeActual)]
        ];

        autoTable(doc, {
          startY: yPosition,
          head: [['Resource Scheduling', 'Nama Material', 'Qty', 'Mhrs/machine hours', 'Cost/unit', 'Extended Cost', 'Per pack']],
          body: overheadData,
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
          columnStyles: {
            0: { cellWidth: 35 },
            1: { cellWidth: 40 },
            2: { halign: 'right', cellWidth: 15 },
            3: { halign: 'center', cellWidth: 15 },
            4: { halign: 'right', cellWidth: 20 },
            5: { halign: 'right', cellWidth: 25 },
            6: { halign: 'right', cellWidth: 20 }
          },
          didParseCell: function(data) {
            if (data.row.index === overheadData.length - 1) {
              data.cell.styles.fontStyle = 'bold';
              data.cell.styles.fillColor = [248, 248, 248];
            }
          }
        });
        yPosition = doc.lastAutoTable.finalY + 15;

      } else if (productType === 'Generic1') {
        checkPageBreak(40);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Overhead', 20, yPosition);
        yPosition += 10;

        const overheadData = [
          ['1 TIMBANG BB', `OPERATOR PROSES LINE ${product?.Group_PNCategory_Dept || 'N/A'}`, formatNumber(product.MH_Timbang_BB || 0), 'HRS', formatNumber(product.Biaya_Generik || 0), formatNumber((product.MH_Timbang_BB || 0) * (product.Biaya_Generik || 0)), formatNumber(((product.MH_Timbang_BB || 0) * (product.Biaya_Generik || 0)) / batchSizeActual)],
          ['2 TIMBANG BK', `OPERATOR PROSES LINE ${product?.Group_PNCategory_Dept || 'N/A'}`, formatNumber(product.MH_Timbang_BK || 0), 'HRS', formatNumber(product.Biaya_Generik || 0), formatNumber((product.MH_Timbang_BK || 0) * (product.Biaya_Generik || 0)), formatNumber(((product.MH_Timbang_BK || 0) * (product.Biaya_Generik || 0)) / batchSizeActual)],
          ['3 PENGOLAHAN', `OPERATOR PROSES LINE ${product?.Group_PNCategory_Dept || 'N/A'}`, formatNumber(product.MH_Proses_Std || 0), 'HRS', formatNumber(product.Biaya_Generik || 0), formatNumber((product.MH_Proses_Std || 0) * (product.Biaya_Generik || 0)), formatNumber(((product.MH_Proses_Std || 0) * (product.Biaya_Generik || 0)) / batchSizeActual)],
          ['4 PENGEMASAN', `OPERATOR PROSES LINE ${product?.Group_PNCategory_Dept || 'N/A'}`, formatNumber(product.MH_Kemas_Std || 0), 'HRS', formatNumber(product.Biaya_Generik || 0), formatNumber((product.MH_Kemas_Std || 0) * (product.Biaya_Generik || 0)), formatNumber(((product.MH_Kemas_Std || 0) * (product.Biaya_Generik || 0)) / batchSizeActual)],
          ['5 ANALISA', `OPERATOR PROSES LINE ${product?.Group_PNCategory_Dept || 'N/A'}`, formatNumber(product.MH_Analisa_Std || 0), 'HRS', formatNumber(product.Biaya_Generik || 0), formatNumber((product.MH_Analisa_Std || 0) * (product.Biaya_Generik || 0)), formatNumber(((product.MH_Analisa_Std || 0) * (product.Biaya_Generik || 0)) / batchSizeActual)],
          ['6 MESIN', 'MESIN OPERATION', formatNumber(product.MH_Mesin_Std || 0), 'HRS', formatNumber(product.Rate_PLN || 0), formatNumber((product.MH_Mesin_Std || 0) * (product.Rate_PLN || 0)), formatNumber(((product.MH_Mesin_Std || 0) * (product.Rate_PLN || 0)) / batchSizeActual)],
          ['7 REAGEN', 'ANALISA REAGENT', '1', 'LOT', formatNumber(product.Biaya_Analisa || 0), formatNumber(product.Biaya_Analisa || 0), formatNumber((product.Biaya_Analisa || 0) / batchSizeActual)],
          ['Total Cost', '', '', '', '', formatNumber(
            ((product.MH_Timbang_BB || 0) * (product.Biaya_Generik || 0)) +
            ((product.MH_Timbang_BK || 0) * (product.Biaya_Generik || 0)) +
            ((product.MH_Proses_Std || 0) * (product.Biaya_Generik || 0)) +
            ((product.MH_Kemas_Std || 0) * (product.Biaya_Generik || 0)) +
            ((product.MH_Analisa_Std || 0) * (product.Biaya_Generik || 0)) +
            ((product.MH_Mesin_Std || 0) * (product.Rate_PLN || 0)) +
            (product.Biaya_Analisa || 0)
          ), formatNumber((
            ((product.MH_Timbang_BB || 0) * (product.Biaya_Generik || 0)) +
            ((product.MH_Timbang_BK || 0) * (product.Biaya_Generik || 0)) +
            ((product.MH_Proses_Std || 0) * (product.Biaya_Generik || 0)) +
            ((product.MH_Kemas_Std || 0) * (product.Biaya_Generik || 0)) +
            ((product.MH_Analisa_Std || 0) * (product.Biaya_Generik || 0)) +
            ((product.MH_Mesin_Std || 0) * (product.Rate_PLN || 0)) +
            (product.Biaya_Analisa || 0)
          ) / batchSizeActual)]
        ];

        autoTable(doc, {
          startY: yPosition,
          head: [['Resource Scheduling', 'Nama Material', 'Qty', 'Mhrs/machine hours', 'Cost/unit', 'Extended Cost', 'Per pack']],
          body: overheadData,
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
          columnStyles: {
            0: { cellWidth: 35 },
            1: { cellWidth: 40 },
            2: { halign: 'right', cellWidth: 15 },
            3: { halign: 'center', cellWidth: 15 },
            4: { halign: 'right', cellWidth: 20 },
            5: { halign: 'right', cellWidth: 25 },
            6: { halign: 'right', cellWidth: 20 }
          },
          didParseCell: function(data) {
            if (data.row.index === overheadData.length - 1) {
              data.cell.styles.fontStyle = 'bold';
              data.cell.styles.fillColor = [248, 248, 248];
            }
          }
        });
        yPosition = doc.lastAutoTable.finalY + 15;

      } else { // Generic2
        // Direct Labor Section
        checkPageBreak(30);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Direct Labor', 20, yPosition);
        yPosition += 10;

        const directLaborData = [
          ['Line Production', '', '', '', '', '', ''],
          ['1 PENGOLAHAN', `OPERATOR PROSES LINE ${product?.Group_PNCategory_Dept || 'N/A'}`, formatNumber(product.MH_Proses_Std || 0), 'HRS', formatNumber(product.Biaya_Proses || 0), formatNumber((product.MH_Proses_Std || 0) * (product.Biaya_Proses || 0)), formatNumber(((product.MH_Proses_Std || 0) * (product.Biaya_Proses || 0)) / batchSizeActual)],
          ['2 PENGEMASAN', `OPERATOR PROSES LINE ${product?.Group_PNCategory_Dept || 'N/A'}`, formatNumber(product.MH_Kemas_Std || 0), 'HRS', formatNumber(product.Biaya_Kemas || 0), formatNumber((product.MH_Kemas_Std || 0) * (product.Biaya_Kemas || 0)), formatNumber(((product.MH_Kemas_Std || 0) * (product.Biaya_Kemas || 0)) / batchSizeActual)],
          ['Total Hours: ' + formatNumber((product.MH_Proses_Std || 0) + (product.MH_Kemas_Std || 0)), 'Total Cost', '', '', '', formatNumber(((product.MH_Proses_Std || 0) * (product.Biaya_Proses || 0)) + ((product.MH_Kemas_Std || 0) * (product.Biaya_Kemas || 0))), formatNumber((((product.MH_Proses_Std || 0) * (product.Biaya_Proses || 0)) + ((product.MH_Kemas_Std || 0) * (product.Biaya_Kemas || 0))) / batchSizeActual)]
        ];

        autoTable(doc, {
          startY: yPosition,
          head: [['Resource Scheduling', 'Nama Material', 'Qty', 'Mhrs/machine hours', 'Cost/unit', 'Extended Cost', 'Per pack']],
          body: directLaborData,
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
          columnStyles: {
            0: { cellWidth: 35 },
            1: { cellWidth: 40 },
            2: { halign: 'right', cellWidth: 15 },
            3: { halign: 'center', cellWidth: 15 },
            4: { halign: 'right', cellWidth: 20 },
            5: { halign: 'right', cellWidth: 25 },
            6: { halign: 'right', cellWidth: 20 }
          },
          didParseCell: function(data) {
            if (data.row.index === 0) {
              data.cell.styles.fontStyle = 'italic';
              data.cell.styles.fillColor = [245, 245, 245];
            } else if (data.row.index === directLaborData.length - 1) {
              data.cell.styles.fontStyle = 'bold';
              data.cell.styles.fillColor = [248, 248, 248];
            }
          }
        });
        yPosition = doc.lastAutoTable.finalY + 15;

        // Factory Over Head Section
        checkPageBreak(30);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Factory Over Head', 20, yPosition);
        yPosition += 10;

        const factoryOverHeadData = [
          ['Line Production', '', '', '', '', '', ''],
          ['1 PENGOLAHAN', `OPERATOR PROSES LINE ${product?.Group_PNCategory_Dept || 'N/A'}`, formatNumber(product.MH_Proses_Std || 0), 'HRS', formatNumber(product.Factory_Over_Head_50 || 0), formatNumber((product.MH_Proses_Std || 0) * (product.Factory_Over_Head_50 || 0)), formatNumber(((product.MH_Proses_Std || 0) * (product.Factory_Over_Head_50 || 0)) / batchSizeActual)],
          ['2 PENGEMASAN', `OPERATOR PROSES LINE ${product?.Group_PNCategory_Dept || 'N/A'}`, formatNumber(product.MH_Kemas_Std || 0), 'HRS', formatNumber(product.Factory_Over_Head_50 || 0), formatNumber((product.MH_Kemas_Std || 0) * (product.Factory_Over_Head_50 || 0)), formatNumber(((product.MH_Kemas_Std || 0) * (product.Factory_Over_Head_50 || 0)) / batchSizeActual)],
          ['Total Hours: ' + formatNumber((product.MH_Proses_Std || 0) + (product.MH_Kemas_Std || 0)), 'Total Cost', '', '', '', formatNumber(((product.MH_Proses_Std || 0) * (product.Factory_Over_Head_50 || 0)) + ((product.MH_Kemas_Std || 0) * (product.Factory_Over_Head_50 || 0))), formatNumber((((product.MH_Proses_Std || 0) * (product.Factory_Over_Head_50 || 0)) + ((product.MH_Kemas_Std || 0) * (product.Factory_Over_Head_50 || 0))) / batchSizeActual)]
        ];

        autoTable(doc, {
          startY: yPosition,
          head: [['Resource Scheduling', 'Nama Material', 'Qty', 'Mhrs/machine hours', 'Cost/unit', 'Extended Cost', 'Per pack']],
          body: factoryOverHeadData,
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
          columnStyles: {
            0: { cellWidth: 35 },
            1: { cellWidth: 40 },
            2: { halign: 'right', cellWidth: 15 },
            3: { halign: 'center', cellWidth: 15 },
            4: { halign: 'right', cellWidth: 20 },
            5: { halign: 'right', cellWidth: 25 },
            6: { halign: 'right', cellWidth: 20 }
          },
          didParseCell: function(data) {
            if (data.row.index === 0) {
              data.cell.styles.fontStyle = 'italic';
              data.cell.styles.fillColor = [245, 245, 245];
            } else if (data.row.index === factoryOverHeadData.length - 1) {
              data.cell.styles.fontStyle = 'bold';
              data.cell.styles.fillColor = [248, 248, 248];
            }
          }
        });
        yPosition = doc.lastAutoTable.finalY + 15;

        // Note: Depreciation section removed for Generic Type 2 as it's no longer used
      }

      // Final Total Section
      checkPageBreak(20);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      
      const finalTotal = totalBB + totalBK + totalOverheadCost + (product.Beban_Sisa_Bahan_Exp || 0);
      
      autoTable(doc, {
        startY: yPosition,
        head: [['Total COGS Estimasi', '', '', '', 'Total HPP', 'Extended Cost', 'Per Pack']],
        body: [['', '', '', '', '', formatNumber(finalTotal), formatNumber(totalHPPPerPack)]],
        styles: { fontSize: 10, cellPadding: 3 },
        headStyles: { fillColor: [255, 235, 156], textColor: [0, 0, 0], fontStyle: 'bold' },
        bodyStyles: { fontStyle: 'bold', fillColor: [255, 235, 156] },
        columnStyles: {
          0: { cellWidth: 35 },
          1: { cellWidth: 20 },
          2: { cellWidth: 20 },
          3: { cellWidth: 20 },
          4: { cellWidth: 25 },
          5: { halign: 'right', cellWidth: 25 },
          6: { halign: 'right', cellWidth: 20 }
        }
      });

      // Save the PDF
      const filename = `Product_HPP_Report_${productType}_${product.Product_ID}_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(filename);
      
    } catch (error) {
      console.error('Error exporting to PDF:', error);
      alert('Failed to export report to PDF. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="product-hpp-modal-overlay">
      <div className="product-hpp-modal">
        <div className="product-hpp-modal-header">
          <h2>Product HPP Report - {product?.Product_Name || 'Loading...'}</h2>
          <div className="product-hpp-modal-actions">
            <button
              onClick={handleExportToExcel}
              disabled={loading || exporting}
              className="product-hpp-export-btn excel"
            >
              {exporting ? <Loader2 className="spin" size={16} /> : <FileText size={16} />}
              Excel
            </button>
            <button
              onClick={handleExportToPDF}
              disabled={loading}
              className="product-hpp-export-btn pdf"
            >
              <Download size={16} />
              PDF
            </button>
            <button onClick={onClose} className="product-hpp-close-btn">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="product-hpp-modal-content">
          {loading ? (
            <div className="product-hpp-loading">
              <Loader2 className="spin" size={32} />
              <p>Loading material usage data...</p>
            </div>
          ) : error ? (
            <div className="product-hpp-error">
              <p>{error}</p>
              <button onClick={fetchMaterialUsage} className="retry-btn">
                Retry
              </button>
            </div>
          ) : (
            <div className="product-hpp-report">
              {/* Document Header - Excel Style */}
              <div className="document-header">
                <div className="header-row">
                  <div className="header-left">
                    <h3>Perhitungan Estimasi COGS</h3>
                  </div>
                  <div className="header-right">
                    <div className="header-info">
                      <span className="label">Site :</span>
                      <span className="value">{product?.Group_PNCategory_Dept || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Product Info Section */}
              <div className="product-info-section">
                <div className="info-grid">
                  <div className="info-left">
                    <div className="info-line">
                      <span className="label">Kode Produk - Description</span>
                      <span className="separator">:</span>
                      <span className="value">{product.Product_ID} - {product.Product_Name}</span>
                    </div>
                    <div className="info-line">
                      <span className="label">Batch Size Teori</span>
                      <span className="separator">:</span>
                      <span className="value">{formatNumber(product.Batch_Size)} KOTAK</span>
                    </div>
                    <div className="info-line">
                      <span className="label">Batch Size Actual</span>
                      <span className="separator">:</span>
                      <span className="value">{formatNumber(batchSizeActual)} KOTAK</span>
                    </div>
                    <div className="info-line">
                      <span className="label">Rendemen</span>
                      <span className="separator">:</span>
                      <span className="value">{formatNumber(product.Group_Rendemen)}%</span>
                    </div>
                  </div>
                  <div className="info-right">
                    <div className="info-line">
                      <span className="label">LOB</span>
                      <span className="separator">:</span>
                      <span className="value">{formatLOB(product)}</span>
                    </div>
                    <div className="info-line">
                      <span className="label">Tanggal Print</span>
                      <span className="separator">:</span>
                      <span className="value">{formatPrintDate()}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bahan Baku Section */}
              <div className="material-section">
                <div className="section-title">
                  <h4>Bahan Baku</h4>
                </div>
                <table className="excel-table">
                  <thead>
                    <tr>
                      <th rowSpan="2" className="narrow"></th>
                      <th rowSpan="2">Kode Material</th>
                      <th rowSpan="2">Nama Material</th>
                      <th rowSpan="2">Qty</th>
                      <th rowSpan="2">Satuan</th>
                      <th rowSpan="2">Cost/unit</th>
                      <th rowSpan="2">Extended Cost</th>
                      <th rowSpan="2">Per pack</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bahanBaku.map((item, index) => (
                      <tr key={`bb-${item.PPI_ItemID}-${index}`}>
                        <td>{index + 1}</td>
                        <td>{item.PPI_ItemID}</td>
                        <td>{item.Item_Name}</td>
                        <td className="number">{formatNumber(item.PPI_QTY)}</td>
                        <td>{item.PPI_UnitID}</td>
                        <td className="number">{formatNumber(item.Item_unit)}</td>
                        <td className="number">{formatNumber(item.total)}</td>
                        <td className="number">{formatNumber(item.total / batchSizeActual)}</td>
                      </tr>
                    ))}
                    <tr className="total-row">
                      <td colSpan="6"><strong>Total BB :</strong></td>
                      <td className="number total"><strong>{formatNumber(totalBB)}</strong></td>
                      <td className="number total"><strong>{formatNumber(totalBBPerPack)}</strong></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Bahan Kemas Section */}
              <div className="material-section">
                <div className="section-title">
                  <h4>Bahan Kemas</h4>
                </div>
                <table className="excel-table">
                  <thead>
                    <tr>
                      <th rowSpan="2" className="narrow"></th>
                      <th rowSpan="2">Kode Material</th>
                      <th rowSpan="2">Nama Material</th>
                      <th rowSpan="2">Qty</th>
                      <th rowSpan="2">Satuan</th>
                      <th rowSpan="2">Cost/unit</th>
                      <th rowSpan="2">Extended Cost</th>
                      <th rowSpan="2">Per pack</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bahanKemas.map((item, index) => (
                      <tr key={`bk-${item.PPI_ItemID}-${index}`}>
                        <td>{index + 1}</td>
                        <td>{item.PPI_ItemID}</td>
                        <td>{item.Item_Name}</td>
                        <td className="number">{formatNumber(item.PPI_QTY)}</td>
                        <td>{item.PPI_UnitID}</td>
                        <td className="number">{formatNumber(item.Item_unit)}</td>
                        <td className="number">{formatNumber(item.total)}</td>
                        <td className="number">{formatNumber(item.total / batchSizeActual)}</td>
                      </tr>
                    ))}
                    <tr className="total-row">
                      <td colSpan="6"><strong>Total BK :</strong></td>
                      <td className="number total"><strong>{formatNumber(totalBK)}</strong></td>
                      <td className="number total"><strong>{formatNumber(totalBKPerPack)}</strong></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Dynamic Labor/Overhead Section based on product type */}
              {productType === 'Ethical' && (
                <div className="labor-section">
                  <div className="material-section">
                    <div className="section-title">
                      <h4>Overhead</h4>
                    </div>
                    <table className="excel-table">
                      <thead>
                        <tr>
                          <th>Resource Scheduling</th>
                          <th>Nama Material</th>
                          <th>Qty</th>
                          <th>Mhrs/machine hours</th>
                          <th>Cost/unit</th>
                          <th>Extended Cost</th>
                          <th>Per pack</th>
                        </tr>
                      </thead>
                      <tbody>
                      <tr>
                        <td>1 PENGOLAHAN</td>
                        <td>OPERATOR PROSES LINE {product?.Group_PNCategory_Dept || 'N/A'}</td>
                        <td className="number">{formatNumber(product.MH_Proses_Std || 0)}</td>
                        <td>HRS</td>
                        <td className="number">{formatNumber(product.Biaya_Proses || 0)}</td>
                        <td className="number">{formatNumber((product.MH_Proses_Std || 0) * (product.Biaya_Proses || 0))}</td>
                        <td className="number">{formatNumber(((product.MH_Proses_Std || 0) * (product.Biaya_Proses || 0)) / batchSizeActual)}</td>
                      </tr>
                      <tr>
                        <td>2 PENGEMASAN</td>
                        <td>OPERATOR PROSES LINE {product?.Group_PNCategory_Dept || 'N/A'}</td>
                        <td className="number">{formatNumber(product.MH_Kemas_Std || 0)}</td>
                        <td>HRS</td>
                        <td className="number">{formatNumber(product.Biaya_Kemas || 0)}</td>
                        <td className="number">{formatNumber((product.MH_Kemas_Std || 0) * (product.Biaya_Kemas || 0))}</td>
                        <td className="number">{formatNumber(((product.MH_Kemas_Std || 0) * (product.Biaya_Kemas || 0)) / batchSizeActual)}</td>
                      </tr>
                      <tr>
                        <td>3 EXPIRY COST</td>
                        <td>-</td>
                        <td className="number">-</td>
                        <td>-</td>
                        <td className="number">{formatNumber(product.Beban_Sisa_Bahan_Exp || 0)}</td>
                        <td className="number">{formatNumber(product.Beban_Sisa_Bahan_Exp || 0)}</td>
                        <td className="number">{formatNumber((product.Beban_Sisa_Bahan_Exp || 0) / batchSizeActual)}</td>
                      </tr>
                      <tr className="total-row">
                        <td colSpan="2"><strong>Total Hours</strong></td>
                        <td className="number"><strong>{formatNumber((product.MH_Proses_Std || 0) + (product.MH_Kemas_Std || 0))}</strong></td>
                        <td><strong>Total Cost</strong></td>
                        <td></td>
                        <td className="number total"><strong>{formatNumber(((product.MH_Proses_Std || 0) * (product.Biaya_Proses || 0)) + ((product.MH_Kemas_Std || 0) * (product.Biaya_Kemas || 0)) + (product.Beban_Sisa_Bahan_Exp || 0))}</strong></td>
                        <td className="number total"><strong>{formatNumber((((product.MH_Proses_Std || 0) * (product.Biaya_Proses || 0)) + ((product.MH_Kemas_Std || 0) * (product.Biaya_Kemas || 0)) + (product.Beban_Sisa_Bahan_Exp || 0)) / batchSizeActual)}</strong></td>
                      </tr>
                    </tbody>
                  </table>
                  </div>
                </div>
              )}

              {productType === 'Generic1' && (
                <div className="labor-section">
                  <div className="material-section">
                    <div className="section-title">
                      <h4>Overhead</h4>
                    </div>
                    <table className="excel-table">
                      <thead>
                        <tr>
                          <th>Resource Scheduling</th>
                          <th>Nama Material</th>
                          <th>Qty</th>
                          <th>Mhrs/machine hours</th>
                          <th>Cost/unit</th>
                          <th>Extended Cost</th>
                          <th>Per pack</th>
                        </tr>
                      </thead>
                      <tbody>
                      <tr>
                        <td>1 TIMBANG BB</td>
                        <td>OPERATOR PROSES LINE {product?.Group_PNCategory_Dept || 'N/A'}</td>
                        <td className="number">{formatNumber(product.MH_Timbang_BB || 0)}</td>
                        <td>HRS</td>
                        <td className="number">{formatNumber(product.Biaya_Generik || 0)}</td>
                        <td className="number">{formatNumber((product.MH_Timbang_BB || 0) * (product.Biaya_Generik || 0))}</td>
                        <td className="number">{formatNumber(((product.MH_Timbang_BB || 0) * (product.Biaya_Generik || 0)) / batchSizeActual)}</td>
                      </tr>
                      <tr>
                        <td>2 TIMBANG BK</td>
                        <td>OPERATOR PROSES LINE {product?.Group_PNCategory_Dept || 'N/A'}</td>
                        <td className="number">{formatNumber(product.MH_Timbang_BK || 0)}</td>
                        <td>HRS</td>
                        <td className="number">{formatNumber(product.Biaya_Generik || 0)}</td>
                        <td className="number">{formatNumber((product.MH_Timbang_BK || 0) * (product.Biaya_Generik || 0))}</td>
                        <td className="number">{formatNumber(((product.MH_Timbang_BK || 0) * (product.Biaya_Generik || 0)) / batchSizeActual)}</td>
                      </tr>
                      <tr>
                        <td>3 PENGOLAHAN</td>
                        <td>OPERATOR PROSES LINE {product?.Group_PNCategory_Dept || 'N/A'}</td>
                        <td className="number">{formatNumber(product.MH_Proses_Std || 0)}</td>
                        <td>HRS</td>
                        <td className="number">{formatNumber(product.Biaya_Generik || 0)}</td>
                        <td className="number">{formatNumber((product.MH_Proses_Std || 0) * (product.Biaya_Generik || 0))}</td>
                        <td className="number">{formatNumber(((product.MH_Proses_Std || 0) * (product.Biaya_Generik || 0)) / batchSizeActual)}</td>
                      </tr>
                      <tr>
                        <td>4 PENGEMASAN</td>
                        <td>OPERATOR PROSES LINE {product?.Group_PNCategory_Dept || 'N/A'}</td>
                        <td className="number">{formatNumber(product.MH_Kemas_Std || 0)}</td>
                        <td>HRS</td>
                        <td className="number">{formatNumber(product.Biaya_Generik || 0)}</td>
                        <td className="number">{formatNumber((product.MH_Kemas_Std || 0) * (product.Biaya_Generik || 0))}</td>
                        <td className="number">{formatNumber(((product.MH_Kemas_Std || 0) * (product.Biaya_Generik || 0)) / batchSizeActual)}</td>
                      </tr>
                      <tr>
                        <td>5 ANALISA</td>
                        <td>OPERATOR PROSES LINE {product?.Group_PNCategory_Dept || 'N/A'}</td>
                        <td className="number">{formatNumber(product.MH_Analisa_Std || 0)}</td>
                        <td>HRS</td>
                        <td className="number">{formatNumber(product.Biaya_Generik || 0)}</td>
                        <td className="number">{formatNumber((product.MH_Analisa_Std || 0) * (product.Biaya_Generik || 0))}</td>
                        <td className="number">{formatNumber(((product.MH_Analisa_Std || 0) * (product.Biaya_Generik || 0)) / batchSizeActual)}</td>
                      </tr>
                      <tr>
                        <td>6 MESIN</td>
                        <td>MESIN OPERATION</td>
                        <td className="number">{formatNumber(product.MH_Mesin_Std || 0)}</td>
                        <td>HRS</td>
                        <td className="number">{formatNumber(product.Rate_PLN || 0)}</td>
                        <td className="number">{formatNumber((product.MH_Mesin_Std || 0) * (product.Rate_PLN || 0))}</td>
                        <td className="number">{formatNumber(((product.MH_Mesin_Std || 0) * (product.Rate_PLN || 0)) / batchSizeActual)}</td>
                      </tr>
                      <tr>
                        <td>7 REAGEN</td>
                        <td>ANALISA REAGENT</td>
                        <td className="number">1</td>
                        <td>LOT</td>
                        <td className="number">{formatNumber(product.Biaya_Analisa || 0)}</td>
                        <td className="number">{formatNumber(product.Biaya_Analisa || 0)}</td>
                        <td className="number">{formatNumber((product.Biaya_Analisa || 0) / batchSizeActual)}</td>
                      </tr>
                      <tr>
                        <td>8 EXPIRY COST</td>
                        <td>-</td>
                        <td className="number">-</td>
                        <td>-</td>
                        <td className="number">{formatNumber(product.Beban_Sisa_Bahan_Exp || 0)}</td>
                        <td className="number">{formatNumber(product.Beban_Sisa_Bahan_Exp || 0)}</td>
                        <td className="number">{formatNumber((product.Beban_Sisa_Bahan_Exp || 0) / batchSizeActual)}</td>
                      </tr>
                      <tr className="total-row">
                        <td colSpan="5"><strong>Total Cost</strong></td>
                        <td className="number total"><strong>{formatNumber(
                          ((product.MH_Timbang_BB || 0) * (product.Biaya_Generik || 0)) +
                          ((product.MH_Timbang_BK || 0) * (product.Biaya_Generik || 0)) +
                          ((product.MH_Proses_Std || 0) * (product.Biaya_Generik || 0)) +
                          ((product.MH_Kemas_Std || 0) * (product.Biaya_Generik || 0)) +
                          ((product.MH_Analisa_Std || 0) * (product.Biaya_Generik || 0)) +
                          ((product.MH_Mesin_Std || 0) * (product.Rate_PLN || 0)) +
                          (product.Biaya_Analisa || 0) +
                          (product.Beban_Sisa_Bahan_Exp || 0)
                        )}</strong></td>
                        <td className="number total"><strong>{formatNumber((
                          ((product.MH_Timbang_BB || 0) * (product.Biaya_Generik || 0)) +
                          ((product.MH_Timbang_BK || 0) * (product.Biaya_Generik || 0)) +
                          ((product.MH_Proses_Std || 0) * (product.Biaya_Generik || 0)) +
                          ((product.MH_Kemas_Std || 0) * (product.Biaya_Generik || 0)) +
                          ((product.MH_Analisa_Std || 0) * (product.Biaya_Generik || 0)) +
                          ((product.MH_Mesin_Std || 0) * (product.Rate_PLN || 0)) +
                          (product.Biaya_Analisa || 0) +
                          (product.Beban_Sisa_Bahan_Exp || 0)
                        ) / batchSizeActual)}</strong></td>
                      </tr>
                    </tbody>
                  </table>
                  </div>
                </div>
              )}

              {productType === 'Generic2' && (
                <div className="labor-section">
                  {/* Direct Labor Section */}
                  <div className="material-section">
                    <div className="section-title">
                      <h4>Direct Labor</h4>
                    </div>
                    <table className="excel-table">
                      <thead>
                        <tr>
                          <th>Resource Scheduling</th>
                          <th>Nama Material</th>
                          <th>Qty</th>
                          <th>Mhrs/machine hours</th>
                          <th>Cost/unit</th>
                          <th>Extended Cost</th>
                          <th>Per pack</th>
                        </tr>
                      </thead>
                      <tbody>
                      <tr className="subsection-header">
                        <td colSpan="7"><em>Line Production</em></td>
                      </tr>
                      <tr>
                        <td>1 PENGOLAHAN</td>
                        <td>OPERATOR PROSES LINE PN1/PN2</td>
                        <td className="number">{formatNumber(product.MH_Proses_Std || 0)}</td>
                        <td>HRS</td>
                        <td className="number">{formatNumber(product.Direct_Labor || 0)}</td>
                        <td className="number">{formatNumber((product.MH_Proses_Std || 0) * (product.Direct_Labor || 0))}</td>
                        <td className="number">{formatNumber(((product.MH_Proses_Std || 0) * (product.Direct_Labor || 0)) / batchSizeActual)}</td>
                      </tr>
                      <tr>
                        <td>2 PENGEMASAN</td>
                        <td>OPERATOR PROSES LINE PN1/PN2</td>
                        <td className="number">{formatNumber(product.MH_Kemas_Std || 0)}</td>
                        <td>HRS</td>
                        <td className="number">{formatNumber(product.Direct_Labor || 0)}</td>
                        <td className="number">{formatNumber((product.MH_Kemas_Std || 0) * (product.Direct_Labor || 0))}</td>
                        <td className="number">{formatNumber(((product.MH_Kemas_Std || 0) * (product.Direct_Labor || 0)) / batchSizeActual)}</td>
                      </tr>
                      <tr className="total-row">
                        <td colSpan="2"><strong>Total Hours</strong></td>
                        <td className="number"><strong>{formatNumber((product.MH_Proses_Std || 0) + (product.MH_Kemas_Std || 0))}</strong></td>
                        <td><strong>Total Cost</strong></td>
                        <td></td>
                        <td className="number total"><strong>{formatNumber(((product.MH_Proses_Std || 0) * (product.Direct_Labor || 0)) + ((product.MH_Kemas_Std || 0) * (product.Direct_Labor || 0)))}</strong></td>
                        <td className="number total"><strong>{formatNumber((((product.MH_Proses_Std || 0) * (product.Direct_Labor || 0)) + ((product.MH_Kemas_Std || 0) * (product.Direct_Labor || 0))) / batchSizeActual)}</strong></td>
                      </tr>
                    </tbody>
                  </table>
                  </div>

                  {/* Factory Over Head Section */}
                  <div className="material-section">
                    <div className="section-title">
                      <h4>Factory Over Head</h4>
                    </div>
                    <table className="excel-table">
                      <thead>
                        <tr>
                          <th>Resource Scheduling</th>
                          <th>Nama Material</th>
                          <th>Qty</th>
                          <th>Mhrs/machine hours</th>
                          <th>Cost/unit</th>
                          <th>Extended Cost</th>
                          <th>Per pack</th>
                        </tr>
                      </thead>
                      <tbody>
                      <tr className="subsection-header">
                        <td colSpan="7"><em>Line Production</em></td>
                      </tr>
                      <tr>
                        <td>1 PENGOLAHAN</td>
                        <td>OPERATOR PROSES LINE PN1/PN2</td>
                        <td className="number">{formatNumber(product.MH_Proses_Std || 0)}</td>
                        <td>HRS</td>
                        <td className="number">{formatNumber(product.Factory_Over_Head_50 || 0)}</td>
                        <td className="number">{formatNumber((product.MH_Proses_Std || 0) * (product.Factory_Over_Head_50 || 0))}</td>
                        <td className="number">{formatNumber(((product.MH_Proses_Std || 0) * (product.Factory_Over_Head_50 || 0)) / batchSizeActual)}</td>
                      </tr>
                      <tr>
                        <td>2 PENGEMASAN</td>
                        <td>OPERATOR PROSES LINE PN1/PN2</td>
                        <td className="number">{formatNumber(product.MH_Kemas_Std || 0)}</td>
                        <td>HRS</td>
                        <td className="number">{formatNumber(product.Factory_Over_Head_50 || 0)}</td>
                        <td className="number">{formatNumber((product.MH_Kemas_Std || 0) * (product.Factory_Over_Head_50 || 0))}</td>
                        <td className="number">{formatNumber(((product.MH_Kemas_Std || 0) * (product.Factory_Over_Head_50 || 0)) / batchSizeActual)}</td>
                      </tr>
                      <tr>
                        <td>3 EXPIRY COST</td>
                        <td>-</td>
                        <td className="number">-</td>
                        <td>-</td>
                        <td className="number">{formatNumber(product.Beban_Sisa_Bahan_Exp || 0)}</td>
                        <td className="number">{formatNumber(product.Beban_Sisa_Bahan_Exp || 0)}</td>
                        <td className="number">{formatNumber((product.Beban_Sisa_Bahan_Exp || 0) / batchSizeActual)}</td>
                      </tr>
                      <tr className="total-row">
                        <td colSpan="2"><strong>Total Hours</strong></td>
                        <td className="number"><strong>{formatNumber((product.MH_Proses_Std || 0) + (product.MH_Kemas_Std || 0))}</strong></td>
                        <td><strong>Total Cost</strong></td>
                        <td></td>
                        <td className="number total"><strong>{formatNumber(((product.MH_Proses_Std || 0) * (product.Factory_Over_Head_50 || 0)) + ((product.MH_Kemas_Std || 0) * (product.Factory_Over_Head_50 || 0)) + (product.Beban_Sisa_Bahan_Exp || 0))}</strong></td>
                        <td className="number total"><strong>{formatNumber((((product.MH_Proses_Std || 0) * (product.Factory_Over_Head_50 || 0)) + ((product.MH_Kemas_Std || 0) * (product.Factory_Over_Head_50 || 0)) + (product.Beban_Sisa_Bahan_Exp || 0)) / batchSizeActual)}</strong></td>
                      </tr>
                    </tbody>
                  </table>
                  </div>

                  {/* Note: Depreciation section removed for Generic Type 2 as it's no longer used */}
                </div>
              )}

              {/* Final Total */}
              <div className="final-total-section">
                <table className="excel-table">
                  <tbody>
                    <tr className="final-total">
                      <td><strong>Total COGS Estimasi</strong></td>
                      <td colSpan="3"></td>
                      <td><strong>Total HPP</strong></td>
                      <td className="number final"><strong>{formatNumber(totalBB + totalBK + totalOverheadCost + (product.Beban_Sisa_Bahan_Exp || 0))}</strong></td>
                      <td className="number final"><strong>{formatNumber(totalHPPPerPack)}</strong></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductHPPReport;
