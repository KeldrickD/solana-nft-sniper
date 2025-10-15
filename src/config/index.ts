import dotenv from 'dotenv';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { BotConfig, EnvConfig } from './types';
import { join } from 'path';
import fs from 'fs';

// Load environment variables
dotenv.config();

/**
 * Validate required environment variables
 */
const validateRequiredEnv = (requiredVars: string[]): void => {
  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }
};

/**
 * Get private key from environment and convert to Keypair
 */
const getKeypairFromEnv = (): Keypair => {
  const privateKeyString = process.env.WALLET_PRIVATE_KEY;
  
  if (!privateKeyString) {
    throw new Error('WALLET_PRIVATE_KEY is not defined in environment variables');
  }
  
  try {
    // Convert base58 private key to Uint8Array and create Keypair
    const decodedKey = bs58.decode(privateKeyString);
    return Keypair.fromSecretKey(decodedKey);
  } catch (error) {
    throw new Error(`Failed to decode wallet private key: ${error instanceof Error ? error.message : String(error)}`);
  }
};

/**
 * Load environment-specific configuration file
 */
const loadEnvConfig = (env: string): object => {
  const configPath = join(process.cwd(), `config/${env}.env`);
  
  if (fs.existsSync(configPath)) {
    dotenv.config({ path: configPath });
    return { configSource: configPath };
  }
  
  return { configSource: '.env (default)' };
};

/**
 * Load and validate configuration from environment variables
 */
export const loadConfig = (): BotConfig => {
  // Load environment-specific config if NODE_ENV is set
  const nodeEnv = process.env.NODE_ENV || 'development';
  const envConfigInfo = loadEnvConfig(nodeEnv);
  
  // Required fields check
  validateRequiredEnv([
    'SOLANA_RPC_URL',
    'WALLET_PRIVATE_KEY',
    'COLLECTION_ADDRESS',
    'PRICE_THRESHOLD'
  ]);
  
  // Create config object
  const config: BotConfig = {
    rpcUrl: process.env.SOLANA_RPC_URL!,
    wallet: getKeypairFromEnv(),
    collectionAddress: process.env.COLLECTION_ADDRESS!,
    priceThreshold: parseFloat(process.env.PRICE_THRESHOLD || '0'),
    autoBuy: process.env.AUTO_BUY === 'true',
    pollingInterval: parseInt(process.env.POLLING_INTERVAL || '5000'),
    discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL,
    logLevel: process.env.LOG_LEVEL || 'info',
    elasticsearchUrl: process.env.ELASTICSEARCH_URL,
    enableMetrics: process.env.ENABLE_METRICS === 'true',
    metricsPort: process.env.METRICS_PORT ? parseInt(process.env.METRICS_PORT) : 9091,
    secretManagerArn: process.env.SECRET_MANAGER_ARN
  };
  
  return config;
}; 