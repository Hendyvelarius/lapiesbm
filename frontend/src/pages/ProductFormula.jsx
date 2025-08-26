import React, { useState, useEffect } from 'react';
import api from '../services/api';
import '../styles/ProductFormula.css';

const ProductFormula = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Load initial data
  useEffect(() => {
    // TODO: Load product formulas data
  }, []);

  if (loading) {
    return (
      <div className="product-formula-container">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="product-formula-container">
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <div className="content-section">
        <div className="section-header">
          <div className="section-title">
            <h2>Product Formula Management</h2>
          </div>
          <div className="header-actions">
            <button className="btn-primary">
              Add New Formula
            </button>
          </div>
        </div>

        <div className="page-content">
          <div className="coming-soon">
            <h3>🚧 Under Construction</h3>
            <p>This page is currently being developed. Here you will be able to:</p>
            <ul>
              <li>Create new product formulas</li>
              <li>Edit existing formulas</li>
              <li>Manage formula ingredients and quantities</li>
              <li>Set batch sizes and default formulas</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductFormula;
