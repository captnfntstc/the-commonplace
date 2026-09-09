import './App.css'
import { BrowserRouter } from 'react-router-dom'
import AppController from './app/AppController'
import { ExpansionProvider } from './context/ExpansionContext'
import { AuthProvider } from './context/AuthContext'
import { RouteMetadata } from './components/RouteMetadata'
import { SiteFooter } from './components/SiteFooter'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <RouteMetadata />
        <div className="site-frame">
          <div className="site-content">
            <ExpansionProvider>
              <AppController />
            </ExpansionProvider>
          </div>
          <SiteFooter />
        </div>
      </AuthProvider>
    </BrowserRouter>
  )
}
