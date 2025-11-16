import {
  detectFaceAndComputeEmbedding,
  computeSimilarity,
  getLoadedModels,
  loadModels,
} from "./faceDetection";

export class AdvancedRecognitionSystem {
  constructor() {
    this.similarityThreshold = 0.72;
    this.highConfidenceThreshold = 0.82;
    this.maxRetries = 2;
    this.embeddingCache = new Map();
  }

  /**
   * Vérifie si TensorFlow.js est disponible de manière sécurisée
   */
  isTensorFlowAvailable() {
    return typeof window !== "undefined" && window.tf !== undefined;
  }

  async initialize() {
    try {
      console.log("🔧 Initialisation du système de reconnaissance...");
      const modelsStatus = getLoadedModels();
      console.log("📋 État initial des modèles:", modelsStatus);

      if (!modelsStatus.tinyFaceDetector) {
        console.log("🔄 Chargement des modèles requis...");
        await loadModels();

        const newStatus = getLoadedModels();
        if (!newStatus.tinyFaceDetector) {
          throw new Error("Échec du chargement du détecteur facial");
        }
      }

      console.log("✅ Système de reconnaissance initialisé");
      return true;
    } catch (error) {
      console.error("❌ Erreur initialisation système:", error);
      throw error;
    }
  }

  /**
   * Analyse la base de données des embeddings pour détecter les problèmes
   */
  async analyserBaseEmbeddings(employes) {
    try {
      console.group("🔍 ANALYSE DES EMBEDDINGS EN BASE");

      let totalEmbeddings = 0;
      let embeddingsValides = 0;
      let problemes = [];

      employes.forEach((emp) => {
        totalEmbeddings++;

        if (!emp.embedding_facial) {
          problemes.push(`${emp.nom || emp.id}: Aucun embedding`);
          return;
        }

        if (!Array.isArray(emp.embedding_facial)) {
          problemes.push(`${emp.nom || emp.id}: Embedding non-array`);
          return;
        }

        const embedding = emp.embedding_facial;

        if (embedding.length !== 128 && embedding.length !== 512) {
          problemes.push(
            `${emp.nom || emp.id}: Longueur anormale (${embedding.length})`
          );
          return;
        }

        const valeursInvalides = embedding.filter(
          (val) => typeof val !== "number" || isNaN(val) || !isFinite(val)
        );

        if (valeursInvalides.length > 0) {
          problemes.push(
            `${emp.nom || emp.id}: ${valeursInvalides.length} valeurs invalides`
          );
          return;
        }

        const magnitude = this.calculerMagnitude(embedding);
        emp._magnitude = magnitude;

        embeddingsValides++;
        console.log(
          `✅ ${emp.nom}: ${embedding.length}d, magnitude: ${magnitude.toFixed(
            4
          )}`
        );
      });

      console.log(
        `📊 Résumé: ${embeddingsValides}/${totalEmbeddings} embeddings valides`
      );

      if (problemes.length > 0) {
        console.warn("🚫 Problèmes détectés:", problemes);
      }

      console.groupEnd();

      return {
        valides: embeddingsValides,
        total: totalEmbeddings,
        problemes: problemes,
      };
    } catch (error) {
      console.error("❌ Erreur analyse embeddings:", error);
      return { valides: 0, total: 0, problemes: [error.message] };
    }
  }

  /**
   * Calcule la magnitude d'un embedding
   */
  calculerMagnitude(embedding) {
    return Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  }

  /**
   * Normalise un embedding pour la comparaison
   */
  normaliserEmbedding(embedding) {
    const magnitude = this.calculerMagnitude(embedding);
    if (magnitude === 0) return embedding;
    return embedding.map((val) => val / magnitude);
  }

