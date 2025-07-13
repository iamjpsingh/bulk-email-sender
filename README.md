# Bulk Email Sender

A web-based bulk email platform built with **Bun**, **Hono**, and **TypeScript**. It provides an easy way to import contacts, compose emails with a rich editor, and send personalized messages using your own SMTP server.

## Features

- **User authentication** and personal SMTP configurations
- Import contacts from Excel files (`.xlsx` or `.xls`)
- Rich WYSIWYG email editor powered by Quill
- Placeholder support (e.g. `{{FirstName}}`, `{{Company}}`)
- Configurable delay between messages
- Live sending statistics and detailed logs
- Export reports as CSV or JSON
- Responsive Bootstrap 5 interface

## Quick Start

### Prerequisites

- [Bun](https://bun.sh/)
- SMTP server credentials (Gmail, Outlook, etc.)

### Installation

```bash
bun install
```

Copy `.env.example` to `.env` and update the SMTP settings:

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=true
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
FROM_EMAIL=your-email@gmail.com
FROM_NAME=Your Name
PORT=3000
```

### Running the App

```bash
# Development mode with auto reload
bun run dev

# Production mode
bun start
```

Open `http://localhost:3000` in your browser to access the dashboard.

## Project Structure

```
bulk-email-sender/
├── src/            # Application source
│   ├── app.ts      # Server entry point
│   ├── routes/     # API and page routes
│   └── services/   # Business logic
├── public/         # Frontend assets
├── .env.example    # Environment template
├── package.json
└── README.md
```

## License

This project is licensed under the MIT License.
