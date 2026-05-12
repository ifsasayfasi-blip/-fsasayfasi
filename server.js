const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const fs = require('fs');
const https = require('https'); // Cloudflare doğrulaması için gerekli

const app = express();
const DB_FILE = './database.json';

// --- CLOUDFLARE ANAHTARLARI (BURAYI DOLDUR) ---
const CLOUDFLARE_SITE_KEY = '0x4AAAAAADN_S2aUH3kBlOuH'; 
const CLOUDFLARE_SECRET_KEY = '0x4AAAAAADN_SwqTzaOoWFnX9yZ0JhzkHE8';

// --- VERİTABANI SİSTEMİ ---
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify([]));
const getPosts = () => JSON.parse(fs.readFileSync(DB_FILE));
const savePosts = (data) => fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({ secret: 'cemile-guard-key', resave: false, saveUninitialized: true }));

// --- TASARIM VE CLOUDFLARE SCRIPTI ---
const layout = (content, showTurnstile = false) => `
<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mehmet Erçin İfşa Sayfası</title>
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600&display=swap" rel="stylesheet">
    <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
    <style>
        :root { --bg: #08080c; --card: #12121a; --red: #ff4757; --blue: #54a0ff; --gold: #feca57; --green: #1dd1a1; }
        body { font-family: 'Poppins', sans-serif; background: var(--bg); color: #f1f2f6; margin: 0; }
        .navbar { display: flex; justify-content: space-between; align-items: center; padding: 15px 25px; background: rgba(0,0,0,0.9); border-bottom: 3px solid var(--red); position: sticky; top: 0; z-index: 1000; }
        .meb-logo { width: 38px; border-radius: 50%; background: white; padding: 2px; }
        .container { padding: 25px; max-width: 550px; margin: auto; animation: slideUp 0.6s ease; }
        .card { background: var(--card); border-radius: 20px; padding: 22px; border: 1px solid rgba(255,255,255,0.05); margin-bottom: 25px; transition: 0.3s; }
        .admin-card { border: 2px solid var(--gold) !important; }
        .btn { display: block; width: 100%; padding: 15px; border: none; border-radius: 12px; margin: 12px 0; cursor: pointer; font-weight: 600; text-align: center; text-decoration: none; color: white; transition: 0.3s; box-sizing: border-box; }
        .btn-blue { background: linear-gradient(135deg, #2e86de, var(--blue)); }
        .btn-red { background: linear-gradient(135deg, #ee5253, var(--red)); }
        .verify-badge { background: var(--gold); color: black; padding: 2px 8px; border-radius: 50px; font-size: 11px; margin-left: 5px; }
        input, textarea, select { width: 100%; padding: 14px; margin: 10px 0; background: #1c1c26; border: 1px solid #2d3436; color: white; border-radius: 10px; box-sizing: border-box; }
        .menu-overlay { display: none; position: fixed; right: 20px; top: 80px; background: #12121a; border: 1px solid var(--blue); border-radius: 15px; z-index: 1001; width: 200px; overflow: hidden; }
        .menu-overlay a { display: block; padding: 15px; color: white; text-decoration: none; border-bottom: 1px solid #1e1e26; }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
    </style>
</head>
<body>
    <div class="navbar">
        <div style="display: flex; align-items: center; gap: 12px;">
            <img src="https://upload.wikimedia.org/wikipedia/tr/b/b2/Mill%C3%AE_E%C4%9Fitim_Bakal%C4%B1%C4%9F%C4%B1_logo.png" class="meb-logo">
            <span style="font-weight: 600;">MEHMET ERÇİN</span>
        </div>
        <div style="font-size: 30px; cursor: pointer; color: var(--blue);" onclick="const m=document.getElementById('m'); m.style.display=(m.style.display==='block'?'none':'block')">☰</div>
    </div>
    <div class="menu-overlay" id="m">
        <a href="/add">✨ Gönderi Paylaş</a>
        <a href="/posts">🔥 İtirafları Oku</a>
        <a href="/admin">👑 Yönetim</a>
    </div>
    ${content}
</body></html>`;

// --- MIDDLEWARE: BOT KONTROLÜ ---
const checkBot = (req, res, next) => {
    if (req.session.isHuman) return next();
    res.send(layout(`
        <div class="container" style="text-align:center; padding-top:100px;">
            <div class="card">
                <h3 style="color:var(--blue)">Güvenlik Taraması 🛡️</h3>
                <p>Sisteme erişmek için insan olduğunuzu doğrulayın.</p>
                <form action="/verify-human" method="POST">
                    <div style="display:flex; justify-content:center; margin:20px 0;">
                        <div class="cf-turnstile" data-sitekey="${CLOUDFLARE_SITE_KEY}"></div>
                    </div>
                    <button type="submit" class="btn btn-blue">GİRİŞ YAP</button>
                </form>
            </div>
        </div>
    `));
};

// --- ROUTES ---

