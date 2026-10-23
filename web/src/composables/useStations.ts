import { ref, type Ref } from 'vue'
import { getCmdRaw } from '@/api'
import { parseStationList, type Station } from '@/utils/parse'

export interface UseStationsHandle {

  stations: Ref<Station[]>

  refresh: () => Promise<void>
}

export function useStations(): UseStationsHandle {
  const rawList = ref<unknown>(null)
  const stations = ref<Station[]>([])

  async function refresh(): Promise<void> {
    try {
      rawList.value = await getCmdRaw('station_list')
      stations.value = parseStationList(rawList.value)
    } catch {

    }
  }

  return { stations, refresh }
}
