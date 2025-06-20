import { parseGwei } from 'viem';
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

export async function checkAllowances(walletClients, publicClient, tokenAddress, spenderAddress) {
  console.log(chalk.blue('\n检查当前授权状态...'));
  
  const allowances = await Promise.all(
    walletClients.map(async (wallet) => {
      try {
        const allowance = await publicClient.readContract({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: 'allowance',
          args: [wallet.address, spenderAddress]
        });
        return { wallet, allowance };
      } catch (error) {
        return { wallet, allowance: 0n, error };
      }
    })
  );
  
  const approved = allowances.filter(a => a.allowance > 0n);
  console.log(chalk.gray(`已授权钱包数量: ${approved.length}/${walletClients.length}`));
  
  return allowances;
}

export async function batchRevoke(walletClients, publicClient, tokenAddress, spenderAddress, config) {
  const limit = pLimit(config.maxConcurrentWallets);
  
  console.log(chalk.blue(`\n开始批量取消授权操作...`));
  console.log(chalk.gray(`代币地址: ${tokenAddress}`));
  console.log(chalk.gray(`取消授权地址: ${spenderAddress}`));
  console.log(chalk.gray(`钱包数量: ${walletClients.length}`));
  
  // 先检查当前授权状态
  const allowances = await checkAllowances(walletClients, publicClient, tokenAddress, spenderAddress);
  const needRevoke = allowances.filter(a => a.allowance > 0n);
  
  if (needRevoke.length === 0) {
    console.log(chalk.yellow('\n没有需要取消授权的钱包'));
    return [];
  }
  
  console.log(chalk.yellow(`\n需要取消授权的钱包: ${needRevoke.length}个`));
  
  // 生成revoke数据（approve 0）
  const revokeData = encodeFunctionData({
    abi: ERC20_ABI,
    functionName: 'approve',
    args: [spenderAddress, 0n]
  });
  
  const tasks = needRevoke.map(({ wallet }, index) => 
    limit(async () => {
      try {
        const hash = await wallet.client.sendTransaction({
          to: tokenAddress,
          data: revokeData,
          gas: BigInt(config.initialGasLimit),
          gasPrice: parseGwei(config.initialGasPriceGwei)
        });
        
        console.log(chalk.green(`✓ 钱包 ${wallet.index} (${wallet.address}) 取消授权成功: ${hash}`));
        return { success: true, wallet, hash };
      } catch (error) {
        console.log(chalk.red(`✗ 钱包 ${wallet.index} (${wallet.address}) 取消授权失败: ${error.message}`));
        return { success: false, wallet, error };
      }
    })
  );
  
  const results = await Promise.all(tasks);
  
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(chalk.blue(`\n取消授权完成统计:`));
  console.log(chalk.green(`成功: ${successful}`));
  console.log(chalk.red(`失败: ${failed}`));
  
  // 再次检查确认
  console.log(chalk.blue('\n验证取消授权结果...'));
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  const finalAllowances = await checkAllowances(walletClients, publicClient, tokenAddress, spenderAddress);
  const stillApproved = finalAllowances.filter(a => a.allowance > 0n);
  
  if (stillApproved.length > 0) {
    console.log(chalk.yellow(`\n仍有 ${stillApproved.length} 个钱包保持授权状态`));
  } else {
    console.log(chalk.green('\n✓ 所有钱包已成功取消授权'));
  }
  
  return results;
}