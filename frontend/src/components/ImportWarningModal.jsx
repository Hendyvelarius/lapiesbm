import React from 'react';
import { X, AlertTriangle, FileDown, CheckCircle, FileText } from 'lucide-react';
import '../styles/ImportWarningModal.css';

const ImportWarningModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title = "Bulk Import Warning",
  dataType = "entries"
}) => {
  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  return (
    <div className="import-warning-modal-overlay">
      <div className="import-warning-modal">
        <div className="import-warning-header">
          <div className="import-warning-title">
            <AlertTriangle className="warning-icon" size={20} />
            <h2>IMPORTANT: {title}</h2>
          </div>
          <button className="import-warning-close" onClick={handleCancel}>
            <X size={20} />
          </button>
        </div>

        <div className="import-warning-content">
          <div className="warning-message">
            <p className="main-warning">
              This import will <strong>DELETE all existing {dataType}</strong> (except default rates) 
              and replace them with your imported data.
            </p>
          </div>

          <div className="safety-checklist">
            <h3>📋 Before proceeding, please ensure:</h3>
            <div className="checklist-items">
              <div className="checklist-item">
                <FileDown size={18} />
                <span>Export your current data as backup</span>
              </div>
              <div className="checklist-item">
                <CheckCircle size={18} />
                <span>Verify your import file is accurate</span>
              </div>
              <div className="checklist-item">
                <FileText size={18} />
                <span>Ensure all Product IDs in your file exist in the system</span>
              </div>
            </div>
          </div>

          <div className="final-warning">
            <p>⚠️ <strong>This action cannot be undone.</strong></p>
            <p>Are you sure you want to continue with the import?</p>
          </div>
        </div>

        <div className="import-warning-actions">
          <button className="cancel-btn" onClick={handleCancel}>
            Cancel Import
          </button>
          <button className="confirm-btn" onClick={handleConfirm}>
            Yes, Import Data
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportWarningModal;