import * as faceapi from 'face-api.js';

// Variable globale pour suivre l'état du chargement
let modelsLoaded = false;

// Chargement des modèles avec gestion d'erreur améliorée
export const loadModels = async () => {
  if (modelsLoaded) {
    console.log('✅ Modèles déjà chargés');
    return true;
  }

  const MODEL_URL = process.env.PUBLIC_URL + '/models';
  
  try {
    console.log('🔄 Début chargement modèles...');
    
    // Vérifier que les fichiers existent
    await checkModelFiles();
    
    // Charger les modèles avec timeout
    await Promise.race([
      Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
      ]),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout chargement modèles')), 30000)
      )
    ]);

    modelsLoaded = true;
    console.log('✅ Tous les modèles chargés avec succès');
    return true;
    
  } catch (error) {
    console.error('❌ Erreur chargement modèles:', error);
    modelsLoaded = false;
    return false;
  }
};

// Vérifier que les fichiers de modèles existent
const checkModelFiles = async () => {
  const requiredFiles = [
    '/models/tiny_face_detector_model-shard1',
    '/models/tiny_face_detector_model-weights_manifest.json',
    '/models/face_landmark_68_model-shard1',
    '/models/face_landmark_68_model-weights_manifest.json',
    '/models/face_recognition_model-shard1',
    '/models/face_recognition_model-shard2',
    '/models/face_recognition_model-weights_manifest.json'
  ];

  for (const file of requiredFiles) {
    try {
      const response = await fetch(process.env.PUBLIC_URL + file);
      if (!response.ok) {
        throw new Error(`Fichier manquant: ${file}`);
      }
      console.log(`✅ ${file} présent`);
    } catch (error) {
      throw new Error(`Fichier modèle manquant: ${file}. Téléchargez les modèles depuis https://github.com/justadudewhohacks/face-api.js/tree/master/weights`);
    }
  }
};

// Détection et extraction d'embedding avec vérification
export const detectFaceAndComputeEmbedding = async (image) => {
  try {
    // Vérifier que les modèles sont chargés
    if (!modelsLoaded) {
      const loaded = await loadModels();
      if (!loaded) {
        throw new Error('Modèles de reconnaissance non chargés');
      }
    }

    console.log('🎭 Détection du visage...');
    
    // Convertir l'image en élément HTML
    const img = await faceapi.fetchImage(image);
    
    // Détection du visage avec options
    const detections = await faceapi
      .detectAllFaces(img, new faceapi.TinyFaceDetectorOptions({
        inputSize: 416, // Taille d'entrée pour meilleure détection
        scoreThreshold: 0.5 // Seuil de confiance
      }))
      .withFaceLandmarks()
      .withFaceDescriptors();
    
    console.log('👤 Visages détectés:', detections.length);
    
    if (detections.length === 0) {
      throw new Error('Aucun visage détecté. Assurez-vous d\'être bien éclairé et face à la caméra.');
    }
    
    if (detections.length > 1) {
      throw new Error('Plusieurs visages détectés. Un seul visage à la fois svp.');
    }
    
    // Retourner l'embedding (vecteur de caractéristiques)
    const embedding = Array.from(detections[0].descriptor);
    console.log('📊 Embedding généré:', embedding.length, 'dimensions');
    
    return embedding;
    
  } catch (error) {
    console.error('❌ Erreur détection visage:', error);
    throw error;
  }
};

// Calcul de similarité entre deux embeddings
export const computeSimilarity = (embedding1, embedding2) => {
  if (!embedding1 || !embedding2 || embedding1.length !== embedding2.length) {
    return 0;
  }
  
  // Distance euclidienne
  let distance = 0;
  for (let i = 0; i < embedding1.length; i++) {
    distance += Math.pow(embedding1[i] - embedding2[i], 2);
  }
  distance = Math.sqrt(distance);
  
  // Convertir en score de similarité (0-1)
  const similarity = 1 - Math.min(distance, 1);
  return Math.max(0, Math.min(1, similarity)); // S'assurer que c'est entre 0 et 1
};

// Vérifier l'état du chargement
export const areModelsLoaded = () => modelsLoaded;