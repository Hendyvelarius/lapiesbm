import React, { useState, useEffect } from "react";
import { X, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { hppAPI } from "../services/api";
import "../styles/AffectedProductsModal.css";

const AffectedProductsModal = ({ isOpen, onClose, priceChangeDescription, priceChangeDate }) => {
  const [loading, setLoading] = useState(false);
  const [affectedProducts, setAffectedProducts] = useState([]);
  const [error, setError] = useState("");

  // Fetch affected products using stored procedure
  const fetchAffectedProducts = async (description, simulasiDate) => {
    try {
      setLoading(true);
      setError("");

      console.log('=== Fetching Affected Products ===');
      console.log('Description:', description);
      console.log('SimulasiDate:', simulasiDate);

      const response = await hppAPI.getPriceChangeAffectedProducts(description, simulasiDate);

      console.log('=== API Response ===');
      console.log('Response:', response);

      if (response.success && response.data) {
        setAffectedProducts(response.data);
      } else {
        setError("Failed to fetch affected products");
        setAffectedProducts([]);
      }

    } catch (err) {
      console.error("Error fetching affected products:", err);
      setError("Failed to fetch affected products. Please try again.");
      setAffectedProducts([]);
    } finally {
      setLoading(false);
    }
  };

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Format price without currency (for price change display)
  const formatPrice = (amount) => {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  // Format percentage
  const formatPercentage = (percent) => {
    const formatted = Math.abs(percent).toFixed(2);
    if (percent > 0) {
      return `+${formatted}%`;
    } else if (percent < 0) {
      return `-${formatted}%`;
    }
    return `${formatted}%`;
  };

  // Get trend icon based on percentage change
  const getTrendIcon = (percent) => {
    if (percent > 0) {
      return <TrendingUp size={16} className="trend-up" />;
    } else if (percent < 0) {
      return <TrendingDown size={16} className="trend-down" />;
    }
    return <Minus size={16} className="trend-neutral" />;
  };

  // Effect to fetch data when modal opens
  useEffect(() => {
    if (isOpen && priceChangeDescription && priceChangeDate) {
      fetchAffectedProducts(priceChangeDescription, priceChangeDate);
    } else if (isOpen) {
      setError("Missing required parameters");
      setAffectedProducts([]);
    }
  }, [isOpen, priceChangeDescription, priceChangeDate]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="affected-products-modal">
        <div className="modal-header">
          <h2>Products Affected by Price Change</h2>
          <button className="close-btn" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {/* Price Change Info */}
          <div className="price-change-info">
            <h3>Price Change Details</h3>
            <div className="price-info">
              <span className="description">
                {priceChangeDescription}
              </span>
              <span className="date">
                Date: {priceChangeDate ? new Date(priceChangeDate).toLocaleString() : 'N/A'}
              </span>
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Calculating product impact...</p>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="error-state">
              <p>{error}</p>
            </div>
          )}

          {/* Results */}
          {!loading && !error && (
            <>
              {affectedProducts.length === 0 ? (
                <div className="no-results">
                  <p>No products found that use this material.</p>
                </div>
              ) : (
                <div className="results-section">
                  <div className="results-header">
                    <h3>Affected Products ({affectedProducts.length})</h3>
                    <p className="results-subtitle">
                      Products affected by the price change simulation
                    </p>
                  </div>

                  <div className="table-container">
                    {affectedProducts.length > 0 && (
                      <table className="affected-products-table">
                        <thead>
                          <tr>
                            <th>Product ID</th>
                            <th>Product Name</th>
                            <th>Material Cost Before</th>
                            <th>Material Cost After</th>
                            <th>HPP Before</th>
                            <th>HPP After</th>
                            <th>Impact</th>
                          </tr>
                        </thead>
                        <tbody>
                          {affectedProducts.map((product, index) => (
                            <tr key={index}>
                              <td className="product-id">{product.Product_ID}</td>
                              <td className="product-name">{product.Product_Name}</td>
                              <td className="material-cost-before">
                                {formatCurrency(parseFloat(product.totalBahanSebelum || 0))}
                              </td>
                              <td className="material-cost-after">
                                {formatCurrency(parseFloat(product.totalBahanSesudah || 0))}
                              </td>
                              <td className="hpp-before">
                                {formatCurrency(parseFloat(product.HPPSebelum || 0))}
                              </td>
                              <td className="hpp-after">
                                {formatCurrency(parseFloat(product.HPPSesudah || 0))}
                              </td>
                              <td className="impact-cell">
                                <div className="impact-indicator">
                                  {getTrendIcon(parseFloat(product.persentase_perubahan || 0))}
                                  <span
                                    className={`percentage ${
                                      parseFloat(product.persentase_perubahan || 0) > 0
                                        ? "increase"
                                        : parseFloat(product.persentase_perubahan || 0) < 0
                                        ? "decrease"
                                        : "neutral"
                                    }`}
                                  >
                                    {formatPercentage(parseFloat(product.persentase_perubahan || 0))}
                                  </span>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="modal-footer">
          <button className="close-button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default AffectedProductsModal;
