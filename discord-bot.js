import dotenv from "dotenv";
import { Client, GatewayIntentBits } from "discord.js";
import OpenAI from "openai";

dotenv.config({ path: ".env.local", override: true });

const DISCORD_TOKEN = process.env.DISCORD_BOT_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5.5";

if (!DISCORD_TOKEN) throw new Error("DISCORD_BOT_TOKEN is missing");
if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is missing");

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once("clientReady", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  console.log(`🤖 Using OpenAI model: ${OPENAI_MODEL}`);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith("!")) return;

  const prompt = message.content.slice(1).trim();

  if (!prompt) return message.reply("Send a command after `!`.");

  if (["delete", "drop", "rm -rf"].some((word) => prompt.toLowerCase().includes(word))) {
    return message.reply("❌ Unsafe command blocked.");
  }

  if (prompt === "ping") return message.reply("🏓 Pong");

  await message.channel.sendTyping();

  try {
    const response = await openai.responses.create({
      model: OPENAI_MODEL,
      input: `You are CertNow AI, helping test and improve a SaaS for gas engineers. Be practical and concise.\n\nUser request: ${prompt}`,
    });

    const text = response.output_text || "No response.";
    const chunks = text.match(/[\s\S]{1,1800}/g) || [];

    for (const chunk of chunks) {
      await message.reply(chunk);
    }
  } catch (err) {
    console.error(err);
    await message.reply("❌ OpenAI request failed. Check terminal logs.");
  }
});

client.login(DISCORD_TOKEN).catch((err) => {
  console.error("❌ Discord login failed:", err.message);
});