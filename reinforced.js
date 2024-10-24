const fs = require('fs');
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const { Client, LocalAuth } = require('whatsapp-web.js');
const { MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const yaml = require('js-yaml');

const words = yaml.load(fs.readFileSync('words.yml', 'utf8'));

const app = express();
const port = 3500;

app.use(bodyParser.json());

const data = fs.readFileSync('pengaturan.json', 'utf8');
const variables = JSON.parse(data);
let flagisgroup = false;

const { nomor_tujuan, id_group, id_admin, endpoint, log_group, login_group} = variables;
let pengirim = "";
let incomingMessages = "";
let chatID = "";

const whatsapp = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: [
            '--disable-gpu',
            '--disable-dev-shm-usage',
            '--disable-setuid-sandbox',
            '--no-first-run',
            '--no-sandbox',
            '--no-zygote',
            '--single-process'
        ]
    }
});

console.log('\nSedang Menghubungkan ke Whatsapp Web........\n');
whatsapp.initialize();

whatsapp.on('loading_screen', (percent, message) => {
    console.log('LOADING SCREEN', percent, message);
});

whatsapp.on('qr', qr => {
    console.log('Silahkan scan kode QR dibawah untuk login!\n');
    qrcode.generate(qr, { small: true });
});

whatsapp.on('authenticated', () => {
    console.log('AUTHENTICATED');
});

whatsapp.on('auth_failure', msg => {
    console.error('AUTENTIKASI GAGAL', msg);
});

whatsapp.on('ready', () => {
    console.log('READY\nTerhubung!\n');
});

whatsapp.on('message', async msg => {
    incomingMessages = msg.body.toLowerCase();
    let chat = await msg.getChat();
    pengirim = msg.from;
    console.log(`Pesan diterima dari ${pengirim}: ${msg.body}`);
    console.log(pengirim == nomor_tujuan ? "Pengirim dikenali\n" : "Pengirim tidak dikenali\n");

    const messageWords = incomingMessages.split(/\s+/); // Membagi pesan menjadi array kata-kata

    for (const word of words) {
        if (messageWords.includes(word)) {
            await msg.delete(true);
            console.log(`Pesan dengan kata "${word}" telah dihapus.`);
            break;
        }
    }

    if (incomingMessages.includes("!bot") && chat.isGroup) {
        console.log("Pesan Grup: " + incomingMessages + "\n");
        
        const senderId = msg.from; // Mendapatkan ID pengirim
    
        if ([id_admin, id_group, log_group, login_group].includes(senderId)) {
            
            console.log("Pesan berasal dari grup yang dikenali");

            if (incomingMessages.includes('server')) {
                await prosesDataServer();
            } else if (incomingMessages.includes('banned')) {
                await kirimBannedPlayers();
            } else if (incomingMessages.includes('online')) {
                await kirimOnlinePlayers();
            } else if (incomingMessages.includes('allplayers')) {
                await kirimAllplayers();
            } else if (incomingMessages.includes("!bot exec") && senderId === id_admin) {
                const command = incomingMessages.replace("!bot exec ", "").trim();
                try {
                    const ip = endpoint;
                    const url = `http://${ip}:4567/v1/server/exec`;
                    const response = await axios.post(url, new URLSearchParams({
                        command: command
                    }), {
                        headers: {
                            'accept': '*/*',
                            'Content-Type': 'application/x-www-form-urlencoded'
                        }
                    });
                    console.log("Command executed");
                    whatsapp.sendMessage(senderId, `Berhasil dikirim`);
                } catch (error) {
                    console.error("Error executing command:", error);
                    whatsapp.sendMessage(senderId, `Gagal dikirim`);
                }
            } else {
                const result = `
    Gunakan perintah berikut:
    Gunakan !bot dan perintahnya, Misal:
    - !bot server
    - !bot banned
    - !bot online
    - !bot allplayers`;
                whatsapp.sendMessage(senderId, result.trim());
                console.log("Kesalahan perintah!, mohon " + result + "\n");
            }
        }
    }
    
    else if (incomingMessages.startsWith('.ai analisa') || incomingMessages.startsWith('.ai')) {
        let queryStartIndex = incomingMessages.startsWith('.ai analisa') ? incomingMessages.indexOf('.ai analisa') + 11 : incomingMessages.indexOf('.ai') + 3;
        let query = incomingMessages.slice(queryStartIndex).trim();

        if (msg.hasQuotedMsg) {
            let quotedMessage = await msg.getQuotedMessage();
            query = `${query} ${quotedMessage.body}`;
        }

        await prosesAI(query, msg);
    }
    else if (!chat.isGroup) {
        const welcomeMessage = `
Halo, bot adalah bagian dari server Minecraft "Craft Cheddar SMP".
bot hanya bisa digunakan dalam komunitas.
Bergabunglah bersama kami di: https://chat.whatsapp.com/HGdDgEmqQ6fGkYOQw6E1Tz`;
        await whatsapp.sendMessage(pengirim, welcomeMessage.trim());
    }

    else{
        console.log("Pesan bukan berasal dari grup yang dikenali");
    }
});

