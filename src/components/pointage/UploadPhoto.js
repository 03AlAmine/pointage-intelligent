import React, { useState, useRef, useEffect, useCallback } from "react";
import * as faceapi from "face-api.js";
import "../styles/UploadPhoto.css";

const UploadPhoto = ({ onPhotoUpload, isProcessing }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [validationError, setValidationError] = useState("");
  const [validationScore, setValidationScore] = useState(0);
  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);
  const animationRef = useRef(null);

  // 🔮 ÉTATS MYSTÉRIEUX POUR L'ANALYSE
  const [faceLandmarks, setFaceLandmarks] = useState(null);
  const [neuralActivity, setNeuralActivity] = useState([]);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [showNeuralAnalysis, setShowNeuralAnalysis] = useState(false);

  // 🔮 GÉNÉRATEUR D'ACTIVITÉ NEURALE
  const generateNeuralActivity = useCallback(() => {
    const activities = [];
    for (let i = 0; i < 6; i++) {
      activities.push({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        intensity: Math.random() * 100,
        delay: Math.random() * 1500
      });
    }
    setNeuralActivity(activities);
  }, []);

  // 🔮 ANALYSE FACIALE AVEC LANDMARKS
  const analyzeFacialLandmarks = async (imageUrl) => {
    if (!imageUrl) return;

    try {
      setShowNeuralAnalysis(true);
      setAnalysisProgress(0);

      // Simulation de progression
      for (let i = 0; i <= 100; i += 10) {
        setAnalysisProgress(i);
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = imageUrl;
      });

      // Vérifier si les modèles sont chargés
      if (!faceapi.nets.tinyFaceDetector.isLoaded) {
        console.warn("Modèles face-api.js non chargés");
        return;
      }

      const detectionOptions = new faceapi.TinyFaceDetectorOptions({
        inputSize: 160,
        scoreThreshold: 0.3
      });

      const detections = await faceapi
        .detectAllFaces(img, detectionOptions)
        .withFaceLandmarks();

      if (detections && detections.length > 0) {
        const detection = detections[0];
        
        if (detection.landmarks) {
          const landmarks = detection.landmarks.positions.map(point => ({
            x: (point.x / img.width) * 100, // Pourcentage pour le responsive
            y: (point.y / img.height) * 100,
            intensity: Math.random() * 80 + 20
          }));
          setFaceLandmarks(landmarks);
          generateNeuralActivity();
          
          // Dessiner les landmarks
          drawLandmarksOnCanvas(detection, img.width, img.height);
        }
      }

      setAnalysisProgress(100);
      
      // Maintenir l'affichage neural pendant 2 secondes
      setTimeout(() => {
        setShowNeuralAnalysis(false);
        setFaceLandmarks(null);
      }, 2000);

    } catch (error) {
      console.warn("⚠️ Analyse faciale limitée:", error);
      setShowNeuralAnalysis(false);
    }
  };

  // 🔮 DESSIN DES LANDMARKS SUR LE CANVAS
  const drawLandmarksOnCanvas = (detection, imgWidth, imgHeight) => {
    const canvas = canvasRef.current;
    if (!canvas || !detection || !detection.landmarks) return;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Adapter la taille du canvas à l'image
    canvas.width = imgWidth;
    canvas.height = imgHeight;

    const landmarks = detection.landmarks.positions;
    
    // 🔮 CONNEXIONS MYSTÉRIEUSES
    ctx.strokeStyle = '#00ff886f';
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.7;

    // Dessiner les connexions principales
    drawFaceConnections(ctx, landmarks);

    // 🔮 POINTS LUMINEUX
    landmarks.forEach((point, index) => {
      const pulse = (Math.sin(Date.now() * 0.01 + index * 0.5) + 1) * 0.5;
      
      // Point central
      ctx.fillStyle = `rgba(0, 255, 136, ${0.4 + pulse * 0.6})`;
      ctx.beginPath();
      ctx.arc(point.x, point.y, 3 + pulse * 2, 0, Math.PI * 2);
      ctx.fill();

      // Aura
      ctx.strokeStyle = `rgba(0, 255, 136, ${0.2 + pulse * 0.3})`;
      ctx.beginPath();
      ctx.arc(point.x, point.y, 6 + pulse * 4, 0, Math.PI * 2);
      ctx.stroke();
    });

    // 🔮 RÉSEAU NEURALE
    drawNeuralNetwork(ctx, landmarks);
  };

  // 🔮 FONCTIONS DE DESSIN
  const drawFaceConnections = (ctx, landmarks) => {
    const connections = [
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16], // Contour visage
      [17, 18, 19, 20, 21], // Sourcil gauche
      [22, 23, 24, 25, 26], // Sourcil droit
      [27, 28, 29, 30], // Nez (arête)
      [31, 32, 33, 34, 35], // Nez (base)
      [36, 37, 38, 39, 40, 41, 36], // Œil gauche
      [42, 43, 44, 45, 46, 47, 42], // Œil droit
      [48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 48], // Lèvres externes
      [60, 61, 62, 63, 64, 65, 66, 67, 60] // Lèvres internes
    ];

    connections.forEach(indices => {
      ctx.beginPath();
      indices.forEach((index, i) => {
        const point = landmarks[index];
        if (i === 0) {
          ctx.moveTo(point.x, point.y);
        } else {
          ctx.lineTo(point.x, point.y);
        }
      });
      ctx.stroke();
    });
  };

  const drawNeuralNetwork = (ctx, landmarks) => {
    ctx.strokeStyle = 'rgba(0, 255, 136, 0.15)';
    ctx.lineWidth = 1;

    for (let i = 0; i < landmarks.length; i++) {
      for (let j = i + 1; j < landmarks.length; j++) {
        if (Math.random() < 0.08) {
          const pointA = landmarks[i];
          const pointB = landmarks[j];
          const distance = Math.sqrt(
            Math.pow(pointA.x - pointB.x, 2) + Math.pow(pointA.y - pointB.y, 2)
          );

          if (distance < 150) {
            const alpha = (150 - distance) / 150 * 0.4;
            ctx.strokeStyle = `rgba(0, 255, 136, ${alpha})`;
            ctx.beginPath();
            ctx.moveTo(pointA.x, pointA.y);
            ctx.lineTo(pointB.x, pointB.y);
            ctx.stroke();
          }
        }
      }
    }
  };

  // 🔮 ANIMATION CONTINUE
  useEffect(() => {
    const animate = () => {
      if (canvasRef.current && faceLandmarks && showNeuralAnalysis) {
        // Redessiner pour les animations
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const landmarks = faceLandmarks.map(landmark => ({
          x: (landmark.x / 100) * canvas.width,
          y: (landmark.y / 100) * canvas.height
        }));

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        drawFaceConnections(ctx, landmarks);
        
        // Points animés
        landmarks.forEach((point, index) => {
          const pulse = (Math.sin(Date.now() * 0.01 + index * 0.5) + 1) * 0.5;
          
          ctx.fillStyle = `rgba(0, 255, 136, ${0.4 + pulse * 0.6})`;
          ctx.beginPath();
          ctx.arc(point.x, point.y, 3 + pulse * 2, 0, Math.PI * 2);
          ctx.fill();
        });

        drawNeuralNetwork(ctx, landmarks);
      }
      animationRef.current = requestAnimationFrame(animate);
    };

    if (showNeuralAnalysis) {
      animate();
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [faceLandmarks, showNeuralAnalysis]);

  // 🔮 VALIDATION AVANCÉE DE L'IMAGE
  const validateImageForFaceRecognition = (imageUrl) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = function () {
        let score = 100;
        const issues = [];

        if (this.width < 200 || this.height < 200) {
          score -= 20;
          issues.push("Image un peu petite (recommandé: 300x300 pixels)");
        }

        const ratio = this.width / this.height;
        const idealRatio = 0.75;
        const ratioDeviation = Math.abs(ratio - idealRatio);

        if (ratioDeviation > 0.5) {
          score -= 10;
          issues.push("Ratio d'image inhabituel");
        }

        const megapixels = (this.width * this.height) / 1000000;
        if (megapixels < 0.05) {
          score -= 15;
          issues.push("Résolution un peu faible");
        } else if (megapixels > 8) {
          score -= 5;
          issues.push("Image très lourde");
        }

        try {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          canvas.width = this.width;
          canvas.height = this.height;
          ctx.drawImage(this, 0, 0);

          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;

          let brightness = 0;
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i], g = data[i + 1], b = data[i + 2];
            brightness += (r + g + b) / 3;
          }
          brightness = brightness / (data.length / 4);

          if (brightness < 80) {
            score -= 15;
            issues.push("Image un peu sombre");
          } else if (brightness > 220) {
            score -= 10;
            issues.push("Image un peu surexposée");
          }
        } catch (analysisError) {
          console.warn("⚠️ Analyse d'image limitée:", analysisError);
        }

        const finalScore = Math.max(0, score);
        setValidationScore(finalScore);

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

  // 🔮 GESTION AMÉLIORÉE DE LA SÉLECTION DE FICHIER
  const handleFileSelect = async (file) => {
    if (!file) return;

    setValidationError("");
    setValidationScore(0);
    setShowNeuralAnalysis(false);
    setFaceLandmarks(null);

    if (!file.type.match("image.*")) {
      setValidationError("❌ Veuillez sélectionner une image (JPEG, PNG, WebP)");
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      setValidationError("❌ L'image est trop volumineuse (max 8MB)");
      return;
    }

    if (file.size < 10 * 1024) {
      setValidationError("❌ Image trop petite (min 10KB)");
      return;
    }

    setSelectedFile(file);

    const reader = new FileReader();
    reader.onload = async (e) => {
      const imageUrl = e.target.result;
      setPreviewUrl(imageUrl);

      try {
        const validation = await validateImageForFaceRecognition(imageUrl);
        console.log("✅ Photo validée:", validation);
        
        // Lancer l'analyse faciale automatique
        await analyzeFacialLandmarks(imageUrl);
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

  // 🔮 UPLOAD AVEC EFFET NEURAL
  const handleUpload = async () => {
    if (selectedFile && previewUrl) {
      try {
        setShowNeuralAnalysis(true);
        setAnalysisProgress(0);

        // Simulation d'analyse neurale
        for (let i = 0; i <= 100; i += 20) {
          setAnalysisProgress(i);
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        const validation = await validateImageForFaceRecognition(previewUrl);

        if (validation.score < 50) {
          const shouldProceed = window.confirm(
            `Cette photo n'est pas optimale (score: ${
              validation.score
            }%). \n\nConseils:\n• ${validation.issues.join(
              "\n• "
            )}\n\nVoulez-vous quand même l'utiliser ?`
          );

          if (!shouldProceed) {
            setShowNeuralAnalysis(false);
            return;
          }
        }

        let imageToProcess = previewUrl;
        if (validation.score < 60) {
          console.log("🔄 Utilisation de l'image originale (score faible)");
          imageToProcess = previewUrl;
        } else {
          imageToProcess = await preprocessImage(previewUrl);
        }

        // Finaliser l'analyse
        setAnalysisProgress(100);
        await new Promise(resolve => setTimeout(resolve, 500));
        
        onPhotoUpload(imageToProcess);
        
      } catch (error) {
        console.warn("⚠️ Validation échouée mais continuation:", error);
        onPhotoUpload(previewUrl);
      } finally {
        setTimeout(() => {
          setShowNeuralAnalysis(false);
        }, 1000);
      }
    }
  };

  // 🔮 PRÉ-TRAITEMENT DE L'IMAGE
  const preprocessImage = (imageUrl) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = function () {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        const targetSize = 500;
        const scale = Math.min(
          targetSize / this.width,
          targetSize / this.height
        );

        canvas.width = this.width * scale;
        canvas.height = this.height * scale;

        ctx.drawImage(this, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
          const contrastFactor = 1.1;
          data[i] = Math.min(255, Math.max(0, (data[i] - 128) * contrastFactor + 128));
          data[i + 1] = Math.min(255, Math.max(0, (data[i + 1] - 128) * contrastFactor + 128));
          data[i + 2] = Math.min(255, Math.max(0, (data[i + 2] - 128) * contrastFactor + 128));

          const brightnessAdjust = 5;
          data[i] = Math.min(255, data[i] + brightnessAdjust);
          data[i + 1] = Math.min(255, data[i + 1] + brightnessAdjust);
          data[i + 2] = Math.min(255, data[i + 2] + brightnessAdjust);
        }

        ctx.putImageData(imageData, 0, 0);
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
    setShowNeuralAnalysis(false);
    setFaceLandmarks(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // 🔮 INDICATEUR DE QUALITÉ
  const getQualityText = (score) => {
    if (score >= 80) return "Excellente";
    if (score >= 60) return "Bonne";
    if (score >= 40) return "Acceptable";
    return "À améliorer";
  };

  const getQualityColor = (score) => {
    if (score >= 80) return "#10b981";
    if (score >= 60) return "#f59e0b";
    if (score >= 40) return "#fbbf24";
    return "#ef4444";
  };

  return (
    <div className="upload-photo-container">
      <div className="upload-header">
        <h3>📁 Uploader une Photo</h3>
        <p>Sélectionnez une photo optimale pour la reconnaissance faciale</p>
      </div>

      {/* Zone de drag & drop avec overlay neural */}
      <div
        className={`upload-zone ${dragActive ? "drag-active" : ""} ${
          previewUrl ? "has-preview" : ""
        } ${validationError ? "has-error" : ""} ${
          showNeuralAnalysis ? "neural-analysis-active" : ""
        }`}
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

        {/* Overlay d'analyse neurale */}
        {showNeuralAnalysis && previewUrl && (
          <div className="neural-analysis-overlay">
            <div className="neural-grid">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="grid-line horizontal" 
                  style={{ top: `${(i + 1) * 12}%` }} />
              ))}
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="grid-line vertical" 
                  style={{ left: `${(i + 1) * 12}%` }} />
              ))}
            </div>

            {neuralActivity.map(activity => (
              <div
                key={activity.id}
                className="neural-node"
                style={{
                  left: `${activity.x}%`,
                  top: `${activity.y}%`,
                  animationDelay: `${activity.delay}ms`,
                  opacity: activity.intensity / 100
                }}
              />
            ))}

            <div className="analysis-progress">
              <div className="progress-text">
                <span>🌀 Analyse Neurale</span>
                <span className="progress-percent">{analysisProgress}%</span>
              </div>
              <div className="progress-bar">
                <div 
                  className="progress-fill"
                  style={{ width: `${analysisProgress}%` }}
                ></div>
              </div>
              <div className="analysis-status">
                {analysisProgress < 100 ? "Décryptage biométrique..." : "Signature verrouillée"}
              </div>
            </div>
          </div>
        )}

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

            <div className="preview-image-container">
              <img src={previewUrl} alt="Aperçu" className="preview-image" />
              
              {/* Canvas pour les landmarks */}
              <canvas
                ref={canvasRef}
                className="landmarks-canvas"
              />
            </div>

            <div className="file-info">
              <span className="file-name">{selectedFile.name}</span>
              <span className="file-size">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </span>
            </div>

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

      {validationError && (
        <div className="validation-error">
          <div className="error-icon">⚠️</div>
          <div className="error-content">
            <strong>Problème détecté :</strong>
            <p>{validationError}</p>
          </div>
        </div>
      )}

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
                <>🌀 Analyser la signature biométrique</>
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
      </div>
    </div>
  );
};

export default UploadPhoto;