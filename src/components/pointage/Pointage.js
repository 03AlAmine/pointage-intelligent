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
  const canvasRef = useRef(null);
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

  // 🔮 ÉTATS MYSTÉRIEUX
  const [detectionStatus, setDetectionStatus] = useState("initializing");
  const [faceLandmarks, setFaceLandmarks] = useState(null);
  const [scanProgress, setScanProgress] = useState(0);
  const [matrixEffect, setMatrixEffect] = useState(false);
  const [neuralActivity, setNeuralActivity] = useState([]);
  const [facePosition, setFacePosition] = useState({ x: 50, y: 50, size: 30 });

  const intervalRef = useRef(null);
  const animationRef = useRef(null);

  // 🔮 INITIALISATION AVEC EFFET MYSTÉRIEUX
  useEffect(() => {
    const initializeSystem = async () => {
      try {
        console.log("🌀 Initialisation du système neuro-visuel...");
        setMatrixEffect(true);

        // Effet de démarrage progressif
        for (let i = 0; i <= 100; i += 10) {
          setScanProgress(i);
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        const modelsLoaded = await loadModels();
        setModelsReady(modelsLoaded);

        if (modelsLoaded) {
          await checkEmployesEnroles();
          setScanProgress(100);
          setTimeout(() => setMatrixEffect(false), 2000);
        } else {
          throw new Error("Échec de la connexion neurale");
        }
      } catch (error) {
        console.error("❌ Rupture du flux de données:", error);
        setLastResult({
          type: "error",
          message: "Anomalie dans le réseau neuronal: " + error.message,
        });
        setMatrixEffect(false);
      }
    };

    initializeSystem();
  }, []);

  // 🔮 GÉNÉRATEUR D'ACTIVITÉ NEURALE
  const generateNeuralActivity = useCallback(() => {
    const activities = [];
    for (let i = 0; i < 8; i++) {
      activities.push({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        intensity: Math.random() * 100,
        delay: Math.random() * 2000
      });
    }
    setNeuralActivity(activities);
  }, []);

  // 🔮 DÉTECTION AVEC LANDMARKS EN TEMPS RÉEL
  const checkFaceQuality = useCallback(async () => {
    if (!webcamRef.current || !modelsReady || !cameraReady || !cameraEnabled) {
      setDetectionStatus("initializing");
      setFaceLandmarks(null);
      return;
    }

    try {
      const imageSrc = webcamRef.current.getScreenshot();
      if (!imageSrc) return;

      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = imageSrc;
      });

      // 🔮 DÉTECTION AVEC LANDMARKS
      const detectionOptions = new faceapi.TinyFaceDetectorOptions({
        inputSize: 160,
        scoreThreshold: 0.3
      });

      let detections = [];
      try {
        detections = await faceapi
          .detectAllFaces(img, detectionOptions)
          .withFaceLandmarks();
      } catch (detectionError) {
        console.warn("⚠️ Erreur détection faciale:", detectionError.message);
        setDetectionStatus("no_face");
        return;
      }

      if (!detections || detections.length === 0) {
        setDetectionStatus("no_face");
        setFaceLandmarks(null);
        return;
      }

      const bestDetection = detections[0];
      
      // 🔮 VALIDATION DE LA DÉTECTION
      const box = bestDetection.detection.box;
      const score = bestDetection.detection.score;
      
      if (!box || typeof score !== 'number') {
        setDetectionStatus("no_face");
        return;
      }

      const faceSize = Math.max(box.width, box.height);
      const isGoodQuality = score > 0.5 && faceSize > 80 && faceSize < 400;
      
      setDetectionStatus(isGoodQuality ? "good_quality" : "detected");
      
      // 🔮 CALCUL DE LA POSITION POUR L'OVERLAY
      const x = Math.max(0, Math.min(100, 50 - ((box.x + box.width / 2) / 640) * 100));
      const y = Math.max(0, Math.min(100, 50 - ((box.y + box.height / 2) / 480) * 100));
      const size = Math.max(10, Math.min(50, (faceSize / 480) * 100));
      setFacePosition({ x, y, size });

      // 🔮 EXTRACTION DES POINTS FACIAUX
      if (bestDetection.landmarks) {
        const landmarks = bestDetection.landmarks.positions.map(point => ({
          x: point.x,
          y: point.y,
          intensity: Math.random() * 80 + 20
        }));
        setFaceLandmarks(landmarks);
        
        // Générer de l'activité neurale quand un visage est détecté
        generateNeuralActivity();
      }

      // 🔮 DESSIN DES LANDMARKS EN TEMPS RÉEL
      drawRealTimeLandmarks(bestDetection);

    } catch (error) {
      console.log("⚠️ Interférence dans l'analyse:", error.message);
      setDetectionStatus("no_face");
      setFaceLandmarks(null);
    }
  }, [modelsReady, cameraReady, cameraEnabled, generateNeuralActivity]);

  // 🔮 DESSIN DES POINTS FACIAUX EN TEMPS RÉEL
  const drawRealTimeLandmarks = useCallback((detection) => {
    const canvas = canvasRef.current;
    if (!canvas || !detection || !detection.landmarks) return;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const landmarks = detection.landmarks.positions;
    
    // 🔮 CONNEXIONS MYSTÉRIEUSES ENTRE LES POINTS
    ctx.strokeStyle = '#00ff886f6f';
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.7;

    // Dessiner les connexions principales du visage
    drawFaceConnections(ctx, landmarks);

    // 🔮 POINTS LUMINEUX
    landmarks.forEach((point, index) => {
      const pulse = (Math.sin(Date.now() * 0.01 + index * 0.5) + 1) * 0.5;
      
      // Point central lumineux
      ctx.fillStyle = `rgba(0, 255, 136, ${0.3 + pulse * 0.7})`;
      ctx.beginPath();
      ctx.arc(point.x, point.y, 2 + pulse * 2, 0, Math.PI * 2);
      ctx.fill();

      // Aura énergétique
      ctx.strokeStyle = `rgba(0, 255, 136, ${0.1 + pulse * 0.2})`;
      ctx.beginPath();
      ctx.arc(point.x, point.y, 4 + pulse * 3, 0, Math.PI * 2);
      ctx.stroke();
    });

    // 🔮 RÉSEAU DE CONNEXIONS ALÉATOIRES
    drawNeuralNetwork(ctx, landmarks);
  }, []);

  // 🔮 DESSIN DES CONNEXIONS DU VISAGE
  const drawFaceConnections = (ctx, landmarks) => {
    // Contour du visage
    const faceOutline = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
    drawConnectedPath(ctx, landmarks, faceOutline, '#00ff886f6f');

    // Sourcils
    const leftEyebrow = [17, 18, 19, 20, 21];
    const rightEyebrow = [22, 23, 24, 25, 26];
    drawConnectedPath(ctx, landmarks, leftEyebrow, '#00ff886f6f');
    drawConnectedPath(ctx, landmarks, rightEyebrow, '#00ff886f6f');

    // Nez
    const noseBridge = [27, 28, 29, 30];
    const noseBottom = [31, 32, 33, 34, 35];
    drawConnectedPath(ctx, landmarks, noseBridge, '#00ff886f6f');
    drawConnectedPath(ctx, landmarks, noseBottom, '#00ff886f6f');

    // Yeux
    const leftEye = [36, 37, 38, 39, 40, 41];
    const rightEye = [42, 43, 44, 45, 46, 47];
    drawConnectedPath(ctx, landmarks, leftEye, '#00ff886f6f', true);
    drawConnectedPath(ctx, landmarks, rightEye, '#00ff886f6f', true);

    // Bouche
    const outerLips = [48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59];
    const innerLips = [60, 61, 62, 63, 64, 65, 66, 67];
    drawConnectedPath(ctx, landmarks, outerLips, '#00ff886f6f', true);
    drawConnectedPath(ctx, landmarks, innerLips, '#00ff886f6f', true);
  };

  // 🔮 DESSIN D'UN CHEMIN CONNECTÉ
  const drawConnectedPath = (ctx, landmarks, indices, color, closePath = false) => {
    ctx.strokeStyle = color;
    ctx.beginPath();
    
    indices.forEach((index, i) => {
      const point = landmarks[index];
      if (i === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.lineTo(point.x, point.y);
      }
    });

    if (closePath) {
      ctx.closePath();
    }
    
    ctx.stroke();
  };

  // 🔮 RÉSEAU NEURALE ALÉATOIRE
  const drawNeuralNetwork = (ctx, landmarks) => {
    ctx.strokeStyle = 'rgba(0, 255, 136, 0.1)';
    ctx.lineWidth = 0.5;

    // Créer des connexions aléatoires entre les points
    for (let i = 0; i < landmarks.length; i++) {
      for (let j = i + 1; j < landmarks.length; j++) {
        if (Math.random() < 0.1) { // 10% de chance de connexion
          const pointA = landmarks[i];
          const pointB = landmarks[j];
          const distance = Math.sqrt(
            Math.pow(pointA.x - pointB.x, 2) + Math.pow(pointA.y - pointB.y, 2)
          );

          if (distance < 100) { // Seulement les points proches
            const alpha = (100 - distance) / 100 * 0.3;
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

  // 🔮 INTERVALLE DE DÉTECTION OPTIMISÉ
  useEffect(() => {
    if (cameraReady && modelsReady && cameraEnabled && activeMode === "camera") {
      const interval = setInterval(checkFaceQuality, 100); // 10 FPS pour fluidité
      return () => clearInterval(interval);
    } else {
      setDetectionStatus("initializing");
      setFaceLandmarks(null);
    }
  }, [cameraReady, modelsReady, cameraEnabled, activeMode, checkFaceQuality]);

  // 🔮 ANIMATION CONTINUE POUR L'EFFET MYSTÉRIEUX
  useEffect(() => {
    const animate = () => {
      if (canvasRef.current && faceLandmarks) {
        // L'animation est gérée par drawRealTimeLandmarks
      }
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [faceLandmarks]);

  // 🔮 VÉRIFICATION DES EMPLOYÉS
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
          message: "Aucune signature neurale enregistrée. Procédez à l'enrôlement.",
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

  // 🔮 CAPTURE MANUELLE AMÉLIORÉE
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

  // 🔮 SCAN AUTOMATIQUE OPTIMISÉ
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
    detectionStatus,
  ]);

  // 🔮 RECONNAISSANCE FACIALE AMÉLIORÉE
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

  // 🔮 CAPTURE ET RECONNAISSANCE
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
    setMatrixEffect(true);
    stopAutoScan();

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
      setMatrixEffect(false);
    }
  };

  // 🔮 UPLOAD DE PHOTO
  const handlePhotoUpload = async (imageSrc) => {
    if (isScanning) return;

    setIsScanning(true);
    setMatrixEffect(true);

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
      setMatrixEffect(false);
    }
  };

  // 🔮 ENREGISTREMENT POINTAGE
  const enregistrerPointage = async (employe, confidence, photoCapture) => {
    try {
      const q = query(
        collection(db, "pointages"),
        where("employe_id", "==", employe.id),
        orderBy("timestamp", "desc"),
        limit(1)
      );

      const querySnapshot = await getDocs(q);
      const dernierPointage = querySnapshot.docs[0]?.data();

      let type = "entrée";
      if (dernierPointage) {
        const derniereDate = dernierPointage.timestamp.toDate();
        const maintenant = new Date();
        const diffHeures = (maintenant - derniereDate) / (1000 * 60 * 60);

        if (dernierPointage.type === "entrée" && diffHeures < 4) {
          type = "sortie";
        }
      }

      console.log(`📝 Pointage ${type} pour ${employe.nom}`);

      await addDoc(collection(db, "pointages"), {
        employe_id: employe.id,
        type: type,
        photo_capture_url: photoCapture,
        confidence: parseFloat(confidence.toFixed(4)),
        timestamp: serverTimestamp(),
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

  // 🔮 GESTION MODALES
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

  // 🔮 TEXTES MYSTÉRIEUX POUR LA DÉTECTION
  const getDetectionText = () => {
    switch (detectionStatus) {
      case "initializing":
        return "🌀 Calibration du réseau neuronal...";
      case "no_face":
        return "🔍 Recherche de signature biométrique...";
      case "detected":
        return "⚠️ Ajustez votre position";
      case "good_quality":
        return "✅ Signature neurale verrouillée";
      default:
        return "🌀 Initialisation du système...";
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
      {/* Effet Matrix */}
      {matrixEffect && (
        <div className="matrix-overlay">
          <div className="matrix-code">
            {Array.from({ length: 50 }).map((_, i) => (
              <div 
                key={i} 
                className="matrix-digit"
                style={{
                  left: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 5}s`,
                  animationDuration: `${1 + Math.random() * 2}s`
                }}
              >
                {Math.random() > 0.5 ? '1' : '0'}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Header Section */}
      <div className="pointage-hero">
        <div className="hero-content">
          <div className="hero-icon">🔮</div>
          <div className="hero-text">
            <h1>Système Neuro-Visuel</h1>
            <p>Identification par signature biométrique avancée</p>
          </div>
        </div>
        <div className="hero-stats">
          <div className="stat-card">
            <div className="stat-value">{employesCount}</div>
            <div className="stat-label">Signatures enregistrées</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{modelsReady ? "🌀" : "..."}</div>
            <div className="stat-label">Réseau Neuronal</div>
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
            <div className="status-icon">{modelsReady ? "🌀" : "⏳"}</div>
            <div className="status-content">
              <div className="status-title">Réseau Neuronal</div>
              <div className="status-value">
                {modelsReady ? "Actif" : "Chargement..."}
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
              <div className="status-title">Signatures</div>
              <div className="status-value">{employesCount} enregistrée(s)</div>
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
                <div className="status-title">Interface Visuelle</div>
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
                <h4>🌀 Interface Neuro-Visuelle</h4>
                <div className="camera-indicators">
                  <div
                    className={`indicator ${
                      cameraReady && cameraEnabled ? "active" : ""
                    }`}
                  >
                    <div className="indicator-dot"></div>
                    Flux visuel {cameraReady
                      ? cameraEnabled
                        ? "établi"
                        : "interrompu"
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
                    {getDetectionText()}
                  </div>
                </div>
              </div>

              <div className="camera-view">
                {cameraEnabled ? (
                  <div className="webcam-container">
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
                    
                    {/* Canvas pour les landmarks */}
                    <canvas
                      ref={canvasRef}
                      className="landmarks-canvas"
                      width={640}
                      height={480}
                    />

                    {/* Overlay d'analyse neurale */}
                    <div className="analysis-overlay">
                      <div className="neural-grid">
                        {Array.from({ length: 12 }).map((_, i) => (
                          <div key={i} className="grid-line horizontal" 
                            style={{ top: `${(i + 1) * 8}%` }} />
                        ))}
                        {Array.from({ length: 12 }).map((_, i) => (
                          <div key={i} className="grid-line vertical" 
                            style={{ left: `${(i + 1) * 8}%` }} />
                        ))}
                      </div>

                      {/* Points d'activité neurale */}
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

                      {/* Indicateur de qualité */}
                      <div className="quality-display">
                        <div className="quality-text">{getDetectionText()}</div>
                        <div className="signal-bars">
                          {[1, 2, 3, 4, 5].map(bar => (
                            <div
                              key={bar}
                              className={`signal-bar ${
                                detectionStatus === 'good_quality' ? 'active' : ''
                              }`}
                              style={{ animationDelay: `${bar * 0.1}s` }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Overlay de détection classique */}
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

                    {/* État de scan */}
                    {isScanning && (
                      <div className="scanning-overlay">
                        <div className="scanning-animation">
                          <div className="scan-ring outer"></div>
                          <div className="scan-ring middle"></div>
                          <div className="scan-ring inner"></div>
                          <div className="scan-text">
                            <div className="scan-dots">
                              <span>Analyse Neurale</span>
                              <span className="dot">.</span>
                              <span className="dot">.</span>
                              <span className="dot">.</span>
                            </div>
                            <div className="scan-subtitle">
                              Décryptage de la signature biométrique
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {cameraReady && !isScanning && autoCapture && (
                      <div className="auto-scan-indicator">
                        <div className="scan-pulse"></div>
                        <span>Scan automatique actif</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="camera-disabled">
                    <div className="camera-off-icon">🔒</div>
                    <h3>Interface verrouillée</h3>
                    <p>Activation requise pour l'accès neuro-visuel</p>
                    <button
                      className="enable-camera-btn"
                      onClick={toggleCamera}
                    >
                      <span className="button-icon">🔓</span>
                      Activer l'Interface
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
                      Interface {cameraEnabled ? "Activée" : "Désactivée"}
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
                      Déchiffrement en cours...
                    </>
                  ) : (
                    <>
                      <span className="button-icon">🔍</span>
                      Lancer l'analyse neurale
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
                  <h3>Signature Verrouillée</h3>
                  <p>Identification biométrique confirmée</p>
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
                  <p>Signature biométrique authentifiée avec succès.</p>
                  <p className="success-subtitle">Accès autorisé</p>
                </div>
              </div>

              <div className="modal-actions">
                <button className="confirm-button" onClick={handleCloseModal}>
                  <span className="button-icon">🌀</span>
                  Reprendre l'analyse
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
                  <h3>Signature Non Reconnue</h3>
                  <p>Le système n'a pas pu authentifier votre identité</p>
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
                    <h4>Pour améliorer la reconnaissance :</h4>
                    <ul className="improvement-tips">
                      <li>✅ Éclairage frontal optimal</li>
                      <li>✅ Position face à l'interface</li>
                      <li>✅ Distance adaptée (50-100cm)</li>
                      <li>✅ Visage complètement visible</li>
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
                  Nouvelle tentative
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