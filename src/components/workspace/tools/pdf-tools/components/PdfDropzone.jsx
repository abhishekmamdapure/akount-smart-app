import { useCallback, useRef, useState } from 'react'
import WorkspaceIcon from '../../../WorkspaceIcon'
import styles from '../../shared/Tools.module.css'
import { joinClasses } from './helpers'

export default function PdfDropzone({
  accept = '.pdf,application/pdf',
  disabled = false,
  file,
  hint,
  meta = [],
  multiple = false,
  onFiles,
  title,
}) {
  const inputRef = useRef(null)
  const [dragActive, setDragActive] = useState(false)

  const handleFiles = useCallback(
    (fileList) => {
      const files = Array.from(fileList || [])

      if (files.length === 0) {
        return
      }

      onFiles(multiple ? files : files[0])
    },
    [multiple, onFiles],
  )

  return (
    <>
      <div
        className={joinClasses(
          styles.dropzone,
          dragActive && styles.dropzoneActive,
          disabled && styles.dropzoneDisabled,
        )}
        onClick={() => {
          if (!disabled) {
            inputRef.current?.click()
          }
        }}
        onDragEnter={(event) => {
          event.preventDefault()
          if (!disabled) {
            setDragActive(true)
          }
        }}
        onDragLeave={(event) => {
          event.preventDefault()
          setDragActive(false)
        }}
        onDragOver={(event) => {
          event.preventDefault()
        }}
        onDrop={(event) => {
          event.preventDefault()
          setDragActive(false)

          if (!disabled) {
            handleFiles(event.dataTransfer?.files)
          }
        }}
        role="presentation"
      >
        <span className={styles.uploadIcon}>
          <WorkspaceIcon name="upload" size={18} />
        </span>
        <strong>{file ? file.name : title}</strong>
        <p>{hint}</p>
        {meta.length > 0 ? (
          <div className={styles.dropzoneMeta}>
            {meta.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        ) : null}
      </div>

      <input
        accept={accept}
        multiple={multiple}
        onChange={(event) => handleFiles(event.target.files)}
        ref={inputRef}
        style={{ display: 'none' }}
        type="file"
      />
    </>
  )
}
