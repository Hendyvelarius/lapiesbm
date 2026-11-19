import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Scrolling the mouse wheel over a focused number input changes its value by one `step` per notch
// (e.g. a price typed as 219.78 was saved as 219.57 after scrolling the dialog down to Save).
// Blur the input instead, so the wheel scrolls the page and the typed value is kept.
document.addEventListener('wheel', (event) => {
  const el = document.activeElement
  if (el instanceof HTMLInputElement && el.type === 'number' && el === event.target) {
    el.blur()
  }
}, { passive: true })

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
