import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import fs from 'fs';
import { Telegraf } from 'telegraf';
import { AptosAccount } from 'aptos';
import dotenv from 'dotenv';
import { Aptos, AptosConfig, Network } from "@aptos-labs/ts-sdk";

dotenv.config();

// Global error handlers
process.on('unhandledRejection', (reason, promise) => {
  console.error("Unhandled Rejection:", reason);
});
process.on('uncaughtException', (err) => {
  console.error("Uncaught Exception:", err);
});

const BOT_TOKEN = process.env.BOT_TOKEN;
const PORT = process.env.PORT || 3000;
const TOTP_ENCRYPTION_KEY = process.env.TOTP_ENCRYPTION_KEY; 
const APTOS_COIN_TYPE = "0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>";

if (!BOT_TOKEN) {
  console.error('Missing BOT_TOKEN in .env');
  process.exit(1);
}

const app = express();
app.use(bodyParser.json());
app.use(cors({ origin: '*' }));

const bot = new Telegraf(BOT_TOKEN);


const USERS_DB_FILE = 'users.json';
const TRADES_DB_FILE = 'trades.json';

function loadUsers(): Record<string, any> {
  if (!fs.existsSync(USERS_DB_FILE)) {
    fs.writeFileSync(USERS_DB_FILE, JSON.stringify({}), 'utf-8');
  }
  const data = fs.readFileSync(USERS_DB_FILE, 'utf-8');
  return JSON.parse(data);
}

function saveUsers(users: any): void {
  fs.writeFileSync(USERS_DB_FILE, JSON.stringify(users, null, 2), 'utf-8');
  console.log('[SAVE USERS] Users DB updated on disk.');
}

function loadTrades(): any[] {
  if (!fs.existsSync(TRADES_DB_FILE)) {
    fs.writeFileSync(TRADES_DB_FILE, JSON.stringify([]), 'utf-8');
  }
  const data = fs.readFileSync(TRADES_DB_FILE, 'utf-8');
  return JSON.parse(data);
}

function saveTrade(trade: any): void {
  const trades = loadTrades();
  trades.push(trade);
  fs.writeFileSync(TRADES_DB_FILE, JSON.stringify(trades, null, 2), 'utf-8');
  console.log('[SAVE TRADES] Trade saved to disk.');
}


bot.start(async (ctx) => {
  const telegramId = String(ctx.from.id);
  const telegramUsername = ctx.from.username || '';
  console.log(`[BOT START] /start by user ${telegramId} (@${telegramUsername})`);

  const users = loadUsers();
  if (users[telegramId]) {
    const userRecord = users[telegramId];
    if (!userRecord.wallet || !userRecord.wallet.publicKey) {
      console.error(`[BOT START] User ${telegramId} record incomplete!`);
      return ctx.reply('Something seems off with your account. Please contact support.');
    }
    console.log(`[BOT START] User ${telegramId} is already registered. Aptos Address: ${userRecord.wallet.publicKey}`);
    return ctx.reply(
      `Welcome back, @${telegramUsername}!\n\n` +
      `Your Aptos address: ${userRecord.wallet.publicKey}\n` +
      `Use /openPosition to perform a trade, or /balance to check your balance.`
    );
  }

  // Generate new Aptos account immediately
  const { AptosAccount } = await import("aptos");
  const newAccount = new AptosAccount();
  const publicKeyStr = newAccount.address().toString();
  const privateKeyHex = Buffer.from(newAccount.signingKey.secretKey.slice(0, 32)).toString("hex");

  
  const allUsers = loadUsers();
  allUsers[telegramId] = {
    telegramId,
    telegramUsername,
    wallet: {
      publicKey: publicKeyStr,
      privateKey: privateKeyHex,
    },
  };
  saveUsers(allUsers);
  console.log(`[BOT START] Registration complete for ${telegramId}. Aptos Address: ${publicKeyStr}`);
  await ctx.reply(
    `✅ Registration complete!\nYour new Aptos address: *${publicKeyStr}*\n\n` +
    `Here is your **32-byte Private Key (hex)** (displayed only once):\n\`${privateKeyHex}\`\n\n` +
    `Keep this safe!\nUse /balance to check your balance.`,
    { parse_mode: 'Markdown' }
  );
});


bot.command('balance', async (ctx) => {
  const telegramId = String(ctx.from.id);
  console.log(`[BALANCE] User ${telegramId} requested balance.`);

  const users = loadUsers();
  const user = users[telegramId];
  if (!user || !user.wallet || !user.wallet.publicKey) {
    console.warn(`[BALANCE] No wallet found for ${telegramId}`);
    return ctx.reply('No wallet found. Use /start to register.');
  }
  const publicKey = user.wallet.publicKey;
  try {
    const [testnetBalance] = await Promise.all([
      getAptosBalance(Network.TESTNET, publicKey),
    ]);
    console.log(`[BALANCE] User ${telegramId} - Testnet: ${testnetBalance} APT`);
    await ctx.reply(
      `🔹 *Your Aptos Address:* \`${publicKey}\`\n\n` +
      `🧪 *Testnet Balance:* ${testnetBalance} APT\n\n` +
      `Check on Aptos Explorer.`,
      { parse_mode: 'Markdown' }
    );
  } catch (error: any) {
    console.error('[BALANCE] Error fetching balance:', error.message);
    await ctx.reply('Failed to fetch balance. Please try again later.');
  }
});


