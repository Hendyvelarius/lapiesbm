import React, { useState, useEffect, useMemo } from 'react';
import { Download, FileText, Loader2, ChevronLeft, ChevronRight, Search, RefreshCw, Calendar, Eye, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
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

const formatNumber = (value, decimals = 0) => {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value);
};

// Format period for display (202601 -> Jan 2026)
const formatPeriod = (periode) => {
  if (!periode || periode.length !== 6) return periode;
  const year = periode.substring(0, 4);
  const month = parseInt(periode.substring(4, 6), 10);
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${monthNames[month - 1]} ${year}`;
};

// Format date for display
const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

// Pagination component
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
        Showing page {currentPage} of {totalPages} ({formatNumber(totalItems)} total batches)
      </div>
      <div className="hpp-actual-pagination-controls">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="hpp-actual-pagination-btn"
        >
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
        
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="hpp-actual-pagination-btn"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};

// Detail Modal Component
const DetailModal = ({ isOpen, onClose, batch, materials, isLoading }) => {
  if (!isOpen) return null;

  return (
    <div className="hpp-actual-modal-overlay" onClick={onClose}>
      <div className="hpp-actual-modal-content" onClick={e => e.stopPropagation()}>
        <div className="hpp-actual-modal-header">
          <h2>Batch Detail: {batch?.BatchNo}</h2>
          <button className="hpp-actual-modal-close" onClick={onClose}>&times;</button>
        </div>
        
        <div className="hpp-actual-modal-body">
          {isLoading ? (
            <div className="hpp-actual-modal-loading">
              <Loader2 className="spinner" size={32} />
              <p>Loading details...</p>
            </div>
          ) : (
            <>
              {/* Batch Summary */}
              <div className="hpp-actual-detail-summary">
                <div className="hpp-actual-detail-grid">
                  <div className="hpp-actual-detail-item">
                    <span className="label">Product ID</span>
                    <span className="value">{batch?.Product_ID}</span>
                  </div>
                  <div className="hpp-actual-detail-item">
                    <span className="label">Product Name</span>
                    <span className="value">{batch?.Product_Name}</span>
                  </div>
                  <div className="hpp-actual-detail-item">
                    <span className="label">Batch No</span>
                    <span className="value">{batch?.BatchNo}</span>
                  </div>
                  <div className="hpp-actual-detail-item">
                    <span className="label">Batch Date</span>
                    <span className="value">{formatDate(batch?.BatchDate)}</span>
                  </div>
                  <div className="hpp-actual-detail-item">
                    <span className="label">Period</span>
                    <span className="value">{formatPeriod(batch?.Periode)}</span>
                  </div>
                  <div className="hpp-actual-detail-item">
                    <span className="label">Output Actual</span>
                    <span className="value">{formatNumber(batch?.Output_Actual)}</span>
                  </div>
                  <div className="hpp-actual-detail-item highlight">
                    <span className="label">Total HPP Batch</span>
                    <span className="value">{formatCurrency(batch?.Total_HPP_Batch)}</span>
                  </div>
                  <div className="hpp-actual-detail-item highlight">
                    <span className="label">HPP Per Unit</span>
                    <span className="value">{formatCurrency(batch?.HPP_Per_Unit)}</span>
                  </div>
                </div>
              </div>

              {/* Cost Breakdown */}
              <div className="hpp-actual-cost-breakdown">
                <h3>Cost Breakdown</h3>
                <table className="hpp-actual-cost-table">
                  <thead>
                    <tr>
                      <th>Component</th>
                      <th>Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Total Cost BB (Raw Materials)</td>
                      <td className="cost-value">{formatCurrency(batch?.Total_Cost_BB)}</td>
                    </tr>
                    <tr>
                      <td>Total Cost BK (Packaging)</td>
                      <td className="cost-value">{formatCurrency(batch?.Total_Cost_BK)}</td>
                    </tr>
                    <tr>
                      <td>Biaya Proses (Direct Labor - Proses)</td>
                      <td className="cost-value">{formatCurrency(batch?.Biaya_Proses)}</td>
                    </tr>
                    <tr>
                      <td>Biaya Kemas (Direct Labor - Kemas)</td>
                      <td className="cost-value">{formatCurrency(batch?.Biaya_Kemas)}</td>
                    </tr>
                    <tr>
                      <td>Biaya Timbang BB</td>
                      <td className="cost-value">{formatCurrency(batch?.Biaya_Timbang_BB)}</td>
                    </tr>
                    <tr>
                      <td>Biaya Timbang BK</td>
                      <td className="cost-value">{formatCurrency(batch?.Biaya_Timbang_BK)}</td>
                    </tr>
                    <tr>
                      <td>Factory Overhead (Proses + Kemas)</td>
                      <td className="cost-value">{formatCurrency(
                        ((batch?.MH_Proses_Actual || batch?.MH_Proses_Std || 0) + (batch?.MH_Kemas_Actual || batch?.MH_Kemas_Std || 0)) * (batch?.Factory_Overhead || 0)
                      )}</td>
                    </tr>
                    <tr>
                      <td>Depresiasi</td>
                      <td className="cost-value">{formatCurrency(
                        ((batch?.MH_Proses_Actual || batch?.MH_Proses_Std || 0) + (batch?.MH_Kemas_Actual || batch?.MH_Kemas_Std || 0)) * (batch?.Depresiasi || 0)
                      )}</td>
                    </tr>
                    <tr>
                      <td>Biaya Analisa</td>
                      <td className="cost-value">{formatCurrency(batch?.Biaya_Analisa)}</td>
                    </tr>
                    <tr>
                      <td>Biaya Reagen</td>
                      <td className="cost-value">{formatCurrency(batch?.Biaya_Reagen)}</td>
                    </tr>
                    <tr>
                      <td>Cost Utility (PLN)</td>
                      <td className="cost-value">{formatCurrency(batch?.Cost_Utility)}</td>
                    </tr>
                    <tr>
                      <td>Toll Fee</td>
                      <td className="cost-value">{formatCurrency(batch?.Toll_Fee)}</td>
                    </tr>
                    <tr>
                      <td>Beban Sisa Bahan Expired</td>
                      <td className="cost-value">{formatCurrency(batch?.Beban_Sisa_Bahan_Exp)}</td>
                    </tr>
                    <tr>
                      <td>Biaya Lain-lain</td>
                      <td className="cost-value">{formatCurrency(batch?.Biaya_Lain)}</td>
                    </tr>
                    <tr className="total-row">
                      <td><strong>Total HPP Batch</strong></td>
                      <td className="cost-value total">{formatCurrency(batch?.Total_HPP_Batch)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Manhour Details */}
              <div className="hpp-actual-manhour-section">
                <h3>Manhour Details</h3>
                <div className="hpp-actual-manhour-grid">
                  <div className="hpp-actual-mh-item">
                    <span className="label">MH Proses (Std)</span>
                    <span className="value">{formatNumber(batch?.MH_Proses_Std, 2)}</span>
                  </div>
                  <div className="hpp-actual-mh-item">
                    <span className="label">MH Proses (Actual)</span>
                    <span className="value highlight">{formatNumber(batch?.MH_Proses_Actual, 2)}</span>
                  </div>
                  <div className="hpp-actual-mh-item">
                    <span className="label">MH Kemas (Std)</span>
                    <span className="value">{formatNumber(batch?.MH_Kemas_Std, 2)}</span>
                  </div>
                  <div className="hpp-actual-mh-item">
                    <span className="label">MH Kemas (Actual)</span>
                    <span className="value highlight">{formatNumber(batch?.MH_Kemas_Actual, 2)}</span>
                  </div>
                  <div className="hpp-actual-mh-item">
                    <span className="label">Direct Labor Rate</span>
                    <span className="value">{formatCurrency(batch?.Direct_Labor)}/MH</span>
                  </div>
                  <div className="hpp-actual-mh-item">
                    <span className="label">Factory Overhead Rate</span>
                    <span className="value">{formatCurrency(batch?.Factory_Overhead)}/MH</span>
                  </div>
                </div>
              </div>

              {/* Materials Table */}
              {materials && materials.length > 0 && (
                <div className="hpp-actual-materials-section">
                  <h3>Materials ({materials.length} items)</h3>
                  <div className="hpp-actual-materials-table-wrapper">
                    <table className="hpp-actual-materials-table">
                      <thead>
                        <tr>
                          <th>Material Code</th>
                          <th>Material Name</th>
                          <th>Type</th>
                          <th>Qty Used</th>
                          <th>Unit</th>
                          <th>Unit Price</th>
                          <th>Total Cost</th>
                          <th>Source</th>
                        </tr>
                      </thead>
                      <tbody>
                        {materials.map((mat, idx) => (
                          <tr key={idx} className={mat.Material_Type === 'BB' ? 'material-bb' : 'material-bk'}>
                            <td>{mat.Material_Code}</td>
                            <td>{mat.Material_Name}</td>
                            <td>
                              <span className={`material-type-badge ${mat.Material_Type?.toLowerCase()}`}>
                                {mat.Material_Type}
                              </span>
                            </td>
                            <td className="number">{formatNumber(mat.Qty_Usage, 4)}</td>
                            <td>{mat.Unit}</td>
                            <td className="number">{formatCurrency(mat.Unit_Price)}</td>
                            <td className="number">{formatCurrency(mat.Total_Cost)}</td>
                            <td>
                              <span className={`source-badge ${mat.Price_Source?.toLowerCase().replace(' ', '-')}`}>
                                {mat.Price_Source || 'N/A'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
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
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [error, setError] = useState(null);
  
  // Detail modal state
  const [detailModal, setDetailModal] = useState({
    isOpen: false,
    batch: null,
    materials: [],
    isLoading: false
  });

  const ITEMS_PER_PAGE = 50;

  // Load available periods on mount
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
        // Auto-select first period if available
        if (response.data.length > 0) {
          setSelectedPeriod(response.data[0].Periode);
        }
      } else {
        setError('Failed to load periods');
      }
    } catch (err) {
      console.error('Error loading periods:', err);
      setError('Failed to load periods: ' + err.message);
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

  const handleViewDetail = async (batch) => {
    setDetailModal({
      isOpen: true,
      batch: batch,
      materials: [],
      isLoading: true
    });

    try {
      const response = await hppAPI.getActualDetail(batch.HPP_Actual_ID);
      
      if (response.success) {
        setDetailModal(prev => ({
          ...prev,
          materials: response.data.materials || [],
          isLoading: false
        }));
      } else {
        setDetailModal(prev => ({
          ...prev,
          isLoading: false
        }));
      }
    } catch (err) {
      console.error('Error loading detail:', err);
      setDetailModal(prev => ({
        ...prev,
        isLoading: false
      }));
    }
  };

  const handleCloseDetail = () => {
    setDetailModal({
      isOpen: false,
      batch: null,
      materials: [],
      isLoading: false
    });
  };

  const handleRefresh = () => {
    if (selectedPeriod) {
      loadBatches(selectedPeriod);
    }
  };

  // Filter and paginate batches
  const filteredBatches = useMemo(() => {
    if (!searchTerm) return batches;
    
    const term = searchTerm.toLowerCase();
    return batches.filter(batch => 
      batch.Product_ID?.toLowerCase().includes(term) ||
      batch.Product_Name?.toLowerCase().includes(term) ||
      batch.BatchNo?.toLowerCase().includes(term) ||
      batch.Group_PNCategory_Name?.toLowerCase().includes(term)
    );
  }, [batches, searchTerm]);

  const totalPages = Math.ceil(filteredBatches.length / ITEMS_PER_PAGE);
  
  const paginatedBatches = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredBatches.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredBatches, currentPage]);

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Export to Excel
  const handleExport = () => {
    if (filteredBatches.length === 0) return;

    const exportData = filteredBatches.map(batch => ({
      'Product ID': batch.Product_ID,
      'Product Name': batch.Product_Name,
      'Batch No': batch.BatchNo,
      'Batch Date': batch.BatchDate ? new Date(batch.BatchDate).toLocaleDateString('id-ID') : '',
      'Period': batch.Periode,
      'LOB': batch.LOB,
      'Category': batch.Group_PNCategory_Name,
      'Batch Size Std': batch.Batch_Size_Std,
      'Output Actual': batch.Output_Actual,
      'Rendemen Std (%)': batch.Rendemen_Std,
      'Rendemen Actual (%)': batch.Rendemen_Actual,
      'Total Cost BB': batch.Total_Cost_BB,
      'Total Cost BK': batch.Total_Cost_BK,
      'MH Proses (Std)': batch.MH_Proses_Std,
      'MH Proses (Actual)': batch.MH_Proses_Actual,
      'MH Kemas (Std)': batch.MH_Kemas_Std,
      'MH Kemas (Actual)': batch.MH_Kemas_Actual,
      'Direct Labor Rate': batch.Direct_Labor,
      'Factory Overhead Rate': batch.Factory_Overhead,
      'Depresiasi Rate': batch.Depresiasi,
      'Biaya Analisa': batch.Biaya_Analisa,
      'Biaya Reagen': batch.Biaya_Reagen,
      'Cost Utility': batch.Cost_Utility,
      'Toll Fee': batch.Toll_Fee,
      'Beban Sisa Bahan Exp': batch.Beban_Sisa_Bahan_Exp,
      'Biaya Lain': batch.Biaya_Lain,
      'Total HPP Batch': batch.Total_HPP_Batch,
      'HPP Per Unit': batch.HPP_Per_Unit,
      'Materials PO': batch.Count_Materials_PO,
      'Materials MR': batch.Count_Materials_MR,
      'Materials STD': batch.Count_Materials_STD,
      'Materials Unlinked': batch.Count_Materials_UNLINKED
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);
    XLSX.utils.book_append_sheet(wb, ws, 'HPP Actual');
    XLSX.writeFile(wb, `HPP_Actual_${selectedPeriod}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    if (filteredBatches.length === 0) return null;
    
    const totalHPP = filteredBatches.reduce((sum, b) => sum + (b.Total_HPP_Batch || 0), 0);
    const avgHPPPerUnit = filteredBatches.reduce((sum, b) => sum + (b.HPP_Per_Unit || 0), 0) / filteredBatches.length;
    const totalOutput = filteredBatches.reduce((sum, b) => sum + (b.Output_Actual || 0), 0);
    
    return {
      totalBatches: filteredBatches.length,
      totalHPP,
      avgHPPPerUnit,
      totalOutput
    };
  }, [filteredBatches]);

  return (
    <div className="hpp-actual-container">
      {/* Header */}
      <div className="hpp-actual-header">
        <div className="hpp-actual-title-section">
          <h1><FileText className="hpp-actual-icon" /> HPP Actual Results</h1>
          <p className="hpp-actual-subtitle">View calculated HPP per batch with actual costs and manhours</p>
        </div>
        
        <div className="hpp-actual-actions">
          <button 
            className="hpp-actual-btn refresh"
            onClick={handleRefresh}
            disabled={loading || !selectedPeriod}
          >
            <RefreshCw size={16} className={loading ? 'spinning' : ''} />
            Refresh
          </button>
          <button 
            className="hpp-actual-btn export"
            onClick={handleExport}
            disabled={filteredBatches.length === 0}
          >
            <Download size={16} />
            Export Excel
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="hpp-actual-filters">
        <div className="hpp-actual-filter-group">
          <label><Calendar size={16} /> Period</label>
          <select 
            value={selectedPeriod} 
            onChange={(e) => setSelectedPeriod(e.target.value)}
            disabled={loading}
          >
            <option value="">Select Period</option>
            {periods.map(p => (
              <option key={p.Periode} value={p.Periode}>
                {formatPeriod(p.Periode)} ({formatNumber(p.BatchCount)} batches)
              </option>
            ))}
          </select>
        </div>
        
        <div className="hpp-actual-filter-group search">
          <label><Search size={16} /> Search</label>
          <input
            type="text"
            placeholder="Search by Product ID, Name, or Batch No..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Summary Cards */}
      {summaryStats && (
        <div className="hpp-actual-summary-cards">
          <div className="hpp-actual-summary-card">
            <span className="label">Total Batches</span>
            <span className="value">{formatNumber(summaryStats.totalBatches)}</span>
          </div>
          <div className="hpp-actual-summary-card">
            <span className="label">Total Output</span>
            <span className="value">{formatNumber(summaryStats.totalOutput)}</span>
          </div>
          <div className="hpp-actual-summary-card">
            <span className="label">Total HPP</span>
            <span className="value">{formatCurrency(summaryStats.totalHPP)}</span>
          </div>
          <div className="hpp-actual-summary-card">
            <span className="label">Avg HPP/Unit</span>
            <span className="value">{formatCurrency(summaryStats.avgHPPPerUnit)}</span>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="hpp-actual-error">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="hpp-actual-loading">
          <Loader2 className="spinner" size={32} />
          <p>Loading data...</p>
        </div>
      )}

      {/* Main Table */}
      {!loading && !error && batches.length > 0 && (
        <div className="hpp-actual-table-container">
          <div className="hpp-actual-table-info">
            Showing {formatNumber(paginatedBatches.length)} of {formatNumber(filteredBatches.length)} batches
          </div>
          
          <div className="hpp-actual-table-wrapper">
            <table className="hpp-actual-table">
              <thead>
                <tr>
                  <th>Product ID</th>
                  <th>Product Name</th>
                  <th>Batch No</th>
                  <th>Batch Date</th>
                  <th>Category</th>
                  <th>Output</th>
                  <th>Total BB</th>
                  <th>Total BK</th>
                  <th>MH Proses</th>
                  <th>MH Kemas</th>
                  <th>Total HPP Batch</th>
                  <th>HPP/Unit</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {paginatedBatches.map((batch, idx) => (
                  <tr key={batch.HPP_Actual_ID || idx}>
                    <td>{batch.Product_ID}</td>
                    <td className="product-name">{batch.Product_Name}</td>
                    <td className="batch-no">{batch.BatchNo}</td>
                    <td>{formatDate(batch.BatchDate)}</td>
                    <td>
                      <span className="category-badge">{batch.Group_PNCategory_Name}</span>
                    </td>
                    <td className="number">{formatNumber(batch.Output_Actual)}</td>
                    <td className="number">{formatCurrency(batch.Total_Cost_BB)}</td>
                    <td className="number">{formatCurrency(batch.Total_Cost_BK)}</td>
                    <td className="number">
                      {batch.MH_Proses_Actual !== null ? (
                        <span className="actual-value">{formatNumber(batch.MH_Proses_Actual, 2)}</span>
                      ) : (
                        <span className="std-value">{formatNumber(batch.MH_Proses_Std, 2)}</span>
                      )}
                    </td>
                    <td className="number">
                      {batch.MH_Kemas_Actual !== null ? (
                        <span className="actual-value">{formatNumber(batch.MH_Kemas_Actual, 2)}</span>
                      ) : (
                        <span className="std-value">{formatNumber(batch.MH_Kemas_Std, 2)}</span>
                      )}
                    </td>
                    <td className="number hpp-value">{formatCurrency(batch.Total_HPP_Batch)}</td>
                    <td className="number hpp-unit">{formatCurrency(batch.HPP_Per_Unit)}</td>
                    <td>
                      <button 
                        className="hpp-actual-view-btn"
                        onClick={() => handleViewDetail(batch)}
                        title="View Detail"
                      >
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            totalItems={filteredBatches.length}
          />
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && selectedPeriod && batches.length === 0 && (
        <div className="hpp-actual-empty">
          <FileText size={48} />
          <h3>No Data Found</h3>
          <p>No HPP Actual data available for period {formatPeriod(selectedPeriod)}</p>
        </div>
      )}

      {/* No Period Selected */}
      {!loading && !selectedPeriod && periods.length === 0 && (
        <div className="hpp-actual-empty">
          <Calendar size={48} />
          <h3>No Periods Available</h3>
          <p>No HPP Actual calculation has been performed yet.</p>
        </div>
      )}

      {/* Detail Modal */}
      <DetailModal
        isOpen={detailModal.isOpen}
        onClose={handleCloseDetail}
        batch={detailModal.batch}
        materials={detailModal.materials}
        isLoading={detailModal.isLoading}
      />
    </div>
  );
};

export default HPPActualList;
