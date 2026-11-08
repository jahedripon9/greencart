import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { BrowserRouter } from 'react-router-dom'
import { AppContextProvider } from './context/AppContext.jsx'
import { ClerkProvider } from '@clerk/clerk-react'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
const PROXY_URL = import.meta.env.VITE_CLERK_PROXY_URL || (import.meta.env.PROD ? '/__clerk' : undefined)

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing Clerk Publishable Key: Please set VITE_CLERK_PUBLISHABLE_KEY in client/.env")
}

createRoot(document.getElementById('root')).render(
  <ClerkProvider publishableKey={PUBLISHABLE_KEY} proxyUrl={PROXY_URL}>
    <BrowserRouter>
      <AppContextProvider>
        <App />
      </AppContextProvider>
    </BrowserRouter>
  </ClerkProvider>,
)
