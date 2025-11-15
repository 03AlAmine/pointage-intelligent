import * as faceapi from "face-api.js";

// États globaux pour la gestion des modèles
let modelsLoaded = false;
let isModelLoading = false;
let modelLoadPromise = null;

/**
 * Vérifie si TensorFlow.js est disponible de manière sécurisée
 */
const isTensorFlowAvailable = () => {
  return typeof window !== 'undefined' && window.tf !== undefined;
};

/**
 * Réinitialise les modèles
 */
export const reinitialiserTensorFlow = async () => {
  try {
    console.log("🔄 Réinitialisation des modèles...");
    
    // Vider le cache des modèles si TensorFlow est disponible
    if (isTensorFlowAvailable()) {
      window.tf.disposeVariables();
      console.log("✅ Cache TensorFlow vidé");
    } else {
      console.log("ℹ️ TensorFlow non détecté, vidage du cache ignoré");
    }
    
    // Réinitialiser face-api.js
    resetModels();
    
    // Recharger les modèles
    await loadModels();
    
    console.log("✅ Modèles réinitialisés avec succès");
    return true;
    
  } catch (error) {
    console.error("❌ Erreur réinitialisation:", error);
    return false;
  }
};

/**
 * Charge tous les modèles nécessaires pour la reconnaissance faciale
 */
export const loadModels = async () => {
  if (modelsLoaded) {
    console.log("✅ Modèles déjà chargés");
    return true;
  }

  if (isModelLoading) {
    console.log("⏳ Attente du chargement en cours...");
    return modelLoadPromise;
  }

  isModelLoading = true;
  console.log("🚀 Début du chargement des modèles...");

  const MODEL_URL = process.env.PUBLIC_URL + "/models";

  try {
    modelLoadPromise = (async () => {
      console.log("📦 Chargement depuis:", MODEL_URL);

      // Vérifier l'environnement TensorFlow de manière sécurisée
      if (isTensorFlowAvailable()) {
        console.log("🔧 TensorFlow.js détecté, backend:", window.tf.getBackend());
      } else {
        console.log("ℹ️ Utilisation du backend par défaut de face-api.js");
      }

      const loadPromises = [];

      // 1. Charger TinyFaceDetector
      console.log("🔧 Chargement TinyFaceDetector...");
      loadPromises.push(
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL)
          .then(() => {
            console.log("✅ TinyFaceDetector chargé avec succès");
            return true;
          })
          .catch(err => {
            console.error("❌ Erreur TinyFaceDetector:", err);
            throw new Error("Échec du chargement du détecteur facial");
          })
      );

      // 2. Charger faceRecognitionNet
      console.log("🔧 Chargement faceRecognitionNet...");
      loadPromises.push(
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
          .then(() => {
            console.log("✅ faceRecognitionNet chargé avec succès");
            return true;
          })
          .catch(err => {
            console.error("❌ Erreur faceRecognitionNet:", err);
            throw new Error("Échec du chargement du réseau de reconnaissance");
          })
      );

      // 3. Charger faceLandmark68Net (optionnel)
      console.log("🔧 Chargement faceLandmark68Net...");
      loadPromises.push(
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL)
          .then(() => {
            console.log("✅ faceLandmark68Net chargé avec succès");
            return true;
          })
          .catch(err => {
            console.log("ℹ️ faceLandmark68Net non chargé (optionnel):", err.message);
            return false;
          })
      );

      await Promise.allSettled(loadPromises);

      // Vérification finale des modèles
      const tinyFaceDetectorLoaded = faceapi.nets.tinyFaceDetector.isLoaded;
      const recognitionLoaded = faceapi.nets.faceRecognitionNet.isLoaded;

      console.log("📋 État final des modèles:", {
        tinyFaceDetector: tinyFaceDetectorLoaded,
        faceRecognitionNet: recognitionLoaded,
        faceLandmark68Net: faceapi.nets.faceLandmark68Net.isLoaded
      });

      if (!tinyFaceDetectorLoaded) {
        throw new Error("TinyFaceDetector n'a pas pu être chargé");
      }

      if (!recognitionLoaded) {
        throw new Error("FaceRecognitionNet n'a pas pu être chargé");
      }

      modelsLoaded = true;
      isModelLoading = false;
      console.log("🎉 Tous les modèles critiques chargés avec succès!");
      return true;

    })();

    return await modelLoadPromise;

  } catch (error) {
    console.error("💥 Erreur critique lors du chargement des modèles:", error);
    isModelLoading = false;
    modelsLoaded = false;
    modelLoadPromise = null;
    throw error;
  }
};

