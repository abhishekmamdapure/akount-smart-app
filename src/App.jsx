import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import LandingPage from './components/LandingPage'
import LoginPage from './components/LoginPage'
import SignupPage from './components/SignupPage'
import OtpPage from './components/OtpPage'
import ForgotPasswordPage from './components/ForgotPasswordPage'
import CreatePasswordPage from './components/CreatePasswordPage'
import ClientsPage from './components/workspace/ClientsPage'
import AccountSettingsPage from './components/workspace/AccountSettingsPage'
import DashboardComingSoonPage from './components/workspace/DashboardComingSoonPage'
import FeaturePlaceholderPage from './components/workspace/FeaturePlaceholderPage'
import TallyXmlConverterPage from './components/workspace/TallyXmlConverterPage'
import WorkspaceLayout from './components/workspace/WorkspaceLayout'
import InvoiceProcessingPage from './components/workspace/tools/invoice-processing/InvoiceProcessingPage'
import GstReconciliationPage from './components/workspace/tools/gst-reconciliation/GstReconciliationPage'
import PdfToolsPage from './components/workspace/tools/pdf-tools/PdfToolsPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/verify-otp" element={<OtpPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/create-password" element={<CreatePasswordPage />} />
        <Route path="/dashboard" element={<WorkspaceLayout />}>
          <Route index element={<DashboardComingSoonPage />} />
          <Route
            path="accounting"
            element={
              <FeaturePlaceholderPage
                description="Structure invoice review, ledger cleanup, and high-volume posting in one accounting workspace."
                eyebrow="Accounting workspace"
                highlights={[
                  {
                    icon: 'invoice',
                    title: 'Batch review queues',
                    copy: 'Group vouchers by source, period, or entity before pushing them into conversion and filing flows.',
                  },
                  {
                    icon: 'chart',
                    title: 'Ledger visibility',
                    copy: 'Spot unmatched ledgers, duplicate postings, and exception-heavy entities before month-end close.',
                  },
                  {
                    icon: 'spark',
                    title: 'AI-assisted cleanup',
                    copy: 'Prioritize cleanup actions based on confidence scores and recurring correction patterns.',
                  },
                ]}
                title="Accounting Operations"
              />
            }
          />
          <Route path="invoice-processing" element={<InvoiceProcessingPage />} />
          <Route path="tally-xml-converter" element={<TallyXmlConverterPage />} />
          <Route path="gst-reconciliation" element={<GstReconciliationPage />} />
          <Route path="reconciliation-2b" element={<Navigate replace to="/dashboard/gst-reconciliation?type=2b" />} />
          <Route path="reconciliation-4a" element={<Navigate replace to="/dashboard/gst-reconciliation?type=4a" />} />
          <Route path="clients" element={<ClientsPage />} />
          <Route path="account-settings" element={<Navigate replace to="/dashboard/settings" />} />
          <Route
            path="pdf-tools"
            element={<PdfToolsPage />}
          />
          <Route
            path="password-manager"
            element={
              <FeaturePlaceholderPage
                description="Store portal credentials, OTP routines, and owner assignments in one governed vault."
                eyebrow="Access control"
                highlights={[
                  {
                    icon: 'password',
                    title: 'Credential vault',
                    copy: 'Organize credentials per entity, portal, and owner with rotation reminders.',
                  },
                  {
                    icon: 'clients',
                    title: 'Entity linking',
                    copy: 'Connect access records directly to clients and filing cycles so context is never lost.',
                  },
                  {
                    icon: 'check',
                    title: 'Approval flow',
                    copy: 'Define who can reveal, edit, or rotate passwords based on team role.',
                  },
                ]}
                title="Password Manager"
              />
            }
          />
          <Route path="settings" element={<AccountSettingsPage />} />
          <Route
            path="help"
            element={
              <FeaturePlaceholderPage
                clientContextEnabled={false}
                description="Use this section for guided support, change logs, and embedded product education."
                eyebrow="Support"
                highlights={[
                  {
                    icon: 'help',
                    title: 'Contextual support',
                    copy: 'Route users to the right guide based on the screen they are already working in.',
                  },
                  {
                    icon: 'spark',
                    title: 'Release communication',
                    copy: 'Explain what changed in a workflow without sending users to external docs first.',
                  },
                  {
                    icon: 'clients',
                    title: 'Escalation paths',
                    copy: 'Give operations, admins, and reviewers clear support ownership.',
                  },
                ]}
                title="Help Center"
              />
            }
          />
        </Route>
        <Route path="*" element={<Navigate replace to="/" />} />
      </Routes>
    </BrowserRouter>
  )
}


