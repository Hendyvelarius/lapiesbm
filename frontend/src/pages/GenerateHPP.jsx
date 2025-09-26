import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import '../styles/GenerateHPP.css';
import { CheckCircle, Calculator, Eye, AlertTriangle, Clock, ChevronRight } from 'lucide-react';
import ValidationModal from '../components/ValidationModal';

// API base configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

// Generic API request function
const apiCall = async (endpoint, method = 'GET', data = null) => {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const config = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (data && method !== 'GET') {
    config.body = JSON.stringify(data);
  }

  try {
    const response = await fetch(url, config);
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || `HTTP error! status: ${response.status}`);
    }

    return result;
  } catch (error) {
    console.error('API Request Error:', error);
    throw error;
  }
};

export default function GenerateHPP() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [stepStatus, setStepStatus] = useState({
    validation: 'pending', // pending, running, completed, failed
    calculation: 'pending',
    dataCheck: 'pending' // Changed from 'posting' to 'dataCheck'
  });
  const [loading, setLoading] = useState(false);
  const [showValidationModal, setShowValidationModal] = useState(false);

  const currentYear = new Date().getFullYear().toString();

  const steps = [
    {
      number: 1,
      title: 'Validation Check',
      description: 'Verify formula assignments, material prices, and data integrity before calculation',
      icon: CheckCircle,
      action: 'Check',
      status: stepStatus.validation
    },
    {
      number: 2,
      title: 'HPP Calculation',
      description: 'Execute stored procedure to calculate Harga Pokok Produksi (HPP) for all products',
      icon: Calculator,
      action: 'Calculate',
      status: stepStatus.calculation
    },
    {
      number: 3,
      title: 'Check Data Validity',
      description: 'Review calculated HPP values and verify data integrity in the results',
      icon: Eye,
      action: 'Check Data',
      status: stepStatus.dataCheck
    }
  ];

  const getStepStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="status-icon completed" size={20} />;
      case 'warning':
        return <AlertTriangle className="status-icon warning" size={20} />;
      case 'running':
        return <Clock className="status-icon running" size={20} />;
      case 'failed':
        return <AlertTriangle className="status-icon failed" size={20} />;
      default:
        return null;
    }
  };

  const getStepStatusClass = (step, status) => {
    if (status === 'completed') return 'completed';
    if (status === 'warning') return 'warning';
    if (status === 'running') return 'running';
    if (status === 'failed') return 'failed';
    if (step <= currentStep) return 'active';
    return 'disabled';
  };

  const handleStepAction = async (stepNumber) => {
    if (stepNumber > currentStep) return; // Can't skip steps
    
    if (stepNumber === 1) {
      // Open validation modal for step 1
      setShowValidationModal(true);
    } else if (stepNumber === 2) {
      // HPP Calculation using stored procedure
      await handleHPPCalculation();
    } else if (stepNumber === 3) {
      // Check Data Validity - navigate to results page
      navigate('/hpp-results');
    }
  };

  const handleHPPCalculation = async () => {
    try {
      setLoading(true);
      setStepStatus(prev => ({ ...prev, calculation: 'running' }));

      // Call the backend to execute sp_COGS_GenerateHPP with hardcoded parameters
      const response = await apiCall('/hpp/generate', 'POST', {
        periode: currentYear
      });

      if (response.success) {
        setStepStatus(prev => ({ ...prev, calculation: 'completed' }));
        setCurrentStep(3);
      } else {
        setStepStatus(prev => ({ ...prev, calculation: 'failed' }));
      }
    } catch (error) {
      console.error('HPP Calculation Error:', error);
      setStepStatus(prev => ({ ...prev, calculation: 'failed' }));
      alert('Error during HPP calculation: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleValidationComplete = (result) => {
    if (result === 'success') {
      setStepStatus(prev => ({ ...prev, validation: 'completed' }));
      setCurrentStep(2);
      setShowValidationModal(false); // Close modal on success
    } else if (result === 'warning') {
      setStepStatus(prev => ({ ...prev, validation: 'warning' }));
      setCurrentStep(2);
      // Don't close modal on warning - let user see the warnings and decide
    } else {
      setStepStatus(prev => ({ ...prev, validation: 'failed' }));
      // Keep modal open on failure - don't close it
      // Don't advance to next step
    }
  };

  const handleValidationClose = () => {
    setShowValidationModal(false);
  };

  const resetProcess = () => {
    setCurrentStep(1);
    setStepStatus({
      validation: 'pending',
      calculation: 'pending',
      dataCheck: 'pending'
    });
    setShowValidationModal(false); // Close modal if it's open
  };

  return (
    <div className="generate-hpp-container">
      <div className="hpp-process-container">
        <div className="process-header">
          <h2>HPP Generation Process</h2>
          <button 
            className="btn-reset"
            onClick={resetProcess}
            disabled={loading}
          >
            Reset Process
          </button>
        </div>

        <div className="steps-container">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const statusClass = getStepStatusClass(step.number, step.status);
            
            return (
              <div key={step.number} className={`step-card ${statusClass}`}>
                <div className="step-header">
                  <div className="step-number-container">
                    <div className="step-number">{step.number}</div>
                    {getStepStatusIcon(step.status)}
                  </div>
                  <div className="step-info">
                    <h3 className="step-title">{step.title}</h3>
                    <p className="step-description">{step.description}</p>
                  </div>
                </div>
                
                <div className="step-actions">
                  <button
                    className={`btn-step ${statusClass}`}
                    onClick={() => handleStepAction(step.number)}
                    disabled={step.number > currentStep || loading || step.status === 'completed' || 
                             (step.number > 1 && stepStatus.validation === 'failed')}
                  >
                    <Icon size={18} />
                    {step.status === 'running' ? 'Processing...' : 
                     step.status === 'completed' ? 'Completed' : 
                     step.action}
                  </button>
                </div>

                {index < steps.length - 1 && (
                  <div className="step-connector">
                    <ChevronRight size={20} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="process-info">
          <div className="info-card">
            <AlertTriangle size={20} />
            <div>
              <h4>Important Notes</h4>
              <ul>
                <li>Complete validation checks before proceeding to calculation</li>
                <li>HPP calculation executes stored procedure sp_COGS_GenerateHPP for year {currentYear}</li>
                <li>Calculation updates database tables automatically when completed</li>
                <li>Review calculated results in the data validity check step</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
      
      {/* Validation Modal */}
      <ValidationModal 
        isOpen={showValidationModal}
        onClose={handleValidationClose}
        onValidationComplete={handleValidationComplete}
      />
    </div>
  );
}