  async processRecognition(imageSrc, employes) {
    console.log(`🎯 Reconnaissance - ${employes.length} employés`);

    try {
      await this.initialize();

      const loadedModels = getLoadedModels();
      console.log("📋 Modèles disponibles:", loadedModels);

      if (!loadedModels.tinyFaceDetector) {
        throw new Error("Système de détection faciale non disponible");
      }

      if (!loadedModels.faceRecognitionNet) {
        throw new Error("Système de reconnaissance faciale non disponible");
      }

      const analyse = await this.analyserBaseEmbeddings(employes);
      if (analyse.valides === 0) {
        throw new Error("Aucun embedding valide dans la base de données");
      }

      console.log("🔍 Génération de l'embedding facial...");
      const embedding = await detectFaceAndComputeEmbedding(imageSrc);

      if (!embedding || embedding.length === 0) {
        throw new Error("Impossible de générer l'empreinte faciale");
      }

      console.log(`📊 Embedding généré: ${embedding.length} dimensions`);

      let bestMatch = null;
      let bestSimilarity = 0;
      let similarities = [];

      const employesValides = employes.filter((emp) => {
        if (!emp.embedding_facial || !Array.isArray(emp.embedding_facial)) {
          console.warn(`🚫 Employé ${emp.nom} sans embedding valide`);
          return false;
        }

        const embeddingEmp = emp.embedding_facial;
        const hasValidValues = embeddingEmp.every(
          (val) => typeof val === "number" && !isNaN(val) && isFinite(val)
        );

        if (!hasValidValues) {
          console.warn(`🚫 Employé ${emp.nom} embedding corrompu`);
          return false;
        }

        return true;
      });

      console.log(
        `👥 ${employesValides.length} employés valides sur ${employes.length}`
      );

      if (employesValides.length === 0) {
        throw new Error("Aucun embedding valide trouvé");
      }

      for (const emp of employesValides) {
        const embeddingEmpNormalise = this.normaliserEmbedding(
          emp.embedding_facial
        );

        const similarity = computeSimilarity(embedding, embeddingEmpNormalise);

        if (isNaN(similarity) || similarity < 0) {
          console.warn(`📊 Similarité invalide pour ${emp.nom}: ${similarity}`);
          continue;
        }

        similarities.push({
          employe: emp,
          similarity: similarity,
          percentage: (similarity * 100).toFixed(1),
        });

        console.log(`📊 ${emp.nom}: ${(similarity * 100).toFixed(1)}%`);

        if (similarity > bestSimilarity) {
          bestSimilarity = similarity;
          bestMatch = emp;
        }
      }

      if (similarities.length === 0) {
        throw new Error("Aucune similarité calculable");
      }

      similarities.sort((a, b) => b.similarity - a.similarity);
      console.log("🏆 Classement:", similarities.slice(0, 3));

      const topMatches = similarities.slice(0, 2);
      const ecart =
        topMatches.length > 1
          ? topMatches[0].similarity - topMatches[1].similarity
          : 0;

      console.log(`📈 Écart 1er/2ème: ${(ecart * 100).toFixed(1)}%`);

      if (bestSimilarity > this.highConfidenceThreshold && ecart > 0.1) {
        console.log(
          `🎉 HAUTE CONFIANCE: ${bestMatch.nom} (${(
            bestSimilarity * 100
          ).toFixed(1)}%)`
        );
        return {
          bestMatch,
          bestSimilarity,
          confidence: "high",
          allMatches: similarities,
          ecart: ecart,
        };
      } else if (bestSimilarity > this.similarityThreshold && ecart > 0.05) {
        console.log(
          `✅ MOYENNE CONFIANCE: ${bestMatch.nom} (${(
            bestSimilarity * 100
          ).toFixed(1)}%)`
        );
        return {
          bestMatch,
          bestSimilarity,
          confidence: "medium",
          allMatches: similarities,
          ecart: ecart,
        };
      } else {
        const top3 = similarities
          .slice(0, 3)
          .map((s) => `${s.employe.nom} (${s.percentage}%)`)
          .join(", ");

        const raison =
          ecart <= 0.05
            ? "Écart trop faible entre les meilleurs résultats"
            : "Score de similarité insuffisant";

        console.warn(`❌ ${raison}. Top 3: ${top3}`);
        throw new Error(
          `Reconnaissance incertaine. ${raison}. Meilleurs: ${top3}`
        );
      }
    } catch (error) {
      console.error("❌ Erreur reconnaissance:", error.message);

      if (
        error.message.includes("TinyYolov2") ||
        error.message.includes("load model")
      ) {
        throw new Error(
          "Système de reconnaissance non initialisé - Rechargez la page"
        );
      } else if (error.message.includes("embedding")) {
        throw new Error(
          "Erreur de traitement facial - Réessayez avec une meilleure photo"
        );
      } else {
        throw error;
      }
    }
  }

  /**
   * Diagnostic complet du système
   */
  async diagnosticComplet(employes = []) {
    console.group("🔍 DIAGNOSTIC COMPLET DU SYSTÈME");

    try {
      const models = getLoadedModels();
      console.log("📋 Modèles chargés:", models);

      // Vérification TensorFlow sécurisée
      if (this.isTensorFlowAvailable()) {
        console.log(
          "✅ TensorFlow.js détecté, version:",
          window.tf.version.tfjs
        );
        console.log("🔧 Backend actuel:", window.tf.getBackend());
      } else {
        console.log(
          "ℹ️ TensorFlow.js non détecté - fonctionnement normal avec face-api.js"
        );
      }

      if (employes.length > 0) {
        await this.analyserBaseEmbeddings(employes);
      }

      try {
        const testCanvas = document.createElement("canvas");
        testCanvas.width = 200;
        testCanvas.height = 200;
        const ctx = testCanvas.getContext("2d");
        ctx.fillStyle = "#cccccc";
        ctx.fillRect(0, 0, 200, 200);

        ctx.fillStyle = "#ffcc99";
        ctx.beginPath();
        ctx.arc(100, 80, 30, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#000000";
        ctx.beginPath();
        ctx.arc(90, 75, 5, 0, Math.PI * 2);
        ctx.arc(110, 75, 5, 0, Math.PI * 2);
        ctx.fill();

        const testImage = testCanvas.toDataURL();
        const testDetections = await detectFaceAndComputeEmbedding(testImage);

        console.log("🧪 Test détection:", testDetections ? "SUCCÈS" : "ÉCHEC");
      } catch (testError) {
        console.error("❌ Test détection échoué:", testError);
      }

      console.log("✅ Diagnostic terminé");
    } catch (error) {
      console.error("❌ Erreur diagnostic:", error);
    }

    console.groupEnd();
  }

  /**
   * Purge le cache des embeddings
   */
  purgerCache() {
    this.embeddingCache.clear();
    console.log("🗑️ Cache des embeddings purgé");
  }
}

// 🔥 EXPORT POUR LES TESTS
if (process.env.NODE_ENV === "development") {
  window.AdvancedRecognitionSystem = AdvancedRecognitionSystem;
}
