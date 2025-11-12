import * as faceapi from "face-api.js";

let modelsLoaded = false;

export const loadModels = async () => {
  if (modelsLoaded) {
    console.log("✅ Modèles déjà chargés");
    return true;
  }

  const MODEL_URL = process.env.PUBLIC_URL + "/models";

  try {
    console.log("🔄 Chargement des modèles optimisés...");

    // 🔥 CORRECTION: Charger les modèles COMPATIBLES
    await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
    await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL); // Nécessaire pour les descriptors
    await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
    
    modelsLoaded = true;
    console.log("✅ Modèles optimisés chargés avec succès");
    return true;
  } catch (error) {
    console.error("❌ Erreur chargement modèles:", error);
    
    // Fallback: essayer avec moins de modèles
    try {
      console.log("🔄 Essai avec modèles de base...");
      await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
      await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
      modelsLoaded = true;
      console.log("✅ Modèles de base chargés (fallback)");
      return true;
    } catch (fallbackError) {
      console.error("❌ Erreur fallback:", fallbackError);
      return false;
    }
  }
};

export const detectFaceAndComputeEmbedding = async (imageSrc) => {
  try {
    if (!modelsLoaded) {
      const loaded = await loadModels();
      if (!loaded) {
        throw new Error("Modèles de reconnaissance non chargés");
      }
    }

    console.log("🎭 Détection du visage...");

    const img = await faceapi.fetchImage(imageSrc);

    // 🔥 CORRECTION: Options OPTIMISÉES
    const detectionOptions = new faceapi.TinyFaceDetectorOptions({
      inputSize: 160,       // Plus petit = plus rapide
      scoreThreshold: 0.3,  // Plus sensible
    });

    // 🔥 CORRECTION: Détection AVEC landmarks (nécessaire pour descriptors)
    let detections;
    try {
      detections = await faceapi
        .detectAllFaces(img, detectionOptions)
        .withFaceLandmarks()     // Nécessaire pour avoir les descriptors
        .withFaceDescriptors();  // Génère l'embedding
    } catch (landmarkError) {
      console.log("⚠️ Fallback: détection sans landmarks");
      // Fallback: détection basique si landmarks échoue
      detections = await faceapi
        .detectAllFaces(img, detectionOptions)
        .withFaceDescriptors();
    }

    console.log("👤 Visages détectés:", detections.length);

    if (detections.length === 0) {
      throw new Error(
        "Aucun visage détecté. Conseils:\n• Éclairage uniforme\n• Distance 1-2 mètres\n• Regardez la caméra\n• Visage bien visible"
      );
    }

    // 🔥 CHANGEMENT: Sélection du MEILLEUR visage
    const bestDetection = selectBestFace(detections);
    
    console.log("✅ Visage sélectionné - Score:", bestDetection.detection.score.toFixed(3));
    console.log("📏 Taille visage:", bestDetection.detection.box.width.toFixed(0), "x", bestDetection.detection.box.height.toFixed(0));

    return Array.from(bestDetection.descriptor);
  } catch (error) {
    console.error('❌ Erreur détection:', error.message);
    throw error;
  }
};

// 🔥 NOUVEAU: Fonction pour sélectionner le MEILLEUR visage
const selectBestFace = (detections) => {
  return detections.reduce((best, current) => {
    const currentScore = calculateFaceScore(current);
    const bestScore = calculateFaceScore(best);
    return currentScore > bestScore ? current : best;
  });
};

// 🔥 NOUVEAU: Calcul d'un score combiné
const calculateFaceScore = (detection) => {
  const box = detection.detection.box;
  
  // Score basé sur:
  const sizeScore = box.width * box.height;           // Plus grand = mieux
  const confidenceScore = detection.detection.score;  // Confiance de détection
  
  // Calcul du centre (pour favoriser les visages centrés)
  const centerX = Math.abs(box.x + box.width/2 - 320) / 320;
  const centerScore = 1 - centerX;                    // Plus centré = mieux
  
  return sizeScore * confidenceScore * centerScore;
};

// 🔥 CHANGEMENT: Amélioration du calcul de similarité
export const computeSimilarity = (embedding1, embedding2) => {
  if (!embedding1 || !embedding2 || embedding1.length !== embedding2.length) {
    return 0;
  }

  // Distance cosinus (gardons celle qui fonctionnait)
  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < embedding1.length; i++) {
    dotProduct += embedding1[i] * embedding2[i];
    norm1 += embedding1[i] * embedding1[i];
    norm2 += embedding2[i] * embedding2[i];
  }

  norm1 = Math.sqrt(norm1);
  norm2 = Math.sqrt(norm2);

  if (norm1 === 0 || norm2 === 0) return 0;

  const similarity = dotProduct / (norm1 * norm2);
  return Math.max(0, Math.min(1, similarity));
};

export const areModelsLoaded = () => modelsLoaded;