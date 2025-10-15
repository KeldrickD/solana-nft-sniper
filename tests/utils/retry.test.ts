import { retryOperation, RetryOptions } from '../../src/utils/retry';

describe('retryOperation', () => {
  // Mock logger
  const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  };
  
  // Default retry options
  const retryOptions: RetryOptions = {
    maxRetries: 3,
    baseDelay: 10, // Small delay for tests
    logger: mockLogger as any
  };
  
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock setTimeout to execute immediately
    jest.useFakeTimers();
  });
  
  afterEach(() => {
    jest.useRealTimers();
  });
  
  it('should resolve immediately if operation succeeds on first try', async () => {
    const operation = jest.fn().mockResolvedValue('success');
    
    const result = await retryOperation(operation, retryOptions);
    
    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(1);
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });
  
  it('should retry operation on failure and eventually succeed', async () => {
    const operation = jest.fn()
      .mockRejectedValueOnce(new Error('First failure'))
      .mockRejectedValueOnce(new Error('Second failure'))
      .mockResolvedValue('finally succeeded');
    
    // Create a promise that resolves when retryOperation completes
    const resultPromise = retryOperation(operation, retryOptions);
    
    // Fast-forward through all the timers
    jest.runAllTimers();
    
    const result = await resultPromise;
    
    expect(result).toBe('finally succeeded');
    expect(operation).toHaveBeenCalledTimes(3);
    expect(mockLogger.warn).toHaveBeenCalledTimes(2);
  });
  
  it('should throw after exceeding retry attempts', async () => {
    const error = new Error('Persistent failure');
    const operation = jest.fn().mockRejectedValue(error);
    
    // Create a promise that resolves when retryOperation completes
    const resultPromise = retryOperation(operation, retryOptions);
    
    // Fast-forward through all the timers
    jest.runAllTimers();
    
    await expect(resultPromise).rejects.toThrow('Persistent failure');
    expect(operation).toHaveBeenCalledTimes(4); // Initial + 3 retries
    expect(mockLogger.warn).toHaveBeenCalledTimes(3);
  });
}); 