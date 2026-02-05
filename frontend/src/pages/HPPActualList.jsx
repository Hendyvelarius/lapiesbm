import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Download, FileText, Loader2, ChevronLeft, ChevronRight, Search, RefreshCw, X, Calculator, AlertCircle, CheckCircle2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { hppAPI } from '../services/api';
import '../styles/HPPActualList.css';

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

const formatPeriod = (periode) => {
  if (!periode || periode.length !== 6) return periode;
  const year = periode.substring(0, 4);
  const month = parseInt(periode.substring(4, 6), 10);
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${monthNames[month - 1]} ${year}`;
};

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatPrintDate = () => {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  return `${day}/${month}/${year}`;
};

const formatHPPRatio = (ratio) => {
  if (!ratio || isNaN(ratio)) return '0,00%';
  const percentage = parseFloat(ratio).toFixed(2);
  return `${percentage.replace('.', ',')}%`;
};

// Pagination Component
const Pagination = ({ currentPage, totalPages, onPageChange, totalItems }) => {
  const getVisiblePages = () => {
    const delta = 2;
    const range = [];
    const rangeWithDots = [];
    for (let i = Math.max(2, currentPage - delta); i <= Math.min(totalPages - 1, currentPage + delta); i++) {
      range.push(i);
    }
    if (currentPage - delta > 2) {
      rangeWithDots.push(1, '...');
    } else {
      rangeWithDots.push(1);
    }
    rangeWithDots.push(...range);
    if (currentPage + delta < totalPages - 1) {
      rangeWithDots.push('...', totalPages);
    } else if (totalPages > 1) {
      rangeWithDots.push(totalPages);
    }
    return rangeWithDots;
  };

  if (totalPages <= 1) return null;

  return (
    <div className="hpp-actual-pagination">
      <div className="hpp-actual-pagination-info">
        Showing page {currentPage} of {totalPages} ({totalItems} total batches)
      </div>
      <div className="hpp-actual-pagination-controls">
        <button onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1} className="hpp-actual-pagination-btn">
          <ChevronLeft size={16} />
        </button>
        {getVisiblePages().map((page, index) => (
          <button
            key={index}
            onClick={() => typeof page === 'number' ? onPageChange(page) : null}
            disabled={page === '...'}
            className={`hpp-actual-pagination-btn ${currentPage === page ? 'active' : ''} ${page === '...' ? 'dots' : ''}`}
          >
            {page}
          </button>
        ))}
        <button onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages} className="hpp-actual-pagination-btn">
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};

// Ethical/OTC Table Component
const EthicalTable = ({ data, filteredCount, totalCount, searchTerm, onSearchChange, pagination, onPageChange, totalPages, onBatchClick }) => (
  <div className="hpp-actual-table-container">
    <div className="hpp-actual-table-header">
      <h3><FileText className="hpp-actual-table-icon" />Ethical / OTC Products</h3>
      <div className="hpp-actual-table-controls">
        <div className="hpp-actual-search-container">
          <Search size={16} className="hpp-actual-search-icon" />
          <input
            type="text"
            placeholder="Search batches..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="hpp-actual-search-input"
          />
        </div>
        <span className="hpp-actual-record-count">{filteredCount} of {totalCount} batches</span>
      </div>
    </div>
    <div className="hpp-actual-table-wrapper">
      <table className="hpp-actual-table">
        <thead>
          <tr>
            <th>Product ID</th>
            <th>Product Name</th>
            <th>Batch No</th>
            <th>Batch Date</th>
            <th>Output</th>
            <th>Total BB</th>
            <th>Total BK</th>
            <th>MH Proses</th>
            <th>MH Kemas</th>
            <th>Biaya Proses</th>
            <th>Biaya Kemas</th>
            <th>Expiry Cost</th>
            <th>Total HPP</th>
            <th>HPP/Unit</th>
            <th>HNA</th>
            <th>HPP/HNA</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item, index) => (
            <tr key={`${item.HPP_Actual_ID}-${index}`}>
              <td>{item.Product_ID}</td>
              <td className="product-name clickable" onClick={() => onBatchClick(item)}>{item.Product_Name}</td>
              <td className="batch-no">{item.BatchNo}</td>
              <td>{formatDate(item.BatchDate)}</td>
              <td className="number">{formatNumber(item.Output_Actual, 0)}</td>
              <td className="number">{formatCurrency(item.Total_Cost_BB)}</td>
              <td className="number">{formatCurrency(item.Total_Cost_BK)}</td>
              <td className="number">{item.MH_Proses_Actual ? <span className="actual">{formatNumber(item.MH_Proses_Actual)}</span> : <span className="std">{formatNumber(item.MH_Proses_Std)}</span>}</td>
              <td className="number">{item.MH_Kemas_Actual ? <span className="actual">{formatNumber(item.MH_Kemas_Actual)}</span> : <span className="std">{formatNumber(item.MH_Kemas_Std)}</span>}</td>
              <td className="number">{formatCurrency(item.Biaya_Proses)}</td>
              <td className="number">{formatCurrency(item.Biaya_Kemas)}</td>
              <td className="number">{formatCurrency(item.Beban_Sisa_Bahan_Exp)}</td>
              <td className="number hpp-value">{formatCurrency(item.Total_HPP_Batch)}</td>
              <td className="number hpp-unit">{formatCurrency(item.HPP_Per_Unit)}</td>
              <td className="number hna-value">{formatCurrency(item.HNA)}</td>
              <td className="number hpp-ratio">{formatHPPRatio(item.HPP_Ratio)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    <Pagination currentPage={pagination.currentPage} totalPages={totalPages} onPageChange={onPageChange} totalItems={filteredCount} />
  </div>
);

// Generic Table Component
const GenericTable = ({ data, filteredCount, totalCount, searchTerm, onSearchChange, pagination, onPageChange, totalPages, onBatchClick }) => (
  <div className="hpp-actual-table-container">
    <div className="hpp-actual-table-header">
      <h3><FileText className="hpp-actual-table-icon" />Generic Products</h3>
      <div className="hpp-actual-table-controls">
        <div className="hpp-actual-search-container">
          <Search size={16} className="hpp-actual-search-icon" />
          <input
            type="text"
            placeholder="Search batches..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="hpp-actual-search-input"
          />
        </div>
        <span className="hpp-actual-record-count">{filteredCount} of {totalCount} batches</span>
      </div>
    </div>
    <div className="hpp-actual-table-wrapper">
      <table className="hpp-actual-table">
        <thead>
          <tr>
            <th>Product ID</th>
            <th>Product Name</th>
            <th>Batch No</th>
            <th>Batch Date</th>
            <th>Output</th>
            <th>Total BB</th>
            <th>Total BK</th>
            <th>MH Proses</th>
            <th>MH Kemas</th>
            <th>Direct Labor</th>
            <th>Factory OH</th>
            <th>Depresiasi</th>
            <th>Expiry Cost</th>
            <th>Total HPP</th>
            <th>HPP/Unit</th>
            <th>HNA</th>
            <th>HPP/HNA</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item, index) => (
            <tr key={`${item.HPP_Actual_ID}-${index}`}>
              <td>{item.Product_ID}</td>
              <td className="product-name clickable" onClick={() => onBatchClick(item)}>{item.Product_Name}</td>
              <td className="batch-no">{item.BatchNo}</td>
              <td>{formatDate(item.BatchDate)}</td>
              <td className="number">{formatNumber(item.Output_Actual, 0)}</td>
              <td className="number">{formatCurrency(item.Total_Cost_BB)}</td>
              <td className="number">{formatCurrency(item.Total_Cost_BK)}</td>
              <td className="number">{item.MH_Proses_Actual ? <span className="actual">{formatNumber(item.MH_Proses_Actual)}</span> : <span className="std">{formatNumber(item.MH_Proses_Std)}</span>}</td>
              <td className="number">{item.MH_Kemas_Actual ? <span className="actual">{formatNumber(item.MH_Kemas_Actual)}</span> : <span className="std">{formatNumber(item.MH_Kemas_Std)}</span>}</td>
              <td className="number">{formatCurrency(item.Direct_Labor)}</td>
              <td className="number">{formatCurrency(item.Factory_Overhead)}</td>
              <td className="number">{formatCurrency(item.Depresiasi)}</td>
              <td className="number">{formatCurrency(item.Beban_Sisa_Bahan_Exp)}</td>
              <td className="number hpp-value">{formatCurrency(item.Total_HPP_Batch)}</td>
              <td className="number hpp-unit">{formatCurrency(item.HPP_Per_Unit)}</td>
              <td className="number hna-value">{formatCurrency(item.HNA)}</td>
              <td className="number hpp-ratio">{formatHPPRatio(item.HPP_Ratio)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    <Pagination currentPage={pagination.currentPage} totalPages={totalPages} onPageChange={onPageChange} totalItems={filteredCount} />
  </div>
);

// Batch Detail Modal Component
const BatchDetailModal = ({ batch, materials, isOpen, onClose, isLoading }) => {
  const modalContentRef = useRef(null);
  const [exporting, setExporting] = useState(false);

  if (!isOpen || !batch) return null;

  // Determine product type based on LOB and available data
  const isEthical = batch.LOB === 'ETHICAL' || batch.LOB === 'ETH' || batch.LOB === 'OTC';
  
  // Detect Generic1 vs Generic2 based on available fields
  // Generic1 has MH_Timbang_BB, MH_Analisa_Std, Biaya_Reagen, etc.
  // Generic2 has Direct_Labor, Factory_Overhead, Depresiasi
  const isGeneric1 = !isEthical && (
    (batch.MH_Timbang_BB && batch.MH_Timbang_BB > 0) ||
    (batch.MH_Analisa_Std && batch.MH_Analisa_Std > 0) ||
    (batch.Biaya_Reagen && batch.Biaya_Reagen > 0) ||
    (batch.MH_Mesin_Std && batch.MH_Mesin_Std > 0)
  );
  const isGeneric2 = !isEthical && !isGeneric1;
  
  // Calculate batch size actual
  const batchSizeActual = batch.Output_Actual || 1;
  
  // Separate materials by Item_Type (from backend)
  const bahanBaku = materials.filter(m => m.Item_Type === 'BB');
  const bahanKemas = materials.filter(m => m.Item_Type === 'BK');
  
  // Calculate totals
  const totalBB = batch.Total_Cost_BB || 0;
  const totalBK = batch.Total_Cost_BK || 0;
  const totalBBPerUnit = batchSizeActual > 0 ? totalBB / batchSizeActual : 0;
  const totalBKPerUnit = batchSizeActual > 0 ? totalBK / batchSizeActual : 0;
  
  // Calculate manhours (use actual if available, else standard)
  const mhProses = batch.MH_Proses_Actual ?? batch.MH_Proses_Std ?? 0;
  const mhKemas = batch.MH_Kemas_Actual ?? batch.MH_Kemas_Std ?? 0;
  const mhTimbangBB = batch.MH_Timbang_BB || 0;
  const mhTimbangBK = batch.MH_Timbang_BK || 0;
  const mhAnalisa = batch.MH_Analisa_Std || 0;
  const mhMesin = batch.MH_Mesin_Std || 0;
  const totalMH = mhProses + mhKemas;

  // Calculate overhead costs based on product type
  let overheadItems = [];
  let totalOverhead = 0;
  let sectionTitle = 'Overhead';

  if (isEthical) {
    // Ethical: Only Pengolahan + Pengemasan + Expiry
    // Use Rate_MH_Proses (Biaya_Proses) and Rate_MH_Kemas (Biaya_Kemas) as rates
    const biayaProses = mhProses * (batch.Rate_MH_Proses || 0);
    const biayaKemas = mhKemas * (batch.Rate_MH_Kemas || 0);
    const expiryCost = batch.Beban_Sisa_Bahan_Exp || 0;
    
    overheadItems = [
      { name: '1 PENGOLAHAN', desc: `OPERATOR PROSES LINE ${batch.Group_PNCategory_Dept || 'N/A'}`, qty: mhProses, unit: 'HRS', rate: batch.Rate_MH_Proses || 0, cost: biayaProses, perUnit: biayaProses / batchSizeActual },
      { name: '2 PENGEMASAN', desc: `OPERATOR PROSES LINE ${batch.Group_PNCategory_Dept || 'N/A'}`, qty: mhKemas, unit: 'HRS', rate: batch.Rate_MH_Kemas || 0, cost: biayaKemas, perUnit: biayaKemas / batchSizeActual },
      { name: '3 EXPIRY COST', desc: '-', qty: '-', unit: '-', rate: expiryCost, cost: expiryCost, perUnit: expiryCost / batchSizeActual },
    ];
    totalOverhead = biayaProses + biayaKemas + expiryCost;
  } else if (isGeneric1) {
    // Generic1: Similar to HPP Results - Timbang, Proses, Kemas, Analisa, Mesin, Reagen, Expiry
    sectionTitle = 'Overhead';
    
    const biayaTimbangBB = mhTimbangBB * (batch.Rate_MH_Timbang || batch.Rate_MH_Proses || 0);
    const biayaTimbangBK = mhTimbangBK * (batch.Rate_MH_Timbang || batch.Rate_MH_Proses || 0);
    const biayaProses = mhProses * (batch.Rate_MH_Proses || 0);
    const biayaKemas = mhKemas * (batch.Rate_MH_Kemas || 0);
    const biayaAnalisa = mhAnalisa * (batch.Biaya_Analisa || 0);
    const biayaMesin = mhMesin * (batch.Rate_PLN || 0);
    const biayaReagen = batch.Biaya_Reagen || 0;
    const expiryCost = batch.Beban_Sisa_Bahan_Exp || 0;
    
    overheadItems = [
      { name: '1 TIMBANG BAHAN', desc: 'OPERATOR PROSES LINE PN1/PN2', qty: mhTimbangBB, unit: 'HRS', rate: batch.Rate_MH_Timbang || batch.Rate_MH_Proses || 0, cost: biayaTimbangBB, perUnit: biayaTimbangBB / batchSizeActual },
      { name: '2 TIMBANG KEMAS', desc: 'OPERATOR PROSES LINE PN1/PN2', qty: mhTimbangBK, unit: 'HRS', rate: batch.Rate_MH_Timbang || batch.Rate_MH_Proses || 0, cost: biayaTimbangBK, perUnit: biayaTimbangBK / batchSizeActual },
      { name: '3 BIAYA PROSES', desc: 'OPERATOR PROSES LINE PN1/PN2', qty: mhProses, unit: 'HRS', rate: batch.Rate_MH_Proses || 0, cost: biayaProses, perUnit: biayaProses / batchSizeActual },
      { name: '4 BIAYA KEMAS', desc: 'OPERATOR PROSES LINE PN1/PN2', qty: mhKemas, unit: 'HRS', rate: batch.Rate_MH_Kemas || 0, cost: biayaKemas, perUnit: biayaKemas / batchSizeActual },
      { name: '5 BIAYA ANALISA', desc: 'OPERATOR PROSES LINE PN1/PN2', qty: mhAnalisa, unit: 'HRS', rate: batch.Biaya_Analisa || 0, cost: biayaAnalisa, perUnit: biayaAnalisa / batchSizeActual },
      { name: '6 BIAYA MESIN', desc: 'MESIN OPERATION', qty: mhMesin, unit: 'HRS', rate: batch.Rate_PLN || 0, cost: biayaMesin, perUnit: biayaMesin / batchSizeActual },
      { name: '7 BIAYA REAGEN', desc: 'ANALISA REAGENT', qty: '-', unit: '-', rate: biayaReagen, cost: biayaReagen, perUnit: biayaReagen / batchSizeActual },
      { name: '8 BEBAN EXPIRY', desc: '-', qty: '-', unit: '-', rate: expiryCost, cost: expiryCost, perUnit: expiryCost / batchSizeActual },
    ];
    totalOverhead = biayaTimbangBB + biayaTimbangBK + biayaProses + biayaKemas + biayaAnalisa + biayaMesin + biayaReagen + expiryCost;
  } else {
    // Generic2: Direct Labor + Factory Overhead + Depresiasi + Expiry
    sectionTitle = 'Conversion Costs';
    
    const directLaborProses = mhProses * (batch.Direct_Labor || 0);
    const directLaborKemas = mhKemas * (batch.Direct_Labor || 0);
    const factoryOHProses = mhProses * (batch.Factory_Overhead || 0);
    const factoryOHKemas = mhKemas * (batch.Factory_Overhead || 0);
    const depresiasiProses = mhProses * (batch.Depresiasi || 0);
    const depresiasiKemas = mhKemas * (batch.Depresiasi || 0);
    const expiryCost = batch.Beban_Sisa_Bahan_Exp || 0;
    
    overheadItems = [
      { section: 'Direct Labor' },
      { name: '1 PENGOLAHAN', desc: `OPERATOR LINE ${batch.Group_PNCategory_Dept || 'PN1/PN2'}`, qty: mhProses, unit: 'HRS', rate: batch.Direct_Labor || 0, cost: directLaborProses, perUnit: directLaborProses / batchSizeActual },
      { name: '2 PENGEMASAN', desc: `OPERATOR LINE ${batch.Group_PNCategory_Dept || 'PN1/PN2'}`, qty: mhKemas, unit: 'HRS', rate: batch.Direct_Labor || 0, cost: directLaborKemas, perUnit: directLaborKemas / batchSizeActual },
      { subtotal: 'Direct Labor', cost: directLaborProses + directLaborKemas, perUnit: (directLaborProses + directLaborKemas) / batchSizeActual },
      { section: 'Factory Over Head' },
      { name: '1 PENGOLAHAN', desc: `OPERATOR LINE ${batch.Group_PNCategory_Dept || 'PN1/PN2'}`, qty: mhProses, unit: 'HRS', rate: batch.Factory_Overhead || 0, cost: factoryOHProses, perUnit: factoryOHProses / batchSizeActual },
      { name: '2 PENGEMASAN', desc: `OPERATOR LINE ${batch.Group_PNCategory_Dept || 'PN1/PN2'}`, qty: mhKemas, unit: 'HRS', rate: batch.Factory_Overhead || 0, cost: factoryOHKemas, perUnit: factoryOHKemas / batchSizeActual },
      { subtotal: 'Factory Overhead', cost: factoryOHProses + factoryOHKemas, perUnit: (factoryOHProses + factoryOHKemas) / batchSizeActual },
      { section: 'Depresiasi' },
      { name: '1 PENGOLAHAN', desc: 'DEPRESIASI MESIN PROSES', qty: mhProses, unit: 'HRS', rate: batch.Depresiasi || 0, cost: depresiasiProses, perUnit: depresiasiProses / batchSizeActual },
      { name: '2 PENGEMASAN', desc: 'DEPRESIASI MESIN KEMAS', qty: mhKemas, unit: 'HRS', rate: batch.Depresiasi || 0, cost: depresiasiKemas, perUnit: depresiasiKemas / batchSizeActual },
      { subtotal: 'Depresiasi', cost: depresiasiProses + depresiasiKemas, perUnit: (depresiasiProses + depresiasiKemas) / batchSizeActual },
      { section: 'Other Costs' },
      { name: 'EXPIRY COST', desc: '-', qty: '-', unit: '-', rate: expiryCost, cost: expiryCost, perUnit: expiryCost / batchSizeActual },
    ];
    totalOverhead = directLaborProses + directLaborKemas + factoryOHProses + factoryOHKemas + depresiasiProses + depresiasiKemas + expiryCost;
  }

  const totalHPP = batch.Total_HPP_Batch || (totalBB + totalBK + totalOverhead);
  const hppPerUnit = batch.HPP_Per_Unit || (batchSizeActual > 0 ? totalHPP / batchSizeActual : 0);

  const handleExportToPDF = async () => {
    if (!modalContentRef.current) return;
    try {
      setExporting(true);
      
      // Get the content element
      const element = modalContentRef.current;
      
      // Clone the element to capture full content without scroll constraints
      const clone = element.cloneNode(true);
      clone.style.position = 'absolute';
      clone.style.left = '-9999px';
      clone.style.top = '0';
      clone.style.width = element.scrollWidth + 'px';
      clone.style.height = 'auto';
      clone.style.maxHeight = 'none';
      clone.style.overflow = 'visible';
      document.body.appendChild(clone);
      
      const canvas = await html2canvas(clone, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });
      
      // Remove the clone
      document.body.removeChild(clone);
      
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const imgWidth = pdfWidth - (margin * 2);
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      // Calculate page dimensions
      const pageContentHeight = pdfHeight - (margin * 2);
      const totalPages = Math.ceil(imgHeight / pageContentHeight);
      
      // For each page, create a cropped portion of the canvas
      for (let page = 0; page < totalPages; page++) {
        if (page > 0) pdf.addPage();
        
        // Calculate source coordinates for this page slice
        const sourceY = (page * pageContentHeight * canvas.width) / imgWidth;
        const sourceHeight = Math.min(
          (pageContentHeight * canvas.width) / imgWidth,
          canvas.height - sourceY
        );
        
        // Create a temporary canvas for this page slice
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvas.width;
        pageCanvas.height = sourceHeight;
        const ctx = pageCanvas.getContext('2d');
        
        // Draw the slice from the source canvas
        ctx.drawImage(
          canvas,
          0, sourceY,           // source x, y
          canvas.width, sourceHeight,  // source width, height
          0, 0,                 // dest x, y
          canvas.width, sourceHeight   // dest width, height
        );
        
        const pageImgData = pageCanvas.toDataURL('image/png');
        const sliceHeight = (sourceHeight * imgWidth) / canvas.width;
        
        pdf.addImage(pageImgData, 'PNG', margin, margin, imgWidth, sliceHeight);
      }
      
      pdf.save(`HPP_Actual_${batch.Product_ID}_${batch.BatchNo}_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error('Error exporting to PDF:', error);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="hpp-actual-modal-overlay" onClick={onClose}>
      <div className="hpp-actual-modal" onClick={e => e.stopPropagation()}>
        <div className="hpp-actual-modal-header">
          <h2>HPP Actual Report - {batch.Product_Name}</h2>
          <div className="hpp-actual-modal-actions">
            <button onClick={handleExportToPDF} disabled={isLoading || exporting} className="hpp-actual-export-btn pdf">
              {exporting ? <Loader2 className="spin" size={16} /> : <Download size={16} />}
              PDF
            </button>
            <button onClick={onClose} className="hpp-actual-close-btn"><X size={20} /></button>
          </div>
        </div>

        <div className="hpp-actual-modal-content" ref={modalContentRef}>
          {isLoading ? (
            <div className="hpp-actual-modal-loading">
              <Loader2 className="spin" size={32} />
              <p>Loading batch details...</p>
            </div>
          ) : (
            <div className="hpp-actual-report">
              {/* Document Header */}
              <div className="document-header">
                <div className="header-row">
                  <div className="header-left"><h3>Perhitungan HPP Actual</h3></div>
                  <div className="header-right">
                    <div className="header-info"><span className="label">Site :</span><span className="value">{batch.Group_PNCategory_Dept || 'N/A'}</span></div>
                  </div>
                </div>
              </div>

              {/* Product Info Section */}
              <div className="product-info-section">
                <div className="info-grid">
                  <div className="info-left">
                    <div className="info-line"><span className="label">Produk</span><span className="separator">:</span><span className="value">{batch.Product_ID} - {batch.Product_Name}</span></div>
                    <div className="info-line"><span className="label">Batch No</span><span className="separator">:</span><span className="value">{batch.BatchNo}</span></div>
                    <div className="info-line"><span className="label">Batch Date</span><span className="separator">:</span><span className="value">{formatDate(batch.BatchDate)}</span></div>
                    <div className="info-line"><span className="label">Output Actual</span><span className="separator">:</span><span className="value">{formatNumber(batch.Output_Actual, 0)} UNIT</span></div>
                  </div>
                  <div className="info-right">
                    <div className="info-line"><span className="label">LOB</span><span className="separator">:</span><span className="value">{isEthical ? 'Ethical / OTC' : 'Generic'}</span></div>
                    <div className="info-line"><span className="label">Periode</span><span className="separator">:</span><span className="value">{formatPeriod(batch.Periode)}</span></div>
                    <div className="info-line"><span className="label">Tanggal Print</span><span className="separator">:</span><span className="value">{formatPrintDate()}</span></div>
                    <div className="info-line"><span className="label">Category</span><span className="separator">:</span><span className="value">{batch.Group_PNCategory_Name || '-'}</span></div>
                  </div>
                </div>
              </div>

              {/* Bahan Baku Section */}
              <div className="material-section">
                <div className="section-title"><h4>Bahan Baku (Raw Materials)</h4></div>
                <table className="excel-table">
                  <thead>
                    <tr>
                      <th className="narrow">#</th>
                      <th>Kode Material</th>
                      <th>Nama Material</th>
                      <th>Qty Used</th>
                      <th>Satuan</th>
                      <th>Cost/unit</th>
                      <th>Extended Cost</th>
                      <th>Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bahanBaku.map((item, index) => (
                      <tr key={`bb-${index}`}>
                        <td>{index + 1}</td>
                        <td>{item.Item_ID}</td>
                        <td>{item.Item_Name}</td>
                        <td className="number">{formatNumber(item.Qty_Used, 4)}</td>
                        <td>{item.Item_Unit || item.Usage_Unit}</td>
                        <td className="number">{formatNumber(item.Unit_Price_IDR)}</td>
                        <td className="number">{formatNumber(item.Total_Cost)}</td>
                        <td><span className={`source-badge ${item.Price_Source?.toLowerCase()}`}>{item.Price_Source || 'N/A'}</span></td>
                      </tr>
                    ))}
                    <tr className="total-row">
                      <td colSpan="6"><strong>Total BB :</strong></td>
                      <td className="number total"><strong>{formatNumber(totalBB)}</strong></td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Bahan Kemas Section */}
              <div className="material-section">
                <div className="section-title"><h4>Bahan Kemas (Packaging)</h4></div>
                <table className="excel-table">
                  <thead>
                    <tr>
                      <th className="narrow">#</th>
                      <th>Kode Material</th>
                      <th>Nama Material</th>
                      <th>Qty Used</th>
                      <th>Satuan</th>
                      <th>Cost/unit</th>
                      <th>Extended Cost</th>
                      <th>Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bahanKemas.map((item, index) => (
                      <tr key={`bk-${index}`}>
                        <td>{index + 1}</td>
                        <td>{item.Item_ID}</td>
                        <td>{item.Item_Name}</td>
                        <td className="number">{formatNumber(item.Qty_Used, 4)}</td>
                        <td>{item.Item_Unit || item.Usage_Unit}</td>
                        <td className="number">{formatNumber(item.Unit_Price_IDR)}</td>
                        <td className="number">{formatNumber(item.Total_Cost)}</td>
                        <td><span className={`source-badge ${item.Price_Source?.toLowerCase()}`}>{item.Price_Source || 'N/A'}</span></td>
                      </tr>
                    ))}
                    <tr className="total-row">
                      <td colSpan="6"><strong>Total BK :</strong></td>
                      <td className="number total"><strong>{formatNumber(totalBK)}</strong></td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Overhead Section */}
              <div className="labor-section">
                <div className="material-section">
                  <div className="section-title"><h4>{sectionTitle}</h4></div>
                  <table className="excel-table">
                    <thead>
                      <tr>
                        <th>Resource</th>
                        <th>Description</th>
                        <th>Qty</th>
                        <th>Unit</th>
                        <th>Rate</th>
                        <th>Extended Cost</th>
                        <th>Per Unit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overheadItems.map((item, index) => {
                        if (item.section) {
                          return (
                            <tr key={`section-${index}`} className="subsection-header">
                              <td colSpan="7"><em>{item.section}</em></td>
                            </tr>
                          );
                        }
                        if (item.subtotal) {
                          return (
                            <tr key={`subtotal-${index}`} className="subtotal-row">
                              <td colSpan="5"><strong>Subtotal {item.subtotal}</strong></td>
                              <td className="number"><strong>{formatNumber(item.cost)}</strong></td>
                              <td className="number"><strong>{formatNumber(item.perUnit)}</strong></td>
                            </tr>
                          );
                        }
                        return (
                          <tr key={`item-${index}`}>
                            <td>{item.name}</td>
                            <td>{item.desc}</td>
                            <td className="number">{item.qty === '-' ? '-' : formatNumber(item.qty)}</td>
                            <td>{item.unit}</td>
                            <td className="number">{formatNumber(item.rate)}</td>
                            <td className="number">{formatNumber(item.cost)}</td>
                            <td className="number">{formatNumber(item.perUnit)}</td>
                          </tr>
                        );
                      })}
                      <tr className="total-row">
                        <td colSpan="2"><strong>Total Man Hours</strong></td>
                        <td className="number"><strong>{formatNumber(totalMH)}</strong></td>
                        <td><strong>Total Overhead</strong></td>
                        <td></td>
                        <td className="number total"><strong>{formatNumber(totalOverhead)}</strong></td>
                        <td className="number total"><strong>{formatNumber(totalOverhead / batchSizeActual)}</strong></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Final Total */}
              <div className="final-total-section">
                <table className="excel-table">
                  <tbody>
                    <tr className="final-total">
                      <td><strong>Total HPP Actual</strong></td>
                      <td colSpan="3"></td>
                      <td><strong>Total HPP</strong></td>
                      <td className="number final"><strong>{formatCurrency(totalHPP)}</strong></td>
                      <td className="number final"><strong>{formatCurrency(hppPerUnit)}</strong></td>
                    </tr>
                    <tr className="final-total">
                      <td><strong>HNA</strong></td>
                      <td colSpan="3"></td>
                      <td><strong>HPP/HNA</strong></td>
                      <td className="number final"><strong>{formatCurrency(batch.HNA)}</strong></td>
                      <td className="number final"><strong>{formatHPPRatio(batch.HPP_Ratio)}</strong></td>
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

