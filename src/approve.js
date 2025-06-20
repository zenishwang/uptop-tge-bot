import { parseGwei, maxUint256 } from 'viem';
import { encodeFunctionData } from 'viem';
import pLimit from 'p-limit';
import chalk from 'chalk';

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
  }
];

export async function batchApprove(walletClients, tokenAddress, spenderAddress, config) {
  const limit = pLimit(config.maxConcurrentWallets);
  
  console.log(chalk.blue(`\n开始批量approve操作...`));
  console.log(chalk.gray(`代币地址: ${tokenAddress}`));
  console.log(chalk.gray(`授权地址: ${spenderAddress}`));
  console.log(chalk.gray(`钱包数量: ${walletClients.length}`));
  
  const approveData = encodeFunctionData({
    abi: ERC20_ABI,
    functionName: 'approve',
    args: [spenderAddress, maxUint256]
  });
  
  const tasks = walletClients.map((wallet, index) => 
    limit(async () => {
      try {
        const hash = await wallet.client.sendTransaction({
          to: tokenAddress,
          data: approveData,
          gas: BigInt(config.initialGasLimit),
          gasPrice: parseGwei(config.initialGasPriceGwei)
        });
        
        console.log(chalk.green(`✓ 钱包 ${index} (${wallet.address}) approve成功: ${hash}`));
        return { success: true, wallet, hash };
      } catch (error) {
        console.log(chalk.red(`✗ 钱包 ${index} (${wallet.address}) approve失败: ${error.message}`));
        return { success: false, wallet, error };
      }
    })
  );
  
  const results = await Promise.all(tasks);
  
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(chalk.blue(`\napprove完成统计:`));
  console.log(chalk.green(`成功: ${successful}`));
  console.log(chalk.red(`失败: ${failed}`));
  
  return results;
}