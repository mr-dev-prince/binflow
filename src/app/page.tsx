'use client'

import { useState } from 'react'
import { ActivityLog } from '@/components/flash/activity-log'
import { AppHeader } from '@/components/flash/app-header'
import { BoardStep } from '@/components/flash/board-step'
import { ConnectDialog } from '@/components/flash/connect-dialog'
import { FirmwareStep } from '@/components/flash/firmware-step'
import { FlashStep } from '@/components/flash/flash-step'
import { readBinary, warningFor } from '@/lib/binary'
import { useElapsed, useFlasher } from '@/lib/use-flasher'

const Home = () => {
  const { state, supported, connectBoard, pickBoard, releaseBoard, forgetBoard, setBinary, clearLog, start, abort, log } =
    useFlasher()
  const [reading, setReading] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)

  const { devices, available, binary, logs, running, stage, activeId, finished, startedAt, finishedAt } = state

  const targets = devices.filter((device) => device.state !== 'offline')
  const elapsed = useElapsed(startedAt, finishedAt, running)

  const active = activeId ? devices.find((device) => device.id === activeId) : undefined
  const progress =
    targets.length === 0 ? 0 : Math.min(1, (finished + (running ? active?.progress ?? 0 : 0)) / targets.length)

  const warning = binary ? warningFor(binary) : null
  const completed = !running && finishedAt !== null && targets.some((device) => device.state !== 'ready')

  const blocker =
    targets.length === 0
      ? 'Connect a board to get started.'
      : !binary
        ? 'Choose a firmware file to continue.'
        : warning

  const summary = binary
    ? `${targets.length === 1 ? targets[0].name : `${targets.length} boards`} · ${binary.name}`
    : ''

  const handleFile = async (file: File) => {
    setReading(true)

    try {
      setBinary(await readBinary(file))
    } catch (error) {
      log('error', 'firmware', `Could not read ${file.name}: ${(error as Error).message}`)
    } finally {
      setReading(false)
    }
  }

  return (
    <div className="paper flex h-dvh flex-col overflow-hidden text-ink">
      <AppHeader supported={supported} />

      <main className="pane-scroll grid min-h-0 flex-1 gap-4 overflow-y-auto px-4 pb-4 lg:grid-cols-[1fr_1fr_1.2fr] lg:grid-rows-[minmax(0,1fr)] lg:overflow-hidden lg:px-6 lg:pb-6">
        <BoardStep
          availableCount={available.length}
          devices={devices}
          onOpenPicker={() => setPickerOpen(true)}
          onRelease={releaseBoard}
          running={running}
          supported={supported}
        />

        <FirmwareStep
          binary={binary}
          disabled={running}
          onClear={() => setBinary(null)}
          onFile={handleFile}
          reading={reading}
        />

        <FlashStep
          activeName={active?.name ?? null}
          blocker={blocker}
          completed={completed}
          elapsed={elapsed}
          finished={finished}
          onAbort={abort}
          onStart={start}
          progress={progress}
          running={running}
          stage={stage}
          summary={summary}
          targets={targets.length}
        />
      </main>

      <ActivityLog entries={logs} onClear={clearLog} />

      <ConnectDialog
        available={available}
        onClose={() => setPickerOpen(false)}
        onConnect={connectBoard}
        onForget={forgetBoard}
        onPick={pickBoard}
        open={pickerOpen}
      />
    </div>
  )
}

export default Home
