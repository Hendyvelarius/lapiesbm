import React, { useState, useEffect } from "react";
import { X, TrendingUp, TrendingDown, Minus, Download } from "lucide-react";
import { hppAPI, masterAPI } from "../services/api";
import LoadingSpinner from "./LoadingSpinner";
import "../styles/AffectedProductsModal.css";

const AffectedProductsModal = ({ isOpen, onClose, priceChangeDescription, priceChangeDate }) => {
  const [loading, setLoading] = useState(false);
  const [affectedProducts, setAffectedProducts] = useState([]);
  const [error, setError] = useState("");
  const [affectedMaterials, setAffectedMaterials] = useState([]);
  const [expandedProducts, setExpandedProducts] = useState(new Set());

  // Toggle product detail expansion
  const toggleProductExpansion = (productId) => {
    setExpandedProducts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        newSet.add(productId);
      }
      return newSet;
    });
  };

  // Fetch affected products using stored procedure
  const fetchAffectedProducts = async (description, simulasiDate) => {
    try {
      setLoading(true);
      setError("");

      const response = await hppAPI.getPriceChangeAffectedProducts(description, simulasiDate);

      if (response.success && response.data) {
        setAffectedProducts(response.data);
        
        // Also fetch affected materials information
        await fetchAffectedMaterials(description);
      } else {
        setError("Failed to fetch affected products");
        setAffectedProducts([]);
        setAffectedMaterials([]);
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

  // Format HPP ratio as percentage (e.g., 0.253779 -> 25.38%)
  const formatHPPRatio = (ratio) => {
    if (!ratio || isNaN(ratio)) return "0.00%";
    const percentage = (parseFloat(ratio) * 100).toFixed(2);
    return `${percentage}%`;
  };

  // Format HPP with currency and ratio (e.g., Rp 15.227 (25%))
  const formatHPPWithRatio = (hppAmount, ratio) => {
    const currency = formatCurrency(parseFloat(hppAmount || 0));
    const ratioPercent = formatHPPRatio(ratio);
    return `${currency} (${ratioPercent})`;
  };

  // Calculate Impact HNA: HPP Ratio After (%) - HPP Ratio Before (%)
  const calculateImpactHNA = (ratioHPPBefore, ratioHPPAfter) => {
    const ratioBefore = parseFloat(ratioHPPBefore || 0) * 100; // Convert to percentage
    const ratioAfter = parseFloat(ratioHPPAfter || 0) * 100;   // Convert to percentage
    
    return ratioAfter - ratioBefore; // Difference in percentage points
  };

  // Calculate overhead based on product LOB
  const calculateOverhead = (product) => {
    const lob = product.LOB;
    const version = product.Versi;

    if (lob === "ETHICAL" || lob === "OTC") {
      const processingCost = (parseFloat(product.MH_Proses_Std || 0) * parseFloat(product.Biaya_Proses || 0));
      const packagingCost = (parseFloat(product.MH_Kemas_Std || 0) * parseFloat(product.Biaya_Kemas || 0));
      const expiryCost = parseFloat(product.Beban_Sisa_Bahan_Exp || 0);
      return processingCost + packagingCost + expiryCost;
    } else if (lob === "GENERIC" && version === "1") {
      const ingredientsWeighing = (parseFloat(product.MH_Timbang_BB || 0) * parseFloat(product.Biaya_Proses || 0));
      const packagingWeighing = (parseFloat(product.MH_Timbang_BK || 0) * parseFloat(product.Biaya_Kemas || 0));
      const processingCost = (parseFloat(product.MH_Proses_Std || 0) * parseFloat(product.Biaya_Proses || 0));
      const packagingCost = (parseFloat(product.MH_Kemas_Std || 0) * parseFloat(product.Biaya_Kemas || 0));
      const analysisFee = (parseFloat(product.MH_Analisa_Std || 0) * parseFloat(product.Biaya_Generik || 0));
      const machineFee = (parseFloat(product.MH_Mesin_Std || 0) * parseFloat(product.Biaya_Generik || 0));
      const reagentFee = parseFloat(product.Biaya_Reagen || 0);
      const expiryCost = parseFloat(product.Beban_Sisa_Bahan_Exp || 0);
      return ingredientsWeighing + packagingWeighing + processingCost + packagingCost + analysisFee + machineFee + reagentFee + expiryCost;
    } else if (lob === "GENERIC" && version === "2") {
      const productionLabor = (parseFloat(product.MH_Proses_Std || 0) * parseFloat(product.Direct_Labor || 0));
      const packagingLabor = (parseFloat(product.MH_Kemas_Std || 0) * parseFloat(product.Direct_Labor || 0));
      const productionFOH = (parseFloat(product.MH_Proses_Std || 0) * parseFloat(product.Factory_Over_Head || 0));
      const packagingFOH = (parseFloat(product.MH_Kemas_Std || 0) * parseFloat(product.Factory_Over_Head || 0));
      const expiryCost = parseFloat(product.Beban_Sisa_Bahan_Exp || 0);
      return productionLabor + packagingLabor + productionFOH + packagingFOH + expiryCost;
    }
    
    return 0;
  };

  // Calculate margin value
  const calculateMarginValue = (product, materialCost) => {
    const lob = product.LOB;
    if (lob !== "ETHICAL" && lob !== "OTC") {
      return 0; // No margin for GENERIC products
    }

    const marginInput = parseFloat(product.Margin || 0);
    
    if (marginInput < 1 && marginInput > 0) {
      // It's a percentage
      const overhead = calculateOverhead(product);
      const subtotal = materialCost + overhead;
      return subtotal * marginInput; // Already in decimal form (0.1 = 10%)
    } else {
      // Direct value
      return marginInput;
    }
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

  // Extract material IDs from price change description
  const extractMaterialIds = (description) => {
    if (!description) return [];
    
    // Example descriptions:
    // "Price Changes : AC 009C: 4.8 -> 6; AC 015B: 19.8 -> 23;"
    // "Price Changes : IN 003: 22000 -> 32000;"
    
    const materialIds = [];
    
    // Find content after "Price Changes :" and before first ":"
    const afterPriceChanges = description.indexOf("Price Changes :");
    if (afterPriceChanges !== -1) {
      const startSearch = afterPriceChanges + "Price Changes :".length;
      const restOfString = description.substring(startSearch);
      
      // Split by ";" to get each price change entry
      const entries = restOfString.split(';');
      
      entries.forEach(entry => {
        const colonIndex = entry.indexOf(':');
        if (colonIndex !== -1) {
          // Get content before the first colon in this entry
          const materialId = entry.substring(0, colonIndex).trim();
          if (materialId) {
            materialIds.push(materialId);
          }
        }
      });
    }
    
    // Remove duplicates and return unique material IDs
    return [...new Set(materialIds)];
  };

  // Fetch material data and find affected materials
  const fetchAffectedMaterials = async (description) => {
    try {
      const materialIds = extractMaterialIds(description);
      
      if (materialIds.length === 0) {
        setAffectedMaterials([]);
        return;
      }

      // Fetch all materials from API
      const materialsResponse = await masterAPI.getMaterial();
      const allMaterials = materialsResponse || [];
      
      // Remove spaces from extracted IDs for comparison
      const normalizedExtractedIds = materialIds.map(id => id.replace(/\s/g, ''));
      
      // Find materials that match the extracted IDs (comparing without spaces)
      const matchedMaterials = allMaterials.filter(material => {
        const normalizedMaterialId = material.ITEM_ID.replace(/\s/g, '');
        return normalizedExtractedIds.includes(normalizedMaterialId);
      });

      setAffectedMaterials(matchedMaterials);
    } catch (error) {
      console.error('Error fetching affected materials:', error);
      setAffectedMaterials([]);
    }
  };

  // Export affected products to Excel
  const handleExportToExcel = async () => {
    try {
      if (!affectedProducts || affectedProducts.length === 0) {
        return;
      }

      // Import XLSX library dynamically
      const XLSX = await import('xlsx');

      // Create material names string from affected materials
      const materialNamesStr = affectedMaterials.length > 0 
        ? affectedMaterials.map(material => material.Item_Name || material.ITEM_NAME).join(', ')
        : 'Materials';

      // Create enhanced price change description with material names
      let enhancedDescription = priceChangeDescription || '';
      if (materialNamesStr && materialNamesStr !== 'Materials' && enhancedDescription.includes('Price Changes :')) {
        enhancedDescription = enhancedDescription.replace('Price Changes :', `${materialNamesStr} :`);
      }

      // Prepare data for Excel export with proper formatting
      const excelData = affectedProducts.map(product => ({
        'Product ID': product.Product_ID || '',
        'Product Name': product.Product_Name || '',
        'Material Cost Before': parseFloat(product.totalBahanSebelum || 0),
        'Material Cost After': parseFloat(product.totalBahanSesudah || 0),
        'Cost Change': parseFloat(product.totalBahanSesudah || 0) - parseFloat(product.totalBahanSebelum || 0),
        'HNA (Sales Price)': parseFloat(product.Product_SalesHNA || 0),
        'HPP Before': parseFloat(product.HPPSebelum || 0),
        'HPP After': parseFloat(product.HPPSesudah || 0),
        'HPP Change': parseFloat(product.HPPSesudah || 0) - parseFloat(product.HPPSebelum || 0),
        'HPP Ratio Before (%)': parseFloat(product.Rasio_HPP_Sebelum || 0) * 100,
        'HPP Ratio After (%)': parseFloat(product.Rasio_HPP_Sesudah || 0) * 100,
        'Impact HPP (%)': parseFloat(product.persentase_perubahan || 0),
        'Impact HNA (%)': calculateImpactHNA(product.Rasio_HPP_Sebelum, product.Rasio_HPP_Sesudah),
        'Price Change Description': enhancedDescription,
        'Price Change Date': priceChangeDate ? new Date(priceChangeDate).toLocaleDateString() : ''
      }));

      // Create a new workbook
      const workbook = XLSX.utils.book_new();

      // Create worksheet from data
      const worksheet = XLSX.utils.json_to_sheet(excelData);

      // Set column widths for better formatting
      const columnWidths = [
        { wch: 15 }, // Product ID
        { wch: 40 }, // Product Name
        { wch: 18 }, // Material Cost Before
        { wch: 18 }, // Material Cost After
        { wch: 15 }, // Cost Change
        { wch: 18 }, // HNA (Sales Price)
        { wch: 15 }, // HPP Before
        { wch: 15 }, // HPP After
        { wch: 15 }, // HPP Change
        { wch: 18 }, // HPP Ratio Before (%)
        { wch: 18 }, // HPP Ratio After (%)
        { wch: 14 }, // Impact HPP (%)
        { wch: 14 }, // Impact HNA (%)
        { wch: 30 }, // Price Change Description
        { wch: 18 }  // Price Change Date
      ];
      worksheet['!cols'] = columnWidths;

      // Apply header formatting
      const headerCells = ['A1', 'B1', 'C1', 'D1', 'E1', 'F1', 'G1', 'H1', 'I1', 'J1', 'K1', 'L1', 'M1', 'N1', 'O1'];
      headerCells.forEach(cell => {
        if (worksheet[cell]) {
          worksheet[cell].s = {
            font: { bold: true, color: { rgb: "FFFFFF" } },
            fill: { fgColor: { rgb: "366092" } },
            alignment: { horizontal: "center" }
          };
        }
      });

      // Apply number formatting to numeric columns
      const range = XLSX.utils.decode_range(worksheet['!ref']);
      for (let row = range.s.r + 1; row <= range.e.r; row++) {
        // Currency columns (C, D, E, F, G, H, I)
        ['C', 'D', 'E', 'F', 'G', 'H', 'I'].forEach(col => {
          const cellAddress = col + (row + 1);
          if (worksheet[cellAddress]) {
            worksheet[cellAddress].s = {
              numFmt: '#,##0.00',
              alignment: { horizontal: "right" }
            };
          }
        });
        
        // Percentage columns (J, K, L)
        ['J', 'K', 'L'].forEach(col => {
          const cellAddress = col + (row + 1);
          if (worksheet[cellAddress]) {
            worksheet[cellAddress].s = {
              numFmt: '0.00',
              alignment: { horizontal: "right" }
            };
          }
        });
      }

      // Add the worksheet to workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Affected Products');

      // Generate filename with current date and material names
      const dateStr = new Date().toISOString().split('T')[0];
      
      // Create a clean filename part from material names or fallback to description
      let fileNamePart = '';
      if (affectedMaterials.length > 0) {
        const materialNames = affectedMaterials.map(material => material.Item_Name || material.ITEM_NAME).join('_');
        fileNamePart = materialNames.replace(/[^a-zA-Z0-9_]/g, '_').substring(0, 50); // Limit length
      } else {
        fileNamePart = (priceChangeDescription || 'PriceChange').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
      }
      
      const fileName = `AffectedProducts_${fileNamePart}_${dateStr}.xlsx`;

      // Write and download the file
      XLSX.writeFile(workbook, fileName);

    } catch (error) {
      console.error('Error exporting affected products:', error);
      // You might want to show a user-friendly error message here
    }
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
          <div className="modal-header-actions">
            {!loading && !error && affectedProducts.length > 0 && (
              <button 
                className="export-btn" 
                onClick={handleExportToExcel}
                title="Export to Excel"
                aria-label="Export affected products to Excel"
              >
                <Download size={16} />
                <span>Export</span>
              </button>
            )}
            <button className="close-btn" onClick={onClose} aria-label="Close">
              <X size={20} />
            </button>
          </div>
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

          {/* Affected Materials Info */}
          {affectedMaterials.length > 0 && (
            <div className="affected-materials-info">
              <h3>Affected Materials</h3>
              <div className="materials-list">
                {affectedMaterials.map((material, index) => (
                  <div key={material.ITEM_ID} className="material-item">
                    <span className="material-id">{material.ITEM_ID}</span>
                    <span className="material-name">{material.Item_Name}</span>
                    <span className="material-type">{material.ITEM_TYPE}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <LoadingSpinner 
              message="Calculating product impact..." 
              size="medium"
              className="esbm-modal-loading"
            />
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
                      Produk yang terdampak simulasi perubahan harga. Persentase dalam kurung pada kolom HPP menunjukkan rasio HPP terhadap HNA (Harga Netto Akhir).
                    </p>
                  </div>

                  <div className="table-container">
                    {affectedProducts.length > 0 && (
                      <table className="affected-products-table">
                        <thead>
                          <tr>
                            <th style={{ width: "40px" }}>Details</th>
                            <th>ID</th>
                            <th>Product Name</th>
                            <th>Cost Before</th>
                            <th>Cost After</th>
                            <th>HNA</th>
                            <th>HPP Before</th>
                            <th>HPP After</th>
                            <th>Impact HPP</th>
                            <th>Impact HNA</th>
                          </tr>
                        </thead>
                        <tbody>
                          {affectedProducts.map((product, index) => {
                            const isExpanded = expandedProducts.has(product.Product_ID);
                            const materialBefore = parseFloat(product.totalBahanSebelum || 0);
                            const materialAfter = parseFloat(product.totalBahanSesudah || 0);
                            const overhead = calculateOverhead(product);
                            const marginBefore = calculateMarginValue(product, materialBefore);
                            const marginAfter = calculateMarginValue(product, materialAfter);
                            
                            return (
                              <React.Fragment key={index}>
                                <tr className={isExpanded ? "expanded" : ""}>
                                  <td>
                                    <button 
                                      className="expand-btn"
                                      onClick={() => toggleProductExpansion(product.Product_ID)}
                                      title={isExpanded ? "Hide details" : "Show details"}
                                    >
                                      {isExpanded ? "▼" : "▶"}
                                    </button>
                                  </td>
                                  <td className="product-id">{product.Product_ID}</td>
                                  <td className="product-name">{product.Product_Name}</td>
                                  <td className="material-cost-before">
                                    {formatCurrency(materialBefore + overhead + marginBefore)}
                                  </td>
                                  <td className="material-cost-after">
                                    {formatCurrency(materialAfter + overhead + marginAfter)}
                                  </td>
                                  <td className="hna">
                                    {formatCurrency(parseFloat(product.Product_SalesHNA || 0))}
                                  </td>
                                  <td className="hpp-before">
                                    {formatHPPWithRatio(product.HPPSebelum, product.Rasio_HPP_Sebelum)}
                                  </td>
                                  <td className="hpp-after">
                                    {formatHPPWithRatio(product.HPPSesudah, product.Rasio_HPP_Sesudah)}
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
                                  <td className="impact-hna-cell">
                                    <div className="impact-indicator">
                                      {(() => {
                                        const impactHNA = calculateImpactHNA(product.Rasio_HPP_Sebelum, product.Rasio_HPP_Sesudah);
                                        return (
                                          <>
                                            {getTrendIcon(impactHNA)}
                                            <span
                                              className={`percentage ${
                                                impactHNA > 0
                                                  ? "increase"
                                                  : impactHNA < 0
                                                  ? "decrease"
                                                  : "neutral"
                                              }`}
                                            >
                                              {formatPercentage(impactHNA)}
                                            </span>
                                          </>
                                        );
                                      })()}
                                    </div>
                                  </td>
                                </tr>
                                {isExpanded && (
                                  <tr className="detail-row">
                                    <td colSpan="10">
                                      <div className="product-detail-breakdown">
                                        <div className="breakdown-columns">
                                          <div className="breakdown-column">
                                            <h4>Cost Breakdown - Before</h4>
                                            <table className="breakdown-table">
                                              <tbody>
                                                <tr>
                                                  <td>Materials</td>
                                                  <td className="number">{formatCurrency(materialBefore)}</td>
                                                </tr>
                                                <tr>
                                                  <td>Overhead ({product.LOB} {product.Versi ? `V${product.Versi}` : ''})</td>
                                                  <td className="number">{formatCurrency(overhead)}</td>
                                                </tr>
                                                {(product.LOB === "ETHICAL" || product.LOB === "OTC") && (
                                                  <tr>
                                                    <td>Margin</td>
                                                    <td className="number">{formatCurrency(marginBefore)}</td>
                                                  </tr>
                                                )}
                                                <tr className="total-row">
                                                  <td><strong>Total</strong></td>
                                                  <td className="number"><strong>{formatCurrency(materialBefore + overhead + marginBefore)}</strong></td>
                                                </tr>
                                              </tbody>
                                            </table>
                                          </div>
                                          
                                          <div className="breakdown-column">
                                            <h4>Cost Breakdown - After</h4>
                                            <table className="breakdown-table">
                                              <tbody>
                                                <tr>
                                                  <td>Materials</td>
                                                  <td className="number">{formatCurrency(materialAfter)}</td>
                                                </tr>
                                                <tr>
                                                  <td>Overhead ({product.LOB} {product.Versi ? `V${product.Versi}` : ''})</td>
                                                  <td className="number">{formatCurrency(overhead)}</td>
                                                </tr>
                                                {(product.LOB === "ETHICAL" || product.LOB === "OTC") && (
                                                  <tr>
                                                    <td>Margin</td>
                                                    <td className="number">{formatCurrency(marginAfter)}</td>
                                                  </tr>
                                                )}
                                                <tr className="total-row">
                                                  <td><strong>Total</strong></td>
                                                  <td className="number"><strong>{formatCurrency(materialAfter + overhead + marginAfter)}</strong></td>
                                                </tr>
                                              </tbody>
                                            </table>
                                          </div>
                                          
                                          <div className="breakdown-column">
                                            <h4>Change</h4>
                                            <table className="breakdown-table">
                                              <tbody>
                                                <tr>
                                                  <td>Materials Change</td>
                                                  <td className="number">{formatCurrency(materialAfter - materialBefore)}</td>
                                                </tr>
                                                <tr>
                                                  <td>Overhead Change</td>
                                                  <td className="number">Rp 0</td>
                                                </tr>
                                                {(product.LOB === "ETHICAL" || product.LOB === "OTC") && (
                                                  <tr>
                                                    <td>Margin Change</td>
                                                    <td className="number">{formatCurrency(marginAfter - marginBefore)}</td>
                                                  </tr>
                                                )}
                                                <tr className="total-row">
                                                  <td><strong>Total Change</strong></td>
                                                  <td className="number"><strong>{formatCurrency((materialAfter + overhead + marginAfter) - (materialBefore + overhead + marginBefore))}</strong></td>
                                                </tr>
                                              </tbody>
                                            </table>
                                          </div>
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
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
