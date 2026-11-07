# ⭐ Salat Stars

A Shia family salat tracker: Jafari prayer times (matched to Hujjat, Stanmore), family league, rewards, qadha tracker, daily sayings of Imam Ali (as), the Shia calendar, and bulugh dates per Sayyid Sistani.

It runs as **one Cloudflare Worker**, which serves the app, the API and the 5-minute prayer-notification timer. It uses a Worker rather than Pages because Pages can't run timers.

## Deploy (about 10 minutes, all from the phone browser)

1. **GitHub:** create a new repository called `salat-stars` and upload every file and folder from this zip, keeping the folder structure. Don't upload `node_modules`.
2. **Storage:** in Cloudflare, go to **Storage & Databases → KV → Create**. Name it `salat-stars` and copy its **ID**.
3. In GitHub, open `wrangler.toml`, tap ✏️, and replace `PASTE_YOUR_KV_NAMESPACE_ID_HERE` with that ID. Commit the change.
4. **Deploy:** in Cloudflare, go to **Workers & Pages → Create → Import a repository** and pick `salat-stars`. Leave the defaults (deploy command `npx wrangler deploy`) and tap Deploy.
5. When it's live (for example `https://salat-stars.<you>.workers.dev`), put that address into `APP_ORIGIN` in `wrangler.toml` and commit. It redeploys automatically.
6. Open the address and tap **Set up a new family**.

Notification keys and the login secret are created automatically on first use, so there's nothing secret to paste.

### Optional: weekly email to parents
1. Create a free account at resend.com and make an API key.
2. In Cloudflare, go to **Worker → Settings → Variables and Secrets → Add**. Make it a **Secret** called `RESEND_API_KEY`.
3. Without your own domain, Resend only sends to the email address you signed up with. To send to everyone, verify a domain in Resend and add a variable `EMAIL_FROM` such as `Salat Stars <stars@yourdomain>`.
4. Emails go out on Sundays at 7pm. Each parent's email is set under Family → Edit.

## Each phone
- **iPhone:** open the link in Safari, tap Share, then **Add to Home Screen**, open it from the Home Screen, then go to Family → **Turn on notifications**.
- **Android:** open the link in Chrome, tap ⋮, then **Install app**, then Family → Turn on notifications.

## Rules built in
| Thing | Rule |
|---|---|
| Points | 1st to pray gets N points (N = family size), 2nd gets N−1 … minimum 1. Taps in the same minute share the higher score. The server's clock decides the order. |
| Extras | Azaan, Iqamah, Tasbih of Sayyida Fatima (sa), a Quran verse: +1 each. Jamaat with family: +2. |
| Windows | Fajr → sunrise. Dhuhr & Asr → sunset. Maghrib & Isha → Jafari midnight. Asr needs Dhuhr first; Isha needs Maghrib first. |
| Missed | −1 when the window ends. By default this only applies once salat is wajib; a parent can switch it to Always or Never per person. |
| Parent override | Cancel the −1, mark as prayed late, or mark qadha done. |
| Qadha | Making it up gives the point back. There are also counters for older qadha. |
| Excused | No penalty, keeps the streak. Parents can see it; siblings can't. |
| Totals | Never go below zero. |
| Bulugh | Girls on completing 9 lunar years; boys on completing 15 lunar years (or earlier signs). Sayyid Sistani, Islamic Laws, Ruling 2270: https://www.sistani.org/english/book/48/2355/ |

## Editing content
`public/js/core/content.js` holds the Nahj al-Balagha sayings (with numbers), the Ahlulbayt wisdom list, the Shia calendar dates, the Zahra Trust link and the extras. Please check the Ahlulbayt quotes against your own books.

## Local test
`npm install` then `npx wrangler dev`.
