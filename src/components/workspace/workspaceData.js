import { workspaceRoutes } from '../../workspaceRoutes'

export const workspaceUser = {
  name: 'AkountSmart',
  subtitle: 'Professional Suite',
  role: 'Signed in',
}

export const navigationSections = [
  {
    title: '',
    items: [
      { label: 'Home', icon: 'toolDashboard', to: workspaceRoutes.home, exact: true },
      { label: 'Clients Management', icon: 'toolClients', to: workspaceRoutes.clients, exact: true },
    ],
  },
  {
    title: 'Accounting',
    items: [
      { label: 'Invoice Processing', icon: 'invoice', to: workspaceRoutes.invoiceProcessing, compact: true },
      { label: 'Tally XML Converter', icon: 'toolTallyXmlConverter', to: workspaceRoutes.tallyXmlConverter, compact: true },
      { label: 'GST Reconciliation', icon: 'toolGst', to: workspaceRoutes.gstReconciliation, compact: true },
    ],
  },
  {
    title: 'PDF Tools',
    items: [
      { label: 'PDF Tools', icon: 'toolPdfTools', to: workspaceRoutes.pdfTools, compact: true },
    ],
  },
  {
    title: 'Access Control',
    items: [
      { label: 'Password Manager', icon: 'toolPasswordManager', to: workspaceRoutes.passwordManager },
    ],
  },
]

export const utilityNavigation = [
  { label: 'Help', icon: 'help', to: workspaceRoutes.help },
]

export const mobileNavigation = [
  { label: 'Home', icon: 'toolDashboard', to: workspaceRoutes.home, exact: true },
  { label: 'Clients Management', icon: 'toolClients', to: workspaceRoutes.clients, exact: true },
  { label: 'Converter', icon: 'toolTallyXmlConverter', to: workspaceRoutes.tallyXmlConverter },
  { label: 'GST', icon: 'toolGst', to: workspaceRoutes.gstReconciliation },
  { label: 'PDF', icon: 'toolPdfTools', to: workspaceRoutes.pdfTools },
]
