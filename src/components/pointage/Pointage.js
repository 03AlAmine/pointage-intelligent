import React, { useState, useEffect, useRef, useCallback } from "react";
import Webcam from "react-webcam";
import UploadPhoto from "./UploadPhoto";
import * as faceapi from "face-api.js";
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
  serverTimestamp,
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

  // 🔥 SIMPLIFICATION des états de détection
  const [detectionStatus, setDetectionStatus] = useState("initializing"); // 'initializing', 'no_face', 'detected', 'good_quality'
  const [facePosition, setFacePosition] = useState({ x: 50, y: 50, size: 30 });

  const intervalRef = useRef(null);

  // 🔥 INITIALISATION SIMPLIFIÉE
  useEffect(() => {
    const initializeSystem = async () => {
      try {
        console.log("🔄 Initialisation du système de pointage...");

        // Charger les modèles
        const modelsLoaded = await loadModels();
        setModelsReady(modelsLoaded);

        if (modelsLoaded) {
          await checkEmployesEnroles();
        } else {
          setLastResult({
            type: "error",
            message: "Échec du chargement des modèles IA",
          });
        }
      } catch (error) {
        console.error("❌ Erreur initialisation:", error);
        setLastResult({
          type: "error",
          message: "Erreur d'initialisation: " + error.message,
        });
      }
    };

    initializeSystem();
  }, []);

  // 🔥 VÉRIFICATION EMPLOYÉS OPTIMISÉE
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
      } else {
        console.log(`✅ ${employesAvecEmbedding.length} employé(s) enrôlé(s)`);
      }
    } catch (error) {
      console.error("❌ Erreur vérification employés:", error);
      setLastResult({
        type: "error",
        message: "Erreur de connexion à la base de données",
      });
    }
  };

  // 🔥 DÉTECTION DE QUALITÉ SIMPLIFIÉE
