import './App.css'
import { MotionConfig } from 'framer-motion'
import { Suspense, useEffect, useState } from 'react'
import { BrowserRouter } from 'react-router-dom'
import AppController from './app/AppController'
import { ExpansionProvider } from './context/ExpansionContext'
import { AuthProvider } from './context/AuthContext'
import { RouteMetadata } from './components/RouteMetadata'
import { SiteFooter } from './components/SiteFooter'
import { PageLoadingSkeleton } from './components/PageLoadingSkeleton'

type PerformanceAwareNavigator = Navigator & {
  deviceMemory?: number
  connection?: { saveData?: boolean }
}

function prefersLightweightEffects() {
  if (typeof navigator === 'undefined') return false
  const performanceNavigator = navigator as PerformanceAwareNavigator
  return Boolean(
    performanceNavigator.connection?.saveData
    || (performanceNavigator.deviceMemory && performanceNavigator.deviceMemory <= 3)
    || (performanceNavigator.hardwareConcurrency && performanceNavigator.hardwareConcurrency <= 2),
  )
}

export default function App() {
  const [lightweightEffects] = useState(prefersLightweightEffects)

  useEffect(() => {
    document.documentElement.classList.toggle('performance-lite', lightweightEffects)
    return () => document.documentElement.classList.remove('performance-lite')
  }, [lightweightEffects])

  return (
    <BrowserRouter>
      <AuthProvider>
        <RouteMetadata />
        <div className="site-frame">
          <div className="site-content">
            <MotionConfig
              reducedMotion={lightweightEffects ? 'always' : 'user'}
              transition={{ duration: 0.16, ease: [0.2, 0, 0, 1] }}
            >
              <ExpansionProvider>
                <Suspense fallback={<PageLoadingSkeleton />}>
                  <AppController />
                </Suspense>
              </ExpansionProvider>
            </MotionConfig>
          </div>
          <SiteFooter />
        </div>
      </AuthProvider>
    </BrowserRouter>
  )
}
