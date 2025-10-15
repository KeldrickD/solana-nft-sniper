import { loadConfig } from './config';
import { SnipingBot } from './services/bot';

/**
 * Main entry point for the NFT sniping bot
 */
async function main() {
  try {
    // Banner
    console.log(`
======================================================
      Tensor NFT Sniping Bot - Enhanced Edition
======================================================
    `);
    
    // Load configuration from .env file or environment-specific config
    console.log('Loading configuration...');
    const config = loadConfig();
    
    // Create and start the bot
    console.log('Initializing bot...');
    const bot = new SnipingBot(config);
    
    console.log('Starting bot...');
    bot.start();
    
    // Handle shutdown signals
    process.on('SIGINT', () => {
      console.log('\nReceived SIGINT. Shutting down...');
      bot.stop();
      setTimeout(() => process.exit(0), 1000);
    });
    
    process.on('SIGTERM', () => {
      console.log('\nReceived SIGTERM. Shutting down...');
      bot.stop();
      setTimeout(() => process.exit(0), 1000);
    });
    
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('Uncaught exception:', error);
      bot.stop();
      process.exit(1);
    });
    
    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
      // Don't exit here, just log the error
    });
    
  } catch (error) {
    console.error('Error starting bot:', error);
    process.exit(1);
  }
}

// Run the main function
main(); 