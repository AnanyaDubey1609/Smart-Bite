# SMART BITE - QR Code Based Restaurant Menu and Food Ordering System

Customers scan a QR code on their table, see the digital menu, add food to a cart and place an order.
The restaurant gets the order **live** on an admin dashboard and updates its status.

**Tech:** HTML, CSS, JavaScript (frontend) | Node.js + Express (backend) | Firebase Firestore (database) | `qrcode` library

---

## 1. What you get

| Part | Features |
|---|---|
| Customer site | Restaurant homepage, 6 categories, food images and prices, search, cart (add / + / - / remove), automatic total, name + optional phone + table, order confirmation with unique Order ID, live order status page |
| QR system | One QR code per table (`http://YOUR-IP:3000/?table=4`), table detected automatically, download PNG, print all |
| Admin dashboard | Secure login, stats (total / pending / completed orders, total sales), live orders without refresh (with sound), accept / reject / preparing / ready / completed, add / edit / delete food, upload food image, show / hide items |
| Backend | Express API, input validation, error handling, JWT login, rate limiting, secrets in `.env` |

---

## 2. Folder structure

```
smart-bite/
├── .env                    your settings and secrets (never share)
├── .env.example            template of the settings
├── package.json
├── backend/
│   ├── server.js           starts the web server and connects everything
│   ├── config/             firebase.js, firestoreDb.js (real DB), memoryDb.js (demo DB), db.js
│   ├── routes/             menu.js, orders.js, admin.js, qr.js
│   ├── middleware/auth.js  admin login check (JWT)
│   ├── utils/              validate.js, events.js, network.js
│   ├── data/               restaurant.js, sampleMenu.js (24 food items)
│   └── scripts/            seedMenu.js, generateQR.js
├── frontend/
│   ├── customer/           index.html (menu + cart), order-status.html
│   ├── admin/              login.html, dashboard.html
│   ├── css/                style.css, admin.css
│   └── js/                 common.js, cart.js, menu.js, status.js, admin.js
├── public/qrcodes/         generated QR images
├── assets/images/          logo.svg, food/*.svg    assets/uploads/  (images you upload)
├── tests/apiTest.js        automatic test (npm test)
└── docs/                   PROJECT_REPORT.md, PPT_CONTENT.md, VIVA_QA.md, HOW_IT_WORKS.md
```

---

## 3. Run on Windows (quick start, 5 minutes, no Firebase needed)

**Step 1. Install tools (one time)**
- Node.js LTS from https://nodejs.org (click Next, Next, Finish)
- VS Code from https://code.visualstudio.com

**Step 2. Unzip** `smart-bite.zip` to your Desktop. You get a folder `smart-bite`.

**Step 3. Open the folder in VS Code**: right-click the folder, "Open with Code".
Open the terminal: menu **Terminal -> New Terminal**.

**Step 4. Install packages** (needs internet, takes about 1 minute):
```powershell
npm install
```

**Step 5. Start the project in DEMO MODE** (the file `.env` already has `USE_MOCK_DB=true`):
```powershell
npm start
```
You will see:
```
SMART BITE is running!
Customer menu : http://localhost:3000
Admin login   : http://localhost:3000/admin
On your phone : http://192.168.x.x:3000
```

**Step 6. Open it**
- Customer site: http://localhost:3000
- Admin: http://localhost:3000/admin  (username `admin`, password from `.env`, default `ChangeThisPassword123`)

> Demo mode keeps data in memory. When you stop the server, orders disappear. To save data permanently, switch to Firebase (next section).

To stop the server press `Ctrl + C` in the terminal.

---

## 4. Switch to Firebase Firestore (real database)

1. Go to https://console.firebase.google.com and sign in with Google.
2. **Create a project** (name: `smart-bite`, Analytics can be off).
3. Left menu: **Build -> Firestore Database -> Create database**.
4. Choose **Production mode** (safe: only our server can use the database).
5. Choose a region near you (India: `asia-south1` Mumbai) and click **Enable**.
6. Click the gear icon next to *Project Overview* -> **Project settings** -> **Service accounts** -> **Generate new private key**. A `.json` file downloads.
7. Open that file in Notepad. Copy these three values into your `.env` file:

```env
USE_MOCK_DB=false
FIREBASE_PROJECT_ID=value of "project_id"
FIREBASE_CLIENT_EMAIL=value of "client_email"
FIREBASE_PRIVATE_KEY="value of private_key, on ONE line, keep the \n characters, keep the quotes"
```
8. Load the sample menu into Firestore:
```powershell
npm run seed
```
9. Start again with `npm start`. You should see **Connected to Firebase Firestore.**
10. In the Firebase console you will now see collections `menuItems` and (after the first order) `orders`.

**Security rules:** keep Firestore in production mode (locked). The backend uses the Admin SDK, which bypasses the rules, so customers and the internet cannot read the database directly. **Never** put the JSON key file or `.env` on GitHub or in frontend code.

Database structure:
- `menuItems`: name, category, price, description, imageUrl, available, createdAt
- `orders` (document ID = Order ID): orderId, customerName, phone, tableNumber, items[], total, status, note, createdAt, updatedAt

