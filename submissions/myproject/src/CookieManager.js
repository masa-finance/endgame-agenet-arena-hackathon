import fs from 'fs';
import path from 'path';
import logger from './utils/logger.js';

class CookieManager {
  constructor(cookiePath = './data/cookies.json') {
    this.cookiePath = cookiePath;
    this.ensureDirectoryExists();
  }

  ensureDirectoryExists() {
    const directory = path.dirname(this.cookiePath);
    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
      logger.info(`Created directory: ${directory}`);
    }
  }

  async saveCookies(cookies) {
    try {
      // Save the cookies in their original format
      // This preserves all the properties which may be needed when loading
      fs.writeFileSync(this.cookiePath, JSON.stringify(cookies, null, 2));
      logger.info('Cookies saved successfully');
      return true;
    } catch (error) {
      logger.error(`Error saving cookies: ${error.message}`);
      return false;
    }
  }

  loadCookies() {
    try {
      if (fs.existsSync(this.cookiePath)) {
        const cookiesData = fs.readFileSync(this.cookiePath, 'utf8');
        const parsedCookies = JSON.parse(cookiesData);
        
        // Make sure we have valid cookies
        if (!parsedCookies || 
            (Array.isArray(parsedCookies) && parsedCookies.length === 0)) {
          logger.warn('Cookie file exists but contains no valid cookies');
          return null;
        }
        
        logger.info('Cookies loaded successfully');
        return parsedCookies;
      }
      logger.info('No cookies file found');
      return null;
    } catch (error) {
      logger.error(`Error loading cookies: ${error.message}`);
      return null;
    }
  }
  
  // Helper method to convert cookies to the format expected by agent-twitter-client
  formatCookiesForTwitterClient(cookies) {
    if (!cookies) return [];
    
    // First check if we have an array of objects with key/value properties
    if (Array.isArray(cookies) && cookies.length > 0 && cookies[0] && cookies[0].key && cookies[0].value) {
      // Convert from {key, value, domain...} format to string format "key=value; domain=xyz; path=/;"
      return cookies.map(cookie => {
        return `${cookie.key}=${cookie.value}; domain=${cookie.domain || '.twitter.com'}; path=${cookie.path || '/'};`;
      });
    }
    
    // If not a specialized format, handle generic cases
    if (!Array.isArray(cookies)) {
      if (typeof cookies === 'string') {
        return [cookies]; // Single cookie string
      } else if (typeof cookies === 'object') {
        return Object.values(cookies); // Object of cookies
      }
      return []; // Default empty array
    }
    
    // If already array, ensure each element is properly formatted
    return cookies.filter(cookie => cookie !== null && cookie !== undefined);
  }

  cookiesExist() {
    return fs.existsSync(this.cookiePath);
  }

  deleteCookies() {
    try {
      if (this.cookiesExist()) {
        fs.unlinkSync(this.cookiePath);
        logger.info('Cookies deleted successfully');
        return true;
      }
      return false;
    } catch (error) {
      logger.error(`Error deleting cookies: ${error.message}`);
      return false;
    }
  }
}

export default CookieManager;