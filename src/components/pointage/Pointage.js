import React, { useState, useEffect, useRef, useCallback } from "react";
import Webcam from "react-webcam";
import UploadPhoto from "./UploadPhoto";
import {
  detectFaceAndComputeEmbedding,
  loadModels,
  getLoadedModels,
} from "../../utils/faceDetection";
import { AdvancedRecognitionSystem } from "../../utils/advancedRecognition";
import { db } from "../../config/firebase";
import {
  collection,
  getDocs,
  addDoc,
  query,
  where,
  orderBy,
  limit,
} from "firebase/firestore";
import "../styles/Pointage.css";

const Pointage = ({ user }) => {
  const webcamRef = useRef(null);
  const [isScanning, setIsScanning] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [employe, setEmploye] = useState(null);
  const [autoCapture, setAutoCapture] = useState(true);
  const [modelsReady, setModelsReady] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [employesCount, setEmployesCount] = useState(0);
  const [activeMode, setActiveMode] = useState("camera");
  const [showResultModal, setShowResultModal] = useState(false);
  const [showUnrecognizedModal, setShowUnrecognizedModal] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(true);

  // États pour le feedback temps réel
  const [faceQuality, setFaceQuality] = useState(0);
  const [detectionFeedback, setDetectionFeedback] = useState("");
  const [facePosition, setFacePosition] = useState({ x: 0, y: 0, size: 0 });
  const [isFaceDetected, setIsFaceDetected] = useState(false);

  const intervalRef = useRef(null);

  // Charger les modèles et vérifier les employés
  // 🔥 Dans useEffect d'initialisation
  useEffect(() => {
    const initializeSystem = async () => {
      try {
        console.log("🔄 Initialisation du système...");

        const modelsLoaded = await loadModels();
        setModelsReady(modelsLoaded);

        // 🔥 NOUVEAU: Afficher les modèles chargés
        if (modelsLoaded && getLoadedModels) {
          const loadedModels = getLoadedModels();
          console.log("✅ Modèles chargés:", loadedModels);

          if (!loadedModels.recognition) {
            setLastResult({
              type: "warning",
              message: "Système en mode basique - Fonctionnalités limitées",
            });
          }
        }

        if (modelsLoaded) {
          await checkEmployesEnroles();
        }
      } catch (error) {
        console.error("❌ Erreur initialisation:", error);
        setLastResult({
          type: "error",
          message: "Erreur initialisation: " + error.message,
        });
      }
    };

    initializeSystem();
  }, []);

  // Vérifier les employés enrôlés - FIREBASE
  const checkEmployesEnroles = async () => {
    try {
      const q = query(
        collection(db, "employes"),
        where("embedding_facial", "!=", null)
      );
      const querySnapshot = await getDocs(q);

      const employesAvecEmbedding = querySnapshot.docs.filter((doc) => {
        const data = doc.data();
        return (
          data.embedding_facial &&
          Array.isArray(data.embedding_facial) &&
          data.embedding_facial.length > 0
        );
      });

      setEmployesCount(employesAvecEmbedding.length);

      if (employesAvecEmbedding.length === 0) {
        setLastResult({
          type: "warning",
          message:
            "Aucun employé enrôlé. Veuillez enrôler des employés d'abord.",
        });
      }
    } catch (error) {
      console.error("Erreur vérification employés:", error);
    }
  };

  // 🔥 CORRECTION: Fonction checkFaceQuality optimisée
  const checkFaceQuality = useCallback(async () => {
    if (!webcamRef.current || !modelsReady || !cameraReady || !cameraEnabled) {
      setDetectionFeedback("⏳ Initialisation...");
      return;
    }

    try {
      const imageSrc = webcamRef.current.getScreenshot();
      if (!imageSrc) {
        setDetectionFeedback("📸 Capture en cours...");
        return;
      }

      // 🔥 DÉTECTION RAPIDE uniquement
      const embedding = await detectFaceAndComputeEmbedding(imageSrc);

      setFaceQuality(85); // 🔥 Qualité haute si détection réussie
      setIsFaceDetected(true);
      setDetectionFeedback("✅ Visage détecté - Prêt !");

      // Position par défaut centrée
      setFacePosition({ x: 50, y: 50, size: 35 });
    } catch (error) {
      setIsFaceDetected(false);
      setFaceQuality(0);

      if (error.message.includes("Aucun visage détecté")) {
        setDetectionFeedback("❌ Aucun visage - Centrez-vous");
      } else {
        setDetectionFeedback("⚠️ Approchez-vous de la caméra");
      }
    }
  }, [modelsReady, cameraReady, cameraEnabled]);

  // 🔥 CORRECTION: Intervalle optimisé
  useEffect(() => {
    if (
      cameraReady &&
      modelsReady &&
      cameraEnabled &&
      activeMode === "camera"
    ) {
      console.log("🔧 Démarrage surveillance qualité...");
      const interval = setInterval(checkFaceQuality, 2500); // 🔥 2.5 secondes

      return () => {
        clearInterval(interval);
      };
    } else {
      setIsFaceDetected(false);
      setFaceQuality(0);
      setDetectionFeedback("");
    }
  }, [cameraReady, modelsReady, cameraEnabled, activeMode, checkFaceQuality]); // 🔥 checkFaceQuality dans les dépendances

  // 🔥 CORRECTION: Capture manuelle améliorée
  const handleManualCapture = async () => {
    if (!modelsReady || !cameraReady || employesCount === 0) {
      setLastResult({
        type: "error",
        message: "Système non prêt pour la reconnaissance",
      });
      return;
    }

    // 🔥 SEUIL PLUS BAS pour capture manuelle
    if (faceQuality < 20) {
      setLastResult({
        type: "warning",
        message: "Positionnez votre visage dans le cadre",
      });
      return;
    }

    await captureAndRecognize();
  };

  // Gestion du scan automatique
  const startAutoScan = () => {
    if (
      intervalRef.current ||
      !modelsReady ||
      !cameraReady ||
      employesCount === 0 ||
      activeMode !== "camera" ||
      showResultModal ||
      showUnrecognizedModal ||
      !cameraEnabled
    )
      return;

    intervalRef.current = setInterval(async () => {
      if (
        !isScanning &&
        webcamRef.current &&
        !showResultModal &&
        !showUnrecognizedModal &&
        cameraEnabled &&
        faceQuality > 50
      ) {
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
    if (
      autoCapture &&
      modelsReady &&
      cameraReady &&
      employesCount > 0 &&
      activeMode === "camera" &&
      !showResultModal &&
      !showUnrecognizedModal &&
      cameraEnabled
    ) {
      startAutoScan();
    } else {
      stopAutoScan();
    }

    return () => stopAutoScan();
  }, [
    autoCapture,
    isScanning,
    modelsReady,
    cameraReady,
    employesCount,
    activeMode,
    showResultModal,
    showUnrecognizedModal,
    cameraEnabled,
    faceQuality,
  ]);

  // Fonction améliorée de reconnaissance
  const processFaceRecognition = async (imageSrc) => {
    if (!modelsReady) {
      throw new Error("Modèles de reconnaissance non chargés");
    }

    if (employesCount === 0) {
      throw new Error("Aucun employé enrôlé dans le système");
    }

    console.log("🎭 Lancement de la reconnaissance avancée...");

    // Récupérer les employés depuis FIRESTORE
    const q = query(
      collection(db, "employes"),
      where("embedding_facial", "!=", null)
    );

    const querySnapshot = await getDocs(q);
    const employes = querySnapshot.docs
      .map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
      .filter(
        (emp) =>
          emp.embedding_facial &&
          Array.isArray(emp.embedding_facial) &&
          emp.embedding_facial.length > 0
      );

    if (!employes || employes.length === 0) {
      throw new Error("Aucun employé enrôlé dans le système");
    }

    console.log(`📊 ${employes.length} employés chargés depuis Firestore`);

    // Utiliser le système de reconnaissance avancé
    const recognitionSystem = new AdvancedRecognitionSystem();
    const { bestMatch, bestSimilarity } =
      await recognitionSystem.processRecognition(imageSrc, employes);

    if (!bestMatch) {
      throw new Error(
        "Aucun employé reconnu. Essayez de mieux vous positionner face à la caméra."
      );
    }

    return { bestMatch, bestSimilarity, imageSrc };
  };

  // Capture depuis la caméra
  const captureAndRecognize = async () => {
    if (
      !webcamRef.current ||
      isScanning ||
      !modelsReady ||
      !cameraReady ||
      showResultModal ||
      showUnrecognizedModal ||
      !cameraEnabled
    )
      return;

    setIsScanning(true);

    try {
      console.log("📸 Capture depuis la caméra...");
      const imageSrc = webcamRef.current.getScreenshot();
      if (!imageSrc) throw new Error("Impossible de capturer l'image");

      const {
        bestMatch,
        bestSimilarity,
        imageSrc: capturedImage,
      } = await processFaceRecognition(imageSrc);

      console.log(
        `✅ ${bestMatch.nom} reconnu (${(bestSimilarity * 100).toFixed(1)}%)`
      );
      await enregistrerPointage(bestMatch, bestSimilarity, capturedImage);
      setEmploye(bestMatch);

      setShowResultModal(true);
      stopAutoScan();
    } catch (error) {
      console.log("❌ Erreur reconnaissance:", error.message);

      if (
        error.message.includes("Aucun visage détecté") ||
        error.message.includes("Aucun employé reconnu") ||
        error.message.includes("Qualité du visage insuffisante")
      ) {
        setShowUnrecognizedModal(true);
        stopAutoScan();
      }
    } finally {
      setIsScanning(false);
    }
  };

  // Upload depuis un fichier
  const handlePhotoUpload = async (imageSrc) => {
    if (isScanning) return;

    setIsScanning(true);

    try {
      console.log("📁 Analyse de la photo uploadée...");

      const {
        bestMatch,
        bestSimilarity,
        imageSrc: uploadedImage,
      } = await processFaceRecognition(imageSrc);

      console.log(
        `✅ ${bestMatch.nom} reconnu (${(bestSimilarity * 100).toFixed(1)}%)`
      );
      await enregistrerPointage(bestMatch, bestSimilarity, uploadedImage);
      setEmploye(bestMatch);
      setShowResultModal(true);
    } catch (error) {
      console.error("❌ Erreur reconnaissance:", error);

      if (error.message.includes("Aucun employé reconnu")) {
        setShowUnrecognizedModal(true);
      } else {
        setLastResult({
          type: "error",
          message: error.message,
        });
      }
    } finally {
      setIsScanning(false);
    }
  };

  // Enregistrement pointage - FIREBASE
  const enregistrerPointage = async (employe, confidence, photoCapture) => {
    try {
      // Récupérer le dernier pointage - FIRESTORE
      const q = query(
        collection(db, "pointages"),
        where("employe_id", "==", employe.id),
        orderBy("timestamp", "desc"),
        limit(1)
      );
      const querySnapshot = await getDocs(q);

      const dernierPointage = querySnapshot.docs[0]?.data();
      const type = dernierPointage?.type === "entrée" ? "sortie" : "entrée";

      // Enregistrer le nouveau pointage - FIRESTORE
      await addDoc(collection(db, "pointages"), {
        employe_id: employe.id,
        type: type,
        photo_capture_url: photoCapture,
        confidence: parseFloat(confidence.toFixed(4)),
        timestamp: new Date(),
        employe_nom: employe.nom,
        employe_email: employe.email,
      });

      console.log(`📝 Pointage ${type} enregistré pour ${employe.nom}`);
    } catch (error) {
      console.error("❌ Erreur enregistrement:", error);
      throw error;
    }
  };

  const handleCloseModal = () => {
    setShowResultModal(false);
    setShowUnrecognizedModal(false);
    setEmploye(null);
    if (
      autoCapture &&
      modelsReady &&
      cameraReady &&
      employesCount > 0 &&
      activeMode === "camera" &&
      cameraEnabled
    ) {
      startAutoScan();
    }
  };

  const handleCloseUnrecognizedModal = () => {
    setShowUnrecognizedModal(false);
    if (
      autoCapture &&
      modelsReady &&
      cameraReady &&
      employesCount > 0 &&
      activeMode === "camera" &&
      cameraEnabled
    ) {
      startAutoScan();
    }
  };

  const handleCameraReady = () => {
    console.log("✅ Caméra prête");
    setCameraReady(true);
  };

  const handleCameraError = (error) => {
    console.error("❌ Erreur caméra:", error);
    setCameraReady(false);
  };

  const toggleCamera = () => {
    setCameraEnabled(!cameraEnabled);
    if (!cameraEnabled) {
      if (
        autoCapture &&
        modelsReady &&
        cameraReady &&
        employesCount > 0 &&
        activeMode === "camera"
      ) {
        startAutoScan();
      }
    } else {
      stopAutoScan();
    }
  };

  const videoConstraints = {
    width: 640,
    height: 480,
    facingMode: "user",
  };

  return (
    <div className="pointage-page">
      {/* Header Section */}
      <div className="pointage-hero">
        <div className="hero-content">
          <div className="hero-icon">👨‍💼</div>
          <div className="hero-text">
            <h1>Pointage Intelligent</h1>
            <p>Reconnaissance faciale automatique pour votre équipe</p>
          </div>
        </div>
        <div className="hero-stats">
          <div className="stat-card">
            <div className="stat-value">{employesCount}</div>
            <div className="stat-label">Employés enrôlés</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{modelsReady ? "✓" : "..."}</div>
            <div className="stat-label">Système IA</div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="pointage-content">
        {/* Mode Selector */}
        <div className="mode-selector-card">
          <div className="mode-header">
            <h3>Mode de Reconnaissance</h3>
            <p>Choisissez votre méthode de pointage</p>
          </div>
          <div className="mode-buttons">
            <button
              className={`mode-btn ${activeMode === "camera" ? "active" : ""}`}
              onClick={() => setActiveMode("camera")}
            >
              <div className="mode-icon">📷</div>
              <div className="mode-info">
                <div className="mode-title">Caméra Live</div>
                <div className="mode-desc">Reconnaissance automatique</div>
              </div>
            </button>
            <button
              className={`mode-btn ${activeMode === "upload" ? "active" : ""}`}
              onClick={() => setActiveMode("upload")}
            >
              <div className="mode-icon">📁</div>
              <div className="mode-info">
                <div className="mode-title">Upload Photo</div>
                <div className="mode-desc">Depuis un fichier</div>
              </div>
            </button>
          </div>
        </div>

        {/* System Status */}
        <div className="status-grid">
          <div
            className={`status-card ${
              modelsReady ? "status-success" : "status-loading"
            }`}
          >
            <div className="status-icon">{modelsReady ? "🤖" : "⏳"}</div>
            <div className="status-content">
              <div className="status-title">Modèles IA</div>
              <div className="status-value">
                {modelsReady ? "Prêts" : "Chargement..."}
              </div>
            </div>
          </div>

          <div
            className={`status-card ${
              employesCount > 0 ? "status-success" : "status-warning"
            }`}
          >
            <div className="status-icon">{employesCount > 0 ? "👥" : "⚠️"}</div>
            <div className="status-content">
              <div className="status-title">Employés</div>
              <div className="status-value">{employesCount} enrôlé(s)</div>
            </div>
          </div>

          {activeMode === "camera" && (
            <div
              className={`status-card ${
                cameraReady ? "status-success" : "status-loading"
              }`}
            >
              <div className="status-icon">{cameraReady ? "📹" : "⏳"}</div>
              <div className="status-content">
                <div className="status-title">Caméra</div>
                <div className="status-value">
                  {cameraReady
                    ? cameraEnabled
                      ? "Active"
                      : "Désactivée"
                    : "Initialisation..."}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Camera/Upload Section */}
        {activeMode === "camera" ? (
          <div className="camera-section">
            <div className="camera-container">
              <div className="camera-header">
                <h4>Caméra de Reconnaissance</h4>
                <div className="camera-indicators">
                  <div
                    className={`indicator ${
                      cameraReady && cameraEnabled ? "active" : ""
                    }`}
                  >
                    <div className="indicator-dot"></div>
                    Caméra{" "}
                    {cameraReady
                      ? cameraEnabled
                        ? "Active"
                        : "Désactivée"
                      : "En attente"}
                  </div>
                  <div
                    className={`indicator ${
                      autoCapture && cameraEnabled ? "active" : ""
                    }`}
                  >
                    <div className="indicator-dot"></div>
                    Scan {autoCapture ? "Auto" : "Manuel"}
                  </div>
                  <div
                    className={`indicator ${isFaceDetected ? "active" : ""}`}
                  >
                    <div className="indicator-dot"></div>
                    Visage {isFaceDetected ? "Détecté" : "Non détecté"}
                  </div>
                </div>
              </div>

              <div className="camera-view">
                {cameraEnabled ? (
                  <>
                    <Webcam
                      audio={false}
                      ref={webcamRef}
                      screenshotFormat="image/jpeg"
                      videoConstraints={videoConstraints}
                      className="webcam-feed"
                      mirrored={true}
                      onUserMedia={handleCameraReady}
                      onUserMediaError={handleCameraError}
                    />

                    {/* Overlay de détection en temps réel */}
                    {cameraReady && (
                      <div className="detection-overlay">
                        {/* Cadre de guidage */}
                        <div className="guide-frame"></div>

                        {/* Indicateur de position du visage */}
                        {isFaceDetected && (
                          <div
                            className="face-indicator"
                            style={{
                              left: `${facePosition.x}%`,
                              top: `${facePosition.y}%`,
                              width: `${facePosition.size}%`,
                              height: `${facePosition.size}%`,
                            }}
                          >
                            <div className="face-pulse"></div>
                          </div>
                        )}

                        {/* Barre de qualité */}
                        <div className="quality-indicator">
                          <div className="quality-label">
                            {detectionFeedback}
                          </div>
                          <div className="quality-bar">
                            <div
                              className="quality-fill"
                              style={{ width: `${faceQuality}%` }}
                            ></div>
                          </div>
                          <div className="quality-percentage">
                            {faceQuality > 0
                              ? `${Math.round(faceQuality)}%`
                              : "--%"}
                          </div>
                        </div>
                      </div>
                    )}

                    {(!cameraReady || isScanning) && (
                      <div className="camera-overlay">
                        {!cameraReady && (
                          <div className="overlay-content">
                            <div className="loading-spinner large"></div>
                            <p>Initialisation de la caméra...</p>
                          </div>
                        )}

                        {cameraReady && isScanning && (
                          <div className="overlay-content scanning">
                            <div className="scan-animation"></div>
                            <p>Analyse faciale en cours...</p>
                          </div>
                        )}
                      </div>
                    )}

                    {cameraReady && !isScanning && autoCapture && (
                      <div className="auto-scan-indicator">
                        <div className="scan-pulse"></div>
                        <span>Scan automatique actif</span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="camera-disabled">
                    <div className="camera-off-icon">📷</div>
                    <h3>Caméra Désactivée</h3>
                    <p>La caméra est actuellement désactivée</p>
                    <button
                      className="enable-camera-btn"
                      onClick={toggleCamera}
                    >
                      <span className="button-icon">🔓</span>
                      Activer la Caméra
                    </button>
                  </div>
                )}
              </div>

              {/* Camera Controls */}
              <div className="camera-controls">
                <div className="camera-toggle-section">
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={cameraEnabled}
                      onChange={toggleCamera}
                    />
                    <span className="toggle-slider"></span>
                    <span className="toggle-label">
                      Caméra {cameraEnabled ? "Activée" : "Désactivée"}
                    </span>
                  </label>
                </div>

                <div className="auto-toggle">
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={autoCapture}
                      onChange={(e) => setAutoCapture(e.target.checked)}
                      disabled={
                        !modelsReady ||
                        !cameraReady ||
                        employesCount === 0 ||
                        !cameraEnabled
                      }
                    />
                    <span className="toggle-slider"></span>
                    <span className="toggle-label">
                      Détection automatique
                      <span className="toggle-sublabel">
                        {autoCapture ? "Active (toutes les 3s)" : "Manuelle"}
                      </span>
                    </span>
                  </label>
                </div>

                <button
                  onClick={handleManualCapture}
                  disabled={
                    isScanning ||
                    !modelsReady ||
                    !cameraReady ||
                    employesCount === 0 ||
                    showResultModal ||
                    showUnrecognizedModal ||
                    !cameraEnabled ||
                    faceQuality < 30
                  }
                  className="scan-button primary"
                >
                  {isScanning ? (
                    <>
                      <div className="button-loader"></div>
                      Analyse en cours...
                    </>
                  ) : (
                    <>
                      <span className="button-icon">🔍</span>
                      Scanner maintenant
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Upload Section */
          <div className="upload-section">
            <UploadPhoto
              onPhotoUpload={handlePhotoUpload}
              isProcessing={isScanning}
            />
          </div>
        )}

        {/* Modal de résultat - Visage reconnu */}
        {showResultModal && employe && (
          <div className="modal-overlay">
            <div className="result-modal">
              <div className="modal-header">
                <div className="modal-icon success">✅</div>
                <div className="modal-title">
                  <h3>Pointage Enregistré !</h3>
                  <p>Reconnaissance faciale réussie</p>
                </div>
                <button className="modal-close" onClick={handleCloseModal}>
                  ×
                </button>
              </div>

              <div className="modal-content">
                <div className="employee-info">
                  <div className="employee-avatar">
                    {employe.photo_url ? (
                      <img src={employe.photo_url} alt={employe.nom} />
                    ) : (
                      <div className="avatar-placeholder">
                        {employe.nom.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="employee-details">
                    <h4>{employe.nom}</h4>
                    <p className="employee-email">{employe.email}</p>
                    <div className="pointage-time">
                      {new Date().toLocaleString("fr-FR", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                </div>

                <div className="pointage-info">
                  <div className="info-card">
                    <div className="info-icon">👤</div>
                    <div className="info-content">
                      <div className="info-label">ID Employé</div>
                      <div className="info-value">#{employe.id}</div>
                    </div>
                  </div>
                  <div className="info-card">
                    <div className="info-icon">📊</div>
                    <div className="info-content">
                      <div className="info-label">Type de Pointage</div>
                      <div className="info-value">Entrée</div>
                    </div>
                  </div>
                </div>

                <div className="success-message">
                  <p>Votre pointage a été enregistré avec succès.</p>
                </div>
              </div>

              <div className="modal-actions">
                <button className="confirm-button" onClick={handleCloseModal}>
                  <span className="button-icon">👌</span>
                  Compris, retour à la caméra
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de résultat - Visage non reconnu */}
        {showUnrecognizedModal && (
          <div className="modal-overlay">
            <div className="result-modal unrecognized">
              <div className="modal-header">
                <div className="modal-icon error">❌</div>
                <div className="modal-title">
                  <h3>Reconnaissance Échouée</h3>
                  <p>Le système n'a pas pu vous identifier</p>
                </div>
                <button
                  className="modal-close"
                  onClick={handleCloseUnrecognizedModal}
                >
                  ×
                </button>
              </div>

              <div className="modal-content">
                <div className="unrecognized-content">
                  <div className="unrecognized-icon">👤</div>
                  <div className="unrecognized-text">
                    <h4>Conseils d'amélioration :</h4>
                    <div className="improvement-tips">
                      <div
                        className={`tip-item ${
                          faceQuality < 50 ? "highlight" : ""
                        }`}
                      >
                        <span className="tip-icon">💡</span>
                        <div className="tip-content">
                          <strong>Améliorez l'éclairage</strong>
                          <p>Placez-vous face à la lumière naturelle</p>
                        </div>
                      </div>
                      <div
                        className={`tip-item ${
                          facePosition.size < 20 ? "highlight" : ""
                        }`}
                      >
                        <span className="tip-icon">📏</span>
                        <div className="tip-content">
                          <strong>Approchez-vous</strong>
                          <p>Distance idéale : 1 à 2 mètres</p>
                        </div>
                      </div>
                      <div className="tip-item">
                        <span className="tip-icon">🎯</span>
                        <div className="tip-content">
                          <strong>Regardez droit</strong>
                          <p>Maintenez un contact visuel avec la caméra</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="technical-info">
                  <details>
                    <summary>Informations techniques</summary>
                    <p>Le système de reconnaissance faciale nécessite :</p>
                    <ul>
                      <li>Un visage clairement visible et bien éclairé</li>
                      <li>Une résolution d'image suffisante</li>
                      <li>Un angle de vue frontal</li>
                      <li>Aucune obstruction du visage</li>
                    </ul>
                  </details>
                </div>
              </div>

              <div className="modal-actions">
                <button
                  className="confirm-button"
                  onClick={handleCloseUnrecognizedModal}
                >
                  <span className="button-icon">🔄</span>
                  Réessayer la reconnaissance
                </button>
                {activeMode === "camera" && (
                  <button
                    className="confirm-button secondary"
                    onClick={() => {
                      setCameraEnabled(false);
                      handleCloseUnrecognizedModal();
                    }}
                  >
                    <span className="button-icon">📷</span>
                    Désactiver la caméra
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Messages d'erreur (uniquement pour le mode upload) */}
        {lastResult && activeMode === "upload" && (
          <div className={`result-panel ${lastResult.type}`}>
            <div className="result-header">
              <div className="result-icon">
                {lastResult.type === "success"
                  ? "✅"
                  : lastResult.type === "error"
                  ? "❌"
                  : "⚠️"}
              </div>
              <div className="result-content">
                <h4>{lastResult.message}</h4>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Pointage;
