// app.js - Point d'entrée principal de l'application
import TrendSnipper from './TrendSnipper.js';

const trendSnipper = new TrendSnipper();

console.log('Starting TrendSnipper...');
trendSnipper.start().catch(error => {
  console.error(`Fatal error: ${error.message}`);
  console.error(error.stack);
  process.exit(1);
});