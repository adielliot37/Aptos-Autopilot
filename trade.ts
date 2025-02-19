// trade.ts
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
// initialize clients
const merkleConfig = await MerkleClientConfig.testnet();
const merkle = new MerkleClient(merkleConfig);
const aptos = new Aptos(merkle.config.aptosConfig);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// initialize account
const privateKey = process.env.APTOS_PRIVATE_KEY;
if (!privateKey) {
  console.error("APTOS_PRIVATE_KEY is missing in .env file");
  process.exit(1);
}

const account = Account.fromPrivateKey({
  privateKey: new Ed25519PrivateKey(
    PrivateKey.formatPrivateKey(privateKey, PrivateKeyVariants.Ed25519)
  ),
});

// get usdc balance
const faucetPayload = merkle.payloads.testnetFaucetUSDC({
  amount: 10_000_000n,
});
const faucetTx = await sendTransaction(faucetPayload);
console.log(`Successfully claimed testnet USDC (tx hash: ${faucetTx.hash})`);

const usdcBalance = await merkle.getUsdcBalance({
  accountAddress: account.accountAddress,
});

console.log(`USDC Balance: ${Number(usdcBalance) / 1e6} USDC`);

// place order
// const openPayload = merkle.payloads.placeMarketOrder({
//   pair: "BTC_USD",
//   userAddress: account.accountAddress,
//   sizeDelta: 300_000_000n,
//   collateralDelta: 5_000_000n,
//   isLong: true,
//   isIncrease: true,
// });

// const openTx = await sendTransaction(openPayload);

// console.log(`Successfully placed open order (tx hash: ${openTx.hash})`);

await sleep(2000);

// get list of open positions & find BTC_USD position
const positions = await merkle.getPositions({
  address: account.accountAddress.toString(),
});

console.log("Open positions", positions);

const position = positions.find((position: any) =>
  position.pairType.endsWith("BTC_USD")
);
if (!position) {
  throw new Error("BTC_USD position not found");
}

// // close position
const closePayload = merkle.payloads.placeMarketOrder({
  pair: "BTC_USD",
  userAddress: account.accountAddress,
  sizeDelta: position.size,
  collateralDelta: position.collateral,
  isLong: position.isLong,
  isIncrease: false,
});

const closeTx = await sendTransaction(closePayload);

console.log(`Successfully placed close order (tx hash: ${closeTx.hash})`);


// Utility function to send a transaction.
async function sendTransaction(payload: InputEntryFunctionData) {
  const transaction = await aptos.transaction.build.simple({
    sender: account.accountAddress,
    data: payload,
  });
  const { hash } = await aptos.signAndSubmitTransaction({
    signer: account,
    transaction,
  });
  return await aptos.waitForTransaction({ transactionHash: hash });
}