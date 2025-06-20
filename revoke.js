import chalk from 'chalk';
import { loadConfig } from './src/config.js';
import { generateWallets, createWalletClients } from './src/wallet.js';
import { batchRevoke } from './src/revoke.js';
import { createPublicClient, http } from 'viem';
import { bsc } from 'viem/chains';

async function main() {
  console.log(chalk.bold.cyan('\n🔓 批量取消授权脚本\n'));
  
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
  
  console.log(chalk.yellow('\n请确认以下信息:'));
  console.log(chalk.yellow(`- 即将取消 ${config.tokenAddress} 的授权`));
  console.log(chalk.yellow(`- 取消对合约 ${config.tgeContractAddress} 的授权`));
  console.log(chalk.yellow(`- 影响钱包数量: ${wallets.length}`));
  
  console.log(chalk.bold.red('\n⚠️  警告: 请确保以上信息正确，按回车继续，按Ctrl+C取消'));
  
  await new Promise(resolve => {
    process.stdin.once('data', resolve);
  });
  
  console.log(chalk.bold.blue('\n====== 开始执行批量取消授权 ======'));
  
  const results = await batchRevoke(
    walletClients,
    publicClient,
    config.tokenAddress,
    config.tgeContractAddress,
    config
  );
  
  console.log(chalk.bold.green('\n✅ 操作完成！'));
}

main().catch(error => {
  console.error(chalk.red('\n❌ 脚本执行失败:'), error);
  process.exit(1);
});