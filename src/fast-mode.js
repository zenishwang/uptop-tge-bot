import { parseGwei } from 'viem';
import pLimit from 'p-limit';
import chalk from 'chalk';
import { encodeFunctionData } from 'viem';
import { createSignatureProvider, buildSignedCalldata } from './signature.js';

const ERC20_ABI = [
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' }
    ],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  }
];

export async function checkAllowance(publicClient, tokenAddress, owner, spender) {
  try {
    const allowance = await publicClient.readContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'allowance',
      args: [owner, spender]
    });
    return allowance;
  } catch (error) {
    return 0n;
  }
}

export async function fastApproveAndPurchase(
  wallet,
  publicClient,
  tokenAddress,
  tgeAddress,
  purchaseData,
  gasConfig,
  signatureProvider = null,
  signaturePosition = 'append',
  maxRetries = 3
) {
  const allowance = await checkAllowance(publicClient, tokenAddress, wallet.address, tgeAddress);
  
  if (allowance === 0n) {
    const approveData = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [tgeAddress, 2n ** 256n - 1n]
    });
    
    try {
      const currentNonce = await publicClient.getTransactionCount({ address: wallet.address });
      
      const approvePromise = wallet.client.sendTransaction({
        to: tokenAddress,
        data: approveData,
        gas: BigInt(gasConfig.gasLimit),
        gasPrice: parseGwei(gasConfig.gasPriceGwei),
        nonce: currentNonce
      });
      
      // 构建购买交易数据
      let finalPurchaseData = `0x${purchaseData}`;
      if (signatureProvider) {
        const signature = await signatureProvider.getSignature(wallet.address);
        finalPurchaseData = buildSignedCalldata(finalPurchaseData, signature, signaturePosition);
      }
      
      const purchasePromise = wallet.client.sendTransaction({
        to: tgeAddress,
        data: finalPurchaseData,
        gas: BigInt(gasConfig.gasLimit),
        gasPrice: parseGwei(gasConfig.gasPriceGwei),
        nonce: currentNonce + 1
      });
      
      const [approveHash, purchaseHash] = await Promise.all([approvePromise, purchasePromise]);
      
      return {
        success: true,
        approveHash,
        purchaseHash,
        needApprove: true
      };
    } catch (error) {
      return {
        success: false,
        error,
        needApprove: true
      };
    }
  } else {
    try {
      // 构建购买交易数据
      let finalPurchaseData = `0x${purchaseData}`;
      if (signatureProvider) {
        const signature = await signatureProvider.getSignature(wallet.address);
        finalPurchaseData = buildSignedCalldata(finalPurchaseData, signature, signaturePosition);
      }
      
      const purchaseHash = await wallet.client.sendTransaction({
        to: tgeAddress,
        data: finalPurchaseData,
        gas: BigInt(gasConfig.gasLimit),
        gasPrice: parseGwei(gasConfig.gasPriceGwei)
      });
      
      return {
        success: true,
        purchaseHash,
        needApprove: false
      };
    } catch (error) {
      return {
        success: false,
        error,
        needApprove: false
      };
    }
  }
}

export async function ultraFastBatchPurchase(
  walletClients,
  publicClient,
  tokenAddress,
  tgeAddress,
  purchaseData,
  config
) {
  const signatureProvider = createSignatureProvider(config);
  const limit = pLimit(config.maxConcurrentWallets);
  
  console.log(chalk.blue(`\n🚀 超高速模式：并行执行approve+抢购...`));
  console.log(chalk.gray(`合约地址: ${tgeAddress}`));
  console.log(chalk.gray(`钱包数量: ${walletClients.length}`));
  
  const startTime = Date.now();
  
  const tasks = walletClients.map((wallet, index) =>
    limit(async () => {
      const taskStartTime = Date.now();
      console.log(chalk.cyan(`→ 钱包 ${index} 开始执行...`));
      
      const result = await fastApproveAndPurchase(
        wallet,
        publicClient,
        tokenAddress,
        tgeAddress,
        purchaseData,
        {
          gasPriceGwei: config.initialGasPriceGwei,
          gasLimit: config.initialGasLimit
        },
        signatureProvider,
        config.signaturePosition
      );
      
      const duration = Date.now() - taskStartTime;
      
      if (result.success) {
        if (result.needApprove) {
          console.log(chalk.green(`✓ 钱包 ${index} 成功 (${duration}ms): Approve=${result.approveHash.slice(0, 10)}... Purchase=${result.purchaseHash.slice(0, 10)}...`));
        } else {
          console.log(chalk.green(`✓ 钱包 ${index} 成功 (${duration}ms, 已有授权): ${result.purchaseHash.slice(0, 10)}...`));
        }
      } else {
        console.log(chalk.red(`✗ 钱包 ${index} 失败 (${duration}ms): ${result.error.message}`));
      }
      
      return { ...result, wallet, duration };
    })
  );
  
  const results = await Promise.all(tasks);
  const totalDuration = Date.now() - startTime;
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(chalk.blue(`\n执行完成统计:`));
  console.log(chalk.green(`成功: ${successful.length}`));
  console.log(chalk.red(`失败: ${failed.length}`));
  console.log(chalk.gray(`总耗时: ${totalDuration}ms`));
  console.log(chalk.gray(`平均耗时: ${Math.round(totalDuration / walletClients.length)}ms`));
  
  return results;
}