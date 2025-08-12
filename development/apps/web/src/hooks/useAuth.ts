import { useSupabase } from '../providers/SupabaseProvider'

export const useAuth = () => {
  return useSupabase()
}
