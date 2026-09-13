This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, install dependencies and run the development server:

```bash
bun install
bun dev
```

This project uses [Bun](https://bun.sh) as its package manager. Use `bun add <pkg>` to add dependencies and `bun run <script>` for scripts; `bun.lock` is the only lockfile that should be committed.

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## What it flashes

| Board | Connection | Formats | Protocol |
|---|---|---|---|
| ESP32, S2, S3, C2, C3, C5, C6, C61, H2, P4 | Web Serial | `.bin`, `.uf2`, `.elf` | ROM bootloader via [esptool-js](https://github.com/espressif/esptool-js) |
| RP2040, RP2350 (BOOTSEL mode) | WebUSB | `.bin`, `.uf2`, `.elf` | PICOBOOT |

- **ELF** files are converted in the browser: ESP builds become an app image the way `esptool elf2image` does, and Pico builds are written from their loadable program segments.
- **UF2** files are decoded into address runs. On an ESP a UF2 that carries a partition table is written at absolute offsets; an app-only UF2 is written relative to the app offset.
- **Raw `.bin`** files go to the flash base on a Pico and to a configurable offset (default `0x10000`) on an ESP.
- Intel HEX is recognised but not written yet.

A Pico that is running firmware shows up as a serial port. The board card offers a reboot into BOOTSEL (the 1200 baud trick from the Pico SDK), after which it can be added as a USB device.

Requires Chrome or Edge on a desktop. Run `bun test` for the image and protocol unit tests.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
