import React, { useState, useEffect, useMemo } from "react";
import { hppAPI } from "../services/api";
import { getCurrentUser } from "../utils/auth";
import AWN from "awesome-notifications";
import "awesome-notifications/dist/style.css";
import "../styles/CurrencySimulation.css";
import LoadingSpinner from "../components/LoadingSpinner";
import {
  ArrowRight,
  Coins,
  Search,
  CheckSquare,
  Square,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Play,
  RefreshCw,
} from "lucide-react";

const notifier = new AWN({
  position: "top-right",
  durations: { global: 5000 },
});

const CURRENCY_SYMBOLS = {
  IDR: "Rp",
  USD: "$",
  EUR: "€",
  CNY: "¥",
  RMB: "¥",
  JPY: "¥",
  SGD: "S$",
  MYR: "RM",
  THB: "฿",
};

const formatNumber = (value, decimals = 2) => {
  if (value === null || value === undefined || isNaN(value)) return "-";
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
};

const formatCurrency = (amount) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0);

const formatPercent = (value) => {
  if (value === null || value === undefined || isNaN(value)) return "-";
  const sign = value > 0 ? "+" : "";
  return `${sign}${parseFloat(value).toFixed(2)}%`;
};

// Props:
//   onBack       — called when the user wants to return to the HPP Simulation list
//   onViewList   — called from the results screen's "View detailed simulations" button
//                  (parent typically jumps to the Currency Changes tab on step 0)
export default function CurrencySimulation({ onBack, onViewList } = {}) {
  const currentUser = getCurrentUser();

  // Workflow step: 1 = pick currencies, 2 = preview impact / pick products, 3 = results
  const [step, setStep] = useState(1);

  // Currencies list + selection state
  const [currencies, setCurrencies] = useState([]);
  const [loadingCurrencies, setLoadingCurrencies] = useState(false);
  const [error, setError] = useState("");

  // Map of currCode -> { selected: bool, newKurs: string }
  const [currencyState, setCurrencyState] = useState({});

  // Scan results
  const [scanLoading, setScanLoading] = useState(false);
  const [affectedMaterials, setAffectedMaterials] = useState([]);
  const [affectedProducts, setAffectedProducts] = useState([]);
  const [selectedProductIds, setSelectedProductIds] = useState(new Set());
  const [productSearch, setProductSearch] = useState("");
  const [productLobFilter, setProductLobFilter] = useState("ALL");

  // Generation
  const [generating, setGenerating] = useState(false);
  const [resultRows, setResultRows] = useState([]);
  const [generationMeta, setGenerationMeta] = useState(null); // { description, simulasiDate }

  // Load currencies on mount
  useEffect(() => {
    loadCurrencies();
  }, []);

  const loadCurrencies = async () => {
    try {
      setLoadingCurrencies(true);
      setError("");
      const response = await hppAPI.getForeignCurrencies();
      const list = response.data || [];
      setCurrencies(list);

      // Initialize state map
      const initial = {};
      list.forEach((c) => {
        initial[c.Curr_Code] = {
          selected: false,
          newKurs: c.Kurs ? String(c.Kurs) : "",
        };
      });
      setCurrencyState(initial);
    } catch (err) {
      console.error("Failed to load currencies:", err);
      setError("Failed to load currency list. " + err.message);
    } finally {
      setLoadingCurrencies(false);
    }
  };

  const selectedCurrencyChanges = useMemo(() => {
    return currencies
      .filter((c) => currencyState[c.Curr_Code]?.selected)
      .map((c) => {
        const s = currencyState[c.Curr_Code];
        return {
          currCode: c.Curr_Code,
          currentKurs: parseFloat(c.Kurs) || 0,
          newKurs: parseFloat(s.newKurs) || 0,
        };
      });
  }, [currencies, currencyState]);

  const validChangesCount = selectedCurrencyChanges.filter(
    (c) => c.newKurs > 0 && c.newKurs !== c.currentKurs
  ).length;

  const toggleCurrency = (code) => {
    setCurrencyState((prev) => ({
      ...prev,
      [code]: { ...prev[code], selected: !prev[code]?.selected },
    }));
  };

  const updateNewKurs = (code, value) => {
    setCurrencyState((prev) => ({
      ...prev,
      [code]: { ...prev[code], newKurs: value },
    }));
  };

  // Filter products in step 2
  const filteredProducts = useMemo(() => {
    let list = affectedProducts;
    if (productLobFilter !== "ALL") {
      list = list.filter(
        (p) => (p.LOB || "").toUpperCase() === productLobFilter
      );
    }
    if (productSearch.trim()) {
      const q = productSearch.toLowerCase();
      list = list.filter(
        (p) =>
          (p.Product_Name || "").toLowerCase().includes(q) ||
          (p.Product_ID || "").toString().toLowerCase().includes(q)
      );
    }
    return list;
  }, [affectedProducts, productLobFilter, productSearch]);

  const allFilteredSelected =
    filteredProducts.length > 0 &&
    filteredProducts.every((p) => selectedProductIds.has(p.Product_ID));

  const toggleProduct = (productId) => {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  };

  const toggleAllFiltered = () => {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filteredProducts.forEach((p) => next.delete(p.Product_ID));
      } else {
        filteredProducts.forEach((p) => next.add(p.Product_ID));
      }
      return next;
    });
  };

  // Step 1 → Step 2: scan impact
  const handleScan = async () => {
    if (validChangesCount === 0) {
      setError(
        "Select at least one currency and enter a new rate that differs from the current rate."
      );
      return;
    }

    try {
      setScanLoading(true);
      setError("");
      const codes = selectedCurrencyChanges.map((c) => c.currCode);
      const response = await hppAPI.scanCurrencyImpact(codes);
      const data = response.data || {};
      const materials = data.materials || [];
      const products = data.products || [];

      setAffectedMaterials(materials);
      setAffectedProducts(products);
      // Default select all affected products
      setSelectedProductIds(new Set(products.map((p) => p.Product_ID)));

      if (products.length === 0) {
        notifier.warning(
          "No products are affected by the selected currencies."
        );
      }
      setStep(2);
    } catch (err) {
      console.error("Scan failed:", err);
      setError("Failed to scan impact: " + err.message);
    } finally {
      setScanLoading(false);
    }
  };

  // Step 2 → Step 3: generate simulation
  const handleGenerate = async () => {
    if (selectedProductIds.size === 0) {
      setError("Select at least one product to simulate.");
      return;
    }

    try {
      setGenerating(true);
      setError("");

      const validChanges = selectedCurrencyChanges
        .filter((c) => c.newKurs > 0 && c.newKurs !== c.currentKurs)
        .map((c) => ({ currCode: c.currCode, newKurs: c.newKurs }));

      const productIds = Array.from(selectedProductIds);

      const response = await hppAPI.generateCurrencyChangeSimulation(
        validChanges,
        productIds,
        currentUser?.logNIK || null
      );

      // The SP returns multiple recordsets; the last one is the impact rows.
      const recordsets = response.data?.recordsets || [];
      const impactRows = recordsets[recordsets.length - 1] || [];

      setResultRows(impactRows);

      // Try to fetch the freshly generated simulation group's description + date
      // so the user can drill into details via HPPSimulation if they want.
      try {
        // Build expected description from changes (matches SP format)
        const descBody = validChanges
          .map((c) => {
            const old = currencies.find((x) => x.Curr_Code === c.currCode)?.Kurs || 0;
            return `${c.currCode}: ${old} -> ${c.newKurs}; `;
          })
          .join("\n");
        const expectedDescription = "Currency Changes : " + descBody;
        setGenerationMeta({ description: expectedDescription });
      } catch {
        // Best-effort; not critical
      }

      notifier.success("Currency simulation generated successfully!");
      setStep(3);
    } catch (err) {
      console.error("Generation failed:", err);
      setError("Failed to generate simulation: " + err.message);
      notifier.alert("Failed to generate simulation: " + err.message);
    } finally {
      setGenerating(false);
    }
  };

  // Reset to start over
  const handleReset = () => {
    const initial = {};
    currencies.forEach((c) => {
      initial[c.Curr_Code] = {
        selected: false,
        newKurs: c.Kurs ? String(c.Kurs) : "",
      };
    });
    setCurrencyState(initial);
    setAffectedMaterials([]);
    setAffectedProducts([]);
    setSelectedProductIds(new Set());
    setResultRows([]);
    setGenerationMeta(null);
    setError("");
    setStep(1);
  };

  // Hand control back to the parent so it can show the Currency Changes tab
  const goToHPPSimulationList = () => {
    if (onViewList) onViewList();
    else if (onBack) onBack();
  };

  // ---- Render helpers ----

  const renderHeader = () => (
    <div className="cs-header">
      <div className="cs-header-title">
        {onBack && (
          <button className="cs-btn cs-btn-secondary cs-btn-sm" onClick={onBack} title="Back to simulation list">
            ← Back to List
          </button>
        )}
        <Coins size={28} className="cs-header-icon" />
        <div>
          <h1>Currency Simulation</h1>
          <p>
            Simulate the impact of changes in foreign exchange rates on
            material costs and finished-product HPP.
          </p>
        </div>
      </div>
      <div className="cs-step-indicator">
        {[1, 2, 3].map((n) => (
          <React.Fragment key={n}>
            <div
              className={`cs-step-dot ${step === n ? "active" : ""} ${
                step > n ? "done" : ""
              }`}
            >
              {step > n ? "✓" : n}
            </div>
            {n < 3 && <div className={`cs-step-line ${step > n ? "done" : ""}`} />}
          </React.Fragment>
        ))}
      </div>
    </div>
  );

  // STEP 1: select currencies + rates
  const renderStep1 = () => {
    if (loadingCurrencies) {
      return (
        <div className="cs-loading-block">
          <LoadingSpinner />
          <span>Loading currencies...</span>
        </div>
      );
    }

    if (currencies.length === 0) {
      return (
        <div className="cs-empty-state">
          <AlertCircle size={32} />
          <p>
            No foreign currencies found for the current year. Make sure currency
            rates are set up on the Currency master page.
          </p>
        </div>
      );
    }

    return (
      <div className="cs-step-body">
        <div className="cs-section-header">
          <h2>1. Choose currencies to simulate</h2>
          <p>
            Tick each currency and enter a new exchange rate (IDR per unit).
            IDR is the base currency and cannot be simulated.
          </p>
        </div>

        <div className="cs-currency-grid">
          {currencies.map((c) => {
            const state = currencyState[c.Curr_Code] || {};
            const current = parseFloat(c.Kurs) || 0;
            const next = parseFloat(state.newKurs) || 0;
            const diff = next - current;
            const diffPct = current ? (diff / current) * 100 : 0;
            return (
              <div
                key={c.Curr_Code}
                className={`cs-currency-card ${state.selected ? "selected" : ""}`}
              >
                <label className="cs-currency-toggle">
                  <input
                    type="checkbox"
                    checked={!!state.selected}
                    onChange={() => toggleCurrency(c.Curr_Code)}
                  />
                  <span className="cs-currency-code">
                    {CURRENCY_SYMBOLS[c.Curr_Code] || ""} {c.Curr_Code}
                  </span>
                  {c.Curr_Name && (
                    <span className="cs-currency-name">{c.Curr_Name}</span>
                  )}
                </label>

                <div className="cs-currency-rates">
                  <div className="cs-rate-row">
                    <span className="cs-rate-label">Current</span>
                    <span className="cs-rate-current">
                      Rp {formatNumber(current, 2)}
                    </span>
                  </div>
                  <div className="cs-rate-row">
                    <span className="cs-rate-label">New rate</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      disabled={!state.selected}
                      value={state.newKurs ?? ""}
                      onChange={(e) =>
                        updateNewKurs(c.Curr_Code, e.target.value)
                      }
                      className="cs-rate-input"
                      placeholder="0"
                    />
                  </div>
                  {state.selected && next > 0 && next !== current && (
                    <div
                      className={`cs-rate-delta ${
                        diff > 0 ? "up" : diff < 0 ? "down" : ""
                      }`}
                    >
                      {diff > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                      {formatPercent(diffPct)} ({diff > 0 ? "+" : ""}
                      Rp {formatNumber(diff, 2)})
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {error && (
          <div className="cs-error">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        <div className="cs-step-actions">
          <button
            className="cs-btn cs-btn-primary"
            onClick={handleScan}
            disabled={scanLoading || validChangesCount === 0}
          >
            {scanLoading ? (
              "Scanning..."
            ) : (
              <>
                <Search size={16} />
                Scan impact ({validChangesCount} currenc
                {validChangesCount === 1 ? "y" : "ies"})
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </div>
      </div>
    );
  };

  // STEP 2: review + pick products
  const renderStep2 = () => {
    // Group materials by currency for the summary
    const materialsByCurrency = affectedMaterials.reduce((acc, m) => {
      acc[m.ITEM_CURRENCY] = acc[m.ITEM_CURRENCY] || [];
      acc[m.ITEM_CURRENCY].push(m);
      return acc;
    }, {});

    const lobOptions = ["ALL", ...new Set(affectedProducts.map((p) => (p.LOB || "").toUpperCase()).filter(Boolean))];

    return (
      <div className="cs-step-body">
        <div className="cs-section-header">
          <h2>2. Review impact &amp; pick products</h2>
          <p>
            The currencies you selected affect the materials and products
            below. Choose which products to include in the simulation.
          </p>
        </div>

        {/* Summary cards */}
        <div className="cs-summary-row">
          <div className="cs-summary-card">
            <div className="cs-summary-label">Currencies changing</div>
            <div className="cs-summary-value">{validChangesCount}</div>
            <div className="cs-summary-sub">
              {selectedCurrencyChanges
                .filter((c) => c.newKurs > 0 && c.newKurs !== c.currentKurs)
                .map((c) => c.currCode)
                .join(", ")}
            </div>
          </div>
          <div className="cs-summary-card">
            <div className="cs-summary-label">Materials affected</div>
            <div className="cs-summary-value">{affectedMaterials.length}</div>
            <div className="cs-summary-sub">in selected currencies</div>
          </div>
          <div className="cs-summary-card">
            <div className="cs-summary-label">Products affected</div>
            <div className="cs-summary-value">{affectedProducts.length}</div>
            <div className="cs-summary-sub">
              {selectedProductIds.size} selected
            </div>
          </div>
        </div>

        {/* Affected materials by currency (collapsible-ish, just a flat block per currency) */}
        {affectedMaterials.length > 0 && (
          <div className="cs-materials-block">
            <h3>Affected materials</h3>
            <div className="cs-materials-by-currency">
              {Object.entries(materialsByCurrency).map(([curr, mats]) => (
                <details key={curr} className="cs-currency-details">
                  <summary>
                    <span className="cs-curr-pill">{curr}</span>
                    <span className="cs-curr-count">
                      {mats.length} material{mats.length !== 1 ? "s" : ""}
                    </span>
                  </summary>
                  <div className="cs-materials-list">
                    {mats.map((m) => (
                      <div key={m.ITEM_ID} className="cs-material-item">
                        <div className="cs-material-id">{m.ITEM_ID}</div>
                        <div className="cs-material-name">{m.Item_Name}</div>
                        <div className="cs-material-price">
                          {curr} {formatNumber(m.ITEM_PURCHASE_STD_PRICE, 4)} /{" "}
                          {m.ITEM_PURCHASE_UNIT}
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          </div>
        )}

        {/* Product selection */}
        {affectedProducts.length === 0 ? (
          <div className="cs-empty-state">
            <AlertCircle size={32} />
            <p>
              No products are currently affected by the selected currency
              changes. Go back and pick different currencies.
            </p>
          </div>
        ) : (
          <div className="cs-products-block">
            <div className="cs-products-header">
              <h3>Affected products</h3>
              <div className="cs-products-controls">
                <div className="cs-search-wrapper">
                  <Search size={14} />
                  <input
                    type="text"
                    placeholder="Search by product name or code..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                  />
                </div>
                {lobOptions.length > 1 && (
                  <select
                    className="cs-lob-select"
                    value={productLobFilter}
                    onChange={(e) => setProductLobFilter(e.target.value)}
                  >
                    {lobOptions.map((lob) => (
                      <option key={lob} value={lob}>
                        {lob}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  className="cs-btn cs-btn-secondary cs-btn-sm"
                  onClick={toggleAllFiltered}
                >
                  {allFilteredSelected ? (
                    <>
                      <Square size={14} /> Deselect all
                    </>
                  ) : (
                    <>
                      <CheckSquare size={14} /> Select all
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="cs-products-table-wrap">
              <table className="cs-products-table">
                <thead>
                  <tr>
                    <th style={{ width: 36 }}></th>
                    <th>Product ID</th>
                    <th>Product Name</th>
                    <th>LOB</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((p) => {
                    const isSel = selectedProductIds.has(p.Product_ID);
                    return (
                      <tr
                        key={p.Product_ID}
                        className={isSel ? "selected" : ""}
                        onClick={() => toggleProduct(p.Product_ID)}
                      >
                        <td>
                          <input
                            type="checkbox"
                            checked={isSel}
                            onChange={() => toggleProduct(p.Product_ID)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </td>
                        <td className="mono">{p.Product_ID}</td>
                        <td>{p.Product_Name}</td>
                        <td>{p.LOB}</td>
                      </tr>
                    );
                  })}
                  {filteredProducts.length === 0 && (
                    <tr>
                      <td colSpan="4" className="cs-empty-cell">
                        No products match the current filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {error && (
          <div className="cs-error">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        <div className="cs-step-actions">
          <button
            className="cs-btn cs-btn-secondary"
            onClick={() => setStep(1)}
            disabled={generating}
          >
            ← Back
          </button>
          <button
            className="cs-btn cs-btn-primary"
            onClick={handleGenerate}
            disabled={generating || selectedProductIds.size === 0}
          >
            {generating ? (
              "Generating..."
            ) : (
              <>
                <Play size={16} />
                Generate simulation ({selectedProductIds.size} product
                {selectedProductIds.size === 1 ? "" : "s"})
              </>
            )}
          </button>
        </div>
      </div>
    );
  };

  // STEP 3: results
  const renderStep3 = () => {
    const rowsWithImpact = resultRows.map((r) => {
      const before = parseFloat(r.HPPSebelum) || 0;
      const after = parseFloat(r.HPPSesudah) || 0;
      const change = after - before;
      const changePct = before ? (change / before) * 100 : 0;
      return { ...r, _before: before, _after: after, _change: change, _changePct: changePct };
    });

    const totalsBefore = rowsWithImpact.reduce((s, r) => s + r._before, 0);
    const totalsAfter = rowsWithImpact.reduce((s, r) => s + r._after, 0);
    const totalsChange = totalsAfter - totalsBefore;
    const increased = rowsWithImpact.filter((r) => r._change > 0).length;
    const decreased = rowsWithImpact.filter((r) => r._change < 0).length;

    return (
      <div className="cs-step-body">
        <div className="cs-section-header">
          <h2>3. Simulation results</h2>
          <p>
            Generated {rowsWithImpact.length} product simulation
            {rowsWithImpact.length === 1 ? "" : "s"}. Click any product to view
            the full ingredient and overhead breakdown in HPP Simulation.
          </p>
        </div>

        <div className="cs-summary-row">
          <div className="cs-summary-card">
            <div className="cs-summary-label">HPP increased</div>
            <div className="cs-summary-value" style={{ color: "#ef4444" }}>
              {increased}
            </div>
          </div>
          <div className="cs-summary-card">
            <div className="cs-summary-label">HPP decreased</div>
            <div className="cs-summary-value" style={{ color: "#10b981" }}>
              {decreased}
            </div>
          </div>
          <div className="cs-summary-card">
            <div className="cs-summary-label">Aggregate change</div>
            <div
              className="cs-summary-value"
              style={{ color: totalsChange > 0 ? "#ef4444" : totalsChange < 0 ? "#10b981" : "#64748b" }}
            >
              {totalsChange > 0 ? "+" : ""}
              {formatCurrency(totalsChange)}
            </div>
            <div className="cs-summary-sub">
              total HPP: {formatCurrency(totalsBefore)} → {formatCurrency(totalsAfter)}
            </div>
          </div>
        </div>

        <div className="cs-products-table-wrap">
          <table className="cs-results-table">
            <thead>
              <tr>
                <th>Product ID</th>
                <th>Product Name</th>
                <th className="num">HPP Before</th>
                <th className="num">HPP After</th>
                <th className="num">Change</th>
                <th className="num">Impact</th>
              </tr>
            </thead>
            <tbody>
              {rowsWithImpact.map((r) => (
                <tr key={r.Product_ID}>
                  <td className="mono">{r.Product_ID}</td>
                  <td>{r.Product_Name}</td>
                  <td className="num">{formatCurrency(r._before)}</td>
                  <td className="num">{formatCurrency(r._after)}</td>
                  <td
                    className={`num ${
                      r._change > 0 ? "neg" : r._change < 0 ? "pos" : ""
                    }`}
                  >
                    {r._change > 0 ? "+" : ""}
                    {formatCurrency(r._change)}
                  </td>
                  <td
                    className={`num ${
                      r._changePct > 0 ? "neg" : r._changePct < 0 ? "pos" : ""
                    }`}
                  >
                    {formatPercent(r._changePct)}
                  </td>
                </tr>
              ))}
              {rowsWithImpact.length === 0 && (
                <tr>
                  <td colSpan="6" className="cs-empty-cell">
                    No impact rows returned by the SP.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="cs-step-actions">
          <button className="cs-btn cs-btn-secondary" onClick={handleReset}>
            <RefreshCw size={16} /> Run another simulation
          </button>
          <button className="cs-btn cs-btn-primary" onClick={goToHPPSimulationList}>
            View detailed simulations in HPP Simulation →
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="cs-page">
      {renderHeader()}
      <div className="cs-content">
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
      </div>
    </div>
  );
}
