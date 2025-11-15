import React, { useRef, useCallback, useState, useEffect } from 'react';
import Webcam from 'react-webcam';
import '../styles/Camera.css';

const Camera = ({ 
  onCapture, 
  isCapturing, 
  autoCapture = false,
  showQualityFeedback = false,
  onFaceQualityChange,
  captureInterval = 3000,
  showInstructions = true
}) => {
  const webcamRef = useRef(null);
  const [facingMode, setFacingMode] = useState('user');
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const [hasPermission, setHasPermission] = useState(null);
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [faceQuality, setFaceQuality] = useState(0);
  const [isFaceDetected, setIsFaceDetected] = useState(false);
  const captureIntervalRef = useRef(null);

  // 🔥 Détection des caméras disponibles
  const handleDevices = useCallback((mediaDevices) => {
    const videoDevices = mediaDevices.filter(({ kind }) => kind === 'videoinput');
    setDevices(videoDevices);
    if (videoDevices.length > 0 && !selectedDeviceId) {
      setSelectedDeviceId(videoDevices[0].deviceId);
    }
  }, [selectedDeviceId]);

  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then(handleDevices);
  }, [handleDevices]);

  // 🔥 Vérification des permissions
  const checkCameraPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(track => track.stop());
      setHasPermission(true);
    } catch (error) {
      setHasPermission(false);
      setCameraError(true);
    }
  };

  useEffect(() => {
    checkCameraPermission();
  }, []);

  // 🔥 Capture optimisée avec validation
  const capture = useCallback(() => {
    if (!webcamRef.current || !cameraReady || isCapturing) {
      return null;
    }

    try {
      const imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc) {
        // 🔥 Validation basique de l'image
        const img = new Image();
        img.onload = function() {
          if (this.width < 100 || this.height < 100) {
            console.warn('Image trop petite');
            return null;
          }
          onCapture(imageSrc);
        };
        img.src = imageSrc;
        return imageSrc;
      }
    } catch (error) {
      console.error('Erreur lors de la capture:', error);
    }
    return null;
  }, [webcamRef, cameraReady, isCapturing, onCapture]);

  // 🔥 Capture automatique améliorée
  useEffect(() => {
    if (autoCapture && cameraReady && !isCapturing) {
      captureIntervalRef.current = setInterval(() => {
        if (showQualityFeedback && faceQuality > 70) {
          capture();
        } else if (!showQualityFeedback) {
          capture();
        }
      }, captureInterval);
    } else {
      if (captureIntervalRef.current) {
        clearInterval(captureIntervalRef.current);
      }
    }

    return () => {
      if (captureIntervalRef.current) {
        clearInterval(captureIntervalRef.current);
      }
    };
  }, [autoCapture, cameraReady, isCapturing, captureInterval, showQualityFeedback, faceQuality, capture]);

  // 🔥 Simulation de détection de qualité (à intégrer avec face-api.js)
  const checkFaceQuality = useCallback(() => {
    if (!webcamRef.current || !cameraReady || !showQualityFeedback) return;

    try {
      const imageSrc = webcamRef.current.getScreenshot();
      if (!imageSrc) return;

      // 🔥 SIMULATION - À REMPLACER PAR VOTRE LOGIQUE FACE-API.JS
      const simulatedQuality = Math.floor(Math.random() * 30) + 70; // Simulation 70-100%
      setFaceQuality(simulatedQuality);
      setIsFaceDetected(simulatedQuality > 60);
      
      if (onFaceQualityChange) {
        onFaceQualityChange(simulatedQuality, simulatedQuality > 60);
      }
    } catch (error) {
      console.log('Erreur vérification qualité:', error);
    }
  }, [webcamRef, cameraReady, showQualityFeedback, onFaceQualityChange]);

  // 🔥 Intervalle de vérification de qualité
  useEffect(() => {
    if (showQualityFeedback && cameraReady) {
      const qualityInterval = setInterval(checkFaceQuality, 1500);
      return () => clearInterval(qualityInterval);
    }
  }, [showQualityFeedback, cameraReady, checkFaceQuality]);

  const switchCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
    resetCameraState();
  };

  const switchDevice = (deviceId) => {
    setSelectedDeviceId(deviceId);
    resetCameraState();
  };

  const resetCameraState = () => {
    setCameraReady(false);
    setCameraError(false);
    setFaceQuality(0);
    setIsFaceDetected(false);
  };

  const handleUserMedia = () => {
    console.log('✅ Caméra prête');
    setCameraReady(true);
    setCameraError(false);
  };

  const handleUserMediaError = (error) => {
    console.error('❌ Erreur caméra:', error);
    setCameraError(true);
    setCameraReady(false);
    
    // 🔥 Gestion d'erreurs spécifiques
    if (error.name === 'NotAllowedError') {
      setHasPermission(false);
    } else if (error.name === 'NotFoundError') {
      console.error('Aucune caméra trouvée');
    }
  };

  const requestCameraAccess = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ video: true });
      setHasPermission(true);
      setCameraError(false);
      window.location.reload();
    } catch (error) {
      setCameraError(true);
    }
  };

  const videoConstraints = {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    facingMode: devices.length === 0 ? facingMode : undefined,
    deviceId: selectedDeviceId ? { exact: selectedDeviceId } : undefined
  };

  // 🔥 Écran d'erreur amélioré
  if (cameraError) {
    return (
      <div className="camera-container camera-error">
        <div className="camera-error-content">
          <div className="camera-error-icon">📷❌</div>
          <h3>Problème avec la caméra</h3>
          
          {hasPermission === false ? (
            <>
              <p>L'accès à la caméra a été refusé. Veuillez autoriser l'accès dans les paramètres de votre navigateur.</p>
              <button onClick={requestCameraAccess} className="primary-btn">
                🔒 Demander l'accès
              </button>
            </>
          ) : (
            <>
              <p>Impossible d'accéder à la caméra. Vérifiez votre périphérique.</p>
              <button onClick={() => window.location.reload()} className="secondary-btn">
                🔄 Réessayer
              </button>
            </>
          )}
          
          <div className="troubleshooting-tips">
            <h4>Conseils de dépannage :</h4>
            <ul>
              <li>✅ Vérifiez qu'aucune autre application n'utilise la caméra</li>
              <li>✅ Essayez une autre caméra si disponible</li>
              <li>✅ Redémarrez votre navigateur</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`camera-container ${autoCapture ? 'auto-mode' : 'manual-mode'}`}>
      {/* En-tête de la caméra */}
      <div className="camera-header">
        <div className="camera-title">
          <h3>📸 Reconnaissance Faciale</h3>
          <p>Positionnez votre visage dans le cadre</p>
        </div>
        
        <div className="camera-actions">
          {/* Sélecteur de caméra */}
          {devices.length > 1 && (
            <select 
              value={selectedDeviceId} 
              onChange={(e) => switchDevice(e.target.value)}
              className="camera-selector"
            >
              {devices.map((device, key) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Caméra ${key + 1}`}
                </option>
              ))}
            </select>
          )}
          
          <button onClick={switchCamera} className="switch-camera-btn">
            🔄 {facingMode === 'user' ? 'Arrière' : 'Avant'}
          </button>
        </div>
      </div>

      {/* Vue caméra avec overlay */}
      <div className="camera-view">
        <Webcam
          audio={false}
          ref={webcamRef}
          screenshotFormat="image/jpeg"
          videoConstraints={videoConstraints}
          className="webcam-preview"
          mirrored={facingMode === 'user'}
          onUserMedia={handleUserMedia}
          onUserMediaError={handleUserMediaError}
          style={{ 
            opacity: cameraReady ? 1 : 0,
            transform: facingMode === 'user' ? 'scaleX(-1)' : 'scaleX(1)'
          }}
        />
        
        {/* Overlay de guidage */}
        {cameraReady && (
          <div className="camera-overlay">
            <div className="guide-frame">
              <div className="guide-corner top-left"></div>
              <div className="guide-corner top-right"></div>
              <div className="guide-corner bottom-left"></div>
              <div className="guide-corner bottom-right"></div>
            </div>
            
            {/* Indicateur de qualité faciale */}
            {showQualityFeedback && (
              <div className="face-quality-indicator">
                <div className="quality-label">
                  {isFaceDetected ? '✅ Visage détecté' : '❌ Aucun visage'}
                </div>
                <div className="quality-bar">
                  <div 
                    className="quality-fill"
                    style={{ width: `${faceQuality}%` }}
                  ></div>
                </div>
                <div className="quality-percentage">
                  {faceQuality}%
                </div>
              </div>
            )}
          </div>
        )}

        {/* État de chargement */}
        {!cameraReady && !cameraError && (
          <div className="camera-loading">
            <div className="loading-spinner"></div>
            <p>Initialisation de la caméra...</p>
            <div className="loading-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        )}
      </div>

      {/* Indicateurs de statut */}
      <div className="camera-status">
        {cameraReady && autoCapture && (
          <div className="auto-capture-indicator">
            <span className="pulse-dot"></span>
            Mode automatique - Capture toutes les {captureInterval / 1000}s
          </div>
        )}
        
        {showQualityFeedback && isFaceDetected && (
          <div className="face-detected-indicator">
            <span className="status-dot green"></span>
            Visage détecté - Qualité: {faceQuality}%
          </div>
        )}
      </div>

      {/* Contrôles de capture */}
      <div className="camera-controls">
        {!isCapturing && !autoCapture && cameraReady && (
          <button onClick={capture} className="capture-btn primary">
            <span className="btn-icon">📸</span>
            Capturer la photo
          </button>
        )}
        
        {isCapturing && (
          <div className="processing-message">
            <div className="processing-spinner"></div>
            <div className="processing-text">
              <span>Analyse faciale en cours...</span>
              <span className="processing-sub">Veuillez patienter</span>
            </div>
          </div>
        )}
      </div>

      {/* Instructions */}
      {showInstructions && cameraReady && (
        <div className="camera-instructions">
          <h4>💡 Pour une reconnaissance optimale</h4>
          <div className="instruction-grid">
            <div className="instruction-item">
              <span className="instruction-icon positive">✅</span>
              <div className="instruction-content">
                <strong>Bon éclairage</strong>
                <span>Lumière naturelle de face</span>
              </div>
            </div>
            <div className="instruction-item">
              <span className="instruction-icon positive">✅</span>
              <div className="instruction-content">
                <strong>Visage centré</strong>
                <span>Dans le cadre de guidage</span>
              </div>
            </div>
            <div className="instruction-item">
              <span className="instruction-icon negative">❌</span>
              <div className="instruction-content">
                <strong>Pas d'obstruction</strong>
                <span>Visage découvert</span>
              </div>
            </div>
            <div className="instruction-item">
              <span className="instruction-icon negative">❌</span>
              <div className="instruction-content">
                <strong>Expression neutre</strong>
                <span>Regard caméra</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Informations techniques */}
      {process.env.NODE_ENV === 'development' && cameraReady && (
        <div className="debug-info">
          <details>
            <summary>Informations techniques</summary>
            <div className="debug-content">
              <p><strong>Mode:</strong> {facingMode}</p>
              <p><strong>Caméra:</strong> {selectedDeviceId}</p>
              <p><strong>Prêt:</strong> {cameraReady ? 'Oui' : 'Non'}</p>
              <p><strong>Qualité visage:</strong> {faceQuality}%</p>
            </div>
          </details>
        </div>
      )}
    </div>
  );
};

export default Camera;