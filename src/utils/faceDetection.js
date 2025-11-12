import * as faceapi from "face-api.js";

let modelsLoaded = false;

export const loadModels = async () => {
  if (modelsLoaded) {
    console.log("✅ Modèles déjà chargés");
    return true;
  }

  const MODEL_URL = process.env.PUBLIC_URL + "/models";

  try {
    console.log("🔄 Début chargement modèles...");

    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL), // 👈 AJOUT ICI
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]);

    modelsLoaded = true;
    console.log("✅ Tous les modèles chargés avec succès");
    return true;
  } catch (error) {
    console.error("❌ Erreur chargement modèles:", error);
    modelsLoaded = false;
    return false;
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

    // Essayer d'abord avec TinyFaceDetector (rapide)
    let detections = await faceapi
      .detectAllFaces(
        img,
        new faceapi.TinyFaceDetectorOptions({
          inputSize: 320,
          scoreThreshold: 0.4,
        })
      )
      .withFaceLandmarks()
      .withFaceDescriptors();

    console.log("👤 Visages détectés (TinyFaceDetector):", detections.length);

    // Si échec, essayer SSD Mobilenet (plus précis)
    if (detections.length === 0) {
      console.log("🔄 Essai avec SSD Mobilenet...");
      detections = await faceapi
        .detectAllFaces(
          img,
          new faceapi.SsdMobilenetv1Options({
            minConfidence: 0.5,
          })
        )
        .withFaceLandmarks()
        .withFaceDescriptors();

      console.log("👤 Visages détectés (SSD):", detections.length);
    }

    if (detections.length === 0) {
      throw new Error(
        "Aucun visage détecté. Conseils: \n• Bon éclairage naturel\n• Face à la caméra\n• Expression neutre\n• Pas d'accessoires"
      );
    }

    // Prendre le visage avec le meilleur score
    const bestDetection = detections.reduce((best, current) =>
      current.detection.score > best.detection.score ? current : best
    );

    console.log(
      "✅ Visage détecté - Score:",
      bestDetection.detection.score.toFixed(3)
    );

    return Array.from(bestDetection.descriptor);
  } catch (error) {
    //console.error('❌ Erreur détection visage:', error);
    throw error;
  }
};

export const computeSimilarity = (embedding1, embedding2) => {
  if (!embedding1 || !embedding2 || embedding1.length !== embedding2.length) {
    return 0;
  }

  // Distance cosinus pour de meilleurs résultats
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
