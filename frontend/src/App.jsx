
import Sidebar from './components/Sidebar';
import TopNavbar from './components/TopNavbar';
import InputHPP from './pages/InputHPP';
import './styles/App.css';

function App() {
  return (
    <div className="app-layout">
      <Sidebar />
      <TopNavbar />
      <main className="main-content">
        <InputHPP />
      </main>
    </div>
  );
}

export default App;
