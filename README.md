# Solana NFT Sniping Bot for Tensor

A simple and configurable bot for sniping NFTs on the Tensor marketplace based on price thresholds.

## Table of Contents
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Usage](#usage)
- [Docker Deployment](#docker-deployment)
- [Getting Your Wallet Private Key](#getting-your-wallet-private-key)
- [Configuring the Bot](#configuring-the-bot)
- [Environment-Specific Configurations](#environment-specific-configurations)
- [Discord Notifications](#discord-notifications)
- [Metrics and Monitoring](#metrics-and-monitoring)
- [Logging and Error Handling](#logging-and-error-handling)
- [Testing](#testing)
- [CI/CD](#cicd)
- [Security Considerations](#security-considerations)
- [Future Improvements](#future-improvements)
- [Disclaimer](#disclaimer)
- [License](#license)

## Features

- Monitor specific NFT collections for new listings
- Set price thresholds for automatic buying
- Enable/disable auto-buy functionality
- Discord webhook notifications for real-time alerts
- Configurable polling interval
- Detailed logging with Winston
- Prometheus metrics for monitoring
- Circuit breaker pattern for API protection
- Retry logic with exponential backoff
- Environment-specific configurations
- Comprehensive test suite
- CI/CD pipeline with GitHub Actions
- Docker container support

## Prerequisites

- Node.js v16+ installed
- A dedicated Solana wallet with funds for purchasing NFTs
- Solana CLI tools (optional, for wallet management)
- Basic understanding of NFT marketplaces and Solana blockchain
- Docker (optional, for containerized deployment)

## Installation

1. Clone this repository:
```bash
git clone https://github.com/yourusername/solana-nft-sniping-bot.git
cd solana-nft-sniping-bot
```

2. Install dependencies:
```bash
npm install
```

3. Create your environment variables file by copying the example:
```bash
cp .env.example .env
```

4. Edit the `.env` file with your specific configuration (you can set `MOCK_TENSOR=true` to run without the Tensor SDK installed):
```
# Solana RPC URL (can be changed to mainnet or testnet)
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com

# Your wallet private key in base58 format (exported from Phantom or other wallets)
WALLET_PRIVATE_KEY=your_private_key_here

# Target collection address (mint address or Tensor slug)
COLLECTION_ADDRESS=your_target_collection_address

# Price threshold in SOL (e.g., 5.5 for 5.5 SOL)
PRICE_THRESHOLD=5.5

# Enable auto-buy (true/false)
AUTO_BUY=false

# How often to check for listings (in milliseconds)
POLLING_INTERVAL=5000

# Discord webhook URL for notifications (optional)
DISCORD_WEBHOOK_URL=your_discord_webhook_url

# Log level (info, warn, error, debug)
LOG_LEVEL=info

# Enable Prometheus metrics server (true/false)
ENABLE_METRICS=false

# Port for Prometheus metrics server
METRICS_PORT=9091

# Optional: Mock Tensor SDK (disables real marketplace calls)
MOCK_TENSOR=false

# Elasticsearch URL for centralized logging (optional)
# ELASTICSEARCH_URL=http://elasticsearch:9200
```

## Usage

1. Build the TypeScript files:
```bash
npm run build
```

2. Start the bot:
```bash
npm start
```

For development, you can use:
```bash
npm run dev
```

## Docker Deployment

For easier deployment and isolation, you can run the bot in a Docker container:

1. Make sure Docker and Docker Compose are installed on your system

2. Configure your `.env` file with appropriate settings

3. Build and start the container:
```bash
docker-compose up -d
```

4. Check container logs:
```bash
docker logs nft-sniping-bot
```

5. Stop the container:
```bash
docker-compose down
```

The log file will be mapped to your host system, so you can monitor it without accessing the container.

## Environment-Specific Configurations

The bot supports different environment configurations for development, testing, and production:

- **Development**: Uses devnet, disables auto-buy, enables detailed logging
- **Testing**: Similar to development but focused on test configurations
- **Production**: Uses mainnet, enables auto-buy, focuses on stability

To use a specific environment:

```bash
NODE_ENV=production npm start
```

This will load the corresponding configuration from the `config` directory.

## Metrics and Monitoring

The bot includes a Prometheus-compatible metrics endpoint for monitoring:

1. Enable metrics in your configuration:
```
ENABLE_METRICS=true
METRICS_PORT=9091
```

2. Access metrics at `http://your-host:9091/metrics`

3. Configure Prometheus to scrape this endpoint:
```yaml
scrape_configs:
  - job_name: 'nft-sniping-bot'
    static_configs:
      - targets: ['your-host:9091']
```

4. Create a Grafana dashboard to visualize the metrics

Available metrics include:
- Total listings scanned
- Matches found
- Purchase attempts and success rate
- Error counts
- Current floor price

## Testing

The bot includes a comprehensive test suite:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate test coverage report
npm run test:coverage
```

## CI/CD

This project includes GitHub Actions workflows that:

1. Run tests and linting on every push
2. Build the application
3. Create and publish Docker images on the main branch

To use the Docker image publication feature, set the following repository secrets:
- `DOCKERHUB_USERNAME`: Your Docker Hub username
- `DOCKERHUB_TOKEN`: Your Docker Hub access token
- `CODECOV_TOKEN`: (Optional) Token for Codecov test coverage reporting

## Getting Your Wallet Private Key

⚠️ **WARNING: Never share your private key with anyone or commit it to version control!** ⚠️

To export your private key from a Solana wallet:

1. From Phantom wallet:
   - Click the hamburger menu
   - Go to Settings > Security & Privacy
   - Click "Export Private Key"
   - Enter your password
   - Copy the key and use it in your .env file

2. From Solana CLI:
   ```bash
   solana-keygen export --outfile ~/exported-keypair.json
   ```

## Configuring the Bot

- **Collection Address**: The address of the NFT collection you want to monitor. You can get this from Tensor marketplace URLs.
- **Price Threshold**: Maximum price in SOL you're willing to pay for an NFT.
- **Auto-Buy**: Set to `true` to automatically buy NFTs below your price threshold, or `false` to just receive notifications.
- **Polling Interval**: How frequently to check for new listings (in milliseconds). Be careful not to set this too low to avoid rate limits.
- **RPC URL**: For testing, use Solana devnet (`https://api.devnet.solana.com`) before moving to mainnet.

### Tensor API Details

This bot interacts with the Tensor marketplace using the official Tensor SDK. For detailed information about the Tensor API and SDK:

- Tensor SDK Documentation: Check [Tensor GitHub repositories](https://github.com/tensor-hq) for the latest SDK documentation.
- API Rate Limits: Be aware of potential rate limits when setting the polling interval.

## Discord Notifications

To set up Discord notifications:

1. Create a Discord server or use an existing one
2. Create a channel for notifications
3. Edit channel settings > Integrations > Webhooks
4. Create a webhook and copy the URL
5. Paste the webhook URL into your .env file

## Logging and Error Handling

This bot uses Winston for logging, with the following features:

- Console output with colored log levels for real-time monitoring
- Log file (`nft-sniping-bot.log`) for historical reference
- Configurable log levels via the LOG_LEVEL environment variable
- Optional Elasticsearch integration for centralized logging

Common errors you might encounter:

- **API Connection Issues**: Check your internet connection and Solana RPC URL
- **Invalid Private Key**: Ensure your private key is correctly formatted in base58
- **Collection Not Found**: Verify the collection address exists on Tensor
- **Insufficient Funds**: Ensure your wallet has enough SOL for purchases and transaction fees

## Security Considerations

- **Dedicated Wallet**: Use a dedicated wallet with limited funds specifically for the bot. NEVER use your primary wallet.
- **Environment File Security**: Your `.env` file contains sensitive information. Never commit it to version control (it's included in `.gitignore` by default).
- **Start with Auto-Buy Disabled**: Begin with `AUTO_BUY=false` to test the bot and monitor its behavior.
- **Use Higher Thresholds Initially**: Start with a higher price threshold than your actual target to avoid unexpected purchases.
- **Test on Devnet First**: Use Solana devnet or testnet before deploying on mainnet with real funds.
- **Regular Monitoring**: Check the bot's activity logs regularly to ensure it's working as expected.
- **AWS Secrets Manager**: For production deployments, consider using AWS Secrets Manager or similar services for secure credential management.

## Future Improvements

Here are some potential enhancements for this bot:

- **Real-Time Data via Websockets**: 
  Replace polling with websocket connections for instant notifications of new listings.

- **Multi-Marketplace Support**: 
  Extend functionality to support other NFT marketplaces on Solana (e.g., Magic Eden).

- **Dynamic Floor Price Tracking**: 
  Automatically adjust price thresholds based on real-time floor price data.

- **Enhanced Transaction Management**: 
  Implement a queuing system to handle multiple transactions and avoid concurrency issues.

- **Machine Learning Integration**: 
  Add predictive analytics to identify potential profitable purchases.

- **Dashboard and Analytics**: 
  Create a web interface to monitor bot performance and transaction history.

## Disclaimer

This bot is provided for educational purposes only. Trading NFTs involves risk, and you should always do your own research before making any investment decisions. The creators of this bot are not responsible for any financial losses incurred from its use.

## License

MIT 