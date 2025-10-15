import { Logger } from 'winston';

/**
 * Retry options for configuring the retry behavior
 */
export interface RetryOptions {
  /** Maximum number of retry attempts */
  maxRetries: number;
  /** Base delay in milliseconds between retries */
  baseDelay: number;
  /** Optional logger instance */
  logger?: Logger;
}

/**
 * Retry an async operation with exponential backoff
 * @param operation Function to retry
 * @param options Retry configuration options
 */
export async function retryOperation<T>(
  operation: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  const { maxRetries, baseDelay, logger } = options;
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt < maxRetries) {
        // Calculate delay with exponential backoff: baseDelay * 2^attempt + some random jitter
        const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 100;
        
        if (logger) {
          logger.warn(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay.toFixed(0)}ms. Error: ${lastError.message}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  // If we've exhausted all retries, throw the last error
  throw lastError;
} 