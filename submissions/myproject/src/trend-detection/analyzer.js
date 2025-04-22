// trend-detection/analyzer.js - Analyseur de tendances
import logger from '../utils/logger.js';
import openaiClient from '../ai/openai-client.js';

class TrendAnalyzer {
  constructor() {}
  
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
  
  // Générer un rapport de tendance de base
  generateBasicReport(trends) {
    if (!trends || trends.length === 0) {
      return 'No micro-trends detected today. Stay tuned for future insights!';
    }
    
    // Limiter le nombre de tendances à afficher
    const maxTrends = 5;
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
      
      // Ajouter la catégorie si disponible
      const categoryLabel = trend.category ? ` [${trend.category}]` : '';
      
      report += `${emoji} ${trend.term}${newLabel}${categoryLabel}\n`;
    });
    
    // Ajouter la signature et les hashtags
    report += '\nAnalyzed by #TrendSnipper 🎯 #AI #TrendSpotting';
    
    return report;
  }
  
  // Analyser les tendances par catégorie
  analyzeTrendsByCategory(trends) {
    if (!trends || trends.length === 0) {
      return {};
    }
    
    const categoryMap = {};
    
    for (const trend of trends) {
      const category = trend.category || 'Other';
      
      if (!categoryMap[category]) {
        categoryMap[category] = [];
      }
      
      categoryMap[category].push(trend);
    }
    
    // Trier les tendances au sein de chaque catégorie
    for (const category in categoryMap) {
      categoryMap[category].sort((a, b) => b.growthRate - a.growthRate);
    }
    
    return categoryMap;
  }
  
  // Analyser le sentiment global des tendances
  analyzeSentiment(trends) {
    if (!trends || trends.length === 0) {
      return {
        positive: 0,
        negative: 0,
        neutral: 0,
        overall: 'neutral'
      };
    }
    
    let positive = 0;
    let negative = 0;
    let neutral = 0;
    
    for (const trend of trends) {
      if (trend.sentiment === 'positive') {
        positive++;
      } else if (trend.sentiment === 'negative') {
        negative++;
      } else {
        neutral++;
      }
    }
    
    // Déterminer le sentiment global
    let overall = 'neutral';
    if (positive > negative && positive > neutral) {
      overall = 'positive';
    } else if (negative > positive && negative > neutral) {
      overall = 'negative';
    }
    
    return {
      positive,
      negative,
      neutral,
      overall
    };
  }
}

export default TrendAnalyzer;