import React, { useState, useEffect } from 'react';
import { masterAPI } from '../services/api';
import '../styles/Currency.css';

const Currency = () => {
  const [currencyData, setCurrencyData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [selectedYear, setSelectedYear] = useState('');
  const [availableYears, setAvailableYears] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchCurrencyData();
  }, []);

  useEffect(() => {
    if (currencyData.length > 0) {
      // Get unique years and sort them
      const years = [...new Set(currencyData.map(item => item.Periode))].sort((a, b) => b - a);
      setAvailableYears(years);
      
      // Set default year to the most recent
      if (!selectedYear && years.length > 0) {
        setSelectedYear(years[0]);
      }
    }
  }, [currencyData, selectedYear]);

  useEffect(() => {
    if (selectedYear) {
      filterDataByYear(selectedYear);
    }
  }, [selectedYear, currencyData]);

  const fetchCurrencyData = async () => {
    try {
      setLoading(true);
      const response = await masterAPI.getCurrency();
      setCurrencyData(response);
      setError('');
    } catch (err) {
      setError('Failed to fetch currency data');
      console.error('Error fetching currency data:', err);
    } finally {
      setLoading(false);
    }
  };

  const filterDataByYear = (year) => {
    const filtered = currencyData.filter(item => item.Periode === year);
    setFilteredData(filtered);
  };

  const handleYearChange = (year) => {
    setSelectedYear(year);
  };

  const getCurrencyHistoryData = (currCode) => {
    return currencyData
      .filter(item => item.Curr_Code === currCode)
      .sort((a, b) => a.Periode - b.Periode)
      .map(item => ({
        year: item.Periode,
        value: parseFloat(item.Kurs)
      }));
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('id-ID').format(value);
  };

  const getCurrencyIcon = (currCode) => {
    const icons = {
      'USD': '$',
      'EUR': '€',
      'GBP': '£',
      'JPY': '¥',
      'SGD': 'S$',
      'AUD': 'A$',
      'CNY': '¥',
      'KRW': '₩',
      'IDR': 'Rp'
    };
    return icons[currCode] || currCode;
  };

  const getCurrencyTrend = (currCode) => {
    const history = getCurrencyHistoryData(currCode);
    if (history.length < 2) return 'neutral';
    
    const currentValue = history[history.length - 1]?.value || 0;
    const previousValue = history[history.length - 2]?.value || 0;
    
    if (currCode === 'IDR') return 'neutral'; // IDR is always 1
    
    if (currentValue > previousValue) return 'up';
    if (currentValue < previousValue) return 'down';
    return 'neutral';
  };

  const getMiniChart = (currCode) => {
    const history = getCurrencyHistoryData(currCode);
    if (history.length < 2 || currCode === 'IDR') {
      return <div className="mini-chart flat"></div>;
    }

    const maxValue = Math.max(...history.map(h => h.value));
    const minValue = Math.min(...history.map(h => h.value));
    const range = maxValue - minValue;

    const points = history.map((item, index) => {
      const x = (index / (history.length - 1)) * 100;
      const y = range === 0 ? 50 : 100 - ((item.value - minValue) / range) * 100;
      return `${x},${y}`;
    }).join(' ');

    const trend = getCurrencyTrend(currCode);

    return (
      <div className="mini-chart">
        <svg viewBox="0 0 100 100" className={`chart-svg ${trend}`}>
          <polyline
            points={points}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
          {history.map((item, index) => {
            const x = (index / (history.length - 1)) * 100;
            const y = range === 0 ? 50 : 100 - ((item.value - minValue) / range) * 100;
            return (
              <circle
                key={index}
                cx={x}
                cy={y}
                r="1.5"
                fill="currentColor"
              />
            );
          })}
        </svg>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="currency-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading currency data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="currency-container">
        <div className="error-message">
          <h3>Error</h3>
          <p>{error}</p>
          <button onClick={fetchCurrencyData} className="retry-btn">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="currency-container">
      <div className="currency-header">
        <div className="year-selector">
          <label htmlFor="year-select">Select Year:</label>
          <select 
            id="year-select"
            value={selectedYear} 
            onChange={(e) => handleYearChange(e.target.value)}
          >
            {availableYears.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="currency-grid">
        {filteredData.map((currency) => {
          const trend = getCurrencyTrend(currency.Curr_Code);
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
                  {getMiniChart(currency.Curr_Code)}
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
    </div>
  );
};

export default Currency;
