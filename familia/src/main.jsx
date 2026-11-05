import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import App from './App.jsx'
import { markNotifRead } from './pages/Notifications.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}))
  // Toque numa notificação com o app já aberto: vai direto para a tela certa.
  navigator.serviceWorker.addEventListener('message', (e) => {
    if (e.data?.type !== 'open') return
    if (e.data.nid) markNotifRead(e.data.nid)
    if (e.data.hash) location.hash = e.data.hash
  })
}
