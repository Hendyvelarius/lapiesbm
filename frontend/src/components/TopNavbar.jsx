import { useNavigate, useLocation } from 'react-router';
import '../styles/TopNavbar.css';

export default function TopNavbar({ notificationCount = 0 }) {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { 
      name: 'Master', 
      active: false,
      submenu: [
        'Formula',
        'Harga Bahan',
        'Kurs STD',
        'Yield STD',
        'Waktu Kerja STD',
        'Pembebanan',
        'Batch Size',
        'STD Parameter',
        'Product',
        'Kategori'
      ]
    },
    { 
      name: 'Transaction', 
      active: location.pathname === '/hpp-simulation',
      submenu: [
        { name: 'HPP Per Product', path: '/' },
        { name: 'HPP Simulation', path: '/hpp-simulation' }
      ]
    },
    { 
      name: 'Report', 
      active: false,
      submenu: [
        'HPP Report'
      ]
    },
  ];

  const handleDropdownClick = (subItem) => {
    if (typeof subItem === 'object' && subItem.path) {
      navigate(subItem.path);
    }
  };

  return (
    <header className="top-navbar">
      <div className="navbar-container">
        {/* Logo Section - Left Aligned */}
        <div className="navbar-logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
          <img 
            src="/LAPILOGO_Black.png" 
            alt="LAPI Logo" 
            className="lapi-logo"
          />
        </div>

        {/* Right side container for menu and buttons */}
        <div className="navbar-right-section">
          {/* Menu Items Container */}
          <div className="navbar-menu-container">
            <nav className="navbar-menu">
              {menuItems.map((item, index) => (
                <div key={index} className="menu-item-wrapper">
                  <button
                    className={`menu-item ${item.active ? 'active' : ''}`}
                  >
                    {item.name}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="dropdown-arrow">
                      <polyline points="6,9 12,15 18,9"></polyline>
                    </svg>
                  </button>
                  
                  {/* Dropdown Menu */}
                  <div className="dropdown-menu">
                    {item.submenu.map((subItem, subIndex) => (
                      <button 
                        key={subIndex} 
                        className="dropdown-item"
                        onClick={() => handleDropdownClick(subItem)}
                      >
                        {typeof subItem === 'object' ? subItem.name : subItem}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </nav>
          </div>

          {/* Individual Circular Buttons */}
          <div className="navbar-right">
            <button className="settings-btn">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </button>
            <button className="notifications-btn" onClick={() => navigate('/')}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
              {notificationCount > 0 && (
                <span className="notification-badge">{notificationCount}</span>
              )}
            </button>
            <div className="user-profile">
              <div className="user-avatar">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
