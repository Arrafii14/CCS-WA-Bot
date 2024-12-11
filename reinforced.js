const fs = require('fs');
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const { Client, LocalAuth } = require('whatsapp-web.js');
const { MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const yaml = require('js-yaml');

const words = yaml.load(fs.readFileSync('words.yml', 'utf8'));

let serverStatus = null;
let lastGroupStatus = null;

const groupTitleOnline = 'Craft Cheddar Server ✅';
const groupTitleOffline = 'Craft Cheddar Server ❌';

const app = express();
const port = 3500;

app.use(bodyParser.json());

const data = fs.readFileSync('pengaturan.json', 'utf8');
const variables = JSON.parse(data);
let flagisgroup = false;

const { nomor_tujuan, id_group, id_admin, endpoint, log_group, login_group, lobby, mix, pure, oneblock} = variables;
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
            '--no-sandbox'
           

        ]
    }
});

console.log(`
   ____ ____ ____    ____        _   
  / ___/ ___/ ___|  | __ )  ___ | |_ 
 | |  | |   \___ \  |  _ \ / _ \| __|
 | |__| |___ ___) | | |_) | (_) | |_ 
  \____\____|____/  |____/ \___/ \__|
 by: Arrafii14                                    
`);
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
    setInterval(checkServerStatus, 5 * 60 * 100);
});

