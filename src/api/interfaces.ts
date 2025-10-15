/**
 * Interface for NFT listing data
 */
export interface NFTListing {
  /** Unique listing identifier */
  id: string;
  /** Price in SOL */
  price: number;
  /** Seller wallet address */
  seller: string;
  /** NFT mint address */
  mint: string;
  /** Token account address */
  tokenAddress: string;
  /** NFT name (optional) */
  tokenName?: string;
  /** NFT image URL (optional) */
  tokenImage?: string;
}

/**
 * Common response interface for API calls
 */
export interface ApiResponse<T> {
  /** Whether the API call was successful */
  success: boolean;
  /** Response data (if successful) */
  data?: T;
  /** Error message (if unsuccessful) */
  error?: string;
  /** Timestamp of the response */
  timestamp: number;
} 