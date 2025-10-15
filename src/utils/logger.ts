import winston from 'winston';
import { BotConfig } from '../config/types';

/**
 * Logger configuration options
 */
export interface LoggerConfig {
  /** Log level (info, debug, warn, error) */
  level: string;
  /** Path to log file (optional) */
  logFilePath?: string;
  /** Elasticsearch URL for centralized logging (optional) */
  elasticsearchUrl?: string;
}

/**
 * Setup a logger with console and file transports
 * Optionally integrates with Elasticsearch if URL is provided
 */
export const setupLogger = (config: LoggerConfig) => {
  // Define standard transports for console and file
  const transports: winston.transport[] = [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({
          format: 'YYYY-MM-DD HH:mm:ss'
        }),
        winston.format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`)
      )
    })
  ];

  // Add file transport if logFilePath is provided
  if (config.logFilePath) {
    transports.push(
      new winston.transports.File({ 
        filename: config.logFilePath,
        format: winston.format.combine(
          winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
          }),
          winston.format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`)
        )
      })
    );
  }

  // Create and return the logger
  return winston.createLogger({
    level: config.level || 'info',
    format: winston.format.combine(
      winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
      }),
      winston.format.errors({ stack: true }),
      winston.format.splat(),
      winston.format.json()
    ),
    defaultMeta: { service: 'nft-sniping-bot' },
    transports
  });
};

/**
 * Create a method to send notifications to Discord
 */
export const sendDiscordNotification = async (webhookUrl: string, message: string): Promise<void> => {
  if (!webhookUrl) return;
  
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        content: message
      })
    });
    
    if (!response.ok) {
      console.error('Failed to send Discord notification:', await response.text());
    }
  } catch (error) {
    console.error('Error sending Discord notification:', error);
  }
}; 