// advancedRecognition.js
import { detectFaceAndComputeEmbedding, computeSimilarity } from './faceDetection';

export class AdvancedRecognitionSystem {
  constructor() {
    this.similarityThreshold = 0.6; // 🔥 Seuil plus bas pour plus de flexibilité
    this.maxRetries = 2;            // 🔥 Nombre de tentatives
    this.qualityThreshold = 0.3;    // 🔥 Qualité minimale du visage
  }

  async processRecognition(imageSrc, employes) {
    let bestMatch = null;
    let bestSimilarity = 0;
    let attempts = 0;
    let lastError = null;

    console.log(`🔍 Début reconnaissance - ${employes.length} employés`);

    while (attempts < this.maxRetries && !bestMatch) {
      try {
        console.log(`🔄 Tentative ${attempts + 1}/${this.maxRetries}`);
        
        const embedding = await detectFaceAndComputeEmbedding(imageSrc);
        
        // 🔥 Vérifier la qualité de l'embedding
        if (!this.isGoodQualityEmbedding(embedding)) {
          throw new Error("Qualité du visage insuffisante - image trop floue ou sombre");
        }

        // 🔥 Recherche du meilleur match
        for (const emp of employes) {
          if (!emp.embedding_facial || !Array.isArray(emp.embedding_facial)) {
            console.log(`⚠️ Employé ${emp.nom} sans embedding`);
            continue;
          }

          const similarity = computeSimilarity(embedding, emp.embedding_facial);
          console.log(`📊 ${emp.nom}: ${(similarity * 100).toFixed(1)}%`);
          
          if (similarity > bestSimilarity && similarity > this.similarityThreshold) {
            bestSimilarity = similarity;
            bestMatch = emp;
          }
        }

        if (bestMatch) {
          console.log(`✅ Match trouvé: ${bestMatch.nom} (${(bestSimilarity * 100).toFixed(1)}%)`);
          break;
        } else {
          console.log(`❌ Aucun match au-dessus du seuil (${this.similarityThreshold})`);
        }

      } catch (error) {
        lastError = error;
        console.log(`❌ Tentative ${attempts + 1} échouée:`, error.message);
      }
      
      attempts++;
      
      // 🔥 Attendre avant de réessayer (sauf si c'est la dernière tentative)
      if (attempts < this.maxRetries && !bestMatch) {
        console.log(`⏳ Attente avant nouvelle tentative...`);
        await this.delay(800); // Attendre 800ms
      }
    }

    if (!bestMatch && lastError) {
      throw lastError;
    }

    return { bestMatch, bestSimilarity };
  }

  // 🔥 Vérifie si l'embedding est de bonne qualité
  isGoodQualityEmbedding(embedding) {
    if (!embedding || embedding.length === 0) return false;
    
    // Calculer la variance des valeurs de l'embedding
    const mean = embedding.reduce((a, b) => a + b) / embedding.length;
    const variance = embedding.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / embedding.length;
    
    console.log(`📈 Qualité embedding: variance = ${variance.toFixed(6)}`);
    
    // Si la variance est trop faible, l'image est probablement de mauvaise qualité
    return variance > 0.0005;
  }

  // 🔥 Fonction d'attente
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // 🔥 Méthode pour ajuster dynamiquement le seuil
  setSimilarityThreshold(threshold) {
    this.similarityThreshold = Math.max(0.3, Math.min(0.9, threshold));
    console.log(`🎚️ Nouveau seuil de similarité: ${this.similarityThreshold}`);
  }
}