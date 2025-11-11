import React, { useRef, useCallback, useState } from 'react';
import Webcam from 'react-webcam';

const Camera = ({ onCapture, isCapturing, autoCapture = false }) => {
  const webcamRef = useRef(null);
  const [facingMode, setFacingMode] = useState('user');

  const capture = useCallback(() => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      onCapture(imageSrc);
    }
  }, [webcamRef, onCapture]);

  const switchCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  const videoConstraints = {
    width: 640,
    height: 480,
    facingMode: facingMode
  };

  return (
    <div className="camera-container">
      <div className="camera-header">
        <h3>📸 Positionnez votre visage dans le cadre</h3>
        <button onClick={switchCamera} className="switch-camera-btn">
          🔄 Caméra
        </button>
      </div>
      
      <Webcam
        audio={false}
        ref={webcamRef}
        screenshotFormat="image/jpeg"
        videoConstraints={videoConstraints}
        className="webcam-preview"
        mirrored={facingMode === 'user'}
      />
      
      <div className="camera-controls">
        {!isCapturing && !autoCapture && (
          <button onClick={capture} className="capture-btn primary">
            📸 Capturer la photo
          </button>
        )}
        
        {isCapturing && (
          <div className="processing-message">
            <div className="spinner"></div>
            Traitement en cours...
          </div>
        )}
      </div>
    </div>
  );
};

export default Camera;