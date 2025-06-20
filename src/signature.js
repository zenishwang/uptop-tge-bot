import chalk from 'chalk';
import pLimit from 'p-limit';

// 签名获取策略接口
export class SignatureProvider {
  async getSignature(walletAddress, params = {}) {
    throw new Error('Not implemented');
  }
  
  async getBatchSignatures(walletAddresses, params = {}) {
    // 默认实现：逐个获取
    const limit = pLimit(10); // 控制并发
    return Promise.all(
      walletAddresses.map(address => 
        limit(() => this.getSignature(address, params))
      )
    );
  }
}

// 策略1: HTTP API签名
export class HttpSignatureProvider extends SignatureProvider {
  constructor(config) {
    super();
    this.apiUrl = config.apiUrl;
    this.apiKey = config.apiKey;
    this.headers = config.headers || {};
    this.method = config.method || 'POST';
  }
  
  async getSignature(walletAddress, params = {}) {
    try {
      const url = this.apiUrl.replace('{address}', walletAddress);
      
      const options = {
        method: this.method,
        headers: {
          'Content-Type': 'application/json',
          ...this.headers
        }
      };
      
      if (this.method === 'POST') {
        options.body = JSON.stringify({
          address: walletAddress,
          ...params
        });
      }
      
      const response = await fetch(url, options);
      const data = await response.json();
      
      // 适配不同的响应格式
      return data.signature || data.sig || data.data?.signature || data.result;
    } catch (error) {
      console.error(chalk.red(`获取签名失败 ${walletAddress}: ${error.message}`));
      throw error;
    }
  }
}

// 策略2: 静态签名（测试用）
export class StaticSignatureProvider extends SignatureProvider {
  constructor(signature) {
    super();
    this.signature = signature;
  }
  
  async getSignature(walletAddress, params = {}) {
    return this.signature;
  }
}

// 策略3: 自定义函数签名
export class CustomSignatureProvider extends SignatureProvider {
  constructor(signatureFunction) {
    super();
    this.signatureFunction = signatureFunction;
  }
  
  async getSignature(walletAddress, params = {}) {
    return this.signatureFunction(walletAddress, params);
  }
}

// 创建签名提供者
export function createSignatureProvider(config) {
  if (!config.signatureRequired) {
    return null;
  }
  
  switch (config.signatureType) {
    case 'http':
      return new HttpSignatureProvider({
        apiUrl: config.signatureApiUrl,
        apiKey: config.signatureApiKey,
        headers: config.signatureHeaders ? JSON.parse(config.signatureHeaders) : {},
        method: config.signatureMethod
      });
      
    case 'static':
      return new StaticSignatureProvider(config.staticSignature);
      
    case 'custom':
      // 这里可以根据需要加载自定义脚本
      const customFunction = new Function('address', 'params', config.customSignatureCode);
      return new CustomSignatureProvider(customFunction);
      
    default:
      throw new Error(`Unknown signature type: ${config.signatureType}`);
  }
}

// 构建带签名的交易数据
export function buildSignedCalldata(originalCalldata, signature, signaturePosition = 'append') {
  const cleanCalldata = originalCalldata.replace(/^0x/i, '');
  const cleanSignature = signature.replace(/^0x/i, '');
  
  switch (signaturePosition) {
    case 'append':
      // 签名附加在末尾
      return '0x' + cleanCalldata + cleanSignature;
      
    case 'prepend':
      // 签名放在开头（少见）
      return '0x' + cleanSignature + cleanCalldata;
      
    case 'replace':
      // 替换特定位置的参数（需要额外配置）
      // 这里需要更复杂的逻辑
      return '0x' + cleanCalldata;
      
    default:
      return '0x' + cleanCalldata + cleanSignature;
  }
}