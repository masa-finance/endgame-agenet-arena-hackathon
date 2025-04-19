import { removeStopwords } from 'stopword';
import config from './config.js';
import logger from './utils/logger.js';

class TrendDetector {
  constructor() {
    this.previousTermFrequency = new Map();
    this.currentTermFrequency = new Map();
    this.emergingTrends = [];
    
    // Les termes à exclure de l'analyse
    this.excludedTerms = new Set([
      ...config.analysis.excludedTerms,
      // Ajouter d'autres mots à exclure si nécessaire
    ]);
  }

  /**
   * Analyse des tweets pour détecter les tendances émergentes
   * @param {Array} tweets Liste des tweets à analyser
   */
  async analyzeTweets(tweets) {
    if (!tweets || tweets.length === 0) {
      logger.warn('Aucun tweet à analyser');
      return [];
    }
    
    logger.info(`Analyse de ${tweets.length} tweets`);
    
    // Sauvegarde de la fréquence précédente
    this.previousTermFrequency = new Map(this.currentTermFrequency);
    this.currentTermFrequency.clear();
    
    // Extraire et compter les termes de tous les tweets
    for (const tweet of tweets) {
      // Utilise le texte du tweet d'origine si c'est un retweet
      const tweetText = tweet.full_text || tweet.text || '';
      
      // Tokenisation simple (séparation par espaces, retrait des caractères spéciaux)
      const tokenizedText = tweetText
        .toLowerCase()
        .replace(/[^\w\s#@]/g, '')
        .split(/\s+/);
      
      // Retrait des mots vides (stopwords)
      const filteredTokens = removeStopwords(tokenizedText);
      
      // Comptage des termes
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

  /**
   * Identifie les tendances émergentes en comparant les fréquences actuelles et précédentes
   */
  identifyEmergingTrends() {
    this.emergingTrends = [];
    
    // Pour chaque terme dans la fréquence courante
    for (const [term, currentCount] of this.currentTermFrequency.entries()) {
      // Ignorer les termes qui n'apparaissent pas assez souvent
      if (currentCount < config.analysis.minOccurrences) continue;
      
      const previousCount = this.previousTermFrequency.get(term) || 0;
      
      // Calculer la croissance (en %) si le terme existait déjà
      let growthRate = 0;
      if (previousCount > 0) {
        growthRate = ((currentCount - previousCount) / previousCount) * 100;
      } else {
        // Pour les nouveaux termes, considérer comme croissance importante
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
    
    logger.info(`${this.emergingTrends.length} tendances émergentes identifiées`);
    return this.emergingTrends;
  }

  /**
   * Generates a text report of emerging trends for publication
   */
  generateTrendReport() {
    if (this.emergingTrends.length === 0) {
      return 'No micro-trends detected today. Stay tuned for future insights!';
    }
    
    // Limit the number of trends to display (top 5)
    const topTrends = this.emergingTrends.slice(0, 5);
    
    let report = '📊 Detected Micro-Trends 📈\n\n';
    
    topTrends.forEach((trend, index) => {
      // Add different emoji based on rank
      const emoji = index === 0 ? '🔥' : index === 1 ? '⚡' : '📈';
      const newLabel = trend.isNew ? ' (NEW!)' : '';
      
      report += `${emoji} ${trend.term}${newLabel}\n`;
    });
    
    // Add signature and hashtags
    report += '\nAnalyzed by #TrendSniper 🎯 #AI #TrendSpotting';
    
    return report;
  }
}

export default new TrendDetector();