import React, { useState, useEffect } from 'react';
import Camera from './Camera';
import UploadPhoto from './UploadPhoto';
import { loadModels, detectFaceAndComputeEmbedding, areModelsLoaded } from '../../utils/faceDetection';
import { supabase } from '../../config/supabase';

const Enrollement = ({ user, onEnrollmentComplete }) => {
  const [step, setStep] = useState(1);
  const [nom, setNom] = useState('');
  const [email, setEmail] = useState(user?.email || '');
  const [photo, setPhoto] = useState(null);
  const [loading, setLoading] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [error, setError] = useState('');
  const [loadingMessage, setLoadingMessage] = useState('');
  const [activeMode, setActiveMode] = useState('camera'); // 'camera' ou 'upload'

  // Chargement des modèles au montage
  useEffect(() => {
    const initModels = async () => {
      try {
        setLoadingMessage('🔄 Chargement des modèles IA...');
        console.log('🔄 Initialisation des modèles TensorFlow...');
        
        const loaded = await loadModels();
        setModelsLoaded(loaded);
        
        if (loaded) {
          setLoadingMessage('');
          console.log('✅ Modèles prêts');
        } else {
          setError('Erreur lors du chargement des modèles de reconnaissance faciale');
          setLoadingMessage('');
        }
      } catch (err) {
        console.error('❌ Erreur initialisation:', err);
        setError('Erreur initialisation IA: ' + err.message);
        setLoadingMessage('');
      }
    };

    initModels();
  }, []);

  const handlePhotoCapture = async (imageSrc) => {
    await processEnrollment(imageSrc);
  };

  const handlePhotoUpload = async (imageSrc) => {
    await processEnrollment(imageSrc);
  };

  const processEnrollment = async (imageSrc) => {
    setLoading(true);
    setError('');
    setPhoto(imageSrc);
    
    try {
      setLoadingMessage('🎭 Analyse du visage...');
      
      // Vérifier une dernière fois les modèles
      if (!areModelsLoaded()) {
        const loaded = await loadModels();
        if (!loaded) {
          throw new Error('Modèles de reconnaissance non disponibles');
        }
      }

      console.log('📸 Capture analysée...');
      const embedding = await detectFaceAndComputeEmbedding(imageSrc);
      
      setLoadingMessage('💾 Enregistrement...');
      
      // Enregistrement dans Supabase
      const { data, error } = await supabase
        .from('employes')
        .insert([
          {
            nom: nom,
            email: email,
            embedding_facial: embedding,
            photo_url: imageSrc,
            firebase_uid: user.uid,
            status: 'enrole'
          }
        ])
        .select();

      if (error) throw error;

      console.log('✅ Enrôlement réussi!');
      setStep(3);
      
    } catch (error) {
      console.error('❌ Erreur enrôlement:', error);
      setError(error.message);
      setPhoto(null);
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  };

  // Afficher les erreurs de modèles
  if (error && !loadingMessage) {
    return (
      <div className="enrollment-container error">
        <h2>❌ Erreur Configuration</h2>
        <p>{error}</p>
        
        <div className="solution-steps">
          <h4>📋 Solution :</h4>
          <ol>
            <li>Téléchargez les modèles depuis GitHub</li>
            <li>Placez-les dans <code>public/models/</code></li>
            <li>Redémarrez l'application</li>
          </ol>
          
          <p>
            <strong>Lien direct :</strong>{' '}
            <a href="https://github.com/justadudewhohacks/face-api.js/tree/master/weights" target="_blank" rel="noopener noreferrer">
              https://github.com/justadudewhohacks/face-api.js/tree/master/weights
            </a>
          </p>
        </div>
        
        <button onClick={() => window.location.reload()} className="primary-btn">
          🔄 Redémarrer
        </button>
      </div>
    );
  }

  if (step === 1) {
    return (
      <div className="enrollment-container">
        <h2>👤 Enrôlement - Étape 1</h2>
        <p>Renseignez vos informations personnelles</p>
        
        <div className="form-group">
          <label>Nom complet:</label>
          <input
            type="text"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            placeholder="Votre nom et prénom"
          />
        </div>
        
        <div className="form-group">
          <label>Email:</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="votre@email.com"
          />
        </div>
        
        <button 
          onClick={() => setStep(2)}
          className="primary-btn"
          disabled={!nom.trim() || !email.trim()}
        >
          Continuer vers la capture photo
        </button>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="enrollment-container">
        <h2>📸 Enrôlement - Étape 2</h2>
        <p>Choisissez comment capturer votre photo pour la reconnaissance faciale</p>

        {/* Sélecteur de mode */}
        <div className="mode-selector">
          <button 
            className={`mode-btn ${activeMode === 'camera' ? 'active' : ''}`}
            onClick={() => setActiveMode('camera')}
          >
            📷 Prendre une photo
          </button>
          <button 
            className={`mode-btn ${activeMode === 'upload' ? 'active' : ''}`}
            onClick={() => setActiveMode('upload')}
          >
            📁 Uploader une photo
          </button>
        </div>

        {loadingMessage ? (
          <div className="loading-models">
            <div className="spinner"></div>
            <p>{loadingMessage}</p>
          </div>
        ) : !modelsLoaded ? (
          <div className="loading-models">
            <div className="spinner"></div>
            <p>Chargement des modèles de reconnaissance...</p>
          </div>
        ) : (
          <>
            {activeMode === 'camera' ? (
              <>
                <Camera 
                  onCapture={handlePhotoCapture}
                  isCapturing={loading}
                />
                
                <div className="capture-instructions">
                  <h4>💡 Pour une meilleure reconnaissance :</h4>
                  <ul>
                    <li>✅ Bon éclairage naturel</li>
                    <li>✅ Visage bien centré</li>
                    <li>✅ Expression neutre</li>
                    <li>❌ Pas de lunettes de soleil</li>
                    <li>❌ Pas de chapeau/casquette</li>
                  </ul>
                </div>
              </>
            ) : (
              <UploadPhoto 
                onPhotoUpload={handlePhotoUpload}
                isProcessing={loading}
              />
            )}
          </>
        )}
        
        {photo && !loading && (
          <div className="photo-preview">
            <h4>Photo sélectionnée:</h4>
            <img src={photo} alt="Preview" className="preview-img" />
            <div className="photo-actions">
              <button 
                onClick={() => setPhoto(null)}
                className="secondary-btn"
              >
                📸 Changer de photo
              </button>
              <button 
                onClick={() => setStep(3)}
                className="primary-btn"
              >
                ✅ Confirmer et terminer
              </button>
            </div>
          </div>
        )}

        <div className="step-navigation">
          <button 
            onClick={() => setStep(1)}
            className="back-btn"
          >
            ↩️ Retour aux informations
          </button>
        </div>
      </div>
    );
  }

  if (step === 3) {
    return (
      <div className="enrollment-container success">
        <h2>🎉 Enrôlement Réussi !</h2>
        <p>Votre profil a été créé avec succès.</p>
        
        {photo && (
          <div className="final-photo">
            <h4>Votre photo d'enrôlement :</h4>
            <img src={photo} alt="Photo d'enrôlement" className="enrollment-photo" />
          </div>
        )}
        
        <div className="enrollment-details">
          <div className="detail-item">
            <strong>Nom:</strong> {nom}
          </div>
          <div className="detail-item">
            <strong>Email:</strong> {email}
          </div>
          <div className="detail-item">
            <strong>Date:</strong> {new Date().toLocaleDateString()}
          </div>
        </div>
        
        <p>Vous pouvez maintenant utiliser le système de pointage.</p>
        
        <button 
          onClick={onEnrollmentComplete}
          className="primary-btn"
        >
          Commencer le pointage
        </button>
      </div>
    );
  }
};

export default Enrollement;