To replace the menu with the sample menu again: `npm run seed -- --reset`

---

## 5. QR codes

1. Start the server and log in to the admin dashboard.
2. Open the **QR codes** tab. Codes are generated automatically.
3. The address box shows the link used inside the QR codes. For phones it must be your laptop's Wi-Fi address (not `localhost`). The app fills this in automatically. If you change it, press **Generate QR codes** again.
4. Press **Download PNG** under any table, or **Print all** to print every code.
5. Stick each QR on its table.

Command line option: `npm run qr` (or `npm run qr -- http://192.168.1.5:3000`). Files are saved in `public/qrcodes/`.

How it works: each QR contains a normal link such as `http://192.168.1.5:3000/?table=4`. The menu page reads `?table=4` and pre-selects Table 4.

---

## 6. Open the website on your mobile phone

1. Connect the laptop and the phone to the **same Wi-Fi** (a mobile hotspot from the phone also works: connect the laptop to the phone's hotspot).
2. Find your laptop IP: run `ipconfig` and look for **IPv4 Address** (example `192.168.1.5`). The server also prints it when it starts.
3. On the phone browser open `http://192.168.1.5:3000`.
4. If it does not open, allow the port in Windows Firewall. Open **PowerShell as Administrator** and run:
```powershell
New-NetFirewallRule -DisplayName "Smart Bite" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow
```
5. If it still does not open: make sure Wi-Fi is set to **Private network** (Settings -> Network -> Wi-Fi -> your network), and that some Wi-Fi routers block device-to-device traffic (guest Wi-Fi / college Wi-Fi). Use a mobile hotspot instead.
6. Generate the QR codes (Section 5) and scan one with the phone camera.

---

## 7. Test the complete ordering process

1. Laptop: log in to http://localhost:3000/admin and keep the **Orders** tab open.
2. Phone: scan the QR of Table 4. The menu opens and shows **Table 4**.
3. Search "pizza", add two items, press **+** / **-**, remove one.
4. Tap the cart, enter name (phone is optional), press **Place order**.
5. The confirmation shows a unique Order ID like `SB-261109-K7QX`.
6. Laptop: the order appears **by itself** with a beep. Press **Accept**.
7. Phone: tap **Track my order**. It shows *Preparing* and updates automatically.
8. Laptop: press **Mark ready**, then **Mark completed**. The phone follows. The **Overview** shows total orders, completed orders and sales.
9. Admin -> **Menu**: add a new item, edit its price, hide it, delete it. Reload the customer menu to see the change.

Automatic test (starts the server by itself in demo mode and checks 44 things):
```powershell
npm test
```

---

## 8. Admin settings (`.env`)

| Setting | Meaning |
|---|---|
| `PORT` | website port (default 3000) |
| `USE_MOCK_DB` | `true` = demo, `false` = Firebase |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | admin login. **Change the password.** |
| `JWT_SECRET` | any long random text (signs the login token) |
| `TOTAL_TABLES` | number of tables (QR codes and table list) |
| `BASE_URL` | website address used in QR codes (auto-detects Wi-Fi IP if it is localhost) |

Restaurant name, address, timings: edit `backend/data/restaurant.js`. Sample menu: `backend/data/sampleMenu.js`.
Food images: the sample food uses simple illustrated pictures. Replace them from Admin -> Menu -> Edit -> upload a real photo.

---

## 9. Troubleshooting

| Problem | Fix |
|---|---|
| `'npm' is not recognized` | Install Node.js, then close and reopen VS Code |
| `Firebase credentials missing` | Fill the 3 Firebase values in `.env`, or set `USE_MOCK_DB=true` |
| `error:1E08010C DECODER routines` or private key error | `FIREBASE_PRIVATE_KEY` must be on one line, inside quotes, with `\n` kept |
| `Port 3000 already in use` | Change `PORT=3001` in `.env` (and use 3001 in links) |
| Phone cannot open the site | Same Wi-Fi? Firewall rule (Section 6)? Use `http://` not `https://` |
| QR opens `localhost` on the phone | Regenerate QR codes after typing your Wi-Fi IP in the QR tab |
| Admin keeps logging out | Set `JWT_SECRET` in `.env` |
| "Too many login attempts" | Wait 15 minutes (anti-hacking protection) |
| Firestore `PERMISSION_DENIED` / `NOT_FOUND` | Create the Firestore database (step 3) and check the project ID |

---

## 10. Putting it online (optional)

Any Node host works (Render, Railway, a VPS). Steps: push code to GitHub (`.env` is ignored), create a Web Service, build command `npm install`, start command `npm start`, add the `.env` values as environment variables, set `BASE_URL` to your public `https://...` address and generate the QR codes again.
Note: free hosts may erase uploaded images and QR files on restart. Regenerate QR codes after deploying, and use image links for food pictures if needed.

---

## 11. Documents for submission

- `docs/PROJECT_REPORT.md` full project report
- `docs/PPT_CONTENT.md` slide-by-slide presentation content
- `docs/VIVA_QA.md` viva questions with answers
- `docs/HOW_IT_WORKS.md` frontend, backend, database and QR explained simply
