import { useState } from 'react'
import styles from './Workspace.module.css'
import WorkspaceIcon from './WorkspaceIcon'

const defaultPreferences = {
  includeMasters: true,
  autoCreate: true,
  validateGstin: false,
}

function joinClasses(...values) {
  return values.filter(Boolean).join(' ')
}

export default function TallyXmlConverterPage() {
  const [preferences, setPreferences] = useState(defaultPreferences)

  function togglePreference(key) {
    setPreferences((current) => ({ ...current, [key]: !current[key] }))
  }

  return (
    <div className={styles.page}>
      <section className={styles.pageIntro}>
        <div>
          <p className={styles.eyebrow}>Accounting tool</p>
          <h1 className={styles.pageTitle}>Tally XML Converter</h1>
          <p className={styles.pageText}>
            Upload a workbook or CSV file to prepare Tally XML output. Preview and history will populate after real conversions are available.
          </p>
        </div>
      </section>

      <section className={styles.converterGrid}>
        <div className={styles.converterMainColumn}>
          <article className={joinClasses(styles.panel, styles.uploadPanel)}>
            <div className={styles.panelHeader}>
              <div>
                <h2 className={styles.panelTitle}>Upload Source File</h2>
                <p className={styles.panelText}>
                  Supports .xlsx, .xls, and .csv formats. The upload pipeline is ready to be connected to your parser service.
                </p>
              </div>
            </div>

            <button className={styles.dropzone} type="button">
              <span className={styles.dropzoneIcon}>
                <WorkspaceIcon name="upload" size={28} />
              </span>
              <strong>Drop your file here</strong>
              <span>Upload a real workbook to start mapping columns.</span>
              <span className={styles.secondaryButton}>Browse Files</span>
            </button>
          </article>

          <article className={styles.emptyState}>
            <span className={styles.emptyStateIcon}>
              <WorkspaceIcon name="converter" size={22} />
            </span>
            <h2>No preview available yet</h2>
            <p className={styles.statusText}>
              Once a file is uploaded and parsed, the mapped preview will appear here instead of mock rows.
            </p>
          </article>
        </div>

        <div className={styles.converterSideColumn}>
          <article className={joinClasses(styles.panel, styles.preferencesPanel)}>
            <div className={styles.panelHeader}>
              <div>
                <h2 className={styles.panelTitle}>Export Preferences</h2>
                <p className={styles.panelText}>Choose how generated XML should be prepared.</p>
              </div>
            </div>

            <div className={styles.checkboxList}>
              <label className={styles.checkboxRow}>
                <input
                  checked={preferences.includeMasters}
                  onChange={() => togglePreference('includeMasters')}
                  type="checkbox"
                />
                <span>Include Master Ledgers</span>
              </label>
              <label className={styles.checkboxRow}>
                <input
                  checked={preferences.autoCreate}
                  onChange={() => togglePreference('autoCreate')}
                  type="checkbox"
                />
                <span>Auto-create Vouchers</span>
              </label>
              <label className={styles.checkboxRow}>
                <input
                  checked={preferences.validateGstin}
                  onChange={() => togglePreference('validateGstin')}
                  type="checkbox"
                />
                <span>Validate GSTINs</span>
              </label>
            </div>

            <button className={joinClasses(styles.gradientButton, styles.fullWidthButton)} type="button">
              Generate Tally XML
            </button>
          </article>
        </div>
      </section>

      <section className={styles.emptyState}>
        <span className={styles.emptyStateIcon}>
          <WorkspaceIcon name="file" size={22} />
        </span>
        <h2>No conversion history yet</h2>
        <p className={styles.statusText}>
          Real conversion runs will appear here after files are processed and stored.
        </p>
      </section>
    </div>
  )
}
