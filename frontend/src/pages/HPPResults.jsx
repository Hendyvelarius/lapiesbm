import React, { useState, useEffect, useMemo } from 'react';
import { Download, FileText, Loader2, ChevronLeft, ChevronRight, Search, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router';
import * as XLSX from 'xlsx';
import { hppAPI, masterAPI } from '../services/api';
import ProductHPPReport from '../components/ProductHPPReport';
import '../styles/HPPResults.css';

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

// Format HPP ratio as percentage (e.g., 0.296500 -> 29.65%)
const formatHPPRatio = (ratio) => {
  if (!ratio || isNaN(ratio)) return '0,00%';
  const percentage = (parseFloat(ratio) * 100).toFixed(2);
  return `${percentage.replace('.', ',')}%`;
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
    } else {
      rangeWithDots.push(totalPages);
    }

    return rangeWithDots;
  };

  if (totalPages <= 1) return null;

  return (
    <div className="hpp-pagination">
      <div className="hpp-pagination-info">
        Showing page {currentPage} of {totalPages} ({totalItems} total items)
      </div>
      <div className="hpp-pagination-controls">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="hpp-pagination-btn"
        >
          <ChevronLeft size={16} />
        </button>
        
        {getVisiblePages().map((page, index) => (
          <button
            key={index}
            onClick={() => typeof page === 'number' ? onPageChange(page) : null}
            disabled={page === '...'}
            className={`hpp-pagination-btn ${currentPage === page ? 'active' : ''} ${page === '...' ? 'dots' : ''}`}
          >
            {page}
          </button>
        ))}
        
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="hpp-pagination-btn"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};

