import './App.css'
import { BrowserRouter } from 'react-router-dom'
import AppController from './app/AppController'
import { ExpansionProvider } from './context/ExpansionContext'
import { AuthProvider } from './context/AuthContext'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ExpansionProvider>
          <AppController />
        </ExpansionProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

