import { useState } from 'react'
import { PageHeader } from '@/shared/components'
import { FileInput } from '../../components/FileInput/FileInput'
import styles from './ReportPage.module.scss'

export function ReportPage() {
  const [outputSample, setOutputSample] = useState<File[]>([])
  const [inputs, setInputs] = useState<File[]>([])

  return (
    <>
      <PageHeader title="Report" description="Add a sample of the output you want and the files to build it from." />
      <div className={styles.sections}>
        <FileInput
          title="Output sample"
          description="One CSV or Excel file showing how the report should look."
          files={outputSample}
          onChange={setOutputSample}
        />
        <FileInput
          title="Inputs"
          description="The CSV or Excel files the report is built from."
          multiple
          files={inputs}
          onChange={setInputs}
        />
      </div>
    </>
  )
}
