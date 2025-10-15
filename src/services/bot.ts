import { Connection } from '@solana/web3.js';
import { BotConfig } from '../config/types';
import { TensorService } from '../api/tensor';
import { NFTListing } from '../api/interfaces';
import { setupLogger, sendDiscordNotification } from '../utils/logger';
import { retryOperation } from '../utils/retry';
import { Metrics } from '../utils/metrics';
import { Logger } from 'winston';

/**
 * Main NFT Sniping Bot class
 */
export class SnipingBot {
  private config: BotConfig;
  private connection: Connection;
  private tensorService: TensorService;
  private logger: Logger;
  private metrics: Metrics;
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
    
    // Set up logger
    this.logger = setupLogger({
      level: config.logLevel,
      logFilePath: 'nft-sniping-bot.log',
      elasticsearchUrl: config.elasticsearchUrl
    });
    
    // Create services
    this.tensorService = new TensorService(this.connection, config.wallet, this.logger);
    this.metrics = new Metrics(this.logger);
    
    // Set initial gauge values
    this.metrics.setGauge('nft_price_threshold_sol', config.priceThreshold);
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
    
    // Start metrics server if enabled
    if (this.config.enableMetrics) {
      this.metrics.startServer(this.config.metricsPort || 9091);
    }
    
    // Send startup notification
    if (this.config.discordWebhookUrl) {
      sendDiscordNotification(
        this.config.discordWebhookUrl,
        `🚀 NFT Sniping Bot started!\n` +
        `Collection: ${this.config.collectionAddress}\n` +
        `Price threshold: ${this.config.priceThreshold} SOL\n` +
        `Auto-buy: ${this.config.autoBuy ? 'Enabled' : 'Disabled'}`
      ).catch(err => this.logger.error('Failed to send startup notification:', err));
    }
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
    
    // Stop metrics server if running
    if (this.config.enableMetrics) {
      this.metrics.stopServer();
    }
    
    // Send shutdown notification
    if (this.config.discordWebhookUrl) {
      sendDiscordNotification(
        this.config.discordWebhookUrl,
        `⏹️ NFT Sniping Bot stopped!`
      ).catch(err => this.logger.error('Failed to send shutdown notification:', err));
    }
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
    
    // Reset metrics counters
    this.metrics.setGauge('nft_consecutive_errors', 0);
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
      // Check for dynamic floor price updates if configured
      await this.updateDynamicPriceThreshold();
      
      const listings = await retryOperation(
        () => this.tensorService.fetchListings(this.config.collectionAddress),
        {
          maxRetries: 3,
          baseDelay: 1000,
          logger: this.logger
        }
      );
      
      this.consecutiveErrors = 0; // Reset error counter on success
      this.metrics.setGauge('nft_consecutive_errors', 0);
      
      this.totalListingsScanned += listings.length;
      this.metrics.incrementCounter('nft_listings_scanned_total', listings.length);
      
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
      this.metrics.incrementCounter('nft_errors_total');
      
      // Track consecutive errors to implement circuit breaker pattern
      this.consecutiveErrors++;
      this.metrics.setGauge('nft_consecutive_errors', this.consecutiveErrors);
      
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
          this.metrics.setGauge('nft_consecutive_errors', 0);
          this.interval = setInterval(() => this.poll(), this.config.pollingInterval);
        }, 300000); // 5 minutes
      }
    }
  }

  /**
   * Update price threshold based on current floor price
   */
  private async updateDynamicPriceThreshold(): Promise<void> {
    // This is a placeholder for dynamic threshold logic based on floor price
    // Only implement if the bot has a dynamic pricing configuration
    
    // Get the current floor price
    const floorPriceResponse = await this.tensorService.getCollectionFloorPrice(this.config.collectionAddress);
    
    if (floorPriceResponse.success && floorPriceResponse.data) {
      const floorPrice = floorPriceResponse.data;
      this.logger.info(`Current floor price: ${floorPrice} SOL`);
      
      // Log the current floor price as a gauge metric
      this.metrics.setGauge('nft_floor_price_sol', floorPrice);
      
      // Example: Update threshold to be 90% of floor price
      // If enabled through configuration, uncomment this code
      /*
      const dynamicThreshold = floorPrice * 0.9;
      if (Math.abs(dynamicThreshold - this.config.priceThreshold) > 0.01) {
        this.logger.info(`Updating price threshold from ${this.config.priceThreshold} SOL to ${dynamicThreshold} SOL based on floor price`);
        this.config.priceThreshold = dynamicThreshold;
        this.metrics.setGauge('nft_price_threshold_sol', dynamicThreshold);
      }
      */
    }
  }

  /**
   * Process a single listing
   */
  private async processListing(listing: NFTListing): Promise<void> {
    // Check if price is below our threshold
    if (listing.price <= this.config.priceThreshold) {
      this.totalMatchesFound++;
      this.metrics.incrementCounter('nft_matches_found_total');
      
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
        this.metrics.incrementCounter('nft_purchase_attempts_total');
        
        try {
          const txSignature = await retryOperation(
            () => this.tensorService.buyNFT(listing),
            {
              maxRetries: 2,
              baseDelay: 500,
              logger: this.logger
            }
          );
          
          if (txSignature) {
            this.totalSuccessfulPurchases++;
            this.metrics.incrementCounter('nft_successful_purchases_total');
            
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
          this.metrics.incrementCounter('nft_errors_total');
          
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
} 