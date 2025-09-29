import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router';
import { useState, useEffect } from 'react';
import TopNavbar from './components/TopNavbar';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import HPPSimulation from './pages/HPPSimulation';
import Currency from './pages/Currency';
import HargaBahan from './pages/HargaBahan';
import BiayaLain from './pages/BiayaLain';
import ProductGroup from './pages/ProductGroup';
import Pembebanan from './pages/Pembebanan';
import FormulaAssignment from './pages/FormulaAssignment';
import ProductFormula from './pages/ProductFormula';
import GenerateHPP from './pages/GenerateHPP';
import ExpiryCost from './pages/ExpiryCost';
import HPPResults from './pages/HPPResults';
import { 
  authenticateFromURL, 
  storeAuthData, 
  getStoredAuthData, 
  getCurrentUser, 
  isAuthenticated, 
  clearAuthData,
  cleanAuthFromURL 
} from './utils/auth';
import './styles/App.css';

function AppContent() {
  const location = useLocation();
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Authentication state
  const [authState, setAuthState] = useState({
    isLoading: true,
    isAuthenticated: false,
    user: null,
    authError: null
  });

  // Initialize authentication on app load
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Check if there's an auth token in the URL
        const urlAuthResult = authenticateFromURL();
        
        if (urlAuthResult.success) {
          // New authentication from URL
          storeAuthData(urlAuthResult);
          setAuthState({
            isLoading: false,
            isAuthenticated: true,
            user: urlAuthResult.user,
            authError: null
          });
          
          // Clean URL by removing auth token
          cleanAuthFromURL();
          
        } else {
          // Check for existing stored authentication
          const storedAuth = getStoredAuthData();
          
          if (storedAuth && storedAuth.success && isAuthenticated()) {
            setAuthState({
              isLoading: false,
              isAuthenticated: true,
              user: storedAuth.user,
              authError: null
            });
          } else {
            // No valid authentication found
            clearAuthData(); // Clean up any invalid stored data
            setAuthState({
              isLoading: false,
              isAuthenticated: false,
              user: null,
              authError: urlAuthResult.message || 'Authentication required'
            });
          }
        }
      } catch (error) {
        console.error('Authentication initialization error:', error);
        setAuthState({
          isLoading: false,
          isAuthenticated: false,
          user: null,
          authError: `Authentication error: ${error.message}`
        });
      }
    };

    initializeAuth();
  }, []);

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);
  
  // Calculate notification count (this could come from a context or API later)
  const getNotificationCount = () => {
    // Sample data for notifications - in real app this would come from API/context
    const missingBatchSize = 8; // Number from dashboard data
    const missingFormula = 6; // Number from dashboard data
    return missingBatchSize + missingFormula;
  };
  
  // Get page title based on current route
  const getPageTitle = () => {
    const userName = authState.user?.nama || authState.user?.inisialNama || 'User';
    
    switch (location.pathname) {
      case '/':
        return `Hello, ${userName}`;
      case '/hpp-simulation':
        return 'HPP Simulation';
      case '/currency':
        return 'Currency Exchange Rates';
      case '/harga-bahan':
        return 'Ingredient Pricing Management';
      case '/biaya-lain':
        return 'General Cost Parameters';
      case '/product-group':
        return 'Product Group Management';
      case '/pembebanan':
        return 'Cost Allocation Management';
      case '/formula-assignment':
        return 'Formula Assignment Management';
      case '/product-formula':
        return 'Product Formula Management';
      case '/generate-hpp':
        return 'Generate HPP';
      case '/expiry-cost':
        return 'Expiry Cost Management';
      case '/hpp-results':
        return 'HPP Calculation Results';
      default:
        return `Hello, ${userName}`;
    }
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Show loading screen while checking authentication
  if (authState.isLoading) {
    return (
      <div className="auth-loading-screen">
        <div className="auth-loading-content">
          <div className="loading-spinner"></div>
          <h2>eSBM - Manufacturing Cost System</h2>
          <p>Checking authentication...</p>
        </div>
      </div>
    );
  }

  // Show authentication error screen
  if (!authState.isAuthenticated) {
    const isTokenExpired = authState.authError && authState.authError.includes('expired');
    
    return (
      <div className="auth-error-screen">
        <div className="auth-error-content">
          <h2>eSBM - Manufacturing Cost System</h2>
          <div className="auth-error-message">
            <h3>{isTokenExpired ? '⏰ Token Expired' : '🔒 Authentication Required'}</h3>
            <p>{authState.authError}</p>
            
            {isTokenExpired ? (
              <div className="auth-info">
                <p><strong>🚨 Token Expiration Issue:</strong></p>
                <ul>
                  <li>Your authentication token has expired</li>
                  <li>Please return to the main system and generate a fresh token</li>
                  <li>Tokens typically expire after 24 hours for security</li>
                  <li><strong>Solution:</strong> Close this tab and access the app again through the main system</li>
                </ul>
              </div>
            ) : (
              <div className="auth-info">
                <p><strong>Debug Information:</strong></p>
                <ul>
                  <li>Current URL: {window.location.href}</li>
                  <li>Supported token formats:</li>
                  <li>• Query parameter: <code>?auth=token</code></li>
                  <li>• Hash fragment: <code>#token</code></li>
                  <li>• Path suffix: <code>/token</code></li>
                  <li>Please ensure you accessed this app through the main system</li>
                </ul>
              </div>
            )}
            
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button 
                onClick={() => window.location.reload()} 
                className="auth-retry-button"
              >
                {isTokenExpired ? 'Check Again' : 'Retry Authentication'}
              </button>
              
              {isTokenExpired && (
                <button 
                  onClick={() => {
                    // Clear any stored data and redirect to a fresh start
                    clearAuthData();
                    window.location.href = window.location.origin;
                  }} 
                  className="auth-retry-button"
                  style={{ background: '#ef4444' }}
                >
                  Clear & Start Fresh
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show main app if authenticated
  return (
    <div className="app-layout">
      <Sidebar user={authState.user} />
      <TopNavbar 
        notificationCount={getNotificationCount()} 
        pageTitle={getPageTitle()} 
        currentTime={formatTime(currentTime)} 
        currentDate={formatDate(currentTime)} 
        user={authState.user} // Pass user data to navbar
      />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Dashboard user={authState.user} />} />
          <Route path="/hpp-simulation" element={<HPPSimulation user={authState.user} />} />
          <Route path="/currency" element={<Currency user={authState.user} />} />
          <Route path="/harga-bahan" element={<HargaBahan user={authState.user} />} />
          <Route path="/biaya-lain" element={<BiayaLain user={authState.user} />} />
          <Route path="/product-group" element={<ProductGroup user={authState.user} />} />
          <Route path="/pembebanan" element={<Pembebanan user={authState.user} />} />
          <Route path="/formula-assignment" element={<FormulaAssignment user={authState.user} />} />
          <Route path="/product-formula" element={<ProductFormula user={authState.user} />} />
          <Route path="/generate-hpp" element={<GenerateHPP user={authState.user} />} />
          <Route path="/expiry-cost" element={<ExpiryCost user={authState.user} />} />
          <Route path="/hpp-results" element={<HPPResults user={authState.user} />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
