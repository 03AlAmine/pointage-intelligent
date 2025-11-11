import React, { useState, useRef } from 'react';

const UploadPhoto = ({ onPhotoUpload, isProcessing }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileSelect = (file) => {
    if (!file) return;

    // Vérifier le type de fichier
    if (!file.type.match('image.*')) {
      alert('Veuillez sélectionner une image (JPEG, PNG, etc.)');
      return;
    }

    // Vérifier la taille (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('L\'image est trop volumineuse (max 5MB)');
      return;
    }

    setSelectedFile(file);
    
    // Créer l'URL de prévisualisation
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const files = e.dataTransfer.files;
    if (files && files[0]) {
      handleFileSelect(files[0]);
    }
  };

  const handleFileInput = (e) => {
    const files = e.target.files;
    if (files && files[0]) {
      handleFileSelect(files[0]);
    }
  };

  const handleUpload = () => {
    if (selectedFile && previewUrl) {
      onPhotoUpload(previewUrl);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const clearSelection = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="upload-photo-container">
      <div className="upload-header">
        <h3>📁 Uploader une Photo</h3>
        <p>Sélectionnez une photo depuis votre appareil</p>
      </div>

      {/* Zone de drag & drop */}
      <div 
        className={`upload-zone ${dragActive ? 'drag-active' : ''} ${previewUrl ? 'has-preview' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={!previewUrl ? triggerFileInput : undefined}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileInput}
          className="file-input"
        />
        
        {!previewUrl ? (
          <div className="upload-placeholder">
            <div className="upload-icon">📁</div>
            <div className="upload-text">
              <p className="main-text">Glissez-déposez votre photo ici</p>
              <p className="sub-text">ou cliquez pour sélectionner</p>
            </div>
            <div className="upload-requirements">
              <span>Formats supportés: JPEG, PNG, WebP</span>
              <span>Taille max: 5MB</span>
            </div>
          </div>
        ) : (
          <div className="preview-container">
            <div className="preview-header">
              <h4>Aperçu de la photo</h4>
              <button 
                onClick={clearSelection}
                className="clear-btn"
                disabled={isProcessing}
              >
                ✕
              </button>
            </div>
            <img 
              src={previewUrl} 
              alt="Aperçu" 
              className="preview-image"
            />
            <div className="file-info">
              <span className="file-name">{selectedFile.name}</span>
              <span className="file-size">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Boutons d'action */}
      <div className="upload-actions">
        {previewUrl && (
          <>
            <button 
              onClick={handleUpload}
              disabled={isProcessing}
              className="upload-btn primary"
            >
              {isProcessing ? (
                <>
                  <div className="button-spinner"></div>
                  Analyse en cours...
                </>
              ) : (
                <>
                  🔍 Analyser la photo
                </>
              )}
            </button>
            <button 
              onClick={clearSelection}
              disabled={isProcessing}
              className="secondary-btn"
            >
              🗑️ Changer de photo
            </button>
          </>
        )}
        
        {!previewUrl && (
          <button 
            onClick={triggerFileInput}
            className="browse-btn"
          >
            📂 Parcourir les fichiers
          </button>
        )}
      </div>

      {/* Instructions */}
      <div className="upload-instructions">
        <h4>💡 Conseils pour une bonne reconnaissance :</h4>
        <ul>
          <li>✅ Photo récente et de bonne qualité</li>
          <li>✅ Visage bien visible et éclairé</li>
          <li>✅ Expression neutre, regard caméra</li>
          <li>✅ Arrière-plan simple de préférence</li>
          <li>❌ Pas de lunettes de soleil</li>
          <li>❌ Pas de chapeau/casquette</li>
        </ul>
      </div>
    </div>
  );
};

export default UploadPhoto;