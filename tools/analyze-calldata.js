import chalk from 'chalk';
import { analyzeCalldata, interactiveModifyCalldata } from '../src/decode-helper.js';

// 获取命令行参数
const calldata = process.argv[2];

if (!calldata) {
  console.log(chalk.red('请提供要分析的calldata'));
  console.log(chalk.gray('用法: node tools/analyze-calldata.js <calldata>'));
  process.exit(1);
}

console.log(chalk.bold.cyan('\n🔍 Calldata分析工具\n'));

// 分析你提供的示例
const example1 = '0xedf9e25100000000000000000000000000000000000000000000000000000000000000000000000000000000000000004c52fdc9fde0eaf0008154e5956adf61e18b444400000000000000000000000000000000000000000000000000000002540be4000000000000000000000000000000000000000000000000000008abf12a5ea900';
const example2 = '0xedf9e25100000000000000000000000000000000000000000000000000000000000000000000000000000000000000004c52fdc9fde0eaf0008154e5956adf61e18b4444000000000000000000000000000000000000000000000000000000174876e8000000000000000000000000000000000000000000000000000000000000000000';

if (calldata === 'example') {
  console.log(chalk.blue('分析示例1:'));
  analyzeCalldata(example1);
  
  console.log(chalk.blue('\n分析示例2:'));
  analyzeCalldata(example2);
  
  console.log(chalk.yellow('\n对比分析:'));
  console.log(chalk.gray('参数3从 0x2540be400 (10000000000) 变为 0x174876e800 (100000000000)'));
  console.log(chalk.gray('参数4从 0x8abf12a5ea900 (2458962261969152) 变为 0x0 (0)'));
  console.log(chalk.green('\n看起来参数4是minAmountOut，需要设置为0'));
} else {
  const modified = interactiveModifyCalldata(calldata);
  console.log(chalk.green('\n修改后的calldata:'));
  console.log(modified);
}