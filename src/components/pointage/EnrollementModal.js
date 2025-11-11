import React, { useState } from 'react';
import Camera from './Camera';
import UploadPhoto from './UploadPhoto';
import { detectFaceAndComputeEmbedding } from '../../utils/faceDetection';
import { supabase } from '../../config/supabase';
import './styles/EnrollementModal.css';

const EnrollementModal = ({ employe, onSuccess, onClose }) => {
  const [step, setStep] = useState(1);
  const [photo, setPhoto] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeMode, setActiveMode] = useState('camera'); // 'camera' ou 'upload'

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
      console.log('🎭 Analyse du visage pour', employe.nom);
      const embedding = await detectFaceAndComputeEmbedding(imageSrc);
      
      console.log('💾 Mise à jour de l\'employé...');
      const { error } = await supabase
        .from('employes')
        .update({
          embedding_facial: embedding,
          photo_url: imageSrc,
          status: 'enrole'
        })
        .eq('id', employe.id);

      if (error) throw error;

      console.log('✅ Enrôlement réussi pour', employe.nom);
      setStep(3);
      
    } catch (error) {
      console.error('❌ Erreur enrôlement:', error);
      setError(error.message);
      setPhoto(null);
    } finally {
      setLoading(false);
    }
  };

  const getStepTitle = () => {
    switch(step) {
      case 1: return "Instructions d'Enrôlement";
      case 2: return "Capture Photo";
      case 3: return "Enrôlement Réussi";
      default: return "Enrôlement";
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content enrollement-modal">
        <div className="modal-header">
          <h2>📸 {getStepTitle()}</h2>
          <button onClick={onClose} className="close-btn">×</button>
        </div>

        <div className="modal-body">
          {/* Étape 1: Instructions */}
          {step === 1 && (
            <div className="enrollement-step instructions-step">
              <div className="employe-info-card">
                <h3>Employé: {employe.nom}</h3>
                <p>Email: {employe.email}</p>
                {employe.embedding_facial?.length > 0 && (
                  <div className="warning-badge">
                    ⚠️ Cet employé est déjà enrôlé. Cette action écrasera l'ancienne photo.
                  </div>
                )}
              </div>
              
              <div className="instructions-list">
                <h4>📋 Préparer l'enrôlement :</h4>
                <div className="instruction-item">
                  <span className="instruction-icon">💡</span>
                  <div className="instruction-text">
                    <strong>Bon éclairage</strong>
                    <p>Photo bien éclairée, face à la lumière naturelle</p>
                  </div>
                </div>
                <div className="instruction-item">
                  <span className="instruction-icon">🎯</span>
                  <div className="instruction-text">
                    <strong>Position du visage</strong>
                    <p>Visage centré, regard droit vers l'objectif</p>
                  </div>
                </div>
                <div className="instruction-item">
                  <span className="instruction-icon">😐</span>
                  <div className="instruction-text">
                    <strong>Expression neutre</strong>
                    <p>Expression naturelle, bouche fermée</p>
                  </div>
                </div>
                <div className="instruction-item">
                  <span className="instruction-icon">🚫</span>
                  <div className="instruction-text">
                    <strong>À éviter</strong>
                    <p>Pas de lunettes de soleil, casquette ou accessoires cachant le visage</p>
                  </div>
                </div>
              </div>

              <div className="step-actions">
                <button onClick={() => setStep(2)} className="primary-btn large">
                  📸 Commencer la Capture
                </button>
                <button onClick={onClose} className="secondary-btn">
                  ❌ Annuler
                </button>
              </div>
            </div>
          )}

          {/* Étape 2: Capture */}
          {step === 2 && (
            <div className="enrollement-step capture-step">
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

              {activeMode === 'camera' ? (
                <Camera 
                  onCapture={handlePhotoCapture}
                  isCapturing={loading}
                />
              ) : (
                <UploadPhoto 
                  onPhotoUpload={handlePhotoUpload}
                  isProcessing={loading}
                />
              )}

              {photo && !loading && (
                <div className="photo-review">
                  <h4>Photo sélectionnée :</h4>
                  <div className="photo-container">
                    <img src={photo} alt="Capture" className="capture-preview" />
                    <div className="photo-actions">
                      <button 
                        onClick={() => setPhoto(null)}
                        className="secondary-btn"
                      >
                        🔁 Changer de photo
                      </button>
                      <button 
                        onClick={() => processEnrollment(photo)}
                        className="primary-btn"
                      >
                        ✅ Utiliser cette photo
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div className="error-message">
                  ❌ {error}
                </div>
              )}

              <div className="step-actions">
                <button onClick={() => setStep(1)} className="secondary-btn">
                  ↩️ Retour
                </button>
              </div>
            </div>
          )}

          {/* Étape 3: Confirmation */}
          {step === 3 && (
            <div className="enrollement-step success-step">
              <div className="success-animation">
                <div className="checkmark">✓</div>
              </div>
              
              <h3>🎉 Enrôlement Réussi !</h3>
              
              <div className="success-details">
                <div className="detail-item">
                  <strong>Employé :</strong>
                  <span>{employe.nom}</span>
                </div>
                <div className="detail-item">
                  <strong>Email :</strong>
                  <span>{employe.email}</span>
                </div>
                <div className="detail-item">
                  <strong>Status :</strong>
                  <span className="status-badge enrolled">✅ Enrôlé</span>
                </div>
                <div className="detail-item">
                  <strong>Date :</strong>
                  <span>{new Date().toLocaleDateString()}</span>
                </div>
              </div>

              {photo && (
                <div className="final-photo">
                  <h4>Photo d'enrôlement :</h4>
                  <img src={photo} alt="Enrôlement" className="enrollement-photo" />
                </div>
              )}

              <div className="step-actions">
                <button onClick={onSuccess} className="primary-btn large">
                  ✅ Terminer
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EnrollementModal;