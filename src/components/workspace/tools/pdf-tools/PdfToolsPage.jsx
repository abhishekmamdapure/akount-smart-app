import { useCallback, useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import workspaceStyles from '../../Workspace.module.css'
import styles from '../shared/Tools.module.css'
import ConvertExcelTool from './components/ConvertExcelTool'
import ConvertWordTool from './components/ConvertWordTool'
import PageNumbersTool from './components/PageNumbersTool'
import PdfHistoryPanel from './components/PdfHistoryPanel'
import PdfToolHome from './components/PdfToolHome'
import ReorderDeleteTool from './components/ReorderDeleteTool'
import SplitMergeTool from './components/SplitMergeTool'
import WatermarkTool from './components/WatermarkTool'
import { TOOL_CARDS } from './pdfToolConstants'
import { EMPTY_PDF_TOOL_TOTALS, fetchPdfToolsUsage, logPdfToolsUsage } from './pdfToolsUsageService'

function joinClasses(...values) {
  return values.filter(Boolean).join(' ')
}

export default function PdfToolsPage() {
  const outletContext = useOutletContext() ?? {}
  const authReady = outletContext.authReady ?? false
  const currentUser = outletContext.currentUser ?? null

  const [activeTool, setActiveTool] = useState('')
  const [historyStatus, setHistoryStatus] = useState('idle')
  const [historyError, setHistoryError] = useState('')
  const [historyItems, setHistoryItems] = useState([])
  const [totalsByTool, setTotalsByTool] = useState({ ...EMPTY_PDF_TOOL_TOTALS })

  useEffect(() => {
    if (!authReady || !currentUser?.id || !currentUser?.email) {
      setHistoryStatus('idle')
      setHistoryError('')
      setHistoryItems([])
      setTotalsByTool({ ...EMPTY_PDF_TOOL_TOTALS })
      return
    }

    let isActive = true
    setHistoryStatus('loading')
    setHistoryError('')

    fetchPdfToolsUsage({ currentUser })
      .then((result) => {
        if (!isActive) {
          return
        }

        setHistoryItems(result.items)
        setTotalsByTool(result.totalsByTool)
        setHistoryStatus('ready')
      })
      .catch((error) => {
        if (!isActive) {
          return
        }

        setHistoryItems([])
        setTotalsByTool({ ...EMPTY_PDF_TOOL_TOTALS })
        setHistoryError(error.message || 'Unable to load PDF usage history.')
        setHistoryStatus('error')
      })

    return () => {
      isActive = false
    }
  }, [authReady, currentUser?.email, currentUser?.id])

  const handleUsage = useCallback(
    async ({ tool, status, summary, durationMs }) => {
      if (!authReady || !currentUser?.id || !currentUser?.email) {
        return
      }

      try {
        const entry = await logPdfToolsUsage({
          currentUser,
          tool,
          status,
          summary,
          durationMs,
        })

        if (!entry) {
          return
        }

        setHistoryItems((current) => [entry, ...current].slice(0, 120))
        setTotalsByTool((current) => ({
          ...current,
          [tool]: (current[tool] || 0) + 1,
        }))
      } catch (error) {
        console.error('[pdf-tools-usage]', error)
      }
    },
    [authReady, currentUser],
  )

  function renderActiveTool() {
    if (activeTool === 'split_merge') {
      return <SplitMergeTool onUsage={handleUsage} />
    }

    if (activeTool === 'reorder_delete') {
      return <ReorderDeleteTool onUsage={handleUsage} />
    }

    if (activeTool === 'page_numbers') {
      return <PageNumbersTool onUsage={handleUsage} />
    }

    if (activeTool === 'watermark') {
      return <WatermarkTool onUsage={handleUsage} />
    }

    if (activeTool === 'to_word') {
      return <ConvertWordTool onUsage={handleUsage} />
    }

    if (activeTool === 'to_excel') {
      return <ConvertExcelTool onUsage={handleUsage} />
    }

    return <PdfToolHome onOpenTool={setActiveTool} />
  }

  return (
    <div className={joinClasses(workspaceStyles.page, styles.toolPage, styles.pdfToolsPage)}>
      <section className={styles.pdfToolsTopbar}>
        <div>
          <p className={workspaceStyles.eyebrow}>Document toolkit</p>
          <h1 className={workspaceStyles.pageTitle}>PDF Tools</h1>
          <p className={workspaceStyles.pageText}>
            One workspace for split/merge, page edits, watermarking, and conversion workflows.
          </p>
        </div>

        {activeTool ? (
          <button className={styles.uploadActionSecondary} onClick={() => setActiveTool('')} type="button">
            <span>Back to tools</span>
          </button>
        ) : (
          <span className={styles.invoiceMetaPill}>{TOOL_CARDS.length} tools available</span>
        )}
      </section>

      <article className={styles.invoiceMainCard}>
        {renderActiveTool()}

        <div className={styles.invoiceCardDivider} />

        <PdfHistoryPanel
          history={historyItems}
          historyError={historyError}
          historyStatus={historyStatus}
          totalsByTool={totalsByTool}
        />
      </article>
    </div>
  )
}
