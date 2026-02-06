import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router';
import { useState, useEffect } from 'react';
import TopNavbar from './components/TopNavbar';
import Sidebar from './components/Sidebar';
import LoadingSpinner from './components/LoadingSpinner';
import Dashboard from './pages/Dashboard';
import HPPSimulation from './pages/HPPSimulation';
import Currency from './pages/Currency';
import HargaBahan from './pages/HargaBahan';
import CostManagement from './pages/CostManagement';
import FormulaAssignment from './pages/FormulaAssignment';
import ProductFormula from './pages/ProductFormula';
import GenerateHPP from './pages/GenerateHPP';
import HPPResults from './pages/HPPResults';
import HPPActualList from './pages/HPPActualList';
import LandingPage from './pages/LandingPage';
import { 
  authenticateFromURL, 
  storeAuthData, 
  getStoredAuthData, 
  getCurrentUser, 
  isAuthenticated, 
  clearAuthData,
  cleanAuthFromURL,
  getAccessLevel 
} from './utils/auth';
import './styles/App.css';

// Component for restricted pages (shown to limited access users)
function RestrictedPage({ pageName }) {
  return (
    <div className="restricted-page">
      <div className="restricted-content">
        <h2>🔒 Access Restricted</h2>
        <p>You do not have permission to access <strong>{pageName}</strong>.</p>
        <p>Your account has limited access to this application.</p>
        <div className="restricted-info">
          <p><strong>Available pages for your access level:</strong></p>
          <ul>
            <li>Home (Landing Page)</li>
            <li>HPP Simulation</li>
          </ul>
        </div>
        <p style={{ marginTop: '20px', color: '#6b7280' }}>
          If you need access to additional features, please contact your administrator.
        </p>
      </div>
    </div>
  );
}

