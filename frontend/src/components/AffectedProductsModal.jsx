import React, { useState, useEffect } from "react";
import { X, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { productsAPI } from "../services/api";
import "../styles/AffectedProductsModal.css";

const AffectedProductsModal = ({ isOpen, onClose, priceChangeDescription }) => {
  const [loading, setLoading] = useState(false);
  const [affectedProducts, setAffectedProducts] = useState([]);
  const [error, setError] = useState("");
  const [materialInfo, setMaterialInfo] = useState({
    materialId: "",
    newPrice: 0,
    oldPrice: 0,
  });

  // Parse the price change description to extract material ID and new price
  const parsePriceChangeDescription = (description) => {
    try {
      // Expected format: "Price Changes : IN 012A: 324.15 -> 500;"
      const regex =
        /Price Changes\s*:\s*([^:]+):\s*([\d.]+)\s*->\s*([\d.]+);?/i;
      const match = description.match(regex);

      if (match) {
        return {
          materialId: match[1].trim(),
          oldPrice: parseFloat(match[2]),
          newPrice: parseFloat(match[3]),
        };
      }

      throw new Error("Invalid price change format");
    } catch (err) {
      console.error("Failed to parse price change description:", err);
      return { materialId: "", oldPrice: 0, newPrice: 0 };
    }
  };

  // Calculate cost impact for affected products
  const calculateProductImpact = async (materialId, newPrice) => {
    try {
      setLoading(true);
      setError("");

      // Fetch all active formula details
      const formulaDetails = await productsAPI.getActiveFormulaDetails();

      // Filter materials that match the changed material ID
      const affectedMaterials = formulaDetails.filter(
        (item) => item.PPI_ItemID === materialId
      );

      if (affectedMaterials.length === 0) {
        setAffectedProducts([]);
        return;
      }

      // Group by Product_ID
      const productGroups = {};

      formulaDetails.forEach((item) => {
        const productId = item.Product_ID;
        if (!productGroups[productId]) {
          productGroups[productId] = {
            Product_ID: productId,
            Product_Name: item.Product_Name,
            BatchSize: item.BatchSize,
            materials: [],
          };
        }
        productGroups[productId].materials.push(item);
      });

      // Calculate impact for products that use the changed material
      const impactedProducts = [];

      Object.values(productGroups).forEach((product) => {
        const hasChangedMaterial = product.materials.some(
          (material) => material.PPI_ItemID === materialId
        );

        if (hasChangedMaterial) {
          // Find the specific material that's being changed to understand the price structure
          const changedMaterial = product.materials.find(
            (m) => m.PPI_ItemID === materialId
          );

          // Calculate original total cost
          const originalCost = product.materials.reduce((sum, material) => {
            return sum + (material.UnitPrice || 0);
          }, 0);

          // Calculate new total cost (with price change)
          const newCost = product.materials.reduce((sum, material) => {
            if (material.PPI_ItemID === materialId) {
              // Calculate the original price per unit from UnitPrice / PurchaseQTYUnit
              const originalPricePerUnit =
                (material.UnitPrice || 0) / (material.PurchaseQTYUnit || 1);

              // Check if we need currency conversion
              // If the original price per unit is much larger than oldPrice, there's likely a currency conversion
              const conversionFactor =
                originalPricePerUnit / (materialInfo.oldPrice || 1);

              // Apply the same conversion factor to the new price
              const adjustedNewPrice = newPrice * conversionFactor;
              const newUnitPrice =
                adjustedNewPrice * (material.PurchaseQTYUnit || 0);

              console.log(`Material ${materialId}:`, {
                oldUnitPrice: material.UnitPrice,
                oldPriceFromDescription: materialInfo.oldPrice,
                newPriceFromDescription: newPrice,
                purchaseQTY: material.PurchaseQTYUnit,
                originalPricePerUnit,
                conversionFactor,
                adjustedNewPrice,
                newUnitPrice,
              });

              return sum + newUnitPrice;
            } else {
              return sum + (material.UnitPrice || 0);
            }
          }, 0);

          console.log(`Product ${product.Product_ID}:`, {
            originalCost,
            newCost,
            difference: newCost - originalCost,
            percentChange:
              originalCost > 0
                ? ((newCost - originalCost) / originalCost) * 100
                : 0,
          });

          const originalCostPerUnit = originalCost / (product.BatchSize || 1);
          const newCostPerUnit = newCost / (product.BatchSize || 1);

          // Calculate percentage change
          let percentChange = 0;
          if (originalCost > 0) {
            percentChange = ((newCost - originalCost) / originalCost) * 100;
          }

          impactedProducts.push({
            Product_ID: product.Product_ID,
            Product_Name: product.Product_Name,
            BatchSize: product.BatchSize,
            originalCost,
            newCost,
            originalCostPerUnit,
            newCostPerUnit,
            percentChange,
          });
        }
      });

      // Sort by percentage change (highest impact first)
      impactedProducts.sort(
        (a, b) => Math.abs(b.percentChange) - Math.abs(a.percentChange)
      );

      setAffectedProducts(impactedProducts);
    } catch (err) {
      console.error("Error calculating product impact:", err);
      setError("Failed to calculate product impact. Please try again.");
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

  // Effect to parse description and fetch data when modal opens
  useEffect(() => {
    if (isOpen && priceChangeDescription) {
      const parsed = parsePriceChangeDescription(priceChangeDescription);
      setMaterialInfo(parsed);

      if (parsed.materialId && parsed.newPrice > 0) {
        calculateProductImpact(parsed.materialId, parsed.newPrice);
      } else {
        setError("Invalid price change description format");
        setAffectedProducts([]);
      }
    }
  }, [isOpen, priceChangeDescription]);

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
              <span className="material-id">
                Material ID: {materialInfo.materialId}
              </span>
              <span className="price-change">
                {formatPrice(materialInfo.oldPrice)} →{" "}
                {formatPrice(materialInfo.newPrice)}
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
                      Showing cost impact analysis for all products using
                      material {materialInfo.materialId}
                    </p>
                  </div>

                  <div className="table-container">
                    <table className="affected-products-table">
                      <thead>
                        <tr>
                          <th>ID</th>
                          <th>Product Name</th>
                          <th>Batch Size</th>
                          <th>Original Cost</th>
                          <th>Original Cost/Unit</th>
                          <th>New Cost</th>
                          <th>New Cost/Unit</th>
                          <th>Impact</th>
                        </tr>
                      </thead>
                      <tbody>
                        {affectedProducts.map((product, index) => (
                          <tr key={`${product.Product_ID}-${index}`}>
                            <td className="product-id">{product.Product_ID}</td>
                            <td className="product-name">
                              {product.Product_Name}
                            </td>
                            <td className="batch-size">
                              {product.BatchSize?.toLocaleString("id-ID")}
                            </td>
                            <td className="original-cost">
                              {formatCurrency(product.originalCost)}
                            </td>
                            <td className="original-cost-unit">
                              {formatCurrency(product.originalCostPerUnit)}
                            </td>
                            <td className="new-cost">
                              {formatCurrency(product.newCost)}
                            </td>
                            <td className="new-cost-unit">
                              {formatCurrency(product.newCostPerUnit)}
                            </td>
                            <td className="impact-cell">
                              <div className="impact-indicator">
                                {getTrendIcon(product.percentChange)}
                                <span
                                  className={`percentage ${
                                    product.percentChange > 0
                                      ? "increase"
                                      : product.percentChange < 0
                                      ? "decrease"
                                      : "neutral"
                                  }`}
                                >
                                  {formatPercentage(product.percentChange)}
                                </span>
                              </div>
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
