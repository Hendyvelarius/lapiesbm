import React, { useState, useEffect, useMemo, useRef } from "react";
import { useLocation } from "react-router";
import { masterAPI, productsAPI, hppAPI } from "../services/api";
import AWN from "awesome-notifications";
import "awesome-notifications/dist/style.css";
import "../styles/HPPSimulation.css";
import "../styles/ProductHPPReport.css"; // Import for modal styling
import LoadingSpinner from "../components/LoadingSpinner";
import ProductHPPReport from "../components/ProductHPPReport";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import {
  FileDown,
  Printer,
  Edit,
  Trash2,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  BarChart3,
  Trash,
  Copy,
  Eye,
} from "lucide-react";
import AffectedProductsModal from "../components/AffectedProductsModal";

// Initialize awesome-notifications
const notifier = new AWN({
  position: "top-right",
  durations: {
    global: 5000,
  },
});

// Utility functions
const formatNumber = (value, decimals = 2) => {
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
};

// Format HNA currency (e.g., 690000.0000 -> Rp 690.000,00)
const formatHNA = (hnaValue) => {
  if (!hnaValue || isNaN(hnaValue)) return "Rp 0,00";
  return `Rp ${formatNumber(parseFloat(hnaValue), 2)}`;
};

// Format HPP ratio as percentage (e.g., 0.042166 -> 4.22%)
const formatHPPRatio = (ratio) => {
  if (!ratio || isNaN(ratio)) return "0,00%";
  const percentage = (parseFloat(ratio) * 100).toFixed(2);
  return `${percentage.replace('.', ',')}%`;
};

// Format cost per unit with HPP ratio (e.g., Rp 29.094,58 (4.22%))
const formatCostPerUnitWithRatio = (cost, ratio) => {
  const costFormatted = `Rp ${formatNumber(cost, 2)}`;
  const ratioFormatted = formatHPPRatio(ratio);
  return `${costFormatted} (${ratioFormatted})`;
};

// Normalize LOB values from database to UI format
const normalizeLOB = (databaseLOB) => {
  if (databaseLOB === "GENERIK") return "GENERIC";
  return databaseLOB;
};

