import React, { useState, useRef } from "react";
import "../styles/UploadPhoto.css";

const UploadPhoto = ({ onPhotoUpload, isProcessing }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [validationError, setValidationError] = useState("");
  const [validationScore, setValidationScore] = useState(0);
  const fileInputRef = useRef(null);

  // 🔥 VALIDATION AVANCÉE DE L'IMAGE
  // 📍 DANS UploadPhoto.js - CORRIGER LES SEUILS
  const validateImageForFaceRecognition = (imageUrl) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = function () {
        let score = 100;
        const issues = [];

        // 🔥 CORRECTION 1: Taille minimale plus réaliste
        if (this.width < 200 || this.height < 200) {
          // ⬅️ 200px au lieu de 300px
          score -= 20; // ⬅️ Pénalité réduite
          issues.push("Image un peu petite (recommandé: 300x300 pixels)");
        }

        // 🔥 CORRECTION 2: Ratio plus flexible
        const ratio = this.width / this.height;
        const idealRatio = 0.75;
        const ratioDeviation = Math.abs(ratio - idealRatio);

        if (ratioDeviation > 0.5) {
          // ⬅️ 0.5 au lieu de 0.3
          score -= 10; // ⬅️ Pénalité réduite
          issues.push("Ratio d'image inhabituel");
        }

        // 🔥 CORRECTION 3: Résolution adaptée
        const megapixels = (this.width * this.height) / 1000000;
        if (megapixels < 0.05) {
          // ⬅️ 0.05 MP au lieu de 0.1 MP
          score -= 15;
          issues.push("Résolution un peu faible");
        } else if (megapixels > 8) {
          // ⬅️ 8 MP au lieu de 5 MP
          score -= 5; // ⬅️ Pénalité réduite
          issues.push("Image très lourde");
        }

        // 🔥 CORRECTION 4: Luminosité adaptée
        try {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          canvas.width = this.width;
          canvas.height = this.height;
          ctx.drawImage(this, 0, 0);

          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;

          let brightness = 0;
          let contrast = 0;
          let rValues = [],
            gValues = [],
            bValues = [];

          for (let i = 0; i < data.length; i += 4) {
            const r = data[i],
              g = data[i + 1],
              b = data[i + 2];
            rValues.push(r);
            gValues.push(g);
            bValues.push(b);
            brightness += (r + g + b) / 3;
          }

          brightness = brightness / (data.length / 4);

          // Calcul du contraste simplifié
          const contrastR = Math.sqrt(
            rValues.reduce(
              (acc, val) => acc + Math.pow(val - brightness, 2),
              0
            ) / rValues.length
          );
          contrast = contrastR; // Utiliser seulement le canal rouge pour simplifier

          console.log(
            `📊 Analyse image: ${Math.round(brightness)} lux, ${Math.round(
              contrast
            )} contraste`
          );

          // 🔥 CORRECTION 5: Seuils de luminosité adaptés
          if (brightness < 80) {
            // ⬅️ 80 au lieu de 50
            score -= 15; // ⬅️ Pénalité réduite
            issues.push("Image un peu sombre");
          } else if (brightness > 220) {
            // ⬅️ 220 au lieu de 200
            score -= 10; // ⬅️ Pénalité réduite
            issues.push("Image un peu surexposée");
          }

          // 🔥 CORRECTION 6: Contraste adapté
          if (contrast < 25) {
            // ⬅️ 25 au lieu de 30
            score -= 10; // ⬅️ Pénalité réduite
            issues.push("Contraste un peu faible");
          }
        } catch (analysisError) {
          console.warn("⚠️ Analyse d'image limitée:", analysisError);
          // Ne pas pénaliser en cas d'erreur d'analyse
        }

        // 🔥 CORRECTION 7: Score minimum réduit
        const finalScore = Math.max(0, score);
        setValidationScore(finalScore);

        // ⬇️ SEUIL RÉDUIT : 40% au lieu de 60%
        if (finalScore < 40) {
          reject({
            message: "Photo pouvant être améliorée pour la reconnaissance",
            issues: issues,
            score: finalScore,
          });
        } else {
          resolve({
            score: finalScore,
            issues: issues,
            dimensions: { width: this.width, height: this.height },
            message:
              finalScore >= 70
                ? `Photo optimale (${finalScore}%)`
                : `Photo acceptable (${finalScore}%)`,
          });
        }
      };

      img.onerror = () =>
        reject({
          message: "Erreur de chargement de l'image",
          score: 0,
        });
      img.src = imageUrl;
    });
  };
  // 🔥 GESTION AMÉLIORÉE DE LA SÉLECTION DE FICHIER
  const handleFileSelect = async (file) => {
    if (!file) return;

    setValidationError("");
    setValidationScore(0);

    // Vérification basique du type
    if (!file.type.match("image.*")) {
      setValidationError(
        "❌ Veuillez sélectionner une image (JPEG, PNG, WebP)"
      );
      return;
    }

    // Vérification de la taille
    if (file.size > 8 * 1024 * 1024) {
      setValidationError("❌ L'image est trop volumineuse (max 8MB)");
      return;
    }

    if (file.size < 10 * 1024) {
      setValidationError("❌ Image trop petite (min 10KB)");
      return;
    }

    setSelectedFile(file);

    // Créer l'URL de prévisualisation
    const reader = new FileReader();
    reader.onload = async (e) => {
      const imageUrl = e.target.result;
      setPreviewUrl(imageUrl);

      // 🔥 VALIDATION AUTOMATIQUE AU CHARGEMENT
      try {
        const validation = await validateImageForFaceRecognition(imageUrl);
        console.log("✅ Photo validée:", validation);
      } catch (error) {
        console.warn("⚠️ Photo sous-optimale:", error);
        setValidationError(`${error.message} - Score: ${error.score}%`);
      }
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

  // 🔥 UPLOAD AVEC PRÉ-TRAITEMENT
  // 📍 DANS UploadPhoto.js - CORRIGER handleUpload
  const handleUpload = async () => {
    if (selectedFile && previewUrl) {
      try {
        // 🔥 VALIDATION PLUS TOLÉRANTE
        const validation = await validateImageForFaceRecognition(previewUrl);

        // ⬇️ SEUIL RÉDUIT : 50% au lieu de 70%
        if (validation.score < 50) {
          const shouldProceed = window.confirm(
            `Cette photo n'est pas optimale (score: ${
              validation.score
            }%). \n\nConseils:\n• ${validation.issues.join(
              "\n• "
            )}\n\nVoulez-vous quand même l'utiliser ?`
          );

          if (!shouldProceed) {
            return;
          }
        }

        // 🔥 OPTIONNEL: Désactiver le pré-traitement si problème
        let imageToProcess = previewUrl;

        // Si score faible, éviter le pré-traitement qui peut dégrader
        if (validation.score < 60) {
          console.log("🔄 Utilisation de l'image originale (score faible)");
          imageToProcess = previewUrl;
        } else {
          // Appliquer le pré-traitement seulement pour les bonnes images
          imageToProcess = await preprocessImage(previewUrl);
        }

        onPhotoUpload(imageToProcess);
      } catch (error) {
        console.warn("⚠️ Validation échouée mais continuation:", error);
        // 🔥 CONTINUER MÊME SI LA VALIDATION ÉCHOUE
        onPhotoUpload(previewUrl);
      }
    }
  };

  // 🔥 PRÉ-TRAITEMENT POUR AMÉLIORER LA RECONNAISSANCE
  const preprocessImage = (imageUrl) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = function () {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        // Dimensions optimales pour la reconnaissance
        const targetSize = 500;
        const scale = Math.min(
          targetSize / this.width,
          targetSize / this.height
        );

        canvas.width = this.width * scale;
        canvas.height = this.height * scale;

        ctx.drawImage(this, 0, 0, canvas.width, canvas.height);

        // 🔥 AMÉLIORATIONS D'IMAGE
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // Ajustement du contraste et de la luminosité
        for (let i = 0; i < data.length; i += 4) {
          // Légère augmentation du contraste
          const contrastFactor = 1.1;
          data[i] = Math.min(
            255,
            Math.max(0, (data[i] - 128) * contrastFactor + 128)
          ); // R
          data[i + 1] = Math.min(
            255,
            Math.max(0, (data[i + 1] - 128) * contrastFactor + 128)
          ); // G
          data[i + 2] = Math.min(
            255,
            Math.max(0, (data[i + 2] - 128) * contrastFactor + 128)
          ); // B

          // Légère correction de luminosité
          const brightnessAdjust = 5;
          data[i] = Math.min(255, data[i] + brightnessAdjust);
          data[i + 1] = Math.min(255, data[i + 1] + brightnessAdjust);
          data[i + 2] = Math.min(255, data[i + 2] + brightnessAdjust);
        }

        ctx.putImageData(imageData, 0, 0);

        // Conversion en JPEG de qualité pour réduire la taille
        const processedImageUrl = canvas.toDataURL("image/jpeg", 0.85);
        resolve(processedImageUrl);
      };
      img.src = imageUrl;
    });
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const clearSelection = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setValidationError("");
    setValidationScore(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // 🔥 INDICATEUR DE QUALITÉ VISUEL
  // 📍 DANS UploadPhoto.js - AMÉLIORER getQualityText
  const getQualityText = (score) => {
    if (score >= 80) return "Excellente";
    if (score >= 60) return "Bonne";
    if (score >= 40) return "Acceptable"; // ⬅️ Nouveau niveau
    return "À améliorer"; // ⬅️ Message plus positif
  };

  const getQualityColor = (score) => {
    if (score >= 80) return "#10b981"; // Vert
    if (score >= 60) return "#f59e0b"; // Orange
    if (score >= 40) return "#fbbf24"; // Jaune - ⬅️ Nouvelle couleur
    return "#ef4444"; // Rouge
  };
  return (
    <div className="upload-photo-container">
      <div className="upload-header">
        <h3>📁 Uploader une Photo</h3>
        <p>Sélectionnez une photo optimale pour la reconnaissance faciale</p>
      </div>

      {/* Zone de drag & drop améliorée */}
      <div
        className={`upload-zone ${dragActive ? "drag-active" : ""} ${
          previewUrl ? "has-preview" : ""
        } ${validationError ? "has-error" : ""}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={!previewUrl ? triggerFileInput : undefined}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
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
              <span>📷 Formats: JPEG, PNG, WebP</span>
              <span>💾 Taille: 10KB - 8MB</span>
              <span>📐 Min: 300x300 pixels</span>
            </div>
          </div>
        ) : (
          <div className="preview-container">
            <div className="preview-header">
              <div className="preview-title">
                <h4>Aperçu de la photo</h4>
                {validationScore > 0 && (
                  <div
                    className="quality-badge"
                    style={{
                      backgroundColor: getQualityColor(validationScore),
                    }}
                  >
                    {getQualityText(validationScore)}: {validationScore}%
                  </div>
                )}
              </div>
              <button
                onClick={clearSelection}
                className="clear-btn"
                disabled={isProcessing}
              >
                ✕
              </button>
            </div>

            <img src={previewUrl} alt="Aperçu" className="preview-image" />

            <div className="file-info">
              <span className="file-name">{selectedFile.name}</span>
              <span className="file-size">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </span>
            </div>

            {/* 🔥 INDICATEUR DE QUALITÉ DÉTAILLÉ */}
            {validationScore > 0 && (
              <div className="quality-indicator">
                <div className="quality-bar">
                  <div
                    className="quality-fill"
                    style={{
                      width: `${validationScore}%`,
                      backgroundColor: getQualityColor(validationScore),
                    }}
                  ></div>
                </div>
                <div className="quality-labels">
                  <span>Faible</span>
                  <span>Optimale</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Messages d'erreur de validation */}
      {validationError && (
        <div className="validation-error">
          <div className="error-icon">⚠️</div>
          <div className="error-content">
            <strong>Problème détecté :</strong>
            <p>{validationError}</p>
          </div>
        </div>
      )}

      {/* Boutons d'action */}
      <div className="upload-actions">
        {previewUrl && (
          <>
            <button
              onClick={handleUpload}
              disabled={
                isProcessing || (validationScore < 30 && !validationError)
              }
              className="upload-btn primary"
              title={
                validationScore < 30 ? "Photo de qualité insuffisante" : ""
              }
            >
              {isProcessing ? (
                <>
                  <div className="button-spinner"></div>
                  Traitement en cours...
                </>
              ) : (
                <>🔍 Analyser la photo</>
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
          <button onClick={triggerFileInput} className="browse-btn">
            📂 Parcourir les fichiers
          </button>
        )}
      </div>

      {/* Instructions détaillées */}
      <div className="upload-instructions">
        <h4>💡 Guide pour une reconnaissance optimale :</h4>
        <div className="instructions-grid">
          <div className="instruction-category">
            <h5>✅ Obligatoire</h5>
            <ul>
              <li>Visage bien visible et centré</li>
              <li>Bon éclairage naturel de face</li>
              <li>Expression neutre, regard caméra</li>
              <li>Photo récente et de bonne qualité</li>
            </ul>
          </div>

          <div className="instruction-category">
            <h5>🚫 À éviter</h5>
            <ul>
              <li>Lunettes de soleil ou reflets</li>
              <li>Chapeau, casquette ou foulard</li>
              <li>Photos de mauvaise qualité/floues</li>
              <li>Arrière-plan complexe/encombré</li>
            </ul>
          </div>

          <div className="instruction-category">
            <h5>📊 Technique</h5>
            <ul>
              <li>Minimum 300x300 pixels</li>
              <li>Format JPEG ou PNG recommandé</li>
              <li>Poids entre 100KB et 2MB</li>
              <li>Ratio portrait (3:4 idéal)</li>
            </ul>
          </div>
        </div>

        {/* Exemples visuels */}
        <div className="examples-section">
          <h5>🎯 Exemples de photos optimales :</h5>
          <div className="examples-grid">
            <div className="example good">
              <div className="example-icon">👍</div>
              <span>Photo bien éclairée</span>
            </div>
            <div className="example good">
              <div className="example-icon">👍</div>
              <span>Visage centré</span>
            </div>
            <div className="example bad">
              <div className="example-icon">👎</div>
              <span>Trop sombre</span>
            </div>
            <div className="example bad">
              <div className="example-icon">👎</div>
              <span>Visage coupé</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UploadPhoto;
