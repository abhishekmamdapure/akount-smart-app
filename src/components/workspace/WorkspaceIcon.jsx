function Svg({ children, size = 20, className = '' }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.85"
      viewBox="0 0 24 24"
      width={size}
    >
      {children}
    </svg>
  )
}

export default function WorkspaceIcon({ name, size = 20, className = '' }) {
  switch (name) {
    case 'dashboard':
      return (
        <Svg className={className} size={size}>
          <rect x="4" y="4" width="6" height="6" rx="1.5" />
          <rect x="14" y="4" width="6" height="10" rx="1.5" />
          <rect x="4" y="14" width="6" height="6" rx="1.5" />
          <rect x="14" y="16" width="6" height="4" rx="1.5" />
        </Svg>
      )
    case 'accounting':
      return (
        <Svg className={className} size={size}>
          <path d="M7 4h8l4 4v12H7z" />
          <path d="M15 4v4h4" />
          <path d="M10 12h6" />
          <path d="M10 16h4" />
        </Svg>
      )
    case 'invoice':
      return (
        <Svg className={className} size={size}>
          <path d="M6 3h12v18l-2.5-1.5L13 21l-2.5-1.5L8 21l-2-1.5z" />
          <path d="M9 8h6" />
          <path d="M9 12h6" />
          <path d="M9 16h4" />
        </Svg>
      )
    case 'converter':
      return (
        <Svg className={className} size={size}>
          <path d="M7 7h12" />
          <path d="m15 4 4 3-4 3" />
          <path d="M17 17H5" />
          <path d="m9 14-4 3 4 3" />
        </Svg>
      )
    case 'gst':
      return (
        <Svg className={className} size={size}>
          <path d="M12 3 6 6v5c0 4 2.4 7.6 6 9 3.6-1.4 6-5 6-9V6z" />
          <path d="m9.5 12 1.8 1.8 3.2-3.6" />
        </Svg>
      )
    case 'clients':
      return (
        <Svg className={className} size={size}>
          <path d="M16 19v-1.2a3.8 3.8 0 0 0-3.8-3.8H8.8A3.8 3.8 0 0 0 5 17.8V19" />
          <circle cx="10.5" cy="8" r="3" />
          <path d="M19 19v-1a3 3 0 0 0-2.4-3" />
          <path d="M15.2 5.4a3 3 0 1 1 0 5.2" />
        </Svg>
      )
    case 'pdf':
      return (
        <Svg className={className} size={size}>
          <path d="M7 3h8l4 4v14H7z" />
          <path d="M15 3v4h4" />
          <path d="M9 15h6" />
          <path d="M9 11h6" />
        </Svg>
      )
    case 'password':
      return (
        <Svg className={className} size={size}>
          <circle cx="8" cy="12" r="3" />
          <path d="M11 12h9" />
          <path d="M17 12v3" />
          <path d="M14 12v2" />
        </Svg>
      )
    case 'settings':
      return (
        <Svg className={className} size={size}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a2 2 0 1 1-4 0v-.2a1 1 0 0 0-.7-.9 1 1 0 0 0-1.1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a2 2 0 1 1 0-4h.2a1 1 0 0 0 .9-.7 1 1 0 0 0-.2-1.1l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1 1 0 0 0 1.1.2h.1a1 1 0 0 0 .6-.9V4a2 2 0 1 1 4 0v.2a1 1 0 0 0 .7.9 1 1 0 0 0 1.1-.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1 1 0 0 0-.2 1.1v.1a1 1 0 0 0 .9.6H20a2 2 0 1 1 0 4h-.2a1 1 0 0 0-.9.7Z" />
        </Svg>
      )
    case 'account':
      return (
        <Svg className={className} size={size}>
          <circle cx="12" cy="8.2" r="3.2" />
          <path d="M5.5 18.2a6.5 6.5 0 0 1 13 0" />
        </Svg>
      )
    case 'help':
      return (
        <Svg className={className} size={size}>
          <circle cx="12" cy="12" r="9" />
          <path d="M9.1 9.3a3 3 0 1 1 4.9 2.3c-.9.8-1.5 1.3-1.5 2.4" />
          <path d="M12 17h.01" />
        </Svg>
      )
    case 'search':
      return (
        <Svg className={className} size={size}>
          <circle cx="11" cy="11" r="6" />
          <path d="m20 20-3.2-3.2" />
        </Svg>
      )
    case 'bell':
      return (
        <Svg className={className} size={size}>
          <path d="M15 17H5.5a1 1 0 0 1-.8-1.6l1.3-1.8V10a6 6 0 1 1 12 0v3.6l1.3 1.8A1 1 0 0 1 18.5 17H17" />
          <path d="M10 20a2 2 0 0 0 4 0" />
        </Svg>
      )
    case 'chevronDown':
      return (
        <Svg className={className} size={size}>
          <path d="m6 9 6 6 6-6" />
        </Svg>
      )
    case 'plus':
      return (
        <Svg className={className} size={size}>
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </Svg>
      )
    case 'mail':
      return (
        <Svg className={className} size={size}>
          <rect x="3.5" y="6.5" width="17" height="11" rx="2" />
          <path d="m4.5 8.5 7.5 5 7.5-5" />
        </Svg>
      )
    case 'phone':
      return (
        <Svg className={className} size={size}>
          <path d="M7.5 4.5h3L12 8l-2 1.5a14 14 0 0 0 4.5 4.5L16 12l3.5 1.5v3a1.5 1.5 0 0 1-1.6 1.5A16.8 16.8 0 0 1 6 6.1 1.5 1.5 0 0 1 7.5 4.5Z" />
        </Svg>
      )
    case 'edit':
      return (
        <Svg className={className} size={size}>
          <path d="M4 20h4l10-10-4-4L4 16z" />
          <path d="m13.5 6.5 4 4" />
        </Svg>
      )
    case 'trash':
      return (
        <Svg className={className} size={size}>
          <path d="M4.5 7.5h15" />
          <path d="M9.5 7.5V5h5v2.5" />
          <path d="M7 7.5 8 19h8l1-11.5" />
          <path d="M10 11v5" />
          <path d="M14 11v5" />
        </Svg>
      )
    case 'upload':
      return (
        <Svg className={className} size={size}>
          <path d="M6 17.5h11a3.5 3.5 0 0 0 .5-7 5 5 0 0 0-9.7-1.2A3.5 3.5 0 0 0 6 17.5Z" />
          <path d="m12 15 0-6" />
          <path d="m9.5 11.5 2.5-2.5 2.5 2.5" />
        </Svg>
      )
    case 'download':
      return (
        <Svg className={className} size={size}>
          <path d="M6 17.5h12" />
          <path d="M12 6v8" />
          <path d="m8.5 10.5 3.5 3.5 3.5-3.5" />
        </Svg>
      )
    case 'file':
      return (
        <Svg className={className} size={size}>
          <path d="M7 3h8l4 4v14H7z" />
          <path d="M15 3v4h4" />
        </Svg>
      )
    case 'chart':
      return (
        <Svg className={className} size={size}>
          <path d="M5 19V9" />
          <path d="M12 19V5" />
          <path d="M19 19v-7" />
          <path d="M4 19h16" />
        </Svg>
      )
    case 'spark':
      return (
        <Svg className={className} size={size}>
          <path d="m12 4 1.6 3.6L17 9.2l-3.4 1.6L12 14.5l-1.6-3.7L7 9.2l3.4-1.6Z" />
          <path d="m18.5 15.5.8 1.8 1.7.8-1.7.8-.8 1.7-.8-1.7-1.7-.8 1.7-.8Z" />
          <path d="m5.5 15.5.8 1.6 1.6.8-1.6.8-.8 1.6-.8-1.6-1.6-.8 1.6-.8Z" />
        </Svg>
      )
    case 'arrowRight':
      return (
        <Svg className={className} size={size}>
          <path d="M5 12h14" />
          <path d="m13 6 6 6-6 6" />
        </Svg>
      )
    case 'check':
      return (
        <Svg className={className} size={size}>
          <path d="m5 12 4 4 10-10" />
        </Svg>
      )
    case 'close':
      return (
        <Svg className={className} size={size}>
          <path d="m6 6 12 12" />
          <path d="M18 6 6 18" />
        </Svg>
      )
    case 'menu':
      return (
        <Svg className={className} size={size}>
          <path d="M4 7h16" />
          <path d="M4 12h16" />
          <path d="M4 17h16" />
        </Svg>
      )
    case 'filter':
      return (
        <Svg className={className} size={size}>
          <path d="M4 7h16" />
          <path d="M7 12h10" />
          <path d="M10 17h4" />
        </Svg>
      )
    case 'switch':
      return (
        <Svg className={className} size={size}>
          <path d="M7 7h11" />
          <path d="m14 4 4 3-4 3" />
          <path d="M17 17H6" />
          <path d="m10 14-4 3 4 3" />
        </Svg>
      )
    case 'logout':
      return (
        <Svg className={className} size={size}>
          <path d="M9 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3" />
          <path d="M16 17l5-5-5-5" />
          <path d="M21 12H9" />
        </Svg>
      )
    case 'calendar':
      return (
        <Svg className={className} size={size}>
          <rect x="4" y="6" width="16" height="14" rx="2" />
          <path d="M8 4v4" />
          <path d="M16 4v4" />
          <path d="M4 10h16" />
        </Svg>
      )
    default:
      return (
        <Svg className={className} size={size}>
          <circle cx="12" cy="12" r="8" />
        </Svg>
      )
  }
}
