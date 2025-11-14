import * as faceapi from "face-api.js";

let modelsLoaded = false;
let isModelLoading = false;

export const loadModels = async () => {
  if (modelsLoaded) return true;
  if (isModelLoading) {
    console.log("⏳ Modèles en cours de chargement...");
    return new Promise(resolve => {
      const checkInterval = setInterval(() => {
        if (modelsLoaded) {
          clearInterval(checkInterval);
          resolve(true);
        }
      }, 100);
    });
  }

  isModelLoading = true;
  const MODEL_URL = process.env.PUBLIC_URL + "/models";

  try {
    console.log("🚀 Chargement des modèles COMPATIBLES...");

    // 🔥 CORRECTION: Utiliser les modèles STANDARDS compatibles
    const loadPromises = [
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL), // 🔥 STANDARD au lieu de Tiny
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
    ];

    await Promise.all(loadPromises);
    
    modelsLoaded = true;
    isModelLoading = false;
    console.log("✅ Modèles standards chargés avec succès");
    return true;
  } catch (error) {
    console.error("❌ Erreur chargement standards:", error);
    
    // 🔥 FALLBACK: Essayer avec juste le détecteur de visage
    try {
      console.log("🔄 Fallback: détecteur seul...");
      await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
      modelsLoaded = true;
      isModelLoading = false;
      console.log("✅ Détecteur seul chargé (mode basique)");
      return true;
    } catch (fallbackError) {
      console.error("❌ Tous les chargements ont échoué:", fallbackError);
      isModelLoading = false;
      return false;
    }
  }
};

export const detectFaceAndComputeEmbedding = async (imageSrc) => {
  try {
    if (!modelsLoaded) {
      const loaded = await loadModels();
      if (!loaded) throw new Error("Modèles non chargés");
    }

    console.log("🎭 Détection visage...");

    const img = await faceapi.fetchImage(imageSrc);

    // 🔥 OPTIONS OPTIMISÉES
    const detectionOptions = new faceapi.TinyFaceDetectorOptions({
      inputSize: 160,
      scoreThreshold: 0.3,
    });

    let detections;

    // 🔥 CORRECTION: Gestion des modèles disponibles
    if (faceapi.nets.faceLandmark68Net.isLoaded && faceapi.nets.faceRecognitionNet.isLoaded) {
      console.log("🔍 Détection avec reconnaissance complète");
      detections = await faceapi
        .detectAllFaces(img, detectionOptions)
        .withFaceLandmarks()
        .withFaceDescriptors();
    } else if (faceapi.nets.faceRecognitionNet.isLoaded) {
      console.log("🔍 Détection avec embedding seul");
      detections = await faceapi
        .detectAllFaces(img, detectionOptions)
        .withFaceDescriptors();
    } else {
      console.log("🔍 Détection basique");
      detections = await faceapi.detectAllFaces(img, detectionOptions);
      // 🔥 Si pas de reconnaissance, créer un embedding basique
      if (detections.length > 0) {
        throw new Error("Système de reconnaissance incomplet - Rechargez la page");
      }
    }

    console.log(`👤 ${detections.length} visage(s) détecté(s)`);

    if (detections.length === 0) {
      throw new Error("Aucun visage détecté - Approchez-vous de la caméra");
    }

    // 🔥 Vérifier si on a les descriptors
    if (!detections[0].descriptor) {
      throw new Error("Système de reconnaissance incomplet - Rechargez la page");
    }

    const bestFace = selectOptimalFace(detections);
    
    if (!bestFace) {
      throw new Error("Visage de mauvaise qualité");
    }

    console.log("✅ Embedding généré");
    return Array.from(bestFace.descriptor);

  } catch (error) {
    console.error('❌ Erreur détection:', error.message);
    throw error;
  }
};

// 🔥 FONCTION DE SÉLECTION SIMPLIFIÉE
const selectOptimalFace = (detections) => {
  return detections.reduce((best, current) => {
    const currentScore = current.detection.score * (current.detection.box.width * current.detection.box.height);
    const bestScore = best.detection.score * (best.detection.box.width * best.detection.box.height);
    return currentScore > bestScore ? current : best;
  });
};

export const computeSimilarity = (embedding1, embedding2) => {
  if (!embedding1 || !embedding2 || embedding1.length !== embedding2.length) {
    return 0;
  }

  let dot = 0, norm1 = 0, norm2 = 0;
  
  for (let i = 0; i < embedding1.length; i++) {
    dot += embedding1[i] * embedding2[i];
    norm1 += embedding1[i] * embedding1[i];
    norm2 += embedding2[i] * embedding2[i];
  }

  const similarity = dot / (Math.sqrt(norm1) * Math.sqrt(norm2));
  return isNaN(similarity) ? 0 : Math.max(0, similarity);
};

export const areModelsLoaded = () => modelsLoaded;

// 🔥 NOUVEAU: Vérifier quels modèles sont chargés
export const getLoadedModels = () => {
  return {
    faceDetector: faceapi.nets.tinyFaceDetector.isLoaded,
    landmarks: faceapi.nets.faceLandmark68Net.isLoaded,
    recognition: faceapi.nets.faceRecognitionNet.isLoaded
  };
};