whatsapp.on('message', async msg => {
    incomingMessages = msg.body.toLowerCase();
    let chat = await msg.getChat();
    pengirim = msg.from;
    console.log(`Pesan diterima dari ${pengirim}: ${msg.body}`);
    console.log(pengirim == nomor_tujuan ? "Pengirim dikenali\n" : "Pengirim tidak dikenali\n");

    const messageWords = incomingMessages.split(/\s+/); // Membagi pesan menjadi array kata-kata

    for (const word of words) {
        if (messageWords.some(msgWord => msgWord === word)) { // Mengecek kecocokan kata yang tepat
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
            else {
        console.log("Pesan bukan berasal dari grup yang dikenali");
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
Halo, bot adalah bagian dari server Minecraft "Craft Cheddar Server".
bot hanya bisa digunakan dalam komunitas.

Bergabunglah bersama kami digrup WhatsApp kami: https://chat.whatsapp.com/HGdDgEmqQ6fGkYOQw6E1Tz.

Untuk bantuan asisten ai dapat digunakan diluar komunitas, gunakan .ai pada awalan
pesan untuk berbincang.`;
        await whatsapp.sendMessage(pengirim, welcomeMessage.trim());
    }

    else{
        console.log("Pesan tak sesuai perintah!");
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

        const newUserID = notification.id.participant;
        const welcomeText = `Hai @${newUserID.replace('@c.us', '')}!\nSelamat datang di grup! Semoga betah dan have fun di sini!\n😇😊`;
        const newUserContact = await whatsapp.getContactById(newUserID);

        await chat.sendMessage(welcomeText, {
            mentions: [newUserContact]
        });
     
        const welcomeMessage = `Hai bro/sis!
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

Address: play.craftcheddar.my.id
Port: 25565

Bedrock/PE
Address: play.craftcheddar.my.id
Port: 19132

Discord
https://discord.gg/uDDf5p6h

Setelah masuk jangan lupa Registrasi
/register (password baru) (password baru)

Untuk login
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

mati? pengen balik lagi?
/back
Semoga betah dan have fun di sini! Ada apa-apa, langsung tanya aja.
Selamat gabung, bro/sis!`;

        setTimeout(async () => {
        if (chatID === id_group) {
            await chat.sendMessage(welcomeMessage.trim());
            const stickerMedia1 = MessageMedia.fromFilePath('/home/container/sticker/welcome1.webp');            
            await chat.sendMessage(stickerMedia1, { sendMediaAsSticker: true });
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
    
    const callerNumber = call.from.replace('@c.us', '');
    const callTime = new Date(call.timestamp * 1000);
    const formattedTime = callTime.toLocaleString('id-ID', {
        timeZone: 'Asia/Makassar', // Zona waktu WITA
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });

    await whatsapp.sendMessage(call.from, `${call.fromMe ? 'Panggilan Keluar' : 'Panggilan Masuk'} dari ${callerNumber}.\nWaktu: ${formattedTime}\nTipe panggilan: ${call.isGroup ? 'grup' : ''} ${call.isVideo ? 'video' : 'suara'}.\n${rejectCalls ? 'Panggilan ditolak otomatis oleh sistem.' : ''}`);
});

async function prosesDataServer() {
    try {
        // Membuat objek untuk menyimpan URL dari masing-masing server
        const endpoints = {
            lobby: `${lobby}/v1/server`,             // Lobby
            survivalMix: `${mix}/v1/server`,         // Survival Mix
            pureSurvival: `${pure}/v1/server`,       // Pure Survival
            oneBlock: `${oneblock}/v1/server`        // One Block
        };

        // Menyusun data server untuk setiap endpoint
        const serverData = await Promise.all(
            Object.entries(endpoints).map(async ([key, url]) => {
                try {
                    const response = await axios.get(url);
                    const { tps, health, maxPlayers, onlinePlayers, version } = response.data;
                    const { totalMemory, maxMemory, freeMemory } = health;

                    const bytesToGB = bytes => (bytes / (1024 ** 3)).toFixed(2);

                    // Menyusun pesan status server
                    const statusOnline = response.status === 200 ? `Informasi server ${formatServerName(key)}:
Versi server: ${version}
Status: 🟢 Online
TPS Server: ${parseFloat(tps).toFixed(1)}
Pemain Aktif: ${onlinePlayers}/${maxPlayers}
Memori Total: ${bytesToGB(totalMemory)} GB
Memori Bebas: ${bytesToGB(freeMemory)} GB
Memori Maksimal: ${bytesToGB(maxMemory)} GB`.trim() : `Informasi server ${formatServerName(key)}:
Status: 🔴 Offline`;

                    return { key, status: statusOnline };
                } catch (error) {
                    console.error(`Error fetching data from ${key}:`, error.message);
                    return { key, status: `Informasi server ${formatServerName(key)}: Status: 🔴 Offline` };
                }
            })
        );

        // Menyusun pesan lengkap dari semua informasi server
        let message = serverData.map(data => data.status).join('\n\n');

        // Mengirimkan pesan ke WhatsApp
        await whatsapp.sendMessage(pengirim, message);

    } catch (error) {
        console.error('Error in processing server data:', error.message);
        await whatsapp.sendMessage(pengirim, "Terjadi kesalahan saat mengambil data server.");
    }
}

// Fungsi untuk memformat nama server
function formatServerName(key) {
    const serverNames = {
        lobby: "Lobby",
        survivalMix: "Survival Mix",
        pureSurvival: "Pure Survival",
        oneBlock: "One Block"
    };
    return serverNames[key] || key;
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
        // Mengambil data pemain dari setiap endpoint
        const endpoints = {
            lobby: `${lobby}/v1/players`,            // Lobby
            survivalMix: `${mix}/v1/players`,        // Survival Mix
            pureSurvival: `${pure}/v1/players`,      // Pure Survival
            oneBlock: `${oneblock}/v1/players`       // One Block
        };

        const playerData = await Promise.all(
            Object.entries(endpoints).map(async ([key, url]) => {
                try {
                    const response = await axios.get(url);
                    return { key, players: response.data };
                } catch (error) {
                    console.error(`Error fetching data from ${key}:`, error.message);
                    return { key, players: [] };
                }
            })
        );

        // Membuat pesan dengan daftar pemain
        let message = `Pemain Online: ${playerData.reduce((total, data) => total + data.players.length, 0)}\n\n`;

        playerData.forEach(data => {
            const serverName = formatServerName(data.key);
            message += `${serverName} (${data.players.length} pemain)\n`;
            if (data.players.length > 0) {
                const playerNames = data.players.map(player => `- ${player.displayName}`).join('\n');
                message += `${playerNames}\n\n`;
            } else {
                message += "Tidak ada pemain online.\n\n";
            }
        });

        // Mengirimkan pesan ke WhatsApp
        await whatsapp.sendMessage(pengirim, message);

    } catch (error) {
        console.error('Error in sending player data:', error.message);
        await whatsapp.sendMessage(pengirim, "Terjadi kesalahan saat mengambil data pemain online.");
    }
}

// Fungsi untuk memformat nama server
function formatServerName(key) {
    const serverNames = {
        lobby: "Lobby",
        survivalMix: "Survival Mix",
        pureSurvival: "Pure Survival",
        oneBlock: "One Block"
    };
    return serverNames[key] || key;
}

async function prosesAI(query, msg) {
    const apiUrl = 'https://api.pawan.krd/cosmosrp/v1/chat/completions';
    const apiKey = 'pk-xFnjfbJgpfzoESvdVgtgiMVaJEuCrAjKNoKMipYMQZXRALgf';

    const data = {
        model: "cosmosrp",
        max_tokens: 2000,
        messages: [
            {
                role: "system",
                content: "Namamu Kuving, Kamu adalah asisten ahli dalam pengetahuan umum namun fokus pada IT dan OT, juga gaming minecraft, fokusmu memberikan bantuan pada komunitas minecraft"
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

// Endpoint webhook
app.post('/webhook/:server', async (req, res) => {
    try {
        const { server } = req.params;
        const serverName = serverNames[`/webhook/${server}`];
        const payload = req.body;

        if (!serverName) {
            return res.status(404).send('Server tidak ditemukan');
        }

        console.log('Payload dari webhook:', JSON.stringify(payload, null, 2));

        if (payload && payload.player && payload.eventType) {
            const { player, eventType } = payload;
            const { displayName, address } = player;

            // Format pesan untuk log_group
            const formattedMessageLogGroup = `${displayName} telah bergabung ke server ${serverName} dengan alamat IP ${address}`;
            await whatsapp.sendMessage(log_group, formattedMessageLogGroup);

            // Format pesan untuk login_group
            const formattedMessageLoginGroup = `${displayName} telah bergabung ke server ${serverName}`;
            await whatsapp.sendMessage(login_group, formattedMessageLoginGroup);

            res.status(200).send('Sukses menerima dan memproses webhook');
        } else {
            console.error('Struktur payload tidak valid');
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

async function checkServerStatus() {
    try {
        const serverEndpoint = `http://${endpoint}:4567/v1/server`;
        const response = await axios.get(serverEndpoint);
        if (response.status === 200) {
            serverStatus = 'online';
            console.log("server online");
        } else {
            serverStatus = 'offline';
            console.log("server offline");
        }
    } catch (error) {
        serverStatus = 'offline';
        console.log("server offline");
    }

    if (serverStatus !== lastGroupStatus) {
        console.log("status flag pengecekan server tidak sama!");
        updateGroupTitle(serverStatus);
        lastGroupStatus = serverStatus;
    }
}

async function updateGroupTitle(status) {
    const chat = await whatsapp.getChatById(id_group);

    if (status === 'online') {
        await chat.setSubject(groupTitleOnline);
        console.log(`Judul grup diubah menjadi: ${groupTitleOnline}`);
    } else {
        await chat.setSubject(groupTitleOffline);
        console.log(`Judul grup diubah menjadi: ${groupTitleOffline}`);
    }

    console.log(`Status grup sekarang: ${status}`);
}