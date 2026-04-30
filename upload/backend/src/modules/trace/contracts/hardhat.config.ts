import * as dotenv from 'dotenv';
import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-ethers';

dotenv.config();

function normalizePrivateKey(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }
  return trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`;
}

const rawPrivateKey = (process.env.EVM_PRIVATE_KEY || '').trim();
const chainId = Number.parseInt(process.env.EVM_CHAIN_ID || '11155111', 10);

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.20',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    sepolia: {
      url: process.env.EVM_RPC_URL || '',
      accounts: rawPrivateKey ? [normalizePrivateKey(rawPrivateKey)] : [],
      chainId: Number.isInteger(chainId) ? chainId : 11155111,
    },
  },
  paths: {
    sources: './contracts',
    cache: './cache',
    artifacts: './artifacts',
  },
};

export default config;
