import React, { useRef, useCallback, useState, useEffect } from 'react';
import Webcam from 'react-webcam';
import '../styles/Camera.css';

const Camera = ({ onCapture, isCapturing, autoCapture = false }) => {
  const webcamRef = useRef(null);
  const [facingMode, setFacingMode] = useState('user');
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState(false);

  const capture = useCallback(() => {
    if (webcamRef.current && cameraReady) {
      const imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc) {
        onCapture(imageSrc);
      }
    }
  }, [webcamRef, onCapture, cameraReady]);

  const switchCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
    setCameraReady(false);
    setCameraError(false);
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
  };

  const videoConstraints = {
    width: 640,
    height: 480,
    facingMode: facingMode
  };

  // Effet pour réinitialiser l'état quand la caméra change
  useEffect(() => {
    setCameraReady(false);
    setCameraError(false);
  }, [facingMode]);

  if (cameraError) {
    return (
      <div className="camera-container camera-error">
        <div className="camera-error-icon">📷❌</div>
        <h4>Caméra non disponible</h4>
        <p>Veuillez autoriser l'accès à la caméra ou vérifier votre périphérique</p>
        <button onClick={() => window.location.reload()} className="secondary-btn">
          🔄 Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className={`camera-container ${autoCapture ? 'auto-mode' : ''}`}>
      <div className="camera-header">
        <h3>📸 Positionnez votre visage dans le cadre</h3>
        <button onClick={switchCamera} className="switch-camera-btn">
          🔄 {facingMode === 'user' ? 'Caméra Arrière' : 'Caméra Avant'}
        </button>
      </div>

      <Webcam
        audio={false}
        ref={webcamRef}
        screenshotFormat="image/jpeg"
        videoConstraints={videoConstraints}
        className="webcam-preview"
        mirrored={facingMode === 'user'}
        onUserMedia={handleUserMedia}
        onUserMediaError={handleUserMediaError}
        style={{ display: cameraReady ? 'block' : 'none' }}
      />
      
      {!cameraReady && !cameraError && (
        <div className="camera-loading">
          <div className="spinner"></div>
          <p>Initialisation de la caméra...</p>
        </div>
      )}

      {cameraReady && autoCapture && (
        <div className="auto-capture-indicator">
          <span className="indicator-dot"></span>
          Mode automatique activé - Détection en temps réel
        </div>
      )}
      
      <div className="camera-controls">
        {!isCapturing && !autoCapture && cameraReady && (
          <button onClick={capture} className="capture-btn primary">
            📸 Capturer la photo
          </button>
        )}
        
        {isCapturing && (
          <div className="processing-message">
            <div className="spinner"></div>
            Analyse faciale en cours...
          </div>
        )}
      </div>

      {cameraReady && (
        <div className="camera-instructions">
          <h4>💡 Instructions pour une bonne capture</h4>
          <div className="instruction-list">
            <div className="instruction-item positive">
              <span className="instruction-icon">✅</span>
              <span>Visage centré dans le cadre</span>
            </div>
            <div className="instruction-item positive">
              <span className="instruction-icon">✅</span>
              <span>Bon éclairage naturel</span>
            </div>
            <div className="instruction-item negative">
              <span className="instruction-icon">❌</span>
              <span>Pas de lunettes de soleil</span>
            </div>
            <div className="instruction-item negative">
              <span className="instruction-icon">❌</span>
              <span>Expression neutre</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Camera;