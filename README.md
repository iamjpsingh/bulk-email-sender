# Bulk Email Sender

A web-based email campaign tool built with **Bun**, **Hono**, and **TypeScript**. It supports importing contacts from Excel, personalized templates, scheduling, and detailed delivery reports. User accounts with individual SMTP profiles allow multiple people to use the system securely.

![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)
![Bun](https://img.shields.io/badge/Bun-%23000000.svg?style=for-the-badge&logo=bun&logoColor=white)
![Bootstrap](https://img.shields.io/badge/bootstrap-%23563D7C.svg?style=for-the-badge&logo=bootstrap&logoColor=white)

## Features

- **User authentication** with session management
- **SMTP configuration per user** with optional global defaults
- **Excel (.xlsx/.xls) contact import** with dynamic placeholder support
- **Rich email editor** powered by Quill
- **Batch sending** and **scheduled jobs** with email notifications on completion
- **Real‑time dashboard** for monitoring progress and logs
- Built using **Bootstrap 5** for the UI

## Getting Started

### Installation

```bash
bun install
```

### Environment setup

Create a `.env` file based on the template below. Values can be left empty to configure SMTP settings through the web interface.

```env
# Bulk Email Sender configuration

# Server settings
PORT=3000
SESSION_SECRET=replace_with_secure_key

# Default SMTP settings
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=true
SMTP_USER=you@example.com
SMTP_PASS=app_password
FROM_EMAIL=you@example.com
FROM_NAME=Your Name

# Optional notification SMTP (for job completion emails)
NOTIFICATION_SMTP_HOST=smtp.gmail.com
NOTIFICATION_SMTP_PORT=587
NOTIFICATION_SMTP_SECURE=true
NOTIFICATION_SMTP_USER=notify@example.com
NOTIFICATION_SMTP_PASS=notify_password
NOTIFICATION_FROM_NAME=Campaign Notifier
```

### Running the server

```bash
bun run dev  # development with reload
bun start    # production
```

The dashboard will be available at `http://localhost:3000`.

## Excel File Format

Upload a spreadsheet with the following headers:

| Email | FirstName | LastName | Company | Subject |
| ----- | --------- | -------- | ------- | ------- |
| `john@example.com` | John | Doe | Example Ltd | Welcome! |

Additional columns can be referenced in the email body using `{{ColumnName}}`.

## Contributing

Contributions are welcome! The frontend currently uses plain HTML, but you can introduce [Svelte](https://svelte.dev/) with TypeScript to build more modular components. Feel free to open issues or pull requests with improvements.

## License

This project is released under the MIT License.
