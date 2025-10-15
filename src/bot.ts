import { Connection } from '@solana/web3.js';
import { BotConfig } from './config';
import { TensorService, NFTListing } from './tensor';
import { setupLogger, sendDiscordNotification } from './logger';
import { Logger } from 'winston';

/**
 * Main NFT Sniping Bot class
 */
export class SnipingBot {
  private config: BotConfig;
  private connection: Connection;
  private tensorService: TensorService;
  private logger: Logger;
  private running: boolean = false;
  private interval: NodeJS.Timeout | null = null;
  
  // Tracking metrics
  private statsStartTime: Date = new Date();
  private totalListingsScanned: number = 0;
  private totalMatchesFound: number = 0;
  private totalPurchaseAttempts: number = 0;
  private totalSuccessfulPurchases: number = 0;
  private consecutiveErrors: number = 0;
  private maxConsecutiveErrors: number = 5;

  // Store processed listings to avoid duplicate processing
  private processedListings: Set<string> = new Set();

  constructor(config: BotConfig) {
    this.config = config;
    this.connection = new Connection(config.rpcUrl, { 
      commitment: 'confirmed',
      confirmTransactionInitialTimeout: 60000 // 60s timeout for transaction confirmation
    });
    this.logger = setupLogger(config);
    this.tensorService = new TensorService(this.connection, config.wallet, this.logger);
  }

  /**
   * Start the sniping bot
   */
  public start(): void {
    if (this.running) {
      this.logger.warn('Bot is already running');
      return;
    }

    this.running = true;
    this.resetStats();
    
    this.logger.info('Starting NFT sniping bot');
    this.logger.info(`Collection: ${this.config.collectionAddress}`);
    this.logger.info(`Price threshold: ${this.config.priceThreshold} SOL`);
    this.logger.info(`Auto-buy: ${this.config.autoBuy ? 'Enabled' : 'Disabled'}`);
    this.logger.info(`Polling interval: ${this.config.pollingInterval}ms`);
    this.logger.info(`Connected to Solana network via: ${this.config.rpcUrl}`);

    // Start polling
    this.poll();
    this.interval = setInterval(() => this.poll(), this.config.pollingInterval);
    
    // Set up a regular stats report
    setInterval(() => this.logStats(), 1800000); // Report stats every 30 minutes
  }

  /**
   * Stop the sniping bot
   */
  public stop(): void {
    if (!this.running) {
      this.logger.warn('Bot is not running');
      return;
    }

    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    this.running = false;
    this.logger.info('Bot stopped');
    this.logStats(); // Log stats on shutdown
  }

  /**
   * Reset bot statistics
   */
  private resetStats(): void {
    this.statsStartTime = new Date();
    this.totalListingsScanned = 0;
    this.totalMatchesFound = 0;
    this.totalPurchaseAttempts = 0;
    this.totalSuccessfulPurchases = 0;
    this.consecutiveErrors = 0;
    this.processedListings.clear();
  }

  /**
   * Log current bot statistics
   */
  private logStats(): void {
    const runningTimeMs = new Date().getTime() - this.statsStartTime.getTime();
    const runningTimeHours = runningTimeMs / (1000 * 60 * 60);
    
    const stats = {
      runningTime: `${runningTimeHours.toFixed(2)} hours`,
      listingsScanned: this.totalListingsScanned,
      matchesFound: this.totalMatchesFound,
      purchaseAttempts: this.totalPurchaseAttempts,
      successfulPurchases: this.totalSuccessfulPurchases,
      successRate: this.totalPurchaseAttempts > 0 
        ? `${((this.totalSuccessfulPurchases / this.totalPurchaseAttempts) * 100).toFixed(2)}%` 
        : 'N/A'
    };
    
    this.logger.info(`Bot Statistics: ${JSON.stringify(stats)}`);
    
    // Send stats to Discord if webhook is configured
    if (this.config.discordWebhookUrl) {
      const statsMessage = `📊 **Bot Statistics**\n` +
        `⏱️ Running time: ${stats.runningTime}\n` +
        `🔍 Listings scanned: ${stats.listingsScanned}\n` +
        `✅ Matches found: ${stats.matchesFound}\n` +
        `🛒 Purchase attempts: ${stats.purchaseAttempts}\n` +
        `💰 Successful purchases: ${stats.successfulPurchases}\n` +
        `📈 Success rate: ${stats.successRate}`;
      
      sendDiscordNotification(this.config.discordWebhookUrl, statsMessage)
        .catch(err => this.logger.error('Failed to send stats to Discord:', err));
    }
  }

