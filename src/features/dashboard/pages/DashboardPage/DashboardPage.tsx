import { PageHeader } from '@/shared/components'
import { OneCard } from '../../components/OneCard/OneCard'
import styles from './DashboardPage.module.scss'

export function DashboardPage() {
  return (
    <>
      <PageHeader title="Dashboard" description="The weekly schedule job at a glance." />
      <div className={styles.cards}>
        <OneCard />
      </div>
    </>
  )
}
