import { Connection, PublicKey, Transaction, sendAndConfirmTransaction, Keypair } from '@solana/web3.js';
import * as tensor from '@tensor-oss/sdk';
import { Logger } from 'winston';

/**
 * Interface for NFT listing data
 */
export interface NFTListing {
  id: string;
  price: number; // in SOL
  seller: string;
  mint: string;
  tokenAddress: string;
  tokenName?: string;
  tokenImage?: string;
}

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
   * Fetch listings for a specific collection
   */
  async fetchListings(collectionAddress: string): Promise<NFTListing[]> {
    try {
      this.logger.info(`Fetching listings for collection: ${collectionAddress}`);
      
      // Initialize Tensor client
      const tapi = await tensor.Tensor.init(this.connection);
      
      // Parse collection address as PublicKey
      const collectionKey = new PublicKey(collectionAddress);
      
      // Fetch active listings for this collection
      const activeListings = await tapi.getActiveListings({ collection: collectionKey });
      
      if (!activeListings || activeListings.length === 0) {
        this.logger.info('No active listings found');
        return [];
      }
      
      // Map API response to our listing format
      const listings: NFTListing[] = activeListings.map(listing => ({
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
   * Buy an NFT from Tensor marketplace
   */
  async buyNFT(listing: NFTListing): Promise<string | null> {
    try {
      this.logger.info(`Attempting to buy NFT: ${listing.id} at ${listing.price} SOL`);
      
      // Initialize Tensor client
      const tapi = await tensor.Tensor.init(this.connection);
      
      // Create buy transaction
      const tx = await tapi.createBuyTx({
        buyer: this.wallet.publicKey,
        seller: new PublicKey(listing.seller),
        mint: new PublicKey(listing.mint),
        tokenAccount: new PublicKey(listing.tokenAddress),
        price: { sol: listing.price },
        // Pass additional required parameters for Tensor buy transaction
      });
      
      // Sign and send transaction
      const signature = await sendAndConfirmTransaction(
        this.connection,
        tx,
        [this.wallet],
        { commitment: 'confirmed' }
      );
      
      this.logger.info(`NFT purchase successful! Transaction: ${signature}`);
      return signature;
      
    } catch (error) {
      this.logger.error(`Failed to buy NFT: ${error}`);
      return null;
    }
  }
} 