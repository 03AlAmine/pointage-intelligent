import React, { useState, useEffect } from 'react'
import { auth } from './config/firebase'
import { onAuthStateChanged } from 'firebase/auth'
import Login from './components/auth/Login'
import Enrollement from './components/pointage/Enrollement'
import Pointage from './components/pointage/Pointage'
import Dashboard from './components/pointage/Dashboard'
import Header from './components/common/Header'
import { supabase } from './config/supabase'
import './App.css'

function App() {
  const [user, setUser] = useState(null)
  const [isEnrolled, setIsEnrolled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [currentView, setCurrentView] = useState('pointage') // 'pointage' ou 'dashboard'

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user)
        await checkEnrollment(user.uid)
      } else {
        setUser(null)
        setIsEnrolled(false)
      }
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const checkEnrollment = async (firebaseUid) => {
    try {
      const { data, error } = await supabase
        .from('employes')
        .select('*')
        .eq('firebase_uid', firebaseUid)
        .single()

      if (data) {
        setIsEnrolled(true)
      } else {
        setIsEnrolled(false)
      }
    } catch (error) {
      console.log('Utilisateur non enrôlé')
      setIsEnrolled(false)
    }
  }

  if (loading) return <div className="loading">Chargement...</div>

  if (!user) return <Login />
  

  return (
    <div className="App">
<Header 
  user={user} 
  currentView={currentView}
  onViewChange={setCurrentView}
  isEnrolled={isEnrolled}
/>      

      
<main className="main-content">
  {!isEnrolled ? (
    <Enrollement 
      user={user} 
      onEnrollmentComplete={() => setIsEnrolled(true)} 
    />
  ) : (
    <>
      {currentView === 'pointage' && <Pointage user={user} />}
      {currentView === 'dashboard' && <Dashboard />}
    </>
  )}
</main>
    </div>
  )
}

export default App