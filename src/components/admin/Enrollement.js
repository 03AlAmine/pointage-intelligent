import React, { useState, useEffect, useCallback } from "react";
import Camera from "../pointage/Camera";
import UploadPhoto from "../pointage/UploadPhoto";
import {
  loadModels,
  detectFaceAndComputeEmbedding,
  areModelsLoaded,
  getLoadedModels,
} from "../../utils/faceDetection";
import { db } from "../../config/firebase";
import { collection, addDoc, query, where, getDocs } from "firebase/firestore";
import "../styles/Enrollement.css";

const Enrollement = ({ user, onEnrollmentComplete }) => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    nom: "",
    prenom: "",
    email: "",
    poste: "",
    departement: ""
  });
  const [photo, setPhoto] = useState(null);
  const [loading, setLoading] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [error, setError] = useState("");
  const [loadingMessage, setLoadingMessage] = useState("");
  const [activeMode, setActiveMode] = useState("camera");
  const [embeddingQuality, setEmbeddingQuality] = useState(null);

  // 🔥 Chargement optimisé des modèles
  useEffect(() => {
    const initModels = async () => {
      try {
        setLoadingMessage("🔄 Chargement des modèles IA...");
        
        // Vérifier d'abord si les modèles sont déjà chargés
        if (areModelsLoaded()) {
          console.log("✅ Modèles déjà chargés");
          setModelsLoaded(true);
          setLoadingMessage("");
          return;
        }

        const loaded = await loadModels();
        setModelsLoaded(loaded);

        if (loaded) {
          const loadedModels = getLoadedModels();
          console.log("📋 Modèles chargés:", loadedModels);
          setLoadingMessage("");
        } else {
          throw new Error("Échec du chargement des modèles IA");
        }
      } catch (err) {
        console.error("❌ Erreur initialisation:", err);
        setError("Erreur d'initialisation: " + err.message);
        setLoadingMessage("");
      }
    };

    initModels();
  }, []);

  // 🔥 Gestion du formulaire optimisée
  const handleInputChange = useCallback((field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    // Effacer les erreurs quand l'utilisateur tape
    if (error) setError("");
  }, [error]);

  // 🔥 Validation d'email améliorée
  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // 🔥 Validation du formulaire renforcée
  const isFormValid = useCallback(() => {
    const { nom, prenom, email } = formData;
    
    if (!nom.trim() || !prenom.trim() || !email.trim()) {
      return false;
    }

    if (!validateEmail(email)) {
      return false;
    }

    return true;
  }, [formData]);

  // 🔥 Validation de la qualité de l'embedding
  const validateEmbeddingQuality = (embedding) => {
    if (!embedding || !Array.isArray(embedding)) {
      return { isValid: false, reason: "Embedding invalide" };
    }

    // Vérifier la magnitude
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    
    if (magnitude < 0.1) {
      return { isValid: false, reason: "Qualité d'embedding trop faible" };
    }

    // Vérifier les valeurs NaN
    if (embedding.some(val => isNaN(val))) {
      return { isValid: false, reason: "Embedding corrompu" };
    }

    return { 
      isValid: true, 
      magnitude: magnitude,
      score: Math.min(100, Math.round(magnitude * 100))
    };
  };

  // 🔥 Capture de photo
  const handlePhotoCapture = async (imageSrc) => {
    await processEnrollment(imageSrc);
  };

  const handlePhotoUpload = async (imageSrc) => {
    await processEnrollment(imageSrc);
  };

  // 🔥 PROCESSUS D'ENRÔLEMENT AMÉLIORÉ
  const processEnrollment = async (imageSrc) => {
    if (!isFormValid()) {
      setError("Veuillez compléter tous les champs obligatoires");
      return;
    }

    setLoading(true);
    setError("");
    setPhoto(imageSrc);

    try {
      // Étape 1: Vérification des modèles
      setLoadingMessage("🔍 Vérification des modèles IA...");
      
      if (!areModelsLoaded()) {
        const loaded = await loadModels();
        if (!loaded) {
          throw new Error("Système de reconnaissance non disponible");
        }
      }

      // Étape 2: Détection faciale
      setLoadingMessage("🎭 Analyse du visage en cours...");
      console.log("📸 Début de l'analyse faciale...");

      const embedding = await detectFaceAndComputeEmbedding(imageSrc);
      
      // 🔥 VALIDATION DE LA QUALITÉ
      const qualityCheck = validateEmbeddingQuality(embedding);
      if (!qualityCheck.isValid) {
        throw new Error(`Qualité insuffisante: ${qualityCheck.reason}`);
      }

      setEmbeddingQuality(qualityCheck);
      console.log("✅ Embedding généré - Qualité:", qualityCheck.score);

      // Étape 3: Vérification email unique
      setLoadingMessage("📧 Vérification de l'email...");
      
      const emailQuery = query(
        collection(db, "employes"), 
        where("email", "==", formData.email.toLowerCase().trim())
      );
      const querySnapshot = await getDocs(emailQuery);

      if (!querySnapshot.empty) {
        throw new Error("Un employé avec cet email existe déjà");
      }

      // Étape 4: Enregistrement Firebase
      setLoadingMessage("💾 Enregistrement en cours...");

      const employeData = {
        // Informations de base
        nom: formData.nom.trim(),
        prenom: formData.prenom.trim(),
        nom_complet: `${formData.prenom.trim()} ${formData.nom.trim()}`,
        email: formData.email.toLowerCase().trim(),
        poste: formData.poste.trim() || null,
        departement: formData.departement || null,
        
        // Données faciales
        embedding_facial: embedding,
        photo_url: imageSrc,
        embedding_quality: qualityCheck.score,
        
        // Métadonnées
        status: "actif",
        created_at: new Date(),
        updated_at: new Date(),
        enrolled_by: user?.email || "admin",
        enrollment_date: new Date()
      };

      const docRef = await addDoc(collection(db, "employes"), employeData);

      console.log("✅ Enrôlement réussi! ID:", docRef.id);
      
      // Petit délai pour montrer le succès
      setTimeout(() => {
        setStep(3);
        setLoading(false);
        setLoadingMessage("");
      }, 1000);

    } catch (error) {
      console.error("❌ Erreur enrôlement:", error);
      setError(error.message);
      setPhoto(null);
      setEmbeddingQuality(null);
      setLoading(false);
      setLoadingMessage("");
    }
  };

  // 🔥 Réinitialisation pour un nouvel enrôlement
  const handleNewEnrollment = () => {
    setFormData({
      nom: "",
      prenom: "",
      email: "",
      poste: "",
      departement: ""
    });
    setPhoto(null);
    setError("");
    setEmbeddingQuality(null);
    setStep(1);
    setActiveMode("camera");
  };

  // 🔥 Écran d'erreur amélioré
  if (error && !loadingMessage && step !== 3) {
    return (
      <div className="enrollment-container error-state">
        <div className="error-header">
          <div className="error-icon">❌</div>
          <h2>Erreur lors de l'enrôlement</h2>
        </div>
        
        <div className="error-content">
          <p className="error-message">{error}</p>
          
          <div className="error-suggestions">
            <h4>Solutions possibles :</h4>
            <ul>
              {error.includes("email") && (
                <li>✅ Vérifiez que l'email n'existe pas déjà</li>
              )}
              {error.includes("visage") || error.includes("qualité") ? (
                <>
                  <li>✅ Assurez-vous d'une bonne luminosité</li>
                  <li>✅ Regardez droit vers la caméra</li>
                  <li>✅ Approchez-vous suffisamment</li>
                </>
              ) : (
                <li>✅ Vérifiez votre connexion internet</li>
              )}
            </ul>
          </div>
        </div>

        <div className="step-actions">
          <button 
            onClick={() => {
              setError("");
              if (photo) setStep(2);
            }} 
            className="primary-btn"
          >
            🔄 Réessayer
          </button>
          <button 
            onClick={handleNewEnrollment}
            className="secondary-btn"
          >
            ↩️ Nouvel enrôlement
          </button>
        </div>
      </div>
    );
  }

  // 🔥 ÉTAPE 1: FORMULAIRE AMÉLIORÉ
  if (step === 1) {
    return (
      <div className="enrollment-container">
        <div className="enrollment-header">
          <div className="header-icon">👤</div>
          <div className="header-content">
            <h2>Enrôlement d'un Employé</h2>
            <p>Ajoutez un nouvel employé au système de pointage intelligent</p>
          </div>
        </div>

        <div className="enrollment-form">
          <div className="form-section">
            <h3>Informations Personnelles</h3>
            
            <div className="form-row">
              <div className="form-group">
                <label>
                  Nom *
                  {formData.nom && !formData.nom.trim() && (
                    <span className="validation-error"> (Requis)</span>
                  )}
                </label>
                <input
                  type="text"
                  value={formData.nom}
                  onChange={(e) => handleInputChange('nom', e.target.value)}
                  placeholder="Nom de famille"
                  className={formData.nom && !formData.nom.trim() ? 'error' : ''}
                  required
                />
              </div>

              <div className="form-group">
                <label>
                  Prénom *
                  {formData.prenom && !formData.prenom.trim() && (
                    <span className="validation-error"> (Requis)</span>
                  )}
                </label>
                <input
                  type="text"
                  value={formData.prenom}
                  onChange={(e) => handleInputChange('prenom', e.target.value)}
                  placeholder="Prénom"
                  className={formData.prenom && !formData.prenom.trim() ? 'error' : ''}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label>
                Email professionnel *
                {formData.email && !validateEmail(formData.email) && (
                  <span className="validation-error"> (Email invalide)</span>
                )}
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                placeholder="email@entreprise.com"
                className={formData.email && !validateEmail(formData.email) ? 'error' : ''}
                required
              />
            </div>
          </div>

          <div className="form-section">
            <h3>Informations Professionnelles (Optionnel)</h3>
            
            <div className="form-row">
              <div className="form-group">
                <label>Poste</label>
                <input
                  type="text"
                  value={formData.poste}
                  onChange={(e) => handleInputChange('poste', e.target.value)}
                  placeholder="Ex: Développeur, Manager..."
                />
              </div>

              <div className="form-group">
                <label>Département</label>
                <select
                  value={formData.departement}
                  onChange={(e) => handleInputChange('departement', e.target.value)}
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
        </div>

        <div className="step-actions">
          <button
            onClick={() => {
              if (!isFormValid()) {
                setError("Veuillez corriger les erreurs dans le formulaire");
                return;
              }
              setStep(2);
            }}
            className="primary-btn large"
            disabled={!isFormValid()}
          >
            <span className="btn-icon">📸</span>
            Continuer vers la capture photo
            <span className="btn-arrow">→</span>
          </button>
        </div>

        {!modelsLoaded && (
          <div className="models-loading">
            <div className="loading-spinner small"></div>
            <span>Chargement des modèles IA...</span>
          </div>
        )}
      </div>
    );
  }

  // 🔥 ÉTAPE 2: CAPTURE PHOTO AMÉLIORÉE
  if (step === 2) {
    return (
      <div className="enrollment-container">
        <div className="enrollment-header">
          <div className="header-icon">📸</div>
          <div className="header-content">
            <h2>Capture Photo Employé</h2>
            <p>Capturez la photo pour la reconnaissance faciale</p>
          </div>
        </div>

        {/* Indicateur de chargement principal */}
        {loadingMessage && (
          <div className="processing-overlay">
            <div className="processing-content">
              <div className="processing-spinner"></div>
              <h4>{loadingMessage}</h4>
              {embeddingQuality && (
                <div className="quality-feedback">
                  Qualité d'embedding: {embeddingQuality.score}%
                </div>
              )}
            </div>
          </div>
        )}

        {/* Sélecteur de mode */}
        <div className="mode-selector">
          <button
            className={`mode-btn ${activeMode === "camera" ? "active" : ""}`}
            onClick={() => setActiveMode("camera")}
            disabled={loading}
          >
            <span className="mode-icon">📷</span>
            <div className="mode-text">
              <div className="mode-title">Prendre une photo</div>
              <div className="mode-description">Utilisez votre caméra</div>
            </div>
          </button>
          <button
            className={`mode-btn ${activeMode === "upload" ? "active" : ""}`}
            onClick={() => setActiveMode("upload")}
            disabled={loading}
          >
            <span className="mode-icon">📁</span>
            <div className="mode-text">
              <div className="mode-title">Uploader une photo</div>
              <div className="mode-description">Depuis vos fichiers</div>
            </div>
          </button>
        </div>

        {/* Section capture/upload */}
        {!modelsLoaded ? (
          <div className="loading-models">
            <div className="spinner"></div>
            <p>Chargement des modèles de reconnaissance...</p>
          </div>
        ) : (
          <>
            {activeMode === "camera" ? (
              <div className="capture-section">
                <Camera 
                  onCapture={handlePhotoCapture} 
                  isCapturing={loading}
                  showQualityFeedback={true}
                  showInstructions={false}
                />
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

        {/* Aperçu de la photo avec validation */}
        {photo && !loading && (
          <div className="photo-preview validated">
            <div className="preview-header">
              <div className="preview-status">
                <span className="status-icon">✅</span>
                <div>
                  <h4>Photo validée</h4>
                  <p>La photo est conforme pour la reconnaissance faciale</p>
                </div>
              </div>
              {embeddingQuality && (
                <div className="quality-badge">
                  Qualité: {embeddingQuality.score}%
                </div>
              )}
            </div>
            <div className="preview-content">
              <img
                src={photo}
                alt="Aperçu du visage de l'employé"
                className="preview-img"
              />
              <div className="photo-actions">
                <button
                  onClick={() => {
                    setPhoto(null);
                    setEmbeddingQuality(null);
                  }}
                  className="secondary-btn"
                >
                  <span className="btn-icon">🔄</span>
                  Reprendre la photo
                </button>
                <button 
                  onClick={() => setStep(3)} 
                  className="primary-btn"
                >
                  <span className="btn-icon">✅</span>
                  Confirmer l'enrôlement
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="step-navigation">
          <button 
            onClick={() => setStep(1)} 
            className="back-btn"
            disabled={loading}
          >
            <span className="btn-icon">↩️</span>
            Retour aux informations
          </button>
        </div>

        {/* Instructions détaillées */}
        {!photo && (
          <div className="capture-instructions">
            <h4>💡 Instructions pour une reconnaissance optimale :</h4>
            <div className="instructions-grid">
              <div className="instruction-item">
                <span className="instruction-icon positive">✅</span>
                <div className="instruction-content">
                  <strong>Bon éclairage naturel</strong>
                  <p>Face à la lumière, pas de contre-jour</p>
                </div>
              </div>
              <div className="instruction-item">
                <span className="instruction-icon positive">✅</span>
                <div className="instruction-content">
                  <strong>Visage bien centré</strong>
                  <p>Regard droit vers l'objectif</p>
                </div>
              </div>
              <div className="instruction-item">
                <span className="instruction-icon positive">✅</span>
                <div className="instruction-content">
                  <strong>Expression neutre</strong>
                  <p>Sourire léger, bouche fermée</p>
                </div>
              </div>
              <div className="instruction-item">
                <span className="instruction-icon negative">❌</span>
                <div className="instruction-content">
                  <strong>Pas d'accessoires</strong>
                  <p>Pas de lunettes de soleil, chapeau ou casquette</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 🔥 ÉTAPE 3: CONFIRMATION AMÉLIORÉE
  if (step === 3) {
    return (
      <div className="enrollment-container success">
        <div className="success-animation">
          <div className="success-icon">🎉</div>
          <div className="success-pulse"></div>
        </div>

        <div className="success-header">
          <h2>Employé Enrôlé avec Succès !</h2>
          <p className="success-message">
            L'employé a été ajouté au système de pointage intelligent.
          </p>
        </div>

        {/* Photo d'enrôlement */}
        {photo && (
          <div className="final-photo">
            <h4>Photo d'enrôlement :</h4>
            <div className="photo-container">
              <img
                src={photo}
                alt="Employé enrôlé"
                className="enrollment-photo"
              />
              {embeddingQuality && (
                <div className="embedding-quality">
                  Qualité de reconnaissance: <strong>{embeddingQuality.score}%</strong>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Détails de l'enrôlement */}
        <div className="enrollment-details">
          <h4>Détails de l'employé :</h4>
          <div className="details-grid">
            <div className="detail-item">
              <span className="detail-label">Nom complet:</span>
              <span className="detail-value">{formData.prenom} {formData.nom}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Email:</span>
              <span className="detail-value">{formData.email}</span>
            </div>
            {formData.poste && (
              <div className="detail-item">
                <span className="detail-label">Poste:</span>
                <span className="detail-value">{formData.poste}</span>
              </div>
            )}
            {formData.departement && (
              <div className="detail-item">
                <span className="detail-label">Département:</span>
                <span className="detail-value">{formData.departement}</span>
              </div>
            )}
            <div className="detail-item">
              <span className="detail-label">Date d'enrôlement:</span>
              <span className="detail-value">
                {new Date().toLocaleDateString("fr-FR", {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </span>
            </div>
          </div>
        </div>

        {/* Prochaines étapes */}
        <div className="next-steps">
          <h4>🎯 Prochaines étapes :</h4>
          <div className="steps-list">
            <div className="step-item">
              <span className="step-icon">✅</span>
              <span>L'employé peut maintenant utiliser le pointage facial</span>
            </div>
            <div className="step-item">
              <span className="step-icon">📊</span>
              <span>Ses pointages apparaîtront dans le dashboard</span>
            </div>
            <div className="step-item">
              <span className="step-icon">👤</span>
              <span>La reconnaissance faciale est opérationnelle</span>
            </div>
          </div>
        </div>

        {/* Actions finales */}
        <div className="step-actions final-actions">
          <button onClick={handleNewEnrollment} className="primary-btn large">
            <span className="btn-icon">➕</span>
            Ajouter un autre employé
          </button>
          <button
            onClick={onEnrollmentComplete}
            className="secondary-btn"
          >
            <span className="btn-icon">📊</span>
            Retour au dashboard
          </button>
        </div>
      </div>
    );
  }
};

export default Enrollement;