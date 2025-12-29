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
  Calendar
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

const formatNumber = (value) => {
  if (value === null || value === undefined || isNaN(value)) return '0';
  return new Intl.NumberFormat('id-ID').format(value);
};

const formatPercent = (value) => {
  if (value === null || value === undefined || isNaN(value)) return '0%';
  return `${parseFloat(value).toFixed(1)}%`;
};

// Simple Pie Chart Component (SVG-based)
const PieChart2D = ({ data, colors, size = 200, showLegend = true }) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  if (total === 0) {
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
  const [showProductModal, setShowProductModal] = useState(false);
  const [showHPPBreakdownModal, setShowHPPBreakdownModal] = useState(false);
  const [showJumlahProdukModal, setShowJumlahProdukModal] = useState(false);
  const [jumlahProdukFilter, setJumlahProdukFilter] = useState('ALL');
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
    const key = selectedCategory.toLowerCase();
    return dashboardData.costDistribution[key] || dashboardData.costDistribution.all;
  };

  // Get HPP stats based on selected category
  const getCurrentHPPStats = () => {
    if (!dashboardData) return { count: 0, highCOGS: 0, lowCOGS: 0 };
    const key = selectedCategory.toLowerCase();
    return dashboardData.hppStats[key] || dashboardData.hppStats.all;
  };

  // Get filtered products for Jumlah Produk modal
  const getFilteredProductsForJumlahProduk = () => {
    if (!dashboardData?.products) return [];
    if (jumlahProdukFilter === 'ALL') return dashboardData.products;
    return dashboardData.products.filter(p => p.category?.toUpperCase() === jumlahProdukFilter);
  };

  // Get filtered products for HPP breakdown modal
  const getFilteredProductsForHPPBreakdown = () => {
    if (!dashboardData?.products) return [];
    if (selectedCategory === 'ALL') return dashboardData.products;
    return dashboardData.products.filter(p => p.category?.toUpperCase() === selectedCategory);
  };

  // Handle Jumlah Produk click
  const handleJumlahProdukClick = (filter) => {
    setJumlahProdukFilter(filter);
    setShowJumlahProdukModal(true);
  };

  if (loading) {
    return (
      <div className="dashboard-loading">
        <Loader2 className="loading-spinner" size={48} />
        <p>Loading dashboard...</p>
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

  const costDistribution = getCurrentCostDistribution();
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
            <div className="stat-breakdown">
              <div className="breakdown-item ethical clickable" onClick={() => handleJumlahProdukClick('ETHICAL')}>
                <span className="breakdown-label">Ethical</span>
                <span className="breakdown-value">{formatNumber(dashboardData?.productCounts?.ethical)}</span>
              </div>
              <div className="breakdown-item otc clickable" onClick={() => handleJumlahProdukClick('OTC')}>
                <span className="breakdown-label">OTC</span>
                <span className="breakdown-value">{formatNumber(dashboardData?.productCounts?.otc)}</span>
              </div>
              <div className="breakdown-item generik clickable" onClick={() => handleJumlahProdukClick('GENERIK')}>
                <span className="breakdown-label">Generik</span>
                <span className="breakdown-value">{formatNumber(dashboardData?.productCounts?.generik)}</span>
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
              size={140}
              label="COGS Ratio"
            />
            <div className="cost-summary">
              <div className="cost-item">
                <span className="cost-label">Total HPP</span>
                <span className="cost-value">{formatCurrency(dashboardData?.costManagement?.totalHPP)}</span>
              </div>
              <div className="cost-item">
                <span className="cost-label">Total HNA</span>
                <span className="cost-value">{formatCurrency(dashboardData?.costManagement?.totalHNA)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Pricing Risk Indicator Card */}
        <div className="dashboard-card pricing-risk-card">
          <div className="card-header">
            <TrendingUp size={24} />
            <h3>Pricing Risk Indicator</h3>
          </div>
          <div className="card-body">
            <p className="card-description">Average COGS % by Category</p>
            <div className="risk-indicators">
              <div className="risk-item">
                <span className="risk-label">Ethical</span>
                <div className="risk-bar-container">
                  <div 
                    className="risk-bar ethical-bar" 
                    style={{ width: `${Math.min(100, dashboardData?.pricingRiskIndicator?.ethical || 0)}%` }}
                  />
                </div>
                <span className="risk-value">{formatPercent(dashboardData?.pricingRiskIndicator?.ethical)}</span>
              </div>
              <div className="risk-item">
                <span className="risk-label">OTC</span>
                <div className="risk-bar-container">
                  <div 
                    className="risk-bar otc-bar" 
                    style={{ width: `${Math.min(100, dashboardData?.pricingRiskIndicator?.otc || 0)}%` }}
                  />
                </div>
                <span className="risk-value">{formatPercent(dashboardData?.pricingRiskIndicator?.otc)}</span>
              </div>
              <div className="risk-item">
                <span className="risk-label">Generik</span>
                <div className="risk-bar-container">
                  <div 
                    className="risk-bar generik-bar" 
                    style={{ width: `${Math.min(100, dashboardData?.pricingRiskIndicator?.generik || 0)}%` }}
                  />
                </div>
                <span className="risk-value">{formatPercent(dashboardData?.pricingRiskIndicator?.generik)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Average HPP Distribution Card */}
        <div className="dashboard-card hpp-distribution-card clickable" onClick={() => setShowHPPBreakdownModal(true)}>
          <div className="card-header">
            <BarChart3 size={24} />
            <h3>Average HPP</h3>
            <span className="category-indicator">{selectedCategory === 'ALL' ? 'All Products' : selectedCategory}</span>
            <span className="card-hint">Click for details</span>
          </div>
          <div className="card-body">
            <div className="distribution-chart">
              <PieChart2D
                data={[
                  { label: 'Bahan Baku (BB)', value: costDistribution.bb },
                  { label: 'Bahan Kemas (BK)', value: costDistribution.bk },
                  { label: 'Others', value: costDistribution.others }
                ]}
                colors={['#3b82f6', '#10b981', '#f59e0b']}
                size={180}
              />
            </div>
          </div>
        </div>

        {/* HPP Info Cards */}
        <div className="dashboard-card hpp-info-card clickable" onClick={() => setShowHPPBreakdownModal(true)}>
          <div className="card-header">
            <DollarSign size={24} />
            <h3>HPP Info</h3>
            <span className="card-hint">Click for details</span>
          </div>
          <div className="card-body">
            <div className="category-switcher" onClick={(e) => e.stopPropagation()}>
              {['ALL', 'ETHICAL', 'OTC', 'GENERIK'].map(cat => (
                <button
                  key={cat}
                  className={`category-btn ${selectedCategory === cat ? 'active' : ''}`}
                  onClick={() => setSelectedCategory(cat)}
                >
                  {cat === 'ALL' ? 'All' : cat.charAt(0) + cat.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
            <div className="hpp-stats-grid">
              <div className="hpp-stat-item total">
                <span className="stat-icon">📦</span>
                <div className="stat-content">
                  <span className="stat-value">{formatNumber(hppStats.count)}</span>
                  <span className="stat-label">Total Products</span>
                </div>
              </div>
              <div className="hpp-stat-item high-risk">
                <span className="stat-icon">⚠️</span>
                <div className="stat-content">
                  <span className="stat-value">{formatNumber(hppStats.highCOGS)}</span>
                  <span className="stat-label">≥30% HNA</span>
                </div>
              </div>
              <div className="hpp-stat-item low-risk">
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

        {/* Quick Actions Card */}
        <div className="dashboard-card quick-actions-card">
          <div className="card-header">
            <h3>Quick Actions</h3>
          </div>
          <div className="card-body">
            <div className="action-buttons">
              <button className="action-btn primary" onClick={() => navigate('/hpp-results')}>
                <BarChart3 size={20} />
                <span>View HPP Results</span>
              </button>
              <button className="action-btn secondary" onClick={() => navigate('/hpp-simulation')}>
                <TrendingUp size={20} />
                <span>HPP Simulation</span>
              </button>
              <button className="action-btn secondary" onClick={() => navigate('/generate-hpp')}>
                <RefreshCw size={20} />
                <span>Generate HPP</span>
              </button>
            </div>
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
        title={`HPP Breakdown (BB/BK/Others) - ${selectedCategory === 'ALL' ? 'All Products' : selectedCategory}`}
        displayMode="hpp-breakdown"
      />

      {/* Jumlah Produk Modal */}
      <ProductListModal
        isOpen={showJumlahProdukModal}
        onClose={() => setShowJumlahProdukModal(false)}
        products={getFilteredProductsForJumlahProduk()}
        title={`Product List - ${jumlahProdukFilter === 'ALL' ? 'All Products' : jumlahProdukFilter}`}
        displayMode="cogs"
      />
    </div>
  );
}
