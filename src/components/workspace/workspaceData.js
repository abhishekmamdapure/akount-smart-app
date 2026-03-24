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
      { label: 'Invoice Processing', icon: 'invoice', to: '/dashboard/invoice-processing', compact: true },
      { label: 'Tally XML Converter', icon: 'converter', to: '/dashboard/tally-xml-converter', compact: true },
      { label: 'GST Reconciliation', icon: 'gst', to: '/dashboard/gst-reconciliation', compact: true },
    ],
  },
  {
    title: 'PDF Tools',
    items: [
      { label: 'PDF Tools', icon: 'pdf', to: '/dashboard/pdf-tools', compact: true },
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
