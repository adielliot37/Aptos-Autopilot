import { MerkleClient, MerkleClientConfig } from "@merkletrade/ts-sdk";
import {
  Account,
  Aptos,
  Ed25519PrivateKey,
  type InputEntryFunctionData,
  PrivateKey,
  PrivateKeyVariants,
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
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Initialize account using the provided private key
const account = Account.fromPrivateKey({
  privateKey: new Ed25519PrivateKey(
    PrivateKey.formatPrivateKey(privateKeyHex, PrivateKeyVariants.Ed25519)
  ),
});

// Fetch open positions for the account
const positions = await merkle.getPositions({ address: account.accountAddress.toString() });
const position = positions.find((p: any) => p.pairType.endsWith("BTC_USD"));
if (!position) {
  console.error("BTC_USD position not found.");
  process.exit(1);
}

// Create a close order payload for BTC_USD
const closePayload = merkle.payloads.placeMarketOrder({
  pair: "BTC_USD",
  userAddress: account.accountAddress,
  sizeDelta: position.size,
  collateralDelta: position.collateral,
  isLong: position.isLong,
  isIncrease: false,
});

async function sendTransaction(payload: InputEntryFunctionData) {
  const transaction = await aptos.transaction.build.simple({
    sender: account.accountAddress,
    data: payload,
  });
  const { hash } = await aptos.signAndSubmitTransaction({ signer: account, transaction });
  return await aptos.waitForTransaction({ transactionHash: hash });
}

// Execute the close order trade
const closeTx = await sendTransaction(closePayload);
await sleep(5000);

// Prepare trade summary for the closed position
const tradeSummary = {
  uid: position.uid,
  avgPrice: position.avgPrice.toString(),
  collateral: position.collateral.toString(),
  pairType: position.pairType,
  size: position.size.toString(),
  takeProfitTriggerPrice: position.takeProfitTriggerPrice.toString(),
  txnHash: closeTx.hash,
};

// Output only valid JSON (without any extra logs)
console.log(JSON.stringify(tradeSummary));