app.post('/openPosition', async (req: Request, res: Response) => {
  const telegramId = req.headers['telegram-id'] as string;
  if (!telegramId) {
    return res.status(400).json({ error: 'Telegram ID required' });
  }
  console.log(`[OPENPOSITION] Received HTTP openPosition request for ${telegramId}.`);
  const users = loadUsers();
  const user = users[telegramId];
  if (!user) {
    return res.status(404).json({ error: 'User not found. Please register first.' });
  }
  const privateKeyHex = user.wallet.privateKey;
  if (!privateKeyHex) {
    return res.status(500).json({ error: 'User wallet data incomplete.' });
  }
  try {
    const { exec } = await import("child_process");
   
    exec(`npx ts-node open_trade.ts ${privateKeyHex} ${user.wallet.publicKey}`, async (error: any, stdout: string, stderr: string) => {
      if (error) {
        console.error(`[OPENPOSITION] Error executing trade: ${stderr || error.message}`);
        return res.status(500).json({ error: 'Trade execution failed' });
      }
      let tradeData;
      try {
        tradeData = JSON.parse(stdout);
      } catch (parseError: any) {
        console.error(`[OPENPOSITION] JSON parse error: ${parseError.message}`);
        return res.status(500).json({ error: 'Failed to parse trade result' });
      }
      const tradeRecord = { ...tradeData, type: "open" };
      saveTrade(tradeRecord);
      const tradeMessage = `🚀 *Trade Executed!*\n\n` +
          `📌 *Details:*\n` +
          `🔹 *UID:* ${tradeData.uid}\n` +
          `🔹 *Pair:* ${tradeData.pairType}\n` +
          `🔹 *Size:* ${tradeData.size}\n` +
          `🔹 *Avg Price:* ${tradeData.avgPrice}\n` +
          `🔹 *Collateral:* ${tradeData.collateral}\n` +
          `🔹 *Take Profit:* ${tradeData.takeProfitTriggerPrice}\n` +
          `🔹 *Type:* open\n\n` +
          `✅ *Txn Hash:* \`${tradeData.txnHash}\`\n\n` +
          `🔗 [View Transaction](https://explorer.aptoslabs.com/txn/${tradeData.txnHash})`;
      await bot.telegram.sendMessage(telegramId, tradeMessage, { parse_mode: "Markdown" });
      return res.json({ message: 'Trade executed successfully.', trade: tradeRecord });
    });
  } catch (error: any) {
    console.error(`[OPENPOSITION] Error: ${error.message}`);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});


app.post('/closePosition', async (req: Request, res: Response) => {
  const telegramId = req.headers['telegram-id'] as string;
  if (!telegramId) {
    return res.status(400).json({ error: 'Telegram ID required' });
  }
  console.log(`[CLOSEPOSITION] Received HTTP closePosition request for ${telegramId}.`);
  const users = loadUsers();
  const user = users[telegramId];
  if (!user) {
    return res.status(404).json({ error: 'User not found. Please register first.' });
  }
  const privateKeyHex = user.wallet.privateKey;
  if (!privateKeyHex) {
    return res.status(500).json({ error: 'User wallet data incomplete.' });
  }
  try {
    const { exec } = await import("child_process");
    // Execute close_trade.ts (close order) with privateKeyHex and publicKey as arguments
    exec(`npx ts-node close_trade.ts ${privateKeyHex} ${user.wallet.publicKey}`, async (error: any, stdout: string, stderr: string) => {
      if (error) {
        console.error(`[CLOSEPOSITION] Error executing trade: ${stderr || error.message}`);
        return res.status(500).json({ error: 'Trade execution failed' });
      }
      let tradeData;
      try {
        tradeData = JSON.parse(stdout);
      } catch (parseError: any) {
        console.error(`[CLOSEPOSITION] JSON parse error: ${parseError.message}`);
        return res.status(500).json({ error: 'Failed to parse trade result' });
      }
      const tradeRecord = { ...tradeData, type: "close" };
      saveTrade(tradeRecord);
      const tradeMessage = `🚀 *Trade Closed Successfully!*\n\n` +
          `📌 *Details:*\n` +
          `🔹 *UID:* ${tradeData.uid}\n` +
          `🔹 *Pair:* ${tradeData.pairType}\n` +
          `🔹 *Size:* ${tradeData.size}\n` +
          `🔹 *Avg Price:* ${tradeData.avgPrice}\n` +
          `🔹 *Collateral:* ${tradeData.collateral}\n` +
          `🔹 *Take Profit:* ${tradeData.takeProfitTriggerPrice}\n` +
          `🔹 *Type:* close\n\n` +
          `✅ *Txn Hash:* \`${tradeData.txnHash}\`\n\n` +
          `🔗 [View Transaction](https://explorer.aptoslabs.com/txn/${tradeData.txnHash})`;
      await bot.telegram.sendMessage(telegramId, tradeMessage, { parse_mode: "Markdown" });
      return res.json({ message: 'Trade closed successfully.', trade: tradeRecord });
    });
  } catch (error: any) {
    console.error(`[CLOSEPOSITION] Error: ${error.message}`);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});


app.use((req: Request, res: Response, next: NextFunction): void => {
  console.log("[HTTP] Received request:", req.method, req.url);
  next();
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[SERVER] Running on port ${PORT} and listening on 0.0.0.0`);
});

(async () => {
  try {
    await bot.launch();
    console.log('[BOT] Telegram bot launched.');
  } catch (err) {
    console.error("Bot launch error:", err);
  }
})();

process.once('SIGINT', () => {
  console.log('[SHUTDOWN] SIGINT received. Stopping bot...');
  bot.stop('SIGINT');
});
process.once('SIGTERM', () => {
  console.log('[SHUTDOWN] SIGTERM received. Stopping bot...');
  bot.stop('SIGTERM');
});