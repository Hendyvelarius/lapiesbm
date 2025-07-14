import '../styles/TopNavbar.css';

export default function TopNavbar() {
  return (
    <header className="top-navbar">
      <nav className="navbar-menu navbar-menu-centered">
        <ul>
          <li>Master</li>
          <li>Transaction</li>
          <li>Report</li>
          <li>Help</li>
        </ul>
      </nav>
    </header>
  );
}