/**
 * Fonction utilitaire pour accéder aux propriétés de détection de manière sécurisée
 */
const getDetectionProperties = (detection) => {
  if (!detection) {
    return null;
  }

  try {
    let box, score;

    if (detection.box) {
      box = detection.box;
      score = detection.score;
    } else if (detection.detection && detection.detection.box) {
      box = detection.detection.box;
      score = detection.detection.score;
    } else if (detection._box) {
      box = {
        x: detection._box._x,
        y: detection._box._y,
        width: detection._box._width,
        height: detection._box._height
      };
      score = detection._score;
    } else {
      console.warn("⚠️ Structure de détection non reconnue:", detection);
      return null;
    }

    if (!box || typeof score !== 'number') {
      return null;
    }

    const normalizedBox = {
      x: typeof box.x === 'number' ? box.x : box._x,
      y: typeof box.y === 'number' ? box.y : box._y,
      width: typeof box.width === 'number' ? box.width : box._width,
      height: typeof box.height === 'number' ? box.height : box._height
    };

    if (typeof normalizedBox.x !== 'number' || typeof normalizedBox.y !== 'number' ||
        typeof normalizedBox.width !== 'number' || typeof normalizedBox.height !== 'number' ||
        normalizedBox.width <= 0 || normalizedBox.height <= 0) {
      return null;
    }

    return {
      box: normalizedBox,
      score: score
    };

  } catch (error) {
    console.warn("⚠️ Erreur lors de l'accès aux propriétés de détection:", error);
    return null;
  }
};

/**
 * Détection faciale sécurisée pour la vérification de qualité
 */
export const safeFaceDetection = async (imageSrc) => {
  try {
    if (!modelsLoaded) {
      await loadModels();
    }

    if (!faceapi.nets.tinyFaceDetector.isLoaded) {
      throw new Error("Détecteur facial non chargé");
    }

    const img = await faceapi.fetchImage(imageSrc);
    const detectionOptions = new faceapi.TinyFaceDetectorOptions({
      inputSize: 160,
      scoreThreshold: 0.3
    });

    const detections = await faceapi.detectAllFaces(img, detectionOptions);
    
    const validDetections = detections.filter(detection => {
      const props = getDetectionProperties(detection);
      if (!props) return false;

      const { box, score } = props;
      
      return score > 0.1 &&
             box.width > 10 &&
             box.height > 10 &&
             box.x >= 0 && box.y >= 0 &&
             box.x + box.width <= img.width &&
             box.y + box.height <= img.height;
    });

    console.log(`🔍 Détections: ${detections.length} total, ${validDetections.length} valides`);
    return validDetections;

  } catch (error) {
    console.error("❌ Erreur lors de la détection sécurisée:", error);
    return [];
  }
};

/**
 * Normalise un embedding pour une meilleure cohérence
 */
const normalizeEmbedding = (embedding) => {
  if (!embedding || !Array.isArray(embedding)) {
    return embedding;
  }

  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  
  if (magnitude === 0) {
    return embedding;
  }

  return embedding.map(val => val / magnitude);
};

/**
 * Détection faciale complète avec génération d'embedding
 */
