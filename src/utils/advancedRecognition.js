import { detectFaceAndComputeEmbedding, computeSimilarity, getLoadedModels } from './faceDetection';

export class AdvancedRecognitionSystem {
  constructor() {
    this.similarityThreshold = 0.5;    // 🔥 Seuil réaliste
    this.highConfidenceThreshold = 0.7;
    this.maxRetries = 1;
  }

  async processRecognition(imageSrc, employes) {
    console.log(`🎯 Reconnaissance - ${employes.length} employés`);

    // 🔥 VÉRIFIER LES MODÈLES DISPONIBLES
    const loadedModels = getLoadedModels && getLoadedModels();
    console.log("📋 Modèles chargés:", loadedModels);

    if (!loadedModels || !loadedModels.faceDetector) {
      throw new Error("Système de détection non chargé");
    }

    if (!loadedModels.recognition) {
      throw new Error("Système de reconnaissance incomplet - Rechargez l'application");
    }

    try {
      const embedding = await detectFaceAndComputeEmbedding(imageSrc);
      
      if (!embedding) {
        throw new Error("Impossible de générer l'empreinte faciale");
      }

      let bestMatch = null;
      let bestSimilarity = 0;

      // 🔥 RECHERCHE SIMPLIFIÉE
      for (const emp of employes) {
        if (!emp.embedding_facial || !Array.isArray(emp.embedding_facial)) {
          console.log(`⚠️ Employé ${emp.nom} sans embedding valide`);
          continue;
        }

        const similarity = computeSimilarity(embedding, emp.embedding_facial);
        
        console.log(`📊 ${emp.nom}: ${(similarity * 100).toFixed(1)}%`);

        if (similarity > bestSimilarity) {
          bestSimilarity = similarity;
          bestMatch = emp;
        }
      }

      // 🔥 DÉCISION SIMPLIFIÉE
      if (bestSimilarity > this.highConfidenceThreshold) {
        console.log(`🎉 HAUTE CONFIANCE: ${bestMatch.nom} (${(bestSimilarity * 100).toFixed(1)}%)`);
        return { bestMatch, bestSimilarity };
      }
      else if (bestSimilarity > this.similarityThreshold) {
        console.log(`✅ Reconnaissance: ${bestMatch.nom} (${(bestSimilarity * 100).toFixed(1)}%)`);
        return { bestMatch, bestSimilarity };
      }
      else {
        throw new Error(`Aucune correspondance (meilleur: ${(bestSimilarity * 100).toFixed(1)}%)`);
      }

    } catch (error) {
      console.error("❌ Erreur reconnaissance:", error.message);
      throw error;
    }
  }
}