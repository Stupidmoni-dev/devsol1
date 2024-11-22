require('dotenv').config();
const { Telegraf } = require('telegraf');
const { Connection, PublicKey } = require('@solana/web3.js');
const axios = require('axios');
const fs = require('fs');

const bot = new Telegraf(process.env.BOT_TOKEN);
const connection = new Connection(process.env.SOLANA_RPC_URL, 'confirmed');

// File paths for storing data
const dataPath = './data';
const tasksFile = `${dataPath}/tasks.json`;
const giveawaysFile = `${dataPath}/giveaways.json`;

// Ensure the data directory and files exist
if (!fs.existsSync(dataPath)) fs.mkdirSync(dataPath);
if (!fs.existsSync(tasksFile)) fs.writeFileSync(tasksFile, JSON.stringify([]));
if (!fs.existsSync(giveawaysFile)) fs.writeFileSync(giveawaysFile, JSON.stringify([]));

// Fetch real-time crypto prices from CoinGecko API
const getCryptoPrices = async () => {
    try {
        const response = await axios.get(
            'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd'
        );
        const prices = response.data;
        return {
            btc: `$${prices.bitcoin.usd}`,
            eth: `$${prices.ethereum.usd}`,
            sol: `$${prices.solana.usd}`,
        };
    } catch (error) {
        console.error('Error fetching crypto prices:', error);
        return { btc: 'N/A', eth: 'N/A', sol: 'N/A' };
    }
};

// Bot Welcome Message
bot.start(async (ctx) => {
    const prices = await getCryptoPrices();
    ctx.reply(
        `🚀 Welcome to the **Crypto Task Bot**!\n\n💎 This bot is your all-in-one tool for managing **polls**, **tasks**, and **giveaways** while rewarding participants with real crypto.\n🔗 Boost engagement, run exciting activities, and earn rewards directly within your Telegram group or channel!\n\n📊 **Features**:\n- **Polls**: Gather opinions or insights from your group with easy-to-create crypto polls.\n- **Tasks**: Assign activities like quizzes, sharing content, or creative submissions, and reward members with SOL tokens.\n- **Giveaways**: Run fun and automated giveaways to boost participation.\n- **Referral System**: Earn commission from transactions initiated by your referred users.\n\n📈 **Market Update**:\nBTC: ${prices.btc} | ETH: ${prices.eth} | SOL: ${prices.sol}\n\nType /help to get started or explore our features. Let's make crypto fun and rewarding!`
    );
});

// Help Command
bot.command('help', (ctx) => {
    ctx.reply(
        `🤖 Bot Commands:\n
        /createpoll - Create a new poll
        /createtask - Create a new task
        /creategiveaway - Host a giveaway
        /getreferral - Generate your referral link
        /faq - Learn how to use the bot`
    );
});

// Create Poll
bot.command('createpoll', (ctx) => {
    ctx.reply('Send the poll question and options separated by commas:\n\nExample: "What is your favorite crypto?, BTC, ETH, SOL"');
    bot.on('text', async (ctx) => {
        const input = ctx.message.text.split(',');
        const question = input[0];
        const options = input.slice(1).map((opt, idx) => ({
            text: opt.trim(),
            callback_data: `poll_vote_${idx}`
        }));

        ctx.reply(question, {
            reply_markup: {
                inline_keyboard: [options]
            }
        });
    });
});

// Handling Poll Votes
bot.on('callback_query', (ctx) => {
    const callbackData = ctx.callbackQuery.data;
    if (callbackData.startsWith('poll_vote_')) {
        const voteIndex = callbackData.split('_')[2]; // Extract vote index
        ctx.answerCbQuery(`You voted for option ${voteIndex + 1}!`);
    }
});

// Referral System
bot.command('getreferral', (ctx) => {
    const userId = ctx.from.id;
    const referralLink = `https://t.me/${ctx.botInfo.username}?start=${userId}`;
    ctx.reply(`🚀 Your Referral Link:\n${referralLink}\n\nEarn 2% commission on every transaction!`);
});

// Create Task
bot.command('createtask', (ctx) => {
    ctx.reply('Send the task details in the following format:\n\n"Task Title, Task Description, Reward Amount (SOL)"');
    bot.on('text', async (ctx) => {
        const input = ctx.message.text.split(',');
        const title = input[0];
        const description = input[1];
        const reward = parseFloat(input[2]);

        if (isNaN(reward)) {
            ctx.reply('❌ Invalid reward amount. Please try again.');
            return;
        }

        // Save to tasks.json
        const tasks = JSON.parse(fs.readFileSync(tasksFile));
        tasks.push({ title, description, reward });
        fs.writeFileSync(tasksFile, JSON.stringify(tasks, null, 2));

        // Send task creation message with a button to participate
        ctx.reply(`✅ Task Created:\n\nTitle: ${title}\nDescription: ${description}\nReward: ${reward} SOL`, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: "Participate", callback_data: `task_participate_${tasks.length - 1}` }]
                ]
            }
        });
    });
});

// Handle Task Participation
bot.on('callback_query', (ctx) => {
    const callbackData = ctx.callbackQuery.data;

    // Handle task participation
    if (callbackData.startsWith('task_participate_')) {
        const taskIndex = callbackData.split('_')[2]; // Extract task index
        ctx.answerCbQuery(`You are participating in task #${taskIndex + 1}!`);
    }
});

// Create Giveaway
bot.command('creategiveaway', (ctx) => {
    ctx.reply('Send the giveaway details in the following format:\n\n"Giveaway Title, Number of Winners, Reward per Winner (SOL)"');
    bot.on('text', async (ctx) => {
        const input = ctx.message.text.split(',');
        const title = input[0];
        const winners = parseInt(input[1]);
        const reward = parseFloat(input[2]);

        if (isNaN(winners) || isNaN(reward)) {
            ctx.reply('❌ Invalid input. Please try again.');
            return;
        }

        // Save to giveaways.json
        const giveaways = JSON.parse(fs.readFileSync(giveawaysFile));
        giveaways.push({ title, winners, reward });
        fs.writeFileSync(giveawaysFile, JSON.stringify(giveaways, null, 2));

        // Send giveaway creation message with a button to participate
        ctx.reply(`✅ Giveaway Created:\n\nTitle: ${title}\nWinners: ${winners}\nReward: ${reward} SOL each`, {
            reply_markup: {
                inline_keyboard: [
                    [{ text: "Participate", callback_data: `giveaway_participate_${giveaways.length - 1}` }]
                ]
            }
        });
    });
});

// Handle Giveaway Participation
bot.on('callback_query', (ctx) => {
    const callbackData = ctx.callbackQuery.data;

    // Handle giveaway participation
    if (callbackData.startsWith('giveaway_participate_')) {
        const giveawayIndex = callbackData.split('_')[2]; // Extract giveaway index
        ctx.answerCbQuery(`You are participating in giveaway #${giveawayIndex + 1}!`);
    }
});

// FAQ
bot.command('faq', (ctx) => {
    ctx.reply(
        `📚 FAQ:\n\n- Add the bot to your group or channel.\n- Use /createpoll to make polls.\n- Use /createtask to create tasks for members.\n- Use /creategiveaway to host giveaways.\n- Use /getreferral to earn commission through referrals.`
    );
});

// Start Bot
(async () => {
    try {
        console.log('🤖 Bot is running...');
        bot.launch();
    } catch (err) {
        console.error('❌ Error starting the bot:', err);
    }
})();

// Graceful Stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
