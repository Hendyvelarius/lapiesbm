import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { masterAPI, dailyCurrencyAPI } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import { TrendingUp, TrendingDown, Minus, Calendar, RefreshCw, Database, Activity, BarChart3, Clock, ArrowUpRight, ArrowDownRight, ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import '../styles/Currency.css';

// Currency metadata for display
const CURRENCY_META = {
  USD: { name: 'US Dollar', flag: '🇺🇸', symbol: '$' },
  EUR: { name: 'Euro', flag: '🇪🇺', symbol: '€' },
  GBP: { name: 'British Pound', flag: '🇬🇧', symbol: '£' },
  JPY: { name: 'Japanese Yen', flag: '🇯🇵', symbol: '¥' },
  SGD: { name: 'Singapore Dollar', flag: '🇸🇬', symbol: 'S$' },
  AUD: { name: 'Australian Dollar', flag: '🇦🇺', symbol: 'A$' },
  CHF: { name: 'Swiss Franc', flag: '🇨🇭', symbol: 'Fr' },
  RMB: { name: 'Chinese Yuan', flag: '🇨🇳', symbol: '¥' },
  MYR: { name: 'Malaysian Ringgit', flag: '🇲🇾', symbol: 'RM' },
};

const Currency = () => {
  // Mode: 'actual' (daily/HPP Actual) or 'standard' (yearly/HPP Standard)
  const [mode, setMode] = useState('actual');
  
  // Actual mode state
  const [dailyData, setDailyData] = useState([]);
  const [selectedCurrency, setSelectedCurrency] = useState('USD');
  const [dateRange, setDateRange] = useState({ start: null, end: null });
  const [timeframe, setTimeframe] = useState('1M'); // 1W, 1M, 3M, 6M, 1Y, ALL, CUSTOM
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [stats, setStats] = useState(null);
  const [schedulerStatus, setSchedulerStatus] = useState(null);
  const [dataLoading, setDataLoading] = useState(false); // For timeframe changes
  
  // Chart tooltip state
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, date: '', value: 0, position: 'above' });
  
  // Standard mode state
  const [currencyData, setCurrencyData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [selectedYear, setSelectedYear] = useState('');
  const [availableYears, setAvailableYears] = useState([]);
  
  // Common state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Fetch data based on mode
  useEffect(() => {
    if (mode === 'actual') {
      fetchActualData();
    } else {
      fetchStandardData();
    }
  }, [mode]);

  // Standard mode year filtering
  useEffect(() => {
    if (mode === 'standard' && currencyData.length > 0) {
      const years = [...new Set(currencyData.map(item => item.Periode))].sort((a, b) => b - a);
      setAvailableYears(years);
      if (!selectedYear && years.length > 0) {
        setSelectedYear(years[0]);
      }
    }
  }, [currencyData, selectedYear, mode]);

  useEffect(() => {
    if (mode === 'standard' && selectedYear) {
      const filtered = currencyData.filter(item => item.Periode === selectedYear);
      setFilteredData(filtered);
    }
  }, [selectedYear, currencyData, mode]);

  // Actual mode: Fetch daily currency data
  const fetchActualData = async (customStart = null, customEnd = null, isTimeframeChange = false, newTimeframe = null) => {
    try {
      // Use dataLoading for timeframe changes, loading for initial load
      if (isTimeframeChange) {
        setDataLoading(true);
      } else {
        setLoading(true);
      }
      setError('');
      
      let startDate, endDate;
      
      // Use the passed timeframe or the current state
      const tf = newTimeframe || timeframe;
      
      // If custom dates are provided, use them
      if (customStart && customEnd) {
        startDate = new Date(customStart);
        endDate = new Date(customEnd);
      } else {
        // Calculate date range based on timeframe
        endDate = new Date();
        startDate = new Date();
        
        switch (tf) {
          case '1W':
            startDate.setDate(startDate.getDate() - 7);
            break;
          case '1M':
            startDate.setMonth(startDate.getMonth() - 1);
            break;
          case '3M':
            startDate.setMonth(startDate.getMonth() - 3);
            break;
          case '6M':
            startDate.setMonth(startDate.getMonth() - 6);
            break;
          case '1Y':
            startDate.setFullYear(startDate.getFullYear() - 1);
            break;
          case 'ALL':
            startDate.setFullYear(2020, 0, 1);
            break;
          case 'CUSTOM':
            // Use the stored custom dates
            if (customStartDate && customEndDate) {
              startDate = new Date(customStartDate);
              endDate = new Date(customEndDate);
            } else {
              startDate.setMonth(startDate.getMonth() - 1);
            }
            break;
          default:
            startDate.setMonth(startDate.getMonth() - 1);
        }
      }
      
      const [dataResponse, statsResponse, schedulerResponse] = await Promise.all([
        dailyCurrencyAPI.getAll({
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
        }),
        dailyCurrencyAPI.getStats(),
        dailyCurrencyAPI.getSchedulerStatus().catch(() => null),
      ]);
      
      setDailyData(dataResponse.data || []);
      setStats(statsResponse.data || null);
      setSchedulerStatus(schedulerResponse?.data || null);
      setDateRange({ start: startDate, end: endDate });
    } catch (err) {
      setError('Failed to fetch currency data. Please try again.');
      console.error('Error fetching actual currency data:', err);
    } finally {
      setLoading(false);
      setDataLoading(false);
    }
  };

  // Handle custom date range search
  const handleCustomDateSearch = () => {
    if (customStartDate && customEndDate) {
      setTimeframe('CUSTOM');
      fetchActualData(customStartDate, customEndDate, true);
    }
  };

  // Clear custom date range
  const handleClearCustomDate = () => {
    setCustomStartDate('');
    setCustomEndDate('');
    setTimeframe('1M');
    fetchActualData();
  };

  // Standard mode: Fetch yearly currency data
  const fetchStandardData = async () => {
    try {
      setLoading(true);
      const response = await masterAPI.getCurrency();
      setCurrencyData(response);
      setError('');
    } catch (err) {
      setError('Failed to fetch currency data');
      console.error('Error fetching standard currency data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Refresh data
  const handleRefresh = async () => {
    setRefreshing(true);
    if (mode === 'actual') {
      await fetchActualData();
    } else {
      await fetchStandardData();
    }
    setRefreshing(false);
  };

  // Trigger manual scheduler fetch
  const handleTriggerFetch = async () => {
    try {
      setRefreshing(true);
      await dailyCurrencyAPI.triggerScheduler();
      await fetchActualData();
    } catch (err) {
      console.error('Error triggering fetch:', err);
    } finally {
      setRefreshing(false);
    }
  };

  // Get chart data for a specific currency
  const getChartData = useCallback((currencyCode) => {
    if (!dailyData || dailyData.length === 0) return [];
    
    return dailyData
      .filter(item => item[currencyCode] != null)
      .map(item => ({
        date: item.date,
        value: parseFloat(item[currencyCode]) || 0,
      }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [dailyData]);

  // Calculate currency statistics
  const getCurrencyStats = useCallback((currencyCode) => {
    const data = getChartData(currencyCode);
    if (data.length === 0) return null;
    
    const values = data.map(d => d.value);
    const current = values[values.length - 1];
    const previous = values.length > 1 ? values[values.length - 2] : current;
    const first = values[0];
    const high = Math.max(...values);
    const low = Math.min(...values);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    
    const dailyChange = current - previous;
    const dailyChangePercent = previous !== 0 ? (dailyChange / previous) * 100 : 0;
    const periodChange = current - first;
    const periodChangePercent = first !== 0 ? (periodChange / first) * 100 : 0;
    
    return {
      current,
      previous,
      high,
      low,
      avg,
      dailyChange,
      dailyChangePercent,
      periodChange,
      periodChangePercent,
      dataPoints: data.length,
      latestDate: data[data.length - 1]?.date,
    };
  }, [getChartData]);

  // Format currency value
  const formatCurrency = (value, decimals = 2) => {
    if (value == null) return '-';
    return new Intl.NumberFormat('id-ID', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  };

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  // Get trend direction
  const getTrend = (change) => {
    if (change > 0) return 'up';
    if (change < 0) return 'down';
    return 'neutral';
  };

  // SVG Chart Component with interactive tooltips
  const CurrencyChart = ({ currencyCode, height = 200, showGrid = true, showLabels = true }) => {
    const data = getChartData(currencyCode);
    const chartRef = React.useRef(null);
    
    if (data.length < 2) {
      return (
        <div className="chart-placeholder" style={{ height }}>
          <BarChart3 size={48} />
          <p>Insufficient data for chart</p>
        </div>
      );
    }

    const values = data.map(d => d.value);
    const maxValue = Math.max(...values);
    const minValue = Math.min(...values);
    const range = maxValue - minValue || 1;
    
    // Use wider viewBox for better aspect ratio
    const chartWidth = 800;
    const chartHeight = 250;
    const padding = { top: 20, right: 30, bottom: 40, left: 80 };

    // Generate path points
    const points = data.map((item, index) => {
      const x = padding.left + (index / (data.length - 1)) * (chartWidth - padding.left - padding.right);
      const y = padding.top + (1 - (item.value - minValue) / range) * (chartHeight - padding.top - padding.bottom);
      return { x, y, ...item };
    });

    const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    
    // Area fill path
    const areaD = `${pathD} L ${points[points.length - 1].x} ${chartHeight - padding.bottom} L ${points[0].x} ${chartHeight - padding.bottom} Z`;

    const trend = getTrend(values[values.length - 1] - values[0]);
    const gradientId = `gradient-${currencyCode}`;

    // Y-axis labels (5 labels for better granularity)
    const yLabelCount = 5;
    const yLabels = Array.from({ length: yLabelCount }, (_, i) => {
      const ratio = i / (yLabelCount - 1);
      return maxValue - ratio * range;
    });

    // Handle mouse events for tooltip
    const handlePointHover = (point, event) => {
      const chartContainer = chartRef.current?.closest('.chart-container');
      if (!chartContainer) return;
      
      const svgRect = chartRef.current.getBoundingClientRect();
      
      // Calculate position relative to container
      const xRatio = point.x / chartWidth;
      const yRatio = point.y / chartHeight;
      
      const tooltipX = xRatio * svgRect.width;
      const tooltipY = yRatio * svgRect.height;
      
      // Check if point is in upper 30% of chart - if so, show tooltip below
      const isNearTop = yRatio < 0.35;
      
      setTooltip({
        visible: true,
        x: tooltipX,
        y: tooltipY,
        date: point.date,
        value: point.value,
        position: isNearTop ? 'below' : 'above',
      });
    };

    const handleMouseLeave = () => {
      setTooltip({ ...tooltip, visible: false });
    };

    // Determine which points to show (show more points for interactivity)
    const visiblePointIndices = new Set();
    const step = Math.max(1, Math.ceil(points.length / 30)); // Show ~30 points max
    for (let i = 0; i < points.length; i += step) {
      visiblePointIndices.add(i);
    }
    visiblePointIndices.add(points.length - 1); // Always show last point

    return (
      <svg 
        ref={chartRef}
        viewBox={`0 0 ${chartWidth} ${chartHeight}`} 
        className={`currency-chart-svg trend-${trend}`} 
        preserveAspectRatio="xMidYMid meet"
        onMouseLeave={handleMouseLeave}
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={trend === 'up' ? '#10b981' : trend === 'down' ? '#ef4444' : '#6366f1'} stopOpacity="0.3" />
            <stop offset="100%" stopColor={trend === 'up' ? '#10b981' : trend === 'down' ? '#ef4444' : '#6366f1'} stopOpacity="0.05" />
          </linearGradient>
        </defs>
        
        {/* Grid lines */}
        {showGrid && (
          <g className="chart-grid">
            {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => (
              <line
                key={i}
                x1={padding.left}
                y1={padding.top + ratio * (chartHeight - padding.top - padding.bottom)}
                x2={chartWidth - padding.right}
                y2={padding.top + ratio * (chartHeight - padding.top - padding.bottom)}
                stroke="#e5e7eb"
                strokeWidth="1"
              />
            ))}
          </g>
        )}

        {/* Y-axis labels */}
        {showLabels && (
          <g className="chart-labels">
            {yLabels.map((val, i) => (
              <text
                key={i}
                x={padding.left - 10}
                y={padding.top + (i / (yLabels.length - 1)) * (chartHeight - padding.top - padding.bottom) + 4}
                textAnchor="end"
                fontSize="12"
                fill="#9ca3af"
              >
                {formatCurrency(val, 0)}
              </text>
            ))}
          </g>
        )}
        
        {/* Area fill */}
        <path d={areaD} fill={`url(#${gradientId})`} />
        
        {/* Main line */}
        <path
          d={pathD}
          fill="none"
          stroke={trend === 'up' ? '#10b981' : trend === 'down' ? '#ef4444' : '#6366f1'}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        
        {/* Interactive data points */}
        {points.map((point, index) => {
          const isVisible = visiblePointIndices.has(index);
          const isLast = index === points.length - 1;
          
          return (
            <circle
              key={index}
              cx={point.x}
              cy={point.y}
              r={isLast ? 6 : isVisible ? 4 : 8}
              fill={isVisible ? (trend === 'up' ? '#10b981' : trend === 'down' ? '#ef4444' : '#6366f1') : 'transparent'}
              stroke={isLast ? 'white' : 'transparent'}
              strokeWidth={isLast ? 2 : 0}
              className="chart-data-point"
              style={{ cursor: 'pointer' }}
              onMouseEnter={(e) => handlePointHover(point, e)}
            />
          );
        })}
      </svg>
    );
  };

  // Mini sparkline chart for cards
  const MiniChart = ({ currencyCode }) => {
    const data = getChartData(currencyCode);
    if (data.length < 2) return <div className="mini-chart-placeholder" />;

    const values = data.map(d => d.value);
    const max = Math.max(...values);
    const min = Math.min(...values);
    const range = max - min || 1;

    const points = values.map((v, i) => {
      const x = (i / (values.length - 1)) * 100;
      const y = 100 - ((v - min) / range) * 100;
      return `${x},${y}`;
    }).join(' ');

    const trend = getTrend(values[values.length - 1] - values[0]);

    return (
      <svg viewBox="0 0 100 100" className={`mini-chart-svg trend-${trend}`} preserveAspectRatio="none">
        <polyline
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  };

  // Currency card for actual mode
  const ActualCurrencyCard = ({ currencyCode }) => {
    const meta = CURRENCY_META[currencyCode] || { name: currencyCode, flag: '💱', symbol: '' };
    const currStats = getCurrencyStats(currencyCode);
    
    if (!currStats) {
      return (
        <div className="actual-currency-card no-data">
          <div className="card-header">
            <span className="currency-flag">{meta.flag}</span>
            <div className="currency-title">
              <h3>{currencyCode}</h3>
              <span>{meta.name}</span>
            </div>
          </div>
          <p className="no-data-text">No data available</p>
        </div>
      );
    }

    const trend = getTrend(currStats.dailyChange);
    const isSelected = selectedCurrency === currencyCode;

    return (
      <div 
        className={`actual-currency-card trend-${trend} ${isSelected ? 'selected' : ''}`}
        onClick={() => setSelectedCurrency(currencyCode)}
      >
        <div className="card-header">
          <span className="currency-flag">{meta.flag}</span>
          <div className="currency-title">
            <h3>{currencyCode}/IDR</h3>
            <span>{meta.name}</span>
          </div>
          <div className={`trend-badge trend-${trend}`}>
            {trend === 'up' && <TrendingUp size={14} />}
            {trend === 'down' && <TrendingDown size={14} />}
            {trend === 'neutral' && <Minus size={14} />}
            <span>{currStats.dailyChangePercent >= 0 ? '+' : ''}{currStats.dailyChangePercent.toFixed(2)}%</span>
          </div>
        </div>
        
        <div className="card-body">
          <div className="current-rate">
            <span className="rate-value">Rp {formatCurrency(currStats.current)}</span>
            <span className={`rate-change trend-${trend}`}>
              {trend === 'up' && <ArrowUpRight size={16} />}
              {trend === 'down' && <ArrowDownRight size={16} />}
              {trend === 'neutral' && <Minus size={16} />}
              {currStats.dailyChange >= 0 ? '+' : ''}{formatCurrency(currStats.dailyChange)}
            </span>
          </div>
          
          <div className="mini-chart-container">
            <MiniChart currencyCode={currencyCode} />
          </div>
        </div>
        
        <div className="card-footer">
          <div className="stat">
            <span className="stat-label">High</span>
            <span className="stat-value">{formatCurrency(currStats.high)}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Low</span>
            <span className="stat-value">{formatCurrency(currStats.low)}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Avg</span>
            <span className="stat-value">{formatCurrency(currStats.avg)}</span>
          </div>
        </div>
      </div>
    );
  };

  // Detailed view panel for selected currency
  const DetailedCurrencyView = () => {
    const meta = CURRENCY_META[selectedCurrency] || { name: selectedCurrency, flag: '💱', symbol: '' };
    const currStats = getCurrencyStats(selectedCurrency);
    const data = getChartData(selectedCurrency);
    
    if (!currStats) {
      return (
        <div className="detailed-view empty">
          <p>Select a currency to view detailed information</p>
        </div>
      );
    }

    const trend = getTrend(currStats.dailyChange);
    const periodTrend = getTrend(currStats.periodChange);

    return (
      <div className="detailed-view">
        <div className="detailed-header">
          <div className="currency-info">
            <span className="large-flag">{meta.flag}</span>
            <div>
              <h2>{selectedCurrency}/IDR</h2>
              <p>{meta.name}</p>
            </div>
          </div>
          <div className="current-price-display">
            <span className="big-price">Rp {formatCurrency(currStats.current)}</span>
            <div className={`price-change trend-${trend}`}>
              {trend === 'up' && <ArrowUpRight size={20} />}
              {trend === 'down' && <ArrowDownRight size={20} />}
              {trend === 'neutral' && <Minus size={20} />}
              <span>{currStats.dailyChange >= 0 ? '+' : ''}{formatCurrency(currStats.dailyChange)} ({currStats.dailyChangePercent >= 0 ? '+' : ''}{currStats.dailyChangePercent.toFixed(2)}%)</span>
            </div>
            <span className="last-update">Last update: {formatDate(currStats.latestDate)}</span>
          </div>
        </div>

        <div className="chart-container">
          <CurrencyChart currencyCode={selectedCurrency} />
          {tooltip.visible && (
            <div 
              className={`chart-tooltip ${tooltip.position === 'below' ? 'tooltip-below' : ''}`}
              style={{ 
                left: tooltip.x, 
                top: tooltip.y,
              }}
            >
              <div className="tooltip-date">{formatDate(tooltip.date)}</div>
              <div className="tooltip-value">Rp {formatCurrency(tooltip.value)}</div>
            </div>
          )}
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon open"><Activity size={20} /></div>
            <div className="stat-content">
              <span className="stat-label">Period Open</span>
              <span className="stat-value">{formatCurrency(data[0]?.value)}</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon high"><TrendingUp size={20} /></div>
            <div className="stat-content">
              <span className="stat-label">Period High</span>
              <span className="stat-value">{formatCurrency(currStats.high)}</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon low"><TrendingDown size={20} /></div>
            <div className="stat-content">
              <span className="stat-label">Period Low</span>
              <span className="stat-value">{formatCurrency(currStats.low)}</span>
            </div>
          </div>
          <div className="stat-card">
            <div className={`stat-icon period-change trend-${periodTrend}`}>
              {periodTrend === 'up' ? <ArrowUpRight size={20} /> : periodTrend === 'down' ? <ArrowDownRight size={20} /> : <Minus size={20} />}
            </div>
            <div className="stat-content">
              <span className="stat-label">Period Change</span>
              <span className={`stat-value trend-${periodTrend}`}>
                {currStats.periodChangePercent >= 0 ? '+' : ''}{currStats.periodChangePercent.toFixed(2)}%
              </span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon avg"><BarChart3 size={20} /></div>
            <div className="stat-content">
              <span className="stat-label">Average</span>
              <span className="stat-value">{formatCurrency(currStats.avg)}</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon data"><Database size={20} /></div>
            <div className="stat-content">
              <span className="stat-label">Data Points</span>
              <span className="stat-value">{currStats.dataPoints} days</span>
            </div>
          </div>
        </div>

        {/* Recent data table */}
        <div className="recent-data-section">
          <h3>Recent Exchange Rates</h3>
          <div className="recent-data-table">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Rate (IDR)</th>
                  <th>Change</th>
                </tr>
              </thead>
              <tbody>
                {data.slice(-10).reverse().map((item, index, arr) => {
                  const prevValue = arr[index + 1]?.value || item.value;
                  const change = item.value - prevValue;
                  const changePercent = prevValue !== 0 ? (change / prevValue) * 100 : 0;
                  const itemTrend = getTrend(change);
                  
                  return (
                    <tr key={item.date}>
                      <td>{formatDate(item.date)}</td>
                      <td className="rate-cell">{formatCurrency(item.value)}</td>
                      <td className={`change-cell trend-${itemTrend}`}>
                        {index < arr.length - 1 && (
                          <>
                            {itemTrend === 'up' && <ArrowUpRight size={14} />}
                            {itemTrend === 'down' && <ArrowDownRight size={14} />}
                            {itemTrend === 'neutral' && <Minus size={14} />}
                            <span>{change >= 0 ? '+' : ''}{changePercent.toFixed(2)}%</span>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // Standard mode helpers
  const getCurrencyIcon = (currCode) => {
    const icons = {
      'USD': '$', 'EUR': '€', 'GBP': '£', 'JPY': '¥', 'SGD': 'S$',
      'AUD': 'A$', 'CNY': '¥', 'KRW': '₩', 'IDR': 'Rp'
    };
    return icons[currCode] || currCode;
  };

  const getCurrencyHistoryData = (currCode) => {
    return currencyData
      .filter(item => item.Curr_Code === currCode)
      .sort((a, b) => a.Periode - b.Periode)
      .map(item => ({ year: item.Periode, value: parseFloat(item.Kurs) }));
  };

  const getStandardCurrencyTrend = (currCode) => {
    const history = getCurrencyHistoryData(currCode);
    if (history.length < 2 || currCode === 'IDR') return 'neutral';
    const currentValue = history[history.length - 1]?.value || 0;
    const previousValue = history[history.length - 2]?.value || 0;
    if (currentValue > previousValue) return 'up';
    if (currentValue < previousValue) return 'down';
    return 'neutral';
  };

  const getStandardMiniChart = (currCode) => {
    const history = getCurrencyHistoryData(currCode);
    if (history.length < 2 || currCode === 'IDR') return <div className="mini-chart flat"></div>;

    const maxValue = Math.max(...history.map(h => h.value));
    const minValue = Math.min(...history.map(h => h.value));
    const range = maxValue - minValue;

    const points = history.map((item, index) => {
      const x = (index / (history.length - 1)) * 100;
      const y = range === 0 ? 50 : 100 - ((item.value - minValue) / range) * 100;
      return `${x},${y}`;
    }).join(' ');

    const trend = getStandardCurrencyTrend(currCode);

    return (
      <div className="mini-chart">
        <svg viewBox="0 0 100 100" className={`chart-svg ${trend}`}>
          <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" />
          {history.map((item, index) => {
            const x = (index / (history.length - 1)) * 100;
            const y = range === 0 ? 50 : 100 - ((item.value - minValue) / range) * 100;
            return <circle key={index} cx={x} cy={y} r="1.5" fill="currentColor" />;
          })}
        </svg>
      </div>
    );
  };

  // Loading state
  if (loading) {
    return (
      <div className="currency-container">
        <LoadingSpinner message="Loading currency data..." size="large" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="currency-container">
        <div className="error-message">
          <h3>Error</h3>
          <p>{error}</p>
          <button onClick={handleRefresh} className="retry-btn">Try Again</button>
        </div>
      </div>
    );
  }

  return (
    <div className="currency-container">
      {/* Mode switcher header */}
      <div className="currency-page-header">
        <div className="mode-switcher">
          <button 
            className={`mode-btn ${mode === 'actual' ? 'active' : ''}`}
            onClick={() => setMode('actual')}
          >
            <Activity size={18} />
            <span>HPP Actual</span>
            <small>Daily Rates</small>
          </button>
          <button 
            className={`mode-btn ${mode === 'standard' ? 'active' : ''}`}
            onClick={() => setMode('standard')}
          >
            <Database size={18} />
            <span>HPP Standard</span>
            <small>Yearly Budget</small>
          </button>
        </div>
        
        <button 
          className={`refresh-btn ${refreshing ? 'spinning' : ''}`}
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw size={18} />
        </button>
      </div>

      {/* Actual Mode Content */}
      {mode === 'actual' && (
        <div className={`actual-mode-content ${dataLoading ? 'loading-data' : ''}`}>
          {/* Loading overlay */}
          {dataLoading && (
            <div className="timeframe-loading">
              <RefreshCw size={18} />
              <span>Loading data...</span>
            </div>
          )}
          
          {/* Controls bar */}
          <div className="actual-controls">
            <div className="controls-left">
              <div className="timeframe-selector">
                {['1W', '1M', '3M', '6M', '1Y', 'ALL'].map(tf => (
                  <button
                    key={tf}
                    className={`timeframe-btn ${timeframe === tf ? 'active' : ''}`}
                    onClick={() => {
                      if (timeframe === tf || dataLoading) return; // Don't refetch if same timeframe or loading
                      setTimeframe(tf);
                      setCustomStartDate('');
                      setCustomEndDate('');
                      fetchActualData(null, null, true, tf);
                    }}
                    disabled={dataLoading}
                  >
                    {tf}
                  </button>
                ))}
              </div>
              
              {/* Custom Date Range Picker */}
              <div className="date-range-picker">
                <div className="date-input-group">
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    max={customEndDate || undefined}
                    placeholder="Start Date"
                    disabled={dataLoading}
                  />
                  <span className="date-separator">to</span>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    min={customStartDate || undefined}
                    placeholder="End Date"
                    disabled={dataLoading}
                  />
                </div>
                <button 
                  className="apply-date-btn"
                  onClick={handleCustomDateSearch}
                  disabled={!customStartDate || !customEndDate || dataLoading}
                >
                  <Search size={14} />
                  <span>Search</span>
                </button>
                {timeframe === 'CUSTOM' && (
                  <button className="clear-date-btn" onClick={handleClearCustomDate} title="Clear custom date" disabled={dataLoading}>
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
            
            <div className="controls-right">
              {schedulerStatus && (
                <div className="scheduler-status">
                  <Clock size={14} />
                  <span>Auto-update: {schedulerStatus.scheduledTime}</span>
                  <span className={`status-dot ${schedulerStatus.isSchedulerRunning ? 'active' : 'inactive'}`} />
                </div>
              )}
              <button className="fetch-now-btn" onClick={handleTriggerFetch} disabled={refreshing}>
                <RefreshCw size={14} />
                <span>Fetch Latest</span>
              </button>
            </div>
          </div>

          {/* Main content grid */}
          <div className="actual-content-grid">
            {/* Currency cards */}
            <div className="currency-cards-panel">
              <h3 className="panel-title">Exchange Rates</h3>
              <div className="actual-currency-grid">
                {Object.keys(CURRENCY_META).map(code => (
                  <ActualCurrencyCard key={code} currencyCode={code} />
                ))}
              </div>
            </div>
            
            {/* Detailed view */}
            <div className="detailed-view-panel">
              <DetailedCurrencyView />
            </div>
          </div>

          {/* Stats footer */}
          {stats && (
            <div className="stats-footer">
              <div className="footer-stat">
                <Database size={16} />
                <span>Total Records: <strong>{stats.totalRecords?.toLocaleString() || 0}</strong></span>
              </div>
              <div className="footer-stat">
                <Calendar size={16} />
                <span>Date Range: <strong>{formatDate(stats.startDate)} - {formatDate(stats.endDate)}</strong></span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Standard Mode Content */}
      {mode === 'standard' && (
        <>
          <div className="currency-header">
            <div className="year-selector">
              <label htmlFor="year-select">Select Year:</label>
              <select 
                id="year-select"
                value={selectedYear} 
                onChange={(e) => setSelectedYear(e.target.value)}
              >
                {availableYears.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="currency-grid">
            {filteredData.map((currency) => {
              const trend = getStandardCurrencyTrend(currency.Curr_Code);
              const isIDR = currency.Curr_Code === 'IDR';
              
              return (
                <div key={currency.Curr_Code} className={`currency-card ${trend} ${isIDR ? 'base-currency' : ''}`}>
                  <div className="currency-card-header">
                    <div className="currency-info">
                      <span className="currency-icon">{getCurrencyIcon(currency.Curr_Code)}</span>
                      <div>
                        <h3>{currency.Curr_Code}</h3>
                        <p>{currency.Curr_Description}</p>
                      </div>
                    </div>
                    {!isIDR && (
                      <div className={`trend-indicator ${trend}`}>
                        {trend === 'up' && '↗'}
                        {trend === 'down' && '↘'}
                        {trend === 'neutral' && '→'}
                      </div>
                    )}
                  </div>

                  <div className="currency-bottom">
                    <div className="currency-value">
                      <span className="value">
                        {isIDR ? '1' : formatCurrency(currency.Kurs)}
                      </span>
                      <span className="unit">
                        {isIDR ? 'Base Currency' : `per 1 ${currency.Curr_Code}`}
                      </span>
                    </div>
                    <div className="currency-chart">
                      {getStandardMiniChart(currency.Curr_Code)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredData.length === 0 && !loading && (
            <div className="no-data">
              <p>No currency data available for the selected year.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Currency;