whatsapp.on('disconnected', reason => {
    console.log('Terputus Karena:', reason);
});


whatsapp.on('group_join', async notification => {
    try {
        const chat = await notification.getChat();
        chatID = chat.id._serialized;
        console.log(`ChatID: ${chatID}`);
        const welcomeMessage = `
Hai bro/sis!
Selamat gabung di grup "Craft Cheddar Server"! Nih, aturan singkat yang perlu lo tahu:
- Toxic boleh (secukupnya)
- Jomok DILARANG (Stop Normalisasi Jokes Jomok)
- Grief = Ban
- Maling = Ban
- PvP boleh (kalau udah sepakat)
- Ganggu player nguli = Ban
- Cross Server (Bedrock/Java)
- Cross Platform (Hp/PC/Laptop/Kompor/Setrika/dll.)
Panduan pada: linktr.ee/mcccs
Pas masuk server/world, jangan lupa register kayak gini:
1. Klik T atau CHAT
2. Ketik /register (password yang bakal lo pake buat login)
Tiap kali masuk, jangan lupa password-nya:
1. Klik T atau CHAT
2. Ketik /login (password yang lo buat pas register)

Java Version [Voice Chat]
Address: play.craftcheddar.my.id
Port: 25565

Bedrock/PE
Address: play.craftcheddar.my.id
Port: 19132

Maps
maps.craftcheddar.my.id

Setelah masuk jangan lupa Registrasi
/register (password baru) (password baru)

Untuk *login*​
/login (password kamu)

Bingung mau kemana? bisa klik NPC pas spawn atau /rtp

Mau teleport ke temen?
/tpa (gametag tmn)

Nerima teleport
/tpaaccept

cara sethome, pegang gold shovel/sekop emas, klik kanan atau tap pada tiap pojok block (minimal 100 block/10x10 block). klo udh ya sethome
/sethome (nama)

cara ke home
/home atau /home (nama home)

cek home kamu
/homes atau /listhome

cara hapus home
/delhome atau /delhome (nama)

mati? pengen balik lagi?
/back
Semoga betah dan have fun di sini! Ada apa-apa, langsung tanya aja.
Selamat gabung, bro/sis!`;

        setTimeout(async () => {
        if (chatID === id_group) {
            await chat.sendMessage(welcomeMessage.trim());
            const stickerMedia1 = MessageMedia.fromFilePath('/home/container/sticker/welcome1.webp');
            const stickerMedia2 = MessageMedia.fromFilePath('/home/container/sticker/welcome2.webp');
            await chat.sendMessage(stickerMedia1, { sendMediaAsSticker: true });
            await chat.sendMessage(stickerMedia2, { sendMediaAsSticker: true });
        }
        }, 3000);

    } catch (error) {
        console.error('Error handling group join event:', error);
    }
});

let rejectCalls = true;
whatsapp.on('call', async call => {
    console.log('Panggilan masuk, menolak panggilan.', call);
    if (rejectCalls) await call.reject();
    await whatsapp.sendMessage(call.from, `${call.fromMe ? 'Panggilan Keluar' : 'Panggilan Masuk'} dari ${call.from}, tipe panggilan ${call.isGroup ? 'grup' : ''} ${call.isVideo ? 'video' : 'suara'}. ${rejectCalls ? 'Panggilan ditolak otomatis oleh script.' : ''}`);
});

async function prosesDataServer() {
    try {
        const ip = endpoint;
        const url = `http://${ip}:4567/v1/server`;

        const response = await axios.get(url);
        const { tps, health, maxPlayers, onlinePlayers, version } = response.data;
        const { totalMemory, maxMemory, freeMemory } = health;

        const bytesToGB = bytes => (bytes / (1024 ** 3)).toFixed(2);

        const statusOnline = response.status === 200 ? `
Informasi Server:
Versi server: ${version}
Status: 🟢 Online
TPS Server: ${parseFloat(tps).toFixed(1)}
Pemain Aktif: ${onlinePlayers}/${maxPlayers}
Memori Total: ${bytesToGB(totalMemory)} GB
Memori Bebas: ${bytesToGB(freeMemory)} GB
Memori Maksimal: ${bytesToGB(maxMemory)} GB`.trim() : 'Status: 🔴 Offline';
await whatsapp.sendMessage(pengirim, statusOnline);
    } catch (error) {
        console.error('Error fetching server data:', error.message);
        await whatsapp.sendMessage(pengirim, "Terjadi kesalahan saat mengambil data server.");
    }
}

