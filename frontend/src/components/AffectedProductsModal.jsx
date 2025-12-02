import React, { useState, useEffect, useRef } from "react";
import { X, TrendingUp, TrendingDown, Minus, Download } from "lucide-react";
import { hppAPI, masterAPI } from "../services/api";
import LoadingSpinner from "./LoadingSpinner";
import "../styles/AffectedProductsModal.css";

const AffectedProductsModal = ({ isOpen, onClose, priceChangeDescription, priceChangeDate, priceUpdateMode = false }) => {
  const [loading, setLoading] = useState(false);
  const [affectedProducts, setAffectedProducts] = useState([]);
  const [error, setError] = useState("");
  const [affectedMaterials, setAffectedMaterials] = useState([]);
  const [expandedProducts, setExpandedProducts] = useState(new Set());
  const [isExporting, setIsExporting] = useState(false);
  const modalContentRef = useRef(null);

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

      // Both Price Change and Price Update use the same parameters: description and simulasiDate
      const response = priceUpdateMode
        ? await hppAPI.getPriceUpdateAffectedProducts(description, simulasiDate)
        : await hppAPI.getPriceChangeAffectedProducts(description, simulasiDate);

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

      // Remove duplicates by creating a Map with ITEM_ID as key
      const uniqueMaterialsMap = new Map();
      matchedMaterials.forEach(material => {
        if (!uniqueMaterialsMap.has(material.ITEM_ID)) {
          uniqueMaterialsMap.set(material.ITEM_ID, material);
        }
      });
      
      const uniqueMaterials = Array.from(uniqueMaterialsMap.values());
      setAffectedMaterials(uniqueMaterials);
    } catch (error) {
      console.error('Error fetching affected materials:', error);
      setAffectedMaterials([]);
    }
  };

  // Export affected products to PDF
  const handleExportToPDF = async () => {
    try {
      if (!affectedProducts || affectedProducts.length === 0) {
        return;
      }

      setIsExporting(true);
      
      // Save current expanded state
      const previousExpandedProducts = new Set(expandedProducts);
      
      // Expand all products for export
      const allProductIds = affectedProducts.map(p => p.Product_ID);
      setExpandedProducts(new Set(allProductIds));
      
      // Wait for DOM to update
      await new Promise(resolve => setTimeout(resolve, 300));

      // Import jsPDF and html2canvas dynamically
      const jsPDF = (await import('jspdf')).default;
      const html2canvas = (await import('html2canvas')).default;

      // Get references to the modal elements
      const modalElement = modalContentRef.current;
      const modalContainer = modalElement?.closest('.affected-products-modal');
      const tableContainers = modalElement?.querySelectorAll('.table-container');
      
      if (!modalElement || !modalContainer) {
        console.error('Modal content ref not found');
        setIsExporting(false);
        return;
      }

      // Save original styles
      const originalModalBodyOverflow = modalElement.style.overflow;
      const originalModalBodyMaxHeight = modalElement.style.maxHeight;
      const originalModalBodyHeight = modalElement.style.height;
      const originalModalBodyMinHeight = modalElement.style.minHeight;
      const originalModalContainerMaxHeight = modalContainer.style.maxHeight;
      const originalModalContainerOverflow = modalContainer.style.overflow;
      const originalModalContainerMinHeight = modalContainer.style.minHeight;
      
      // Save table container styles
      const originalTableStyles = Array.from(tableContainers).map(tc => ({
        overflow: tc.style.overflow,
        overflowX: tc.style.overflowX,
        overflowY: tc.style.overflowY
      }));
      
      // Temporarily remove scroll constraints for full capture
      modalElement.style.overflow = 'visible';
      modalElement.style.maxHeight = 'none';
      modalElement.style.height = 'auto';
      modalContainer.style.maxHeight = 'none';
      modalContainer.style.overflow = 'visible';
      
      // Remove table scrolling to show full content
      tableContainers.forEach(tc => {
        tc.style.overflow = 'visible';
        tc.style.overflowX = 'visible';
        tc.style.overflowY = 'visible';
      });
      
      // Wait for layout to settle and content to expand
      await new Promise(resolve => setTimeout(resolve, 500));

      // Force the element to expand to its full scrollable height
      const fullHeight = modalElement.scrollHeight + 100; // Add buffer
      const fullWidth = modalElement.scrollWidth + 50;
      
      // Set explicit dimensions to force full expansion
      modalElement.style.minHeight = `${fullHeight}px`;
      modalContainer.style.minHeight = `${fullHeight}px`;
      
      // Wait a bit more for the forced expansion
      await new Promise(resolve => setTimeout(resolve, 200));

      console.log('Capturing modal - Full dimensions:', fullWidth, 'x', fullHeight);

      // Capture the content as canvas with full dimensions
      const canvas = await html2canvas(modalElement, {
        scale: 1.5,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: fullWidth,
        height: fullHeight,
        scrollY: -window.scrollY,
        scrollX: -window.scrollX
      });

      // Restore original styles
      modalElement.style.overflow = originalModalBodyOverflow;
      modalElement.style.maxHeight = originalModalBodyMaxHeight;
      modalElement.style.height = originalModalBodyHeight;
      modalElement.style.minHeight = originalModalBodyMinHeight;
      modalContainer.style.maxHeight = originalModalContainerMaxHeight;
      modalContainer.style.overflow = originalModalContainerOverflow;
      modalContainer.style.minHeight = originalModalContainerMinHeight;
      
      // Restore table container styles
      tableContainers.forEach((tc, index) => {
        if (originalTableStyles[index]) {
          tc.style.overflow = originalTableStyles[index].overflow;
          tc.style.overflowX = originalTableStyles[index].overflowX;
          tc.style.overflowY = originalTableStyles[index].overflowY;
        }
      });

      console.log('Canvas captured - Dimensions:', canvas.width, 'x', canvas.height);

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'px',
        format: [canvas.width, canvas.height],
        compress: true
      });

      // Add the full canvas as a single image
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);

      // Generate filename
      const dateStr = new Date().toISOString().split('T')[0];
      let fileNamePart = '';
      if (affectedMaterials.length > 0) {
        const materialNames = affectedMaterials.map(material => material.Item_Name || material.ITEM_NAME).join('_');
        fileNamePart = materialNames.replace(/[^a-zA-Z0-9_]/g, '_').substring(0, 50);
      } else {
        fileNamePart = (priceChangeDescription || 'PriceChange').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
      }
      
      const fileName = `AffectedProducts_${fileNamePart}_${dateStr}.pdf`;

      // Save PDF
      pdf.save(fileName);
      
      // Restore previous expanded state
      setExpandedProducts(previousExpandedProducts);
      setIsExporting(false);

    } catch (error) {
      console.error('Error exporting affected products to PDF:', error);
      setIsExporting(false);
      alert('Failed to export PDF. Please try again.');
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
          <h2>Products Affected by {priceUpdateMode ? 'Price Update' : 'Price Change'}</h2>
          <div className="modal-header-actions">
            {!loading && !error && affectedProducts.length > 0 && (
              <button 
                className="export-btn" 
                onClick={handleExportToPDF}
                disabled={isExporting}
                title="Export to PDF"
                aria-label="Export affected products to PDF"
              >
                <Download size={16} />
                <span>{isExporting ? 'Exporting...' : 'Export PDF'}</span>
              </button>
            )}
            <button className="close-btn" onClick={onClose} aria-label="Close">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="modal-body" ref={modalContentRef}>
          {/* Price Change/Update Info */}
          <div className="price-change-info">
            <h3>{priceUpdateMode ? 'Price Update Details' : 'Price Change Details'}</h3>
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
