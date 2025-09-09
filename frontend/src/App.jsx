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
import './styles/App.css';

function AppContent() {
  const location = useLocation();
  const [currentTime, setCurrentTime] = useState(new Date());

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
    switch (location.pathname) {
      case '/':
        return 'Hello, Gunawan';
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
      default:
        return 'Hello, Gunawan';
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

  return (
    <div className="app-layout">
      <Sidebar />
      <TopNavbar 
        notificationCount={getNotificationCount()} 
        pageTitle={getPageTitle()} 
        currentTime={formatTime(currentTime)} 
        currentDate={formatDate(currentTime)} 
      />
      <main className="main-content">
                  <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/hpp-simulation" element={<HPPSimulation />} />
            <Route path="/currency" element={<Currency />} />
            <Route path="/harga-bahan" element={<HargaBahan />} />
            <Route path="/biaya-lain" element={<BiayaLain />} />
            <Route path="/product-group" element={<ProductGroup />} />
            <Route path="/pembebanan" element={<Pembebanan />} />
            <Route path="/formula-assignment" element={<FormulaAssignment />} />
            <Route path="/product-formula" element={<ProductFormula />} />
            <Route path="/generate-hpp" element={<GenerateHPP />} />
            <Route path="/expiry-cost" element={<ExpiryCost />} />
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
