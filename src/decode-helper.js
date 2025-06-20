import chalk from 'chalk';

export function analyzeCalldata(calldata) {
  // 移除0x前缀
  const data = calldata.replace(/^0x/i, '');
  
  // 函数选择器（前8位）
  const selector = data.slice(0, 8);
  
  // 参数部分（每个参数64位）
  const params = [];
  for (let i = 8; i < data.length; i += 64) {
    params.push(data.slice(i, i + 64));
  }
  
  console.log(chalk.blue('\n字节码分析:'));
  console.log(chalk.gray(`函数选择器: 0x${selector}`));
  console.log(chalk.gray(`参数数量: ${params.length}`));
  
  params.forEach((param, index) => {
    const value = BigInt(`0x${param}`);
    console.log(chalk.gray(`参数${index}: 0x${param} (${value})`));
  });
  
  return { selector, params };
}

export function modifyParameter(calldata, paramIndex, newValue) {
  const data = calldata.replace(/^0x/i, '');
  const selector = data.slice(0, 8);
  
  const params = [];
  for (let i = 8; i < data.length; i += 64) {
    params.push(data.slice(i, i + 64));
  }
  
  // 将新值转换为64位hex
  const hexValue = BigInt(newValue).toString(16).padStart(64, '0');
  params[paramIndex] = hexValue;
  
  return '0x' + selector + params.join('');
}

export function findAndReplaceMinAmount(calldata, minAmountPattern = null) {
  const data = calldata.replace(/^0x/i, '');
  const selector = data.slice(0, 8);
  const params = [];
  
  for (let i = 8; i < data.length; i += 64) {
    params.push(data.slice(i, i + 64));
  }
  
  // 策略1: 寻找最后一个非零参数（通常minAmountOut是最后一个参数）
  let lastNonZeroIndex = -1;
  for (let i = params.length - 1; i >= 0; i--) {
    if (params[i] !== '0'.repeat(64)) {
      lastNonZeroIndex = i;
      break;
    }
  }
  
  // 策略2: 寻找看起来像金额的参数（通常是较大的数字）
  const likelyAmountIndices = [];
  params.forEach((param, index) => {
    const value = BigInt(`0x${param}`);
    // 如果值大于10^15（0.001 ETH/BNB的wei值），可能是金额参数
    if (value > 1000000000000000n) {
      likelyAmountIndices.push({ index, value });
    }
  });
  
  console.log(chalk.yellow('\n可能的minAmountOut参数:'));
  if (lastNonZeroIndex >= 0) {
    console.log(chalk.gray(`- 最后一个非零参数 (索引${lastNonZeroIndex}): ${BigInt(`0x${params[lastNonZeroIndex]}`)}`));
  }
  likelyAmountIndices.forEach(({ index, value }) => {
    console.log(chalk.gray(`- 参数${index}: ${value}`));
  });
  
  return { selector, params, lastNonZeroIndex, likelyAmountIndices };
}

// 交互式修改工具
export function interactiveModifyCalldata(calldata) {
  console.log(chalk.blue('\n原始calldata:'));
  console.log(chalk.gray(calldata));
  
  const analysis = analyzeCalldata(calldata);
  const suggestions = findAndReplaceMinAmount(calldata);
  
  console.log(chalk.yellow('\n建议修改:'));
  if (suggestions.lastNonZeroIndex >= 0) {
    const modifiedCalldata = modifyParameter(calldata, suggestions.lastNonZeroIndex, 0);
    console.log(chalk.green(`将参数${suggestions.lastNonZeroIndex}设为0:`));
    console.log(chalk.gray(modifiedCalldata));
    return modifiedCalldata;
  }
  
  return calldata;
}