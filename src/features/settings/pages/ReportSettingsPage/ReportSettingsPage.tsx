import { useId } from 'react'
import {
  MappingTable,
  ShortNamesEditor,
  TradeLists,
  useReportMapping,
  useShortNames,
  useTradePorts,
} from '@/features/report'
import { PageHeader } from '@/shared/components'
import styles from './ReportSettingsPage.module.scss'

export function ReportSettingsPage() {
  const mappingTitleId = useId()
  const tradeTitleId = useId()
  const shortNamesTitleId = useId()
  const { mapping, setMapping } = useReportMapping()
  const { ports, setPorts } = useTradePorts()
  const { shortNames, setShortNames } = useShortNames()

  return (
    <>
      <PageHeader title="Report settings" description="Settings for building the report." />
      <div className={styles.sections}>
        <section className={styles.section} aria-labelledby={mappingTitleId}>
          <div className={styles.head}>
            <div>
              <h2 id={mappingTitleId} className={styles.title}>
                Column mapping
              </h2>
              <p className={styles.description}>
                Which column of each input fills each column of the report. Columns are found by their titles, so they
                can be in any order in the files. Changes are saved in this browser and used for the next report.
              </p>
            </div>
          </div>

          <ul className={styles.help}>
            <li>Click a cell to change it. Enter saves, Escape cancels.</li>
            <li>
              Type the input's column title, like <code>Carrier Bkg. No.</code> To try several, join them with{' '}
              <code>or</code>: <code>MAWB No. or MB/L No.</code>
            </li>
            <li>
              A value in quotes, like <code>"XX"</code>, is written on every row. Leave a cell empty to leave the column
              empty; Teus and Trade are then calculated.
            </li>
            <li>The top row is the report's column titles, as the output sample has them.</li>
          </ul>

          <MappingTable mapping={mapping} onChange={setMapping} />
        </section>

        <section className={styles.section} aria-labelledby={shortNamesTitleId}>
          <div className={styles.head}>
            <div>
              <h2 id={shortNamesTitleId} className={styles.title}>
                Short names
              </h2>
              <p className={styles.description}>
                Values written shorter in a column of the report, like FREE CARGO as BCO in Customer type. They match
                without case or extra spaces, and apply whichever file or lookup filled the column.
              </p>
            </div>
          </div>
          <ShortNamesEditor shortNames={shortNames} onChange={setShortNames} titles={mapping.outputTitles} />
        </section>

        <section className={styles.section} aria-labelledby={tradeTitleId}>
          <div className={styles.head}>
            <div>
              <h2 id={tradeTitleId} className={styles.title}>
                Trade lanes
              </h2>
              <p className={styles.description}>
                The Trade column comes from POD: a port on the TP list gives TP, and so on. Names match without INT'L,
                AIRPORT or PT, and a longer name containing a listed one counts too (HARTSFIELD JACKSON ATLANTA has
                ATLANTA). A port on no list is Other.
              </p>
            </div>
          </div>
          <TradeLists ports={ports} onChange={setPorts} />
        </section>
      </div>
    </>
  )
}
