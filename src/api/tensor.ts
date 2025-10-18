import { Connection, PublicKey, Transaction, sendAndConfirmTransaction, Keypair } from '@solana/web3.js';
import { AnchorProvider, Wallet } from '@project-serum/anchor';
import { Logger } from 'winston';
import { NFTListing, ApiResponse } from './interfaces';
import { retryOperation, RetryOptions } from '../utils/retry';

/**
 * Tensor API service for interacting with the Tensor marketplace
 */
export class TensorService {
  private connection: Connection;
  private wallet: Keypair;
  private logger: Logger;
  
  constructor(connection: Connection, wallet: Keypair, logger: Logger) {
    this.connection = connection;
    this.wallet = wallet;
    this.logger = logger;
  }
  
  /**
   * Initialize Tensor client with retry logic
   */
  private async getTensorClient(): Promise<any> {
    // If mocking is enabled, return a minimal mock client
    if (process.env.MOCK_TENSOR === 'true') {
      return {
        getActiveListings: async () => [],
        getCollectionStats: async (_collectionKey: PublicKey) => ({ floor: { sol: undefined } }),
        createBuyTx: async () => new Transaction(),
      };
    }

    const retryOptions: RetryOptions = {
      maxRetries: 3,
      baseDelay: 1000,
      logger: this.logger
    };

    // Dynamic import to use maintained Tensor SDK
    return retryOperation(
      async () => {
        const { TensorSwapSDK } = await import('@tensor-oss/tensorswap-sdk');
        const provider = new AnchorProvider(
          this.connection as any,
          new Wallet(this.wallet) as any,
          { commitment: 'confirmed' } as any
        );
        const swapSdk = new TensorSwapSDK({ provider });

        // Adapter to current bot expectations; implement real calls later
        return {
          getActiveListings: async (_args: { collection: PublicKey }) => {
            this.logger.warn('Tensor listings via tensorswap-sdk not implemented yet; returning empty list');
            return [] as any[];
          },
          getCollectionStats: async (_collectionKey: PublicKey) => {
            this.logger.warn('Tensor stats via tensorswap-sdk not implemented yet');
            return { floor: { sol: undefined } } as any;
          },
          createBuyTx: async (_params: any) => {
            this.logger.warn('Tensor buy via tensorswap-sdk not implemented yet; returning empty Transaction');
            return new Transaction();
          },
          _client: swapSdk,
        } as any;
      },
      retryOptions
    );
  }

  /**
   * Fetch listings for a specific collection with detailed error handling
   */
  async fetchListings(collectionAddress: string): Promise<NFTListing[]> {
    try {
      this.logger.info(`Fetching listings for collection: ${collectionAddress}`);
      
      // Initialize Tensor client with retry logic
      const tapi = await this.getTensorClient();
      
      // Parse collection address as PublicKey
      const collectionKey = new PublicKey(collectionAddress);
      
      // Fetch active listings for this collection
      const activeListings = await tapi.getActiveListings({ collection: collectionKey });
      
      if (!activeListings || activeListings.length === 0) {
        this.logger.info('No active listings found');
        return [];
      }
      
      // Map API response to our listing format
      const listings: NFTListing[] = activeListings.map((listing: any) => ({
        id: listing.listingAddress.toString(),
        price: listing.price.sol,
        seller: listing.seller.toString(),
        mint: listing.nft.mint.toString(),
        tokenAddress: listing.nft.owner.toString(),
        tokenName: listing.nft.metadataOnchain?.name,
        tokenImage: listing.nft.metadataOffchain?.image
      }));
      
      this.logger.info(`Found ${listings.length} active listings`);
      return listings;
      
    } catch (error) {
      this.logger.error('Error fetching listings:', error);
      return [];
    }
  }

  /**
   * Buy an NFT from Tensor marketplace with enhanced error handling
   */
  async buyNFT(listing: NFTListing): Promise<string | null> {
    try {
      this.logger.info(`Attempting to buy NFT: ${listing.id} at ${listing.price} SOL`);
      
      // Initialize Tensor client
      const tapi = await this.getTensorClient();
      
      // Log wallet balance before purchase attempt
      const walletBalance = await this.connection.getBalance(this.wallet.publicKey);
      this.logger.info(`Wallet balance before purchase: ${walletBalance / 1e9} SOL`);
      
      // Check if wallet has enough funds
      if (walletBalance < listing.price * 1e9 * 1.01) { // Add 1% for fees
        throw new Error(`Insufficient funds. Required: ${listing.price * 1.01} SOL, Available: ${walletBalance / 1e9} SOL`);
      }
      
      // Create buy transaction
      const tx = await tapi.createBuyTx({
        buyer: this.wallet.publicKey,
        seller: new PublicKey(listing.seller),
        mint: new PublicKey(listing.mint),
        tokenAccount: new PublicKey(listing.tokenAddress),
        price: { sol: listing.price },
        // Pass additional required parameters for Tensor buy transaction
      });
      
      // Sign and send transaction with detailed error handling
      const signature = await sendAndConfirmTransaction(
        this.connection,
        tx,
        [this.wallet],
        { commitment: 'confirmed', maxRetries: 5 }
      );
      
      // Verify transaction success
      const txStatus = await this.connection.getTransaction(signature, {
        commitment: 'confirmed',
      });
      
      if (txStatus?.meta?.err) {
        throw new Error(`Transaction failed with error: ${JSON.stringify(txStatus.meta.err)}`);
      }
      
      this.logger.info(`NFT purchase successful! Transaction: ${signature}`);
      
      // Get updated wallet balance
      const newWalletBalance = await this.connection.getBalance(this.wallet.publicKey);
      this.logger.info(`Wallet balance after purchase: ${newWalletBalance / 1e9} SOL`);
      
      return signature;
      
    } catch (error) {
      this.logger.error(`Failed to buy NFT: ${error}`);
      return null;
    }
  }
  
  /**
   * Get collection floor price
   */
  async getCollectionFloorPrice(collectionAddress: string): Promise<ApiResponse<number>> {
    try {
      // Initialize Tensor client
      const tapi = await this.getTensorClient();
      
      // Parse collection address as PublicKey
      const collectionKey = new PublicKey(collectionAddress);
      
      // Get collection stats
      const stats = await tapi.getCollectionStats(collectionKey);
      
      if (!stats || !stats.floor) {
        return {
          success: false,
          error: 'Could not retrieve floor price',
          timestamp: Date.now()
        };
      }
      
      return {
        success: true,
        data: stats.floor.sol,
        timestamp: Date.now()
      };
      
    } catch (error) {
      this.logger.error('Error fetching collection floor price:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now()
      };
    }
  }
} 