export const detectFaceAndComputeEmbedding = async (imageSrc) => {
  try {
    console.log("🎭 Début de la détection faciale complète...");

    if (!modelsLoaded) {
      console.log("🔄 Chargement des modèles requis...");
      const loaded = await loadModels();
      if (!loaded) {
        throw new Error("Impossible de charger les modèles de reconnaissance");
      }
    }

    if (!faceapi.nets.tinyFaceDetector.isLoaded) {
      throw new Error("TinyFaceDetector n'est pas chargé");
    }

    if (!faceapi.nets.faceRecognitionNet.isLoaded) {
      throw new Error("FaceRecognitionNet n'est pas chargé");
    }

    console.log("✅ Modèles validés, chargement de l'image...");

    const img = await faceapi.fetchImage(imageSrc);
    
    const detectionOptions = new faceapi.TinyFaceDetectorOptions({
      inputSize: 320,
      scoreThreshold: 0.5
    });

    console.log("🔍 Détection des visages...");

    let detections;

    if (faceapi.nets.faceLandmark68Net.isLoaded && faceapi.nets.faceRecognitionNet.isLoaded) {
      console.log("🎯 Détection complète avec landmarks et embedding");
      detections = await faceapi
        .detectAllFaces(img, detectionOptions)
        .withFaceLandmarks()
        .withFaceDescriptors();
    } else if (faceapi.nets.faceRecognitionNet.isLoaded) {
      console.log("🎯 Détection avec embedding uniquement");
      detections = await faceapi
        .detectAllFaces(img, detectionOptions)
        .withFaceDescriptors();
    } else {
      throw new Error("Système de reconnaissance incomplet");
    }

    console.log(`👤 ${detections.length} visage(s) détecté(s)`);

    if (detections.length === 0) {
      throw new Error("Aucun visage détecté - Approchez-vous et assurez un bon éclairage");
    }

    const bestFace = selectOptimalFace(detections);
    
    if (!bestFace || !bestFace.descriptor) {
      throw new Error("Impossible de générer l'empreinte faciale");
    }

    const rawEmbedding = Array.from(bestFace.descriptor);
    const normalizedEmbedding = normalizeEmbedding(rawEmbedding);
    
    const embeddingQuality = validateEmbedding(normalizedEmbedding);
    
    if (!embeddingQuality.isValid) {
      throw new Error(`Embedding de mauvaise qualité: ${embeddingQuality.reason}`);
    }

    console.log(`✅ Embedding généré: ${normalizedEmbedding.length} dimensions, qualité: ${embeddingQuality.score}%`);
    return normalizedEmbedding;

  } catch (error) {
    console.error('❌ Erreur lors de la détection:', error.message);
    
    if (error.message.includes("TinyYolov2") || error.message.includes("load model")) {
      throw new Error("Système de reconnaissance non initialisé - Rechargez la page");
    } else if (error.message.includes("fetch")) {
      throw new Error("Erreur de chargement d'image - Vérifiez la source");
    } else if (error.message.includes("inference")) {
      throw new Error("Problème de traitement IA - Réessayez");
    }
    
    throw error;
  }
};

/**
 * Sélectionne la face optimale parmi les détections
 */
const selectOptimalFace = (detections) => {
  if (!detections || detections.length === 0) {
    return null;
  }

  return detections.reduce((best, current) => {
    if (!current) return best;

    try {
      const currentProps = getDetectionProperties(current);
      const bestProps = best ? getDetectionProperties(best) : null;

      if (!currentProps) return best;
      if (!bestProps) return current;

      const currentScore = currentProps.score;
      const currentBox = currentProps.box;
      const bestScore = bestProps.score;
      const bestBox = bestProps.box;

      const currentSize = currentBox.width * currentBox.height;
      const bestSize = bestBox.width * bestBox.height;
      
      const currentQuality = currentScore * Math.sqrt(currentSize);
      const bestQuality = bestScore * Math.sqrt(bestSize);
      
      return currentQuality > bestQuality ? current : best;

    } catch (error) {
      console.warn("⚠️ Erreur lors de la sélection de la face:", error);
      return best;
    }
  }, detections[0]);
};

/**
 * Valide la qualité d'un embedding facial
 */
const validateEmbedding = (embedding) => {
  if (!embedding || !Array.isArray(embedding)) {
    return { isValid: false, reason: "Embedding invalide ou vide" };
  }

  if (embedding.length === 0) {
    return { isValid: false, reason: "Embedding vide" };
  }

  if (embedding.some(val => isNaN(val))) {
    return { isValid: false, reason: "Embedding contient des valeurs invalides" };
  }

  const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  
  if (magnitude < 0.1) {
    return { isValid: false, reason: "Magnitude trop faible" };
  }

  const validRange = embedding.every(val => val >= -1 && val <= 1);
  if (!validRange) {
    console.warn("⚠️ Embedding hors plage normale [-1, 1]");
  }

  const score = Math.min(100, Math.round(magnitude * 100));

  return { 
    isValid: true, 
    magnitude: magnitude,
    score: score,
    dimensions: embedding.length
  };
};

/**
 * Calcule la similarité cosinus entre deux embeddings
 */
