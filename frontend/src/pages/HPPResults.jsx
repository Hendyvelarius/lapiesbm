import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Download, FileText, Loader2 } from 'lucide-react';
import { hppAPI } from '../services/api';
import '../styles/HPPResults.css';

const HPPResults = () => {
  const [hppData, setHppData] = useState({
    ethical: [],
    generik1: [],
    generik2: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Refs for table wrappers to maintain scroll positions
  const ethicalTableRef = useRef(null);
  const generik1TableRef = useRef(null);
  const generik2TableRef = useRef(null);

  useEffect(() => {
    fetchHPPResults();
  }, []);

  const fetchHPPResults = async () => {
    try {
      setLoading(true);
      // Save current scroll positions before refreshing data
      const scrollPositions = {
        ethical: ethicalTableRef.current ? { 
          scrollLeft: ethicalTableRef.current.scrollLeft,
          scrollTop: ethicalTableRef.current.scrollTop 
        } : { scrollLeft: 0, scrollTop: 0 },
        generik1: generik1TableRef.current ? {
          scrollLeft: generik1TableRef.current.scrollLeft,
          scrollTop: generik1TableRef.current.scrollTop 
        } : { scrollLeft: 0, scrollTop: 0 },
        generik2: generik2TableRef.current ? {
          scrollLeft: generik2TableRef.current.scrollLeft,
          scrollTop: generik2TableRef.current.scrollTop 
        } : { scrollLeft: 0, scrollTop: 0 }
      };

      const response = await hppAPI.getResults();
      setHppData(response);
      
      // Restore scroll positions after data is updated
      setTimeout(() => {
        if (ethicalTableRef.current) {
          ethicalTableRef.current.scrollLeft = scrollPositions.ethical.scrollLeft;
          ethicalTableRef.current.scrollTop = scrollPositions.ethical.scrollTop;
        }
        if (generik1TableRef.current) {
          generik1TableRef.current.scrollLeft = scrollPositions.generik1.scrollLeft;
          generik1TableRef.current.scrollTop = scrollPositions.generik1.scrollTop;
        }
        if (generik2TableRef.current) {
          generik2TableRef.current.scrollLeft = scrollPositions.generik2.scrollLeft;
          generik2TableRef.current.scrollTop = scrollPositions.generik2.scrollTop;
        }
      }, 0);
    } catch (error) {
      console.error('Error fetching HPP results:', error);
      setError('Failed to load HPP results');
    } finally {
      setLoading(false);
    }
  };

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

  const EthicalTable = ({ data }) => (
    <div className="hpp-table-container">
      <div className="hpp-table-header">
        <h3><FileText className="hpp-table-icon" />Ethical Products</h3>
        <span className="hpp-record-count">{data.length} products</span>
      </div>
      <div 
        className="hpp-table-wrapper"
        ref={ethicalTableRef}
      >
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
              <th>Group Rendemen</th>
              <th>Batch Size</th>
              <th>HPP</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item, index) => (
              <tr key={index}>
                <td>{item.Product_ID}</td>
                <td className="product-name">{item.Product_Name}</td>
                <td>{formatCurrency(item.totalBB)}</td>
                <td>{formatCurrency(item.totalBK)}</td>
                <td>{formatNumber(item.MH_Proses_Std)}</td>
                <td>{formatNumber(item.MH_Kemas_Std)}</td>
                <td>{formatCurrency(item.Biaya_Proses)}</td>
                <td>{formatCurrency(item.Biaya_Kemas)}</td>
                <td>{formatNumber(item.Group_Rendemen)}%</td>
                <td>{formatNumber(item.Batch_Size)}</td>
                <td className="hpp-value">{formatCurrency(item.HPP)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const Generik1Table = ({ data }) => (
    <div className="hpp-table-container">
      <div className="hpp-table-header">
        <h3><FileText className="hpp-table-icon" />Generic Products (Type 1)</h3>
        <span className="hpp-record-count">{data.length} products</span>
      </div>
      <div 
        className="hpp-table-wrapper"
        ref={generik1TableRef}
      >
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
              <th>Group Rendemen</th>
              <th>Batch Size</th>
              <th>HPP</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item, index) => (
              <tr key={index}>
                <td>{item.Product_ID}</td>
                <td className="product-name">{item.Product_Name}</td>
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
                <td>{formatNumber(item.Group_Rendemen)}%</td>
                <td>{formatNumber(item.Batch_Size)}</td>
                <td className="hpp-value">{formatCurrency(item.HPP)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const Generik2Table = ({ data }) => (
    <div className="hpp-table-container">
      <div className="hpp-table-header">
        <h3><FileText className="hpp-table-icon" />Generic Products (Type 2)</h3>
        <span className="hpp-record-count">{data.length} products</span>
      </div>
      <div 
        className="hpp-table-wrapper"
        ref={generik2TableRef}
      >
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
              <th>Direct Labor</th>
              <th>Factory Over Head 50</th>
              <th>Group Rendemen</th>
              <th>Batch Size</th>
              <th>HPP</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item, index) => (
              <tr key={index}>
                <td>{item.Product_ID}</td>
                <td className="product-name">{item.Product_Name}</td>
                <td>{formatCurrency(item.totalBB)}</td>
                <td>{formatCurrency(item.totalBK)}</td>
                <td>{formatNumber(item.MH_Proses_Std)}</td>
                <td>{formatNumber(item.MH_Kemas_Std)}</td>
                <td>{formatCurrency(item.Biaya_Proses)}</td>
                <td>{formatCurrency(item.Biaya_Kemas)}</td>
                <td>{formatCurrency(item.Direct_Labor)}</td>
                <td>{formatCurrency(item.Factory_Over_Head_50)}</td>
                <td>{formatNumber(item.Group_Rendemen)}%</td>
                <td>{formatNumber(item.Batch_Size)}</td>
                <td className="hpp-value">{formatCurrency(item.HPP)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

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
          <button className="hpp-export-btn">
            <Download size={16} />
            Export to Excel
          </button>
          <button onClick={fetchHPPResults} className="hpp-refresh-btn">
            Refresh Data
          </button>
        </div>
      </div>

      <div className="hpp-results-content">
        <EthicalTable data={hppData.ethical} />
        <Generik1Table data={hppData.generik1} />
        <Generik2Table data={hppData.generik2} />
      </div>
    </div>
  );
};

export default HPPResults;
