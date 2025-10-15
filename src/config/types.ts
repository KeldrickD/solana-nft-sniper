import { Keypair } from '@solana/web3.js';

/**
 * Bot configuration interface
 */
export interface BotConfig {
  /** Solana RPC URL */
  rpcUrl: string;
  /** User wallet keypair */
  wallet: Keypair;
  /** Target NFT collection address */
  collectionAddress: string;
  /** Maximum price threshold in SOL to trigger buy */
  priceThreshold: number;
  /** Whether to automatically buy NFTs below threshold */
  autoBuy: boolean;
  /** How often to check for listings (in milliseconds) */
  pollingInterval: number;
  /** Discord webhook URL for notifications (optional) */
  discordWebhookUrl?: string;
  /** Log level (info, debug, warn, error) */
  logLevel: string;
  /** Elasticsearch URL for centralized logging (optional) */
  elasticsearchUrl?: string;
  /** Whether to enable Prometheus metrics server */
  enableMetrics?: boolean;
  /** Port for Prometheus metrics server */
  metricsPort?: number;
  /** AWS Secrets Manager ARN for wallet private key (optional) */
  secretManagerArn?: string;
}

/**
 * Environment variables for bot configuration
 */
export interface EnvConfig {
  /** Solana RPC URL */
  SOLANA_RPC_URL: string;
  /** Wallet private key in base58 format */
  WALLET_PRIVATE_KEY: string;
  /** Target NFT collection address */
  COLLECTION_ADDRESS: string;
  /** Maximum price threshold in SOL */
  PRICE_THRESHOLD: string;
  /** Whether to automatically buy NFTs */
  AUTO_BUY?: string;
  /** How often to check for listings */
  POLLING_INTERVAL?: string;
  /** Discord webhook URL */
  DISCORD_WEBHOOK_URL?: string;
  /** Log level */
  LOG_LEVEL?: string;
  /** Elasticsearch URL */
  ELASTICSEARCH_URL?: string;
  /** Whether to enable metrics */
  ENABLE_METRICS?: string;
  /** Metrics server port */
  METRICS_PORT?: string;
  /** AWS Secrets Manager ARN */
  SECRET_MANAGER_ARN?: string;
} 