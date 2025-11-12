import React, { useState, useEffect } from 'react';
import Camera from '../pointage/Camera';
import UploadPhoto from '../pointage/UploadPhoto';
import { loadModels, detectFaceAndComputeEmbedding, areModelsLoaded } from '../../utils/faceDetection';
import { supabase } from '../../config/supabase';
import '../styles/Enrollement.css';

const Enrollement = ({ user, onEnrollmentComplete }) => {
  const [step, setStep] = useState(1);
  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [email, setEmail] = useState('');
  const [poste, setPoste] = useState('');
  const [departement, setDepartement] = useState('');
  const [photo, setPhoto] = useState(null);
  const [loading, setLoading] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [error, setError] = useState('');
  const [loadingMessage, setLoadingMessage] = useState('');
  const [activeMode, setActiveMode] = useState('camera');

  // Chargement des modèles
  useEffect(() => {
    const initModels = async () => {
      try {
        setLoadingMessage('🔄 Chargement des modèles IA...');
        const loaded = await loadModels();
        setModelsLoaded(loaded);
        
        if (loaded) {
          setLoadingMessage('');
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
      
      if (!areModelsLoaded()) {
        const loaded = await loadModels();
        if (!loaded) {
          throw new Error('Modèles de reconnaissance non disponibles');
        }
      }

      console.log('📸 Capture analysée...');
      const embedding = await detectFaceAndComputeEmbedding(imageSrc);
      
      setLoadingMessage('💾 Enregistrement...');
      
      // Vérifier si l'email existe déjà
      const { data: existingEmploye, error: checkError } = await supabase
        .from('employes')
        .select('id')
        .eq('email', email)
        .single();

      if (existingEmploye && !checkError) {
        throw new Error('Un employé avec cet email existe déjà');
      }

      // Enregistrement dans Supabase
      const { error } = await supabase
        .from('employes')
        .insert([
          {
            nom: nom,
            prenom: prenom,
            nom_complet: `${prenom} ${nom}`.trim(),
            email: email,
            poste: poste || null, // Devient optionnel
            departement: departement || null, // Devient optionnel
            embedding_facial: embedding,
            photo_url: imageSrc,
            status: 'enrole'
          }
        ])
        .select();

      if (error) {
        if (error.code === '23505') { // Violation de contrainte unique
          if (error.message.includes('email')) {
            throw new Error('Un employé avec cet email existe déjà');
          }
        }
        throw error;
      }

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

  const isFormValid = () => {
    return nom.trim() && 
           prenom.trim() && 
           email.trim();
    // Poste et département ne sont plus requis
  };

  // Afficher les erreurs de modèles
  if (error && !loadingMessage) {
    return (
      <div className="enrollment-container error">
        <h2>❌ Erreur</h2>
        <p>{error}</p>
      
        
        <div className="step-actions">
          <button onClick={() => setError('')} className="primary-btn">
            🔄 Réessayer
          </button>
        </div>
      </div>
    );
  }

  if (step === 1) {
    return (
      <div className="enrollment-container">
        <div className="enrollment-header">
          <h2>👤 Enrôlement d'un Employé</h2>
          <p>Ajoutez un nouvel employé au système de pointage</p>
        </div>
        
        <div className="enrollment-form">
          <div className="form-row">
            <div className="form-group">
              <label>Nom *</label>
              <input
                type="text"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                placeholder="Nom de famille"
                required
              />
            </div>
            
            <div className="form-group">
              <label>Prénom *</label>
              <input
                type="text"
                value={prenom}
                onChange={(e) => setPrenom(e.target.value)}
                placeholder="Prénom"
                required
              />
            </div>
          </div>
          
          <div className="form-group">
            <label>Email professionnel *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@entreprise.com"
              required
            />
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label>Poste (optionnel)</label>
              <input
                type="text"
                value={poste}
                onChange={(e) => setPoste(e.target.value)}
                placeholder="Ex: Développeur, Manager..."
              />
            </div>
            
            <div className="form-group">
              <label>Département (optionnel)</label>
              <select
                value={departement}
                onChange={(e) => setDepartement(e.target.value)}
              >
                <option value="">Sélectionnez un département</option>
                <option value="IT">IT - Technologies de l'Information</option>
                <option value="RH">RH - Ressources Humaines</option>
                <option value="Marketing">Marketing</option>
                <option value="Ventes">Ventes</option>
                <option value="Finance">Finance</option>
                <option value="Production">Production</option>
                <option value="Logistique">Logistique</option>
                <option value="R&D">R&D - Recherche et Développement</option>
                <option value="Direction">Direction</option>
                <option value="Autre">Autre</option>
              </select>
            </div>
          </div>
        </div>
        
        <div className="step-actions">
          <button 
            onClick={() => setStep(2)}
            className="primary-btn large"
            disabled={!isFormValid()}
          >
            📸 Continuer vers la capture photo
          </button>
        </div>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="enrollment-container">
        <div className="enrollment-header">
          <h2>📸 Capture Photo Employé</h2>
          <p>Capturez la photo de l'employé pour la reconnaissance faciale</p>
        </div>

        <div className="mode-selector">
          <button 
            className={`mode-btn ${activeMode === 'camera' ? 'active' : ''}`}
            onClick={() => setActiveMode('camera')}
          >
            <span className="mode-icon">📷</span>
            <div className="mode-text">
              <div className="mode-title">Prendre une photo</div>
              <div className="mode-description">Utilisez votre caméra</div>
            </div>
          </button>
          <button 
            className={`mode-btn ${activeMode === 'upload' ? 'active' : ''}`}
            onClick={() => setActiveMode('upload')}
          >
            <span className="mode-icon">📁</span>
            <div className="mode-text">
              <div className="mode-title">Uploader une photo</div>
              <div className="mode-description">Depuis vos fichiers</div>
            </div>
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
              <div className="capture-section">
                <Camera 
                  onCapture={handlePhotoCapture}
                  isCapturing={loading}
                />
                
                <div className="capture-instructions">
                  <h4>💡 Instructions pour l'employé :</h4>
                  <div className="instructions-grid">
                    <div className="instruction-item positive">
                      <span className="instruction-icon">✅</span>
                      <div className="instruction-content">
                        <strong>Bon éclairage naturel</strong>
                        <p>Face à la lumière, pas de contre-jour</p>
                      </div>
                    </div>
                    <div className="instruction-item positive">
                      <span className="instruction-icon">✅</span>
                      <div className="instruction-content">
                        <strong>Visage bien centré</strong>
                        <p>Regard droit vers l'objectif</p>
                      </div>
                    </div>
                    <div className="instruction-item positive">
                      <span className="instruction-icon">✅</span>
                      <div className="instruction-content">
                        <strong>Expression neutre</strong>
                        <p>Sourire léger, bouche fermée</p>
                      </div>
                    </div>
                    <div className="instruction-item negative">
                      <span className="instruction-icon">❌</span>
                      <div className="instruction-content">
                        <strong>Pas de lunettes de soleil</strong>
                        <p>Les yeux doivent être visibles</p>
                      </div>
                    </div>
                    <div className="instruction-item negative">
                      <span className="instruction-icon">❌</span>
                      <div className="instruction-content">
                        <strong>Pas de chapeau/casquette</strong>
                        <p>Visage complètement découvert</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="upload-section">
                <UploadPhoto 
                  onPhotoUpload={handlePhotoUpload}
                  isProcessing={loading}
                />
              </div>
            )}
          </>
        )}
        
        {photo && !loading && (
          <div className="photo-preview">
            <div className="preview-header">
              <h4>✅ Photo sélectionnée</h4>
              <p>Vérifiez que la photo est claire et conforme</p>
            </div>
            <div className="preview-content">
              <img src={photo} alt="Aperçu du visage de l'employé" className="preview-img" />
              <div className="photo-actions">
                <button 
                  onClick={() => setPhoto(null)}
                  className="secondary-btn"
                >
                  <span className="btn-icon">🔄</span>
                  Changer de photo
                </button>
                <button 
                  onClick={() => setStep(3)}
                  className="primary-btn"
                >
                  <span className="btn-icon">✅</span>
                  Confirmer et terminer
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="step-navigation">
          <button 
            onClick={() => setStep(1)}
            className="back-btn"
          >
            <span className="btn-icon">↩️</span>
            Retour aux informations
          </button>
        </div>
      </div>
    );
  }

  if (step === 3) {
    return (
      <div className="enrollment-container success">
        <div className="success-animation">
          <div className="success-icon">🎉</div>
        </div>
        
        <h2>Employé Enrôlé avec Succès !</h2>
        <p className="success-message">L'employé a été ajouté au système de pointage.</p>
        
        {photo && (
          <div className="final-photo">
            <h4>Photo d'enrôlement :</h4>
            <img src={photo} alt="Employé enrôlé" className="enrollment-photo" />
          </div>
        )}
        
        <div className="enrollment-details">
          <div className="detail-item">
            <strong>Nom complet:</strong> 
            <span>{prenom} {nom}</span>
          </div>
          <div className="detail-item">
            <strong>Email:</strong> 
            <span>{email}</span>
          </div>
          {poste && (
            <div className="detail-item">
              <strong>Poste:</strong> 
              <span>{poste}</span>
            </div>
          )}
          {departement && (
            <div className="detail-item">
              <strong>Département:</strong> 
              <span>{departement}</span>
            </div>
          )}
          <div className="detail-item">
            <strong>Date d'enrôlement:</strong> 
            <span>{new Date().toLocaleDateString('fr-FR')}</span>
          </div>
        </div>
        
        <div className="next-steps">
          <h4>Prochaines étapes :</h4>
          <ul>
            <li>✅ L'employé peut maintenant pointer</li>
            <li>📊 Ses pointages apparaîtront dans le dashboard</li>
            <li>👤 La reconnaissance faciale est configurée</li>
          </ul>
        </div>
        
        <div className="step-actions">
          <button 
            onClick={onEnrollmentComplete}
            className="primary-btn large"
          >
            ➕ Ajouter un autre employé
          </button>
          <button 
            onClick={() => window.location.reload()}
            className="secondary-btn"
          >
            📊 Voir le dashboard
          </button>
        </div>
      </div>
    );
  }
};

export default Enrollement;