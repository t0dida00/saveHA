import { useCallback, useState } from 'react'
import { renameCarrierPort } from '../data/portCodesStore'
import { findService, portChoices, SERVICES, type Carrier } from '../data/services'
import type { PortSide, ServiceRoute } from '../types'

// ONE keeps its original key so saved selections survive
const STORAGE_KEYS: Record<Carrier, string> = {
  one: 'saveha.shipSchedule.selection',
  hpl: 'saveha.shipSchedule.hpl.selection',
  cma: 'saveha.shipSchedule.cma.selection',
}

export const WEEK_OPTIONS = [2, 4, 6, 8]
export const DEFAULT_WEEKS = 8

export function today() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

// Only the services and their ports are stored. Date and weeks always start at their defaults.
// Keep only services that still exist in the catalogue; ports are kept as saved.
const ports = (value: unknown) =>
  Array.isArray(value)
    ? [...new Set(value.filter((port): port is string => typeof port === 'string').map(renameCarrierPort))]
    : []

const defaultRoute = ({ code, origins, destinations }: ServiceRoute): ServiceRoute => ({
  code,
  origins: [...origins],
  destinations: [...destinations],
})

function loadServices(carrier: Carrier): ServiceRoute[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS[carrier])
    if (!raw) return []
    const stored = JSON.parse(raw) as { services?: ServiceRoute[] }
    return (Array.isArray(stored.services) ? stored.services : []).flatMap((route) => {
      const service = findService(carrier, route?.code)
      if (!service) return []
      return [{ code: service.code, origins: ports(route.origins), destinations: ports(route.destinations) }]
    })
  } catch {
    return []
  }
}

/** One carrier's chosen services and their ports, saved in this browser per carrier */
export function useScheduleSelection(carrier: Carrier) {
  const [services, setServices] = useState(() => loadServices(carrier))
  // What Save last wrote (or what was loaded), to tell whether the services have unsaved changes
  const [savedJson, setSavedJson] = useState(() => JSON.stringify(services))
  const isDirty = JSON.stringify(services) !== savedJson
  const catalogue = SERVICES[carrier]

  // Returns false when storage is unavailable (private mode, blocked)
  const save = useCallback(() => {
    const json = JSON.stringify(services)
    try {
      localStorage.setItem(STORAGE_KEYS[carrier], JSON.stringify({ services }))
    } catch {
      return false
    }
    setSavedJson(json)
    return true
  }, [carrier, services])

  // A newly added service starts with all of its ports selected
  const toggleService = useCallback(
    (code: string) => {
      setServices((current) => {
        if (current.some((route) => route.code === code)) return current.filter((route) => route.code !== code)
        const service = findService(carrier, code)
        return service ? [...current, defaultRoute(service)] : current
      })
    },
    [carrier],
  )

  // All selected: deselect every service. Otherwise add the missing ones (with default ports) and keep the rest.
  const toggleAllServices = useCallback(() => {
    setServices((current) =>
      current.length === catalogue.length
        ? []
        : catalogue.map((service) => current.find((route) => route.code === service.code) ?? defaultRoute(service)),
    )
  }, [catalogue])

  // Drag and drop: move a service to where another one is. The order is kept by Save and used for the request.
  const moveService = useCallback((code: string, overCode: string) => {
    setServices((current) => {
      const from = current.findIndex((route) => route.code === code)
      const to = current.findIndex((route) => route.code === overCode)
      if (from < 0 || to < 0 || from === to) return current
      const next = [...current]
      next.splice(to, 0, ...next.splice(from, 1))
      return next
    })
  }, [])

  const togglePort = useCallback((code: string, side: PortSide, port: string) => {
    setServices((current) =>
      current.map((route) => {
        if (route.code !== code) return route
        const ports = route[side].includes(port)
          ? route[side].filter((p) => p !== port)
          : // Keep the order the card shows (Settings order)
            portChoices(side, [...route[side], port]).filter((p) => p === port || route[side].includes(p))
        return { ...route, [side]: ports }
      }),
    )
  }, [])

  // Throws away unsaved changes: services go back to what Save last wrote
  const cancelChanges = useCallback(() => setServices(JSON.parse(savedJson) as ServiceRoute[]), [savedJson])

  return {
    services,
    isDirty,
    save,
    toggleService,
    toggleAllServices,
    togglePort,
    moveService,
    cancelChanges,
  }
}
