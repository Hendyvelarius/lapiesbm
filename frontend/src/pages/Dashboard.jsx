import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { 
  Package, 
  PieChart, 
  TrendingUp, 
  AlertTriangle, 
  ChevronDown, 
  X,
  RefreshCw,
  BarChart3,
  DollarSign,
  Loader2,
  Calendar,
  Grid3X3
} from 'lucide-react';
import { dashboardAPI } from '../services/api';
import '../styles/Dashboard.css';

// Utility functions
const formatCurrency = (value) => {
  if (value === null || value === undefined || isNaN(value)) return 'Rp 0';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
};

// Format large currency values in abbreviated form (Miliar/Juta)
const formatCurrencyAbbrev = (value) => {
  if (value === null || value === undefined || isNaN(value)) return 'Rp 0';
  const num = parseFloat(value);
  if (num >= 1000000000) {
    return `Rp ${(num / 1000000000).toFixed(2)} M`;
  } else if (num >= 1000000) {
    return `Rp ${(num / 1000000).toFixed(2)} Jt`;
  }
  return formatCurrency(value);
};

const formatNumber = (value) => {
  if (value === null || value === undefined || isNaN(value)) return '0';
  return new Intl.NumberFormat('id-ID').format(value);
};

const formatPercent = (value) => {
  if (value === null || value === undefined || isNaN(value)) return '0%';
  return `${parseFloat(value).toFixed(1)}%`;
};

// Stacked Horizontal Bar Component for HPP Distribution
const StackedBar = ({ label, bb, bk, others, onClick }) => {
  const total = bb + bk + others;
  const bbPercent = total > 0 ? (bb / total) * 100 : 0;
  const bkPercent = total > 0 ? (bk / total) * 100 : 0;
  const othersPercent = total > 0 ? (others / total) * 100 : 0;
  
  const hasData = total > 0;
  
  return (
    <div className={`stacked-bar-row ${onClick ? 'clickable' : ''}`} onClick={onClick}>
      <span className="stacked-bar-label">{label}</span>
      <div className="stacked-bar-container">
        {hasData ? (
          <>
            <div 
              className="stacked-bar-segment bb" 
              style={{ width: `${bbPercent}%` }}
              title={`BB: ${bbPercent.toFixed(1)}%`}
            >
              {bbPercent >= 10 && <span>{bbPercent.toFixed(0)}%</span>}
            </div>
            <div 
              className="stacked-bar-segment bk" 
              style={{ width: `${bkPercent}%` }}
              title={`BK: ${bkPercent.toFixed(1)}%`}
            >
              {bkPercent >= 10 && <span>{bkPercent.toFixed(0)}%</span>}
            </div>
            <div 
              className="stacked-bar-segment others" 
              style={{ width: `${othersPercent}%` }}
              title={`Others: ${othersPercent.toFixed(1)}%`}
            >
              {othersPercent >= 10 && <span>{othersPercent.toFixed(0)}%</span>}
            </div>
          </>
        ) : (
          <div className="stacked-bar-empty">No data</div>
        )}
      </div>
    </div>
  );
};

// Heat Map Cell Component
const HeatMapCell = ({ total, highCOGS, onClick }) => {
  if (total === 0) {
    return (
      <td className="heat-map-cell empty" onClick={onClick}>
        <span className="heat-cell-value">-</span>
      </td>
    );
  }
  
  const percent = (highCOGS / total) * 100;
  const riskLevel = percent >= 50 ? 'high' : percent >= 10 ? 'medium' : 'low';
  
  return (
    <td className={`heat-map-cell ${riskLevel}`} onClick={onClick}>
      <span className="heat-cell-value">{highCOGS}/{total}</span>
      <span className="heat-cell-percent">({percent.toFixed(0)}%)</span>
    </td>
  );
};

