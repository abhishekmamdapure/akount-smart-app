export const workspaceUser = {
  name: 'AkountSmart',
  subtitle: 'Professional Suite',
  role: 'Signed in',
}

export const navigationSections = [
  {
    title: '',
    items: [
      { label: 'Home', icon: 'dashboard', to: '/dashboard', exact: true },
      { label: 'Clients Management', icon: 'clients', to: '/dashboard/clients', exact: true },
    ],
  },
  {
    title: 'Accounting',
    items: [
      { label: 'Accounting', icon: 'accounting', to: '/dashboard/accounting' },
      { label: 'Invoice Processing', icon: 'invoice', to: '/dashboard/invoice-processing', compact: true },
      { label: 'Tally XML Converter', icon: 'converter', to: '/dashboard/tally-xml-converter', compact: true },
    ],
  },
  {
    title: 'GST Reconciliation',
    items: [
      { label: 'GST Reconciliation', icon: 'gst', to: '/dashboard/gst-reconciliation' },
      { label: '2B Reconciliation', icon: 'spark', to: '/dashboard/reconciliation-2b', compact: true },
      { label: '4A Reconciliation', icon: 'chart', to: '/dashboard/reconciliation-4a', compact: true },
    ],
  },
  {
    title: 'PDF Tools',
    items: [
      { label: 'Split / Merge', icon: 'pdf', to: '/dashboard/pdf-tools' },
      { label: 'Reorder / Delete', icon: 'file', to: '/dashboard/pdf-tools', compact: true },
      { label: 'Page Numbers', icon: 'file', to: '/dashboard/pdf-tools', compact: true },
      { label: 'Watermark', icon: 'file', to: '/dashboard/pdf-tools', compact: true },
      { label: 'Convert to Word', icon: 'download', to: '/dashboard/pdf-tools', compact: true },
      { label: 'Convert to Excel', icon: 'download', to: '/dashboard/pdf-tools', compact: true },
    ],
  },
  {
    title: 'Access Control',
    items: [
      { label: 'Password Manager', icon: 'password', to: '/dashboard/password-manager' },
    ],
  },
]

export const utilityNavigation = [
  { label: 'Help', icon: 'help', to: '/dashboard/help' },
]

export const mobileNavigation = [
  { label: 'Home', icon: 'dashboard', to: '/dashboard', exact: true },
  { label: 'Clients Management', icon: 'clients', to: '/dashboard/clients', exact: true },
  { label: 'Converter', icon: 'converter', to: '/dashboard/tally-xml-converter' },
  { label: 'GST', icon: 'gst', to: '/dashboard/gst-reconciliation' },
  { label: 'PDF', icon: 'pdf', to: '/dashboard/pdf-tools' },
]
