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
          <Route
            path="gst-reconciliation"
            element={
              <FeaturePlaceholderPage
                description="This module is prepared for mismatch triage, notice response, and reconciliation workflows."
                eyebrow="Compliance center"
                highlights={[
                  {
                    icon: 'gst',
                    title: 'Mismatch triage',
                    copy: 'Group exceptions by severity so the team can clear high-risk filings first.',
                  },
                  {
                    icon: 'spark',
                    title: 'Notice-ready audit trails',
                    copy: 'Keep snapshots, explanations, and evidence packs attached to every compliance cycle.',
                  },
                  {
                    icon: 'clients',
                    title: 'Client-wise follow-up',
                    copy: 'Coordinate action owners, dates, and entity-specific blockers from one screen.',
                  },
                ]}
                title="GST Reconciliation"
              />
            }
          />
          <Route
            path="reconciliation-2b"
            element={
              <FeaturePlaceholderPage
                description="Use this space for supplier matching, mismatch aging, and vendor follow-up cycles."
                eyebrow="2B reconciliation"
                highlights={[
                  {
                    icon: 'chart',
                    title: 'Supplier match rate',
                    copy: 'Track how much input tax credit is ready to claim and where the exposure remains.',
                  },
                  {
                    icon: 'switch',
                    title: 'Vendor escalations',
                    copy: 'Escalate repeated mismatch vendors with shared notes and required evidence.',
                  },
                  {
                    icon: 'calendar',
                    title: 'Period control',
                    copy: 'Lock reconciliation by month and reopen only when corrected filings come in.',
                  },
                ]}
                title="2B Reconciliation"
              />
            }
          />
          <Route
            path="reconciliation-4a"
            element={
              <FeaturePlaceholderPage
                description="This section can hold claim summaries, offset validation, and filing support views."
                eyebrow="4A reconciliation"
                highlights={[
                  {
                    icon: 'gst',
                    title: 'Credit snapshots',
                    copy: 'Summarize eligible and blocked credits before filing windows close.',
                  },
                  {
                    icon: 'dashboard',
                    title: 'Variance tracking',
                    copy: 'Compare current 4A positions against prior periods and resolved mismatches.',
                  },
                  {
                    icon: 'check',
                    title: 'Filing confidence',
                    copy: 'Give reviewers a clean readiness score before sign-off.',
                  },
                ]}
                title="4A Reconciliation"
              />
            }
          />
          <Route path="clients" element={<ClientsPage />} />
          <Route path="account-settings" element={<Navigate replace to="/dashboard/settings" />} />
          <Route
            path="pdf-tools"
            element={
              <FeaturePlaceholderPage
                description="Reserve this module for splitting, redaction, password removal, and document packet creation."
                eyebrow="Document toolkit"
                highlights={[
                  {
                    icon: 'pdf',
                    title: 'Batch utilities',
                    copy: 'Split and merge large filing packets without leaving the workspace.',
                  },
                  {
                    icon: 'password',
                    title: 'Secure handling',
                    copy: 'Apply or remove passwords with clear audit ownership and expiry controls.',
                  },
                  {
                    icon: 'download',
                    title: 'Download packs',
                    copy: 'Prepare final client delivery bundles with minimal manual formatting.',
                  },
                ]}
                title="PDF Tools"
              />
            }
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