// Simple Pie Chart Component (SVG-based)
const PieChart2D = ({ data, colors, size = 200, showLegend = true }) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  
  // Check if we have any data at all (even if some categories are 0)
  const hasAnyData = data.some(item => item.value > 0);
  if (!hasAnyData) {
    return (
      <div className="pie-chart-empty">
        <span>No data available</span>
      </div>
    );
  }

  let cumulativePercent = 0;
  const slices = data.map((item, index) => {
    const percent = (item.value / total) * 100;
    const startAngle = cumulativePercent * 3.6;
    cumulativePercent += percent;
    const endAngle = cumulativePercent * 3.6;
    
    // Calculate SVG arc path
    const startX = 50 + 40 * Math.cos((startAngle - 90) * Math.PI / 180);
    const startY = 50 + 40 * Math.sin((startAngle - 90) * Math.PI / 180);
    const endX = 50 + 40 * Math.cos((endAngle - 90) * Math.PI / 180);
    const endY = 50 + 40 * Math.sin((endAngle - 90) * Math.PI / 180);
    const largeArcFlag = percent > 50 ? 1 : 0;
    
    const pathD = percent >= 100 
      ? `M 50 10 A 40 40 0 1 1 49.99 10 Z`
      : `M 50 50 L ${startX} ${startY} A 40 40 0 ${largeArcFlag} 1 ${endX} ${endY} Z`;

    return (
      <path
        key={index}
        d={pathD}
        fill={colors[index % colors.length]}
        className="pie-slice"
      />
    );
  });

  return (
    <div className="pie-chart-container">
      <svg viewBox="0 0 100 100" width={size} height={size} className="pie-chart-svg">
        {slices}
      </svg>
      {showLegend && (
        <div className="pie-legend">
          {data.map((item, index) => (
            <div key={index} className="legend-item">
              <span 
                className="legend-color" 
                style={{ backgroundColor: colors[index % colors.length] }}
              />
              <span className="legend-label">{item.label}</span>
              <span className="legend-value">{formatPercent(item.value / total * 100)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Donut Chart Component
const DonutChart = ({ value, total, color = '#3b82f6', size = 120, label }) => {
  const percent = total > 0 ? (value / total) * 100 : 0;
  const circumference = 2 * Math.PI * 40;
  const strokeDashoffset = circumference - (percent / 100) * circumference;

  return (
    <div className="donut-chart-container">
      <svg viewBox="0 0 100 100" width={size} height={size}>
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="12"
        />
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
          className="donut-progress"
        />
        <text x="50" y="50" textAnchor="middle" dy="0.35em" className="donut-text">
          {formatPercent(percent)}
        </text>
      </svg>
      {label && <span className="donut-label">{label}</span>}
    </div>
  );
};

// Product List Modal - supports multiple display modes
const ProductListModal = ({ isOpen, onClose, products, title, displayMode = 'cogs' }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState(displayMode === 'hpp-breakdown' ? 'bb' : 'cogs');
  const [sortOrder, setSortOrder] = useState('desc');

  const filteredProducts = useMemo(() => {
    let filtered = products.filter(p => 
      p.Product_Name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.Product_ID?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    filtered.sort((a, b) => {
      let aVal, bVal;
      switch (sortBy) {
        case 'name':
          aVal = a.Product_Name || '';
          bVal = b.Product_Name || '';
          return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        case 'hpp':
          aVal = a.HPP || 0;
          bVal = b.HPP || 0;
          break;
        case 'hna':
          aVal = a.HNA || 0;
          bVal = b.HNA || 0;
          break;
        case 'bb':
          aVal = parseFloat(a.totalBB) || 0;
          bVal = parseFloat(b.totalBB) || 0;
          break;
        case 'bk':
          aVal = parseFloat(a.totalBK) || 0;
          bVal = parseFloat(b.totalBK) || 0;
          break;
        case 'others':
          aVal = parseFloat(a.totalOthers) || 0;
          bVal = parseFloat(b.totalOthers) || 0;
          break;
        case 'cogs':
        default:
          aVal = parseFloat(a.COGS) || 0;
          bVal = parseFloat(b.COGS) || 0;
      }
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
    });

    return filtered;
  }, [products, searchTerm, sortBy, sortOrder]);

  if (!isOpen) return null;

  const sortOptions = displayMode === 'hpp-breakdown' 
    ? [
        { value: 'bb', label: 'Sort by BB' },
        { value: 'bk', label: 'Sort by BK' },
        { value: 'others', label: 'Sort by Others' },
        { value: 'cogs', label: 'Sort by COGS %' },
        { value: 'name', label: 'Sort by Name' },
      ]
    : [
        { value: 'cogs', label: 'Sort by COGS %' },
        { value: 'name', label: 'Sort by Name' },
        { value: 'hpp', label: 'Sort by HPP' },
        { value: 'hna', label: 'Sort by HNA' },
      ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content product-list-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="modal-controls">
          <input
            type="text"
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="modal-search"
          />
          <div className="sort-controls">
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              {sortOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <button 
              className="sort-order-btn"
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </button>
          </div>
        </div>
        <div className="modal-body">
          <table className="product-table">
            <thead>
              <tr>
                <th>Product ID</th>
                <th>Product Name</th>
                <th>LOB</th>
                <th>Category</th>
                <th>HNA</th>
                {displayMode === 'hpp-breakdown' ? (
                  <>
                    <th>BB (Rp)</th>
                    <th>BK (Rp)</th>
                    <th>Others (Rp)</th>
                  </>
                ) : (
                  <th>HPP</th>
                )}
                <th>COGS %</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((product, index) => (
                <tr key={`${product.Product_ID}-${index}`}>
                  <td>{product.Product_ID}</td>
                  <td>{product.Product_Name}</td>
                  <td>
                    <span className={`category-badge ${product.category?.toLowerCase()}`}>
                      {product.category}
                    </span>
                  </td>
                  <td>
                    <span className={`toll-badge ${product.tollCategory?.toLowerCase().replace(' ', '-')}`}>
                      {product.tollCategory || '-'}
                    </span>
                  </td>
                  <td>{formatCurrency(product.HNA)}</td>
                  {displayMode === 'hpp-breakdown' ? (
                    <>
                      <td>
                        <span className="breakdown-value bb">{formatCurrency(product.totalBB)}</span>
                      </td>
                      <td>
                        <span className="breakdown-value bk">{formatCurrency(product.totalBK)}</span>
                      </td>
                      <td>
                        <span className="breakdown-value others">{formatCurrency(product.totalOthers)}</span>
                      </td>
                    </>
                  ) : (
                    <td>{formatCurrency(product.HPP)}</td>
                  )}
                  <td>
                    <span className={`cogs-value ${parseFloat(product.COGS) >= 30 ? 'high' : 'low'}`}>
                      {formatPercent(product.COGS)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredProducts.length === 0 && (
            <div className="no-results">No products found</div>
          )}
        </div>
        <div className="modal-footer">
          <span className="product-count">{filteredProducts.length} products</span>
        </div>
      </div>
    </div>
  );
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [selectedYear, setSelectedYear] = useState(null);
  const [availableYears, setAvailableYears] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [categoryMode, setCategoryMode] = useState('lob'); // 'lob' or 'toll'
  const [showProductModal, setShowProductModal] = useState(false);
  const [showHPPBreakdownModal, setShowHPPBreakdownModal] = useState(false);
  const [hppBreakdownFilter, setHppBreakdownFilter] = useState('ALL');
  const [hppBreakdownMode, setHppBreakdownMode] = useState('lob'); // 'lob' or 'toll'
  const [hppBreakdownCogsFilter, setHppBreakdownCogsFilter] = useState('all'); // 'all', 'high', 'low'
  const [showJumlahProdukModal, setShowJumlahProdukModal] = useState(false);
  const [jumlahProdukFilter, setJumlahProdukFilter] = useState('ALL');
  const [jumlahProdukMode, setJumlahProdukMode] = useState('lob'); // 'lob' or 'toll'
  const [showHeatMapModal, setShowHeatMapModal] = useState(false);
  const [heatMapFilter, setHeatMapFilter] = useState({ lob: null, category: null });
  const [refreshing, setRefreshing] = useState(false);
  const [showYearDropdown, setShowYearDropdown] = useState(false);

  // Fetch available years and dashboard data
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setLoading(true);
        
        // Get available years first
        const yearsResponse = await dashboardAPI.getYears();
        if (yearsResponse.success) {
          setAvailableYears(yearsResponse.data.years);
          setSelectedYear(yearsResponse.data.latestYear);
        }
        
        // Get dashboard stats
        const statsResponse = await dashboardAPI.getStats();
        if (statsResponse.success) {
          setDashboardData(statsResponse.data);
        }
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err);
        setError('Failed to load dashboard data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, []);

  // Fetch dashboard data when year changes
  const handleYearChange = async (year) => {
    try {
      setRefreshing(true);
      setSelectedYear(year);
      const response = await dashboardAPI.getStats(year);
      if (response.success) {
        setDashboardData(response.data);
      }
    } catch (err) {
      console.error('Failed to fetch dashboard data for year:', err);
    } finally {
      setRefreshing(false);
    }
  };

  // Refresh data
  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      const response = await dashboardAPI.getStats(selectedYear);
      if (response.success) {
        setDashboardData(response.data);
      }
    } catch (err) {
      console.error('Failed to refresh dashboard data:', err);
    } finally {
      setRefreshing(false);
    }
  };

  // Get cost distribution based on selected category
  const getCurrentCostDistribution = () => {
    if (!dashboardData) return { bb: 0, bk: 0, others: 0 };
    
    // Map category to key based on mode
    let key;
    if (selectedCategory === 'ALL') {
      key = 'all';
    } else if (categoryMode === 'toll') {
      // Map toll categories (Toll In excluded)
      const tollKeyMap = {
        'TOLL_OUT': 'tollOut',
        'IMPORT': 'import',
        'INHOUSE': 'inhouse'
      };
      key = tollKeyMap[selectedCategory] || 'all';
    } else {
      key = selectedCategory.toLowerCase();
    }
    
    return dashboardData.costDistribution[key] || dashboardData.costDistribution.all;
  };

  // Get HPP stats based on selected category
  const getCurrentHPPStats = () => {
    if (!dashboardData) return { count: 0, highCOGS: 0, lowCOGS: 0 };
    
    // Map category to key based on mode
    let key;
    if (selectedCategory === 'ALL') {
      key = 'all';
    } else if (categoryMode === 'toll') {
      // Map toll categories (Toll In excluded)
      const tollKeyMap = {
        'TOLL_OUT': 'tollOut',
        'IMPORT': 'import',
        'INHOUSE': 'inhouse'
      };
      key = tollKeyMap[selectedCategory] || 'all';
    } else {
      key = selectedCategory.toLowerCase();
    }
    
    return dashboardData.hppStats[key] || dashboardData.hppStats.all;
  };

  // Get filtered products for Jumlah Produk modal
  const getFilteredProductsForJumlahProduk = () => {
    if (!dashboardData?.products) return [];
    if (jumlahProdukFilter === 'ALL') return dashboardData.products;
    
    if (jumlahProdukMode === 'toll') {
      // Map toll filter to actual category values (Toll In excluded)
      const tollCategoryMap = {
        'TOLL_OUT': 'Toll Out',
        'IMPORT': 'Import',
        'INHOUSE': 'Inhouse'
      };
      return dashboardData.products.filter(p => p.tollCategory === tollCategoryMap[jumlahProdukFilter]);
    }
    
    return dashboardData.products.filter(p => p.category?.toUpperCase() === jumlahProdukFilter);
  };

  // Get filtered products for HPP breakdown modal
  const getFilteredProductsForHPPBreakdown = () => {
    if (!dashboardData?.products) return [];
    
    let filtered = dashboardData.products;
    
    // First filter by category/lob
    if (hppBreakdownFilter !== 'ALL') {
      if (hppBreakdownMode === 'toll') {
        // Map toll filter to actual category values (Toll In excluded)
        const tollCategoryMap = {
          'TOLL_OUT': 'Toll Out',
          'IMPORT': 'Import',
          'INHOUSE': 'Inhouse'
        };
        filtered = filtered.filter(p => p.tollCategory === tollCategoryMap[hppBreakdownFilter]);
      } else {
        filtered = filtered.filter(p => p.category?.toUpperCase() === hppBreakdownFilter);
      }
    }
    
    // Then filter by COGS level
    if (hppBreakdownCogsFilter === 'high') {
      filtered = filtered.filter(p => parseFloat(p.COGS) >= 30);
    } else if (hppBreakdownCogsFilter === 'low') {
      filtered = filtered.filter(p => parseFloat(p.COGS) < 30);
    }
    
    return filtered;
  };

  // Get filtered products for Heat Map modal (LOB x Category)
  const getFilteredProductsForHeatMap = () => {
    if (!dashboardData?.products) return [];
    const { lob, category } = heatMapFilter;
    if (!lob || !category) return [];
    
    return dashboardData.products.filter(p => 
      p.category?.toUpperCase() === lob.toUpperCase() && 
      p.tollCategory === category
    );
  };

  // Handle HPP Distribution bar click
  const handleHPPDistributionClick = (filter, mode = 'lob') => {
    setHppBreakdownFilter(filter);
    setHppBreakdownMode(mode);
    setHppBreakdownCogsFilter('all'); // Reset COGS filter when clicking HPP Distribution
    setShowHPPBreakdownModal(true);
  };

  // Handle HPP Info click - uses current selectedCategory and categoryMode
  const handleHPPInfoClick = (cogsFilter = 'all') => {
    setHppBreakdownFilter(selectedCategory);
    setHppBreakdownMode(categoryMode);
    setHppBreakdownCogsFilter(cogsFilter);
    setShowHPPBreakdownModal(true);
  };

  // Handle Heat Map cell click
  const handleHeatMapClick = (lob, category) => {
    setHeatMapFilter({ lob, category });
    setShowHeatMapModal(true);
  };

  // Handle Jumlah Produk click
  const handleJumlahProdukClick = (filter, mode = 'lob') => {
    setJumlahProdukFilter(filter);
    setJumlahProdukMode(mode);
    setShowJumlahProdukModal(true);
  };

  if (loading) {
    return (
      <div className="dashboard-loading-screen">
        <div className="loading-content">
          <div className="loading-logo">
            <BarChart3 size={56} className="loading-icon" />
          </div>
          <div className="loading-spinner-ring">
            <div className="spinner-ring"></div>
          </div>
          <div className="loading-text">
            <h2>Loading Dashboard</h2>
            <p>Preparing your HPP analytics...</p>
          </div>
          <div className="loading-progress">
            <div className="progress-bar">
              <div className="progress-fill"></div>
            </div>
          </div>
          <p className="loading-hint">Please wait while we fetch your data</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-error">
        <AlertTriangle size={48} />
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  const costDistribution = getCurrentCostDistribution(); // Keep for potential future use
  const hppStats = getCurrentHPPStats();

  return (
    <div className="dashboard-container">
      {/* Header */}
      <div className="dashboard-header">
        <div className="header-left">
          <h1>Dashboard HPP</h1>
        </div>
        <div className="header-right">
          <div className="periode-selector-wrapper">
            <div className="periode-selector" onClick={() => setShowYearDropdown(!showYearDropdown)}>
              <Calendar size={18} />
              <span className="periode-text">Periode {dashboardData?.periode}</span>
              <ChevronDown size={16} className={`dropdown-arrow ${showYearDropdown ? 'open' : ''}`} />
              {showYearDropdown && (
                <div className="year-dropdown" onClick={(e) => e.stopPropagation()}>
                  {availableYears.map(year => (
                    <div 
                      key={year} 
                      className={`year-option ${selectedYear === year ? 'active' : ''}`}
                      onClick={() => {
                        handleYearChange(year);
                        setShowYearDropdown(false);
                      }}
                    >
                      {year}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button 
              className="refresh-btn-integrated" 
              onClick={(e) => { e.stopPropagation(); handleRefresh(); }}
              disabled={refreshing}
              title="Refresh data"
            >
              <RefreshCw size={16} className={refreshing ? 'spinning' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="dashboard-grid">
        {/* Product Count Card */}
        <div className="dashboard-card product-count-card">
          <div className="card-header">
            <Package size={24} />
            <h3>Jumlah Produk</h3>
          </div>
          <div className="card-body">
            <div className="main-stat clickable" onClick={() => handleJumlahProdukClick('ALL')}>
              <span className="stat-number">{formatNumber(dashboardData?.productCounts?.total)}</span>
              <span className="stat-label">Total Produk</span>
            </div>
            {/* LOB Categories Row */}
            <div className="stat-breakdown-section">
              <span className="breakdown-section-label">By LOB</span>
              <div className="stat-breakdown">
                <div className="breakdown-item ethical clickable" onClick={() => handleJumlahProdukClick('ETHICAL', 'lob')}>
                  <span className="breakdown-label">Ethical</span>
                  <span className="breakdown-value">{formatNumber(dashboardData?.productCounts?.ethical)}</span>
                </div>
                <div className="breakdown-item otc clickable" onClick={() => handleJumlahProdukClick('OTC', 'lob')}>
                  <span className="breakdown-label">OTC</span>
                  <span className="breakdown-value">{formatNumber(dashboardData?.productCounts?.otc)}</span>
                </div>
                <div className="breakdown-item generik clickable" onClick={() => handleJumlahProdukClick('GENERIK', 'lob')}>
                  <span className="breakdown-label">Generik</span>
                  <span className="breakdown-value">{formatNumber(dashboardData?.productCounts?.generik)}</span>
                </div>
              </div>
            </div>
            {/* Category Row (Toll Out/Import/Inhouse - excluding Toll In) */}
            <div className="stat-breakdown-section">
              <span className="breakdown-section-label">By Category</span>
              <div className="stat-breakdown toll-breakdown">
                <div className="breakdown-item toll-out clickable" onClick={() => handleJumlahProdukClick('TOLL_OUT', 'toll')}>
                  <span className="breakdown-label">Toll Out</span>
                  <span className="breakdown-value">{formatNumber(dashboardData?.productCounts?.tollOut)}</span>
                </div>
                <div className="breakdown-item import clickable" onClick={() => handleJumlahProdukClick('IMPORT', 'toll')}>
                  <span className="breakdown-label">Import</span>
                  <span className="breakdown-value">{formatNumber(dashboardData?.productCounts?.import)}</span>
                </div>
                <div className="breakdown-item inhouse clickable" onClick={() => handleJumlahProdukClick('INHOUSE', 'toll')}>
                  <span className="breakdown-label">Inhouse</span>
                  <span className="breakdown-value">{formatNumber(dashboardData?.productCounts?.inhouse)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Cost Management Card */}
        <div className="dashboard-card cost-management-card clickable" onClick={() => setShowProductModal(true)}>
          <div className="card-header">
            <PieChart size={24} />
            <h3>Cost Management</h3>
            <span className="card-hint">Click for details</span>
          </div>
          <div className="card-body">
            <DonutChart 
              value={dashboardData?.costManagement?.totalHPP || 0}
              total={dashboardData?.costManagement?.totalHNA || 1}
              color="#ef4444"
              size={180}
              label="COGS Ratio"
            />
          </div>
        </div>

        {/* Pricing Risk Indicator Card - Redesigned */}
        <div className="dashboard-card pricing-risk-card">
          <div className="card-header">
            <TrendingUp size={24} />
            <h3>Pricing Risk Indicator</h3>
          </div>
          <div className="card-body">
            <p className="card-description">Average COGS % by Category</p>
            
            {/* LOB Categories - Gauge Style */}
            <div className="risk-section">
              <span className="risk-section-label">By LOB</span>
              <div className="risk-gauges">
                {[
                  { key: 'ethical', label: 'Ethical', color: '#3b82f6' },
                  { key: 'otc', label: 'OTC', color: '#10b981' },
                  { key: 'generik', label: 'Generik', color: '#f59e0b' }
                ].map(item => {
                  const value = parseFloat(dashboardData?.pricingRiskIndicator?.[item.key] || 0);
                  const riskLevel = value >= 40 ? 'high' : value >= 25 ? 'medium' : 'low';
                  return (
                    <div key={item.key} className={`risk-gauge-item ${riskLevel}`}>
                      <div className="risk-gauge-ring" style={{ '--progress': `${Math.min(100, value)}%`, '--color': item.color }}>
                        <div className="risk-gauge-inner">
                          <span className="risk-gauge-value">{value.toFixed(1)}%</span>
                        </div>
                      </div>
                      <span className="risk-gauge-label">{item.label}</span>
                      <span className={`risk-badge ${riskLevel}`}>
                        {riskLevel === 'high' ? '⚠️ High' : riskLevel === 'medium' ? '⚡ Medium' : '✅ Low'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            
            {/* Category Section (Toll Out/Import/Inhouse) - Compact Bars */}
            <div className="risk-section toll-section">
              <span className="risk-section-label">By Category</span>
              <div className="risk-compact-bars">
                {[
                  { key: 'tollOut', label: 'Toll Out', color: '#ec4899' },
                  { key: 'import', label: 'Import', color: '#0ea5e9' },
                  { key: 'inhouse', label: 'Inhouse', color: '#f43f5e' }
                ].map(item => {
                  const value = parseFloat(dashboardData?.pricingRiskIndicator?.[item.key] || 0);
                  const riskLevel = value >= 40 ? 'high' : value >= 25 ? 'medium' : 'low';
                  return (
                    <div key={item.key} className="risk-compact-item">
                      <div className="risk-compact-header">
                        <span className="risk-compact-label">{item.label}</span>
                        <span className={`risk-compact-value ${riskLevel}`}>{value.toFixed(1)}%</span>
                      </div>
                      <div className="risk-compact-bar-bg">
                        <div 
                          className="risk-compact-bar-fill"
                          style={{ width: `${Math.min(100, value)}%`, backgroundColor: item.color }}
                        />
                        <div className="risk-threshold-marker" style={{ left: '30%' }} title="30% threshold" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Average HPP Distribution Card - Stacked Bars */}
        <div className="dashboard-card hpp-distribution-card">
          <div className="card-header">
            <BarChart3 size={24} />
            <h3>HPP Distribution</h3>
          </div>
          <div className="card-body">
            <div className="stacked-bars-legend">
              <span className="legend-item"><span className="legend-color bb"></span>BB</span>
              <span className="legend-item"><span className="legend-color bk"></span>BK</span>
              <span className="legend-item"><span className="legend-color others"></span>Others</span>
            </div>
            <div className="stacked-bars-container">
              <div className="stacked-bars-section">
                <span className="section-label">By LOB</span>
                <StackedBar 
                  label="All" 
                  bb={dashboardData?.costDistribution?.all?.bb || 0}
                  bk={dashboardData?.costDistribution?.all?.bk || 0}
                  others={dashboardData?.costDistribution?.all?.others || 0}
                  onClick={() => handleHPPDistributionClick('ALL', 'lob')}
                />
                <StackedBar 
                  label="Ethical" 
                  bb={dashboardData?.costDistribution?.ethical?.bb || 0}
                  bk={dashboardData?.costDistribution?.ethical?.bk || 0}
                  others={dashboardData?.costDistribution?.ethical?.others || 0}
                  onClick={() => handleHPPDistributionClick('ETHICAL', 'lob')}
                />
                <StackedBar 
                  label="OTC" 
                  bb={dashboardData?.costDistribution?.otc?.bb || 0}
                  bk={dashboardData?.costDistribution?.otc?.bk || 0}
                  others={dashboardData?.costDistribution?.otc?.others || 0}
                  onClick={() => handleHPPDistributionClick('OTC', 'lob')}
                />
                <StackedBar 
                  label="Generik" 
                  bb={dashboardData?.costDistribution?.generik?.bb || 0}
                  bk={dashboardData?.costDistribution?.generik?.bk || 0}
                  others={dashboardData?.costDistribution?.generik?.others || 0}
                  onClick={() => handleHPPDistributionClick('GENERIK', 'lob')}
                />
              </div>
              <div className="stacked-bars-section">
                <span className="section-label">By Category</span>
                <StackedBar 
                  label="Toll Out" 
                  bb={dashboardData?.costDistribution?.tollOut?.bb || 0}
                  bk={dashboardData?.costDistribution?.tollOut?.bk || 0}
                  others={dashboardData?.costDistribution?.tollOut?.others || 0}
                  onClick={() => handleHPPDistributionClick('TOLL_OUT', 'toll')}
                />
                <StackedBar 
                  label="Import" 
                  bb={dashboardData?.costDistribution?.import?.bb || 0}
                  bk={dashboardData?.costDistribution?.import?.bk || 0}
                  others={dashboardData?.costDistribution?.import?.others || 0}
                  onClick={() => handleHPPDistributionClick('IMPORT', 'toll')}
                />
                <StackedBar 
                  label="Inhouse" 
                  bb={dashboardData?.costDistribution?.inhouse?.bb || 0}
                  bk={dashboardData?.costDistribution?.inhouse?.bk || 0}
                  others={dashboardData?.costDistribution?.inhouse?.others || 0}
                  onClick={() => handleHPPDistributionClick('INHOUSE', 'toll')}
                />
              </div>
            </div>
          </div>
        </div>

        {/* HPP Info Cards */}
        <div className="dashboard-card hpp-info-card">
          <div className="card-header">
            <DollarSign size={24} />
            <h3>HPP Info</h3>
            <span className="card-hint">Click stats for details</span>
          </div>
          <div className="card-body">
            {/* Category Mode Toggle */}
            <div className="category-mode-toggle" onClick={(e) => e.stopPropagation()}>
              <button
                className={`mode-btn ${categoryMode === 'lob' ? 'active' : ''}`}
                onClick={() => { setCategoryMode('lob'); setSelectedCategory('ALL'); }}
              >
                By LOB
              </button>
              <button
                className={`mode-btn ${categoryMode === 'toll' ? 'active' : ''}`}
                onClick={() => { setCategoryMode('toll'); setSelectedCategory('ALL'); }}
              >
                By Category
              </button>
            </div>
            <div className="category-switcher" onClick={(e) => e.stopPropagation()}>
              {categoryMode === 'lob' ? (
                // LOB Categories
                ['ALL', 'ETHICAL', 'OTC', 'GENERIK'].map(cat => (
                  <button
                    key={cat}
                    className={`category-btn ${selectedCategory === cat ? 'active' : ''}`}
                    onClick={() => setSelectedCategory(cat)}
                  >
                    {cat === 'ALL' ? 'All' : cat.charAt(0) + cat.slice(1).toLowerCase()}
                  </button>
                ))
              ) : (
                // Toll Categories (excluding Toll In)
                ['ALL', 'TOLL_OUT', 'IMPORT', 'INHOUSE'].map(cat => (
                  <button
                    key={cat}
                    className={`category-btn toll-cat ${selectedCategory === cat ? 'active' : ''}`}
                    onClick={() => setSelectedCategory(cat)}
                  >
                    {cat === 'ALL' ? 'All' : cat === 'TOLL_OUT' ? 'Toll Out' : cat === 'INHOUSE' ? 'Inhouse' : cat}
                  </button>
                ))
              )}
            </div>
            <div className="hpp-stats-grid">
              <div className="hpp-stat-item total clickable" onClick={() => handleHPPInfoClick('all')}>
                <span className="stat-icon">📦</span>
                <div className="stat-content">
                  <span className="stat-value">{formatNumber(hppStats.count)}</span>
                  <span className="stat-label">Total Products</span>
                </div>
              </div>
              <div className="hpp-stat-item high-risk clickable" onClick={() => handleHPPInfoClick('high')}>
                <span className="stat-icon">⚠️</span>
                <div className="stat-content">
                  <span className="stat-value">{formatNumber(hppStats.highCOGS)}</span>
                  <span className="stat-label">≥30% HNA</span>
                </div>
              </div>
              <div className="hpp-stat-item low-risk clickable" onClick={() => handleHPPInfoClick('low')}>
                <span className="stat-icon">✅</span>
                <div className="stat-content">
                  <span className="stat-value">{formatNumber(hppStats.lowCOGS)}</span>
                  <span className="stat-label">&lt;30% HNA</span>
                </div>
              </div>
            </div>
            <div className="hpp-gauge">
              <div className="gauge-bar">
                <div 
                  className="gauge-fill high"
                  style={{ width: `${hppStats.count > 0 ? (hppStats.highCOGS / hppStats.count) * 100 : 0}%` }}
                />
              </div>
              <div className="gauge-labels">
                <span>≥30%: {hppStats.count > 0 ? ((hppStats.highCOGS / hppStats.count) * 100).toFixed(1) : 0}%</span>
                <span>&lt;30%: {hppStats.count > 0 ? ((hppStats.lowCOGS / hppStats.count) * 100).toFixed(1) : 0}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* COGS Heat Map Card */}
        <div className="dashboard-card heat-map-card">
          <div className="card-header">
            <Grid3X3 size={24} />
            <h3>COGS Heat Map</h3>
            <span className="card-hint">High COGS (≥30%) / Total Products</span>
          </div>
          <div className="card-body">
            <div className="heat-map-legend">
              <span className="legend-item low">●  &lt;10% (Low)</span>
              <span className="legend-item medium">●  10-50% (Medium)</span>
              <span className="legend-item high">●  &gt;50% (High)</span>
            </div>
            <table className="heat-map-table">
              <thead>
                <tr>
                  <th></th>
                  <th>Ethical</th>
                  <th>OTC</th>
                  <th>Generik</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="row-header">Inhouse</td>
                  <HeatMapCell 
                    total={dashboardData?.heatMap?.inhouse?.ethical?.total || 0}
                    highCOGS={dashboardData?.heatMap?.inhouse?.ethical?.highCOGS || 0}
                    onClick={() => handleHeatMapClick('ETHICAL', 'Inhouse')}
                  />
                  <HeatMapCell 
                    total={dashboardData?.heatMap?.inhouse?.otc?.total || 0}
                    highCOGS={dashboardData?.heatMap?.inhouse?.otc?.highCOGS || 0}
                    onClick={() => handleHeatMapClick('OTC', 'Inhouse')}
                  />
                  <HeatMapCell 
                    total={dashboardData?.heatMap?.inhouse?.generik?.total || 0}
                    highCOGS={dashboardData?.heatMap?.inhouse?.generik?.highCOGS || 0}
                    onClick={() => handleHeatMapClick('GENERIK', 'Inhouse')}
                  />
                </tr>
                <tr>
                  <td className="row-header">Import</td>
                  <HeatMapCell 
                    total={dashboardData?.heatMap?.import?.ethical?.total || 0}
                    highCOGS={dashboardData?.heatMap?.import?.ethical?.highCOGS || 0}
                    onClick={() => handleHeatMapClick('ETHICAL', 'Import')}
                  />
                  <HeatMapCell 
                    total={dashboardData?.heatMap?.import?.otc?.total || 0}
                    highCOGS={dashboardData?.heatMap?.import?.otc?.highCOGS || 0}
                    onClick={() => handleHeatMapClick('OTC', 'Import')}
                  />
                  <HeatMapCell 
                    total={dashboardData?.heatMap?.import?.generik?.total || 0}
                    highCOGS={dashboardData?.heatMap?.import?.generik?.highCOGS || 0}
                    onClick={() => handleHeatMapClick('GENERIK', 'Import')}
                  />
                </tr>
                <tr>
                  <td className="row-header">Toll Out</td>
                  <HeatMapCell 
                    total={dashboardData?.heatMap?.tollOut?.ethical?.total || 0}
                    highCOGS={dashboardData?.heatMap?.tollOut?.ethical?.highCOGS || 0}
                    onClick={() => handleHeatMapClick('ETHICAL', 'Toll Out')}
                  />
                  <HeatMapCell 
                    total={dashboardData?.heatMap?.tollOut?.otc?.total || 0}
                    highCOGS={dashboardData?.heatMap?.tollOut?.otc?.highCOGS || 0}
                    onClick={() => handleHeatMapClick('OTC', 'Toll Out')}
                  />
                  <HeatMapCell 
                    total={dashboardData?.heatMap?.tollOut?.generik?.total || 0}
                    highCOGS={dashboardData?.heatMap?.tollOut?.generik?.highCOGS || 0}
                    onClick={() => handleHeatMapClick('GENERIK', 'Toll Out')}
                  />
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Product List Modal - Cost Management */}
      <ProductListModal
        isOpen={showProductModal}
        onClose={() => setShowProductModal(false)}
        products={dashboardData?.products || []}
        title={`Product COGS Details - ${dashboardData?.periode}`}
        displayMode="cogs"
      />

      {/* HPP Breakdown Modal - Average HPP */}
      <ProductListModal
        isOpen={showHPPBreakdownModal}
        onClose={() => setShowHPPBreakdownModal(false)}
        products={getFilteredProductsForHPPBreakdown()}
        title={`HPP Breakdown (BB/BK/Others) - ${
          hppBreakdownFilter === 'ALL' ? 'All Products' : 
          hppBreakdownMode === 'toll' ? 
            (hppBreakdownFilter === 'TOLL_OUT' ? 'Toll Out' : 
             hppBreakdownFilter === 'IMPORT' ? 'Import' : 
             hppBreakdownFilter === 'INHOUSE' ? 'Inhouse' : hppBreakdownFilter) :
          hppBreakdownFilter
        }${hppBreakdownCogsFilter !== 'all' ? ` (COGS ${hppBreakdownCogsFilter === 'high' ? '≥30%' : '<30%'})` : ''}`}
        displayMode="hpp-breakdown"
      />

      {/* Heat Map Modal - LOB x Category */}
      <ProductListModal
        isOpen={showHeatMapModal}
        onClose={() => setShowHeatMapModal(false)}
        products={getFilteredProductsForHeatMap()}
        title={`Products - ${heatMapFilter.lob || ''} × ${heatMapFilter.category || ''}`}
        displayMode="cogs"
      />

      {/* Jumlah Produk Modal */}
      <ProductListModal
        isOpen={showJumlahProdukModal}
        onClose={() => setShowJumlahProdukModal(false)}
        products={getFilteredProductsForJumlahProduk()}
        title={`Product List - ${
          jumlahProdukFilter === 'ALL' ? 'All Products' : 
          jumlahProdukMode === 'toll' ? 
            (jumlahProdukFilter === 'TOLL_OUT' ? 'Toll Out' : jumlahProdukFilter) :
          jumlahProdukFilter
        }`}
        displayMode="cogs"
      />
    </div>
  );
}
