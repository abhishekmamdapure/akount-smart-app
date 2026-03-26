import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
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
import PasswordManagerPage from './components/workspace/tools/password-manager/PasswordManagerPage'
import GstReconciliationPage from './components/workspace/tools/gst-reconciliation/GstReconciliationPage'
import PdfToolsPage from './components/workspace/tools/pdf-tools/PdfToolsPage'
import { buildLegacyDashboardRedirectTarget, workspaceRoutes } from './workspaceRoutes'

function LegacyDashboardRedirect() {
  const location = useLocation()
  const nextPath = buildLegacyDashboardRedirectTarget(location.pathname, location.search, location.hash)

  return <Navigate replace to={nextPath} />
}

function getWorkspaceRouteSegment(path) {
  return String(path || '').replace(/^\//, '')
}

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
        <Route path="/" element={<WorkspaceLayout />}>
          <Route path={getWorkspaceRouteSegment(workspaceRoutes.home)} element={<DashboardComingSoonPage />} />
          <Route
            path={getWorkspaceRouteSegment(workspaceRoutes.accounting)}
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
          <Route path={getWorkspaceRouteSegment(workspaceRoutes.invoiceProcessing)} element={<InvoiceProcessingPage />} />
          <Route path={getWorkspaceRouteSegment(workspaceRoutes.tallyXmlConverter)} element={<TallyXmlConverterPage />} />
          <Route path={getWorkspaceRouteSegment(workspaceRoutes.gstReconciliation)} element={<GstReconciliationPage />} />
          <Route
            path={getWorkspaceRouteSegment(workspaceRoutes.reconciliation2b)}
            element={<Navigate replace to={`${workspaceRoutes.gstReconciliation}?type=2b`} />}
          />
          <Route
            path={getWorkspaceRouteSegment(workspaceRoutes.reconciliation4a)}
            element={<Navigate replace to={`${workspaceRoutes.gstReconciliation}?type=4a`} />}
          />
          <Route path={getWorkspaceRouteSegment(workspaceRoutes.clients)} element={<ClientsPage />} />
          <Route
            path={getWorkspaceRouteSegment(workspaceRoutes.accountSettings)}
            element={<Navigate replace to={workspaceRoutes.settings} />}
          />
          <Route
            path={getWorkspaceRouteSegment(workspaceRoutes.pdfTools)}
            element={<PdfToolsPage />}
          />
          <Route
            path={getWorkspaceRouteSegment(workspaceRoutes.passwordManager)}
            element={<PasswordManagerPage />}
          />
          <Route path={getWorkspaceRouteSegment(workspaceRoutes.settings)} element={<AccountSettingsPage />} />
          <Route
            path={getWorkspaceRouteSegment(workspaceRoutes.help)}
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
        <Route path="/dashboard/*" element={<LegacyDashboardRedirect />} />
        <Route path="*" element={<Navigate replace to="/" />} />
      </Routes>
    </BrowserRouter>
  )
}


