import winston from 'winston';
import { BotConfig } from './config';

/**
 * Setup a logger with console and file transports
 */
export const setupLogger = (config: BotConfig) => {
  return winston.createLogger({
    level: config.logLevel,
    format: winston.format.combine(
      winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
      }),
      winston.format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`)
    ),
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`)
        )
      }),
      new winston.transports.File({ filename: 'nft-sniping-bot.log' })
    ]
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