import { removeStopwords } from 'stopword';
import config from './config.js';
import logger from './utils/logger.js';
import openaiClient from './ai/openai-client.js';

class TrendDetector {
  constructor() {
    this.previousTermFrequency = new Map();
    this.currentTermFrequency = new Map();
    this.emergingTrends = [];
    this.trendHistory = [];
    
    // Terms to exclude from analysis
    this.excludedTerms = new Set([
      ...config.analysis.excludedTerms,
      // Add other words to exclude if needed
    ]);
    
    // États d'analyse autonome
    this.autonomousModeActive = config.analysis.autonomousFallback.enabled;
    this.lastSyntheticTrendsGeneration = null;
  }

  // Analyser les tweets pour détecter les tendances émergentes
  // tweets - Liste des tweets à analyser
  async analyzeTweets(tweets) {
    if (!tweets || tweets.length === 0) {
      logger.warn('No tweets to analyze, considering fallback options');
      
      if (this.autonomousModeActive) {
        return await this.generateSyntheticTrends();
      }
      
      return [];
    }
    
    logger.info(`Analyzing ${tweets.length} tweets`);
    
    if (config.openai && config.openai.useForTrendDetection) {
      // Utiliser la détection de tendance basée sur l'IA
      return await this.analyzeWithAI(tweets);
    } else {
      // Utiliser la détection traditionnelle basée sur la fréquence
      return await this.analyzeWithFrequency(tweets);
    }
  }

