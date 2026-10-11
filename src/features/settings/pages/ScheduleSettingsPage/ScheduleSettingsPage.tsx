import { PortCodesEditor, CronScheduleEditor } from '@/features/ship-schedule'
import { PageHeader } from '@/shared/components'
import styles from './ScheduleSettingsPage.module.scss'

export function ScheduleSettingsPage() {
  return (
    <>
      <PageHeader
        title="Schedule settings"
        description="When the weekly schedule runs, and the codes used when checking ship schedules."
      />
      <div className={styles.sections}>
        <PortCodesEditor />
        <CronScheduleEditor />
      </div>
    </>
  )
}
