// hooks/useEbaySettings.ts
import { useState, useEffect } from 'react'
import { ebayApi, type EbaySettings, type EbaySettingsResponse } from '../services/ebayApi'

export const useEbaySettings = () => {
  const [settings, setSettings] = useState<EbaySettings>({
    dashboard: { refresh_enabled: true, refresh_interval: 30 },
    sync: { auto_sync_enabled: true, sync_interval: 15 }
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSettings = async () => {
    setLoading(true)
    setError(null)
    try {
      const result: EbaySettingsResponse = await ebayApi.getSettings()
      if (result.success && result.data) {
        setSettings(result.data)
      } else {
        setError(result.error || 'Failed to load settings')
      }
    } catch (err) {
      console.error('Error fetching eBay settings:', err)
      setError('Failed to fetch settings from server')
    } finally {
      setLoading(false)
    }
  }

  const updateSettings = async (newSettings: Partial<EbaySettings>): Promise<boolean> => {
    setError(null)
    try {
      const result: EbaySettingsResponse = await ebayApi.updateSettings(newSettings)
      if (result.success && result.data) {
        setSettings(result.data)
        return true
      } else {
        setError(result.error || 'Failed to update settings')
        return false
      }
    } catch (err) {
      console.error('Error updating eBay settings:', err)
      setError('Failed to update settings on server')
      return false
    }
  }

  useEffect(() => {
    fetchSettings()
  }, [])

  return { 
    settings, 
    loading, 
    error, 
    updateSettings, 
    refetch: fetchSettings,
    setSettings // For local state updates if needed
  }
}