  /**
   * Poll for new listings and process them with retry logic
   */
  private async poll(): Promise<void> {
    try {
      const listings = await this.retryOperation(
        () => this.tensorService.fetchListings(this.config.collectionAddress),
        3, // max retries
        1000 // base delay in ms
      );
      
      this.consecutiveErrors = 0; // Reset error counter on success
      this.totalListingsScanned += listings.length;
      
      // Process each listing
      for (const listing of listings) {
        // Skip already processed listings
        if (this.processedListings.has(listing.id)) {
          continue;
        }
        
        // Mark as processed
        this.processedListings.add(listing.id);
        
        // Process the new listing
        await this.processListing(listing);
        
        // Keep the processed listings set from growing too large
        if (this.processedListings.size > 1000) {
          const oldestEntries = Array.from(this.processedListings).slice(0, 200);
          oldestEntries.forEach(entry => this.processedListings.delete(entry));
        }
      }
    } catch (error) {
      this.logger.error('Error during polling:', error);
      
      // Track consecutive errors to implement circuit breaker pattern
      this.consecutiveErrors++;
      
      if (this.consecutiveErrors >= this.maxConsecutiveErrors) {
        this.logger.error(`Reached ${this.maxConsecutiveErrors} consecutive errors. Pausing bot for 5 minutes to prevent API rate limiting.`);
        
        // Pause polling temporarily
        if (this.interval) {
          clearInterval(this.interval);
          this.interval = null;
        }
        
        // Send alert about the pause
        if (this.config.discordWebhookUrl) {
          await sendDiscordNotification(
            this.config.discordWebhookUrl, 
            `⚠️ Bot temporarily paused due to ${this.maxConsecutiveErrors} consecutive errors. Will resume in 5 minutes.`
          );
        }
        
        // Resume after 5 minutes
        setTimeout(() => {
          this.logger.info('Resuming bot operation after temporary pause');
          this.consecutiveErrors = 0;
          this.interval = setInterval(() => this.poll(), this.config.pollingInterval);
        }, 300000); // 5 minutes
      }
    }
  }

  /**
   * Process a single listing
   */
  private async processListing(listing: NFTListing): Promise<void> {
    // Check if price is below our threshold
    if (listing.price <= this.config.priceThreshold) {
      this.totalMatchesFound++;
      
      const message = `🚨 Found listing below threshold! 
      - NFT: ${listing.tokenName || listing.mint} 
      - Price: ${listing.price} SOL (below ${this.config.priceThreshold} SOL)
      - Seller: ${listing.seller}`;
      
      this.logger.info(message);
      
      // Send Discord notification if configured
      if (this.config.discordWebhookUrl) {
        await sendDiscordNotification(this.config.discordWebhookUrl, message)
          .catch(err => this.logger.error('Failed to send Discord notification:', err));
      }
      
      // Auto-buy if enabled
      if (this.config.autoBuy) {
        this.logger.info(`Auto-buy enabled, attempting to purchase NFT: ${listing.id}`);
        this.totalPurchaseAttempts++;
        
        try {
          const txSignature = await this.retryOperation(
            () => this.tensorService.buyNFT(listing),
            2, // max retries for purchase
            500 // base delay in ms
          );
          
          if (txSignature) {
            this.totalSuccessfulPurchases++;
            
            const successMessage = `✅ Successfully purchased NFT!
            - Transaction: ${txSignature}
            - NFT: ${listing.tokenName || listing.mint}
            - Price: ${listing.price} SOL`;
            
            this.logger.info(successMessage);
            
            // Send success notification
            if (this.config.discordWebhookUrl) {
              await sendDiscordNotification(this.config.discordWebhookUrl, successMessage)
                .catch(err => this.logger.error('Failed to send success notification:', err));
            }
          } else {
            this.logger.warn(`Purchase attempt for ${listing.id} did not result in a transaction signature`);
          }
        } catch (error) {
          this.logger.error(`Failed to purchase NFT ${listing.id}:`, error);
          
          // Send failure notification
          if (this.config.discordWebhookUrl) {
            const errorMessage = `❌ Failed to purchase NFT!
            - NFT: ${listing.tokenName || listing.mint}
            - Price: ${listing.price} SOL
            - Error: ${error instanceof Error ? error.message : String(error)}`;
            
            await sendDiscordNotification(this.config.discordWebhookUrl, errorMessage)
              .catch(err => this.logger.error('Failed to send error notification:', err));
          }
        }
      } else {
        this.logger.info('Auto-buy disabled. Manual purchase required.');
      }
    }
  }

  /**
   * Retry an async operation with exponential backoff
   * @param operation Function to retry
   * @param maxRetries Maximum number of retry attempts
   * @param baseDelay Base delay in milliseconds
   */
  private async retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries: number,
    baseDelay: number
  ): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt < maxRetries) {
          // Calculate delay with exponential backoff: baseDelay * 2^attempt + some random jitter
          const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 100;
          this.logger.warn(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay.toFixed(0)}ms. Error: ${lastError.message}`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    // If we've exhausted all retries, throw the last error
    throw lastError;
  }
} 