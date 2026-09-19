import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { CullingProvider } from './ui/store'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <CullingProvider>
      <App />
    </CullingProvider>
  </React.StrictMode>,
)
