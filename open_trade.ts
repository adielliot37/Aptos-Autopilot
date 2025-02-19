import { MerkleClient, MerkleClientConfig } from "@merkletrade/ts-sdk";
import {
  Account,
  Aptos,
  Ed25519PrivateKey,
  type InputEntryFunctionData,
  PrivateKey,
  PrivateKeyVariants
} from "@aptos-labs/ts-sdk";

import dotenv from "dotenv";
dotenv.config();

const args = process.argv.slice(2);
const privateKeyHex = args[0];
const publicKey = args[1];

if (!privateKeyHex || !publicKey) {
  console.error("Missing required arguments: privateKeyHex and publicKey");
  process.exit(1);
}

const merkleConfig = await MerkleClientConfig.testnet();
const merkle = new MerkleClient(merkleConfig);
const aptos = new Aptos(merkle.config.aptosConfig);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Initialize account using the provided decrypted private key
const account = Account.fromPrivateKey({
  privateKey: new Ed25519PrivateKey(
    PrivateKey.formatPrivateKey(privateKeyHex, PrivateKeyVariants.Ed25519)
  ),
});


// const faucetPayload = merkle.payloads.testnetFaucetUSDC({
//     amount: 10_000_000n,
//   });
// const faucetTx = await sendTransaction(faucetPayload);

// Create a market order payload for BTC_USD
const openPayload = merkle.payloads.placeMarketOrder({
  pair: "BTC_USD",
  userAddress: account.accountAddress,
  sizeDelta: 300_000_000n,
  collateralDelta: 10_000_000n,
  isLong: true,
  isIncrease: true,
});

async function sendTransaction(payload: InputEntryFunctionData) {
  const transaction = await aptos.transaction.build.simple({
    sender: account.accountAddress,
    data: payload,
  });
  const { hash } = await aptos.signAndSubmitTransaction({ signer: account, transaction });
  return await aptos.waitForTransaction({ transactionHash: hash });
}

// Execute the trade
const openTx = await sendTransaction(openPayload);
// Wait a little for the trade to be reflected
await sleep(4000);

// Fetch open positions and extract trade summary for BTC_USD
const positions = await merkle.getPositions({ address: account.accountAddress.toString() });
const position = positions.find((p: any) => p.pairType.endsWith("BTC_USD"));
if (!position) {
  console.error("BTC_USD position not found.");
  process.exit(1);
}

// Prepare a trade summary (selected fields only)
const tradeSummary = {
  uid: position.uid,
  avgPrice: position.avgPrice.toString(),
  collateral: position.collateral.toString(),
  pairType: position.pairType,
  size: position.size.toString(),
  takeProfitTriggerPrice: position.takeProfitTriggerPrice.toString(),
  txnHash: openTx.hash,
};

// Output only valid JSON (without any extra logs)
console.log(JSON.stringify(tradeSummary));