export const computeSimilarity = (embedding1, embedding2) => {
  if (!embedding1 || !embedding2 || 
      !Array.isArray(embedding1) || !Array.isArray(embedding2) ||
      embedding1.length !== embedding2.length ||
      embedding1.length === 0) {
    console.warn("❌ Embeddings invalides pour le calcul de similarité");
    return 0;
  }

  let dot = 0;
  let norm1 = 0;
  let norm2 = 0;
  
  for (let i = 0; i < embedding1.length; i++) {
    const val1 = embedding1[i];
    const val2 = embedding2[i];
    
    if (typeof val1 !== 'number' || typeof val2 !== 'number' || 
        isNaN(val1) || isNaN(val2)) {
      continue;
    }
    
    dot += val1 * val2;
    norm1 += val1 * val1;
    norm2 += val2 * val2;
  }

  if (norm1 === 0 || norm2 === 0) {
    return 0;
  }

  const similarity = dot / (Math.sqrt(norm1) * Math.sqrt(norm2));
  const normalizedSimilarity = isNaN(similarity) ? 0 : Math.max(0, Math.min(1, similarity));
  
  return normalizedSimilarity;
};

/**
 * Vérifie si les modèles sont chargés
 */
export const areModelsLoaded = () => {
  return modelsLoaded && 
         faceapi.nets.tinyFaceDetector.isLoaded && 
         faceapi.nets.faceRecognitionNet.isLoaded;
};

/**
 * Retourne l'état détaillé des modèles chargés
 */
export const getLoadedModels = () => {
  return {
    modelsLoaded: modelsLoaded,
    isModelLoading: isModelLoading,
    tinyFaceDetector: faceapi.nets.tinyFaceDetector.isLoaded,
    faceRecognitionNet: faceapi.nets.faceRecognitionNet.isLoaded,
    faceLandmark68Net: faceapi.nets.faceLandmark68Net.isLoaded,
    loadTimestamp: modelsLoaded ? new Date().toISOString() : null
  };
};

/**
 * Réinitialise l'état des modèles (pour les tests)
 */
export const resetModels = () => {
  modelsLoaded = false;
  isModelLoading = false;
  modelLoadPromise = null;
  console.log("🔄 État des modèles réinitialisé");
};

/**
 * Diagnostic complet du système
 */
export const runDiagnostic = async () => {
  const diagnostic = {
    timestamp: new Date().toISOString(),
    models: getLoadedModels(),
    environment: {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language
    },
    issues: []
  };

  try {
    if (!diagnostic.models.modelsLoaded) {
      diagnostic.issues.push("Modèles non chargés");
      
      console.log("🔧 Tentative de chargement pour diagnostic...");
      const loaded = await loadModels();
      diagnostic.models = getLoadedModels();
      
      if (!loaded) {
        diagnostic.issues.push("Échec du chargement des modèles");
      }
    }

    if (!diagnostic.models.tinyFaceDetector) {
      diagnostic.issues.push("TinyFaceDetector manquant");
    }

    if (!diagnostic.models.faceRecognitionNet) {
      diagnostic.issues.push("FaceRecognitionNet manquant");
    }

    if (diagnostic.models.modelsLoaded) {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 100;
        canvas.height = 100;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#cccccc';
        ctx.fillRect(0, 0, 100, 100);
        
        const testImage = canvas.toDataURL();
        const testDetections = await safeFaceDetection(testImage);
        
        diagnostic.testDetection = {
          success: true,
          detections: testDetections.length
        };
      } catch (testError) {
        diagnostic.testDetection = {
          success: false,
          error: testError.message
        };
        diagnostic.issues.push(`Test de détection échoué: ${testError.message}`);
      }
    }

    console.log("📊 Diagnostic complet:", diagnostic);
    return diagnostic;

  } catch (error) {
    console.error("❌ Erreur lors du diagnostic:", error);
    diagnostic.issues.push(`Erreur diagnostic: ${error.message}`);
    return diagnostic;
  }
};

// 🔥 EXPORT POUR LES TESTS (développement seulement)
if (process.env.NODE_ENV === 'development') {
  window.faceDetectionAPI = {
    loadModels,
    safeFaceDetection,
    detectFaceAndComputeEmbedding,
    computeSimilarity,
    areModelsLoaded,
    getLoadedModels,
    resetModels,
    runDiagnostic,
    reinitialiserTensorFlow
  };
}