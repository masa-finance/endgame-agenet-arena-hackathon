import winston from 'winston';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Format personnalisé avec mise en évidence des messages importants
const customFormat = winston.format.printf(({ level, message, timestamp }) => {
  let formattedMessage = message;
  
  // Mettre en évidence les messages de planification de post
  if (message && message.includes('Next post scheduled for:')) {
    formattedMessage = `\n${'='.repeat(80)}\n${message}\n${'='.repeat(80)}`;
  }
  
  // Mettre en évidence les erreurs importantes
  if (level === 'error' && message && (
    message.includes('Authentication failed') || 
    message.includes('Fatal error')
  )) {
    formattedMessage = `\n${'!'.repeat(80)}\n${message}\n${'!'.repeat(80)}`;
  }
  
  return `${timestamp} [${level.toUpperCase()}]: ${formattedMessage}`;
});

// Configuration du logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    customFormat
  ),
  transports: [
    // Console pour le développement
    new winston.transports.Console({ 
      format: winston.format.combine(
        winston.format.colorize({ all: true }),
        winston.format.timestamp(),
        customFormat
      )
    }),
    // Fichiers pour les logs persistants
    new winston.transports.File({ 
      filename: join(__dirname, '../../logs/error.log'), 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: join(__dirname, '../../logs/combined.log') 
    })
  ]
});

export default logger;