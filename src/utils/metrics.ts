import { Logger } from 'winston';
import http from 'http';

/**
 * Metrics tracking for NFT sniping bot
 * Uses Prometheus metrics format
 */
export class Metrics {
  private counters: Map<string, number> = new Map();
  private gauges: Map<string, number> = new Map();
  private server: http.Server | null = null;
  private logger: Logger;
  
  constructor(logger: Logger) {
    this.logger = logger;
    this.initializeCounters();
  }
  
  /**
   * Initialize default counters with zero values
   */
  private initializeCounters(): void {
    // Define default counters
    this.counters.set('nft_listings_scanned_total', 0);
    this.counters.set('nft_matches_found_total', 0);
    this.counters.set('nft_purchase_attempts_total', 0);
    this.counters.set('nft_successful_purchases_total', 0);
    this.counters.set('nft_errors_total', 0);
    
    // Define default gauges
    this.gauges.set('nft_price_threshold_sol', 0);
    this.gauges.set('nft_consecutive_errors', 0);
  }
  
  /**
   * Increment a counter metric
   */
  public incrementCounter(name: string, value: number = 1): void {
    const currentValue = this.counters.get(name) || 0;
    this.counters.set(name, currentValue + value);
  }
  
  /**
   * Set a gauge metric to a specific value
   */
  public setGauge(name: string, value: number): void {
    this.gauges.set(name, value);
  }
  
  /**
   * Get the current value of a counter
   */
  public getCounter(name: string): number {
    return this.counters.get(name) || 0;
  }
  
  /**
   * Get the current value of a gauge
   */
  public getGauge(name: string): number {
    return this.gauges.get(name) || 0;
  }
  
  /**
   * Start a metrics server on the specified port
   */
  public startServer(port: number = 9091): void {
    if (this.server) {
      this.logger.warn('Metrics server is already running');
      return;
    }
    
    this.server = http.createServer((req, res) => {
      if (req.url === '/metrics') {
        res.setHeader('Content-Type', 'text/plain');
        res.end(this.formatMetrics());
      } else {
        res.statusCode = 404;
        res.end('Not Found');
      }
    });
    
    this.server.listen(port, () => {
      this.logger.info(`Metrics server listening on port ${port}`);
    });
    
    this.server.on('error', (error) => {
      this.logger.error('Metrics server error:', error);
    });
  }
  
  /**
   * Stop the metrics server
   */
  public stopServer(): void {
    if (this.server) {
      this.server.close();
      this.server = null;
      this.logger.info('Metrics server stopped');
    }
  }
  
  /**
   * Format metrics in Prometheus text format
   */
  private formatMetrics(): string {
    let output = '';
    
    // Format counters
    for (const [name, value] of this.counters.entries()) {
      output += `# TYPE ${name} counter\n`;
      output += `${name} ${value}\n\n`;
    }
    
    // Format gauges
    for (const [name, value] of this.gauges.entries()) {
      output += `# TYPE ${name} gauge\n`;
      output += `${name} ${value}\n\n`;
    }
    
    return output;
  }
} 