import { useLocation } from 'react-router';
import { Calendar, ChevronDown, RefreshCw, CircleHelp } from 'lucide-react';
import '../styles/TopNavbar.css';

export default function TopNavbar({ 
  dashboardPeriod,
  setDashboardPeriod,
  isDashboard = false,
  ...props 
}) {
  const location = useLocation();

  const handleYearSelect = (year) => {
    if (setDashboardPeriod) {
      setDashboardPeriod(prev => ({
        ...prev,
        selectedYear: year,
        showDropdown: false
      }));
    }
  };

  const toggleDropdown = () => {
    if (setDashboardPeriod) {
      setDashboardPeriod(prev => ({
        ...prev,
        showDropdown: !prev.showDropdown
      }));
    }
  };

  const handleRefresh = (e) => {
    e.stopPropagation();
    if (setDashboardPeriod) {
      // Set refreshing flag - Dashboard will handle the actual refresh
      setDashboardPeriod(prev => ({
        ...prev,
        triggerRefresh: true
      }));
    }
  };

  const handleOpenHelp = () => {
    window.dispatchEvent(new CustomEvent('esbm:open-help', {
      detail: {
        pathname: location.pathname
      }
    }));
  };

  return (
    <header className="top-navbar">
      <div className="navbar-container">
        <div className="navbar-left-section">
          <span className="navbar-greeting">{props.pageTitle}</span>
        </div>
        <div className="navbar-right-section">
          <div className="navbar-right">
            {/* Period Selector - Only show on Dashboard */}
            {isDashboard && dashboardPeriod && dashboardPeriod.availableYears?.length > 0 && (
              <div className="navbar-periode-wrapper">
                <div 
                  className="navbar-periode-selector" 
                  onClick={toggleDropdown}
                >
                  <Calendar size={16} />
                  <span className="navbar-periode-text">
                    Periode {dashboardPeriod.selectedYear}
                  </span>
                  <ChevronDown 
                    size={14} 
                    className={`navbar-dropdown-arrow ${dashboardPeriod.showDropdown ? 'open' : ''}`} 
                  />
                  {dashboardPeriod.showDropdown && (
                    <div className="navbar-year-dropdown" onClick={(e) => e.stopPropagation()}>
                      {dashboardPeriod.availableYears.map(year => (
                        <div 
                          key={year} 
                          className={`navbar-year-option ${dashboardPeriod.selectedYear === year ? 'active' : ''}`}
                          onClick={() => handleYearSelect(year)}
                        >
                          {year}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <button 
                  className="navbar-refresh-btn" 
                  onClick={handleRefresh}
                  disabled={dashboardPeriod.refreshing}
                  title="Refresh data"
                >
                  <RefreshCw size={14} className={dashboardPeriod.refreshing ? 'spinning' : ''} />
                </button>
              </div>
            )}
            <button className="settings-btn">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </button>
            <button
              className="notifications-btn help-btn"
              onClick={handleOpenHelp}
              title="Open page help"
              aria-label="Open page help"
            >
              <CircleHelp size={22} />
            </button>
            <div className="user-profile">
              <div className="user-avatar">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              </div>
            </div>
            <div className="navbar-datetime">
              <span className="navbar-time">{props.currentTime}</span>
              <span className="navbar-date">{props.currentDate}</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
