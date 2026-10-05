import { useCallback, useState } from 'react'
import { portChoices, SERVICES, SERVICES_BY_CODE } from '../data/services'
import type { PortSide, ScheduleSelection, ServiceRoute } from '../types'

const STORAGE_KEY = 'saveha.shipSchedule.selection'

export const WEEK_OPTIONS = [2, 4, 6, 8]
const DEFAULT_WEEKS = 8

function today() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

function defaultSelection(): ScheduleSelection {
  return { startDate: today(), weeks: DEFAULT_WEEKS, services: [] }
}

// Only the services and their ports are stored. Date and weeks always start at their defaults.
// Keep only services that still exist in the catalogue; ports are kept as saved.
const ports = (value: unknown) =>
  Array.isArray(value) ? [...new Set(value.filter((port): port is string => typeof port === 'string'))] : []

function loadServices(): ServiceRoute[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const stored = JSON.parse(raw) as { services?: ServiceRoute[] }
    return (Array.isArray(stored.services) ? stored.services : []).flatMap((route) => {
      const service = SERVICES_BY_CODE.get(route?.code)
      if (!service) return []
      return [
        {
          code: service.code,
          origins: ports(route.origins),
          destinations: ports(route.destinations),
        },
      ]
    })
  } catch {
    return []
  }
}

export function useScheduleSelection() {
  const [selection, setSelection] = useState(() => ({ ...defaultSelection(), services: loadServices() }))
  // What Save last wrote (or what was loaded), to tell whether the services have unsaved changes
  const [savedJson, setSavedJson] = useState(() => JSON.stringify(selection.services))
  const isDirty = JSON.stringify(selection.services) !== savedJson

  // Returns false when storage is unavailable (private mode, blocked)
  const save = useCallback(() => {
    const json = JSON.stringify(selection.services)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ services: selection.services }))
    } catch {
      return false
    }
    setSavedJson(json)
    return true
  }, [selection.services])

  const setStartDate = useCallback((startDate: string) => setSelection((s) => ({ ...s, startDate })), [])

  const setWeeks = useCallback((weeks: number) => setSelection((s) => ({ ...s, weeks })), [])

  // A newly added service starts with all of its ports selected
  const toggleService = useCallback((code: string) => {
    setSelection((s) => {
      if (s.services.some((route) => route.code === code)) {
        return { ...s, services: s.services.filter((route) => route.code !== code) }
      }
      const service = SERVICES_BY_CODE.get(code)
      if (!service) return s
      const route = { code, origins: [...service.origins], destinations: [...service.destinations] }
      return { ...s, services: [...s.services, route] }
    })
  }, [])

  // All selected: deselect every service. Otherwise add the missing ones (with default ports) and keep the rest.
  const toggleAllServices = useCallback(() => {
    setSelection((s) => {
      if (s.services.length === SERVICES.length) return { ...s, services: [] }
      const services = SERVICES.map(
        (service) =>
          s.services.find((route) => route.code === service.code) ?? {
            code: service.code,
            origins: [...service.origins],
            destinations: [...service.destinations],
          },
      )
      return { ...s, services }
    })
  }, [])

  // Drag and drop: move a service to where another one is. The order is kept by Save and used for the request.
  const moveService = useCallback((code: string, overCode: string) => {
    setSelection((s) => {
      const from = s.services.findIndex((route) => route.code === code)
      const to = s.services.findIndex((route) => route.code === overCode)
      if (from < 0 || to < 0 || from === to) return s
      const services = [...s.services]
      services.splice(to, 0, ...services.splice(from, 1))
      return { ...s, services }
    })
  }, [])

  const resetAllRoutes = useCallback(() => {
    setSelection((s) => ({
      ...s,
      services: s.services.map((route) => {
        const service = SERVICES_BY_CODE.get(route.code)
        return service
          ? { code: service.code, origins: [...service.origins], destinations: [...service.destinations] }
          : route
      }),
    }))
  }, [])

  const togglePort = useCallback((code: string, side: PortSide, port: string) => {
    setSelection((s) => ({
      ...s,
      services: s.services.map((route) => {
        if (route.code !== code) return route
        const ports = route[side].includes(port)
          ? route[side].filter((p) => p !== port)
          : // Keep the order the card shows (Settings order)
            portChoices(side, [...route[side], port]).filter((p) => p === port || route[side].includes(p))
        return { ...route, [side]: ports }
      }),
    }))
  }, [])

  // Throws away unsaved changes: services go back to what Save last wrote (date and weeks aren't saved, so they stay)
  const cancelChanges = useCallback(
    () => setSelection((s) => ({ ...s, services: JSON.parse(savedJson) as ServiceRoute[] })),
    [savedJson],
  )

  return {
    selection,
    isDirty,
    save,
    setStartDate,
    setWeeks,
    toggleService,
    toggleAllServices,
    togglePort,
    resetAllRoutes,
    moveService,
    cancelChanges,
  }
}
