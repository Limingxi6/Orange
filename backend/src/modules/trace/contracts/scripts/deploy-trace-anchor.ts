import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import * as dotenv from 'dotenv';
import { isAddress } from 'ethers';
import hre from 'hardhat';

dotenv.config();

function getRequiredEnv(name: 'EVM_RPC_URL' | 'EVM_PRIVATE_KEY'): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function normalizePrivateKey(value: string): string {
  const normalized = value.startsWith('0x') ? value : `0x${value}`;
  if (!/^0x[a-fA-F0-9]{64}$/.test(normalized)) {
    throw new Error('EVM_PRIVATE_KEY must be a 32-byte hex string (with or without 0x).');
  }
  return normalized;
}

async function main() {
  const rpcUrl = getRequiredEnv('EVM_RPC_URL');
  const privateKey = normalizePrivateKey(getRequiredEnv('EVM_PRIVATE_KEY'));
  const configuredInitialOwner = process.env.EVM_INITIAL_OWNER?.trim();

  if (configuredInitialOwner && !isAddress(configuredInitialOwner)) {
    throw new Error('EVM_INITIAL_OWNER must be a valid EVM address.');
  }

  const { ethers, artifacts, network } = hre;
  const [deployer] = await ethers.getSigners();
  const initialOwner = configuredInitialOwner || deployer.address;
  const deployerFromPrivateKey = new ethers.Wallet(privateKey).address;

  if (deployerFromPrivateKey.toLowerCase() !== deployer.address.toLowerCase()) {
    throw new Error('EVM_PRIVATE_KEY does not match the configured signer account.');
  }

  const factory = await ethers.getContractFactory('TraceAnchor');
  const contract = await factory.deploy(initialOwner);
  const deploymentTx = contract.deploymentTransaction();

  if (!deploymentTx) {
    throw new Error('Missing deployment transaction.');
  }

  await contract.waitForDeployment();
  const receipt = await deploymentTx.wait();
  const contractAddress = await contract.getAddress();
  const providerNetwork = await ethers.provider.getNetwork();
  const chainId = Number(providerNetwork.chainId);
  const networkName = network.name;

  const artifact = await artifacts.readArtifact('TraceAnchor');
  const abiOutput = {
    contractName: artifact.contractName,
    abi: artifact.abi,
  };

  const projectRoot = resolve(__dirname, '..');
  const abiOutputPath = join(projectRoot, 'TraceAnchor.json');
  writeFileSync(abiOutputPath, `${JSON.stringify(abiOutput, null, 2)}\n`, 'utf8');

  const deploymentDir = join(projectRoot, 'deployments');
  mkdirSync(deploymentDir, { recursive: true });

  const deploymentOutput = {
    contractName: artifact.contractName,
    network: networkName,
    chainId,
    contractAddress,
    deployer: deployer.address,
    txHash: deploymentTx.hash,
    blockNumber: receipt?.blockNumber ?? null,
    initialOwner,
    deployedAt: new Date().toISOString(),
    abiPath: 'TraceAnchor.json',
  };

  const deploymentPath = join(deploymentDir, `${networkName}.json`);
  writeFileSync(deploymentPath, `${JSON.stringify(deploymentOutput, null, 2)}\n`, 'utf8');

  const backendEnvSnippet = [
    'TRACE_ANCHOR_ENABLED=true',
    'TRACE_ANCHOR_PROVIDER=evm',
    'TRACE_CHAIN_PROVIDER=evm',
    `TRACE_CHAIN_NETWORK=${networkName}`,
    `EVM_RPC_URL=${rpcUrl}`,
    'EVM_PRIVATE_KEY=0x<your_private_key>',
    `EVM_CHAIN_ID=${chainId}`,
    `EVM_CHAIN_NAME=${networkName}`,
    `EVM_CONTRACT_ADDRESS=${contractAddress}`,
  ].join('\n');

  const backendEnvPath = join(deploymentDir, `${networkName}.backend.env`);
  writeFileSync(backendEnvPath, `${backendEnvSnippet}\n`, 'utf8');

  console.log('=== TraceAnchor deployed ===');
  console.log(`contract address: ${contractAddress}`);
  console.log(`network name: ${networkName}`);
  console.log(`deployer address: ${deployer.address}`);
  console.log(`tx hash: ${deploymentTx.hash}`);
  console.log(`abi output: ${abiOutputPath}`);
  console.log(`deployment output: ${deploymentPath}`);
  console.log('--- backend .env snippet ---');
  console.log(backendEnvSnippet);
}

main().catch((error) => {
  console.error('TraceAnchor deployment failed.');
  console.error(error);
  process.exitCode = 1;
});