async function kirimBannedPlayers() {
    try {
        const ip = endpoint;
        const url = `http://${ip}:4567/v1/server`;
        const response = await axios.get(url);
        const bannedPlayers = response.data.bannedPlayers;

        const bannedPlayersMessage = 'Daftar Pemain yang Dibanned:\n\n' + bannedPlayers.map(player => `- ${player.target}`).join('\n');
        await whatsapp.sendMessage(pengirim, bannedPlayersMessage);
    } catch (error) {
        console.error('Error fetching banned players data:', error.message);
        await whatsapp.sendMessage(pengirim, "Terjadi kesalahan saat mengambil data pemain yang dibanned.");
    }
}

async function kirimAllplayers() {
    try {
        const ip = endpoint;
        const url = `http://${ip}:4567/v1/players/all`;
        const response = await axios.get(url);
        const players = response.data;

        if (!players || !Array.isArray(players)) {
            throw new Error('Invalid data format');
        }

        const playerNames = players.map(player => `- ${player.name}`);
        const message = `Jumlah Total Pemain: ${playerNames.length}\n\n${playerNames.join('\n')}`;
        await whatsapp.sendMessage(pengirim, message);
    } catch (error) {
        console.error('Error fetching all players data:', error.message);
        await whatsapp.sendMessage(pengirim, "Terjadi kesalahan saat mengambil data semua pemain.");
    }
}

async function kirimOnlinePlayers() {
    try {
        const ip = endpoint;
        const url = `http://${ip}:4567/v1/players`;
        const response = await axios.get(url);
        const players = response.data;

        const playerNames = players.map(player => `- ${player.displayName}`);
        const message = `Jumlah Pemain Online: ${playerNames.length}\n\n${playerNames.join('\n')}`;
        await whatsapp.sendMessage(pengirim, message);
    } catch (error) {
        console.error('Error fetching online players data:', error.message);
        await whatsapp.sendMessage(pengirim, "Terjadi kesalahan saat mengambil data pemain online.");
    }
}

async function prosesAI(query, msg) {
    const apiUrl = 'https://api.pawan.krd/cosmosrp/v1/chat/completions';
    const apiKey = 'pk-hREqlIaOgfPicvstJeEaJYRPVcCbIuKYcuemGghAYgtLKPQc';

    const data = {
        model: "cosmosrp",
        max_tokens: 2000,
        messages: [
            {
                role: "system",
                content: "Kamu adalah asisten ahli dalam pengetahuan umum."
            },
            {
                role: "user",
                content: query
            }
        ]
    };

    try {
        const response = await axios.post(apiUrl, data, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.data.choices && response.data.choices.length > 0) {
            const aiResponse = response.data.choices[0].message.content;
            await msg.reply(`${aiResponse}`);
        } else {
            await msg.reply('AI tidak merespon');
        }
    } catch (error) {
        console.error('Error:', error);
        await msg.reply('Gagal berkomunikasi dengan AI');
    }
}

app.post('/webhook', async (req, res) => {
    try {
        const payload = req.body;
        console.log('Payload dari webhook:', JSON.stringify(payload, null, 2));

        if (payload && payload.player && payload.eventType) {
            const { player, eventType } = payload;
            const { displayName, address } = player;

            console.log('Extracted Values:', { displayName, address, eventType });
            
            const formattedMessage = `Nama: ${displayName}\nAlamat IP: ${address}\nAktivitas: ${eventType}`;
            console.log('Pesan yang akan dikirim:', formattedMessage);
            await whatsapp.sendMessage(log_group, formattedMessage);            
            
            const formattedMessagelogin = `Nama: ${displayName}\nAktivitas: ${eventType}`;
            console.log('Pesan yang akan dikirim:', formattedMessagelogin);
            await whatsapp.sendMessage(login_group, formattedMessagelogin);

            res.status(200).send('Sukses menerima dan memproses webhook');
        } else {
            console.error('Invalid payload structure');
            res.status(400).send('Invalid payload structure');
        }
    } catch (error) {
        console.error('Error saat menangani webhook:', error);
        res.status(500).send('Terjadi kesalahan dalam pemrosesan webhook');
    }
});

app.listen(port, () => {
    console.log(`Server berjalan di http://localhost:${port}`);
});
