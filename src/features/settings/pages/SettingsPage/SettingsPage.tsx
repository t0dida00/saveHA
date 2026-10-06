import { PortCodesEditor, CronScheduleEditor } from '@/features/ship-schedule'
import { PageHeader } from '@/shared/components'
import styles from './SettingsPage.module.scss'

export function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="When the weekly schedule runs, and the codes used when checking ship schedules." />
      <div className={styles.sections}>
        <PortCodesEditor />
        <CronScheduleEditor />
      </div>
    </>
  )
}
