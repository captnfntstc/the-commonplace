import './App.css'
import { BrowserRouter } from 'react-router-dom'
import AppController from './app/AppController'
import { ExpansionProvider } from './context/ExpansionContext'

export default function App() {
  return (
    <BrowserRouter>
      <ExpansionProvider>
        <AppController />
      </ExpansionProvider>
    </BrowserRouter>
  )
}
