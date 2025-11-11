import React, { useState, useEffect, useRef } from 'react';
import Webcam from 'react-webcam';
import UploadPhoto from './UploadPhoto';
import { detectFaceAndComputeEmbedding, computeSimilarity, loadModels, areModelsLoaded } from '../../utils/faceDetection';
import { supabase } from '../../config/supabase';

const Pointage = ({ user }) => {
  const webcamRef = useRef(null);
  const [isScanning, setIsScanning] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [employe, setEmploye] = useState(null);
  const [autoCapture, setAutoCapture] = useState(true);
  const [modelsReady, setModelsReady] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [employesCount, setEmployesCount] = useState(0);
  const [activeMode, setActiveMode] = useState('camera'); // 'camera' ou 'upload'
  const intervalRef = useRef(null);

  // Charger les modèles et vérifier les employés
  useEffect(() => {
    const initializeSystem = async () => {
      try {
        console.log('🔄 Initialisation du système...');
        
        const modelsLoaded = await loadModels();
        setModelsReady(modelsLoaded);
        
        if (modelsLoaded) {
          await checkEmployesEnroles();
        }
        
      } catch (error) {
        console.error('❌ Erreur initialisation:', error);
        setLastResult({
          type: 'error',
          message: 'Erreur initialisation système'
        });
      }
    };

    initializeSystem();
  }, []);

  // Vérifier les employés enrôlés
  const checkEmployesEnroles = async () => {
    try {
      const { data, error } = await supabase
        .from('employes')
        .select('id')
        .not('embedding_facial', 'is', null)
        .not('embedding_facial', 'eq', '[]');

      if (error) throw error;
      
      setEmployesCount(data?.length || 0);
      
      if (data?.length === 0) {
        setLastResult({
          type: 'warning',
          message: 'Aucun employé enrôlé. Veuillez enrôler des employés d\'abord.'
        });
      }
    } catch (error) {
      console.error('Erreur vérification employés:', error);
    }
  };

  // Gestion du scan automatique (uniquement pour la caméra)
  const startAutoScan = () => {
    if (intervalRef.current || !modelsReady || !cameraReady || employesCount === 0 || activeMode !== 'camera') return;
    
    intervalRef.current = setInterval(async () => {
      if (!isScanning && webcamRef.current) {
        await captureAndRecognize();
      }
    }, 3000);
  };

  const stopAutoScan = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  useEffect(() => {
    if (autoCapture && modelsReady && cameraReady && employesCount > 0 && activeMode === 'camera') {
      startAutoScan();
    } else {
      stopAutoScan();
    }

    return () => stopAutoScan();
  }, [autoCapture, isScanning, modelsReady, cameraReady, employesCount, activeMode]);

  // Fonction principale de reconnaissance
  const processFaceRecognition = async (imageSrc) => {
    if (!modelsReady) {
      throw new Error('Modèles de reconnaissance non chargés');
    }

    if (employesCount === 0) {
      throw new Error('Aucun employé enrôlé dans le système');
    }

    console.log('🎭 Calcul de l\'embedding facial...');
    const currentEmbedding = await detectFaceAndComputeEmbedding(imageSrc);

    // Récupérer tous les employés enrôlés
    const { data: employes, error } = await supabase
      .from('employes')
      .select('id, nom, email, embedding_facial')
      .not('embedding_facial', 'is', null)
      .not('embedding_facial', 'eq', '[]');

    if (error) throw new Error('Erreur de connexion à la base de données');
    if (!employes || employes.length === 0) throw new Error('Aucun employé enrôlé');

    console.log(`🔍 Recherche parmi ${employes.length} employés...`);

    // Trouver la meilleure correspondance
    let bestMatch = null;
    let bestSimilarity = 0;
    const similarityThreshold = 0.6;

    for (const emp of employes) {
      if (!emp.embedding_facial || !Array.isArray(emp.embedding_facial)) continue;

      try {
        const similarity = computeSimilarity(currentEmbedding, emp.embedding_facial);
        
        if (similarity > bestSimilarity && similarity > similarityThreshold) {
          bestSimilarity = similarity;
          bestMatch = emp;
        }
      } catch (calcError) {
        console.warn('Erreur calcul similarité:', calcError);
      }
    }

    if (!bestMatch) {
      throw new Error('Aucun employé reconnu sur cette photo');
    }

    return { bestMatch, bestSimilarity, imageSrc };
  };

  // Capture depuis la caméra
  const captureAndRecognize = async () => {
    if (!webcamRef.current || isScanning || !modelsReady || !cameraReady) return;

    setIsScanning(true);
    setLastResult(null);
    
    try {
      console.log('📸 Capture depuis la caméra...');
      const imageSrc = webcamRef.current.getScreenshot();
      if (!imageSrc) throw new Error('Impossible de capturer l\'image');

      const { bestMatch, bestSimilarity, imageSrc: capturedImage } = await processFaceRecognition(imageSrc);
      
      console.log(`✅ ${bestMatch.nom} reconnu (${(bestSimilarity * 100).toFixed(1)}%)`);
      await enregistrerPointage(bestMatch, bestSimilarity, capturedImage);
      setEmploye(bestMatch);
      setLastResult({
        type: 'success',
        message: `✅ ${bestMatch.nom} reconnu!`,
        similarity: bestSimilarity
      });

      setTimeout(() => {
        setLastResult(null);
        setEmploye(null);
      }, 5000);

    } catch (error) {
      console.error('❌ Erreur reconnaissance:', error);
      setLastResult({
        type: 'error',
        message: error.message
      });
    } finally {
      setIsScanning(false);
    }
  };

  // Upload depuis un fichier
  const handlePhotoUpload = async (imageSrc) => {
    if (isScanning) return;

    setIsScanning(true);
    setLastResult(null);
    
    try {
      console.log('📁 Analyse de la photo uploadée...');
      
      const { bestMatch, bestSimilarity, imageSrc: uploadedImage } = await processFaceRecognition(imageSrc);
      
      console.log(`✅ ${bestMatch.nom} reconnu (${(bestSimilarity * 100).toFixed(1)}%)`);
      await enregistrerPointage(bestMatch, bestSimilarity, uploadedImage);
      setEmploye(bestMatch);
      setLastResult({
        type: 'success',
        message: `✅ ${bestMatch.nom} reconnu!`,
        similarity: bestSimilarity
      });

      setTimeout(() => {
        setLastResult(null);
        setEmploye(null);
      }, 5000);

    } catch (error) {
      console.error('❌ Erreur reconnaissance:', error);
      setLastResult({
        type: 'error',
        message: error.message
      });
    } finally {
      setIsScanning(false);
    }
  };

  const enregistrerPointage = async (employe, confidence, photoCapture) => {
    try {
      const { data: derniersPointages } = await supabase
        .from('pointages')
        .select('*')
        .eq('employe_id', employe.id)
        .order('timestamp', { ascending: false })
        .limit(1);

      const dernierPointage = derniersPointages?.[0];
      const type = dernierPointage?.type === 'entrée' ? 'sortie' : 'entrée';

      const { error } = await supabase
        .from('pointages')
        .insert([
          {
            employe_id: employe.id,
            type: type,
            photo_capture_url: photoCapture,
            confidence: parseFloat(confidence.toFixed(4))
          }
        ]);

      if (error) throw error;

      console.log(`📝 Pointage ${type} enregistré pour ${employe.nom}`);

    } catch (error) {
      console.error('❌ Erreur enregistrement:', error);
      throw error;
    }
  };

  const handleManualCapture = async () => {
    if (!modelsReady || !cameraReady || employesCount === 0) {
      setLastResult({
        type: 'error',
        message: 'Système non prêt pour la reconnaissance'
      });
      return;
    }
    await captureAndRecognize();
  };

  const handleCameraReady = () => {
    console.log('✅ Caméra prête');
    setCameraReady(true);
  };

  const handleCameraError = (error) => {
    console.error('❌ Erreur caméra:', error);
    setCameraReady(false);
  };

  const videoConstraints = {
    width: 640,
    height: 480,
    facingMode: "user"
  };

  return (
    <div className="pointage-container">
      <div className="pointage-header">
        <h1>📅 Pointage Automatique</h1>
        <p>Reconnaissance faciale par caméra ou upload de photo</p>
      </div>

      {/* Sélecteur de mode */}
      <div className="mode-selector">
        <button 
          className={`mode-btn ${activeMode === 'camera' ? 'active' : ''}`}
          onClick={() => setActiveMode('camera')}
        >
          📷 Mode Caméra
        </button>
        <button 
          className={`mode-btn ${activeMode === 'upload' ? 'active' : ''}`}
          onClick={() => setActiveMode('upload')}
        >
          📁 Upload Photo
        </button>
      </div>

      {/* Statut du système */}
      <div className="system-status">
        <div className={`status-item ${modelsReady ? 'ready' : 'loading'}`}>
          <span className="status-icon">{modelsReady ? '✅' : '⏳'}</span>
          <span>Modèles IA: {modelsReady ? 'Prêts' : 'Chargement...'}</span>
        </div>
        
        <div className={`status-item ${employesCount > 0 ? 'ready' : 'warning'}`}>
          <span className="status-icon">{employesCount > 0 ? '✅' : '⚠️'}</span>
          <span>Employés: {employesCount} enrôlé(s)</span>
        </div>
        
        {activeMode === 'camera' && (
          <div className={`status-item ${cameraReady ? 'ready' : 'loading'}`}>
            <span className="status-icon">{cameraReady ? '✅' : '⏳'}</span>
            <span>Caméra: {cameraReady ? 'Active' : 'Initialisation...'}</span>
          </div>
        )}
      </div>

      {/* Contenu selon le mode */}
      {activeMode === 'camera' ? (
        <>
          {/* Section Caméra */}
          <div className="camera-section">
            <div className="camera-wrapper">
              <Webcam
                audio={false}
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                videoConstraints={videoConstraints}
                className="webcam-live"
                mirrored={true}
                onUserMedia={handleCameraReady}
                onUserMediaError={handleCameraError}
              />
              
              <div className="camera-overlay">
                {!cameraReady && (
                  <div className="overlay-message">
                    <div className="spinner"></div>
                    <p>Initialisation de la caméra...</p>
                  </div>
                )}
                
                {cameraReady && isScanning && (
                  <div className="overlay-message scanning">
                    <div className="pulse-animation"></div>
                    <p>Analyse en cours...</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Contrôles caméra */}
          <div className="controls-section">
            <div className="auto-capture-toggle">
              <label className="toggle-label">
                <input
                  type="checkbox"
                  checked={autoCapture}
                  onChange={(e) => setAutoCapture(e.target.checked)}
                  disabled={!modelsReady || !cameraReady || employesCount === 0}
                />
                <span className="toggle-slider"></span>
                Scan automatique
              </label>
              <span className="help-text">
                {autoCapture ? '(Détection toutes les 3 secondes)' : '(Mode manuel)'}
              </span>
            </div>

            <div className="manual-controls">
              <button 
                onClick={handleManualCapture}
                disabled={isScanning || !modelsReady || !cameraReady || employesCount === 0}
                className="capture-btn primary"
              >
                {isScanning ? (
                  <>
                    <div className="button-spinner"></div>
                    Analyse en cours...
                  </>
                ) : (
                  '📸 Scanner maintenant'
                )}
              </button>
            </div>
          </div>
        </>
      ) : (
        /* Mode Upload */
        <UploadPhoto 
          onPhotoUpload={handlePhotoUpload}
          isProcessing={isScanning}
        />
      )}

      {/* Résultats (commun aux deux modes) */}
      {lastResult && (
        <div className={`result-card ${lastResult.type}`}>
          <div className="result-header">
            <h3>{lastResult.message}</h3>
            {lastResult.similarity > 0 && (
              <div className="confidence-badge">
                {(lastResult.similarity * 100).toFixed(1)}%
              </div>
            )}
          </div>
          
          {employe && (
            <div className="employe-details">
              <div className="detail-row">
                <span className="label">Nom:</span>
                <span className="value">{employe.nom}</span>
              </div>
              <div className="detail-row">
                <span className="label">Email:</span>
                <span className="value">{employe.email}</span>
              </div>
              <div className="detail-row">
                <span className="label">Heure:</span>
                <span className="value">{new Date().toLocaleTimeString()}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Pointage;