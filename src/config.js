import dotenv from 'dotenv';
import chalk from 'chalk';
import { findAndReplaceMinAmount, modifyParameter } from './decode-helper.js';

dotenv.config();

export function loadConfig() {
  const requiredFields = [
    'MNEMONIC',
    'TGE_CONTRACT_ADDRESS', 
    'TOKEN_ADDRESS',
    'PURCHASE_DATA'
  ];
  
  const missingFields = requiredFields.filter(field => !process.env[field]);
  
  if (missingFields.length > 0) {
    console.log(chalk.red('\n缺少必要的配置参数:'));
    missingFields.forEach(field => {
      console.log(chalk.red(`  - ${field}`));
    });
    console.log(chalk.yellow('\n请复制 .env.example 到 .env 并填写所有必要参数'));
    process.exit(1);
  }
  
  let purchaseData = process.env.PURCHASE_DATA.replace(/^0x/i, '');
  
  // 处理minAmountOut
  const autoZeroMinAmount = process.env.AUTO_ZERO_MIN_AMOUNT === 'true';
  const minAmountParamIndex = parseInt(process.env.MIN_AMOUNT_PARAM_INDEX || '-1');
  
  if (autoZeroMinAmount && purchaseData) {
    console.log(chalk.yellow('\n处理minAmountOut参数...'));
    
    if (minAmountParamIndex >= 0) {
      // 使用指定的参数索引
      purchaseData = modifyParameter('0x' + purchaseData, minAmountParamIndex, 0).replace(/^0x/i, '');
      console.log(chalk.green(`✓ 已将参数${minAmountParamIndex}设置为0`));
    } else {
      // 自动检测
      const analysis = findAndReplaceMinAmount('0x' + purchaseData);
      if (analysis.lastNonZeroIndex >= 0) {
        purchaseData = modifyParameter('0x' + purchaseData, analysis.lastNonZeroIndex, 0).replace(/^0x/i, '');
        console.log(chalk.green(`✓ 已自动将参数${analysis.lastNonZeroIndex}（可能的minAmountOut）设置为0`));
      }
    }
  }
  
  const config = {
    mnemonic: process.env.MNEMONIC,
    tgeContractAddress: process.env.TGE_CONTRACT_ADDRESS,
    tokenAddress: process.env.TOKEN_ADDRESS,
    purchaseData,
    initialGasPriceGwei: process.env.INITIAL_GAS_PRICE_GWEI || '5',
    initialGasLimit: process.env.INITIAL_GAS_LIMIT || '300000',
    maxConcurrentWallets: parseInt(process.env.MAX_CONCURRENT_WALLETS || '10'),
    maxRetries: parseInt(process.env.MAX_RETRIES || '3'),
    rpcUrl: process.env.RPC_URL || 'https://bsc-dataseed.binance.org/',
    walletCount: parseInt(process.env.WALLET_COUNT || '50'),
    executionMode: process.env.EXECUTION_MODE || 'ultra',
    
    // 签名配置
    signatureRequired: process.env.SIGNATURE_REQUIRED === 'true',
    signatureType: process.env.SIGNATURE_TYPE || 'http',
    signatureApiUrl: process.env.SIGNATURE_API_URL || '',
    signatureApiKey: process.env.SIGNATURE_API_KEY || '',
    signatureMethod: process.env.SIGNATURE_METHOD || 'POST',
    signatureHeaders: process.env.SIGNATURE_HEADERS || '{}',
    staticSignature: process.env.STATIC_SIGNATURE || '',
    signaturePosition: process.env.SIGNATURE_POSITION || 'append'
  };
  
  console.log(chalk.blue('\n配置加载成功:'));
  console.log(chalk.gray(`  - TGE合约: ${config.tgeContractAddress}`));
  console.log(chalk.gray(`  - 代币地址: ${config.tokenAddress}`));
  console.log(chalk.gray(`  - 钱包数量: ${config.walletCount}`));
  console.log(chalk.gray(`  - 并发数: ${config.maxConcurrentWallets}`));
  console.log(chalk.gray(`  - 初始Gas Price: ${config.initialGasPriceGwei} Gwei`));
  console.log(chalk.gray(`  - 初始Gas Limit: ${config.initialGasLimit}`));
  console.log(chalk.gray(`  - 执行模式: ${config.executionMode === 'ultra' ? '超高速' : '快速'}`));
  console.log(chalk.gray(`  - 签名验证: ${config.signatureRequired ? `是 (${config.signatureType})` : '否'}`));
  
  return config;
}