  // Analyse basée sur la fréquence traditionnelle
  async analyzeWithFrequency(tweets) {
    // Sauvegarder la fréquence précédente
    this.previousTermFrequency = new Map(this.currentTermFrequency);
    this.currentTermFrequency.clear();
    
    // Extraire et compter les termes de tous les tweets
    for (const tweet of tweets) {
      // Utiliser le texte original du tweet s'il s'agit d'un retweet
      const tweetText = tweet.full_text || tweet.text || '';
      
      // Tokenisation simple (séparation par espaces, suppression des caractères spéciaux)
      const tokenizedText = tweetText
        .toLowerCase()
        .replace(/[^\w\s#@]/g, '')
        .split(/\s+/);
      
      // Supprimer les mots vides
      const filteredTokens = removeStopwords(tokenizedText);
      
      // Compter les termes
      for (const token of filteredTokens) {
        // Ignorer les termes exclus et les termes trop courts
        if (this.excludedTerms.has(token) || token.length < 3) continue;
        
        // Compter les occurrences
        this.currentTermFrequency.set(
          token,
          (this.currentTermFrequency.get(token) || 0) + 1
        );
      }
    }
    
    // Identifier les tendances émergentes
    return this.identifyEmergingTrends();
  }
  
  // Analyse de tendance basée sur l'IA
  async analyzeWithAI(tweets) {
    // Maintenir quand même la carte de fréquence pour comparaison historique
    this.previousTermFrequency = new Map(this.currentTermFrequency);
    this.currentTermFrequency.clear();
    
    // D'abord faire une analyse de fréquence de base pour maintenir les cartes à jour
    for (const tweet of tweets) {
      const tweetText = tweet.full_text || tweet.text || '';
      
      const tokenizedText = tweetText
        .toLowerCase()
        .replace(/[^\w\s#@]/g, '')
        .split(/\s+/);
      
      const filteredTokens = removeStopwords(tokenizedText);
      
      for (const token of filteredTokens) {
        if (this.excludedTerms.has(token) || token.length < 3) continue;
        this.currentTermFrequency.set(token, (this.currentTermFrequency.get(token) || 0) + 1);
      }
    }
    
    try {
      // Préparer les termes existants pour fournir un contexte à l'IA
      const existingTerms = this.trendHistory.length > 0 
        ? this.trendHistory[this.trendHistory.length - 1].map(trend => trend.term)
        : [];
      
      // Utiliser OpenAI pour analyser les tweets et détecter les tendances
      const aiTrends = await openaiClient.analyzeTrends(tweets, existingTerms);
      
      if (!aiTrends || aiTrends.length === 0) {
        logger.info('No trends detected by AI, falling back to frequency analysis');
        return this.identifyEmergingTrends();
      }
      
      // Transformer la sortie AI dans notre format de tendance attendu
      this.emergingTrends = aiTrends.map(aiTrend => {
        // Obtenir la fréquence si disponible, ou utiliser une valeur par défaut
        const currentCount = this.currentTermFrequency.get(aiTrend.term) || aiTrend.occurrences || 1;
        const previousCount = this.previousTermFrequency.get(aiTrend.term) || 0;
        
        // Calculer le taux de croissance ou utiliser la valeur fournie par l'IA
        let growthRate = aiTrend.confidence || 0;
        if (previousCount > 0 && !aiTrend.confidence) {
          growthRate = ((currentCount - previousCount) / previousCount) * 100;
        }
        
        return {
          term: aiTrend.term,
          count: currentCount,
          growthRate: growthRate,
          isNew: previousCount === 0,
          category: aiTrend.category || null,
          sentiment: aiTrend.sentiment || null,
          context: aiTrend.context || null
        };
      });
      
      // Trier par taux de croissance ou confiance (du plus élevé au plus bas)
      this.emergingTrends.sort((a, b) => b.growthRate - a.growthRate);
      
      // Enregistrer les tendances pour référence historique
      this.updateTrendHistory();
      
      logger.info(`${this.emergingTrends.length} emerging trends identified by AI analysis`);
      return this.emergingTrends;
    } catch (error) {
      logger.error(`Error in AI trend analysis: ${error.message}`);
      logger.info('Falling back to frequency-based trend detection');
      
      // Fallback vers la méthode traditionnelle si l'analyse IA échoue
      return this.identifyEmergingTrends();
    }
  }
  
  // Générer des tendances synthétiques quand aucune donnée réelle n'est disponible
  async generateSyntheticTrends() {
    try {
      logger.info('Generating synthetic trends for autonomous operation');
      
      // Limiter la génération à une fois par heure maximum
      const now = new Date();
      if (this.lastSyntheticTrendsGeneration) {
        const timeSinceLastGeneration = now - this.lastSyntheticTrendsGeneration;
        const oneHourInMs = 60 * 60 * 1000;
        
        if (timeSinceLastGeneration < oneHourInMs) {
          logger.info(`Synthetic trends were generated recently (${Math.round(timeSinceLastGeneration/60000)} minutes ago), reusing last trends`);
          return this.emergingTrends;
        }
      }
      
      // Si OpenAI est configuré, utiliser pour générer des tendances synthétiques
      if (config.openai && config.openai.apiKey) {
        logger.info('Using OpenAI to generate synthetic trends');
        
        const syntheticTrends = await openaiClient.generateSyntheticTrends();
        
        if (syntheticTrends && syntheticTrends.length > 0) {
          // Transformer au format standard des tendances
          this.emergingTrends = syntheticTrends.map(trend => ({
            term: trend.term,
            count: trend.count || Math.floor(Math.random() * 100) + 20,
            growthRate: trend.confidence || Math.floor(Math.random() * 50) + 50,
            isNew: true,
            category: trend.category || null,
            sentiment: trend.sentiment || null,
            context: trend.context || null,
            isSynthetic: true // Marquer comme synthétique
          }));
          
          // Enregistrer l'historique des tendances
          this.updateTrendHistory();
          
          // Mettre à jour le timestamp de dernière génération
          this.lastSyntheticTrendsGeneration = now;
          
          logger.info(`${this.emergingTrends.length} synthetic trends generated successfully`);
          return this.emergingTrends;
        }
      }
      
      // Fallback: Générer des tendances simples basées sur des sujets courants
      logger.info('Generating basic synthetic trends as fallback');
      
      const basicTrendTopics = [
        { term: "#AI", category: "Technology" },
        { term: "#MachineLearning", category: "Technology" },
        { term: "#Blockchain", category: "Technology" },
        { term: "#ClimateAction", category: "Environment" },
        { term: "#DigitalTransformation", category: "Business" },
        { term: "#RemoteWork", category: "Work" },
        { term: "#SpaceExploration", category: "Science" },
        { term: "#Cybersecurity", category: "Technology" }
      ];
      
      // Sélectionner aléatoirement 3-5 tendances
      const numTrends = Math.floor(Math.random() * 3) + 3; // 3 à 5 tendances
      const selectedTrends = [];
      
      while (selectedTrends.length < numTrends && basicTrendTopics.length > 0) {
        const randomIndex = Math.floor(Math.random() * basicTrendTopics.length);
        selectedTrends.push(basicTrendTopics[randomIndex]);
        basicTrendTopics.splice(randomIndex, 1);
      }
      
      // Créer les objets de tendance
      this.emergingTrends = selectedTrends.map(topic => ({
        term: topic.term,
        count: Math.floor(Math.random() * 100) + 20, // 20-120 mentions
        growthRate: Math.floor(Math.random() * 50) + 50, // 50-100% croissance
        isNew: Math.random() > 0.5, // 50% chance d'être nouveau
        category: topic.category,
        sentiment: Math.random() > 0.7 ? "negative" : Math.random() > 0.4 ? "positive" : "neutral",
        isSynthetic: true
      }));
      
      // Enregistrer l'historique des tendances
      this.updateTrendHistory();
      
      // Mettre à jour le timestamp de dernière génération
      this.lastSyntheticTrendsGeneration = now;
      
      logger.info(`${this.emergingTrends.length} basic synthetic trends generated as fallback`);
      return this.emergingTrends;
    } catch (error) {
      logger.error(`Error generating synthetic trends: ${error.message}`);
      return [];
    }
  }
  
  // Mettre à jour l'historique des tendances pour référence future
  updateTrendHistory() {
    // Ajouter les tendances actuelles à l'historique
    this.trendHistory.push([...this.emergingTrends]);
    
    // Limiter la taille de l'historique basée sur la configuration
    const maxHistorySize = config.analysis.trendHistorySize || 10;
    if (this.trendHistory.length > maxHistorySize) {
      this.trendHistory.shift();
    }
  }

  // Identifier les tendances émergentes en comparant les fréquences actuelles et précédentes
  identifyEmergingTrends() {
    this.emergingTrends = [];
    
    // Pour chaque terme dans la fréquence actuelle
    for (const [term, currentCount] of this.currentTermFrequency.entries()) {
      // Ignorer les termes qui n'apparaissent pas assez souvent
      if (currentCount < config.analysis.minOccurrences) continue;
      
      const previousCount = this.previousTermFrequency.get(term) || 0;
      
      // Calculer la croissance (en %) si le terme existait déjà
      let growthRate = 0;
      if (previousCount > 0) {
        growthRate = ((currentCount - previousCount) / previousCount) * 100;
      } else {
        // Pour les nouveaux termes, considérer comme une croissance significative
        growthRate = 100;
      }
      
      // Considérer comme tendance émergente si la croissance dépasse le seuil configuré
      if (growthRate >= config.analysis.growthThreshold) {
        this.emergingTrends.push({
          term,
          count: currentCount,
          growthRate,
          isNew: previousCount === 0
        });
      }
    }
    
    // Trier par taux de croissance (du plus élevé au plus bas)
    this.emergingTrends.sort((a, b) => b.growthRate - a.growthRate);
    
    // Mettre à jour l'historique des tendances
    this.updateTrendHistory();
    
    logger.info(`${this.emergingTrends.length} emerging trends identified`);
    return this.emergingTrends;
  }
  
  // Générer un rapport textuel des tendances émergentes pour publication
  async generateTrendReport(specificTrends = null) {
    // Utiliser les tendances fournies ou les tendances émergentes détectées
    const trendsToReport = specificTrends || this.emergingTrends;
    
    if (config.reporting.enhancedReports && config.openai.apiKey) {
      return this.generateEnhancedReport(trendsToReport);
    } else {
      return this.generateBasicReport(trendsToReport);
    }
  }
  
  // Générer un rapport de tendance amélioré en utilisant OpenAI
  async generateEnhancedReport(trends) {
    try {
      if (!trends || trends.length === 0) {
        return 'No micro-trends detected today. Stay tuned for future insights!';
      }
      
      const report = await openaiClient.generateEnhancedTrendReport(trends);
      return report;
    } catch (error) {
      logger.error(`Error generating enhanced report: ${error.message}`);
      return this.generateBasicReport(trends);
    }
  }
  
  // Générer un rapport de tendance de base sans aide de l'IA
  generateBasicReport(trends) {
    if (!trends || trends.length === 0) {
      return 'No micro-trends detected today. Stay tuned for future insights!';
    }
    
    // Limiter le nombre de tendances à afficher
    const maxTrends = config.reporting.maxTrendsInReport || 5;
    const topTrends = trends.slice(0, maxTrends);
    
    // Ajouter un indicateur si des tendances synthétiques sont présentes
    const hasSyntheticTrends = topTrends.some(trend => trend.isSynthetic === true);
    const reportPrefix = hasSyntheticTrends 
      ? '🔮 AI-Predicted Micro-Trends 🔮\n\n' 
      : '📊 Detected Micro-Trends 📈\n\n';
    
    let report = reportPrefix;
    
    topTrends.forEach((trend, index) => {
      // Ajouter un emoji différent en fonction du rang
      const emoji = index === 0 ? '🔥' : index === 1 ? '⚡' : '📈';
      const newLabel = trend.isNew ? ' (NEW!)' : '';
      
      // Ajouter la catégorie si disponible et configurée
      const categoryLabel = trend.category && config.reporting.includeCategories 
        ? ` [${trend.category}]` 
        : '';
      
      report += `${emoji} ${trend.term}${newLabel}${categoryLabel}\n`;
    });
    
    // Ajouter la signature et les hashtags
    report += '\nAnalyzed by #TrendSnipper 🎯 #AI #TrendSpotting';
    
    return report;
  }
}

// Export a singleton instance
const trendDetector = new TrendDetector();
export default trendDetector;