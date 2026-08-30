import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import './styles/tailwind.css'
import { App } from '@/App'
import { FullPage } from '@/fullpage/FullPage'
import './index.css'

const root = document.getElementById('root')
if (!root) throw new Error('#root not found')

// Only `/fullpage` is diverted; every other path renders the index page exactly
// as it did before. Vite's dev server and `vite preview` both fall back to
// index.html for unknown paths, so two pages need no router dependency.
const isFullPage = window.location.pathname.replace(/\/+$/, '') === '/fullpage'

createRoot(root).render(<StrictMode>{isFullPage ? <FullPage /> : <App />}</StrictMode>)