// Table components moved outside to prevent re-creation on each render
const EthicalTable = ({ data, filteredCount, totalCount, searchTerm, onSearchChange, pagination, onPageChange, totalPages, onProductClick }) => (
  <div className="hpp-table-container">
    <div className="hpp-table-header">
      <h3><FileText className="hpp-table-icon" />Ethical / OTC Products</h3>
      <div className="hpp-table-controls">
        <div className="hpp-search-container">
          <Search size={16} className="hpp-search-icon" />
          <input
            type="text"
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="hpp-search-input"
          />
        </div>
        <span className="hpp-record-count">
          {filteredCount} of {totalCount} products
        </span>
      </div>
    </div>
    <div className="hpp-table-wrapper">
      <table className="hpp-table">
        <thead>
          <tr>
            <th>Product ID</th>
            <th>Product Name</th>
            <th>Total BB</th>
            <th>Total BK</th>
            <th>MH Proses Std</th>
            <th>MH Kemas Std</th>
            <th>Biaya Proses</th>
            <th>Biaya Kemas</th>
            <th>Expiry Cost</th>
            <th>Group Rendemen</th>
            <th>Batch Size</th>
            <th>HPP</th>
            <th>HNA</th>
            <th>HPP/HNA</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item, index) => (
            <tr key={`${item.Product_ID}-${index}`}>
              <td>{item.Product_ID}</td>
              <td className="product-name clickable" onClick={() => onProductClick(item)}>{item.Product_Name}</td>
              <td>{formatCurrency(item.totalBB)}</td>
              <td>{formatCurrency(item.totalBK)}</td>
              <td>{formatNumber(item.MH_Proses_Std)}</td>
              <td>{formatNumber(item.MH_Kemas_Std)}</td>
              <td>{formatCurrency(item.Biaya_Proses)}</td>
              <td>{formatCurrency(item.Biaya_Kemas)}</td>
              <td>{formatCurrency(item.Beban_Sisa_Bahan_Exp)}</td>
              <td>{formatNumber(item.Group_Rendemen)}%</td>
              <td>{formatNumber(item.Batch_Size)}</td>
              <td className="hpp-value">{formatCurrency(item.HPP)}</td>
              <td>{formatCurrency(item.Product_SalesHNA)}</td>
              <td>{formatHPPRatio(item.HPP_Ratio)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    <Pagination
      currentPage={pagination.currentPage}
      totalPages={totalPages}
      onPageChange={onPageChange}
      totalItems={filteredCount}
    />
  </div>
);

const Generik1Table = ({ data, filteredCount, totalCount, searchTerm, onSearchChange, pagination, onPageChange, totalPages, onProductClick }) => (
  <div className="hpp-table-container">
    <div className="hpp-table-header">
      <h3><FileText className="hpp-table-icon" />Generic Products (Type 1)</h3>
      <div className="hpp-table-controls">
        <div className="hpp-search-container">
          <Search size={16} className="hpp-search-icon" />
          <input
            type="text"
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="hpp-search-input"
          />
        </div>
        <span className="hpp-record-count">
          {filteredCount} of {totalCount} products
        </span>
      </div>
    </div>
    <div className="hpp-table-wrapper">
      <table className="hpp-table">
        <thead>
          <tr>
            <th>Product ID</th>
            <th>Product Name</th>
            <th>Total BB</th>
            <th>Total BK</th>
            <th>MH Proses Std</th>
            <th>MH Kemas Std</th>
            <th>MH Analisa Std</th>
            <th>MH Timbang BB</th>
            <th>MH Timbang BK</th>
            <th>Biaya Generik</th>
            <th>Biaya Analisa</th>
            <th>MH Mesin Std</th>
            <th>Rate PLN</th>
            <th>Expiry Cost</th>
            <th>Group Rendemen</th>
            <th>Batch Size</th>
            <th>HPP</th>
            <th>HNA</th>
            <th>HPP/HNA</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item, index) => (
            <tr key={`${item.Product_ID}-${index}`}>
              <td>{item.Product_ID}</td>
              <td className="product-name clickable" onClick={() => onProductClick(item)}>{item.Product_Name}</td>
              <td>{formatCurrency(item.totalBB)}</td>
              <td>{formatCurrency(item.totalBK)}</td>
              <td>{formatNumber(item.MH_Proses_Std)}</td>
              <td>{formatNumber(item.MH_Kemas_Std)}</td>
              <td>{formatNumber(item.MH_Analisa_Std)}</td>
              <td>{formatNumber(item.MH_Timbang_BB)}</td>
              <td>{formatNumber(item.MH_Timbang_BK)}</td>
              <td>{formatCurrency(item.Biaya_Generik)}</td>
              <td>{formatCurrency(item.Biaya_Analisa)}</td>
              <td>{formatNumber(item.MH_Mesin_Std)}</td>
              <td>{formatCurrency(item.Rate_PLN)}</td>
              <td>{formatCurrency(item.Beban_Sisa_Bahan_Exp)}</td>
              <td>{formatNumber(item.Group_Rendemen)}%</td>
              <td>{formatNumber(item.Batch_Size)}</td>
              <td className="hpp-value">{formatCurrency(item.HPP)}</td>
              <td>{formatCurrency(item.Product_SalesHNA)}</td>
              <td>{formatHPPRatio(item.HPP_Ratio)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    <Pagination
      currentPage={pagination.currentPage}
      totalPages={totalPages}
      onPageChange={onPageChange}
      totalItems={filteredCount}
    />
  </div>
);

const Generik2Table = ({ data, filteredCount, totalCount, searchTerm, onSearchChange, pagination, onPageChange, totalPages, onProductClick }) => (
  <div className="hpp-table-container">
    <div className="hpp-table-header">
      <h3><FileText className="hpp-table-icon" />Generic Products (Type 2)</h3>
      <div className="hpp-table-controls">
        <div className="hpp-search-container">
          <Search size={16} className="hpp-search-icon" />
          <input
            type="text"
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="hpp-search-input"
          />
        </div>
        <span className="hpp-record-count">
          {filteredCount} of {totalCount} products
        </span>
      </div>
    </div>
    <div className="hpp-table-wrapper">
      <table className="hpp-table">
        <thead>
          <tr>
            <th>Product ID</th>
            <th>Product Name</th>
            <th>Total BB</th>
            <th>Total BK</th>
            <th>MH Proses Std</th>
            <th>MH Kemas Std</th>
            <th>Direct Labor</th>
            <th>Factory Over Head 50</th>
            <th>Depresiasi</th>
            <th>Expiry Cost</th>
            <th>Group Rendemen</th>
            <th>Batch Size</th>
            <th>HPP</th>
            <th>HNA</th>
            <th>HPP/HNA</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item, index) => (
            <tr key={`${item.Product_ID}-${index}`}>
              <td>{item.Product_ID}</td>
              <td className="product-name clickable" onClick={() => onProductClick(item)}>{item.Product_Name}</td>
              <td>{formatCurrency(item.totalBB)}</td>
              <td>{formatCurrency(item.totalBK)}</td>
              <td>{formatNumber(item.MH_Proses_Std)}</td>
              <td>{formatNumber(item.MH_Kemas_Std)}</td>
              <td>{formatCurrency(item.Direct_Labor)}</td>
              <td>{formatCurrency(item.Factory_Over_Head_50)}</td>
              <td>{formatCurrency(item.Depresiasi)}</td>
              <td>{formatCurrency(item.Beban_Sisa_Bahan_Exp)}</td>
              <td>{formatNumber(item.Group_Rendemen)}%</td>
              <td>{formatNumber(item.Batch_Size)}</td>
              <td className="hpp-value">{formatCurrency(item.HPP)}</td>
              <td>{formatCurrency(item.Product_SalesHNA)}</td>
              <td>{formatHPPRatio(item.HPP_Ratio)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    <Pagination
      currentPage={pagination.currentPage}
      totalPages={totalPages}
      onPageChange={onPageChange}
      totalItems={filteredCount}
    />
  </div>
);

const HPPResults = () => {
  const navigate = useNavigate();
  const [hppData, setHppData] = useState({
    ethical: [],
    generik1: [],
    generik2: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('ethical');
  const [exporting, setExporting] = useState(false);
  
  // Product HPP Report modal state
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showProductReport, setShowProductReport] = useState(false);
  
  // Pagination state for each table
  const [pagination, setPagination] = useState({
    ethical: { currentPage: 1, itemsPerPage: 50 },
    generik1: { currentPage: 1, itemsPerPage: 50 },
    generik2: { currentPage: 1, itemsPerPage: 50 }
  });

  // Search state for each table
  const [searchTerms, setSearchTerms] = useState({
    ethical: '',
    generik1: '',
    generik2: ''
  });

  useEffect(() => {
    fetchHPPResults();
  }, []);

  const fetchHPPResults = async () => {
    try {
      setLoading(true);
      const response = await hppAPI.getResults();
      setHppData(response);
    } catch (error) {
      console.error('Error fetching HPP results:', error);
      setError('Failed to load HPP results');
    } finally {
      setLoading(false);
    }
  };

  // Handle opening product report
  const handleProductClick = (product) => {
    setSelectedProduct(product);
    setShowProductReport(true);
  };

  // Handle closing product report
  const handleCloseProductReport = () => {
    setShowProductReport(false);
    setSelectedProduct(null);
  };

  // Filter data based on search terms
  const getFilteredData = (data, searchTerm) => {
    if (!searchTerm.trim()) return data;
    return data.filter(item => 
      (item.Product_ID && item.Product_ID.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.Product_Name && item.Product_Name.toLowerCase().includes(searchTerm.toLowerCase()))
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
    // Reset to first page when searching
    setPagination(prev => ({
      ...prev,
      [tableType]: { ...prev[tableType], currentPage: 1 }
    }));
  };

  // Memoize filtered and paginated data to prevent unnecessary recalculations
  const processedData = useMemo(() => {
    const ethical = getFilteredData(hppData.ethical, searchTerms.ethical);
    const generik1 = getFilteredData(hppData.generik1, searchTerms.generik1);
    const generik2 = getFilteredData(hppData.generik2, searchTerms.generik2);

    return {
      ethical: {
        filtered: ethical,
        paginated: getPaginatedData(ethical, pagination.ethical.currentPage, pagination.ethical.itemsPerPage),
        totalPages: Math.ceil(ethical.length / pagination.ethical.itemsPerPage)
      },
      generik1: {
        filtered: generik1,
        paginated: getPaginatedData(generik1, pagination.generik1.currentPage, pagination.generik1.itemsPerPage),
        totalPages: Math.ceil(generik1.length / pagination.generik1.itemsPerPage)
      },
      generik2: {
        filtered: generik2,
        paginated: getPaginatedData(generik2, pagination.generik2.currentPage, pagination.generik2.itemsPerPage),
        totalPages: Math.ceil(generik2.length / pagination.generik2.itemsPerPage)
      }
    };
  }, [hppData, searchTerms, pagination]);

  // Tab configuration
  const tabs = [
    {
      id: 'ethical',
      label: 'Ethical / OTC',
      icon: FileText,
      count: hppData.ethical.length
    },
    {
      id: 'generik1',
      label: 'Generic Type 1',
      icon: FileText,
      count: hppData.generik1.length
    },
    {
      id: 'generik2',
      label: 'Generic Type 2',
      icon: FileText,
      count: hppData.generik2.length
    }
  ];

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
  };

  // Navigate to Generate HPP page for data refresh
  const handleRefreshData = () => {
    navigate('/generate-hpp');
  };

  // Export all three tables to Excel with separate sheets
  const handleExportToExcel = async () => {
    try {
      setExporting(true);
      
      // Create a new workbook
      const workbook = XLSX.utils.book_new();
      
      // Define columns for each table type
      const ethicalColumns = [
        'Product_ID', 'Product_Name', 'totalBB', 'totalBK', 'MH_Proses_Std', 
        'MH_Kemas_Std', 'Biaya_Proses', 'Biaya_Kemas', 'Beban_Sisa_Bahan_Exp',
        'Group_Rendemen', 'Batch_Size', 'HPP', 'Product_SalesHNA', 'HPP_Ratio'
      ];
      
      const generik1Columns = [
        'Product_ID', 'Product_Name', 'totalBB', 'totalBK', 'MH_Proses_Std',
        'MH_Kemas_Std', 'MH_Analisa_Std', 'MH_Timbang_BB', 'MH_Timbang_BK',
        'Biaya_Generik', 'Biaya_Analisa', 'MH_Mesin_Std', 'Rate_PLN',
        'Beban_Sisa_Bahan_Exp', 'Group_Rendemen', 'Batch_Size', 'HPP', 'Product_SalesHNA', 'HPP_Ratio'
      ];
      
      const generik2Columns = [
        'Product_ID', 'Product_Name', 'totalBB', 'totalBK', 'MH_Proses_Std',
        'MH_Kemas_Std', 'Direct_Labor',
        'Factory_Over_Head_50', 'Depresiasi', 'Beban_Sisa_Bahan_Exp', 'Group_Rendemen', 
        'Batch_Size', 'HPP', 'Product_SalesHNA', 'HPP_Ratio'
      ];

      const materialUsageColumns = [
        'product_id', 'item_type', 'PPI_ItemID', 'Item_Name', 'PPI_QTY',
        'PPI_UnitID', 'Item_unit', 'total'
      ];

      // Create worksheets for each table
      if (hppData.ethical && hppData.ethical.length > 0) {
        const ethicalWS = XLSX.utils.json_to_sheet(hppData.ethical, { 
          header: ethicalColumns 
        });
        XLSX.utils.book_append_sheet(workbook, ethicalWS, 'Ethical OTC');
      }
      
      if (hppData.generik1 && hppData.generik1.length > 0) {
        const generik1WS = XLSX.utils.json_to_sheet(hppData.generik1, { 
          header: generik1Columns 
        });
        XLSX.utils.book_append_sheet(workbook, generik1WS, 'Generic Type 1');
      }
      
      if (hppData.generik2 && hppData.generik2.length > 0) {
        const generik2WS = XLSX.utils.json_to_sheet(hppData.generik2, { 
          header: generik2Columns 
        });
        XLSX.utils.book_append_sheet(workbook, generik2WS, 'Generic Type 2');
      }

      // Fetch and add Material Raw Data sheet
      try {
        const materialUsageResponse = await masterAPI.getMaterialUsage();
        if (materialUsageResponse && materialUsageResponse.length > 0) {
          const materialUsageWS = XLSX.utils.json_to_sheet(materialUsageResponse, { 
            header: materialUsageColumns 
          });
          XLSX.utils.book_append_sheet(workbook, materialUsageWS, 'Material Raw Data');
        }
      } catch (materialError) {
        console.warn('Failed to fetch material usage data for export:', materialError);
        // Continue with export without material data
      }
      
      // Generate filename with current date
      const currentDate = new Date().toISOString().split('T')[0];
      const filename = `HPP_Results_${currentDate}.xlsx`;
      
      // Save the file
      XLSX.writeFile(workbook, filename);
      
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      alert('Failed to export data to Excel. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const renderActiveTable = () => {
    const currentData = processedData[activeTab];
    const currentSearchTerm = searchTerms[activeTab];
    const currentPagination = pagination[activeTab];
    
    const tableProps = {
      data: currentData.paginated,
      filteredCount: currentData.filtered.length,
      totalCount: hppData[activeTab].length,
      searchTerm: currentSearchTerm,
      onSearchChange: (term) => handleSearchChange(activeTab, term),
      pagination: currentPagination,
      onPageChange: (page) => handlePageChange(activeTab, page),
      totalPages: currentData.totalPages,
      onProductClick: handleProductClick
    };

    switch (activeTab) {
      case 'ethical':
        return <EthicalTable {...tableProps} />;
      case 'generik1':
        return <Generik1Table {...tableProps} />;
      case 'generik2':
        return <Generik2Table {...tableProps} />;
      default:
        return <EthicalTable {...tableProps} />;
    }
  };

  if (loading) {
    return (
      <div className="hpp-results-page">
        <div className="hpp-loading">
          <Loader2 className="hpp-loading-spinner" />
          <p>Loading HPP results...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="hpp-results-page">
        <div className="hpp-error">
          <p>{error}</p>
          <button onClick={fetchHPPResults} className="hpp-retry-btn">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="hpp-results-page">
      <div className="hpp-results-header">
        <h1>HPP Calculation Results</h1>
        <div className="hpp-header-actions">
          <button 
            className="hpp-export-btn"
            onClick={handleExportToExcel}
            disabled={exporting || loading}
          >
            {exporting ? (
              <>
                <Loader2 className="hpp-export-spinner" size={16} />
                Exporting...
              </>
            ) : (
              <>
                <Download size={16} />
                Export to Excel
              </>
            )}
          </button>
          <button 
            onClick={handleRefreshData} 
            className="hpp-refresh-btn"
            disabled={loading}
          >
            <RefreshCw size={16} />
            Generate New HPP
          </button>
        </div>
      </div>

      <div className="hpp-results-content">
        {/* Tab Navigation */}
        <div className="hpp-tabs-container">
          <div className="hpp-tabs-header">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`hpp-tab ${activeTab === tab.id ? 'active' : ''}`}
                >
                  <Icon size={18} />
                  <span className="hpp-tab-label">{tab.label}</span>
                  <span className="hpp-tab-count">{tab.count}</span>
                </button>
              );
            })}
          </div>
          
          {/* Active Table Content */}
          <div className="hpp-tab-content">
            {renderActiveTable()}
          </div>
        </div>
      </div>

      {/* Product HPP Report Modal */}
      <ProductHPPReport
        product={selectedProduct}
        isOpen={showProductReport}
        onClose={handleCloseProductReport}
      />
    </div>
  );
};

export default HPPResults;
