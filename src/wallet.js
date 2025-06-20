import { mnemonicToAccount } from 'viem/accounts';
import { createWalletClient, http } from 'viem';
import { bsc } from 'viem/chains';

export function generateWallets(mnemonic, count = 50) {
  const wallets = [];
  
  for (let i = 0; i < count; i++) {
    const account = mnemonicToAccount(mnemonic, {
      addressIndex: i
    });
    
    wallets.push({
      index: i,
      address: account.address,
      account
    });
  }
  
  return wallets;
}

export function createWalletClients(wallets, rpcUrl) {
  return wallets.map(wallet => ({
    ...wallet,
    client: createWalletClient({
      account: wallet.account,
      chain: bsc,
      transport: http(rpcUrl)
    })
  }));
}