// 🔥 CORRECTION POUR LA NOUVELLE STRUCTURE
const checkFaceQuality = useCallback(async () => {
  if (!webcamRef.current || !modelsReady || !cameraReady || !cameraEnabled) {
    setDetectionStatus("initializing");
    return;
  }

  try {
    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) {
      setDetectionStatus("initializing");
      return;
    }

    // Chargement de l'image
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = imageSrc;
    });

    let detections = [];
    
    try {
      const detectionOptions = new faceapi.TinyFaceDetectorOptions({
        inputSize: 160,
        scoreThreshold: 0.3
      });

      detections = await faceapi.detectAllFaces(img, detectionOptions);
    } catch (detectionError) {
      console.warn("⚠️ Erreur détection faciale:", detectionError.message);
      setDetectionStatus("no_face");
      return;
    }

    // 🔥 VALIDATION CORRECTE POUR LA NOUVELLE STRUCTURE
    if (!detections || !Array.isArray(detections) || detections.length === 0) {
      setDetectionStatus("no_face");
      return;
    }

    let bestDetection = null;
    let bestScore = 0;

    for (const detection of detections) {
      // 🔥 UTILISER LES GETTERS CORRECTS
      if (!detection) {
        console.warn("⚠️ Détection null ignorée");
        continue;
      }

      try {
        // 🔥 UTILISER LES GETTERS COMME .box AU LIEU DE ._box
        const box = detection.box; // ✅ Getter correct
        const score = detection.score; // ✅ Getter correct
        
        if (!box || typeof score !== 'number') {
          console.warn("⚠️ Détection incomplète:", detection);
          continue;
        }

        // 🔥 VALIDATION DES PROPRIÉTÉS DE LA BOX
        const x = box.x;
        const y = box.y;
        const width = box.width;
        const height = box.height;

        if (typeof x !== 'number' || typeof y !== 'number' || 
            typeof width !== 'number' || typeof height !== 'number' ||
            width <= 0 || height <= 0 || 
            x < 0 || y < 0 || 
            x + width > 640 || y + height > 480) {
          console.warn("⚠️ Box invalide:", { x, y, width, height });
          continue;
        }

        // Calcul du score de qualité
        const faceSize = Math.max(width, height);
        const qualityScore = score * Math.min(faceSize / 200, 1);

        if (qualityScore > bestScore) {
          bestScore = qualityScore;
          bestDetection = detection;
        }

      } catch (error) {
        console.warn("⚠️ Erreur traitement détection:", error);
        continue;
      }
    }

    if (!bestDetection) {
      setDetectionStatus("no_face");
      return;
    }

    try {
      // 🔥 UTILISER LES GETTERS POUR LA MEILLEURE DÉTECTION
      const box = bestDetection.box;
      const score = bestDetection.score;
      
      const faceSize = Math.max(box.width, box.height);
      
      // 🔥 CRITÈRES DE QUALITÉ
      const isGoodQuality = 
        score > 0.5 && 
        faceSize > 80 && 
        faceSize < 400;

      setDetectionStatus(isGoodQuality ? "good_quality" : "detected");
      
      // 🔥 CALCUL DE LA POSITION
      const x = Math.max(0, Math.min(100, 50 - ((box.x + box.width / 2) / 640) * 100));
      const y = Math.max(0, Math.min(100, 50 - ((box.y + box.height / 2) / 480) * 100));
      const size = Math.max(10, Math.min(50, (faceSize / 480) * 100));

      setFacePosition({ x, y, size });

      console.log(`✅ Détection: score=${score.toFixed(2)}, taille=${Math.round(faceSize)}, qualité=${isGoodQuality ? 'bonne' : 'moyenne'}`);

    } catch (error) {
      console.warn("⚠️ Erreur traitement meilleure détection:", error);
      setDetectionStatus("no_face");
    }

  } catch (error) {
    console.log("⚠️ Erreur détection qualité:", error.message);
    setDetectionStatus("no_face");
    setFacePosition({ x: 50, y: 50, size: 30 });
  }
}, [modelsReady, cameraReady, cameraEnabled]);
  // 🔥 INTERVALLE DE DÉTECTION OPTIMISÉ
  useEffect(() => {
    if (
      cameraReady &&
      modelsReady &&
      cameraEnabled &&
      activeMode === "camera"
    ) {
      console.log("🔍 Démarrage surveillance caméra...");
      const interval = setInterval(checkFaceQuality, 2000); // 2 secondes

      return () => {
        clearInterval(interval);
      };
    } else {
      setDetectionStatus("initializing");
    }
  }, [cameraReady, modelsReady, cameraEnabled, activeMode, checkFaceQuality]);

  // 🔥 CAPTURE MANUELLE AMÉLIORÉE
  const handleManualCapture = async () => {
    if (!modelsReady || !cameraReady || employesCount === 0) {
      setLastResult({
        type: "error",
        message: "Système non prêt pour la reconnaissance",
      });
      return;
    }

    if (detectionStatus !== "good_quality") {
      setLastResult({
        type: "warning",
        message: "Positionnez votre visage correctement dans le cadre",
      });
      return;
    }

    await captureAndRecognize();
  };

  // 🔥 SCAN AUTOMATIQUE OPTIMISÉ
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
    ) {
      return;
    }

    intervalRef.current = setInterval(async () => {
      if (!isScanning && detectionStatus === "good_quality") {
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
    detectionStatus, // 🔥 Dépendance importante
  ]);

  // 🔥 RECONNAISSANCE FACIALE AMÉLIORÉE
  const processFaceRecognition = async (imageSrc) => {
    if (!modelsReady) {
      throw new Error("Modèles de reconnaissance non chargés");
    }

    if (employesCount === 0) {
      throw new Error("Aucun employé enrôlé dans le système");
    }

    console.log("🎭 Lancement de la reconnaissance faciale...");

    // Récupérer les employés depuis Firestore
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

    if (employes.length === 0) {
      throw new Error("Aucun employé avec embedding facial valide");
    }

    console.log(`📊 ${employes.length} employés chargés pour reconnaissance`);

    // Utiliser le système de reconnaissance
    const recognitionSystem = new AdvancedRecognitionSystem();
    const result = await recognitionSystem.processRecognition(
      imageSrc,
      employes
    );

    if (!result.bestMatch) {
      throw new Error("Aucun employé reconnu");
    }

    return result;
  };

  // 🔥 CAPTURE ET RECONNAISSANCE
  const captureAndRecognize = async () => {
    if (
      !webcamRef.current ||
      isScanning ||
      !modelsReady ||
      !cameraReady ||
      showResultModal ||
      showUnrecognizedModal ||
      !cameraEnabled
    ) {
      return;
    }

    setIsScanning(true);
    stopAutoScan(); // 🔥 Arrêter le scan pendant le traitement

    try {
      console.log("📸 Capture et reconnaissance...");
      const imageSrc = webcamRef.current.getScreenshot();
      if (!imageSrc) throw new Error("Impossible de capturer l'image");

      const result = await processFaceRecognition(imageSrc);

      console.log(
        `✅ ${result.bestMatch.nom} reconnu (${(
          result.bestSimilarity * 100
        ).toFixed(1)}%)`
      );

      await enregistrerPointage(
        result.bestMatch,
        result.bestSimilarity,
        imageSrc
      );
      setEmploye(result.bestMatch);
      setShowResultModal(true);
    } catch (error) {
      console.log("❌ Erreur reconnaissance:", error.message);

      if (
        error.message.includes("Aucun employé reconnu") ||
        error.message.includes("Aucun visage détecté") ||
        error.message.includes("correspondance")
      ) {
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

  // 🔥 UPLOAD DE PHOTO
  const handlePhotoUpload = async (imageSrc) => {
    if (isScanning) return;

    setIsScanning(true);

    try {
      console.log("📁 Analyse de la photo uploadée...");
      const result = await processFaceRecognition(imageSrc);

      console.log(
        `✅ ${result.bestMatch.nom} reconnu (${(
          result.bestSimilarity * 100
        ).toFixed(1)}%)`
      );

      await enregistrerPointage(
        result.bestMatch,
        result.bestSimilarity,
        imageSrc
      );
      setEmploye(result.bestMatch);
      setShowResultModal(true);
    } catch (error) {
      console.error("❌ Erreur reconnaissance upload:", error);

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

  // 🔥 ENREGISTREMENT POINTAGE CORRIGÉ
  const enregistrerPointage = async (employe, confidence, photoCapture) => {
    try {
      // 🔥 RÉCUPÉRER LE DERNIER POINTAGE
      const q = query(
        collection(db, "pointages"),
        where("employe_id", "==", employe.id),
        orderBy("timestamp", "desc"),
        limit(1)
      );

      const querySnapshot = await getDocs(q);
      const dernierPointage = querySnapshot.docs[0]?.data();

      // 🔥 DÉTERMINER LE TYPE DE POINTAGE
      let type = "entrée"; // Par défaut

      if (dernierPointage) {
        const derniereDate = dernierPointage.timestamp.toDate();
        const maintenant = new Date();
        const diffHeures = (maintenant - derniereDate) / (1000 * 60 * 60);

        // Si dernier pointage < 4 heures, c'est une sortie
        if (dernierPointage.type === "entrée" && diffHeures < 4) {
          type = "sortie";
        }
        // Si dernier pointage était une sortie ou > 4h, c'est une entrée
        else {
          type = "entrée";
        }
      }

      console.log(`📝 Pointage ${type} pour ${employe.nom}`);

      // 🔥 ENREGISTRER LE NOUVEAU POINTAGE
      await addDoc(collection(db, "pointages"), {
        employe_id: employe.id,
        type: type,
        photo_capture_url: photoCapture,
        confidence: parseFloat(confidence.toFixed(4)),
        timestamp: serverTimestamp(), // 🔥 Utiliser serverTimestamp
        employe_nom: employe.nom,
        employe_email: employe.email,
        employe_poste: employe.poste || "Non spécifié",
        user_id: user?.uid || "system",
      });

      console.log(`✅ Pointage ${type} enregistré pour ${employe.nom}`);
    } catch (error) {
      console.error("❌ Erreur enregistrement pointage:", error);
      throw new Error("Erreur lors de l'enregistrement du pointage");
    }
  };

  // 🔥 GESTION MODALES SIMPLIFIÉE
  const handleCloseModal = () => {
    setShowResultModal(false);
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
    setLastResult({
      type: "error",
      message: "Erreur d'accès à la caméra",
    });
  };

  const toggleCamera = () => {
    setCameraEnabled(!cameraEnabled);
    if (cameraEnabled) {
      stopAutoScan();
    }
  };

  const videoConstraints = {
    width: 640,
    height: 480,
    facingMode: "user",
  };

  // 🔥 TEXTES POUR LA DÉTECTION
  const getDetectionText = () => {
    switch (detectionStatus) {
      case "initializing":
        return "⏳ Initialisation...";
      case "no_face":
        return "❌ Aucun visage détecté";
      case "detected":
        return "⚠️ Approchez-vous de la caméra";
      case "good_quality":
        return "✅ Visage détecté - Prêt !";
      default:
        return "⏳ Initialisation...";
    }
  };

  const getDetectionQuality = () => {
    switch (detectionStatus) {
      case "initializing":
        return 0;
      case "no_face":
        return 0;
      case "detected":
        return 50;
      case "good_quality":
        return 100;
      default:
        return 0;
    }
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
                    className={`indicator ${
                      detectionStatus === "good_quality" ? "active" : ""
                    }`}
                  >
                    <div className="indicator-dot"></div>
                    Visage{" "}
                    {detectionStatus === "good_quality"
                      ? "Détecté"
                      : "Non détecté"}
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

                    {/* Overlay de détection */}
                    {cameraReady && (
                      <div className="detection-overlay">
                        <div className="guide-frame"></div>

                        {detectionStatus !== "no_face" &&
                          detectionStatus !== "initializing" && (
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

                        <div className="quality-indicator">
                          <div className="quality-label">
                            {getDetectionText()}
                          </div>
                          <div className="quality-bar">
                            <div
                              className="quality-fill"
                              style={{ width: `${getDetectionQuality()}%` }}
                            ></div>
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
                    detectionStatus !== "good_quality"
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
          <div className="upload-section">
            <UploadPhoto
              onPhotoUpload={handlePhotoUpload}
              isProcessing={isScanning}
            />
          </div>
        )}

        {/* Modal de résultat */}
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

                <div className="success-message">
                  <p>Votre pointage a été enregistré avec succès.</p>
                  <p className="success-subtitle">Bon travail !</p>
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

        {/* Modal non reconnu */}
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
                    <h4>Conseils pour améliorer la reconnaissance :</h4>
                    <ul className="improvement-tips">
                      <li>✅ Assurez-vous d'être bien éclairé</li>
                      <li>✅ Regardez droit vers la caméra</li>
                      <li>✅ Approchez-vous suffisamment</li>
                      <li>✅ Enlevez lunettes de soleil/casquette</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="modal-actions">
                <button
                  className="confirm-button"
                  onClick={handleCloseUnrecognizedModal}
                >
                  <span className="button-icon">🔄</span>
                  Réessayer
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Pointage;
