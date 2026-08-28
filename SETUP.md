# সেটআপ গাইড — AI Assistant App (Admin Dashboard সহ)

## যা যোগ করা হয়েছে
- **Admin role**: `admin` ইউজার লগইন করলে সাধারণ ইউজারদের থেকে আলাদা Admin Dashboard দেখবে।
- **Global API Config**: Admin Dashboard থেকে API provider/key/model বদলালে সব ইউজারের জন্য সাথে সাথে কার্যকর হয় — আলাদা করে কারো config সেভ করতে হয় না।
- **Activity Log**: Admin ড্যাশবোর্ডে "User Activity" ট্যাবে সব ইউজারের পাঠানো মেসেজ ও ছবি দেখা যায়।
- **স্বচ্ছতা নোটিশ**: চ্যাট স্ক্রিনে সবার জন্য একটা ছোট নোটিশ থাকে যে মেসেজ/ছবি রিভিউ হতে পারে। এটা ইচ্ছাকৃতভাবে **দৃশ্যমান** রাখা হয়েছে — গোপন মনিটরিং সিস্টেম বানানো হয়নি।

## যা যোগ করা হয়নি
- ফোনের গ্যালারি অ্যাক্সেস — এটা এই অ্যাপের স্কোপের বাইরে এবং করা হয়নি।
- Admin প্যানেল গোপন রাখা — এটা normal role-based access, কাউকে ঠকানো হয়নি।

---

## ধাপ ১: প্রজেক্ট স্ট্রাকচার

```
ai-assistant-app/
├── ai-assistant-backend.js
├── package.json
├── .env
├── database.js
├── _env.example
├── SETUP.md
└── client/
    ├── package.json
    ├── dist/             ← production build
    └── src/
        └── ai-assistant-frontend.jsx
```

## ধাপ ২: Backend ডিপেন্ডেন্সি ইনস্টল

```bash
npm install
```

## ধাপ ৩: `.env` কনফিগার

```bash
cp _env.example .env
```

`.env` এ নিচেরগুলো সেট করুন:

```env
PORT=5000
JWT_SECRET=<strong-random-string>
NODE_ENV=production
DEMO_MODE=false

# Database (optional but recommended)
DATABASE_TYPE=sqlite
DATABASE_PATH=./data/app.db
```

## ধাপ ৪: Frontend বিল্ড

```bash
cd client
npm run build
cd ..
```

এতে `client/dist` ফোল্ডার তৈরি হবে, যা backend automatically সার্ভ করবে।

## ধাপ ৫: প্রোডাকশনে চালান

```bash
npm start
```

কনসোলে দেখবেন:
```
AI Assistant API running on http://localhost:5000
Storage: Database
```

## ধাপ ৬: লগইন করে টেস্ট

- সাধারণ ইউজার: `demo` / `demo123`
- Admin: `admin` / `admin123`

---

## গুরুত্বপূর্ণ প্রোডাকশন নোট

- `JWT_SECRET` অবশ্যই শক্তিশালী র‍্যান্ডম স্ট্রিং দিয়ে বদলে দিন।
- `DEMO_MODE=false` সেট করুন এবং Admin Dashboard-এ real API key configure করুন।
-_monitoring/লগিং ফিচারটা ব্যবহারকারীদের জানিয়ে রাখা হয়েছে — এটা রাখাই ভালো।

## ডাটাবেস কনফিগারেশন (Optional)

### SQLite (Recommended, zero-config)

```env
DATABASE_TYPE=sqlite
DATABASE_PATH=./data/app.db
```

```bash
mkdir data
npm start
```

### PostgreSQL/MySQL/MongoDB (future support)

```env
DATABASE_TYPE=postgresql
DATABASE_URL=postgresql://user:password@localhost:5432/ai_assistant
```

দ্রষ্টব্য: বর্তমানে শুধুমাত্র **SQLite** পূর্ণরূপে implement করা আছে।

### ডাটাবেসে স্টোর করা ডেটা

- Users
- Global API Configuration
- Custom Provider Configuration
- Activity Log
- Conversations এবং Messages

### Migration from In-Memory

ডাটাবেস মোডে স্যুইচ করলে প্রথমবারে অটোমেটিক demo users সিড হবে। এরপর সব ডেটা persist হবে।

---

## ক) প্রোডাকশন ডিপ্লয়মেন্ট গাইড

### প্রি-ডিপ্লয়মেন্ট চেকলিস্ট

- [ ] `.env` ফাইলের `JWT_SECRET` বদলে দিন শক্তিশালী র‍্যান্ডম স্ট্রিং দিন
- [ ] `DEMO_MODE=false` সেট করুন যদি real AI provider ব্যবহার করতে চান
- [ ] ডেমো পাসওয়ার্ডগুলো বদলে দিন (`DEMO_USERS`), অথবা database enable করুন
- [ ] Frontend build করুন: `cd client && npm run build`
- [ ] Production dependencies install করুন: `npm install --production`

### Quick Deploy (Single Server)

```bash
# 1. Copy project
cd ai-assistant-app

# 2. Install dependencies
npm install --production

# 3. Build frontend
cd client
npm run build
cd ..

# 4. Configure environment
cp _env.example .env
# Edit .env with your settings

# 5. Start server
npm start
```

### Process Management with PM2 (Recommended)

```bash
# Install PM2 globally
npm install -g pm2

# Start app
pm2 start ai-assistant-backend.js --name "ai-assistant"

# Save config
pm2 save

# Auto-start on boot
pm2 startup
```

### Systemd Service (Linux)

Create `/etc/systemd/system/ai-assistant.service`:

```ini
[Unit]
Description=AI Assistant App
After=network.target

[Service]
Type=simple
WorkingDirectory=/path/to/ai-assistant-app
ExecStart=/usr/bin/node ai-assistant-backend.js
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable ai-assistant
sudo systemctl start ai-assistant
```

### Reverse Proxy with Nginx (Optional)

```nginx
server {
    listen 80;
    server_name your-domain.com;

    client_max_body_size 50M;

    location / {
        proxy_pass http://localhost:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Environment Variables for Production

```env
NODE_ENV=production
PORT=5000
JWT_SECRET=<long-random-string-here>
DEMO_MODE=false

# Database (optional but recommended)
DATABASE_TYPE=sqlite
DATABASE_PATH=./data/app.db

# Or PostgreSQL
# DATABASE_TYPE=postgresql
# DATABASE_URL=postgresql://user:pass@localhost:5432/ai_assistant
```

### Important Notes

- Default port is `5000`, but you can change it via `PORT` in `.env`
- Frontend is automatically served from `client/dist` by Express
- Admin Dashboard API config applies to all users
- SQLite mode is recommended for small deployments; use PostgreSQL/MySQL for production scale
