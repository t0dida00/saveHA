import { PortCodesEditor } from '@/features/ship-schedule'
import { PageHeader } from '@/shared/components'

export function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="Codes used when checking ship schedules." />
      <PortCodesEditor />
    </>
  )
}
