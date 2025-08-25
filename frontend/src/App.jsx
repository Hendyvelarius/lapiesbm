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
import ProductFormula from './pages/ProductFormula';
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
      case '/kurs':
        return 'Currency Exchange Rates';
      case '/harga-bahan':
        return 'Ingredient Pricing Management';
      case '/biaya-lain':
        return 'Additional Cost Parameters';
      case '/product-group':
        return 'Product Group Management';
      case '/pembebanan':
        return 'Cost Allocation Management';
      case '/productformula':
        return 'Product Formula Management';
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
        {/* Removed welcome section, now handled by TopNavbar */}
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/hpp-simulation" element={<HPPSimulation />} />
          <Route path="/kurs" element={<Currency />} />
          <Route path="/harga-bahan" element={<HargaBahan />} />
          <Route path="/biaya-lain" element={<BiayaLain />} />
          <Route path="/product-group" element={<ProductGroup />} />
          <Route path="/pembebanan" element={<Pembebanan />} />
          <Route path="/productformula" element={<ProductFormula />} />
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
