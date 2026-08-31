# Project Peak Control Room

Project Peak Main Website နဲ့ 12-Week Home Workout app ကို တစ်နေရာတည်းက စီမံနိုင်တဲ့ standalone admin dashboard ဖြစ်ပါတယ်။

## Included

- Telegram-delivered 6-digit OTP login
- Five-minute OTP expiry, attempt limits and rate limiting
- One active device across the dashboard
- Home Workout payment review, receipt preview and program assignment
- Customer access controls
- Notion-style bilingual 12-week template builder
- Main Website blog draft/publish editor
- Audit trail for authentication and content changes
- Responsive, Myanmar-first trainer UI

## Local setup

Copy `.env.example` to `.env.local`, add the server-only credentials, then run:

```bash
npm install
npm run dev
```

## Checks

```bash
npm run lint
npm run build
```

Database changes are versioned in `supabase/migrations`.
