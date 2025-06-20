import chalk from 'chalk';
import { loadConfig } from './src/config.js';
import { generateWallets, createWalletClients } from './src/wallet.js';
import { batchApprove } from './src/approve.js';
import { batchPurchase } from './src/purchase.js';
import { batchPurchaseWithSignature } from './src/purchase-with-signature.js';
import { ultraFastBatchPurchase } from './src/fast-mode.js';
import { createPublicClient, http } from 'viem';
import { bsc } from 'viem/chains';

async function main() {
  console.log(chalk.bold.cyan('\n🚀 TGE批量抢购脚本启动\n'));
  
  const config = loadConfig();
  
  console.log(chalk.blue('\n1. 生成钱包...'));
  const wallets = generateWallets(config.mnemonic, config.walletCount);
  console.log(chalk.green(`✓ 已生成 ${wallets.length} 个钱包`));
  
  const walletClients = createWalletClients(wallets, config.rpcUrl);
  
  const publicClient = createPublicClient({
    chain: bsc,
    transport: http(config.rpcUrl)
  });
  
  console.log(chalk.blue('\n2. 检查网络连接...'));
  try {
    const blockNumber = await publicClient.getBlockNumber();
    console.log(chalk.green(`✓ 连接成功，当前区块高度: ${blockNumber}`));
  } catch (error) {
    console.log(chalk.red(`✗ 网络连接失败: ${error.message}`));
    process.exit(1);
  }
  
  console.log(chalk.blue('\n3. 显示钱包地址...'));
  wallets.slice(0, 5).forEach((wallet, i) => {
    console.log(chalk.gray(`  钱包${i}: ${wallet.address}`));
  });
  console.log(chalk.gray(`  ... 还有 ${wallets.length - 5} 个钱包`));
  
  console.log(chalk.yellow('\n请确认以下信息:'));
  console.log(chalk.yellow(`- 即将对 ${config.tokenAddress} 进行approve操作`));
  console.log(chalk.yellow(`- 授权给合约: ${config.tgeContractAddress}`));
  console.log(chalk.yellow(`- 然后执行抢购交易`));
  console.log(chalk.yellow(`- 交易数据: 0x${config.purchaseData.substring(0, 10)}...`));
  
  console.log(chalk.bold.red('\n⚠️  警告: 请确保以上信息正确，按回车继续，按Ctrl+C取消'));
  
  await new Promise(resolve => {
    process.stdin.once('data', resolve);
  });
  
  console.log(chalk.bold.blue('\n====== 开始执行批量操作 ======'));
  
  let purchaseResults;
  
  if (config.executionMode === 'ultra') {
    console.log(chalk.bold.yellow('\n⚡ 超高速模式启动！'));
    purchaseResults = await ultraFastBatchPurchase(
      walletClients,
      publicClient,
      config.tokenAddress,
      config.tgeContractAddress,
      config.purchaseData,
      config
    );
  } else {
    console.log(chalk.blue('\n4. 执行批量approve...'));
    const approveResults = await batchApprove(
      walletClients,
      config.tokenAddress,
      config.tgeContractAddress,
      config
    );
    
    const approveSuccess = approveResults.filter(r => r.success).length;
    if (approveSuccess === 0) {
      console.log(chalk.red('\n所有approve操作都失败了，请检查配置和钱包余额'));
      process.exit(1);
    }
    
    console.log(chalk.blue('\n5. 立即执行批量抢购...'));
    console.log(chalk.bold.yellow('🔥 抢购开始！'));
    
    if (config.signatureRequired) {
      purchaseResults = await batchPurchaseWithSignature(
        walletClients,
        config.tgeContractAddress,
        config.purchaseData,
        config
      );
    } else {
      purchaseResults = await batchPurchase(
        walletClients,
        config.tgeContractAddress,
        config.purchaseData,
        config
      );
    }
  }
  
  console.log(chalk.bold.green('\n✅ 批量操作完成！'));
  
  const purchaseSuccess = purchaseResults.filter(r => r.success).length;
  console.log(chalk.blue('\n最终统计:'));
  console.log(chalk.green(`  抢购成功: ${purchaseSuccess}/${wallets.length}`));
  console.log(chalk.yellow(`  成功率: ${(purchaseSuccess / wallets.length * 100).toFixed(2)}%`));
  
  if (purchaseSuccess > 0) {
    console.log(chalk.green('\n成功的交易哈希:'));
    purchaseResults
      .filter(r => r.success)
      .slice(0, 10)
      .forEach((r, i) => {
        console.log(chalk.gray(`  ${i + 1}. ${r.hash}`));
      });
    if (purchaseSuccess > 10) {
      console.log(chalk.gray(`  ... 还有 ${purchaseSuccess - 10} 个成功交易`));
    }
  }
}

main().catch(error => {
  console.error(chalk.red('\n❌ 脚本执行失败:'), error);
  process.exit(1);
});