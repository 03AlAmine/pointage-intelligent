import React, { useState, useEffect } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../../config/firebase';
import './Header.css';

const Header = ({ user, currentView, onViewChange, isEnrolled, onEnrollClick }) => {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [currentTime, setCurrentTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(new Date().toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit'
      }));
    };

    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Erreur déconnexion:', error);
    }
  };

  const getCurrentDate = () => {
    return new Date().toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Définir le statut de l'utilisateur
  const status = (() => {
    if (!user) {
      return {
        color: '#ccc',
        variant: 'offline',
        icon: '⚪',
        text: 'Déconnecté'
      };
    }
    if (isEnrolled) {
      return {
        color: '#4caf50',
        variant: 'online',
        icon: '🟢',
        text: 'Enrôlé'
      };
    }
    return {
      color: '#ff9800',
      variant: 'pending',
      icon: '🟠',
      text: 'Non enrôlé'
    };
  })();



  return (
    <header className="app-header">
      <div className="header-content">
        {/* Logo et Titre */}
        <div className="header-brand">
          <div className="logo">
            <div className="logo-icon">👨‍💼</div>
            <div className="logo-text">
              <h1>WorkFlow</h1>
              <span className="tagline">Système de pointage intelligent</span>
            </div>
          </div>
        </div>

        {/* Navigation Centrale - Admin a accès à tout */}
        <nav className="header-nav">
          <button 
            className={`nav-btn ${currentView === 'pointage' ? 'active' : ''}`}
            onClick={() => onViewChange('pointage')}
          >
            <span className="nav-icon">📊</span>
            <span className="nav-text">Pointage</span>
          </button>
          
          <button 
            className={`nav-btn ${currentView === 'dashboard' ? 'active' : ''}`}
            onClick={() => onViewChange('dashboard')}
          >
            <span className="nav-icon">📈</span>
            <span className="nav-text">Dashboard</span>
          </button>
          
          <button 
            className={`nav-btn ${currentView === 'enrollment' ? 'active' : ''}`}
            onClick={() => onViewChange('enrollment')}
          >
            <span className="nav-icon">👤</span>
            <span className="nav-text">Enrôlement</span>
          </button>
        </nav>

        {/* Informations Utilisateur */}
        <div className="header-actions">
          {/* Date et Heure */}
          <div className="time-display">
            <div className="time-badge">
              <span className="time-icon">🕒</span>
              <span className="time-value">{currentTime}</span>
            </div>
            <div className="date-value">{getCurrentDate()}</div>
          </div>


          {/* Menu Admin */}
          {user && (
            <div className="user-menu">
              <button 
                className="user-trigger"
                onClick={() => setShowUserMenu(!showUserMenu)}
              >
                <div className="user-avatar">
                  <div className="avatar-fallback admin-avatar">
                    👑
                  </div>
                  <div className="status-dot" style={{ backgroundColor: status.color }}></div>
                </div>
                
                <div className="user-info">
                  <span className="user-name">
                    Admin
                  </span>
                  <span className="user-email">{user?.email}</span>
                </div>
                
                <span className={`dropdown-arrow ${showUserMenu ? 'rotated' : ''}`}>
                  ▼
                </span>
              </button>

              {showUserMenu && (
                <div className="user-panel">
                  <div className="panel-header">
                    <div className="panel-avatar">
                      <div className="panel-avatar-fallback admin-avatar">
                        👑
                      </div>
                    </div>
                    <div className="panel-user-info">
                      <h3>Administrateur</h3>
                      <p>{user?.email}</p>
                    </div>
                  </div>

                  <div className="panel-stats">
                    <div className="stat-item">
                      <span className="stat-label">Role</span>
                      <span className="stat-value stat-success">
                        👑 Administrateur
                      </span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Accès</span>
                      <span className="stat-value">
                        Système complet
                      </span>
                    </div>
                  </div>

                  <div className="panel-actions">
                    <button 
                      onClick={handleLogout}
                      className="logout-button"
                    >
                      🚪 Se déconnecter
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Overlay pour fermer le menu */}
      {showUserMenu && (
        <div 
          className="panel-overlay"
          onClick={() => setShowUserMenu(false)}
        ></div>
      )}
    </header>
  );
};

export default Header;