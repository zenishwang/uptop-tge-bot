import chalk from 'chalk';
import { HttpSignatureProvider, StaticSignatureProvider, buildSignedCalldata } from '../src/signature.js';

async function testSignatureProvider() {
  console.log(chalk.bold.cyan('\n🔑 签名功能测试工具\n'));
  
  // 测试静态签名
  console.log(chalk.blue('1. 测试静态签名提供者:'));
  const staticProvider = new StaticSignatureProvider('0x1234567890abcdef');
  const testAddress = '0x742d35cc6cf3f6a5d7d20d8f3f8f2c8a1a2b3c4d';
  
  try {
    const signature = await staticProvider.getSignature(testAddress);
    console.log(chalk.green(`✓ 获取签名成功: ${signature}`));
  } catch (error) {
    console.log(chalk.red(`✗ 获取签名失败: ${error.message}`));
  }
  
  // 测试calldata构建
  console.log(chalk.blue('\n2. 测试calldata构建:'));
  const originalCalldata = '0xedf9e25100000000000000000000000000000000000000000000000000000000000000000000000000000000000000004c52fdc9fde0eaf0008154e5956adf61e18b444400000000000000000000000000000000000000000000000000000002540be400';
  const signature = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1b';
  
  console.log(chalk.gray('原始calldata:'));
  console.log(chalk.gray(originalCalldata));
  
  const signedCalldata = buildSignedCalldata(originalCalldata, signature, 'append');
  console.log(chalk.gray('\n添加签名后:'));
  console.log(chalk.gray(signedCalldata));
  
  // 测试HTTP签名（如果有配置）
  if (process.env.SIGNATURE_API_URL) {
    console.log(chalk.blue('\n3. 测试HTTP签名提供者:'));
    const httpProvider = new HttpSignatureProvider({
      apiUrl: process.env.SIGNATURE_API_URL,
      apiKey: process.env.SIGNATURE_API_KEY,
      method: process.env.SIGNATURE_METHOD || 'POST'
    });
    
    try {
      const httpSignature = await httpProvider.getSignature(testAddress);
      console.log(chalk.green(`✓ HTTP签名获取成功: ${httpSignature}`));
    } catch (error) {
      console.log(chalk.red(`✗ HTTP签名获取失败: ${error.message}`));
    }
  } else {
    console.log(chalk.yellow('\n3. 跳过HTTP签名测试（未配置SIGNATURE_API_URL）'));
  }
}

testSignatureProvider().catch(console.error);