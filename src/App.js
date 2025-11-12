import React, { useState, useEffect } from 'react'
import { auth } from './config/firebase'
import { onAuthStateChanged } from 'firebase/auth'
import Login from './components/auth/Login'
import Enrollement from './components/admin/Enrollement'
import Pointage from './components/pointage/Pointage'
import Dashboard from './components/admin/Dashboard'
import Header from './components/common/Header'
import './App.css'

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [currentView, setCurrentView] = useState('pointage')

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('🔄 État authentification:', user ? `Admin: ${user.email}` : 'Déconnecté')
      
      if (user) {
        setUser(user)
        // L'admin est toujours considéré comme "enrôlé" car il gère le système
        console.log('✅ Admin connecté, accès complet au système')
      } else {
        setUser(null)
      }
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Chargement...</p>
      </div>
    )
  }

  if (!user) {
    return <Login />
  }

  return (
    <div className="App">
      <Header 
        user={user} 
        currentView={currentView}
        onViewChange={setCurrentView}
        isEnrolled={true} // L'admin est toujours considéré comme enrôlé
      />      

      <main className="main-content">
        {/* L'admin a accès à toutes les pages sans vérification d'enrôlement */}
        {currentView === 'pointage' && <Pointage user={user} />}
        {currentView === 'dashboard' && <Dashboard user={user} />}
        {currentView === 'enrollment' && (
          <Enrollement 
            user={user} 
            onEnrollmentComplete={() => setCurrentView('pointage')} 
          />
        )}
      </main>
    </div>
  )
}

export default App