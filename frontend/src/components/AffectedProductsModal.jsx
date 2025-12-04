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
  const [isExporting, setIsExporting] = useState(false);
  const modalContentRef = useRef(null);

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

  // Export affected products to PDF - optimized for large datasets
  const handleExportToPDF = async () => {
    try {
      if (!affectedProducts || affectedProducts.length === 0) {
        return;
      }

      setIsExporting(true);
      
      // Import jsPDF dynamically
      const jsPDF = (await import('jspdf')).default;

      // Create PDF in landscape mode for better table fit
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const usableWidth = pageWidth - (margin * 2);
      let yPosition = margin;

      // Helper function to add new page if needed
      const checkNewPage = (neededHeight) => {
        if (yPosition + neededHeight > pageHeight - margin) {
          pdf.addPage();
          yPosition = margin;
          return true;
        }
        return false;
      };

      // Set font
      pdf.setFont('helvetica');

      // Title
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`Products Affected by ${priceUpdateMode ? 'Price Update' : 'Price Change'}`, margin, yPosition + 6);
      yPosition += 12;

      // Price change description
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      const descText = priceChangeDescription || 'N/A';
      const descLines = pdf.splitTextToSize(descText, usableWidth);
      pdf.text(descLines, margin, yPosition + 4);
      yPosition += (descLines.length * 4) + 6;

      // Date
      pdf.setFontSize(8);
      pdf.text(`Date: ${priceChangeDate ? new Date(priceChangeDate).toLocaleString() : 'N/A'}`, margin, yPosition + 3);
      yPosition += 8;

      // Affected Materials section
      if (affectedMaterials.length > 0) {
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Affected Materials:', margin, yPosition + 4);
        yPosition += 6;

        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'normal');
        affectedMaterials.forEach((material) => {
          checkNewPage(5);
          const matText = `• ${material.ITEM_ID} - ${material.Item_Name} (${material.ITEM_TYPE})`;
          pdf.text(matText, margin + 2, yPosition + 3);
          yPosition += 4;
        });
        yPosition += 4;
      }

      // Products table header
      checkNewPage(20);
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`Affected Products (${affectedProducts.length})`, margin, yPosition + 5);
      yPosition += 10;

      // Table configuration - 10 columns with Change column added
      const colWidths = [22, 48, 26, 26, 26, 26, 32, 32, 20, 19]; // Adjusted widths to fit A4 landscape (277mm usable)
      const colHeaders = ['ID', 'Product Name', 'Cost Before', 'Cost After', 'Change', 'HNA', 'HPP Before', 'HPP After', 'Impact HPP', 'Impact HNA'];
      const rowHeight = 6;
      const headerHeight = 8;

      // Draw table header
      const drawTableHeader = () => {
        pdf.setFillColor(66, 139, 202); // Blue header
        pdf.rect(margin, yPosition, usableWidth, headerHeight, 'F');
        
        pdf.setFontSize(7);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(255, 255, 255);
        
        let xPos = margin + 1;
        colHeaders.forEach((header, i) => {
          pdf.text(header, xPos, yPosition + 5);
          xPos += colWidths[i];
        });
        
        pdf.setTextColor(0, 0, 0);
        yPosition += headerHeight;
      };

      drawTableHeader();

      // Draw table rows
      pdf.setFontSize(7);
      pdf.setFont('helvetica', 'normal');

      affectedProducts.forEach((product, index) => {
        // Check if we need a new page
        if (checkNewPage(rowHeight + 2)) {
          drawTableHeader();
        }

        // Alternate row colors
        if (index % 2 === 0) {
          pdf.setFillColor(245, 245, 245);
          pdf.rect(margin, yPosition, usableWidth, rowHeight, 'F');
        }

        // Calculate values
        const materialBefore = parseFloat(product.totalBahanSebelum || 0);
        const materialAfter = parseFloat(product.totalBahanSesudah || 0);
        const overhead = calculateOverhead(product);
        const marginBefore = calculateMarginValue(product, materialBefore);
        const marginAfter = calculateMarginValue(product, materialAfter);
        const costBefore = materialBefore + overhead + marginBefore;
        const costAfter = materialAfter + overhead + marginAfter;
        const costChange = costAfter - costBefore;
        const hna = parseFloat(product.Product_SalesHNA || 0);
        const hppBefore = parseFloat(product.HPPSebelum || 0);
        const hppAfter = parseFloat(product.HPPSesudah || 0);
        const impactHPP = parseFloat(product.persentase_perubahan || 0);
        const impactHNA = calculateImpactHNA(product.Rasio_HPP_Sebelum, product.Rasio_HPP_Sesudah);

        // Format helper
        const fmtCurrency = (val) => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(val);
        const fmtCurrencyWithSign = (val) => {
          const formatted = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Math.abs(val));
          return val > 0 ? `+${formatted}` : val < 0 ? `-${formatted}` : formatted;
        };
        const fmtPercent = (val) => {
          const abs = Math.abs(val).toFixed(2);
          return val > 0 ? `+${abs}%` : val < 0 ? `-${abs}%` : `${abs}%`;
        };
        const fmtHPPRatio = (hpp, ratio) => {
          const hppStr = fmtCurrency(hpp);
          const ratioStr = ratio ? `${(parseFloat(ratio) * 100).toFixed(1)}%` : '0%';
          return `${hppStr} (${ratioStr})`;
        };

        // Truncate product name if too long
        const productName = product.Product_Name || '';
        const maxNameLen = 30;
        const truncatedName = productName.length > maxNameLen 
          ? productName.substring(0, maxNameLen - 2) + '..' 
          : productName;

        // Row data - 10 columns with Change added after Cost After
        const rowData = [
          product.Product_ID || '',
          truncatedName,
          fmtCurrency(costBefore),
          fmtCurrency(costAfter),
          fmtCurrencyWithSign(costChange),
          fmtCurrency(hna),
          fmtHPPRatio(hppBefore, product.Rasio_HPP_Sebelum),
          fmtHPPRatio(hppAfter, product.Rasio_HPP_Sesudah),
          fmtPercent(impactHPP),
          fmtPercent(impactHNA)
        ];

        // Draw row
        let xPos = margin + 1;
        rowData.forEach((cell, i) => {
          // Color code for Change column (index 4) and impact columns (8 and 9)
          if (i === 4) {
            // Change column - red for positive (cost increase), green for negative (cost decrease)
            if (costChange > 0) pdf.setTextColor(220, 53, 69); // Red for increase
            else if (costChange < 0) pdf.setTextColor(40, 167, 69); // Green for decrease
            else pdf.setTextColor(108, 117, 125); // Gray for neutral
          } else if (i === 8 || i === 9) {
            const val = i === 8 ? impactHPP : impactHNA;
            if (val > 0) pdf.setTextColor(220, 53, 69); // Red for increase
            else if (val < 0) pdf.setTextColor(40, 167, 69); // Green for decrease
            else pdf.setTextColor(108, 117, 125); // Gray for neutral
          }
          
          pdf.text(String(cell), xPos, yPosition + 4);
          pdf.setTextColor(0, 0, 0); // Reset color
          xPos += colWidths[i];
        });

        yPosition += rowHeight;

        // Draw light border
        pdf.setDrawColor(200, 200, 200);
        pdf.line(margin, yPosition, margin + usableWidth, yPosition);
      });

      // Footer with generation info
      checkNewPage(10);
      yPosition += 5;
      pdf.setFontSize(7);
      pdf.setTextColor(128, 128, 128);
      pdf.text(`Generated on ${new Date().toLocaleString()} | Total: ${affectedProducts.length} products`, margin, yPosition + 3);

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
                            <th>ID</th>
                            <th>Product Name</th>
                            <th>Cost Before</th>
                            <th>Cost After</th>
                            <th>Change</th>
                            <th>HNA</th>
                            <th>HPP Before</th>
                            <th>HPP After</th>
                            <th>Impact HPP</th>
                            <th>Impact HNA</th>
                          </tr>
                        </thead>
                        <tbody>
                          {affectedProducts.map((product, index) => {
                            const materialBefore = parseFloat(product.totalBahanSebelum || 0);
                            const materialAfter = parseFloat(product.totalBahanSesudah || 0);
                            const overhead = calculateOverhead(product);
                            const marginBefore = calculateMarginValue(product, materialBefore);
                            const marginAfter = calculateMarginValue(product, materialAfter);
                            const costBefore = materialBefore + overhead + marginBefore;
                            const costAfter = materialAfter + overhead + marginAfter;
                            const costChange = costAfter - costBefore;
                            
                            return (
                              <tr key={index}>
                                <td className="product-id">{product.Product_ID}</td>
                                <td className="product-name">{product.Product_Name}</td>
                                <td className="material-cost-before">
                                  {formatCurrency(costBefore)}
                                </td>
                                <td className="material-cost-after">
                                  {formatCurrency(costAfter)}
                                </td>
                                <td className={`cost-change ${costChange > 0 ? 'increase' : costChange < 0 ? 'decrease' : 'neutral'}`}>
                                  {costChange > 0 ? '+' : ''}{formatCurrency(costChange)}
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
