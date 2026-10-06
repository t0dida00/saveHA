import type { ScheduleFile } from '../types'
import { readDayCache, storeDayCache } from '../utils/dayCache'

const STORAGE_KEY = 'saveha.shipSchedule.latest'

/** The latest scheduled file fetched within the last day, or undefined */
export const readCachedLatest = () => readDayCache<ScheduleFile>(STORAGE_KEY)

export const storeCachedLatest = (file: ScheduleFile) => storeDayCache(STORAGE_KEY, file)
