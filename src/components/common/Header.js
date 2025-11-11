import React, { useState, useEffect } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../../config/firebase';
import { supabase } from '../../config/supabase';
import './Header.css';

const Header = ({ user, currentView, onViewChange, isEnrolled }) => {
  const [employe, setEmploye] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Charger les informations de l'employé connecté
  useEffect(() => {
    const loadEmployeInfo = async () => {
      if (!user) return;
      
      try {
        const { data, error } = await supabase
          .from('employes')
          .select('*')
          .eq('firebase_uid', user.uid)
          .single();

        if (data) {
          setEmploye(data);
        }
      } catch (error) {
        console.log('Employé non trouvé ou non enrôlé');
      } finally {
        setLoading(false);
      }
    };

    loadEmployeInfo();
  }, [user]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Erreur déconnexion:', error);
    }
  };

  const getCurrentTime = () => {
    return new Date().toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getCurrentDate = () => {
    return new Date().toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getStatusInfo = () => {
    if (!isEnrolled) return { text: 'Non enrôlé', color: '#ff6b6b', icon: '⏳' };
    if (!employe) return { text: 'En cours...', color: '#ffa726', icon: '🔍' };
    
    return employe.embedding_facial?.length > 0 
      ? { text: 'Enrôlé', color: '#28a745', icon: '✅' }
      : { text: 'En attente', color: '#ffa726', icon: '⏳' };
  };

  const status = getStatusInfo();

  return (
    <header className="app-header">
      <div className="header-content">
        {/* Logo et Titre */}
        <div className="header-left">
          <div className="logo">
            <div className="logo-icon">🤖</div>
            <div className="logo-text">
              <h1>Pointage Intelligent</h1>
              <span className="tagline">Reconnaissance Faciale</span>
            </div>
          </div>
        </div>

        {/* Navigation Centrale */}
        {isEnrolled && (
          <nav className="header-nav">
            <button 
              className={`nav-btn ${currentView === 'pointage' ? 'active' : ''}`}
              onClick={() => onViewChange('pointage')}
            >
              <span className="nav-icon">📅</span>
              <span className="nav-text">Pointage</span>
            </button>
            
            <button 
              className={`nav-btn ${currentView === 'dashboard' ? 'active' : ''}`}
              onClick={() => onViewChange('dashboard')}
            >
              <span className="nav-icon">📊</span>
              <span className="nav-text">Dashboard</span>
            </button>
          </nav>
        )}

        {/* Informations Utilisateur */}
        <div className="header-right">
          {/* Date et Heure */}
          <div className="time-info">
            <div className="current-time">{getCurrentTime()}</div>
            <div className="current-date">{getCurrentDate()}</div>
          </div>

          {/* Statut Employé */}
          <div className="status-indicator">
            <span 
              className="status-dot"
              style={{ backgroundColor: status.color }}
            ></span>
            <span className="status-text">
              {status.icon} {status.text}
            </span>
          </div>

          {/* Menu Utilisateur */}
          <div className="user-menu-container">
            <button 
              className="user-toggle"
              onClick={() => setShowUserMenu(!showUserMenu)}
            >
              <div className="user-avatar">
                {employe?.photo_url ? (
                  <img 
                    src={employe.photo_url} 
                    alt={employe.nom}
                    className="avatar-img"
                  />
                ) : (
                  <div className="avatar-placeholder">
                    {user?.email?.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="user-details">
                <span className="user-name">
                  {employe?.nom || user?.email?.split('@')[0]}
                </span>
                <span className="user-email">{user?.email}</span>
              </div>
              <span className="dropdown-arrow">▼</span>
            </button>

            {showUserMenu && (
              <div className="user-dropdown">
                <div className="dropdown-header">
                  <strong>Compte Utilisateur</strong>
                </div>
                
                <div className="dropdown-info">
                  <div className="info-item">
                    <span className="info-label">Nom:</span>
                    <span className="info-value">
                      {employe?.nom || 'Non spécifié'}
                    </span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Email:</span>
                    <span className="info-value">{user?.email}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Status:</span>
                    <span 
                      className="info-value status-badge"
                      style={{ color: status.color }}
                    >
                      {status.icon} {status.text}
                    </span>
                  </div>
                  {employe?.date_creation && (
                    <div className="info-item">
                      <span className="info-label">Membre depuis:</span>
                      <span className="info-value">
                        {new Date(employe.date_creation).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                  )}
                </div>

                <div className="dropdown-actions">
                  <button 
                    onClick={handleLogout}
                    className="logout-btn"
                  >
                    <span className="logout-icon">🚪</span>
                    Déconnexion
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Overlay pour fermer le menu */}
      {showUserMenu && (
        <div 
          className="menu-overlay"
          onClick={() => setShowUserMenu(false)}
        ></div>
      )}
    </header>
  );
};

export default Header;