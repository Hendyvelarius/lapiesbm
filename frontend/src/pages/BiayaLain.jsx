import React, { useState, useEffect } from 'react';
import { masterAPI } from '../services/api';
import '../styles/BiayaLain.css';
import { Search, Filter, Users, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Plus, Edit, Trash2, X, Check, Download, Upload } from 'lucide-react';
import AWN from 'awesome-notifications';
import 'awesome-notifications/dist/style.css';
import * as XLSX from 'xlsx';

// Initialize awesome-notifications
const notifier = new AWN({
  position: 'top-right',
  durations: {
    global: 4000
  }
});

const BiayaLain = () => {
  const [generalCostsData, setGeneralCostsData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [paginatedData, setPaginatedData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPeriode, setSelectedPeriode] = useState('All Periods');
  const [selectedLineProduction, setSelectedLineProduction] = useState('All Lines');
  const [selectedBentukSediaan, setSelectedBentukSediaan] = useState('All Forms');
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50);

  // Sorting states
  const [sortField, setSortField] = useState('');
  const [sortDirection, setSortDirection] = useState('asc');

  // Inline editing states
  const [editingRowId, setEditingRowId] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [submitLoading, setSubmitLoading] = useState(false);
  
  // Delete modal states
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingItem, setDeletingItem] = useState(null);

  // Add modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [addFormData, setAddFormData] = useState({
    periode: new Date().getFullYear().toString(),
    directLabor: '',
    factoryOverHead: '',
    depresiasi: '',
    lineProduction: '',
    bentukSediaan: ''
  });
  
  // Import warning modal state
  const [showImportWarning, setShowImportWarning] = useState(false);

  // Fetch all data
  const fetchAllData = async () => {
    try {
      setLoading(true);
      const generalCostsResponse = await masterAPI.getGeneralCostsPerSediaan();
      
      setGeneralCostsData(generalCostsResponse);
      setError('');
    } catch (error) {
      console.error('Error fetching general costs data:', error);
      setError('Failed to load general costs data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Initial data load
  useEffect(() => {
    fetchAllData();
  }, []);

  // Process general costs data
  const processedData = React.useMemo(() => {
    return generalCostsData.map(cost => ({
      // Create composite key for uniqueness
      compositeKey: `${cost.Periode}_${cost.Line_Production}_${cost.Bentuk_Sediaan}`,
      periode: cost.Periode,
      directLabor: cost.Direct_Labor,
      factoryOverHead: cost.Factory_Over_Head,
      depresiasi: cost.Depresiasi,
      lineProduction: cost.Line_Production,
      bentukSediaan: cost.Bentuk_Sediaan
    })).sort((a, b) => {
      // Sort by periode desc, then bentukSediaan, then lineProduction
      if (a.periode !== b.periode) {
        return b.periode.localeCompare(a.periode);
      }
      if (a.bentukSediaan !== b.bentukSediaan) {
        return a.bentukSediaan.localeCompare(b.bentukSediaan);
      }
      return a.lineProduction.localeCompare(b.lineProduction);
    });
  }, [generalCostsData]);

  // Filter and search data
  useEffect(() => {
    let filtered = processedData;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(item =>
        item.bentukSediaan.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.lineProduction.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.periode.toString().toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply periode filter
    if (selectedPeriode !== 'All Periods') {
      filtered = filtered.filter(item => item.periode === selectedPeriode);
    }

    // Apply line production filter
    if (selectedLineProduction !== 'All Lines') {
      filtered = filtered.filter(item => item.lineProduction === selectedLineProduction);
    }

    // Apply bentuk sediaan filter
    if (selectedBentukSediaan !== 'All Forms') {
      filtered = filtered.filter(item => item.bentukSediaan === selectedBentukSediaan);
    }

    setFilteredData(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  }, [processedData, searchTerm, selectedPeriode, selectedLineProduction, selectedBentukSediaan]);

  // Handle sorting
  const handleSort = (field) => {
    const newDirection = sortField === field && sortDirection === 'asc' ? 'desc' : 'asc';
    setSortField(field);
    setSortDirection(newDirection);

    const sorted = [...filteredData].sort((a, b) => {
      let aValue = a[field];
      let bValue = b[field];

      // Handle numeric fields
      if (field === 'directLabor' || field === 'factoryOverHead' || field === 'depresiasi') {
        aValue = parseFloat(aValue) || 0;
        bValue = parseFloat(bValue) || 0;
      }

      // Handle string fields
      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (newDirection === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    setFilteredData(sorted);
  };

  // Pagination
  useEffect(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    setPaginatedData(filteredData.slice(startIndex, endIndex));
  }, [filteredData, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, filteredData.length);

  // Get unique values for filter dropdowns
  const uniquePeriodes = [...new Set(processedData.map(item => item.periode))].sort().reverse();
  const uniqueLineProductions = [...new Set(processedData.map(item => item.lineProduction))].sort();
  const uniqueBentukSediaanList = [...new Set(processedData.map(item => item.bentukSediaan))].sort();

  // Available options for dropdowns
  const availablePeriodes = uniquePeriodes.length > 0 ? uniquePeriodes : [new Date().getFullYear().toString()];
  const availableLineProductions = ['PN1', 'PN2', 'PN3']; // Define available production lines
  const availableBentukSediaanOptions = [
    'Tablet Biasa Kapsul',
    'Tablet Salut', 
    'Injeksi',
    'Liquid & DS',
    'Probiotik & Hormon'
  ]; // Define available dosage forms based on CSV

  // Inline editing functions
  const handleEdit = (item) => {
    setEditingRowId(item.compositeKey);
    setEditFormData({
      originalKeys: {
        periode: item.periode,
        lineProduction: item.lineProduction,
        bentukSediaan: item.bentukSediaan
      },
      periode: item.periode,
      directLabor: item.directLabor,
      factoryOverHead: item.factoryOverHead,
      depresiasi: item.depresiasi,
      lineProduction: item.lineProduction,
      bentukSediaan: item.bentukSediaan
    });
  };

  const handleCancelEdit = () => {
    setEditingRowId(null);
    setEditFormData({});
  };

  const handleEditChange = (field, value) => {
    setEditFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmitEdit = async () => {
    try {
      setSubmitLoading(true);
      
      const updateData = {
        periode: editFormData.periode,
        directLabor: parseFloat(editFormData.directLabor) || 0,
        factoryOverHead: parseFloat(editFormData.factoryOverHead) || 0,
        depresiasi: parseFloat(editFormData.depresiasi) || 0,
        lineProduction: editFormData.lineProduction,
        bentukSediaan: editFormData.bentukSediaan
      };
      
      await masterAPI.updateGeneralCostPerSediaan(editFormData.originalKeys, updateData);
      
      // Refresh data
      await fetchAllData();
      
      setEditingRowId(null);
      setEditFormData({});
      
      notifier.success('General cost updated successfully');
      
    } catch (error) {
      console.error('Error updating general cost:', error);
      notifier.alert('Error updating entry: ' + error.message);
    } finally {
      setSubmitLoading(false);
    }
  };

  // Add modal functions
  const handleAdd = () => {
    setShowAddModal(true);
  };

  const handleCancelAdd = () => {
    setShowAddModal(false);
    setAddFormData({
      periode: new Date().getFullYear().toString(),
      directLabor: '',
      factoryOverHead: '',
      depresiasi: '',
      lineProduction: '',
      bentukSediaan: ''
    });
  };

  const handleAddFormChange = (field, value) => {
    setAddFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmitAdd = async () => {
    try {
      // Validation
      if (!addFormData.periode) {
        notifier.alert('Please select a Periode');
        return;
      }
      
      if (!addFormData.directLabor || parseFloat(addFormData.directLabor) < 0) {
        notifier.alert('Please enter a valid Direct Labor cost (must be 0 or greater)');
        return;
      }
      
      if (!addFormData.factoryOverHead || parseFloat(addFormData.factoryOverHead) < 0) {
        notifier.alert('Please enter a valid Factory Overhead cost (must be 0 or greater)');
        return;
      }

      if (!addFormData.depresiasi || parseFloat(addFormData.depresiasi) < 0) {
        notifier.alert('Please enter a valid Depreciation cost (must be 0 or greater)');
        return;
      }
      
      if (!addFormData.lineProduction) {
        notifier.alert('Please select a Production Line');
        return;
      }
      
      if (!addFormData.bentukSediaan) {
        notifier.alert('Please select a Dosage Form');
        return;
      }
      
      // Check for duplicate entry
      const isDuplicate = processedData.some(item => 
        item.periode === addFormData.periode && 
        item.lineProduction === addFormData.lineProduction &&
        item.bentukSediaan === addFormData.bentukSediaan
      );
      
      if (isDuplicate) {
        notifier.alert(`A general cost entry for periode ${addFormData.periode}, line ${addFormData.lineProduction}, and form ${addFormData.bentukSediaan} already exists. Please edit the existing entry instead.`);
        return;
      }
      
      const newEntry = {
        periode: addFormData.periode,
        directLabor: parseFloat(addFormData.directLabor),
        factoryOverHead: parseFloat(addFormData.factoryOverHead),
        depresiasi: parseFloat(addFormData.depresiasi),
        lineProduction: addFormData.lineProduction,
        bentukSediaan: addFormData.bentukSediaan
      };
      
      await masterAPI.addGeneralCostPerSediaan(newEntry);
      
      // Refresh data and close modal
      await fetchAllData();
      handleCancelAdd();
      notifier.success('General cost added successfully');
    } catch (error) {
      console.error('Error adding general cost entry:', error);
      notifier.alert('Error adding entry: ' + error.message);
    }
  };

  // Delete functions
  const handleDelete = (item) => {
    setDeletingItem(item);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      setSubmitLoading(true);
      
      const keys = {
        periode: deletingItem.periode,
        lineProduction: deletingItem.lineProduction,
        bentukSediaan: deletingItem.bentukSediaan
      };
      
      await masterAPI.deleteGeneralCostPerSediaan(keys);
      
      // Refresh data
      await fetchAllData();
      
      setShowDeleteModal(false);
      setDeletingItem(null);
      
      notifier.success('General cost deleted successfully');
      
    } catch (error) {
      console.error('Error deleting general cost:', error);
      notifier.alert('Failed to delete item: ' + error.message);
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteModal(false);
    setDeletingItem(null);
  };

  // Export function
  const handleExportGeneralCosts = () => {
    try {
      const exportData = processedData.map(item => ({
        'Periode': item.periode,
        'Direct_Labor': item.directLabor || 0,
        'Factory_Over_Head': item.factoryOverHead || 0,
        'Depresiasi': item.depresiasi || 0,
        'Line_Production': item.lineProduction,
        'Bentuk_Sediaan': item.bentukSediaan
      }));

      if (exportData.length === 0) {
        notifier.alert('No general costs data available for export');
        return;
      }

      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const columnWidths = [
        { wch: 10 }, { wch: 15 }, { wch: 18 }, { wch: 12 }, { wch: 18 }, { wch: 25 }
      ];
      worksheet['!cols'] = columnWidths;
      XLSX.utils.book_append_sheet(workbook, worksheet, 'General Costs per Sediaan');
      const filename = `general_costs_per_sediaan_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(workbook, filename);
      notifier.success(`Successfully exported ${exportData.length} general costs records to Excel`);
    } catch (error) {
      console.error('Error exporting general costs data:', error);
      notifier.alert('Failed to export general costs data. Please try again.');
    }
  };

  // Import function
  const handleImportGeneralCosts = () => {
    setShowImportWarning(true);
  };

  const handleImportConfirm = () => {
    setShowImportWarning(false);
    proceedWithImport();
  };

  const proceedWithImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,.xlsx,.xls';
    input.style.display = 'none';

    input.onchange = async (event) => {
      const file = event.target.files[0];
      if (!file) return;

      try {
        setLoading(true);

        let importedData = [];
        
        if (file.name.endsWith('.csv')) {
          const text = await readFileAsText(file);
          importedData = parseCSV(text);
        } else {
          const buffer = await file.arrayBuffer();
          const workbook = XLSX.read(buffer, { type: 'buffer' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          importedData = XLSX.utils.sheet_to_json(worksheet);
        }

        if (importedData.length === 0) {
          notifier.alert('No data found in the uploaded file.');
          return;
        }

        const validatedData = await validateAndMapImportData(importedData);
        
        if (validatedData.length === 0) {
          notifier.alert('No valid data found after validation. Please check your file format and data.');
          return;
        }

        const result = await masterAPI.bulkImportGeneralCostsPerSediaan(validatedData);
        console.log('Import successful:', result);
        await fetchAllData();

        // Close import modal
        setShowImportWarning(false);

        notifier.success(`Import completed successfully! Deleted: ${result.data.deleted} old records, Inserted: ${result.data.inserted} new records`, {
          durations: { success: 6000 }
        });

      } catch (error) {
        console.error('Error importing data:', error);
        notifier.alert(`Failed to import data: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };

    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
  };

  const readFileAsText = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(e);
      reader.readAsText(file);
    });
  };

  const parseCSV = (text) => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const data = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      data.push(row);
    }

    return data;
  };

  const validateAndMapImportData = async (importedData) => {
    const validatedData = [];
    const errors = [];

    for (let i = 0; i < importedData.length; i++) {
      const row = importedData[i];
      const rowIndex = i + 2;

      const periode = row['Periode'] || row['periode'] || row['Period'] || row['year'];
      const directLabor = row['Direct_Labor'] || row['DirectLabor'] || row['Direct Labor'] || row['direct_labor'];
      const factoryOverHead = row['Factory_Over_Head'] || row['FactoryOverHead'] || row['Factory Overhead'] || row['factory_over_head'];
      const depresiasi = row['Depresiasi'] || row['depresiasi'] || row['Depreciation'] || row['depreciation'];
      const lineProduction = row['Line_Production'] || row['LineProduction'] || row['Line Production'] || row['line_production'];
      const bentukSediaan = row['Bentuk_Sediaan'] || row['BentukSediaan'] || row['Bentuk Sediaan'] || row['bentuk_sediaan'] || row['Dosage Form'];

      if (!periode) {
        errors.push(`Row ${rowIndex}: Periode is required`);
        continue;
      }
      if (!lineProduction) {
        errors.push(`Row ${rowIndex}: Line Production is required`);
        continue;
      }
      if (!bentukSediaan) {
        errors.push(`Row ${rowIndex}: Bentuk Sediaan is required`);
        continue;
      }

      const numericFields = { directLabor, factoryOverHead, depresiasi };
      let validRow = true;
      const processedRow = {
        periode: String(periode),
        lineProduction: String(lineProduction),
        bentukSediaan: String(bentukSediaan)
      };

      for (const [key, value] of Object.entries(numericFields)) {
        if (value !== null && value !== undefined && value !== '') {
          const numValue = Number(value);
          if (isNaN(numValue)) {
            errors.push(`Row ${rowIndex}: ${key} must be a valid number`);
            validRow = false;
          } else {
            processedRow[key] = numValue;
          }
        } else {
          processedRow[key] = 0;
        }
      }

      // Check for duplicates within the import data (not against existing data since bulk import replaces all)
      const isDuplicateInImport = validatedData.some(existing => 
        existing.periode === processedRow.periode &&
        existing.lineProduction === processedRow.lineProduction &&
        existing.bentukSediaan === processedRow.bentukSediaan
      );

      if (isDuplicateInImport) {
        errors.push(`Row ${rowIndex}: Duplicate entry within import data for ${processedRow.periode}, ${processedRow.lineProduction}, ${processedRow.bentukSediaan}`);
        validRow = false;
      }

      if (validRow) {
        validatedData.push(processedRow);
      }
    }

    if (errors.length > 0) {
      const errorMessage = `Import validation errors:\n${errors.slice(0, 10).join('\n')}${errors.length > 10 ? `\n... and ${errors.length - 10} more errors` : ''}`;
      notifier.alert(errorMessage);
    }

    return validatedData;
  };

  if (loading) {
    return (
      <div className="loading-spinner">
        <div className="spinner"></div>
        <p>Loading general costs data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-message">
        <Users size={48} />
        <p>{error}</p>
        <button className="retry-btn" onClick={fetchAllData}>
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="product-group-container biaya-lain-page">
      <div className="controls-section">
        <div className="search-box">
          <Search size={20} />
          <input
            type="text"
            placeholder="Search by dosage form, production line, period..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="filter-controls">
          <div className="category-filter">
            <Filter size={18} />
            <select
              value={selectedPeriode}
              onChange={(e) => setSelectedPeriode(e.target.value)}
            >
              <option value="All Periods">All Periods</option>
              {uniquePeriodes.map(periode => (
                <option key={periode} value={periode}>{periode}</option>
              ))}
            </select>
          </div>

          <div className="category-filter">
            <Filter size={18} />
            <select
              value={selectedLineProduction}
              onChange={(e) => setSelectedLineProduction(e.target.value)}
            >
              <option value="All Lines">All Lines</option>
              {uniqueLineProductions.map(line => (
                <option key={line} value={line}>{line}</option>
              ))}
            </select>
          </div>

          <div className="category-filter">
            <Filter size={18} />
            <select
              value={selectedBentukSediaan}
              onChange={(e) => setSelectedBentukSediaan(e.target.value)}
            >
              <option value="All Forms">All Forms</option>
              {uniqueBentukSediaanList.map(form => (
                <option key={form} value={form}>{form}</option>
              ))}
            </select>
          </div>
          
          <button className="export-btn" onClick={handleExportGeneralCosts}>
            <Download size={20} />
            Export
          </button>
          
          <button className="import-btn" onClick={handleImportGeneralCosts}>
            <Upload size={20} />
            Import
          </button>
          
          <button className="add-btn" onClick={() => setShowAddModal(true)}>
            <Plus size={20} />
            Add New
          </button>
        </div>
      </div>

      <div className="table-container">
        <div className="table-scroll-wrapper">
          <table className="groups-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('periode')} className="sortable">
                  Periode
                  {sortField === 'periode' && (
                    sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                  )}
                </th>
                <th onClick={() => handleSort('lineProduction')} className="sortable">
                  Line Production
                  {sortField === 'lineProduction' && (
                    sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                  )}
                </th>
                <th onClick={() => handleSort('bentukSediaan')} className="sortable">
                  Bentuk Sediaan
                  {sortField === 'bentukSediaan' && (
                    sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                  )}
                </th>
                <th onClick={() => handleSort('directLabor')} className="sortable">
                  Direct Labor
                  {sortField === 'directLabor' && (
                    sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                  )}
                </th>
                <th onClick={() => handleSort('factoryOverHead')} className="sortable">
                  Factory Overhead
                  {sortField === 'factoryOverHead' && (
                    sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                  )}
                </th>
                <th onClick={() => handleSort('depresiasi')} className="sortable">
                  Depreciation
                  {sortField === 'depresiasi' && (
                    sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                  )}
                </th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.map((item) => (
                <tr key={item.compositeKey}>
                  <td className="periode-cell">{item.periode}</td>
                  <td className="line-cell">{item.lineProduction}</td>
                  <td className="bentuk-cell">{item.bentukSediaan}</td>
                  
                  {editingRowId === item.compositeKey ? (
                    // Editing mode
                    <>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          value={editFormData.directLabor}
                          onChange={(e) => handleEditChange('directLabor', e.target.value)}
                          className="edit-input"
                          placeholder="Direct Labor"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          value={editFormData.factoryOverHead}
                          onChange={(e) => handleEditChange('factoryOverHead', e.target.value)}
                          className="edit-input"
                          placeholder="Factory Overhead"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          step="0.01"
                          value={editFormData.depresiasi}
                          onChange={(e) => handleEditChange('depresiasi', e.target.value)}
                          className="edit-input"
                          placeholder="Depreciation"
                        />
                      </td>
                      <td className="actions editing-mode">
                        <button 
                          className="submit-btn"
                          onClick={handleSubmitEdit}
                          disabled={submitLoading}
                          title="Save Changes"
                        >
                          <Check size={16} />
                        </button>
                        <button 
                          className="cancel-btn"
                          onClick={handleCancelEdit}
                          disabled={submitLoading}
                          title="Cancel Edit"
                        >
                          <X size={16} />
                        </button>
                      </td>
                    </>
                  ) : (
                    // Display mode
                    <>
                      <td className="cost-cell">{parseFloat(item.directLabor).toLocaleString('id-ID')}</td>
                      <td className="cost-cell">{parseFloat(item.factoryOverHead).toLocaleString('id-ID')}</td>
                      <td className="cost-cell">{parseFloat(item.depresiasi).toLocaleString('id-ID')}</td>
                      <td className="actions display-mode">
                        <button 
                          className="edit-btn"
                          onClick={() => handleEdit(item)}
                          title="Edit General Cost"
                        >
                          <Edit size={16} />
                        </button>
                        <button 
                          className="delete-btn"
                          onClick={() => handleDelete(item)}
                          title="Delete General Cost"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredData.length === 0 && !loading && (
          <div className="no-data">
            <Users size={48} />
            <h3>No General Costs Data Found</h3>
            <p>
              {searchTerm
                ? 'No data matches your search criteria.'
                : 'No general costs data available.'
              }
            </p>
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {filteredData.length > 0 && (
        <div className="pagination-container">
          <div className="pagination-info">
            Showing {startItem} to {endItem} of {filteredData.length} entries
          </div>
          
          <div className="pagination-controls">
            <button 
              className="pagination-btn"
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft size={16} />
              Previous
            </button>
            
            <div className="page-numbers">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pageNumber = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
                return (
                  <button
                    key={pageNumber}
                    className={`page-number ${currentPage === pageNumber ? 'active' : ''}`}
                    onClick={() => setCurrentPage(pageNumber)}
                  >
                    {pageNumber}
                  </button>
                );
              })}
            </div>
            
            <button 
              className="pagination-btn"
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
            >
              Next
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      <div className="table-info">
        <span>{filteredData.length} of {processedData.length} general cost entries</span>
      </div>

      {/* Add New Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content add-modal">
            <div className="modal-header">
              <h2>Add New General Cost per Sediaan</h2>
              <button className="modal-close" onClick={handleCancelAdd}>
                <X size={24} />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label>Periode: *</label>
                  <input
                    type="text"
                    value={addFormData.periode}
                    onChange={(e) => handleAddFormChange('periode', e.target.value)}
                    placeholder="YYYY"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Line Production: *</label>
                  <select
                    value={addFormData.lineProduction}
                    onChange={(e) => handleAddFormChange('lineProduction', e.target.value)}
                    required
                  >
                    <option value="">Select Line Production</option>
                    {availableLineProductions.map(line => (
                      <option key={line} value={line}>{line}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="form-group">
                <label>Bentuk Sediaan: *</label>
                <select
                  value={addFormData.bentukSediaan}
                  onChange={(e) => handleAddFormChange('bentukSediaan', e.target.value)}
                  required
                >
                  <option value="">Select Dosage Form</option>
                  {availableBentukSediaanOptions.map(form => (
                    <option key={form} value={form}>{form}</option>
                  ))}
                </select>
              </div>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Direct Labor: *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={addFormData.directLabor}
                    onChange={(e) => handleAddFormChange('directLabor', e.target.value)}
                    placeholder="0.00"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Factory Overhead: *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={addFormData.factoryOverHead}
                    onChange={(e) => handleAddFormChange('factoryOverHead', e.target.value)}
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>
              
              <div className="form-group">
                <label>Depreciation: *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={addFormData.depresiasi}
                  onChange={(e) => handleAddFormChange('depresiasi', e.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>
              
              <div className="form-info">
                <small>
                  * Required fields<br/>
                  • All cost fields must be numeric values (0 or greater)
                </small>
              </div>
            </div>
            <div className="modal-actions">
              <button 
                type="button" 
                className="modal-btn secondary" 
                onClick={handleCancelAdd}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="modal-btn primary" 
                onClick={handleSubmitAdd}
                disabled={!addFormData.periode || !addFormData.lineProduction || !addFormData.bentukSediaan || !addFormData.directLabor || !addFormData.factoryOverHead || !addFormData.depresiasi}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="modal-overlay">
          <div className="modal-content delete-modal">
            <div className="modal-header">
              <h2>Delete General Cost</h2>
              <button className="modal-close" onClick={handleDeleteCancel}>
                <X size={24} />
              </button>
            </div>
            
            <div className="modal-body">
              <div className="delete-warning">
                <div className="warning-icon">
                  <Trash2 size={48} />
                </div>
                <h3>Are you sure you want to delete this general cost entry?</h3>
                
                {deletingItem && (
                  <div className="delete-info">
                    <div className="info-row">
                      <strong>Periode:</strong>
                      <span>{deletingItem.periode}</span>
                    </div>
                    <div className="info-row">
                      <strong>Line Production:</strong>
                      <span>{deletingItem.lineProduction}</span>
                    </div>
                    <div className="info-row">
                      <strong>Bentuk Sediaan:</strong>
                      <span>{deletingItem.bentukSediaan}</span>
                    </div>
                    <div className="info-row">
                      <strong>Direct Labor:</strong>
                      <span>{deletingItem.directLabor}</span>
                    </div>
                    <div className="info-row">
                      <strong>Factory Overhead:</strong>
                      <span>{deletingItem.factoryOverHead}</span>
                    </div>
                    <div className="info-row">
                      <strong>Depreciation:</strong>
                      <span>{deletingItem.depresiasi}</span>
                    </div>
                  </div>
                )}
                
                <p className="warning-text">
                  This action cannot be undone.
                </p>
              </div>
              
              <div className="modal-actions">
                <button 
                  className="modal-btn secondary" 
                  onClick={handleDeleteCancel}
                  disabled={submitLoading}
                >
                  Cancel
                </button>
                <button 
                  className="modal-btn danger" 
                  onClick={handleDeleteConfirm}
                  disabled={submitLoading}
                >
                  {submitLoading ? (
                    <>
                      <div className="btn-spinner"></div>
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 size={16} />
                      Delete General Cost
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Import Warning Modal - Need to implement */}
      {showImportWarning && (
        <div className="modal-overlay">
          <div className="modal-content import-warning-modal">
            <div className="modal-header">
              <h2>General Costs Import</h2>
              <button className="modal-close" onClick={() => setShowImportWarning(false)}>
                <X size={24} />
              </button>
            </div>
            
            <div className="modal-body">
              <div className="warning-icon">
                <Upload size={48} />
              </div>
              <h3>Import General Cost Entries</h3>
              <p>
                This will replace ALL existing general cost entries with the data from your file.
                Make sure your file contains the correct format with the following columns:
              </p>
              <ul>
                <li><strong>Periode</strong> - Year (e.g., 2025)</li>
                <li><strong>Direct_Labor</strong> - Direct labor cost</li>
                <li><strong>Factory_Over_Head</strong> - Factory overhead cost</li>
                <li><strong>Depresiasi</strong> - Depreciation cost</li>
                <li><strong>Line_Production</strong> - Production line (PN1, PN2, PN3)</li>
                <li><strong>Bentuk_Sediaan</strong> - Dosage form</li>
              </ul>
            </div>
            
            <div className="modal-actions">
              <button 
                className="modal-btn secondary" 
                onClick={() => setShowImportWarning(false)}
              >
                Cancel
              </button>
              <button 
                className="modal-btn primary" 
                onClick={handleImportConfirm}
              >
                Continue Import
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BiayaLain;
