import { MerkleClient, MerkleClientConfig } from "@merkletrade/ts-sdk";
const merkle = new MerkleClient(await MerkleClientConfig.testnet());

// subscribe to price feed

const session = await merkle.connectWsApi();

console.log("Connected to Websocket API");

const priceFeed = session.subscribeAccountFeed("0xd47fd290f6f42b212566e216f2b8268f1913831279bb4614b4f7f322cb87c53e");

console.log("Subscribed to price feed");


  console.log(priceFeed);
