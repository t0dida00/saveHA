import { PageHeader } from '@/shared/components'
import { CarrierCard } from '../../components/CarrierCard/CarrierCard'
import styles from './DashboardPage.module.scss'

export function DashboardPage() {
  return (
    <>
      <PageHeader title="Dashboard" description="Each carrier's schedule at a glance." />
      <div className={styles.cards}>
        <CarrierCard carrier="one" />
        <CarrierCard carrier="hpl" />
        <CarrierCard carrier="cma" />
      </div>
    </>
  )
}
