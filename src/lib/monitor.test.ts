import { describe, expect, test } from 'bun:test'
import { SerialMonitor } from './monitor'

/** A port that hands the monitor whatever the test pushes into it. */
function fakePort() {
  let push!: (text: string) => void
  let finish!: () => void

  const readable = new ReadableStream<Uint8Array>({
    start(controller) {
      push = (text) => controller.enqueue(new TextEncoder().encode(text))
      finish = () => controller.close()
    },
  })

  const port = {
    readable,
    open: async () => undefined,
    close: async () => undefined,
    setSignals: async () => undefined,
    getInfo: () => ({}),
  }

  return { port: port as unknown as SerialPort, push, finish }
}

/** Snapshots are published on a timer, so give the store a moment to catch up. */
const settle = (ms = 140) => new Promise((resolve) => setTimeout(resolve, ms))

async function watch() {
  const { port, push, finish } = fakePort()
  const monitor = new SerialMonitor()
  await monitor.attach('board-1', port)

  return { monitor, push, finish, lines: () => monitor.getSnapshot().lines.map((line) => line.text) }
}

describe('serial monitor', () => {
  test('joins lines that arrive in pieces', async () => {
    const { monitor, push, lines } = await watch()

    push('hello ')
    push('world\nsecond line\n')
    await settle()

    expect(lines()).toEqual(['hello world', 'second line'])
    await monitor.detach()
  })

  test('handles a CRLF split across two chunks', async () => {
    const { monitor, push, lines } = await watch()

    push('one\r')
    push('\ntwo\r\n')
    await settle()

    expect(lines()).toEqual(['one', 'two'])
    await monitor.detach()
  })

  test('a bare carriage return starts a new line', async () => {
    const { monitor, push, lines } = await watch()

    push('10%\r20%\r')
    await settle()

    expect(lines()).toEqual(['10%', '20%'])
    await monitor.detach()
  })

  test('drops ANSI colour codes and stray control bytes', async () => {
    const { monitor, push, lines } = await watch()

    push('\u001b[0;32mI (301) app: up\u001b[0m\n\u0007ping\n')
    await settle()

    expect(lines()).toEqual(['I (301) app: up', 'ping'])
    await monitor.detach()
  })

  test('shows a line with no newline yet, then completes it', async () => {
    const { monitor, push, lines } = await watch()

    push('Enter a command: ')
    await settle(400)
    expect(lines()).toEqual(['Enter a command: '])

    push('reboot\n')
    await settle()
    expect(lines()).toEqual(['Enter a command: reboot'])

    await monitor.detach()
  })

  test('keeps the tail of a chatty board and stops on detach', async () => {
    const { monitor, push, lines } = await watch()

    for (let index = 0; index < 2100; index += 1) push(`line ${index}\n`)
    await settle()

    const kept = lines()
    expect(kept.length).toBe(2000)
    expect(kept[0]).toBe('line 100')
    expect(kept[1999]).toBe('line 2099')

    await monitor.detach()
    expect(monitor.getSnapshot().status).toBe('off')
    expect(monitor.watching).toBeNull()

    // The stream is cancelled, which is what frees the port for the flasher.
    expect(() => push('after detach\n')).toThrow()
  })

  test('notices when the stream ends under it', async () => {
    const { monitor, finish, lines } = await watch()

    finish()
    await settle()

    expect(monitor.getSnapshot().status).toBe('off')
    expect(monitor.getSnapshot().error).toBe('The board went away')
    expect(lines().at(-1)).toBe('— disconnected —')
  })
})