// Create a unique group key for Price Change simulations based on description and date/time
const createPriceChangeGroupKey = (description, simulasiDate) => {
  const desc = description || "No Description";
  // Format date to minute precision for grouping
  // This ensures simulations with same description but different minutes are in separate groups
  const date = new Date(simulasiDate);
  const dateKey = date.toISOString().substring(0, 16); // YYYY-MM-DDTHH:MM format
  return `${desc}|${dateKey}`;
};

  // Extract description from group key
  const getDescriptionFromGroupKey = (groupKey) => {
    return groupKey.split('|')[0];
  };

  // Extract formatted date from group key for display
  const getDateFromGroupKey = (groupKey) => {
    const dateStr = groupKey.split('|')[1];
    const date = new Date(dateStr);
    return date.toLocaleString('id-ID', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Extract material IDs from price change description (reused from AffectedProductsModal)
  const extractMaterialIds = (description) => {
    if (!description) return [];
    
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

export default function HPPSimulation() {
  const [step, setStep] = useState(0); // Start with simulation list view
  const [simulationType, setSimulationType] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const [productOptions, setProductOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Simulation list state
  const [simulationList, setSimulationList] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState("");
  const [isEditMode, setIsEditMode] = useState(false); // Track if we're editing an existing simulation

  // Tab state for grouping simulations by type
  const [activeTab, setActiveTab] = useState("existing"); // 'existing', 'custom', or 'price-change'

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredSimulationList, setFilteredSimulationList] = useState([]);

  // Ref for table container scroll detection
  const tableContainerRef = useRef(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20); // Show 20 simulations per page
  const [paginatedSimulations, setPaginatedSimulations] = useState([]);

  // Sorting state
  const [sortField, setSortField] = useState("Simulasi_Date"); // Default sort by date
  const [sortDirection, setSortDirection] = useState("desc"); // Default newest first

  // Price Change grouping state
  const [expandedGroups, setExpandedGroups] = useState(new Set()); // Track which price change groups are expanded
  const [groupedSimulations, setGroupedSimulations] = useState({}); // Store grouped simulations

  // Affected Products Modal state
  const [affectedProductsModalOpen, setAffectedProductsModalOpen] =
    useState(false);
  const [selectedPriceChangeDescription, setSelectedPriceChangeDescription] =
    useState("");
  const [selectedPriceChangeDate, setSelectedPriceChangeDate] = useState("");

  // Material names cache for Price Changes groups
  const [groupMaterialNames, setGroupMaterialNames] = useState({}); // Cache material names by group key
  const [allMaterials, setAllMaterials] = useState([]); // Cache all materials to avoid repeated API calls

  // Bulk delete confirmation modal states
  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false);
  const [bulkDeleteDescription, setBulkDeleteDescription] = useState("");
  const [bulkDeleteDate, setBulkDeleteDate] = useState("");
  const [bulkDeleteCount, setBulkDeleteCount] = useState(0);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Available products with formulas (intersection of productName and chosenFormula)
  const [availableProducts, setAvailableProducts] = useState([]);

  // Formula data for selected product
  const [recipeData, setRecipeData] = useState([]);
  const [formulaGroups, setFormulaGroups] = useState({});
  const [selectedFormulas, setSelectedFormulas] = useState({});
  const [availableTypeCodes] = useState(["PI", "PS", "KP", "KS"]);
  const [typeCodeNames] = useState({
    PI: "1. PENGOLAHAN INTI",
    PS: "2. PENGOLAHAN SEKUNDER",
    KP: "3. KEMASAN PRIMER",
    KS: "4. KEMASAN SEKUNDER",
  });

  // Material master data
  const [materialData, setMaterialData] = useState([]);
  const [materialMap, setMaterialMap] = useState({});

  // Price change simulation state variables
  const [priceMaterials, setPriceMaterials] = useState([]);
  const [selectedMaterials, setSelectedMaterials] = useState([]);
  const [selectedMaterialPrices, setSelectedMaterialPrices] = useState({});
  const [priceChangeStep, setPriceChangeStep] = useState(1);
  const [loadingPriceMaterials, setLoadingPriceMaterials] = useState(false);
  const [loadingImpact, setLoadingImpact] = useState(false);

  // Material selection pagination and search
  const [materialSearchTerm, setMaterialSearchTerm] = useState("");
  const [filteredMaterials, setFilteredMaterials] = useState([]);
  const [currentMaterialPage, setCurrentMaterialPage] = useState(1);
  const [materialsPerPage] = useState(20); // Show 20 materials per page

  // Simulation results
  const [simulationResults, setSimulationResults] = useState(null);
  const [showDetailedReport, setShowDetailedReport] = useState(false);
  const [reportPage, setReportPage] = useState(2); // 1 = Before (HPP Results), 2 = After (Simulation) - default to After
  const [hppResultsData, setHppResultsData] = useState(null); // HPP Results data for Before page
  const [loadingHppResults, setLoadingHppResults] = useState(false);

  // Detailed simulation data from API
  const [simulationHeader, setSimulationHeader] = useState(null);
  const [simulationDetailBahan, setSimulationDetailBahan] = useState([]);
  const [simulationSummary, setSimulationSummary] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Editable simulation parameters
  const [editableBatchSize, setEditableBatchSize] = useState(null);
  const [editableRendemen, setEditableRendemen] = useState(null);
  const [editableMaterialData, setEditableMaterialData] = useState([]);
  const [editableOverheadData, setEditableOverheadData] = useState({
    // ETHICAL/OTC overhead parameters
    MH_Proses_Std: null,
    Biaya_Proses: null,
    MH_Kemas_Std: null,
    Biaya_Kemas: null,
    Beban_Sisa_Bahan_Exp: null,
    // GENERIC V1 overhead parameters
    MH_Timbang_BB: null,
    MH_Timbang_BK: null,
    MH_Analisa_Std: null,
    MH_Mesin_Std: null,
    Biaya_Generik: null,
    Biaya_Reagen: null,
    Rate_PLN: null,
    Depresiasi: null,
    // GENERIC V2 overhead parameters
    Direct_Labor: null,
    Factory_Over_Head: null,
  });

  // LOB and Version selection
  const [editableLOB, setEditableLOB] = useState(null);
  const [editableVersion, setEditableVersion] = useState(null);
  const [editableDescription, setEditableDescription] = useState(null);

  // Margin type state (percent or value)
  const [marginType, setMarginType] = useState("value"); // 'percent' or 'value'

  // Custom formula state
  const [isCustomFormula, setIsCustomFormula] = useState(false);
  const [customProductName, setCustomProductName] = useState("");
  const [customFormulaName, setCustomFormulaName] = useState("");
  const [customLine, setCustomLine] = useState("PN1"); // Default to PN1

  // Group selection state
  const [selectedGroup, setSelectedGroup] = useState("");
  const [groupsData, setGroupsData] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(false);

  // Material master data for adding new materials
  const [masterMaterials, setMasterMaterials] = useState([]);
  const [loadingMaterials, setLoadingMaterials] = useState(false);
  const [showAddMaterialModal, setShowAddMaterialModal] = useState(false);
  const [addMaterialType, setAddMaterialType] = useState(""); // 'BB' or 'BK'
  const [materialSearchQuery, setMaterialSearchQuery] = useState("");
  const [randomMaterialSample, setRandomMaterialSample] = useState([]); // Stable random sample

  // Fetch material names for a group and cache the result (using cached materials)
  const fetchMaterialNamesForGroup = (groupKey, description, materialsData = allMaterials) => {
    try {
      const materialIds = extractMaterialIds(description);
      
      if (materialIds.length === 0 || materialsData.length === 0) {
        return [];
      }
      
      // Remove spaces from extracted IDs for comparison
      const normalizedExtractedIds = materialIds.map(id => id.replace(/\s/g, ''));
      
      // Find materials that match the extracted IDs (comparing without spaces)
      const matchedMaterials = materialsData.filter(material => {
        const normalizedMaterialId = material.ITEM_ID.replace(/\s/g, '');
        return normalizedExtractedIds.includes(normalizedMaterialId);
      });

      // Cache the result
      const materialNames = matchedMaterials.map(material => material.Item_Name);
      
      setGroupMaterialNames(prev => ({
        ...prev,
        [groupKey]: materialNames
      }));

      return materialNames;
    } catch (error) {
      console.error('Error fetching material names for group:', error);
      return [];
    }
  };

  // Load all materials once to avoid repeated API calls
  const loadAllMaterials = async () => {
    try {
      const materialsResponse = await masterAPI.getMaterial();
      
      // Handle different response formats
      let materials = [];
      if (Array.isArray(materialsResponse)) {
        materials = materialsResponse;
      } else if (materialsResponse && materialsResponse.data) {
        materials = materialsResponse.data;
      } else if (materialsResponse) {
        materials = materialsResponse;
      }
      
      setAllMaterials(materials);
    } catch (error) {
      console.error('Error loading all materials:', error);
    }
  };

  // Load simulation list, groups data, and materials on component mount
  useEffect(() => {
    loadSimulationList();
    loadGroupsData();
    loadAllMaterials();
  }, []);

  // Get current location for navigation detection
  const location = useLocation();

  // Reset to simulation list (step 0) when user navigates to this page from sidebar
  // This detects both initial load and navigation from sidebar
  useEffect(() => {
    // Reset to step 0 whenever the location changes (including clicking sidebar link)
    setStep(0);
    setSimulationType("");
    setSelectedProduct(null);
    setError("");
    setIsEditMode(false);
  }, [location.key]); // location.key changes on every navigation, even to same path

  // Generate random sample when materials are loaded and modal type is set
  useEffect(() => {
    if (masterMaterials.length > 0 && addMaterialType && showAddMaterialModal) {
      generateRandomSample(addMaterialType);
    }
  }, [masterMaterials, addMaterialType, showAddMaterialModal]);

  // Auto-update overhead costs when group, LOB, or version changes
  useEffect(() => {
    if (selectedGroup && isCustomFormula) {
      updateOverheadFromGroup(selectedGroup);
    }
  }, [editableLOB, editableVersion, selectedGroup, isCustomFormula, groupsData]);

  // Sorting function
  const sortSimulations = (simulations, field, direction) => {
    return [...simulations].sort((a, b) => {
      let aValue = a[field];
      let bValue = b[field];

      // Handle different data types
      if (field === "Simulasi_Date") {
        aValue = new Date(aValue);
        bValue = new Date(bValue);
      } else if (field === "Simulasi_ID" || field === "Product_ID") {
        aValue = parseInt(aValue) || 0;
        bValue = parseInt(bValue) || 0;
      } else {
        // Convert to string for text comparison
        aValue = (aValue || "").toString().toLowerCase();
        bValue = (bValue || "").toString().toLowerCase();
      }

      if (direction === "asc") {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      } else {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
      }
    });
  };

  // Handle column header click for sorting
  const handleSort = (field) => {
    if (sortField === field) {
      // Same field, toggle direction
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      // New field, default to ascending
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Render sort icon for table headers
  const renderSortIcon = (field) => {
    if (sortField !== field) {
      return <ChevronsUpDown size={14} className="sort-icon inactive" />;
    }
    return sortDirection === "asc" ? (
      <ChevronUp size={14} className="sort-icon active" />
    ) : (
      <ChevronDown size={14} className="sort-icon active" />
    );
  };

  // Format sort field name for display
  const formatSortField = (field) => {
    const fieldNames = {
      Simulasi_ID: "ID",
      Simulasi_Type: "Type",
      Product_ID: "Product ID",
      Product_Name: "Product Name",
      Formula: "Formula",
      Simulasi_Deskripsi: "Description",
      Simulasi_Date: "Date",
    };
    return fieldNames[field] || field;
  };

  // Filter and sort simulation list
  useEffect(() => {
    let filtered;

    // First filter by active tab
    let tabFiltered = simulationList.filter((simulation) => {
      const simType = simulation.Simulasi_Type;
      
      if (activeTab === "existing") {
        return simType === "Product Existing";
      } else if (activeTab === "custom") {
        return simType === "Product Custom";
      } else if (activeTab === "price-change") {
        return simType === "Price Changes";
      }
      return false;
    });

    // Then filter by search query
    if (!searchQuery.trim()) {
      filtered = tabFiltered;
    } else {
      const query = searchQuery.toLowerCase().trim();
      filtered = tabFiltered.filter((simulation) => {
        const productName = (simulation.Product_Name || "").toLowerCase();
        const formula = (simulation.Formula || "").toLowerCase();
        const date = new Date(simulation.Simulasi_Date)
          .toLocaleDateString("id-ID")
          .toLowerCase();
        const productId = (simulation.Product_ID || "")
          .toString()
          .toLowerCase();
        const description = (simulation.Simulasi_Deskripsi || "").toLowerCase();

        return (
          productName.includes(query) ||
          formula.includes(query) ||
          date.includes(query) ||
          productId.includes(query) ||
          description.includes(query)
        );
      });
    }

    // Apply sorting
    const sorted = sortSimulations(filtered, sortField, sortDirection);
    setFilteredSimulationList(sorted);

    // Reset to page 1 when search or sort changes
    setCurrentPage(1);
  }, [searchQuery, simulationList, sortField, sortDirection, activeTab]);

  // Paginate filtered simulation list
  useEffect(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginated = filteredSimulationList.slice(startIndex, endIndex);
    setPaginatedSimulations(paginated);
  }, [filteredSimulationList, currentPage, itemsPerPage]);

  // Group Price Change simulations by description AND date/time
  useEffect(() => {
    const grouped = {};

    filteredSimulationList.forEach((simulation) => {
      if (simulation.Simulasi_Type === "Price Changes") {
        const description = simulation.Simulasi_Deskripsi || "No Description";
        const groupKey = createPriceChangeGroupKey(description, simulation.Simulasi_Date);

        if (!grouped[groupKey]) {
          grouped[groupKey] = {
            groupKey: groupKey,
            description: description,
            simulations: [],
            count: 0,
            date: simulation.Simulasi_Date, // Use the first simulation's date for sorting
            formattedDate: getDateFromGroupKey(groupKey), // For display purposes
          };
        }

        grouped[groupKey].simulations.push(simulation);
        grouped[groupKey].count = grouped[groupKey].simulations.length;

        // Keep the latest date for the group (though they should be very close now)
        if (
          new Date(simulation.Simulasi_Date) >
          new Date(grouped[groupKey].date)
        ) {
          grouped[groupKey].date = simulation.Simulasi_Date;
          grouped[groupKey].formattedDate = getDateFromGroupKey(groupKey);
        }
      }
    });

    setGroupedSimulations(grouped);

    // Fetch material names for new groups (only if materials are loaded)
    if (allMaterials.length > 0) {
      Object.keys(grouped).forEach((groupKey) => {
        if (!groupMaterialNames[groupKey]) {
          fetchMaterialNamesForGroup(groupKey, grouped[groupKey].description, allMaterials);
        }
      });
    }
  }, [filteredSimulationList, allMaterials]);

  // Create final paginated list that handles both grouped and regular simulations
  const paginatedDisplayList = useMemo(() => {
    // Step 1: Create a list of "paginatable items" (group headers + regular simulations, but NOT group children)
    const paginatableItems = [];
    const processedPriceChangeGroups = new Set();

    filteredSimulationList.forEach((simulation) => {
      if (simulation.Simulasi_Type === "Price Changes") {
        const description = simulation.Simulasi_Deskripsi || "No Description";
        const groupKey = createPriceChangeGroupKey(description, simulation.Simulasi_Date);

        // Only add the group header once per unique group key (description + date)
        if (!processedPriceChangeGroups.has(groupKey)) {
          processedPriceChangeGroups.add(groupKey);
          
          // Add the group header as a paginatable item
          paginatableItems.push({
            type: "group",
            groupKey: groupKey,
            ...groupedSimulations[groupKey],
          });
        }
      } else {
        // Regular simulations are also paginatable items
        paginatableItems.push({
          type: "simulation",
          isGroupChild: false,
          ...simulation,
        });
      }
    });

    // Step 2: Apply pagination to only the paginatable items (group headers + regular simulations)
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedItems = paginatableItems.slice(startIndex, endIndex);

    // Step 3: Build final display list by expanding groups if needed
    const finalDisplayList = [];
    
    paginatedItems.forEach((item) => {
      if (item.type === "group") {
        // Add the group header
        finalDisplayList.push(item);
        
        // Add expanded children if this group is expanded (children don't count toward pagination)
        if (expandedGroups.has(item.groupKey)) {
          groupedSimulations[item.groupKey]?.simulations?.forEach((sim) => {
            finalDisplayList.push({
              type: "simulation",
              isGroupChild: true,
              ...sim,
            });
          });
        }
      } else {
        // Add regular simulation
        finalDisplayList.push(item);
      }
    });

    return finalDisplayList;
  }, [
    filteredSimulationList,
    groupedSimulations,
    expandedGroups,
    currentPage,
    itemsPerPage,
  ]);

  // Calculate total paginatable items count (group headers + regular simulations, NOT expanded children)
  const getTotalDisplayCount = () => {
    const processedPriceChangeGroups = new Set();
    let totalCount = 0;

    filteredSimulationList.forEach((simulation) => {
      if (simulation.Simulasi_Type === "Price Changes") {
        const description = simulation.Simulasi_Deskripsi || "No Description";
        const groupKey = createPriceChangeGroupKey(description, simulation.Simulasi_Date);

        // Count each unique price change group only once (description + date)
        if (!processedPriceChangeGroups.has(groupKey)) {
          processedPriceChangeGroups.add(groupKey);
          totalCount++; // Add 1 for the group header (but NOT for expanded children)
        }
      } else {
        // Regular simulations count normally
        totalCount++;
      }
    });

    return totalCount;
  };

  // Toggle group expansion
  const toggleGroup = (groupKey) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupKey)) {
      newExpanded.delete(groupKey);
    } else {
      newExpanded.add(groupKey);
    }
    setExpandedGroups(newExpanded);
  };

  // Function to check if table container is scrollable and add appropriate class
  const checkTableScrollable = () => {
    if (tableContainerRef.current) {
      const container = tableContainerRef.current;
      const isScrollable = container.scrollHeight > container.clientHeight;
      
      if (isScrollable) {
        container.classList.add('has-scroll');
      } else {
        container.classList.remove('has-scroll');
      }
    }
  };

  // Check scrollable status when expanded groups change or data changes
  useEffect(() => {
    // Use a longer delay to ensure DOM updates and layout changes are complete
    const timeoutId = setTimeout(checkTableScrollable, 300);
    return () => clearTimeout(timeoutId);
  }, [expandedGroups, paginatedSimulations]);

  // Add resize observer to handle window resize
  useEffect(() => {
    const resizeObserver = new ResizeObserver(() => {
      checkTableScrollable();
    });

    if (tableContainerRef.current) {
      resizeObserver.observe(tableContainerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Open affected products modal for price changes
  const handleShowAffectedProducts = (description, date, event) => {
    event.stopPropagation(); // Prevent group toggle when clicking the button
    setSelectedPriceChangeDescription(description);
    setSelectedPriceChangeDate(date);
    setAffectedProductsModalOpen(true);
  };

  // Close affected products modal
  const handleCloseAffectedProductsModal = () => {
    setAffectedProductsModalOpen(false);
    setSelectedPriceChangeDescription("");
    setSelectedPriceChangeDate("");
  };

  // Handle bulk delete confirmation
  const handleBulkDeleteGroup = (description, date, count, event) => {
    event.stopPropagation(); // Prevent group toggle when clicking the button
    setBulkDeleteDescription(description);
    setBulkDeleteDate(date);
    setBulkDeleteCount(count);
    setBulkDeleteModalOpen(true);
  };

  // Close bulk delete modal
  const handleCloseBulkDeleteModal = () => {
    setBulkDeleteModalOpen(false);
    setBulkDeleteDescription("");
    setBulkDeleteDate("");
    setBulkDeleteCount(0);
    setBulkDeleting(false);
  };

  // Execute bulk delete
  const handleConfirmBulkDelete = async () => {
    try {
      setBulkDeleting(true);
      
      const notifier = new AWN();
      notifier.info("Deleting price change group...");

      // Call the API to bulk delete
      const response = await hppAPI.bulkDeletePriceChangeGroup(
        bulkDeleteDescription,
        bulkDeleteDate
      );

      // Show success message
      notifier.success(
        `Successfully deleted ${response.data?.deletedCount || bulkDeleteCount} price change simulations`
      );

      // Close modal
      handleCloseBulkDeleteModal();

      // Refresh the simulation list
      await loadSimulationList();

    } catch (error) {
      console.error("Error bulk deleting price change group:", error);
      const notifier = new AWN();
      notifier.alert("Failed to delete price change group: " + error.message);
      setBulkDeleting(false);
    }
  };

  // Load simulation list from API
  const loadSimulationList = async () => {
    try {
      setLoadingList(true);
      setListError("");

      const response = await hppAPI.getSimulationList();
      setSimulationList(response.data || []);
    } catch (error) {
      console.error("Error loading simulation list:", error);
      setListError("Failed to load simulation list. Please try again.");
    } finally {
      setLoadingList(false);
    }
  };

  // Load groups data for group selection
  const loadGroupsData = async () => {
    try {
      setLoadingGroups(true);
      const response = await masterAPI.getPembebanan();
      const data = response.data || response;
      
      // Filter data where Group_ProductID is null (default rates)
      const defaultGroups = data.filter(item => item.Group_ProductID === null);
      setGroupsData(defaultGroups);
      

    } catch (error) {
      console.error("Error loading pembebanan data:", error);
    } finally {
      setLoadingGroups(false);
    }
  };

  // Handle group selection and update overhead costs
  const handleGroupSelection = (groupId) => {
    setSelectedGroup(groupId);
    if (groupId) {
      updateOverheadFromGroup(groupId);
    }
  };

  // Update overhead costs based on selected group and current LOB/Version
  const updateOverheadFromGroup = (groupId) => {
    if (!groupId) return;
    
    const selectedGroupData = groupsData.find(g => g.Group_PNCategoryID === groupId);
    if (!selectedGroupData) return;
    
    const currentLOB = getCurrentLOB();
    const currentVersion = editableVersion || simulationResults?.[0]?.Versi || "1";
    
    // Update overhead costs based on LOB type
    if (currentLOB === "ETHICAL" || currentLOB === "OTC") {
      // For ETHICAL: use Group_Proses_Rate and Group_Kemas_Rate
      setEditableOverheadData(prev => ({
        ...prev,
        Biaya_Proses: selectedGroupData.Group_Proses_Rate,
        Biaya_Kemas: selectedGroupData.Group_Kemas_Rate,
      }));
    } else if (currentLOB === "GENERIC" && currentVersion === "1") {
      // For GENERIC V1: use Group_Generik_Rate and Group_Analisa_Rate
      setEditableOverheadData(prev => ({
        ...prev,
        Biaya_Generik: selectedGroupData.Group_Generik_Rate,
        Biaya_Reagen: selectedGroupData.Group_Analisa_Rate,
      }));
    }
    

  };

  // Delete simulation
  const handleDeleteSimulation = async (simulasiId) => {
    notifier.confirm(
      "Are you sure you want to delete this simulation? This action cannot be undone.",
      async () => {
        // This runs if user clicks OK/Yes
        try {
          setLoading(true);
          await hppAPI.deleteSimulation(simulasiId);

          // Reload the simulation list
          await loadSimulationList();

          notifier.success("Simulation deleted successfully!");
        } catch (error) {
          console.error("Error deleting simulation:", error);
          notifier.alert("Failed to delete simulation. Please try again.");
        } finally {
          setLoading(false);
        }
      },
      () => {
        // This runs if user clicks Cancel/No - do nothing
      },
      {
        labels: {
          confirm: "Delete",
          cancel: "Cancel",
        },
      }
    );
  };

  // Clone simulation and enter edit mode
  const handleCloneSimulation = async (simulation) => {
    try {
      setLoading(true);
      setLoadingDetails(false);
      setError("");
      
      // Generate clone description
      const cloneDescription = `Clone of: ${simulation.Simulasi_Deskripsi || simulation.Formula || `Simulasi_ID ${simulation.Simulasi_ID}`}`;
      
      // Use the new clone API that copies everything
      const response = await hppAPI.cloneSimulation(simulation.Simulasi_ID, cloneDescription);
      const newSimulasiId = response.data.newSimulasiId;
      
      // Load the cloned simulation data for editing
      const [headerResponse, materialsResponse, summaryResponse] = await Promise.all([
        hppAPI.getSimulationHeader(newSimulasiId),
        hppAPI.getSimulationDetailBahan(newSimulasiId),
        hppAPI.getSimulationSummary(newSimulasiId),
      ]);

      const headerData = headerResponse.data[0]; // API returns array, take first element
      const materialsData = materialsResponse.data;
      const summaryData = summaryResponse.data[0]; // API returns array, take first element
      
      // Set simulation summary for HNA and HPP ratio display
      setSimulationSummary(summaryData);

      // Parse Formula to extract individual formulas
      const parseFormula = (formula) => {
        if (!formula) return { pi: "", ps: "", kp: "", ks: "" };
        const parts = formula.split("#");
        return {
          pi: parts[0] || "",
          ps: parts[1] === "-" ? "" : parts[1] || "",
          kp: parts[2] || "",
          ks: parts[3] || "",
        };
      };

      const formulaParts = parseFormula(headerData.Formula);

      // Set up the simulation results with properly mapped data (same as handleEditSimulation)
      setSimulationResults([
        {
          Simulasi_ID: newSimulasiId,
          Product_ID: headerData.Product_ID,
          Product_Name: headerData.Product_Name,
          Simulasi_Deskripsi: headerData.Simulasi_Deskripsi,
          LOB: headerData.LOB,
          Versi: headerData.Versi,
          Formula: headerData.Formula,
          Batch_Size: headerData.Batch_Size,
          Group_Rendemen: headerData.Group_Rendemen,
          Group_PNCategory_Dept: headerData.Group_PNCategory_Dept,
          Line: headerData.Group_PNCategory_Dept,

          // Map Selected Formulas from Formula field
          SelectedFormulas: {
            PI: formulaParts.pi,
            PS: formulaParts.ps,
            KP: formulaParts.kp,
            KS: formulaParts.ks,
          },

          // Map Processing and Packaging costs with manhours
          ProcessingCost: {
            cost: headerData.Biaya_Proses || 0,
            manhours: headerData.MH_Proses_Std || 0,
          },
          PackagingCost: {
            cost: headerData.Biaya_Kemas || 0,
            manhours: headerData.MH_Kemas_Std || 0,
          },
          ExpiryCost: {
            cost: headerData.Beban_Sisa_Bahan_Exp || 0,
            manhours: 0, // No specific manhours for expiry cost
          },

          // Map other overhead data
          MH_Analisa_Std: headerData.MH_Analisa_Std || 0,
          MH_Timbang_BB: headerData.MH_Timbang_BB || 0,
          MH_Timbang_BK: headerData.MH_Timbang_BK || 0,
          MH_Mesin_Std: headerData.MH_Mesin_Std || 0,
          Biaya_Generik: headerData.Biaya_Generik || 0,
          Biaya_Reagen: headerData.Biaya_Reagen || 0,
          Toll_Fee: headerData.Toll_Fee || 0,
          Rate_PLN: headerData.Rate_PLN || 0,
          Direct_Labor: headerData.Direct_Labor || 0,
          Factory_Over_Head: headerData.Factory_Over_Head || 0,
          Depresiasi: headerData.Depresiasi || 0,
        },
      ]);

      // Set up editable state with loaded data
      setEditableLOB(headerData.LOB || "");
      setEditableVersion(headerData.Versi || "");
      setEditableBatchSize(headerData.Batch_Size || 0);
      setEditableRendemen(headerData.Group_Rendemen || 0);
      setEditableDescription(headerData.Simulasi_Deskripsi || "");
      
      // Set up editable overhead data
      setEditableOverheadData({
        MH_Proses_Std: headerData.MH_Proses_Std || 0,
        MH_Kemas_Std: headerData.MH_Kemas_Std || 0,
        MH_Analisa_Std: headerData.MH_Analisa_Std || 0,
        MH_Timbang_BB: headerData.MH_Timbang_BB || 0,
        MH_Timbang_BK: headerData.MH_Timbang_BK || 0,
        MH_Mesin_Std: headerData.MH_Mesin_Std || 0,
        Biaya_Proses: headerData.Biaya_Proses || 0,
        Biaya_Kemas: headerData.Biaya_Kemas || 0,
        Biaya_Analisa: headerData.Biaya_Analisa || 0,
        Biaya_Generik: headerData.Biaya_Generik || 0,
        Biaya_Reagen: headerData.Biaya_Reagen || 0,
        Toll_Fee: headerData.Toll_Fee || 0,
        Rate_PLN: headerData.Rate_PLN || 0,
        Direct_Labor: headerData.Direct_Labor || 0,
        Factory_Over_Head: headerData.Factory_Over_Head || 0,
        Depresiasi: headerData.Depresiasi || 0,
        Beban_Sisa_Bahan_Exp: headerData.Beban_Sisa_Bahan_Exp || 0,
      });

      // Set up materials data with proper mapping
      const formattedMaterials = materialsData?.map((material) => ({
        product_id: material.Item_ID,
        product_code: material.Item_ID,
        product_name: material.Item_Name,
        qty: material.Item_QTY,
        uom: material.Item_Unit,
        harga: material.Item_Unit_Price,
        total: (material.Item_QTY || 0) * (material.Item_Unit_Price || 0),
        // Keep API field names for compatibility
        Item_ID: material.Item_ID,
        Item_Name: material.Item_Name,
        Item_QTY: material.Item_QTY,
        Item_Unit: material.Item_Unit,
        Item_Unit_Price: material.Item_Unit_Price,
        Tipe_Bahan: material.Tipe_Bahan,
      })) || [];

      setEditableMaterialData(formattedMaterials);

      // Also set simulationDetailBahan for display purposes
      setSimulationDetailBahan(materialsData || []);

      // Set simulationHeader for detailed report functionality
      setSimulationHeader([headerData]);

      // Set the selected formulas state for display
      setSelectedFormulas({
        PI: formulaParts.pi,
        PS: formulaParts.ps,
        KP: formulaParts.kp,
        KS: formulaParts.ks,
      });

      // Set simulation type and selected product info for context
      setSimulationType("existing");
      setSelectedProduct({
        Product_ID: headerData.Product_ID,
        Product_Name: headerData.Product_Name,
      });

      // Set edit mode
      setIsEditMode(true);

      // Reset custom formula state
      setIsCustomFormula(false);
      
      // Go directly to Step 4: Simulation Results for editing
      setStep(4);
      
      // Reload simulation list in background for updated list
      loadSimulationList();
      
      notifier.success(`Simulation cloned successfully! Now editing clone with ID: ${newSimulasiId}`);
      
    } catch (error) {
      console.error("Error cloning simulation:", error);
      notifier.alert("Failed to clone simulation. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Start new simulation
  const handleNewSimulation = () => {
    setStep(1);
    setSimulationType("");
    setSelectedProduct(null);
    setProductSearchQuery("");
    setProductOptions([]);
    setError("");
    setSimulationResults(null);
    setSimulationDetailBahan([]); // Clear materials display data
    setSimulationHeader(null); // Clear simulation header for detailed report
    setSimulationSummary(null); // Clear simulation summary data
    setLoadingDetails(false); // Reset loading details state
    setIsEditMode(false); // New simulation mode
    setEditableDescription(null); // Reset description for new simulation
    setIsCustomFormula(false); // Reset custom formula flag
  };

  // Go back to simulation list
  const handleBackToList = () => {
    setStep(0);
    setSimulationType("");
    setSelectedProduct(null);
    setProductSearchQuery("");
    setProductOptions([]);
    setError("");
    setSimulationResults(null);
    // Reset all editable data
    setEditableLOB("");
    setEditableVersion("");
    setEditableBatchSize(0);
    setEditableRendemen(0);
    setEditableDescription(""); // Reset description
    setEditableOverheadData({});
    setEditableMaterialData([]);
    setSimulationDetailBahan([]); // Clear materials display data
    setSimulationHeader(null); // Clear simulation header for detailed report
    setSimulationSummary(null); // Clear simulation summary data
    setLoadingDetails(false); // Reset loading details state
    setIsEditMode(false); // Reset edit mode
    loadSimulationList(); // Refresh the list
  };

  // Initialize custom formula simulation
  const initializeCustomFormula = () => {
    setIsCustomFormula(true);
    setCustomProductName("");
    setCustomFormulaName("");
    setCustomLine("PN1");

    // Create mock simulation results for Step 4
    const mockCustomSimulation = {
      Simulasi_ID: null, // Will be set when saved
      Product_ID: "-",
      Product_Name: "", // Will be filled by user
      Simulasi_Deskripsi: "",
      LOB: "ETHICAL",
      Versi: "1",
      Formula: "", // Will be filled by user
      Batch_Size: 1000, // Default batch size
      Group_Rendemen: 100, // Default rendemen
      Group_PNCategory_Dept: "PN1", // Default line
      Line: "PN1",

      // Initialize with zero costs - user will fill manually
      MH_Proses_Std: 0,
      MH_Kemas_Std: 0,
      MH_Analisa_Std: 0,
      MH_Timbang_BB: 0,
      MH_Timbang_BK: 0,
      MH_Mesin_Std: 0,
      Biaya_Proses: 0,
      Biaya_Kemas: 0,
      Biaya_Analisa: 0,
      Biaya_Generik: 0,
      Biaya_Reagen: 0,
      Toll_Fee: 0,
      Rate_PLN: 0,
      Direct_Labor: 0,
      Factory_Over_Head: 0,
      Depresiasi: 0,
      Beban_Sisa_Bahan_Exp: 0,
    };

    setSimulationResults([mockCustomSimulation]);

    // Initialize empty material data
    setEditableMaterialData([]);
    setSimulationDetailBahan([]);

    // Reset editable states
    setEditableLOB("ETHICAL");
    setEditableVersion("1");
    setEditableBatchSize(1000);
    setEditableRendemen(100);
    setEditableDescription("");
    setEditableOverheadData({
      MH_Proses_Std: 0,
      MH_Kemas_Std: 0,
      MH_Analisa_Std: 0,
      MH_Timbang_BB: 0,
      MH_Timbang_BK: 0,
      MH_Mesin_Std: 0,
      Biaya_Proses: 0,
      Biaya_Kemas: 0,
      Biaya_Analisa: 0,
      Biaya_Generik: 0,
      Biaya_Reagen: 0,
      Toll_Fee: 0,
      Rate_PLN: 0,
      Direct_Labor: 0,
      Factory_Over_Head: 0,
      Depresiasi: 0,
      Beban_Sisa_Bahan_Exp: 0,
    });
  };

  // Initialize price change simulation
  const initializePriceChangeSimulation = () => {
    setSelectedMaterials([]); // Reset selected materials for price changes
    setPriceChangeStep(1); // Start with material selection
    setMaterialSearchTerm(""); // Reset search
    setCurrentMaterialPage(1); // Reset pagination

    // Reset other simulation states
    setSimulationResults(null);
    setEditableMaterialData([]);
    setSimulationDetailBahan([]);
    setSimulationHeader(null);
    setSimulationSummary(null);
    setLoadingDetails(false);
    setError("");

    // Load materials with prices for price change selection
    loadPriceMaterials();
  };

  // Load materials with price data from hargaBahan API
  const loadPriceMaterials = async () => {
    setLoadingPriceMaterials(true);
    setError("");

    try {
      // Fetch price data and use cached materials if available
      const priceResponse = await masterAPI.getHargaBahan();
      const priceData = priceResponse.data || priceResponse;
      
      let materialData;
      if (allMaterials.length > 0) {
        // Use cached materials
        materialData = allMaterials;
      } else {
        // Fallback to API call if cache not available
        const materialResponse = await masterAPI.getMaterial();
        materialData = materialResponse.data || materialResponse;
      }



      // Create a map of material names for quick lookup
      const materialNameMap = {};
      materialData.forEach((material) => {
        materialNameMap[material.ITEM_ID] = material.Item_Name;
      });

      // Merge price data with material names
      const mergedMaterials = priceData.map((priceItem) => ({
        ...priceItem,
        ITEM_NAME:
          materialNameMap[priceItem.ITEM_ID] ||
          `Unknown Material (${priceItem.ITEM_ID})`, // Fallback with clear indication
        ITEM_TYP: priceItem.ITEM_TYPE || "N/A", // Use correct field mapping with fallback
        UNIT: priceItem.ITEM_PURCHASE_UNIT || "unit", // Add purchase unit with fallback
        CURRENCY: priceItem.ITEM_CURRENCY || "IDR", // Add currency with fallback
      }));


      setPriceMaterials(mergedMaterials);
      setFilteredMaterials(mergedMaterials); // Initialize filtered materials
      setCurrentMaterialPage(1); // Reset pagination
    } catch (error) {
      console.error("Error loading price materials:", error);
      setError("Failed to load material price data. Please try again.");
    } finally {
      setLoadingPriceMaterials(false);
    }
  };

  // Handle material selection for price change
  const handleMaterialSelection = (material, selected) => {
    if (selected) {
      // Add material to selected list with current price as new price
      const materialWithNewPrice = {
        ...material,
        originalPrice: material.ITEM_PURCHASE_STD_PRICE,
        newPrice: material.ITEM_PURCHASE_STD_PRICE, // Start with current price
        priceChange: 0,
        priceChangePercent: 0,
      };
      setSelectedMaterials((prev) => [...prev, materialWithNewPrice]);
    } else {
      // Remove material from selected list
      setSelectedMaterials((prev) =>
        prev.filter((m) => m.ITEM_ID !== material.ITEM_ID)
      );
    }
  };

  // Update new price for selected material
  const handlePriceChange = (materialId, newPrice) => {
    setSelectedMaterials((prev) =>
      prev.map((material) => {
        if (material.ITEM_ID === materialId) {
          const originalPrice = material.originalPrice;
          const priceChange = newPrice - originalPrice;
          const priceChangePercent =
            originalPrice !== 0 ? (priceChange / originalPrice) * 100 : 0;

          return {
            ...material,
            newPrice: parseFloat(newPrice) || 0,
            priceChange,
            priceChangePercent,
          };
        }
        return material;
      })
    );
  };

  // Proceed to next step in price change simulation
  const handleProceedToPriceChange = () => {
    // Navigate to material selection step
    setPriceChangeStep(2);
    setError("");
  };

  // Generate price change simulation
  const handleGenerateSimulation = async () => {
    if (selectedMaterials.length === 0) {
      setError(
        "Please select at least one material for price change simulation."
      );
      return;
    }

    // Validate that all selected materials have new prices
    const missingPrices = selectedMaterials.filter((material) => {
      const newPrice = material.newPrice;
      return !newPrice || newPrice <= 0;
    });

    if (missingPrices.length > 0) {
      setError("Please enter valid new prices for all selected materials.");
      return;
    }

    setLoadingImpact(true);
    setError("");

    try {
      // Prepare the material price changes array
      const materialPriceChanges = selectedMaterials.map((material) => ({
        materialId: material.ITEM_ID,
        newPrice: material.newPrice,
      }));

      // Call the backend API
      const result = await hppAPI.generatePriceChangeSimulation(
        materialPriceChanges
      );

      // Store the materials that were changed for finding the created simulation
      const changedMaterialIds = selectedMaterials.map(m => m.ITEM_ID);

      // Show success message
      notifier.success("Price change simulation generated successfully!");

      // Reset the form and go back to main simulations table
      setSelectedMaterials([]);
      setSelectedMaterialPrices({});
      setPriceChangeStep(1);
      setStep(0); // Go back to main simulations list
      
      // Refresh the simulation list to show new simulations
      await loadSimulationList();

      // Wait a bit more for the data to be fully refreshed, then find the latest matching simulation
      setTimeout(async () => {
        try {
          // Refresh the simulation list again to get the latest data
          const refreshedResponse = await hppAPI.getSimulationList();
          const refreshedSimulations = refreshedResponse.data || [];
          
          // Find the most recent price change simulation that contains our changed materials
          const recentSimulations = refreshedSimulations
            .filter(sim => sim.Simulasi_Type === "Price Changes")
            .sort((a, b) => new Date(b.Simulasi_Date) - new Date(a.Simulasi_Date)) // Most recent first
            .slice(0, 10); // Check only the 10 most recent simulations
          
          // Look for a simulation with a description that contains our material IDs
          let matchingSimulation = null;
          for (const sim of recentSimulations) {
            const description = sim.Simulasi_Deskripsi || "";
            // Check if the description contains any of our changed material IDs
            const containsChangedMaterial = changedMaterialIds.some(materialId => 
              description.includes(materialId)
            );
            if (containsChangedMaterial) {
              matchingSimulation = sim;
              break; // Take the first (most recent) match
            }
          }
          
          if (matchingSimulation) {
            setSelectedPriceChangeDescription(matchingSimulation.Simulasi_Deskripsi);
            setSelectedPriceChangeDate(matchingSimulation.Simulasi_Date);
            setAffectedProductsModalOpen(true);
          } else {
            console.warn("Could not find matching simulation for automatic modal opening");
            // Fallback - just notify user that simulation was created
            notifier.info("Price change simulation created. You can view affected products from the simulation list.");
          }
        } catch (error) {
          console.error("Error finding matching simulation:", error);
          // Don't show error to user, just log it
        }
      }, 1000); // Longer delay to ensure the simulation is fully created and available
    } catch (error) {
      console.error("Error generating simulation:", error);
      setError("Failed to generate simulation: " + error.message);
      notifier.alert("Failed to generate simulation: " + error.message);
    } finally {
      setLoadingImpact(false);
    }
  };

  // Handle material search
  const handleMaterialSearch = (searchTerm) => {
    setMaterialSearchTerm(searchTerm);
    setCurrentMaterialPage(1); // Reset to first page when searching

    if (!searchTerm.trim()) {
      setFilteredMaterials(priceMaterials);
    } else {
      const filtered = priceMaterials.filter(
        (material) =>
          material.ITEM_NAME?.toLowerCase().includes(
            searchTerm.toLowerCase()
          ) ||
          material.ITEM_ID?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          material.ITEM_TYP?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          material.UNIT?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          material.CURRENCY?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredMaterials(filtered);
    }
  };

  // Get paginated materials
  const getPaginatedMaterials = () => {
    const materialsToShow =
      filteredMaterials.length > 0 ? filteredMaterials : priceMaterials;
    const startIndex = (currentMaterialPage - 1) * materialsPerPage;
    const endIndex = startIndex + materialsPerPage;
    return materialsToShow.slice(startIndex, endIndex);
  };

  // Get total pages for materials
  const getTotalMaterialPages = () => {
    const materialsToShow =
      filteredMaterials.length > 0 ? filteredMaterials : priceMaterials;
    return Math.ceil(materialsToShow.length / materialsPerPage);
  };

  // Format price with currency symbol
  const formatPriceWithCurrency = (price, currency) => {
    if (!price && price !== 0) return "Not Set";

    const formattedPrice = parseFloat(price).toLocaleString();

    // Map common currencies to their symbols
    const currencySymbols = {
      IDR: "Rp ",
      USD: "$ ",
      EUR: "€ ",
      RMB: "¥ ",
      CNY: "¥ ",
      JPY: "¥ ",
      SGD: "S$ ",
      MYR: "RM ",
      THB: "฿ ",
    };

    const symbol = currencySymbols[currency] || `${currency} `;
    return `${symbol}${formattedPrice}`;
  };

  // Load existing simulation for editing
  const handleEditSimulation = async (simulation) => {
    try {
      setLoading(true);
      setLoadingDetails(false); // Reset loading details state
      setError("");

      // Reset custom formula state when editing regular simulation
      setIsCustomFormula(false);

      // First, load the simulation header, detail data, and summary
      const [headerResponse, materialsResponse, summaryResponse] = await Promise.all([
        hppAPI.getSimulationHeader(simulation.Simulasi_ID),
        hppAPI.getSimulationDetailBahan(simulation.Simulasi_ID),
        hppAPI.getSimulationSummary(simulation.Simulasi_ID),
      ]);

      const headerData = headerResponse.data[0]; // API returns array, take first element
      const materialsData = materialsResponse.data;
      const summaryData = summaryResponse.data[0]; // API returns array, take first element
      
      // Set simulation summary for HNA and HPP ratio display
      setSimulationSummary(summaryData);

      // Parse Formula to extract individual formulas
      // Format: "GLC#-#B#C" means PI: GLC, PS: - (none), KP: B, KS: C
      const parseFormula = (formula) => {
        if (!formula) return { pi: "", ps: "", kp: "", ks: "" };
        const parts = formula.split("#");
        return {
          pi: parts[0] || "",
          ps: parts[1] === "-" ? "" : parts[1] || "",
          kp: parts[2] || "",
          ks: parts[3] || "",
        };
      };

      const formulaParts = parseFormula(headerData.Formula);

      // Set up the simulation results with properly mapped data
      setSimulationResults([
        {
          Simulasi_ID: headerData.Simulasi_ID,
          Product_ID: headerData.Product_ID,
          Product_Name: headerData.Product_Name,
          Simulasi_Deskripsi: headerData.Simulasi_Deskripsi,
          LOB: headerData.LOB,
          Versi: headerData.Versi,
          Formula: headerData.Formula,
          Batch_Size: headerData.Batch_Size,
          Group_Rendemen: headerData.Group_Rendemen,
          Group_PNCategory_Dept: headerData.Group_PNCategory_Dept, // This is what the display expects
          Line: headerData.Group_PNCategory_Dept, // Also set Line field for consistency

          // Map Selected Formulas from Formula field
          SelectedFormulas: {
            PI: formulaParts.pi,
            PS: formulaParts.ps,
            KP: formulaParts.kp,
            KS: formulaParts.ks,
          },

          // Map Processing and Packaging costs with manhours
          ProcessingCost: {
            cost: headerData.Biaya_Proses || 0,
            manhours: headerData.MH_Proses_Std || 0,
          },
          PackagingCost: {
            cost: headerData.Biaya_Kemas || 0,
            manhours: headerData.MH_Kemas_Std || 0,
          },
          ExpiryCost: {
            cost: headerData.Beban_Sisa_Bahan_Exp || 0,
            manhours: 0, // No specific manhours for expiry cost
          },

          // Map other overhead data
          MH_Analisa_Std: headerData.MH_Analisa_Std || 0,
          MH_Timbang_BB: headerData.MH_Timbang_BB || 0,
          MH_Timbang_BK: headerData.MH_Timbang_BK || 0,
          MH_Mesin_Std: headerData.MH_Mesin_Std || 0,
          Biaya_Generik: headerData.Biaya_Generik || 0,
          Biaya_Reagen: headerData.Biaya_Reagen || 0,
          Toll_Fee: headerData.Toll_Fee || 0,
          Rate_PLN: headerData.Rate_PLN || 0,
          Direct_Labor: headerData.Direct_Labor || 0,
          Factory_Over_Head: headerData.Factory_Over_Head || 0,
          Depresiasi: headerData.Depresiasi || 0,
        },
      ]);

      // Set up editable state with loaded data (normalize LOB to match dropdown values)
      setEditableLOB(normalizeLOB(headerData.LOB) || "");
      setEditableVersion(headerData.Versi || "");
      setEditableBatchSize(headerData.Batch_Size || 0);
      setEditableRendemen(headerData.Group_Rendemen || 0);
      setEditableDescription(headerData.Simulasi_Deskripsi || "");

      // Detect margin type: if < 1, it's percent; otherwise it's direct value
      const marginValue = headerData.Margin || 0;
      if (marginValue < 1 && marginValue > 0) {
        setMarginType("percent");
        // Convert to percentage for display (0.1 -> 10)
        setEditableOverheadData({
          MH_Proses_Std: headerData.MH_Proses_Std || 0,
          MH_Kemas_Std: headerData.MH_Kemas_Std || 0,
          MH_Analisa_Std: headerData.MH_Analisa_Std || 0,
          MH_Timbang_BB: headerData.MH_Timbang_BB || 0,
          MH_Timbang_BK: headerData.MH_Timbang_BK || 0,
          MH_Mesin_Std: headerData.MH_Mesin_Std || 0,
          Biaya_Proses: headerData.Biaya_Proses || 0,
          Biaya_Kemas: headerData.Biaya_Kemas || 0,
          Biaya_Analisa: headerData.Biaya_Analisa || 0,
          Biaya_Generik: headerData.Biaya_Generik || 0,
          Biaya_Reagen: headerData.Biaya_Reagen || 0,
          Toll_Fee: headerData.Toll_Fee || 0,
          Rate_PLN: headerData.Rate_PLN || 0,
          Direct_Labor: headerData.Direct_Labor || 0,
          Factory_Over_Head: headerData.Factory_Over_Head || 0,
          Depresiasi: headerData.Depresiasi || 0,
          Beban_Sisa_Bahan_Exp: headerData.Beban_Sisa_Bahan_Exp || 0,
          Margin: marginValue * 100, // Convert to percent for display
        });
      } else {
        setMarginType("value");
        setEditableOverheadData({
          MH_Proses_Std: headerData.MH_Proses_Std || 0,
          MH_Kemas_Std: headerData.MH_Kemas_Std || 0,
          MH_Analisa_Std: headerData.MH_Analisa_Std || 0,
          MH_Timbang_BB: headerData.MH_Timbang_BB || 0,
          MH_Timbang_BK: headerData.MH_Timbang_BK || 0,
          MH_Mesin_Std: headerData.MH_Mesin_Std || 0,
          Biaya_Proses: headerData.Biaya_Proses || 0,
          Biaya_Kemas: headerData.Biaya_Kemas || 0,
          Biaya_Analisa: headerData.Biaya_Analisa || 0,
          Biaya_Generik: headerData.Biaya_Generik || 0,
          Biaya_Reagen: headerData.Biaya_Reagen || 0,
          Toll_Fee: headerData.Toll_Fee || 0,
          Rate_PLN: headerData.Rate_PLN || 0,
          Direct_Labor: headerData.Direct_Labor || 0,
          Factory_Over_Head: headerData.Factory_Over_Head || 0,
          Depresiasi: headerData.Depresiasi || 0,
          Beban_Sisa_Bahan_Exp: headerData.Beban_Sisa_Bahan_Exp || 0,
          Margin: marginValue, // Keep as direct value
        });
      }

      // Set up materials data with proper mapping from detail-bahan API
      const formattedMaterials =
        materialsData?.map((material) => ({
          product_id: material.Item_ID,
          product_code: material.Item_ID, // Use Item_ID as product code
          product_name: material.Item_Name,
          qty: material.Item_QTY,
          uom: material.Item_Unit,
          harga: material.Item_Unit_Price,
          total: (material.Item_QTY || 0) * (material.Item_Unit_Price || 0),
          // Keep API field names for compatibility with existing functions
          Item_ID: material.Item_ID,
          Item_Name: material.Item_Name,
          Item_QTY: material.Item_QTY,
          Item_Unit: material.Item_Unit,
          Item_Unit_Price: material.Item_Unit_Price,
          Tipe_Bahan: material.Tipe_Bahan, // Keep uppercase for existing functions
          Seq_ID: material.Seq_ID,
        })) || [];

      setEditableMaterialData(formattedMaterials);

      // Also set simulationDetailBahan for display purposes
      setSimulationDetailBahan(materialsData || []);

      // Set simulationHeader for detailed report functionality
      setSimulationHeader([headerData]);

      // Set the selected formulas state for display
      setSelectedFormulas({
        PI: formulaParts.pi,
        PS: formulaParts.ps,
        KP: formulaParts.kp,
        KS: formulaParts.ks,
      });

      // Set simulation type and selected product info for context
      setSimulationType("existing");
      setSelectedProduct({
        Product_ID: headerData.Product_ID,
        Product_Name: headerData.Product_Name,
      });

      // Set edit mode
      setIsEditMode(true);

      // Navigate to Step 4 (Simulation Results)
      setStep(4);

      notifier.success(
        `Loaded simulation "${headerData.Product_Name}" for editing`
      );
    } catch (error) {
      console.error("Error loading simulation for editing:", error);
      notifier.alert(
        "Failed to load simulation for editing. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  // Handle preview simulation - loads edit mode then automatically shows detailed report
  const handlePreviewSimulation = async (simulation) => {
    try {
      // First, load the simulation in edit mode (this loads all necessary data)
      await handleEditSimulation(simulation);
      
      // Wait a brief moment for the edit mode to fully load
      setTimeout(() => {
        // Automatically open the detailed report modal
        setShowDetailedReport(true);
      }, 100);
      
    } catch (error) {
      console.error("Error loading simulation for preview:", error);
      notifier.alert("Failed to load simulation preview. Please try again.");
    }
  };

  // Load available products when component mounts or when simulation type changes to "Existing Formula"
  useEffect(() => {
    if (simulationType === "existing") {
      loadAvailableProducts();
    }
  }, [simulationType]);

  // Filter products based on search query
  useEffect(() => {
    if (!productSearchQuery) {
      setProductOptions([]);
      return;
    }

    const filtered = availableProducts.filter(
      (product) =>
        product.Product_ID.toLowerCase().includes(
          productSearchQuery.toLowerCase()
        ) ||
        product.Product_Name.toLowerCase().includes(
          productSearchQuery.toLowerCase()
        )
    );
    setProductOptions(filtered.slice(0, 10)); // Limit to 10 results
  }, [productSearchQuery, availableProducts]);

  const loadAvailableProducts = async () => {
    setLoading(true);
    setError("");

    try {
      // Get all products and chosen formulas in parallel
      const [productNamesResponse, chosenFormulasResponse] = await Promise.all([
        masterAPI.getProductName(),
        productsAPI.getChosenFormula(),
      ]);

      const productNames = productNamesResponse.data || productNamesResponse;
      const chosenFormulas =
        chosenFormulasResponse.data || chosenFormulasResponse;

      // Create a set of product IDs that have chosen formulas
      const productsWithFormulas = new Set(
        chosenFormulas.map((formula) => formula.Product_ID)
      );

      // Filter product names to only include those with formulas
      const available = productNames.filter((product) =>
        productsWithFormulas.has(product.Product_ID)
      );

      setAvailableProducts(available);
    } catch (error) {
      console.error("Error loading available products:", error);
      setError("Failed to load available products. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSimulationTypeSelect = (type) => {
    setSimulationType(type);
    setError("");
    setSelectedProduct(null);
    setProductSearchQuery("");
    setProductOptions([]);

    if (type === "existing") {
      setIsCustomFormula(false); // Ensure custom formula is disabled for existing products
      setStep(2); // Move to product selection step (was step 2, now step 2)
    } else if (type === "custom") {
      // Skip product selection and formula selection steps for custom formula
      // Go directly to custom Step 4 (results/configuration)
      setStep(4);
      setIsEditMode(false); // This is a new custom simulation
      // Initialize empty custom formula simulation
      initializeCustomFormula();
    } else if (type === "price-change") {
      // Move to price change configuration step
      setStep(5); // New step for price change simulation
      setIsEditMode(false); // This is a new price change simulation
      // Initialize price change simulation
      initializePriceChangeSimulation();
    } else {
      setError("Unknown simulation type selected.");
    }
  };

  const handleProductSelect = (product) => {
    setSelectedProduct(product);
    setProductSearchQuery(""); // Clear search bar after selection
    setProductOptions([]);
  };

  const handleNextStep = () => {
    if (step === 2 && selectedProduct) {
      // Load recipe data for the selected product
      loadRecipeData(selectedProduct.Product_ID);
    }
  };

  const loadRecipeData = async (productId) => {
    setLoading(true);
    setError("");

    try {
      // Load recipe data and use cached materials if available
      const recipeResponse = await productsAPI.getRecipe(productId);
      const recipeData = recipeResponse.data || recipeResponse;
      
      let materialData;
      if (allMaterials.length > 0) {
        // Use cached materials
        materialData = allMaterials;
      } else {
        // Fallback to API call if cache not available
        const materialResponse = await masterAPI.getMaterial();
        materialData = materialResponse.data || materialResponse;
      }

      setRecipeData(recipeData);
      setMaterialData(materialData);

      // Create material lookup map
      const materialLookup = {};
      materialData.forEach((material) => {
        materialLookup[material.ITEM_ID] = material;
      });
      setMaterialMap(materialLookup);

      // Process and group the data by TypeCode and PPI_SubID
      const groups = processRecipeData(recipeData);
      setFormulaGroups(groups);

      // Set default selected formulas (active ones)
      const defaultSelections = getDefaultFormulas(groups);
      setSelectedFormulas(defaultSelections);

      setStep(3);
    } catch (error) {
      console.error("Error loading recipe data:", error);
      setError("Failed to load product recipe data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const processRecipeData = (data) => {
    const groups = {};

    // Group by TypeCode first, then by PPI_SubID
    data.forEach((item) => {
      const { TypeCode, PPI_SubID } = item;

      if (!groups[TypeCode]) {
        groups[TypeCode] = {};
      }

      if (!groups[TypeCode][PPI_SubID]) {
        groups[TypeCode][PPI_SubID] = {
          subId: PPI_SubID,
          typeName: item.TypeName,
          isActive: item.DefaultCOGS === "Aktif",
          batchSize: item.BatchSize,
          source: item.Source,
          materials: [],
        };
      }

      // Add material to the formula
      groups[TypeCode][PPI_SubID].materials.push({
        seqId: item.PPI_SeqID,
        itemId: item.PPI_ItemID,
        unitId: item.PPI_UnitID,
        qty: parseFloat(item.PPI_QTY),
        unitPrice: item.UnitPrice,
        purchaseQtyUnit: item.PurchaseQTYUnit,
        purchaseUnit: item.PurchaseUnit,
        itemType: item.ITEM_TYPE,
      });
    });

    return groups;
  };

  const getDefaultFormulas = (groups) => {
    const defaults = {};

    Object.keys(groups).forEach((typeCode) => {
      // Find the active formula for this TypeCode
      const activeSubId = Object.keys(groups[typeCode]).find(
        (subId) => groups[typeCode][subId].isActive
      );

      // activeSubId can be empty string, which is a valid formula
      if (activeSubId !== undefined) {
        defaults[typeCode] = activeSubId;
      }
    });

    return defaults;
  };

  const handleFormulaSelection = (typeCode, subId) => {
    setSelectedFormulas((prev) => {
      const newFormulas = { ...prev };

      if (subId === "__NO_SELECTION__") {
        // Special value for "-- Select a formula --" was chosen, so remove the selection
        delete newFormulas[typeCode];
      } else {
        // Store the selection (including empty string formulas which are valid)
        newFormulas[typeCode] = subId;
      }

      return newFormulas;
    });
  };

  const buildFormulaString = () => {
    // Build formula string in format: PI#PS#KP#KS
    // Use "-" for types that don't have selections
    const parts = [];
    availableTypeCodes.forEach((typeCode) => {
      const subId = selectedFormulas[typeCode];
      // Handle empty string formulas properly - they are valid selections
      if (selectedFormulas.hasOwnProperty(typeCode)) {
        parts.push(subId); // subId can be empty string, which is valid
      } else {
        parts.push("-"); // No selection made
      }
    });
    return parts.join("#");
  };

  // Fetch HPP Results data for Before/After comparison
  const fetchHppResultsForProduct = async (productId) => {
    try {
      setLoadingHppResults(true);
      const currentYear = new Date().getFullYear();
      
      // Fetch HPP results data
      const response = await hppAPI.getResults(currentYear);
      
      // Find the matching product in all three categories
      let matchedProduct = null;
      if (response.ethical) {
        matchedProduct = response.ethical.find(p => p.Product_ID === productId);
        if (matchedProduct) matchedProduct._sourceTab = 'ethical';
      }
      if (!matchedProduct && response.generik1) {
        matchedProduct = response.generik1.find(p => p.Product_ID === productId);
        if (matchedProduct) matchedProduct._sourceTab = 'generik1';
      }
      if (!matchedProduct && response.generik2) {
        matchedProduct = response.generik2.find(p => p.Product_ID === productId);
        if (matchedProduct) matchedProduct._sourceTab = 'generik2';
      }
      
      setHppResultsData(matchedProduct);
    } catch (error) {
      console.error('Error fetching HPP Results data:', error);
      setHppResultsData(null); // Set to null if not found or error
    } finally {
      setLoadingHppResults(false);
    }
  };

  const handleRunSimulation = async () => {
    // Check if at least one formula is selected (empty string is a valid selection)
    const hasAtLeastOneSelection = Object.keys(selectedFormulas).length > 0;

    if (!hasAtLeastOneSelection) {
      setError("Please select at least one formula before running simulation.");
      return;
    }

    setLoading(true);
    setError("");
    setIsCustomFormula(false); // Ensure custom formula is disabled for existing products

    try {
      const formulaString = buildFormulaString();
      const response = await hppAPI.generateSimulation(
        selectedProduct.Product_ID,
        formulaString
      );

      const results = response.data || response;
      setSimulationResults(results);

      // If simulation is successful and we have a Simulasi_ID, fetch detailed data
      if (results && results.length > 0 && results[0].Simulasi_ID) {
        const simulasiId = results[0].Simulasi_ID;

        setLoadingDetails(true);
        try {
          // Fetch header, detail data, and summary in parallel
          const [headerResponse, detailResponse, summaryResponse] = await Promise.all([
            hppAPI.getSimulationHeader(simulasiId),
            hppAPI.getSimulationDetailBahan(simulasiId),
            hppAPI.getSimulationSummary(simulasiId),
          ]);

          setSimulationHeader(headerResponse.data || []);
          setSimulationDetailBahan(detailResponse.data || []);
          setSimulationSummary(summaryResponse.data?.[0] || null);

          // Initialize editable values with current data
          if (results && results.length > 0) {
            const normalizedLOB = normalizeLOB(results[0].LOB);

            setEditableBatchSize(results[0].Batch_Size);
            setEditableRendemen(results[0].Group_Rendemen);
            setEditableLOB(normalizedLOB);
            setEditableVersion(results[0].Versi || "1");
            
            // Detect margin type: if < 1, it's percent; otherwise it's direct value
            const marginValue = results[0].Margin || 0;
            if (marginValue < 1 && marginValue > 0) {
              setMarginType("percent");
              // Convert to percentage for display (0.1 -> 10)
              setEditableOverheadData({
                // ETHICAL/OTC overhead parameters
                MH_Proses_Std: results[0].MH_Proses_Std,
                Biaya_Proses: results[0].Biaya_Proses,
                MH_Kemas_Std: results[0].MH_Kemas_Std,
                Biaya_Kemas: results[0].Biaya_Kemas,
                Beban_Sisa_Bahan_Exp: results[0].Beban_Sisa_Bahan_Exp,
                Margin: marginValue * 100, // Convert to percent for display
                // GENERIC V1 overhead parameters
              MH_Timbang_BB: results[0].MH_Timbang_BB,
              MH_Timbang_BK: results[0].MH_Timbang_BK,
              MH_Analisa_Std: results[0].MH_Analisa_Std,
              MH_Mesin_Std: results[0].MH_Mesin_Std,
              Biaya_Generik: results[0].Biaya_Generik,
              Biaya_Reagen: results[0].Biaya_Reagen,
              Rate_PLN: results[0].Rate_PLN,
              Depresiasi: results[0].Depresiasi,
              // GENERIC V2 overhead parameters
              Direct_Labor: results[0].Direct_Labor,
              Factory_Over_Head: results[0].Factory_Over_Head,
              });
            } else {
              setMarginType("value");
              setEditableOverheadData({
                // ETHICAL/OTC overhead parameters
                MH_Proses_Std: results[0].MH_Proses_Std,
                Biaya_Proses: results[0].Biaya_Proses,
                MH_Kemas_Std: results[0].MH_Kemas_Std,
                Biaya_Kemas: results[0].Biaya_Kemas,
                Beban_Sisa_Bahan_Exp: results[0].Beban_Sisa_Bahan_Exp,
                Margin: marginValue, // Keep as direct value
                // GENERIC V1 overhead parameters
                MH_Timbang_BB: results[0].MH_Timbang_BB,
                MH_Timbang_BK: results[0].MH_Timbang_BK,
                MH_Analisa_Std: results[0].MH_Analisa_Std,
                MH_Mesin_Std: results[0].MH_Mesin_Std,
                Biaya_Generik: results[0].Biaya_Generik,
                Biaya_Reagen: results[0].Biaya_Reagen,
                Rate_PLN: results[0].Rate_PLN,
                Depresiasi: results[0].Depresiasi,
                // GENERIC V2 overhead parameters
                Direct_Labor: results[0].Direct_Labor,
                Factory_Over_Head: results[0].Factory_Over_Head,
              });
            }
          }

          // Initialize editable material data
          if (detailResponse.data && detailResponse.data.length > 0) {
            setEditableMaterialData([...detailResponse.data]);
          }
        } catch (detailError) {
          console.error(
            "Error fetching detailed simulation data:",
            detailError
          );
          // Don't fail the whole process if detailed data fails
        } finally {
          setLoadingDetails(false);
        }
      }

      // Move to simulation results step
      setStep(4);
    } catch (error) {
      console.error("Simulation error:", error);
      setError("Failed to run simulation. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const calculateTotalCost = (result) => {
    const costs = [
      result.Biaya_Proses || 0,
      result.Biaya_Kemas || 0,
      result.Biaya_Generik || 0,
      result.Biaya_Reagen || 0,
      result.Toll_Fee || 0,
      result.Direct_Labor || 0,
      result.Factory_Over_Head || 0,
      result.Depresiasi || 0,
    ];
    return costs.reduce((sum, cost) => sum + cost, 0);
  };

  const calculateCostPerUnit = (result) => {
    const totalCost = calculateTotalCost(result);
    const batchSize = result.Batch_Size || 1;
    return totalCost / batchSize;
  };

  const handleBack = () => {
    if (step === 2) {
      setStep(1);
      setSimulationType("");
      setSelectedProduct(null);
      setProductSearchQuery("");
      setProductOptions([]);
    } else if (step === 3) {
      setStep(2);
      setRecipeData([]);
      setFormulaGroups({});
      setSelectedFormulas({});
    } else if (step === 4) {
      setStep(3);
      setSimulationResults(null);
    }
  };

  // Save simulation handler
  const handleSaveSimulation = async () => {
    try {
      setLoading(true);
      setError("");

      if (isCustomFormula) {
        // Handle custom formula saving - create new simulation
        if (!customProductName.trim() || !customFormulaName.trim()) {
          setError(
            "Product name and formula name are required for custom formulas"
          );
          return;
        }

        // Prepare header data for custom formula
        const headerData = {
          Product_ID: null, // Custom formulas don't have a product ID
          Product_Name: customProductName.trim(),
          Formula: customFormulaName.trim(),
          Group_PNCategory: null, // Will be set based on department mapping if needed
          Group_PNCategory_Dept: customLine,
          Periode: "2025",
          Simulasi_Deskripsi: editableDescription || "",
          Group_Rendemen: editableRendemen || 100,
          Batch_Size: editableBatchSize || 1000,
          LOB: editableLOB || "ETHICAL",
          Versi: editableVersion || "1",
          MH_Proses_Std: editableOverheadData.MH_Proses_Std || 0,
          MH_Kemas_Std: editableOverheadData.MH_Kemas_Std || 0,
          MH_Analisa_Std: editableOverheadData.MH_Analisa_Std || 0,
          MH_Timbang_BB: editableOverheadData.MH_Timbang_BB || 0,
          MH_Timbang_BK: editableOverheadData.MH_Timbang_BK || 0,
          MH_Mesin_Std: editableOverheadData.MH_Mesin_Std || 0,
          Biaya_Proses: editableOverheadData.Biaya_Proses || 0,
          Biaya_Kemas: editableOverheadData.Biaya_Kemas || 0,
          Biaya_Analisa: editableOverheadData.Biaya_Analisa || 0,
          Biaya_Generik: editableOverheadData.Biaya_Generik || 0,
          Biaya_Reagen: editableOverheadData.Biaya_Reagen || 0,
          Toll_Fee: editableOverheadData.Toll_Fee || 0,
          Rate_PLN: editableOverheadData.Rate_PLN || 0,
          Direct_Labor: editableOverheadData.Direct_Labor || 0,
          Factory_Over_Head: editableOverheadData.Factory_Over_Head || 0,
          Depresiasi: editableOverheadData.Depresiasi || 0,
          Beban_Sisa_Bahan_Exp: editableOverheadData.Beban_Sisa_Bahan_Exp || 0,
        };

        // Prepare materials data for custom formula
        const materials = editableMaterialData.map((item) => ({
          Tipe_Bahan: item.Tipe_Bahan,
          Item_ID: item.Item_ID,
          Item_Name: item.Item_Name,
          Item_QTY: item.Item_QTY,
          Item_Unit: item.Item_Unit,
          Item_Unit_Price: item.Item_Unit_Price,
        }));

        // Call the create simulation API (assuming you have this endpoint)
        const response = await hppAPI.createCustomSimulation(
          headerData,
          materials
        );

        notifier.success("Custom formula simulation saved successfully!");

        // Reset custom formula state and return to list
        setIsCustomFormula(false);
        setStep(0); // Return to simulation list view
        loadSimulationList();
      } else {
        // Handle regular simulation saving - update existing simulation
        if (
          !simulationResults ||
          !simulationResults[0] ||
          !simulationResults[0].Simulasi_ID
        ) {
          setError("No simulation data to save");
          return;
        }

        const simulasiId = simulationResults[0].Simulasi_ID;

        // Prepare header data from current editable state
        const headerData = {
          Periode: simulationResults[0].Periode || "2025",
          Simulasi_Deskripsi:
            editableDescription ||
            simulationResults[0].Simulasi_Deskripsi ||
            "",
          Group_Rendemen:
            editableRendemen || simulationResults[0].Group_Rendemen,
          Batch_Size: editableBatchSize || simulationResults[0].Batch_Size,
          LOB: editableLOB || normalizeLOB(simulationResults[0].LOB),
          Versi: editableVersion || simulationResults[0].Versi || "1",
          MH_Proses_Std:
            editableOverheadData.MH_Proses_Std ||
            simulationResults[0].MH_Proses_Std ||
            0,
          MH_Kemas_Std:
            editableOverheadData.MH_Kemas_Std ||
            simulationResults[0].MH_Kemas_Std ||
            0,
          MH_Analisa_Std:
            editableOverheadData.MH_Analisa_Std ||
            simulationResults[0].MH_Analisa_Std ||
            0,
          MH_Timbang_BB:
            editableOverheadData.MH_Timbang_BB ||
            simulationResults[0].MH_Timbang_BB ||
            0,
          MH_Timbang_BK:
            editableOverheadData.MH_Timbang_BK ||
            simulationResults[0].MH_Timbang_BK ||
            0,
          MH_Mesin_Std:
            editableOverheadData.MH_Mesin_Std ||
            simulationResults[0].MH_Mesin_Std ||
            0,
          Biaya_Proses:
            editableOverheadData.Biaya_Proses ||
            simulationResults[0].Biaya_Proses ||
            0,
          Biaya_Kemas:
            editableOverheadData.Biaya_Kemas ||
            simulationResults[0].Biaya_Kemas ||
            0,
          Biaya_Analisa:
            editableOverheadData.Biaya_Analisa ||
            simulationResults[0].Biaya_Analisa ||
            0,
          Biaya_Generik:
            editableOverheadData.Biaya_Generik ||
            simulationResults[0].Biaya_Generik,
          Biaya_Reagen:
            editableOverheadData.Biaya_Reagen ||
            simulationResults[0].Biaya_Reagen,
          Toll_Fee:
            editableOverheadData.Toll_Fee || simulationResults[0].Toll_Fee,
          Rate_PLN:
            editableOverheadData.Rate_PLN || simulationResults[0].Rate_PLN || 0,
          Direct_Labor:
            editableOverheadData.Direct_Labor ||
            simulationResults[0].Direct_Labor ||
            0,
          Factory_Over_Head:
            editableOverheadData.Factory_Over_Head ||
            simulationResults[0].Factory_Over_Head ||
            0,
          Depresiasi:
            editableOverheadData.Depresiasi ||
            simulationResults[0].Depresiasi ||
            0,
          Beban_Sisa_Bahan_Exp:
            editableOverheadData.Beban_Sisa_Bahan_Exp ||
            simulationResults[0].Beban_Sisa_Bahan_Exp,
        };

        // Prepare materials data from current editable state
        const materials = editableMaterialData.map((item) => ({
          Tipe_Bahan: item.Tipe_Bahan,
          Item_ID: item.Item_ID,
          Item_Name: item.Item_Name,
          Item_QTY: item.Item_QTY,
          Item_Unit: item.Item_Unit,
          Item_Unit_Price: item.Item_Unit_Price,
        }));

        // Call the save API
        const response = await hppAPI.saveSimulation(
          simulasiId,
          headerData,
          materials
        );

        // Show success message
        notifier.success(
          `Simulation saved successfully! Updated ${response.data.materialsInserted} materials.`
        );
      }
    } catch (err) {
      console.error("Error saving simulation:", err);
      setError("Failed to save simulation: " + err.message);
      notifier.alert("Failed to save simulation: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Helper functions to extract material data from selected formulas
  const getBahanBakuFromFormulas = () => {
    const materials = [];
    Object.entries(selectedFormulas).forEach(([typeCode, subId]) => {
      const formula = formulaGroups[typeCode]?.[subId];
      if (formula) {
        formula.materials.forEach((material) => {
          const materialInfo = materialMap[material.itemId];
          if (materialInfo && materialInfo.ITEM_TYPE === "BB") {
            materials.push(material);
          }
        });
      }
    });
    return materials;
  };

  const getBahanKemasFromFormulas = () => {
    const materials = [];
    Object.entries(selectedFormulas).forEach(([typeCode, subId]) => {
      const formula = formulaGroups[typeCode]?.[subId];
      if (formula) {
        formula.materials.forEach((material) => {
          const materialInfo = materialMap[material.itemId];
          if (materialInfo && materialInfo.ITEM_TYPE === "BK") {
            materials.push(material);
          }
        });
      }
    });
    return materials;
  };

  // Helper functions to work with detailed API data (using editable data)
  const getBahanBakuFromApiData = () => {
    return editableMaterialData.filter((item) => item.Tipe_Bahan === "BB");
  };

  const getBahanKemasFromApiData = () => {
    return editableMaterialData.filter((item) => item.Tipe_Bahan === "BK");
  };

  const calculateTotalBahanBaku = () => {
    return getBahanBakuFromApiData().reduce(
      (sum, item) => sum + (item.Item_Unit_Price || 0) * (item.Item_QTY || 0),
      0
    );
  };

  const calculateTotalBahanKemas = () => {
    return getBahanKemasFromApiData().reduce(
      (sum, item) => sum + (item.Item_Unit_Price || 0) * (item.Item_QTY || 0),
      0
    );
  };

  // Get current normalized LOB value
  const getCurrentLOB = () => {
    if (editableLOB) return normalizeLOB(editableLOB);
    if (simulationResults && simulationResults[0])
      return normalizeLOB(simulationResults[0].LOB);
    return "ETHICAL";
  };

  // Helper function to get actual batch size with rendemen
  const getActualBatchSize = () => {
    const batchSize =
      editableBatchSize ||
      (simulationResults && simulationResults[0]
        ? simulationResults[0].Batch_Size
        : 1);
    const rendemen =
      editableRendemen ||
      (simulationResults && simulationResults[0]
        ? simulationResults[0].Group_Rendemen
        : 100);
    return (batchSize * rendemen) / 100;
  };

  // Overhead calculations for ETHICAL products (using editable data)
  const calculateProcessingCost = () => {
    const currentLOB = getCurrentLOB();
    if (
      !simulationResults[0] ||
      (currentLOB !== "ETHICAL" && currentLOB !== "OTC")
    )
      return 0;
    return (
      (editableOverheadData.MH_Proses_Std || 0) *
      (editableOverheadData.Biaya_Proses || 0)
    );
  };

  const calculatePackagingCost = () => {
    const currentLOB = getCurrentLOB();
    if (
      !simulationResults[0] ||
      (currentLOB !== "ETHICAL" && currentLOB !== "OTC")
    )
      return 0;
    return (
      (editableOverheadData.MH_Kemas_Std || 0) *
      (editableOverheadData.Biaya_Kemas || 0)
    );
  };

  const calculateExpiryCost = () => {
    if (!simulationResults[0]) return 0;
    return editableOverheadData.Beban_Sisa_Bahan_Exp || 0;
  };

  // GENERIC Version 1 overhead calculations
  const calculateIngredientsWeighing = () => {
    const currentLOB = getCurrentLOB();
    const currentVersion =
      editableVersion || (simulationResults[0] && simulationResults[0].Versi);
    if (
      !simulationResults[0] ||
      currentLOB !== "GENERIC" ||
      currentVersion !== "1"
    )
      return 0;
    return (
      (editableOverheadData.MH_Timbang_BB || 0) *
      (editableOverheadData.Biaya_Proses || 0)
    );
  };

  const calculatePackagingWeighing = () => {
    const currentLOB = getCurrentLOB();
    const currentVersion =
      editableVersion || (simulationResults[0] && simulationResults[0].Versi);
    if (
      !simulationResults[0] ||
      currentLOB !== "GENERIC" ||
      currentVersion !== "1"
    )
      return 0;
    return (
      (editableOverheadData.MH_Timbang_BK || 0) *
      (editableOverheadData.Biaya_Kemas || 0)
    );
  };

  const calculateGenericProcessingCost = () => {
    const currentLOB = getCurrentLOB();
    const currentVersion =
      editableVersion || (simulationResults[0] && simulationResults[0].Versi);
    if (
      !simulationResults[0] ||
      currentLOB !== "GENERIC" ||
      currentVersion !== "1"
    )
      return 0;
    return (
      (editableOverheadData.MH_Proses_Std || 0) *
      (editableOverheadData.Biaya_Proses || 0)
    );
  };

  const calculateGenericPackagingCost = () => {
    const currentLOB = getCurrentLOB();
    const currentVersion =
      editableVersion || (simulationResults[0] && simulationResults[0].Versi);
    if (
      !simulationResults[0] ||
      currentLOB !== "GENERIC" ||
      currentVersion !== "1"
    )
      return 0;
    return (
      (editableOverheadData.MH_Kemas_Std || 0) *
      (editableOverheadData.Biaya_Kemas || 0)
    );
  };

  const calculateAnalysisFee = () => {
    const currentLOB = getCurrentLOB();
    const currentVersion =
      editableVersion || (simulationResults[0] && simulationResults[0].Versi);
    if (
      !simulationResults[0] ||
      currentLOB !== "GENERIC" ||
      currentVersion !== "1"
    )
      return 0;
    return (
      (editableOverheadData.MH_Analisa_Std || 0) *
      (editableOverheadData.Biaya_Analisa || 0)
    );
  };

  const calculateMachineFee = () => {
    const currentLOB = getCurrentLOB();
    const currentVersion =
      editableVersion || (simulationResults[0] && simulationResults[0].Versi);
    if (
      !simulationResults[0] ||
      currentLOB !== "GENERIC" ||
      currentVersion !== "1"
    )
      return 0;
    return (
      (editableOverheadData.MH_Mesin_Std || 0) *
      (editableOverheadData.Rate_PLN || 0)
    );
  };

  const calculateReagentFee = () => {
    const currentLOB = getCurrentLOB();
    const currentVersion =
      editableVersion || (simulationResults[0] && simulationResults[0].Versi);
    if (
      !simulationResults[0] ||
      currentLOB !== "GENERIC" ||
      currentVersion !== "1"
    )
      return 0;
    return editableOverheadData.Biaya_Reagen || 0;
  };

  const calculateGenericExpiryCost = () => {
    const currentLOB = getCurrentLOB();
    const currentVersion =
      editableVersion || (simulationResults[0] && simulationResults[0].Versi);
    if (
      !simulationResults[0] ||
      currentLOB !== "GENERIC" ||
      currentVersion !== "1"
    )
      return 0;
    return editableOverheadData.Beban_Sisa_Bahan_Exp || 0;
  };

  // GENERIC Version 2 overhead calculations
  const calculateProductionLaborCost = () => {
    const currentLOB = getCurrentLOB();
    const currentVersion =
      editableVersion || (simulationResults[0] && simulationResults[0].Versi);
    if (
      !simulationResults[0] ||
      currentLOB !== "GENERIC" ||
      currentVersion !== "2"
    )
      return 0;
    return (
      (editableOverheadData.MH_Proses_Std || 0) *
      (editableOverheadData.Direct_Labor || 0)
    );
  };

  const calculatePackagingLaborCost = () => {
    const currentLOB = getCurrentLOB();
    const currentVersion =
      editableVersion || (simulationResults[0] && simulationResults[0].Versi);
    if (
      !simulationResults[0] ||
      currentLOB !== "GENERIC" ||
      currentVersion !== "2"
    )
      return 0;
    return (
      (editableOverheadData.MH_Kemas_Std || 0) *
      (editableOverheadData.Direct_Labor || 0)
    );
  };

  const calculateProductionFOH = () => {
    const currentLOB = getCurrentLOB();
    const currentVersion =
      editableVersion || (simulationResults[0] && simulationResults[0].Versi);
    if (
      !simulationResults[0] ||
      currentLOB !== "GENERIC" ||
      currentVersion !== "2"
    )
      return 0;
    return (
      (editableOverheadData.MH_Proses_Std || 0) *
      (editableOverheadData.Factory_Over_Head || 0)
    );
  };

  const calculatePackagingFOH = () => {
    const currentLOB = getCurrentLOB();
    const currentVersion =
      editableVersion || (simulationResults[0] && simulationResults[0].Versi);
    if (
      !simulationResults[0] ||
      currentLOB !== "GENERIC" ||
      currentVersion !== "2"
    )
      return 0;
    return (
      (editableOverheadData.MH_Kemas_Std || 0) *
      (editableOverheadData.Factory_Over_Head || 0)
    );
  };

  const calculateProductionDepreciation = () => {
    const currentLOB = getCurrentLOB();
    const currentVersion =
      editableVersion || (simulationResults[0] && simulationResults[0].Versi);
    if (
      !simulationResults[0] ||
      currentLOB !== "GENERIC" ||
      currentVersion !== "2"
    )
      return 0;
    return (
      (editableOverheadData.MH_Proses_Std || 0) *
      (editableOverheadData.Depresiasi || 0)
    );
  };

  const calculatePackagingDepreciation = () => {
    const currentLOB = getCurrentLOB();
    const currentVersion =
      editableVersion || (simulationResults[0] && simulationResults[0].Versi);
    if (
      !simulationResults[0] ||
      currentLOB !== "GENERIC" ||
      currentVersion !== "2"
    )
      return 0;
    return (
      (editableOverheadData.MH_Kemas_Std || 0) *
      (editableOverheadData.Depresiasi || 0)
    );
  };

  const calculateTotalOverhead = () => {
    if (!simulationResults[0]) return 0;

    const currentLOB = getCurrentLOB();
    const currentVersion = editableVersion || simulationResults[0].Versi;

    if (currentLOB === "ETHICAL" || currentLOB === "OTC") {
      // ETHICAL/OTC overhead calculation
      return (
        calculateProcessingCost() +
        calculatePackagingCost() +
        calculateExpiryCost()
      );
    } else if (currentLOB === "GENERIC" && currentVersion === "1") {
      // GENERIC V1 overhead calculation
      return (
        calculateIngredientsWeighing() +
        calculatePackagingWeighing() +
        calculateGenericProcessingCost() +
        calculateGenericPackagingCost() +
        calculateAnalysisFee() +
        calculateMachineFee() +
        calculateReagentFee() +
        calculateGenericExpiryCost()
      );
    } else if (currentLOB === "GENERIC" && currentVersion === "2") {
      // GENERIC V2 overhead calculation
      return (
        calculateProductionLaborCost() +
        calculatePackagingLaborCost() +
        calculateProductionFOH() +
        calculatePackagingFOH() +
        calculateExpiryCost()
      );
    }

    return 0;
  };

  const calculateMarginValue = () => {
    if (getCurrentLOB() !== "ETHICAL" && getCurrentLOB() !== "OTC") {
      return 0; // No margin for GENERIC products
    }

    const marginInput = editableOverheadData.Margin || 0;
    
    if (marginType === "percent") {
      // Calculate margin as percentage of subtotal (materials + overhead)
      const bahanBaku = editableMaterialData.length > 0 ? calculateTotalBahanBaku() : 0;
      const bahanKemas = editableMaterialData.length > 0 ? calculateTotalBahanKemas() : 0;
      const overhead = calculateTotalOverhead();
      const subtotal = bahanBaku + bahanKemas + overhead;
      return subtotal * (marginInput / 100);
    } else {
      // Direct value
      return marginInput;
    }
  };

  const calculateGrandTotal = () => {
    const bahanBaku =
      editableMaterialData.length > 0 ? calculateTotalBahanBaku() : 0;
    const bahanKemas =
      editableMaterialData.length > 0 ? calculateTotalBahanKemas() : 0;
    const overhead = calculateTotalOverhead();
    const margin = calculateMarginValue();
    return bahanBaku + bahanKemas + overhead + margin;
  };

  const calculateCostPerUnitWithRendemen = () => {
    if (!simulationResults[0]) return 0;
    const grandTotal = calculateGrandTotal();
    const batchSize = editableBatchSize || simulationResults[0].Batch_Size || 1;
    const rendemen =
      editableRendemen || simulationResults[0].Group_Rendemen || 100;
    const effectiveUnits = batchSize * (rendemen / 100);
    return grandTotal / effectiveUnits;
  };

  // Material management functions
  const handleMaterialQuantityChange = (index, newQty) => {
    const updatedMaterials = [...editableMaterialData];
    updatedMaterials[index].Item_QTY = parseFloat(newQty) || 0;
    setEditableMaterialData(updatedMaterials);
  };

  const handleRemoveMaterial = (index) => {
    notifier.confirm(
      "Are you sure you want to remove this material?",
      () => {
        // This runs if user clicks OK/Yes
        const updatedMaterials = editableMaterialData.filter(
          (_, i) => i !== index
        );
        setEditableMaterialData(updatedMaterials);
      },
      () => {
        // This runs if user clicks Cancel/No - do nothing
      },
      {
        labels: {
          confirm: "Remove",
          cancel: "Cancel",
        },
      }
    );
  };

  const handleAddMaterial = async (materialType) => {
    setAddMaterialType(materialType);
    setShowAddMaterialModal(true);
    setMaterialSearchQuery(""); // Reset search

    // Load master materials if not already loaded
    if (masterMaterials.length === 0) {
      setLoadingMaterials(true);
      try {
        await loadMasterMaterials();
      } catch (error) {
        console.error("Error loading materials:", error);
      } finally {
        setLoadingMaterials(false);
      }
    }
    // Random sample generation is now handled by useEffect
  };

  const generateRandomSample = (materialType) => {
    const typeFilteredMaterials = masterMaterials.filter(
      (material) => material.ITEM_TYPE === materialType
    );
    const sampleSize = Math.min(20, typeFilteredMaterials.length);
    const shuffled = [...typeFilteredMaterials].sort(() => 0.5 - Math.random());
    setRandomMaterialSample(shuffled.slice(0, sampleSize));
  };

  const loadMasterMaterials = async () => {
    try {
      if (allMaterials.length > 0) {
        // Use cached materials
        setMasterMaterials(allMaterials);
      } else {
        // Fallback to API call if cache not available
        const response = await masterAPI.getMaterial();
        setMasterMaterials(response.data || response || []);
      }
    } catch (error) {
      console.error("Error loading master materials:", error);
    }
  };

  const addNewMaterial = (material, quantity) => {
    const newMaterial = {
      Periode:
        simulationResults[0].Periode || new Date().getFullYear().toString(),
      Simulasi_ID: simulationResults[0].Simulasi_ID,
      Seq_ID: Math.max(...editableMaterialData.map((m) => m.Seq_ID || 0)) + 1,
      Tipe_Bahan: addMaterialType,
      Item_ID: material.ITEM_ID,
      Item_Name: material.Item_Name,
      Item_QTY: quantity,
      Item_Unit: material.Item_Unit,
      Item_Unit_Price: material.Unit_Price || 0,
    };

    setEditableMaterialData([...editableMaterialData, newMaterial]);
    setShowAddMaterialModal(false);
  };

  // Add custom material function
  const addCustomMaterial = () => {
    const nextSeqId =
      Math.max(...editableMaterialData.map((m) => m.Seq_ID || 0)) + 1;
    const customMaterial = {
      Periode:
        simulationResults[0].Periode || new Date().getFullYear().toString(),
      Simulasi_ID: simulationResults[0].Simulasi_ID,
      Seq_ID: nextSeqId,
      Tipe_Bahan: addMaterialType,
      Item_ID: "CUSTOM",
      Item_Name: "", // This will be editable
      Item_QTY: 0, // This will be editable
      Item_Unit: "", // This will be editable
      Item_Unit_Price: 0, // This will be editable
      isCustom: true, // Flag to identify custom materials
    };

    setEditableMaterialData([...editableMaterialData, customMaterial]);
    setShowAddMaterialModal(false);

    notifier.success(
      "Custom material added. You can now edit its details in the table."
    );
  };

  // Handle custom material field updates
  const handleCustomMaterialFieldChange = (materialIndex, field, value) => {
    const updatedMaterials = [...editableMaterialData];
    updatedMaterials[materialIndex] = {
      ...updatedMaterials[materialIndex],
      [field]: value,
    };

    // Auto-calculate extended cost when quantity or unit price changes
    if (field === "Item_QTY" || field === "Item_Unit_Price") {
      const qty =
        field === "Item_QTY"
          ? parseFloat(value) || 0
          : updatedMaterials[materialIndex].Item_QTY || 0;
      const unitPrice =
        field === "Item_Unit_Price"
          ? parseFloat(value) || 0
          : updatedMaterials[materialIndex].Item_Unit_Price || 0;
      updatedMaterials[materialIndex].extendedCost = qty * unitPrice;
    }

    setEditableMaterialData(updatedMaterials);
  };

  const getFilteredMaterials = () => {
    const typeFilteredMaterials = masterMaterials.filter(
      (material) => material.ITEM_TYPE === addMaterialType
    );

    // If no search query, show the stable random sample
    if (!materialSearchQuery || materialSearchQuery.trim().length === 0) {
      return randomMaterialSample;
    }

    // Require at least 2 characters for search to reduce lag from single character searches
    if (materialSearchQuery.trim().length < 2) {
      return []; // Show empty results with a hint message
    }

    // If there's a search query, filter by ID or name and limit results to prevent lag
    const searchResults = typeFilteredMaterials.filter(
      (material) =>
        material.ITEM_ID.toLowerCase().includes(
          materialSearchQuery.toLowerCase()
        ) ||
        material.Item_Name.toLowerCase().includes(
          materialSearchQuery.toLowerCase()
        )
    );

    // Limit results to 50 items to prevent rendering lag
    return searchResults.slice(0, 50);
  };

  // PDF generation function
  const handleGeneratePDF = async () => {
    try {
      notifier.info("Generating PDF...");

      const pdf = new jsPDF("p", "mm", "a4");
      const imgWidth = 200; // Reduced from 210 to add margins (5mm on each side)
      const pageHeight = 295; // A4 height in mm
      const marginLeft = 5; // 5mm left margin
      const marginTop = 5; // 5mm top margin
      let isFirstPage = true;

      // If we have HPP Results data, capture "Before" page first
      if (hppResultsData && !isCustomFormula) {
        // Temporarily switch to page 1 to capture it
        const originalPage = reportPage;
        setReportPage(1);
        
        // Wait longer for ProductHPPReport component to fully render
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Capture Before page - ProductHPPReport renders in its own modal
        // Look for the report content inside ProductHPPReport modal using specific ID
        const beforeReportContent = document.querySelector("#product-hpp-report-before");
        if (beforeReportContent) {
          const canvas = await html2canvas(beforeReportContent, {
            scale: 2,
            useCORS: true,
            logging: false,
            width: beforeReportContent.scrollWidth,
            height: beforeReportContent.scrollHeight,
            scrollX: 0,
            scrollY: 0,
          });

          // Validate canvas has content
          if (canvas.width > 0 && canvas.height > 0) {
            const imgData = canvas.toDataURL("image/png");
            
            // Check if image data is valid
            if (imgData && imgData.startsWith('data:image/png')) {
              const imgHeight = (canvas.height * imgWidth) / canvas.width;
              let heightLeft = imgHeight;
              let position = 0;

              // Add Before page(s)
              pdf.addImage(
                imgData,
                "PNG",
                marginLeft,
                marginTop + position,
                imgWidth,
                imgHeight
              );
              heightLeft -= pageHeight;

              while (heightLeft >= 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(
                  imgData,
                  "PNG",
                  marginLeft,
                  marginTop + position,
                  imgWidth,
                  imgHeight
                );
                heightLeft -= pageHeight;
              }
              
              isFirstPage = false;
            } else {
              console.warn('Before page: Invalid image data');
            }
          } else {
            console.warn('Before page: Canvas has no dimensions');
          }
        } else {
          console.warn('Before page: Report content not found');
        }
        
        // Switch to page 2 to capture "After"
        setReportPage(2);
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Capture After page - this is in the main simulation modal using specific ID
        const afterModalContent = document.querySelector("#product-hpp-report-after");
        if (afterModalContent) {
          if (!isFirstPage) pdf.addPage();
          
          const canvas = await html2canvas(afterModalContent, {
            scale: 2,
            useCORS: true,
            logging: false,
            width: afterModalContent.scrollWidth,
            height: afterModalContent.scrollHeight,
            scrollX: 0,
            scrollY: 0,
          });

          // Validate canvas has content
          if (canvas.width > 0 && canvas.height > 0) {
            const imgData = canvas.toDataURL("image/png");
            
            // Check if image data is valid
            if (imgData && imgData.startsWith('data:image/png')) {
              const imgHeight = (canvas.height * imgWidth) / canvas.width;
              let heightLeft = imgHeight;
              let position = 0;

              // Add After page(s)
              pdf.addImage(
                imgData,
                "PNG",
                marginLeft,
                marginTop + position,
                imgWidth,
                imgHeight
              );
              heightLeft -= pageHeight;

              while (heightLeft >= 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(
                  imgData,
                  "PNG",
                  marginLeft,
                  marginTop + position,
                  imgWidth,
                  imgHeight
                );
                heightLeft -= pageHeight;
              }
            } else {
              console.warn('After page: Invalid image data');
            }
          } else {
            console.warn('After page: Canvas has no dimensions');
          }
        } else {
          console.warn('After page: Report content not found');
        }
        
        // Restore original page
        setReportPage(originalPage);
      } else {
        // No Before data, just capture current simulation page
        const modalContent = document.querySelector("#product-hpp-report-after");
        if (!modalContent) {
          throw new Error("Modal content not found");
        }

        const canvas = await html2canvas(modalContent, {
          scale: 2,
          useCORS: true,
          logging: false,
          width: modalContent.scrollWidth,
          height: modalContent.scrollHeight,
          scrollX: 0,
          scrollY: 0,
        });

        // Validate canvas has content
        if (canvas.width > 0 && canvas.height > 0) {
          const imgData = canvas.toDataURL("image/png");
          
          if (imgData && imgData.startsWith('data:image/png')) {
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            let heightLeft = imgHeight;
            let position = 0;

            pdf.addImage(
              imgData,
              "PNG",
              marginLeft,
              marginTop + position,
              imgWidth,
              imgHeight
            );
            heightLeft -= pageHeight;

            while (heightLeft >= 0) {
              position = heightLeft - imgHeight;
              pdf.addPage();
              pdf.addImage(
                imgData,
                "PNG",
                marginLeft,
                marginTop + position,
                imgWidth,
                imgHeight
              );
              heightLeft -= pageHeight;
            }
          } else {
            throw new Error("Failed to generate valid image data");
          }
        } else {
          throw new Error("Canvas has no dimensions");
        }
      }

      // Generate filename
      const productName = selectedProduct?.Product_Name || "Simulation_Result";
      const timestamp = new Date().toISOString().slice(0, 10);
      const filename = hppResultsData && !isCustomFormula
        ? `HPP_Comparison_Before_After_${productName}_${timestamp}.pdf`
        : `HPP_Report_${productName}_${timestamp}.pdf`;

      // Download the PDF
      pdf.save(filename);

      notifier.success(hppResultsData && !isCustomFormula ? "PDF with Before/After comparison generated successfully!" : "PDF generated successfully!");
    } catch (error) {
      console.error("Error generating PDF:", error);
      notifier.alert("Failed to generate PDF. Please try again.");
    }
  };

  // Print function
  const handlePrintModal = () => {
    try {
      // Create a new window for printing
      const printWindow = window.open("", "_blank");
      if (!printWindow) {
        throw new Error("Could not open print window");
      }

      // Get the modal content
      const modalContent = document.querySelector(".product-hpp-modal-content");
      if (!modalContent) {
        throw new Error("Modal content not found");
      }

      // Get all stylesheets from the parent window
      const stylesheets = Array.from(document.styleSheets)
        .map((sheet) => {
          try {
            if (sheet.href) {
              return `<link rel="stylesheet" href="${sheet.href}">`;
            } else if (sheet.ownerNode && sheet.ownerNode.textContent) {
              return `<style>${sheet.ownerNode.textContent}</style>`;
            }
          } catch (e) {
            console.warn("Could not access stylesheet:", e);
          }
          return "";
        })
        .join("");

      // Write the content to the print window
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>HPP Report - ${
            selectedProduct?.Product_Name || "Simulation Result"
          }</title>
          ${stylesheets}
          <style>
            body { margin: 0; padding: 20px; font-family: Arial, sans-serif; }
            @media print {
              body { margin: 0; }
              .no-print { display: none !important; }
            }
          </style>
        </head>
        <body>
          ${modalContent.innerHTML}
        </body>
        </html>
      `);

      printWindow.document.close();

      // Wait for content to load then print
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.focus();
          printWindow.print();
          printWindow.close();
        }, 500);
      };
    } catch (error) {
      console.error("Error printing modal:", error);
      notifier.error("Failed to print. Please try again.");
    }
  };

  return (
    <div className="hpp-simulation-container">
      <div
        className={`hpp-simulation-card ${
          step === 5 && simulationType === "price-change"
            ? "price-change-no-card"
            : ""
        }`}
      >
        {error && <div className="error-message">{error}</div>}

        {/* Step 0: Simulation List */}
        {step === 0 && (
          <div className="simulation-step">
            {/* Tabs for simulation types */}
            <div className="simulation-tabs">
              <button
                className={`simulation-tab ${activeTab === "existing" ? "active" : ""}`}
                onClick={() => {
                  setActiveTab("existing");
                  setCurrentPage(1);
                  setSearchQuery("");
                }}
              >
                Product Existing
              </button>
              <button
                className={`simulation-tab ${activeTab === "custom" ? "active" : ""}`}
                onClick={() => {
                  setActiveTab("custom");
                  setCurrentPage(1);
                  setSearchQuery("");
                }}
              >
                Product Custom
              </button>
              <button
                className={`simulation-tab ${activeTab === "price-change" ? "active" : ""}`}
                onClick={() => {
                  setActiveTab("price-change");
                  setCurrentPage(1);
                  setSearchQuery("");
                }}
              >
                Price Changes
              </button>
            </div>

            <div className="simulation-list-header">
              <div className="search-and-new">
                <input
                  type="text"
                  placeholder="Search simulations (product name, formula, date)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="simulation-search-input"
                />
                <button
                  className="new-simulation-btn"
                  onClick={handleNewSimulation}
                  disabled={loading}
                >
                  + New Simulation
                </button>
              </div>
            </div>

            {listError && (
              <div className="error-message">
                {listError}
                <button onClick={loadSimulationList} className="retry-btn">
                  Retry
                </button>
              </div>
            )}

            {loadingList ? (
              <div className="loading-message">Loading simulations...</div>
            ) : (
              <div className="simulation-table-container" ref={tableContainerRef}>
                <table className="simulation-list-table">
                  <thead>
                    <tr>
                      <th
                        className="sortable-header"
                        onClick={() => handleSort("Simulasi_ID")}
                        title="Click to sort by ID"
                      >
                        ID {renderSortIcon("Simulasi_ID")}
                      </th>
                      <th
                        className="sortable-header"
                        onClick={() => handleSort("Simulasi_Type")}
                        title="Click to sort by Type"
                      >
                        Type {renderSortIcon("Simulasi_Type")}
                      </th>
                      <th
                        className="sortable-header"
                        onClick={() => handleSort("Product_ID")}
                        title="Click to sort by Product ID"
                      >
                        Product ID {renderSortIcon("Product_ID")}
                      </th>
                      <th
                        className="sortable-header"
                        onClick={() => handleSort("Product_Name")}
                        title="Click to sort by Product Name"
                      >
                        Product Name {renderSortIcon("Product_Name")}
                      </th>
                      <th
                        className="sortable-header"
                        onClick={() => handleSort("Formula")}
                        title="Click to sort by Formula"
                      >
                        Formula {renderSortIcon("Formula")}
                      </th>
                      <th
                        className="sortable-header"
                        onClick={() => handleSort("Simulasi_Deskripsi")}
                        title="Click to sort by Description"
                      >
                        Description {renderSortIcon("Simulasi_Deskripsi")}
                      </th>
                      <th
                        className="sortable-header"
                        onClick={() => handleSort("Simulasi_Date")}
                        title="Click to sort by Date"
                      >
                        Date {renderSortIcon("Simulasi_Date")}
                      </th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      if (paginatedDisplayList.length === 0) {
                        return (
                          <tr>
                            <td colSpan="8" className="no-data">
                              {searchQuery.trim()
                                ? `No simulations found matching "${searchQuery}". Try adjusting your search terms.`
                                : 'No simulations found. Click "New Simulation" to create your first simulation.'}
                            </td>
                          </tr>
                        );
                      }

                      return paginatedDisplayList.map((item, index) => {
                        if (item.type === "group") {
                          // Render Price Changes group header
                          const isExpanded = expandedGroups.has(item.groupKey);
                          return (
                            <tr
                              key={`group-${item.groupKey}`}
                              className="price-changes-group"
                              onClick={() => toggleGroup(item.groupKey)}
                              style={{ cursor: "pointer" }}
                            >
                              <td colSpan="8" className="group-header">
                                <div className="group-header-content">
                                  <div className="group-toggle">
                                    {isExpanded ? (
                                      <ChevronDown size={16} />
                                    ) : (
                                      <ChevronRight size={16} />
                                    )}
                                  </div>
                                  <div className="group-info">
                                    <span 
                                      className="group-description"
                                      title={item.description}
                                    >
                                      {item.description}
                                    </span>
                                    {/* Display affected materials */}
                                    {groupMaterialNames[item.groupKey] && groupMaterialNames[item.groupKey].length > 0 && (
                                      <div className="group-materials">
                                        <span className="materials-label">Affected Materials:</span>
                                        <span className="materials-list">
                                          {groupMaterialNames[item.groupKey].join(', ')}
                                        </span>
                                      </div>
                                    )}
                                    <div className="group-meta">
                                      <div className="group-meta-left">
                                        <span className="group-date">
                                          {item.formattedDate}
                                        </span>
                                        <span className="group-count">
                                          ({item.count} products)
                                        </span>
                                      </div>
                                      <div className="group-actions">
                                        <button
                                          className="affected-products-btn"
                                          onClick={(e) =>
                                            handleShowAffectedProducts(
                                              item.description,
                                              item.date,
                                              e
                                            )
                                          }
                                          title="View products affected by this price change"
                                        >
                                          <BarChart3 size={16} />
                                          <span>Affected Products</span>
                                        </button>
                                        <button
                                          className="bulk-delete-group-btn"
                                          onClick={(e) =>
                                            handleBulkDeleteGroup(
                                              item.description,
                                              item.date,
                                              item.count,
                                              e
                                            )
                                          }
                                          title={`Delete all ${item.count} simulations in this price change group`}
                                        >
                                          <Trash size={16} />
                                          <span>Delete Group</span>
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          );
                        } else {
                          // Render individual simulation
                          const simulation = item;
                          return (
                            <tr
                              key={simulation.Simulasi_ID}
                              className={item.isGroupChild ? "group-child" : ""}
                            >
                              <td>{simulation.Simulasi_ID}</td>
                              <td>{simulation.Simulasi_Type}</td>
                              <td>{simulation.Product_ID}</td>
                              <td className="product-name">
                                {simulation.Product_Name}
                              </td>
                              <td className="formula-cell">
                                {simulation.Formula}
                              </td>
                              <td className="description-cell">
                                {simulation.Simulasi_Deskripsi || "-"}
                              </td>
                              <td>
                                {new Date(
                                  simulation.Simulasi_Date
                                ).toLocaleDateString("id-ID")}
                              </td>
                              <td className="actions-cell">
                                <button
                                  className="preview-btn"
                                  onClick={() =>
                                    handlePreviewSimulation(simulation)
                                  }
                                  disabled={loading}
                                  title="Preview Simulation Report"
                                >
                                  <Eye size={16} />
                                </button>
                                <button
                                  className="edit-btn"
                                  onClick={() =>
                                    handleEditSimulation(simulation)
                                  }
                                  disabled={loading}
                                  title="Edit Simulation"
                                >
                                  {loading ? "⏳" : <Edit size={16} />}
                                </button>
                                {simulation.Simulasi_Type !== "Price Changes" && (
                                  <button
                                    className="clone-btn"
                                    onClick={() =>
                                      handleCloneSimulation(simulation)
                                    }
                                    disabled={loading}
                                    title="Clone Simulation"
                                  >
                                    <Copy size={16} />
                                  </button>
                                )}
                                <button
                                  className="delete-btn"
                                  onClick={() =>
                                    handleDeleteSimulation(
                                      simulation.Simulasi_ID
                                    )
                                  }
                                  disabled={loading}
                                  title="Delete Simulation"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </td>
                            </tr>
                          );
                        }
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {!loadingList && filteredSimulationList.length > 0 && (
              <div className="pagination-container">
                <div className="pagination-info">
                  Showing simulation entries
                  {searchQuery.trim() && (
                    <span className="search-info">
                      {" "}
                      (filtered from {simulationList.length} total)
                    </span>
                  )}
                  <span className="sort-info">
                    {" "}
                    • Sorted by {formatSortField(sortField)} (
                    {sortDirection === "asc" ? "A-Z" : "Z-A"})
                  </span>
                  <span className="grouping-info">
                    {" "}
                    • Price Changes are grouped by description
                  </span>
                </div>

                <div className="pagination-controls">
                  <button
                    className="pagination-btn"
                    onClick={() =>
                      setCurrentPage((prev) => Math.max(prev - 1, 1))
                    }
                    disabled={currentPage === 1}
                  >
                    ← Previous
                  </button>

                  <div className="page-numbers">
                    {(() => {
                      const totalDisplayCount = getTotalDisplayCount();
                      const totalPages = Math.ceil(
                        totalDisplayCount / itemsPerPage
                      );
                      const pages = [];
                      const startPage = Math.max(1, currentPage - 2);
                      const endPage = Math.min(totalPages, currentPage + 2);

                      if (startPage > 1) {
                        pages.push(
                          <button
                            key={1}
                            className={`page-number ${
                              currentPage === 1 ? "active" : ""
                            }`}
                            onClick={() => setCurrentPage(1)}
                          >
                            1
                          </button>
                        );
                        if (startPage > 2) {
                          pages.push(
                            <span key="ellipsis1" className="ellipsis">
                              ...
                            </span>
                          );
                        }
                      }

                      for (let i = startPage; i <= endPage; i++) {
                        pages.push(
                          <button
                            key={i}
                            className={`page-number ${
                              currentPage === i ? "active" : ""
                            }`}
                            onClick={() => setCurrentPage(i)}
                          >
                            {i}
                          </button>
                        );
                      }

                      if (endPage < totalPages) {
                        if (endPage < totalPages - 1) {
                          pages.push(
                            <span key="ellipsis2" className="ellipsis">
                              ...
                            </span>
                          );
                        }
                        pages.push(
                          <button
                            key={totalPages}
                            className={`page-number ${
                              currentPage === totalPages ? "active" : ""
                            }`}
                            onClick={() => setCurrentPage(totalPages)}
                          >
                            {totalPages}
                          </button>
                        );
                      }

                      return pages;
                    })()}
                  </div>

                  <button
                    className="pagination-btn"
                    onClick={() =>
                      setCurrentPage((prev) => {
                        const totalDisplayCount = getTotalDisplayCount();
                        const maxPage = Math.ceil(
                          totalDisplayCount / itemsPerPage
                        );
                        return Math.min(prev + 1, maxPage);
                      })
                    }
                    disabled={(() => {
                      const totalDisplayCount = getTotalDisplayCount();
                      const maxPage = Math.ceil(
                        totalDisplayCount / itemsPerPage
                      );
                      return currentPage >= maxPage;
                    })()}
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}

            {/* Show info message when groups are expanded */}
            {!loadingList && filteredSimulationList.length > 0 && expandedGroups.size > 0 && (
              <div className="expanded-groups-info">
                <p>
                  <strong>📋 Smart Pagination Active</strong> - Expanded group children are shown in full while maintaining normal pagination for group headers. You can see all items within expanded groups on this page.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Step 1: Select Simulation Type */}
        {step === 1 && (
          <div className="simulation-step">
            <div className="step-header">
              <button className="back-btn" onClick={handleBackToList}>
                ← Back to List
              </button>
              <h2>Step 1: Choose Simulation Type</h2>
            </div>
            <p>What type of simulation would you like to perform?</p>

            <div className="simulation-type-options">
              <div
                className={`simulation-option ${
                  simulationType === "existing" ? "selected" : ""
                }`}
                onClick={() => handleSimulationTypeSelect("existing")}
              >
                <div className="option-icon">📋</div>
                <h3>Existing Formula</h3>
                <p>
                  Simulate HPP using an existing product formula that has
                  already been configured in the system.
                </p>
                <div className="option-features">
                  <span>✓ Use predefined formulas</span>
                  <span>✓ Quick simulation</span>
                  <span>✓ Based on real product data</span>
                </div>
              </div>

              <div
                className={`simulation-option ${
                  simulationType === "custom" ? "selected" : ""
                }`}
                onClick={() => handleSimulationTypeSelect("custom")}
              >
                <div className="option-icon">⚙️</div>
                <h3>New Product</h3>
                <p>
                  Create a custom simulation with your own formula parameters
                  and ingredient specifications.
                </p>
                <div className="option-features">
                  <span>✓ Custom ingredients</span>
                  <span>✓ Flexible parameters</span>
                  <span>✓ What-if scenarios</span>
                </div>
              </div>

              <div
                className={`simulation-option ${
                  simulationType === "price-change" ? "selected" : ""
                }`}
                onClick={() => handleSimulationTypeSelect("price-change")}
              >
                <div className="option-icon">📊</div>
                <h3>Price Change Simulation</h3>
                <p>
                  Simulate the impact of material price changes on existing
                  products. Automatically identifies and processes affected
                  products.
                </p>
                <div className="option-features">
                  <span>✓ Price impact analysis</span>
                  <span>✓ Multi-product simulation</span>
                  <span>✓ Automatic product detection</span>
                  <span>✓ Before/after comparison</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Product Selection (for Existing Formula) */}
        {step === 2 && simulationType === "existing" && (
          <div className="simulation-step">
            <h2>Step 2: Select Product</h2>
            <p>Choose a product that has an existing formula configured.</p>

            <div className="product-search-section">
              <div className="search-input-container">
                <input
                  type="text"
                  placeholder="Search by Product ID or Product Name..."
                  value={productSearchQuery}
                  onChange={(e) => setProductSearchQuery(e.target.value)}
                  className="product-search-input"
                />
                {loading && (
                  <LoadingSpinner 
                    message="Searching..." 
                    size="small" 
                    className="esbm-inline-loading"
                  />
                )}
              </div>

              {productOptions.length > 0 && (
                <div className="product-options">
                  {productOptions.map((product) => (
                    <div
                      key={product.Product_ID}
                      className={`product-option ${
                        selectedProduct?.Product_ID === product.Product_ID
                          ? "selected"
                          : ""
                      }`}
                      onClick={() => handleProductSelect(product)}
                    >
                      <div className="product-id">{product.Product_ID}</div>
                      <div className="product-name">{product.Product_Name}</div>
                    </div>
                  ))}
                </div>
              )}

              {productSearchQuery &&
                productOptions.length === 0 &&
                !loading && (
                  <div className="no-products-found">
                    No products found matching "{productSearchQuery}". Make sure
                    the product has a configured formula.
                  </div>
                )}

              {selectedProduct && (
                <div className="selected-product">
                  <h4>Selected Product:</h4>
                  <div className="product-details">
                    <strong>{selectedProduct.Product_ID}</strong> -{" "}
                    {selectedProduct.Product_Name}
                  </div>
                </div>
              )}
            </div>

            <div className="available-products-info">
              <p>
                <strong>Available Products:</strong> {availableProducts.length}{" "}
                products with configured formulas
              </p>
            </div>

            <div className="form-actions">
              <button type="button" onClick={handleBack}>
                Back
              </button>
              <button
                type="button"
                onClick={handleNextStep}
                disabled={!selectedProduct}
              >
                Continue to Simulation
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Formula Selection */}
        {step === 3 && (
          <div className="simulation-step">
            <h2>Step 3: Select Formulas</h2>
            <p>
              Choose the formulas you want to simulate for{" "}
              <strong>
                {selectedProduct?.Product_ID} - {selectedProduct?.Product_Name}
              </strong>
            </p>

            {loading && (
              <LoadingSpinner 
                message="Loading recipe data and materials..." 
                size="medium" 
                className="esbm-table-loading"
              />
            )}

            {!loading && Object.keys(formulaGroups).length === 0 && (
              <div className="no-formulas-message">
                No formulas found for this product. Please ensure the product
                has configured formulas.
              </div>
            )}

            {!loading && Object.keys(formulaGroups).length > 0 && (
              <div className="formula-selection-section">
                {availableTypeCodes.map((typeCode) => {
                  const typeFormulas = formulaGroups[typeCode];

                  if (!typeFormulas) {
                    return (
                      <div key={typeCode} className="formula-type-section">
                        <h3 className="formula-type-title unavailable">
                          {typeCode} - {typeCodeNames[typeCode]}
                          <span className="unavailable-badge">
                            Not Available
                          </span>
                        </h3>
                        <p className="unavailable-text">
                          No formulas configured for this type.
                        </p>
                      </div>
                    );
                  }

                  const subIds = Object.keys(typeFormulas);
                  const selectedSubId = selectedFormulas[typeCode];
                  // Handle empty string formulas properly
                  const selectedFormula = selectedFormulas.hasOwnProperty(
                    typeCode
                  )
                    ? typeFormulas[selectedSubId]
                    : null;

                  return (
                    <div key={typeCode} className="formula-type-section">
                      <h3 className="formula-type-title">
                        {typeCode} - {typeCodeNames[typeCode]}
                      </h3>

                      <div className="formula-dropdown-section">
                        <label className="formula-dropdown-label">
                          Select Formula:
                        </label>
                        <select
                          className="formula-dropdown"
                          value={
                            selectedFormulas.hasOwnProperty(typeCode)
                              ? selectedSubId
                              : "__NO_SELECTION__"
                          }
                          onChange={(e) =>
                            handleFormulaSelection(typeCode, e.target.value)
                          }
                        >
                          <option value="__NO_SELECTION__">
                            -- Select a formula --
                          </option>
                          {subIds.map((subId) => {
                            const formula = typeFormulas[subId];
                            // Handle display for empty string formulas
                            const formulaDisplay =
                              subId === ""
                                ? "(Empty Formula)"
                                : `Formula ${subId}`;
                            return (
                              <option key={subId} value={subId}>
                                {formulaDisplay} - {formula.source}
                                {formula.isActive ? " (Currently Active)" : ""}
                                {formula.batchSize
                                  ? ` - Batch: ${formula.batchSize.toLocaleString()}`
                                  : ""}
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      {selectedFormula && (
                        <div className="selected-formula-details">
                          <div className="formula-info">
                            <div className="formula-info-row">
                              <span className="info-label">Formula ID:</span>
                              <span className="info-value">
                                {selectedSubId === ""
                                  ? "(Empty Formula)"
                                  : selectedSubId}
                                {selectedFormula.isActive && (
                                  <span className="active-indicator">
                                    Currently Active
                                  </span>
                                )}
                              </span>
                            </div>
                            <div className="formula-info-row">
                              <span className="info-label">Source:</span>
                              <span className="info-value">
                                {selectedFormula.source}
                              </span>
                            </div>
                            <div className="formula-info-row">
                              <span className="info-label">Batch Size:</span>
                              <span className="info-value">
                                {selectedFormula.batchSize?.toLocaleString() ||
                                  "N/A"}
                              </span>
                            </div>
                            <div className="formula-info-row">
                              <span className="info-label">
                                Total Materials:
                              </span>
                              <span className="info-value">
                                {selectedFormula.materials.length}
                              </span>
                            </div>
                          </div>

                          <div className="materials-table">
                            <h4>Materials Used:</h4>
                            <div className="table-container">
                              <table>
                                <thead>
                                  <tr>
                                    <th>Seq</th>
                                    <th>Material ID</th>
                                    <th>Material Name</th>
                                    <th>Type</th>
                                    <th>Quantity</th>
                                    <th>Unit</th>
                                    <th>Unit Price</th>
                                    <th>Total Cost</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {selectedFormula.materials.map(
                                    (material, idx) => {
                                      const materialInfo =
                                        materialMap[material.itemId] || {};
                                      // Calculate actual unit price: total price divided by formula quantity
                                      const actualUnitPrice =
                                        material.unitPrice && material.qty
                                          ? material.unitPrice / material.qty
                                          : 0;
                                      // Total cost is just the UnitPrice (which is already the total cost for this material in the formula)
                                      const totalCost = material.unitPrice || 0;

                                      return (
                                        <tr key={idx}>
                                          <td>{material.seqId}</td>
                                          <td className="material-id-cell">
                                            {material.itemId}
                                          </td>
                                          <td className="material-name-cell">
                                            {materialInfo.Item_Name ||
                                              "Unknown Material"}
                                          </td>
                                          <td>
                                            <span
                                              className={`item-type-badge ${material.itemType.toLowerCase()}`}
                                            >
                                              {material.itemType}
                                            </span>
                                          </td>
                                          <td className="qty-cell">
                                            {material.qty.toLocaleString()}
                                          </td>
                                          <td>{material.unitId}</td>
                                          <td className="price-cell">
                                            {actualUnitPrice
                                              ? `Rp ${actualUnitPrice.toLocaleString()}`
                                              : "N/A"}
                                          </td>
                                          <td className="total-cost-cell">
                                            <strong>
                                              Rp {totalCost.toLocaleString()}
                                            </strong>
                                          </td>
                                        </tr>
                                      );
                                    }
                                  )}
                                </tbody>
                                <tfoot>
                                  <tr className="total-row">
                                    <td colSpan="7">
                                      <strong>Total Formula Cost:</strong>
                                    </td>
                                    <td className="total-cost-cell">
                                      <strong>
                                        Rp{" "}
                                        {selectedFormula.materials
                                          .reduce(
                                            (sum, material) =>
                                              sum + (material.unitPrice || 0),
                                            0
                                          )
                                          .toLocaleString()}
                                      </strong>
                                    </td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="form-actions">
              <button type="button" onClick={handleBack}>
                Back
              </button>
              <button
                type="button"
                onClick={handleRunSimulation}
                disabled={loading || Object.keys(selectedFormulas).length === 0}
              >
                {loading ? "Running Simulation..." : "Run Simulation"}
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Simulation Results */}
        {step === 4 && simulationResults && (
          <div className="simulation-step">
            <div className="step-header">
              <button className="back-btn" onClick={handleBackToList}>
                ← Back to List
              </button>
              <h2>Step 4: Simulation Results</h2>
            </div>
            <p>
              HPP simulation completed for{" "}
              <strong>
                {selectedProduct?.Product_ID} - {selectedProduct?.Product_Name}
              </strong>
            </p>

            {simulationResults.length > 0 && (
              <div className="simulation-results-section">
                {/* Loading state for detailed data */}
                {loadingDetails && (
                  <LoadingSpinner 
                    message="Loading detailed simulation data..." 
                    size="medium" 
                    className="esbm-table-loading"
                  />
                )}

                {/* Custom Formula or Selected Formulas Summary */}
                {isCustomFormula ? (
                  <div className="custom-formula-inputs">
                    <h4>Custom Formula Configuration:</h4>
                    <div className="custom-inputs-grid">
                      <div className="custom-input-item">
                        <label className="custom-input-label">
                          Product Name:
                        </label>
                        <input
                          type="text"
                          value={customProductName}
                          onChange={(e) => setCustomProductName(e.target.value)}
                          className="custom-input-field"
                          placeholder="Enter custom product name"
                        />
                      </div>
                      <div className="custom-input-item">
                        <label className="custom-input-label">
                          Formula Name:
                        </label>
                        <input
                          type="text"
                          value={customFormulaName}
                          onChange={(e) => setCustomFormulaName(e.target.value)}
                          className="custom-input-field"
                          placeholder="Enter custom formula name"
                        />
                      </div>
                      <div className="custom-input-item">
                        <label className="custom-input-label">
                          Production Line:
                        </label>
                        <select
                          value={customLine}
                          onChange={(e) => setCustomLine(e.target.value)}
                          className="custom-select-field"
                        >
                          <option value="PN1">PN1</option>
                          <option value="PN2">PN2</option>
                        </select>
                      </div>
                      <div className="custom-input-item">
                        <label className="custom-input-label">
                          Group:
                        </label>
                        <select
                          value={selectedGroup}
                          onChange={(e) => handleGroupSelection(e.target.value)}
                          className="custom-select-field"
                          disabled={loadingGroups}
                        >
                          <option value="">
                            {loadingGroups ? "Loading groups..." : "-- Select Group --"}
                          </option>
                          {groupsData.map((group) => (
                            <option 
                              key={group.Group_PNCategoryID} 
                              value={group.Group_PNCategoryID}
                              title={group.Group_PNCategory_Name} // Tooltip for long names
                            >
                              {group.Group_PNCategoryID}. {
                                group.Group_PNCategory_Name.length > 60 
                                  ? `${group.Group_PNCategory_Name.substring(0, 60)}...`
                                  : group.Group_PNCategory_Name
                              }
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="selected-formulas-final">
                    <h4>Selected Formulas Used:</h4>
                    <div className="formulas-grid">
                      {availableTypeCodes.map((typeCode) => {
                        const subId = selectedFormulas[typeCode];
                        return (
                          <div key={typeCode} className="formula-final-item">
                            <span className="formula-type">{typeCode}:</span>
                            <span className="formula-id">
                              {subId === undefined
                                ? "(Empty Formula)"
                                : subId === ""
                                ? "(Empty Formula)"
                                : `Formula ${subId}`}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Simulation Summary */}
                <div className="simulation-summary">
                  <h4>Simulation Summary:</h4>

                  {/* Description field - allows user to add notes/purpose for the simulation */}
                  <div className="summary-description">
                    <div className="summary-item full-width">
                      <span className="summary-label">Description:</span>
                      <textarea
                        value={
                          editableDescription ||
                          simulationResults[0]?.Simulasi_Deskripsi ||
                          ""
                        }
                        onChange={(e) => setEditableDescription(e.target.value)}
                        className="summary-textarea-input"
                        placeholder="Add a description for this simulation (optional)"
                        rows="3"
                      />
                    </div>
                  </div>

                  <div className="summary-grid">
                    <div className="summary-item">
                      <span className="summary-label">Product Type (LOB):</span>
                      <select
                        value={
                          editableLOB ||
                          normalizeLOB(simulationResults[0].LOB) ||
                          "ETHICAL"
                        }
                        onChange={(e) => setEditableLOB(e.target.value)}
                        className="summary-select-input"
                      >
                        <option value="ETHICAL">ETHICAL</option>
                        <option value="OTC">OTC</option>
                        <option value="GENERIC">GENERIC</option>
                      </select>
                    </div>
                    <div className="summary-item">
                      <span className="summary-label">Type:</span>
                      <select
                        value={
                          editableVersion || simulationResults[0].Versi || "1"
                        }
                        onChange={(e) => setEditableVersion(e.target.value)}
                        className="summary-select-input"
                        disabled={getCurrentLOB() !== "GENERIC"}
                      >
                        <option value="1">1</option>
                        <option value="2">2</option>
                      </select>
                    </div>
                    <div className="summary-item">
                      <span className="summary-label">Batch Size:</span>
                      <input
                        type="number"
                        value={
                          editableBatchSize ||
                          simulationResults[0].Batch_Size ||
                          ""
                        }
                        onChange={(e) =>
                          setEditableBatchSize(parseFloat(e.target.value) || 0)
                        }
                        className="summary-edit-input"
                        min="1"
                      />
                    </div>
                    <div className="summary-item">
                      <span className="summary-label">Line:</span>
                      <span className="summary-value">
                        {isCustomFormula
                          ? customLine
                          : simulationResults[0].Group_PNCategory_Dept}
                      </span>
                    </div>
                    <div className="summary-item">
                      <span className="summary-label">Rendemen:</span>
                      <div className="summary-input-group">
                        <input
                          type="number"
                          value={
                            editableRendemen ||
                            simulationResults[0].Group_Rendemen ||
                            ""
                          }
                          onChange={(e) =>
                            setEditableRendemen(parseFloat(e.target.value) || 0)
                          }
                          className="summary-edit-input"
                          min="1"
                          max="100"
                          step="0.1"
                        />
                        <span className="summary-unit">%</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Detailed Materials Section - Show when data is loaded OR in custom formula mode */}
                {!loadingDetails &&
                  (simulationDetailBahan.length > 0 || isCustomFormula) && (
                    <>
                      {/* Bahan Baku Section */}
                      <div className="material-breakdown">
                        <div className="material-section-header">
                          <h4>Bahan Baku (Raw Materials)</h4>
                          <button
                            className="add-material-btn"
                            onClick={() => handleAddMaterial("BB")}
                            type="button"
                          >
                            + Add Material
                          </button>
                        </div>
                        <div className="material-table-container">
                          <table className="material-table">
                            <thead>
                              <tr>
                                <th>No</th>
                                <th>Kode Material</th>
                                <th>Nama Material</th>
                                <th>Qty</th>
                                <th>Satuan</th>
                                <th>Cost/Unit</th>
                                <th>Extended Cost</th>
                                <th>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {getBahanBakuFromApiData().map((item, index) => {
                                const globalIndex =
                                  editableMaterialData.findIndex(
                                    (m) =>
                                      m.Item_ID === item.Item_ID &&
                                      m.Seq_ID === item.Seq_ID &&
                                      m.Tipe_Bahan === "BB"
                                  );
                                const isCustom =
                                  item.isCustom || item.Item_ID === "CUSTOM";

                                return (
                                  <tr key={`bb-${item.Item_ID}-${item.Seq_ID}`}>
                                    <td>{index + 1}</td>
                                    <td>
                                      {isCustom ? (
                                        <span className="custom-material-code">
                                          Custom
                                        </span>
                                      ) : (
                                        item.Item_ID
                                      )}
                                    </td>
                                    <td>
                                      {isCustom ? (
                                        <input
                                          type="text"
                                          value={item.Item_Name || ""}
                                          onChange={(e) =>
                                            handleCustomMaterialFieldChange(
                                              globalIndex,
                                              "Item_Name",
                                              e.target.value
                                            )
                                          }
                                          className="custom-material-input"
                                          placeholder="Material name..."
                                        />
                                      ) : (
                                        item.Item_Name
                                      )}
                                    </td>
                                    <td className="number">
                                      <input
                                        type="number"
                                        value={item.Item_QTY || 0}
                                        onChange={(e) =>
                                          isCustom
                                            ? handleCustomMaterialFieldChange(
                                                globalIndex,
                                                "Item_QTY",
                                                e.target.value
                                              )
                                            : handleMaterialQuantityChange(
                                                globalIndex,
                                                e.target.value
                                              )
                                        }
                                        className="qty-edit-input"
                                        min="0"
                                        step="0.01"
                                      />
                                    </td>
                                    <td>
                                      {isCustom ? (
                                        <input
                                          type="text"
                                          value={item.Item_Unit || ""}
                                          onChange={(e) =>
                                            handleCustomMaterialFieldChange(
                                              globalIndex,
                                              "Item_Unit",
                                              e.target.value
                                            )
                                          }
                                          className="custom-material-input unit-input"
                                          placeholder="Unit..."
                                        />
                                      ) : (
                                        item.Item_Unit
                                      )}
                                    </td>
                                    <td className="number">
                                      <input
                                        type="number"
                                        value={item.Item_Unit_Price || 0}
                                        onChange={(e) =>
                                          handleCustomMaterialFieldChange(
                                            globalIndex,
                                            "Item_Unit_Price",
                                            e.target.value
                                          )
                                        }
                                        className="custom-material-input price-input"
                                        min="0"
                                        step="0.01"
                                        placeholder="0.00"
                                      />
                                    </td>
                                    <td className="number">
                                      Rp{" "}
                                      {formatNumber(
                                        item.Item_Unit_Price * item.Item_QTY,
                                        2
                                      )}
                                    </td>
                                    <td className="actions">
                                      <button
                                        className="remove-material-btn"
                                        onClick={() =>
                                          handleRemoveMaterial(globalIndex)
                                        }
                                        type="button"
                                        title="Remove material"
                                      >
                                        ✕
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                            <tfoot>
                              <tr className="total-row">
                                <td colSpan="6">
                                  <strong>Total Bahan Baku</strong>
                                </td>
                                <td
                                  className="number total-value-cell"
                                  colSpan="2"
                                >
                                  <strong>
                                    Rp{" "}
                                    {formatNumber(calculateTotalBahanBaku(), 2)}
                                  </strong>
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>

                      {/* Bahan Kemas Section */}
                      <div className="material-breakdown">
                        <div className="material-section-header">
                          <h4>Bahan Kemas (Packaging Materials)</h4>
                          <button
                            className="add-material-btn"
                            onClick={() => handleAddMaterial("BK")}
                            type="button"
                          >
                            + Add Material
                          </button>
                        </div>
                        <div className="material-table-container">
                          <table className="material-table">
                            <thead>
                              <tr>
                                <th>No</th>
                                <th>Kode Material</th>
                                <th>Nama Material</th>
                                <th>Qty</th>
                                <th>Satuan</th>
                                <th>Cost/Unit</th>
                                <th>Extended Cost</th>
                                <th>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {getBahanKemasFromApiData().map((item, index) => {
                                const globalIndex =
                                  editableMaterialData.findIndex(
                                    (m) =>
                                      m.Item_ID === item.Item_ID &&
                                      m.Seq_ID === item.Seq_ID &&
                                      m.Tipe_Bahan === "BK"
                                  );
                                const isCustom =
                                  item.isCustom || item.Item_ID === "CUSTOM";

                                return (
                                  <tr key={`bk-${item.Item_ID}-${item.Seq_ID}`}>
                                    <td>{index + 1}</td>
                                    <td>
                                      {isCustom ? (
                                        <span className="custom-material-code">
                                          Custom
                                        </span>
                                      ) : (
                                        item.Item_ID
                                      )}
                                    </td>
                                    <td>
                                      {isCustom ? (
                                        <input
                                          type="text"
                                          value={item.Item_Name || ""}
                                          onChange={(e) =>
                                            handleCustomMaterialFieldChange(
                                              globalIndex,
                                              "Item_Name",
                                              e.target.value
                                            )
                                          }
                                          className="custom-material-input"
                                          placeholder="Material name..."
                                        />
                                      ) : (
                                        item.Item_Name
                                      )}
                                    </td>
                                    <td className="number">
                                      <input
                                        type="number"
                                        value={item.Item_QTY || 0}
                                        onChange={(e) =>
                                          isCustom
                                            ? handleCustomMaterialFieldChange(
                                                globalIndex,
                                                "Item_QTY",
                                                e.target.value
                                              )
                                            : handleMaterialQuantityChange(
                                                globalIndex,
                                                e.target.value
                                              )
                                        }
                                        className="qty-edit-input"
                                        min="0"
                                        step="0.01"
                                      />
                                    </td>
                                    <td>
                                      {isCustom ? (
                                        <input
                                          type="text"
                                          value={item.Item_Unit || ""}
                                          onChange={(e) =>
                                            handleCustomMaterialFieldChange(
                                              globalIndex,
                                              "Item_Unit",
                                              e.target.value
                                            )
                                          }
                                          className="custom-material-input unit-input"
                                          placeholder="Unit..."
                                        />
                                      ) : (
                                        item.Item_Unit
                                      )}
                                    </td>
                                    <td className="number">
                                      <input
                                        type="number"
                                        value={item.Item_Unit_Price || 0}
                                        onChange={(e) =>
                                          handleCustomMaterialFieldChange(
                                            globalIndex,
                                            "Item_Unit_Price",
                                            e.target.value
                                          )
                                        }
                                        className="custom-material-input price-input"
                                        min="0"
                                        step="0.01"
                                        placeholder="0.00"
                                      />
                                    </td>
                                    <td className="number">
                                      Rp{" "}
                                      {formatNumber(
                                        item.Item_Unit_Price * item.Item_QTY,
                                        2
                                      )}
                                    </td>
                                    <td className="actions">
                                      <button
                                        className="remove-material-btn"
                                        onClick={() =>
                                          handleRemoveMaterial(globalIndex)
                                        }
                                        type="button"
                                        title="Remove material"
                                      >
                                        ✕
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                            <tfoot>
                              <tr className="total-row">
                                <td colSpan="6">
                                  <strong>Total Bahan Kemas</strong>
                                </td>
                                <td
                                  className="number total-value-cell"
                                  colSpan="2"
                                >
                                  <strong>
                                    Rp{" "}
                                    {formatNumber(
                                      calculateTotalBahanKemas(),
                                      2
                                    )}
                                  </strong>
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>
                    </>
                  )}

                {/* Overhead Cost Breakdown for ETHICAL/OTC Products */}
                {(getCurrentLOB() === "ETHICAL" ||
                  getCurrentLOB() === "OTC") && (
                  <div className="overhead-cost">
                    <h4>Overhead Cost Breakdown ({getCurrentLOB()}):</h4>
                    <div className="overhead-cost-grid">
                      <div className="overhead-cost-item">
                        <span className="overhead-label">Processing Cost:</span>
                        <div className="overhead-formula-editable">
                          <span className="formula-part">(</span>
                          <input
                            type="number"
                            value={editableOverheadData.MH_Proses_Std || 0}
                            onChange={(e) =>
                              setEditableOverheadData({
                                ...editableOverheadData,
                                MH_Proses_Std: parseFloat(e.target.value) || 0,
                              })
                            }
                            className="overhead-edit-input"
                            step="0.1"
                            min="0"
                          />
                          <span className="formula-part">MH × Rp</span>
                          <input
                            type="number"
                            value={editableOverheadData.Biaya_Proses || 0}
                            onChange={(e) =>
                              setEditableOverheadData({
                                ...editableOverheadData,
                                Biaya_Proses: parseFloat(e.target.value) || 0,
                              })
                            }
                            className="overhead-edit-input"
                            step="0.01"
                            min="0"
                          />
                          <span className="formula-part">)</span>
                        </div>
                        <span className="overhead-value">
                          Rp {formatNumber(calculateProcessingCost(), 2)}
                        </span>
                      </div>
                      <div className="overhead-cost-item">
                        <span className="overhead-label">Packaging Cost:</span>
                        <div className="overhead-formula-editable">
                          <span className="formula-part">(</span>
                          <input
                            type="number"
                            value={editableOverheadData.MH_Kemas_Std || 0}
                            onChange={(e) =>
                              setEditableOverheadData({
                                ...editableOverheadData,
                                MH_Kemas_Std: parseFloat(e.target.value) || 0,
                              })
                            }
                            className="overhead-edit-input"
                            step="0.1"
                            min="0"
                          />
                          <span className="formula-part">MH × Rp</span>
                          <input
                            type="number"
                            value={editableOverheadData.Biaya_Kemas || 0}
                            onChange={(e) =>
                              setEditableOverheadData({
                                ...editableOverheadData,
                                Biaya_Kemas: parseFloat(e.target.value) || 0,
                              })
                            }
                            className="overhead-edit-input"
                            step="0.01"
                            min="0"
                          />
                          <span className="formula-part">)</span>
                        </div>
                        <span className="overhead-value">
                          Rp {formatNumber(calculatePackagingCost(), 2)}
                        </span>
                      </div>
                      <div className="overhead-cost-item">
                        <span className="overhead-label">Expiry Cost:</span>
                        <div className="overhead-formula-editable">
                          <span className="formula-part">Rp</span>
                          <input
                            type="number"
                            value={
                              editableOverheadData.Beban_Sisa_Bahan_Exp || 0
                            }
                            onChange={(e) =>
                              setEditableOverheadData({
                                ...editableOverheadData,
                                Beban_Sisa_Bahan_Exp:
                                  parseFloat(e.target.value) || 0,
                              })
                            }
                            className="overhead-edit-input"
                            step="0.01"
                            min="0"
                            placeholder="0"
                          />
                          <span className="formula-part">(Direct Value)</span>
                        </div>
                        <span className="overhead-value">
                          Rp {formatNumber(calculateExpiryCost(), 2)}
                        </span>
                      </div>
                      <div className="overhead-cost-item total-overhead">
                        <span className="overhead-label">Total Overhead:</span>
                        <span className="overhead-formula"></span>
                        <span className="overhead-value">
                          Rp {formatNumber(calculateTotalOverhead(), 2)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Overhead Cost Breakdown for GENERIC Version 1 Products */}
                {getCurrentLOB() === "GENERIC" &&
                  (editableVersion || simulationResults[0].Versi) === "1" && (
                    <div className="overhead-cost">
                      <h4>Overhead Cost Breakdown (GENERIC V1):</h4>
                      <div className="overhead-cost-grid">
                        <div className="overhead-cost-item">
                          <span className="overhead-label">
                            Ingredients Weighing:
                          </span>
                          <div className="overhead-formula-editable">
                            <span className="formula-part">(</span>
                            <input
                              type="number"
                              value={editableOverheadData.MH_Timbang_BB || 0}
                              onChange={(e) =>
                                setEditableOverheadData({
                                  ...editableOverheadData,
                                  MH_Timbang_BB:
                                    parseFloat(e.target.value) || 0,
                                })
                              }
                              className="overhead-edit-input"
                              step="0.1"
                              min="0"
                            />
                            <span className="formula-part">MH × Rp</span>
                            <input
                              type="number"
                              value={editableOverheadData.Biaya_Proses || 0}
                              onChange={(e) => {
                                const newValue = parseFloat(e.target.value) || 0;
                                setEditableOverheadData({
                                  ...editableOverheadData,
                                  Biaya_Proses: newValue,
                                })
                              }}
                              className="overhead-edit-input"
                              step="0.01"
                              min="0"
                            />
                            <span className="formula-part">)</span>
                          </div>
                          <span className="overhead-value">
                            Rp {formatNumber(calculateIngredientsWeighing(), 2)}
                          </span>
                        </div>
                        <div className="overhead-cost-item">
                          <span className="overhead-label">
                            Packaging Weighing:
                          </span>
                          <div className="overhead-formula-editable">
                            <span className="formula-part">(</span>
                            <input
                              type="number"
                              value={editableOverheadData.MH_Timbang_BK || 0}
                              onChange={(e) =>
                                setEditableOverheadData({
                                  ...editableOverheadData,
                                  MH_Timbang_BK:
                                    parseFloat(e.target.value) || 0,
                                })
                              }
                              className="overhead-edit-input"
                              step="0.1"
                              min="0"
                            />
                            <span className="formula-part">MH × Rp</span>
                            <input
                              type="number"
                              value={editableOverheadData.Biaya_Kemas || 0}
                              onChange={(e) => {
                                const newValue = parseFloat(e.target.value) || 0;
                                setEditableOverheadData({
                                  ...editableOverheadData,
                                  Biaya_Kemas: newValue,
                                })
                              }}
                              className="overhead-edit-input"
                              step="0.01"
                              min="0"
                            />
                            <span className="formula-part">)</span>
                          </div>
                          <span className="overhead-value">
                            Rp {formatNumber(calculatePackagingWeighing(), 2)}
                          </span>
                        </div>
                        <div className="overhead-cost-item">
                          <span className="overhead-label">
                            Processing Cost:
                          </span>
                          <div className="overhead-formula-editable">
                            <span className="formula-part">(</span>
                            <input
                              type="number"
                              value={editableOverheadData.MH_Proses_Std || 0}
                              onChange={(e) =>
                                setEditableOverheadData({
                                  ...editableOverheadData,
                                  MH_Proses_Std:
                                    parseFloat(e.target.value) || 0,
                                })
                              }
                              className="overhead-edit-input"
                              step="0.1"
                              min="0"
                            />
                            <span className="formula-part">MH × Rp</span>
                            <input
                              type="number"
                              value={editableOverheadData.Biaya_Proses || 0}
                              onChange={(e) => {
                                const newValue = parseFloat(e.target.value) || 0;
                                setEditableOverheadData({
                                  ...editableOverheadData,
                                  Biaya_Proses: newValue,
                                })
                              }}
                              className="overhead-edit-input"
                              step="0.01"
                              min="0"
                            />
                            <span className="formula-part">)</span>
                          </div>
                          <span className="overhead-value">
                            Rp{" "}
                            {formatNumber(calculateGenericProcessingCost(), 2)}
                          </span>
                        </div>
                        <div className="overhead-cost-item">
                          <span className="overhead-label">
                            Packaging Cost:
                          </span>
                          <div className="overhead-formula-editable">
                            <span className="formula-part">(</span>
                            <input
                              type="number"
                              value={editableOverheadData.MH_Kemas_Std || 0}
                              onChange={(e) =>
                                setEditableOverheadData({
                                  ...editableOverheadData,
                                  MH_Kemas_Std: parseFloat(e.target.value) || 0,
                                })
                              }
                              className="overhead-edit-input"
                              step="0.1"
                              min="0"
                            />
                            <span className="formula-part">MH × Rp</span>
                            <input
                              type="number"
                              value={editableOverheadData.Biaya_Kemas || 0}
                              onChange={(e) => {
                                const newValue = parseFloat(e.target.value) || 0;
                                setEditableOverheadData({
                                  ...editableOverheadData,
                                  Biaya_Kemas: newValue,
                                })
                              }}
                              className="overhead-edit-input"
                              step="0.01"
                              min="0"
                            />
                            <span className="formula-part">)</span>
                          </div>
                          <span className="overhead-value">
                            Rp{" "}
                            {formatNumber(calculateGenericPackagingCost(), 2)}
                          </span>
                        </div>
                        <div className="overhead-cost-item">
                          <span className="overhead-label">Analysis Fee:</span>
                          <div className="overhead-formula-editable">
                            <span className="formula-part">(</span>
                            <input
                              type="number"
                              value={editableOverheadData.MH_Analisa_Std || 0}
                              onChange={(e) =>
                                setEditableOverheadData({
                                  ...editableOverheadData,
                                  MH_Analisa_Std:
                                    parseFloat(e.target.value) || 0,
                                })
                              }
                              className="overhead-edit-input"
                              step="0.1"
                              min="0"
                            />
                            <span className="formula-part">MH × Rp</span>
                            <input
                              type="number"
                              value={editableOverheadData.Biaya_Analisa || 0}
                              onChange={(e) =>
                                setEditableOverheadData({
                                  ...editableOverheadData,
                                  Biaya_Analisa:
                                    parseFloat(e.target.value) || 0,
                                })
                              }
                              className="overhead-edit-input"
                              step="0.01"
                              min="0"
                            />
                            <span className="formula-part">)</span>
                          </div>
                          <span className="overhead-value">
                            Rp {formatNumber(calculateAnalysisFee(), 2)}
                          </span>
                        </div>
                        <div className="overhead-cost-item">
                          <span className="overhead-label">Machine Fee:</span>
                          <div className="overhead-formula-editable">
                            <span className="formula-part">(</span>
                            <input
                              type="number"
                              value={editableOverheadData.MH_Mesin_Std || 0}
                              onChange={(e) =>
                                setEditableOverheadData({
                                  ...editableOverheadData,
                                  MH_Mesin_Std: parseFloat(e.target.value) || 0,
                                })
                              }
                              className="overhead-edit-input"
                              step="0.1"
                              min="0"
                            />
                            <span className="formula-part">MH × Rp</span>
                            <input
                              type="number"
                              value={editableOverheadData.Rate_PLN || 0}
                              onChange={(e) =>
                                setEditableOverheadData({
                                  ...editableOverheadData,
                                  Rate_PLN: parseFloat(e.target.value) || 0,
                                })
                              }
                              className="overhead-edit-input"
                              step="0.01"
                              min="0"
                            />
                            <span className="formula-part">)</span>
                          </div>
                          <span className="overhead-value">
                            Rp {formatNumber(calculateMachineFee(), 2)}
                          </span>
                        </div>
                        <div className="overhead-cost-item">
                          <span className="overhead-label">Reagent Fee:</span>
                          <div className="overhead-formula-editable">
                            <span className="formula-part">Rp</span>
                            <input
                              type="number"
                              value={editableOverheadData.Biaya_Reagen || 0}
                              onChange={(e) =>
                                setEditableOverheadData({
                                  ...editableOverheadData,
                                  Biaya_Reagen: parseFloat(e.target.value) || 0,
                                })
                              }
                              className="overhead-edit-input"
                              step="0.01"
                              min="0"
                              placeholder="0"
                            />
                            <span className="formula-part">(Direct Value)</span>
                          </div>
                          <span className="overhead-value">
                            Rp {formatNumber(calculateReagentFee(), 2)}
                          </span>
                        </div>
                        <div className="overhead-cost-item">
                          <span className="overhead-label">Expiry Cost:</span>
                          <div className="overhead-formula-editable">
                            <span className="formula-part">Rp</span>
                            <input
                              type="number"
                              value={
                                editableOverheadData.Beban_Sisa_Bahan_Exp || 0
                              }
                              onChange={(e) =>
                                setEditableOverheadData({
                                  ...editableOverheadData,
                                  Beban_Sisa_Bahan_Exp:
                                    parseFloat(e.target.value) || 0,
                                })
                              }
                              className="overhead-edit-input"
                              step="0.01"
                              min="0"
                              placeholder="0"
                            />
                            <span className="formula-part">(Direct Value)</span>
                          </div>
                          <span className="overhead-value">
                            Rp {formatNumber(calculateGenericExpiryCost(), 2)}
                          </span>
                        </div>
                        <div className="overhead-cost-item total-overhead">
                          <span className="overhead-label">
                            Total Overhead:
                          </span>
                          <span className="overhead-formula"></span>
                          <span className="overhead-value">
                            Rp {formatNumber(calculateTotalOverhead(), 2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                {/* Overhead Cost Breakdown for GENERIC Version 2 Products */}
                {getCurrentLOB() === "GENERIC" &&
                  (editableVersion || simulationResults[0].Versi) === "2" && (
                    <div className="overhead-cost">
                      <h4>Overhead Cost Breakdown (GENERIC V2):</h4>
                      <div className="overhead-cost-grid">
                        <div className="overhead-cost-item">
                          <span className="overhead-label">
                            Production Labor Cost:
                          </span>
                          <div className="overhead-formula-editable">
                            <span className="formula-part">(</span>
                            <input
                              type="number"
                              value={editableOverheadData.MH_Proses_Std || 0}
                              onChange={(e) =>
                                setEditableOverheadData({
                                  ...editableOverheadData,
                                  MH_Proses_Std:
                                    parseFloat(e.target.value) || 0,
                                })
                              }
                              className="overhead-edit-input"
                              step="0.1"
                              min="0"
                            />
                            <span className="formula-part">MH × Rp</span>
                            <input
                              type="number"
                              value={editableOverheadData.Direct_Labor || 0}
                              onChange={(e) =>
                                setEditableOverheadData({
                                  ...editableOverheadData,
                                  Direct_Labor: parseFloat(e.target.value) || 0,
                                })
                              }
                              className="overhead-edit-input"
                              step="0.01"
                              min="0"
                            />
                            <span className="formula-part">)</span>
                          </div>
                          <span className="overhead-value">
                            Rp {formatNumber(calculateProductionLaborCost(), 2)}
                          </span>
                        </div>
                        <div className="overhead-cost-item">
                          <span className="overhead-label">
                            Packaging Labor Cost:
                          </span>
                          <div className="overhead-formula-editable">
                            <span className="formula-part">(</span>
                            <input
                              type="number"
                              value={editableOverheadData.MH_Kemas_Std || 0}
                              onChange={(e) =>
                                setEditableOverheadData({
                                  ...editableOverheadData,
                                  MH_Kemas_Std: parseFloat(e.target.value) || 0,
                                })
                              }
                              className="overhead-edit-input"
                              step="0.1"
                              min="0"
                            />
                            <span className="formula-part">MH × Rp</span>
                            <input
                              type="number"
                              value={editableOverheadData.Direct_Labor || 0}
                              onChange={(e) =>
                                setEditableOverheadData({
                                  ...editableOverheadData,
                                  Direct_Labor: parseFloat(e.target.value) || 0,
                                })
                              }
                              className="overhead-edit-input"
                              step="0.01"
                              min="0"
                            />
                            <span className="formula-part">)</span>
                          </div>
                          <span className="overhead-value">
                            Rp {formatNumber(calculatePackagingLaborCost(), 2)}
                          </span>
                        </div>
                        <div className="overhead-cost-item">
                          <span className="overhead-label">
                            Production FOH:
                          </span>
                          <div className="overhead-formula-editable">
                            <span className="formula-part">(</span>
                            <input
                              type="number"
                              value={editableOverheadData.MH_Proses_Std || 0}
                              onChange={(e) =>
                                setEditableOverheadData({
                                  ...editableOverheadData,
                                  MH_Proses_Std:
                                    parseFloat(e.target.value) || 0,
                                })
                              }
                              className="overhead-edit-input"
                              step="0.1"
                              min="0"
                            />
                            <span className="formula-part">MH × Rp</span>
                            <input
                              type="number"
                              value={
                                editableOverheadData.Factory_Over_Head || 0
                              }
                              onChange={(e) =>
                                setEditableOverheadData({
                                  ...editableOverheadData,
                                  Factory_Over_Head:
                                    parseFloat(e.target.value) || 0,
                                })
                              }
                              className="overhead-edit-input"
                              step="0.01"
                              min="0"
                            />
                            <span className="formula-part">)</span>
                          </div>
                          <span className="overhead-value">
                            Rp {formatNumber(calculateProductionFOH(), 2)}
                          </span>
                        </div>
                        <div className="overhead-cost-item">
                          <span className="overhead-label">Packaging FOH:</span>
                          <div className="overhead-formula-editable">
                            <span className="formula-part">(</span>
                            <input
                              type="number"
                              value={editableOverheadData.MH_Kemas_Std || 0}
                              onChange={(e) =>
                                setEditableOverheadData({
                                  ...editableOverheadData,
                                  MH_Kemas_Std: parseFloat(e.target.value) || 0,
                                })
                              }
                              className="overhead-edit-input"
                              step="0.1"
                              min="0"
                            />
                            <span className="formula-part">MH × Rp</span>
                            <input
                              type="number"
                              value={
                                editableOverheadData.Factory_Over_Head || 0
                              }
                              onChange={(e) =>
                                setEditableOverheadData({
                                  ...editableOverheadData,
                                  Factory_Over_Head:
                                    parseFloat(e.target.value) || 0,
                                })
                              }
                              className="overhead-edit-input"
                              step="0.01"
                              min="0"
                            />
                            <span className="formula-part">)</span>
                          </div>
                          <span className="overhead-value">
                            Rp {formatNumber(calculatePackagingFOH(), 2)}
                          </span>
                        </div>
                        <div className="overhead-cost-item">
                          <span className="overhead-label">Expiry Cost:</span>
                          <div className="overhead-formula-editable">
                            <span className="formula-part">Rp</span>
                            <input
                              type="number"
                              value={
                                editableOverheadData.Beban_Sisa_Bahan_Exp || 0
                              }
                              onChange={(e) =>
                                setEditableOverheadData({
                                  ...editableOverheadData,
                                  Beban_Sisa_Bahan_Exp:
                                    parseFloat(e.target.value) || 0,
                                })
                              }
                              className="overhead-edit-input"
                              step="0.01"
                              min="0"
                              placeholder="0"
                            />
                            <span className="formula-part">(Direct Value)</span>
                          </div>
                          <span className="overhead-value">
                            Rp {formatNumber(calculateExpiryCost(), 2)}
                          </span>
                        </div>
                        <div className="overhead-cost-item total-overhead">
                          <span className="overhead-label">
                            Total Overhead:
                          </span>
                          <span className="overhead-formula"></span>
                          <span className="overhead-value">
                            Rp {formatNumber(calculateTotalOverhead(), 2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                {/* Margin Section for ETHICAL/OTC Products */}
                {(getCurrentLOB() === "ETHICAL" || getCurrentLOB() === "OTC") && (
                  <div className="overhead-cost" style={{ marginTop: "20px" }}>
                    <h4>Margin:</h4>
                    <div className="overhead-cost-grid">
                      <div className="overhead-cost-item">
                        <span className="overhead-label">
                          Margin Type:
                          <button
                            type="button"
                            onClick={() => setMarginType(marginType === "percent" ? "value" : "percent")}
                            style={{
                              marginLeft: "10px",
                              padding: "5px 10px",
                              fontSize: "12px",
                              cursor: "pointer",
                              backgroundColor: "#007bff",
                              color: "white",
                              border: "none",
                              borderRadius: "4px"
                            }}
                          >
                            Switch to {marginType === "percent" ? "Direct Value" : "Percent"}
                          </button>
                        </span>
                        <div className="overhead-formula-editable">
                          {marginType === "percent" ? (
                            <>
                              <input
                                type="number"
                                value={editableOverheadData.Margin || 0}
                                onChange={(e) =>
                                  setEditableOverheadData({
                                    ...editableOverheadData,
                                    Margin: parseFloat(e.target.value) || 0,
                                  })
                                }
                                className="overhead-edit-input"
                                step="0.1"
                                min="0"
                                placeholder="0"
                              />
                              <span className="formula-part">%</span>
                            </>
                          ) : (
                            <>
                              <span className="formula-part">Rp</span>
                              <input
                                type="number"
                                value={editableOverheadData.Margin || 0}
                                onChange={(e) =>
                                  setEditableOverheadData({
                                    ...editableOverheadData,
                                    Margin: parseFloat(e.target.value) || 0,
                                  })
                                }
                                className="overhead-edit-input"
                                step="0.01"
                                min="0"
                                placeholder="0"
                              />
                              <span className="formula-part">(Direct Value)</span>
                            </>
                          )}
                        </div>
                        <span className="overhead-value">
                          Rp {formatNumber(calculateMarginValue(), 2)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Grand Total Cost */}
                <div className="grand-total-cost">
                  <h4>Total Cost Summary:</h4>
                  <div className="grand-total-grid">
                    {!loadingDetails &&
                      (simulationDetailBahan.length > 0 || isCustomFormula) && (
                        <>
                          <div className="total-cost-item">
                            <span className="total-label">
                              Total Bahan Baku:
                            </span>
                            <span className="total-value">
                              Rp {formatNumber(calculateTotalBahanBaku(), 2)}
                            </span>
                          </div>
                          <div className="total-cost-item">
                            <span className="total-label">
                              Total Bahan Kemas:
                            </span>
                            <span className="total-value">
                              Rp {formatNumber(calculateTotalBahanKemas(), 2)}
                            </span>
                          </div>
                        </>
                      )}
                    {(getCurrentLOB() === "ETHICAL" ||
                      getCurrentLOB() === "OTC" ||
                      (getCurrentLOB() === "GENERIC" &&
                        ((editableVersion || simulationResults[0].Versi) ===
                          "1" ||
                          (editableVersion || simulationResults[0].Versi) ===
                            "2"))) && (
                      <div className="total-cost-item">
                        <span className="total-label">Total Overhead:</span>
                        <span className="total-value">
                          Rp {formatNumber(calculateTotalOverhead(), 2)}
                        </span>
                      </div>
                    )}
                    <div className="total-cost-item grand-total">
                      <span className="total-label">
                        Grand Total per Batch:
                      </span>
                      <span className="total-value">
                        Rp {formatNumber(calculateGrandTotal(), 2)}
                      </span>
                    </div>
                    {simulationSummary && (
                      <div className="total-cost-item">
                        <span className="total-label">HNA:</span>
                        <span className="total-value">
                          {formatHNA(simulationSummary.Product_SalesHNA)}
                        </span>
                      </div>
                    )}
                    <div className="total-cost-item grand-total">
                      <span className="total-label">Cost per Unit:</span>
                      <span className="total-value">
                        {simulationSummary ? 
                          formatCostPerUnitWithRatio(
                            calculateCostPerUnitWithRendemen(), 
                            simulationSummary.HPP_Ratio
                          ) : 
                          `Rp ${formatNumber(calculateCostPerUnitWithRendemen(), 2)}`
                        }
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="form-actions">
              <button
                type="button"
                onClick={async () => {
                  setReportPage(2); // Start with page 2 (After)
                  setShowDetailedReport(true);
                  
                  // Fetch HPP Results data for comparison if product exists
                  const productId = isCustomFormula 
                    ? null 
                    : simulationResults?.[0]?.Product_ID;
                  
                  if (productId) {
                    await fetchHppResultsForProduct(productId);
                  } else {
                    setHppResultsData(null); // Custom formula has no "before" data
                  }
                }}
                disabled={loadingDetails || !simulationHeader}
              >
                📋 Show Detailed Report
              </button>
              <button
                type="button"
                onClick={handleSaveSimulation}
                disabled={
                  loading ||
                  (!isCustomFormula &&
                    (!simulationResults || !simulationResults[0]?.Simulasi_ID))
                }
                className="save-simulation-btn"
              >
                💾 Save Simulation
              </button>
              <button type="button" onClick={() => setStep(1)}>
                New Simulation
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detailed Report Modal - Comprehensive HPP Report with Before/After */}
      {showDetailedReport && (
        <div className="product-hpp-modal-overlay" style={{ display: reportPage === 1 && hppResultsData && !isCustomFormula ? 'none' : 'flex' }}>
          <div className="product-hpp-modal">
            <div className="product-hpp-modal-header">
              <h2>
                {hppResultsData && !isCustomFormula ? (
                  <>
                    <span style={{ marginRight: '20px' }}>
                      {reportPage === 1 ? '📊 Before (HPP Results)' : '🔬 After (Simulation)'}
                    </span>
                    <span style={{ fontSize: '0.85em', fontWeight: 'normal' }}>
                      {selectedProduct?.Product_Name || "Simulation Result"}
                    </span>
                  </>
                ) : (
                  <>
                    Product HPP Report - {selectedProduct?.Product_Name || "Simulation Result"}
                  </>
                )}
              </h2>
              <div className="product-hpp-modal-actions">
                {/* Toggle switch for Before/After comparison */}
                {hppResultsData && !isCustomFormula && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginRight: '16px' }}>
                    <span style={{ fontSize: '14px', fontWeight: '500', color: reportPage === 1 ? '#2196F3' : '#666' }}>
                      📊 Before
                    </span>
                    <label style={{ position: 'relative', display: 'inline-block', width: '50px', height: '24px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={reportPage === 2}
                        onChange={(e) => setReportPage(e.target.checked ? 2 : 1)}
                        style={{ opacity: 0, width: 0, height: 0 }}
                      />
                      <span style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: reportPage === 2 ? '#2196F3' : '#ccc',
                        borderRadius: '24px',
                        transition: 'background-color 0.3s',
                      }}>
                        <span style={{
                          position: 'absolute',
                          content: '',
                          height: '18px',
                          width: '18px',
                          left: reportPage === 2 ? '29px' : '3px',
                          bottom: '3px',
                          backgroundColor: 'white',
                          borderRadius: '50%',
                          transition: 'left 0.3s',
                        }}></span>
                      </span>
                    </label>
                    <span style={{ fontSize: '14px', fontWeight: '500', color: reportPage === 2 ? '#2196F3' : '#666' }}>
                      🔬 After
                    </span>
                  </div>
                )}
                <button
                  onClick={handleGeneratePDF}
                  className="product-hpp-export-btn pdf"
                  title="Download as PDF"
                >
                  <FileDown size={16} /> PDF
                </button>
                <button
                  onClick={() => setShowDetailedReport(false)}
                  className="product-hpp-close-btn"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="product-hpp-modal-content">
              {/* Show loading state while fetching HPP Results */}
              {loadingHppResults && reportPage === 1 && (
                <div style={{ padding: '40px', textAlign: 'center' }}>
                  <LoadingSpinner />
                  <p>Loading HPP Results data...</p>
                </div>
              )}

              {/* Show "Before" page - HPP Results data */}
              {reportPage === 1 && hppResultsData && !loadingHppResults && !isCustomFormula && (
                <div className="product-hpp-report" id="before-report-content">
                  {/* This will be populated by the hidden ProductHPPReport component */}
                </div>
              )}

              {/* Show message if no HPP Results data available */}
              {reportPage === 1 && !hppResultsData && !loadingHppResults && !isCustomFormula && (
                <div style={{ padding: '40px', textAlign: 'center' }}>
                  <p>No HPP Results data found for this product in the current year.</p>
                  <p style={{ fontSize: '0.9em', color: '#666', marginTop: '8px' }}>
                    The product may not have been calculated yet or was calculated in a different year.
                  </p>
                  <button 
                    onClick={() => setReportPage(2)}
                    style={{ marginTop: '16px', padding: '8px 16px' }}
                    className="product-hpp-export-btn"
                  >
                    View Simulation Results →
                  </button>
                </div>
              )}

              {/* Show "After" page (or only page if custom formula) - Simulation data */}
              {(reportPage === 2 || isCustomFormula || !hppResultsData) && !loadingHppResults && (
              <div className="product-hpp-report" id="product-hpp-report-after">
                {/* Document Header */}
                <div className="document-header">
                  <div className="header-row">
                    <div className="header-left">
                      <h3>Perhitungan Estimasi HPP</h3>
                    </div>
                    <div className="header-right">
                      <div className="header-info">
                        <span className="label">Site :</span>
                        <span className="value">
                          {isCustomFormula
                            ? customLine
                            : simulationResults && simulationResults[0]
                            ? simulationResults[0].Group_PNCategory_Dept
                            : "N/A"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Product Info Section */}
                <div className="product-info-section">
                  <div className="info-grid">
                    <div className="info-left">
                      <div className="info-line">
                        <span className="label">Kode Produk - Description</span>
                        <span className="separator">:</span>
                        <span className="value">
                          {isCustomFormula
                            ? `- - ${customProductName || "Product Custom"}`
                            : `${
                                simulationResults && simulationResults[0]
                                  ? simulationResults[0].Product_ID
                                  : "N/A"
                              } - ${
                                simulationResults && simulationResults[0]
                                  ? simulationResults[0].Product_Name
                                  : "Unknown Product"
                              }`}
                        </span>
                      </div>
                      <div className="info-line">
                        <span className="label">Batch Size Teori</span>
                        <span className="separator">:</span>
                        <span className="value">
                          {(
                            editableBatchSize ||
                            (simulationResults && simulationResults[0]
                              ? simulationResults[0].Batch_Size
                              : 0)
                          ).toLocaleString()}{" "}
                          {simulationResults && simulationResults[0]
                            ? simulationResults[0].Batch_Unit || "KOTAK"
                            : "KOTAK"}
                        </span>
                      </div>
                      <div className="info-line">
                        <span className="label">Batch Size Actual</span>
                        <span className="separator">:</span>
                        <span className="value">
                          {getActualBatchSize().toLocaleString()}{" "}
                          {simulationResults && simulationResults[0]
                            ? simulationResults[0].Batch_Unit || "KOTAK"
                            : "KOTAK"}
                        </span>
                      </div>
                      <div className="info-line">
                        <span className="label">Rendemen</span>
                        <span className="separator">:</span>
                        <span className="value">
                          {(
                            editableRendemen ||
                            (simulationResults && simulationResults[0]
                              ? simulationResults[0].Group_Rendemen
                              : 0)
                          ).toFixed(2)}
                          %
                        </span>
                      </div>
                    </div>
                    <div className="info-right">
                      <div className="info-line">
                        <span className="label">LOB</span>
                        <span className="separator">:</span>
                        <span className="value">
                          {getCurrentLOB() === "ETHICAL" ? "Ethical / OTC" : 
                           getCurrentLOB() === "GENERIC" && editableVersion === "1" ? "Generic Type 1" :
                           getCurrentLOB() === "GENERIC" && editableVersion === "2" ? "Generic Type 2" :
                           getCurrentLOB()}
                        </span>
                      </div>
                      <div className="info-line">
                        <span className="label">Tanggal Print</span>
                        <span className="separator">:</span>
                        <span className="value">
                          {new Date().toLocaleDateString("id-ID")}
                        </span>
                      </div>
                      <div className="info-line">
                        <span className="label">Formula</span>
                        <span className="separator">:</span>
                        <span className="value">
                          {isCustomFormula
                            ? customFormulaName || "-"
                            : (simulationResults && simulationResults[0]
                                ? simulationResults[0].Formula
                                : "") || "-"}
                        </span>
                      </div>
                      <div className="info-line">
                        <span className="label">Simulation Description</span>
                        <span className="separator">:</span>
                        <span className="value">
                          {isCustomFormula
                            ? editableDescription || "-"
                            : editableDescription ||
                              (simulationResults && simulationResults[0]
                                ? simulationResults[0].Simulasi_Deskripsi
                                : "") ||
                              "-"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Raw Materials Section */}
                <div className="material-section">
                  <div className="section-title">
                    <h4>Bahan Baku</h4>
                  </div>
                  <table className="excel-table">
                    <thead>
                      <tr>
                        <th className="narrow">No</th>
                        <th>Kode Material</th>
                        <th>Nama Material</th>
                        <th>Qty</th>
                        <th>Satuan</th>
                        <th>Cost/unit</th>
                        <th>Extended Cost</th>
                        <th>Cost per pack</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getBahanBakuFromApiData().map((item, index) => (
                        <tr key={`raw-${index}`}>
                          <td>{index + 1}</td>
                          <td>{item.Item_ID}</td>
                          <td>{item.Item_Name}</td>
                          <td className="number">
                            {formatNumber(item.Item_QTY)}
                          </td>
                          <td>{item.Item_Unit}</td>
                          <td className="number">
                            Rp {formatNumber(item.Item_Unit_Price, 2)}
                          </td>
                          <td className="number">
                            Rp{" "}
                            {formatNumber(
                              item.Item_QTY * item.Item_Unit_Price,
                              2
                            )}
                          </td>
                          <td className="number">
                            Rp{" "}
                            {formatNumber(
                              (item.Item_QTY * item.Item_Unit_Price) /
                                getActualBatchSize(),
                              2
                            )}
                          </td>
                        </tr>
                      ))}
                      <tr className="total-row">
                        <td colSpan="6">
                          <strong>Total Bahan Baku :</strong>
                        </td>
                        <td className="number total">
                          <strong>
                            Rp {formatNumber(calculateTotalBahanBaku(), 2)}
                          </strong>
                        </td>
                        <td className="number total">
                          <strong>
                            Rp{" "}
                            {formatNumber(
                              calculateTotalBahanBaku() / getActualBatchSize(),
                              2
                            )}
                          </strong>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Packaging Materials Section */}
                <div className="material-section">
                  <div className="section-title">
                    <h4>Bahan Kemas</h4>
                  </div>
                  <table className="excel-table">
                    <thead>
                      <tr>
                        <th className="narrow">No</th>
                        <th>Kode Material</th>
                        <th>Nama Material</th>
                        <th>Qty</th>
                        <th>Satuan</th>
                        <th>Cost/unit</th>
                        <th>Extended Cost</th>
                        <th>Cost per pack</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getBahanKemasFromApiData().map((item, index) => (
                        <tr key={`pack-${index}`}>
                          <td>{index + 1}</td>
                          <td>{item.Item_ID}</td>
                          <td>{item.Item_Name}</td>
                          <td className="number">
                            {formatNumber(item.Item_QTY)}
                          </td>
                          <td>{item.Item_Unit}</td>
                          <td className="number">
                            Rp {formatNumber(item.Item_Unit_Price, 2)}
                          </td>
                          <td className="number">
                            Rp{" "}
                            {formatNumber(
                              item.Item_QTY * item.Item_Unit_Price,
                              2
                            )}
                          </td>
                          <td className="number">
                            Rp{" "}
                            {formatNumber(
                              (item.Item_QTY * item.Item_Unit_Price) /
                                getActualBatchSize(),
                              2
                            )}
                          </td>
                        </tr>
                      ))}
                      <tr className="total-row">
                        <td colSpan="6">
                          <strong>Total Bahan Kemas :</strong>
                        </td>
                        <td className="number total">
                          <strong>
                            Rp {formatNumber(calculateTotalBahanKemas(), 2)}
                          </strong>
                        </td>
                        <td className="number total">
                          <strong>
                            Rp{" "}
                            {formatNumber(
                              calculateTotalBahanKemas() / getActualBatchSize(),
                              2
                            )}
                          </strong>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Overhead Section - Dynamic based on LOB and Version */}
                <div className="material-section">
                  <div className="section-title">
                    <h4>Overhead</h4>
                  </div>

                  {getCurrentLOB() === "ETHICAL" && (
                    <>
                    <table className="excel-table">
                      <thead>
                        <tr>
                          <th>Resource Scheduling</th>
                          <th>Description</th>
                          <th>Qty</th>
                          <th>Unit</th>
                          <th>Cost/unit</th>
                          <th>Extended Cost</th>
                          <th>Cost per pack</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>1 PENGOLAHAN</td>
                          <td>OPERATOR PROSES LINE PN1/PN2</td>
                          <td className="number">
                            {formatNumber(
                              editableOverheadData.MH_Proses_Std || 0
                            )}
                          </td>
                          <td>HRS</td>
                          <td className="number">
                            Rp{" "}
                            {formatNumber(
                              editableOverheadData.Biaya_Proses || 0,
                              2
                            )}
                          </td>
                          <td className="number">
                            Rp {formatNumber(calculateProcessingCost(), 2)}
                          </td>
                          <td className="number">
                            Rp{" "}
                            {formatNumber(
                              calculateProcessingCost() / getActualBatchSize(),
                              2
                            )}
                          </td>
                        </tr>
                        <tr>
                          <td>2 PENGEMASAN</td>
                          <td>OPERATOR PROSES LINE PN1/PN2</td>
                          <td className="number">
                            {formatNumber(
                              editableOverheadData.MH_Kemas_Std || 0
                            )}
                          </td>
                          <td>HRS</td>
                          <td className="number">
                            Rp{" "}
                            {formatNumber(
                              editableOverheadData.Biaya_Kemas || 0,
                              2
                            )}
                          </td>
                          <td className="number">
                            Rp {formatNumber(calculatePackagingCost(), 2)}
                          </td>
                          <td className="number">
                            Rp{" "}
                            {formatNumber(
                              calculatePackagingCost() / getActualBatchSize(),
                              2
                            )}
                          </td>
                        </tr>
                        <tr>
                          <td>3 EXPIRY</td>
                          <td>BEBAN SISA BAHAN EXPIRE</td>
                          <td className="number">1</td>
                          <td>BATCH</td>
                          <td className="number">
                            Rp{" "}
                            {formatNumber(
                              editableOverheadData.Beban_Sisa_Bahan_Exp || 0,
                              2
                            )}
                          </td>
                          <td className="number">
                            Rp {formatNumber(calculateExpiryCost(), 2)}
                          </td>
                          <td className="number">
                            Rp{" "}
                            {formatNumber(
                              calculateExpiryCost() / getActualBatchSize(),
                              2
                            )}
                          </td>
                        </tr>
                        <tr className="total-row">
                          <td colSpan="2">
                            <strong>Total Hours</strong>
                          </td>
                          <td className="number">
                            <strong>
                              {formatNumber(
                                (editableOverheadData.MH_Proses_Std || 0) +
                                  (editableOverheadData.MH_Kemas_Std || 0)
                              )}
                            </strong>
                          </td>
                          <td>
                            <strong>Total Cost</strong>
                          </td>
                          <td></td>
                          <td className="number total">
                            <strong>
                              Rp {formatNumber(calculateTotalOverhead(), 2)}
                            </strong>
                          </td>
                          <td className="number total">
                            <strong>
                              Rp{" "}
                              {formatNumber(
                                calculateTotalOverhead() / getActualBatchSize(),
                                2
                              )}
                            </strong>
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    {/* Margin Section for ETHICAL */}
                    <table className="excel-table" style={{ marginTop: "10px" }}>
                      <tbody>
                        <tr>
                          <td style={{ width: "20%" }}>
                            <strong>Margin</strong>
                          </td>
                          <td style={{ width: "60%" }}>
                            {marginType === "percent" 
                              ? `${formatNumber(editableOverheadData.Margin || 0, 2)}%`
                              : `Rp ${formatNumber(editableOverheadData.Margin || 0, 2)}`}
                          </td>
                          <td style={{ width: "20%" }} className="number">
                            <strong>
                              Rp {formatNumber(calculateMarginValue(), 2)}
                            </strong>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                    </>
                  )}

                  {getCurrentLOB() === "OTC" && (
                    <>
                    <table className="excel-table">
                      <thead>
                        <tr>
                          <th>Resource Scheduling</th>
                          <th>Description</th>
                          <th>Qty</th>
                          <th>Unit</th>
                          <th>Cost/unit</th>
                          <th>Extended Cost</th>
                          <th>Cost per pack</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>1 PENGOLAHAN</td>
                          <td>OPERATOR PROSES LINE PN1/PN2</td>
                          <td className="number">
                            {formatNumber(
                              editableOverheadData.MH_Proses_Std || 0
                            )}
                          </td>
                          <td>HRS</td>
                          <td className="number">
                            Rp{" "}
                            {formatNumber(
                              editableOverheadData.Biaya_Proses || 0,
                              2
                            )}
                          </td>
                          <td className="number">
                            Rp {formatNumber(calculateProcessingCost(), 2)}
                          </td>
                          <td className="number">
                            Rp{" "}
                            {formatNumber(
                              calculateProcessingCost() / getActualBatchSize(),
                              2
                            )}
                          </td>
                        </tr>
                        <tr>
                          <td>2 PENGEMASAN</td>
                          <td>OPERATOR PROSES LINE PN1/PN2</td>
                          <td className="number">
                            {formatNumber(
                              editableOverheadData.MH_Kemas_Std || 0
                            )}
                          </td>
                          <td>HRS</td>
                          <td className="number">
                            Rp{" "}
                            {formatNumber(
                              editableOverheadData.Biaya_Kemas || 0,
                              2
                            )}
                          </td>
                          <td className="number">
                            Rp {formatNumber(calculatePackagingCost(), 2)}
                          </td>
                          <td className="number">
                            Rp{" "}
                            {formatNumber(
                              calculatePackagingCost() / getActualBatchSize(),
                              2
                            )}
                          </td>
                        </tr>
                        <tr>
                          <td>3 EXPIRY</td>
                          <td>BEBAN SISA BAHAN EXPIRE</td>
                          <td className="number">1</td>
                          <td>BATCH</td>
                          <td className="number">
                            Rp{" "}
                            {formatNumber(
                              editableOverheadData.Beban_Sisa_Bahan_Exp || 0,
                              2
                            )}
                          </td>
                          <td className="number">
                            Rp {formatNumber(calculateExpiryCost(), 2)}
                          </td>
                          <td className="number">
                            Rp{" "}
                            {formatNumber(
                              calculateExpiryCost() / getActualBatchSize(),
                              2
                            )}
                          </td>
                        </tr>
                        <tr className="total-row">
                          <td colSpan="2">
                            <strong>Total Hours</strong>
                          </td>
                          <td className="number">
                            <strong>
                              {formatNumber(
                                (editableOverheadData.MH_Proses_Std || 0) +
                                  (editableOverheadData.MH_Kemas_Std || 0)
                              )}
                            </strong>
                          </td>
                          <td>
                            <strong>Total Cost</strong>
                          </td>
                          <td></td>
                          <td className="number total">
                            <strong>
                              Rp {formatNumber(calculateTotalOverhead(), 2)}
                            </strong>
                          </td>
                          <td className="number total">
                            <strong>
                              Rp{" "}
                              {formatNumber(
                                calculateTotalOverhead() / getActualBatchSize(),
                                2
                              )}
                            </strong>
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    {/* Margin Section for OTC */}
                    <table className="excel-table" style={{ marginTop: "10px" }}>
                      <tbody>
                        <tr>
                          <td style={{ width: "20%" }}>
                            <strong>Margin</strong>
                          </td>
                          <td style={{ width: "60%" }}>
                            {marginType === "percent" 
                              ? `${formatNumber(editableOverheadData.Margin || 0, 2)}%`
                              : `Rp ${formatNumber(editableOverheadData.Margin || 0, 2)}`}
                          </td>
                          <td style={{ width: "20%" }} className="number">
                            <strong>
                              Rp {formatNumber(calculateMarginValue(), 2)}
                            </strong>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                    </>
                  )}

                  {getCurrentLOB() === "GENERIC" &&
                    (editableVersion || simulationResults[0]?.Versi) ===
                      "1" && (
                      <table className="excel-table">
                        <thead>
                          <tr>
                            <th>Component</th>
                            <th>Description</th>
                            <th>Formula</th>
                            <th>Extended Cost</th>
                            <th>Cost per pack</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td>Ingredients Weighing</td>
                            <td>Ingredients Weighing Cost</td>
                            <td>
                              (
                              {formatNumber(
                                editableOverheadData.MH_Timbang_BB || 0,
                                2
                              )}{" "}
                              MH × Rp{" "}
                              {formatNumber(
                                editableOverheadData.Biaya_Proses || 0,
                                2
                              )}
                              )
                            </td>
                            <td className="number">
                              Rp{" "}
                              {formatNumber(calculateIngredientsWeighing(), 2)}
                            </td>
                            <td className="number">
                              Rp{" "}
                              {formatNumber(
                                calculateIngredientsWeighing() /
                                  getActualBatchSize(),
                                2
                              )}
                            </td>
                          </tr>
                          <tr>
                            <td>Packaging Weighing</td>
                            <td>Packaging Weighing Cost</td>
                            <td>
                              (
                              {formatNumber(
                                editableOverheadData.MH_Timbang_BK || 0,
                                2
                              )}{" "}
                              MH × Rp{" "}
                              {formatNumber(
                                editableOverheadData.Biaya_Kemas || 0,
                                2
                              )}
                              )
                            </td>
                            <td className="number">
                              Rp {formatNumber(calculatePackagingWeighing(), 2)}
                            </td>
                            <td className="number">
                              Rp{" "}
                              {formatNumber(
                                calculatePackagingWeighing() /
                                  getActualBatchSize(),
                                2
                              )}
                            </td>
                          </tr>
                          <tr>
                            <td>Processing Cost</td>
                            <td>Production Processing Cost</td>
                            <td>
                              (
                              {formatNumber(
                                editableOverheadData.MH_Proses_Std || 0,
                                2
                              )}{" "}
                              MH × Rp{" "}
                              {formatNumber(
                                editableOverheadData.Biaya_Proses || 0,
                                2
                              )}
                              )
                            </td>
                            <td className="number">
                              Rp{" "}
                              {formatNumber(
                                calculateGenericProcessingCost(),
                                2
                              )}
                            </td>
                            <td className="number">
                              Rp{" "}
                              {formatNumber(
                                calculateGenericProcessingCost() /
                                  getActualBatchSize(),
                                2
                              )}
                            </td>
                          </tr>
                          <tr>
                            <td>Packaging Cost</td>
                            <td>Packaging Processing Cost</td>
                            <td>
                              (
                              {formatNumber(
                                editableOverheadData.MH_Kemas_Std || 0,
                                2
                              )}{" "}
                              MH × Rp{" "}
                              {formatNumber(
                                editableOverheadData.Biaya_Kemas || 0,
                                2
                              )}
                              )
                            </td>
                            <td className="number">
                              Rp{" "}
                              {formatNumber(calculateGenericPackagingCost(), 2)}
                            </td>
                            <td className="number">
                              Rp{" "}
                              {formatNumber(
                                calculateGenericPackagingCost() /
                                  getActualBatchSize(),
                                2
                              )}
                            </td>
                          </tr>
                          <tr>
                            <td>Analysis Fee</td>
                            <td>Quality Control Analysis</td>
                            <td>
                              (
                              {formatNumber(
                                editableOverheadData.MH_Analisa_Std || 0,
                                2
                              )}{" "}
                              MH × Rp{" "}
                              {formatNumber(
                                editableOverheadData.Biaya_Analisa || 0,
                                2
                              )}
                              )
                            </td>
                            <td className="number">
                              Rp {formatNumber(calculateAnalysisFee(), 2)}
                            </td>
                            <td className="number">
                              Rp{" "}
                              {formatNumber(
                                calculateAnalysisFee() / getActualBatchSize(),
                                2
                              )}
                            </td>
                          </tr>
                          <tr>
                            <td>Machine Fee</td>
                            <td>Equipment Usage Fee</td>
                            <td>
                              (
                              {formatNumber(
                                editableOverheadData.MH_Mesin_Std || 0,
                                2
                              )}{" "}
                              MH × Rp{" "}
                              {formatNumber(
                                editableOverheadData.Rate_PLN || 0,
                                2
                              )}
                              )
                            </td>
                            <td className="number">
                              Rp {formatNumber(calculateMachineFee(), 2)}
                            </td>
                            <td className="number">
                              Rp{" "}
                              {formatNumber(
                                calculateMachineFee() / getActualBatchSize(),
                                2
                              )}
                            </td>
                          </tr>
                          <tr>
                            <td>Reagent Fee</td>
                            <td>Testing Reagent Cost</td>
                            <td>
                              Rp{" "}
                              {formatNumber(
                                editableOverheadData.Biaya_Reagen || 0,
                                2
                              )}{" "}
                              (Direct Value)
                            </td>
                            <td className="number">
                              Rp {formatNumber(calculateReagentFee(), 2)}
                            </td>
                            <td className="number">
                              Rp{" "}
                              {formatNumber(
                                calculateReagentFee() / getActualBatchSize(),
                                2
                              )}
                            </td>
                          </tr>
                          <tr>
                            <td>Expiry Cost</td>
                            <td>Material Expiry Cost</td>
                            <td>
                              Rp{" "}
                              {formatNumber(
                                editableOverheadData.Biaya_Exp_Generik || 0,
                                2
                              )}{" "}
                              (Direct Value)
                            </td>
                            <td className="number">
                              Rp {formatNumber(calculateGenericExpiryCost(), 2)}
                            </td>
                            <td className="number">
                              Rp{" "}
                              {formatNumber(
                                calculateGenericExpiryCost() /
                                  getActualBatchSize(),
                                2
                              )}
                            </td>
                          </tr>

                          <tr className="total-row">
                            <td colSpan="3">
                              <strong>Total Overhead</strong>
                            </td>
                            <td className="number total">
                              <strong>
                                Rp {formatNumber(calculateTotalOverhead(), 2)}
                              </strong>
                            </td>
                            <td className="number total">
                              <strong>
                                Rp{" "}
                                {formatNumber(
                                  calculateTotalOverhead() /
                                    getActualBatchSize(),
                                  2
                                )}
                              </strong>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    )}

                  {getCurrentLOB() === "GENERIC" &&
                    (editableVersion || simulationResults[0]?.Versi) ===
                      "2" && (
                      <table className="excel-table">
                        <thead>
                          <tr>
                            <th>Component</th>
                            <th>Description</th>
                            <th>Formula</th>
                            <th>Extended Cost</th>
                            <th>Cost per pack</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td>Processing Labor</td>
                            <td>Production Labor Cost</td>
                            <td>
                              (
                              {formatNumber(
                                editableOverheadData.MH_Proses_Std || 0
                              )}{" "}
                              MH × Rp{" "}
                              {formatNumber(
                                editableOverheadData.Direct_Labor || 0,
                                2
                              )}
                              )
                            </td>
                            <td className="number">
                              Rp{" "}
                              {formatNumber(calculateProductionLaborCost(), 2)}
                            </td>
                            <td className="number">
                              Rp{" "}
                              {formatNumber(
                                calculateProductionLaborCost() /
                                  getActualBatchSize(),
                                2
                              )}
                            </td>
                          </tr>
                          <tr>
                            <td>Packaging Labor</td>
                            <td>Packaging Labor Cost</td>
                            <td>
                              (
                              {formatNumber(
                                editableOverheadData.MH_Kemas_Std || 0
                              )}{" "}
                              MH × Rp{" "}
                              {formatNumber(
                                editableOverheadData.Direct_Labor || 0,
                                2
                              )}
                              )
                            </td>
                            <td className="number">
                              Rp{" "}
                              {formatNumber(calculatePackagingLaborCost(), 2)}
                            </td>
                            <td className="number">
                              Rp{" "}
                              {formatNumber(
                                calculatePackagingLaborCost() /
                                  getActualBatchSize(),
                                2
                              )}
                            </td>
                          </tr>
                          <tr>
                            <td>Production FOH</td>
                            <td>Production Factory Overhead</td>
                            <td>
                              (
                              {formatNumber(
                                editableOverheadData.MH_Proses_Std || 0
                              )}{" "}
                              MH × Rp{" "}
                              {formatNumber(
                                editableOverheadData.Factory_Over_Head || 0,
                                2
                              )}
                              )
                            </td>
                            <td className="number">
                              Rp {formatNumber(calculateProductionFOH(), 2)}
                            </td>
                            <td className="number">
                              Rp{" "}
                              {formatNumber(
                                calculateProductionFOH() / getActualBatchSize(),
                                2
                              )}
                            </td>
                          </tr>
                          <tr>
                            <td>Packaging FOH</td>
                            <td>Packaging Factory Overhead</td>
                            <td>
                              (
                              {formatNumber(
                                editableOverheadData.MH_Kemas_Std || 0
                              )}{" "}
                              MH × Rp{" "}
                              {formatNumber(
                                editableOverheadData.Factory_Over_Head || 0,
                                2
                              )}
                              )
                            </td>
                            <td className="number">
                              Rp {formatNumber(calculatePackagingFOH(), 2)}
                            </td>
                            <td className="number">
                              Rp{" "}
                              {formatNumber(
                                calculatePackagingFOH() / getActualBatchSize(),
                                2
                              )}
                            </td>
                          </tr>
                          <tr>
                            <td>Expiry Cost</td>
                            <td>Material Expiry Cost</td>
                            <td>
                              Rp{" "}
                              {formatNumber(
                                editableOverheadData.Beban_Sisa_Bahan_Exp || 0,
                                2
                              )}
                            </td>
                            <td className="number">
                              Rp {formatNumber(calculateExpiryCost(), 2)}
                            </td>
                            <td className="number">
                              Rp{" "}
                              {formatNumber(
                                calculateExpiryCost() / getActualBatchSize(),
                                2
                              )}
                            </td>
                          </tr>
                          <tr className="total-row">
                            <td colSpan="3">
                              <strong>Total Overhead</strong>
                            </td>
                            <td className="number total">
                              <strong>
                                Rp {formatNumber(calculateTotalOverhead(), 2)}
                              </strong>
                            </td>
                            <td className="number total">
                              <strong>
                                Rp{" "}
                                {formatNumber(
                                  calculateTotalOverhead() /
                                    getActualBatchSize(),
                                  2
                                )}
                              </strong>
                            </td>
                          </tr>
                          {(getCurrentLOB() === "ETHICAL" || getCurrentLOB() === "OTC") && (
                            <tr>
                              <td>Margin</td>
                              <td>
                                {marginType === "percent" 
                                  ? `Margin (${formatNumber(editableOverheadData.Margin || 0, 2)}%)`
                                  : "Margin (Direct Value)"}
                              </td>
                              <td>
                                {marginType === "percent"
                                  ? `${formatNumber(editableOverheadData.Margin || 0, 2)}% of subtotal`
                                  : `Rp ${formatNumber(editableOverheadData.Margin || 0, 2)}`}
                              </td>
                              <td className="number">
                                Rp {formatNumber(calculateMarginValue(), 2)}
                              </td>
                              <td className="number">
                                Rp{" "}
                                {formatNumber(
                                  calculateMarginValue() / getActualBatchSize(),
                                  2
                                )}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    )}
                </div>

                {/* Final Total Section */}
                <div className="final-total-section">
                  <table className="excel-table">
                    <tbody>
                      <tr className="final-total">
                        <td>
                          <strong>Total HPP Estimasi</strong>
                        </td>
                        <td colSpan="2"></td>
                        <td>
                          <strong>HPP</strong>
                        </td>
                        <td className="number final">
                          <strong>
                            {formatNumber(
                              calculateGrandTotal(),
                              0
                            )}
                          </strong>
                        </td>
                        <td className="number final">
                          <strong>
                            Rp{" "}
                            {formatNumber(
                              calculateGrandTotal() /
                                getActualBatchSize(),
                              2
                            )}
                          </strong>
                        </td>
                      </tr>
                      <tr className="final-total">
                        <td>
                          <strong>HNA</strong>
                        </td>
                        <td colSpan="2"></td>
                        <td>
                          <strong>HPP/HNA</strong>
                        </td>
                        <td className="number final">
                          <strong>
                            Rp{" "}
                            {simulationSummary?.HNA 
                              ? formatNumber(simulationSummary.HNA, 0)
                              : hppResultsData?.Product_SalesHNA
                              ? formatNumber(hppResultsData.Product_SalesHNA, 0)
                              : "-"}
                          </strong>
                        </td>
                        <td className="number final">
                          <strong>
                            {(() => {
                              const hppPerPack = calculateGrandTotal() / getActualBatchSize();
                              const hna = simulationSummary?.HNA || hppResultsData?.Product_SalesHNA;
                              
                              if (hna && hna > 0) {
                                const ratio = (hppPerPack / hna) * 100;
                                return `${ratio.toFixed(2).replace('.', ',')}%`;
                              }
                              
                              return "-";
                            })()}
                          </strong>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Step 5: Price Change Simulation */}
      {step === 5 && simulationType === "price-change" && (
        <div className="simulation-step">
          <div className="step-header">
            <button className="back-btn" onClick={handleBackToList}>
              ← Back to List
            </button>
            <h2>Price Change Simulation</h2>
          </div>

          <div className="price-change-simulation-content">
            <div className="simulation-description">
              <p>
                Simulate the impact of material price changes on existing
                products. Select materials that will have price changes, and the
                system will automatically identify all products that use these
                materials and calculate the new cost structure.
              </p>
            </div>

            <div className="price-change-workflow">
              <div className="workflow-steps">
                <div className="workflow-step">
                  <div className="step-number">1</div>
                  <div className="step-content">
                    <h4>Select Materials</h4>
                    <p>Choose materials that will have price changes</p>
                  </div>
                </div>
                <div className="workflow-arrow">→</div>

                <div className="workflow-step">
                  <div className="step-number">2</div>
                  <div className="step-content">
                    <h4>Set New Prices</h4>
                    <p>Define the new unit prices for selected materials</p>
                  </div>
                </div>
                <div className="workflow-arrow">→</div>

                <div className="workflow-step">
                  <div className="step-number">3</div>
                  <div className="step-content">
                    <h4>Find Products</h4>
                    <p>System identifies all products using these materials</p>
                  </div>
                </div>
                <div className="workflow-arrow">→</div>

                <div className="workflow-step">
                  <div className="step-number">4</div>
                  <div className="step-content">
                    <h4>Calculate Impact</h4>
                    <p>
                      Generate before/after cost comparison for affected
                      products
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {priceChangeStep === 1 ? (
              <>
                <div className="price-change-features">
                  <h3>What you'll get:</h3>
                  <div className="features-grid">
                    <div className="feature-item">
                      <div className="feature-icon">📊</div>
                      <h4>Cost Impact Analysis</h4>
                      <p>
                        See exactly how price changes affect each product's
                        total cost
                      </p>
                    </div>

                    <div className="feature-item">
                      <div className="feature-icon">🔍</div>
                      <h4>Automatic Product Discovery</h4>
                      <p>
                        System finds all products that use the selected
                        materials
                      </p>
                    </div>

                    <div className="feature-item">
                      <div className="feature-icon">⚖️</div>
                      <h4>Before/After Comparison</h4>
                      <p>
                        Clear comparison showing old vs new costs and percentage
                        changes
                      </p>
                    </div>

                    <div className="feature-item">
                      <div className="feature-icon">📈</div>
                      <h4>Multi-Product Simulation</h4>
                      <p>
                        Process multiple affected products in a single
                        simulation run
                      </p>
                    </div>
                  </div>
                </div>

                <div className="price-change-actions">
                  <div className="action-buttons">
                    <button
                      className="secondary-btn"
                      onClick={() => setStep(1)}
                      disabled={loading}
                    >
                      ← Choose Different Type
                    </button>

                    <button
                      className="primary-btn"
                      onClick={handleProceedToPriceChange}
                      disabled={loadingPriceMaterials}
                    >
                      {loadingPriceMaterials
                        ? "Loading Materials & Names..."
                        : "Start Price Change Simulation →"}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="material-selection-container">
                <div className="material-selection-header">
                  <button
                    className="back-button"
                    onClick={() => setPriceChangeStep(1)}
                  >
                    ← Back to Overview
                  </button>
                  <h3>Select Materials for Price Change</h3>
                </div>

                {/* Selected Materials Section */}
                {selectedMaterials.length > 0 && (
                  <div className="selected-materials-section">
                    <div className="selected-materials-header">
                      <h4>Selected Materials ({selectedMaterials.length})</h4>
                      <button
                        className="clear-all-btn"
                        onClick={() => setSelectedMaterials([])}
                        title="Clear all selected materials"
                      >
                        Clear All
                      </button>
                    </div>
                    <div className="selected-materials-list">
                      {selectedMaterials.map((material) => (
                        <div key={material.ITEM_ID} className="selected-material-item">
                          <div className="selected-material-info">
                            <div className="selected-material-name">
                              {material.ITEM_NAME}
                            </div>
                            <div className="selected-material-details">
                              Code: {material.ITEM_ID} | Type: {material.ITEM_TYP} | Unit: {material.UNIT}
                            </div>
                            <div className="selected-material-original-price">
                              Original: {formatPriceWithCurrency(material.originalPrice, material.CURRENCY)} per {material.UNIT}
                            </div>
                          </div>
                          <div className="selected-material-price-input">
                            <label>New Price ({material.CURRENCY}):</label>
                            <input
                              type="number"
                              step="0.01"
                              value={material.newPrice || ""}
                              onChange={(e) => handlePriceChange(material.ITEM_ID, e.target.value)}
                              placeholder={`Enter new price`}
                              className="price-input"
                            />
                            {material.priceChangePercent !== 0 && (
                              <div className={`price-change-indicator ${material.priceChange > 0 ? "increase" : "decrease"}`}>
                                {material.priceChange > 0 ? "+" : ""}
                                {material.priceChangePercent?.toFixed(2)}%
                                <span className="price-change-amount">
                                  ({formatPriceWithCurrency(material.priceChange, material.CURRENCY)})
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="selected-material-actions">
                            <button
                              className="remove-material-btn"
                              onClick={() => handleMaterialSelection(material, false)}
                              title="Remove this material"
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="material-search-section">
                  <div className="search-controls">
                    <input
                      type="text"
                      placeholder="Search materials by name, code, type, unit, or currency..."
                      value={materialSearchTerm}
                      onChange={(e) => handleMaterialSearch(e.target.value)}
                      className="material-search-input"
                    />
                    <div className="material-stats">
                      {filteredMaterials.length > 0 ? (
                        <span>
                          Showing {getPaginatedMaterials().length} of{" "}
                          {filteredMaterials.length} materials
                        </span>
                      ) : (
                        <span>
                          Showing {getPaginatedMaterials().length} of{" "}
                          {priceMaterials.length} materials
                        </span>
                      )}
                      {selectedMaterials.length > 0 && (
                        <span className="selected-count">
                          {" "}
                          | Selected: {selectedMaterials.length}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {priceMaterials.length > 0 ? (
                  <>
                    <div className="materials-list">
                      {getPaginatedMaterials().map((material) => {
                        const isSelected = selectedMaterials.some(
                          (m) => m.ITEM_ID === material.ITEM_ID
                        );

                        return (
                          <div
                            key={material.ITEM_ID}
                            className={`material-item ${
                              isSelected ? "selected" : ""
                            }`}
                          >
                            <div className="material-checkbox">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) =>
                                  handleMaterialSelection(
                                    material,
                                    e.target.checked
                                  )
                                }
                              />
                            </div>
                            <div className="material-info">
                              <div className="material-name">
                                {material.ITEM_NAME}
                              </div>
                              <div className="material-details">
                                Code: {material.ITEM_ID} | Type:{" "}
                                {material.ITEM_TYP} | Unit: {material.UNIT} |
                                Current Price:{" "}
                                {formatPriceWithCurrency(
                                  material.ITEM_PURCHASE_STD_PRICE,
                                  material.CURRENCY
                                )}{" "}
                                per {material.UNIT}
                              </div>
                              {isSelected && (
                                <div className="selected-indicator">
                                  ✓ Selected - Edit price in the section above
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Pagination Controls */}
                    {getTotalMaterialPages() > 1 && (
                      <div className="material-pagination">
                        <button
                          className="pagination-btn"
                          onClick={() =>
                            setCurrentMaterialPage((prev) =>
                              Math.max(prev - 1, 1)
                            )
                          }
                          disabled={currentMaterialPage === 1}
                        >
                          ← Previous
                        </button>

                        <div className="pagination-info">
                          Page {currentMaterialPage} of{" "}
                          {getTotalMaterialPages()}
                        </div>

                        <button
                          className="pagination-btn"
                          onClick={() =>
                            setCurrentMaterialPage((prev) =>
                              Math.min(prev + 1, getTotalMaterialPages())
                            )
                          }
                          disabled={
                            currentMaterialPage === getTotalMaterialPages()
                          }
                        >
                          Next →
                        </button>
                      </div>
                    )}

                    <div className="selection-actions">
                      <button
                        className="action-button secondary-button"
                        onClick={() => {
                          setSelectedMaterials([]);
                          setError("");
                        }}
                      >
                        Clear All
                      </button>
                      <button
                        className="action-button primary-button"
                        onClick={handleGenerateSimulation}
                        disabled={selectedMaterials.length === 0}
                      >
                        Generate Simulation ({selectedMaterials.length}) →
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="no-materials">
                    <p>No materials available for price change simulation.</p>
                    <button
                      className="action-button"
                      onClick={() => setPriceChangeStep(1)}
                    >
                      Back to Overview
                    </button>
                  </div>
                )}

                {error && <div className="error-message">{error}</div>}
              </div>
            )}

            <div className="price-change-note">
              <div className="note-content">
                <strong>Note:</strong> This simulation will create temporary
                calculations without affecting your actual product formulas or
                pricing data. You can review all changes before deciding to
                implement them.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Material Modal */}
      {showAddMaterialModal && (
        <div className="add-material-modal-overlay">
          <div className="add-material-modal">
            <div className="add-material-modal-header">
              <h3>
                Add {addMaterialType === "BB" ? "Bahan Baku" : "Bahan Kemas"}
              </h3>
              <button
                className="add-material-close-btn"
                onClick={() => setShowAddMaterialModal(false)}
                type="button"
              >
                ✕
              </button>
            </div>

            <div className="add-material-modal-content">
              <div className="material-search-section">
                <label htmlFor="material-search">Search Materials:</label>
                <input
                  id="material-search"
                  type="text"
                  placeholder="Search by code or name..."
                  className="material-search-input"
                  value={materialSearchQuery}
                  onChange={(e) => setMaterialSearchQuery(e.target.value)}
                />
                <p className="search-hint">
                  {materialSearchQuery.trim() === ""
                    ? "Showing 20 random materials. Start typing to search specific materials."
                    : `Searching for "${materialSearchQuery}"...`}
                </p>
              </div>

              <div className="material-list-section">
                {/* Show limited results warning */}
                {materialSearchQuery &&
                  materialSearchQuery.trim().length >= 2 &&
                  masterMaterials.filter(
                    (material) =>
                      material.ITEM_TYPE === addMaterialType &&
                      (material.ITEM_ID.toLowerCase().includes(
                        materialSearchQuery.toLowerCase()
                      ) ||
                        material.Item_Name.toLowerCase().includes(
                          materialSearchQuery.toLowerCase()
                        ))
                  ).length > 50 && (
                    <div className="search-results-info">
                      <p
                        style={{
                          fontSize: "12px",
                          color: "#666",
                          marginBottom: "10px",
                          textAlign: "center",
                        }}
                      >
                        Showing first 50 results. Type more characters to narrow
                        down your search.
                      </p>
                    </div>
                  )}

                <div className="material-list-container">
                  <table className="material-selection-table">
                    <thead>
                      <tr>
                        <th>Code</th>
                        <th>Name</th>
                        <th>Unit</th>
                        <th>Unit Price</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getFilteredMaterials().map((material, index) => (
                        <tr key={`${material.ITEM_ID}-${index}`}>
                          <td>{material.ITEM_ID}</td>
                          <td>{material.Item_Name}</td>
                          <td>{material.Item_Unit}</td>
                          <td className="number">
                            Rp {formatNumber(material.Unit_Price || 0, 2)}
                          </td>
                          <td>
                            <button
                              className="select-material-btn"
                              onClick={() => {
                                // Add material immediately with quantity 0, user can edit inline
                                addNewMaterial(material, 0);
                                notifier.success(
                                  `${material.Item_Name} added! Set quantity in the materials table.`
                                );
                              }}
                              type="button"
                            >
                              Add Material
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {getFilteredMaterials().length === 0 && (
                    <div className="no-materials-found">
                      <p>
                        {loadingMaterials
                          ? "Loading materials..."
                          : materialSearchQuery &&
                            materialSearchQuery.trim().length === 1
                          ? "Please type at least 2 characters to search..."
                          : materialSearchQuery &&
                            materialSearchQuery.trim().length > 1
                          ? `No ${
                              addMaterialType === "BB"
                                ? "Bahan Baku"
                                : "Bahan Kemas"
                            } materials found matching "${materialSearchQuery}". Try a different search term.`
                          : `No ${
                              addMaterialType === "BB"
                                ? "Bahan Baku"
                                : "Bahan Kemas"
                            } materials found.`}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Custom Material Section */}
              <div className="custom-material-section">
                <div className="custom-material-divider">
                  <span>or</span>
                </div>
                <button
                  className="add-custom-material-btn"
                  onClick={addCustomMaterial}
                  type="button"
                >
                  + Add New Item
                </button>
                <p className="custom-material-hint">
                  Create a custom material with your own specifications
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Affected Products Modal */}
      <AffectedProductsModal
        isOpen={affectedProductsModalOpen}
        onClose={handleCloseAffectedProductsModal}
        priceChangeDescription={selectedPriceChangeDescription}
        priceChangeDate={selectedPriceChangeDate}
      />

      {/* Bulk Delete Confirmation Modal */}
      {bulkDeleteModalOpen && (
        <div className="modal-overlay">
          <div className="bulk-delete-modal">
            <div className="modal-header">
              <h3>⚠️ Confirm Bulk Delete</h3>
              <button
                className="modal-close-btn"
                onClick={handleCloseBulkDeleteModal}
                disabled={bulkDeleting}
              >
                ×
              </button>
            </div>
            <div className="modal-content">
              <div className="bulk-delete-warning">
                <p>
                  You are about to <strong>permanently delete</strong> all{" "}
                  <strong>{bulkDeleteCount} simulations</strong> in this Price Change group:
                </p>
                <div className="group-details">
                  <p>
                    <strong>Description:</strong> {bulkDeleteDescription}
                  </p>
                  <p>
                    <strong>Date:</strong>{" "}
                    {new Date(bulkDeleteDate).toLocaleString("id-ID")}
                  </p>
                </div>
                <div className="warning-note">
                  <strong>⚠️ Warning:</strong> This action cannot be undone. All
                  simulation data, materials, and calculations for this price change
                  will be permanently removed.
                </div>
              </div>
            </div>
            <div className="modal-actions">
              <button
                className="cancel-btn"
                onClick={handleCloseBulkDeleteModal}
                disabled={bulkDeleting}
              >
                Cancel
              </button>
              <button
                className="confirm-delete-btn"
                onClick={handleConfirmBulkDelete}
                disabled={bulkDeleting}
              >
                {bulkDeleting ? (
                  <>
                    <div className="esbm-spinner esbm-spinner-small" style={{ marginRight: '8px' }}></div>
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash size={16} />
                    Delete {bulkDeleteCount} Simulations
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Always render both ProductHPPReport (Before) and Simulation Modal (After) for PDF generation */}
      {/* ProductHPPReport for Before page */}
      {showDetailedReport && hppResultsData && !isCustomFormula && (
        <div style={reportPage === 2 ? { 
          position: 'fixed', 
          left: '-9999px', 
          top: 0,
          width: '1200px',
          opacity: 0,
          pointerEvents: 'none',
          zIndex: -1
        } : {}}>
          <ProductHPPReport
            product={hppResultsData}
            isOpen={true}
            onClose={() => setShowDetailedReport(false)}
            selectedYear={new Date().getFullYear()}
            isBeforeAfterMode={true}
            currentPage={reportPage}
            onPageChange={setReportPage}
          />
        </div>
      )}
    </div>
  );
}