function AppContent() {
  const location = useLocation();
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Dashboard period state (lifted up for navbar access)
  const [dashboardPeriod, setDashboardPeriod] = useState({
    selectedYear: null,
    availableYears: [],
    showDropdown: false,
    refreshing: false
  });
  
  // Authentication state
  const [authState, setAuthState] = useState({
    isLoading: true,
    isAuthenticated: false,
    user: null,
    accessLevel: null,
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
            accessLevel: urlAuthResult.accessLevel,
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
              accessLevel: storedAuth.accessLevel,
              authError: null
            });
          } else {
            // No valid authentication found
            clearAuthData(); // Clean up any invalid stored data
            setAuthState({
              isLoading: false,
              isAuthenticated: false,
              user: null,
              accessLevel: null,
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
          accessLevel: null,
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
      case '/eSistemBiayaManufaktur':
      case '/eSistemBiayaManufaktur/':
        return `Welcome, ${userName}`;
      case '/dashboard':
        return 'Dashboard';
      case '/hpp-simulation':
        return 'HPP Simulation';
      case '/currency':
        return 'Currency Exchange Rates';
      case '/harga-bahan':
        return 'Ingredient Pricing Management';
      case '/cost-management':
        return 'Cost Management';
      case '/formula-assignment':
        return 'Formula Assignment Management';
      case '/product-formula':
        return 'Product Formula Management';
      case '/generate-hpp':
        return 'Generate HPP';
      case '/hpp-results':
        return 'HPP Standard Results';
      case '/hpp-actual':
        return 'HPP Actual Results';
      default:
        return `Welcome, ${userName}`;
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
          <LoadingSpinner size="large" showMessage={false} />
          <h2>eSBM - Manufacturing Cost System</h2>
          <p>Checking authentication...</p>
        </div>
      </div>
    );
  }

  // Show authentication error screen
  if (!authState.isAuthenticated) {
    const isTokenExpired = authState.authError && authState.authError.includes('expired');
    const isDepartmentRestricted = authState.authError && authState.authError.includes('Access denied');
    
    return (
      <div className="auth-error-screen">
        <div className="auth-error-content">
          <h2>eSBM - Manufacturing Cost System</h2>
          <div className="auth-error-message">
            <h3>
              {isTokenExpired ? '⏰ Token Expired' : 
               isDepartmentRestricted ? '� Access Denied' : 
               '�🔒 Authentication Required'}
            </h3>
            <p>{authState.authError}</p>
            
            {isDepartmentRestricted ? (
              <div className="auth-info">
                <p><strong>🚫 Department Access Restriction:</strong></p>
                <ul>
                  <li>This application is restricted to authorized personnel only</li>
                  <li><strong>Full Access:</strong> PL department staff, authorized NT users</li>
                  <li><strong>Limited Access:</strong> RD1/RD2/RD3 Managers, HD HO</li>
                  <li>Your current department/job level combination does not have access</li>
                  <li>If you believe this is an error, please contact your system administrator</li>
                </ul>
                <div style={{ marginTop: '15px', padding: '10px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '4px' }}>
                  <p style={{ margin: 0, color: '#dc2626', fontWeight: 'bold' }}>
                    ⚠️ Access is limited to authorized personnel only
                  </p>
                </div>
              </div>
            ) : isTokenExpired ? (
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
              {!isDepartmentRestricted && (
                <button 
                  onClick={() => window.location.reload()} 
                  className="auth-retry-button"
                >
                  {isTokenExpired ? 'Check Again' : 'Retry Authentication'}
                </button>
              )}
              
              {isDepartmentRestricted && (
                <button 
                  onClick={() => {
                    // Clear data and close tab for department restrictions
                    clearAuthData();
                    window.close();
                  }} 
                  className="auth-retry-button"
                  style={{ background: '#ef4444' }}
                >
                  Close Application
                </button>
              )}
              
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
      <Sidebar user={authState.user} accessLevel={authState.accessLevel} />
      <TopNavbar 
        notificationCount={getNotificationCount()} 
        pageTitle={getPageTitle()} 
        currentTime={formatTime(currentTime)} 
        currentDate={formatDate(currentTime)} 
        user={authState.user}
        // Dashboard period props
        dashboardPeriod={dashboardPeriod}
        setDashboardPeriod={setDashboardPeriod}
        isDashboard={location.pathname === '/dashboard'}
      />
      <main className="main-content">
        <Routes>
          <Route path="/" element={
            <LandingPage 
              user={authState.user} 
              accessLevel={authState.accessLevel}
            />
          } />
          <Route path="/dashboard" element={
            authState.accessLevel === 'full' 
              ? <Dashboard 
                  user={authState.user} 
                  dashboardPeriod={dashboardPeriod}
                  setDashboardPeriod={setDashboardPeriod}
                />
              : <RestrictedPage pageName="Dashboard" />
          } />
          <Route path="/hpp-simulation" element={<HPPSimulation user={authState.user} />} />
          {/* Routes below are only accessible to users with full access */}
          <Route path="/currency" element={
            authState.accessLevel === 'full' 
              ? <Currency user={authState.user} /> 
              : <RestrictedPage pageName="Exchange Rates" />
          } />
          <Route path="/harga-bahan" element={
            authState.accessLevel === 'full' 
              ? <HargaBahan user={authState.user} /> 
              : <RestrictedPage pageName="Material Prices" />
          } />
          <Route path="/cost-management" element={
            authState.accessLevel === 'full' 
              ? <CostManagement user={authState.user} /> 
              : <RestrictedPage pageName="Cost Management" />
          } />
          <Route path="/formula-assignment" element={
            authState.accessLevel === 'full' 
              ? <FormulaAssignment user={authState.user} /> 
              : <RestrictedPage pageName="Formula Assignment" />
          } />
          <Route path="/product-formula" element={
            authState.accessLevel === 'full' 
              ? <ProductFormula user={authState.user} /> 
              : <RestrictedPage pageName="Product Formula" />
          } />
          <Route path="/generate-hpp" element={
            authState.accessLevel === 'full' 
              ? <GenerateHPP user={authState.user} /> 
              : <RestrictedPage pageName="Generate HPP" />
          } />
          <Route path="/hpp-results" element={
            authState.accessLevel === 'full' 
              ? <HPPResults user={authState.user} /> 
              : <RestrictedPage pageName="HPP Results" />
          } />
          <Route path="/hpp-actual" element={
            authState.accessLevel === 'full' 
              ? <HPPActualList user={authState.user} /> 
              : <RestrictedPage pageName="HPP Actual Results" />
          } />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <Router basename="/eSistemBiayaManufaktur">
      <AppContent />
    </Router>
  );
}

export default App;
