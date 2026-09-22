'use client'

import { useState } from 'react'
import { ActivityLog } from '@/components/flash/activity-log'
import { AppHeader } from '@/components/flash/app-header'
import { BoardStep } from '@/components/flash/board-step'
import { ConnectDialog } from '@/components/flash/connect-dialog'
import { FAMILY_LABEL } from '@/components/flash/family'
import { FirmwareStep } from '@/components/flash/firmware-step'
import { FlashStep } from '@/components/flash/flash-step'
import { readBinary, warningFor } from '@/lib/binary'
import type { Binary, Device } from '@/lib/types'
import { useElapsed, useFlasher } from '@/lib/use-flasher'

/** Bridges such as CP210x hide the chip, so an unknown serial board is assumed to be an ESP. */
function fits(binary: Binary, device: Device) {
  if (binary.hint.family === 'unknown') return true
  if (binary.hint.family === device.family) return true
  return binary.hint.family === 'esp' && device.family === 'unknown'
}

const Home = () => {
  const {
    state,
    support,
    monitor,
    connectBoard,
    pickSerial,
    pickBootsel,
    releaseBoard,
    forgetBoard,
    rebootBoard,
    recheckBoard,
    startMonitor,
    stopMonitor,
    selectMonitorBoard,
    setMonitorBaud,
    clearMonitor,
    resetMonitored,
    setBinary,
    setEspOffset,
    clearLog,
    start,
    abort,
    log,
  } = useFlasher()
  const [reading, setReading] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)

  const { devices, available, binary, espOffset, logs, running, stage, activeId, finished, startedAt, finishedAt } = state

  const targets = devices.filter((device) => device.state !== 'offline')
  /** Only a serial board prints anything; a Pico in BOOTSEL has no console. */
  const serialBoards = targets.filter((device) => device.transport === 'serial')
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
          ? warning
          : !targets.some((device) => fits(binary, device))
            ? `This file is built for ${FAMILY_LABEL[binary.hint.family]} boards. None is connected.`
            : null

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
      <AppHeader support={support} />

      <main className="pane-scroll grid min-h-0 flex-1 gap-4 overflow-y-auto px-4 pb-4 lg:grid-cols-[1fr_1fr_1.2fr] lg:grid-rows-[minmax(0,1fr)] lg:overflow-hidden lg:px-6 lg:pb-6">
        <BoardStep
          availableCount={available.length}
          devices={devices}
          onOpenPicker={() => setPickerOpen(true)}
          onReboot={rebootBoard}
          onRecheck={recheckBoard}
          onRelease={releaseBoard}
          running={running}
          support={support}
        />

        <FirmwareStep
          binary={binary}
          disabled={running}
          espOffset={espOffset}
          onClear={() => setBinary(null)}
          onEspOffset={setEspOffset}
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

      <ActivityLog
        entries={logs}
        monitor={monitor}
        monitorBoards={serialBoards}
        onClear={clearLog}
        onClearMonitor={clearMonitor}
        onMonitorBaud={setMonitorBaud}
        onResetBoard={resetMonitored}
        onSelectBoard={selectMonitorBoard}
        onStartMonitor={startMonitor}
        onStopMonitor={stopMonitor}
        running={running}
      />

      <ConnectDialog
        available={available}
        onClose={() => setPickerOpen(false)}
        onConnect={connectBoard}
        onForget={forgetBoard}
        onPickBootsel={pickBootsel}
        onPickSerial={pickSerial}
        open={pickerOpen}
        support={support}
      />
    </div>
  )
}

export default Home
