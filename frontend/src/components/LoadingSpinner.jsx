import React from "react";
import "../styles/LoadingSpinner.css";

const LoadingSpinner = ({ 
  message = "Loading...", 
  size = "medium", 
  showMessage = true,
  className = "" 
}) => {
  return (
    <div className={`esbm-loading-container ${className}`}>
      <div className={`esbm-spinner esbm-spinner-${size}`}></div>
      {showMessage && (
        <p className="esbm-loading-message">{message}</p>
      )}
    </div>
  );
};

export default LoadingSpinner;