import React, { useState, useEffect } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../config/firebase';
import './Login.css';

const Login = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);

  // Écouter les changements d'authentification
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user && loginSuccess) {
        console.log('✅ Utilisateur connecté, redirection...');
        if (onLoginSuccess) {
          onLoginSuccess();
        }
      }
    });

    return () => unsubscribe();
  }, [loginSuccess, onLoginSuccess]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      if (isLogin) {
        // Connexion
        await signInWithEmailAndPassword(auth, email, password);
        console.log('✅ Connexion réussie');
        setLoginSuccess(true);
      } else {
        // Inscription
        await createUserWithEmailAndPassword(auth, email, password);
        console.log('✅ Inscription réussie');
        setLoginSuccess(true);
      }
    } catch (error) {
      alert(`Erreur: ${error.message}`);
      setLoginSuccess(false);
    } finally {
      setLoading(false);
    }
  };

  // Si la connexion a réussi, afficher un message de chargement
  if (loginSuccess) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="success-message">
            <div className="success-icon">✅</div>
            <h3>Connexion réussie !</h3>
            <p>Redirection en cours...</p>
            <div className="loading-spinner"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>{isLogin ? '🔐 Connexion' : '👤 Inscription'}</h2>
        <p>{isLogin ? 'Connectez-vous à votre compte' : 'Créez un nouveau compte'}</p>
        
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <input
              type="email"
              placeholder="Adresse email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          
          <div className="form-group">
            <input
              type="password"
              placeholder="Mot de passe"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength="6"
            />
          </div>
          
          <button 
            type="submit" 
            disabled={loading}
            className="auth-btn primary"
          >
            {loading ? '⏳ Traitement...' : (isLogin ? 'Se connecter' : "S'inscrire")}
          </button>
        </form>
        
        <div className="auth-switch">
          <button 
            onClick={() => setIsLogin(!isLogin)}
            className="switch-btn"
          >
            {isLogin ? "Pas de compte ? S'inscrire" : 'Déjà un compte ? Se connecter'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;