// Main Component
const HPPActualList = ({ user }) => {
  const [loading, setLoading] = useState(true);
  const [periods, setPeriods] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState('');
  const [batches, setBatches] = useState([]);
  const [activeTab, setActiveTab] = useState('ethical');
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);

  // Modal state
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [batchMaterials, setBatchMaterials] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);

  // Calculate HPP Modal state
  const [showCalculateModal, setShowCalculateModal] = useState(false);
  const [calculateMonth, setCalculateMonth] = useState(new Date().getMonth() + 1);
  const [calculateYear, setCalculateYear] = useState(new Date().getFullYear());
  const [overwriteExisting, setOverwriteExisting] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [calculateResult, setCalculateResult] = useState(null);
  const [calculateError, setCalculateError] = useState(null);

  // Pagination state for each tab
  const [pagination, setPagination] = useState({
    ethical: { currentPage: 1, itemsPerPage: 50 },
    generic: { currentPage: 1, itemsPerPage: 50 }
  });

  // Search state for each tab
  const [searchTerms, setSearchTerms] = useState({
    ethical: '',
    generic: ''
  });

  // Load periods on mount
  useEffect(() => {
    loadPeriods();
  }, []);

  // Load batches when period changes
  useEffect(() => {
    if (selectedPeriod) {
      loadBatches(selectedPeriod);
    }
  }, [selectedPeriod]);

  const loadPeriods = async () => {
    try {
      setLoading(true);
      const response = await hppAPI.getActualPeriods();
      if (response.success && response.data) {
        setPeriods(response.data);
        if (response.data.length > 0) {
          setSelectedPeriod(response.data[0].Periode);
        }
      }
    } catch (err) {
      console.error('Error loading periods:', err);
      setError('Failed to load periods');
    } finally {
      setLoading(false);
    }
  };

  const loadBatches = async (periode) => {
    try {
      setLoading(true);
      setError(null);
      const response = await hppAPI.getActualList(periode);
      if (response.success) {
        setBatches(response.data || []);
      } else {
        setError('Failed to load batches');
        setBatches([]);
      }
    } catch (err) {
      console.error('Error loading batches:', err);
      setError('Failed to load batches: ' + err.message);
      setBatches([]);
    } finally {
      setLoading(false);
    }
  };

  const handleBatchClick = async (batch) => {
    setSelectedBatch(batch);
    setShowModal(true);
    setModalLoading(true);
    setBatchMaterials([]);

    try {
      const response = await hppAPI.getActualDetail(batch.HPP_Actual_ID);
      if (response.success) {
        setBatchMaterials(response.data.details || []);
      }
    } catch (err) {
      console.error('Error loading batch detail:', err);
    } finally {
      setModalLoading(false);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedBatch(null);
    setBatchMaterials([]);
  };

  const handleRefresh = () => {
    if (selectedPeriod) loadBatches(selectedPeriod);
  };

  // Split batches by LOB
  const splitBatches = useMemo(() => {
    const ethical = batches.filter(b => b.LOB === 'ETHICAL' || b.LOB === 'ETH' || b.LOB === 'OTC');
    const generic = batches.filter(b => b.LOB !== 'ETHICAL' && b.LOB !== 'ETH' && b.LOB !== 'OTC');
    return { ethical, generic };
  }, [batches]);

  // Filter data based on search terms
  const getFilteredData = (data, searchTerm) => {
    if (!searchTerm.trim()) return data;
    const term = searchTerm.toLowerCase();
    return data.filter(item =>
      item.Product_ID?.toLowerCase().includes(term) ||
      item.Product_Name?.toLowerCase().includes(term) ||
      item.BatchNo?.toLowerCase().includes(term)
    );
  };

  // Get paginated data
  const getPaginatedData = (data, page, itemsPerPage) => {
    const startIndex = (page - 1) * itemsPerPage;
    return data.slice(startIndex, startIndex + itemsPerPage);
  };

  // Handle pagination change
  const handlePageChange = (tableType, newPage) => {
    setPagination(prev => ({
      ...prev,
      [tableType]: { ...prev[tableType], currentPage: newPage }
    }));
  };

  // Handle search change
  const handleSearchChange = (tableType, searchTerm) => {
    setSearchTerms(prev => ({ ...prev, [tableType]: searchTerm }));
    setPagination(prev => ({
      ...prev,
      [tableType]: { ...prev[tableType], currentPage: 1 }
    }));
  };

  // Process data
  const processedData = useMemo(() => {
    const ethicalFiltered = getFilteredData(splitBatches.ethical, searchTerms.ethical);
    const genericFiltered = getFilteredData(splitBatches.generic, searchTerms.generic);

    return {
      ethical: {
        filtered: ethicalFiltered,
        paginated: getPaginatedData(ethicalFiltered, pagination.ethical.currentPage, pagination.ethical.itemsPerPage),
        totalPages: Math.ceil(ethicalFiltered.length / pagination.ethical.itemsPerPage)
      },
      generic: {
        filtered: genericFiltered,
        paginated: getPaginatedData(genericFiltered, pagination.generic.currentPage, pagination.generic.itemsPerPage),
        totalPages: Math.ceil(genericFiltered.length / pagination.generic.itemsPerPage)
      }
    };
  }, [splitBatches, searchTerms, pagination]);

  // Tab configuration
  const tabs = [
    { id: 'ethical', label: 'Ethical / OTC', count: splitBatches.ethical.length },
    { id: 'generic', label: 'Generic', count: splitBatches.generic.length }
  ];

  // Export to Excel
  const handleExportToExcel = async () => {
    try {
      setExporting(true);
      const workbook = XLSX.utils.book_new();

      const columnMapping = {
        'Product_ID': 'Product ID',
        'Product_Name': 'Product Name',
        'BatchNo': 'Batch No',
        'BatchDate': 'Batch Date',
        'Periode': 'Period',
        'LOB': 'LOB',
        'Group_PNCategory_Name': 'Category',
        'Output_Actual': 'Output Actual',
        'Total_Cost_BB': 'Total BB',
        'Total_Cost_BK': 'Total BK',
        'MH_Proses_Std': 'MH Proses (Std)',
        'MH_Proses_Actual': 'MH Proses (Actual)',
        'MH_Kemas_Std': 'MH Kemas (Std)',
        'MH_Kemas_Actual': 'MH Kemas (Actual)',
        'Direct_Labor': 'Direct Labor Rate',
        'Factory_Overhead': 'Factory Overhead Rate',
        'Depresiasi': 'Depresiasi Rate',
        'Beban_Sisa_Bahan_Exp': 'Expiry Cost',
        'Total_HPP_Batch': 'Total HPP Batch',
        'HPP_Per_Unit': 'HPP Per Unit',
        'Count_Materials_PO': 'Materials (PO)',
        'Count_Materials_MR': 'Materials (MR)',
        'Count_Materials_STD': 'Materials (STD)',
        'Count_Materials_UNLINKED': 'Materials (Unlinked)'
      };

      const transformData = (data) => data.map(item => {
        const transformed = {};
        Object.entries(columnMapping).forEach(([key, header]) => {
          transformed[header] = item[key];
        });
        return transformed;
      });

      if (splitBatches.ethical.length > 0) {
        const ws = XLSX.utils.json_to_sheet(transformData(splitBatches.ethical));
        XLSX.utils.book_append_sheet(workbook, ws, 'Ethical OTC');
      }

      if (splitBatches.generic.length > 0) {
        const ws = XLSX.utils.json_to_sheet(transformData(splitBatches.generic));
        XLSX.utils.book_append_sheet(workbook, ws, 'Generic');
      }

      const filename = `HPP_Actual_${selectedPeriod}_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(workbook, filename);
    } catch (err) {
      console.error('Error exporting to Excel:', err);
    } finally {
      setExporting(false);
    }
  };

  // Calculate HPP Modal handlers
  const handleOpenCalculateModal = () => {
    // Pre-fill with current month/year
    const now = new Date();
    setCalculateMonth(now.getMonth() + 1);
    setCalculateYear(now.getFullYear());
    setOverwriteExisting(false);
    setCalculateResult(null);
    setCalculateError(null);
    setShowCalculateModal(true);
  };

  const handleCloseCalculateModal = () => {
    setShowCalculateModal(false);
    setCalculateResult(null);
    setCalculateError(null);
  };

  const handleCalculateHPP = async () => {
    try {
      setCalculating(true);
      setCalculateResult(null);
      setCalculateError(null);
      
      // Build period string YYYYMM
      const periode = `${calculateYear}${String(calculateMonth).padStart(2, '0')}`;
      
      console.log(`Calculating HPP Actual for period ${periode}, overwrite: ${overwriteExisting}`);
      
      const response = await hppAPI.calculateActual(periode, overwriteExisting);
      
      if (response.success) {
        setCalculateResult(response.data);
        // Refresh periods list and data if current period matches
        loadPeriods();
        if (selectedPeriod === periode) {
          loadBatches(periode);
        }
      } else {
        setCalculateError(response.message || 'Calculation failed');
      }
    } catch (err) {
      console.error('Error calculating HPP:', err);
      setCalculateError(err.message || 'Failed to calculate HPP');
    } finally {
      setCalculating(false);
    }
  };

  const monthNames = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' }
  ];

  // Generate year options (current year and a few years back)
  const currentYear = new Date().getFullYear();
  const yearOptions = [];
  for (let y = currentYear; y >= currentYear - 5; y--) {
    yearOptions.push(y);
  }

  const renderActiveTable = () => {
    const currentData = processedData[activeTab];
    const currentSearchTerm = searchTerms[activeTab];
    const currentPagination = pagination[activeTab];
    const rawData = activeTab === 'ethical' ? splitBatches.ethical : splitBatches.generic;

    const tableProps = {
      data: currentData.paginated,
      filteredCount: currentData.filtered.length,
      totalCount: rawData.length,
      searchTerm: currentSearchTerm,
      onSearchChange: (term) => handleSearchChange(activeTab, term),
      pagination: currentPagination,
      onPageChange: (page) => handlePageChange(activeTab, page),
      totalPages: currentData.totalPages,
      onBatchClick: handleBatchClick
    };

    return activeTab === 'ethical' ? <EthicalTable {...tableProps} /> : <GenericTable {...tableProps} />;
  };

  if (loading && !batches.length) {
    return (
      <div className="hpp-actual-page">
        <div className="hpp-actual-loading">
          <Loader2 className="hpp-actual-loading-spinner" />
          <p>Loading HPP Actual data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="hpp-actual-page">
      {/* Header Row with Period, Search Actions */}
      <div className="hpp-actual-header">
        <div className="hpp-actual-period-selector">
          <label htmlFor="period-select">Period:</label>
          <select
            id="period-select"
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            disabled={loading}
          >
            <option value="">Select Period</option>
            {periods.map(p => (
              <option key={p.Periode} value={p.Periode}>
                {formatPeriod(p.Periode)} ({p.BatchCount} batches)
              </option>
            ))}
          </select>
        </div>
        <div className="hpp-actual-header-actions">
          <button className="hpp-actual-refresh-btn" onClick={handleRefresh} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
            Refresh
          </button>
          <button className="hpp-actual-export-btn" onClick={handleExportToExcel} disabled={exporting || loading || batches.length === 0}>
            {exporting ? <Loader2 className="spin" size={16} /> : <Download size={16} />}
            Export to Excel
          </button>
          <button className="hpp-actual-calculate-btn" onClick={handleOpenCalculateModal} disabled={calculating}>
            {calculating ? <Loader2 className="spin" size={16} /> : <Calculator size={16} />}
            Calculate HPP
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="hpp-actual-error">
          <p>{error}</p>
          <button onClick={handleRefresh}>Retry</button>
        </div>
      )}

      {/* Tab System */}
      <div className="hpp-actual-tabs-container">
        <div className="hpp-actual-tabs-header">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`hpp-actual-tab ${activeTab === tab.id ? 'active' : ''}`}
            >
              <FileText size={18} />
              <span className="hpp-actual-tab-label">{tab.label}</span>
              <span className="hpp-actual-tab-count">{tab.count}</span>
            </button>
          ))}
        </div>

        <div className="hpp-actual-tab-content">
          {renderActiveTable()}
        </div>
      </div>

      {/* Batch Detail Modal */}
      <BatchDetailModal
        batch={selectedBatch}
        materials={batchMaterials}
        isOpen={showModal}
        onClose={handleCloseModal}
        isLoading={modalLoading}
      />

      {/* Calculate HPP Modal */}
      {showCalculateModal && (
        <div className="hpp-actual-modal-overlay" onClick={handleCloseCalculateModal}>
          <div className="hpp-actual-calculate-modal" onClick={e => e.stopPropagation()}>
            <div className="hpp-actual-modal-header">
              <h2><Calculator size={20} /> Calculate HPP Actual</h2>
              <button onClick={handleCloseCalculateModal} className="hpp-actual-close-btn"><X size={20} /></button>
            </div>
            
            <div className="hpp-actual-calculate-content">
              {/* Processing Time Warning */}
              <div className="calculate-time-warning">
                <div className="warning-icon">
                  <Loader2 size={24} />
                </div>
                <div className="warning-content">
                  <h4>Processing Time Notice</h4>
                  <p>
                    This calculation may take <strong>2-5 minutes</strong> depending on the number of 
                    batches in the selected period. Please be patient and do not close this window 
                    while the calculation is in progress.
                  </p>
                </div>
              </div>

              {/* Period Selection */}
              <div className="calculate-form-section">
                <h3>Select Period</h3>
                <p className="section-description">
                  Choose the month and year for which you want to calculate HPP Actual. 
                  The system will process all production batches within the selected period.
                </p>
                <div className="calculate-period-row">
                  <div className="calculate-field">
                    <label htmlFor="calc-month">Month</label>
                    <select
                      id="calc-month"
                      value={calculateMonth}
                      onChange={(e) => setCalculateMonth(parseInt(e.target.value))}
                      disabled={calculating}
                    >
                      {monthNames.map(m => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="calculate-field">
                    <label htmlFor="calc-year">Year</label>
                    <select
                      id="calc-year"
                      value={calculateYear}
                      onChange={(e) => setCalculateYear(parseInt(e.target.value))}
                      disabled={calculating}
                    >
                      {yearOptions.map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Overwrite Option */}
              <div className="calculate-form-section">
                <h3>Calculation Options</h3>
                <div className="calculate-checkbox-row">
                  <input
                    type="checkbox"
                    id="overwrite-existing"
                    checked={overwriteExisting}
                    onChange={(e) => setOverwriteExisting(e.target.checked)}
                    disabled={calculating}
                  />
                  <label htmlFor="overwrite-existing">
                    <strong>Overwrite existing calculations</strong>
                  </label>
                </div>
                <div className="option-explanation">
                  <p className="explanation-text">
                    <strong>When unchecked (default):</strong> The system will only calculate HPP for new batches 
                    that haven't been processed yet. Existing HPP calculations will remain unchanged.
                  </p>
                  <p className="explanation-text">
                    <strong>When checked:</strong> All batches in the selected period will be recalculated, 
                    including those that already have HPP values. Use this option if material prices or 
                    overhead rates have been updated and you need to refresh all calculations.
                  </p>
                </div>
              </div>

              {/* Error Display */}
              {calculateError && (
                <div className="calculate-error">
                  <AlertCircle size={18} />
                  <span>{calculateError}</span>
                </div>
              )}

              {/* Success Result */}
              {calculateResult && (
                <div className="calculate-success">
                  <div className="success-header">
                    <CheckCircle2 size={20} />
                    <span>Calculation Completed Successfully!</span>
                  </div>
                  <div className="success-details">
                    <div className="detail-row">
                      <span className="label">Granulates Processed:</span>
                      <span className="value">{calculateResult.granulatesProcessed}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Total Batches Found:</span>
                      <span className="value">{calculateResult.totalProductBatches}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Batches Calculated:</span>
                      <span className="value">{calculateResult.productsProcessed}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Batches Skipped:</span>
                      <span className="value">{calculateResult.totalProductBatches - calculateResult.productsProcessed}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Duration:</span>
                      <span className="value">{calculateResult.durationSeconds} seconds</span>
                    </div>
                    {calculateResult.errors > 0 && (
                      <>
                        <div className="detail-row warning">
                          <span className="label">Errors:</span>
                          <span className="value">{calculateResult.errors}</span>
                        </div>
                        
                        {/* Error Batches Detail */}
                        {calculateResult.errorBatches && calculateResult.errorBatches.length > 0 && (
                          <div className="error-batches-section">
                            <h4 className="error-batches-title">
                              <AlertCircle size={16} />
                              <span>Batches with Errors:</span>
                            </h4>
                            <div className="error-batches-list">
                              {calculateResult.errorBatches.map((batch, index) => (
                                <div key={batch.HPP_Actual_ID || index} className="error-batch-item">
                                  <div className="error-batch-info">
                                    <span className="batch-number">{batch.BatchNo}</span>
                                    <span className="product-name">{batch.Product_Name || batch.DNc_ProductID}</span>
                                  </div>
                                  <div className="error-message">
                                    {batch.Error_Message || 'Unknown error'}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="hpp-actual-calculate-footer">
              <button 
                className="calculate-cancel-btn" 
                onClick={handleCloseCalculateModal}
                disabled={calculating}
              >
                {calculateResult ? 'Close' : 'Cancel'}
              </button>
              {!calculateResult && (
                <button 
                  className="calculate-submit-btn" 
                  onClick={handleCalculateHPP}
                  disabled={calculating}
                >
                  {calculating ? (
                    <>
                      <Loader2 className="spin" size={16} />
                      Calculating...
                    </>
                  ) : (
                    <>
                      <Calculator size={16} />
                      Calculate HPP
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HPPActualList;
