# TGE批量抢购脚本

用于BSC链上TGE项目的批量抢购工具，支持多钱包并发、自动重试、动态gas调整等功能。

## 功能特性

- 🔑 助记词批量生成钱包（可配置1-50个）
- 💰 批量approve BEP20代币
- 🚀 高并发批量抢购
- ⚡ 超高速模式：approve和purchase并行发送
- 🔄 智能重试机制
- ⛽ 动态gas调整策略
- 📊 详细的执行统计

## 快速开始

1. 安装依赖
```bash
npm install
```

2. 配置环境变量
```bash
cp .env.example .env
```

编辑 `.env` 文件，填入以下参数：
- `MNEMONIC`: 12个单词的助记词
- `TGE_CONTRACT_ADDRESS`: TGE合约地址
- `TOKEN_ADDRESS`: 需要approve的BEP20代币地址
- `PURCHASE_DATA`: 抢购交易的字节码（不含0x前缀）
- `WALLET_COUNT`: 参与抢购的钱包数量（默认50）
- `EXECUTION_MODE`: 执行模式（ultra/fast，默认ultra）
- `MAX_CONCURRENT_WALLETS`: 最大并发数（默认10）
- 其他可选参数见 `.env.example`

3. 运行脚本

抢购：
```bash
npm start
```

取消授权（用于测试）：
```bash
npm run revoke
```

分析calldata：
```bash
npm run analyze <calldata>
```

## 注意事项

- 确保所有钱包都有足够的BNB作为gas费
- 确保钱包有足够的BEP20代币用于抢购
- 建议先在测试网进行测试
- 根据网络情况调整并发数和gas参数

## 安全警告

- 妥善保管助记词，不要泄露给他人
- 本脚本仅供学习研究使用
- 使用前请充分了解风险