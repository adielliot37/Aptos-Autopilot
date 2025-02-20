# Aptos Autopilot

**Demo** - https://youtu.be/mtkFKM8yAZY?feature=shared

**Transaction(mainnet)** - https://explorer.aptoslabs.com/txn/0xd7411cb2d4d8e7ec50d7a4554c680007b28d1e7f42523418bec7c4878b70ee4e?network=mainnet

## Identified Problems

- **User Onboarding Friction:**  
  A large proportion of retail and institutional traders are interested in autonomous leveraged trading. However, issues with wallet infrastructure security for decentralized exchange automation and poor signal generation hinder user onboarding.

## Proposed Solution

**Aptos Autopilot** is an AI-driven Trading Kit that combines advanced blockchain and machine learning technologies to enable decentralized leveraged trading on Aptos L1. It features:
- **TEE-Protected Wallet Infrastructure:** Secure wallet generation and management using Trusted Execution Environments (TEE).
- **Advanced Signal Generation:** Utilizes a time series transformer to identify high-probability opportunities for longing or shorting Bitcoin positions.
- **Seamless Integration:** Built on Aptos with native support through the Aptos TS SDK and trade execution via the Merkle Trade SDK.

## Integrations Leveraged

- **ZkAGI TEE Nodes:** Secure wallet creation and management.
- **Nixtla Time Series Transformer:** Hosted on the ZkAGI network for advanced signal prediction.
- **Aptos TS SDK:** For seamless blockchain interactions on Aptos.
- **Merkle Trade SDK:** To execute decentralized leveraged trading orders.

## Benefits

- **Fast Finality:** Powered by Aptos, ensuring quick transaction finality.
- **Secure Wallet Infrastructure:** Wallets are safeguarded by TEE with password and OTP encryption(2FA).
- **Compelling Signal Generation:** Advanced time series transformers deliver reliable trading signals.
- **Decentralized Leveraged Trading:** Offers up to 150x leverage and efficient order execution with the Merkle Trade SDK.

## Future Plans

- **Enhanced Risk Management:** Implement risk management strategies for positions using time series transformer insights.
- **Asset Expansion:** Extend support to additional assets beyond Bitcoin.
