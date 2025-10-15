import dotenv from 'dotenv';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

// Load environment variables
dotenv.config();

/**
 * Bot configuration interface
 */
export interface BotConfig {
  rpcUrl: string;
  wallet: Keypair;
  collectionAddress: string;
  priceThreshold: number;
  autoBuy: boolean;
  pollingInterval: number;
  discordWebhookUrl?: string;
  logLevel: string;
}

/**
 * Get private key from environment and convert to Keypair
 */
const getKeypairFromEnv = (): Keypair => {
  const privateKeyString = process.env.WALLET_PRIVATE_KEY;
  
  if (!privateKeyString) {
    throw new Error('WALLET_PRIVATE_KEY is not defined in environment variables');
  }
  
  // Convert base58 private key to Uint8Array and create Keypair
  const decodedKey = bs58.decode(privateKeyString);
  return Keypair.fromSecretKey(decodedKey);
};

/**
 * Load and validate configuration from environment variables
 */
export const loadConfig = (): BotConfig => {
  // Required fields check
  const requiredEnvVars = [
    'SOLANA_RPC_URL',
    'WALLET_PRIVATE_KEY',
    'COLLECTION_ADDRESS',
    'PRICE_THRESHOLD'
  ];
  
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Missing required environment variable: ${envVar}`);
    }
  }
  
  // Create config object
  const config: BotConfig = {
    rpcUrl: process.env.SOLANA_RPC_URL!,
    wallet: getKeypairFromEnv(),
    collectionAddress: process.env.COLLECTION_ADDRESS!,
    priceThreshold: parseFloat(process.env.PRICE_THRESHOLD || '0'),
    autoBuy: process.env.AUTO_BUY === 'true',
    pollingInterval: parseInt(process.env.POLLING_INTERVAL || '5000'),
    discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL,
    logLevel: process.env.LOG_LEVEL || 'info'
  };
  
  return config;
}; 