// Cloudflare Doğrulama Postu
app.post('/verify-human', async (req, res) => {
    const token = req.body['cf-turnstile-response'];
    const formData = `secret=${CLOUDFLARE_SECRET_KEY}&response=${token}`;

    const request = https.request({
        hostname: 'challenges.cloudflare.com',
        path: '/turnstile/v0/siteverify',
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    }, (response) => {
        let body = '';
        response.on('data', d => body += d);
        response.on('end', () => {
            const result = JSON.parse(body);
            if (result.success) {
                req.session.isHuman = true;
                res.redirect('/posts');
            } else {
                res.send('Bot doğrulaması başarısız! Lütfen tekrar deneyin.');
            }
        });
    });
    request.write(formData);
    request.end();
});

// Gönderiler (Bot kontrolü eklendi)
app.get('/posts', checkBot, (req, res) => {
    const posts = getPosts().filter(p => p.approved || p.admin);
    const html = posts.reverse().map(p => `
        <div class="card ${p.admin ? 'admin-card' : ''}">
            <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                <span style="font-weight:600; color:${p.admin ? 'var(--gold)' : 'white'}">${p.admin ? 'Yönetim' : p.display_name} ${p.admin ? '<span class="verify-badge">✔ RESMİ</span>' : ''}</span>
                <small style="color:#747d8c">${p.class}</small>
            </div>
            <p style="margin:0; font-size:15px;">${p.message}</p>
        </div>
    `).join('');
    res.send(layout(`<div class="container"><h2 style="text-align:center;">İtiraflar 🔥</h2>${html || '<p>Henüz mesaj yok.</p>'}</div>`));
});

// Diğer yollar (Add, Admin vb.) aynı şekilde devam ediyor...
app.get('/add', checkBot, (req, res) => {
    res.send(layout(`<div class="container"><div class="card"><h3 style="color:var(--blue)">Gönderi Paylaş ✨</h3><form action="/send" method="POST"><select name="vis"><option value="public">🌍 Herkese Açık</option><option value="hidden">👤 Gizli Üye</option></select><input type="text" name="real_name" placeholder="Gerçek Ad Soyad" required><input type="text" name="clazz" placeholder="Sınıfın" required><textarea name="msg" rows="5" placeholder="Mesajın..." required></textarea><button class="btn btn-blue">GÖNDER 🚀</button></form></div></div>`));
});

app.post('/send', checkBot, (req, res) => {
    const { vis, real_name, clazz, msg } = req.body;
    const posts = getPosts();
    posts.push({ id: Date.now(), real_name, display_name: vis === 'hidden' ? 'Gizli Üye' : real_name, class: clazz, message: msg, approved: vis !== 'hidden', admin: false, date: new Date().toLocaleString('tr-TR') });
    savePosts(posts);
    res.redirect('/posts');
});

app.get('/admin', (req, res) => res.send(layout(`<div class="container"><div class="card"><h3>Yönetici Girişi 👑</h3><form action="/admin/login" method="POST"><input type="password" name="pw" placeholder="Şifre" required><button class="btn btn-red">GİRİŞ</button></form></div></div>`)));
app.post('/admin/login', (req, res) => { if(req.body.pw === 'sevemezsiniz') { req.session.isAdmin = true; res.redirect('/admin/panel'); } else res.send('Hatalı!'); });

app.get('/admin/panel', (req, res) => {
    if(!req.session.isAdmin) return res.redirect('/admin');
    const pending = getPosts().filter(p => !p.approved && !p.admin);
    let pendingHtml = pending.map(p => `<div class="card" style="border-left:4px solid var(--red)"><b>KİM: ${p.real_name}</b><p>${p.message}</p><a href="/admin/ok/${p.id}">ONAYLA</a> | <a href="/admin/del/${p.id}">SİL</a></div>`).join('');
    res.send(layout(`<div class="container"><h3>Yönetim Paneli</h3><form action="/admin/announce" method="POST"><textarea name="m" placeholder="Resmi Duyuru..."></textarea><button class="btn btn-blue">PAYLAŞ</button></form><hr>${pendingHtml || 'Bekleyen yok.'}</div>`));
});

app.get('/admin/ok/:id', (req, res) => { if(req.session.isAdmin) { const ps = getPosts(); const i = ps.findIndex(x => x.id == req.params.id); if(i>-1) ps[i].approved = true; savePosts(ps); } res.redirect('/admin/panel'); });
app.get('/admin/del/:id', (req, res) => { if(req.session.isAdmin) { const ps = getPosts().filter(x => x.id != req.params.id); savePosts(ps); } res.redirect('/admin/panel'); });
app.post('/admin/announce', (req, res) => { if(req.session.isAdmin) { const ps = getPosts(); ps.push({ id: Date.now(), display_name: 'Admin', class: 'Yönetim', message: req.body.m, approved: true, admin: true, date: new Date().toLocaleString('tr-TR') }); savePosts(ps); } res.redirect('/posts'); });

app.listen(process.env.PORT || 3000, () => console.log('Sistem Hazır!'));
      
