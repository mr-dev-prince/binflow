type IconProps = { className?: string }

const base = 'h-4 w-4 shrink-0'

function Svg({ className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      className={className ? `${base} ${className}` : base}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.6"
      viewBox="0 0 24 24"
    >
      {children}
    </svg>
  )
}

export const BoardIcon = (props: IconProps) => (
  <Svg {...props}>
    <rect height="14" rx="2" width="14" x="5" y="5" />
    <rect height="4" rx="1" width="4" x="10" y="10" />
    <path d="M9 5V3M15 5V3M9 21v-2M15 21v-2M5 9H3M5 15H3M21 9h-2M21 15h-2" />
  </Svg>
)

export const UploadIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M12 16V4m0 0L8 8m4-4 4 4" />
    <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
  </Svg>
)

export const BoltIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M13 3 5 14h6l-1 7 8-11h-6l1-7Z" />
  </Svg>
)

export const StopIcon = (props: IconProps) => (
  <Svg {...props}>
    <rect height="12" rx="2" width="12" x="6" y="6" />
  </Svg>
)

export const RefreshIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M20 12a8 8 0 1 1-2.34-5.66" />
    <path d="M20 4v5h-5" />
  </Svg>
)

export const CheckIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="m5 13 4 4L19 7" />
  </Svg>
)

export const AlertIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M12 8v5M12 16.5v.5" />
    <circle cx="12" cy="12" r="9" />
  </Svg>
)

export const TrashIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M4 7h16M10 7V5h4v2M6 7l1 13h10l1-13" />
  </Svg>
)

export const FileIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
    <path d="M14 3v5h5" />
  </Svg>
)

export const ChevronIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="m6 9 6 6 6-6" />
  </Svg>
)

export const ExpandIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M9 4H4v5M15 4h5v5M15 20h5v-5M9 20H4v-5" />
  </Svg>
)

export const CollapseIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M4 9h5V4M20 9h-5V4M20 15h-5v5M4 15h5v5" />
  </Svg>
)

export const PlugIcon = (props: IconProps) => (
  <Svg {...props}>
    <path d="M9 3v5M15 3v5" />
    <path d="M6 8h12v3a6 6 0 0 1-12 0V8Z" />
    <path d="M12 17v4" />
  </Svg>
)
