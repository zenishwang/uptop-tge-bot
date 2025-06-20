import { parseGwei } from 'viem';
import pLimit from 'p-limit';
import chalk from 'chalk';
import { createSignatureProvider, buildSignedCalldata } from './signature.js';

export async function executePurchaseWithSignature(
  wallet,
  contractAddress,
  purchaseData,
  signatureProvider,
  signaturePosition,
  gasConfig,
  maxRetries = 3
) {
  let attempt = 0;
  let lastError;
  let currentGasPrice = parseGwei(gasConfig.gasPriceGwei);
  let currentGasLimit = BigInt(gasConfig.gasLimit);
  
  while (attempt < maxRetries) {
    attempt++;
    
    try {
      let finalCalldata = `0x${purchaseData}`;
      
      // 如果需要签名，获取签名并构建最终calldata
      if (signatureProvider) {
        const signature = await signatureProvider.getSignature(wallet.address);
        finalCalldata = buildSignedCalldata(finalCalldata, signature, signaturePosition);
        console.log(chalk.gray(`  钱包 ${wallet.index} 获取签名成功: ${signature.slice(0, 10)}...`));
      }
      
      const hash = await wallet.client.sendTransaction({
        to: contractAddress,
        data: finalCalldata,
        gas: currentGasLimit,
        gasPrice: currentGasPrice
      });
      
      return { success: true, hash, attempts: attempt };
    } catch (error) {
      lastError = error;
      console.log(chalk.yellow(`  钱包 ${wallet.index} 第${attempt}次尝试失败: ${error.message}`));
      
      if (error.message.includes('gas') || error.message.includes('reverted')) {
        currentGasPrice = currentGasPrice * 120n / 100n;
        currentGasLimit = currentGasLimit * 150n / 100n;
        console.log(chalk.gray(`  提升gas重试 - Price: ${currentGasPrice} wei, Limit: ${currentGasLimit}`));
      }
      
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 100 * attempt));
      }
    }
  }
  
  return { success: false, error: lastError, attempts: attempt };
}

export async function batchPurchaseWithSignature(walletClients, contractAddress, purchaseData, config) {
  const limit = pLimit(config.maxConcurrentWallets);
  const signatureProvider = createSignatureProvider(config);
  
  console.log(chalk.blue(`\n开始批量抢购操作（${config.signatureRequired ? '需要签名' : '无需签名'}）...`));
  console.log(chalk.gray(`合约地址: ${contractAddress}`));
  console.log(chalk.gray(`交易数据: 0x${purchaseData.substring(0, 10)}...`));
  console.log(chalk.gray(`钱包数量: ${walletClients.length}`));
  console.log(chalk.gray(`最大并发: ${config.maxConcurrentWallets}`));
  
  if (config.signatureRequired) {
    console.log(chalk.yellow(`签名配置: ${config.signatureType} - ${config.signatureApiUrl || '静态签名'}`));
  }
  
  const startTime = Date.now();
  
  const tasks = walletClients.map((wallet, index) => 
    limit(async () => {
      const taskStartTime = Date.now();
      console.log(chalk.cyan(`→ 钱包 ${index} (${wallet.address}) 开始执行...`));
      
      const result = await executePurchaseWithSignature(
        wallet,
        contractAddress,
        purchaseData,
        signatureProvider,
        config.signaturePosition,
        {
          gasPriceGwei: config.initialGasPriceGwei,
          gasLimit: config.initialGasLimit
        },
        config.maxRetries
      );
      
      const duration = Date.now() - taskStartTime;
      
      if (result.success) {
        console.log(chalk.green(`✓ 钱包 ${index} 成功 (${duration}ms, ${result.attempts}次尝试): ${result.hash}`));
      } else {
        console.log(chalk.red(`✗ 钱包 ${index} 失败 (${duration}ms, ${result.attempts}次尝试): ${result.error.message}`));
      }
      
      return { ...result, wallet, duration };
    })
  );
  
  const results = await Promise.all(tasks);
  const totalDuration = Date.now() - startTime;
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(chalk.blue(`\n抢购完成统计:`));
  console.log(chalk.green(`成功: ${successful.length}`));
  console.log(chalk.red(`失败: ${failed.length}`));
  console.log(chalk.gray(`总耗时: ${totalDuration}ms`));
  console.log(chalk.gray(`平均耗时: ${Math.round(totalDuration / walletClients.length)}ms`));
  
  if (successful.length > 0) {
    console.log(chalk.green(`\n最快成功的5个钱包:`));
    successful
      .sort((a, b) => a.duration - b.duration)
      .slice(0, 5)
      .forEach((r, i) => {
        console.log(chalk.gray(`  ${i + 1}. 钱包${r.wallet.index} - ${r.duration}ms`));
      });
  }
  
  return results;
}